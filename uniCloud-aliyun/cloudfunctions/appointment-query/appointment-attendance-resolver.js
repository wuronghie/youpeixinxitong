/**
 * 预约打卡数据解析与旧数据自愈
 * - 兼容 timestamp / 字符串 / Date 等多种 class_*_at 存储格式
 * - 同一家长+老师多条预约时，从会话绑定或兄弟预约继承打卡记录
 * - 可选将打卡数据回写到当前预约（修复旧数据分裂问题）
 */

function normalizeTimestamp(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && value > 0) return value
  if (typeof value === 'string') {
    const asNum = Number(value)
    if (!Number.isNaN(asNum) && asNum > 0) return asNum
    const parsed = new Date(value).getTime()
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
    return null
  }
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof value === 'object') {
    if (value.$date) return normalizeTimestamp(value.$date)
    if (typeof value.getTime === 'function') {
      const t = value.getTime()
      return Number.isNaN(t) ? null : t
    }
  }
  return null
}

function applyNormalizedAttendance(target) {
  const started = normalizeTimestamp(target.class_started_at)
  const ended = normalizeTimestamp(target.class_ended_at)
  if (started) target.class_started_at = started
  else target.class_started_at = null
  if (ended) target.class_ended_at = ended
  else target.class_ended_at = null
  return target
}

async function enrichParentPaidFromOrders(db, appointment, options = {}) {
  const { persistHeal = false } = options
  const dbCmd = db.command
  appointment.confirm_appointment_id = appointment._id

  if (appointment.parent_paid === true || appointment.parent_paid === 'true') {
    appointment.parent_paid = true
    return appointment
  }

  if (appointment.parent_payment_time || appointment.payment_time || appointment.parent_payment_order_id) {
    appointment.parent_paid = true
    appointment.parent_paid_from_record = true
    return appointment
  }

  try {
    const orderDoc = await db.collection('payment-orders')
      .where({
        appointment_id: appointment._id,
        status: dbCmd.in(['paid', 'success'])
      })
      .limit(20)
      .get()

    const orders = (orderDoc.data || [])
      .filter((order) => {
        const type = order.order_type || order.fee_kind || ''
        return ['course_fee', 'trial', 'regular'].includes(type) || type === '' || !type
      })
      .sort((a, b) => {
        const ta = Number(a.payment_time || a.pay_time || a.update_time || 0)
        const tb = Number(b.payment_time || b.pay_time || b.update_time || 0)
        return tb - ta
      })

    if (orders.length > 0) {
      const order = orders[0]
      appointment.parent_paid = true
      appointment.parent_paid_from_order = true
      appointment.parent_payment_time = appointment.parent_payment_time || order.payment_time || order.pay_time || null
      appointment.parent_payment_order_id = appointment.parent_payment_order_id || order._id

      if (persistHeal) {
        try {
          await db.collection('appointments').doc(appointment._id).update({
            parent_paid: true,
            parent_payment_time: appointment.parent_payment_time || Date.now(),
            parent_payment_order_id: order._id,
            update_time: Date.now()
          })
        } catch (healErr) {
          console.warn('[appointment-attendance-resolver] heal parent_paid failed:', healErr)
        }
      }
    }
  } catch (e) {
    console.warn('[appointment-attendance-resolver] enrich self order failed:', e)
    try {
      const fallbackDoc = await db.collection('payment-orders')
        .where({ appointment_id: appointment._id })
        .limit(20)
        .get()
      const paidOrder = (fallbackDoc.data || []).find((order) => ['paid', 'success'].includes(order.status))
      if (paidOrder) {
        appointment.parent_paid = true
        appointment.parent_paid_from_order = true
        appointment.parent_payment_time = paidOrder.payment_time || paidOrder.pay_time || null
        appointment.parent_payment_order_id = paidOrder._id
      }
    } catch (fallbackErr) {
      console.warn('[appointment-attendance-resolver] enrich fallback order failed:', fallbackErr)
    }
  }

  return appointment
}

async function enrichConversationId(db, appointment) {
  if (appointment.conversation_id) return appointment
  if (!appointment.parent_id || !appointment.teacher_id) return appointment

  try {
    const convDoc = await db.collection('chat-conversations')
      .where({
        parent_id: appointment.parent_id,
        teacher_id: appointment.teacher_id
      })
      .orderBy('update_time', 'desc')
      .limit(1)
      .get()
    if (convDoc.data && convDoc.data[0] && convDoc.data[0]._id) {
      appointment.conversation_id = convDoc.data[0]._id
    }
  } catch (e) {
    console.warn('[appointment-attendance-resolver] enrich conversation_id failed:', e)
  }

  return appointment
}

function hasAttendanceRecord(appointment) {
  return !!(normalizeTimestamp(appointment && appointment.class_started_at) ||
    normalizeTimestamp(appointment && appointment.class_ended_at))
}

function mergeAttendanceFields(target, source) {
  if (!source) return target
  const started = normalizeTimestamp(source.class_started_at)
  const ended = normalizeTimestamp(source.class_ended_at)
  if (started) {
    target.class_started_at = started
    target.class_started_location = source.class_started_location || target.class_started_location || null
  }
  if (ended) {
    target.class_ended_at = ended
    target.class_ended_location = source.class_ended_location || target.class_ended_location || null
  }
  if (source._id && source._id !== target._id) {
    target.attendance_source_appointment_id = source._id
  }
  return target
}

async function findAttendanceSource(db, appointment) {
  const dbCmd = db.command
  const candidates = []

  if (appointment.conversation_id) {
    try {
      const convDoc = await db.collection('chat-conversations').doc(appointment.conversation_id).get()
      const convApptId = convDoc.data && convDoc.data[0] && convDoc.data[0].appointment_id
      if (convApptId && convApptId !== appointment._id) {
        const convApptDoc = await db.collection('appointments').doc(convApptId).get()
        if (convApptDoc.data && convApptDoc.data[0]) {
          candidates.push(convApptDoc.data[0])
        }
      }
    } catch (e) {
      console.warn('[appointment-attendance-resolver] conversation lookup failed:', e)
    }
  }

  if (appointment.parent_id && appointment.teacher_id) {
    try {
      const convDoc = await db.collection('chat-conversations')
        .where({
          parent_id: appointment.parent_id,
          teacher_id: appointment.teacher_id
        })
        .orderBy('update_time', 'desc')
        .limit(1)
        .get()
      const convApptId = convDoc.data && convDoc.data[0] && convDoc.data[0].appointment_id
      if (convApptId && convApptId !== appointment._id) {
        const convApptDoc = await db.collection('appointments').doc(convApptId).get()
        if (convApptDoc.data && convApptDoc.data[0]) {
          candidates.push(convApptDoc.data[0])
        }
      }
    } catch (e) {
      console.warn('[appointment-attendance-resolver] pair conversation lookup failed:', e)
    }
  }

  if (appointment.parent_id && appointment.teacher_id) {
    try {
      const siblingDoc = await db.collection('appointments')
        .where({
          parent_id: appointment.parent_id,
          teacher_id: appointment.teacher_id,
          class_started_at: dbCmd.gt(0)
        })
        .orderBy('class_ended_at', 'desc')
        .limit(10)
        .get()
      candidates.push(...(siblingDoc.data || []))
    } catch (e) {
      console.warn('[appointment-attendance-resolver] sibling attendance lookup failed:', e)
    }
  }

  const seen = new Set()
  for (const item of candidates) {
    if (!item || !item._id || seen.has(item._id)) continue
    seen.add(item._id)
    if (item._id === appointment._id) continue
    if (hasAttendanceRecord(item)) {
      return item
    }
  }
  return null
}

async function findConversationBoundAttendance(db, appointment) {
  if (!appointment.parent_id || !appointment.teacher_id) return null

  try {
    const convDoc = await db.collection('chat-conversations')
      .where({
        parent_id: appointment.parent_id,
        teacher_id: appointment.teacher_id
      })
      .orderBy('update_time', 'desc')
      .limit(1)
      .get()
    const convApptId = convDoc.data && convDoc.data[0] && convDoc.data[0].appointment_id
    if (!convApptId || convApptId === appointment._id) return null
    const convApptDoc = await db.collection('appointments').doc(convApptId).get()
    const convAppt = convApptDoc.data && convApptDoc.data[0]
    return hasAttendanceRecord(convAppt) ? convAppt : null
  } catch (e) {
    console.warn('[appointment-attendance-resolver] conversation bound attendance failed:', e)
    return null
  }
}

async function persistAttendanceHeal(db, targetId, payload) {
  if (!targetId || !payload || !payload.class_ended_at) return
  const updateData = {
    class_started_at: payload.class_started_at || null,
    class_started_location: payload.class_started_location || null,
    class_ended_at: payload.class_ended_at,
    class_ended_location: payload.class_ended_location || null,
    update_time: Date.now()
  }
  if (payload.status === 'in_progress') {
    updateData.status = 'in_progress'
  }
  await db.collection('appointments').doc(targetId).update(updateData)
}

/**
 * @param {Object} db uniCloud database
 * @param {Object} appointment 预约文档
 * @param {{ persistHeal?: boolean }} options
 */
async function resolveAppointmentAttendance(db, appointment, options = {}) {
  const { persistHeal = true } = options
  if (!appointment || !appointment._id) return appointment

  await enrichParentPaidFromOrders(db, appointment, { persistHeal })
  await enrichConversationId(db, appointment)
  applyNormalizedAttendance(appointment)

  const mergeFromSource = async (source, persist = false) => {
    if (!source) return
    mergeAttendanceFields(appointment, source)
    if (['pending_confirm', 'confirmed'].includes(appointment.status) &&
      (appointment.class_started_at || appointment.class_ended_at) &&
      appointment.status !== 'completed') {
      appointment.status = 'in_progress'
    }
    appointment.confirm_appointment_id = appointment._id
    if (persist && persistHeal && appointment.parent_paid && appointment.class_ended_at) {
      try {
        await persistAttendanceHeal(db, appointment._id, {
          class_started_at: appointment.class_started_at,
          class_started_location: appointment.class_started_location,
          class_ended_at: appointment.class_ended_at,
          class_ended_location: appointment.class_ended_location,
          status: appointment.status
        })
        console.log('[appointment-attendance-resolver] healed attendance:', {
          viewAppointmentId: appointment._id,
          sourceAppointmentId: source._id,
          class_ended_at: appointment.class_ended_at
        })
      } catch (e) {
        console.warn('[appointment-attendance-resolver] persist heal failed:', e)
      }
    }
  }

  // 已支付：从兄弟预约/会话绑定预约同步打卡（用于展示 + 确认）
  if (appointment.parent_paid) {
    if (!hasAttendanceRecord(appointment)) {
      await mergeFromSource(await findAttendanceSource(db, appointment), persistHeal)
    } else if (!appointment.class_ended_at) {
      await mergeFromSource(await findAttendanceSource(db, appointment), false)
    }
    appointment.confirm_appointment_id = appointment._id
    return appointment
  }

  // 未支付：不同步打卡，避免家长端误展示
  if (!appointment.parent_paid) {
    appointment.class_started_at = null
    appointment.class_started_location = null
    appointment.class_ended_at = null
    appointment.class_ended_location = null
    appointment.confirm_appointment_id = appointment._id
    return appointment
  }
}

module.exports = {
  normalizeTimestamp,
  applyNormalizedAttendance,
  enrichParentPaidFromOrders,
  enrichConversationId,
  hasAttendanceRecord,
  findAttendanceSource,
  findConversationBoundAttendance,
  resolveAppointmentAttendance
}
