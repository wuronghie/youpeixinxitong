/**
 * 预约打卡数据解析
 * - 兼容 timestamp / 字符串 / Date 等多种 class_*_at 存储格式
 * - 每笔预约打卡独立，不再从兄弟预约/旧单继承（避免再次试课后串数据）
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
  target.class_started_at = started
  target.class_ended_at = ended
  if (!started) target.class_started_location = null
  if (!ended) target.class_ended_location = null
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

  // 清理错误继承的打卡：
  // 1) 带 attendance_source_appointment_id
  // 2) 打卡时间早于本单创建时间（说明是从历史预约串过来的）
  applyNormalizedAttendance(appointment)
  const createTs = Number(appointment.create_time || 0)
  const startedTs = normalizeTimestamp(appointment.class_started_at)
  const inheritedFromOther =
    (appointment.attendance_source_appointment_id &&
      appointment.attendance_source_appointment_id !== appointment._id) ||
    (createTs > 0 && startedTs > 0 && startedTs < createTs - 1000)
  if (inheritedFromOther) {
    appointment.class_started_at = null
    appointment.class_started_location = null
    appointment.class_ended_at = null
    appointment.class_ended_location = null
    appointment.attendance_source_appointment_id = null
    if (persistHeal) {
      try {
        await db.collection('appointments').doc(appointment._id).update({
          class_started_at: null,
          class_started_location: null,
          class_ended_at: null,
          class_ended_location: null,
          attendance_source_appointment_id: null,
          update_time: Date.now()
        })
        console.log('[appointment-attendance-resolver] cleared inherited attendance:', appointment._id)
      } catch (e) {
        console.warn('[appointment-attendance-resolver] clear inherited attendance failed:', e)
      }
    }
  }

  applyNormalizedAttendance(appointment)
  appointment.confirm_appointment_id = appointment._id
  return appointment
}

module.exports = {
  normalizeTimestamp,
  applyNormalizedAttendance,
  enrichParentPaidFromOrders,
  enrichConversationId,
  hasAttendanceRecord,
  resolveAppointmentAttendance
}
