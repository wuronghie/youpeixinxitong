/**
 * 创建支付云对象
 * 功能：创建支付订单（试课费、正式课程费、保证金）
 * 使用 uni-id-common 进行 token 验证
 */

const uniID = require('uni-id-common')

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

function generateOrderNo(prefix = 'ORD') {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `${prefix}${timestamp}${random}`
}

async function resolveUserId(context) {
  const token = context.getUniIdToken()
  if (!token) {
    throw new Error('未获取到token，请先登录')
  }
  try {
    const payload = await context.uniID.checkToken(token)
    if (payload.code) {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      return parts.length >= 1 ? parts[0] : null
    }
    return payload.uid
  } catch (err) {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split('_')
    return parts.length >= 1 ? parts[0] : null
  }
}

async function handlePaySuccess(db, order, options = {}) {
  const appointmentDoc = await db.collection('appointments').doc(order.appointment_id).get()
  if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
    throw new Error('关联预约不存在')
  }
  const appointment = appointmentDoc.data[0]
  const now = Date.now()
  const payment_time = options.pay_time || now
  const transaction_id = options.transaction_id || `MOCK${now}`
  const channel = options.channel || order.channel || 'wxpay'

    await db.collection('payment-orders').doc(order._id).update({
    status: 'paid',
    payment_time,
    transaction_id,
    channel,
    payment_notify_payload: options.raw_payload || null,
    update_time: now
  })

    // 如果使用了优惠券，标记优惠券为已使用
    if (order.user_coupon_id) {
      try {
        await db.collection('user-coupons')
          .doc(order.user_coupon_id)
          .update({
            status: 'used',
            order_id: order._id,
            use_time: payment_time,
            update_time: now
          })
      } catch (couponErr) {
        console.error('[payment-create] 标记优惠券已使用失败:', couponErr)
      }
    }

  if (order.order_type === 'course_fee') {
    const nextStatus = appointment.deposit_paid || appointment.status === 'confirmed'
      ? 'confirmed'
      : 'pending_confirm'
    await db.collection('appointments').doc(order.appointment_id).update({
      status: nextStatus,
      payment_time,
      parent_paid: true,
      parent_payment_time: payment_time,
      parent_payment_order_id: order._id,
      update_time: now
    })
    
    // 支付课程费后，更新会话状态（会话应该在联系老师或试课邀请时已创建）
    const conversationDoc = await db.collection('chat-conversations')
      .where({ appointment_id: order.appointment_id })
      .get()
    
    if (conversationDoc.data && conversationDoc.data.length > 0) {
      // 如果会话已存在，更新聊天状态
      const conversationId = conversationDoc.data[0]._id
      await db.collection('chat-conversations').doc(conversationId).update({
        chat_enabled: true, // 确保聊天功能已开启
        update_time: now
      })
      
      // 确保预约的 conversation_id 已保存
      if (!appointment.conversation_id) {
        await db.collection('appointments').doc(order.appointment_id).update({
          conversation_id: conversationId,
          update_time: now
        })
      }
    } else {
      // 如果会话不存在，记录警告（不应该发生，因为会话应该在联系老师或试课邀请时创建）
      console.warn('[payment-create] 支付课程费时会话不存在，appointment_id:', order.appointment_id)
      // 不自动创建会话，因为根据新流程，会话应该在联系老师或试课邀请时创建
    }
    
    return { appointment_status: nextStatus }
  }

  if (order.order_type === 'deposit') {
    // 支付保证金后，不自动确认预约，保持当前状态（pending_confirm 或 contact_request）
    // 需要老师手动点击"确认预约"按钮才会变为 confirmed
    const currentStatus = appointment.status
    const nextStatus = currentStatus === 'contact_request' ? 'contact_request' : 'pending_confirm'
    
    await db.collection('appointments').doc(order.appointment_id).update({
      status: nextStatus,
      deposit_paid: true,
      deposit_time: payment_time,
      update_time: now
      // 不设置 confirm_time，等老师确认预约时再设置
    })

    // 支付保证金后，更新会话状态（会话应该在联系请求时已创建）
    const conversationDoc = await db.collection('chat-conversations')
      .where({ appointment_id: order.appointment_id })
      .get()

    if (conversationDoc.data && conversationDoc.data.length > 0) {
      // 如果会话已存在（联系请求阶段创建的），更新聊天状态
      const conversationId = conversationDoc.data[0]._id
      await db.collection('chat-conversations').doc(conversationId).update({
        chat_enabled: true,
        teacher_deposit_paid: true,
        update_time: now
      })
    } else {
      // 如果会话不存在，记录警告（不应该发生，因为会话应该在联系请求时创建）
      console.warn('[payment-create] 支付保证金时会话不存在，appointment_id:', order.appointment_id)
      // 不自动创建会话，因为根据新流程，会话应该在联系老师时创建
    }
    return { appointment_status: nextStatus }
  }

  return { appointment_status: appointment.status }
}

module.exports = {
  _before: function() {
    // 云对象前置方法，初始化 uni-id 实例
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
  },
  
  /**
   * 创建支付订单（使用 token 验证）
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {String} params.payment_type 支付类型（course_fee/deposit/refund）
   * @param {Number} params.amount 支付金额
   * @returns {Object}
   */
  async create(params) {
    const {
      appointment_id,
      payment_type,
      amount,
      channel = 'wxpay',
      user_coupon_id // 可选：用户优惠券记录ID（仅课程费支付时使用）
    } = params
    
    try {
      const db = uniCloud.database()
      
      const payer_id = await resolveUserId(this)
      if (!payer_id) {
        return error('token验证失败，请重新登录')
      }
      
      if (!appointment_id) {
        return error('预约ID不能为空')
      }
      
      if (!payment_type) {
        return error('支付类型不能为空')
      }
      
      // 金额转换与校验：支持小于1元以及 0 元场景（全额优惠）
      const amountNum = Number(amount)
      if (isNaN(amountNum) || amountNum < 0) {
        return error('支付金额不合法')
      }
      
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 课程原价（未扣除优惠），用于校验与统计（单位：元，保留两位小数）
      const originalAmount = parseFloat(Number(appointment.total_amount || appointment.amount || 0).toFixed(2))
      // 优惠相关字段在整个函数作用域内声明，避免在非课程费场景下出现未定义错误
      let discountAmount = 0
      let couponId = null
      
      if (payment_type === 'course_fee') {
        if (payer_id !== appointment.parent_id) {
          return error('只有预约家长可以支付课程费')
        }
        
        if (appointment.parent_paid) {
          return error('课程费用已支付，无需重复支付')
        }
        
        const allowStatuses = ['pending_payment', 'pending_confirm', 'confirmed', 'in_progress']
        if (!allowStatuses.includes(appointment.status)) {
          return error('当前预约状态不允许支付')
        }
        
        // 如果是试课预约，必须是由老师发起的邀请（invited_by === 'teacher' 或 status 曾经是 trial_invited）
        if (appointment.course_type === 'trial') {
          // 检查是否有 invited_by 字段，或者检查预约历史
          // 如果预约状态不是从 trial_invited 转换来的，说明是家长直接创建的，不允许支付
          if (!appointment.invited_by || appointment.invited_by !== 'teacher') {
            return error('试课预约只能由老师发起邀请，请先联系老师')
          }
        }
        
        // 处理优惠券：如果传入 user_coupon_id，则根据券规则计算应付金额
        if (user_coupon_id) {
          // 查询用户优惠券记录
          const userCouponDoc = await db.collection('user-coupons')
            .doc(user_coupon_id)
            .get()
          
          if (!userCouponDoc.data || userCouponDoc.data.length === 0) {
            return error('优惠券不存在或已失效')
          }
          
          const userCoupon = userCouponDoc.data[0]
          
          if (userCoupon.user_id !== payer_id || userCoupon.role !== 'parent') {
            return error('无权使用该优惠券')
          }
          
          if (userCoupon.status !== 'unused') {
            return error('该优惠券已使用或已失效')
          }
          
          // 查询券模板
          const couponDoc = await db.collection('coupons')
            .doc(userCoupon.coupon_id)
            .get()
          
          if (!couponDoc.data || couponDoc.data.length === 0) {
            return error('优惠券模板不存在')
          }
          
          const coupon = couponDoc.data[0]
          const nowTs = Date.now()
          
          if (coupon.status !== 'active') {
            return error('该优惠券活动已结束')
          }
          
          if (coupon.target_role && !['parent', 'all'].includes(coupon.target_role)) {
            return error('该优惠券仅限指定角色使用')
          }
          
          if (coupon.valid_from && nowTs < new Date(coupon.valid_from).getTime()) {
            return error('该优惠券尚未生效')
          }
          
          if (coupon.valid_to && nowTs > new Date(coupon.valid_to).getTime()) {
            return error('该优惠券已过期')
          }
          
          // 检查使用门槛
          const minSpend = Number(coupon.min_spend || 0)
          if (minSpend > 0 && originalAmount < minSpend) {
            return error(`订单金额未达到使用门槛，需满¥${minSpend.toFixed(2)} 才可使用`)
          }
          
          // 计算优惠金额
          if (coupon.type === 'amount') {
            discountAmount = Number(coupon.amount || 0)
          } else if (coupon.type === 'discount') {
            const discountRate = Number(coupon.discount || 0)
            if (discountRate <= 0 || discountRate >= 1) {
              return error('优惠券折扣配置错误')
            }
            discountAmount = originalAmount * (1 - discountRate)
          } else {
            return error('不支持的优惠券类型')
          }
          
          if (!discountAmount || discountAmount <= 0) {
            return error('优惠金额无效')
          }
          
          if (discountAmount > originalAmount) {
            discountAmount = originalAmount
          }
          
          // 统一保留两位小数，避免浮点误差
          discountAmount = parseFloat(discountAmount.toFixed(2))
          couponId = coupon._id
          
          const expectedPayable = parseFloat((originalAmount - discountAmount).toFixed(2))
          
          // 使用“分”为单位再次比较，避免 0.1 与 0.10000001 这类浮点问题
          const payCents = Math.round(amountNum * 100)
          const expectedCents = Math.round(expectedPayable * 100)
          
          if (payCents !== expectedCents) {
            console.warn('[payment-create] 金额校验失败（使用优惠券）:', {
              appointment_id,
              originalAmount,
              discountAmount,
              expectedPayable,
              amount_client: amount,
              amountNum,
              payCents,
              expectedCents
            })
            return error('支付金额与优惠后金额不符')
          }
        } else {
          // 未使用优惠券时，要求支付金额等于预约金额（同样用“分”比较）
          const payCents = Math.round(amountNum * 100)
          const originalCents = Math.round(originalAmount * 100)
          if (payCents !== originalCents) {
            console.warn('[payment-create] 金额校验失败（无优惠券）:', {
              appointment_id,
              originalAmount,
              amount_client: amount,
              amountNum,
              payCents,
              originalCents
            })
            return error('支付金额与预约金额不符')
          }
        }
        
      } else if (payment_type === 'deposit') {
        if (payer_id !== appointment.teacher_id) {
          return error('只有预约教师可以支付保证金')
        }
        
        // 保证金支付：允许在联系请求、待确认、待支付状态下支付
        // 联系请求（contact_request）状态下也可以支付保证金来开启聊天
        const allowedStatuses = ['contact_request', 'pending_confirm', 'pending_payment']
        if (!allowedStatuses.includes(appointment.status)) {
          return error('当前预约状态不允许支付保证金')
        }
        
        const configDoc = await db.collection('system-config')
          .where({ config_key: 'teacher_deposit_amount' })
          .get()
        
        const depositAmount = configDoc.data[0]?.config_value || 1
        
        if (amount !== depositAmount) {
          return error(`保证金金额应为${depositAmount}元`)
        }
        
        // 检查该老师是否已经为该家长支付过保证金（一个家长只需要支付一次）
        // 方式1: 检查会话中是否已标记为已支付
        const depositConversation = await db.collection('chat-conversations')
          .where({
            parent_id: appointment.parent_id,
            teacher_id: appointment.teacher_id,
            teacher_deposit_paid: true
          })
          .limit(1)
          .get()
        
        if (depositConversation.data && depositConversation.data.length > 0) {
          return error('该家长与老师已支付过保证金，无需重复支付')
        }
        
        // 方式2: 检查是否已有已支付的保证金订单（针对该家长和该老师）
        // 先查找该老师已支付的所有保证金订单
        const existingDepositOrders = await db.collection('payment-orders')
          .where({
            order_type: 'deposit',
            payer_id: payer_id, // 老师ID
            status: db.command.in(['paid', 'success'])
          })
          .get()
        
        // 如果存在已支付的保证金订单，检查这些订单是否属于该家长的预约
        if (existingDepositOrders.data && existingDepositOrders.data.length > 0) {
          const appointmentIds = existingDepositOrders.data.map(order => order.appointment_id)
          if (appointmentIds.length > 0) {
            const relatedAppointments = await db.collection('appointments')
              .where({
                _id: db.command.in(appointmentIds),
                parent_id: appointment.parent_id
              })
              .limit(1)
              .get()
            
            if (relatedAppointments.data && relatedAppointments.data.length > 0) {
              return error('该家长与老师已支付过保证金，无需重复支付')
            }
          }
        }
        
      } else {
        return error('不支持的支付类型')
      }
      
      const order = {
        order_no: generateOrderNo('ORD'),
        appointment_id,
        payer_id,
        payee_id: 'platform',
        order_type: payment_type,
        // 订单金额：amount 为实际支付金额；total_amount / original_amount 记录原价
        amount,
        total_amount: originalAmount || amount,
        original_amount: originalAmount || amount,
        discount_amount: payment_type === 'course_fee' ? (Number(discountAmount) || 0) : 0,
        user_coupon_id: payment_type === 'course_fee' && user_coupon_id ? user_coupon_id : null,
        coupon_id: payment_type === 'course_fee' && couponId ? couponId : null,
        status: 'pending',
        channel,
        payment_method: channel,
        create_time: Date.now(),
        update_time: Date.now()
      }
      
      const result = await db.collection('payment-orders').add(order)
      
      if (!result.id) {
        return error('创建支付订单失败')
      }
      
      const paymentParams = {
        orderId: result.id,
        orderNo: order.order_no,
        amount,
        channel,
        description: payment_type === 'course_fee'
          ? `${appointment.course_type === 'trial' ? '试课' : '正式课程'}费用`
          : '教师保证金',
        mockPayment: true
      }
      
      await db.collection('payment-orders').doc(result.id).update({
        payment_params: paymentParams
      })
      
      return success({
        order_id: result.id,
        order_no: order.order_no,
        channel,
        payment_type,
        amount,
        payment_params: paymentParams,
        tips: '开发阶段：请调用测试支付接口模拟支付成功'
      }, '支付订单创建成功')
      
    } catch (e) {
      console.error('创建支付订单失败:', e)
      return error(e.message || '创建支付订单失败')
    }
  },
  
  /**
   * 模拟支付成功（开发测试用）
   * 实际项目中应该通过微信支付回调通知
   * @param {Object} params
   * @param {String} params.order_no 订单号
   * @returns {Object}
   */
  /**
   * 更新支付订单状态为已支付（支付成功后调用）
   * @param {Object} params
   * @param {String} params.order_no 订单号
   * @param {String} params.out_trade_no uni-pay 支付单号（可选，用于退款）
   * @param {String} params.uni_pay_order_no uni-pay 订单号（可选）
   */
  async mockPaySuccess(params) {
    const { order_no, out_trade_no, uni_pay_order_no } = params
    
    try {
      const db = uniCloud.database()
      
      const orderDoc = await db.collection('payment-orders')
        .where({ order_no })
        .get()
      
      if (!orderDoc.data || orderDoc.data.length === 0) {
        return error('订单不存在')
      }
      
      const order = orderDoc.data[0]
      
      if (order.status !== 'pending') {
        return error('订单状态不正确')
      }
      
      const result = await handlePaySuccess(db, order, { channel: order.channel || 'wxpay' })
      
      // 保存 out_trade_no 到订单（供退款时使用）
      const updateData = {
        update_time: Date.now()
      }
      if (out_trade_no) {
        updateData.out_trade_no = out_trade_no
        console.log('[payment-create] 保存 out_trade_no 到订单:', out_trade_no)
      }
      if (uni_pay_order_no) {
        updateData.uni_pay_order_no = uni_pay_order_no
      }
      
      // 更新订单，保存 out_trade_no
      await db.collection('payment-orders').doc(order._id).update(updateData)
      
      return success({
        order_no,
        status: 'paid',
        appointment_status: result.appointment_status
      }, '支付成功')
      
    } catch (e) {
      console.error('模拟支付失败:', e)
      return error(e.message || '支付处理失败')
    }
  },
  
  /**
   * 获取用户的订单列表（使用 token 验证）
   * @param {Object} params
   * @param {String} params.payment_type 支付类型筛选：'all' | 'course_fee' | 'deposit' | 'refund'
   * @param {String} params.status 订单状态筛选：'all' | 'pending' | 'paid' | 'refunded' | 'cancelled'
   * @returns {Object}
   */
  async getOrderList(params) {
    const {
      payment_type = 'all',
      status = 'all',
      page = 1,
      pageSize = 20,
      order_id,
      appointment_id
    } = params
    
    try {
      const db = uniCloud.database()
      const dbCmd = db.command
      const user_id = await resolveUserId(this)
      if (!user_id) {
        return error('token验证失败，请重新登录')
      }
      
      const where = { payer_id: user_id }
      if (payment_type !== 'all') {
        where.order_type = payment_type
      }
      if (status !== 'all') {
        const statusMap = {
          unpaid: ['pending', 'unpaid'],
          pending: ['pending', 'unpaid'],
          paid: ['paid', 'success'],
          success: ['paid', 'success'],
          refunded: ['refunded'],
          refunding: ['refunding']
        }
        const statusArray = statusMap[status] || [status]
        where.status = dbCmd.in(statusArray)
      }
      if (order_id) {
        if (order_id.startsWith('ORD')) {
          where.order_no = order_id
        } else {
          where._id = order_id
        }
      }
      if (appointment_id) {
        where.appointment_id = appointment_id
      }
      
      const skip = Math.max(page - 1, 0) * pageSize
      const collection = db.collection('payment-orders')
      const orderRes = await collection
        .where(where)
        .orderBy('create_time', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      const totalRes = await collection.where(where).count()
      const orders = orderRes.data || []
      
      if (orders.length > 0) {
        const appointmentIds = [...new Set(orders.map(item => item.appointment_id).filter(Boolean))]
        if (appointmentIds.length > 0) {
          const appointmentsDoc = await db.collection('appointments')
            .where({ _id: dbCmd.in(appointmentIds) })
            .field({
              _id: true,
              appointment_no: true,
              course_type: true,
              date: true,
              start_time: true,
              teacher_id: true,
              teacher_info: true
            })
            .get()
          const appointmentMap = {}
          const teacherIds = []
          if (appointmentsDoc.data && appointmentsDoc.data.length > 0) {
            appointmentsDoc.data.forEach(a => {
              appointmentMap[a._id] = {
                _id: a._id,
                appointment_no: a.appointment_no,
                course_type: a.course_type,
                date: a.date,
                time: a.start_time,
                teacher_id: a.teacher_id,
                teacher_info: a.teacher_info || null
              }
              if (a.teacher_id) {
                teacherIds.push(a.teacher_id)
              }
            })
          }
          if (teacherIds.length > 0) {
            const teacherDoc = await db.collection('teacher-profiles')
              .where({ teacher_id: dbCmd.in(teacherIds) })
              .field({ teacher_id: true, display_name: true, avatar: true, title: true, subjects: true })
              .get()
            const teacherMap = {}
            if (teacherDoc.data && teacherDoc.data.length > 0) {
              teacherDoc.data.forEach(t => {
                teacherMap[t.teacher_id] = {
                  teacher_id: t.teacher_id,
                  display_name: t.display_name,
                  avatar: t.avatar,
                  title: t.title,
                  subjects: t.subjects
                }
              })
            }
            Object.keys(appointmentMap).forEach(id => {
              const info = appointmentMap[id]
              if (!info.teacher_info && info.teacher_id && teacherMap[info.teacher_id]) {
                info.teacher_info = teacherMap[info.teacher_id]
              }
            })
          }
          orders.forEach(item => {
            item.amount = Number(item.amount || item.total_amount || 0)
            item.appointment_info = appointmentMap[item.appointment_id] || null
          })
        }

        const orderIds = orders.map(item => item._id).filter(Boolean)
        if (orderIds.length > 0) {
          const refundsDoc = await db.collection('payment-refunds')
            .where({ order_id: dbCmd.in(orderIds) })
            .orderBy('create_time', 'desc')
            .get()
          if (refundsDoc.data && refundsDoc.data.length > 0) {
            const refundMap = {}
            refundsDoc.data.forEach(r => {
              if (!refundMap[r.order_id]) {
                refundMap[r.order_id] = r
              }
            })
            orders.forEach(item => {
              if (refundMap[item._id]) {
                item.refund_info = refundMap[item._id]
              }
            })
          }
        }
      }
      
      const total = totalRes.total || 0
      const hasMore = skip + orders.length < total
      
      return success({
        list: orders,
        pagination: {
          page,
          pageSize,
          total,
          hasMore
        }
      }, '查询成功')
      
    } catch (e) {
      console.error('查询订单列表失败:', e)
      return error(e.message || '查询失败')
    }
  },
  
  /**
   * 获取订单详情（使用 token 验证）
   * @param {Object} params
   * @param {String} params.order_id 订单ID
   * @returns {Object}
   */
  async getOrderDetail(params) {
    const { order_id } = params
    
    try {
      const db = uniCloud.database()
      const dbCmd = db.command
      
      if (!order_id) {
        return error('订单ID不能为空')
      }
      
      const user_id = await resolveUserId(this)
      if (!user_id) {
        return error('token验证失败，请重新登录')
      }
      
      const orderDoc = await db.collection('payment-orders')
        .doc(order_id)
        .get()
      
      if (!orderDoc.data || orderDoc.data.length === 0) {
        return error('订单不存在')
      }
      
      const order = orderDoc.data[0]
      
      if (order.payer_id !== user_id) {
        return error('无权查看此订单')
      }
      
      order.amount = Number(order.amount || order.total_amount || 0)
      order.has_review = false
      
      if (order.appointment_id) {
        const appointmentDoc = await db.collection('appointments')
          .doc(order.appointment_id)
          .get()
        if (appointmentDoc.data && appointmentDoc.data.length > 0) {
          const appointment = appointmentDoc.data[0]
          let teacherInfo = appointment.teacher_info || null
          if (!teacherInfo && appointment.teacher_id) {
            const teacherDoc = await db.collection('teacher-profiles')
              .where({ teacher_id: appointment.teacher_id })
              .field({ teacher_id: true, display_name: true, avatar: true, title: true, subjects: true })
              .limit(1)
              .get()
            if (teacherDoc.data && teacherDoc.data.length > 0) {
              teacherInfo = teacherDoc.data[0]
            }
          }
          
          let hasReview = false
          try {
            const reviewDoc = await db.collection('reviews')
              .where({ appointment_id: appointment._id })
              .field({ _id: true })
              .limit(1)
              .get()
            hasReview = !!(reviewDoc.data && reviewDoc.data.length > 0)
          } catch (reviewErr) {
            console.warn('[payment-create] 查询评价信息失败', reviewErr)
          }
          
          order.appointment_info = {
            _id: appointment._id,
            appointment_no: appointment.appointment_no,
            course_type: appointment.course_type,
            date: appointment.date,
            time: appointment.start_time,
            status: appointment.status,
            parent_paid: !!appointment.parent_paid,
            deposit_paid: !!appointment.deposit_paid,
            has_review: hasReview,
            teacher_info: teacherInfo
          }
          order.has_review = hasReview
        }
      }
      
      const refundDoc = await db.collection('payment-refunds')
        .where({ order_id: order._id })
        .orderBy('create_time', 'desc')
        .limit(1)
        .get()
      if (refundDoc.data && refundDoc.data.length > 0) {
        order.refund_info = refundDoc.data[0]
      }
      
      return success(order, '获取成功')
      
    } catch (e) {
      console.error('获取订单详情失败:', e)
      return error(e.message || '获取失败')
    }
  },

  async notify(params) {
    const { order_no, transaction_id, pay_time, channel = 'wxpay', raw_payload = null } = params
    try {
      if (!order_no) {
        return error('缺少订单号')
      }
      const db = uniCloud.database()
      const orderDoc = await db.collection('payment-orders')
        .where({ order_no })
        .get()
      if (!orderDoc.data || orderDoc.data.length === 0) {
        return error('订单不存在')
      }
      const order = orderDoc.data[0]
      if (order.status === 'paid') {
        return success({ order_no }, '订单已处理')
      }
      const result = await handlePaySuccess(db, order, { transaction_id, pay_time, channel, raw_payload })
      return success({ order_no, appointment_status: result.appointment_status }, '支付结果已更新')
    } catch (e) {
      console.error('处理支付回调失败:', e)
      return error(e.message || '支付回调处理失败')
    }
  }
}

