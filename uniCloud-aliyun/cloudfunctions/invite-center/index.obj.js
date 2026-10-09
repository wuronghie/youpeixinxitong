/**
 * 邀请中心云对象
 * 功能：
 *  1. 为当前用户生成/获取唯一邀请码 my_invite_code
 *  2. 接受邀请：根据邀请码绑定邀请关系，并为邀请双方发放优惠券
 */

const uniID = require('uni-id-common')
const {
  loadUserOpenid,
  recordOpenidClaim,
  countUserActivityTaken,
  loadActiveActivities,
  getCouponMap,
  sendCouponMessage
} = require('coupon-issue')

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

function resolveBizRole(raw) {
  if (Array.isArray(raw)) {
    if (raw.includes('parent')) return 'parent'
    if (raw.includes('teacher')) return 'teacher'
    return raw[0] || 'parent'
  }
  if (raw === 'teacher' || raw === 'parent') return raw
  return 'parent'
}

function firstInviterId(inviterUid) {
  if (Array.isArray(inviterUid) && inviterUid.length > 0) return inviterUid[0]
  return typeof inviterUid === 'string' ? inviterUid : ''
}

function unwrapDoc(res) {
  const data = res && res.data
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  if (typeof data === 'object') return data
  return null
}

async function safeWriteInvitedCode(users, uid, code) {
  if (!uid || !code) return
  try {
    await users.doc(uid).update({
      invited_code: String(code).toUpperCase()
    })
  } catch (e) {
    console.warn('[invite-center] 回写 invited_code 失败:', e && e.message)
  }
}

function pickInviteActivity(activities, role) {
  const list = activities || []
  return list.find((item) => item.target_role === role)
    || list.find((item) => !item.target_role || item.target_role === 'all')
    || list[0]
    || null
}

async function resolveBoundInviteCode(users, self = {}) {
  if (self.invited_code) return String(self.invited_code).toUpperCase()
  const inviterId = firstInviterId(self.inviter_uid)
  if (!inviterId) return ''
  const inviter = unwrapDoc(await users.doc(inviterId).get()) || {}
  return inviter.my_invite_code ? String(inviter.my_invite_code).toUpperCase() : ''
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
  inviterRole
}) {
  const userCouponsCol = db.collection('user-coupons')
  const issuedRecords = []
  const invitePairKey = `${inviterId}_${uid}`
  const inviteeOpenid = await loadUserOpenid(db, uid)
  const inviterOpenid = await loadUserOpenid(db, inviterId)
  const now = Date.now()
  let activities = await loadActiveActivities(db, {
    types: ['invite_reward'],
    now
  })
  // 兼容后台只打开优惠券模板「邀请奖励自动发放」，未建 invite_reward 活动
  if (!activities.length) {
    const tplRes = await db.collection('coupons')
      .where({
        is_invite_reward: true,
        status: 'active'
      })
      .limit(20)
      .get()
    activities = (tplRes.data || []).map((coupon) => ({
      _id: '',
      coupon_id: coupon._id,
      target_role: coupon.target_role || 'all'
    }))
  }
  const couponMap = await getCouponMap(db, activities.map((item) => item.coupon_id))

  const inviteeActivity = pickInviteActivity(activities, role)
  const inviterActivity = pickInviteActivity(activities, inviterRole)

  const rewardTargets = []
  if (inviteeActivity && inviteeActivity.coupon_id) {
    let skipInvitee = false
    if (inviteeActivity._id && inviteeOpenid) {
      const taken = await countUserActivityTaken(db, {
        uid,
        activityId: inviteeActivity._id,
        openid: inviteeOpenid
      })
      skipInvitee = taken > 0
      if (skipInvitee) {
        console.log('[invite-center.acceptInvite] 受邀微信号已领取过该活动券，跳过受邀人:', {
          uid,
          inviteeOpenid,
          activityId: inviteeActivity._id
        })
      }
    }
    if (!skipInvitee) {
      rewardTargets.push({
        user_id: uid,
        role,
        coupon_id: inviteeActivity.coupon_id,
        source: 'invite',
        status: 'unused',
        activity_id: inviteeActivity._id || null,
        invite_pair_key: invitePairKey,
        remark: '活动：邀请送券-受邀新用户',
        wx_openid: inviteeOpenid || undefined,
        claimOpenid: inviteeOpenid,
        couponName: (couponMap[inviteeActivity.coupon_id] && couponMap[inviteeActivity.coupon_id].name) || '优惠券'
      })
    }
  }

  if (inviterActivity && inviterActivity.coupon_id) {
    rewardTargets.push({
      user_id: inviterId,
      role: inviterRole,
      coupon_id: inviterActivity.coupon_id,
      source: 'invite',
      status: 'unused',
      activity_id: inviterActivity._id || null,
      invite_pair_key: invitePairKey,
      remark: '活动：邀请送券-邀请人',
      wx_openid: inviterOpenid || undefined,
      claimOpenid: '',
      couponName: (couponMap[inviterActivity.coupon_id] && couponMap[inviterActivity.coupon_id].name) || '优惠券'
    })
  }

  if (!rewardTargets.length) {
    console.warn('[invite-center.acceptInvite] 未找到有效的邀请送券活动，本次仅绑定关系不发券', {
      uid,
      inviterId,
      inviteeRole: role,
      inviterRole,
      activityCount: activities.length
    })
    return issuedRecords
  }

  for (const record of rewardTargets) {
    const claimOpenid = record.claimOpenid
    const couponName = record.couponName
    delete record.claimOpenid
    delete record.couponName
    if (!record.wx_openid) delete record.wx_openid
    if (!record.activity_id) delete record.activity_id

    const where = {
      user_id: record.user_id,
      coupon_id: record.coupon_id,
      source: 'invite',
      invite_pair_key: invitePairKey
    }
    if (record.activity_id) {
      where.activity_id = record.activity_id
    }

    const existed = await userCouponsCol.where(where).limit(1).get()
    if (existed.data && existed.data.length > 0) {
      console.log('[invite-center.acceptInvite] 邀请奖励已存在，跳过重复发放:', {
        user_id: record.user_id,
        coupon_id: record.coupon_id,
        activity_id: record.activity_id || null,
        invite_pair_key: invitePairKey,
        existed: existed.data[0]
      })
      continue
    }

    const addRes = await userCouponsCol.add(record)
    if (claimOpenid && record.activity_id) {
      await recordOpenidClaim(db, {
        openid: claimOpenid,
        activityId: record.activity_id,
        couponId: record.coupon_id,
        uid: record.user_id
      })
    }
    await sendCouponMessage(db, {
      uid: record.user_id,
      role: record.role,
      couponName
    })
    issuedRecords.push({
      user_id: record.user_id,
      role: record.role,
      coupon_id: record.coupon_id,
      activity_id: record.activity_id || null,
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
   * 返回：{ invite_code, bound_invite_code, bound }
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

      const doc = await users.doc(uid).get()
      const self = unwrapDoc(doc) || {}
      let inviteCode = self.my_invite_code || ''

      if (!inviteCode) {
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
      }

      const boundInviterId = firstInviterId(self.inviter_uid)
      let boundInviteCode = await resolveBoundInviteCode(users, self)
      const bound = !!(boundInviterId || boundInviteCode || self.invited_code)
      if (bound && boundInviteCode && !self.invited_code) {
        await safeWriteInvitedCode(users, uid, boundInviteCode)
      }

      let issuedCount = 0
      if (bound && boundInviterId) {
        try {
          const existed = await db.collection('user-coupons')
            .where({
              user_id: uid,
              source: 'invite'
            })
            .limit(1)
            .get()
          if (!existed.data || !existed.data.length) {
            const inviter = unwrapDoc(await users.doc(boundInviterId).get()) || {}
            const addRes = await issueInviteRewards({
              db,
              uid,
              role: resolveBizRole(self.role),
              inviterId: boundInviterId,
              inviterRole: resolveBizRole(inviter.role)
            })
            issuedCount = addRes.length
          }
        } catch (issueErr) {
          console.warn('[invite-center.getMyInviteCode] 补发邀请券失败:', issueErr && issueErr.message)
        }
      }

      return success(
        {
          invite_code: inviteCode,
          bound_invite_code: boundInviteCode,
          bound,
          issued_count: issuedCount
        },
        inviteCode === self.my_invite_code ? '获取成功' : '生成成功'
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
    const invite_code = String((params && params.invite_code) || '').trim().toUpperCase()
    try {
      const db = uniCloud.database()

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

      const selfDoc = await users.doc(uid).get()
      const self = unwrapDoc(selfDoc)

      console.log('[invite-center.acceptInvite] 当前用户查询结果:', {
        uid,
        self
      })

      if (!self) {
        return error('用户信息不存在')
      }

      const role = resolveBizRole(self.role)

      console.log('[invite-center.acceptInvite] 当前用户角色解析结果:', {
        uid,
        rawRole: self.role,
        resolvedRole: role,
        inviter_uid: self.inviter_uid,
        invited_code: self.invited_code,
        my_invite_code: self.my_invite_code
      })

      if (role !== 'parent' && role !== 'teacher') {
        return error('当前角色不能参与邀请活动')
      }

      const boundInviterId = firstInviterId(self.inviter_uid)
      let boundInviteCode = await resolveBoundInviteCode(users, self)

      // 已绑定：展示已填码、禁止改绑，仅在从未发过邀请券时补发
      if (boundInviterId || self.invited_code) {
        if (!boundInviteCode && boundInviterId) {
          const inviter = unwrapDoc(await users.doc(boundInviterId).get()) || {}
          boundInviteCode = inviter.my_invite_code ? String(inviter.my_invite_code).toUpperCase() : ''
        }
        if (boundInviteCode && !self.invited_code) {
          await safeWriteInvitedCode(users, uid, boundInviteCode)
        }
        let issuedCount = 0
        if (boundInviterId) {
          const inviter = unwrapDoc(await users.doc(boundInviterId).get()) || {}
          const addRes = await issueInviteRewards({
            db,
            uid,
            role,
            inviterId: boundInviterId,
            inviterRole: resolveBizRole(inviter.role)
          })
          issuedCount = addRes.length
        }
        return success({
          bound_invite_code: boundInviteCode,
          bound: true,
          already_bound: true,
          issued_count: issuedCount
        }, issuedCount ? '邀请奖励已补发' : '已填写邀请码')
      }

      if (self.my_invite_code && String(self.my_invite_code).toUpperCase() === invite_code) {
        return error('不能使用自己的邀请码')
      }

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
        return error('邀请码无效或邀请人不存在')
      }

      const inviterId = inviterDoc.data[0]._id
      const inviterRole = resolveBizRole(inviterDoc.data[0].role)

      if (inviterId === uid) {
        return error('不能使用自己的邀请码')
      }

      await users
        .doc(uid)
        .update({
          inviter_uid: [inviterId],
          invite_time: Date.now()
        })
      await safeWriteInvitedCode(users, uid, invite_code)

      console.log('[invite-center.acceptInvite] 邀请关系绑定成功:', {
        uid,
        inviterId,
        invite_code
      })

      const addRes = await issueInviteRewards({
        db,
        uid,
        role,
        inviterId,
        inviterRole
      })
      console.log('[invite-center.acceptInvite] 优惠券发放完成:', {
        issuedCount: addRes.length,
        addResult: addRes
      })

      return success({
        bound_invite_code: invite_code,
        bound: true,
        issued_count: addRes.length
      }, addRes.length ? '邀请码填写成功，优惠券已到账' : '邀请码填写成功')
    } catch (e) {
      console.error('[invite-center] 接受邀请失败:', e)
      return error(e.message || '接受邀请失败')
    }
  }
}

