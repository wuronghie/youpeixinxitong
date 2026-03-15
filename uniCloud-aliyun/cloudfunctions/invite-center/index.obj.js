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

function decodeSimpleTokenUid(token = '') {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split('_')
    return parts.length >= 1 ? parts[0] : null
  } catch (e) {
    return null
  }
}

async function resolveUidFromToken(instance, token, scene = 'unknown') {
  let uid = ''
  try {
    const payload = await instance.uniID.checkToken(token)
    console.log(`[invite-center.${scene}] checkToken 返回:`, JSON.stringify(payload))

    // 兼容不同版本 uni-id-common 的成功返回格式
    const isSuccess =
      payload &&
      payload.uid &&
      (payload.code === undefined || payload.code === 0)

    if (isSuccess) {
      uid = payload.uid
      console.log(`[invite-center.${scene}] 使用标准 token，uid:`, uid)
      return uid
    }

    console.warn(`[invite-center.${scene}] 标准 token 未直接解析出 uid，尝试简单 token 解析`)
  } catch (checkErr) {
    console.warn(`[invite-center.${scene}] token 验证异常，尝试解析简单 token:`, checkErr.message)
  }

  uid = decodeSimpleTokenUid(token)
  if (uid) {
    console.log(`[invite-center.${scene}] 使用简单 token 解析，uid:`, uid)
  } else {
    console.error(`[invite-center.${scene}] 简单 token 解析失败`)
  }
  return uid || ''
}

async function issueInviteRewards({
  db,
  uid,
  role,
  inviterId,
  couponId,
  activityId,
  now
}) {
  const userCouponsCol = db.collection('user-coupons')
  const issuedRecords = []
  const invitePairKey = `${inviterId}_${uid}`

  const rewardTargets = [
    {
      user_id: uid,
      role,
      coupon_id: couponId,
      source: 'invite',
      status: 'unused',
      issue_time: now,
      activity_id: activityId || null,
      invite_pair_key: invitePairKey,
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
      invite_pair_key: invitePairKey,
      remark: '活动：邀请送券-邀请人'
    }
  ]

  for (const record of rewardTargets) {
    const where = {
      user_id: record.user_id,
      coupon_id: record.coupon_id,
      source: 'invite',
      invite_pair_key: invitePairKey
    }
    if (activityId) {
      where.activity_id = activityId
    }

    const existed = await userCouponsCol.where(where).limit(1).get()
    if (existed.data && existed.data.length > 0) {
      console.log('[invite-center.acceptInvite] 邀请奖励已存在，跳过重复发放:', {
        user_id: record.user_id,
        coupon_id: record.coupon_id,
        activity_id: activityId || null,
        invite_pair_key: invitePairKey,
        existed: existed.data[0]
      })
      continue
    }

    const addRes = await userCouponsCol.add(record)
    issuedRecords.push({
      user_id: record.user_id,
      coupon_id: record.coupon_id,
      activity_id: activityId || null,
      invite_pair_key: invitePairKey,
      addResult: addRes
    })
  }

  return issuedRecords
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

      const uid = await resolveUidFromToken(this, token, 'getMyInviteCode')

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

      console.log('[invite-center.acceptInvite] 开始绑定邀请码:', {
        invite_code,
        hasToken: !!token
      })

      const uid = await resolveUidFromToken(this, token, 'acceptInvite')

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
          my_invite_code: true,
          nickname: true
        })
        .get()

      console.log('[invite-center.acceptInvite] 当前用户查询结果:', {
        uid,
        selfDocCount: selfDoc.data ? selfDoc.data.length : 0,
        selfDoc: selfDoc.data && selfDoc.data.length > 0 ? selfDoc.data[0] : null
      })

      if (!selfDoc.data || selfDoc.data.length === 0) {
        return error('用户信息不存在')
      }

      const self = selfDoc.data[0]
      let role = 'parent'
      if (Array.isArray(self.role)) {
        if (self.role.includes('parent')) {
          role = 'parent'
        } else if (self.role.includes('teacher')) {
          role = 'teacher'
        } else if (self.role.length > 0) {
          role = self.role[0]
        }
      } else if (typeof self.role === 'string' && self.role) {
        role = self.role
      }

      console.log('[invite-center.acceptInvite] 当前用户角色解析结果:', {
        uid,
        rawRole: self.role,
        resolvedRole: role,
        inviter_uid: self.inviter_uid,
        my_invite_code: self.my_invite_code
      })

      if (role !== 'parent') {
        // 目前只对家长生效
        return success(null, '仅家长角色参与邀请活动')
      }

      const boundInviterId = self.inviter_uid && Array.isArray(self.inviter_uid) && self.inviter_uid.length > 0
        ? self.inviter_uid[0]
        : ''

      // 防止自己邀请自己
      if (self.my_invite_code && self.my_invite_code === invite_code) {
        return success(null, '不能使用自己的邀请码')
      }

      // 查找邀请码对应的邀请人
      let inviterDoc = await users
        .where({
          my_invite_code: invite_code
        })
        .field({
          _id: true,
          role: true,
          nickname: true,
          my_invite_code: true
        })
        .get()

      console.log('[invite-center.acceptInvite] 邀请人查询结果:', {
        invite_code,
        inviterCount: inviterDoc.data ? inviterDoc.data.length : 0,
        inviterDoc: inviterDoc.data && inviterDoc.data.length > 0 ? inviterDoc.data[0] : null
      })

      if (!inviterDoc.data || inviterDoc.data.length === 0) {
        // 如果已绑定过邀请人，允许走“补发奖励”逻辑
        if (!boundInviterId) {
          return error('邀请码无效或邀请人不存在')
        }
      }

      let inviterId = inviterDoc.data && inviterDoc.data.length > 0 ? inviterDoc.data[0]._id : ''
      if (boundInviterId) {
        console.log('[invite-center.acceptInvite] 当前账号已绑定邀请人，进入补发检查逻辑:', {
          uid,
          boundInviterId,
          inputInviteOwner: inviterId || null
        })
        // 如果已绑定且本次输入的邀请码对应的是另一个邀请人，直接返回，避免错误改绑
        if (inviterId && inviterId !== boundInviterId) {
          return success(null, '已绑定其他邀请人')
        }
        inviterId = boundInviterId
      }

      if (inviterId === uid) {
        return success(null, '不能使用自己的邀请码')
      }

      // 仅首次绑定时写入 inviter_uid；已绑定时只做补发奖励检查
      if (!boundInviterId) {
        await users
          .doc(uid)
          .update({
            inviter_uid: [inviterId],
            invite_time: Date.now()
          })

        console.log('[invite-center.acceptInvite] 邀请关系绑定成功:', {
          uid,
          inviterId,
          invite_code
        })
      }

      // 为邀请双方发放优惠券（仅通过后台活动配置）
      const now = Date.now()

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
            start_time: dbCmd.lte(now),
            end_time: dbCmd.gte(now)
          })
          .limit(1)
          .get()

        console.log('[invite-center.acceptInvite] 邀请送券活动查询结果:', {
          now,
          activityCount: actRes.data ? actRes.data.length : 0,
          activity: actRes.data && actRes.data.length > 0 ? actRes.data[0] : null
        })

        if (actRes.data && actRes.data.length > 0) {
          const activity = actRes.data[0]
          couponId = activity.coupon_id
          activityId = activity._id
        }
      } catch (e) {
        console.error('[invite-center] 查询邀请活动失败:', e)
      }

      if (couponId) {
        console.log('[invite-center.acceptInvite] 准备发放邀请奖励优惠券:', {
          uid,
          inviterId,
          couponId,
          activityId
        })
        const addRes = await issueInviteRewards({
          db,
          uid,
          role,
          inviterId,
          couponId,
          activityId,
          now
        })
        console.log('[invite-center.acceptInvite] 优惠券发放完成:', {
          couponId,
          activityId,
          addResult: addRes
        })
      } else {
        console.warn('[invite-center.acceptInvite] 未找到有效的邀请送券活动，本次仅绑定关系不发券', {
          uid,
          inviterId,
          invite_code,
          now
        })
      }

      return success(null, boundInviterId ? '已绑定邀请人，已检查邀请奖励' : '邀请关系已绑定')
    } catch (e) {
      console.error('[invite-center] 接受邀请失败:', e)
      return error(e.message || '接受邀请失败')
    }
  }
}

