/**
 * 预约查询云对象
 * 功能：查询教师的待确认预约
 * 使用 uni-id-common 进行 token 验证
 */

const uniID = require('uni-id-common')
const {
  resolveAppointmentAttendance,
  applyNormalizedAttendance,
  normalizeTimestamp
} = require('./appointment-attendance-resolver.js')

// 工具函数（内嵌）
function success(data = null, message = 'success') {
  return {
    code: 0,
    message,
    data,
    timestamp: Date.now()
  }
}

function error(message = 'error', code = -1, data = null) {
  return {
    code,
    message,
    data,
    timestamp: Date.now()
  }
}

async function resolveUserIdFromCtx(ctx) {
  const token = ctx.getUniIdToken && ctx.getUniIdToken()
  if (!token) return null
  if (ctx.uniID && typeof ctx.uniID.checkToken === 'function') {
    try {
      const payload = await ctx.uniID.checkToken(token)
      if (payload && !payload.code && payload.uid) {
        return payload.uid
      }
    } catch (e) {
      // 回落 base64 兜底
    }
  }
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split('_')
    return parts.length >= 1 && parts[0] ? parts[0] : null
  } catch (e) {
    return null
  }
}

async function enrichAppointmentDetail(db, appointment) {
  try {
    const reviewDoc = await db.collection('reviews')
      .where({ appointment_id: appointment._id })
      .field({ _id: true })
      .limit(1)
      .get()
    appointment.has_review = !!(reviewDoc.data && reviewDoc.data.length > 0)
  } catch (e) {
    console.warn('[appointment-query] enrich has_review failed:', e)
    appointment.has_review = !!appointment.has_review
  }

  await resolveAppointmentAttendance(db, appointment, { persistHeal: true })
  return appointment
}

module.exports = {
  _before: function() {
    // 云对象前置方法，初始化 uni-id 实例
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
  },
  
  /**
   * 查询教师的待确认预约（使用 token 验证）
   * @returns {Object}
   */
  async getPendingAppointments() {
    try {
      const db = uniCloud.database()
      
      // 获取 token 并验证
      const token = this.getUniIdToken()
      let teacher_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 验证 token（支持标准 token 和简单 token）
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // 尝试解析简单 token
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } else {
          teacher_id = payload.uid
        }
      } catch (checkError) {
        // 尝试解析简单 token
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        teacher_id = parts.length >= 1 ? parts[0] : null
      }
      
      if (!teacher_id) {
        return error('token验证失败，请重新登录')
      }
      
      // 查询教师的预约（待确认或已确认）
      const appointmentDoc = await db.collection('appointments')
        .where({
          teacher_id: teacher_id,
          status: db.command.in(['pending_confirm', 'confirmed'])
        })
        .orderBy('create_time', 'desc')
        .get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('没有找到待确认的预约')
      }
      
      return success({
        appointments: appointmentDoc.data,
        latestAppointment: appointmentDoc.data[0]
      }, '查询成功')
      
    } catch (e) {
      console.error('查询预约失败:', e)
      return error(e.message || '查询失败')
    }
  },
  
  /**
   * 查询教师可聊天的预约（用于聊天功能，使用 token 验证）
   * @returns {Object}
   */
  async getChatableAppointments() {
    try {
      const db = uniCloud.database()
      
      // 获取 token 并验证
      const token = this.getUniIdToken()
      let teacher_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 验证 token（支持标准 token 和简单 token）
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // 尝试解析简单 token
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } else {
          teacher_id = payload.uid
        }
      } catch (checkError) {
        // 尝试解析简单 token
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        teacher_id = parts.length >= 1 ? parts[0] : null
      }
      
      if (!teacher_id) {
        return error('token验证失败，请重新登录')
      }
      
      console.log('查询教师可聊天预约，teacher_id:', teacher_id)
      
      // 查询已确认的预约（可以聊天的预约）
      const appointmentDoc = await db.collection('appointments')
        .where({
          teacher_id: teacher_id,
          status: 'confirmed',  // 只查询已确认的预约
          deposit_paid: true    // 确保信息费已支付
        })
        .orderBy('create_time', 'desc')
        .get()
      
      console.log('可聊天预约查询结果:', appointmentDoc.data)
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('没有找到可聊天的预约，请确保已支付信息费')
      }
      
      return success({
        appointments: appointmentDoc.data,
        latestAppointment: appointmentDoc.data[0]
      }, '查询成功')
      
    } catch (e) {
      console.error('查询可聊天预约失败:', e)
      return error(e.message || '查询失败')
    }
  },
  
  /**
   * 获取预约详情
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @returns {Object}
   */
  async getAppointmentDetail(params) {
    const { appointment_id } = params
    
    try {
      const db = uniCloud.database()
      
      if (!appointment_id) {
        return error('预约ID不能为空')
      }
      
      const appointmentDoc = await db.collection('appointments')
        .doc(appointment_id)
        .get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      await enrichAppointmentDetail(db, appointment)
      
      // 关联教师信息，保证详情页展示的教师数据与实际老师一致
      if (appointment.teacher_id) {
        try {
          const teacherRes = await db.collection('teacher-profiles')
            .where({ teacher_id: appointment.teacher_id })
            .field({
              teacher_id: true,
              display_name: true,
              avatar: true,
              hourly_rate: true,
              subjects: true
            })
            .limit(1)
            .get()
          
          if (teacherRes.data && teacherRes.data.length > 0) {
            const t = teacherRes.data[0]
            const appointmentHourlyRate = Number(
              appointment.trial_invite_hourly_rate || appointment.hourly_rate || 0
            )
            const displayHourlyRate = (appointment.course_type === 'trial' && appointmentHourlyRate > 0)
              ? appointmentHourlyRate
              : (t.hourly_rate || 0)
            appointment.teacher_info = {
              name: t.display_name || '教师',
              display_name: t.display_name || '教师',
              avatar: t.avatar || '',
              hourly_rate: displayHourlyRate,
              subjects: t.subjects || []
            }
          }
        } catch (e) {
          console.error('[appointment-query] 关联教师信息失败:', e)
          // 关联失败不影响预约主体信息返回
        }
      }
      
      console.log('[appointment-query.getAppointmentDetail] 返回预约详情:', {
        appointment_id,
        returnedAppointmentId: appointment._id,
        confirm_appointment_id: appointment.confirm_appointment_id || appointment._id,
        attendance_source_appointment_id: appointment.attendance_source_appointment_id || null,
        teacher_id: appointment.teacher_id,
        parent_id: appointment.parent_id,
        status: appointment.status,
        parent_paid: appointment.parent_paid,
        has_review: appointment.has_review,
        class_started_at: appointment.class_started_at || null,
        class_ended_at: appointment.class_ended_at || null,
        conversation_id: appointment.conversation_id || null
      })
      
      return success(appointment, '获取成功')
      
    } catch (e) {
      console.error('获取预约详情失败:', e)
      return error(e.message || '获取失败')
    }
  },

  /**
   * 查询预约打卡状态（家长/教师均可调用）
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   */
  async getAttendanceStatus(params = {}) {
    const { appointment_id } = params

    try {
      const db = uniCloud.database()
      if (!appointment_id) {
        return error('缺少预约ID')
      }

      const userId = await resolveUserIdFromCtx(this)
      if (!userId) {
        return error('未获取到token，请先登录')
      }

      const doc = await db.collection('appointments').doc(appointment_id).get()
      if (!doc.data || doc.data.length === 0) {
        return error('预约不存在')
      }

      const appointment = doc.data[0]
      if (appointment.teacher_id !== userId && appointment.parent_id !== userId) {
        return error('无权查看')
      }

      applyNormalizedAttendance(appointment)
      await resolveAppointmentAttendance(db, appointment, { persistHeal: true })

      return success({
        status: appointment.status,
        parent_paid: !!appointment.parent_paid,
        parent_paid_from_order: !!appointment.parent_paid_from_order,
        class_started_at: appointment.class_started_at || null,
        class_started_location: appointment.class_started_location || null,
        class_ended_at: appointment.class_ended_at || null,
        class_ended_location: appointment.class_ended_location || null,
        attendance_source_appointment_id: appointment.attendance_source_appointment_id || null
      })
    } catch (e) {
      console.error('[appointment-query.getAttendanceStatus]', e)
      return error(e.message || '查询打卡状态失败')
    }
  },
  
  /**
   * 获取家长的预约列表（使用 token 验证，支持分页）
   * @param {Object} params
   * @param {String} params.status 状态筛选：'all' | 'pending_payment' | 'pending_confirm' | 'confirmed' | 'completed' | 'cancelled' | 'trial_invited'
   * @param {Number} params.page 页码（从1开始）
   * @param {Number} params.pageSize 每页数量
   * @returns {Object}
   */
  async getParentAppointments(params) {
    const { status = 'all', page = 1, pageSize = 20 } = params
    
    try {
      const db = uniCloud.database()
      const dbCmd = db.command
      
      // 获取 token 并验证
      const token = this.getUniIdToken()
      let parent_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 验证 token（支持标准 token 和简单 token）
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // 尝试解析简单 token
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          parent_id = parts.length >= 1 ? parts[0] : null
        } else {
          parent_id = payload.uid
        }
      } catch (checkError) {
        // 尝试解析简单 token
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        parent_id = parts.length >= 1 ? parts[0] : null
      }
      
      if (!parent_id) {
        return error('token验证失败，请重新登录')
      }
      
      // 验证用户角色
      const userDoc = await db.collection('uni-id-users').doc(parent_id).get()
      if (!userDoc.data || userDoc.data.length === 0) {
        return error('用户不存在')
      }
      
      if (userDoc.data[0].role !== 'parent') {
        return error('只有家长可以查看预约列表')
      }
      
      // 构建查询条件（pending_payment 需整体替换为 and/or 组合，故用 let）
      let where = {
        parent_id: parent_id
      }
      
      // 状态筛选（支持单个状态或状态数组）
      if (status !== 'all' && status !== undefined) {
        if (status === 'pending_payment') {
          // 待支付：包含 pending_payment，以及老师发起试课中家长尚未支付的情况
          where = dbCmd.and([
            { parent_id: parent_id },
            dbCmd.or([
              { parent_paid: false },
              { parent_paid: dbCmd.exists(false) }
            ]),
            dbCmd.or([
              { status: 'pending_payment' },
              {
                status: dbCmd.in(['pending_confirm', 'confirmed']),
                course_type: 'trial',
                invited_by: 'teacher'
              }
            ])
          ])
        } else if (Array.isArray(status)) {
          where.status = dbCmd.in(status)
        } else {
          where.status = status
        }
      }
      
      // 查询预约列表（支持分页）
      const skip = Math.max((page - 1) * pageSize, 0)
      const appointmentDoc = await db.collection('appointments')
        .where(where)
        .orderBy('create_time', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      
      // 查询总数
      const countRes = await db.collection('appointments')
        .where(where)
        .count()
      
      const appointments = appointmentDoc.data || []
      const total = countRes.total || 0
      const hasMore = skip + appointments.length < total
      
      // 关联教师信息
      if (appointments.length > 0) {
        const teacherIds = [...new Set(appointments.map(item => item.teacher_id).filter(Boolean))]
        
        if (teacherIds.length > 0) {
          const teachersDoc = await db.collection('teacher-profiles')
            .where({
              teacher_id: dbCmd.in(teacherIds)
            })
            .field({
              teacher_id: true,
              display_name: true,
              avatar: true,
              hourly_rate: true,
              subjects: true
            })
            .get()
          
          const teacherMap = {}
          if (teachersDoc.data && teachersDoc.data.length > 0) {
            teachersDoc.data.forEach(t => {
              teacherMap[t.teacher_id] = {
                name: t.display_name,
                avatar: t.avatar,
                hourly_rate: t.hourly_rate,
                subjects: t.subjects || []
              }
            })
          }
          
          // 格式化预约数据，添加教师信息
          appointments.forEach(item => {
            item.teacher_info = teacherMap[item.teacher_id] || { 
              name: '教师', 
              avatar: '', 
              hourly_rate: 0,
              subjects: []
            }
          })
        }
      }
      
      return success({
        list: appointments,
        total: total,
        pagination: {
          page: page,
          pageSize: pageSize,
          total: total,
          hasMore: hasMore
        }
      }, '查询成功')
      
    } catch (e) {
      console.error('查询家长预约列表失败:', e)
      return error(e.message || '查询失败')
    }
  },

  /**
   * 获取家长个人中心概览数据
   * @returns {Object}
   */
  async getParentOverview() {
    try {
      const db = uniCloud.database()
      const dbCmd = db.command
      const $ = dbCmd.aggregate

      const token = this.getUniIdToken()
      let parent_id

      if (!token) {
        return error('未获取到token，请先登录')
      }

      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          parent_id = parts.length >= 1 ? parts[0] : null
        } else {
          parent_id = payload.uid
        }
      } catch (checkError) {
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        parent_id = parts.length >= 1 ? parts[0] : null
      }

      if (!parent_id) {
        return error('token验证失败，请重新登录')
      }

      const userDoc = await db.collection('uni-id-users').doc(parent_id).field({ role: true }).get()
      if (!userDoc.data || userDoc.data.length === 0) {
        return error('用户不存在')
      }
      if (userDoc.data[0].role !== 'parent') {
        return error('只有家长可以查看概览信息')
      }

      let appointmentStats = {
        total: 0,
        pending_payment: 0,
        pending_confirm: 0,
        confirmed: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0
      }

      try {
        const statsRes = await db.collection('appointments')
          .aggregate()
          .match({ parent_id })
          .group({
            _id: '$status',
            count: $.sum(1)
          })
          .end()

        if (Array.isArray(statsRes.data)) {
          statsRes.data.forEach(item => {
            const statusKey = item._id || 'unknown'
            if (Object.prototype.hasOwnProperty.call(appointmentStats, statusKey)) {
              appointmentStats[statusKey] = item.count
            }
            appointmentStats.total += item.count || 0
          })
        }
      } catch (aggError) {
        console.error('[appointment-query] 聚合预约统计失败，使用回退方案', aggError)
        const statuses = Object.keys(appointmentStats).filter(key => key !== 'total')
        const countPromises = statuses.map(async statusKey => {
          const res = await db.collection('appointments')
            .where({ parent_id, status: statusKey })
            .count()
          appointmentStats[statusKey] = res.total || 0
          appointmentStats.total += res.total || 0
        })
        await Promise.all(countPromises)
      }

      const [pendingOrderRes, refundProcessingRes] = await Promise.all([
        db.collection('payment-orders')
          .where({
            payer_id: parent_id,
            status: dbCmd.in(['pending'])
          })
          .count(),
        db.collection('payment-refunds')
          .where({
            payer_id: parent_id,
            status: dbCmd.in(['pending', 'processing'])
          })
          .count()
      ])

      const conversationRes = await db.collection('chat-conversations')
        .where({
          parent_id,
          parent_deleted: dbCmd.neq(true)
        })
        .field({
          unread_count_parent: true
        })
        .get()

      let unreadMessages = 0
      if (conversationRes.data && conversationRes.data.length > 0) {
        unreadMessages = conversationRes.data.reduce((sum, item) => {
          return sum + (item.unread_count_parent || 0)
        }, 0)
      }

      let nextAppointment = null
      const upcomingRes = await db.collection('appointments')
        .where({
          parent_id,
          status: dbCmd.in(['pending_confirm', 'confirmed', 'in_progress'])
        })
        .orderBy('start_time', 'asc')
        .limit(1)
        .get()

      if (upcomingRes.data && upcomingRes.data.length > 0) {
        nextAppointment = upcomingRes.data[0]
        if (nextAppointment.teacher_id) {
          const teacherRes = await db.collection('teacher-profiles')
            .where({ teacher_id: nextAppointment.teacher_id })
            .field({
              teacher_id: true,
              display_name: true,
              avatar: true,
              title: true,
              subjects: true
            })
            .limit(1)
            .get()
          if (teacherRes.data && teacherRes.data.length > 0) {
            nextAppointment.teacher_info = {
              display_name: teacherRes.data[0].display_name || '老师',
              avatar: teacherRes.data[0].avatar || '/static/default-avatar.png',
              title: teacherRes.data[0].title || '',
              subjects: teacherRes.data[0].subjects || []
            }
          }
        }
      }

      return success({
        appointmentStats,
        orderStats: {
          pending_payment: pendingOrderRes.total || 0,
          refund_processing: refundProcessingRes.total || 0
        },
        unreadMessages,
        nextAppointment
      }, '获取成功')
    } catch (e) {
      console.error('获取家长概览失败:', e)
      return error(e.message || '获取家长概览失败')
    }
  },

  /**
   * 家长确认课程完成
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {Boolean} [params.is_satisfied] 仅试课用：true=确认成功（默认），false=确认不满意（走 confirmTrialFail，
   *   信息费退教师，不退家长任何钱；如需异常退款请走 payment-refund.apply）
   * @param {String} [params.fail_reason] 试课不满意原因（is_satisfied=false 时使用）
   */
  async confirmCompletion(params = {}) {
    const { appointment_id, is_satisfied = true, fail_reason = '' } = params
    
    try {
      const db = uniCloud.database()
      const dbCmd = db.command
      
      if (!appointment_id) {
        return error('预约ID不能为空')
      }
      
      const token = this.getUniIdToken()
      let parent_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          parent_id = parts.length >= 1 ? parts[0] : null
        } else {
          parent_id = payload.uid
        }
      } catch (checkError) {
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        parent_id = parts.length >= 1 ? parts[0] : null
      }
      
      if (!parent_id) {
        return error('token验证失败，请重新登录')
      }
      
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      if (appointment.parent_id !== parent_id) {
        return error('无权操作该预约')
      }

      await resolveAppointmentAttendance(db, appointment, { persistHeal: true })

      if (!appointment.parent_paid) {
        return error('课程费用尚未支付，无法确认完成')
      }

      if (!appointment.class_ended_at) {
        return error('教师尚未下课打卡，无法确认结果，请稍后再试')
      }
      
      // 允许 confirmed / in_progress；对于已支付但仍处于 pending_confirm 的情况，前端已放开按钮，这里也一并允许，具体业务安全由后续结算逻辑控制
      if (!['pending_confirm', 'confirmed', 'in_progress'].includes(appointment.status)) {
        console.warn('[confirmCompletion] 当前预约状态不可确认完成:', {
          appointment_id,
          status: appointment.status,
          parent_paid: appointment.parent_paid
        })
        return error('当前预约状态不可确认完成')
      }
      
      console.log('[confirmCompletion] 开始处理课程完成:', {
        appointment_id,
        course_type: appointment.course_type,
        status: appointment.status,
        total_amount: appointment.total_amount,
        teacher_id: appointment.teacher_id,
        parent_id: appointment.parent_id,
        class_ended_at: appointment.class_ended_at || null
      })
      
      // 根据课程类型 + is_satisfied 调用不同的结算逻辑：
      // - 正式课程：completeCourse
      // - 试课课程：is_satisfied=true → confirmTrialSuccess；false → confirmTrialFail
      const appointmentComplete = uniCloud.importObject('appointment-complete', { customUI: true })
      let completeResult
      if (appointment.course_type === 'trial') {
        if (is_satisfied === false) {
          console.log('[confirmCompletion] 试课不满意，调用 confirmTrialFail')
          completeResult = await appointmentComplete.confirmTrialFail({ appointment_id, reason: fail_reason })
        } else {
          console.log('[confirmCompletion] 试课成功，调用 confirmTrialSuccess')
          completeResult = await appointmentComplete.confirmTrialSuccess({ appointment_id })
        }
      } else {
        console.log('[confirmCompletion] 正式课程，调用 completeCourse')
        completeResult = await appointmentComplete.completeCourse({ appointment_id })
      }
      
      console.log('[confirmCompletion] 结算返回结果:', {
        appointment_id,
        course_type: appointment.course_type,
        result_code: completeResult && completeResult.code,
        result_message: completeResult && completeResult.message,
        result_data: completeResult && completeResult.data
      })
      
      if (!completeResult || completeResult.code !== 0) {
        console.error('[confirmCompletion] 结算失败:', completeResult)
        return error((completeResult && completeResult.message) || '确认完成失败')
      }
      
      const now = Date.now()
      
      // 更新订单状态
      const orderUpdateRes = await db.collection('payment-orders')
        .where({
          appointment_id,
          order_type: 'course_fee'
        })
        .update({
          status: 'success',
          finish_time: now,
          update_time: now
        })
      
      console.log('[confirmCompletion] 更新课程费订单状态结果:', {
        appointment_id,
        modified: orderUpdateRes && orderUpdateRes.updated
      })
      
      // 更新会话状态
      const convUpdateRes = await db.collection('chat-conversations')
        .where({ appointment_id })
        .update({
          status: 'completed',
          update_time: now
        })
      
      console.log('[confirmCompletion] 更新聊天会话状态结果:', {
        appointment_id,
        modified: convUpdateRes && convUpdateRes.updated
      })
      
      const responseData = {
        appointment_id,
        status: 'completed',
        complete_time: now
      }
      
      console.log('[confirmCompletion] 课程完成流程结束:', responseData)
      
      return success(responseData, '课程已确认完成，教师收入已结算')
      
    } catch (e) {
      console.error('确认课程完成失败:', e)
      return error(e.message || '确认失败')
    }
  },
  
  /**
   * 获取教师的预约列表（支持按状态筛选，使用 token 验证）
   * @param {Object} params
   * @param {String} params.status 状态筛选：'all' | 'pending_confirm' | 'confirmed' | 'completed' | 'rejected'
   * @returns {Object}
   */
  async getTeacherAppointments(params) {
    const { status = 'all', page = 1, pageSize = 20 } = params
    
    try {
      const db = uniCloud.database()
      const dbCmd = db.command
      
      // 获取 token 并验证
      const token = this.getUniIdToken()
      let teacher_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 验证 token（支持标准 token 和简单 token）
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // 尝试解析简单 token
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } else {
          teacher_id = payload.uid
        }
      } catch (checkError) {
        // 尝试解析简单 token
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        teacher_id = parts.length >= 1 ? parts[0] : null
      }
      
      if (!teacher_id) {
        return error('token验证失败，请重新登录')
      }
      
      // 构建查询条件
      const where = {
        teacher_id: teacher_id
      }
      
      // 状态筛选（支持单个状态或状态数组）
      if (status !== 'all' && status !== undefined) {
        if (Array.isArray(status)) {
          // 如果是数组，使用 in 查询
          where.status = dbCmd.in(status)
          console.log('[appointment-query] 查询状态数组:', JSON.stringify(status))
        } else {
          // 如果是单个状态，直接赋值
          where.status = status
          console.log('[appointment-query] 查询单个状态:', status)
        }
      } else {
        console.log('[appointment-query] 查询所有状态')
      }
      
      console.log('[appointment-query] 查询条件 teacher_id:', where.teacher_id)
      console.log('[appointment-query] 查询条件 status:', Array.isArray(status) ? JSON.stringify(status) : status)
      
      // 查询预约列表（支持分页）
      const skip = (page - 1) * pageSize
      const appointmentDoc = await db.collection('appointments')
        .where(where)
        .orderBy('create_time', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      
      // 查询总数
      const countRes = await db.collection('appointments')
        .where(where)
        .count()
      
      console.log('[appointment-query] 查询结果数量:', appointmentDoc.data?.length || 0)
      console.log('[appointment-query] 总记录数:', countRes.total || 0)
      if (appointmentDoc.data && appointmentDoc.data.length > 0) {
        console.log('[appointment-query] 查询结果状态分布:', appointmentDoc.data.map(item => item.status))
      }
      
      const appointments = appointmentDoc.data || []
      
      // 关联家长信息
      if (appointments.length > 0) {
        const parentIds = [...new Set(appointments.map(item => item.parent_id).filter(Boolean))]
        
        if (parentIds.length > 0) {
          const parentsDoc = await db.collection('uni-id-users')
            .where({
              _id: dbCmd.in(parentIds)
            })
            .field({
              _id: true,
              nickname: true,
              avatar: true,
              wx_nickname: true,
              wx_avatarUrl: true
            })
            .get()
          
          const parentMap = {}
          if (parentsDoc.data && parentsDoc.data.length > 0) {
            parentsDoc.data.forEach(p => {
              parentMap[p._id] = {
                nickname: p.nickname || p.wx_nickname || '家长',
                avatar: p.avatar || p.wx_avatarUrl || ''
              }
            })
          }
          
          // 格式化预约数据，添加家长信息
          appointments.forEach(item => {
            item.parent_info = parentMap[item.parent_id] || { nickname: '家长', avatar: '' }
            // 格式化日期时间显示
            if (item.appointment_date && item.start_time) {
              item.appointment_date_str = item.appointment_date
              item.appointment_time_str = item.start_time
            }
          })
        }
      }
      
      return success({
        list: appointments,
        pagination: {
          page: page,
          pageSize: pageSize,
          total: countRes.total || 0,
          hasMore: skip + appointments.length < (countRes.total || 0)
        }
      }, '查询成功')
      
    } catch (e) {
      console.error('查询教师预约列表失败:', e)
      return error(e.message || '查询失败')
    }
  },
  
  /**
   * 教师端：检查与指定家长是否已有试课成功记录
   * @param {Object} params
   * @param {String} params.parent_id 家长ID
   * @returns {Object}
   */
  async checkTrialStatusForParent(params = {}) {
    const { parent_id } = params
    
    try {
      const db = uniCloud.database()
      const dbCmd = db.command
      
      if (!parent_id) {
        return error('家长ID不能为空')
      }
      
      // 获取 token 并验证（当前登录用户必须是教师）
      const token = this.getUniIdToken()
      let teacher_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } else {
          teacher_id = payload.uid
        }
      } catch (checkError) {
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        teacher_id = parts.length >= 1 ? parts[0] : null
      }
      
      if (!teacher_id) {
        return error('token验证失败，请重新登录')
      }
      
      // 查询该老师与该家长之间的所有试课预约
      const trialDoc = await db.collection('appointments')
        .where({
          teacher_id,
          parent_id,
          course_type: 'trial'
        })
        .orderBy('create_time', 'desc')
        .get()
      
      const trials = trialDoc.data || []
      
      // 允许视为“试课成功”的条件：
      // - status = 'completed'
      // - trial_result 为 'success'，或者 trial_result 为空（兼容旧数据）
      const hasTrialSuccess = trials.some(apt => {
        const isCompleted = apt.status === 'completed'
        const isSuccessResult = !apt.trial_result || apt.trial_result === 'success'
        return isCompleted && isSuccessResult
      })

      const activeStatuses = ['trial_invited', 'pending_payment', 'pending_confirm', 'confirmed', 'in_progress']
      const hasActiveTrial = trials.some(apt => activeStatuses.includes(apt.status))
      
      const lastTrial = trials.length > 0 ? trials[0] : null
      
      return success({
        hasTrialSuccess,
        hasActiveTrial,
        trialCount: trials.length,
        lastTrialStatus: lastTrial ? {
          id: lastTrial._id,
          status: lastTrial.status,
          trial_result: lastTrial.trial_result
        } : null
      }, '查询成功')
      
    } catch (e) {
      console.error('[appointment-query] 检查试课状态失败:', e)
      return error(e.message || '查询试课状态失败')
    }
  },

  /**
   * 家长待确认试课结果列表（已下课打卡、尚未确认 success/fail）
   * @returns {Object} { list: [{ _id, teacher_name, ... }] }
   */
  async listPendingTrialConfirmations() {
    try {
      const db = uniCloud.database()
      const dbCmd = db.command

      const token = this.getUniIdToken()
      let parent_id
      if (!token) {
        return error('未获取到token，请先登录')
      }
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          parent_id = decoded.split('_')[0] || null
        } else {
          parent_id = payload.uid
        }
      } catch (checkError) {
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        parent_id = decoded.split('_')[0] || null
      }
      if (!parent_id) {
        return error('token验证失败，请重新登录')
      }

      const userDoc = await db.collection('uni-id-users').doc(parent_id).field({ role: true }).get()
      if (!userDoc.data || userDoc.data.length === 0 || userDoc.data[0].role !== 'parent') {
        return success({ list: [] }, '非家长角色')
      }

      const aptDoc = await db.collection('appointments')
        .where({
          parent_id,
          course_type: 'trial',
          parent_paid: true,
          status: dbCmd.in(['pending_confirm', 'confirmed', 'in_progress']),
          class_ended_at: dbCmd.gt(0),
          trial_result: dbCmd.in([null, ''])
        })
        .orderBy('class_ended_at', 'desc')
        .limit(10)
        .get()

      let rows = aptDoc.data || []

      // 旧数据兼容：已支付但打卡写在兄弟预约上的记录，尝试自愈后再纳入提醒列表
      if (rows.length < 10) {
        const pendingDoc = await db.collection('appointments')
          .where({
            parent_id,
            course_type: 'trial',
            status: dbCmd.in(['pending_confirm', 'confirmed', 'in_progress']),
            trial_result: dbCmd.in([null, ''])
          })
          .orderBy('update_time', 'desc')
          .limit(20)
          .get()
        const existingIds = new Set(rows.map(item => item._id))
        for (const item of (pendingDoc.data || [])) {
          if (existingIds.has(item._id)) continue
          if (!item.parent_paid) continue
          if (normalizeTimestamp(item.class_ended_at)) continue
          await resolveAppointmentAttendance(db, item, { persistHeal: true })
          if (!item.parent_paid || !normalizeTimestamp(item.class_ended_at)) continue
          rows.push(item)
          existingIds.add(item._id)
          if (rows.length >= 10) break
        }
        rows.sort((a, b) => (normalizeTimestamp(b.class_ended_at) || 0) - (normalizeTimestamp(a.class_ended_at) || 0))
      }

      if (!rows.length) {
        return success({ list: [] })
      }

      const teacherIds = [...new Set(rows.map(r => r.teacher_id).filter(Boolean))]
      const teacherNameMap = {}
      if (teacherIds.length) {
        const profileDoc = await db.collection('teacher-profiles')
          .where({ teacher_id: dbCmd.in(teacherIds) })
          .field({ teacher_id: true, display_name: true })
          .get()
        ;(profileDoc.data || []).forEach(p => {
          teacherNameMap[p.teacher_id] = p.display_name || ''
        })
      }

      const list = rows.map(row => ({
        _id: row._id,
        appointment_no: row.appointment_no,
        teacher_id: row.teacher_id,
        teacher_name: teacherNameMap[row.teacher_id] || '老师',
        class_ended_at: row.class_ended_at,
        date: row.date,
        start_time: row.start_time
      }))

      return success({ list })
    } catch (e) {
      console.error('[appointment-query] listPendingTrialConfirmations failed:', e)
      return error(e.message || '查询失败')
    }
  },
  
  /**
   * 教师拒绝预约（使用 token 验证）
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {String} params.reason 拒绝原因（可选）
   * @returns {Object}
   */
  async rejectAppointment(params) {
    const { appointment_id, reason = '' } = params
    
    try {
      const db = uniCloud.database()
      
      // 获取 token 并验证
      const token = this.getUniIdToken()
      let teacher_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 验证 token（支持标准 token 和简单 token）
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // 尝试解析简单 token
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } else {
          teacher_id = payload.uid
        }
      } catch (checkError) {
        // 尝试解析简单 token
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        teacher_id = parts.length >= 1 ? parts[0] : null
      }
      
      if (!teacher_id) {
        return error('token验证失败，请重新登录')
      }
      
      if (!appointment_id) {
        return error('预约ID不能为空')
      }
      
      // 查询预约
      const appointmentDoc = await db.collection('appointments')
        .doc(appointment_id)
        .get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 验证权限
      if (appointment.teacher_id !== teacher_id) {
        return error('只能操作自己的预约')
      }
      
      if (appointment.status !== 'pending_confirm') {
        return error('当前预约状态不允许拒绝')
      }
      
      // 更新预约状态为已拒绝
      await db.collection('appointments').doc(appointment_id).update({
        status: 'rejected',
        reject_reason: reason,
        reject_time: Date.now(),
        update_time: Date.now()
      })
      
      // 创建退款订单（简化版，实际应该调用退款接口）
      const refundOrder = {
        order_no: 'RFD' + Date.now() + Math.floor(Math.random() * 10000),
        appointment_id,
        payer_id: 'platform',
        payee_id: appointment.parent_id,
        order_type: 'refund',
        total_amount: appointment.total_amount || 0,
        status: 'paid',
        payment_time: Date.now(),
        create_time: Date.now(),
        update_time: Date.now()
      }
      
      await db.collection('payment-orders').add(refundOrder)
      
      console.log('预约已拒绝，费用已退款')
      
      return success({
        appointment_id,
        status: 'rejected',
        refund_amount: appointment.total_amount || 0
      }, '预约已拒绝，费用已全额退还给家长')
      
    } catch (e) {
      console.error('拒绝预约失败:', e)
      return error(e.message || '拒绝预约失败')
    }
  },
  
  /**
   * 教师确认预约
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @returns {Object}
   */
  async confirmAppointment(params = {}) {
    const { appointment_id } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 验证用户登录状态（使用 this.uniID，已在 _before 中初始化）
      const token = this.getUniIdToken()
      let teacher_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 验证 token（支持标准 token 和简单 token）
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // 尝试解析简单 token
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } else {
          teacher_id = payload.uid
        }
      } catch (checkError) {
        // 尝试解析简单 token
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        teacher_id = parts.length >= 1 ? parts[0] : null
      }
      
      if (!teacher_id) {
        console.warn('[appointment-query][confirmAppointment] token解析失败，无法获取teacher_id')
        return error('token验证失败，请重新登录')
      }
      
      console.log('[appointment-query][confirmAppointment] 入参与教师信息:', {
        appointment_id,
        teacher_id
      })
      
      // 2. 查询预约
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        console.warn('[appointment-query][confirmAppointment] 预约不存在:', { appointment_id })
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]

      if (appointment.course_type === 'trial' && appointment.invited_by === 'teacher') {
        return error('试课预约无需教师确认，请等待家长支付试课费用')
      }
      
      console.log('[appointment-query][confirmAppointment] 读取到预约信息:', {
        appointment_id,
        teacher_id: appointment.teacher_id,
        parent_id: appointment.parent_id,
        status: appointment.status,
        deposit_paid: appointment.deposit_paid,
        parent_paid: appointment.parent_paid
      })
      
      // 3. 验证权限和状态
      if (appointment.teacher_id !== teacher_id) {
        console.warn('[appointment-query][confirmAppointment] 教师无权操作该预约:', {
          appointment_id,
          appointment_teacher_id: appointment.teacher_id,
          current_teacher_id: teacher_id
        })
        return error('只能操作自己的预约')
      }
      
      // 支持 pending_confirm 和 pending_payment 两种状态（兼容老数据）
      if (!['pending_confirm', 'pending_payment'].includes(appointment.status)) {
        console.warn('[appointment-query][confirmAppointment] 当前预约状态不允许确认:', {
          appointment_id,
          status: appointment.status
        })
        return error('当前预约状态不允许确认')
      }
      
      // 检查信息费支付状态
      // 业务规则：同一“家长 + 老师”只需支付一次信息费，因此这里既要看当前预约，也要看该家长与老师历史记录。
      let depositPaid = !!appointment.deposit_paid
      
      // 3.1 如果预约中没有标记为已支付，先检查当前预约绑定会话中的 teacher_deposit_paid 状态
      if (!depositPaid) {
        const conversationDoc = await db.collection('chat-conversations')
          .where({ appointment_id: appointment_id })
          .limit(1)
          .get()
        
        if (conversationDoc.data && conversationDoc.data.length > 0) {
          depositPaid = !!conversationDoc.data[0].teacher_deposit_paid
        }
      }
      
      // 3.2 如果当前预约未标记为已支付，再按“家长 + 老师”维度检查任意会话是否已支付信息费
      if (!depositPaid) {
        const pairConvDoc = await db.collection('chat-conversations')
          .where({
            parent_id: appointment.parent_id,
            teacher_id: appointment.teacher_id,
            teacher_deposit_paid: true
          })
          .limit(1)
          .get()
        
        if (pairConvDoc.data && pairConvDoc.data.length > 0) {
          depositPaid = true
        }
      }
      
      // 3.3 如果会话中也没有，检查是否有已支付的信息费订单
      //      先看当前预约的信息费订单，如果没有，再看该老师为该家长其它预约支付的信息费订单
      if (!depositPaid) {
        const dbCmd = db.command
        
        // 当前预约的信息费订单
        const currentDepositOrderDoc = await db.collection('payment-orders')
          .where({
            appointment_id: appointment_id,
            order_type: 'deposit',
            payer_id: teacher_id,
            status: dbCmd.in(['paid', 'success'])
          })
          .limit(1)
          .get()
        
        if (currentDepositOrderDoc.data && currentDepositOrderDoc.data.length > 0) {
          depositPaid = true
        } else {
          // 查找该老师已支付的所有信息费订单，再过滤出属于当前家长的任意预约
          const existingDepositOrders = await db.collection('payment-orders')
            .where({
              order_type: 'deposit',
              payer_id: teacher_id,
              status: dbCmd.in(['paid', 'success'])
            })
            .get()
          
          if (existingDepositOrders.data && existingDepositOrders.data.length > 0) {
            const appointmentIds = existingDepositOrders.data
              .map(order => order.appointment_id)
              .filter(Boolean)
            
            if (appointmentIds.length > 0) {
              const relatedAppointments = await db.collection('appointments')
                .where({
                  _id: dbCmd.in(appointmentIds),
                  parent_id: appointment.parent_id
                })
                .limit(1)
                .get()
              
              if (relatedAppointments.data && relatedAppointments.data.length > 0) {
                depositPaid = true
              }
            }
          }
        }
      }
      
      if (!depositPaid) {
        console.warn('[appointment-query][confirmAppointment] 教师尚未为该家长支付信息费，拒绝确认:', {
          appointment_id,
          teacher_id,
          parent_id: appointment.parent_id
        })
        return error('请先支付信息费')
      }
      
      // 4. 更新预约状态为已确认（家长随后才能支付课程费）
      const now = Date.now()
      await db.collection('appointments').doc(appointment_id).update({
        status: 'confirmed',
        confirm_time: now,
        teacher_confirm_time: now,
        update_time: now
      })
      
      console.log('[appointment-query][confirmAppointment] 预约已确认:', {
        appointment_id,
        teacher_id,
        parent_id: appointment.parent_id,
        new_status: 'confirmed'
      })
      
      return success({ appointment_id, status: 'confirmed' }, '预约已确认')
      
    } catch (e) {
      console.error('确认预约失败:', e)
      return error(e.message || '确认失败')
    }
  }
}
