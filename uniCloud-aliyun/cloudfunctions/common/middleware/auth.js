/**
 * 权限验证中间件
 */

const uniID = require('uni-id-common')

/**
 * 验证用户登录状态
 * @param {Object} event 云函数event对象
 * @returns {Object} payload 包含用户信息
 * @throws {Error} 未登录或登录过期
 */
async function requireAuth(event) {
  const uniIdIns = uniID.createInstance({
    context: event.context
  })
  
  const token = event.uniIdToken || event.token
  if (!token) {
    throw new Error('未登录，请先登录')
  }
  
  const payload = await uniIdIns.checkToken(token)
  if (payload.code !== 0) {
    throw new Error('登录已过期，请重新登录')
  }
  
  return payload
}

/**
 * 验证用户角色
 * @param {Object} event 云函数event对象
 * @param {String} requiredRole 需要的角色（parent/teacher）
 * @returns {Object} 用户信息
 * @throws {Error} 权限不足
 */
async function requireRole(event, requiredRole) {
  const payload = await requireAuth(event)
  const userInfo = payload.userInfo
  
  if (!userInfo.role) {
    throw new Error('用户角色未设置')
  }
  
  if (userInfo.role !== requiredRole) {
    throw new Error(`权限不足，需要${requiredRole}角色`)
  }
  
  return {
    uid: payload.uid,
    ...userInfo
  }
}

/**
 * 验证是否为家长
 * @param {Object} event 
 * @returns {Object} 用户信息
 */
async function requireParent(event) {
  return await requireRole(event, 'parent')
}

/**
 * 验证是否为教师
 * @param {Object} event 
 * @returns {Object} 用户信息
 */
async function requireTeacher(event) {
  return await requireRole(event, 'teacher')
}

/**
 * 获取当前用户信息（不强制要求登录）
 * @param {Object} event 
 * @returns {Object|null} 用户信息或null
 */
async function getCurrentUser(event) {
  try {
    const payload = await requireAuth(event)
    return {
      uid: payload.uid,
      ...payload.userInfo
    }
  } catch (e) {
    return null
  }
}

/**
 * 验证数据所有权
 * @param {String} userId 数据所属用户ID
 * @param {String} currentUserId 当前用户ID
 * @param {String} message 错误提示
 * @throws {Error} 无权操作
 */
function checkOwnership(userId, currentUserId, message = '无权操作此数据') {
  if (userId !== currentUserId) {
    throw new Error(message)
  }
}

module.exports = {
  requireAuth,
  requireRole,
  requireParent,
  requireTeacher,
  getCurrentUser,
  checkOwnership
}

