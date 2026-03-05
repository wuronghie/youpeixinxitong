'use strict';

const { success, error, paramError, unauthorized, handlePagination, formatPageResult } = require('common');

/**
 * 搜索历史云函数
 * 功能：保存、获取、删除搜索历史记录
 */
exports.main = async (event, context) => {
  const { action, searchData, page, pageSize } = event;

  // 参数验证
  if (!action) {
    return paramError('操作类型不能为空');
  }

  const db = uniCloud.database();
  const dbCmd = db.command;

  try {
    // 1. 验证用户身份
    const { uid } = context;
    if (!uid) {
      return unauthorized('请先登录');
    }

    switch (action) {
      case 'save':
        return await saveSearchHistory(db, uid, searchData);
      case 'get':
        return await getSearchHistory(db, uid, page, pageSize);
      case 'delete':
        return await deleteSearchHistory(db, uid, searchData);
      case 'clear':
        return await clearSearchHistory(db, uid);
      default:
        return paramError('不支持的操作类型');
    }

  } catch (err) {
    console.error('搜索历史操作失败：', err);
    return error('操作失败，请稍后重试');
  }
};

/**
 * 保存搜索历史
 * @param {Object} db - 数据库实例
 * @param {String} userId - 用户ID
 * @param {Object} searchData - 搜索数据
 */
async function saveSearchHistory(db, userId, searchData) {
  if (!searchData || !searchData.keyword) {
    return paramError('搜索关键词不能为空');
  }

  const searchRecord = {
    userId,
    keyword: searchData.keyword.trim(),
    filters: searchData.filters || {},
    searchTime: new Date(),
    createTime: new Date()
  };

  // 检查是否已存在相同的搜索记录
  const existingQuery = await db.collection('search_history')
    .where({
      userId,
      keyword: searchRecord.keyword
    })
    .get();

  if (existingQuery.data.length > 0) {
    // 更新现有记录的时间
    await db.collection('search_history')
      .doc(existingQuery.data[0]._id)
      .update({
        searchTime: new Date(),
        filters: searchRecord.filters
      });
  } else {
    // 创建新记录
    await db.collection('search_history').add(searchRecord);
  }

  return success({
    message: '搜索历史保存成功'
  });
}

/**
 * 获取搜索历史
 * @param {Object} db - 数据库实例
 * @param {String} userId - 用户ID
 * @param {Number} page - 页码
 * @param {Number} pageSize - 每页数量
 */
async function getSearchHistory(db, userId, page = 1, pageSize = 20) {
  const { page: currentPage, pageSize: currentPageSize, skip } = handlePagination(page, pageSize);

  // 查询搜索历史
  const historyQuery = await db.collection('search_history')
    .where({
      userId
    })
    .orderBy('searchTime', 'desc')
    .skip(skip)
    .limit(currentPageSize)
    .get();

  // 获取总数
  const countQuery = await db.collection('search_history')
    .where({
      userId
    })
    .count();

  return success({
    list: historyQuery.data,
    total: countQuery.total,
    page: currentPage,
    pageSize: currentPageSize,
    totalPages: Math.ceil(countQuery.total / currentPageSize)
  });
}

/**
 * 删除搜索历史
 * @param {Object} db - 数据库实例
 * @param {String} userId - 用户ID
 * @param {Object} searchData - 搜索数据
 */
async function deleteSearchHistory(db, userId, searchData) {
  if (!searchData || !searchData.keyword) {
    return paramError('搜索关键词不能为空');
  }

  const result = await db.collection('search_history')
    .where({
      userId,
      keyword: searchData.keyword
    })
    .remove();

  return success({
    message: '搜索历史删除成功',
    deletedCount: result.deleted
  });
}

/**
 * 清空搜索历史
 * @param {Object} db - 数据库实例
 * @param {String} userId - 用户ID
 */
async function clearSearchHistory(db, userId) {
  const result = await db.collection('search_history')
    .where({
      userId
    })
    .remove();

  return success({
    message: '搜索历史清空成功',
    deletedCount: result.deleted
  });
}
