/**
 * 教师工作台云对象
 * 功能：提供教师端仪表盘所需的统计数据与待处理事项
 * 使用 uni-id-common 进行 token 验证
 */

const uniID = require('uni-id-common')

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

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 累计学生 = 试课成功（completed 且 trial_result 非 fail）的去重家长数 */
async function countSuccessfulTrialStudents(db, teacher_id) {
  const $ = db.command.aggregate
  const agg = await db.collection('appointments')
    .aggregate()
    .match({
      teacher_id,
      course_type: 'trial',
      status: 'completed'
    })
    .group({
      _id: '$parent_id',
      hasSuccess: $.max(
        $.cond({
          if: $.or([
            $.eq(['$trial_result', 'success']),
            $.eq([$.ifNull(['$trial_result', '']), ''])
          ]),
          then: 1,
          else: 0
        })
      )
    })
    .match({ hasSuccess: 1 })
    .count('total')
    .end()

  return agg.data && agg.data.length > 0 ? Number(agg.data[0].total || 0) : 0
}

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
  },

  /**
   * 获取教师工作台概览数据
   * @returns {Object}
   */
  async getOverview() {
    const db = uniCloud.database()
    const dbCmd = db.command
    const $ = db.command.aggregate

    try {
      const token = this.getUniIdToken()
      let teacher_id

      if (!token) {
        return error('未获取到token，请先登录')
      }

      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          throw new Error(payload.message || 'token校验失败')
        }
        teacher_id = payload.uid
      } catch (tokenError) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } catch (decodeError) {
          teacher_id = null
        }
      }

      if (!teacher_id) {
        return error('token验证失败，请重新登录')
      }

      // 获取教师个人资料
      const profileRes = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .field({
          display_name: true,
          avatar: true,
          title: true,
          subjects: true,
          hourly_rate: true,
          is_verified: true
        })
        .limit(1)
        .get()

      const teacherProfile = profileRes.data && profileRes.data.length > 0 ? profileRes.data[0] : null

      const now = new Date()
      const todayStr = formatDate(now)

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()

      // 今日预约数量
      const todayCountRes = await db.collection('appointments')
        .where({
          teacher_id,
          date: todayStr,
          status: dbCmd.in(['pending_payment', 'pending_confirm', 'confirmed', 'in_progress'])
        })
        .count()

      // 本月收入（完成的预约），取 teacher_income 字段
      const monthIncomeAgg = await db.collection('appointments')
        .aggregate()
        .match({
          teacher_id,
          status: 'completed',
          teacher_income: dbCmd.gt(0),
          create_time: dbCmd.and([dbCmd.gte(startOfMonth), dbCmd.lt(startOfNextMonth)])
        })
        .group({
          _id: null,
          total: $.sum('$teacher_income')
        })
        .end()

      const monthIncome = monthIncomeAgg.data && monthIncomeAgg.data.length > 0
        ? Number(monthIncomeAgg.data[0].total || 0)
        : 0

      // 累计学生：仅统计试课成功后的去重家长
      const totalStudents = await countSuccessfulTrialStudents(db, teacher_id)

      // 待处理预约（待支付或待确认）
      const pendingAppointmentsRes = await db.collection('appointments')
        .where({
          teacher_id,
          status: dbCmd.in(['pending_payment', 'pending_confirm'])
        })
        .orderBy('date', 'asc')
        .orderBy('start_time', 'asc')
        .limit(5)
        .get()

      const pendingAppointments = (pendingAppointmentsRes.data || []).map(item => ({
        _id: item._id,
        appointment_date: item.date || item.appointment_date,
        appointment_time: item.start_time || item.appointment_time,
        student_name: item.student_info?.name || item.student_name || '学生',
        subject: item.student_info?.subject || item.subject || '',
        status: item.status,
        deposit_paid: !!item.deposit_paid
      }))

      // 最近三天和七天内的预约数量
      const threeDaysLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)
      const sevenDaysLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
      const threeDaysStr = formatDate(threeDaysLater)
      const sevenDaysStr = formatDate(sevenDaysLater)

      const upcoming3Res = await db.collection('appointments')
        .where({
          teacher_id,
          date: dbCmd.gte(todayStr).lte(threeDaysStr),
          status: dbCmd.in(['pending_confirm', 'confirmed', 'in_progress'])
        })
        .count()

      const upcoming7Res = await db.collection('appointments')
        .where({
          teacher_id,
          date: dbCmd.gte(todayStr).lte(sevenDaysStr),
          status: dbCmd.in(['pending_confirm', 'confirmed', 'in_progress'])
        })
        .count()

      // 打卡待办：confirmed/in_progress + 已支付信息费 + 未上课/未下课
      // 前端展示徽章数量；具体筛选时间窗口由前端结合排课时间判断
      const needClockInRes = await db.collection('appointments')
        .where({
          teacher_id,
          status: dbCmd.in(['confirmed', 'in_progress']),
          deposit_paid: true,
          parent_paid: true,
          class_started_at: dbCmd.exists(false)
        })
        .count()

      const needClockOutRes = await db.collection('appointments')
        .where({
          teacher_id,
          status: 'in_progress',
          deposit_paid: true,
          parent_paid: true,
          class_started_at: dbCmd.exists(true),
          class_ended_at: dbCmd.exists(false)
        })
        .count()

      return success({
        profile: teacherProfile,
        stats: {
          todayAppointments: todayCountRes.total || 0,
          monthIncome,
          totalStudents,
          upcoming3Days: upcoming3Res.total || 0,
          upcoming7Days: upcoming7Res.total || 0,
          needClockIn: needClockInRes.total || 0,
          needClockOut: needClockOutRes.total || 0
        },
        pendingAppointments
      })
    } catch (e) {
      console.error('[teacher-dashboard] 获取工作台数据失败', e)
      return error(e.message || '获取工作台数据失败')
    }
  },

  /**
   * 检查教师信息是否完善
   * @returns {Object} 返回缺失的字段列表
   */
  async checkProfileComplete() {
    console.log('[云函数] checkProfileComplete 被调用')
    const db = uniCloud.database()

    try {
      const token = this.getUniIdToken()
      console.log('[云函数] token 存在:', !!token)
      let teacher_id

      if (!token) {
        console.warn('[云函数] 未获取到token')
        return error('未获取到token，请先登录')
      }

      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          throw new Error(payload.message || 'token校验失败')
        }
        teacher_id = payload.uid
      } catch (tokenError) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } catch (decodeError) {
          teacher_id = null
        }
      }

      if (!teacher_id) {
        console.warn('[云函数] token验证失败')
        return error('token验证失败，请重新登录')
      }

      console.log('[云函数] teacher_id:', teacher_id)

      // 查询教师资料
      const profileRes = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .limit(1)
        .get()

      console.log('[云函数] 查询结果:', {
        hasData: !!profileRes.data,
        dataLength: profileRes.data ? profileRes.data.length : 0
      })

      if (!profileRes.data || profileRes.data.length === 0) {
        console.warn('[云函数] 教师资料不存在')
        return success({
          isComplete: false,
          missingFields: ['display_name', 'gender', 'avatar', 'contact_mobile', 'subjects', 'grades', 'hourly_rate', 'experience_years', 'introduction', 'qualifications'],
          missingFieldsText: ['姓名', '性别', '本人头像', '联系手机号', '教学科目', '适合年级', '课时费', '教龄', '自我介绍', '资质证书截图']
        }, '教师资料不存在')
      }

      const profile = profileRes.data[0]
      console.log('[云函数] 教师资料:', {
        display_name: profile.display_name,
        subjects: profile.subjects,
        grades: profile.grades,
        hourly_rate: profile.hourly_rate
      })
      const missingFields = []
      const missingFieldsText = []

      // 检查必填字段
      if (!profile.display_name || profile.display_name.trim() === '') {
        missingFields.push('display_name')
        missingFieldsText.push('姓名')
      }

      // 性别必填（新规则）
      if (!profile.gender || !['male', 'female'].includes(profile.gender)) {
        missingFields.push('gender')
        missingFieldsText.push('性别')
      }

      // 头像必填（新规则：本人证件照或自拍照）
      if (!profile.avatar || !String(profile.avatar).trim()) {
        missingFields.push('avatar')
        missingFieldsText.push('本人头像')
      }

      // 检查联系手机号：家长/后台通过手机号联系教师，必填
      // 兼容 number / string 两种存储类型
      const mobileReg = /^1[3-9]\d{9}$/
      const rawMobile = profile.contact_mobile
      const contactMobile = (rawMobile !== null && rawMobile !== undefined && rawMobile !== '')
        ? String(rawMobile).trim()
        : ''
      console.log('[云函数] contact_mobile 原值:', rawMobile, '(type:', typeof rawMobile, ') 处理后:', contactMobile)
      if (!contactMobile) {
        missingFields.push('contact_mobile')
        missingFieldsText.push('联系手机号')
      } else if (!mobileReg.test(contactMobile)) {
        missingFields.push('contact_mobile')
        missingFieldsText.push('联系手机号格式不正确')
      }

      if (!profile.subjects || !Array.isArray(profile.subjects) || profile.subjects.length === 0) {
        missingFields.push('subjects')
        missingFieldsText.push('教学科目')
      }

      const isFullTimeTeacher = profile.school === '专职老师'
      if (!isFullTimeTeacher && (!profile.grades || !Array.isArray(profile.grades) || profile.grades.length === 0)) {
        missingFields.push('grades')
        missingFieldsText.push('适合年级')
      }

      if (!profile.hourly_rate || Number(profile.hourly_rate) <= 0) {
        missingFields.push('hourly_rate')
        missingFieldsText.push('课时费')
      }

      if (!profile.teaching_experience?.years || Number(profile.teaching_experience.years) <= 0) {
        missingFields.push('experience_years')
        missingFieldsText.push('教龄')
      }

      if (!profile.introduction || !String(profile.introduction).trim()) {
        missingFields.push('introduction')
        missingFieldsText.push('自我介绍')
      }

      const hasQualificationImage = Array.isArray(profile.qualifications) && profile.qualifications.some(item => item && item.image)
      if (!hasQualificationImage) {
        missingFields.push('qualifications')
        missingFieldsText.push('资质证书截图')
      }

      const isComplete = missingFields.length === 0

      // 打印详细的缺失信息日志 - 使用 console.warn 使其更明显
      if (!isComplete) {
        console.warn('========================================')
        console.warn('[云函数-教师信息检查] ⚠️ 信息未完善')
        console.warn('缺失的字段数量:', missingFields.length)
        console.warn('缺失的字段（英文）:', missingFields.join(', '))
        console.warn('缺失的字段（中文）:', missingFieldsText.join('、'))
        console.warn('详细信息:')
        missingFields.forEach((field, index) => {
          const fieldName = missingFieldsText[index]
          let currentValue = '未设置'
          switch(field) {
            case 'display_name':
              currentValue = profile.display_name || '空'
              break
            case 'subjects':
              currentValue = Array.isArray(profile.subjects) 
                ? `数组长度: ${profile.subjects.length}` 
                : '不是数组'
              break
            case 'grades':
              currentValue = Array.isArray(profile.grades) 
                ? `数组长度: ${profile.grades.length}` 
                : '不是数组'
              break
            case 'hourly_rate':
              currentValue = profile.hourly_rate || '0'
              break
            case 'experience_years':
              currentValue = profile.teaching_experience?.years || '0'
              break
            case 'introduction':
              currentValue = profile.introduction ? '已填写' : '空'
              break
            case 'qualifications':
              currentValue = Array.isArray(profile.qualifications)
                ? `有效截图数: ${profile.qualifications.filter(item => item && item.image).length}`
                : '不是数组'
              break
          }
          console.warn(`  - ${fieldName} (${field}): ${currentValue}`)
        })
        console.warn('========================================')
      } else {
        console.log('[云函数-教师信息检查] ✓ 信息已完善')
      }

      return success({
        isComplete,
        missingFields,
        missingFieldsText,
        profile: isComplete ? profile : null
      }, isComplete ? '信息已完善' : '信息未完善')
    } catch (e) {
      console.error('检查教师信息失败:', e)
      return error(e.message || '检查失败')
    }
  },

  /**
   * 获取教师主页展示数据
   * @returns {Object}
   */
  async getProfileDetail() {
    const db = uniCloud.database()
    const dbCmd = db.command
    const $ = db.command.aggregate

    try {
      const token = this.getUniIdToken()
      let teacher_id

      if (!token) {
        return error('未获取到token，请先登录')
      }

      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          throw new Error(payload.message || 'token校验失败')
        }
        teacher_id = payload.uid
      } catch (tokenError) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } catch (decodeError) {
          teacher_id = null
        }
      }

      if (!teacher_id) {
        return error('token验证失败，请重新登录')
      }

      // 教师基本资料
      const profileRes = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .limit(1)
        .get()

      if (!profileRes.data || profileRes.data.length === 0) {
        return error('教师资料不存在，请先完善信息')
      }

      const profile = profileRes.data[0]

      // 教师标签数据：最近完成预约数、平均评分、累计评价
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

      const appointmentsAgg = await db.collection('appointments')
        .aggregate()
        .match({
          teacher_id,
          status: 'completed'
        })
        .group({
          _id: null,
          recent_completed: $.sum(
            $.cond({
              if: $.gte(['$create_time', thirtyDaysAgo]),
              then: 1,
              else: 0
            })
          ),
          total_income: $.sum('$teacher_income')
        })
        .end()

      const appointmentInfo = appointmentsAgg.data && appointmentsAgg.data.length > 0
        ? appointmentsAgg.data[0]
        : null

      const totalStudents = await countSuccessfulTrialStudents(db, teacher_id)

      const recentCompleted = appointmentInfo && appointmentInfo.recent_completed
        ? appointmentInfo.recent_completed
        : 0

      const totalIncome = appointmentInfo && appointmentInfo.total_income
        ? Number(appointmentInfo.total_income)
        : 0

      // 评价统计
      const reviewsAgg = await db.collection('reviews')
        .aggregate()
        .match({ teacher_id })
        .group({
          _id: null,
          total_reviews: $.sum(1),
          average_rating: $.avg('$rating')
        })
        .end()

      const reviewInfo = reviewsAgg.data && reviewsAgg.data.length > 0
        ? reviewsAgg.data[0]
        : null

      const totalReviews = reviewInfo && reviewInfo.total_reviews
        ? reviewInfo.total_reviews
        : 0

      const averageRating = reviewInfo && reviewInfo.average_rating
        ? Number(reviewInfo.average_rating.toFixed(1))
        : (profile.rating || 5.0)

      // 试课统计
      const trialAppointmentsAgg = await db.collection('appointments')
        .aggregate()
        .match({
          teacher_id,
          type: 'trial'
        })
        .group({
          _id: null,
          total_trials: $.sum(1),
          successful_trials: $.sum(
            $.cond({
              if: {
                $and: [
                  { $eq: ['$status', 'completed'] },
                  { $eq: ['$trial_result.is_satisfied', true] }
                ]
              },
              then: 1,
              else: 0
            })
          )
        })
        .end()

      const trialInfo = trialAppointmentsAgg.data && trialAppointmentsAgg.data.length > 0
        ? trialAppointmentsAgg.data[0]
        : null

      const totalTrials = trialInfo && trialInfo.total_trials
        ? trialInfo.total_trials
        : 0

      const successfulTrials = trialInfo && trialInfo.successful_trials
        ? trialInfo.successful_trials
        : 0

      // 总预约数统计（包括试课和正式课程）
      const totalAppointmentsRes = await db.collection('appointments')
        .where({ teacher_id })
        .count()

      const totalAppointments = totalAppointmentsRes.total || 0

      const result = {
        profile: {
          display_name: profile.display_name || '教师',
          avatar: profile.avatar || '',
          title: profile.title || '',
          introduction: profile.introduction || '',
          hourly_rate: profile.hourly_rate || 0,
          subjects: profile.subjects || [],
          grades: profile.grades || [],
          teaching_experience: profile.teaching_experience || { years: 0, description: '' },
          education: profile.education || {},
          qualifications: profile.qualifications || [],
          teaching_areas: profile.teaching_areas || [],
          is_verified: profile.is_verified !== undefined ? profile.is_verified : false,
          available: profile.available !== undefined ? profile.available : false
        },
        metrics: {
          averageRating,
          totalReviews,
          totalStudents,
          recentCompleted,
          totalIncome,
          totalAppointments,
          totalTrials,
          successfulTrials
        }
      }

      return success(result)
    } catch (e) {
      console.error('[teacher-dashboard] 获取教师主页数据失败', e)
      return error(e.message || '获取教师主页数据失败')
    }
  }
}

