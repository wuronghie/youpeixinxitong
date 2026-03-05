'use strict';

const { success, error, paramError, unauthorized, handlePagination, formatPageResult } = require('common');

/**
 * 获取评价列表
 * 功能：获取教师或订单的评价列表，支持分页和筛选
 */
exports.main = async (event, context) => {
  const { 
    teacherId, 
    orderId, 
    page = 1, 
    pageSize = 10,
    rating,
    hasReply,
    sortBy = 'createTime',
    sortOrder = 'desc'
  } = event;

  // 参数验证
  if (!teacherId && !orderId) {
    return paramError('必须指定教师ID或订单ID');
  }

  if (page < 1 || pageSize < 1 || pageSize > 100) {
    return paramError('分页参数错误');
  }

  const db = uniCloud.database();
  const dbCmd = db.command;

  try {
    // 1. 验证用户身份（可选，允许匿名查看）
    const { uid } = context;

    // 2. 构建查询条件
    const whereCondition = {};
    
    if (teacherId) {
      whereCondition.teacherId = teacherId;
    }
    
    if (orderId) {
      whereCondition.orderId = orderId;
    }
    
    if (rating) {
      whereCondition.rating = parseInt(rating);
    }
    
    if (hasReply !== undefined) {
      if (hasReply) {
        whereCondition.reply = dbCmd.neq(null).and(dbCmd.neq(''));
      } else {
        whereCondition.reply = dbCmd.eq(null).or(dbCmd.eq(''));
      }
    }

    // 只显示未隐藏的评价
    whereCondition.isHidden = false;

    // 3. 构建排序条件
    const sortCondition = {};
    if (sortBy === 'rating') {
      sortCondition.rating = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'createTime') {
      sortCondition.createTime = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortCondition.createTime = -1; // 默认按创建时间倒序
    }

    // 4. 处理分页
    const { page: currentPage, pageSize: currentPageSize, skip } = handlePagination(page, pageSize);

    // 5. 查询评价列表
    const reviewsQuery = await db.collection('reviews')
      .where(whereCondition)
      .orderBy(sortCondition)
      .skip(skip)
      .limit(currentPageSize)
      .get();

    // 6. 获取总数
    const countQuery = await db.collection('reviews')
      .where(whereCondition)
      .count();

    // 7. 获取关联的用户信息
    const reviews = reviewsQuery.data;
    const userIds = [...new Set(reviews.map(review => [review.parentId, review.teacherId]).flat())];
    
    let users = [];
    if (userIds.length > 0) {
      const usersQuery = await db.collection('users')
        .where({
          _id: dbCmd.in(userIds)
        })
        .field('_id, nickname, avatar, userType')
        .get();
      users = usersQuery.data;
    }

    // 8. 获取关联的订单信息
    const orderIds = [...new Set(reviews.map(review => review.orderId))];
    let orders = [];
    if (orderIds.length > 0) {
      const ordersQuery = await db.collection('orders')
        .where({
          _id: dbCmd.in(orderIds)
        })
        .field('_id, subject, grade, duration, totalAmount')
        .get();
      orders = ordersQuery.data;
    }

    // 9. 组装返回数据
    const reviewList = reviews.map(review => {
      const parentUser = users.find(user => user._id === review.parentId);
      const teacherUser = users.find(user => user._id === review.teacherId);
      const order = orders.find(order => order._id === review.orderId);

      return {
        _id: review._id,
        orderId: review.orderId,
        parentId: review.parentId,
        teacherId: review.teacherId,
        rating: review.rating,
        content: review.content,
        tags: review.tags || [],
        images: review.images || [],
        reply: review.reply || '',
        replyTime: review.replyTime || null,
        isAnonymous: review.isAnonymous,
        createTime: review.createTime,
        updateTime: review.updateTime,
        // 关联信息
        parentUser: review.isAnonymous ? {
          nickname: '匿名用户',
          avatar: '',
          userType: 'parent'
        } : {
          nickname: parentUser?.nickname || '未知用户',
          avatar: parentUser?.avatar || '',
          userType: parentUser?.userType || 'parent'
        },
        teacherUser: {
          nickname: teacherUser?.nickname || '未知教师',
          avatar: teacherUser?.avatar || '',
          userType: teacherUser?.userType || 'teacher'
        },
        order: order ? {
          subject: order.subject,
          grade: order.grade,
          duration: order.duration,
          totalAmount: order.totalAmount
        } : null
      };
    });

    // 10. 计算评分统计
    let ratingStats = null;
    if (teacherId) {
      ratingStats = await calculateRatingStats(db, teacherId);
    }

    return success({
      list: reviewList,
      total: countQuery.total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(countQuery.total / currentPageSize),
      ratingStats
    });

  } catch (err) {
    console.error('获取评价列表失败：', err);
    return error('获取评价列表失败，请稍后重试');
  }
};

/**
 * 计算评分统计
 * @param {Object} db - 数据库实例
 * @param {String} teacherId - 教师ID
 */
async function calculateRatingStats(db, teacherId) {
  try {
    const statsQuery = await db.collection('reviews')
      .where({
        teacherId: teacherId,
        isHidden: false
      })
      .field('rating')
      .get();

    const reviews = statsQuery.data;
    const total = reviews.length;

    if (total === 0) {
      return {
        total: 0,
        average: 0,
        distribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        }
      };
    }

    // 计算平均分
    const totalScore = reviews.reduce((sum, review) => sum + review.rating, 0);
    const average = Math.round((totalScore / total) * 10) / 10;

    // 计算评分分布
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    });

    return {
      total,
      average,
      distribution
    };

  } catch (err) {
    console.error('计算评分统计失败：', err);
    return null;
  }
}
