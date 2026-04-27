/**
 * 教师列表云对象
 * 功能：获取教师列表、教师详情、搜索教师
 */

const uniID = require('uni-id-common')

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

module.exports = {
  _before: function() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
  },
  
  /**
   * 获取教师列表
   * @param {Object} params
   * @param {Number} params.page 页码（从1开始）
   * @param {Number} params.pageSize 每页数量
   * @param {String} params.subject 筛选科目
   * @param {String} params.grade 筛选年级
   * @param {String} params.school 筛选院校
   * @param {String} params.experience 筛选资历
   * @param {Number} params.minPrice 最低价格
   * @param {Number} params.maxPrice 最高价格
   * @param {String} params.location 筛选位置（区）
   * @param {Array} params.tags 筛选标签（数组）
   * @param {String} params.sortBy 排序方式（rating-评分, price-价格, newest-最新）
   * @returns {Object}
   */
  async getList(params) {
    const {
      page = 1,
      pageSize = 10,
      subject,
      grade,
      school,
      experience,
      minPrice,
      maxPrice,
      location,
      tags,
      sortBy = 'rating',
      keyword,
      debug = false
    } = params
    
    try {
      const db = uniCloud.database()
      const dbCmd = db.command
      const collection = db.collection('teacher-profiles')
      
      const conditions = [
        { is_verified: true },
        { available: true }
      ]
      
      // 科目筛选
      if (subject) {
        conditions.push({ subjects: dbCmd.in([subject]) })
      }
      
      // 年级筛选
      if (grade) {
        const gradeMap = {
          '小学': ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
          '初中': ['初一', '初二', '初三'],
          '高中': ['高一', '高二', '高三']
        }
        const gradeValues = gradeMap[grade] ? [...gradeMap[grade], grade] : [grade]
        conditions.push({ grades: dbCmd.in(gradeValues) })
      }
      
      // 院校筛选
      if (school) {
        conditions.push({ school: school })
      }
      
      // 资历筛选
      if (experience) {
        conditions.push({ experience: experience })
      }
      
      // 价格筛选
      if (minPrice !== undefined || maxPrice !== undefined) {
        const priceConditions = []
        if (minPrice !== undefined) {
          priceConditions.push(dbCmd.gte(minPrice))
        }
        if (maxPrice !== undefined) {
          priceConditions.push(dbCmd.lte(maxPrice))
        }
        if (priceConditions.length === 1) {
          conditions.push({ hourly_rate: priceConditions[0] })
        } else if (priceConditions.length === 2) {
          conditions.push({ hourly_rate: dbCmd.and(priceConditions) })
        }
      }
      
      // 位置筛选（根据 teaching_areas 数组中的 district 字段）
      if (location) {
        // 查询 teaching_areas 数组中包含指定 district 的记录
        conditions.push({
          'teaching_areas.district': location
        })
      }
      
      // 标签筛选（多选，需要匹配 tags 数组中的任意一个）
      if (tags && Array.isArray(tags) && tags.length > 0) {
        conditions.push({
          tags: dbCmd.in(tags)
        })
      }

      const keywordConditions = []
      let sanitizedKeyword = ''
      if (keyword) {
        sanitizedKeyword = String(keyword)
          .split(/\s+/)
          .filter(Boolean)
          .map(item => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|')
        if (sanitizedKeyword) {
          const reg = new db.RegExp({
            regexp: sanitizedKeyword,
            options: 'i'
          })
          keywordConditions.push({ display_name: reg })
          keywordConditions.push({ name: reg })
          keywordConditions.push({ introduction: reg })
          keywordConditions.push({ subjects: reg })
          keywordConditions.push({ grades: reg })
          keywordConditions.push({ 'education.degree': reg })
          keywordConditions.push({ 'school': reg })
          // 兼容旧数据：同时搜索 education.school
          keywordConditions.push({ 'education.school': reg })
          keywordConditions.push({ 'education.major': reg })
          keywordConditions.push({ 'qualifications.name': reg })
          keywordConditions.push({ 'qualifications.type': reg })
          keywordConditions.push({ specialties: reg })
          keywordConditions.push({ 'teaching_experience.description': reg })
        }
      }
      
      // 确定排序字段
      let orderField = 'rating'
      let orderType = 'desc'
      
      if (sortBy === 'price') {
        orderField = 'hourly_rate'
      } else if (sortBy === 'price_asc') {
        orderField = 'hourly_rate'
        orderType = 'asc'
      } else if (sortBy === 'newest') {
        orderField = 'create_time'
      }
      
      // 计算跳过数量
      const skip = (page - 1) * pageSize
      
      let whereClause
      whereClause = dbCmd.and(conditions)
      
      const finalConditions = conditions.slice()
      if (sanitizedKeyword && keywordConditions.length) {
        finalConditions.push(dbCmd.or(keywordConditions))
      }

      const finalWhere = dbCmd.and(finalConditions)

      let listData = []
      let total = 0

      // 关键词搜索时限制扫描条数，避免全表拉取消耗过大
      const KEYWORD_SCAN_LIMIT = 300
      if (sanitizedKeyword && keywordConditions.length) {
        const rawResult = await collection
          .where(dbCmd.and(conditions))
          .orderBy(orderField, orderType)
          .limit(KEYWORD_SCAN_LIMIT)
          .get()
        const allData = rawResult.data || []
        const regex = new RegExp(sanitizedKeyword, 'i')
        const matchKeyword = (item) => {
          const fields = [
            item.display_name,
            item.name,
            item.introduction,
            ...(Array.isArray(item.subjects) ? item.subjects : []),
            ...(Array.isArray(item.grades) ? item.grades : []),
            item.education?.degree,
            item.school || item.education?.school, // 优先使用 school 字段，兼容旧数据
            item.education?.major,
            ...(Array.isArray(item.qualifications) ? item.qualifications.map(q => q.name || q.type || '') : []),
            ...(Array.isArray(item.specialties) ? item.specialties : []),
            item.teaching_experience?.description
          ]
          return fields.some(field => field && regex.test(String(field)))
        }
        const filtered = allData.filter(matchKeyword)
        total = filtered.length
        listData = filtered.slice(skip, skip + pageSize)
      } else {
        const result = await collection
          .where(finalWhere)
          .orderBy(orderField, orderType)
          .skip(skip)
          .limit(pageSize)
          .get()
        listData = result.data || []
        const countResult = await collection.where(finalWhere).count()
        total = countResult.total || 0
      }

      // 进一步修正价格排序，确保“价格从低到高/从高到低”在前端看到的顺序与 hourly_rate 一致
      if (listData.length > 0 && (sortBy === 'price' || sortBy === 'price_asc')) {
        // 将无效或缺失价格视为“未知价格”，在升序时排在最后，在降序时排在最前
        const withValidPrice = []
        const withoutPrice = []
        listData.forEach(item => {
          const rate = typeof item.hourly_rate === 'number'
            ? item.hourly_rate
            : Number(item.hourly_rate || 0)
          if (rate && !Number.isNaN(rate)) {
            item._normalized_rate = rate
            withValidPrice.push(item)
          } else {
            item._normalized_rate = null
            withoutPrice.push(item)
          }
        })

        if (sortBy === 'price_asc') {
          withValidPrice.sort((a, b) => a._normalized_rate - b._normalized_rate)
          // 升序：无价格的老师排在最后
          listData = [...withValidPrice, ...withoutPrice]
        } else if (sortBy === 'price') {
          withValidPrice.sort((a, b) => b._normalized_rate - a._normalized_rate)
          // 降序：无价格的老师排在最后
          listData = [...withValidPrice, ...withoutPrice]
        }
      }

      // 为每个教师计算试课统计数据
      if (listData.length > 0) {
        const teacherIds = listData.map(t => t.teacher_id || t._id).filter(Boolean)
        if (teacherIds.length > 0) {
          // 批量查询试课数据
          const trialAppointments = await db.collection('appointments')
            .where({
              teacher_id: dbCmd.in(teacherIds),
              course_type: 'trial',
              status: dbCmd.in(['completed', 'refunded', 'cancelled'])
            })
            .get()
          
          // 按 teacher_id 分组统计
          const trialStatsMap = {}
          if (trialAppointments.data) {
            teacherIds.forEach(teacherId => {
              const teacherTrials = trialAppointments.data.filter(a => a.teacher_id === teacherId)
              const trialCount = teacherTrials.length
              const trialSuccessCount = teacherTrials.filter(a => {
                const isCompleted = a.status === 'completed'
                // 兼容历史数据：早期已完成试课可能没有写入 trial_result，也视为成功
                const isSuccess = !a.trial_result || a.trial_result === 'success'
                return isCompleted && isSuccess
              }).length
              const trialSuccessRate = trialCount > 0 ? (trialSuccessCount / trialCount) : 0
              
              trialStatsMap[teacherId] = {
                trial_count: trialCount,
                trial_success_count: trialSuccessCount,
                trial_success_rate: Number(trialSuccessRate.toFixed(2))
              }
            })
          }
          
          // 将统计数据添加到每个教师信息中
          listData.forEach(teacher => {
            const teacherId = teacher.teacher_id || teacher._id
            const stats = trialStatsMap[teacherId] || {
              trial_count: teacher.trial_count || 0,
              trial_success_count: teacher.trial_success_count || 0,
              trial_success_rate: teacher.trial_success_rate || 0
            }
            teacher.trial_count = stats.trial_count
            teacher.trial_success_count = stats.trial_success_count
            teacher.trial_success_rate = stats.trial_success_rate
          })
        }
      }

      return success({
        list: listData,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasMore: skip + listData.length < total
        },
        debugInfo: debug ? {
          params: {
            page,
            pageSize,
            subject,
            grade,
            school,
            experience,
            minPrice,
            maxPrice,
            location,
            tags,
            sortBy,
            keyword
          },
          appliedConditions: finalConditions
        } : undefined
      })
      
    } catch (e) {
      console.error('获取教师列表失败:', e)
      return error(e.message || '获取教师列表失败')
    }
  },
  
  /**
   * 获取教师详情
   * @param {Object} params
   * @param {String} params.teacherId 教师ID
   * @returns {Object}
   */
  async getDetail(params) {
    const { teacherId } = params
    
    if (!teacherId) {
      return error('教师ID不能为空')
    }
    
    try {
      const db = uniCloud.database()
      
      const profileCollection = db.collection('teacher-profiles')
      let profileResult = await profileCollection
        .doc(teacherId)
        .get()
      
      // 如果使用 doc 查询不到，尝试按 teacher_id 查询（兼容旧参数）
      if (!profileResult.data || profileResult.data.length === 0) {
        profileResult = await profileCollection
          .where({
            teacher_id: teacherId
          })
          .get()
      }
      
      if (!profileResult.data || profileResult.data.length === 0) {
        return error('教师不存在')
      }
      
      const profile = profileResult.data[0]
      
      // 从profile中获取teacher_id（关联的uni-id-users的用户ID）
      const userId = profile.teacher_id || teacherId
      const dbCmd = db.command

      // 并行请求：用户信息、评价、课表、试课统计，减少串行等待与总耗时
      const [userResult, reviewsResult, scheduleResult, trialAppointments] = await Promise.all([
        db.collection('uni-id-users')
          .doc(userId)
          .field({ nickname: true, avatar: true, gender: true })
          .get(),
        db.collection('reviews')
          .where({ teacher_id: userId })
          .orderBy('create_time', 'desc')
          .limit(5)
          .get(),
        db.collection('teacher-schedule')
          .where({ teacher_id: userId })
          .get(),
        db.collection('appointments')
          .where({
            teacher_id: userId,
            course_type: 'trial',
            status: dbCmd.in(['completed', 'refunded', 'cancelled'])
          })
          .field({ status: true, trial_result: true })
          .get()
      ])
      
      const userInfo = userResult.data && userResult.data.length > 0 ? userResult.data[0] : {}
      
      const trialCount = trialAppointments.data ? trialAppointments.data.length : 0
      const trialSuccessCount = trialAppointments.data
        ? trialAppointments.data.filter(a => {
            const isCompleted = a.status === 'completed'
            // 兼容历史数据：早期已完成试课可能没有写入 trial_result，也视为成功
            const isSuccess = !a.trial_result || a.trial_result === 'success'
            return isCompleted && isSuccess
          }).length
        : 0
      const trialSuccessRate = trialCount > 0 ? (trialSuccessCount / trialCount) : 0
      
      // 格式化数据，确保字段名与前端一致
      const formattedData = {
        ...profile,
        _id: profile._id || teacherId,
        name: profile.display_name || profile.name || userInfo.nickname || '教师',
        display_name: profile.display_name || userInfo.nickname || '教师',
        avatar: profile.avatar || userInfo.avatar || '',
        gender: profile.gender || userInfo.gender || '',
        nickname: userInfo.nickname || profile.display_name || '教师',
        title: profile.title || '专业教师', // 可能不存在，使用默认值
        teacher_id: profile.teacher_id || userId,
        subjects: profile.subjects || [],
        grades: profile.grades || [],
        teaching_methods: profile.teaching_methods || ['online', 'offline'], // 默认支持两种方式
        hourly_rate: profile.hourly_rate || 100,
        rating: profile.rating || 5.0,
        review_count: profile.review_count || 0,
        total_students: profile.total_students || 0,
        total_courses: profile.total_courses || 0,
        total_hours: profile.total_hours || profile.total_courses * 2 || 0, // 如果没有，用课程数*2估算
        trial_count: trialCount, // 试课次数（实时计算）
        trial_success_count: trialSuccessCount, // 试课成功次数（实时计算）
        trial_success_rate: Number(trialSuccessRate.toFixed(2)), // 试课成功率（实时计算，保留2位小数）
        experience_years: profile.teaching_experience?.years || 0, // 教龄（年数）
        experience: profile.experience || '', // 教师资历（新增字段）
        school: profile.school || '', // 所在院校（新增字段）
        tags: profile.tags || [], // 附加标签（新增字段）
        introduction: profile.introduction || '',
        specialties: profile.specialties || [], // 可能不存在
        education: profile.education || null,
        qualifications: profile.qualifications || [],
        is_verified: profile.is_verified !== undefined ? profile.is_verified : false,
        available: profile.available !== undefined ? profile.available : true,
        teacher_info: userInfo || {},
        recent_reviews: reviewsResult.data || [],
        schedule: scheduleResult.data && scheduleResult.data.length > 0 ? scheduleResult.data[0] : null
      }
      
      return success(formattedData)
      
    } catch (e) {
      console.error('获取教师详情失败:', e)
      return error(e.message || '获取教师详情失败')
    }
  },
  
  /**
   * 搜索教师
   * @param {Object} params
   * @param {String} params.keyword 关键词
   * @param {Number} params.page 页码
   * @param {Number} params.pageSize 每页数量
   * @returns {Object}
   */
  async search(params) {
    const {
      keyword,
      page = 1,
      pageSize = 10
    } = params
    
    if (!keyword) {
      return error('搜索关键词不能为空')
    }
    
    try {
      const db = uniCloud.database()
      const dbCmd = db.command
      const collection = db.collection('teacher-profiles')
      
      // 构建搜索条件（模糊匹配姓名或介绍）
      const where = dbCmd.and([
        {
          is_verified: true,
          available: true
        },
        dbCmd.or([
          {
            display_name: new db.RegExp({ regexp: keyword, options: 'i' })
          },
          {
            introduction: new db.RegExp({ regexp: keyword, options: 'i' })
          }
        ])
      ])
      
      const skip = (page - 1) * pageSize
      
      const result = await collection
        .where(where)
        .orderBy('rating', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      
      const countResult = await collection.where(where).count()
      
      return success({
        list: result.data,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize),
          hasMore: skip + result.data.length < countResult.total
        }
      })
      
    } catch (e) {
      console.error('搜索教师失败:', e)
      return error(e.message || '搜索教师失败')
    }
  }
}

