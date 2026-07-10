const uniID = require('uni-id-common')

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

  try {
    const payload = await context.uniID.checkToken(token)
    if (payload.code) {
      throw new Error(payload.message || 'token校验失败')
    }
    return payload.uid
  } catch (err) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      if (parts.length >= 1) {
        return parts[0]
      }
    } catch (decodeError) {
      // ignore
    }
    throw new Error('token验证失败，请重新登录')
  }
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

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({ clientInfo })
  },

  /**
   * 家长申请退款
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
    const { order_id, reason = '', refund_type = 'only_refund', description = '', images = [] } = params

    console.log('[payment-refund] ========== 开始申请退款 ==========')
    console.log('[payment-refund] 请求参数:', JSON.stringify(params, null, 2))

    try {
      const user_id = await resolveUserId(this)
      console.log('[payment-refund] 用户ID:', user_id)
      
      if (!order_id) {
        console.error('[payment-refund] ❌ 缺少订单ID')
        return error('缺少订单ID')
      }

      console.log('[payment-refund] 查询订单, order_id:', order_id)
      const orderDoc = await db.collection('payment-orders').doc(order_id).get()
      if (!orderDoc.data || orderDoc.data.length === 0) {
        console.error('[payment-refund] ❌ 订单不存在, order_id:', order_id)
        return error('订单不存在')
      }
      const order = orderDoc.data[0]
      console.log('[payment-refund] 订单信息:', {
        order_id: order._id,
        order_no: order.order_no,
        status: order.status,
        payer_id: order.payer_id,
        appointment_id: order.appointment_id
      })
      
      if (order.payer_id !== user_id) {
        console.error('[payment-refund] ❌ 无法操作他人的订单, order.payer_id:', order.payer_id, 'user_id:', user_id)
        return error('无法操作他人的订单')
      }
      if (!['paid', 'success'].includes(order.status)) {
        console.error('[payment-refund] ❌ 订单状态不支持退款, status:', order.status)
        return error('当前订单状态不支持退款')
      }

      console.log('[payment-refund] 检查是否存在待处理的退款申请')
      const pendingRefund = await db.collection('payment-refunds')
        .where({ order_id, payer_id: user_id, status: dbCmd.in(['pending', 'processing']) })
        .count()
      console.log('[payment-refund] 待处理退款数量:', pendingRefund.total)
      if (pendingRefund.total > 0) {
        console.warn('[payment-refund] ⚠️ 已存在待处理的退款申请')
        return error('已提交退款申请，请等待处理')
      }

      console.log('[payment-refund] 查询预约信息, appointment_id:', order.appointment_id)
      const appointmentDoc = await db.collection('appointments').doc(order.appointment_id).get()
      const appointment = appointmentDoc.data && appointmentDoc.data.length > 0 ? appointmentDoc.data[0] : null
      console.log('[payment-refund] 预约信息:', appointment ? {
        appointment_id: appointment._id,
        course_type: appointment.course_type,
        teacher_id: appointment.teacher_id,
        status: appointment.status,
        has_review: appointment.has_review
      } : '无')

      // 家长一旦在合并的「评价 + 确认结果」页提交，预约会切到 completed 并写入 has_review，
      // 视为认可本次结算，不再允许申请退款（前端已拦截，这里做服务端二次校验）
      if (appointment && (appointment.status === 'completed' || appointment.has_review === true)) {
        console.warn('[payment-refund] ❌ 订单已确认完成，不允许再申请退款', {
          status: appointment.status,
          has_review: appointment.has_review
        })
        return error('订单已确认，不可再申请退款')
      }

      let refundAmount = Number(order.amount || order.total_amount || 0)
      if (appointment && appointment.course_type === 'trial') {
        refundAmount = Math.round(refundAmount * 0.5 * 100) / 100
        console.log('[payment-refund] 试课订单，退款金额为50%:', refundAmount)
      }
      if (refundAmount <= 0) {
        console.error('[payment-refund] ❌ 订单金额异常, refundAmount:', refundAmount)
        return error('订单金额异常，无法申请退款')
      }

      const refundRecord = {
        order_id,
        order_no: order.order_no,
        appointment_id: order.appointment_id,
        payer_id: user_id,
        amount: refundAmount,
        reason,
        refund_type,
        description,
        images: images.slice(0, 6),
        status: 'pending',
        teacher_review_status: appointment ? 'pending' : 'approved',
        teacher_id: appointment ? appointment.teacher_id : null,
        create_time: Date.now(),
        update_time: Date.now()
      }

      console.log('[payment-refund] 准备创建退款记录:', JSON.stringify(refundRecord, null, 2))
      const refundRes = await db.collection('payment-refunds').add(refundRecord)
      if (!refundRes.id) {
        console.error('[payment-refund] ❌ 创建退款记录失败, refundRes:', refundRes)
        return error('提交退款申请失败')
      }
      console.log('[payment-refund] ✅ 退款记录创建成功, refund_id:', refundRes.id)

      console.log('[payment-refund] 更新订单状态为退款中')
      await db.collection('payment-orders').doc(order_id).update({
        status: 'refunding',
        refund_amount: refundAmount,
        refund_reason: reason,
        refund_request_id: refundRes.id,
        update_time: Date.now()
      })
      console.log('[payment-refund] ✅ 订单状态更新成功')

      if (appointment) {
        console.log('[payment-refund] 更新预约退款状态')
        await db.collection('appointments').doc(appointment._id).update({
          refund_status: 'pending',
          update_time: Date.now()
        })
        console.log('[payment-refund] ✅ 预约状态更新成功')
      }

      console.log('[payment-refund] ========== 退款申请成功 ==========')
      return success({ refund_id: refundRes.id, refund_amount: refundAmount }, '退款申请已提交，等待审核')
    } catch (e) {
      console.error('[payment-refund] ❌ 申请退款异常:', {
        error: e,
        message: e.message,
        stack: e.stack
      })
      return error(e.message || '申请退款失败')
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
      // 如果是管理员模式，不需要验证 token
      let reviewer_id = null
      if (!isAdmin) {
        try {
          reviewer_id = await resolveUserId(this)
        } catch (tokenError) {
          console.warn('[payment-refund] token 验证失败，尝试管理员模式:', tokenError.message)
          // 如果 token 验证失败，可能是后台管理系统调用，允许继续（但记录警告）
        }
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
      if (refund.teacher_review_status === 'pending') {
        return error('教师尚未处理退款申请')
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

        // 更新预约状态
        if (refund.appointment_id) {
          await db.collection('appointments').doc(refund.appointment_id).update({
            refund_status: refundResult ? 'success' : 'processing', // 如果退款成功则为 success，否则为 processing
            status: refund.refund_type === 'refund_cancel' ? 'cancelled' : order.status,
            update_time: now
          })
        }

        // 更新退款记录
        await db.collection('payment-refunds').doc(refund_id).update({
          status: refundResult ? 'success' : 'processing', // 如果退款成功则为 success，否则为 processing
          reviewer_id,
          review_opinion: opinion,
          review_time: now,
          finish_time: refundResult ? now : null, // 如果退款成功则设置完成时间
          refund_result_payload: refundResult ? JSON.stringify(refundResult) : null,
          out_trade_no: out_trade_no, // 保存 uni-pay 订单号
          update_time: now
        })

        const message = refundResult 
          ? '退款审核通过，退款已成功处理' 
          : '退款审核通过，但退款处理失败，请手动处理'
        
        return success({ 
          refund_id, 
          status: refundResult ? 'success' : 'processing',
          refund_result: refundResult
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
        actionableRes
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
        ])).count()
      ])

      return success({
        total: totalRes.total || 0,
        pending: pendingRes.total || 0,
        processing: processingRes.total || 0,
        success: successRes.total || 0,
        rejected: rejectedRes.total || 0,
        waiting_teacher: waitingTeacherRes.total || 0,
        actionable: actionableRes.total || 0
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
      }

      const kw = String(keyword || '').trim()
      if (kw) {
        const kwCond = dbCmd.or([
          { _id: kw },
          { order_no: kw },
          { order_no: new RegExp(kw, 'i') },
          { order_id: kw },
          { appointment_id: kw },
          { payer_id: kw },
          { teacher_id: kw },
          { reason: new RegExp(kw, 'i') }
        ])
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
            type: true
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
        return {
          ...item,
          parent_name: userNameMap[item.payer_id] || '',
          teacher_name: teacherNameMap[item.teacher_id] || userNameMap[item.teacher_id] || '',
          appointment_no: apt ? apt.appointment_no : '',
          appointment_status: apt ? apt.status : '',
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
