const uniID = require('uni-id-common')

const REVIEW_COLLECTION = 'reviews'
const PROFILE_COLLECTION = 'user-profiles'
const USER_COLLECTION = 'uni-id-users'

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

const POSITIVE_RATING_THRESHOLD = 4

async function updateTeacherReviewStats(db, teacher_id) {
  const allReviews = await db.collection(REVIEW_COLLECTION)
    .where({ teacher_id })
    .field({ rating: true })
    .get()

  const reviews = allReviews.data || []
  if (reviews.length === 0) {
    await db.collection('teacher-profiles')
      .where({ teacher_id })
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
  const avgRating = Math.round((totalRating / total) * 10) / 10
  const positiveRate = Math.round((positiveCount / total) * 100)

  await db.collection('teacher-profiles')
    .where({ teacher_id })
    .update({
      rating: avgRating,
      review_count: total,
      positive_rate: positiveRate,
      update_time: Date.now()
    })
}

async function resolveTeacherId(context) {
  const token = context.getUniIdToken()
  if (!token) {
    throw new Error('未获取到token，请先登录')
  }

  try {
    const payload = await context.uniID.checkToken(token)
    if (payload.code) {
      throw new Error(payload.message || 'token校验失败')
    }
    return payload.uid
  } catch (err) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      if (parts.length >= 1) {
        return parts[0]
      }
    } catch (decodeError) {
      // ignore
    }
    throw new Error('token验证失败，请重新登录')
  }
}

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({ clientInfo })
  },

  /**
   * 家长提交评价
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {Number} params.rating 评分（1-5）
   * @param {Array} params.tags 评价标签
   * @param {String} params.content 文字评价
   * @param {Boolean|null} params.is_satisfied 试课结果
   */
  async submit(params = {}) {
    const db = uniCloud.database()
    const {
      appointment_id,
      rating,
      tags = [],
      content = '',
      is_satisfied = null
    } = params

    try {
      const token = this.getUniIdToken()
      if (!token) {
        return error('未获取到token，请先登录')
      }
      let parent_id
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          parent_id = parts.length >= 1 ? parts[0] : null
        } else {
          parent_id = payload.uid
        }
      } catch (e) {
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        parent_id = parts.length >= 1 ? parts[0] : null
      }

      if (!parent_id) {
        return error('token验证失败，请重新登录')
      }

      if (!appointment_id) {
        return error('预约ID不能为空')
      }
      const score = Number(rating)
      if (!score || score < 1 || score > 5) {
        return error('请给出1-5星评分')
      }
      if (!content || !content.trim()) {
        return error('请填写评价内容')
      }

      const userDoc = await db.collection(USER_COLLECTION).doc(parent_id).get()
      if (!userDoc.data || userDoc.data.length === 0) {
        return error('用户不存在')
      }
      const userInfo = userDoc.data[0]
      const role = Array.isArray(userInfo.role) ? userInfo.role : [userInfo.role]
      if (!role.includes('parent')) {
        return error('只有家长可以提交评价')
      }

      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      const appointment = appointmentDoc.data[0]
      if (appointment.parent_id !== parent_id) {
        return error('只能评价自己的预约')
      }
      if (appointment.status !== 'completed') {
        return error('课程确认完成后才能评价')
      }

      const existing = await db.collection(REVIEW_COLLECTION)
        .where({ appointment_id })
        .count()
      if (existing.total > 0) {
        return error('本次预约已提交过评价')
      }

      const teacher_id = appointment.teacher_id
      if (!teacher_id) {
        return error('缺少教师信息，无法提交评价')
      }

      const parentProfileDoc = await db.collection(PROFILE_COLLECTION)
        .where({ uid: parent_id })
        .field({ display_name: true, nick_name: true, avatar: true })
        .limit(1)
        .get()
      const parentProfile = parentProfileDoc.data && parentProfileDoc.data.length > 0
        ? parentProfileDoc.data[0]
        : {}

      const teacherProfileDoc = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .field({
          teacher_id: true,
          display_name: true,
          avatar: true,
          subjects: true
        })
        .limit(1)
        .get()
      const teacherProfile = teacherProfileDoc.data && teacherProfileDoc.data.length > 0
        ? teacherProfileDoc.data[0]
        : {}

      const now = Date.now()
      const reviewData = {
        appointment_id,
        teacher_id,
        parent_id,
        rating: score,
        tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
        content: content.trim(),
        is_satisfied: typeof is_satisfied === 'boolean' ? is_satisfied : null,
        status: 'published',
        teacher_name: teacherProfile.display_name || appointment.teacher_name || '',
        teacher_avatar: teacherProfile.avatar || '',
        subjects: teacherProfile.subjects || [],
        parent_name: parentProfile.display_name || parentProfile.nick_name || userInfo.nickname || '家长',
        parent_avatar: parentProfile.avatar || userInfo.avatar || '',
        create_time: now,
        update_time: now
      }

      const addRes = await db.collection(REVIEW_COLLECTION).add(reviewData)
      if (!addRes.id) {
        return error('提交评价失败')
      }

      await db.collection('appointments').doc(appointment_id).update({
        has_review: true,
        review_id: addRes.id,
        update_time: now
      })

      await db.collection('payment-orders')
        .where({
          appointment_id,
          order_type: 'course_fee'
        })
        .update({
          has_review: true,
          review_id: addRes.id,
          update_time: now
        })

      await updateTeacherReviewStats(db, teacher_id)

      return success({ review_id: addRes.id }, '评价提交成功')
    } catch (e) {
      console.error('[teacher-review] 提交评价失败', e)
      return error(e.message || '提交评价失败')
    }
  },

  /**
   * 获取教师评价列表
   * @param {Object} params
   * @param {Number} params.page
   * @param {Number} params.pageSize
   * @param {String} params.status all|unreplied|replied
   * @param {Number} params.rating 指定星级筛选，可选
   */
  async getList(params = {}) {
    const db = uniCloud.database()
    const _ = db.command

    const {
      page = 1,
      pageSize = 20,
      status = 'all',
      rating
    } = params

    try {
      const teacher_id = await resolveTeacherId(this)
      const skip = Math.max(page - 1, 0) * pageSize

      const where = { teacher_id }
      if (typeof rating === 'number' && rating > 0) {
        where.rating = rating
      }
      if (status === 'unreplied') {
        where.teacher_reply = _.exists(false)
      } else if (status === 'replied') {
        where.teacher_reply = _.exists(true)
      }

      const reviewCollection = db.collection(REVIEW_COLLECTION)
      const listRes = await reviewCollection
        .where(where)
        .orderBy('create_time', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()

      const countPromise = reviewCollection.where(where).count()
      const statsPromise = reviewCollection.where({ teacher_id }).field({ rating: true, teacher_reply: true }).get()

      const [countRes, statsRes] = await Promise.all([countPromise, statsPromise])

      const reviews = listRes.data || []
      const parentIds = reviews.map(item => item.parent_id).filter(Boolean)
      let parentMap = {}
      if (parentIds.length > 0) {
        const parentRes = await db.collection(PROFILE_COLLECTION)
          .where({ uid: _.in(parentIds) })
          .field({ uid: true, nick_name: true, avatar: true, role: true, display_name: true })
          .get()
        parentMap = (parentRes.data || []).reduce((acc, cur) => {
          acc[cur.uid] = cur
          return acc
        }, {})
      }

      const formatted = reviews.map(item => {
        const parentProfile = parentMap[item.parent_id] || {}
        return {
          _id: item._id,
          review_id: item._id,
          appointment_id: item.appointment_id,
          parent_id: item.parent_id,
          parent_name: item.parent_name || parentProfile.display_name || parentProfile.nick_name || '家长',
          parent_avatar: item.parent_avatar || parentProfile.avatar || '',
          rating: Number(item.rating || 0),
          tags: item.tags || [],
          content: item.content || '',
          create_time: item.create_time || item.submit_time || Date.now(),
          teacher_reply: item.teacher_reply || '',
          reply_time: item.reply_time || null
        }
      })

      const allReviews = statsRes.data || []
      const total = allReviews.length
      const repliedCount = allReviews.filter(item => item.teacher_reply).length
      const unrepliedCount = total - repliedCount
      const ratingStats = [1, 2, 3, 4, 5].map(star => ({
        star,
        count: allReviews.filter(item => Number(item.rating) === star).length
      }))
      const averageRating = total > 0
        ? (allReviews.reduce((sum, cur) => sum + Number(cur.rating || 0), 0) / total).toFixed(1)
        : '0.0'

      return success({
        list: formatted,
        pagination: {
          page,
          pageSize,
          total: countRes.total || 0
        },
        stats: {
          total,
          replied: repliedCount,
          unreplied: unrepliedCount,
          averageRating,
          ratingStats
        }
      })
    } catch (e) {
      console.error('[teacher-review] 获取评价列表失败', e)
      return error(e.message || '获取评价列表失败')
    }
  },

  /**
   * 教师回复评价
   * @param {Object} params
   * @param {String} params.review_id
   * @param {String} params.reply_content
   */
  async reply(params = {}) {
    const db = uniCloud.database()
    const { review_id, reply_content } = params

    if (!review_id) {
      return error('缺少评价ID')
    }
    if (!reply_content || !reply_content.trim()) {
      return error('回复内容不能为空')
    }

    try {
      const teacher_id = await resolveTeacherId(this)
      const reviewCollection = db.collection(REVIEW_COLLECTION)

      const reviewDoc = await reviewCollection.doc(review_id).get()
      if (!reviewDoc.data || reviewDoc.data.length === 0) {
        return error('评价不存在')
      }
      const review = reviewDoc.data[0]
      if (review.teacher_id !== teacher_id) {
        return error('无权回复该评价')
      }

      const now = Date.now()
      const updateRes = await reviewCollection.doc(review_id).update({
        teacher_reply: reply_content,
        reply_time: now,
        update_time: now
      })

      if (!updateRes.updated) {
        throw new Error('回复评价失败')
      }

      return success({ review_id, reply_time: now }, '回复成功')
    } catch (e) {
      console.error('[teacher-review] 回复评价失败', e)
      return error(e.message || '回复评价失败')
    }
  }
}
