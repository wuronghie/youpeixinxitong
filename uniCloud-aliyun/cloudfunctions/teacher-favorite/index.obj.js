/**
 * 教师收藏云对象
 * 功能：家长收藏教师、取消收藏、查询收藏列表
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

async function resolveUser(ctx, expectedRole = null) {
  const db = uniCloud.database()
  const token = ctx.getUniIdToken()
  if (!token) {
    return { error: error('未获取到token，请先登录') }
  }

  let uid
  try {
    const payload = await ctx.uniID.checkToken(token)
    if (payload.code) {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      uid = parts.length >= 1 ? parts[0] : null
    } else {
      uid = payload.uid
    }
  } catch (err) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      uid = parts.length >= 1 ? parts[0] : null
    } catch (decodeError) {
      console.error('[teacher-favorite] token解析失败', decodeError)
      return { error: error('登录状态失效，请重新登录') }
    }
  }

  if (!uid) {
    return { error: error('登录状态失效，请重新登录') }
  }

  if (!expectedRole) {
    return { uid }
  }

  const userDoc = await db.collection('uni-id-users')
    .doc(uid)
    .field({ role: true })
    .get()

  if (!userDoc.data || userDoc.data.length === 0) {
    return { error: error('用户不存在') }
  }

  const role = userDoc.data[0].role
  if (expectedRole !== 'any' && role !== expectedRole) {
    return { error: error('当前账号无权进行该操作') }
  }

  return { uid, role }
}

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({ clientInfo })
  },

  /**
   * 获取家长收藏列表
   */
  async getParentFavorites() {
    try {
      const auth = await resolveUser(this, 'parent')
      if (auth.error) {
        return auth.error
      }

      const db = uniCloud.database()
      const dbCmd = db.command
      const parent_id = auth.uid

      const favoriteDoc = await db.collection('teacher-favorites')
        .where({ parent_id })
        .orderBy('create_time', 'desc')
        .get()

      const favorites = favoriteDoc.data || []
      if (favorites.length === 0) {
        return success({ list: [], total: 0 }, '获取成功')
      }

      const teacherIds = [...new Set(favorites.map(item => item.teacher_id).filter(Boolean))]
      let teacherMap = {}
      if (teacherIds.length > 0) {
        const [teacherProfiles, teacherUsers, appointments, conversations] = await Promise.all([
          db.collection('teacher-profiles')
            .where({ teacher_id: dbCmd.in(teacherIds) })
            .field({
              teacher_id: true,
              display_name: true,
              avatar: true,
              title: true,
              subjects: true,
              hourly_rate: true,
              is_verified: true,
              rating: true,
              order_count: true
            })
            .get(),
          db.collection('uni-id-users')
            .where({ _id: dbCmd.in(teacherIds) })
            .field({ _id: true, avatar: true, nickname: true })
            .get(),
          db.collection('appointments')
            .where({
              parent_id,
              teacher_id: dbCmd.in(teacherIds),
              status: dbCmd.nin(['cancelled', 'refunded', 'refunding', 'rejected'])
            })
            .field({
              teacher_id: true,
              deposit_paid: true,
              parent_paid: true,
              parent_payment_time: true,
              deposit_payment_time: true,
              schedule_start_time: true,
              status: true
            })
            .get(),
          db.collection('chat-conversations')
            .where({
              parent_id,
              teacher_id: dbCmd.in(teacherIds),
              parent_deleted: dbCmd.neq(true)
            })
            .field({
              teacher_id: true,
              conversation_id: true
            })
            .get()
        ])

        teacherMap = teacherProfiles.data.reduce((map, item) => {
          map[item.teacher_id] = {
            name: item.display_name,
            avatar: item.avatar,
            title: item.title,
            subjects: item.subjects || [],
            hourly_rate: item.hourly_rate || 0,
            is_verified: item.is_verified === true,
            rating: item.rating || 5,
            order_count: item.order_count || 0
          }
          return map
        }, {})

        teacherUsers.data.forEach(user => {
          if (!teacherMap[user._id]) {
            teacherMap[user._id] = {}
          }
          teacherMap[user._id].name = teacherMap[user._id].name || user.nickname || '教师'
          teacherMap[user._id].avatar = teacherMap[user._id].avatar || user.avatar || ''
        })

        const contactSet = new Set()
        const lastPayMap = {}
        appointments.data.forEach(item => {
          if (!item.teacher_id) return
          if (item.deposit_paid === true || item.parent_paid === true) {
            contactSet.add(item.teacher_id)
            const payTime = Number(item.parent_payment_time || item.deposit_payment_time || item.schedule_start_time || item.update_time || item.create_time || Date.now())
            const prev = lastPayMap[item.teacher_id] || 0
            if (payTime > prev) {
              lastPayMap[item.teacher_id] = payTime
            }
          }
        })

        const conversationMap = conversations.data.reduce((map, item) => {
          if (item.teacher_id && item.conversation_id) {
            map[item.teacher_id] = item.conversation_id
          }
          return map
        }, {})

        teacherIds.forEach(id => {
          if (!teacherMap[id]) {
            teacherMap[id] = {}
          }
          const conversationId = conversationMap[id] || ''
          const canContact = contactSet.has(id) && !!conversationId
          teacherMap[id].can_contact = canContact
          teacherMap[id].conversation_id = conversationId
          teacherMap[id].last_pay_time = lastPayMap[id] || 0
        })
      }

      const list = favorites.map(item => {
        const teacherInfo = teacherMap[item.teacher_id] || {}
        return {
          favorite_id: item._id,
          teacher_id: item.teacher_id,
          create_time: item.create_time,
          teacher_name: teacherInfo.name || '教师',
          avatar: teacherInfo.avatar || '',
          title: teacherInfo.title || '',
          subjects: teacherInfo.subjects || [],
          hourly_rate: teacherInfo.hourly_rate || 0,
          rating: teacherInfo.rating || 5,
          order_count: teacherInfo.order_count || 0,
          is_verified: teacherInfo.is_verified === true,
          can_contact: teacherInfo.can_contact === true,
          conversation_id: teacherInfo.conversation_id || '',
          last_pay_time: teacherInfo.last_pay_time || 0
        }
      })

      return success({
        list,
        total: list.length
      }, '获取成功')
    } catch (e) {
      console.error('[teacher-favorite] 获取收藏列表失败', e)
      return error(e.message || '获取收藏列表失败')
    }
  },

  /**
   * 添加收藏
   * @param {Object} params
   * @param {String} params.teacher_id 教师ID
   */
  async addFavorite(params = {}) {
    const { teacher_id } = params
    try {
      const auth = await resolveUser(this, 'parent')
      if (auth.error) {
        return auth.error
      }

      if (!teacher_id) {
        return error('缺少教师ID')
      }

      const db = uniCloud.database()
      const parent_id = auth.uid

      const teacherDoc = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .field({ teacher_id: true, is_verified: true })
        .get()

      if (!teacherDoc.data || teacherDoc.data.length === 0) {
        return error('教师不存在或已下架')
      }

      const exists = await db.collection('teacher-favorites')
        .where({ parent_id, teacher_id })
        .count()

      if (exists.total > 0) {
        return success(null, '已收藏过该教师')
      }

      let latestPayTime = 0
      const appointmentDoc = await db.collection('appointments')
        .where({
          parent_id,
          teacher_id,
          status: db.command.nin(['cancelled', 'refunded', 'refunding', 'rejected'])
        })
        .field({
          deposit_paid: true,
          parent_paid: true,
          parent_payment_time: true,
          deposit_payment_time: true,
          schedule_start_time: true,
          update_time: true,
          create_time: true
        })
        .get()

      appointmentDoc.data.forEach(item => {
        if (item.deposit_paid === true || item.parent_paid === true) {
          const payTime = Number(item.parent_payment_time || item.deposit_payment_time || item.schedule_start_time || item.update_time || item.create_time || Date.now())
          if (payTime > latestPayTime) {
            latestPayTime = payTime
          }
        }
      })

      const addRes = await db.collection('teacher-favorites').add({
        parent_id,
        teacher_id,
        create_time: Date.now(),
        last_pay_time: latestPayTime
      })

      if (!addRes.id) {
        return error('收藏失败，请稍后再试')
      }

      return success({
        favorite_id: addRes.id,
        teacher_id,
        last_pay_time: latestPayTime
      }, '收藏成功')
    } catch (e) {
      console.error('[teacher-favorite] 收藏教师失败', e)
      return error(e.message || '收藏失败')
    }
  },

  /**
   * 取消收藏
   * @param {Object} params
   * @param {String} params.teacher_id 教师ID
   */
  async removeFavorite(params = {}) {
    const { teacher_id } = params
    try {
      const auth = await resolveUser(this, 'parent')
      if (auth.error) {
        return auth.error
      }

      if (!teacher_id) {
        return error('缺少教师ID')
      }

      const db = uniCloud.database()
      const parent_id = auth.uid

      const favoriteDoc = await db.collection('teacher-favorites')
        .where({ parent_id, teacher_id })
        .get()

      if (!favoriteDoc.data || favoriteDoc.data.length === 0) {
        return error('尚未收藏该教师', -2)
      }

      const favoriteId = favoriteDoc.data[0]._id
      await db.collection('teacher-favorites').doc(favoriteId).remove()

      return success({
        teacher_id,
        favorite_id: favoriteId
      }, '已取消收藏')
    } catch (e) {
      console.error('[teacher-favorite] 取消收藏失败', e)
      return error(e.message || '取消收藏失败')
    }
  },

  /**
   * 检查是否已收藏（可选）
   * @param {Object} params
   * @param {String} params.teacher_id 教师ID
   */
  async checkFavorite(params = {}) {
    const { teacher_id } = params
    try {
      const auth = await resolveUser(this, 'parent')
      if (auth.error) {
        return auth.error
      }
      if (!teacher_id) {
        return error('缺少教师ID')
      }
      const db = uniCloud.database()
      const res = await db.collection('teacher-favorites')
        .where({ parent_id: auth.uid, teacher_id })
        .count()

      return success({
        teacher_id,
        favorited: res.total > 0
      }, '查询成功')
    } catch (e) {
      console.error('[teacher-favorite] 检查收藏状态失败', e)
      return error(e.message || '查询失败')
    }
  }
}

