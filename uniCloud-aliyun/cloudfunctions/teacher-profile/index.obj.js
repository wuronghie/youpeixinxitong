/**
 * 教师个人资料云对象
 * 功能：教师提交和更新个人资料
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

/**
 * 深度比较两个值是否相等
 * @param {*} a 值1
 * @param {*} b 值2
 * @returns {Boolean}
 */
function deepEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a).sort()
    const keysB = Object.keys(b).sort()
    if (keysA.length !== keysB.length) return false
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return false
      if (!deepEqual(a[keysA[i]], b[keysB[i]])) return false
    }
    return true
  }
  
  return false
}

/**
 * 检查教师资料是否有修改
 * @param {Object} oldProfile 旧资料
 * @param {Object} newData 新数据
 * @returns {Boolean} 是否有修改
 */
function hasProfileChanged(oldProfile, newData) {
  // 比较基本字段
  if (oldProfile.display_name !== newData.display_name) return true
  if (oldProfile.hourly_rate !== newData.hourly_rate) return true
  if ((oldProfile.introduction || '') !== (newData.introduction || '')) return true
  
  // 比较数组字段
  if (!deepEqual(oldProfile.subjects || [], newData.subjects || [])) return true
  if (!deepEqual(oldProfile.grades || [], newData.grades || [])) return true
  if (!deepEqual(oldProfile.qualifications || [], newData.qualifications || [])) return true
  if (!deepEqual(oldProfile.teaching_areas || [], newData.teaching_areas || [])) return true
  if (!deepEqual(oldProfile.tags || [], newData.tags || [])) return true
  
  // 比较新增字段
  if ((oldProfile.school || '') !== (newData.school || '')) return true
  if ((oldProfile.experience || '') !== (newData.experience || '')) return true
  
  // 比较对象字段
  const oldExp = oldProfile.teaching_experience || { years: 0, description: '' }
  const newExp = newData.teaching_experience || { years: 0, description: '' }
  if (oldExp.years !== newExp.years || (oldExp.description || '') !== (newExp.description || '')) return true
  
  const oldEdu = oldProfile.education || { degree: '', school: '', major: '', graduation_year: null }
  const newEdu = {
    degree: newData.education?.degree || '',
    school: '', // 不再比较 education.school，统一使用 school 字段
    major: newData.education?.major || '',
    graduation_year: newData.education?.graduation_year || null
  }
  if (!deepEqual(oldEdu, newEdu)) return true
  
  // 比较头像（如果有提供新头像）
  if (newData.avatar && oldProfile.avatar !== newData.avatar) return true
  
  return false
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
   * 教师提交/更新个人资料（使用 token 验证）
   * @param {Object} params
   * @param {String} params.display_name 姓名
   * @param {Array} params.subjects 教学科目
   * @param {Array} params.grades 教学年级
   * @param {Number} params.hourly_rate 时薪
   * @param {String} params.introduction 个人简介
   * @param {Object} params.teaching_experience 教学经验 { years:Number, description:String }
   * @param {Object} params.education 学历 { degree:String, school:String, major:String, graduation_year:Number }
   * @param {Array} params.qualifications 资质证书 [{ type:String, name:String, number:String, issued_by:String, issue_date:Number, expiry_date:Number, images:Array<String> }]
   * @param {Array} params.teaching_areas 教学地区
   */
  async submitProfile(params) {
    const {
      avatar,
      display_name,
      subjects,
      grades,
      hourly_rate,
      introduction,
      school,
      experience,
      tags,
      teaching_experience,
      education,
      qualifications,
      teaching_areas,
      certification
    } = params
    
    try {
      const db = uniCloud.database()
      
      // 获取 token
      const token = this.getUniIdToken()
      let teacher_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 尝试使用 uni-id-common 验证 token
      try {
        const payload = await this.uniID.checkToken(token)
        // 根据示例：如果 payload.code 存在，说明有错误
        if (payload.code) {
          // token 验证失败，尝试解析简单 token
          console.log('[teacher-profile] uni-id token验证失败，尝试解析简单token，code:', payload.code)
          throw new Error('uni-id token验证失败')
        } else {
          // 验证成功
          teacher_id = payload.uid
          console.log('[teacher-profile] uni-id token验证成功，uid:', teacher_id)
        }
      } catch (checkError) {
        // uni-id token 验证失败，尝试解析简单 token（base64格式：uid_timestamp_random）
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          if (parts.length >= 1) {
            teacher_id = parts[0]
            console.log('[teacher-profile] 简单token解析成功，uid:', teacher_id)
          } else {
            return error('token格式错误')
          }
        } catch (decodeError) {
          console.error('[teacher-profile] token解析失败:', decodeError)
          return error('token验证失败，请重新登录')
        }
      }
      
      // 验证用户角色
      const userDoc = await db.collection('uni-id-users')
        .doc(teacher_id)
        .field({ role: true })
        .get()
      
      if (!userDoc.data || userDoc.data.length === 0) {
        return error('用户不存在')
      }
      
      if (userDoc.data[0].role !== 'teacher') {
        return error('当前账号不是教师角色')
      }
      
      // 1. 验证必填参数
      
      if (!display_name || !subjects || !grades || !hourly_rate) {
        return error('请填写完整的基本信息（姓名、科目、年级、时薪）')
      }
      
      // 2. 查询教师资料是否存在
      const profileDoc = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .get()
      
      const profileData = profileDoc.result?.data || profileDoc.data || []
      
      if (profileData.length === 0) {
        return error('教师资料不存在，请先登录')
      }
      
      const profile = profileData[0]
      
      // 3. 准备新数据
      const newData = {
        display_name,
        subjects,
        grades,
        hourly_rate,
        introduction: introduction || '',
        school: school || '',
        experience: experience || '',
        tags: Array.isArray(tags) ? tags : [],
        teaching_experience: teaching_experience || {
          years: 0,
          description: ''
        },
        education: {
          degree: education?.degree || '',
          school: '', // 不再使用 education.school，统一使用 school 字段
          major: education?.major || '',
          graduation_year: education?.graduation_year || null
        },
        qualifications: Array.isArray(qualifications) ? qualifications : [],
        teaching_areas: teaching_areas || []
      }

      if (typeof avatar === 'string' && avatar.length > 0) {
        newData.avatar = avatar
      }
      
      // 4. 检查是否有修改
      const hasChanged = hasProfileChanged(profile, newData)
      
      if (!hasChanged) {
        // 没有修改，直接返回成功，不更新数据库
        console.log(`教师 ${teacher_id} 提交了个人资料，但未检测到修改，跳过审核`)
        return success({
          teacher_id,
          display_name,
          avatar: profile.avatar,
          status: 'no_change',
          is_verified: profile.is_verified,
          available: profile.available
        }, '资料未修改，无需审核')
      }
      
      // 5. 有修改，更新教师资料并设置为待审核
      const updateData = {
        ...newData,
        // 提交后等待审核
        is_verified: false,
        available: false,
        update_time: Date.now()
      }

      await db.collection('teacher-profiles').doc(profile._id).update(updateData)

      if (updateData.avatar && updateData.avatar !== profile.avatar) {
        await db.collection('uni-id-users').doc(teacher_id).update({
          avatar: updateData.avatar
        })
      }
      
      // 6. 创建系统消息，通知教师资料已提交，等待审核
      try {
        await db.collection('system-messages').add({
          user_id: teacher_id,
          type: 'system',
          title: '资料审核中',
          content: `您的教师资料已提交，正在等待平台审核。审核通过后，您将可以接受学生预约。`,
          related_id: profile._id,
          action: {
            type: 'navigate',
            path: '/pages-teacher/profile/index'
          },
          action_url: '/pages-teacher/profile/index',  // 兼容字段，用于前端跳转
          is_read: false
        })
        console.log(`已为教师 ${teacher_id} 创建审核等待消息`)
      } catch (msgError) {
        console.error('创建系统消息失败:', msgError)
        // 消息创建失败不影响主流程，只记录错误
      }
      
      console.log(`教师 ${teacher_id} 提交了个人资料，检测到修改，等待审核`)
      
      return success({
        teacher_id,
        display_name,
        avatar: updateData.avatar || profile.avatar,
        status: 'pending_review'
      }, '资料提交成功，等待平台审核')
      
    } catch (e) {
      console.error('提交教师资料失败:', e)
      return error(e.message || '提交失败')
    }
  },
  
  /**
   * 获取教师个人资料（使用 token 验证）
   * @returns {Object}
   */
  async getProfile() {
    try {
      const db = uniCloud.database()
      
      // 获取 token
      const token = this.getUniIdToken()
      let teacher_id
      
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 尝试使用 uni-id-common 验证 token
      try {
        const payload = await this.uniID.checkToken(token)
        // 根据示例：如果 payload.code 存在，说明有错误
        if (payload.code) {
          throw new Error('uni-id token验证失败')
        } else {
          // 验证成功
          teacher_id = payload.uid
        }
      } catch (checkError) {
        // uni-id token 验证失败，尝试解析简单 token
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          if (parts.length >= 1) {
            teacher_id = parts[0]
          } else {
            return error('token格式错误')
          }
        } catch (decodeError) {
          return error('token验证失败，请重新登录')
        }
      }
      
      // 验证用户角色
      const userDoc = await db.collection('uni-id-users')
        .doc(teacher_id)
        .field({ role: true })
        .get()
      
      if (!userDoc.data || userDoc.data.length === 0) {
        return error('用户不存在')
      }
      
      if (userDoc.data[0].role !== 'teacher') {
        return error('当前账号不是教师角色')
      }
      
      const profileDoc = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .get()
      
      const profileData = profileDoc.result?.data || profileDoc.data || []
      
      if (profileData.length === 0) {
        return error('教师资料不存在')
      }
      
      return success(profileData[0], '获取成功')
      
    } catch (e) {
      console.error('获取教师资料失败:', e)
      return error(e.message || '获取失败')
    }
  },
  
  /**
   * 平台审核通过（管理员功能/测试用）
   * @param {Object} params
   * @param {String} params.teacher_id 教师ID
   * @param {Boolean} params.approve 是否通过
   */
  async approve(params) {
    const { teacher_id, approve = true } = params
    
    try {
      const db = uniCloud.database()
      
      if (!teacher_id) {
        return error('教师ID不能为空')
      }
      
      // 查询教师资料
      const profileDoc = await db.collection('teacher-profiles')
        .where({ teacher_id })
        .get()
      
      const profileData = profileDoc.result?.data || profileDoc.data || []
      
      if (profileData.length === 0) {
        return error('教师资料不存在')
      }
      
      const profile = profileData[0]
      
      // 更新审核状态
      await db.collection('teacher-profiles').doc(profile._id).update({
        is_verified: approve,
        available: approve,
        update_time: Date.now()
      })
      
      // 创建系统消息，通知教师审核结果
      try {
        const messageTitle = approve ? '资料审核通过' : '资料审核未通过'
        const messageContent = approve 
          ? `恭喜！您的教师资料已通过平台审核，现在可以接受学生预约了。`
          : `很抱歉，您的教师资料未通过审核。请检查并完善资料后重新提交。如有疑问，请联系客服。`
        
        await db.collection('system-messages').add({
          user_id: teacher_id,
          type: 'system',
          title: messageTitle,
          content: messageContent,
          related_id: profile._id,
          action: {
            type: 'navigate',
            path: '/pages-teacher/profile/index'
          },
          action_url: '/pages-teacher/profile/index',  // 兼容字段，用于前端跳转
          is_read: false
        })
        console.log(`已为教师 ${teacher_id} 创建审核结果消息，审核${approve ? '通过' : '未通过'}`)
      } catch (msgError) {
        console.error('创建系统消息失败:', msgError)
        // 消息创建失败不影响主流程，只记录错误
      }
      
      console.log(`教师 ${teacher_id} 审核${approve ? '通过' : '未通过'}`)
      
      return success({
        teacher_id,
        is_verified: approve,
        available: approve
      }, approve ? '审核通过，教师可以接受预约' : '审核未通过')
      
    } catch (e) {
      console.error('审核教师失败:', e)
      return error(e.message || '审核失败')
    }
  }
}

