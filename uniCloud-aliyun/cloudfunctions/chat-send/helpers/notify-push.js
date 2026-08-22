/**
 * 聊天消息写入成功后，向接收方推送在线透传（uni-push 2.0）
 * 失败不影响发消息主流程；返回调试信息供客户端日志查看
 */

const UNI_APP_ID = '__UNI__863DB44'

function buildPayload({ conversationId, sendTime }) {
  return {
    type: 'chat_new',
    conversation_id: conversationId,
    send_time: sendTime || Date.now()
  }
}

async function sendByUserId(uniPush, { receiverId, preview, payload }) {
  return uniPush.sendMessage({
    user_id: receiverId,
    check_token: false,
    platform: ['mp-weixin'],
    title: '新消息',
    content: preview,
    payload
  })
}

async function sendByClientIds(uniPush, { cids, preview, payload }) {
  if (!cids.length) return null
  return uniPush.sendMessage({
    push_clientid: cids.length === 1 ? cids[0] : cids,
    title: '新消息',
    content: preview,
    payload
  })
}

async function loadReceiverCids(receiverId) {
  const db = uniCloud.database()
  const dbCmd = db.command
  const res = await db.collection('uni-id-device')
    .where({
      user_id: receiverId,
      push_clientid: dbCmd.exists(true)
    })
    .field({ push_clientid: true, device_id: true, token_expired: true })
    .limit(20)
    .get()
  console.log('[chat-send.notifyPush] uni-id-device 查询 receiver=', receiverId, 'rows=', JSON.stringify(res.data || []))
  const list = (res.data || [])
    .map(item => item.push_clientid)
    .filter(cid => typeof cid === 'string' && cid)
  return [...new Set(list)]
}

/**
 * @returns {Promise<Object>} push 调试信息
 */
async function notifyChatNewMessage({
  receiverId,
  conversationId,
  content,
  sendTime
} = {}) {
  const debug = {
    triggered: true,
    appId: UNI_APP_ID,
    receiverId: receiverId || '',
    conversationId: conversationId || '',
    cids: [],
    byUser: null,
    byCid: null,
    error: ''
  }

  if (!receiverId || !conversationId) {
    debug.triggered = false
    debug.error = '缺少 receiverId 或 conversationId'
    console.warn('[chat-send.notifyPush] skip:', debug.error)
    return debug
  }

  try {
    console.log('[chat-send.notifyPush] ★ 开始推送', JSON.stringify({
      receiverId,
      conversationId,
      preview: String(content || '').substring(0, 30)
    }))

    const uniPush = uniCloud.getPushManager({ appId: UNI_APP_ID })
    const preview = String(content || '您有一条新消息').substring(0, 50)
    const payload = buildPayload({ conversationId, sendTime })

    try {
      const byUser = await sendByUserId(uniPush, { receiverId, preview, payload })
      debug.byUser = byUser
      console.log('[chat-send.notifyPush] by user_id 结果:', JSON.stringify(byUser))
    } catch (e) {
      debug.byUser = { error: e && (e.message || String(e)) }
      console.warn('[chat-send.notifyPush] by user_id 失败:', e && (e.message || e))
    }

    const cids = await loadReceiverCids(receiverId)
    debug.cids = cids
    if (!cids.length) {
      debug.error = '接收方 uni-id-device 无 push_clientid（对方需重新登录/打开小程序完成绑定）'
      console.warn('[chat-send.notifyPush]', debug.error)
      return debug
    }

    try {
      const byCid = await sendByClientIds(uniPush, { cids, preview, payload })
      debug.byCid = byCid
      console.log('[chat-send.notifyPush] by push_clientid 结果:', JSON.stringify(byCid))
    } catch (e) {
      debug.byCid = { error: e && (e.message || String(e)) }
      debug.error = e && (e.message || String(e))
      console.warn('[chat-send.notifyPush] by push_clientid 失败:', e && (e.message || e))
    }
  } catch (e) {
    debug.error = e && (e.message || String(e))
    console.warn('[chat-send.notifyPush] 总失败:', debug.error)
  }

  return debug
}

module.exports = {
  notifyChatNewMessage
}
