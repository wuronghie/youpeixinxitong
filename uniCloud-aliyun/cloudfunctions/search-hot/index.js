'use strict';

const { success, error, paramError } = require('common');

/**
 * 热门搜索云函数
 * 功能：获取热门搜索推荐和搜索建议
 */
exports.main = async (event, context) => {
  const { type = 'hot', limit = 10 } = event;

  const db = uniCloud.database();
  const dbCmd = db.command;

  try {
    switch (type) {
      case 'hot':
        return await getHotSearches(db, limit);
      case 'suggest':
        return await getSearchSuggestions(db, event.keyword, limit);
      case 'trending':
        return await getTrendingSearches(db, limit);
      default:
        return paramError('不支持的类型');
    }

  } catch (err) {
    console.error('获取热门搜索失败：', err);
    return error('获取失败，请稍后重试');
  }
};

/**
 * 获取热门搜索
 * @param {Object} db - 数据库实例
 * @param {Number} limit - 限制数量
 */
async function getHotSearches(db, limit) {
  try {
    // 从搜索历史中统计热门关键词
    const hotSearchesQuery = await db.collection('search_history')
      .aggregate()
      .group({
        _id: '$keyword',
        count: dbCmd.sum(1),
        lastSearchTime: dbCmd.max('$searchTime')
      })
      .sort({
        count: -1,
        lastSearchTime: -1
      })
      .limit(limit)
      .end();

    const hotSearches = hotSearchesQuery.data.map(item => ({
      keyword: item._id,
      count: item.count,
      lastSearchTime: item.lastSearchTime
    }));

    // 如果没有搜索历史，返回默认热门搜索
    if (hotSearches.length === 0) {
      const defaultHotSearches = [
        { keyword: '数学', count: 0, isDefault: true },
        { keyword: '英语', count: 0, isDefault: true },
        { keyword: '物理', count: 0, isDefault: true },
        { keyword: '化学', count: 0, isDefault: true },
        { keyword: '语文', count: 0, isDefault: true }
      ];
      return success({
        list: defaultHotSearches.slice(0, limit)
      });
    }

    return success({
      list: hotSearches
    });

  } catch (err) {
    console.error('获取热门搜索失败：', err);
    return error('获取热门搜索失败');
  }
}

/**
 * 获取搜索建议
 * @param {Object} db - 数据库实例
 * @param {String} keyword - 关键词
 * @param {Number} limit - 限制数量
 */
async function getSearchSuggestions(db, keyword, limit) {
  if (!keyword || keyword.trim().length < 1) {
    return success({ list: [] });
  }

  try {
    const keywordTrim = keyword.trim();
    
    // 从搜索历史中查找相关建议
    const suggestionsQuery = await db.collection('search_history')
      .where({
        keyword: new RegExp(keywordTrim, 'i')
      })
      .field({
        keyword: true,
        searchTime: true
      })
      .orderBy('searchTime', 'desc')
      .limit(limit)
      .get();

    const suggestions = suggestionsQuery.data.map(item => ({
      keyword: item.keyword,
      searchTime: item.searchTime
    }));

    // 去重
    const uniqueSuggestions = suggestions.filter((item, index, self) => 
      index === self.findIndex(t => t.keyword === item.keyword)
    );

    return success({
      list: uniqueSuggestions
    });

  } catch (err) {
    console.error('获取搜索建议失败：', err);
    return error('获取搜索建议失败');
  }
}

/**
 * 获取趋势搜索
 * @param {Object} db - 数据库实例
 * @param {Number} limit - 限制数量
 */
async function getTrendingSearches(db, limit) {
  try {
    // 获取最近7天的搜索趋势
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendingQuery = await db.collection('search_history')
      .aggregate()
      .match({
        searchTime: dbCmd.gte(sevenDaysAgo)
      })
      .group({
        _id: '$keyword',
        count: dbCmd.sum(1),
        recentSearches: dbCmd.push('$searchTime')
      })
      .sort({
        count: -1
      })
      .limit(limit)
      .end();

    const trendingSearches = trendingQuery.data.map(item => ({
      keyword: item._id,
      count: item.count,
      recentSearches: item.recentSearches
    }));

    return success({
      list: trendingSearches
    });

  } catch (err) {
    console.error('获取趋势搜索失败：', err);
    return error('获取趋势搜索失败');
  }
}
