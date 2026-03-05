/**
 * 优惠券中心云对象
 * 功能：
 *  1. 查询当前家长可用优惠券列表
 *  2. 后台/系统向指定家长发放优惠券（后续可接入运营后台）
 *  3. 在下单/支付前校验并预计算优惠金额
 */

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

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
  },

  /**
   * 获取当前登录家长的可用优惠券
   * 场景：家长在下单/支付前，展示可选择的优惠券列表
   */
  async getAvailableCoupons() {
    try {
      const db = uniCloud.database()
      const dbCmd = db.command

      // 验证登录
      const token = this.getUniIdToken()
      if (!token) {
        return error('未获取到token，请先登录')
      }

      let uid
      try {
        const payload = await this.uniID.checkToken(token)
        console.log('[coupon-center.getAvailableCoupons] checkToken 返回:', JSON.stringify(payload))

        // 情况1：标准 uni-id token 验证成功
        if (payload && payload.code === undefined && payload.uid) {
          uid = payload.uid
        } else if (payload && payload.code !== undefined && payload.code !== 0) {
          // 情况2：标准 token 验证失败，尝试按简单 token 解析
          console.warn('[coupon-center.getAvailableCoupons] 标准 token 验证失败，尝试解析简单 token')
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
          } catch (decodeErr) {
            console.error('[coupon-center.getAvailableCoupons] 简单 token 解析失败:', decodeErr)
            uid = null
          }
        } else {
          // payload 格式异常，同样尝试简单 token
          console.warn('[coupon-center.getAvailableCoupons] payload 异常，尝试解析简单 token')
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
          } catch (decodeErr) {
            console.error('[coupon-center.getAvailableCoupons] 简单 token 解析失败:', decodeErr)
            uid = null
          }
        }
      } catch (checkErr) {
        console.warn('[coupon-center.getAvailableCoupons] token 验证异常，尝试解析简单 token:', checkErr.message)
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          uid = parts.length >= 1 ? parts[0] : null
        } catch (decodeErr) {
          console.error('[coupon-center.getAvailableCoupons] 简单 token 解析失败:', decodeErr)
          uid = null
        }
      }

      if (!uid) {
        console.error('[coupon-center.getAvailableCoupons] 无法从 token 中获取 uid，token 前 20 字符:', token.substring(0, 20))
        return error('登录已过期或token无效')
      }

      // 只面向家长角色发放优惠券（兼容 role 为字符串或数组的情况）
      const userDoc = await db.collection('uni-id-users')
        .doc(uid)
        .field({
          role: true
        })
        .get()

      let userRole = 'parent'
      if (userDoc.data && userDoc.data.length > 0) {
        const rawRole = userDoc.data[0].role
        if (Array.isArray(rawRole)) {
          if (rawRole.includes('parent')) {
            userRole = 'parent'
          } else if (rawRole.includes('teacher')) {
            userRole = 'teacher'
          } else if (rawRole.length > 0) {
            userRole = rawRole[0]
          }
        } else if (typeof rawRole === 'string' && rawRole) {
          userRole = rawRole
        }
      }

      console.log('[coupon-center.getAvailableCoupons] uid:', uid, 'userRole:', userRole)

      if (userRole !== 'parent') {
        console.log('[coupon-center.getAvailableCoupons] 当前角色不是家长，直接返回空列表')
        return success({
          list: []
        }, '当前角色不是家长，无可用优惠券')
      }

      const now = Date.now()

      // 1）查出该用户的未使用优惠券记录
      const userCouponsRes = await db.collection('user-coupons')
        .where({
          user_id: uid,
          role: 'parent',
          status: 'unused'
        })
        .get()

      const userCoupons = userCouponsRes.data || []
      console.log('[coupon-center.getAvailableCoupons] user_coupons 条数:', userCoupons.length)
      if (userCoupons.length === 0) {
        return success({
          list: []
        }, '暂无可用优惠券')
      }

      const couponIds = userCoupons.map(item => item.coupon_id).filter(Boolean)
      console.log('[coupon-center.getAvailableCoupons] couponIds:', couponIds)
      if (couponIds.length === 0) {
        return success({
          list: []
        }, '暂无可用优惠券')
      }

      // 2）查出对应的券模板，过滤掉已失效的活动
      const couponsRes = await db.collection('coupons')
        .where({
          _id: dbCmd.in(couponIds),
          status: 'active',
          target_role: dbCmd.in(['parent', 'all']),
          // 为兼容 timestamp/number 两种存储形式，这里直接和毫秒时间戳比较
          valid_from: dbCmd.lte(now),
          valid_to: dbCmd.gte(now)
        })
        .get()

      const couponMap = {}
      ;(couponsRes.data || []).forEach(c => {
        couponMap[c._id] = c
      })

      console.log('[coupon-center.getAvailableCoupons] 命中的券模板数量:', (couponsRes.data || []).length)

      const list = userCoupons
        .filter(uc => couponMap[uc.coupon_id])
        .map(uc => {
          const tpl = couponMap[uc.coupon_id]
          return {
            _id: uc._id,
            coupon_id: uc.coupon_id,
            name: tpl.name,
            description: tpl.description,
            type: tpl.type,
            amount: tpl.amount,
            discount: tpl.discount,
            min_spend: tpl.min_spend,
            valid_from: tpl.valid_from,
            valid_to: tpl.valid_to,
            source: uc.source,
            status: uc.status,
            issue_time: uc.issue_time
          }
        })

      console.log('[coupon-center.getAvailableCoupons] 最终可用优惠券数量:', list.length)

      return success({
        list
      }, '查询成功')
    } catch (e) {
      console.error('[coupon-center] 获取可用优惠券失败:', e)
      return error(e.message || '获取优惠券失败')
    }
  },

  /**
   * 试算某张优惠券在指定预约上的优惠金额
   * 不修改数据库，仅返回 originalAmount / discountAmount / payableAmount
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {String} params.user_coupon_id 用户优惠券记录ID（user-coupons._id）
   */
  async previewForAppointment(params = {}) {
    const { appointment_id, user_coupon_id } = params

    try {
      const db = uniCloud.database()

      const token = this.getUniIdToken()
      if (!token) {
        return error('未获取到token，请先登录')
      }

      if (!appointment_id) {
        return error('预约ID不能为空')
      }

      if (!user_coupon_id) {
        return error('优惠券记录ID不能为空')
      }

      // 兼容标准 uni-id token 与简单 token 的 uid 解析逻辑
      let uid
      try {
        const payload = await this.uniID.checkToken(token)

        // 情况1：标准 uni-id token 验证成功
        if (payload && payload.code === undefined && payload.uid) {
          uid = payload.uid
        } else if (payload && payload.code !== undefined && payload.code !== 0) {
          // 情况2：标准 token 验证失败，尝试按简单 token 解析
          console.warn('[coupon-center.previewForAppointment] 标准 token 验证失败，尝试解析简单 token')
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
          } catch (decodeErr) {
            console.error('[coupon-center.previewForAppointment] 简单 token 解析失败:', decodeErr)
            uid = null
          }
        } else {
          // payload 格式异常，同样尝试简单 token
          console.warn('[coupon-center.previewForAppointment] payload 异常，尝试解析简单 token')
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
          } catch (decodeErr) {
            console.error('[coupon-center.previewForAppointment] 简单 token 解析失败:', decodeErr)
            uid = null
          }
        }
      } catch (checkErr) {
        console.warn('[coupon-center.previewForAppointment] token 验证异常，尝试解析简单 token:', checkErr.message)
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          uid = parts.length >= 1 ? parts[0] : null
        } catch (decodeErr) {
          console.error('[coupon-center.previewForAppointment] 简单 token 解析失败:', decodeErr)
          uid = null
        }
      }

      if (!uid) {
        console.error('[coupon-center.previewForAppointment] 无法从 token 中获取 uid，token 前 20 字符:', token.substring(0, 20))
        return error('登录已过期或token无效')
      }

      // 查询预约信息，确认是当前家长的预约
      const appointmentDoc = await db.collection('appointments')
        .doc(appointment_id)
        .get()

      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }

      const appointment = appointmentDoc.data[0]
      if (appointment.parent_id !== uid) {
        return error('无权使用该预约的优惠券')
      }

      // 只对未支付的课程费订单进行优惠
      if (appointment.parent_paid) {
        return error('该预约已支付，无法再使用优惠券')
      }

      const originalAmount = Number(appointment.total_amount || appointment.amount || 0)
      if (!originalAmount || isNaN(originalAmount) || originalAmount <= 0) {
        return error('预约金额异常，无法使用优惠券')
      }

      // 查询用户优惠券记录
      const userCouponDoc = await db.collection('user-coupons')
        .doc(user_coupon_id)
        .get()

      if (!userCouponDoc.data || userCouponDoc.data.length === 0) {
        return error('优惠券不存在或已失效')
      }

      const userCoupon = userCouponDoc.data[0]

      if (userCoupon.user_id !== uid || userCoupon.role !== 'parent') {
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
      const now = Date.now()

      if (coupon.status !== 'active') {
        return error('该优惠券活动已结束')
      }

      if (coupon.target_role && !['parent', 'all'].includes(coupon.target_role)) {
        return error('该优惠券仅限指定角色使用')
      }

      if (coupon.valid_from && now < new Date(coupon.valid_from).getTime()) {
        return error('该优惠券尚未生效')
      }

      if (coupon.valid_to && now > new Date(coupon.valid_to).getTime()) {
        return error('该优惠券已过期')
      }

      // 检查使用门槛
      const minSpend = Number(coupon.min_spend || 0)
      if (minSpend > 0 && originalAmount < minSpend) {
        return error(`订单金额未达到使用门槛，需满¥${minSpend.toFixed(2)} 才可使用`)
      }

      // 计算优惠金额
      let discountAmount = 0
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

      const payableAmount = parseFloat((originalAmount - discountAmount).toFixed(2))

      return success({
        appointment_id,
        user_coupon_id,
        coupon_id: coupon._id,
        originalAmount,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        payableAmount,
        couponName: coupon.name,
        description: coupon.description,
        min_spend: minSpend
      }, '试算成功')
    } catch (e) {
      console.error('[coupon-center] 试算优惠券失败:', e)
      return error(e.message || '试算优惠失败')
    }
  }
}


