/**
 * 用户登录云对象
 * 功能：微信登录、角色选择、自动创建教师主页和钱包
 * 使用 uni-id-common 标准方式
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

/**
 * 创建教师主页
 * @param {String} uid 用户ID
 * @param {Object} userData 用户数据
 */
async function createTeacherProfile(uid, userData) {
  const db = uniCloud.database()
  const teacherProfiles = db.collection('teacher-profiles')
  
  // 检查是否已存在
  const existing = await teacherProfiles.where({ teacher_id: uid }).count()
  if (existing.total > 0) {
    console.log(`教师主页已存在，跳过创建: ${uid}`)
    return
  }
  
  console.log(`创建教师主页: ${uid}`)
  await teacherProfiles.add({
    teacher_id: uid,
    display_name: userData.nickname || '未命名教师',
    avatar: userData.avatar || '',
    subjects: [],
    grades: [],
    hourly_rate: 0,
    rating: 5.0,
    review_count: 0,
    introduction: '',
    teaching_experience: {
      years: 0,
      description: ''
    },
    certification: {
      teacher_cert: '',
      education_cert: '',
      verify_status: 'pending'
    },
    teaching_areas: [],
    is_verified: false,
    available: false, // 默认不可预约，需要完善信息后才开放
    total_courses: 0,
    total_students: 0,
    create_time: Date.now(),
    update_time: Date.now()
  })
}

/**
 * 创建教师钱包
 * @param {String} uid 用户ID
 */
async function createTeacherWallet(uid) {
  const db = uniCloud.database()
  const walletCollection = db.collection('teacher-wallet')
  
  // 检查是否已存在
  const existing = await walletCollection.where({ teacher_id: uid }).count()
  if (existing.total > 0) {
    console.log(`教师钱包已存在，跳过创建: ${uid}`)
    return
  }
  
  console.log(`创建教师钱包: ${uid}`)
  await walletCollection.add({
    teacher_id: uid,
    balance: 0,
    frozen_amount: 0,
    total_income: 0,
    total_withdraw: 0,
    deposit_total: 0,
    deposit_refunded: 0,
    create_time: Date.now(),
    update_time: Date.now()
  })
}

function decodeSimpleToken(token) {
  if (typeof token !== 'string' || !token) return null
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    if (!decoded || decoded.indexOf('_') === -1) return null
    const [uid] = decoded.split('_')
    return uid || null
  } catch (err) {
    return null
  }
}

module.exports = {
  _before: function() {
    // 云对象前置方法，初始化 uni-id 实例
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
    console.log('uni-id 实例初始化完成:', !!this.uniID)
  },
  
  /**
   * 微信登录
   * @param {Object} params
   * @param {String} params.code 微信登录code
   * @param {String} params.role 用户角色（parent/teacher）首次登录必传
   * @returns {Object}
   */
  async login(params) {
    const { code, role } = params
    
    if (!code) {
      return error('缺少登录凭证code')
    }
    
    try {
      const db = uniCloud.database()
      
      console.log('开始微信登录，code:', code)
      
      // 从配置中心获取微信小程序 AppID 和 Secret
      const configCenter = require('uni-config-center')({ pluginId: 'uni-id' })
      const uniIdConfig = configCenter.config()
      
      // 获取小程序配置（优先使用 mp-weixin，如果没有则使用 app 配置）
      let weixinConfig = null
      if (Array.isArray(uniIdConfig)) {
        // 多维配置，查找当前应用配置
        const clientInfo = this.getClientInfo()
        const appConfig = uniIdConfig.find(config => 
          config.dcloudAppid === clientInfo.appId || !config.dcloudAppid
        ) || uniIdConfig[0]
        weixinConfig = appConfig?.['mp-weixin']?.oauth?.weixin || appConfig?.app?.oauth?.weixin
      } else {
        // 单维配置
        weixinConfig = uniIdConfig?.['mp-weixin']?.oauth?.weixin || uniIdConfig?.app?.oauth?.weixin
      }
      
      // 如果配置中心没有，使用 manifest.json 中的配置（从环境变量或硬编码）
      const appid = weixinConfig?.appid || process.env.WX_MP_APPID || 'wx920e8bcaa338caf6'
      const secret = weixinConfig?.appsecret || process.env.WX_MP_SECRET || ''
      
      if (!appid) {
        console.error('微信小程序 AppID 未配置')
        return error('微信登录配置错误：AppID 未配置')
      }
      
      if (!secret) {
        console.error('微信小程序 Secret 未配置，AppID:', appid)
        return error('微信登录配置错误：Secret 未配置，请在小程序后台获取 AppSecret 并配置到 uni-config-center/uni-id/config.json 的 mp-weixin.oauth.weixin.appsecret')
      }
      
      console.log('使用 AppID:', appid)
      
      // 直接使用微信接口获取 openid 和 session_key
      const weixinResult = await uniCloud.httpclient.request(
        'https://api.weixin.qq.com/sns/jscode2session',
        {
          method: 'GET',
          data: {
            appid: appid,
            secret: secret,
            js_code: code,
            grant_type: 'authorization_code'
          },
          dataType: 'json'
        }
      )
      
      if (weixinResult.status !== 200 || !weixinResult.data) {
        return error('微信登录失败：网络错误')
      }
      
      const wxData = weixinResult.data
      
      if (wxData.errcode) {
        console.error('微信code2Session错误:', wxData)
        return error(`微信登录失败：${wxData.errmsg}`)
      }
      
      const openid = wxData.openid
      const sessionKey = wxData.session_key
      const unionid = wxData.unionid || ''
      
      if (!openid) {
        return error('微信登录失败：未获取到openid')
      }
      
      console.log('微信登录成功，openid:', openid, 'hasUnionid:', !!unionid)
      
      // 查找或创建用户
      const usersCollection = db.collection('uni-id-users')
      let userDoc = await usersCollection.where({
        wx_openid: {
          mp: openid
        }
      }).get()

      // 若按 mp openid 找不到，但有 unionid，再按 unionid 兜底（避免多端身份分裂）
      if ((!userDoc.data || userDoc.data.length === 0) && unionid) {
        userDoc = await usersCollection.where({ wx_unionid: unionid }).limit(1).get()
      }
      
      let uid
      let userData
      
      if (!userDoc.data || userDoc.data.length === 0) {
        // 新用户，创建记录
        const newUser = {
          wx_openid: {
            mp: openid
          },
          wx_session_key: {
            mp: sessionKey
          },
          register_date: Date.now(),
          register_ip: '',
          last_login_date: Date.now(),
          last_login_ip: ''
        }
        if (unionid) {
          newUser.wx_unionid = unionid
        }
        
        const addResult = await usersCollection.add(newUser)
        uid = addResult.id
        userData = newUser
        userData._id = uid
        console.log('新用户创建成功，uid:', uid)
      } else {
        // 老用户，更新 session_key / unionid / 登录时间
        userData = userDoc.data[0]
        uid = userData._id
        
        const loginPatch = {
          wx_session_key: {
            mp: sessionKey
          },
          last_login_date: Date.now(),
          'wx_openid.mp': openid
        }
        if (unionid) {
          loginPatch.wx_unionid = unionid
        }
        await usersCollection.doc(uid).update(loginPatch)
        if (unionid) {
          userData.wx_unionid = unionid
        }
        const wxOpenid = Object.assign({}, userData.wx_openid || {}, { mp: openid })
        userData.wx_openid = wxOpenid
        console.log('老用户登录成功，uid:', uid, 'hasUnionid:', !!unionid)
      }

      // 登录后：用 unionid 补绑服务号 openid（关注时若用户尚未有 unionid 会落入 pending）
      if (unionid) {
        try {
          const pendingRes = await db.collection('wx-oa-pending-bind')
            .where({ unionid })
            .limit(5)
            .get()
          const pendingList = pendingRes.data || []
          for (const p of pendingList) {
            const oaOpenid = p.oa_openid || p._id
            if (!oaOpenid) continue
            const wx_openid = Object.assign({}, userData.wx_openid || {}, { mp: openid, h5: oaOpenid })
            await usersCollection.doc(uid).update({ wx_openid })
            userData.wx_openid = wx_openid
            try {
              await db.collection('wx-oa-pending-bind').doc(p._id).remove()
            } catch (e) {}
            console.log('登录补绑服务号 openid 成功', { uid, oaOpenid })
          }
        } catch (bindErr) {
          console.warn('登录补绑服务号失败（可忽略）:', bindErr.message || bindErr)
        }
      }
      
      // 使用 uni-id-common 生成 token（不传 role，避免 $in 期望数组的错误）
      let token, tokenExpired
      try {
        if (this.uniID && typeof this.uniID.createToken === 'function') {
          const tokenResult = await this.uniID.createToken({ uid })
          token = tokenResult.token
          tokenExpired = tokenResult.tokenExpired
          console.log('使用 uni-id 生成 token')
        } else {
          // 回退到简单 token
          token = Buffer.from(`${uid}_${Date.now()}_${Math.random()}`).toString('base64')
          tokenExpired = Date.now() + 7200000 // 2小时后过期
          console.log('使用简单 token')
        }
      } catch (tokenError) {
        console.error('生成 token 失败，使用简单 token:', tokenError)
        token = Buffer.from(`${uid}_${Date.now()}_${Math.random()}`).toString('base64')
        tokenExpired = Date.now() + 7200000
      }

      // 单账号单角色：获取当前账号的角色
      const currentRole = userData.role || null
      const hadRole = !!currentRole

      const updateData = {
        last_login_date: Date.now()
      }

      if (!hadRole) {
        // 新用户，首次登录必须选择角色
        if (!role) {
          return error('首次登录需要选择角色（parent/teacher）')
        }
        if (role !== 'parent' && role !== 'teacher') {
          return error('角色参数错误，只能是parent或teacher')
        }
        updateData.role = role
        updateData.status = 'active'
        updateData.update_date = Date.now()
        if (role === 'teacher') {
          await createTeacherProfile(uid, userData)
          await createTeacherWallet(uid)
        }
      } else {
        // 老用户，检查角色是否匹配
        if (!role) {
          // 未传角色，使用当前角色
          updateData.role = currentRole
        } else if (role !== currentRole) {
          // 角色不匹配，拒绝登录
          return error(`当前账号已绑定为${currentRole === 'teacher' ? '教师' : '家长'}身份，如需切换角色请先注销账号后重新注册`)
        }
        // 角色匹配，正常登录
        updateData.role = currentRole
        if (currentRole === 'teacher') {
          // 确保教师主页和钱包存在
          await createTeacherProfile(uid, userData)
          await createTeacherWallet(uid)
        }
      }

      await usersCollection.doc(uid).update(updateData)

      const isFirstLogin = !hadRole
      const finalRole = updateData.role

      userData.role = finalRole
      userData.status = userData.status || updateData.status || 'active'

      // 登录成功后，按活动配置发放“登录送券”
      try {
        if (finalRole === 'parent') {
          const activitiesCol = db.collection('coupon-activities')
          const now = Date.now()
          const dbCmd = db.command
          const actRes = await activitiesCol
            .where({
              type: 'login_reward',
              status: 'active',
              target_role: dbCmd.in(['parent', 'all']),
              start_time: dbCmd.lte(new Date(now)),
              end_time: dbCmd.gte(new Date(now))
            })
            .limit(1)
            .get()

          if (actRes.data && actRes.data.length > 0) {
            const activity = actRes.data[0]
            const userCoupons = db.collection('user-coupons')

            // 每人限领次数控制
            let canIssue = true
            if (activity.per_user_limit && activity.per_user_limit > 0) {
              const takenCountRes = await userCoupons.where({
                user_id: uid,
                role: 'parent',
                source: 'system',
                activity_id: activity._id
              }).count()
              if (takenCountRes.total >= activity.per_user_limit) {
                canIssue = false
                console.log('[login_reward] 已达到每人限领次数，跳过发券:', uid)
              }
            }

            // 总库存控制（简单计数）
            if (canIssue && activity.total_stock && activity.total_stock > 0) {
              const totalTakenRes = await userCoupons.where({
                activity_id: activity._id
              }).count()
              if (totalTakenRes.total >= activity.total_stock) {
                canIssue = false
                console.log('[login_reward] 活动库存已用完，跳过发券:', activity._id)
              }
            }

            if (canIssue) {
              await userCoupons.add({
                user_id: uid,
                role: 'parent',
                coupon_id: activity.coupon_id,
                source: 'system',
                status: 'unused',
                issue_time: now,
                activity_id: activity._id,
                remark: `活动：${activity.name}（登录送券）`
              })
            }
          }
        }
      } catch (e) {
        console.error('[login_reward] 登录送券处理失败（忽略，不影响登录）:', e)
      }
      
      return success({
        token,
        tokenExpired,
        userInfo: {
          uid,
          nickname: userData.nickname || userData.wx_nickname || '微信用户',
          avatar: userData.avatar || userData.wx_avatarUrl || '',
          role: finalRole,
          status: userData.status || 'active',
          phone: userData.phone || ''
        },
        isFirstLogin
      }, '登录成功')
      
    } catch (e) {
      console.error('登录失败详情:', e)
      console.error('错误堆栈:', e.stack)
      return error(e.message || e.errMsg || '登录失败')
    }
  },
  
  /**
   * 获取当前用户信息（需要token）
   * @returns {Object}
   */
  async getUserInfo(params = {}) {
    try {
      const { role: targetRole = null, token: overrideToken = '' } = params || {}
      // 获取 token 并验证
      const token = overrideToken || this.getUniIdToken()
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 使用 uni-id-common 验证token
      let payload
      try {
        payload = await this.uniID.checkToken(token)
      } catch (checkErr) {
        payload = { code: checkErr.code || -1, msg: checkErr.message || checkErr.errMsg || '' }
      }
      
      let uid = payload && !payload.code ? payload.uid : null
      if (!uid) {
        uid = decodeSimpleToken(token)
      }
      
      if (!uid) {
        return error('登录已过期或token无效')
      }
      
      const db = uniCloud.database()
      
      // 获取用户基本信息
      const userDoc = await db.collection('uni-id-users')
        .doc(uid)
        .field({
          nickname: true,
          avatar: true,
          roles: true,
          role: true,
          status: true,
          phone: true,
          wx_nickname: true,
          wx_avatarUrl: true,
          parent_info: true
        })
        .get()
      
      if (!userDoc.data || userDoc.data.length === 0) {
        return error('用户信息不存在')
      }
      
      const userData = userDoc.data[0]
      
      // 单账号单角色：只返回当前账号的角色
      const currentRole = userData.role || 'parent'
      
      // 如果传入了 targetRole 且与当前角色不匹配，拒绝请求
      if (targetRole && targetRole !== currentRole) {
        return error('当前账号角色不匹配，无法切换到该角色')
      }

      const resultData = {
        uid,
        role: currentRole,
        nickname: userData.nickname || userData.wx_nickname || '微信用户',
        avatar: userData.avatar || userData.wx_avatarUrl || '',
        status: userData.status || 'active',
        phone: userData.phone || '',
        parent_info: userData.parent_info || {}
      }
      
      // 如果是教师，获取教师详细信息
      if (currentRole === 'teacher') {
        const teacherDoc = await db.collection('teacher-profiles')
          .where({ teacher_id: uid })
          .get()
        
        if (teacherDoc.data && teacherDoc.data.length > 0) {
          resultData.teacherProfile = teacherDoc.data[0]
        }
        
        // 获取教师钱包信息
        const walletDoc = await db.collection('teacher-wallet')
          .where({ teacher_id: uid })
          .get()
        
        if (walletDoc.data && walletDoc.data.length > 0) {
          resultData.wallet = walletDoc.data[0]
        }
      } else {
        // 保留已有的 teacherProfile 信息（如果之前缓存过）
        if (userData.teacherProfile) {
          resultData.teacherProfile = userData.teacherProfile
        }
      }
      
      return success(resultData, '获取成功')
      
    } catch (e) {
      console.error('获取用户信息失败:', e)
      return error(e.message || '获取用户信息失败')
    }
  },
  
  /**
   * 注销账号
   * 功能：删除用户账号及相关数据，注销后可以重新注册并选择角色
   * @returns {Object}
   */
  async deleteAccount() {
    try {
      // 获取 token 并验证
      const token = this.getUniIdToken()
      if (!token) {
        return error('未获取到token，请先登录')
      }
      
      // 使用 uni-id-common 验证token
      let payload
      try {
        payload = await this.uniID.checkToken(token)
      } catch (checkErr) {
        payload = { code: checkErr.code || -1, msg: checkErr.message || checkErr.errMsg || '' }
      }
      
      let uid = payload && !payload.code ? payload.uid : null
      if (!uid) {
        uid = decodeSimpleToken(token)
      }
      
      if (!uid) {
        return error('登录已过期或token无效')
      }
      
      const db = uniCloud.database()
      const dbCmd = db.command
      
      // 获取用户信息，确认角色
      const userDoc = await db.collection('uni-id-users')
        .doc(uid)
        .field({
          role: true
        })
        .get()
      
      if (!userDoc.data || userDoc.data.length === 0) {
        return error('用户信息不存在')
      }
      
      const userRole = userDoc.data[0].role
      
      // 如果是教师角色，删除相关数据
      if (userRole === 'teacher') {
        // 删除教师资料
        await db.collection('teacher-profiles')
          .where({ teacher_id: uid })
          .remove()
        
        // 删除教师钱包
        await db.collection('teacher-wallet')
          .where({ teacher_id: uid })
          .remove()
        
        // 删除教师时间表
        await db.collection('teacher-schedule')
          .where({ teacher_id: uid })
          .remove()
      }
      
      // 删除用户的预约记录（作为教师和家长的角色）
      await db.collection('appointments')
        .where(dbCmd.or([
          { teacher_id: uid },
          { parent_id: uid }
        ]))
        .remove()
      
      // 删除评价记录
      await db.collection('reviews')
        .where({ teacher_id: uid })
        .remove()
      
      // 删除聊天记录
      await db.collection('chat-conversations')
        .where(dbCmd.or([
          { teacher_id: uid },
          { parent_id: uid }
        ]))
        .remove()
      
      await db.collection('chat-messages')
        .where(dbCmd.or([
          { teacher_id: uid },
          { parent_id: uid }
        ]))
        .remove()
      
      // 最后删除用户账号
      await db.collection('uni-id-users')
        .doc(uid)
        .remove()
      
      console.log(`账号注销成功: ${uid}`)
      return success(null, '账号注销成功')
      
    } catch (e) {
      console.error('注销账号失败:', e)
      return error(e.message || '注销账号失败')
    }
  }
}
