/**
 * 教师打卡成功后，向聊天会话写入提醒（家长可读，后台可查）
 */

const UNI_APP_ID = '__UNI__863DB44'

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

async function notifyParentPush(receiverId, conversationId, preview) {
  try {
    const uniPush = uniCloud.getPushManager({ appId: UNI_APP_ID })
    await uniPush.sendMessage({
      user_id: receiverId,
      check_token: false,
      platform: ['mp-weixin'],
      title: '打卡提醒',
      content: String(preview || '老师已打卡').substring(0, 50),
      payload: {
        type: 'chat_new',
        conversation_id: conversationId,
        send_time: Date.now()
      }
    })
  } catch (e) {
    console.warn('[appointment-attendance] push 失败:', e && (e.message || e))
  }
}

/**
 * @param {object} db
 * @param {object} opts
 * @param {object} opts.appointment
 * @param {'clock_in'|'clock_out'} opts.action
 * @param {number} opts.clockTime
 * @param {object} opts.location
 */
async function appendAttendanceChatNotice(db, {
  appointment,
  action,
  clockTime,
  location
} = {}) {
  if (!appointment || !appointment.teacher_id || !appointment.parent_id) return null

  const conversation = await findConversation(db, appointment)
  if (!conversation) {
    console.warn('[appointment-attendance] 未找到会话，跳过打卡聊天提醒', appointment._id)
    return null
  }

  const now = Date.now()
  const loc = location || {}
  const timeText = formatClockTime(clockTime || now)
  const address = typeof loc.address === 'string' ? loc.address.trim() : ''
  const isIn = action === 'clock_in'
  const title = isIn ? '老师已上课打卡' : '老师已下课打卡'
  const tip = isIn
    ? '课程进行中，请留意上课安排'
    : '下课打卡已完成，请家长确认课程结果'

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

  const content = JSON.stringify(payload)
  const preview = address ? `${title} · ${address}` : title

  await db.collection('chat-messages').add({
    conversation_id: conversation._id,
    sender_id: appointment.teacher_id,
    sender_role: 'teacher',
    receiver_id: appointment.parent_id,
    receiver_role: 'parent',
    message_type: 'text',
    content,
    is_read: false,
    send_time: now
  })

  const dbCmd = db.command
  await db.collection('chat-conversations').doc(conversation._id).update({
    appointment_id: appointment._id,
    last_message: preview,
    last_message_time: now,
    chat_enabled: true,
    unread_count_parent: dbCmd.inc(1),
    update_time: now
  })

  await notifyParentPush(appointment.parent_id, conversation._id, preview)
  console.log('[appointment-attendance] 已写入打卡聊天提醒', {
    appointment_id: appointment._id,
    conversation_id: conversation._id,
    action
  })
  return conversation._id
}

module.exports = {
  appendAttendanceChatNotice
}
