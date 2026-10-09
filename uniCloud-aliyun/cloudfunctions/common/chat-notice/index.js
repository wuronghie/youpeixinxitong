'use strict'
/**
 * 向家长/教师同一会话写入系统卡片（打卡、评价），并 push 刷新双方聊天页
 */

const { notifyChatNew } = require('notify-push')

function formatClockTime(ts) {
  const d = new Date(Number(ts) || Date.now())
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function findConversation(db, appointment) {
  if (!appointment) return null
  if (appointment.conversation_id) {
    try {
      const byId = await db.collection('chat-conversations').doc(appointment.conversation_id).get()
      if (byId.data && byId.data.length) return byId.data[0]
    } catch (e) {
      // ignore
    }
  }
  if (appointment._id) {
    const byApt = await db.collection('chat-conversations')
      .where({ appointment_id: appointment._id })
      .limit(1)
      .get()
    if (byApt.data && byApt.data.length) return byApt.data[0]
  }
  if (appointment.teacher_id && appointment.parent_id) {
    const byPair = await db.collection('chat-conversations')
      .where({
        teacher_id: appointment.teacher_id,
        parent_id: appointment.parent_id
      })
      .orderBy('update_time', 'desc')
      .limit(1)
      .get()
    if (byPair.data && byPair.data.length) return byPair.data[0]
  }
  return null
}

async function pushChatRefresh(userIds, conversationId, preview, title) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  for (const userId of ids) {
    try {
      await notifyChatNew({
        receiverId: userId,
        conversationId,
        content: preview,
        title: title || '会话更新'
      })
    } catch (e) {
      console.warn('[chat-notice] push 失败', userId, e && (e.message || e))
    }
  }
}

/**
 * @param {'parent'|'teacher'|'both'|'none'} unreadFor
 */
async function appendChatCard(db, {
  appointment,
  senderId,
  senderRole,
  receiverId,
  receiverRole,
  payload,
  preview,
  unreadFor = 'none',
  pushUserIds = []
} = {}) {
  if (!appointment || !senderId || !receiverId || !payload) return null
  const conversation = await findConversation(db, appointment)
  if (!conversation) {
    console.warn('[chat-notice] 未找到会话', appointment._id, payload && payload.type)
    return null
  }

  const now = Date.now()
  const content = JSON.stringify(payload)
  await db.collection('chat-messages').add({
    conversation_id: conversation._id,
    sender_id: senderId,
    sender_role: senderRole,
    receiver_id: receiverId,
    receiver_role: receiverRole,
    message_type: 'text',
    content,
    is_read: false,
    send_time: now
  })

  const dbCmd = db.command
  const updateData = {
    appointment_id: appointment._id,
    last_message: preview || payload.title || '会话更新',
    last_message_time: now,
    chat_enabled: true,
    update_time: now
  }
  if (unreadFor === 'parent' || unreadFor === 'both') {
    updateData.unread_count_parent = dbCmd.inc(1)
  }
  if (unreadFor === 'teacher' || unreadFor === 'both') {
    updateData.unread_count_teacher = dbCmd.inc(1)
  }
  await db.collection('chat-conversations').doc(conversation._id).update(updateData)
  await pushChatRefresh(pushUserIds, conversation._id, updateData.last_message, payload.title)
  return conversation._id
}

async function appendAttendanceChatNotice(db, {
  appointment,
  action,
  clockTime,
  location
} = {}) {
  if (!appointment || !appointment.teacher_id || !appointment.parent_id) return null

  const loc = location || {}
  const now = Date.now()
  const timeText = formatClockTime(clockTime || now)
  const address = typeof loc.address === 'string' ? loc.address.trim() : ''
  const isIn = action === 'clock_in'
  const title = isIn ? '上课打卡' : '下课打卡'
  const tip = isIn
    ? '上课打卡已记录，家长与老师均可在会话中查看'
    : '下课打卡已记录，请家长确认结果并评价'

  const payload = {
    type: 'attendance_clock',
    action: isIn ? 'clock_in' : 'clock_out',
    appointment_id: appointment._id,
    clock_time: clockTime || now,
    address,
    latitude: Number(loc.latitude) || 0,
    longitude: Number(loc.longitude) || 0,
    title,
    tip,
    text: address
      ? `${title}\n时间：${timeText}\n地点：${address}`
      : `${title}\n时间：${timeText}`
  }

  return appendChatCard(db, {
    appointment,
    senderId: appointment.teacher_id,
    senderRole: 'teacher',
    receiverId: appointment.parent_id,
    receiverRole: 'parent',
    payload,
    preview: address ? `${title} · ${address}` : title,
    unreadFor: 'parent',
    pushUserIds: [appointment.parent_id, appointment.teacher_id]
  })
}

async function appendReviewChatNotice(db, {
  appointment,
  review = {}
} = {}) {
  if (!appointment || !appointment.teacher_id || !appointment.parent_id) return null

  const rating = Math.min(5, Math.max(1, Number(review.rating) || 5))
  const isAuto = review.is_auto === true
  const isTrial = appointment.course_type === 'trial'
  const satisfied = review.is_satisfied
  const contentText = String(review.content || '').trim()
  const tags = Array.isArray(review.tags) ? review.tags.filter(Boolean).slice(0, 8) : []

  let resultText = ''
  if (isTrial && typeof satisfied === 'boolean') {
    resultText = satisfied ? '试课成功' : '试课不满意'
  }

  const title = isAuto ? '系统默认好评' : '课程评价'
  const starText = `${rating}星`
  const tipParts = [starText]
  if (resultText) tipParts.push(resultText)
  if (isAuto) tipParts.push('超时未评价')
  const tip = tipParts.join(' · ')

  const payload = {
    type: 'review_result',
    appointment_id: appointment._id,
    review_id: review.review_id || '',
    rating,
    tags,
    content: contentText,
    is_satisfied: typeof satisfied === 'boolean' ? satisfied : null,
    is_auto: isAuto,
    title,
    tip,
    text: contentText
      ? `${title}\n${starText}${resultText ? ` · ${resultText}` : ''}\n${contentText}`
      : `${title}\n${starText}${resultText ? ` · ${resultText}` : ''}`
  }

  return appendChatCard(db, {
    appointment,
    senderId: appointment.parent_id,
    senderRole: 'parent',
    receiverId: appointment.teacher_id,
    receiverRole: 'teacher',
    payload,
    preview: `${title} · ${starText}`,
    unreadFor: isAuto ? 'both' : 'teacher',
    pushUserIds: [appointment.parent_id, appointment.teacher_id]
  })
}

module.exports = {
  findConversation,
  appendChatCard,
  appendAttendanceChatNotice,
  appendReviewChatNotice
}
