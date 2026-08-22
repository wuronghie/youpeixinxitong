const uniID = require('uni-id-common')
const { assertStaffAccess, PERMISSION } = require('admin-auth')

/** 后台退款权限：超管或持有 AUDIT_REFUND（不再信任客户端 isAdmin 入参） */
async function requireRefundStaff(ctx) {
  return assertStaffAccess(ctx, [PERMISSION.AUDIT_REFUND])
}

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

async function resolveUserId(context) {
  const token = context.getUniIdToken()
  if (!token) {
    throw new Error('未获取到token，请先登录')
  }

  // 1) 标准 uni-id token
  try {
    const payload = await context.uniID.checkToken(token)
    if (payload && !payload.code && !payload.errCode && payload.uid) {
      return payload.uid
    }
  } catch (err) {
    // 继续简易 token 兜底
  }

  // 2) 小程序登录简易 token：base64(uid_timestamp_random)
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split('_')
    if (parts.length >= 1 && parts[0]) {
      return parts[0]
    }
  } catch (decodeError) {
    // ignore
  }

  throw new Error('token验证失败，请重新登录')
}

/**
 * 解析聊天会话（与 chat-send.getConversation 逻辑一致）
 * 同一家长+教师复用会话时，appointment_id 可能已指向较新的预约
 */
async function resolveConversationForAdmin(db, options = {}) {
  const {
    conversation_id = '',
    appointment_id = '',
    teacher_id = '',
    parent_id = ''
  } = options

  if (conversation_id) {
    const doc = await db.collection('chat-conversations').doc(conversation_id).get()
    if (doc.data && doc.data.length) {
      return doc.data[0]
    }
  }

  if (appointment_id) {
    const byApt = await db.collection('chat-conversations')
      .where({ appointment_id })
      .limit(1)
      .get()
    if (byApt.data && byApt.data.length) {
      return byApt.data[0]
    }

    const aptDoc = await db.collection('appointments')
      .doc(appointment_id)
      .field({ parent_id: true, teacher_id: true, conversation_id: true })
      .get()
    if (aptDoc.data && aptDoc.data.length) {
      const appt = aptDoc.data[0]
      if (appt.conversation_id) {
        const linked = await db.collection('chat-conversations').doc(appt.conversation_id).get()
        if (linked.data && linked.data.length) {
          return linked.data[0]
        }
      }
      const tid = teacher_id || appt.teacher_id
      const pid = parent_id || appt.parent_id
      if (tid && pid) {
        const byPair = await db.collection('chat-conversations')
          .where({ parent_id: pid, teacher_id: tid })
          .limit(1)
          .get()
        if (byPair.data && byPair.data.length) {
          return byPair.data[0]
        }
      }
    }
  }

  if (teacher_id && parent_id) {
    const byPair = await db.collection('chat-conversations')
      .where({ parent_id, teacher_id })
      .limit(1)
      .get()
    if (byPair.data && byPair.data.length) {
      return byPair.data[0]
    }
  }

  return null
}

function roundCurrency(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

async function resolveOutTradeNo(db, order) {
  if (order && order.out_trade_no) return order.out_trade_no

  if (order && order.order_no) {
    try {
      const byOrderNo = await db.collection('uni-pay-orders')
        .where({ order_no: order.order_no, status: 1 })
        .orderBy('pay_date', 'desc')
        .limit(1)
        .get()
      if (byOrderNo.data && byOrderNo.data[0] && byOrderNo.data[0].out_trade_no) {
        return byOrderNo.data[0].out_trade_no
      }
    } catch (e) {
      console.warn('[payment-refund] resolveOutTradeNo order_no 失败:', e.message)
    }
  }

  if (order && order.appointment_id) {
    try {
      const byApt = await db.collection('uni-pay-orders')
        .where({ 'custom.appointment_id': order.appointment_id, status: 1 })
        .orderBy('pay_date', 'desc')
        .limit(1)
        .get()
      if (byApt.data && byApt.data[0] && byApt.data[0].out_trade_no) {
        return byApt.data[0].out_trade_no
      }
    } catch (e) {
      console.warn('[payment-refund] resolveOutTradeNo appointment_id 失败:', e.message)
    }
  }
  return null
}

/** 微信原路退款给家长 */
async function executeWechatRefund(db, order, refundAmount, reason = '试课退款') {
  const amount = roundCurrency(refundAmount)
  if (!order || amount <= 0) {
    return { success: true, skipped: true, refundAmount: 0 }
  }
  if (order.auto_partial_refunded || order.status === 'refunded') {
    return {
      success: true,
      skipped: true,
      refundAmount: order.auto_partial_refund_amount || order.refund_amount || amount
    }
  }

  const out_trade_no = await resolveOutTradeNo(db, order)
  if (!out_trade_no) {
    return { success: false, refundAmount: amount, message: '未找到支付单号，无法退款' }
  }

  const out_refund_no = `RF30_${String(order._id).slice(-8)}_${Date.now()}`
  try {
    const uniPayCo = uniCloud.importObject('uni-pay-co', { customUI: true })
    const refundRes = await uniPayCo.refund({
      out_trade_no,
      out_refund_no,
      refund_fee: Math.round(amount * 100),
      refund_desc: reason || '试课退款30%'
    })

    if (!refundRes || refundRes.errCode !== 0) {
      const msg = (refundRes && (refundRes.errMsg || refundRes.message)) || '微信退款失败'
      return { success: false, refundAmount: amount, message: msg }
    }

    return {
      success: true,
      refundAmount: amount,
      out_trade_no,
      out_refund_no,
      refundResult: refundRes
    }
  } catch (e) {
    const msg = e.message || e.errMsg || String(e)
    console.error('[payment-refund] uni-pay-co.refund 异常:', e)
    return {
      success: false,
      refundAmount: amount,
      message: msg.includes('token') ? '支付退款鉴权失败，请重新上传 uni-pay-co 后重试' : msg
    }
  }
}

/**
 * 试课退款：教师 70% 直接商家转账到微信零钱（不入钱包余额）
 */
async function settleTeacherTrialShare(appointment, teacherIncome, source = 'trial_refund_apply') {
  const income = roundCurrency(teacherIncome)
  const teacherId = appointment && appointment.teacher_id
  const appointmentId = appointment && appointment._id
  const logPrefix = '[payment-refund][教师打款]'

  if (!teacherId || income <= 0) {
    console.warn(logPrefix, '跳过：缺少教师或金额', { teacherId, income, appointmentId })
    return { settled: false, skipped: true, message: '缺少教师或金额', fail_reason: '缺少教师或金额' }
  }
  // 仅当微信打款已成功/已发起时跳过；旧版 wallet_settled 不阻止补打款
  if (appointment.teacher_paid_wechat) {
    console.log(logPrefix, '跳过：该预约已微信打款', { appointmentId })
    return { settled: true, duplicate: true, fail_reason: '' }
  }

  console.log(logPrefix, '开始直接转账到教师微信', {
    teacherId,
    appointmentId,
    amount: income,
    source
  })

  try {
    const teacherWallet = uniCloud.importObject('teacher-wallet', { customUI: true })
    const res = await teacherWallet.directPayTeacher({
      teacher_id: teacherId,
      amount: income,
      appointment_id: appointmentId || '',
      remark: '试课退款课酬70%'
    })

    const data = (res && res.data) || {}
    const transferOk = !!(res && res.code === 0 && data.transfer_ok)
    const status = data.status || ''
    const failReason = data.fail_reason || (res && res.message) || ''

    console.log(logPrefix, '转账结果', {
      ok: transferOk,
      code: res && res.code,
      message: res && res.message,
      status,
      need_confirm: !!data.need_confirm,
      auto_transferred: !!data.auto_transferred,
      withdraw_id: data.withdraw_id || '',
      payment_no: data.payment_no || '',
      fail_reason: failReason || '(无)',
      amount: data.amount || income,
      teacherId,
      appointmentId
    })

    if (transferOk) {
      return {
        settled: true,
        auto_transferred: !!data.auto_transferred,
        need_confirm: !!data.need_confirm,
        status,
        withdraw_id: data.withdraw_id || '',
        payment_no: data.payment_no || '',
        fail_reason: data.need_confirm ? '需教师微信确认收款' : '',
        message: res.message || '打款成功'
      }
    }

    console.error(logPrefix, '转账失败原因:', failReason || '未知错误')
    return {
      settled: false,
      auto_transferred: false,
      need_confirm: false,
      status: status || 'failed',
      fail_reason: failReason || '转账失败',
      message: failReason || '转账失败'
    }
  } catch (e) {
    console.error(logPrefix, '调用异常', {
      teacherId,
      appointmentId,
      amount: income,
      message: e.message,
      errMsg: e.errMsg,
      stack: e.stack
    })
    return {
      settled: false,
      fail_reason: e.message || e.errMsg || '打款调用异常',
      message: e.message || e.errMsg || '打款调用异常'
    }
  }
}

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({ clientInfo })
  },

  /**
   * 家长申请退款（提交后进入平台审核；通过后才退家长款并结算教师课酬）
   * @param {Object} params
   * @param {String} params.order_id 支付订单ID
   * @param {String} params.reason 退款原因
   * @param {String} params.refund_type 退款类型（only_refund/refund_cancel）
   * @param {String} params.description 退款说明
   * @param {Array} params.images 凭证图片
   */
  async apply(params = {}) {
    const db = uniCloud.database()
    const dbCmd = db.command
    let { order_id, reason = '', refund_type = 'refund_cancel', description = '', images = [] } = params

    console.log('[payment-refund] ========== 开始申请退款（待平台审核） ==========')
    console.log('[payment-refund] 请求参数:', JSON.stringify(params, null, 2))

    try {
      const user_id = await resolveUserId(this)
      if (!order_id) {
        return error('缺少订单ID')
      }

      const orderDoc = await db.collection('payment-orders').doc(order_id).get()
      if (!orderDoc.data || orderDoc.data.length === 0) {
        return error('订单不存在')
      }
      const order = orderDoc.data[0]

      if (order.payer_id !== user_id) {
        return error('无法操作他人的订单')
      }

      let appointment = null
      if (order.appointment_id) {
        const appointmentDoc = await db.collection('appointments').doc(order.appointment_id).get()
        appointment = appointmentDoc.data && appointmentDoc.data.length > 0 ? appointmentDoc.data[0] : null
      }

      if (appointment && (appointment.status === 'completed' || appointment.has_review === true)) {
        return error('订单已确认，不可再申请退款')
      }

      if (!['paid', 'success'].includes(order.status)) {
        return error('当前订单状态不支持退款')
      }

      const isTrial = !!(appointment && appointment.course_type === 'trial')
      const orderAmount = roundCurrency(order.amount || order.total_amount || 0)
      let refundAmount = orderAmount
      let teacherIncome = 0
      if (isTrial) {
        refundAmount = roundCurrency(orderAmount * 0.3)
        teacherIncome = roundCurrency(orderAmount * 0.7)
        refund_type = 'refund_cancel'
      }
      if (refundAmount <= 0) {
        return error('订单金额异常，无法申请退款')
      }

      // 已有成功退款：仅允许补打教师课酬（不重复退家长）
      const successRefund = await db.collection('payment-refunds')
        .where({ order_id, status: dbCmd.in(['success', 'completed']) })
        .limit(1)
        .get()
      if (successRefund.data && successRefund.data.length > 0) {
        if (
          isTrial &&
          appointment &&
          !appointment.teacher_paid_wechat &&
          teacherIncome > 0
        ) {
          const settleRes = await settleTeacherTrialShare(appointment, teacherIncome, 'trial_refund_repair')
          if (settleRes.settled) {
            await db.collection('appointments').doc(appointment._id).update({
              teacher_income: teacherIncome,
              teacher_paid_wechat: true,
              teacher_pay_status: settleRes.status || 'ok',
              teacher_pay_fail_reason: settleRes.fail_reason || '',
              teacher_pay_withdraw_id: settleRes.withdraw_id || '',
              teacher_pay_payment_no: settleRes.payment_no || '',
              teacher_pay_time: Date.now(),
              update_time: Date.now()
            })
            return success({
              refund_id: successRefund.data[0]._id,
              refund_amount: refundAmount,
              teacher_income: teacherIncome,
              repaired: true
            }, settleRes.need_confirm
              ? '退款已到账；教师 70% 已发起转账，需微信确认收款'
              : '退款已到账；已为教师补打款 70% 至微信零钱')
          }
          return error(`教师打款失败：${settleRes.fail_reason || settleRes.message || '未知原因'}`)
        }
        return error('该订单已退款完成')
      }

      const pendingRefundDoc = await db.collection('payment-refunds')
        .where({ order_id, payer_id: user_id, status: dbCmd.in(['pending', 'processing']) })
        .orderBy('create_time', 'desc')
        .limit(1)
        .get()
      if (pendingRefundDoc.data && pendingRefundDoc.data.length > 0) {
        const existed = pendingRefundDoc.data[0]
        return success({
          refund_id: existed._id,
          refund_amount: roundCurrency(existed.amount || refundAmount),
          status: existed.status,
          pending_review: true
        }, '您已提交退款申请，请等待平台审核')
      }

      const now = Date.now()
      // 直进平台待审（跳过教师侧审核）
      const refundRes = await db.collection('payment-refunds').add({
        order_id,
        order_no: order.order_no,
        appointment_id: order.appointment_id || '',
        payer_id: user_id,
        amount: refundAmount,
        reason,
        refund_type,
        description,
        images: images.slice(0, 6),
        status: 'pending',
        teacher_review_status: 'approved',
        teacher_id: appointment ? appointment.teacher_id : null,
        teacher_income: teacherIncome,
        course_type: appointment ? (appointment.course_type || '') : '',
        create_time: now,
        update_time: now
      })
      if (!refundRes.id) {
        return error('提交退款失败')
      }

      await db.collection('payment-orders').doc(order_id).update({
        status: 'refunding',
        refund_amount: refundAmount,
        refund_reason: reason,
        refund_request_id: refundRes.id,
        update_time: now
      })

      if (appointment) {
        await db.collection('appointments').doc(appointment._id).update({
          refund_status: 'pending',
          update_time: now
        })
      }

      console.log('[payment-refund] ========== 退款申请已提交待审 ==========', {
        refund_id: refundRes.id,
        refundAmount,
        teacherIncome,
        isTrial
      })

      return success({
        refund_id: refundRes.id,
        refund_amount: refundAmount,
        teacher_income: teacherIncome,
        status: 'pending',
        pending_review: true,
        auto: false
      }, isTrial
        ? '退款申请已提交，预计退回 30%，请等待平台审核'
        : '退款申请已提交，请等待平台审核')
    } catch (e) {
      console.error('[payment-refund] ❌ 申请退款异常:', e)
      return error(e.message || '申请退款失败')
    }
  },

  /**
   * 补打教师课酬（家长退款已成功但教师未到账时调用）
   * @param {{ order_id?: string, appointment_id?: string, isAdmin?: boolean }} params
   */
  async repairTeacherPay(params = {}) {
    const db = uniCloud.database()
    const dbCmd = db.command
    const { order_id = '', appointment_id = '', isAdmin = false } = params
    const logPrefix = '[payment-refund.repairTeacherPay]'

    try {
      let user_id = null
      if (isAdmin) {
        await requireRefundStaff(this)
      } else {
        user_id = await resolveUserId(this)
      }

      let order = null
      if (order_id) {
        const orderDoc = await db.collection('payment-orders').doc(order_id).get()
        order = orderDoc.data && orderDoc.data[0]
      } else if (appointment_id) {
        const orderDoc = await db.collection('payment-orders')
          .where({
            appointment_id,
            order_type: 'course_fee',
            status: dbCmd.in(['refunded', 'refunding', 'paid', 'success'])
          })
          .orderBy('update_time', 'desc')
          .limit(1)
          .get()
        order = orderDoc.data && orderDoc.data[0]
      }

      if (!order) {
        return error('未找到相关支付订单')
      }
      if (!isAdmin && order.payer_id !== user_id) {
        return error('无法操作他人的订单')
      }

      const aptId = order.appointment_id || appointment_id
      if (!aptId) {
        return error('订单缺少预约信息')
      }

      const aptDoc = await db.collection('appointments').doc(aptId).get()
      const appointment = aptDoc.data && aptDoc.data[0]
      if (!appointment) {
        return error('预约不存在')
      }
      if (appointment.course_type !== 'trial') {
        return error('仅试课订单支持补打教师课酬')
      }
      if (appointment.teacher_paid_wechat) {
        return success({
          already: true,
          teacher_pay_status: appointment.teacher_pay_status || 'ok'
        }, '教师课酬已打款，无需重复操作')
      }

      const orderAmount = roundCurrency(order.amount || order.total_amount || appointment.total_amount || 0)
      const teacherIncome = roundCurrency(orderAmount * 0.7)
      if (teacherIncome <= 0) {
        return error('课酬金额异常')
      }

      console.log(logPrefix, '开始补打款', {
        order_id: order._id,
        appointment_id: aptId,
        teacher_id: appointment.teacher_id,
        teacherIncome,
        isAdmin: !!isAdmin
      })

      const settleRes = await settleTeacherTrialShare(appointment, teacherIncome, 'trial_refund_repair')
      console.log(logPrefix, '补打款结果', {
        settled: !!settleRes.settled,
        status: settleRes.status || '',
        fail_reason: settleRes.fail_reason || '',
        need_confirm: !!settleRes.need_confirm,
        withdraw_id: settleRes.withdraw_id || '',
        payment_no: settleRes.payment_no || ''
      })

      const now = Date.now()
      if (settleRes.settled) {
        await db.collection('appointments').doc(aptId).update({
          teacher_income: teacherIncome,
          teacher_paid_wechat: true,
          teacher_pay_status: settleRes.status || 'ok',
          teacher_pay_fail_reason: settleRes.fail_reason || '',
          teacher_pay_withdraw_id: settleRes.withdraw_id || '',
          teacher_pay_payment_no: settleRes.payment_no || '',
          teacher_pay_time: now,
          update_time: now
        })
        try {
          await db.collection('payment-refunds')
            .where({ order_id: order._id, status: dbCmd.in(['success', 'completed']) })
            .update({
              teacher_settled: true,
              teacher_income: teacherIncome,
              teacher_pay_status: settleRes.status || '',
              teacher_pay_fail_reason: settleRes.fail_reason || '',
              teacher_pay_withdraw_id: settleRes.withdraw_id || '',
              teacher_pay_payment_no: settleRes.payment_no || '',
              update_time: now
            })
        } catch (e) {
          console.warn(logPrefix, '更新退款单标记失败（忽略）', e.message)
        }

        const msg = settleRes.need_confirm
          ? '已发起教师打款，需教师在微信确认收款'
          : (settleRes.auto_transferred ? '教师 70% 课酬已转入微信零钱' : '教师打款已受理')
        return success({
          repaired: true,
          teacher_income: teacherIncome,
          teacher_pay_status: settleRes.status || '',
          teacher_pay_fail_reason: settleRes.fail_reason || '',
          withdraw_id: settleRes.withdraw_id || '',
          payment_no: settleRes.payment_no || ''
        }, msg)
      }

      await db.collection('appointments').doc(aptId).update({
        teacher_pay_status: 'failed',
        teacher_pay_fail_reason: settleRes.fail_reason || settleRes.message || '打款失败',
        update_time: now
      })
      return error(`教师打款失败：${settleRes.fail_reason || settleRes.message || '未知原因'}`)
    } catch (e) {
      console.error(logPrefix, '异常', e)
      return error(e.message || '补打款失败')
    }
  },

  /**
   * 获取退款详情
   * @param {Object} params
   * @param {String} params.order_id
   */
  async getDetail(params = {}) {
    const db = uniCloud.database()
    const dbCmd = db.command
    const { order_id, refund_id = null, appointment_id = null, isAdmin = false } = params

    try {
      if (isAdmin) {
        await requireRefundStaff(this)
      }
      const user_id = isAdmin ? null : await resolveUserId(this)
      
      if (!order_id && !refund_id && !appointment_id) {
        return error('缺少查询参数')
      }

      let whereCondition
      if (refund_id) {
        // 如果有退款ID，直接查询
        whereCondition = isAdmin 
          ? { _id: refund_id }
          : dbCmd.and([
              { _id: refund_id },
              dbCmd.or([{ payer_id: user_id }, { teacher_id: user_id }])
            ])
      } else if (appointment_id) {
        // 通过预约ID查询（管理员可用，或验证用户权限）
        if (isAdmin) {
          whereCondition = { appointment_id }
        } else {
          whereCondition = dbCmd.and([
            { appointment_id },
            dbCmd.or([{ payer_id: user_id }, { teacher_id: user_id }])
          ])
        }
      } else {
        // 通过订单ID查询
        whereCondition = isAdmin
          ? { order_id }
          : dbCmd.and([
              { order_id },
              dbCmd.or([{ payer_id: user_id }, { teacher_id: user_id }])
            ])
      }

      console.log('[payment-refund] getDetail 查询条件:', JSON.stringify(whereCondition, null, 2))
      
      const query = db.collection('payment-refunds')
        .where(whereCondition)
        .orderBy('create_time', 'desc')
        .limit(1)
      const refundDoc = await query.get()

      console.log('[payment-refund] getDetail 查询结果:', {
        hasData: refundDoc.data && refundDoc.data.length > 0,
        count: refundDoc.data ? refundDoc.data.length : 0
      })

      if (!refundDoc.data || refundDoc.data.length === 0) {
        return error('暂无退款记录')
      }

      return success(refundDoc.data[0])
    } catch (e) {
      console.error('[payment-refund] 获取退款详情失败', e)
      return error(e.message || '获取退款详情失败')
    }
  },

  async teacherReview(params = {}) {
    const db = uniCloud.database()
    const { refund_id, action = 'approve', opinion = '' } = params

    try {
      const teacher_id = await resolveUserId(this)
      if (!refund_id) {
        return error('缺少退款申请ID')
      }

      const refundDoc = await db.collection('payment-refunds').doc(refund_id).get()
      if (!refundDoc.data || refundDoc.data.length === 0) {
        return error('退款申请不存在')
      }
      const refund = refundDoc.data[0]
      if (refund.teacher_id !== teacher_id) {
        return error('无权处理该退款申请')
      }
      if (refund.status !== 'pending') {
        return error('当前退款状态无需教师审核')
      }
      if (refund.teacher_review_status !== 'pending') {
        return error('已处理该退款申请')
      }

      const now = Date.now()
      if (action === 'approve') {
        await db.collection('payment-refunds').doc(refund_id).update({
          teacher_review_status: 'approved',
          teacher_review_time: now,
          teacher_opinion: opinion,
          status: 'processing',
          update_time: now
        })
        return success({ refund_id, status: 'processing' }, '已同意退款，等待平台审核')
      }

      if (action === 'reject') {
        await db.collection('payment-refunds').doc(refund_id).update({
          teacher_review_status: 'rejected',
          teacher_review_time: now,
          teacher_opinion: opinion,
          status: 'rejected',
          update_time: now
        })
        await db.collection('payment-orders').doc(refund.order_id).update({
          status: 'paid',
          update_time: now
        })
        if (refund.appointment_id) {
          await db.collection('appointments').doc(refund.appointment_id).update({
            refund_status: 'rejected',
            update_time: now
          })
        }
        return success({ refund_id, status: 'rejected' }, '已驳回退款申请')
      }

      return error('不支持的审核操作')
    } catch (e) {
      console.error('[payment-refund] 教师审核退款失败', e)
      return error(e.message || '教师审核退款失败')
    }
  },

  /**
   * 平台审核退款（预留接口）
   * @param {Object} params
   * @param {String} params.refund_id 退款申请ID
   * @param {String} params.action 审核操作：'approve' | 'reject'
   * @param {String} params.opinion 审核意见
   * @param {Boolean} params.isAdmin 是否为管理员（后台管理系统调用）
   */
  async review(params = {}) {
    const db = uniCloud.database()
    const { refund_id, action = 'approve', opinion = '', refund_channel_payload = null, isAdmin = false } = params

    try {
      let reviewer_id = null
      if (isAdmin) {
        const staff = await requireRefundStaff(this)
        reviewer_id = staff.uid
      } else {
        reviewer_id = await resolveUserId(this)
      }
      
      if (!refund_id) {
        return error('缺少退款申请ID')
      }

      const refundDoc = await db.collection('payment-refunds').doc(refund_id).get()
      if (!refundDoc.data || refundDoc.data.length === 0) {
        return error('退款申请不存在')
      }
      const refund = refundDoc.data[0]
      if (refund.status !== 'pending' && refund.status !== 'processing') {
        return error('当前退款状态无需审核')
      }
      // 平台可直接审核；若仍标记待教师处理，审核时自动视为已跳过
      if (refund.teacher_review_status === 'pending' && action === 'approve') {
        console.warn('[payment-refund] 教师未处理，平台直接审核通过')
      }

      const orderDoc = await db.collection('payment-orders').doc(refund.order_id).get()
      if (!orderDoc.data || orderDoc.data.length === 0) {
        console.error('[payment-refund] ❌ 关联订单不存在, order_id:', refund.order_id)
        return error('关联订单不存在')
      }
      const order = orderDoc.data[0]
      console.log('[payment-refund] 订单信息:', {
        order_id: order._id,
        order_no: order.order_no,
        out_trade_no: order.out_trade_no,
        appointment_id: order.appointment_id
      })
      const now = Date.now()

      if (action === 'approve') {
        // 查找对应的 uni-pay 订单（通过 appointment_id 或 order_no）
        let uniPayOrder = null
        let out_trade_no = null
        
        // 方法1：通过 payment-orders 表中的 out_trade_no（如果已保存）
        if (order.out_trade_no) {
          out_trade_no = order.out_trade_no
          console.log('[payment-refund] ✅ 方法1-从 payment-orders 获取 out_trade_no:', out_trade_no)
        } else {
          console.log('[payment-refund] ⚠️ payment-orders 中没有 out_trade_no，尝试方法2')
          
          // 方法2：通过 order_no 查找 uni-pay-orders 表
          if (order.order_no) {
            try {
              console.log('[payment-refund] 方法2-通过 order_no 查找 uni-pay 订单:', order.order_no)
              const uniPayOrdersResByOrderNo = await db.collection('uni-pay-orders')
                .where({
                  order_no: order.order_no,
                  status: 1 // 已支付
                })
                .orderBy('pay_date', 'desc')
                .limit(1)
                .get()
              
              if (uniPayOrdersResByOrderNo.data && uniPayOrdersResByOrderNo.data.length > 0) {
                uniPayOrder = uniPayOrdersResByOrderNo.data[0]
                out_trade_no = uniPayOrder.out_trade_no
                console.log('[payment-refund] ✅ 方法2-从 uni-pay-orders (order_no) 获取 out_trade_no:', out_trade_no)
              } else {
                console.log('[payment-refund] ⚠️ 方法2-未找到 uni-pay 订单 (order_no)')
              }
            } catch (err) {
              console.warn('[payment-refund] 方法2-查找 uni-pay 订单失败:', err)
            }
          }
          
          // 方法3：通过 appointment_id 查找 uni-pay-orders 表
          if (!out_trade_no && refund.appointment_id) {
            try {
              console.log('[payment-refund] 方法3-通过 appointment_id 查找 uni-pay 订单:', refund.appointment_id)
              const uniPayOrdersRes = await db.collection('uni-pay-orders')
                .where({
                  'custom.appointment_id': refund.appointment_id,
                  status: 1 // 已支付
                })
                .orderBy('pay_date', 'desc')
                .limit(1)
                .get()
              
              if (uniPayOrdersRes.data && uniPayOrdersRes.data.length > 0) {
                uniPayOrder = uniPayOrdersRes.data[0]
                out_trade_no = uniPayOrder.out_trade_no
                console.log('[payment-refund] ✅ 方法3-从 uni-pay-orders (appointment_id) 获取 out_trade_no:', out_trade_no)
              } else {
                console.log('[payment-refund] ⚠️ 方法3-未找到 uni-pay 订单 (appointment_id)')
              }
            } catch (err) {
              console.warn('[payment-refund] 方法3-查找 uni-pay 订单失败:', err)
            }
          }
        }
        
        if (!out_trade_no) {
          console.error('[payment-refund] ❌ 未找到 out_trade_no，无法执行退款')
          return error('未找到支付订单号，无法执行退款。请检查订单信息或手动处理。')
        }

        // 调用 uni-pay-co 退款接口实际退款
        // 使用云对象调用，但需要处理权限问题
        let refundResult = null
        try {
          console.log('[payment-refund] ========== 开始调用 uni-pay-co 退款接口 ==========')
          console.log('[payment-refund] 退款参数:', {
            out_trade_no: out_trade_no,
            refund_amount: refund.amount,
            refund_amount_cents: Math.round(refund.amount * 100),
            refund_reason: refund.reason || '用户申请退款'
          })
          
          // 退款金额（分）
          const refundFee = Math.round(refund.amount * 100)
          
          // 生成退款单号
          const out_refund_no = `REF_${refund_id.slice(-8)}_${Date.now()}`
          
          console.log('[payment-refund] 调用 uni-pay-co.refund...')
          
          // 使用云对象调用 uni-pay-co
          // 需要确保 token 正确传递，以便 admin 角色能被识别
          const uniPayCo = uniCloud.importObject('uni-pay-co', { customUI: true })
          
          // 如果是管理员模式，尝试获取并传递 token
          let tokenToPass = null
          if (isAdmin) {
            try {
              // 尝试获取当前请求的 token（从 payment-refund 的上下文中）
              tokenToPass = this.getUniIdToken()
              console.log('[payment-refund] 管理员模式，尝试传递 token:', tokenToPass ? '已获取' : '未获取')
            } catch (tokenErr) {
              console.warn('[payment-refund] 获取 token 失败:', tokenErr.message)
            }
          }
          
          console.log('[payment-refund] 调用 uni-pay-co.refund，使用当前登录用户的 token...')
          
          // 如果获取到 token，通过参数传递（uni-pay-co 的 auth 中间件支持从参数获取 token）
          const refundParams = {
            out_trade_no: out_trade_no,
            out_refund_no: out_refund_no,
            refund_fee: refundFee,
            refund_desc: refund.reason || '用户申请退款'
          }
          
          // 如果获取到 token，添加到参数中（uni-pay-co 的 auth 中间件会从参数中读取）
          if (tokenToPass) {
            refundParams.uniIdToken = tokenToPass
          }
          
          const refundRes = await uniPayCo.refund(refundParams)
          
          console.log('[payment-refund] uni-pay-co.refund 返回结果:', JSON.stringify(refundRes, null, 2))
          
          if (refundRes && refundRes.errCode === 0) {
            refundResult = refundRes
            console.log('[payment-refund] ✅ uni-pay 退款成功')
          } else {
            console.error('[payment-refund] ❌ uni-pay 退款失败:', {
              errCode: refundRes?.errCode,
              errMsg: refundRes?.errMsg,
              data: refundRes?.data
            })
            // 退款失败，返回错误
            return error(`退款失败: ${refundRes?.errMsg || '未知错误'}`)
          }
        } catch (refundError) {
          console.error('[payment-refund] ❌ 调用退款接口异常:', {
            error: refundError,
            message: refundError.message,
            errCode: refundError.errCode,
            errMsg: refundError.errMsg,
            stack: refundError.stack
          })
          // 退款异常，返回错误
          return error(`退款异常: ${refundError.message || refundError.errMsg || '未知错误'}`)
        }

        // 更新订单状态
        await db.collection('payment-orders').doc(order._id).update({
          status: 'refunded',
          refund_amount: refund.amount,
          refund_time: now,
          refund_result_payload: refund_channel_payload || (refundResult ? JSON.stringify(refundResult) : null),
          out_trade_no: out_trade_no || order.out_trade_no, // 保存 out_trade_no 供后续使用
          update_time: now
        })

        // 试课：审核通过后补结算教师 70%
        let teacherSettle = { settled: false }
        let teacherIncome = 0
        let appointmentForSettle = null
        if (refund.appointment_id && refundResult) {
          try {
            const aptDoc = await db.collection('appointments').doc(refund.appointment_id).get()
            appointmentForSettle = aptDoc.data && aptDoc.data[0] ? aptDoc.data[0] : null
            if (appointmentForSettle && appointmentForSettle.course_type === 'trial') {
              const orderAmount = roundCurrency(order.amount || order.total_amount || 0)
              teacherIncome = roundCurrency(orderAmount * 0.7)
              teacherSettle = await settleTeacherTrialShare(
                appointmentForSettle,
                teacherIncome,
                'trial_refund_review'
              )
            }
          } catch (settleErr) {
            console.warn('[payment-refund] 审核通过后教师结算失败:', settleErr)
          }
        }

        // 更新预约状态
        if (refund.appointment_id) {
          const aptUpdate = {
            refund_status: refundResult ? 'success' : 'processing',
            status: refund.refund_type === 'refund_cancel' ? 'cancelled' : (appointmentForSettle && appointmentForSettle.status) || 'cancelled',
            update_time: now
          }
          if (teacherIncome > 0) {
            aptUpdate.teacher_income = teacherIncome
            aptUpdate.parent_refund_amount = roundCurrency(refund.amount)
            aptUpdate.wallet_settled = false
            aptUpdate.teacher_paid_wechat = !!teacherSettle.settled
            aptUpdate.teacher_pay_status = teacherSettle.need_confirm
              ? 'wait_confirm'
              : (teacherSettle.settled ? (teacherSettle.status || 'ok') : 'failed')
            aptUpdate.teacher_pay_fail_reason = teacherSettle.fail_reason || ''
            aptUpdate.teacher_pay_withdraw_id = teacherSettle.withdraw_id || ''
            aptUpdate.teacher_pay_payment_no = teacherSettle.payment_no || ''
            aptUpdate.teacher_pay_time = teacherSettle.settled ? now : null
            aptUpdate.wallet_settlement_amount = teacherIncome
            aptUpdate.wallet_settlement_time = teacherSettle.settled ? now : null
            aptUpdate.trial_result = 'fail'
            aptUpdate.trial_fail_reason = refund.reason || refund.description || '家长申请退款'
          }
          await db.collection('appointments').doc(refund.appointment_id).update(aptUpdate)
        }

        // 更新退款记录
        await db.collection('payment-refunds').doc(refund_id).update({
          status: refundResult ? 'success' : 'processing',
          teacher_review_status: 'approved',
          teacher_income: teacherIncome || refund.teacher_income || 0,
          teacher_settled: !!teacherSettle.settled,
          teacher_pay_status: teacherSettle.status || '',
          teacher_pay_fail_reason: teacherSettle.fail_reason || '',
          teacher_pay_withdraw_id: teacherSettle.withdraw_id || '',
          teacher_pay_payment_no: teacherSettle.payment_no || '',
          reviewer_id,
          review_opinion: opinion,
          review_time: now,
          finish_time: refundResult ? now : null,
          refund_result_payload: refundResult ? JSON.stringify(refundResult) : null,
          out_trade_no: out_trade_no,
          update_time: now
        })

        const needTeacherRepair = !!(
          refundResult &&
          teacherIncome > 0 &&
          !teacherSettle.settled
        )
        const message = refundResult
          ? (teacherIncome > 0
            ? (teacherSettle.settled
              ? (teacherSettle.need_confirm
                ? '退款已成功；教师70%已发起转账，需微信确认收款'
                : '退款已成功，教师70%已打入微信零钱')
              : `家长退款已成功，但教师打款失败：${teacherSettle.fail_reason || teacherSettle.message || '未知原因'}。请使用「补打教师课酬」重试`)
            : '退款审核通过，退款已成功处理')
          : '退款审核通过，但退款处理失败，请手动处理'
        
        return success({ 
          refund_id, 
          status: refundResult ? 'success' : 'processing',
          refund_result: refundResult,
          teacher_income: teacherIncome,
          teacher_settled: !!teacherSettle.settled,
          teacher_pay_status: teacherSettle.status || (needTeacherRepair ? 'failed' : ''),
          teacher_pay_fail_reason: teacherSettle.fail_reason || teacherSettle.message || '',
          need_teacher_repair: needTeacherRepair
        }, message)
      }

      if (action === 'reject') {
        await db.collection('payment-orders').doc(order._id).update({
          status: 'paid',
          update_time: now
        })
        if (refund.appointment_id) {
          await db.collection('appointments').doc(refund.appointment_id).update({
            refund_status: 'rejected',
            update_time: now
          })
        }
        await db.collection('payment-refunds').doc(refund_id).update({
          status: 'rejected',
          reviewer_id,
          review_opinion: opinion,
          review_time: now,
          update_time: now
        })
        return success({ refund_id, status: 'rejected' }, '退款申请已驳回')
      }

      return error('不支持的审核操作')
    } catch (e) {
      console.error('[payment-refund] 审核退款失败', e)
      return error(e.message || '审核退款失败')
    }
  },

  /**
   * 后台退款列表 KPI
   */
  async adminKpi(params = {}) {
    const { isAdmin = false } = params
    if (!isAdmin) {
      return error('无权访问')
    }
    try {
      await requireRefundStaff(this)
    } catch (e) {
      return error(e.message || '无权访问')
    }

    const db = uniCloud.database()
    const dbCmd = db.command
    const collection = db.collection('payment-refunds')

    try {
      const [
        totalRes,
        pendingRes,
        processingRes,
        successRes,
        rejectedRes,
        waitingTeacherRes,
        actionableRes,
        teacherPayPendingRes
      ] = await Promise.all([
        collection.count(),
        collection.where({ status: 'pending' }).count(),
        collection.where({ status: 'processing' }).count(),
        collection.where({ status: dbCmd.in(['success', 'completed']) }).count(),
        collection.where({ status: 'rejected' }).count(),
        collection.where(dbCmd.and([
          { status: dbCmd.in(['pending', 'processing']) },
          { teacher_review_status: 'pending' }
        ])).count(),
        collection.where(dbCmd.and([
          { status: dbCmd.in(['pending', 'processing']) },
          { teacher_review_status: dbCmd.neq('pending') }
        ])).count(),
        // 家长已退成功，但教师课酬未成功结算
        collection.where(dbCmd.and([
          { status: dbCmd.in(['success', 'completed']) },
          { teacher_income: dbCmd.gt(0) },
          dbCmd.or([
            { teacher_settled: false },
            { teacher_settled: dbCmd.exists(false) },
            { teacher_pay_status: 'failed' },
            { teacher_pay_status: '' },
            { teacher_pay_status: dbCmd.exists(false) }
          ])
        ])).count()
      ])

      return success({
        total: totalRes.total || 0,
        pending: pendingRes.total || 0,
        processing: processingRes.total || 0,
        success: successRes.total || 0,
        rejected: rejectedRes.total || 0,
        waiting_teacher: waitingTeacherRes.total || 0,
        actionable: actionableRes.total || 0,
        teacher_pay_pending: teacherPayPendingRes.total || 0
      })
    } catch (e) {
      console.error('[payment-refund] adminKpi failed', e)
      return error(e.message || '查询退款统计失败')
    }
  },

  /**
   * 后台退款列表
   */
  async adminList(params = {}) {
    const {
      status = 'all',
      page = 1,
      pageSize = 20,
      keyword = '',
      isAdmin = false
    } = params

    if (!isAdmin) {
      return error('无权访问')
    }
    try {
      await requireRefundStaff(this)
    } catch (e) {
      return error(e.message || '无权访问')
    }

    const db = uniCloud.database()
    const dbCmd = db.command

    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1)
      const size = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20))

      let where = {}
      if (status === 'pending') {
        where.status = 'pending'
      } else if (status === 'processing') {
        where.status = 'processing'
      } else if (status === 'success') {
        where.status = dbCmd.in(['success', 'completed'])
      } else if (status === 'rejected') {
        where.status = 'rejected'
      } else if (status === 'waiting_teacher') {
        where = dbCmd.and([
          { status: dbCmd.in(['pending', 'processing']) },
          { teacher_review_status: 'pending' }
        ])
      } else if (status === 'actionable') {
        where = dbCmd.and([
          { status: dbCmd.in(['pending', 'processing']) },
          { teacher_review_status: dbCmd.neq('pending') }
        ])
      } else if (status === 'teacher_pay_pending') {
        where = dbCmd.and([
          { status: dbCmd.in(['success', 'completed']) },
          { teacher_income: dbCmd.gt(0) },
          dbCmd.or([
            { teacher_settled: false },
            { teacher_settled: dbCmd.exists(false) },
            { teacher_pay_status: 'failed' },
            { teacher_pay_status: '' },
            { teacher_pay_status: dbCmd.exists(false) }
          ])
        ])
      }

      const kw = String(keyword || '').trim()
      if (kw) {
        const nameUserIds = []
        if (!/^[a-zA-Z0-9_-]{16,}$/.test(kw)) {
          try {
            const queryRe = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            const [userRes, teacherRes] = await Promise.all([
              db.collection('uni-id-users')
                .where(dbCmd.or([
                  { nickname: queryRe },
                  { username: queryRe },
                  { wx_nickname: queryRe },
                  { mobile: queryRe }
                ]))
                .field({ _id: true })
                .limit(100)
                .get(),
              db.collection('teacher-profiles')
                .where(dbCmd.or([
                  { display_name: queryRe },
                  { real_name: queryRe }
                ]))
                .field({ teacher_id: true })
                .limit(100)
                .get()
            ])
            ;(userRes.data || []).forEach((u) => { if (u && u._id) nameUserIds.push(u._id) })
            ;(teacherRes.data || []).forEach((p) => { if (p && p.teacher_id) nameUserIds.push(p.teacher_id) })
          } catch (e) {
            console.warn('[payment-refund.adminList] 昵称反查失败:', e)
          }
        }
        const kwOr = [
          { _id: kw },
          { order_no: kw },
          { order_no: new RegExp(kw, 'i') },
          { order_id: kw },
          { appointment_id: kw },
          { payer_id: kw },
          { teacher_id: kw },
          { reason: new RegExp(kw, 'i') }
        ]
        if (nameUserIds.length) {
          kwOr.push({ payer_id: dbCmd.in(nameUserIds) })
          kwOr.push({ teacher_id: dbCmd.in(nameUserIds) })
        }
        const kwCond = dbCmd.or(kwOr)
        where = Object.keys(where).length ? dbCmd.and([where, kwCond]) : kwCond
      }

      const collection = db.collection('payment-refunds')
      const countRes = await collection.where(where).count()
      const listRes = await collection
        .where(where)
        .orderBy('create_time', 'desc')
        .skip((pageNum - 1) * size)
        .limit(size)
        .get()

      const list = listRes.data || []
      const appointmentIds = [...new Set(list.map(item => item.appointment_id).filter(Boolean))]
      const teacherIds = [...new Set(list.map(item => item.teacher_id).filter(Boolean))]
      const payerIds = [...new Set(list.map(item => item.payer_id).filter(Boolean))]

      const appointmentMap = {}
      if (appointmentIds.length) {
        const aptRes = await db.collection('appointments')
          .where({ _id: dbCmd.in(appointmentIds) })
          .field({
            _id: true,
            appointment_no: true,
            conversation_id: true,
            status: true,
            refund_status: true,
            course_type: true,
            type: true,
            teacher_income: true,
            teacher_paid_wechat: true,
            teacher_pay_status: true,
            teacher_pay_fail_reason: true
          })
          .get()
        ;(aptRes.data || []).forEach(item => {
          appointmentMap[item._id] = item
        })

        const missingConvAptIds = appointmentIds.filter(id => {
          const apt = appointmentMap[id]
          return !apt || !apt.conversation_id
        })
        if (missingConvAptIds.length) {
          const convByAptRes = await db.collection('chat-conversations')
            .where({ appointment_id: dbCmd.in(missingConvAptIds) })
            .field({ _id: true, appointment_id: true, chat_enabled: true, status: true })
            .get()
          ;(convByAptRes.data || []).forEach(item => {
            if (appointmentMap[item.appointment_id]) {
              appointmentMap[item.appointment_id].conversation_id = item._id
            }
          })
        }
      }

      const teacherNameMap = {}
      if (teacherIds.length) {
        const teacherRes = await db.collection('teacher-profiles')
          .where({ teacher_id: dbCmd.in(teacherIds) })
          .field({ teacher_id: true, display_name: true })
          .get()
        ;(teacherRes.data || []).forEach(item => {
          teacherNameMap[item.teacher_id] = item.display_name || ''
        })
      }

      const userNameMap = {}
      const allUserIds = [...new Set([...payerIds, ...teacherIds])]
      if (allUserIds.length) {
        const userRes = await db.collection('uni-id-users')
          .where({ _id: dbCmd.in(allUserIds) })
          .field({ _id: true, nickname: true, username: true })
          .get()
        ;(userRes.data || []).forEach(item => {
          userNameMap[item._id] = item.nickname || item.username || item._id
        })
      }

      const conversationIds = [...new Set(
        list.map(item => {
          const apt = appointmentMap[item.appointment_id]
          return apt && apt.conversation_id ? apt.conversation_id : ''
        }).filter(Boolean)
      )]
      const conversationMap = {}
      if (conversationIds.length) {
        const convRes = await db.collection('chat-conversations')
          .where({ _id: dbCmd.in(conversationIds) })
          .field({ _id: true, appointment_id: true, chat_enabled: true, status: true })
          .get()
        ;(convRes.data || []).forEach(item => {
          conversationMap[item._id] = item
        })
      }

      const enriched = list.map(item => {
        const apt = appointmentMap[item.appointment_id] || null
        let conversationId = apt && apt.conversation_id ? apt.conversation_id : ''
        const teacherIncome = Number(item.teacher_income || (apt && apt.teacher_income) || 0)
        const courseType = item.course_type || (apt && apt.course_type) || ''
        const payStatus = item.teacher_pay_status || (apt && apt.teacher_pay_status) || ''
        const paidWechat = !!(apt && apt.teacher_paid_wechat) ||
          item.teacher_settled === true ||
          ['ok', 'success', 'completed', 'wait_confirm', 'pending'].includes(payStatus)
        const isTrialLike = courseType === 'trial' ||
          item.refund_type === 'refund_cancel' ||
          teacherIncome > 0
        const needTeacherRepair = ['success', 'completed'].includes(item.status) &&
          isTrialLike &&
          teacherIncome > 0 &&
          !paidWechat
        return {
          ...item,
          parent_name: userNameMap[item.payer_id] || '',
          teacher_name: teacherNameMap[item.teacher_id] || userNameMap[item.teacher_id] || '',
          appointment_no: apt ? apt.appointment_no : '',
          appointment_status: apt ? apt.status : '',
          course_type: courseType,
          teacher_income: teacherIncome,
          teacher_paid_wechat: !!(apt && apt.teacher_paid_wechat),
          teacher_pay_status: payStatus,
          teacher_pay_fail_reason: item.teacher_pay_fail_reason || (apt && apt.teacher_pay_fail_reason) || '',
          need_teacher_repair: needTeacherRepair,
          conversation_id: conversationId,
          chat_enabled: conversationId && conversationMap[conversationId]
            ? conversationMap[conversationId].chat_enabled
            : null
        }
      })

      for (const item of enriched) {
        if (item.conversation_id) continue
        const conv = await resolveConversationForAdmin(db, {
          appointment_id: item.appointment_id,
          teacher_id: item.teacher_id,
          parent_id: item.payer_id
        })
        if (conv) {
          item.conversation_id = conv._id
          item.chat_enabled = conv.chat_enabled
        }
      }

      return success({
        list: enriched,
        total: countRes.total || 0,
        page: pageNum,
        pageSize: size
      })
    } catch (e) {
      console.error('[payment-refund] adminList failed', e)
      return error(e.message || '查询退款列表失败')
    }
  },

  /**
   * 后台订单详情
   */
  async getOrderDetail(params = {}) {
    const { order_id, isAdmin = false } = params
    if (!isAdmin) {
      return error('无权访问')
    }
    try {
      await requireRefundStaff(this)
    } catch (e) {
      return error(e.message || '无权访问')
    }
    if (!order_id) {
      return error('缺少订单ID')
    }

    const db = uniCloud.database()
    const dbCmd = db.command

    try {
      const orderDoc = await db.collection('payment-orders').doc(order_id).get()
      if (!orderDoc.data || !orderDoc.data.length) {
        return error('订单不存在')
      }

      const order = orderDoc.data[0]
      let effectiveTeacherId = order.teacher_id || ''
      let effectiveParentId = order.parent_id || ''

      let appointment = null
      if (order.appointment_id) {
        const aptRes = await db.collection('appointments')
          .doc(order.appointment_id)
          .field({
            _id: true,
            appointment_no: true,
            conversation_id: true,
            status: true,
            course_type: true,
            type: true,
            date: true,
            start_time: true,
            teacher_id: true,
            parent_id: true
          })
          .get()
        appointment = aptRes.data && aptRes.data[0] ? aptRes.data[0] : null
        if (appointment) {
          effectiveTeacherId = effectiveTeacherId || appointment.teacher_id || ''
          effectiveParentId = effectiveParentId || appointment.parent_id || ''
        }
      }

      // 订单表可能未冗余 teacher_id / parent_id，按订单类型从 payer_id 推断
      if (!effectiveParentId && ['course_fee', 'trial', 'regular'].includes(order.order_type)) {
        effectiveParentId = order.payer_id || ''
      }
      if (!effectiveTeacherId && order.order_type === 'deposit') {
        effectiveTeacherId = order.payer_id || ''
      }

      if (order.appointment_id) {
        const conv = await resolveConversationForAdmin(db, {
          conversation_id: appointment && appointment.conversation_id,
          appointment_id: order.appointment_id,
          teacher_id: effectiveTeacherId,
          parent_id: effectiveParentId
        })
        if (conv) {
          if (appointment) {
            appointment.conversation_id = conv._id
          } else {
            appointment = {
              _id: order.appointment_id,
              conversation_id: conv._id
            }
          }
          effectiveTeacherId = effectiveTeacherId || conv.teacher_id || ''
          effectiveParentId = effectiveParentId || conv.parent_id || ''
        }
      }

      const userIds = [order.payer_id, effectiveParentId, effectiveTeacherId].filter(Boolean)
      const userNameMap = {}
      if (userIds.length) {
        const userRes = await db.collection('uni-id-users')
          .where({ _id: dbCmd.in([...new Set(userIds)]) })
          .field({ _id: true, nickname: true, username: true, mobile: true })
          .get()
        ;(userRes.data || []).forEach(item => {
          userNameMap[item._id] = {
            name: item.nickname || item.username || item._id,
            mobile: item.mobile || ''
          }
        })
      }

      let teacherName = ''
      if (effectiveTeacherId) {
        const teacherRes = await db.collection('teacher-profiles')
          .where({ teacher_id: effectiveTeacherId })
          .field({ display_name: true, teacher_id: true })
          .limit(1)
          .get()
        teacherName = teacherRes.data && teacherRes.data[0]
          ? (teacherRes.data[0].display_name || '')
          : ''
      }

      const parentName = effectiveParentId && userNameMap[effectiveParentId]
        ? userNameMap[effectiveParentId].name
        : (order.payer_id && ['course_fee', 'trial', 'regular'].includes(order.order_type) && userNameMap[order.payer_id]
          ? userNameMap[order.payer_id].name
          : '')

      return success({
        ...order,
        teacher_id: effectiveTeacherId || order.teacher_id || '',
        parent_id: effectiveParentId || order.parent_id || '',
        payer_name: userNameMap[order.payer_id] ? userNameMap[order.payer_id].name : '',
        parent_name: parentName,
        teacher_name: teacherName || (effectiveTeacherId && userNameMap[effectiveTeacherId]
          ? userNameMap[effectiveTeacherId].name
          : ''),
        appointment
      })
    } catch (e) {
      console.error('[payment-refund] getOrderDetail failed', e)
      return error(e.message || '查询订单详情失败')
    }
  },

  /**
   * 后台查看会话聊天记录（绕过 clientDB 权限）
   */
  async adminGetConversationMessages(params = {}) {
    const {
      conversation_id = '',
      appointment_id = '',
      teacher_id = '',
      parent_id = '',
      page = 1,
      pageSize = 50,
      isAdmin = false
    } = params

    if (!isAdmin) {
      return error('无权访问')
    }
    try {
      await assertStaffAccess(this, [
        PERMISSION.AUDIT_REFUND,
        PERMISSION.AUDIT_TEACHER,
        PERMISSION.AUDIT_RECRUITMENT
      ])
    } catch (e) {
      return error(e.message || '无权访问')
    }
    if (!conversation_id && !appointment_id && !(teacher_id && parent_id)) {
      return error('缺少会话或预约ID')
    }

    const db = uniCloud.database()
    const dbCmd = db.command

    try {
      const conversation = await resolveConversationForAdmin(db, {
        conversation_id,
        appointment_id,
        teacher_id,
        parent_id
      })

      if (!conversation) {
        return error('未找到关联聊天会话')
      }

      const conversationId = conversation._id
      const pageNum = Math.max(1, parseInt(page, 10) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 50))
      const skip = (pageNum - 1) * size

      const [msgRes, countRes] = await Promise.all([
        db.collection('chat-messages')
          .where({ conversation_id: conversationId })
          .orderBy('create_time', 'desc')
          .skip(skip)
          .limit(size)
          .get(),
        db.collection('chat-messages')
          .where({ conversation_id: conversationId })
          .count()
      ])

      const messages = (msgRes.data || []).reverse()
      const total = countRes.total || 0
      const userIds = [...new Set([
        conversation.parent_id,
        conversation.teacher_id,
        ...messages.map(item => item.sender_id),
        ...messages.map(item => item.receiver_id)
      ].filter(Boolean))]

      const userNameMap = {}
      const teacherNameMap = {}
      if (userIds.length) {
        const [userRes, teacherRes] = await Promise.all([
          db.collection('uni-id-users')
            .where({ _id: dbCmd.in(userIds) })
            .field({ _id: true, nickname: true, username: true })
            .get(),
          db.collection('teacher-profiles')
            .where({ teacher_id: dbCmd.in(userIds) })
            .field({ teacher_id: true, display_name: true })
            .get()
        ])
        ;(userRes.data || []).forEach(item => {
          userNameMap[item._id] = item.nickname || item.username || item._id
        })
        ;(teacherRes.data || []).forEach(item => {
          teacherNameMap[item.teacher_id] = item.display_name || ''
        })
      }

      const parentName = userNameMap[conversation.parent_id] || '家长'
      const teacherName = teacherNameMap[conversation.teacher_id] || userNameMap[conversation.teacher_id] || '教师'

      const enrichedMessages = messages.map(item => {
        const isTeacher = item.sender_role === 'teacher' || item.sender_id === conversation.teacher_id
        const senderName = isTeacher
          ? (teacherNameMap[item.sender_id] || userNameMap[item.sender_id] || teacherName)
          : (userNameMap[item.sender_id] || parentName)
        return {
          ...item,
          sender_name: senderName,
          sender_label: isTeacher ? '教师' : '家长'
        }
      })

      return success({
        conversation: {
          _id: conversation._id,
          appointment_id: conversation.appointment_id,
          parent_id: conversation.parent_id,
          teacher_id: conversation.teacher_id,
          parent_name: parentName,
          teacher_name: teacherName,
          chat_enabled: conversation.chat_enabled,
          status: conversation.status
        },
        messages: enrichedMessages,
        total,
        page: pageNum,
        pageSize: size,
        hasMore: skip + messages.length < total
      })
    } catch (e) {
      console.error('[payment-refund] adminGetConversationMessages failed', e)
      return error(e.message || '查询聊天记录失败')
    }
  }
}
