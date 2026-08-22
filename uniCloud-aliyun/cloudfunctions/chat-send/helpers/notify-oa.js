/**
 * 聊天消息写入成功后，向接收方发送服务号「来访预约消息通知」
 * 失败不影响发消息主流程
 */

const { sendNewChat, formatNow } = require('wx-oa-client')

function previewReason(content, messageType) {
  const type = String(messageType || 'text')
  if (type === 'image') return '发来一张图片'
  if (type === 'voice' || type === 'audio') return '发来一条语音'
  let text = String(content || '').trim()
  if (!text) return '您有一条新消息'
  if (text.charAt(0) === '{') {
    try {
      const obj = JSON.parse(text)
      text = obj.text || obj.title || obj.tip || obj.content || '您有一条新消息'
    } catch (e) {
      // keep raw
    }
  }
  text = String(text).replace(/\s+/g, ' ').trim()
  return text.slice(0, 20) || '您有一条新消息'
}

async function loadVisitorName(db, senderId, senderRole) {
  if (!senderId) return senderRole === 'teacher' ? '老师' : '家长'
  try {
    const doc = await db.collection('uni-id-users')
      .doc(senderId)
      .field({ nickname: true, username: true })
      .get()
    const user = doc.data && doc.data[0]
    if (user && (user.nickname || user.username)) {
      return String(user.nickname || user.username).slice(0, 20)
    }
  } catch (e) {}
  return senderRole === 'teacher' ? '老师' : '家长'
}

/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {string} opts.receiverId
 * @param {string} opts.receiverRole parent|teacher
 * @param {string} opts.senderId
 * @param {string} opts.senderRole
 * @param {string} opts.conversationId
 * @param {string} opts.messageId
 * @param {string} opts.content
 * @param {string} [opts.messageType]
 * @param {number} [opts.sendTime]
 */
async function notifyChatNewMessageOa({
  db,
  receiverId,
  receiverRole,
  senderId,
  senderRole,
  conversationId,
  messageId,
  content,
  messageType,
  sendTime
} = {}) {
  if (!receiverId || !conversationId) return { skipped: true, reason: 'missing_args' }

  const visitorName = await loadVisitorName(db, senderId, senderRole)
  const reason = previewReason(content, messageType)
  const timeText = formatNow(sendTime || Date.now())
  const pagepath = receiverRole === 'teacher'
    ? `pages-teacher/chat/conversation?conversationId=${encodeURIComponent(conversationId)}`
    : `pages/chat/conversation?conversationId=${encodeURIComponent(conversationId)}`

  const oaRes = await sendNewChat({
    user_id: receiverId,
    message_id: messageId,
    visitor_name: visitorName,
    reason,
    visit_time: timeText,
    send_time: timeText,
    pagepath,
    client_msg_id: 'new_chat_' + (messageId || conversationId)
  })

  if (oaRes && !oaRes.ok && !oaRes.skipped) {
    console.warn('[chat-send.notifyOa] 失败', oaRes.errcode, oaRes.errmsg)
  } else {
    console.log('[chat-send.notifyOa] 结果', JSON.stringify(oaRes))
  }
  return oaRes
}

module.exports = {
  notifyChatNewMessageOa
}
