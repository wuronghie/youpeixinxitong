const uniID = require('uni-id-common')

const COLLECTION = 'system-messages'

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

async function resolveUserId(context) {
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
   * 获取教师系统消息列表
   * @param {Object} params
   * @param {String} params.type 消息类型 all|system|appointment|payment
   * @param {Number} params.page 页码
   * @param {Number} params.pageSize 每页数量
   */
  async getList(params = {}) {
    const db = uniCloud.database()
    const _ = db.command
    const $ = _.aggregate

    const {
      type = 'all',
      page = 1,
      pageSize = 20
    } = params

    try {
      const user_id = await resolveUserId(this)

      const where = { user_id }
      if (type !== 'all') {
        where.message_type = type
      }

      const collection = db.collection(COLLECTION)
      const skip = Math.max(page - 1, 0) * pageSize

      const listRes = await collection
        .where(where)
        .orderBy('create_time', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()

      const totalRes = await collection.where(where).count()

      const statsAgg = await collection
        .aggregate()
        .match({ user_id })
        .group({
          _id: '$message_type',
          total: $.sum(1),
          unread: $.sum($.cond([{ $eq: ['$is_read', false] }, 1, 0]))
        })
        .end()

      const unreadAllRes = await collection
        .where({ user_id, is_read: false })
        .count()

      const perTypeStats = statsAgg.data || []
      const tabStats = perTypeStats.reduce((acc, cur) => {
        acc[cur._id || 'system'] = {
          total: cur.total || 0,
          unread: cur.unread || 0
        }
        return acc
      }, {})

      const list = (listRes.data || []).map(item => ({
        _id: item._id,
        message_id: item._id,
        type: item.type || item.message_type || 'system',
        title: item.title || '系统通知',
        content: item.content || '',
        is_read: !!item.is_read,
        status: item.status || 'normal',
        // 从 action 对象中提取 path，或使用 action_url 字段
        action_url: item.action?.path || item.action_url || '',
        ext_data: item.ext_data || {},
        create_time: item.create_time || Date.now()
      }))

      return success({
        list,
        pagination: {
          page,
          pageSize,
          total: totalRes.total || 0
        },
        stats: {
          total: totalRes.total || 0,
          unread: unreadAllRes.total || 0,
          perType: {
            system: tabStats.system || { total: 0, unread: 0 },
            appointment: tabStats.appointment || { total: 0, unread: 0 },
            payment: tabStats.payment || { total: 0, unread: 0 }
          }
        }
      })
    } catch (e) {
      console.error('[teacher-message] 获取消息列表失败', e)
      return error(e.message || '获取消息失败')
    }
  },

  /**
   * 标记单条消息为已读
   * @param {Object} params
   * @param {String} params.message_id
   */
  async markRead(params = {}) {
    const db = uniCloud.database()
    const { message_id } = params

    if (!message_id) {
      return error('缺少消息ID')
    }

    try {
      const user_id = await resolveUserId(this)
      const docRes = await db.collection(COLLECTION).doc(message_id).get()
      if (!docRes.data || docRes.data.length === 0) {
        return error('消息不存在')
      }

      const message = docRes.data[0]
      if (message.user_id !== user_id) {
        return error('无权操作此消息')
      }

      if (message.is_read) {
        return success({ message_id }, '已是已读状态')
      }

      await db.collection(COLLECTION).doc(message_id).update({
        is_read: true,
        read_time: Date.now()
      })

      return success({ message_id }, '标记成功')
    } catch (e) {
      console.error('[teacher-message] 标记消息已读失败', e)
      return error(e.message || '标记失败')
    }
  },

  /**
   * 按类型批量标记为已读
   * @param {Object} params
   * @param {String} params.type all|system|appointment|payment
   */
  async markAllRead(params = {}) {
    const db = uniCloud.database()
    const { type = 'all' } = params

    try {
      const user_id = await resolveUserId(this)
      const where = { user_id, is_read: false }
      if (type !== 'all') {
        where.message_type = type
      }

      await db.collection(COLLECTION)
        .where(where)
        .update({
          is_read: true,
          read_time: Date.now()
        })

      return success(null, '全部已读')
    } catch (e) {
      console.error('[teacher-message] 批量标记消息已读失败', e)
      return error(e.message || '操作失败')
    }
  },

  /**
   * 发送系统消息给教师（管理员功能）
   * @param {Object} params
   * @param {String} params.teacher_id 教师用户ID
   * @param {String} params.type 消息类型 system|appointment|payment|review|withdraw
   * @param {String} params.title 消息标题
   * @param {String} params.content 消息内容
   * @param {String} params.related_id 关联的业务ID（可选）
   * @param {String} params.action_path 跳转路径（可选）
   * @returns {Object}
   */
  async sendMessage(params = {}) {
    const db = uniCloud.database()
    const {
      teacher_id,
      type = 'system',
      title,
      content,
      related_id = '',
      action_path = ''
    } = params

    try {
      // 参数验证
      if (!teacher_id) {
        return error('教师ID不能为空')
      }
      if (!title) {
        return error('消息标题不能为空')
      }
      if (!content) {
        return error('消息内容不能为空')
      }

      // 验证消息类型
      const validTypes = ['system', 'appointment', 'payment', 'review', 'withdraw']
      if (!validTypes.includes(type)) {
        return error(`消息类型必须是以下之一：${validTypes.join('、')}`)
      }

      // 验证教师是否存在
      const userDoc = await db.collection('uni-id-users')
        .doc(teacher_id)
        .field({ role: true })
        .get()

      if (!userDoc.data || userDoc.data.length === 0) {
        return error('教师用户不存在')
      }

      if (userDoc.data[0].role !== 'teacher') {
        return error('该用户不是教师角色')
      }

      // 创建系统消息
      const messageData = {
        user_id: teacher_id,
        type: type,
        title: title,
        content: content,
        related_id: related_id || '',
        is_read: false
      }

      // 如果有跳转路径，设置 action
      if (action_path) {
        messageData.action = {
          type: 'navigate',
          path: action_path
        }
        messageData.action_url = action_path
      }

      const result = await db.collection(COLLECTION).add(messageData)

      if (!result.id) {
        return error('创建系统消息失败')
      }

      console.log(`已向教师 ${teacher_id} 发送系统消息：${title}`)

      return success({
        message_id: result.id,
        teacher_id,
        title,
        type
      }, '消息发送成功')

    } catch (e) {
      console.error('[teacher-message] 发送系统消息失败', e)
      return error(e.message || '发送失败')
    }
  }
}
