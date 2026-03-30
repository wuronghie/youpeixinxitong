/**
 * 完成课程云对象
 * 功能：课程完成、试课结算、退款处理
 */

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
 * 计算课程结束时间戳
 * @param {Object} appointment 预约信息
 * @returns {Number|null} 结束时间戳（毫秒）
 */
function getAppointmentEndTimestamp(appointment) {
  if (!appointment || !appointment.date || !appointment.start_time) {
    return null
  }
  const startTimeStr = `${appointment.date} ${appointment.start_time}`
  const startDate = new Date(startTimeStr.replace(/-/g, '/'))
  if (Number.isNaN(startDate.getTime())) {
    return null
  }
  const durationHours = Number(appointment.duration) || 0
  if (durationHours <= 0) {
    return null
  }
  return startDate.getTime() + durationHours * 60 * 60 * 1000
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
 * 该家长-教师对是否已有过试课成功记录（不含当前预约）
 * 用于判断是否收取“一节试课完整费用”作为中介费（仅首单试课成功收取）
 */
async function hasPriorTrialSuccess(db, parentId, teacherId, excludeAppointmentId) {
  const dbCmd = db.command
  const res = await db.collection('appointments')
    .where({
      parent_id: parentId,
      teacher_id: teacherId,
      course_type: 'trial',
      status: 'completed',
      trial_result: 'success',
      _id: dbCmd.neq(excludeAppointmentId)
    })
    .limit(1)
    .count()
  return (res.total || 0) > 0
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
 * @param {Number} depositAmount 保证金金额（可选）
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
  
  if (depositNum > 0) {
    const depositRounded = Number(depositNum.toFixed(2))
    updateData.balance = Number(((updateData.balance || wallet.balance || 0) + depositRounded).toFixed(2))
    updateData.deposit_refunded = Number(((wallet.deposit_refunded || 0) + depositRounded).toFixed(2))
    console.log(`[钱包更新] 保证金退还: ${depositRounded}元`)
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

  return {
    settled: incomeRounded > 0 || depositNum > 0,
    duplicate: false,
    wallet
  }
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
      
      // 2. 查询预约
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 3. 验证状态（权限验证已在调用方完成）
      
      if (appointment.course_type !== 'trial') {
        return error('只有试课可以确认成功')
      }
      
      if (appointment.status !== 'confirmed' && appointment.status !== 'in_progress') {
        return error('当前预约状态不允许确认')
      }
      
      // 4.1 检查课程是否已结束
      const endTimestamp = getAppointmentEndTimestamp(appointment)
      if (!endTimestamp) {
        return error('课程时间信息缺失，暂不可确认')
      }
      if (Date.now() < endTimestamp) {
        return error('课程尚未结束，请在课程结束后再确认')
      }
      
      // 4. 查询支付订单，获取原价和优惠金额（如果使用了优惠券）
      const paymentOrder = await getLatestPaidCourseOrder(db, appointment_id)
      const settlement = buildSettlementResult(appointment, paymentOrder)
      // 中介费规则：收取一节试课完整费用作为中介费，仅在该家长-教师对首次试课成功时收取
      const isFirstTrialSuccess = !(await hasPriorTrialSuccess(db, appointment.parent_id, appointment.teacher_id, appointment_id))
      if (isFirstTrialSuccess) {
        const oneTrialFee = Math.min(settlement.originalAmount, settlement.actualPaidAmount)
        settlement.platformFee = roundCurrency(oneTrialFee)
        settlement.teacherIncome = roundCurrency(Math.max(0, settlement.actualPaidAmount - settlement.platformFee))
      } else {
        settlement.platformFee = 0
        settlement.teacherIncome = roundCurrency(settlement.actualPaidAmount > 0 ? settlement.actualPaidAmount : settlement.originalAmount)
      }
      
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
      
      console.log('[confirmTrialSuccess] 试课结算计算结果:', {
        appointment_id,
        course_type: appointment.course_type,
        isFirstTrialSuccess,
        originalAmount: settlement.originalAmount,
        discountAmount: settlement.discountAmount,
        hasCoupon: settlement.hasCoupon,
        actualPaidAmount: settlement.actualPaidAmount,
        platformFee: settlement.platformFee,
        teacherIncome: settlement.teacherIncome
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
      
      // 7. 更新教师钱包
      const walletResult = await updateTeacherWallet(appointment.teacher_id, settlement.teacherIncome, 0, {
        appointment_id,
        course_type: appointment.course_type,
        source: 'trial_complete'
      })
      await db.collection('appointments').doc(appointment_id).update({
        wallet_settled: !!(walletResult.settled || walletResult.duplicate),
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
      
      await db.collection('teacher-profiles')
        .where({ teacher_id: appointment.teacher_id })
        .update({
          total_courses: db.command.inc(1),
          total_students: db.command.inc(1),
          trial_count: trialCount,
          trial_success_count: trialSuccessCount,
          trial_success_rate: Number(trialSuccessRate.toFixed(2)),
          update_time: Date.now()
        })
      
      console.log('试课成功确认，教师收益已结算')
      
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
   * 家长确认试课不满意，申请退款
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {String} params.reason 不满意原因
   * @returns {Object}
   */
  async requestRefund(params) {
    const { appointment_id, reason = '' } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 验证用户登录状态（解析 uniIdToken，兼容简单 token）
      const token = this.getClientInfo().uniIdToken
      let parent_id
      if (!token) {
        return error('请先登录')
      }
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        parent_id = parts.length >= 1 ? parts[0] : null
      } catch (e) {
        console.error('解析token失败:', e)
        return error('token验证失败，请重新登录')
      }
      if (!parent_id) {
        return error('token验证失败，请重新登录')
      }
      
      // 2. 查询预约
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 3. 验证权限和状态
      if (appointment.parent_id !== parent_id) {
        return error('只能操作自己的预约')
      }
      
      if (appointment.course_type !== 'trial') {
        return error('只有试课可以申请退款')
      }
      
      if (appointment.status !== 'confirmed' && appointment.status !== 'in_progress') {
        return error('当前预约状态不允许退款')
      }
      
      // 4. 获取退款比例配置
      const configDoc = await db.collection('system-config')
        .where({ config_key: 'trial_refund_rate' })
        .get()
      
      const refundRate = configDoc.data[0]?.config_value || 0.5
      
      // 5. 计算退款金额（50%，即1小时费用）
      // 试课价格为2小时费用，不满意退款50%即1小时费用
      const refundAmount = appointment.total_amount * refundRate
      
      // 6. 更新预约状态
      await db.collection('appointments').doc(appointment_id).update({
        status: 'refunded',
        refund_time: Date.now(),
        refund_reason: reason,
        refund_amount: refundAmount,
        trial_result: 'fail',
        update_time: Date.now()
      })
      
      // 7. 创建退款订单
      const refundOrder = {
        order_no: 'RFD' + Date.now() + Math.floor(Math.random() * 10000),
        appointment_id,
        payer_id: 'platform',
        payee_id: parent_id,
        order_type: 'refund',
        total_amount: refundAmount,
        status: 'paid',
        payment_time: Date.now(),
        create_time: Date.now(),
        update_time: Date.now()
      }
      
      await db.collection('payment-orders').add(refundOrder)
      
      // 8. 扣除教师保证金（不退还）
      // 保证金作为违约金不予退还
      
      // 9. 更新教师试课统计数据
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
      
      await db.collection('teacher-profiles')
        .where({ teacher_id: appointment.teacher_id })
        .update({
          trial_count: trialCount,
          trial_success_count: trialSuccessCount,
          trial_success_rate: Number(trialSuccessRate.toFixed(2)),
          update_time: Date.now()
        })
      
      console.log('退款申请已处理，退款50%')
      
      return success({
        appointment_id,
        status: 'refunded',
        refund_amount: refundAmount,
        refund_rate: refundRate
      }, `退款成功，已退还${refundRate * 100}%费用`)
      
    } catch (e) {
      console.error('申请退款失败:', e)
      return error(e.message || '退款失败')
    }
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
      
      // 2. 查询预约
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        console.error('[completeCourse] 预约不存在:', { appointment_id })
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
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
      
      // 8. 更新教师钱包
      if (settlement.teacherIncome > 0) {
        console.log('[completeCourse] 即将更新教师钱包:', {
          teacher_id: appointment.teacher_id,
          teacherIncome: settlement.teacherIncome,
          appointment_id
        })
        const walletResult = await updateTeacherWallet(appointment.teacher_id, settlement.teacherIncome, 0, {
          appointment_id,
          course_type: appointment.course_type,
          source: 'regular_complete'
        })
        await db.collection('appointments').doc(appointment_id).update({
          wallet_settled: !!(walletResult.settled || walletResult.duplicate),
          wallet_settlement_time: Date.now(),
          wallet_settlement_amount: settlement.teacherIncome,
          update_time: Date.now()
        })
        console.log('[completeCourse] 教师钱包更新完成:', {
          teacher_id: appointment.teacher_id,
          teacherIncome: settlement.teacherIncome,
          appointment_id
        })
      } else {
        console.warn(`[completeCourse] 教师收入为0或无效，跳过钱包更新: teacherIncome=${settlement.teacherIncome}, appointment_id=${appointment_id}`)
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

