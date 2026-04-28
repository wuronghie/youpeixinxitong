/**
 * 微信小程序内容安全（服务端）
 * 注意：须放在本云对象目录内一并上传；勿用 ../common，阿里云打包不包含上级目录。
 * teacher-profile / user-profile 目录内各有一份同名文件，修改时请同步。
 */

const createConfig = require('uni-config-center')

const LOG_PREFIX = '[wx-mp-sec]'
const USER_FACING_HINT = '您所发布的内容含违规信息，请修改后重试'

let tokenCache = {
  access_token: '',
  expireAt: 0
}

function getWeixinMpCredentials(clientInfo) {
  const configCenter = createConfig({ pluginId: 'uni-id' })
  const uniIdConfig = configCenter.config()
  let weixinConfig = null
  if (Array.isArray(uniIdConfig)) {
    const appIdHint = clientInfo && clientInfo.appId
    const appConfig =
      uniIdConfig.find((c) => c.dcloudAppid === appIdHint || !c.dcloudAppid) || uniIdConfig[0]
    weixinConfig = appConfig?.['mp-weixin']?.oauth?.weixin || appConfig?.app?.oauth?.weixin
  } else {
    weixinConfig = uniIdConfig?.['mp-weixin']?.oauth?.weixin || uniIdConfig?.app?.oauth?.weixin
  }
  const appid = weixinConfig?.appid || process.env.WX_MP_APPID || ''
  const secret = weixinConfig?.appsecret || process.env.WX_MP_SECRET || ''
  return { appid, secret }
}

async function getStableAccessToken(clientInfo) {
  const { appid, secret } = getWeixinMpCredentials(clientInfo)
  console.log(`${LOG_PREFIX} getStableAccessToken`, {
    hasAppid: !!appid,
    hasSecret: !!secret,
    appidTail: appid ? String(appid).slice(-6) : ''
  })
  if (!appid || !secret) {
    throw new Error('微信小程序 AppID/Secret 未配置，无法调用内容安全接口')
  }
  const now = Date.now()
  if (tokenCache.access_token && now < tokenCache.expireAt - 120000) {
    console.log(`${LOG_PREFIX} access_token 使用缓存，expireAt`, tokenCache.expireAt)
    return tokenCache.access_token
  }
  console.log(`${LOG_PREFIX} 请求 stable_token ...`)
  const res = await uniCloud.httpclient.request('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    content: JSON.stringify({
      grant_type: 'client_credential',
      appid,
      secret
    }),
    headers: {
      'Content-Type': 'application/json'
    },
    dataType: 'json',
    timeout: 20000
  })
  const data = res.data
  if (!data || data.errcode) {
    console.error(`${LOG_PREFIX} stable_token 失败`, {
      errcode: data && data.errcode,
      errmsg: data && data.errmsg,
      status: res.status
    })
    throw new Error((data && data.errmsg) || '获取微信 access_token 失败')
  }
  tokenCache = {
    access_token: data.access_token,
    expireAt: now + (data.expires_in || 7200) * 1000
  }
  console.log(`${LOG_PREFIX} stable_token 成功，expires_in`, data.expires_in)
  return tokenCache.access_token
}

function buildMultipartImageBody(buffer, filename, contentType) {
  const boundary = '----WxMpSecBoundary' + Date.now()
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    'utf8'
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  return {
    boundary,
    body: Buffer.concat([head, buffer, tail])
  }
}

function detectContentType(buffer) {
  if (!buffer || buffer.length < 3) return 'image/jpeg'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  return 'image/jpeg'
}

function extFromContentType(ct) {
  if (ct.includes('png')) return 'png'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

/**
 * 同步校验图片（≤1MB）
 */
async function imgSecCheck(imageBuffer, contentType, clientInfo) {
  const ct = contentType || detectContentType(imageBuffer)
  console.log(`${LOG_PREFIX} imgSecCheck 开始`, {
    bufferLength: imageBuffer && imageBuffer.length,
    contentType: ct
  })
  const token = await getStableAccessToken(clientInfo)
  const filename = `upload.${extFromContentType(ct)}`
  const { boundary, body } = buildMultipartImageBody(imageBuffer, filename, ct)
  const res = await uniCloud.httpclient.request(
    `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      content: body,
      dataType: 'json',
      timeout: 35000
    }
  )
  const data = res.data
  console.log(`${LOG_PREFIX} img_sec_check 原始响应`, {
    status: res.status,
    errcode: data && data.errcode,
    errmsg: data && data.errmsg
  })
  if (!data) {
    throw new Error('图片安全接口无响应')
  }
  if (data.errcode === 0) {
    return { ok: true }
  }
  if (data.errcode === 87014) {
    return { ok: false }
  }
  if (data.errcode === 44941) {
    throw new Error('内容安全检测繁忙，请稍后重试')
  }
  throw new Error(data.errmsg || `图片安全检测失败(${data.errcode})`)
}

/**
 * 文本安全（msg_sec_check version 2）
 */
async function msgSecCheck(openid, content, scene = 1, clientInfo) {
  if (!openid) {
    throw new Error('缺少用户标识，无法完成内容安全校验')
  }
  const text = String(content || '').trim()
  if (!text) {
    return { ok: true }
  }
  console.log(`${LOG_PREFIX} msgSecCheck`, { scene, textLen: text.length, openidTail: String(openid).slice(-6) })
  const token = await getStableAccessToken(clientInfo)
  const res = await uniCloud.httpclient.request(
    `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      content: JSON.stringify({
        content: text.slice(0, 2500),
        version: 2,
        scene,
        openid
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      dataType: 'json',
      timeout: 20000
    }
  )
  const data = res.data
  console.log(`${LOG_PREFIX} msg_sec_check 原始响应`, {
    status: res.status,
    errcode: data && data.errcode,
    errmsg: data && data.errmsg,
    suggest: data && data.result && data.result.suggest
  })
  if (!data) {
    throw new Error('文本安全接口无响应')
  }
  if (data.errcode === 87014) {
    return { ok: false, suggest: 'risky' }
  }
  if (data.errcode === 0 && data.result) {
    const suggest = data.result.suggest
    if (suggest === 'pass') {
      return { ok: true }
    }
    return { ok: false, suggest }
  }
  if (data.errcode === 44941) {
    throw new Error('内容安全检测繁忙，请稍后重试')
  }
  throw new Error(data.errmsg || `文本安全检测失败(${data.errcode})`)
}

module.exports = {
  LOG_PREFIX,
  USER_FACING_HINT,
  getWeixinMpCredentials,
  getStableAccessToken,
  detectContentType,
  imgSecCheck,
  msgSecCheck
}
