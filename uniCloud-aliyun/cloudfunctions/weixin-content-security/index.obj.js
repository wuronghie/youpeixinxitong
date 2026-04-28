/**
 * 微信内容安全云对象（供小程序端调用）
 * 图片：走 img_sec_check；需在服务端使用与小程序一致的 AppID/Secret 换 token
 */

const uniID = require('uni-id-common')
const wxSec = require('./wx-mp-sec')

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

async function resolveUid(ctx) {
  const token = ctx.getUniIdToken && ctx.getUniIdToken()
  if (!token) return null
  try {
    const payload = await ctx.uniID.checkToken(token)
    if (payload && !payload.code && payload.uid) {
      return payload.uid
    }
  } catch (e) {
    // 忽略，走简单 token
  }
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split('_')
    return parts.length >= 1 && parts[0] ? parts[0] : null
  } catch (e) {
    return null
  }
}

module.exports = {
  _before: function () {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({ clientInfo })
  },

  /**
   * 校验用户上传的图片（Base64，不含 data: 头）
   * 通过微信 img_sec_check；图片须 ≤ 1MB
   */
  async checkImageBase64(params = {}) {
    const { image_base64: imageBase64 } = params
    const reqId = `img-${Date.now()}`
    console.log('[weixin-content-security] checkImageBase64 开始', { reqId, base64Len: imageBase64 ? imageBase64.length : 0 })
    const uid = await resolveUid(this)
    if (!uid) {
      console.warn('[weixin-content-security] 未登录', { reqId })
      return error('请先登录')
    }
    console.log('[weixin-content-security] uid 已解析', { reqId, uidTail: String(uid).slice(-8) })
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return error('缺少图片数据')
    }
    const raw = imageBase64.replace(/^data:\w+\/\w+;base64,/, '')
    let buffer
    try {
      buffer = Buffer.from(raw, 'base64')
    } catch (e) {
      console.error('[weixin-content-security] Base64 解码失败', { reqId, err: e.message })
      return error('图片数据格式错误')
    }
    if (!buffer.length || buffer.length > 1024 * 1024) {
      console.warn('[weixin-content-security] 图片大小无效', { reqId, bufferLength: buffer.length })
      return error('图片需小于1MB，请压缩后重试')
    }
    try {
      const contentType = wxSec.detectContentType(buffer)
      const clientInfo = this.getClientInfo && this.getClientInfo()
      console.log('[weixin-content-security] 调用微信 img_sec_check', { reqId, contentType, bufferLength: buffer.length, appId: clientInfo && clientInfo.appId })
      const result = await wxSec.imgSecCheck(buffer, contentType, clientInfo)
      if (!result.ok) {
        console.warn('[weixin-content-security] 图片未通过安全检测', { reqId })
        return error(wxSec.USER_FACING_HINT, -2)
      }
      console.log('[weixin-content-security] 图片检测通过', { reqId })
      return success({ safe: true })
    } catch (e) {
      console.error('[weixin-content-security] checkImageBase64 异常', {
        reqId,
        name: e.name,
        message: e.message,
        stack: e.stack && String(e.stack).split('\n').slice(0, 5).join(' | ')
      })
      return error(e.message || '内容安全检测失败，请稍后重试')
    }
  }
}
