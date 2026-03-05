/**
 * Token 验证辅助函数
 * 支持 uni-id 标准 token 和简单 base64 token
 */

/**
 * 验证 token 并获取用户 ID
 * @param {Object} uniID uni-id 实例
 * @param {String} token token 字符串
 * @returns {Object} { success: Boolean, uid: String, error: String }
 */
async function verifyTokenAndGetUid(uniID, token) {
  if (!token) {
    return { success: false, error: '未获取到token，请先登录' }
  }
  
  // 首先尝试使用 uni-id-common 验证标准 token
  try {
    const payload = await uniID.checkToken(token)
    
    // 根据 uni-id-common 文档：如果 payload.code 存在，说明有错误
    if (payload.code) {
      // 标准 token 验证失败，尝试解析简单 token
      console.log('[token-helper] uni-id token验证失败，尝试解析简单token，code:', payload.code)
      throw new Error('uni-id token验证失败')
    } else {
      // 验证成功
      return { success: true, uid: payload.uid }
    }
  } catch (checkError) {
    // uni-id token 验证失败，尝试解析简单 token（base64格式：uid_timestamp_random）
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      if (parts.length >= 1) {
        const uid = parts[0]
        console.log('[token-helper] 简单token解析成功，uid:', uid)
        return { success: true, uid: uid }
      } else {
        return { success: false, error: 'token格式错误' }
      }
    } catch (decodeError) {
      console.error('[token-helper] token解析失败:', decodeError)
      return { success: false, error: 'token验证失败，请重新登录' }
    }
  }
}

module.exports = {
  verifyTokenAndGetUid
}

