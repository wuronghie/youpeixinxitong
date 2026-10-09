/**
 * 聊天消息写入成功后推送接收方（uni-push 2.0）
 * 失败不影响发消息主流程
 */

const { notifyChatNew } = require('notify-push')

async function notifyChatNewMessage({
  receiverId,
  conversationId,
  content,
  sendTime
} = {}) {
  return notifyChatNew({
    receiverId,
    conversationId,
    content,
    sendTime
  })
}

module.exports = {
  notifyChatNewMessage
}
