"use strict";
function isTrialAppointment(apt = {}) {
  return (apt.course_type || apt.type) === "trial";
}
function isParentCoursePaid(apt = {}) {
  return apt.parent_paid === true || apt.parent_paid === "true" || !!apt.parent_paid_from_order || !!apt.parent_paid_from_record || !!(apt.parent_payment_time || apt.payment_time);
}
function isDepositPaid(apt = {}) {
  if (apt.deposit_paid === true || apt.deposit_paid === "true" || !!apt.deposit_paid_from_pair) {
    return true;
  }
  if (!isTrialAppointment(apt) && apt.status !== "contact_request")
    return true;
  return false;
}
const CLOCK_STATUSES = ["confirmed", "in_progress", "pending_confirm", "completed"];
function canShowTeacherClock(apt = {}) {
  if (!apt || !apt._id)
    return false;
  if (apt.class_started_at || apt.class_ended_at)
    return true;
  if (!isDepositPaid(apt) || !isParentCoursePaid(apt))
    return false;
  return CLOCK_STATUSES.includes(apt.status);
}
function parseScheduleStart(item = {}) {
  const schedule = item.schedule || {};
  const date = schedule.date || item.appointment_date || item.date;
  const startTime = schedule.start_time || item.appointment_time || item.start_time;
  if (!date || !startTime)
    return 0;
  const ts = (/* @__PURE__ */ new Date(`${date}T${startTime}:00`)).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}
function parseScheduleEnd(item = {}, startTs) {
  if (!startTs)
    return 0;
  const schedule = item.schedule || {};
  if (schedule.end_time) {
    const date = schedule.date || item.appointment_date || item.date;
    const ts = (/* @__PURE__ */ new Date(`${date}T${schedule.end_time}:00`)).getTime();
    if (!Number.isNaN(ts))
      return ts;
  }
  const duration = Number(schedule.duration || item.duration || 2);
  return startTs + duration * 3600 * 1e3;
}
function getTeacherClockBadge(item) {
  if (!canShowTeacherClock(item))
    return null;
  const startTs = parseScheduleStart(item);
  const endTs = parseScheduleEnd(item, startTs);
  const now = Date.now();
  const ALLOW_EARLY_MS = 15 * 60 * 1e3;
  const started = !!item.class_started_at;
  const ended = !!item.class_ended_at;
  if (started && ended)
    return { text: "打卡已完成", className: "badge-success" };
  if (started && !ended) {
    if (endTs && now >= endTs)
      return { text: "待下课打卡", className: "badge-warning" };
    return { text: "上课中", className: "badge-info" };
  }
  if (startTs && now >= startTs - ALLOW_EARLY_MS && (!endTs || now < endTs)) {
    return { text: "待上课打卡", className: "badge-danger" };
  }
  if (endTs && now >= endTs)
    return { text: "已超时未打卡", className: "badge-danger" };
  return { text: "未到打卡时间", className: "badge-muted" };
}
exports.canShowTeacherClock = canShowTeacherClock;
exports.getTeacherClockBadge = getTeacherClockBadge;
exports.isDepositPaid = isDepositPaid;
exports.isParentCoursePaid = isParentCoursePaid;
exports.isTrialAppointment = isTrialAppointment;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/utils/appointmentClock.js.map
