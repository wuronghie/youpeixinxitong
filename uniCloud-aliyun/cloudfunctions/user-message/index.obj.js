/**
 * 家长系统消息云对象
 */

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

async function resolveUserId(context, expectedRole = 'parent') {
  const token = context.getUniIdToken()
  if (!token) {
    throw new Error('未获取到token，请先登录')
  }

  let uid
  try {
    const payload = await context.uniID.checkToken(token)
    if (payload.code) {
      throw new Error(payload.message || 'token校验失败')
    }
    uid = payload.uid
  } catch (err) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      if (parts.length >= 1) {
        uid = parts[0]
      }
    } catch (decodeError) {
      // ignore
    }
  }

  if (!uid) {
    throw new Error('token验证失败，请重新登录')
  }

  if (expectedRole) {
    const db = uniCloud.database()
    const userDoc = await db.collection('uni-id-users')
      .doc(uid)
      .field({ role: true })
      .get()
    if (!userDoc.data || userDoc.data.length === 0) {
      throw new Error('用户不存在')
    }
    const role = userDoc.data[0].role
    if (role !== expectedRole) {
      throw new Error('当前账号无权操作系统消息')
    }
  }

  return uid
}

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({ clientInfo })
  },

  /**
   * 获取家长系统消息列表
   * @param {Object} params
   * @param {String} params.type 消息类型 all|system|appointment|payment|review|refund
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
      const user_id = await resolveUserId(this, 'parent')

      const where = {
        user_id,
        user_role: _.in(['parent', null])
      }
      if (type !== 'all') {
        where.type = type
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
        .match({
          user_id,
          user_role: _.in(['parent', null])
        })
        .group({
          _id: '$type',
          total: $.sum(1),
          unread: $.sum($.cond([{ $eq: ['$is_read', false] }, 1, 0]))
        })
        .end()

      const unreadAllRes = await collection
        .where({ user_id, user_role: _.in(['parent', null]), is_read: false })
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
            payment: tabStats.payment || { total: 0, unread: 0 },
            review: tabStats.review || { total: 0, unread: 0 },
            refund: tabStats.refund || { total: 0, unread: 0 },
            recruitment: tabStats.recruitment || { total: 0, unread: 0 }
          }
        }
      })
    } catch (e) {
      console.error('[user-message] 获取消息列表失败', e)
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
      const user_id = await resolveUserId(this, 'parent')
      const docRes = await db.collection(COLLECTION).doc(message_id).get()
      if (!docRes.data || docRes.data.length === 0) {
        return error('消息不存在')
      }

      const message = docRes.data[0]
      if (message.user_id !== user_id || (message.user_role && message.user_role !== 'parent')) {
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
      console.error('[user-message] 标记消息已读失败', e)
      return error(e.message || '标记失败')
    }
  },

  /**
   * 按类型批量标记为已读
   * @param {Object} params
   * @param {String} params.type all|system|appointment|payment|review|refund
   */
  async markAllRead(params = {}) {
    const db = uniCloud.database()
    const { type = 'all' } = params

    try {
      const user_id = await resolveUserId(this, 'parent')
      const where = {
        user_id,
        user_role: db.command.in(['parent', null]),
        is_read: false
      }
      if (type !== 'all') {
        where.type = type
      }

      await db.collection(COLLECTION)
        .where(where)
        .update({
          is_read: true,
          read_time: Date.now()
        })

      return success(null, '全部已读')
    } catch (e) {
      console.error('[user-message] 批量标记消息已读失败', e)
      return error(e.message || '操作失败')
    }
  }
}

