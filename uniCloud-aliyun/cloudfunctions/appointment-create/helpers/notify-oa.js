/**
 * 预约创建成功后发送服务号「预约成功通知」
 */

const { sendAppointmentSuccess, formatNow } = require('wx-oa-client')

function mapAppointmentType(courseType, lessonMode) {
  // phrase 最多 5 个汉字
  if (courseType === 'trial') return '试课'
  if (courseType === 'regular') return '正课'
  if (lessonMode === 'online') return '线上'
  if (lessonMode === 'offline') return '线下'
  return '预约'
}

function formatAppointmentDate(date, startTime) {
  const d = date == null ? '' : String(date).trim()
  let t = startTime == null ? '' : String(startTime).trim()
  if (/^\d{10,13}$/.test(t)) {
    t = formatNow(Number(t)).slice(11) // HH:mm
  } else if (t.length > 5 && t.indexOf(' ') >= 0) {
    t = t.split(' ').pop().slice(0, 5)
  } else {
    t = t.slice(0, 5)
  }
  if (d && t) return `${d} ${t}`
  if (d) return d
  if (t) return t
  return formatNow()
}

/**
 * 通知家长与教师（失败不影响主流程）
 */
async function notifyAppointmentSuccessOa({
  appointmentId,
  appointmentNo,
  parentId,
  teacherId,
  courseType,
  lessonMode,
  date,
  startTime,
  subject
} = {}) {
  const orderNo = String(appointmentNo || appointmentId || '').slice(0, 32)
  const type = mapAppointmentType(courseType, lessonMode)
  const project = String(subject || '家教课程').slice(0, 20)
  const dateText = formatAppointmentDate(date, startTime)

  const targets = [
    {
      user_id: parentId,
      pagepath: `pages/appointment/detail?id=${encodeURIComponent(appointmentId)}`,
      role: 'parent'
    },
    {
      user_id: teacherId,
      pagepath: `pages-teacher/appointment/detail?id=${encodeURIComponent(appointmentId)}`,
      role: 'teacher'
    }
  ]

  const results = []
  for (const target of targets) {
    if (!target.user_id) continue
    try {
      const res = await sendAppointmentSuccess({
        user_id: target.user_id,
        appointment_id: appointmentId,
        order_no: orderNo,
        date: dateText,
        type,
        project,
        pagepath: target.pagepath,
        client_msg_id: `appt_ok_${appointmentId}_${target.role}`
      })
      results.push({ role: target.role, ...res })
      if (res && !res.ok && !res.skipped) {
        console.warn('[appointment-create.notifyOa]', target.role, res.errcode, res.errmsg)
      }
    } catch (e) {
      console.warn('[appointment-create.notifyOa]', target.role, e && (e.message || e))
      results.push({ role: target.role, ok: false, errmsg: e && e.message })
    }
  }
  return results
}

module.exports = {
  notifyAppointmentSuccessOa
}
