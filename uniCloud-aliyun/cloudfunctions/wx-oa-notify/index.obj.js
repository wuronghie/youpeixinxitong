'use strict'
/**
 * 微信服务号通知
 * - testSendToMe：测发（scene: check_in | new_chat | appointment_success）
 * - sendCheckIn / sendNewChat / sendAppointmentSuccess
 */

const uniID = require('uni-id-common')
const {
  getOaConfig,
  getUserOaOpenid,
  syncUserOaBind,
  sendCheckIn: sendCheckInMsg,
  sendNewChat: sendNewChatMsg,
  sendAppointmentSuccess: sendAppointmentSuccessMsg,
  EIP_IPS
} = require('wx-oa-client')

function success(data = null, message = 'success') {
  return { code: 0, message, data }
}

function error(message = 'error', code = -1, data = null) {
  return { code, message, data }
}

function decodeSimpleToken(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split('_')
    return parts.length >= 1 && parts[0] ? parts[0] : null
  } catch (e) {
    return null
  }
}

async function resolveUid(ctx) {
  const token = ctx.getUniIdToken && ctx.getUniIdToken()
  if (!token) return null
  try {
    const payload = await ctx.uniID.checkToken(token)
    if (payload && !payload.code && payload.uid) return payload.uid
  } catch (e) {
    // fall through：兼容 user-login 的简单 base64 token
  }
  return decodeSimpleToken(token)
}

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({ clientInfo })
  },

  async getSetupHint() {
    const conf = getOaConfig()
    const templates = conf.templates || {}
    return success({
      notifyType: conf.notifyType,
      hasAppId: !!conf.appid,
      hasSecret: !!conf.appsecret,
      mpAppId: conf.mpAppId || '',
      username: conf.username || '',
      oaName: conf.oaName || '服务号',
      templates: {
        check_in: !!templates.check_in,
        new_chat: !!templates.new_chat,
        appointment_success: !!templates.appointment_success
      },
      eipWhitelist: EIP_IPS,
      tip: '已启用 check_in / new_chat / appointment_success'
    })
  },

  /**
   * 补绑当前用户服务号 openid（关注后调用；App 启动也会调）
   */
  async syncMyOaBind() {
    try {
      const uid = await resolveUid(this)
      if (!uid) return error('未登录')
      const res = await syncUserOaBind(uid)
      if (res.ok) {
        return success(
          { bound: true, oa_openid_tail: String(res.oa_openid || '').slice(-6) },
          '已绑定服务号'
        )
      }
      const tips = {
        no_unionid: '账号缺少 unionid，请退出后重新登录小程序，再确认已关注服务号',
        not_followed_or_pending: '未检测到服务号绑定。请用同一微信关注服务号后，重新打开小程序或重新登录',
        no_user: '用户无效'
      }
      return error(tips[res.reason] || '未绑定服务号', -1, res)
    } catch (e) {
      console.error('[wx-oa-notify] syncMyOaBind', e)
      return error(e.message || '补绑失败')
    }
  },

  /**
   * 测发。params.scene = check_in | new_chat | appointment_success
   */
  async testSendToMe(params = {}) {
    try {
      const uid = await resolveUid(this)
      if (!uid) return error('未登录或登录已过期，请重新登录后再试')
      const oaOpenid = await getUserOaOpenid(uid)
      if (!oaOpenid) {
        return error('当前账号未绑定服务号（请先关注服务号，确认 uni-id-users.wx_openid.h5 有值）')
      }

      const conf = getOaConfig()
      const scene = String(params.scene || 'check_in').trim()
      let result

      if (scene === 'new_chat') {
        if (!conf.templates.new_chat) return error('未配置 templates.new_chat')
        result = await sendNewChatMsg({
          user_id: uid,
          message_id: 'test_' + Date.now(),
          visitor_name: params.visitor_name || '测试访客',
          reason: params.reason || '测试聊天消息',
          pagepath: params.pagepath || 'pages/chat/list',
          client_msg_id: 'test_new_chat_' + uid + '_' + Date.now()
        })
      } else if (scene === 'appointment_success') {
        if (!conf.templates.appointment_success) return error('未配置 templates.appointment_success')
        result = await sendAppointmentSuccessMsg({
          user_id: uid,
          appointment_id: 'TEST' + Date.now(),
          order_no: params.order_no || ('APT' + Date.now()),
          date: params.date || '',
          type: params.type || '试课',
          project: params.project || '数学',
          pagepath: params.pagepath || 'pages/appointment/list',
          client_msg_id: 'test_appt_' + uid + '_' + Date.now()
        })
      } else {
        if (!conf.templates.check_in) return error('未配置 templates.check_in')
        result = await sendCheckInMsg({
          user_id: uid,
          appointment_id: params.appointment_id || ('TEST' + Date.now()),
          course: params.course || '测试课程',
          place: params.place || '测试地点',
          person: params.person || '测试老师',
          time: params.time || '',
          pagepath: params.pagepath || 'pages/appointment/list',
          client_msg_id: 'test_check_in_' + uid + '_' + Date.now(),
          data: params.data
        })
      }

      if (result.skipped) {
        return error('未发送: ' + result.reason, -1, result)
      }
      if (!result.ok) {
        return error(result.errmsg || '发送失败', Number(result.errcode) || -1, result)
      }
      return success(result, '已发送，请查看服务号消息')
    } catch (e) {
      console.error('[wx-oa-notify] testSendToMe', e)
      return error(e.message || '发送失败')
    }
  },

  async sendCheckIn(params = {}) {
    try {
      const result = await sendCheckInMsg(params)
      return result.ok || result.skipped
        ? success(result, result.ok ? 'ok' : 'skipped')
        : error(result.errmsg || '发送失败', result.errcode || -1, result)
    } catch (e) {
      console.error('[wx-oa-notify] sendCheckIn', e)
      return error(e.message || '发送失败')
    }
  },

  async sendNewChat(params = {}) {
    try {
      const result = await sendNewChatMsg(params)
      return result.ok || result.skipped
        ? success(result, result.ok ? 'ok' : 'skipped')
        : error(result.errmsg || '发送失败', result.errcode || -1, result)
    } catch (e) {
      console.error('[wx-oa-notify] sendNewChat', e)
      return error(e.message || '发送失败')
    }
  },

  async sendAppointmentSuccess(params = {}) {
    try {
      const result = await sendAppointmentSuccessMsg(params)
      return result.ok || result.skipped
        ? success(result, result.ok ? 'ok' : 'skipped')
        : error(result.errmsg || '发送失败', result.errcode || -1, result)
    } catch (e) {
      console.error('[wx-oa-notify] sendAppointmentSuccess', e)
      return error(e.message || '发送失败')
    }
  }
}
