/**
 * 聊天云对象
 * 功能：发送消息、获取消息列表、标记已读
 * 使用 uni-id-common 进行 token 验证
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
    // 云对象前置方法，初始化 uni-id 实例
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
  },
  
  /**
   * 发送消息
   * @param {Object} params
   * @param {String} params.conversation_id 会话ID
   * @param {String} params.message_type 消息类型（text/image/voice）
   * @param {String} params.content 消息内容
   * @returns {Object}
   */
  async send(params) {
    const {
      conversation_id,
      message_type = 'text',
      content
    } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 获取发送者ID（从token中获取）
      const token = this.getUniIdToken()
      let sender_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 尝试使用 uni-id-common 验证 token
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // token 验证失败，尝试解析简单 token
          throw new Error('uni-id token验证失败')
        } else {
          // 验证成功
          sender_id = payload.uid
        }
      } catch (checkError) {
        // uni-id token 验证失败，尝试解析简单 token（base64格式：uid_timestamp_random）
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          if (parts.length >= 1) {
            sender_id = parts[0]
          } else {
            return error('token格式错误')
          }
        } catch (decodeError) {
          console.error('[chat-send] token解析失败:', decodeError)
          return error('token验证失败，请重新登录')
        }
      }
      
      if (!sender_id) {
        return error('未获取到token，请先登录')
      }
      
      // 2. 参数验证
      if (!conversation_id) {
        return error('会话ID不能为空')
      }
      
      if (!content || content.trim() === '') {
        return error('消息内容不能为空')
      }
      
      // 3. 查询会话信息
      const conversationDoc = await db.collection('chat-conversations').doc(conversation_id).get()
      
      if (!conversationDoc.data || conversationDoc.data.length === 0) {
        return error('会话不存在')
      }
      
      const conversation = conversationDoc.data[0]
      
      // 4. 验证聊天权限
      if (sender_id !== conversation.parent_id && sender_id !== conversation.teacher_id) {
        return error('无权在此会话中发送消息')
      }
      
      // 5. 确定发送者角色
      const sender_role = sender_id === conversation.parent_id ? 'parent' : 'teacher'
      
      // 6. 验证聊天权限（联系请求阶段：家长可以发送，老师需要支付保证金后才能发送）
      // 查询关联的预约状态
      const appointmentDoc = await db.collection('appointments')
        .doc(conversation.appointment_id)
        .get()
      
      const appointment = appointmentDoc.data && appointmentDoc.data.length > 0 
        ? appointmentDoc.data[0] 
        : null
      
      // 如果是联系请求（contact_request）状态，需要特殊处理
      if (appointment && appointment.status === 'contact_request') {
        if (sender_role === 'teacher' && !conversation.chat_enabled) {
          return error('请先支付保证金后才能回复家长')
        }
        
        // 家长在联系请求阶段：需要等待老师回复后才能继续发送消息
        if (sender_role === 'parent') {
          // 查询是否有老师的消息（检查是否有老师发送的消息）
          const teacherMessages = await db.collection('chat-messages')
            .where({
              conversation_id,
              sender_role: 'teacher'
            })
            .orderBy('send_time', 'desc')
            .limit(1)
            .get()
          
          // 如果已经有老师的消息，说明老师已经回复，家长可以继续发送
          // 如果没有老师的消息，检查是否已经有家长的消息（第一条联系请求消息）
          if (!teacherMessages.data || teacherMessages.data.length === 0) {
            // 检查是否已经有家长发送的消息（除了系统自动发送的联系请求消息）
            const parentMessages = await db.collection('chat-messages')
              .where({
                conversation_id,
                sender_role: 'parent'
              })
              .orderBy('send_time', 'desc')
              .get()
            
            // 如果家长已经发送过消息（包括系统自动发送的联系请求消息），需要等待老师回复
            if (parentMessages.data && parentMessages.data.length > 0) {
              return error('请等待老师回复后再继续发送消息')
            }
            // 如果没有家长消息，说明这是第一条联系请求消息，允许发送
          }
        }
      } else {
        // 其他状态（如已确认的预约），需要 chat_enabled 为 true
        if (!conversation.chat_enabled) {
          return error('聊天未开启，请先支付保证金')
        }
      }
      const receiver_id = sender_role === 'parent' ? conversation.teacher_id : conversation.parent_id
      const receiver_role = sender_role === 'parent' ? 'teacher' : 'parent'
      
      // 7. 创建消息
      const message = {
        conversation_id,
        sender_id,
        sender_role,
        receiver_id,
        receiver_role,
        message_type,
        content,
        is_read: false,
        send_time: Date.now()
      }
      
      const result = await db.collection('chat-messages').add(message)
      
      if (!result.id) {
        return error('发送消息失败')
      }
      
      // 7. 更新会话信息
      const updateData = {
        last_message: content.substring(0, 50),  // 最多保存50个字符
        last_message_time: Date.now(),
        update_time: Date.now()
      }
      
      // 增加对方的未读数
      if (sender_role === 'parent') {
        updateData.unread_count_teacher = db.command.inc(1)
      } else {
        updateData.unread_count_parent = db.command.inc(1)
      }
      
      await db.collection('chat-conversations').doc(conversation_id).update(updateData)
      
      console.log('消息发送成功:', result.id)
      
      return success({
        message_id: result.id,
        send_time: message.send_time
      }, '发送成功')
      
    } catch (e) {
      console.error('发送消息失败:', e)
      return error(e.message || '发送失败')
    }
  },
  
  /**
   * 获取消息列表（已废弃，使用 getMessages）
   * @param {Object} params
   * @param {String} params.conversation_id 会话ID
   * @param {Number} params.page 页码
   * @param {Number} params.page_size 每页数量
   * @returns {Object}
   */
  async getList(params) {
    const {
      conversation_id,
      page = 1,
      page_size = 20
    } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 获取用户ID（从token中获取）
      const token = this.getUniIdToken()
      let user_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 尝试使用 uni-id-common 验证 token
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // token 验证失败，尝试解析简单 token
          throw new Error('uni-id token验证失败')
        } else {
          // 验证成功
          user_id = payload.uid
        }
      } catch (checkError) {
        // uni-id token 验证失败，尝试解析简单 token（base64格式：uid_timestamp_random）
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          if (parts.length >= 1) {
            user_id = parts[0]
          } else {
            return error('token格式错误')
          }
        } catch (decodeError) {
          console.error('[chat-send] token解析失败:', decodeError)
          return error('token验证失败，请重新登录')
        }
      }
      
      if (!user_id) {
        return error('未获取到token，请先登录')
      }
      
      // 2. 查询会话信息
      const conversationDoc = await db.collection('chat-conversations').doc(conversation_id).get()
      
      if (!conversationDoc.data || conversationDoc.data.length === 0) {
        return error('会话不存在')
      }
      
      const conversation = conversationDoc.data[0]
      
      // 3. 验证权限
      if (user_id !== conversation.parent_id && user_id !== conversation.teacher_id) {
        return error('无权查看此会话')
      }
      
      // 4. 查询消息列表
      const result = await db.collection('chat-messages')
        .where({ conversation_id })
        .orderBy('send_time', 'desc')
        .skip((page - 1) * page_size)
        .limit(page_size)
        .get()
      
      // 5. 统计总数
      const countResult = await db.collection('chat-messages')
        .where({ conversation_id })
        .count()
      
      console.log(`查询到${result.data.length}条消息`)
      
      return success({
        list: result.data.reverse(),  // 反转为正序（旧消息在前）
        total: countResult.total,
        page,
        page_size
      })
      
    } catch (e) {
      console.error('获取消息列表失败:', e)
      return error(e.message || '获取失败')
    }
  },
  
  /**
   * 标记消息为已读
   * @param {Object} params
   * @param {String} params.conversation_id 会话ID
   * @returns {Object}
   */
  async markRead(params) {
    const { conversation_id } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 获取用户ID（从token中获取）
      const token = this.getUniIdToken()
      let user_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 尝试使用 uni-id-common 验证 token
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // token 验证失败，尝试解析简单 token
          throw new Error('uni-id token验证失败')
        } else {
          // 验证成功
          user_id = payload.uid
        }
      } catch (checkError) {
        // uni-id token 验证失败，尝试解析简单 token（base64格式：uid_timestamp_random）
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          if (parts.length >= 1) {
            user_id = parts[0]
          } else {
            return error('token格式错误')
          }
        } catch (decodeError) {
          console.error('[chat-send] token解析失败:', decodeError)
          return error('token验证失败，请重新登录')
        }
      }
      
      if (!user_id) {
        return error('未获取到token，请先登录')
      }
      
      // 2. 查询会话信息
      const conversationDoc = await db.collection('chat-conversations').doc(conversation_id).get()
      
      if (!conversationDoc.data || conversationDoc.data.length === 0) {
        return error('会话不存在')
      }
      
      const conversation = conversationDoc.data[0]
      
      // 3. 验证权限
      if (user_id !== conversation.parent_id && user_id !== conversation.teacher_id) {
        return error('无权操作此会话')
      }
      
      // 4. 确定角色
      const user_role = user_id === conversation.parent_id ? 'parent' : 'teacher'
      
      // 5. 标记消息为已读
      await db.collection('chat-messages')
        .where({
          conversation_id,
          receiver_id: user_id,
          is_read: false
        })
        .update({
          is_read: true,
          read_time: Date.now()
        })
      
      // 6. 更新会话未读数
      const updateData = {
        update_time: Date.now()
      }
      
      if (user_role === 'parent') {
        updateData.unread_count_parent = 0
      } else {
        updateData.unread_count_teacher = 0
      }
      
      await db.collection('chat-conversations').doc(conversation_id).update(updateData)
      
      console.log('消息已标记为已读')
      
      return success(null, '已读')
      
    } catch (e) {
      console.error('标记已读失败:', e)
      return error(e.message || '标记失败')
    }
  },
  
  /**
   * 根据预约ID获取会话
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @returns {Object}
   */
  async getConversation(params) {
    const { appointment_id } = params
    
    try {
      const db = uniCloud.database()
      
      if (!appointment_id) {
        return error('预约ID不能为空')
      }
      
      console.log('查询会话，预约ID:', appointment_id)
      
      // 查询会话
      // 优先按 appointment_id 精确匹配；如果不存在，则按 parent_id + teacher_id 维度回退查找，
      // 以兼容“同一对家长与老师复用会话和保证金”的逻辑。
      let conversation = null
      
      const conversationDoc = await db.collection('chat-conversations')
        .where({ appointment_id })
        .get()
      
      if (conversationDoc.data && conversationDoc.data.length > 0) {
        conversation = conversationDoc.data[0]
      } else {
        // 没有绑定该预约的会话时，尝试按家长+老师维度查找历史会话
        const apptDoc = await db.collection('appointments')
          .doc(appointment_id)
          .get()
        
        if (!apptDoc.data || apptDoc.data.length === 0) {
          return error('聊天会话不存在，请先联系老师或接受试课邀请')
        }
        
        const appt = apptDoc.data[0]
        
        const pairConvDoc = await db.collection('chat-conversations')
          .where({
            parent_id: appt.parent_id,
            teacher_id: appt.teacher_id
          })
          .orderBy('create_time', 'desc')
          .limit(1)
          .get()
        
        if (!pairConvDoc.data || pairConvDoc.data.length === 0) {
          return error('聊天会话不存在，请先联系老师或接受试课邀请')
        }
        
        conversation = pairConvDoc.data[0]
      }
      
      // 查询关联的预约状态，判断是否为联系请求
      const appointmentDoc = await db.collection('appointments')
        .doc(conversation.appointment_id)
        .get()
      
      const appointment = appointmentDoc.data && appointmentDoc.data.length > 0 
        ? appointmentDoc.data[0] 
        : null
      
      // 如果是联系请求状态，允许查看会话（即使chat_enabled为false）
      // 其他状态需要chat_enabled为true才能查看
      if (appointment && appointment.status !== 'contact_request') {
        if (!conversation.chat_enabled) {
          return error('聊天功能未开启，请先支付保证金')
        }
      }
      
      return success({
        conversation_id: conversation._id,
        appointment_id: conversation.appointment_id,
        parent_id: conversation.parent_id,
        teacher_id: conversation.teacher_id,
        chat_enabled: conversation.chat_enabled,
        teacher_deposit_paid: conversation.teacher_deposit_paid || false
      }, '获取会话成功')
      
    } catch (e) {
      console.error('获取会话失败:', e)
      return error(e.message || '获取会话失败')
    }
  },
  
  /**
   * 获取会话信息及对方用户信息
   * @param {Object} params
   * @param {String} params.conversation_id 会话ID（可选）
   * @param {String} params.appointment_id 预约ID（可选）
   * @returns {Object}
   */
  async getConversationWithUserInfo(params) {
    const { conversation_id, appointment_id } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 获取用户ID（从token中获取）
      const token = this.getUniIdToken()
      let user_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 尝试使用 uni-id-common 验证 token
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // token 验证失败，尝试解析简单 token
          throw new Error('uni-id token验证失败')
        } else {
          // 验证成功
          user_id = payload.uid
        }
      } catch (checkError) {
        // uni-id token 验证失败，尝试解析简单 token（base64格式：uid_timestamp_random）
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          if (parts.length >= 1) {
            user_id = parts[0]
          } else {
            return error('token格式错误')
          }
        } catch (decodeError) {
          console.error('[chat-send] token解析失败:', decodeError)
          return error('token验证失败，请重新登录')
        }
      }
      
      if (!user_id) {
        return error('未获取到token，请先登录')
      }
      
      // 2. 获取会话信息
      let conversation
      if (conversation_id) {
        const conversationDoc = await db.collection('chat-conversations')
          .doc(conversation_id)
          .get()
        
        if (!conversationDoc.data || conversationDoc.data.length === 0) {
          return error('会话不存在')
        }
        conversation = conversationDoc.data[0]
      } else if (appointment_id) {
        const conversationDoc = await db.collection('chat-conversations')
          .where({ appointment_id })
          .get()
        
        if (!conversationDoc.data || conversationDoc.data.length === 0) {
          return error('聊天会话不存在')
        }
        conversation = conversationDoc.data[0]
      } else {
        return error('请提供会话ID或预约ID')
      }
      
      // 3. 验证权限
      if (user_id !== conversation.parent_id && user_id !== conversation.teacher_id) {
        return error('无权查看此会话')
      }
      
      // 4. 确定对方用户ID
      const otherUserId = user_id === conversation.parent_id 
        ? conversation.teacher_id 
        : conversation.parent_id
      
      // 5. 获取对方用户信息
      let otherUserInfo = {}
      let teacherProfile = null
      if (otherUserId) {
        const userDoc = await db.collection('uni-id-users')
          .doc(otherUserId)
          .field({ nickname: true, avatar: true, role: true })
          .get()
        
        if (userDoc.data && userDoc.data.length > 0) {
          otherUserInfo = {
            nickname: userDoc.data[0].nickname || '用户',
            avatar: userDoc.data[0].avatar || '/static/default-avatar.png',
            role: userDoc.data[0].role
          }
        }

        if (otherUserId === conversation.teacher_id) {
          const teacherDoc = await db.collection('teacher-profiles')
            .where({ teacher_id: otherUserId })
            .field({ display_name: true, avatar: true, title: true, subjects: true })
            .limit(1)
            .get()
          if (teacherDoc.data && teacherDoc.data.length > 0) {
            const teacher = teacherDoc.data[0]
            teacherProfile = teacher
            otherUserInfo.display_name = teacher.display_name || otherUserInfo.nickname || '老师'
            otherUserInfo.avatar = teacher.avatar || otherUserInfo.avatar
            otherUserInfo.title = teacher.title || ''
            otherUserInfo.subjects = teacher.subjects || []
          }
        } else if (otherUserId === conversation.parent_id) {
          const parentProfile = await db.collection('user-profiles')
            .where({ uid: otherUserId })
            .field({ display_name: true, avatar: true })
            .limit(1)
            .get()
          if (parentProfile.data && parentProfile.data.length > 0) {
            const profile = parentProfile.data[0]
            otherUserInfo.display_name = profile.display_name || otherUserInfo.nickname || '家长'
            otherUserInfo.avatar = profile.avatar || otherUserInfo.avatar
          }
        }
      }
      
      // 6. 获取预约信息（用于判断状态）
      let appointmentInfo = null
      if (conversation.appointment_id) {
        const appointmentDoc = await db.collection('appointments')
          .doc(conversation.appointment_id)
          .field({ status: true, course_type: true })
          .get()
        if (appointmentDoc.data && appointmentDoc.data.length > 0) {
          appointmentInfo = {
            status: appointmentDoc.data[0].status,
            course_type: appointmentDoc.data[0].course_type
          }
        }
      }
      
      // 7. 获取当前用户信息
      const currentUserDoc = await db.collection('uni-id-users')
        .doc(user_id)
        .field({ nickname: true, avatar: true, role: true })
        .get()
      
      let currentUserInfo = {}
      if (currentUserDoc.data && currentUserDoc.data.length > 0) {
        currentUserInfo = {
          nickname: currentUserDoc.data[0].nickname || '我',
          avatar: currentUserDoc.data[0].avatar || '/static/default-avatar.png',
          role: currentUserDoc.data[0].role
        }
      }
      
      let teacherInfo = teacherProfile || {}
      if ((!teacherInfo || Object.keys(teacherInfo).length === 0) && conversation.teacher_id) {
        const teacherDoc = await db.collection('teacher-profiles')
          .where({ teacher_id: conversation.teacher_id })
          .field({ teacher_id: true, display_name: true, avatar: true, title: true, subjects: true })
          .limit(1)
          .get()
        if (teacherDoc.data && teacherDoc.data.length > 0) {
          teacherInfo = teacherDoc.data[0]
        }
      }

      return success({
        conversation_id: conversation._id,
        appointment_id: conversation.appointment_id,
        parent_id: conversation.parent_id,
        teacher_id: conversation.teacher_id,
        chat_enabled: conversation.chat_enabled,
        teacher_info: teacherInfo,
        other_user: otherUserInfo,
        current_user: currentUserInfo,
        appointment: appointmentInfo  // 添加预约信息，包含状态
      }, '获取成功')
      
    } catch (e) {
      console.error('获取会话信息失败:', e)
      return error(e.message || '获取失败')
    }
  },
  
  /**
   * 获取用户的会话列表
   * @returns {Object}
   */
  async getConversationList() {
    try {
      const db = uniCloud.database()
      
      // 1. 获取用户ID（从token中获取）
      const token = this.getUniIdToken()
      let user_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 尝试使用 uni-id-common 验证 token
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // token 验证失败，尝试解析简单 token
          throw new Error('uni-id token验证失败')
        } else {
          // 验证成功
          user_id = payload.uid
        }
      } catch (checkError) {
        // uni-id token 验证失败，尝试解析简单 token（base64格式：uid_timestamp_random）
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          if (parts.length >= 1) {
            user_id = parts[0]
          } else {
            return error('token格式错误')
          }
        } catch (decodeError) {
          console.error('[chat-send] token解析失败:', decodeError)
          return error('token验证失败，请重新登录')
        }
      }
      
      if (!user_id) {
        return error('未获取到token，请先登录')
      }
      
      // 2. 获取用户角色
      const userDoc = await db.collection('uni-id-users').doc(user_id).get()
      const user_role = userDoc.data[0].role
      
      // 3. 查询会话列表
      const whereCondition = user_role === 'parent' 
        ? { parent_id: user_id }
        : { teacher_id: user_id }
      
      const result = await db.collection('chat-conversations')
        .where(whereCondition)
        .orderBy('last_message_time', 'desc')
        .get()
      
      // 4. 关联对方信息
      if (result.data && result.data.length > 0) {
        const otherUserIds = []
        const teacherIds = []
        const parentIds = []
        const appointmentIds = []
        result.data.forEach(item => {
          appointmentIds.push(item.appointment_id)
          if (user_role === 'parent') {
            otherUserIds.push(item.teacher_id)
            teacherIds.push(item.teacher_id)
          } else {
            otherUserIds.push(item.parent_id)
            parentIds.push(item.parent_id)
          }
        })

        const users = otherUserIds.length > 0
          ? await db.collection('uni-id-users')
              .where({ _id: db.command.in(otherUserIds) })
              .field({ _id: true, nickname: true, avatar: true })
              .get()
          : { data: [] }

        const teacherProfiles = teacherIds.length > 0
          ? await db.collection('teacher-profiles')
              .where({ teacher_id: db.command.in(teacherIds) })
              .field({ teacher_id: true, display_name: true, avatar: true, title: true, subjects: true })
              .get()
          : { data: [] }

        const parentProfiles = parentIds.length > 0
          ? await db.collection('user-profiles')
              .where({ uid: db.command.in(parentIds) })
              .field({ uid: true, display_name: true, avatar: true })
              .get()
          : { data: [] }

        const appointmentProfiles = appointmentIds.length > 0
          ? await db.collection('appointments')
              .where({ _id: db.command.in(appointmentIds) })
              .field({ _id: true, teacher_info: true })
              .get()
          : { data: [] }

        const userMap = {}
        users.data.forEach(u => {
          userMap[u._id] = u
        })

        const teacherMap = {}
        teacherProfiles.data.forEach(t => {
          teacherMap[t.teacher_id] = t
        })

        const parentMap = {}
        parentProfiles.data.forEach(p => {
          parentMap[p.uid] = p
        })

        const appointmentTeacherMap = {}
        appointmentProfiles.data.forEach(a => {
          appointmentTeacherMap[a._id] = a.teacher_info || {}
        })

        result.data.forEach(item => {
          const appointmentTeacherInfo = appointmentTeacherMap[item.appointment_id] || {}
          if (user_role === 'parent') {
            const teacherInfo = teacherMap[item.teacher_id] || {}
            const userInfo = userMap[item.teacher_id] || {}
            const avatarCandidates = [
              userInfo.avatar,
              teacherInfo.avatar,
              appointmentTeacherInfo.avatar
            ]
            const resolvedAvatar = avatarCandidates.find(src => src && src !== '/static/default-avatar.png')
            item.other_user = {
              teacher_id: item.teacher_id,
              display_name: teacherInfo.display_name
                || appointmentTeacherInfo.display_name
                || userInfo.nickname
                || '老师',
              nickname: userInfo.nickname || teacherInfo.display_name || '老师',
              avatar: resolvedAvatar || '/static/default-avatar.png',
              title: teacherInfo.title || appointmentTeacherInfo.title || '',
              subjects: teacherInfo.subjects || appointmentTeacherInfo.subjects || []
            }
            item.teacher_info = {
              display_name: teacherInfo.display_name || appointmentTeacherInfo.display_name || userInfo.nickname || '老师',
              avatar: resolvedAvatar || '/static/default-avatar.png',
              title: teacherInfo.title || appointmentTeacherInfo.title || '',
              subjects: teacherInfo.subjects || appointmentTeacherInfo.subjects || []
            }
          } else {
            const parentInfo = parentMap[item.parent_id] || {}
            const userInfo = userMap[item.parent_id] || {}
            const avatarCandidates = [parentInfo.avatar, userInfo.avatar]
            const resolvedAvatar = avatarCandidates.find(src => src && src !== '/static/default-avatar.png')
            item.other_user = {
              parent_id: item.parent_id,
              display_name: parentInfo.display_name || userInfo.nickname || '家长',
              nickname: userInfo.nickname || parentInfo.display_name || '家长',
              avatar: resolvedAvatar || '/static/default-avatar.png'
            }
          }
        })
      }
      
      console.log(`查询到${result.data.length}个会话`)
      
      return success({
        list: result.data,
        total: result.data.length
      })
      
    } catch (e) {
      console.error('获取会话列表失败:', e)
      return error(e.message || '获取失败')
    }
  },
  
  /**
   * 获取消息列表
   * @param {Object} params
   * @param {String} params.conversation_id 会话ID
   * @param {Number} params.page 页码，默认1
   * @param {Number} params.pageSize 每页数量，默认20
   * @returns {Object}
   */
  async getMessages(params) {
    const {
      conversation_id,
      page = 1,
      pageSize = 20
    } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 获取用户ID（从token中获取）
      const token = this.getUniIdToken()
      let user_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 尝试使用 uni-id-common 验证 token
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // token 验证失败，尝试解析简单 token
          throw new Error('uni-id token验证失败')
        } else {
          // 验证成功
          user_id = payload.uid
        }
      } catch (checkError) {
        // uni-id token 验证失败，尝试解析简单 token（base64格式：uid_timestamp_random）
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          if (parts.length >= 1) {
            user_id = parts[0]
          } else {
            return error('token格式错误')
          }
        } catch (decodeError) {
          console.error('[chat-send] token解析失败:', decodeError)
          return error('token验证失败，请重新登录')
        }
      }
      
      if (!user_id) {
        return error('未获取到token，请先登录')
      }
      
      // 2. 参数验证
      if (!conversation_id) {
        return error('会话ID不能为空')
      }
      
      console.log('获取消息列表，会话ID:', conversation_id, '页码:', page)
      
      // 3. 验证会话是否存在
      const conversationDoc = await db.collection('chat-conversations').doc(conversation_id).get()
      
      if (!conversationDoc.data || conversationDoc.data.length === 0) {
        return error('会话不存在')
      }
      
      const conversation = conversationDoc.data[0]
      
      // 4. 验证权限
      if (user_id !== conversation.parent_id && user_id !== conversation.teacher_id) {
        return error('无权查看此会话')
      }
      
      // 5. 查询消息列表
      const skip = (page - 1) * pageSize
      const messageDoc = await db.collection('chat-messages')
        .where({ conversation_id })
        .orderBy('send_time', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      
      console.log(`查询到${messageDoc.data.length}条消息`)
      
      // 6. 格式化消息数据
      const messages = messageDoc.data.map(msg => ({
        message_id: msg._id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        sender_role: msg.sender_role,
        message_type: msg.message_type,
        content: msg.content,
        send_time: msg.send_time,
        is_read: msg.is_read,
        create_time: msg.create_time
      }))
      
      // 7. 获取消息总数
      const totalResult = await db.collection('chat-messages')
        .where({ conversation_id })
        .count()
      
      return success({
        messages: messages.reverse(), // 按时间正序返回
        total: totalResult.total,
        page,
        pageSize,
        hasMore: skip + messages.length < totalResult.total
      }, '获取成功')
      
    } catch (e) {
      console.error('获取消息列表失败:', e)
      return error(e.message || '获取失败')
    }
  },
  
}

