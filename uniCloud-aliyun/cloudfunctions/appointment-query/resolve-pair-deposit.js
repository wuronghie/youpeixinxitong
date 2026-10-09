/**
 * 同一对家长 + 老师只需支付一次信息费。
 * 正式课预约创建时常常 deposit_paid=false，实际费用记在试课单或会话上。
 */

async function resolvePairDepositPaid(db, appointment, options = {}) {
  const { persistHeal = false } = options
  if (!appointment) return false

  if (appointment.deposit_paid === true || appointment.deposit_paid === 'true') {
    appointment.deposit_paid = true
    return true
  }

  const parentId = appointment.parent_id
  const teacherId = appointment.teacher_id
  if (!parentId || !teacherId) return false

  const dbCmd = db.command
  let depositPaid = false

  try {
    const byApt = await db.collection('chat-conversations')
      .where({ appointment_id: appointment._id })
      .limit(1)
      .get()
    if (byApt.data && byApt.data[0] && byApt.data[0].teacher_deposit_paid) {
      depositPaid = true
    }
  } catch (e) {}

  if (!depositPaid) {
    try {
      const pair = await db.collection('chat-conversations')
        .where({
          parent_id: parentId,
          teacher_id: teacherId,
          teacher_deposit_paid: true
        })
        .limit(1)
        .get()
      if (pair.data && pair.data.length) depositPaid = true
    } catch (e) {}
  }

  if (!depositPaid) {
    try {
      const orders = await db.collection('payment-orders')
        .where({
          order_type: 'deposit',
          payer_id: teacherId,
          status: dbCmd.in(['paid', 'success'])
        })
        .get()
      const appointmentIds = (orders.data || []).map((o) => o.appointment_id).filter(Boolean)
      if (appointmentIds.indexOf(appointment._id) !== -1) {
        depositPaid = true
      } else if (appointmentIds.length) {
        const related = await db.collection('appointments')
          .where({
            _id: dbCmd.in(appointmentIds),
            parent_id: parentId
          })
          .limit(1)
          .get()
        if (related.data && related.data.length) depositPaid = true
      }
    } catch (e) {
      console.warn('[resolve-pair-deposit] 查信息费订单失败', e && (e.message || e))
    }
  }

  if (depositPaid) {
    appointment.deposit_paid = true
    appointment.deposit_paid_from_pair = true
    if (persistHeal && appointment._id) {
      try {
        await db.collection('appointments').doc(appointment._id).update({
          deposit_paid: true,
          deposit_time: appointment.deposit_time || Date.now(),
          update_time: Date.now()
        })
      } catch (healErr) {
        console.warn('[resolve-pair-deposit] 回写 deposit_paid 失败', healErr && (healErr.message || healErr))
      }
    }
  }

  return depositPaid
}

async function markListDepositFromPairs(db, teacherId, appointments) {
  const list = appointments || []
  if (!teacherId || !list.length) return list
  const need = list.filter((item) => !(item.deposit_paid === true || item.deposit_paid === 'true'))
  if (!need.length) return list

  const paidParents = {}
  try {
    const convs = await db.collection('chat-conversations')
      .where({
        teacher_id: teacherId,
        teacher_deposit_paid: true
      })
      .field({ parent_id: true })
      .limit(500)
      .get()
    ;(convs.data || []).forEach((row) => {
      if (row.parent_id) paidParents[row.parent_id] = true
    })
  } catch (e) {
    console.warn('[resolve-pair-deposit] 列表会话查询失败', e && (e.message || e))
  }

  list.forEach((item) => {
    if (item.deposit_paid === true || item.deposit_paid === 'true') return
    if (item.parent_id && paidParents[item.parent_id]) {
      item.deposit_paid = true
      item.deposit_paid_from_pair = true
    }
  })
  return list
}

module.exports = {
  resolvePairDepositPaid,
  markListDepositFromPairs
}
