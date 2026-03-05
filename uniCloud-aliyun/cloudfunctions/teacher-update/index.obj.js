/**
 * 教师数据更新云对象
 * 功能：批量完善教师数据（开发测试用）
 */

const uniID = require('uni-id-common')
const { verifyTokenAndGetUid } = require('../common/utils/token-helper')

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
   * 批量完善教师数据
   */
  async updateAll() {
    try {
      const token = this.getUniIdToken()
      const { success, uid, error: tokenError } = await verifyTokenAndGetUid(this.uniID, token)
      if (!success) {
        return error(tokenError || 'token验证失败，请重新登录')
      }

      const db = uniCloud.database()
      const userRes = await db.collection('uni-id-users').doc(uid).field({ roles: true, role: true }).get()
      const userInfo = userRes.data && userRes.data[0]
      const roles = Array.isArray(userInfo?.roles) ? userInfo.roles : (userInfo?.role ? [userInfo.role] : [])
      if (!roles.includes('admin')) {
        return error('仅管理员可以执行此操作')
      }
      
      console.log('开始查询教师数据...')
      
      // 1. 查询所有教师
      const result = await db.collection('teacher-profiles').get()
      const teacherData = result.result?.data || result.data || []
      
      console.log(`找到 ${teacherData.length} 个教师`)
      
      if (teacherData.length === 0) {
        return error('没有找到教师数据')
      }
      
      // 2. 更新每个教师
      let updateCount = 0
      for (const teacher of teacherData) {
        await db.collection('teacher-profiles').doc(teacher._id).update({
          display_name: teacher.display_name || '测试教师',
          subjects: teacher.subjects && teacher.subjects.length > 0 ? teacher.subjects : ['数学', '物理'],
          grades: teacher.grades && teacher.grades.length > 0 ? teacher.grades : ['初中', '高中'],
          hourly_rate: teacher.hourly_rate || 150,
          rating: teacher.rating || 4.9,
          review_count: teacher.review_count || 10,
          introduction: teacher.introduction || '测试教师，擅长数学和物理教学，有5年教学经验',
          teaching_experience: teacher.teaching_experience || {
            years: 5,
            description: '5年一线教学经验'
          },
          teaching_areas: teacher.teaching_areas && teacher.teaching_areas.length > 0 ? teacher.teaching_areas : [{
            province: '广东省',
            city: '深圳市',
            district: '南山区',
            address: ''
          }],
          is_verified: true,    // 关键！设置为已认证
          available: true,      // 关键！设置为可预约
          total_courses: teacher.total_courses || 50,
          total_students: teacher.total_students || 20,
          update_time: Date.now()
        })
        updateCount++
        console.log(`已更新教师：${teacher.teacher_id}`)
      }
      
      console.log(`完善教师数据完成，共更新 ${updateCount} 个教师`)
      
      return success({
        updateCount,
        teachers: teacherData.map(t => ({
          id: t.teacher_id,
          name: t.display_name || '测试教师'
        }))
      }, `完善成功！共更新 ${updateCount} 个教师`)
      
    } catch (e) {
      console.error('完善教师数据失败:', e)
      return error(e.message || '操作失败')
    }
  }
}

