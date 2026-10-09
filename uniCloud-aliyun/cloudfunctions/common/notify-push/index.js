/**
 * uni-push 业务通知（聊天 / 系统消息 / 预约）
 * 失败不影响主流程；需调用方云对象声明 extensions.uni-cloud-push
 */

const UNI_APP_ID = '__UNI__863DB44'

const PUSH_TYPE = {
  CHAT_NEW: 'chat_new',
  SYSTEM_MESSAGE: 'system_message',
  APPOINTMENT_UPDATE: 'appointment_update'
}

async function loadReceiverCids(userId) {
  if (!userId) return []
  const db = uniCloud.database()
  const dbCmd = db.command
  const res = await db.collection('uni-id-device')
    .where({
      user_id: userId,
      push_clientid: dbCmd.exists(true)
    })
    .field({ push_clientid: true })
    .limit(20)
    .get()
  const list = (res.data || [])
    .map(item => item.push_clientid)
    .filter(cid => typeof cid === 'string' && cid)
  return [...new Set(list)]
}

async function sendByUserId(uniPush, { userId, title, content, payload }) {
  return uniPush.sendMessage({
    user_id: userId,
    check_token: false,
    platform: ['mp-weixin'],
    title,
    content,
    payload
  })
}

async function sendByClientIds(uniPush, { cids, title, content, payload }) {
  if (!cids.length) return null
  return uniPush.sendMessage({
    push_clientid: cids.length === 1 ? cids[0] : cids,
    title,
    content,
    payload
  })
}

/**
 * 向单个用户推送（user_id + cid 双通道）
 */
async function notifyAppPush({
  userId,
  title = '优培信息通',
  content = '您有一条新通知',
  payload = {}
} = {}) {
  const debug = {
    triggered: true,
    appId: UNI_APP_ID,
    userId: userId || '',
    type: payload && payload.type,
    cids: [],
    byUser: null,
    byCid: null,
    error: ''
  }

  if (!userId) {
    debug.triggered = false
    debug.error = '缺少 userId'
    return debug
  }

  try {
    const uniPush = uniCloud.getPushManager({ appId: UNI_APP_ID })
    const preview = String(content || '您有一条新通知').substring(0, 50)
    const heading = String(title || '优培信息通').substring(0, 20)
    const body = payload && typeof payload === 'object'
      ? { ...payload, send_time: payload.send_time || Date.now() }
      : { send_time: Date.now() }

    try {
      debug.byUser = await sendByUserId(uniPush, {
        userId,
        title: heading,
        content: preview,
        payload: body
      })
    } catch (e) {
      debug.byUser = { error: e && (e.message || String(e)) }
      console.warn('[notify-push] by user_id 失败:', e && (e.message || e))
    }

    const cids = await loadReceiverCids(userId)
    debug.cids = cids
    if (!cids.length) {
      if (!debug.error) debug.error = '无 push_clientid'
      return debug
    }

    try {
      debug.byCid = await sendByClientIds(uniPush, {
        cids,
        title: heading,
        content: preview,
        payload: body
      })
    } catch (e) {
      debug.byCid = { error: e && (e.message || String(e)) }
      debug.error = e && (e.message || String(e))
      console.warn('[notify-push] by cid 失败:', e && (e.message || e))
    }
  } catch (e) {
    debug.error = e && (e.message || String(e))
    console.warn('[notify-push] 总失败:', debug.error)
  }

  return debug
}

async function notifyUsers(userIds, opts) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  const results = []
  for (const userId of ids) {
    results.push(await notifyAppPush({ ...opts, userId }))
  }
  return results
}

async function notifyChatNew({
  receiverId,
  conversationId,
  content,
  sendTime,
  title = '新消息'
} = {}) {
  if (!receiverId) return { triggered: false, error: '缺少 receiverId' }
  return notifyAppPush({
    userId: receiverId,
    title,
    content: content || '您有一条新消息',
    payload: {
      type: PUSH_TYPE.CHAT_NEW,
      conversation_id: conversationId || '',
      send_time: sendTime || Date.now()
    }
  })
}

async function notifySystemMessage({
  userId,
  title,
  content,
  messageType = 'system',
  relatedId = '',
  extra = {}
} = {}) {
  if (!userId) return { triggered: false, error: '缺少 userId' }
  return notifyAppPush({
    userId,
    title: title || '系统消息',
    content: content || '您有一条新的系统消息',
    payload: {
      type: PUSH_TYPE.SYSTEM_MESSAGE,
      message_type: messageType,
      related_id: relatedId || '',
      send_time: Date.now(),
      ...extra
    }
  })
}

async function notifyAppointmentUpdate({
  userId,
  userIds,
  appointmentId,
  status = '',
  title = '预约更新',
  content = '您的预约有新的状态，请打开查看',
  extra = {}
} = {}) {
  const ids = [...new Set([...(userIds || []), userId].filter(Boolean))]
  if (!ids.length) return [{ triggered: false, error: '缺少接收人' }]
  return notifyUsers(ids, {
    title,
    content,
    payload: {
      type: PUSH_TYPE.APPOINTMENT_UPDATE,
      appointment_id: appointmentId || '',
      status: status || '',
      send_time: Date.now(),
      ...extra
    }
  })
}

async function notifyAppointmentPeers(appointment, {
  status,
  title,
  content,
  extra,
  excludeUserId
} = {}) {
  if (!appointment) return []
  const ids = [appointment.parent_id, appointment.teacher_id]
    .filter(id => id && id !== excludeUserId)
  return notifyAppointmentUpdate({
    userIds: ids,
    appointmentId: appointment._id,
    status: status || appointment.status || '',
    title,
    content,
    extra
  })
}

module.exports = {
  PUSH_TYPE,
  UNI_APP_ID,
  notifyAppPush,
  notifyChatNew,
  notifySystemMessage,
  notifyAppointmentUpdate,
  notifyAppointmentPeers
}
