'use strict'

/**
 * 优惠券发放公共逻辑
 * 供 coupon-center（后台批量）与 user-login（首次注册/登录送券）复用
 */

const TYPE_LABEL = {
  register_reward: '首次注册送券',
  login_reward: '登录送券',
  invite_reward: '邀请送券',
  flash_sale: '限时抢券'
}

const PAGE_SIZE_MAX = 80
const USER_IDS_MAX = 200
const { notifySystemMessage } = require('notify-push')

function toTs(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 0
  }
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function normalizeRole(rawRole, fallback = '') {
  if (Array.isArray(rawRole)) {
    if (rawRole.includes('teacher')) return 'teacher'
    if (rawRole.includes('parent')) return 'parent'
    return rawRole[0] || fallback
  }
  return typeof rawRole === 'string' && rawRole ? rawRole : fallback
}

function isBizRole(role) {
  const r = normalizeRole(role, '')
  return r === 'parent' || r === 'teacher'
}

function isActivityInDate(activity, now) {
  const start = toTs(activity && activity.start_time)
  let end = toTs(activity && activity.end_time)
  if (end) {
    const d = new Date(end)
    if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) {
      end = d.getTime() + 24 * 60 * 60 * 1000 - 1
    }
  }
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

function activityRoleMatch(activity, role) {
  const target = activity && activity.target_role
  return !target || target === 'all' || target === role
}

function couponRoleMatch(coupon, role) {
  const target = coupon && coupon.target_role
  return !target || target === 'all' || target === role
}

function couponPath(role) {
  return role === 'teacher' ? '/pages-teacher/coupon/list' : '/pages/coupon/list'
}

function typeLabel(type) {
  return TYPE_LABEL[type] || type || '优惠活动'
}

function extractWxOpenid(user) {
  const wx = user && user.wx_openid
  if (!wx) return ''
  if (typeof wx === 'string') return wx.trim()
  return String(wx.mp || wx['mp-weixin'] || '').trim()
}

function ownerWhere(dbCmd, { uid, openid }) {
  const parts = []
  if (uid) parts.push({ user_id: uid })
  if (openid) parts.push({ wx_openid: openid })
  if (parts.length === 0) return { user_id: '__none__' }
  if (parts.length === 1) return parts[0]
  return dbCmd.or(parts)
}

async function loadUserOpenid(db, uid) {
  if (!uid) return ''
  try {
    const doc = await db.collection('uni-id-users').doc(uid).field({ wx_openid: true }).get()
    const user = doc.data && doc.data[0]
    return extractWxOpenid(user)
  } catch (e) {
    console.warn('[coupon-issue] loadUserOpenid failed:', e && e.message)
    return ''
  }
}

async function recordOpenidClaim(db, { openid, activityId, couponId, uid }) {
  if (!openid || !activityId) return
  try {
    const existed = await db.collection('coupon-openid-claims')
      .where({
        wx_openid: openid,
        activity_id: activityId
      })
      .limit(1)
      .get()
    if (existed.data && existed.data.length) return
    await db.collection('coupon-openid-claims').add({
      wx_openid: openid,
      activity_id: activityId,
      coupon_id: couponId || '',
      user_id: uid || ''
    })
  } catch (e) {
    console.warn('[coupon-issue] recordOpenidClaim failed:', e && e.message)
  }
}

async function stampOpenidOnAccountDelete(db, { uid, openid }) {
  if (!uid || !openid) return
  const res = await db.collection('user-coupons')
    .where({ user_id: uid })
    .limit(100)
    .get()
  const list = res.data || []
  for (const item of list) {
    if (!item.wx_openid) {
      try {
        await db.collection('user-coupons').doc(item._id).update({ wx_openid: openid })
      } catch (e) {
        console.warn('[coupon-issue] stamp openid failed:', item._id, e && e.message)
      }
    }
    if (item.activity_id) {
      await recordOpenidClaim(db, {
        openid,
        activityId: item.activity_id,
        couponId: item.coupon_id,
        uid
      })
    }
  }
}

async function loadActiveActivities(db, { types, role, now } = {}) {
  const dbCmd = db.command
  const typeList = Array.isArray(types) ? types.filter(Boolean) : []
  if (!typeList.length) return []

  const res = await db.collection('coupon-activities')
    .where({
      type: dbCmd.in(typeList),
      status: 'active'
    })
    .limit(50)
    .get()

  const ts = now || Date.now()
  return (res.data || []).filter((activity) => {
    if (role && !activityRoleMatch(activity, role)) return false
    return isActivityInDate(activity, ts)
  })
}

async function getCouponMap(db, couponIds) {
  const ids = [...new Set((couponIds || []).filter(Boolean))]
  if (!ids.length) return {}
  const dbCmd = db.command
  const res = await db.collection('coupons')
    .where({ _id: dbCmd.in(ids) })
    .get()
  const map = {}
  ;(res.data || []).forEach((c) => {
    map[c._id] = c
  })
  return map
}

async function countUserActivityTaken(db, { uid, activityId, openid }) {
  if (!activityId) return 0
  const dbCmd = db.command
  let claimCount = 0
  if (openid) {
    try {
      const claimRes = await db.collection('coupon-openid-claims')
        .where({
          wx_openid: openid,
          activity_id: activityId
        })
        .count()
      claimCount = claimRes.total || 0
    } catch (e) {
      console.warn('[coupon-issue] count claims failed:', e && e.message)
    }
  }

  const owner = ownerWhere(dbCmd, { uid, openid })
  const couponRes = await db.collection('user-coupons')
    .where(dbCmd.and([
      { activity_id: activityId },
      owner
    ]))
    .count()
  const couponCount = couponRes.total || 0
  return Math.max(claimCount, couponCount)
}

async function countActivityIssued(db, activityId) {
  if (!activityId) return 0
  const res = await db.collection('user-coupons')
    .where({ activity_id: activityId })
    .count()
  return res.total || 0
}

async function hasUnusedSameCoupon(db, { uid, couponId, openid }) {
  const dbCmd = db.command
  const owner = ownerWhere(dbCmd, { uid, openid })
  const res = await db.collection('user-coupons')
    .where(dbCmd.and([
      { coupon_id: couponId },
      { status: 'unused' },
      owner
    ]))
    .limit(1)
    .get()
  return !!(res.data && res.data.length)
}

/**
 * @returns {{ ok: boolean, reason?: string }}
 */
async function checkCanIssue(db, {
  uid,
  role,
  coupon,
  activity,
  openid = '',
  skipExistingUnused = true
}) {
  if (!uid || !isBizRole(role)) {
    return { ok: false, reason: '用户角色无效' }
  }
  if (!coupon || !coupon._id) {
    return { ok: false, reason: '优惠券模板不存在' }
  }
  if (coupon.status && coupon.status !== 'active') {
    return { ok: false, reason: '优惠券模板已停用' }
  }
  if (!couponRoleMatch(coupon, role)) {
    return { ok: false, reason: '优惠券与用户角色不匹配' }
  }
  if (skipExistingUnused && await hasUnusedSameCoupon(db, { uid, couponId: coupon._id, openid })) {
    return { ok: false, reason: '已有未使用的同模板优惠券' }
  }
  if (activity) {
    let limit = Number(activity.per_user_limit || 0)
    if (activity.type === 'register_reward' || activity.type === 'login_reward') {
      if (limit <= 0) limit = 1
    }
    if (limit > 0) {
      const taken = await countUserActivityTaken(db, {
        uid,
        activityId: activity._id,
        openid
      })
      if (taken >= limit) {
        return { ok: false, reason: '该微信号已领取过此活动优惠券' }
      }
    }
  }
  return { ok: true }
}

async function sendCouponMessage(db, { uid, role, couponName }) {
  try {
    await db.collection('system-messages').add({
      user_id: uid,
      type: 'system',
      title: '您收到一张新的优惠券',
      content: `优惠券：${couponName || '优惠券'}，请在“我的优惠券”中查看并在有效期内使用。`,
      action: {
        type: 'navigate',
        path: couponPath(role),
        params: {}
      }
    })
    await notifySystemMessage({
      userId: uid,
      title: '您收到一张新的优惠券',
      content: `优惠券：${couponName || '优惠券'}，请在“我的优惠券”中查看并在有效期内使用。`,
      messageType: 'system'
    })
  } catch (e) {
    console.warn('[coupon-issue] 发送系统消息失败:', e && e.message)
  }
}

function buildUserCouponDoc({ uid, role, couponId, source, activity, remark, openid }) {
  const doc = {
    user_id: uid,
    role,
    coupon_id: couponId,
    source: source || 'system',
    status: 'unused',
    remark: remark || ''
  }
  if (openid) {
    doc.wx_openid = openid
  }
  // issue_time 由 schema forceDefaultValue 写入，客户端/云函数传值会报「不与默认值匹配」
  if (activity && activity._id) {
    doc.activity_id = activity._id
    if (!doc.remark) {
      doc.remark = `活动：${activity.name || ''}（${typeLabel(activity.type)}）`
    }
  }
  return doc
}

async function issueOne(db, {
  uid,
  role,
  coupon,
  activity,
  source,
  remark,
  openid = '',
  sendMessage = true
}) {
  const couponName = (coupon && coupon.name) || '优惠券'
  await db.collection('user-coupons').add(buildUserCouponDoc({
    uid,
    role,
    couponId: coupon._id,
    source,
    activity,
    remark,
    openid
  }))
  if (activity && activity._id && openid) {
    await recordOpenidClaim(db, {
      openid,
      activityId: activity._id,
      couponId: coupon._id,
      uid
    })
  }
  if (sendMessage) {
    await sendCouponMessage(db, { uid, role, couponName })
  }
  return true
}

/**
 * 登录/注册后按活动自动发券
 */
async function tryIssueActivities(db, {
  uid,
  role,
  types,
  openid = '',
  sendMessage = true
} = {}) {
  const userRole = normalizeRole(role, '')
  if (!uid || !isBizRole(userRole)) {
    return { issued: 0, skipped: 0, details: [] }
  }
  const wxOpenid = openid || await loadUserOpenid(db, uid)

  const now = Date.now()
  const activities = await loadActiveActivities(db, { types, role: userRole, now })
  if (!activities.length) {
    return { issued: 0, skipped: 0, details: [] }
  }

  const couponMap = await getCouponMap(db, activities.map((a) => a.coupon_id))
  let issued = 0
  let skipped = 0
  const details = []

  for (const activity of activities) {
    const coupon = couponMap[activity.coupon_id]
    const stock = Number(activity.total_stock)
    if (stock > 0) {
      const used = await countActivityIssued(db, activity._id)
      if (used >= stock) {
        skipped += 1
        details.push({ activity_id: activity._id, ok: false, reason: '活动库存已用完' })
        continue
      }
    }

    const check = await checkCanIssue(db, {
      uid,
      role: userRole,
      coupon,
      activity,
      openid: wxOpenid,
      skipExistingUnused: true
    })
    if (!check.ok) {
      skipped += 1
      details.push({ activity_id: activity._id, ok: false, reason: check.reason })
      continue
    }

    try {
      await issueOne(db, {
        uid,
        role: userRole,
        coupon,
        activity,
        source: 'system',
        remark: `活动：${activity.name}（${typeLabel(activity.type)}）`,
        openid: wxOpenid,
        sendMessage
      })
      issued += 1
      details.push({ activity_id: activity._id, ok: true, coupon_name: coupon.name || '优惠券' })
    } catch (e) {
      skipped += 1
      details.push({ activity_id: activity._id, ok: false, reason: e.message || '发券失败' })
      console.error('[coupon-issue] tryIssueActivities failed:', activity._id, e)
    }
  }

  return { issued, skipped, details }
}

async function listUsersByRole(db, { role, skip = 0, limit = PAGE_SIZE_MAX } = {}) {
  const size = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(limit, 10) || PAGE_SIZE_MAX))
  const offset = Math.max(0, parseInt(skip, 10) || 0)
  const dbCmd = db.command
  const want = normalizeRole(role, '')
  let where
  if (want === 'all' || !want) {
    where = dbCmd.or([
      { role: 'parent' },
      { role: 'teacher' }
    ])
  } else {
    where = { role: want }
  }

  const res = await db.collection('uni-id-users')
    .where(where)
    .field({
      _id: true,
      role: true,
      nickname: true,
      username: true,
      wx_openid: true
    })
    .skip(offset)
    .limit(size)
    .get()

  const list = (res.data || [])
    .map((u) => ({
      uid: u._id,
      role: normalizeRole(u.role, ''),
      nickname: u.nickname || u.username || '',
      openid: extractWxOpenid(u)
    }))
    .filter((u) => isBizRole(u.role))

  return {
    list,
    next_skip: offset + (res.data || []).length,
    page_size: size,
    raw_count: (res.data || []).length
  }
}

async function countUsersByRole(db, role) {
  const want = normalizeRole(role, '')
  if (want === 'all' || !want) {
    const parentRes = await db.collection('uni-id-users').where({ role: 'parent' }).count()
    const teacherRes = await db.collection('uni-id-users').where({ role: 'teacher' }).count()
    return (parentRes.total || 0) + (teacherRes.total || 0)
  }
  const res = await db.collection('uni-id-users').where({ role: want }).count()
  return res.total || 0
}

async function loadUsersByIds(db, userIds) {
  const ids = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return []
  const dbCmd = db.command
  const res = await db.collection('uni-id-users')
    .where({ _id: dbCmd.in(ids.slice(0, USER_IDS_MAX)) })
    .field({
      _id: true,
      role: true,
      nickname: true,
      username: true,
      wx_openid: true
    })
    .limit(USER_IDS_MAX)
    .get()
  return (res.data || []).map((u) => ({
    uid: u._id,
    role: normalizeRole(u.role, ''),
    nickname: u.nickname || u.username || '',
    openid: extractWxOpenid(u)
  }))
}

/**
 * 向一批用户发券（后台批量 / 活动补发）
 */
async function issueToUserList(db, {
  users,
  coupon,
  activity,
  source = 'manual',
  remark = '',
  skipExistingUnused = true,
  sendMessage = true,
  remainingStock = -1
} = {}) {
  let issued = 0
  let skipped = 0
  let failed = 0
  let stockLeft = remainingStock
  const details = []

  for (const user of users || []) {
    if (stockLeft === 0) {
      skipped += 1
      details.push({ uid: user.uid, ok: false, reason: '活动库存已用完' })
      continue
    }
    const check = await checkCanIssue(db, {
      uid: user.uid,
      role: user.role,
      coupon,
      activity,
      openid: user.openid || '',
      skipExistingUnused
    })
    if (!check.ok) {
      skipped += 1
      details.push({ uid: user.uid, ok: false, reason: check.reason })
      continue
    }
    try {
      await issueOne(db, {
        uid: user.uid,
        role: user.role,
        coupon,
        activity,
        source,
        remark,
        openid: user.openid || '',
        sendMessage
      })
      issued += 1
      if (stockLeft > 0) stockLeft -= 1
      details.push({ uid: user.uid, ok: true })
    } catch (e) {
      failed += 1
      details.push({ uid: user.uid, ok: false, reason: e.message || '发券失败' })
      console.error('[coupon-issue] issueToUserList failed:', user.uid, e)
    }
  }

  return { issued, skipped, failed, remainingStock: stockLeft, details }
}

module.exports = {
  TYPE_LABEL,
  PAGE_SIZE_MAX,
  USER_IDS_MAX,
  toTs,
  normalizeRole,
  isBizRole,
  typeLabel,
  loadActiveActivities,
  getCouponMap,
  tryIssueActivities,
  listUsersByRole,
  countUsersByRole,
  loadUsersByIds,
  issueToUserList,
  countActivityIssued,
  countUserActivityTaken,
  checkCanIssue,
  extractWxOpenid,
  loadUserOpenid,
  recordOpenidClaim,
  stampOpenidOnAccountDelete,
  sendCouponMessage
}
