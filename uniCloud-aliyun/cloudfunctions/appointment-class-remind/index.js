'use strict'
/**
 * 上课前 30 分钟定时提醒
 * 服务号「预约到场通知」44710：访客姓名=孩子名字，服务项目=课程类型/科目/时间
 * 访客电话：通知家长填教师手机号，通知教师填家长手机号
 * 每 5 分钟跑一次，窗口 25–35 分钟，发送后写入 oa_class_reminded_at 防重复
 */

const { sendClassRemind, formatNow } = require('wx-oa-client')

const LEAD_MS = 30 * 60 * 1000
const WINDOW_MS = 5 * 60 * 1000
const PAGE_SIZE = 100

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatDate(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function normalizeTime(raw) {
  const s = String(raw || '').trim()
  const m = s.match(/(\d{1,2}):(\d{2})/)
  if (!m) return ''
  return `${pad(Number(m[1]))}:${m[2]}`
}

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('86')) digits = digits.slice(2)
  return digits.slice(0, 17)
}

function resolveStartTs(appointment) {
  const schedule = appointment.schedule || {}
  const date = schedule.date || appointment.appointment_date || appointment.date
  const startTime = normalizeTime(
    schedule.start_time || appointment.start_time || appointment.appointment_time || appointment.time
  )
  if (!date || !startTime) return 0
  const dateNorm = String(date).trim().replace(/-/g, '/')
  const ts = new Date(`${dateNorm} ${startTime}:00`).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

function resolveEndTime(appointment) {
  const schedule = appointment.schedule || {}
  return normalizeTime(schedule.end_time || appointment.end_time)
}

function courseTypeText(courseType) {
  if (courseType === 'trial') return '试课'
  if (courseType === 'regular') return '正课'
  return '课程'
}

function sliceThing(text, max = 20) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function buildVisitorName(appointment) {
  const fromInfo = appointment.student_info && appointment.student_info.name
  return sliceThing(appointment.student_name || fromInfo || appointment.studentName || '学员')
}

function buildService(appointment, startTs) {
  const typeText = courseTypeText(appointment.course_type || appointment.type)
  const subject = String(appointment.subject || (appointment.student_info && appointment.student_info.subject) || '').trim() || '家教'
  const startTime = formatNow(startTs).slice(11, 16)
  const endTime = resolveEndTime(appointment)
  const timeText = endTime ? `${startTime}-${endTime}` : startTime
  return sliceThing(`${typeText} ${subject} ${timeText}`)
}

async function loadCandidates(db, today, tomorrow) {
  const dbCmd = db.command
  const res = await db.collection('appointments')
    .where(dbCmd.and([
      { status: 'confirmed' },
      dbCmd.or([
        { date: dbCmd.in([today, tomorrow]) },
        { appointment_date: dbCmd.in([today, tomorrow]) },
        { 'schedule.date': dbCmd.in([today, tomorrow]) }
      ])
    ]))
    .field({
      parent_id: true,
      teacher_id: true,
      student_name: true,
      student_info: true,
      subject: true,
      course_type: true,
      type: true,
      date: true,
      appointment_date: true,
      start_time: true,
      end_time: true,
      appointment_time: true,
      time: true,
      schedule: true,
      address: true,
      class_started_at: true,
      oa_class_reminded_at: true
    })
    .limit(PAGE_SIZE)
    .get()
  return res.data || []
}

async function loadUserPhone(db, userId) {
  if (!userId) return ''
  try {
    const userDoc = await db.collection('uni-id-users')
      .doc(userId)
      .field({ mobile: true, parent_info: true })
      .get()
    const user = (userDoc.data && userDoc.data[0]) || {}
    const parentInfo = user.parent_info || {}
    return normalizePhone(user.mobile)
      || normalizePhone(parentInfo.contact_mobile)
      || normalizePhone(parentInfo.phone)
      || ''
  } catch (e) {
    return ''
  }
}

async function loadTeacherPhone(db, teacherId) {
  if (!teacherId) return ''
  try {
    const profileRes = await db.collection('teacher-profiles')
      .where({ teacher_id: teacherId })
      .field({ contact_mobile: true })
      .limit(1)
      .get()
    const profile = (profileRes.data && profileRes.data[0]) || {}
    const fromProfile = normalizePhone(profile.contact_mobile)
    if (fromProfile) return fromProfile
  } catch (e) {}
  return loadUserPhone(db, teacherId)
}

async function loadPeerPhones(db, appointment) {
  const parentPhone = normalizePhone(appointment.address && appointment.address.contact_phone)
    || await loadUserPhone(db, appointment.parent_id)
  const teacherPhone = await loadTeacherPhone(db, appointment.teacher_id)
  return { parentPhone, teacherPhone }
}

async function remindOne(db, appointment, startTs) {
  const visitorName = buildVisitorName(appointment)
  const service = buildService(appointment, startTs)
  const timeText = formatNow(startTs)
  const { parentPhone, teacherPhone } = await loadPeerPhones(db, appointment)
  const appointmentId = appointment._id
  const targets = [
    {
      user_id: appointment.parent_id,
      role: 'parent',
      phone: teacherPhone,
      pagepath: `pages-biz/appointment/detail?id=${encodeURIComponent(appointmentId)}`
    },
    {
      user_id: appointment.teacher_id,
      role: 'teacher',
      phone: parentPhone,
      pagepath: `pages-teacher/appointment/detail?id=${encodeURIComponent(appointmentId)}`
    }
  ]

  const results = []
  for (const target of targets) {
    if (!target.user_id) {
      results.push({ role: target.role, skipped: true, reason: 'no_user' })
      continue
    }
    try {
      const res = await sendClassRemind({
        user_id: target.user_id,
        appointment_id: appointmentId,
        visitor_name: visitorName,
        service,
        time: timeText,
        phone: target.phone,
        pagepath: target.pagepath,
        client_msg_id: `class_soon_${appointmentId}_${target.role}`
      })
      results.push({ role: target.role, ...res })
    } catch (e) {
      results.push({
        role: target.role,
        ok: false,
        error: e && (e.message || String(e))
      })
    }
  }
  return results
}

exports.main = async () => {
  const now = Date.now()
  const today = formatDate(now)
  const tomorrow = formatDate(now + 24 * 60 * 60 * 1000)
  const db = uniCloud.database()

  let list = []
  try {
    list = await loadCandidates(db, today, tomorrow)
  } catch (e) {
    console.error('[appointment-class-remind] 查询失败', e)
    return { code: -1, message: e.message || '查询失败' }
  }

  const due = []
  for (const apt of list) {
    if (apt.oa_class_reminded_at) continue
    if (apt.class_started_at) continue
    const startTs = resolveStartTs(apt)
    if (!startTs) continue
    const delta = startTs - now
    if (delta >= LEAD_MS - WINDOW_MS && delta <= LEAD_MS + WINDOW_MS) {
      due.push({ apt, startTs })
    }
  }

  console.log('[appointment-class-remind] candidates=', list.length, 'due=', due.length, {
    today,
    tomorrow,
    now: formatNow(now)
  })

  const sent = []
  for (const item of due) {
    const results = await remindOne(db, item.apt, item.startTs)
    const hardFail = results.some(r => r.ok === false && !r.skipped)
    if (!hardFail) {
      try {
        await db.collection('appointments').doc(item.apt._id).update({
          oa_class_reminded_at: now,
          update_time: now
        })
      } catch (e) {
        console.warn('[appointment-class-remind] 标记已提醒失败', item.apt._id, e && e.message)
      }
    }
    sent.push({
      appointment_id: item.apt._id,
      visitor_name: buildVisitorName(item.apt),
      service: buildService(item.apt, item.startTs),
      results
    })
    console.log('[appointment-class-remind] sent', JSON.stringify({
      appointment_id: item.apt._id,
      results
    }))
  }

  return {
    code: 0,
    message: 'ok',
    data: {
      scanned: list.length,
      due: due.length,
      sent
    }
  }
}
