'use strict';

/**
 * 云函数公共工具库
 */

/**
 * 统一响应格式
 * @param {Number} code - 状态码
 * @param {String} message - 提示信息
 * @param {Any} data - 数据
 */
function createResponse(code = 0, message = '操作成功', data = null) {
  return {
    code,
    message,
    data
  };
}

/**
 * 成功响应
 * @param {Any} data - 数据
 * @param {String} message - 提示信息
 */
function success(data = null, message = '操作成功') {
  return createResponse(0, message, data);
}

/**
 * 失败响应
 * @param {String} message - 错误信息
 * @param {Number} code - 错误码
 */
function error(message = '操作失败', code = 500) {
  return createResponse(code, message, null);
}

/**
 * 参数验证错误
 * @param {String} message - 错误信息
 */
function paramError(message = '参数错误') {
  return createResponse(400, message, null);
}

/**
 * 未授权错误
 * @param {String} message - 错误信息
 */
function unauthorized(message = '未授权，请先登录') {
  return createResponse(401, message, null);
}

/**
 * 未找到错误
 * @param {String} message - 错误信息
 */
function notFound(message = '未找到相关数据') {
  return createResponse(404, message, null);
}

/**
 * 验证手机号
 * @param {String} phone - 手机号
 */
function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 验证邮箱
 * @param {String} email - 邮箱
 */
function validateEmail(email) {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(email);
}

/**
 * 生成订单号
 * @param {String} prefix - 前缀
 */
function generateOrderNo(prefix = 'ORD') {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `${prefix}${year}${month}${day}${hours}${minutes}${seconds}${random}`;
}

/**
 * 检查用户是否被封禁
 * @param {Object} db - 数据库实例
 * @param {String} userId - 用户ID
 */
async function checkUserBlocked(db, userId) {
  const userQuery = await db.collection('users').doc(userId).field('isBlocked').get();
  
  if (userQuery.data.length === 0) {
    return {
      blocked: false,
      notFound: true
    };
  }
  
  return {
    blocked: userQuery.data[0].isBlocked || false,
    notFound: false
  };
}

/**
 * 验证用户权限
 * @param {Object} db - 数据库实例
 * @param {String} userId - 用户ID
 * @param {String} requiredType - 需要的用户类型
 */
async function checkUserType(db, userId, requiredType) {
  const userQuery = await db.collection('users').doc(userId).field('userType').get();
  
  if (userQuery.data.length === 0) {
    return false;
  }
  
  return userQuery.data[0].userType === requiredType;
}

/**
 * 分页参数处理
 * @param {Number} page - 页码
 * @param {Number} pageSize - 每页数量
 */
function handlePagination(page = 1, pageSize = 10) {
  page = Math.max(1, parseInt(page) || 1);
  pageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 10));
  
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };
}

/**
 * 格式化分页结果
 * @param {Array} list - 数据列表
 * @param {Number} total - 总数
 * @param {Number} page - 当前页
 * @param {Number} pageSize - 每页数量
 */
function formatPageResult(list, total, page, pageSize) {
  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

/**
 * 计算评分平均值
 * @param {Number} currentRating - 当前评分
 * @param {Number} currentCount - 当前评价数
 * @param {Number} newRating - 新评分
 */
function calculateAverageRating(currentRating, currentCount, newRating) {
  const totalScore = currentRating * currentCount + newRating;
  const newCount = currentCount + 1;
  return Math.round((totalScore / newCount) * 10) / 10; // 保留一位小数
}

/**
 * 隐藏敏感信息
 * @param {String} str - 原字符串
 * @param {Number} start - 开始位置
 * @param {Number} end - 结束位置
 */
function maskString(str, start = 3, end = 7) {
  if (!str || str.length < start + (str.length - end)) {
    return str;
  }
  return str.substring(0, start) + '****' + str.substring(end);
}

/**
 * 验证日期格式 YYYY-MM-DD
 * @param {String} dateStr - 日期字符串
 */
function validateDate(dateStr) {
  if (!dateStr) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * 获取日期范围
 * @param {String} type - 类型：today, week, month, year
 */
function getDateRange(type) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let start, end;
  
  switch (type) {
    case 'today':
      start = today.getTime();
      end = today.getTime() + 24 * 60 * 60 * 1000 - 1;
      break;
    case 'week':
      const dayOfWeek = today.getDay() || 7; // 周日为0，转为7
      start = today.getTime() - (dayOfWeek - 1) * 24 * 60 * 60 * 1000;
      end = start + 7 * 24 * 60 * 60 * 1000 - 1;
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1).getTime();
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
      break;
    default:
      start = today.getTime();
      end = today.getTime() + 24 * 60 * 60 * 1000 - 1;
  }
  
  return { start, end };
}

module.exports = {
  createResponse,
  success,
  error,
  paramError,
  unauthorized,
  notFound,
  validatePhone,
  validateEmail,
  generateOrderNo,
  checkUserBlocked,
  checkUserType,
  handlePagination,
  formatPageResult,
  calculateAverageRating,
  maskString,
  validateDate,
  getDateRange
};

