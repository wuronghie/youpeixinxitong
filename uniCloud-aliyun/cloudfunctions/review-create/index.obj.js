/**
 * 评价云对象
 * 功能：创建评价、获取评价列表
 */

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
    // 云对象前置方法
  },
  
  /**
   * 创建评价
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {Number} params.rating 评分（1-5）
   * @param {Array} params.tags 标签
   * @param {String} params.content 评价内容
   * @returns {Object}
   */
  async create(params) {
    const {
      appointment_id,
      rating,
      tags = [],
      content = ''
    } = params
    
    try {
      const db = uniCloud.database()
      const uniIdCommon = require('uni-id-common')
      
      // 1. 验证用户登录状态
      const payload = await uniIdCommon.checkToken(this.getClientInfo().uniIdToken)
      if (!payload || !payload.uid) {
        return error('请先登录')
      }
      
      const parent_id = payload.uid
      
      // 2. 参数验证
      if (!appointment_id) {
        return error('预约ID不能为空')
      }
      
      if (!rating || rating < 1 || rating > 5) {
        return error('评分必须在1-5之间')
      }
      
      // 3. 查询预约信息
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 4. 验证权限
      if (appointment.parent_id !== parent_id) {
        return error('只能评价自己的预约')
      }
      
      if (appointment.status !== 'completed') {
        return error('只有已完成的课程才能评价')
      }
      
      // 5. 检查是否已评价
      const existReviewCount = await db.collection('reviews')
        .where({ appointment_id })
        .count()
      
      if (existReviewCount.total > 0) {
        return error('该课程已评价，不能重复评价')
      }
      
      // 6. 创建评价
      const review = {
        appointment_id,
        teacher_id: appointment.teacher_id,
        parent_id,
        rating,
        tags,
        content,
        course_type: appointment.course_type,
        subject: appointment.student_info.subject,
        create_time: Date.now()
      }
      
      const result = await db.collection('reviews').add(review)
      
      if (!result.id) {
        return error('创建评价失败')
      }
      
      // 7. 更新教师评分
      // 查询该教师的所有评价
      const allReviews = await db.collection('reviews')
        .where({ teacher_id: appointment.teacher_id })
        .field({ rating: true })
        .get()
      
      if (allReviews.data && allReviews.data.length > 0) {
        // 计算平均评分
        const totalRating = allReviews.data.reduce((sum, r) => sum + r.rating, 0)
        const avgRating = Math.round((totalRating / allReviews.data.length) * 10) / 10
        
        // 更新教师主页
        await db.collection('teacher-profiles')
          .where({ teacher_id: appointment.teacher_id })
          .update({
            rating: avgRating,
            review_count: allReviews.data.length,
            update_time: Date.now()
          })
        
        console.log(`教师评分已更新：${avgRating}分（${allReviews.data.length}条评价）`)
      }
      
      // 8. 标记预约已评价
      await db.collection('appointments').doc(appointment_id).update({
        is_reviewed: true,
        update_time: Date.now()
      })
      
      console.log('评价创建成功:', result.id)
      
      return success({
        review_id: result.id,
        rating,
        tags,
        content
      }, '评价成功')
      
    } catch (e) {
      console.error('创建评价失败:', e)
      return error(e.message || '评价失败')
    }
  },
  
  /**
   * 获取教师的评价列表
   * @param {Object} params
   * @param {String} params.teacher_id 教师ID
   * @param {Number} params.page 页码
   * @param {Number} params.page_size 每页数量
   * @returns {Object}
   */
  async getList(params) {
    const {
      teacher_id,
      page = 1,
      page_size = 20
    } = params
    
    try {
      const db = uniCloud.database()
      
      if (!teacher_id) {
        return error('教师ID不能为空')
      }
      
      // 1. 查询评价列表
      const result = await db.collection('reviews')
        .where({ teacher_id })
        .orderBy('create_time', 'desc')
        .skip((page - 1) * page_size)
        .limit(page_size)
        .get()
      
      // 2. 关联家长信息
      if (result.data && result.data.length > 0) {
        const parentIds = [...new Set(result.data.map(item => item.parent_id))]
        const parents = await db.collection('uni-id-users')
          .where({ _id: db.command.in(parentIds) })
          .field({ _id: true, nickname: true, avatar: true })
          .get()
        
        const parentMap = {}
        parents.data.forEach(p => {
          parentMap[p._id] = {
            nickname: p.nickname || '家长',
            avatar: p.avatar || ''
          }
        })
        
        result.data.forEach(item => {
          item.parent_info = parentMap[item.parent_id] || {}
          // 隐藏家长ID，保护隐私
          delete item.parent_id
        })
      }
      
      // 3. 统计总数
      const countResult = await db.collection('reviews')
        .where({ teacher_id })
        .count()
      
      console.log(`查询到${result.data.length}条评价`)
      
      return success({
        list: result.data,
        total: countResult.total,
        page,
        page_size
      })
      
    } catch (e) {
      console.error('获取评价列表失败:', e)
      return error(e.message || '获取失败')
    }
  },
  
  /**
   * 获取评价统计
   * @param {Object} params
   * @param {String} params.teacher_id 教师ID
   * @returns {Object}
   */
  async getStatistics(params) {
    const { teacher_id } = params
    
    try {
      const db = uniCloud.database()
      
      if (!teacher_id) {
        return error('教师ID不能为空')
      }
      
      // 1. 获取所有评价
      const result = await db.collection('reviews')
        .where({ teacher_id })
        .field({ rating: true, tags: true })
        .get()
      
      if (!result.data || result.data.length === 0) {
        return success({
          total: 0,
          avg_rating: 0,
          rating_distribution: {
            '5': 0, '4': 0, '3': 0, '2': 0, '1': 0
          },
          top_tags: []
        })
      }
      
      // 2. 计算评分分布
      const ratingDistribution = {
        '5': 0, '4': 0, '3': 0, '2': 0, '1': 0
      }
      
      result.data.forEach(review => {
        ratingDistribution[review.rating.toString()]++
      })
      
      // 3. 统计热门标签
      const tagCount = {}
      result.data.forEach(review => {
        if (review.tags && Array.isArray(review.tags)) {
          review.tags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1
          })
        }
      })
      
      // 排序取前10个
      const topTags = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }))
      
      // 4. 计算平均分
      const totalRating = result.data.reduce((sum, r) => sum + r.rating, 0)
      const avgRating = Math.round((totalRating / result.data.length) * 10) / 10
      
      return success({
        total: result.data.length,
        avg_rating: avgRating,
        rating_distribution: ratingDistribution,
        top_tags: topTags
      })
      
    } catch (e) {
      console.error('获取评价统计失败:', e)
      return error(e.message || '获取失败')
    }
  },
  
  /**
   * 获取用户信息（内部方法）
   */
  getClientInfo() {
    return this.getUniCloudClientInfo ? this.getUniCloudClientInfo() : {}
  }
}

