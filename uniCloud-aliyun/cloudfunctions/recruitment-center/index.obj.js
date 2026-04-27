/**
 * 家长招募：发布、教师广场、邀请试课（含信息费前置）
 */
const uniID = require('uni-id-common')

function success(data = null, message = 'success') {
  return { code: 0, message, data, timestamp: Date.now() }
}

function error(message = 'error', code = -1, data = null) {
  return { code, message, data, timestamp: Date.now() }
}

async function resolveUserId(ctx) {
  const token = ctx.getUniIdToken()
  if (!token) return null
  try {
    const payload = await ctx.uniID.checkToken(token)
    if (payload.code) {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      return parts.length >= 1 ? parts[0] : null
    }
    return payload.uid
  } catch (e) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      return parts.length >= 1 ? parts[0] : null
    } catch (e2) {
      return null
    }
  }
}

function generateAppointmentNo() {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `APT${timestamp}${random}`
}

function maskDisplayName(nickname, uid) {
  const n = (nickname || '家长').trim()
  if (n.length <= 1) {
    const tail = (uid || '').slice(-4)
    return tail ? `家长${tail}` : '家长'
  }
  return `${n.charAt(0)}**家长`
}

function hasRole(userDoc, roleName) {
  const role = userDoc && userDoc.role
  const roles = Array.isArray(role) ? role : role ? [role] : []
  return roles.includes(roleName)
}

function normalizeGenderValue(value) {
  if (value === 1 || value === '1' || value === 'male') return 'male'
  if (value === 2 || value === '2' || value === 'female') return 'female'
  return ''
}

function isParentProfileComplete(userDoc) {
  const parentInfo = (userDoc && userDoc.parent_info) || {}
  return !!(
    String(parentInfo.student_name || '').trim() &&
    String(parentInfo.student_grade || '').trim() &&
    normalizeGenderValue(parentInfo.student_gender)
  )
}

function isTeacherProfileComplete(profile) {
  if (!profile) return false
  const hasQualificationImage = Array.isArray(profile.qualifications) && profile.qualifications.some((item) => item && item.image)
  return !!(
    String(profile.display_name || '').trim() &&
    Array.isArray(profile.subjects) && profile.subjects.length > 0 &&
    Array.isArray(profile.grades) && profile.grades.length > 0 &&
    Number(profile.hourly_rate || 0) > 0 &&
    Number((profile.teaching_experience && profile.teaching_experience.years) || 0) > 0 &&
    String(profile.introduction || '').trim() &&
    hasQualificationImage
  )
}

async function assertParentProfileComplete(db, userDoc) {
  if (!isParentProfileComplete(userDoc)) {
    throw new Error('请先完善孩子信息（学生姓名、性别和年级）后再发布招募')
  }
}

async function fillRecruitmentStudentGender(db, rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return rows
  const parentIds = Array.from(
    new Set(
      rows
        .filter((row) => row && row.parent_id && !normalizeGenderValue(row.student_gender))
        .map((row) => row.parent_id)
    )
  )
  if (!parentIds.length) {
    return rows.map((row) => ({
      ...row,
      student_gender: normalizeGenderValue(row.student_gender)
    }))
  }

  const userRes = await db
    .collection('uni-id-users')
    .where({ _id: db.command.in(parentIds) })
    .field({ _id: true, parent_info: true })
    .get()

  const genderMap = {}
  ;(userRes.data || []).forEach((user) => {
    genderMap[user._id] = normalizeGenderValue(user.parent_info && user.parent_info.student_gender)
  })

  return rows.map((row) => ({
    ...row,
    student_gender: normalizeGenderValue(row.student_gender) || genderMap[row.parent_id] || ''
  }))
}

async function assertTeacherProfileComplete(db, teacher_id) {
  const profileRes = await db.collection('teacher-profiles').where({ teacher_id }).limit(1).get()
  const profile = profileRes.data && profileRes.data.length > 0 ? profileRes.data[0] : null
  if (!isTeacherProfileComplete(profile)) {
    throw new Error('请先完善教师资料后再邀请试课')
  }
}

async function teacherPaidDepositForParent(db, teacher_id, parent_id) {
  const conv = await db
    .collection('chat-conversations')
    .where({ teacher_id, parent_id, teacher_deposit_paid: true })
    .limit(1)
    .get()
  if (conv.data && conv.data.length > 0) return true

  const existingDepositOrders = await db
    .collection('payment-orders')
    .where({
      order_type: 'deposit',
      payer_id: teacher_id,
      status: db.command.in(['paid', 'success'])
    })
    .get()

  if (!existingDepositOrders.data || existingDepositOrders.data.length === 0) return false
  const appointmentIds = existingDepositOrders.data.map((o) => o.appointment_id).filter(Boolean)
  if (appointmentIds.length === 0) return false
  const related = await db
    .collection('appointments')
    .where({
      _id: db.command.in(appointmentIds),
      parent_id
    })
    .limit(1)
    .get()
  return !!(related.data && related.data.length > 0)
}

/**
 * 创建试课邀请预约 + 会话（与 appointment-create.inviteTrial 对齐）
 */
async function createTrialInviteCore(db, teacher_id, parent_id, extras = {}) {
  const teacherProfileDoc = await db
    .collection('teacher-profiles')
    .where({ teacher_id })
    .field({ hourly_rate: true, display_name: true })
    .limit(1)
    .get()

  const teacherProfile =
    teacherProfileDoc.data && teacherProfileDoc.data.length > 0 ? teacherProfileDoc.data[0] : {}
  const hourlyRate = Number(teacherProfile.hourly_rate || 100)
  const trialAmount = hourlyRate * 2
  const appointmentNo = generateAppointmentNo()
  const now = Date.now()

  const appointmentData = {
    appointment_no: appointmentNo,
    teacher_id,
    parent_id,
    course_type: 'trial',
    status: 'trial_invited',
    hourly_rate: hourlyRate,
    total_amount: trialAmount,
    duration: 2,
    create_time: now,
    update_time: now,
    invited_by: 'teacher',
    invite_time: now
  }
  if (extras.recruitment_id) appointmentData.recruitment_id = extras.recruitment_id
  if (extras.invited_via) appointmentData.invited_via = extras.invited_via

  const result = await db.collection('appointments').add(appointmentData)
  if (!result.id) throw new Error('创建试课邀请失败')

  const conversationDoc = await db
    .collection('chat-conversations')
    .where({ teacher_id, parent_id })
    .limit(1)
    .get()

  let conversationId = null
  if (conversationDoc.data && conversationDoc.data.length > 0) {
    conversationId = conversationDoc.data[0]._id
    await db.collection('chat-conversations').doc(conversationId).update({
      appointment_id: result.id,
      update_time: now
    })
  } else {
    const conversationResult = await db.collection('chat-conversations').add({
      teacher_id,
      parent_id,
      appointment_id: result.id,
      chat_enabled: false,
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

  return {
    appointment_id: result.id,
    appointment_no: appointmentNo,
    conversation_id: conversationId,
    trial_amount: trialAmount
  }
}

/** 教师端仅可见审核通过的招募 */
function auditVisibleToTeacher() {
  return 'approved'
}

async function notifyParentRecruitmentInvite(db, parent_id, recruitment_id) {
  try {
    await db.collection('system-messages').add({
      user_id: parent_id,
      type: 'recruitment',
      title: '有老师响应您的招募',
      content: '一位老师向您发起了试课邀请，请前往「消息」或聊天查看并填写预约。',
      related_id: recruitment_id,
      action: { type: 'navigate', path: '/pages/chat/list' },
      action_url: '/pages/chat/list',
      is_read: false
    })
  } catch (e) {
    console.error('[recruitment-center] 系统消息写入失败', e)
  }
}

async function syncConversationDepositState(db, conversation_id, appointment_id, depositPaid) {
  if (!conversation_id) return
  const now = Date.now()
  await db.collection('chat-conversations').doc(conversation_id).update({
    appointment_id,
    chat_enabled: !!depositPaid,
    teacher_deposit_paid: !!depositPaid,
    update_time: now
  })
}

async function assertAdmin(ctx) {
  const uid = await resolveUserId(ctx)
  if (!uid) throw new Error('未登录')
  const db = uniCloud.database()
  const doc = await db.collection('uni-id-users').doc(uid).field({ role: true }).get()
  const role = doc.data && doc.data[0] ? doc.data[0].role : []
  const roles = Array.isArray(role) ? role : role ? [role] : []
  if (!roles.includes('admin')) throw new Error('需要管理员权限')
  return uid
}

module.exports = {
  _before: function () {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({ clientInfo })
  },

  async create(params = {}) {
    const db = uniCloud.database()
    const parent_id = await resolveUserId(this)
    if (!parent_id) return error('请先登录')

    const userDoc = await db.collection('uni-id-users').doc(parent_id).get()
    if (!userDoc.data || userDoc.data.length === 0 || !hasRole(userDoc.data[0], 'parent')) {
      return error('仅家长可发布招募')
    }
    try {
      await assertParentProfileComplete(db, userDoc.data[0])
    } catch (e) {
      return error(e.message || '请先完善信息')
    }

    const {
      subject,
      student_grade,
      lesson_mode,
      region,
      location,
      goal,
      budget_min,
      budget_max,
      time_note,
      remark,
      valid_days = 14,
      max_teacher_responses
    } = params

    if (!subject || !student_grade || !lesson_mode) {
      return error('请填写科目、年级与上课方式')
    }
    if (lesson_mode === 'offline' && (!region || (!region.city && !region.name))) {
      return error('线下请填写大致地区')
    }

    const days = [7, 14, 30].includes(Number(valid_days)) ? Number(valid_days) : 14
    const now = Date.now()
    const expire_at = now + days * 24 * 60 * 60 * 1000
    const nick = userDoc.data[0].nickname || userDoc.data[0].wx_nickname || ''
    const parentInfo = userDoc.data[0].parent_info || {}
    const student_gender = normalizeGenderValue(parentInfo.student_gender)
    const display_name = maskDisplayName(nick, parent_id)

    const doc = {
      parent_id,
      status: 'open',
      audit_status: 'pending',
      audit_remark: '',
      display_name,
      subject: String(subject).trim(),
      student_grade: String(student_grade).trim(),
      student_gender,
      lesson_mode,
      region: region || {},
      location: location || {},
      goal: goal ? String(goal).trim() : '',
      budget_min: budget_min != null ? Number(budget_min) : null,
      budget_max: budget_max != null ? Number(budget_max) : null,
      time_note: time_note ? String(time_note).trim() : '',
      remark: remark ? String(remark).trim() : '',
      expire_at,
      response_count: 0,
      max_teacher_responses: max_teacher_responses > 0 ? Number(max_teacher_responses) : null,
      create_time: now,
      update_time: now
    }

    const res = await db.collection('parent-recruitments').add(doc)
    if (!res.id) return error('发布失败')
    return success({ recruitment_id: res.id }, '已提交，审核通过后将展示给教师')
  },

  async update(params = {}) {
    const db = uniCloud.database()
    const parent_id = await resolveUserId(this)
    if (!parent_id) return error('请先登录')
    const userDoc = await db.collection('uni-id-users').doc(parent_id).get()
    if (!userDoc.data || userDoc.data.length === 0 || !hasRole(userDoc.data[0], 'parent')) {
      return error('仅家长可编辑招募')
    }
    try {
      await assertParentProfileComplete(db, userDoc.data[0])
    } catch (e) {
      return error(e.message || '请先完善信息')
    }

    const { recruitment_id, ...rest } = params
    if (!recruitment_id) return error('缺少招募ID')

    const col = db.collection('parent-recruitments')
    const cur = await col.doc(recruitment_id).get()
    if (!cur.data || cur.data.length === 0) return error('招募不存在')
    const row = cur.data[0]
    if (row.parent_id !== parent_id) return error('无权修改')
    if (row.status !== 'open') return error('仅进行中的招募可编辑')

    const now = Date.now()
    const patch = { update_time: now }
    const allow = [
      'subject',
      'student_grade',
      'lesson_mode',
      'region',
      'location',
      'goal',
      'budget_min',
      'budget_max',
      'time_note',
      'remark',
      'max_teacher_responses'
    ]
    for (const k of allow) {
      if (rest[k] !== undefined) patch[k] = rest[k]
    }
    const parentInfo = userDoc.data[0].parent_info || {}
    patch.student_gender = normalizeGenderValue(parentInfo.student_gender)
    if (rest.valid_days) {
      const days = [7, 14, 30].includes(Number(rest.valid_days)) ? Number(rest.valid_days) : 14
      patch.expire_at = now + days * 24 * 60 * 60 * 1000
    }
    // 修改内容后需重新审核
    patch.audit_status = 'pending'
    patch.audit_remark = ''
    patch.audited_at = db.command.remove()
    patch.audited_by = db.command.remove()

    await col.doc(recruitment_id).update(patch)
    return success(null, '已保存')
  },

  async close(params = {}) {
    const db = uniCloud.database()
    const parent_id = await resolveUserId(this)
    if (!parent_id) return error('请先登录')

    const { recruitment_id, close_reason } = params
    if (!recruitment_id) return error('缺少招募ID')

    const col = db.collection('parent-recruitments')
    const cur = await col.doc(recruitment_id).get()
    if (!cur.data || cur.data.length === 0) return error('招募不存在')
    const row = cur.data[0]
    if (row.parent_id !== parent_id) return error('无权操作')
    if (row.status !== 'open') return error('已结束')

    await col.doc(recruitment_id).update({
      status: 'closed',
      close_reason: close_reason || 'other',
      update_time: Date.now()
    })
    return success(null, '已关闭')
  },

  async myList(params = {}) {
    const db = uniCloud.database()
    const parent_id = await resolveUserId(this)
    if (!parent_id) return error('请先登录')

    const { tab = 'open', page = 1, pageSize = 20 } = params
    const skip = Math.max(0, page - 1) * pageSize
    const now = Date.now()
    const col = db.collection('parent-recruitments')
    let where = { parent_id }

    if (tab === 'open') {
      where.status = 'open'
      where.expire_at = db.command.gt(now)
    } else {
      const _ = db.command
      where = _.and([
        { parent_id },
        _.or([
          { status: _.in(['closed', 'expired']) },
          _.and([{ status: 'open' }, { expire_at: _.lte(now) }])
        ])
      ])
    }

    const listRes = await col.where(where).orderBy('create_time', 'desc').skip(skip).limit(pageSize).get()

    let list = await fillRecruitmentStudentGender(db, listRes.data || [])
    if (tab === 'open') {
      const expiredIds = []
      list = list.map((r) => {
        let st = r.status
        if (r.status === 'open' && r.expire_at && r.expire_at < now) {
          st = 'expired'
          expiredIds.push(r._id)
        }
        return { ...r, effective_status: st }
      })
      for (const id of expiredIds) {
        try {
          await col.doc(id).update({ status: 'expired', update_time: now })
        } catch (e) {
          /* ignore */
        }
      }
    }

    const countRes = await col.where(where).count()
    return success({
      list,
      pagination: { page, pageSize, total: countRes.total || 0 }
    })
  },

  async listForTeacher(params = {}) {
    const db = uniCloud.database()
    const teacher_id = await resolveUserId(this)
    if (!teacher_id) return error('请先登录')

    const userDoc = await db.collection('uni-id-users').doc(teacher_id).get()
    if (!userDoc.data || userDoc.data.length === 0 || userDoc.data[0].role !== 'teacher') {
      return error('仅教师可查看广场')
    }

    const { subject, student_grade, lesson_mode, city, page = 1, pageSize = 20 } = params
    const now = Date.now()
    const skip = Math.max(0, page - 1) * pageSize

    const where = {
      status: 'open',
      expire_at: db.command.gt(now),
      audit_status: auditVisibleToTeacher()
    }
    if (subject && String(subject).trim()) where.subject = String(subject).trim()
    if (student_grade && String(student_grade).trim()) where.student_grade = String(student_grade).trim()
    if (lesson_mode) where.lesson_mode = lesson_mode
    if (city && String(city).trim()) {
      where['region.city'] = new RegExp(String(city).trim(), 'i')
    }

    const col = db.collection('parent-recruitments')
    const listRes = await col.where(where).orderBy('create_time', 'desc').skip(skip).limit(pageSize).get()
    const rows = await fillRecruitmentStudentGender(db, listRes.data || [])
    const list = rows.map((r) => ({
      _id: r._id,
      display_name: r.display_name,
      subject: r.subject,
      student_grade: r.student_grade,
      student_gender: r.student_gender,
      lesson_mode: r.lesson_mode,
      region: r.region,
      goal: r.goal,
      remark: r.remark,
      time_note: r.time_note,
      budget_min: r.budget_min,
      budget_max: r.budget_max,
      expire_at: r.expire_at,
      create_time: r.create_time,
      response_count: r.response_count || 0
    }))

    const totalRes = await col.where(where).count()

    return success({ list, pagination: { page, pageSize, total: totalRes.total || 0 } })
  },

  async detailForTeacher(params = {}) {
    const db = uniCloud.database()
    const teacher_id = await resolveUserId(this)
    if (!teacher_id) return error('请先登录')

    const userDoc = await db.collection('uni-id-users').doc(teacher_id).get()
    if (!userDoc.data || userDoc.data.length === 0 || userDoc.data[0].role !== 'teacher') {
      return error('仅教师可查看')
    }

    const { recruitment_id } = params
    if (!recruitment_id) return error('缺少招募ID')

    const doc = await db.collection('parent-recruitments').doc(recruitment_id).get()
    if (!doc.data || doc.data.length === 0) return error('招募不存在')
    const r = doc.data[0]
    const now = Date.now()
    if (r.status !== 'open' || (r.expire_at && r.expire_at < now)) {
      return error('招募已结束或已过期')
    }
    const aud = r.audit_status
    if (aud !== 'approved') {
      return error('该招募尚未通过审核')
    }

    const existing = await db
      .collection('recruitment-responses')
      .where({ recruitment_id, teacher_id })
      .limit(1)
      .get()

    let already_responded = false
    let my_response = null
    if (existing.data && existing.data.length > 0) {
      already_responded = true
      my_response = existing.data[0]
    }

    const need_deposit = !(await teacherPaidDepositForParent(db, teacher_id, r.parent_id))
    if (my_response && my_response.conversation_id && my_response.appointment_id) {
      await syncConversationDepositState(db, my_response.conversation_id, my_response.appointment_id, !need_deposit)
    }

    const detail = {
      _id: r._id,
      display_name: r.display_name,
      subject: r.subject,
      student_grade: r.student_grade,
      student_gender: normalizeGenderValue(r.student_gender),
      lesson_mode: r.lesson_mode,
      region: r.region,
      goal: r.goal,
      remark: r.remark,
      time_note: r.time_note,
      budget_min: r.budget_min,
      budget_max: r.budget_max,
      expire_at: r.expire_at,
      create_time: r.create_time,
      already_responded,
      my_response,
      need_deposit
    }

    if (!detail.student_gender && r.parent_id) {
      const parentDoc = await db.collection('uni-id-users').doc(r.parent_id).field({ parent_info: true }).get()
      const parentInfo = parentDoc.data && parentDoc.data[0] ? parentDoc.data[0].parent_info || {} : {}
      detail.student_gender = normalizeGenderValue(parentInfo.student_gender)
    }

    return success(detail)
  },

  async inviteFromRecruitment(params = {}) {
    const db = uniCloud.database()
    const teacher_id = await resolveUserId(this)
    if (!teacher_id) return error('请先登录')

    const userDoc = await db.collection('uni-id-users').doc(teacher_id).get()
    if (!userDoc.data || userDoc.data.length === 0 || !hasRole(userDoc.data[0], 'teacher')) {
      return error('仅教师可邀请')
    }
    try {
      await assertTeacherProfileComplete(db, teacher_id)
    } catch (e) {
      return error(e.message || '请先完善信息')
    }

    const { recruitment_id } = params
    if (!recruitment_id) return error('缺少招募ID')

    const doc = await db.collection('parent-recruitments').doc(recruitment_id).get()
    if (!doc.data || doc.data.length === 0) return error('招募不存在')
    const rec = doc.data[0]
    const now = Date.now()
    if (rec.status !== 'open' || (rec.expire_at && rec.expire_at < now)) {
      return error('招募已结束或已过期')
    }
    const aud = rec.audit_status
    if (aud !== 'approved') {
      return error('该招募尚未通过审核')
    }
    if (rec.parent_id === teacher_id) return error('参数错误')

    const maxR = rec.max_teacher_responses
    if (maxR && maxR > 0 && (rec.response_count || 0) >= maxR) {
      return error('该招募响应人数已达上限')
    }

    const existResp = await db
      .collection('recruitment-responses')
      .where({ recruitment_id, teacher_id })
      .limit(1)
      .get()

    if (existResp.data && existResp.data.length > 0) {
      const row = existResp.data[0]
      const depositOk = await teacherPaidDepositForParent(db, teacher_id, rec.parent_id)
      await syncConversationDepositState(db, row.conversation_id, row.appointment_id, depositOk)
      return success({
        already_exists: true,
        appointment_id: row.appointment_id,
        conversation_id: row.conversation_id,
        need_deposit: !depositOk,
        trial_amount: null
      })
    }

    const depositPaid = await teacherPaidDepositForParent(db, teacher_id, rec.parent_id)
    const trial = await createTrialInviteCore(db, teacher_id, rec.parent_id, {
      recruitment_id,
      invited_via: 'recruitment'
    })

    const need_deposit = !depositPaid
    await syncConversationDepositState(db, trial.conversation_id, trial.appointment_id, depositPaid)

    await db.collection('recruitment-responses').add({
      recruitment_id,
      teacher_id,
      parent_id: rec.parent_id,
      appointment_id: trial.appointment_id,
      conversation_id: trial.conversation_id,
      need_deposit,
      deposit_paid: !need_deposit,
      create_time: now
    })

    await db
      .collection('parent-recruitments')
      .doc(recruitment_id)
      .update({
        response_count: db.command.inc(1),
        last_response_at: now,
        update_time: now
      })

    await notifyParentRecruitmentInvite(db, rec.parent_id, recruitment_id)

    return success({
      already_exists: false,
      appointment_id: trial.appointment_id,
      conversation_id: trial.conversation_id,
      need_deposit,
      trial_amount: trial.trial_amount
    })
  },

  /**
   * 后台招募审核工作台：各状态数量（与列表 Tab / 首页待审口径对齐）
   */
  async adminRecruitmentKpi() {
    try {
      await assertAdmin(this)
    } catch (e) {
      return error(e.message || '无权限')
    }
    const db = uniCloud.database()
    const _ = db.command
    const pendingWhere = _.and([
      { status: 'open' },
      _.or([{ audit_status: 'pending' }, { audit_status: _.exists(false) }])
    ])
    const [totalRes, pendingRes, approvedRes, rejectedRes, closedRes] = await Promise.all([
      db.collection('parent-recruitments').where({}).count(),
      db.collection('parent-recruitments').where(pendingWhere).count(),
      db.collection('parent-recruitments').where({ audit_status: 'approved' }).count(),
      db.collection('parent-recruitments').where({ audit_status: 'rejected' }).count(),
      db.collection('parent-recruitments').where({ status: 'closed' }).count()
    ])
    return success({
      total: totalRes.total || 0,
      pending: pendingRes.total || 0,
      approved: approvedRes.total || 0,
      rejected: rejectedRes.total || 0,
      closed: closedRes.total || 0
    })
  },

  async adminList(params = {}) {
    try {
      await assertAdmin(this)
    } catch (e) {
      return error(e.message || '无权限')
    }
    const db = uniCloud.database()
    const _ = db.command
    const { page = 1, pageSize = 20, status, parent_id, audit_status } = params
    const skip = Math.max(0, page - 1) * pageSize
    const q = db.collection('parent-recruitments')
    const parts = []
    if (status) parts.push({ status })
    if (parent_id) parts.push({ parent_id })
    if (audit_status === 'pending') {
      parts.push(_.or([{ audit_status: 'pending' }, { audit_status: _.exists(false) }]))
    } else if (audit_status && ['approved', 'rejected'].includes(audit_status)) {
      parts.push({ audit_status })
    }
    const w = parts.length === 0 ? {} : parts.length === 1 ? parts[0] : _.and(parts)
    const listRes = await q
      .where(w)
      .orderBy('create_time', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    const enrichedList = await fillRecruitmentStudentGender(db, listRes.data || [])
    const totalRes = await db.collection('parent-recruitments').where(w).count()
    return success({
      list: enrichedList,
      pagination: { page, pageSize, total: totalRes.total || 0 }
    })
  },

  async adminDetail(params = {}) {
    try {
      await assertAdmin(this)
    } catch (e) {
      return error(e.message || '无权限')
    }
    const { recruitment_id } = params
    if (!recruitment_id) return error('缺少ID')
    const db = uniCloud.database()
    const doc = await db.collection('parent-recruitments').doc(recruitment_id).get()
    if (!doc.data || !doc.data.length) return error('不存在')
    const enrichedRows = await fillRecruitmentStudentGender(db, doc.data || [])
    const responses = await db
      .collection('recruitment-responses')
      .where({ recruitment_id })
      .orderBy('create_time', 'desc')
      .limit(100)
      .get()
    return success({ recruitment: enrichedRows[0] || doc.data[0], responses: responses.data || [] })
  },

  async adminForceClose(params = {}) {
    try {
      await assertAdmin(this)
    } catch (e) {
      return error(e.message || '无权限')
    }
    const { recruitment_id } = params
    if (!recruitment_id) return error('缺少ID')
    const db = uniCloud.database()
    await db.collection('parent-recruitments').doc(recruitment_id).update({
      status: 'closed',
      close_reason: 'other',
      update_time: Date.now()
    })
    return success(null, '已下架')
  },

  async adminAuditApprove(params = {}) {
    let adminUid
    try {
      adminUid = await assertAdmin(this)
    } catch (e) {
      return error(e.message || '无权限')
    }
    const { recruitment_id } = params
    if (!recruitment_id) return error('缺少ID')
    const db = uniCloud.database()
    const now = Date.now()
    await db.collection('parent-recruitments').doc(recruitment_id).update({
      audit_status: 'approved',
      audit_remark: '',
      audited_at: now,
      audited_by: adminUid,
      update_time: now
    })
    return success(null, '已通过审核')
  },

  async adminAuditReject(params = {}) {
    let adminUid
    try {
      adminUid = await assertAdmin(this)
    } catch (e) {
      return error(e.message || '无权限')
    }
    const { recruitment_id, audit_remark = '' } = params
    if (!recruitment_id) return error('缺少ID')
    const db = uniCloud.database()
    const now = Date.now()
    await db.collection('parent-recruitments').doc(recruitment_id).update({
      audit_status: 'rejected',
      audit_remark: String(audit_remark || '').trim().slice(0, 500),
      audited_at: now,
      audited_by: adminUid,
      update_time: now
    })
    return success(null, '已拒绝')
  }
}
