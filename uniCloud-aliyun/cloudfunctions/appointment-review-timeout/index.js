'use strict'
/**
 * 下课未评价超时处理
 * 21 小时：服务号提醒家长「3小时后将默认好评」
 * 24 小时：系统默认 5 星好评；尚未确认结果的按试课成功 / 正式课完成结算
 */

const { sendReviewRemind, formatNow } = require('wx-oa-client')
const { appendReviewChatNotice } = require('chat-notice')

const REMIND_MS = 21 * 60 * 60 * 1000
const DEFAULT_MS = 24 * 60 * 60 * 1000
const PAGE_SIZE = 50
const DEFAULT_CONTENT = '系统默认好评'
const POSITIVE_RATING_THRESHOLD = 4
const OPEN_STATUSES = ['pending_confirm', 'confirmed', 'in_progress', 'completed']

function sliceThing(text, max = 20) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function teacherLabel(appointment) {
  return sliceThing(appointment.teacher_name || '评价提醒')
}

function reviewPagepath(appointmentId) {
  return `pages/review/create?appointmentId=${encodeURIComponent(appointmentId)}`
}

async function hasReviewRecord(db, appointmentId) {
  const existing = await db.collection('reviews')
    .where({ appointment_id: appointmentId })
    .limit(1)
    .get()
  return !!(existing.data && existing.data.length)
}

async function loadCandidates(db, cutoff21) {
  const dbCmd = db.command
  const res = await db.collection('appointments')
    .where(dbCmd.and([
      { class_ended_at: dbCmd.lte(cutoff21) },
      { parent_paid: true },
      { status: dbCmd.in(OPEN_STATUSES) }
    ]))
    .field({
      parent_id: true,
      teacher_id: true,
      teacher_name: true,
      course_type: true,
      status: true,
      parent_paid: true,
      class_ended_at: true,
      has_review: true,
      review_id: true,
      oa_review_reminded_at: true,
      auto_reviewed_at: true
    })
    .orderBy('class_ended_at', 'asc')
    .limit(PAGE_SIZE)
    .get()
  return res.data || []
}

async function updateTeacherReviewStats(db, teacherId) {
  if (!teacherId) return
  const allReviews = await db.collection('reviews')
    .where({ teacher_id: teacherId })
    .field({ rating: true })
    .get()
  const reviews = allReviews.data || []
  if (!reviews.length) {
    await db.collection('teacher-profiles')
      .where({ teacher_id: teacherId })
      .update({
        rating: 0,
        review_count: 0,
        positive_rate: 0,
        update_time: Date.now()
      })
    return
  }
  const total = reviews.length
  const totalRating = reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0)
  const positiveCount = reviews.filter(r => Number(r.rating) >= POSITIVE_RATING_THRESHOLD).length
  await db.collection('teacher-profiles')
    .where({ teacher_id: teacherId })
    .update({
      rating: Math.round((totalRating / total) * 10) / 10,
      review_count: total,
      positive_rate: Math.round((positiveCount / total) * 100),
      update_time: Date.now()
    })
}

async function settleIfNeeded(db, appointment) {
  if (appointment.status === 'completed') {
    return { ok: true, skipped: true }
  }
  const appointmentComplete = uniCloud.importObject('appointment-complete', { customUI: true })
  let completeResult
  if (appointment.course_type === 'trial') {
    completeResult = await appointmentComplete.confirmTrialSuccess({
      appointment_id: appointment._id
    })
  } else {
    completeResult = await appointmentComplete.completeCourse({
      appointment_id: appointment._id
    })
  }
  const alreadyDone = completeResult && completeResult.message && /已完成|已结算/.test(completeResult.message)
  if (!completeResult || (completeResult.code !== 0 && !alreadyDone)) {
    return { ok: false, message: (completeResult && completeResult.message) || '结算失败' }
  }

  const now = Date.now()
  await db.collection('payment-orders')
    .where({
      appointment_id: appointment._id,
      order_type: 'course_fee'
    })
    .update({
      status: 'success',
      finish_time: now,
      update_time: now
    })
  await db.collection('chat-conversations')
    .where({ appointment_id: appointment._id })
    .update({
      status: 'completed',
      update_time: now
    })
  return { ok: true }
}

async function writeDefaultReview(db, appointment, now) {
  if (await hasReviewRecord(db, appointment._id)) {
    return { ok: true, skipped: true, reason: 'has_review' }
  }
  const addRes = await db.collection('reviews').add({
    appointment_id: appointment._id,
    teacher_id: appointment.teacher_id,
    parent_id: appointment.parent_id,
    rating: 5,
    tags: [],
    content: DEFAULT_CONTENT,
    is_satisfied: appointment.course_type === 'trial' ? true : null,
    is_auto: true,
    status: 'published',
    teacher_name: appointment.teacher_name || '',
    parent_name: '家长',
    create_time: now,
    update_time: now
  })
  if (!addRes.id) {
    return { ok: false, message: '写入默认评价失败' }
  }
  await db.collection('appointments').doc(appointment._id).update({
    has_review: true,
    review_id: addRes.id,
    auto_reviewed_at: now,
    is_reviewed: true,
    update_time: now
  })
  await db.collection('payment-orders')
    .where({
      appointment_id: appointment._id,
      order_type: 'course_fee'
    })
    .update({
      has_review: true,
      review_id: addRes.id,
      update_time: now
    })
  await updateTeacherReviewStats(db, appointment.teacher_id)
  try {
    await appendReviewChatNotice(db, {
      appointment,
      review: {
        review_id: addRes.id,
        rating: 5,
        tags: [],
        content: DEFAULT_CONTENT,
        is_satisfied: appointment.course_type === 'trial' ? true : null,
        is_auto: true
      }
    })
  } catch (noticeErr) {
    console.warn('[appointment-review-timeout] 聊天评价卡片失败', appointment._id, noticeErr && noticeErr.message)
  }
  return { ok: true, review_id: addRes.id }
}

async function remindParent(db, appointment, now) {
  const appointmentId = appointment._id
  let oa = { skipped: true, reason: 'no_parent' }
  if (appointment.parent_id) {
    try {
      oa = await sendReviewRemind({
        user_id: appointment.parent_id,
        appointment_id: appointmentId,
        visitor_name: teacherLabel(appointment),
        reason: '3小时后将默认好评',
        time: formatNow(now),
        pagepath: reviewPagepath(appointmentId),
        client_msg_id: `review_soon_${appointmentId}`
      })
    } catch (e) {
      oa = { ok: false, error: e && (e.message || String(e)) }
    }
  }

  try {
    await db.collection('system-messages').add({
      user_id: appointment.parent_id,
      type: 'review',
      title: '请尽快评价，3 小时后将默认好评',
      content: `您与${appointment.teacher_name || '教师'}的课程已结束超过 21 小时仍未评价。3 小时后系统将默认好评并完成结算，请尽快前往评价。`,
      related_id: appointmentId,
      action: {
        type: 'navigate',
        path: '/pages/review/create',
        params: { appointmentId }
      },
      is_read: false
    })
  } catch (e) {
    console.warn('[appointment-review-timeout] 系统消息失败', appointmentId, e && e.message)
  }

  const hardFail = oa && oa.ok === false && !oa.skipped
  if (!hardFail) {
    await db.collection('appointments').doc(appointmentId).update({
      oa_review_reminded_at: now,
      update_time: now
    })
  }
  return { action: 'remind', oa }
}

async function applyDefault(db, appointment, now) {
  try {
    const settled = await settleIfNeeded(db, appointment)
    if (!settled.ok) {
      return { action: 'default', ok: false, message: settled.message }
    }
    const review = await writeDefaultReview(db, appointment, now)
    return { action: 'default', ...review }
  } catch (e) {
    return { action: 'default', ok: false, error: e && (e.message || String(e)) }
  }
}

exports.main = async () => {
  const now = Date.now()
  const cutoff21 = now - REMIND_MS
  const cutoff24 = now - DEFAULT_MS
  const db = uniCloud.database()

  let list = []
  try {
    list = await loadCandidates(db, cutoff21)
  } catch (e) {
    console.error('[appointment-review-timeout] 查询失败', e)
    return { code: -1, message: e.message || '查询失败' }
  }

  const results = []
  for (const apt of list) {
    const ended = Number(apt.class_ended_at) || 0
    if (!ended || apt.has_review || apt.auto_reviewed_at) continue
    if (await hasReviewRecord(db, apt._id)) continue

    let item
    if (ended <= cutoff24) {
      item = await applyDefault(db, apt, now)
    } else if (!apt.oa_review_reminded_at) {
      item = await remindParent(db, apt, now)
    } else {
      item = { action: 'wait', skipped: true }
    }
    results.push({ appointment_id: apt._id, ended_at: ended, ...item })
    console.log('[appointment-review-timeout]', JSON.stringify(results[results.length - 1]))
  }

  return {
    code: 0,
    message: 'ok',
    data: {
      scanned: list.length,
      handled: results.length,
      results
    }
  }
}
