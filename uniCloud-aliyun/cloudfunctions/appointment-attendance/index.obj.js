/**
 * 教师上课/下课打卡云对象
 *
 * 业务规则（打卡时间与排课时间解耦，任意时刻可打，只落库时间 + 定位便于查询）：
 *   0. 前置条件：家长已支付本单课程费（parent_paid / 已支付订单），试课须先付后打
 *   1. 上课打卡（clockIn）：
 *      - 仅教师本人可调用
 *      - 预约状态必须为 confirmed 或 in_progress
 *      - 必须上传定位（latitude/longitude）
 *      - 不校验与排课开始/结束时间的先后关系
 *      - 成功后将 status 置为 in_progress 并写入 class_started_at + class_started_location
 *
 *   2. 下课打卡（clockOut）：
 *      - 仅教师本人可调用
 *      - 须已存在上课打卡，且未重复下课打卡
 *      - 家长须已支付本单课程费
 *      - 必须上传定位；不限制相对排课结束时间多久
 *      - 成功后写入 class_ended_at + class_ended_location
 *
 *   3. 结算等流程仍以「存在下课打卡记录」等为准，由 appointment-complete 等单独校验
 */

function success(data = null, message = 'success') {
  return { code: 0, message, data, timestamp: Date.now() }
}

function error(message = 'error', code = -1, data = null) {
  return { code, message, data, timestamp: Date.now() }
}

/**
 * 解析预约的开始 / 结束时间，返回 { startTs, endTs }（毫秒时间戳）
 * 兼容多种字段：schedule.date / schedule.start_time / schedule.end_time / schedule.duration
 *               appointment_date / appointment_time / duration
 */
function resolveSchedule(appointment) {
  const schedule = appointment.schedule || {}
  const date = schedule.date || appointment.appointment_date || appointment.date
  const startTime = schedule.start_time || appointment.appointment_time || appointment.start_time
  const duration = Number(schedule.duration || appointment.duration || 2)

  if (!date || !startTime) {
    return { startTs: 0, endTs: 0, ok: false }
  }

  const startTs = new Date(`${date}T${startTime}:00`).getTime()
  if (Number.isNaN(startTs)) {
    return { startTs: 0, endTs: 0, ok: false }
  }

  let endTs
  if (schedule.end_time) {
    const t = new Date(`${date}T${schedule.end_time}:00`).getTime()
    endTs = Number.isNaN(t) ? startTs + duration * 3600 * 1000 : t
  } else {
    endTs = startTs + duration * 3600 * 1000
  }

  return { startTs, endTs, ok: true }
}

function validateLocation(location) {
  if (!location || typeof location !== 'object') return '请上传打卡定位'
  const { latitude, longitude, address } = location
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return '定位参数不合法（缺少经纬度）'
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return '定位参数超出合法范围'
  }
  if (typeof address !== 'string' || !address.trim()) {
    return '请上传打卡文字地址'
  }
  return null
}

function buildLocation(location) {
  return {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    address: typeof location.address === 'string' ? location.address.trim() : '',
    accuracy: typeof location.accuracy === 'number' ? location.accuracy : 0
  }
}

/**
 * 解析当前调用者的 uid。与项目其他云对象（appointment-create 等）完全一致：
 *   1) 用 ctx.getUniIdToken() 取 token（标准 uni-id 接口）
 *   2) 优先 ctx.uniID.checkToken(token) 验证
 *   3) checkToken 失败时回落 base64 解码（兼容测试账号的简单 token）
 *
 * 注意 ❌ 不要用 ctx.getClientInfo().uniIdToken：在某些客户端/环境下为空，
 * 会导致明明已登录但报 "请先登录"。
 */
async function resolveUserId(ctx) {
  try {
    const token = ctx.getUniIdToken && ctx.getUniIdToken()
    if (!token) return null

    if (ctx.uniID && typeof ctx.uniID.checkToken === 'function') {
      try {
        const payload = await ctx.uniID.checkToken(token)
        if (payload && !payload.code && payload.uid) {
          return payload.uid
        }
      } catch (e) {
        // 忽略，落到 base64 兜底
      }
    }

    // 兜底：兼容简单 token（base64(uid_xxx)），用于测试账号
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      return parts.length >= 1 && parts[0] ? parts[0] : null
    } catch (e) {
      return null
    }
  } catch (e) {
    console.error('[appointment-attendance] resolveUserId 异常:', e)
    return null
  }
}

async function isParentCourseFeePaid(db, appointment) {
  if (!appointment) return false
  if (appointment.parent_paid === true || appointment.parent_paid === 'true') return true
  if (appointment.parent_payment_time || appointment.payment_time || appointment.parent_payment_order_id) {
    return true
  }
  try {
    const dbCmd = db.command
    const orderDoc = await db.collection('payment-orders')
      .where({
        appointment_id: appointment._id,
        status: dbCmd.in(['paid', 'success'])
      })
      .limit(10)
      .get()
    return (orderDoc.data || []).some((order) => {
      const type = order.order_type || order.fee_kind || 'course_fee'
      return ['course_fee', 'trial', 'regular'].includes(type) || !type
    })
  } catch (e) {
    console.warn('[appointment-attendance] isParentCourseFeePaid query failed:', e)
    return false
  }
}

function canClockInByStatus(status) {
  return ['confirmed', 'in_progress'].includes(status)
}

async function resolveParentPaid(db, appointment) {
  const paid = await isParentCourseFeePaid(db, appointment)
  appointment.parent_paid = paid
  return paid
}

module.exports = {
  _before() {
    // 提前建好 uni-id 实例，方法里直接用 this.uniID
    try {
      const uniIdCommon = require('uni-id-common')
      if (typeof uniIdCommon.createInstance === 'function') {
        this.uniID = uniIdCommon.createInstance({ clientInfo: this.getClientInfo() })
      }
    } catch (e) {
      console.warn('[appointment-attendance] _before 初始化 uni-id 失败:', e)
    }
  },

  /**
   * 上课打卡
   * @param {Object} params
   * @param {String} params.appointment_id   预约ID
   * @param {Object} params.location         { latitude, longitude, address?, accuracy? }
   */
  async clockIn(params = {}) {
    try {
      const { appointment_id, location } = params
      if (!appointment_id) return error('缺少预约ID')

      const locErr = validateLocation(location)
      if (locErr) return error(locErr)

      const teacherId = await resolveUserId(this)
      if (!teacherId) return error('请先登录')

      const db = uniCloud.database()
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      const appointment = appointmentDoc.data[0]

      if (appointment.teacher_id !== teacherId) {
        return error('无权操作该预约')
      }

      if (appointment.class_started_at) {
        return error('已经上课打卡，不可重复打卡')
      }

      const parentPaid = await resolveParentPaid(db, appointment)
      if (!parentPaid) {
        return error('家长尚未支付试课费，请等待家长完成支付后再打卡')
      }

      if (!canClockInByStatus(appointment.status)) {
        return error(`当前状态（${appointment.status}）不允许上课打卡，请等待家长支付并确认预约`)
      }

      const now = Date.now()

      await db.collection('appointments').doc(appointment_id).update({
        status: 'in_progress',
        class_started_at: now,
        class_started_location: buildLocation(location),
        update_time: now
      })

      return success({
        appointment_id,
        class_started_at: now,
        location: buildLocation(location)
      }, '上课打卡成功')
    } catch (e) {
      console.error('[appointment-attendance.clockIn]', e)
      return error('上课打卡失败：' + (e && e.message || e))
    }
  },

  /**
   * 下课打卡
   * @param {Object} params
   * @param {String} params.appointment_id
   * @param {Object} params.location
   */
  async clockOut(params = {}) {
    try {
      const { appointment_id, location } = params
      if (!appointment_id) return error('缺少预约ID')

      const locErr = validateLocation(location)
      if (locErr) return error(locErr)

      const teacherId = await resolveUserId(this)
      if (!teacherId) return error('请先登录')

      const db = uniCloud.database()
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      const appointment = appointmentDoc.data[0]

      if (appointment.teacher_id !== teacherId) {
        return error('无权操作该预约')
      }

      if (!appointment.class_started_at) {
        return error('请先完成上课打卡')
      }

      if (appointment.class_ended_at) {
        return error('已完成下课打卡，不可重复打卡')
      }

      const parentPaid = await resolveParentPaid(db, appointment)
      if (!parentPaid) {
        return error('家长尚未支付试课费，无法完成下课打卡')
      }

      const now = Date.now()
      console.log('[appointment-attendance.clockOut] 准备写入下课打卡:', {
        appointment_id,
        teacherId,
        appointmentTeacherId: appointment.teacher_id,
        appointmentParentId: appointment.parent_id,
        status: appointment.status,
        class_started_at: appointment.class_started_at || null,
        class_ended_at_before: appointment.class_ended_at || null,
        write_class_ended_at: now,
        location: buildLocation(location)
      })

      await db.collection('appointments').doc(appointment_id).update({
        class_ended_at: now,
        class_ended_location: buildLocation(location),
        update_time: now
      })
      console.log('[appointment-attendance.clockOut] 下课打卡写入完成:', {
        appointment_id,
        class_ended_at: now
      })

      return success({
        appointment_id,
        class_ended_at: now,
        location: buildLocation(location)
      }, '下课打卡成功')
    } catch (e) {
      console.error('[appointment-attendance.clockOut]', e)
      return error('下课打卡失败：' + (e && e.message || e))
    }
  },

  /**
   * 查询当前预约的打卡状态（前端轮询/进入页面时使用）
   */
  async getStatus(params = {}) {
    try {
      const { appointment_id } = params
      if (!appointment_id) return error('缺少预约ID')

      const teacherId = await resolveUserId(this)
      if (!teacherId) return error('请先登录')

      const db = uniCloud.database()
      const doc = await db.collection('appointments').doc(appointment_id).get()
      if (!doc.data || doc.data.length === 0) return error('预约不存在')

      const appointment = doc.data[0]
      if (appointment.teacher_id !== teacherId && appointment.parent_id !== teacherId) {
        console.warn('[appointment-attendance.getStatus] 无权查看:', {
          appointment_id,
          callerUid: teacherId,
          appointmentTeacherId: appointment.teacher_id,
          appointmentParentId: appointment.parent_id
        })
        return error('无权查看')
      }

      const { startTs, endTs, ok } = resolveSchedule(appointment)
      const now = Date.now()
      const parentPaid = await resolveParentPaid(db, appointment)
      const canClockIn = parentPaid &&
        !appointment.class_started_at &&
        canClockInByStatus(appointment.status)
      const canClockOut = parentPaid &&
        !!appointment.class_started_at &&
        !appointment.class_ended_at
      console.log('[appointment-attendance.getStatus] 查询打卡状态:', {
        appointment_id,
        callerUid: teacherId,
        appointmentTeacherId: appointment.teacher_id,
        appointmentParentId: appointment.parent_id,
        status: appointment.status,
        parent_paid: parentPaid,
        class_started_at: appointment.class_started_at || null,
        class_ended_at: appointment.class_ended_at || null,
        can_clock_in: canClockIn,
        can_clock_out: canClockOut
      })
      return success({
        status: appointment.status,
        parent_paid: parentPaid,
        class_started_at: appointment.class_started_at || null,
        class_started_location: appointment.class_started_location || null,
        class_ended_at: appointment.class_ended_at || null,
        class_ended_location: appointment.class_ended_location || null,
        can_clock_in: canClockIn,
        can_clock_out: canClockOut,
        schedule: ok ? {
          start_ts: startTs,
          end_ts: endTs,
          server_now: now
        } : { start_ts: null, end_ts: null, server_now: now }
      })
    } catch (e) {
      console.error('[appointment-attendance.getStatus]', e)
      return error('查询打卡状态失败：' + (e && e.message || e))
    }
  }
}
