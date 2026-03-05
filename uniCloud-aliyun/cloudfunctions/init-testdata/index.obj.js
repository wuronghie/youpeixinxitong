/**
 * 测试数据初始化云对象
 * ⚠️ 仅用于开发环境！生产环境请勿使用！
 */

const uniID = require('uni-id-common')
const { verifyTokenAndGetUid } = require('../common/utils/token-helper')

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
   * 初始化系统配置
   */
  async initSystemConfig() {
    try {
      const token = this.getUniIdToken()
      const { success, uid, error: tokenError } = await verifyTokenAndGetUid(this.uniID, token)
      if (!success) {
        return error(tokenError || 'token验证失败，请重新登录')
      }
      const db = uniCloud.database()
      const userRes = await db.collection('uni-id-users').doc(uid).field({ roles: true, role: true }).get()
      const user = userRes.data && userRes.data[0]
      const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : [])
      if (!roles.includes('admin')) {
        return error('仅管理员可以执行此操作')
      }
      
      
      const collection = db.collection('system-config')
      
      // 清空现有数据（可选）
      // await collection.where({}).remove()
      
      const configs = [
        {
          key: "platform_fee_rate",
          value: 0,
          description: "平台手续费率（正式课程）0%（当前不收取平台费用）",
          create_time: Date.now(),
          update_time: Date.now()
        },
        {
          key: "teacher_deposit_amount",
          value: 1,
          description: "教师确认预约需支付的保证金（元）",
          create_time: Date.now(),
          update_time: Date.now()
        },
        {
          key: "trial_refund_rate",
          value: 0.5,
          description: "试课不满意时家长退款比例 50%",
          create_time: Date.now(),
          update_time: Date.now()
        },
        {
          key: "cancel_hours_limit",
          value: 24,
          description: "开课前多少小时可以取消（小时）",
          create_time: Date.now(),
          update_time: Date.now()
        },
        {
          key: "trial_course_duration",
          value: 2,
          description: "试课时长（小时）",
          create_time: Date.now(),
          update_time: Date.now()
        },
        {
          key: "min_withdraw_amount",
          value: 100,
          description: "最低提现金额（元）",
          create_time: Date.now(),
          update_time: Date.now()
        }
      ]
      
      let successCount = 0
      let errorList = []
      
      for (const config of configs) {
        try {
          // 检查是否已存在
          const existing = await collection.where({ key: config.key }).count()
          if (existing.total > 0) {
            console.log(`配置 ${config.key} 已存在，跳过`)
            continue
          }
          
          await collection.add(config)
          successCount++
          console.log(`添加配置 ${config.key} 成功`)
        } catch (e) {
          errorList.push({ key: config.key, error: e.message })
          console.error(`添加配置 ${config.key} 失败:`, e)
        }
      }
      
      return success({
        total: configs.length,
        success: successCount,
        errors: errorList
      }, `系统配置初始化完成，成功 ${successCount} 条`)
      
    } catch (e) {
      console.error('初始化系统配置失败:', e)
      return error(e.message || '初始化系统配置失败')
    }
  },
  
  /**
   * 创建测试教师数据
   * ⚠️ 需要先手动创建5个教师账号
   */
  async createTestTeachers() {
    try {
      const db = uniCloud.database()
      const collection = db.collection('teacher-profiles')
      
      // 这里需要替换为实际的教师ID
      const teachers = [
        {
          teacher_id: "REPLACE_WITH_REAL_TEACHER_ID_1",
          display_name: "张老师",
          avatar: "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKotsBr2icbYNYlRSlx/132",
          subjects: ["数学", "物理"],
          grades: ["初中", "高中"],
          hourly_rate: 150,
          rating: 4.9,
          review_count: 28,
          introduction: "从教10年，擅长初高中数学和物理教学。多次带出中考满分学生，教学方法独特，注重培养学生的逻辑思维能力。",
          teaching_experience: {
            years: 10,
            description: "重点中学任教10年，带过3届毕业班"
          },
          certification: {
            teacher_cert: "https://example.com/cert1.jpg",
            education_cert: "https://example.com/edu1.jpg",
            verify_status: "approved"
          },
          teaching_areas: [
            {
              province: "广东省",
              city: "深圳市",
              district: "南山区",
              address: ""
            }
          ],
          is_verified: true,
          available: true,
          total_courses: 156,
          total_students: 42,
          create_time: Date.now(),
          update_time: Date.now()
        },
        {
          teacher_id: "REPLACE_WITH_REAL_TEACHER_ID_2",
          display_name: "李老师",
          avatar: "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKotsBr2icbYNYlRSlx/132",
          subjects: ["英语"],
          grades: ["小学", "初中", "高中"],
          hourly_rate: 120,
          rating: 4.8,
          review_count: 35,
          introduction: "英语专业八级，留学英国3年，口语纯正。擅长提高学生的英语口语和写作能力，注重培养英语思维。",
          teaching_experience: {
            years: 8,
            description: "培训机构资深英语教师，雅思托福辅导经验丰富"
          },
          certification: {
            teacher_cert: "https://example.com/cert2.jpg",
            education_cert: "https://example.com/edu2.jpg",
            verify_status: "approved"
          },
          teaching_areas: [
            {
              province: "广东省",
              city: "深圳市",
              district: "福田区",
              address: ""
            }
          ],
          is_verified: true,
          available: true,
          total_courses: 203,
          total_students: 58,
          create_time: Date.now(),
          update_time: Date.now()
        },
        {
          teacher_id: "REPLACE_WITH_REAL_TEACHER_ID_3",
          display_name: "王老师",
          avatar: "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKotsBr2icbYNYlRSlx/132",
          subjects: ["语文", "历史"],
          grades: ["初中", "高中"],
          hourly_rate: 100,
          rating: 4.7,
          review_count: 21,
          introduction: "师范大学中文系毕业，热爱文学和历史。教学风格幽默风趣，善于激发学生的学习兴趣。",
          teaching_experience: {
            years: 6,
            description: "中学语文教师，多次获得优秀教师称号"
          },
          certification: {
            teacher_cert: "https://example.com/cert3.jpg",
            education_cert: "https://example.com/edu3.jpg",
            verify_status: "approved"
          },
          teaching_areas: [
            {
              province: "广东省",
              city: "深圳市",
              district: "罗湖区",
              address: ""
            }
          ],
          is_verified: true,
          available: true,
          total_courses: 87,
          total_students: 26,
          create_time: Date.now(),
          update_time: Date.now()
        }
      ]
      
      let successCount = 0
      let errorList = []
      
      for (const teacher of teachers) {
        try {
          // 检查teacher_id是否为占位符
          if (teacher.teacher_id.includes('REPLACE_WITH')) {
            errorList.push({ 
              name: teacher.display_name, 
              error: '请先替换为实际的教师ID' 
            })
            continue
          }
          
          // 检查是否已存在
          const existing = await collection.where({ 
            teacher_id: teacher.teacher_id 
          }).count()
          
          if (existing.total > 0) {
            console.log(`教师 ${teacher.display_name} 已存在，跳过`)
            continue
          }
          
          await collection.add(teacher)
          successCount++
          console.log(`添加教师 ${teacher.display_name} 成功`)
        } catch (e) {
          errorList.push({ name: teacher.display_name, error: e.message })
          console.error(`添加教师 ${teacher.display_name} 失败:`, e)
        }
      }
      
      return success({
        total: teachers.length,
        success: successCount,
        errors: errorList
      }, `测试教师数据创建完成，成功 ${successCount} 条`)
      
    } catch (e) {
      console.error('创建测试教师数据失败:', e)
      return error(e.message || '创建测试教师数据失败')
    }
  },
  
  /**
   * 一键初始化所有测试数据
   */
  async initAll() {
    try {
      const results = []
      
      // 1. 初始化系统配置
      console.log('开始初始化系统配置...')
      const configResult = await this.initSystemConfig()
      results.push({ 
        step: '系统配置', 
        result: configResult 
      })
      
      // 2. 创建测试教师（需要手动替换ID）
      console.log('开始创建测试教师...')
      const teacherResult = await this.createTestTeachers()
      results.push({ 
        step: '测试教师', 
        result: teacherResult 
      })
      
      return success(results, '测试数据初始化完成')
      
    } catch (e) {
      console.error('初始化测试数据失败:', e)
      return error(e.message || '初始化测试数据失败')
    }
  },
  
  /**
   * 清空所有测试数据（危险操作！）
   */
  async clearAll() {
    try {
      const db = uniCloud.database()
      
      // 只清空可以清空的表
      const collections = [
        'teacher-profiles',
        'appointments',
        'payment-orders',
        'chat-conversations',
        'chat-messages',
        'reviews',
        'withdraw-records',
        'teacher-schedule',
        'system-messages'
      ]
      
      const results = []
      
      for (const collectionName of collections) {
        try {
          const collection = db.collection(collectionName)
          const result = await collection.where({}).remove()
          results.push({
            collection: collectionName,
            deleted: result.deleted
          })
          console.log(`清空 ${collectionName} 成功，删除 ${result.deleted} 条`)
        } catch (e) {
          results.push({
            collection: collectionName,
            error: e.message
          })
          console.error(`清空 ${collectionName} 失败:`, e)
        }
      }
      
      return success(results, '测试数据清空完成')
      
    } catch (e) {
      console.error('清空测试数据失败:', e)
      return error(e.message || '清空测试数据失败')
    }
  }
}

