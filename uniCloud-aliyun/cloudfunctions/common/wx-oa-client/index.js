'use strict'
/**
 * 微信服务号客户端
 * - 场景：check_in / new_chat / appointment_success
 * - 配置：uni-config-center / wx-oa
 * - 出网：httpProxyForEip（固定 IP，需加入服务号白名单）
 */

const createConfig = require('uni-config-center')

const EIP_IPS = [
  '47.92.132.2',
  '47.92.152.34',
  '47.92.87.58',
  '47.92.207.183',
  '8.142.185.204'
]

function getOaConfig() {
  const conf = createConfig({ pluginId: 'wx-oa' }).config() || {}
  const notifyType = String(conf.notifyType || 'subscribe').trim().toLowerCase()
  return {
    appid: String(conf.appid || '').trim(),
    appsecret: String(conf.appsecret || '').trim(),
    token: String(conf.token || '').trim(),
    mpAppId: String(conf.mpAppId || '').trim(),
    // 公众号原始 ID（gh_xxx），用于小程序内一键打开公众号主页
    username: String(conf.username || conf.oaUsername || '').trim(),
    oaName: String(conf.oaName || conf.nickname || '服务号').trim(),
    // subscribe=订阅通知(bizsend)；template=旧模板消息(已逐步下线)
    notifyType: notifyType === 'template' ? 'template' : 'subscribe',
    templates: conf.templates || {},
    templateDataKeys: conf.templateDataKeys || {}
  }
}

async function requestWeixin(method, url, body) {
  let eipRes
  if (String(method).toUpperCase() === 'GET') {
    eipRes = await uniCloud.httpProxyForEip.get(url, {}, { Accept: 'application/json' })
  } else {
    eipRes = await uniCloud.httpProxyForEip.post(
      url,
      typeof body === 'string' ? body : JSON.stringify(body || {}),
      { Accept: 'application/json', 'Content-Type': 'application/json' }
    )
  }
  let data = eipRes.body
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (e) {
      data = { errmsg: data }
    }
  }
  return data || {}
}

async function getAccessToken() {
  const conf = getOaConfig()
  if (!conf.appid || !conf.appsecret) {
    throw new Error('wx-oa appid/appsecret 未配置')
  }
  const db = uniCloud.database()
  const cacheId = 'wx_oa_access_token'
  try {
    const cached = await db.collection('opendb-tempdata').doc(cacheId).get()
    const row = cached.data && cached.data[0]
    if (row && row.value && row.expired > Date.now()) {
      return row.value
    }
  } catch (e) {}

  const url =
    'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' +
    encodeURIComponent(conf.appid) +
    '&secret=' +
    encodeURIComponent(conf.appsecret)
  const data = await requestWeixin('GET', url)
  if (!data.access_token) {
    throw new Error('获取服务号 access_token 失败: ' + (data.errmsg || JSON.stringify(data)))
  }
  try {
    await db.collection('opendb-tempdata').doc(cacheId).set({
      value: data.access_token,
      expired: Date.now() + Math.max(60, (Number(data.expires_in) || 7200) - 300) * 1000
    })
  } catch (e) {}
  return data.access_token
}

async function clearAccessTokenCache() {
  try {
    await uniCloud.database().collection('opendb-tempdata').doc('wx_oa_access_token').remove()
  } catch (e) {}
}

async function fetchOaUserInfo(oaOpenid) {
  if (!oaOpenid) return { subscribe: 0 }
  const urlBase = 'https://api.weixin.qq.com/cgi-bin/user/info?lang=zh_CN&openid=' + encodeURIComponent(oaOpenid)
  let token = await getAccessToken()
  let data = await requestWeixin('GET', urlBase + '&access_token=' + encodeURIComponent(token))
  if (data && (Number(data.errcode) === 40001 || Number(data.errcode) === 42001)) {
    await clearAccessTokenCache()
    token = await getAccessToken()
    data = await requestWeixin('GET', urlBase + '&access_token=' + encodeURIComponent(token))
  }
  return data || {}
}

/** true=仍关注 / false=已取关 / null=接口失败，勿清绑定 */
async function isOaSubscribed(oaOpenid) {
  try {
    const info = await fetchOaUserInfo(oaOpenid)
    if (info.errcode) {
      const code = Number(info.errcode)
      if (code === 40003 || code === 43004) return false
      console.warn('[wx-oa-client] user/info fail', info.errcode, info.errmsg)
      return null
    }
    if (!Object.prototype.hasOwnProperty.call(info, 'subscribe')) {
      console.warn('[wx-oa-client] user/info missing subscribe')
      return null
    }
    return Number(info.subscribe) === 1
  } catch (e) {
    console.warn('[wx-oa-client] isOaSubscribed error', e && (e.message || e))
    return null
  }
}

async function clearUserOaBind(userId, oaOpenid) {
  const db = uniCloud.database()
  if (userId) {
    try {
      const doc = await db.collection('uni-id-users').doc(userId).field({ wx_openid: true }).get()
      const user = doc.data && doc.data[0]
      if (user) {
        const wx_openid = Object.assign({}, user.wx_openid || {})
        delete wx_openid.h5
        delete wx_openid.oa
        delete wx_openid.official
        await db.collection('uni-id-users').doc(userId).update({ wx_openid })
      }
    } catch (e) {
      console.warn('[wx-oa-client] clear user oa bind fail', e && (e.message || e))
    }
  }
  if (oaOpenid) {
    try {
      await db.collection('wx-oa-pending-bind').doc(oaOpenid).remove()
    } catch (e) {}
  }
}

/**
 * 取用户服务号 openid；若尚未写入 h5，尝试用 unionid 从 wx-oa-pending-bind 补绑
 * （解决：已登录用户后关注服务号 / 关注后未重新登录 导致发不出通知）
 */
async function getUserOaOpenid(userId) {
  if (!userId) return ''
  const db = uniCloud.database()
  const doc = await db.collection('uni-id-users')
    .doc(userId)
    .field({ wx_openid: true, wx_unionid: true })
    .get()
  const user = doc.data && doc.data[0]
  if (!user) return ''

  const openidMap = user.wx_openid && typeof user.wx_openid === 'object' ? user.wx_openid : {}
  // 服务号 openid 约定写在 h5；兼容个别误写入的 oa / official
  const existing = openidMap.h5 || openidMap.oa || openidMap.official || ''
  if (existing) return existing

  const unionid = String(user.wx_unionid || '').trim()
  if (!unionid) {
    console.log('[wx-oa-client] getUserOaOpenid: no h5 and no unionid', userId)
    return ''
  }

  try {
    const pendingRes = await db.collection('wx-oa-pending-bind')
      .where({ unionid })
      .limit(5)
      .get()
    const pendingList = pendingRes.data || []
    for (const p of pendingList) {
      const oaOpenid = p.oa_openid || p._id
      if (!oaOpenid) continue
      const subscribed = await isOaSubscribed(oaOpenid)
      if (subscribed !== true) {
        if (subscribed === false) {
          try {
            await db.collection('wx-oa-pending-bind').doc(p._id).remove()
          } catch (e) {}
        }
        continue
      }
      const wx_openid = Object.assign({}, openidMap, { h5: oaOpenid })
      await db.collection('uni-id-users').doc(userId).update({ wx_openid })
      try {
        await db.collection('wx-oa-pending-bind').doc(p._id).remove()
      } catch (e) {}
      console.log('[wx-oa-client] healed oa bind from pending', {
        userId,
        oaOpenidTail: String(oaOpenid).slice(-6)
      })
      return oaOpenid
    }
  } catch (e) {
    console.warn('[wx-oa-client] heal oa bind fail', e && (e.message || e))
  }
  console.log('[wx-oa-client] getUserOaOpenid: not bound', userId, 'unionidTail=', unionid.slice(-6))
  return ''
}

/**
 * 主动补绑：供登录后 / 小程序启动时调用。会向微信核对是否仍关注，取关则清绑定。
 * @returns {{ ok: boolean, oa_openid: string, reason?: string }}
 */
async function syncUserOaBind(userId) {
  if (!userId) return { ok: false, oa_openid: '', reason: 'no_user' }
  const db = uniCloud.database()
  const doc = await db.collection('uni-id-users')
    .doc(userId)
    .field({ wx_openid: true, wx_unionid: true })
    .get()
  const user = doc.data && doc.data[0]
  if (!user) return { ok: false, oa_openid: '', reason: 'no_user' }

  const openidMap = user.wx_openid && typeof user.wx_openid === 'object' ? user.wx_openid : {}
  let oaOpenid = openidMap.h5 || openidMap.oa || openidMap.official || ''

  if (!oaOpenid && user.wx_unionid) {
    try {
      const pendingRes = await db.collection('wx-oa-pending-bind')
        .where({ unionid: String(user.wx_unionid).trim() })
        .limit(5)
        .get()
      const pending = (pendingRes.data || [])[0]
      if (pending) oaOpenid = pending.oa_openid || pending._id || ''
    } catch (e) {}
  }

  if (!oaOpenid) {
    if (!user.wx_unionid) return { ok: false, oa_openid: '', reason: 'no_unionid' }
    return { ok: false, oa_openid: '', reason: 'not_followed_or_pending' }
  }

  const subscribed = await isOaSubscribed(oaOpenid)
  if (subscribed === false) {
    await clearUserOaBind(userId, oaOpenid)
    console.log('[wx-oa-client] sync: unsubscribed, cleared bind', {
      userId,
      oaOpenidTail: String(oaOpenid).slice(-6)
    })
    return { ok: false, oa_openid: '', reason: 'unsubscribed' }
  }
  if (subscribed === true) {
    if (!openidMap.h5) {
      await db.collection('uni-id-users').doc(userId).update({
        wx_openid: Object.assign({}, openidMap, { h5: oaOpenid })
      })
    }
    return { ok: true, oa_openid: oaOpenid, reason: 'bound' }
  }

  if (openidMap.h5) return { ok: true, oa_openid: oaOpenid, reason: 'bound_cached' }
  if (!user.wx_unionid) return { ok: false, oa_openid: '', reason: 'no_unionid' }
  return { ok: false, oa_openid: '', reason: 'not_followed_or_pending' }
}

function clip(val, max) {
  const s = val == null ? '' : String(val)
  if (!max || s.length <= max) return s
  return s.slice(0, max)
}

const PLACEHOLDER_NAMES = new Set([
  '老师',
  '家长',
  '用户',
  '微信用户',
  '未命名教师',
  '未命名'
])

function pickPersonName(...candidates) {
  for (const item of candidates) {
    const name = String(item || '').trim()
    if (!name || PLACEHOLDER_NAMES.has(name)) continue
    return clip(name, 20)
  }
  return ''
}

/**
 * 解析公众号通知里的人名：教师用资料 display_name，家长用 parent_info.real_name
 * @param {object} db uniCloud.database()
 * @param {string} userId
 * @param {string} [role] teacher|parent
 */
async function resolveNotifyPersonName(db, userId, role) {
  const fallback = role === 'teacher' ? '老师' : '家长'
  if (!db || !userId) return fallback

  try {
    const userDoc = await db.collection('uni-id-users')
      .doc(userId)
      .field({ nickname: true, username: true, parent_info: true })
      .get()
    const user = (userDoc.data && userDoc.data[0]) || {}
    const parentInfo = user.parent_info || {}

    let teacherName = ''
    if (role !== 'parent') {
      try {
        const teacherRes = await db.collection('teacher-profiles')
          .where({ teacher_id: userId })
          .field({ display_name: true })
          .limit(1)
          .get()
        const teacher = teacherRes.data && teacherRes.data[0]
        if (teacher) teacherName = teacher.display_name
      } catch (e) {}
    }

    if (role === 'teacher') {
      return pickPersonName(teacherName, user.nickname, user.username) || fallback
    }
    return pickPersonName(
      parentInfo.real_name,
      user.nickname,
      user.username
    ) || fallback
  } catch (e) {
    return fallback
  }
}

function buildTemplateData(map, values) {
  const data = {}
  const m = map || {}
  Object.keys(m).forEach((wxKey) => {
    const srcKey = m[wxKey]
    let v = values[srcKey]
    if (v == null) v = ''
    v = String(v)
    // 类目模板常见长度/类型限制
    if (/^thing/i.test(wxKey)) v = clip(v, 20)
    if (/^character_string/i.test(wxKey)) v = clip(v, 32)
    if (/^phrase/i.test(wxKey)) v = clip(v, 5)
    // number.DATA 只能是数字；订单号含字母时提取数字，否则用时间戳兜底
    if (/^number/i.test(wxKey)) {
      const digits = v.replace(/\D/g, '')
      v = digits || String(Date.now()).slice(-12)
    }
    // 订阅通知 amount 需带币种符号，如 ¥12.00
    if (/^amount/i.test(wxKey)) {
      const n = Number(String(v).replace(/[^\d.-]/g, ''))
      const num = Number.isFinite(n) ? n.toFixed(2) : '0.00'
      v = /^[¥￥]|元$/.test(String(values[srcKey] || '')) ? String(values[srcKey]) : ('¥' + num)
    }
    if (/^phone_number/i.test(wxKey)) {
      let digits = v.replace(/\D/g, '')
      if (digits.length === 13 && digits.startsWith('86')) digits = digits.slice(2)
      v = digits.slice(0, 17)
      if (!v) return
    }
    data[wxKey] = { value: v }
  })
  return data
}

function buildSendPayload(opts, conf) {
  const payload = {
    touser: String(opts.touser || '').trim(),
    template_id: String(opts.template_id || '').trim(),
    data: opts.data || {}
  }
  if (opts.client_msg_id) {
    payload.client_msg_id = String(opts.client_msg_id)
  }
  if (conf.mpAppId && opts.pagepath) {
    payload.miniprogram = {
      appid: conf.mpAppId,
      pagepath: String(opts.pagepath)
    }
  }
  if (opts.page) {
    payload.page = String(opts.page)
  }
  return payload
}

/**
 * 发送服务号订阅通知（当前推荐）
 * POST /cgi-bin/message/subscribe/bizsend
 */
async function sendSubscribeMessage(opts = {}) {
  const conf = getOaConfig()
  const payload = buildSendPayload(opts, conf)
  if (!payload.touser) {
    return { ok: false, skipped: true, reason: 'no_oa_openid' }
  }
  if (!payload.template_id) {
    return { ok: false, skipped: true, reason: 'no_template_id' }
  }

  const token = await getAccessToken()
  const url =
    'https://api.weixin.qq.com/cgi-bin/message/subscribe/bizsend?access_token=' +
    encodeURIComponent(token)
  const res = await requestWeixin('POST', url, payload)
  if (res.errcode && Number(res.errcode) !== 0) {
    console.warn('[wx-oa-client] subscribe bizsend fail', res.errcode, res.errmsg, payload.template_id)
    return {
      ok: false,
      errcode: res.errcode,
      errmsg: res.errmsg,
      template_id: payload.template_id,
      appid: conf.appid,
      notifyType: 'subscribe'
    }
  }
  return { ok: true, msgid: res.msgid, notifyType: 'subscribe' }
}

/**
 * 发送旧版模板消息（已逐步下线，仅兼容）
 * POST /cgi-bin/message/template/send
 */
async function sendTemplateMessage(opts = {}) {
  const conf = getOaConfig()
  const payload = buildSendPayload(opts, conf)
  if (!payload.touser) {
    return { ok: false, skipped: true, reason: 'no_oa_openid' }
  }
  if (!payload.template_id) {
    return { ok: false, skipped: true, reason: 'no_template_id' }
  }

  const token = await getAccessToken()
  const url =
    'https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=' +
    encodeURIComponent(token)
  const res = await requestWeixin('POST', url, payload)
  if (res.errcode && Number(res.errcode) !== 0) {
    console.warn('[wx-oa-client] template send fail', res.errcode, res.errmsg, payload.template_id)
    return {
      ok: false,
      errcode: res.errcode,
      errmsg: res.errmsg,
      template_id: payload.template_id,
      appid: conf.appid,
      notifyType: 'template'
    }
  }
  return { ok: true, msgid: res.msgid, notifyType: 'template' }
}

async function sendNotifyMessage(opts = {}) {
  const conf = getOaConfig()
  if (conf.notifyType === 'template') {
    return sendTemplateMessage(opts)
  }
  return sendSubscribeMessage(opts)
}

/**
 * 按场景发送（读 config.templates / templateDataKeys）
 */
async function sendByScene(scene, { user_id, values = {}, pagepath, client_msg_id, page } = {}) {
  const conf = getOaConfig()
  const templateId = conf.templates[scene]
  if (!templateId) {
    return { ok: false, skipped: true, reason: 'template_not_configured', scene }
  }
  const oaOpenid = await getUserOaOpenid(user_id)
  if (!oaOpenid) {
    return { ok: false, skipped: true, reason: 'user_not_followed_oa', user_id }
  }
  const map = conf.templateDataKeys[scene] || {}
  const data = Object.keys(map).length
    ? buildTemplateData(map, values)
    : (values._rawData || {})

  return sendNotifyMessage({
    touser: oaOpenid,
    template_id: templateId,
    data,
    pagepath,
    page,
    client_msg_id
  })
}

/**
 * 签到成功通知（模板：签到课程/地点/签到人/课程时间）
 */
async function sendCheckIn(params = {}) {
  return sendByScene('check_in', {
    user_id: params.user_id,
    pagepath: params.pagepath || 'pages/appointment/detail',
    client_msg_id: params.client_msg_id || ('check_in_' + (params.appointment_id || '') + '_' + (params.user_id || '')),
    values: {
      course: params.course || '家教课程',
      place: params.place || '待确认',
      person: params.person || '老师',
      time: params.time || formatNow(),
      _rawData: params.data
    }
  })
}

/**
 * 聊天消息通知（来访预约消息通知）
 * thing2 访客姓名 / thing4 事由(≤20字) / time5 访问时间 / time16 发送时间
 */
async function sendNewChat(params = {}) {
  const timeText = params.send_time || params.visit_time || formatNow()
  return sendByScene('new_chat', {
    user_id: params.user_id,
    pagepath: params.pagepath || 'pages/chat/list',
    client_msg_id: params.client_msg_id || ('new_chat_' + (params.message_id || '') + '_' + (params.user_id || '')),
    values: {
      visitor_name: params.visitor_name || '用户',
      reason: params.reason || '您有一条新消息',
      visit_time: params.visit_time || timeText,
      send_time: timeText,
      _rawData: params.data
    }
  })
}

/**
 * 预约成功通知
 * character_string9 订单号 / time10 预约日期 / phrase17 预约类型 / thing18 预约项目
 */
async function sendAppointmentSuccess(params = {}) {
  return sendByScene('appointment_success', {
    user_id: params.user_id,
    pagepath: params.pagepath || 'pages/appointment/detail',
    client_msg_id: params.client_msg_id || ('appt_ok_' + (params.appointment_id || '') + '_' + (params.user_id || '')),
    values: {
      order_no: params.order_no || params.appointment_no || '',
      date: params.date || formatNow(),
      type: params.type || '预约',
      project: params.project || '家教课程',
      _rawData: params.data
    }
  })
}

/**
 * 上课前提醒（预约到场通知 44710）
 * thing9 访客姓名 / thing16 服务项目 / time11 签到时间
 * phone_number10 访客电话：发给家长填教师号，发给教师填家长号
 */
async function sendClassRemind(params = {}) {
  return sendByScene('class_remind', {
    user_id: params.user_id,
    pagepath: params.pagepath || 'pages/appointment/detail',
    client_msg_id: params.client_msg_id || ('class_soon_' + (params.appointment_id || '') + '_' + (params.user_id || '')),
    values: {
      visitor_name: params.visitor_name || '学员',
      service: params.service || '家教课程',
      time: params.time || formatNow(),
      phone: params.phone || '',
      _rawData: params.data
    }
  })
}

/**
 * 评价超时提醒（复用「来访预约消息通知」字段）
 * thing2 访客姓名 / thing4 事由(≤20字) / time5 访问时间 / time16 发送时间
 */
async function sendReviewRemind(params = {}) {
  const timeText = params.time || formatNow()
  return sendByScene('review_remind', {
    user_id: params.user_id,
    pagepath: params.pagepath || 'pages/review/create',
    client_msg_id: params.client_msg_id || ('review_soon_' + (params.appointment_id || '') + '_' + (params.user_id || '')),
    values: {
      visitor_name: params.visitor_name || '评价提醒',
      reason: params.reason || '3小时后将默认好评',
      visit_time: params.visit_time || timeText,
      send_time: timeText,
      _rawData: params.data
    }
  })
}

function formatNow(ts) {
  const d = ts != null ? new Date(ts) : new Date()
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  }
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

module.exports = {
  EIP_IPS,
  getOaConfig,
  getAccessToken,
  getUserOaOpenid,
  syncUserOaBind,
  isOaSubscribed,
  sendSubscribeMessage,
  sendTemplateMessage,
  sendNotifyMessage,
  sendByScene,
  sendCheckIn,
  sendNewChat,
  sendAppointmentSuccess,
  sendClassRemind,
  sendReviewRemind,
  formatNow,
  resolveNotifyPersonName
}
