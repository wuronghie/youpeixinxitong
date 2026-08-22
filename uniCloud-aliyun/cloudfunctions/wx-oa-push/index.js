'use strict'
/**
 * 微信服务号消息与事件推送
 * - GET：接入校验（返回 echostr）
 * - POST：关注/取关等事件；关注后写入 uni-id-users.wx_openid.h5
 *
 * 后台配置（明文模式先联调）：
 * URL = 云函数 URL 化地址（.../wx-oa-push）
 * Token = wx-oa/config.json 的 token
 * EncodingAESKey = 可先空；选明文模式
 */

const crypto = require('crypto')
const createConfig = require('uni-config-center')

const db = uniCloud.database()

function getOaConfig() {
  const conf = createConfig({ pluginId: 'wx-oa' }).config() || {}
  return {
    appid: String(conf.appid || '').trim(),
    appsecret: String(conf.appsecret || '').trim(),
    token: String(conf.token || '').trim(),
    encodingAESKey: String(conf.encodingAESKey || '').trim(),
    mpAppId: String(conf.mpAppId || '').trim()
  }
}

function httpText(body, statusCode = 200) {
  return {
    mpserverlessComposedResponse: true,
    statusCode,
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    },
    body: body == null ? '' : String(body)
  }
}

function checkSignature(token, timestamp, nonce, signature) {
  if (!token || !timestamp || !nonce || !signature) return false
  const arr = [String(token), String(timestamp), String(nonce)].sort()
  const hash = crypto.createHash('sha1').update(arr.join('')).digest('hex')
  return hash === String(signature)
}

function pickQuery(event = {}) {
  const qs = event.queryStringParameters || event.query || {}
  return {
    signature: qs.signature || event.signature,
    timestamp: qs.timestamp || event.timestamp,
    nonce: qs.nonce || event.nonce,
    echostr: qs.echostr || event.echostr,
    encrypt_type: qs.encrypt_type || event.encrypt_type,
    msg_signature: qs.msg_signature || event.msg_signature
  }
}

function getHttpMethod(event = {}) {
  const m = event.httpMethod || event.method || event.requestContext?.http?.method
  if (m) return String(m).toUpperCase()
  // 有 echostr 基本是接入校验
  const q = pickQuery(event)
  if (q.echostr) return 'GET'
  return 'POST'
}

function getRawBody(event = {}) {
  let body = event.body
  if (body == null) return ''
  if (event.isBase64Encoded && typeof body === 'string') {
    try {
      return Buffer.from(body, 'base64').toString('utf8')
    } catch (e) {
      return body
    }
  }
  if (typeof body === 'object') {
    // 少数网关已解析
    return ''
  }
  return String(body)
}

function xmlGet(xml, tag) {
  if (!xml || !tag) return ''
  const re = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = String(xml).match(re)
  return m ? String(m[1] != null && m[1] !== '' ? m[1] : m[2] || '').trim() : ''
}

/**
 * 阿里云云函数出网 IP 不固定，服务号「IP白名单」会不断失效。
 * 必须走固定出口代理 httpProxyForEip，并把下列 IP 全部加入服务号白名单：
 * 47.92.132.2 / 47.92.152.34 / 47.92.87.58 / 47.92.207.183 / 8.142.185.204
 * 文档：https://doc.dcloud.net.cn/uniCloud/cf-functions.html#eip
 */
async function requestWeixinGet(url) {
  const eipRes = await uniCloud.httpProxyForEip.get(
    url,
    {},
    { Accept: 'application/json' }
  )
  let data = eipRes.body
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (e) {
      data = { errmsg: data }
    }
  }
  if (data == null) data = {}
  return data
}

async function getAccessToken(appid, appsecret) {
  if (!appid || !appsecret || appsecret.indexOf('请在此') === 0) {
    throw new Error('wx-oa appid/appsecret 未配置')
  }
  const cacheId = 'wx_oa_access_token'
  try {
    const cached = await db.collection('opendb-tempdata').doc(cacheId).get()
    const row = cached.data && cached.data[0]
    if (row && row.value && row.expired > Date.now()) {
      return row.value
    }
  } catch (e) {
    // ignore cache miss
  }

  const url =
    'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' +
    encodeURIComponent(appid) +
    '&secret=' +
    encodeURIComponent(appsecret)
  const data = await requestWeixinGet(url)
  if (!data.access_token) {
    throw new Error('获取服务号 access_token 失败: ' + (data.errmsg || JSON.stringify(data)))
  }

  try {
    await db.collection('opendb-tempdata').doc(cacheId).set({
      value: data.access_token,
      expired: Date.now() + Math.max(60, (Number(data.expires_in) || 7200) - 300) * 1000
    })
  } catch (e) {
    // cache 失败不影响主流程
  }
  return data.access_token
}

async function fetchOaUserInfo(accessToken, openid) {
  const url =
    'https://api.weixin.qq.com/cgi-bin/user/info?access_token=' +
    encodeURIComponent(accessToken) +
    '&openid=' +
    encodeURIComponent(openid) +
    '&lang=zh_CN'
  return requestWeixinGet(url)
}

async function clearAccessTokenCache() {
  try {
    await db.collection('opendb-tempdata').doc('wx_oa_access_token').remove()
  } catch (e) {}
}

async function fetchOaUserInfoWithRetry(conf, oaOpenid) {
  let token = await getAccessToken(conf.appid, conf.appsecret)
  let info = await fetchOaUserInfo(token, oaOpenid)
  // access_token 失效时清缓存重试一次
  if (info && (Number(info.errcode) === 40001 || Number(info.errcode) === 42001)) {
    console.warn('[wx-oa-push] access_token invalid, refresh and retry user/info')
    await clearAccessTokenCache()
    token = await getAccessToken(conf.appid, conf.appsecret)
    info = await fetchOaUserInfo(token, oaOpenid)
  }
  return info
}

async function bindSubscribe(oaOpenid) {
  const conf = getOaConfig()
  let unionid = ''
  let subscribe = 0
  try {
    const info = await fetchOaUserInfoWithRetry(conf, oaOpenid)
    if (info.errcode) {
      console.warn('[wx-oa-push] user/info fail', info.errcode, info.errmsg)
    } else {
      unionid = info.unionid || info.unionId || ''
      subscribe = Number(info.subscribe) || 0
      console.log('[wx-oa-push] user/info ok', {
        hasUnionid: !!unionid,
        subscribe,
        nickname: info.nickname ? 'yes' : 'no',
        keys: Object.keys(info || {}),
        openidTail: String(info.openid || '').slice(-6)
      })
      if (!unionid) {
        console.warn(
          '[wx-oa-push] 关注用户无 unionid：请确认小程序与服务号已绑定同一开放平台，否则无法关联小程序账号发通知'
        )
      }
    }
  } catch (e) {
    console.warn('[wx-oa-push] fetch user info error', e.message || e)
  }

  if (unionid) {
    const users = await db
      .collection('uni-id-users')
      .where({ wx_unionid: unionid })
      .field({ _id: true, wx_openid: true })
      .limit(5)
      .get()
    const list = users.data || []
    for (const u of list) {
      const wx_openid = Object.assign({}, u.wx_openid || {}, { h5: oaOpenid })
      await db.collection('uni-id-users').doc(u._id).update({ wx_openid })
    }
    console.log('[wx-oa-push] subscribe bound', {
      oaOpenidTail: String(oaOpenid).slice(-6),
      unionidTail: String(unionid).slice(-6),
      userCount: list.length
    })
    if (list.length) {
      // 已写入用户 h5，清掉 pending
      try {
        await db.collection('wx-oa-pending-bind').doc(oaOpenid).remove()
      } catch (e) {}
    } else {
      // 有 unionid 但库中尚无用户：记 pending，登录/发信前可补绑
      try {
        await db.collection('wx-oa-pending-bind').doc(oaOpenid).set({
          oa_openid: oaOpenid,
          unionid,
          create_time: Date.now()
        })
      } catch (e) {
        console.warn('[wx-oa-push] pending bind write fail', e.message || e)
      }
    }
    return { unionid, bound: list.length }
  }

  // 无 unionid：仍记 pending（仅 openid），需用户稍后用带 unionid 的登录 + 再次关注或人工排查开放平台
  try {
    await db.collection('wx-oa-pending-bind').doc(oaOpenid).set({
      oa_openid: oaOpenid,
      unionid: '',
      create_time: Date.now()
    })
  } catch (e) {
    console.warn('[wx-oa-push] pending bind write fail', e.message || e)
  }
  console.log('[wx-oa-push] subscribe pending (no unionid from weixin)', {
    oaOpenidTail: String(oaOpenid).slice(-6)
  })
  return { unionid: '', bound: 0 }
}

async function unbindUnsubscribe(oaOpenid) {
  const users = await db
    .collection('uni-id-users')
    .where({ 'wx_openid.h5': oaOpenid })
    .field({ _id: true, wx_openid: true })
    .limit(20)
    .get()
  const list = users.data || []
  for (const u of list) {
    const wx_openid = Object.assign({}, u.wx_openid || {})
    delete wx_openid.h5
    await db.collection('uni-id-users').doc(u._id).update({ wx_openid })
  }
  try {
    await db.collection('wx-oa-pending-bind').doc(oaOpenid).remove()
  } catch (e) {
    // ignore
  }
  console.log('[wx-oa-push] unsubscribe cleared', { oaOpenid, userCount: list.length })
  return { cleared: list.length }
}

async function handleEventXml(xml) {
  const msgType = xmlGet(xml, 'MsgType')
  const event = xmlGet(xml, 'Event')
  const fromUser = xmlGet(xml, 'FromUserName')

  if (msgType === 'event' && fromUser) {
    const ev = String(event || '').toLowerCase()
    if (ev === 'subscribe') {
      await bindSubscribe(fromUser)
    } else if (ev === 'unsubscribe') {
      await unbindUnsubscribe(fromUser)
    }
  }
  // 其它消息暂不处理；返回 success 避免微信重试
  return 'success'
}

exports.main = async (event, context) => {
  const conf = getOaConfig()
  const method = getHttpMethod(event)
  const q = pickQuery(event)

  try {
    if (method === 'GET') {
      const ok = checkSignature(conf.token, q.timestamp, q.nonce, q.signature)
      if (!ok) {
        console.warn('[wx-oa-push] signature invalid on GET')
        return httpText('invalid signature', 403)
      }
      return httpText(q.echostr || '')
    }

    // POST
    if (!checkSignature(conf.token, q.timestamp, q.nonce, q.signature)) {
      console.warn('[wx-oa-push] signature invalid on POST')
      return httpText('invalid signature', 403)
    }

    if (q.encrypt_type === 'aes') {
      // 当前按明文模式接入；安全模式需再实现加解密
      console.warn('[wx-oa-push] encrypt_type=aes not implemented, use plaintext mode in MP admin')
      return httpText('success')
    }

    const xml = getRawBody(event)
    if (!xml) {
      return httpText('success')
    }
    const reply = await handleEventXml(xml)
    return httpText(reply)
  } catch (e) {
    console.error('[wx-oa-push] error', e)
    // 仍返回 success，避免微信疯狂重试；错误看云函数日志
    return httpText('success')
  }
}
