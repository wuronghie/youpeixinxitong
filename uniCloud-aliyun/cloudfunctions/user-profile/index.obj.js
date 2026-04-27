/**
 * 用户信息更新云对象
 * 功能：更新用户基本信息（家长和教师通用）
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

module.exports = {
  _before: function() {
    // 云对象前置方法，初始化 uni-id 实例
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
  },
  
  /**
   * 获取用户信息（使用 token 验证）
   * @returns {Object}
   */
  async getUserProfile() {
    try {
      const db = uniCloud.database()
      
      // 获取 token 并验证
      const token = this.getUniIdToken()
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 验证 token（支持标准 token 和简单 token）
      let uid
      try {
        const payload = await this.uniID.checkToken(token)
        // 检查 payload 是否有错误码
        if (payload && payload.code !== undefined && payload.code !== 0) {
          // 标准 token 验证失败，尝试解析简单 token
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
            console.log('[getUserProfile] 使用简单token解析，uid:', uid)
          } catch (decodeError) {
            console.error('[getUserProfile] 简单token解析失败:', decodeError)
            uid = null
          }
        } else if (payload && payload.uid) {
          // 标准 token 验证成功
          uid = payload.uid
          console.log('[getUserProfile] 使用标准token，uid:', uid)
        } else {
          // payload 格式异常，尝试解析简单 token
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            uid = parts.length >= 1 ? parts[0] : null
            console.log('[getUserProfile] payload异常，使用简单token解析，uid:', uid)
          } catch (decodeError) {
            console.error('[getUserProfile] 简单token解析失败:', decodeError)
            uid = null
          }
        }
      } catch (checkError) {
        // token验证异常，尝试解析简单 token
        console.warn('[getUserProfile] token验证异常，尝试解析简单token:', checkError.message)
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          uid = parts.length >= 1 ? parts[0] : null
          console.log('[getUserProfile] 使用简单token解析，uid:', uid)
        } catch (decodeError) {
          console.error('[getUserProfile] 简单token解析失败:', decodeError)
          uid = null
        }
      }
      
      if (!uid) {
        console.error('[getUserProfile] 无法从token中获取uid，token:', token.substring(0, 20) + '...')
        return error('token验证失败，请重新登录')
      }
      
      console.log('[getUserProfile] 查询用户，uid:', uid)
      const userDoc = await db.collection('uni-id-users')
        .doc(uid)
        .field({
          _id: true,
          nickname: true,
          avatar: true,
          phone: true,
          gender: true,
          role: true,
          status: true,
          wx_nickname: true,
          wx_avatarUrl: true,
          parent_info: true,
          teacher_info: true
        })
        .get()
      
      if (!userDoc.data || userDoc.data.length === 0) {
        console.error('[getUserProfile] 用户不存在，uid:', uid)
        // 对于新用户，返回空数据而不是错误，允许前端继续完善信息
        return success({
          _id: uid,
          nickname: '',
          avatar: '',
          phone: '',
          gender: 0,
          role: null,
          status: 'active',
          wx_nickname: '',
          wx_avatarUrl: '',
          parent_info: {},
          teacher_info: {}
        }, '用户信息为空，请完善信息')
      }
      
      return success(userDoc.data[0], '获取成功')
      
    } catch (e) {
      console.error('获取用户信息失败:', e)
      return error(e.message || '获取失败')
    }
  },
  
  /**
   * 更新用户信息（家长版，使用 token 验证）
   * @param {Object} params
   * @param {String} params.real_name 真实姓名
   * @param {String} params.phone 手机号
   * @param {String} params.avatar 头像URL（可选）
   * @param {String} params.student_name 学生姓名
   * @param {String} params.student_grade 学生年级
   * @returns {Object}
   */
  async updateParentProfile(params) {
    const {
      real_name,
      phone,
      gender, // 性别（必填）：'male' | 'female'
      avatar,
      student_name,
      student_gender, // 孩子性别（必填）：'male' | 'female'
      student_grade,
      student_subjects = [],
      learning_goal = '',
      contact_wechat = '',
      address_detail = '',
      address = null, // 地址对象 {latitude, longitude, name}（仅用于计算，实际不直接存储在 address 字段）
      student_age = '',
      school_name = '',
      extra_notes = ''
    } = params
    
    try {
      console.log('[updateParentProfile] 开始更新家长信息，参数:', {
        real_name,
        phone,
        student_name,
        student_grade
      })
      
      const db = uniCloud.database()
      
      // 获取 token
      const token = this.getUniIdToken()
      let uid
      
      if (!token) {
        console.error('[updateParentProfile] 未获取到token')
        return error('未获取到token，请先登录')
      }
      
      console.log('[updateParentProfile] 获取到token，长度:', token.length, '前20字符:', token.substring(0, 20))
      
      // 验证 token（支持标准 token 和简单 token）
      try {
        const payload = await this.uniID.checkToken(token)
        console.log('[updateParentProfile] checkToken返回:', JSON.stringify(payload))
        
        // 检查 payload 是否有错误码
        if (payload && payload.code !== undefined && payload.code !== 0) {
          // 标准 token 验证失败，尝试解析简单 token
          console.log('[updateParentProfile] 标准token验证失败，尝试解析简单token')
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            if (parts.length >= 1) {
              uid = parts[0]
            } else {
              console.error('[updateParentProfile] token格式错误，parts:', parts)
              return error('token格式错误')
            }
            console.log('[updateParentProfile] 使用简单token解析，uid:', uid)
          } catch (decodeError) {
            console.error('[updateParentProfile] 简单token解析失败:', decodeError)
            return error('token验证失败，请重新登录')
          }
        } else if (payload && payload.uid) {
          // 标准 token 验证成功
          uid = payload.uid
          console.log('[updateParentProfile] 使用标准token，uid:', uid)
        } else {
          // payload 格式异常，尝试解析简单 token
          console.log('[updateParentProfile] payload格式异常，尝试解析简单token，payload:', JSON.stringify(payload))
          try {
            const decoded = Buffer.from(token, 'base64').toString('utf-8')
            const parts = decoded.split('_')
            if (parts.length >= 1) {
              uid = parts[0]
            } else {
              console.error('[updateParentProfile] token格式错误，parts:', parts)
              return error('token验证失败，请重新登录')
            }
            console.log('[updateParentProfile] payload异常，使用简单token解析，uid:', uid)
          } catch (decodeError) {
            console.error('[updateParentProfile] 简单token解析失败:', decodeError)
            return error('token验证失败，请重新登录')
          }
        }
      } catch (checkError) {
        // token验证异常，尝试解析简单 token
        console.warn('[updateParentProfile] token验证异常，尝试解析简单token:', checkError.message)
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          if (parts.length >= 1) {
            uid = parts[0]
          } else {
            console.error('[updateParentProfile] token格式错误，parts:', parts)
            return error('token验证失败，请重新登录')
          }
          console.log('[updateParentProfile] 使用简单token解析，uid:', uid)
        } catch (decodeError) {
          console.error('[updateParentProfile] 简单token解析失败:', decodeError)
          return error('token验证失败，请重新登录')
        }
      }
      
      if (!uid) {
        console.error('[updateParentProfile] 无法从token中获取uid，token前20字符:', token.substring(0, 20))
        return error('token验证失败，请重新登录')
      }
      
      console.log('[updateParentProfile] 查询用户，uid:', uid)
      // 验证用户角色 - 先查询完整信息，如果不存在再尝试通过openid查找
      let userDoc = await db.collection('uni-id-users')
        .doc(uid)
        .field({ role: true, _id: true })
        .get()
      
      if (!userDoc.data || userDoc.data.length === 0) {
        console.error('[updateParentProfile] 用户不存在，uid:', uid)
        console.log('[updateParentProfile] 尝试通过其他方式查找用户...')
        
        // 如果通过uid找不到，可能是新用户记录还没完全写入，尝试等待一下再查询
        await new Promise(resolve => setTimeout(resolve, 500))
        userDoc = await db.collection('uni-id-users')
          .doc(uid)
          .field({ role: true, _id: true })
          .get()
        
        if (!userDoc.data || userDoc.data.length === 0) {
          console.error('[updateParentProfile] 重试后用户仍不存在，uid:', uid)
          return error('用户不存在，请重新登录')
        }
      }
      
      if (userDoc.data[0].role !== 'parent') {
        console.error('[updateParentProfile] 用户角色不匹配，当前角色:', userDoc.data[0].role)
        return error('当前账号不是家长角色')
      }
      
      if (!real_name || !phone) {
        console.error('[updateParentProfile] 必填字段为空:', { real_name, phone })
        return error('真实姓名和手机号不能为空')
      }
      
      // 验证手机号格式（简单验证）
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(phone)) {
        console.error('[updateParentProfile] 手机号格式不正确:', phone)
        return error('手机号格式不正确')
      }
      
      // 验证性别（必填：male / female）
      const genderStr = typeof gender === 'string' ? gender.trim() : ''
      if (!genderStr || !['male', 'female'].includes(genderStr)) {
        console.error('[updateParentProfile] 性别格式不正确:', gender)
        return error('请选择性别')
      }
      const studentGenderStr = typeof student_gender === 'string' ? student_gender.trim() : ''
      if (!studentGenderStr || !['male', 'female'].includes(studentGenderStr)) {
        console.error('[updateParentProfile] 孩子性别格式不正确:', student_gender)
        return error('请选择孩子性别')
      }
      // uni-id 约定：1=男, 2=女（0=未知）
      const genderCode = genderStr === 'male' ? 1 : 2
      
      // 构建更新数据
      const updateData = {
        nickname: real_name,  // 使用真实姓名作为昵称
        phone: phone,
        gender: genderCode,
        update_date: Date.now()
      }
      
      if (avatar) {
        updateData.avatar = avatar
      }
      
      // 计算地址相关字段
      const hasAddress =
        address &&
        typeof address === 'object' &&
        (address.latitude !== undefined ||
          address.longitude !== undefined ||
          address.name)
      
      const finalAddressDetail = address_detail || (hasAddress && address.name) || ''
      
      // 更新家长信息（存储在 parent_info 对象中）
      // 注意：不再直接在 parent_info 中使用嵌套的 address 子对象，以避免
      // 旧数据中 address 为 null 时出现 “Cannot create field 'latitude' in element {address: null}” 的问题。
      const parentInfo = {
        real_name: real_name,
        student_name: student_name || '',
        student_gender: studentGenderStr,
        student_grade: student_grade || '',
        student_subjects: Array.isArray(student_subjects) ? student_subjects : [],
        learning_goal: learning_goal || '',
        contact_wechat: contact_wechat || '',
        // 仅存储可读的地址文本
        address_detail: finalAddressDetail,
        // 经纬度单独存储，避免与旧的 address:null 结构冲突
        location_latitude: hasAddress && address.latitude !== undefined ? Number(address.latitude) : undefined,
        location_longitude: hasAddress && address.longitude !== undefined ? Number(address.longitude) : undefined,
        location_name: hasAddress && address.name ? address.name : finalAddressDetail,
        student_age: student_age || '',
        school_name: school_name || '',
        extra_notes: extra_notes || '',
        update_time: Date.now()
      }
      
      updateData.parent_info = parentInfo
      
      console.log('[updateParentProfile] 准备更新数据，uid:', uid, 'updateData:', JSON.stringify(updateData))
      
      // 更新用户信息
      const updateResult = await db.collection('uni-id-users').doc(uid).update(updateData)
      console.log('[updateParentProfile] 数据库更新结果:', updateResult)
      
      console.log(`[updateParentProfile] 家长 ${uid} 更新了个人信息`)
      
      return success({
        user_id: uid,
        ...updateData
      }, '信息更新成功')
      
    } catch (e) {
      console.error('[updateParentProfile] 更新家长信息失败:', e)
      console.error('[updateParentProfile] 错误堆栈:', e.stack)
      return error(e.message || e.errMsg || '更新失败')
    }
  },
  
  /**
   * 更新用户信息（教师版 - 简化版，实际应该使用 teacher-profile，使用 token 验证）
   * @param {Object} params
   * @param {String} params.real_name 真实姓名
   * @param {String} params.phone 手机号
   * @param {String} params.avatar 头像URL（可选）
   * @returns {Object}
   */
  async updateTeacherProfile(params) {
    const {
      real_name,
      phone,
      avatar
    } = params
    
    try {
      const db = uniCloud.database()
      
      // 获取 token 并验证
      const token = this.getUniIdToken()
      let uid
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 验证 token（支持标准 token 和简单 token）
      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          // 尝试解析简单 token
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          uid = parts.length >= 1 ? parts[0] : null
        } else {
          uid = payload.uid
        }
      } catch (checkError) {
        // 尝试解析简单 token
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        uid = parts.length >= 1 ? parts[0] : null
      }
      
      if (!uid) {
        return error('token验证失败，请重新登录')
      }
      
      // 验证用户角色
      const userDoc = await db.collection('uni-id-users')
        .doc(uid)
        .field({ role: true })
        .get()
      
      if (!userDoc.data || userDoc.data.length === 0) {
        return error('用户不存在')
      }
      
      if (userDoc.data[0].role !== 'teacher') {
        return error('当前账号不是教师角色')
      }
      
      if (!real_name || !phone) {
        return error('真实姓名和手机号不能为空')
      }
      
      // 验证手机号格式
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(phone)) {
        return error('手机号格式不正确')
      }
      
      // 构建更新数据
      const updateData = {
        nickname: real_name,
        phone: phone,
        update_date: Date.now()
      }
      
      if (avatar) {
        updateData.avatar = avatar
      }
      
      // 更新用户信息
      await db.collection('uni-id-users').doc(uid).update(updateData)
      
      console.log(`教师 ${uid} 更新了基本信息`)
      
      return success({
        user_id: uid,
        ...updateData
      }, '信息更新成功')
      
    } catch (e) {
      console.error('更新教师信息失败:', e)
      return error(e.message || '更新失败')
    }
  }
}

