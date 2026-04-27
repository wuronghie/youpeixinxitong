const DEFAULT_ROLE = 'parent'

// 单账号单角色：不再需要 roles 数组
function normalizeUserInfoFromDb(data = {}) {
  const activeRole = data.role || DEFAULT_ROLE
  return {
    uid: data._id || data.uid,
    nickname: data.nickname || data.wx_nickname || '微信用户',
    avatar: data.avatar || data.wx_avatarUrl || '',
    role: activeRole,
    status: data.status || 'active',
    phone: data.phone || '',
    // 性别（uni-id 约定：0=未知, 1=男, 2=女）
    gender: data.gender != null ? data.gender : 0,
    parent_info: data.parent_info || {},
    teacherProfile: data.teacher_info || data.teacherProfile || {},
    wallet: data.wallet || {}
  }
}

export function getStoredUserInfo() {
  return uni.getStorageSync('userInfo') || {}
}

export function setStoredUserInfo(info = {}) {
  if (info && typeof info === 'object') {
    uni.setStorageSync('userInfo', info)
    if (info.role) {
      uni.setStorageSync('last_role', info.role)
    }
  }
}

export function clearStoredAuth() {
  uni.removeStorageSync('uni_id_token')
  uni.removeStorageSync('token')
  uni.removeStorageSync('userInfo')
  uni.removeStorageSync('last_role')
}

export function redirectByRole(role) {
  // 教师角色跳转到工作台，家长角色跳转到找教师页面
  const url = role === 'teacher' ? '/pages-teacher/index/index' : '/pages/teacher/list'
  // 延迟执行，避免在回调中直接调用导致超时
  setTimeout(() => {
    uni.reLaunch({ url })
  }, 100)
}

/**
 * 检查用户信息是否完善
 * @param {Object} userInfo 用户信息
 * @returns {Object} { isComplete: boolean, message: string }
 */
export async function checkProfileComplete(userInfo) {
  if (!userInfo || !userInfo.role) {
    return { isComplete: false, message: '用户信息不完整' }
  }

  if (userInfo.role === 'parent') {
    // 检查家长信息：家长姓名、性别、手机号、学生信息必须补齐，方便后台/老师联系
    // 注意：phone 存储在 uni-id-users 顶层（userInfo.phone），不是 parent_info.phone
    // 性别存储在 uni-id-users.gender（1=男, 2=女, 0/空=未填）
    const parentInfo = userInfo.parent_info || {}
    const phone = userInfo.phone || userInfo.mobile || parentInfo.phone || ''
    const genderCode = userInfo.gender
    const genderFilled = genderCode === 1 || genderCode === 2 || genderCode === '1' || genderCode === '2' || genderCode === 'male' || genderCode === 'female'
    const studentGender = parentInfo.student_gender
    const studentGenderFilled = studentGender === 'male' || studentGender === 'female' || studentGender === 1 || studentGender === 2 || studentGender === '1' || studentGender === '2'
    const missing = []
    if (!parentInfo.real_name) missing.push('家长姓名')
    if (!genderFilled) missing.push('性别')
    if (!phone) missing.push('手机号')
    if (!parentInfo.student_name) missing.push('学生姓名')
    if (!studentGenderFilled) missing.push('孩子性别')
    if (!parentInfo.student_grade) missing.push('学生年级')
    console.log('[auth] 家长信息检查:', {
      real_name: parentInfo.real_name,
      gender: genderCode,
      phone,
      student_name: parentInfo.student_name,
      student_gender: studentGender,
      student_grade: parentInfo.student_grade,
      missing
    })
    if (missing.length > 0) {
      return {
        isComplete: false,
        message: '请完善资料：' + missing.join('、'),
        redirectUrl: '/pages/common/register'
      }
    }
    return { isComplete: true }
  } else if (userInfo.role === 'teacher') {
    // 检查教师信息：调用云函数检查
    try {
      const dashboard = uniCloud.importObject('teacher-dashboard', { customUI: true })
      const res = await dashboard.checkProfileComplete()
      
      console.log('[auth] 教师信息检查结果:', res)
      
      if (res.code === 0 && res.data) {
        const { isComplete, missingFieldsText } = res.data
        if (!isComplete) {
          return {
            isComplete: false,
            message: `请完善教师资料：${missingFieldsText.join('、')}`,
            redirectUrl: '/pages-teacher/profile/edit',
            missingFields: res.data.missingFields || [],
            missingFieldsText: missingFieldsText || []
          }
        }
        return { isComplete: true }
      } else {
        // 云函数调用失败，默认跳转到首页让用户自己看到提示
        console.warn('[auth] 检查教师信息失败，跳转到首页:', res.message)
        return { isComplete: true } // 返回 true，让用户进入首页，首页会显示提示
      }
    } catch (error) {
      console.error('[auth] 检查教师信息异常:', error)
      // 异常时也返回 true，让用户进入首页
      return { isComplete: true }
    }
  }

  return { isComplete: true }
}

export function ensureLoggedIn(requiredRole = null) {
  const token = uni.getStorageSync('uni_id_token')
  const userInfo = getStoredUserInfo()
  if (!token || !userInfo.uid) {
    uni.reLaunch({ url: '/pages/login/index' })
    return false
  }
  if (requiredRole && userInfo.role !== requiredRole) {
    redirectByRole(userInfo.role || DEFAULT_ROLE)
    return false
  }
  return true
}

// 单账号单角色：不再支持 targetRole 参数
export async function fetchRemoteUserInfo(options = {}) {
  // 优先使用传入的 token，其次从本地读取
  const token = options.token || uni.getStorageSync('uni_id_token')
  if (!token) {
    // 如果没有 token，但本地还有用户信息，就直接返回本地信息
    const local = getStoredUserInfo()
    if (local && local.uid) {
      return local
    }
    throw new Error('未登录或登录已过期')
  }

  try {
    const userProfile = uniCloud.importObject('user-profile', { customUI: true })
    const res = await userProfile.getUserProfile()

    if (res.code === 0 && res.data) {
      const normalized = normalizeUserInfoFromDb(res.data)
      setStoredUserInfo(normalized)
      return normalized
    }

    // 云端调用失败时，回退到本地缓存
    const local = getStoredUserInfo()
    if (local && local.uid) {
      return local
    }

    throw new Error(res.message || '获取用户信息失败')
  } catch (error) {
    console.error('[auth] 获取远程用户信息失败:', error)
    // 失败时，如果本地还有用户信息，仍然返回本地，避免完全无法使用
    const local = getStoredUserInfo()
    if (local && local.uid) {
      return local
    }
    throw error
  }
}

export async function ensureUserInfo(requiredRole = null) {
  if (!ensureLoggedIn(requiredRole)) return null
  const info = getStoredUserInfo()
  if (!info.role || (requiredRole && info.role !== requiredRole)) {
    try {
      const fresh = await fetchRemoteUserInfo()
      return fresh
    } catch (error) {
      uni.showToast({ title: error.message || '获取信息失败', icon: 'none' })
      return null
    }
  }
  return info
}

