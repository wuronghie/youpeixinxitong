/**
 * 预约创建云对象
 * 功能：创建预约、创建联系请求、邀请试课
 * 使用 uni-id-common 进行 token 验证
 */

const uniID = require('uni-id-common')

/** 课时费下限（元/小时） */
const MIN_HOURLY_RATE = 120

// 工具函数
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

// 解析用户ID（从token中）
async function resolveUserId(context) {
  try {
    const token = context.getUniIdToken()
    if (!token) return null
    
    const payload = await context.uniID.checkToken(token)
    if (payload.code) {
      // 尝试解析简单 token
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      return parts.length >= 1 ? parts[0] : null
    }
    return payload.uid
  } catch (err) {
    // 尝试解析简单 token
    try {
      const token = context.getUniIdToken()
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      return parts.length >= 1 ? parts[0] : null
    } catch (e) {
      return null
    }
  }
}

// 生成预约号
function generateAppointmentNo() {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `APT${timestamp}${random}`
}

function hasRole(userDoc, roleName) {
  const role = userDoc && userDoc.role
  const roles = Array.isArray(role) ? role : role ? [role] : []
  return roles.includes(roleName)
}

function isParentProfileComplete(userDoc) {
  const parentInfo = (userDoc && userDoc.parent_info) || {}
  return !!(String(parentInfo.student_name || '').trim() && String(parentInfo.student_grade || '').trim())
}

function isFullTimeTeacher(profile) {
  return !!(profile && profile.school === '专职老师')
}

function isTeacherProfileComplete(profile) {
  if (!profile) return false
  const hasQualificationImage = Array.isArray(profile.qualifications) && profile.qualifications.some((item) => item && item.image)
  const gradesOk = isFullTimeTeacher(profile) || (Array.isArray(profile.grades) && profile.grades.length > 0)
  return !!(
    String(profile.display_name || '').trim() &&
    Array.isArray(profile.subjects) && profile.subjects.length > 0 &&
    gradesOk &&
    Number(profile.hourly_rate || 0) > 0 &&
    Number((profile.teaching_experience && profile.teaching_experience.years) || 0) > 0 &&
    String(profile.introduction || '').trim() &&
    hasQualificationImage
  )
}

function assertParentProfileComplete(userDoc) {
  if (!isParentProfileComplete(userDoc)) {
    throw new Error('请先完善孩子信息（学生姓名和年级）后再聊天')
  }
}

async function assertTeacherProfileComplete(db, teacher_id) {
  const profileRes = await db.collection('teacher-profiles').where({ teacher_id }).limit(1).get()
  const profile = profileRes.data && profileRes.data.length > 0 ? profileRes.data[0] : null
  if (!isTeacherProfileComplete(profile)) {
    throw new Error('请先完善教师资料后再邀请试课')
  }
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
   * 教师邀请家长试课
   * @param {Object} params
   * @param {String} params.parent_id 家长ID（从会话中获取）
   * @returns {Object}
   */
  async inviteTrial(params) {
    const { parent_id, recruitment_id, invited_via, trial_hourly_rate } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 验证用户登录状态和角色
      const teacher_id = await resolveUserId(this)
      if (!teacher_id) {
        return error('请先登录')
      }
      
      const userDoc = await db.collection('uni-id-users').doc(teacher_id).get()
      if (!userDoc.data || userDoc.data.length === 0 || !hasRole(userDoc.data[0], 'teacher')) {
        return error('只有教师可以邀请试课')
      }
      try {
        await assertTeacherProfileComplete(db, teacher_id)
      } catch (e) {
        return error(e.message || '请先完善信息')
      }
      
      if (!parent_id) {
        return error('家长ID不能为空')
      }

      const dbCmd = db.command
      const activeTrialRes = await db.collection('appointments')
        .where({
          teacher_id,
          parent_id,
          course_type: 'trial',
          status: dbCmd.in(['trial_invited', 'pending_payment', 'pending_confirm', 'confirmed', 'in_progress'])
        })
        .count()
      if (activeTrialRes.total > 0) {
        return error('当前有进行中的试课，请等待结束后再发起新邀请')
      }
      
      // 2. 检查家长是否存在
      const parentDoc = await db.collection('uni-id-users').doc(parent_id).get()
      if (!parentDoc.data || parentDoc.data.length === 0 || !hasRole(parentDoc.data[0], 'parent')) {
        return error('家长不存在')
      }
      
      // 3. 获取教师信息（计算试课费用）
      const teacherProfileDoc = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .field({ hourly_rate: true, display_name: true })
        .limit(1)
        .get()
      
      const teacherProfile = teacherProfileDoc.data && teacherProfileDoc.data.length > 0 
        ? teacherProfileDoc.data[0] 
        : {}
      
      const profileHourlyRate = Number(teacherProfile.hourly_rate || MIN_HOURLY_RATE)
      let hourlyRate = profileHourlyRate
      if (trial_hourly_rate != null && trial_hourly_rate !== '') {
        hourlyRate = Number(trial_hourly_rate)
      }
      if (!hourlyRate || hourlyRate < MIN_HOURLY_RATE) {
        return error(`试课课时费不能低于${MIN_HOURLY_RATE}元/小时`)
      }
      const trialAmount = Number((hourlyRate * 2).toFixed(2)) // 试课2小时
      
      const now = Date.now()
      
      // 4. 先查会话，判断同一对（teacher_id + parent_id）是否历史已支付过信息费
      //    业务规则：同一老师 + 同一家长只需支付一次信息费，整个会话生命周期内复用
      //    （见 payment-create.create 的 deposit 重复支付校验）
      const conversationDoc = await db.collection('chat-conversations')
        .where({
          teacher_id,
          parent_id
        })
        .limit(1)
        .get()
      
      const existingConversation = (conversationDoc.data && conversationDoc.data.length > 0)
        ? conversationDoc.data[0]
        : null
      let inheritedDepositPaid = !!(existingConversation && existingConversation.teacher_deposit_paid)
      
      // 自愈：会话上没有 teacher_deposit_paid，但 payment-orders 有该老师 + 该家长的已支付信息费订单，
      //       说明会话被历史 bug 错误重置过，这里恢复正确状态。
      if (!inheritedDepositPaid) {
        try {
          const dbCmdLocal = db.command
          const paidDepositOrders = await db.collection('payment-orders')
            .where({
              order_type: 'deposit',
              payer_id: teacher_id,
              status: dbCmdLocal.in(['paid', 'success'])
            })
            .get()
          if (paidDepositOrders.data && paidDepositOrders.data.length > 0) {
            const appointmentIds = paidDepositOrders.data
              .map(order => order.appointment_id)
              .filter(Boolean)
            if (appointmentIds.length > 0) {
              const relatedApt = await db.collection('appointments')
                .where({
                  _id: dbCmdLocal.in(appointmentIds),
                  parent_id
                })
                .limit(1)
                .get()
              if (relatedApt.data && relatedApt.data.length > 0) {
                inheritedDepositPaid = true
              }
            }
          }
        } catch (healErr) {
          console.warn('[inviteTrial] 自愈 deposit 状态失败（忽略）:', healErr)
        }
      }
      
      // 5. 创建试课邀请预约（状态为 trial_invited）
      const appointmentNo = generateAppointmentNo()
      
      const appointmentData = {
        appointment_no: appointmentNo,
        teacher_id,
        parent_id,
        course_type: 'trial',
        status: 'trial_invited', // 试课邀请状态
        hourly_rate: hourlyRate,
        trial_invite_hourly_rate: hourlyRate, // 本次邀请专用单价，不影响教师档案
        total_amount: trialAmount,
        duration: 2,
        create_time: now,
        update_time: now,
        invited_by: 'teacher', // 标记是教师发起的邀请
        invite_time: now
      }
      if (recruitment_id) appointmentData.recruitment_id = recruitment_id
      if (invited_via) appointmentData.invited_via = invited_via
      // 同一对家长+老师之前已支付过信息费 → 直接继承到新建的试课预约，
      // 否则发邀请卡片消息会被 chat-send 拦截"聊天未开启，请先支付信息费"
      if (inheritedDepositPaid) {
        appointmentData.deposit_paid = true
        appointmentData.deposit_time = now
      }
      
      const result = await db.collection('appointments').add(appointmentData)
      
      if (!result.id) {
        return error('创建试课邀请失败')
      }
      
      // 6. 维护聊天会话
      let conversationId = null
      if (existingConversation) {
        conversationId = existingConversation._id
        // 复用旧会话：仅把 appointment_id 切到新预约，
        // 注意 ❌ 不要重置 chat_enabled / teacher_deposit_paid——
        // 同一对家长+老师只需付一次信息费，重置会导致老师无法继续聊天/邀请试课
        const convUpdate = {
          appointment_id: result.id,
          update_time: now
        }
        // 自愈：如果通过订单回查确认应当已支付，但会话上为 false，这里一并修正
        if (inheritedDepositPaid && !existingConversation.teacher_deposit_paid) {
          convUpdate.teacher_deposit_paid = true
          convUpdate.chat_enabled = true
        }
        await db.collection('chat-conversations').doc(conversationId).update(convUpdate)
      } else {
        // 没有任何历史会话：新建一条，初始未支付未开聊
        const conversationResult = await db.collection('chat-conversations').add({
          teacher_id,
          parent_id,
          appointment_id: result.id,
          chat_enabled: false, // 试课邀请阶段还不能聊天
          teacher_deposit_paid: false,
          last_message: '',
          last_message_time: null,
          unread_count_parent: 0,
          unread_count_teacher: 0,
          create_time: now,
          update_time: now
        })
        conversationId = conversationResult.id
      }
      
      // 6. 发送系统消息给家长（可选，可以通过其他方式通知）
      // 注意：这里不再自动发送消息，因为邀请消息会通过前端发送邀请卡片
      // 试课邀请会在预约列表中显示，家长可以主动查看
      
      console.log('试课邀请创建成功，appointment_id:', result.id)
      
      return success({
        appointment_id: result.id,
        appointment_no: appointmentNo,
        conversation_id: conversationId,
        trial_amount: trialAmount,
        trial_hourly_rate: hourlyRate
      }, '试课邀请已发送')
      
    } catch (e) {
      console.error('邀请试课失败:', e)
      return error(e.message || '邀请试课失败')
    }
  },
  
  /**
   * 家长创建预约（支持从试课邀请创建）
   * @param {Object} params
   * @param {String} params.teacher_id 教师ID
   * @param {String} params.invite_id 试课邀请ID（可选，如果是从邀请创建）
   * @param {String} params.course_type 课程类型：'trial' 或 'regular'
   * @param {String} params.date 日期
   * @param {String} params.start_time 开始时间
   * @param {Number} params.duration 时长（小时）
   * @param {String} params.lesson_mode 授课方式：'online' 或 'offline'
   * @param {Object} params.address 地址（线下时需要）
   * @param {String} params.student_name 学生姓名
   * @param {String} params.student_grade 学生年级
   * @param {String} params.subject 科目
   * @param {String} params.requirements 备注
   * @returns {Object}
   */
  async create(params) {
    const {
      teacher_id,
      invite_id, // 试课邀请ID（可选）
      course_type,
      date,
      start_time,
      duration = 2,
      lesson_mode,
      address,
      student_name,
      student_grade,
      subject,
      requirements = ''
    } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 验证用户登录状态
      const parent_id = await resolveUserId(this)
      if (!parent_id) {
        return error('请先登录')
      }
      
      // 2. 验证用户角色（确保是家长）
      const userDoc = await db.collection('uni-id-users').doc(parent_id).get()
      if (!userDoc.data || userDoc.data.length === 0 || userDoc.data[0].role !== 'parent') {
        return error('只有家长可以创建预约')
      }
      
      // 3. 如果是从邀请创建，先查询邀请信息
      let inviteAppointment = null
      let finalTeacherId = teacher_id // 使用新的变量来存储最终的教师ID
      if (invite_id) {
        const inviteDoc = await db.collection('appointments').doc(invite_id).get()
        if (!inviteDoc.data || inviteDoc.data.length === 0) {
          return error('试课邀请不存在')
        }
        inviteAppointment = inviteDoc.data[0]
        
        // 验证邀请状态
        if (inviteAppointment.status !== 'trial_invited') {
          return error('该试课邀请已处理或已失效')
        }
        
        // 验证邀请的接收者
        if (inviteAppointment.parent_id !== parent_id) {
          return error('无权操作此试课邀请')
        }
        
        // 使用邀请中的教师ID
        if (inviteAppointment.teacher_id) {
          finalTeacherId = inviteAppointment.teacher_id
        }
      } else {
        // 4. 如果不是从邀请创建，检查是否联系过老师
        if (course_type === 'trial') {
          // 试课预约只能由老师发起邀请
          return error('试课预约只能由老师发起邀请，请先联系老师')
        } else if (course_type === 'regular') {
          // 正式课程：检查是否已经完成该老师的试课（与前端教师详情页逻辑保持一致）
          const dbCmd = db.command
          
          // 1) 查询与该老师相关的所有试课预约
          const trialListDoc = await db.collection('appointments')
            .where({
              teacher_id: finalTeacherId,
              parent_id,
              course_type: 'trial'
            })
            .get()
          
          const trials = trialListDoc.data || []
          
          // 允许视为“试课成功”的条件：
          // - status = 'completed'
          // - trial_result 为 'success'，或者 trial_result 为空（兼容旧数据）
          const hasTrialSuccess = trials.some(apt => {
            const isCompleted = apt.status === 'completed'
            const isSuccessResult = !apt.trial_result || apt.trial_result === 'success'
            return isCompleted && isSuccessResult
          })
          
          console.log('[appointment-create] 正式课程创建前试课检查:', {
            teacher_id: finalTeacherId,
            parent_id,
            trialTotal: trials.length,
            hasTrialSuccess,
            trialSummary: trials.map(apt => ({
              id: apt._id,
              status: apt.status,
              trial_result: apt.trial_result,
              course_type: apt.course_type
            }))
          })
          
          if (!hasTrialSuccess) {
            // 如果没有试课成功记录，依然允许家长先联系老师，但不能直接预约正式课
            // 这里统一返回“请先完成试课并确认成功后才能预约正式课程”
            return error('请先完成试课并确认成功后才能预约正式课程')
          }
        }
      }
      
      if (!finalTeacherId) {
        return error('教师ID不能为空')
      }
      
      if (!course_type) {
        return error('课程类型不能为空')
      }
      
      // 3. 验证必填字段
      if (!date || !start_time) {
        return error('请选择上课日期和时间')
      }
      
      if (!student_name) {
        return error('请填写学生姓名')
      }
      
      if (!subject) {
        return error('请选择科目')
      }
      
      // 4. 获取教师信息
      const teacherProfileDoc = await db.collection('teacher-profiles')
        .where({ teacher_id: finalTeacherId })
        .field({ hourly_rate: true, display_name: true })
        .limit(1)
        .get()
      
      if (!teacherProfileDoc.data || teacherProfileDoc.data.length === 0) {
        return error('教师不存在')
      }
      
      const teacherProfile = teacherProfileDoc.data[0]
      const profileHourlyRate = Number(teacherProfile.hourly_rate || 100)
      // 试课邀请已约定单价：家长填写信息时保留邀请价，不用教师档案价覆盖
      let hourlyRate = profileHourlyRate
      let totalAmount = Number((hourlyRate * duration).toFixed(2))
      if (invite_id && inviteAppointment) {
        const inviteHourlyRate = Number(
          inviteAppointment.trial_invite_hourly_rate || inviteAppointment.hourly_rate || 0
        )
        if (inviteHourlyRate > 0) {
          hourlyRate = inviteHourlyRate
        }
        const inviteTotalAmount = Number(inviteAppointment.total_amount || 0)
        if (inviteTotalAmount > 0) {
          totalAmount = inviteTotalAmount
        } else {
          totalAmount = Number((hourlyRate * duration).toFixed(2))
        }
      }
      
      // 5. 生成预约号（如果是邀请创建，使用邀请的预约号；否则生成新的）
      const appointmentNo = inviteAppointment 
        ? inviteAppointment.appointment_no 
        : generateAppointmentNo()
      
      const now = Date.now()
      
      // 6. 如果是从邀请创建，更新现有预约；否则创建新预约
      let appointmentId
      if (invite_id && inviteAppointment) {
        // 更新邀请预约，填入家长填写的信息
        // 注意：invited_by 字段会被保留（update 不会删除未指定的字段）
        await db.collection('appointments').doc(invite_id).update({
          date,
          start_time,
          duration,
          lesson_mode: lesson_mode || 'offline',
          address: lesson_mode === 'offline' ? (address || {}) : {},
          student_name,
          student_grade: student_grade || '',
          subject,
          requirements,
          hourly_rate: hourlyRate,
          total_amount: totalAmount,
          parent_paid: false,
          status: 'pending_payment', // 家长填写信息后待支付试课费
          update_time: now
          // invited_by: 'teacher' 字段会被保留，因为 update 不会删除未指定的字段
        })
        appointmentId = invite_id
      } else {
        // 创建新预约
        const appointmentData = {
          appointment_no: appointmentNo,
          teacher_id: finalTeacherId,
          parent_id,
          course_type,
          date,
          start_time,
          duration,
          lesson_mode: lesson_mode || 'offline',
          address: lesson_mode === 'offline' ? (address || {}) : {},
          hourly_rate: hourlyRate,
          total_amount: totalAmount,
          student_name,
          student_grade: student_grade || '',
          subject,
          requirements,
          status: 'pending_payment', // 待支付
          parent_paid: false,
          deposit_paid: false,
          create_time: now,
          update_time: now
        }
        
        const result = await db.collection('appointments').add(appointmentData)
        appointmentId = result.id
      }
      
      console.log('预约创建成功，appointment_id:', appointmentId)
      
      return success({
        appointment_id: appointmentId,
        appointment_no: appointmentNo,
        total_amount: totalAmount
      }, '预约创建成功，请完成支付')
      
    } catch (e) {
      console.error('创建预约失败:', e)
      return error(e.message || '创建预约失败')
    }
  },
  
  /**
   * 家长创建联系请求（保留原有功能）
   * @param {Object} params
   * @param {String} params.teacher_id 教师ID
   * @param {String} params.student_name 学生姓名
   * @param {String} params.student_grade 学生年级
   * @param {Array} params.student_subjects 学生科目
   * @param {String} params.learning_goal 学习目标
   * @param {String} params.extra_notes 额外备注
   * @param {String} params.address_detail 地址详情
   * @returns {Object}
   */
  async createContactRequest(params) {
    const {
      teacher_id,
      student_name,
      student_grade,
      student_subjects = [],
      learning_goal = '',
      extra_notes = '',
      address_detail = ''
    } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 验证用户登录状态
      const parent_id = await resolveUserId(this)
      if (!parent_id) {
        return error('请先登录')
      }
      const parentUserDoc = await db.collection('uni-id-users').doc(parent_id).get()
      if (!parentUserDoc.data || parentUserDoc.data.length === 0 || !hasRole(parentUserDoc.data[0], 'parent')) {
        return error('只有家长可以发起联系')
      }
      try {
        assertParentProfileComplete(parentUserDoc.data[0])
      } catch (e) {
        return error(e.message || '请先完善信息')
      }
      
      if (!teacher_id) {
        return error('教师ID不能为空')
      }
      
      // 2. 验证教师是否存在
      const teacherDoc = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .field({ _id: true })
        .limit(1)
        .get()
      
      if (!teacherDoc.data || teacherDoc.data.length === 0) {
        return error('教师不存在')
      }
      
      // 3. 检查是否已经存在联系请求（未处理的 contact_request 状态）
      const existingRequestDoc = await db.collection('appointments')
        .where({
          teacher_id,
          parent_id,
          status: 'contact_request'
        })
        .orderBy('create_time', 'desc')
        .limit(1)
        .get()
      
      let conversationId = null
      let appointmentId = null
      
      if (existingRequestDoc.data && existingRequestDoc.data.length > 0) {
        // 已经存在联系请求，返回已有的会话信息
        appointmentId = existingRequestDoc.data[0]._id
        const existingConversationDoc = await db.collection('chat-conversations')
          .where({
            teacher_id,
            parent_id
          })
          .limit(1)
          .get()
        
        if (existingConversationDoc.data && existingConversationDoc.data.length > 0) {
          conversationId = existingConversationDoc.data[0]._id
        }
        
        return success({
          appointment_id: appointmentId,
          conversation_id: conversationId,
          already_exists: true
        }, '您已经发送过联系请求，请等待老师回复')
      }
      
      // 4. 创建联系请求预约（状态为 contact_request）
      const appointmentNo = generateAppointmentNo()
      const now = Date.now()
      
      const appointmentData = {
        appointment_no: appointmentNo,
        teacher_id,
        parent_id,
        course_type: 'trial', // 联系请求默认为试课类型
        status: 'contact_request',
        student_name: student_name || '',
        student_grade: student_grade || '',
        subject: student_subjects.length > 0 ? student_subjects[0] : '',
        requirements: `${learning_goal ? `学习目标：${learning_goal}\n` : ''}${extra_notes || ''}${address_detail ? `\n地址：${address_detail}` : ''}`,
        create_time: now,
        update_time: now
      }
      
      const result = await db.collection('appointments').add(appointmentData)
      
      if (!result.id) {
        return error('创建联系请求失败')
      }
      
      appointmentId = result.id
      
      // 5. 创建或获取聊天会话
      const conversationDoc = await db.collection('chat-conversations')
        .where({
          teacher_id,
          parent_id
        })
        .limit(1)
        .get()
      
      if (conversationDoc.data && conversationDoc.data.length > 0) {
        conversationId = conversationDoc.data[0]._id
        // 复用旧会话时，重置为当前联系请求的聊天状态，避免继承历史已支付状态
        await db.collection('chat-conversations').doc(conversationId).update({
          appointment_id: appointmentId,
          chat_enabled: false,
          teacher_deposit_paid: false,
          update_time: now
        })
      } else {
        const conversationResult = await db.collection('chat-conversations').add({
          teacher_id,
          parent_id,
          appointment_id: appointmentId,
          chat_enabled: false, // 联系请求阶段还不能聊天，需教师支付信息费后开启
          teacher_deposit_paid: false,
          last_message: '',
          last_message_time: null,
          unread_count_parent: 0,
          unread_count_teacher: 1, // 教师端有未读
          create_time: now,
          update_time: now
        })
        conversationId = conversationResult.id
      }
      
      // 5. 注意：联系请求创建后，消息发送应该由前端处理
      // 前端在创建联系请求成功后，会自动跳转到聊天页面，然后可以发送初始消息
      // 或者前端可以在创建成功后调用 chat-send.send 方法发送一条初始消息
      
      return success({
        appointment_id: result.id,
        conversation_id: conversationId
      }, '联系请求已发送')
      
    } catch (e) {
      console.error('创建联系请求失败:', e)
      return error(e.message || '创建联系请求失败')
    }
  },
  
  /**
   * 获取用户信息（内部方法）
   */
  getClientInfo() {
    return this.getUniCloudClientInfo ? this.getUniCloudClientInfo() : {}
  },
  
  /**
   * 获取 uni-id token（内部方法）
   */
  getUniIdToken() {
    return this.getClientInfo().uniIdToken || ''
  }
}
