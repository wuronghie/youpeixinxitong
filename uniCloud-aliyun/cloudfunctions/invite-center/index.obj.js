/**
 * 邀请中心云对象
 * 功能：
 *  1. 为当前用户生成/获取唯一邀请码 my_invite_code
 *  2. 接受邀请：根据邀请码绑定邀请关系，并为邀请双方发放优惠券
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

function generateInviteCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混淆字符
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
  },

  /**
   * 获取或生成当前用户的邀请码
   * 返回：{ invite_code }
   */
  async getMyInviteCode() {
    try {
      const db = uniCloud.database()

      const token = this.getUniIdToken()
      if (!token) {
        return error('未获取到token，请先登录')
      }

      let uid
      try {
        const payload = await this.uniID.checkToken(token)
        console.log('[invite-center.getMyInviteCode] checkToken 返回:', JSON.stringify(payload))

        // 情况1：标准 uni-id token 验证成功
        if (payload && payload.code === undefined && payload.uid) {
          uid = payload.uid
          console.log('[invite-center.getMyInviteCode] 使用标准 token，uid:', uid)
        } else if (payload && payload.code !== undefined && payload.code !== 0) {
          // 情况2：标准 token 验证失败，尝试按简单 token 解析
          console.warn('[invite-center.getMyInviteCode] 标准 token 验证失败，尝试解析简单 token')
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
            console.log('[invite-center.getMyInviteCode] 使用简单 token 解析，uid:', uid)
          } catch (decodeErr) {
            console.error('[invite-center.getMyInviteCode] 简单 token 解析失败:', decodeErr)
            uid = null
          }
        } else {
          // payload 格式异常，同样尝试简单 token
          console.warn('[invite-center.getMyInviteCode] payload 异常，尝试解析简单 token')
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
            console.log('[invite-center.getMyInviteCode] payload 异常，使用简单 token 解析，uid:', uid)
          } catch (decodeErr) {
            console.error('[invite-center.getMyInviteCode] 简单 token 解析失败:', decodeErr)
            uid = null
          }
        }
      } catch (checkErr) {
        // token 验证异常，同样尝试简单 token
        console.warn('[invite-center.getMyInviteCode] token 验证异常，尝试解析简单 token:', checkErr.message)
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          uid = parts.length >= 1 ? parts[0] : null
          console.log('[invite-center.getMyInviteCode] 使用简单 token 解析，uid:', uid)
        } catch (decodeErr) {
          console.error('[invite-center.getMyInviteCode] 简单 token 解析失败:', decodeErr)
          uid = null
        }
      }

      if (!uid) {
        console.error('[invite-center.getMyInviteCode] 无法从 token 中获取 uid，token 前 20 字符:', token.substring(0, 20))
        return error('登录已过期或token无效')
      }

      const users = db.collection('uni-id-users')

      // 先查已有的邀请码
      const doc = await users
        .doc(uid)
        .field({
          my_invite_code: true
        })
        .get()

      if (doc.data && doc.data.length > 0 && doc.data[0].my_invite_code) {
        return success(
          {
            invite_code: doc.data[0].my_invite_code
          },
          '获取成功'
        )
      }

      // 生成新的邀请码并确保唯一
      let inviteCode = ''
      const maxTry = 5
      for (let i = 0; i < maxTry; i++) {
        inviteCode = generateInviteCode(6)
        const exist = await users
          .where({
            my_invite_code: inviteCode
          })
          .count()
        if (!exist.total) break
        inviteCode = ''
      }

      if (!inviteCode) {
        return error('生成邀请码失败，请稍后重试')
      }

      await users
        .doc(uid)
        .update({
          my_invite_code: inviteCode
        })

      return success(
        {
          invite_code: inviteCode
        },
        '生成成功'
      )
    } catch (e) {
      console.error('[invite-center] 获取邀请码失败:', e)
      return error(e.message || '获取邀请码失败')
    }
  },

  /**
   * 接受邀请：根据邀请码绑定邀请关系，并为邀请双方发放优惠券
   * @param {Object} params
   * @param {String} params.invite_code 邀请码
   */
  async acceptInvite(params = {}) {
    const { invite_code } = params
    try {
      const db = uniCloud.database()
      const dbCmd = db.command

      const token = this.getUniIdToken()
      if (!token) {
        return error('未获取到token，请先登录')
      }

      if (!invite_code) {
        return error('邀请码不能为空')
      }

      let uid
      try {
        const payload = await this.uniID.checkToken(token)
        console.log('[invite-center.acceptInvite] checkToken 返回:', JSON.stringify(payload))

        // 情况1：标准 uni-id token 验证成功
        if (payload && payload.code === undefined && payload.uid) {
          uid = payload.uid
          console.log('[invite-center.acceptInvite] 使用标准 token，uid:', uid)
        } else if (payload && payload.code !== undefined && payload.code !== 0) {
          // 情况2：标准 token 验证失败，尝试按简单 token 解析
          console.warn('[invite-center.acceptInvite] 标准 token 验证失败，尝试解析简单 token')
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
            console.log('[invite-center.acceptInvite] 使用简单 token 解析，uid:', uid)
          } catch (decodeErr) {
            console.error('[invite-center.acceptInvite] 简单 token 解析失败:', decodeErr)
            uid = null
          }
        } else {
          // payload 格式异常，同样尝试简单 token
          console.warn('[invite-center.acceptInvite] payload 异常，尝试解析简单 token')
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
            console.log('[invite-center.acceptInvite] payload 异常，使用简单 token 解析，uid:', uid)
          } catch (decodeErr) {
            console.error('[invite-center.acceptInvite] 简单 token 解析失败:', decodeErr)
            uid = null
          }
        }
      } catch (checkErr) {
        // token 验证异常，同样尝试简单 token
        console.warn('[invite-center.acceptInvite] token 验证异常，尝试解析简单 token:', checkErr.message)
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          uid = parts.length >= 1 ? parts[0] : null
          console.log('[invite-center.acceptInvite] 使用简单 token 解析，uid:', uid)
        } catch (decodeErr) {
          console.error('[invite-center.acceptInvite] 简单 token 解析失败:', decodeErr)
          uid = null
        }
      }

      if (!uid) {
        console.error('[invite-center.acceptInvite] 无法从 token 中获取 uid，token 前 20 字符:', token.substring(0, 20))
        return error('登录已过期或token失效，请重新登录后再填写邀请码')
      }

      const users = db.collection('uni-id-users')

      // 查询当前用户信息，确认是家长且尚未绑定邀请人
      const selfDoc = await users
        .doc(uid)
        .field({
          role: true,
          inviter_uid: true,
          my_invite_code: true
        })
        .get()

      if (!selfDoc.data || selfDoc.data.length === 0) {
        return error('用户信息不存在')
      }

      const self = selfDoc.data[0]
      const role = self.role || 'parent'

      if (role !== 'parent') {
        // 目前只对家长生效
        return success(null, '仅家长角色参与邀请活动')
      }

      if (self.inviter_uid && Array.isArray(self.inviter_uid) && self.inviter_uid.length > 0) {
        // 已经绑定过邀请人，直接返回成功，避免重复绑定
        return success(null, '已绑定邀请人')
      }

      // 防止自己邀请自己
      if (self.my_invite_code && self.my_invite_code === invite_code) {
        return success(null, '不能使用自己的邀请码')
      }

      // 查找邀请人
      const inviterDoc = await users
        .where({
          my_invite_code: invite_code
        })
        .field({
          _id: true
        })
        .get()

      if (!inviterDoc.data || inviterDoc.data.length === 0) {
        return error('邀请码无效或邀请人不存在')
      }

      const inviterId = inviterDoc.data[0]._id

      if (inviterId === uid) {
        return success(null, '不能使用自己的邀请码')
      }

      // 绑定邀请关系（只绑定一次）
      await users
        .doc(uid)
        .update({
          inviter_uid: [inviterId],
          invite_time: Date.now()
        })

      // 为邀请双方发放优惠券（仅通过后台活动配置）
      const now = Date.now()

      const couponsCol = db.collection('coupons')
      const userCouponsCol = db.collection('user-coupons')
      const activitiesCol = db.collection('coupon-activities')

      // 仅使用邀请送券活动配置（后台 coupon-activities 表），不再根据优惠券模板 is_invite_reward 发放
      let couponId = null
      let activityId = null
      try {
        const actRes = await activitiesCol
          .where({
            type: 'invite_reward',
            status: 'active',
            target_role: dbCmd.in(['parent', 'all']),
            start_time: dbCmd.lte(new Date(now)),
            end_time: dbCmd.gte(new Date(now))
          })
          .limit(1)
          .get()
        if (actRes.data && actRes.data.length > 0) {
          const activity = actRes.data[0]
          couponId = activity.coupon_id
          activityId = activity._id
        }
      } catch (e) {
        console.error('[invite-center] 查询邀请活动失败:', e)
      }

      if (couponId) {
        const records = [
          {
            user_id: uid,
            role,
            coupon_id: couponId,
            source: 'invite',
            status: 'unused',
            issue_time: now,
            activity_id: activityId || null,
            remark: '活动：邀请送券-受邀新用户'
          },
          {
            user_id: inviterId,
            role: 'parent',
            coupon_id: couponId,
            source: 'invite',
            status: 'unused',
            issue_time: now,
            activity_id: activityId || null,
            remark: '活动：邀请送券-邀请人'
          }
        ]

        await userCouponsCol.add(records)
      }

      return success(null, '邀请关系已绑定')
    } catch (e) {
      console.error('[invite-center] 接受邀请失败:', e)
      return error(e.message || '接受邀请失败')
    }
  }
}

