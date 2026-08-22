/**
 * 完成课程云对象
 * 功能：课程完成、试课结算、信息费处理
 *
 * 交易结算规则（2026/06）：
 * 1) 教师信息费（order_type='deposit'，金额=hourly_rate × 2）在聊天开启时支付：
 *    · 无论试课成功/失败，信息费均归平台收取，不退回
 * 2) 试课费分账：
 *    · 试课成功 → 教师收入 = 100% × original_amount
 *    · 试课失败 → 教师收入 = 70% × original_amount；家长自动退款 30% × actualPaidAmount
 * 3) 对外接口：
 *    · confirmTrialSuccess(appointment_id) — 家长确认试课满意
 *    · confirmTrialFail(appointment_id, reason) — 家长确认试课不满意
 *    · completeCourse(appointment_id) — 正式课程完成
 */

const { resolveAppointmentAttendance } = require('./appointment-attendance-resolver.js')

// 工具函数（内嵌）
function success(data = null, message = 'success') {
  return {
    code: 0,
    message,
    data,
    timestamp: Date.now()
  }
}

function error(message = 'error', code = -1, data = null) {
  return {
    code,
    message,
    data,
    timestamp: Date.now()
  }
}

/**
 * 计算排课结束时间戳（兼容 schedule / appointment_date 等多字段）
 * @param {Object} appointment 预约信息
 * @returns {Number|null} 结束时间戳（毫秒）
 */
function getAppointmentEndTimestamp(appointment) {
  if (!appointment) return null
  const schedule = appointment.schedule || {}
  const date = schedule.date || appointment.appointment_date || appointment.date
  const startTime = schedule.start_time || appointment.appointment_time || appointment.start_time
  const duration = Number(schedule.duration || appointment.duration || 0)

  if (!date || !startTime) return null

  const startDate = new Date(`${String(date).replace(/-/g, '/')} ${startTime}`)
  if (Number.isNaN(startDate.getTime())) return null

  if (schedule.end_time) {
    const endDate = new Date(`${String(date).replace(/-/g, '/')} ${schedule.end_time}`)
    if (!Number.isNaN(endDate.getTime())) return endDate.getTime()
  }

  if (duration <= 0) return null
  return startDate.getTime() + duration * 3600 * 1000
}

/**
 * 家长确认/结算前置：教师已下课打卡则视为课程已结束，不再校验排课结束时间
 */
function assertReadyForParentConfirm(appointment) {
  if (!appointment.class_ended_at) {
    return { ok: false, message: '教师尚未下课打卡，无法确认结果，请稍后再试' }
  }
  return { ok: true }
}

async function loadResolvedAppointment(db, appointment_id) {
  const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
  if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
    return null
  }
  const appointment = appointmentDoc.data[0]
  await resolveAppointmentAttendance(db, appointment, { persistHeal: true })
  return appointment
}

function roundCurrency(value) {
  const num = Number(value) || 0
  return Number(num.toFixed(2))
}

async function getLatestPaidCourseOrder(db, appointmentId) {
  const dbCmd = db.command
  const orderDoc = await db.collection('payment-orders')
    .where({
      appointment_id: appointmentId,
      order_type: 'course_fee',
      status: dbCmd.in(['paid', 'success'])
    })
    .orderBy('payment_time', 'desc')
    .limit(1)
    .get()
  return orderDoc.data && orderDoc.data.length > 0 ? orderDoc.data[0] : null
}

function buildSettlementResult(appointment, paymentOrder) {
  const originalAmount = roundCurrency(
    paymentOrder
      ? Number(paymentOrder.original_amount || paymentOrder.total_amount || appointment.total_amount || 0)
      : Number(appointment.total_amount || 0)
  )
  const actualPaidAmount = roundCurrency(
    paymentOrder
      ? Number(paymentOrder.amount || 0)
      : Number(appointment.total_amount || 0)
  )
  const discountAmount = roundCurrency(paymentOrder ? Number(paymentOrder.discount_amount || 0) : 0)
  // 基础结果；试课/正式课的中介费与教师收入由调用方按业务规则覆盖
  const teacherIncome = actualPaidAmount > 0 ? actualPaidAmount : originalAmount
  return {
    originalAmount,
    actualPaidAmount,
    discountAmount,
    hasCoupon: !!(paymentOrder && paymentOrder.user_coupon_id),
    platformFee: 0,
    teacherIncome: roundCurrency(teacherIncome)
  }
}

/**
 * 课程/试课收入：统一打到微信零钱（钱包已暂时停用，失败不再入余额）
 */
async function settleTeacherIncome(teacherId, income = 0, meta = {}) {
  const incomeNum = roundCurrency(income)
  if (incomeNum <= 0) {
    return { settled: false, duplicate: false, auto_transferred: false }
  }

  const db = uniCloud.database()
  const isInfoFeeRefund = meta.source === 'info_fee_refund'
  if (meta.appointment_id) {
    const dupWhere = isInfoFeeRefund
      ? {
          teacher_id: teacherId,
          appointment_id: meta.appointment_id,
          source: 'info_fee_refund'
        }
      : {
          teacher_id: teacherId,
          appointment_id: meta.appointment_id,
          type: 'income'
        }
    const existingTransactionDoc = await db.collection('teacher-transactions')
      .where(dupWhere)
      .limit(1)
      .get()
    if (existingTransactionDoc.data && existingTransactionDoc.data.length > 0) {
      console.log('[结算] 已存在流水，跳过重复结算:', {
        teacher_id: teacherId,
        appointment_id: meta.appointment_id,
        source: meta.source
      })
      return { settled: false, duplicate: true, auto_transferred: false }
    }
  }

  try {
    const teacherWallet = uniCloud.importObject('teacher-wallet', { customUI: true })
    const remark = isInfoFeeRefund
      ? '信息费退还到账'
      : (meta.course_type === 'trial' ? '试课收入到账' : '课程收入到账')
    const res = await teacherWallet.settleToWechat({
      teacher_id: teacherId,
      amount: incomeNum,
      appointment_id: meta.appointment_id || '',
      remark,
      income_title: isInfoFeeRefund ? '信息费退还' : (meta.course_type === 'trial' ? '试课收入' : '课程收入'),
      income_type: isInfoFeeRefund ? 'refund' : 'income',
      income_source: meta.source || 'appointment_complete',
      disable_wallet_fallback: true
    })
    if (res && res.code === 0) {
      const data = res.data || {}
      const ok = !!(data.settled || data.auto_transferred || data.need_confirm || data.skipped)
      return {
        settled: ok,
        duplicate: false,
        auto_transferred: !!data.auto_transferred,
        need_confirm: !!data.need_confirm,
        teacher_paid_wechat: !!(data.auto_transferred || data.need_confirm || data.status === 'pending'),
        fail_reason: data.fail_reason || '',
        transfer: data
      }
    }
    console.warn('[结算] 微信打款失败（不再入钱包）:', res && res.message)
    return {
      settled: false,
      duplicate: false,
      auto_transferred: false,
      fail_reason: (res && res.message) || '微信打款失败'
    }
  } catch (e) {
    console.error('[结算] 微信打款异常（不再入钱包）:', e)
    return {
      settled: false,
      duplicate: false,
      auto_transferred: false,
      fail_reason: e.message || '微信打款异常'
    }
  }
}

/**
 * 确保教师钱包存在，如果不存在则创建
 * @param {String} teacherId 教师ID
 * @returns {Object} 钱包对象
 */
async function ensureTeacherWallet(teacherId) {
  const db = uniCloud.database()
  const walletCollection = db.collection('teacher-wallet')
  
  // 查询钱包
  const walletDoc = await walletCollection.where({ teacher_id: teacherId }).get()
  
  if (walletDoc.data && walletDoc.data.length > 0) {
    return walletDoc.data[0]
  }
  
  // 如果不存在，创建钱包
  const now = Date.now()
  const result = await walletCollection.add({
    teacher_id: teacherId,
    balance: 0,
    frozen_amount: 0,
    total_income: 0,
    total_withdraw: 0,
    deposit_total: 0,
    deposit_refunded: 0,
    create_time: now,
    update_time: now
  })
  
  // 返回新创建的钱包
  const newWalletDoc = await walletCollection.doc(result.id).get()
  return newWalletDoc.data[0]
}

/**
 * 更新教师钱包余额，并记录一条交易流水
 * @param {String} teacherId 教师ID
 * @param {Number} income 收入金额
 * @param {Number} depositAmount 信息费退还金额（可选，仅试课失败场景）
 * @param {Object} meta 额外信息：{ appointment_id, course_type, source }
 */
async function updateTeacherWallet(teacherId, income = 0, depositAmount = 0, meta = {}) {
  const wallet = await ensureTeacherWallet(teacherId)
  const db = uniCloud.database()
  const transactionCollection = db.collection('teacher-transactions')
  
  const updateData = {
    update_time: Date.now()
  }
  
  // 确保金额是数字类型，并保留两位小数
  const incomeNum = Number(income) || 0
  const depositNum = Number(depositAmount) || 0
  
  let incomeRounded = 0

  if (meta.appointment_id && incomeNum > 0) {
    const existingTransactionDoc = await transactionCollection
      .where({
        teacher_id: teacherId,
        appointment_id: meta.appointment_id,
        type: 'income'
      })
      .limit(1)
      .get()
    if (existingTransactionDoc.data && existingTransactionDoc.data.length > 0) {
      const existingTransaction = existingTransactionDoc.data[0]
      await transactionCollection.doc(existingTransaction._id).update({
        title: meta.course_type === 'trial' ? '试课收入' : '课程收入',
        description: meta.appointment_id
          ? `预约 ${meta.appointment_id} 完成，收入结算`
          : '课程完成收入结算',
        amount: roundCurrency(incomeNum),
        status: 'completed',
        source: meta.source || 'appointment_complete',
        update_time: Date.now()
      })
      console.log('[钱包更新] 已存在交易记录，跳过重复入账:', {
        teacher_id: teacherId,
        appointment_id: meta.appointment_id,
        transaction_id: existingTransaction._id
      })
      return {
        settled: false,
        duplicate: true,
        wallet
      }
    }
  }
  
  if (incomeNum > 0) {
    // 确保金额精度，保留两位小数
    incomeRounded = Number(incomeNum.toFixed(2))
    updateData.balance = Number(((wallet.balance || 0) + incomeRounded).toFixed(2))
    updateData.total_income = Number(((wallet.total_income || 0) + incomeRounded).toFixed(2))
    console.log(`[钱包更新] 收入: ${incomeRounded}元, 余额: ${updateData.balance}元, 总收入: ${updateData.total_income}元`)
  }
  
  let depositRounded = 0
  if (depositNum > 0) {
    depositRounded = Number(depositNum.toFixed(2))
    updateData.balance = Number(((updateData.balance || wallet.balance || 0) + depositRounded).toFixed(2))
    updateData.deposit_refunded = Number(((wallet.deposit_refunded || 0) + depositRounded).toFixed(2))
    console.log(`[钱包更新] 信息费退还: ${depositRounded}元`)
  }
  
  await db.collection('teacher-wallet').doc(wallet._id).update(updateData)
  
  console.log(`[钱包更新完成] teacherId=${teacherId}, income=${incomeNum}元, deposit=${depositNum}元, 最终余额=${updateData.balance || wallet.balance}元`)
  
  // 如果有有效收入，顺带写一条交易记录，供教师钱包“收支明细”展示
  try {
    if (incomeRounded > 0) {
      const now = Date.now()
      const transaction = {
        teacher_id: teacherId,
        type: 'income',
        title: meta.course_type === 'trial' ? '试课收入' : '课程收入',
        description: meta.appointment_id
          ? `预约 ${meta.appointment_id} 完成，收入结算`
          : '课程完成收入结算',
        amount: incomeRounded,
        status: 'completed',
        appointment_id: meta.appointment_id || null,
        source: meta.source || 'appointment_complete',
        create_time: now,
        update_time: now
      }
      await transactionCollection.add(transaction)
      console.log('[钱包更新] 已写入教师交易记录:', {
        teacher_id: teacherId,
        amount: incomeRounded,
        appointment_id: meta.appointment_id
      })
    }
  } catch (e) {
    console.error('[钱包更新] 写入教师交易记录失败:', e)
    // 不影响主流程
  }

  // 信息费退还也写一条教师钱包流水，便于收支明细展示
  try {
    if (depositRounded > 0) {
      const now = Date.now()
      const transaction = {
        teacher_id: teacherId,
        type: 'refund',
        title: '信息费退还',
        description: meta.appointment_id
          ? `预约 ${meta.appointment_id} 试课未成功，信息费已退回`
          : '信息费退还',
        amount: depositRounded,
        status: 'completed',
        appointment_id: meta.appointment_id || null,
        source: meta.source || 'info_fee_refund',
        create_time: now,
        update_time: now
      }
      await transactionCollection.add(transaction)
      console.log('[钱包更新] 已写入信息费退还流水:', {
        teacher_id: teacherId,
        amount: depositRounded,
        appointment_id: meta.appointment_id
      })
    }
  } catch (e) {
    console.error('[钱包更新] 写入信息费退还流水失败:', e)
  }

  return {
    settled: incomeRounded > 0 || depositRounded > 0,
    duplicate: false,
    wallet
  }
}

/**
 * 累计学生 = 预约过试课的去重家长数（邀请发出即算）
 */
async function countAcceptedTrialStudents(db, teacher_id) {
  const dbCmd = db.command
  const agg = await db.collection('appointments')
    .aggregate()
    .match({
      teacher_id,
      course_type: 'trial',
      status: dbCmd.in([
        'trial_invited',
        'pending_payment',
        'pending_confirm',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'refunded'
      ])
    })
    .group({
      _id: '$parent_id'
    })
    .count('total')
    .end()

  return agg.data && agg.data.length > 0 ? Number(agg.data[0].total || 0) : 0
}

/** 解析微信支付 out_trade_no */
async function resolveOutTradeNo(db, order) {
  if (!order) return null
  if (order.out_trade_no) return order.out_trade_no
  if (order.order_no) {
    try {
      const uniPayDoc = await db.collection('uni-pay-orders')
        .where({ order_no: order.order_no })
        .limit(1)
        .get()
      if (uniPayDoc.data && uniPayDoc.data.length > 0 && uniPayDoc.data[0].out_trade_no) {
        return uniPayDoc.data[0].out_trade_no
      }
    } catch (e) {
      console.warn('[resolveOutTradeNo] 通过 order_no 查找失败:', e.message)
    }
  }
  if (order.appointment_id) {
    try {
      const uniPayDoc = await db.collection('uni-pay-orders')
        .where({ 'custom.appointment_id': order.appointment_id })
        .limit(1)
        .get()
      if (uniPayDoc.data && uniPayDoc.data.length > 0 && uniPayDoc.data[0].out_trade_no) {
        return uniPayDoc.data[0].out_trade_no
      }
    } catch (e) {
      console.warn('[resolveOutTradeNo] 通过 appointment_id 查找失败:', e.message)
    }
  }
  return null
}

/**
 * 试课失败时自动向家长退还部分试课费（微信原路退回）
 * @returns {{ success: boolean, refundAmount: number, message?: string }}
 */
async function executeParentPartialRefund(db, paymentOrder, refundAmount, appointment) {
  const amount = roundCurrency(refundAmount)
  if (!paymentOrder || amount <= 0) {
    return { success: true, refundAmount: 0, skipped: true }
  }
  if (paymentOrder.auto_partial_refunded) {
    return { success: true, refundAmount: paymentOrder.auto_partial_refund_amount || amount, skipped: true }
  }

  const actualPaid = roundCurrency(Number(paymentOrder.amount || 0))
  const safeRefund = Math.min(amount, actualPaid)
  if (safeRefund <= 0) {
    return { success: true, refundAmount: 0, skipped: true }
  }

  const out_trade_no = await resolveOutTradeNo(db, paymentOrder)
  if (!out_trade_no) {
    console.error('[executeParentPartialRefund] 未找到 out_trade_no', paymentOrder._id)
    return { success: false, refundAmount: safeRefund, message: '未找到支付单号，无法自动退款' }
  }

  const out_refund_no = `TRIAL30_${String(paymentOrder._id).slice(-8)}_${Date.now()}`
  const uniPayCo = uniCloud.importObject('uni-pay-co', { customUI: true })
  const refundRes = await uniPayCo.refund({
    out_trade_no,
    out_refund_no,
    refund_fee: Math.round(safeRefund * 100),
    refund_desc: '试课不满意，退还30%试课费'
  })

  if (!refundRes || refundRes.errCode !== 0) {
    console.error('[executeParentPartialRefund] uni-pay 退款失败:', refundRes)
    return {
      success: false,
      refundAmount: safeRefund,
      message: (refundRes && refundRes.errMsg) || '家长退款失败'
    }
  }

  const now = Date.now()
  await db.collection('payment-orders').doc(paymentOrder._id).update({
    auto_partial_refunded: true,
    auto_partial_refund_amount: safeRefund,
    auto_partial_refund_time: now,
    refund_amount: safeRefund,
    update_time: now
  })

  try {
    await db.collection('payment-refunds').add({
      order_id: paymentOrder._id,
      order_no: paymentOrder.order_no,
      appointment_id: appointment._id,
      payer_id: appointment.parent_id,
      amount: safeRefund,
      reason: '试课不满意自动退款30%',
      refund_type: 'only_refund',
      description: '系统自动：试课失败家长获得30%试课费退款',
      status: 'success',
      teacher_review_status: 'approved',
      teacher_id: appointment.teacher_id,
      create_time: now,
      update_time: now,
      finish_time: now
    })
  } catch (e) {
    console.warn('[executeParentPartialRefund] 写入退款记录失败（不影响主流程）:', e)
  }

  return { success: true, refundAmount: safeRefund }
}

module.exports = {
  _before: function() {
    // 云对象前置方法
  },
  
  /**
   * 家长确认试课成功
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @returns {Object}
   */
  async confirmTrialSuccess(params) {
    const { appointment_id } = params
    
    try {
      const db = uniCloud.database()
      
      const appointment = await loadResolvedAppointment(db, appointment_id)
      if (!appointment) {
        return error('预约不存在')
      }
      
      // 3. 验证状态（权限验证已在调用方完成）
      
      if (appointment.course_type !== 'trial') {
        return error('只有试课可以确认成功')
      }
      
      if (!['pending_confirm', 'confirmed', 'in_progress'].includes(appointment.status)) {
        return error('当前预约状态不允许确认')
      }

      const readyCheck = assertReadyForParentConfirm(appointment)
      if (!readyCheck.ok) {
        return error(readyCheck.message)
      }

      // 4. 查询支付订单，获取原价和优惠金额（如果使用了优惠券）
      const paymentOrder = await getLatestPaidCourseOrder(db, appointment_id)
      const settlement = buildSettlementResult(appointment, paymentOrder)
      // 试课成功：教师获得 100% 试课费（以原价 original_amount 为基数）
      settlement.teacherIncome = roundCurrency(settlement.originalAmount)
      settlement.platformFee = roundCurrency(Math.max(0, settlement.actualPaidAmount - settlement.teacherIncome))
      
      console.log('[confirmTrialSuccess] 支付订单信息:', {
        appointment_id,
        originalAmount: settlement.originalAmount,
        discountAmount: settlement.discountAmount,
        hasCoupon: settlement.hasCoupon,
        paymentOrder: paymentOrder ? {
          order_no: paymentOrder.order_no,
          original_amount: paymentOrder.original_amount,
          discount_amount: paymentOrder.discount_amount,
          user_coupon_id: paymentOrder.user_coupon_id
        } : null
      })
      
      console.log('[confirmTrialSuccess] 试课成功结算（100% 给教师）:', {
        appointment_id,
        course_type: appointment.course_type,
        originalAmount: settlement.originalAmount,
        actualPaidAmount: settlement.actualPaidAmount,
        teacherIncome: settlement.teacherIncome,
        platformFee: settlement.platformFee
      })
      
      // 6. 更新预约状态与结算字段
      const settlementTime = Date.now()
      await db.collection('appointments').doc(appointment_id).update({
        status: 'completed',
        complete_time: settlementTime,
        trial_result: 'success',
        platform_fee: settlement.platformFee,
        teacher_income: settlement.teacherIncome,
        wallet_settled: false,
        wallet_settlement_amount: settlement.teacherIncome,
        update_time: settlementTime
      })
      
      // 7. 教师收入：优先自动到微信零钱
      const walletResult = await settleTeacherIncome(appointment.teacher_id, settlement.teacherIncome, {
        appointment_id,
        course_type: appointment.course_type,
        source: 'trial_complete'
      })
      const paidWechat = !!(walletResult.teacher_paid_wechat || walletResult.auto_transferred || walletResult.need_confirm)
      await db.collection('appointments').doc(appointment_id).update({
        wallet_settled: false,
        teacher_paid_wechat: paidWechat || !!walletResult.duplicate,
        teacher_pay_status: walletResult.need_confirm
          ? 'wait_confirm'
          : (walletResult.auto_transferred ? 'ok' : (walletResult.fail_reason ? 'failed' : '')),
        teacher_pay_fail_reason: walletResult.fail_reason || '',
        wallet_settlement_time: Date.now(),
        wallet_settlement_amount: settlement.teacherIncome,
        update_time: Date.now()
      })
      
      // 8. 更新教师试课统计数据
      // 计算试课统计数据
      const dbCmd = db.command
      const trialAppointments = await db.collection('appointments')
        .where({
          teacher_id: appointment.teacher_id,
          course_type: 'trial',
          status: dbCmd.in(['completed', 'refunded', 'cancelled'])
        })
        .get()
      
      const trialCount = trialAppointments.data ? trialAppointments.data.length : 0
      const trialSuccessCount = trialAppointments.data
        ? trialAppointments.data.filter(a => {
            const isCompleted = a.status === 'completed'
            // 兼容历史数据：早期已完成试课可能没有写入 trial_result，也视为成功
            const isSuccess = !a.trial_result || a.trial_result === 'success'
            return isCompleted && isSuccess
          }).length
        : 0
      const trialSuccessRate = trialCount > 0 ? (trialSuccessCount / trialCount) : 0
      const totalStudents = await countAcceptedTrialStudents(db, appointment.teacher_id)
      
      await db.collection('teacher-profiles')
        .where({ teacher_id: appointment.teacher_id })
        .update({
          total_courses: db.command.inc(1),
          total_students: totalStudents,
          trial_count: trialCount,
          trial_success_count: trialSuccessCount,
          trial_success_rate: Number(trialSuccessRate.toFixed(2)),
          update_time: Date.now()
        })
      
      console.log('试课成功确认，教师收益已结算', {
        trialCount,
        trialSuccessCount,
        totalStudents,
        paidWechat
      })
      
      return success({
        appointment_id,
        status: 'completed',
        platform_fee: settlement.platformFee,
        teacher_income: settlement.teacherIncome,
        can_review: true
      }, '试课已完成，可以评价教师了')
      
    } catch (e) {
      console.error('确认试课成功失败:', e)
      return error(e.message || '操作失败')
    }
  },
  
  /**
   * 家长确认试课不满意
   *
   * 结算规则：
   *   · 教师收入 = 70% × original_amount
   *   · 家长退款 = 30% × actualPaidAmount（微信原路退回）
   *   · 信息费归平台，不退回
   *
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {String} [params.reason] 不满意原因（写入 trial_fail_reason）
   * @returns {Object}
   */
  async confirmTrialFail(params) {
    const { appointment_id, reason = '' } = params || {}

    try {
      const db = uniCloud.database()

      // 1. 解析家长身份（与 confirmTrialSuccess 保持一致：调用方需自行鉴权或通过 token）
      const token = (this.getUniIdToken && this.getUniIdToken()) || ''
      let parent_id = null
      if (token) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          parent_id = parts.length >= 1 ? parts[0] : null
        } catch (e) {
          // ignore
        }
      }

      // 2. 查询预约（含旧数据打卡自愈）
      const appointment = await loadResolvedAppointment(db, appointment_id)
      if (!appointment) {
        return error('预约不存在')
      }

      // 3. 校验权限 + 状态
      if (parent_id && appointment.parent_id !== parent_id) {
        return error('只能操作自己的预约')
      }
      if (appointment.course_type !== 'trial') {
        return error('只有试课可以确认结果')
      }
      if (!['pending_confirm', 'confirmed', 'in_progress'].includes(appointment.status)) {
        return error('当前预约状态不允许确认结果')
      }

      const readyCheck = assertReadyForParentConfirm(appointment)
      if (!readyCheck.ok) {
        return error(readyCheck.message)
      }

      // 5. 试课失败：教师 70%，家长退 30%
      const paymentOrder = await getLatestPaidCourseOrder(db, appointment_id)
      const settlement = buildSettlementResult(appointment, paymentOrder)
      const teacherShareRate = 0.7
      const parentRefundRate = 0.3
      settlement.teacherIncome = roundCurrency(settlement.originalAmount * teacherShareRate)
      const parentRefundAmount = roundCurrency(settlement.actualPaidAmount * parentRefundRate)
      settlement.platformFee = roundCurrency(
        Math.max(0, settlement.actualPaidAmount - settlement.teacherIncome - parentRefundAmount)
      )

      console.log('[confirmTrialFail] 试课失败结算（70% 教师 + 30% 退家长）:', {
        appointment_id,
        originalAmount: settlement.originalAmount,
        actualPaidAmount: settlement.actualPaidAmount,
        teacherShareRate,
        parentRefundRate,
        teacherIncome: settlement.teacherIncome,
        parentRefundAmount,
        platformFee: settlement.platformFee
      })

      // 6. 更新预约状态：completed + trial_result=fail（不再是 refunded）
      const settlementTime = Date.now()
      await db.collection('appointments').doc(appointment_id).update({
        status: 'completed',
        complete_time: settlementTime,
        trial_result: 'fail',
        trial_fail_reason: reason || '',
        platform_fee: settlement.platformFee,
        teacher_income: settlement.teacherIncome,
        parent_refund_amount: parentRefundAmount,
        wallet_settled: false,
        wallet_settlement_amount: settlement.teacherIncome,
        update_time: settlementTime
      })

      // 7. 教师收入：优先自动到微信零钱（试课失败 70%）
      const walletResult = await settleTeacherIncome(
        appointment.teacher_id,
        settlement.teacherIncome,
        {
          appointment_id,
          course_type: appointment.course_type,
          source: 'trial_fail_complete'
        }
      )
      const paidWechat = !!(walletResult.teacher_paid_wechat || walletResult.auto_transferred || walletResult.need_confirm)
      await db.collection('appointments').doc(appointment_id).update({
        wallet_settled: false,
        teacher_paid_wechat: paidWechat || !!walletResult.duplicate,
        teacher_pay_status: walletResult.need_confirm
          ? 'wait_confirm'
          : (walletResult.auto_transferred ? 'ok' : (walletResult.fail_reason ? 'failed' : '')),
        teacher_pay_fail_reason: walletResult.fail_reason || '',
        wallet_settlement_time: Date.now(),
        wallet_settlement_amount: settlement.teacherIncome,
        update_time: Date.now()
      })

      // 7.1 家长自动退款 30% 试课费
      let parentRefundResult = { success: true, refundAmount: 0, skipped: true }
      if (paymentOrder && parentRefundAmount > 0) {
        parentRefundResult = await executeParentPartialRefund(
          db,
          paymentOrder,
          parentRefundAmount,
          appointment
        )
        if (!parentRefundResult.success) {
          console.error('[confirmTrialFail] 家长30%退款失败:', parentRefundResult.message)
        } else {
          await db.collection('appointments').doc(appointment_id).update({
            parent_refund_amount: parentRefundResult.refundAmount,
            refund_status: parentRefundResult.refundAmount > 0 ? 'partial_auto' : appointment.refund_status,
            update_time: Date.now()
          })
        }
      }

      // 8. 信息费归平台，试课失败也不退回
      console.log('[confirmTrialFail] 信息费不退回，归平台收取:', { appointment_id })

      // 9. 更新教师试课统计 + 学员数
      const dbCmd = db.command
      const trialAppointments = await db.collection('appointments')
        .where({
          teacher_id: appointment.teacher_id,
          course_type: 'trial',
          status: dbCmd.in(['completed', 'refunded', 'cancelled'])
        })
        .get()
      const trialCount = trialAppointments.data ? trialAppointments.data.length : 0
      const trialSuccessCount = trialAppointments.data
        ? trialAppointments.data.filter(a => {
            const isCompleted = a.status === 'completed'
            const isSuccess = !a.trial_result || a.trial_result === 'success'
            return isCompleted && isSuccess
          }).length
        : 0
      const trialSuccessRate = trialCount > 0 ? (trialSuccessCount / trialCount) : 0
      const totalStudents = await countAcceptedTrialStudents(db, appointment.teacher_id)
      await db.collection('teacher-profiles')
        .where({ teacher_id: appointment.teacher_id })
        .update({
          total_students: totalStudents,
          trial_count: trialCount,
          trial_success_count: trialSuccessCount,
          trial_success_rate: Number(trialSuccessRate.toFixed(2)),
          update_time: Date.now()
        })

      return success({
        appointment_id,
        status: 'completed',
        trial_result: 'fail',
        teacher_income: settlement.teacherIncome,
        parent_refund_amount: parentRefundResult.refundAmount || parentRefundAmount,
        platform_fee: settlement.platformFee,
        info_fee_refunded: false,
        can_review: true,
        can_reinvite_trial: true
      }, parentRefundResult.success
        ? '已确认试课不满意，费用已按规则结算，教师可再次发起试课邀请'
        : '试课结果已确认，教师收入已结算；家长退款处理异常，请联系平台')
    } catch (e) {
      console.error('[confirmTrialFail] 试课失败确认异常:', e)
      return error(e.message || '操作失败')
    }
  },

  /**
   * @deprecated 旧版自动退款流程，已废弃。
   *
   * 新版规则：试课不满意请调 confirmTrialFail（仅结算，不退家长）；
   * 异常退款（如教师爽约/欺诈）请调用 payment-refund.apply 提交退款申请，由管理员审核。
   * 该方法保留以避免老版本客户端调用失败，调用时直接返回引导信息。
   *
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {String} [params.reason] 不满意原因
   * @returns {Object}
   */
  async requestRefund(params) {
    console.warn('[requestRefund][deprecated] 旧自动退款入口被调用，已禁用:', params)
    return error(
      '该入口已升级：试课不满意请使用「确认试课不满意」（confirmTrialFail）。如需异常退款（教师爽约等），请通过订单详情页提交退款申请，由管理员审核。',
      4090
    )
  },

  /**
   * 正式课程完成
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @returns {Object}
   */
  async completeCourse(params) {
    const { appointment_id } = params
    
    try {
      const db = uniCloud.database()
      
      console.log('[completeCourse] 接收到完成正式课程请求:', {
        appointment_id
      })
      
      // 2. 查询预约（含旧数据打卡自愈）
      const appointment = await loadResolvedAppointment(db, appointment_id)
      
      if (!appointment) {
        console.error('[completeCourse] 预约不存在:', { appointment_id })
        return error('预约不存在')
      }
      
      console.log('[completeCourse] 读取到预约信息:', {
        appointment_id,
        teacher_id: appointment.teacher_id,
        parent_id: appointment.parent_id,
        course_type: appointment.course_type,
        status: appointment.status,
        total_amount: appointment.total_amount,
        original_amount_in_appointment: appointment.original_amount
      })
      
      // 3. 验证状态
      if (appointment.course_type !== 'regular') {
        console.warn('[completeCourse] 非正式课程调用 completeCourse，被拒绝:', {
          appointment_id,
          course_type: appointment.course_type
        })
        return error('只有正式课程可以执行此操作')
      }
      
      // 允许 pending_confirm / confirmed / in_progress 三种状态，由前置流程控制何时可点“确认完成”
      if (!['pending_confirm', 'confirmed', 'in_progress'].includes(appointment.status)) {
        console.warn('[completeCourse] 当前状态不允许完成:', {
          appointment_id,
          status: appointment.status
        })
        return error('当前预约状态不允许完成')
      }

      // 3.1 正式课同样要求教师已完成下课打卡
      if (!appointment.class_ended_at) {
        console.warn('[completeCourse] 教师尚未下课打卡:', { appointment_id })
        return error('教师尚未下课打卡，无法确认完成')
      }

      // 4. 查询支付订单，获取原价和优惠金额
      const paymentOrder = await getLatestPaidCourseOrder(db, appointment_id)
      const settlement = buildSettlementResult(appointment, paymentOrder)
      // 正式课规则：试课成功一次后平台不收费；优惠券由平台承担，教师获得完整课程金额
      settlement.platformFee = 0
      settlement.teacherIncome = roundCurrency(settlement.originalAmount)
      
      console.log('[completeCourse] 支付订单信息:', {
        appointment_id,
        originalAmount: settlement.originalAmount,
        discountAmount: settlement.discountAmount,
        hasCoupon: settlement.hasCoupon,
        paymentOrder: paymentOrder ? {
          order_no: paymentOrder.order_no,
          original_amount: paymentOrder.original_amount,
          discount_amount: paymentOrder.discount_amount,
          user_coupon_id: paymentOrder.user_coupon_id
        } : null
      })
      
      // 7. 更新预约状态和结算字段
      const settlementTime = Date.now()
      await db.collection('appointments').doc(appointment_id).update({
        status: 'completed',
        complete_time: settlementTime,
        platform_fee: settlement.platformFee,
        teacher_income: settlement.teacherIncome,
        wallet_settled: false,
        wallet_settlement_amount: settlement.teacherIncome,
        update_time: settlementTime
      })
      
      // 8. 教师收入：优先自动到微信零钱
      if (settlement.teacherIncome > 0) {
        console.log('[completeCourse] 即将结算教师收入:', {
          teacher_id: appointment.teacher_id,
          teacherIncome: settlement.teacherIncome,
          appointment_id
        })
        const walletResult = await settleTeacherIncome(appointment.teacher_id, settlement.teacherIncome, {
          appointment_id,
          course_type: appointment.course_type,
          source: 'regular_complete'
        })
        const paidWechat = !!(walletResult.teacher_paid_wechat || walletResult.auto_transferred || walletResult.need_confirm)
        await db.collection('appointments').doc(appointment_id).update({
          wallet_settled: false,
          teacher_paid_wechat: paidWechat || !!walletResult.duplicate,
          teacher_pay_status: walletResult.need_confirm
            ? 'wait_confirm'
            : (walletResult.auto_transferred ? 'ok' : (walletResult.fail_reason ? 'failed' : '')),
          teacher_pay_fail_reason: walletResult.fail_reason || '',
          wallet_settlement_time: Date.now(),
          wallet_settlement_amount: settlement.teacherIncome,
          update_time: Date.now()
        })
        console.log('[completeCourse] 教师收入结算完成:', {
          teacher_id: appointment.teacher_id,
          teacherIncome: settlement.teacherIncome,
          auto_transferred: walletResult.auto_transferred,
          paidWechat,
          appointment_id
        })
      } else {
        console.warn(`[completeCourse] 教师收入为0或无效，跳过结算: teacherIncome=${settlement.teacherIncome}, appointment_id=${appointment_id}`)
      }
      
      // 9. 更新教师统计
      await db.collection('teacher-profiles')
        .where({ teacher_id: appointment.teacher_id })
        .update({
          total_courses: db.command.inc(1),
          update_time: Date.now()
        })
      
      console.log('[completeCourse] 正式课程已完成，结算信息:', {
        appointment_id,
        originalAmount: settlement.originalAmount,
        discountAmount: settlement.discountAmount,
        hasCoupon: settlement.hasCoupon,
        platformFee: settlement.platformFee,
        teacherIncome: settlement.teacherIncome
      })
      
      return success({
        appointment_id,
        status: 'completed',
        platform_fee: settlement.platformFee,
        teacher_income: settlement.teacherIncome,
        can_review: true
      }, '课程已完成，可以评价教师了')
      
    } catch (e) {
      console.error('完成课程失败:', e)
      return error(e.message || '操作失败')
    }
  },
  
  /**
   * 获取用户信息（内部方法）
   */
  getClientInfo() {
    return this.getUniCloudClientInfo ? this.getUniCloudClientInfo() : {}
  }
}

