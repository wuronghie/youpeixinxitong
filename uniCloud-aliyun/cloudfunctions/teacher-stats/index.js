'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
  const { action, teacherId, startDate, endDate, timeRange } = event;
  
  try {
    switch (action) {
      case 'getTeacherStats':
        return await getTeacherStats(teacherId, startDate, endDate, timeRange);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('统计接口错误:', error);
    return {
      code: 500,
      message: '服务器内部错误',
      error: error.message
    };
  }
};

// 获取教师统计数据
async function getTeacherStats(teacherId, startDate, endDate, timeRange) {
  if (!teacherId) {
    return {
      code: 400,
      message: '教师ID不能为空'
    };
  }

  // 构建时间查询条件
  let timeQuery = {};
  if (startDate && endDate) {
    timeQuery = {
      createTime: dbCmd.gte(new Date(startDate)).and(dbCmd.lte(new Date(endDate)))
    };
  } else if (timeRange) {
    const now = new Date();
    let startTime;
    switch (timeRange) {
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    timeQuery = {
      createTime: dbCmd.gte(startTime)
    };
  }

  try {
    // 1. 预约次数统计
    const orderStats = await db.collection('orders')
      .where({
        teacherId: teacherId,
        ...timeQuery
      })
      .aggregate()
      .group({
        _id: null,
        totalOrders: dbCmd.sum(1),
        completedOrders: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$status', 'completed'),
          1,
          0
        )),
        pendingOrders: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$status', 'pending'),
          1,
          0
        )),
        acceptedOrders: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$status', 'accepted'),
          1,
          0
        )),
        teachingOrders: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$status', 'teaching'),
          1,
          0
        )),
        totalAmount: dbCmd.sum(dbCmd.cond(
          dbCmd.in('$status', ['paid', 'teaching', 'completed']),
          '$totalAmount',
          0
        ))
      })
      .end();

    // 2. 收入统计
    const incomeStats = await db.collection('orders')
      .where({
        teacherId: teacherId,
        status: dbCmd.in(['paid', 'teaching', 'completed']),
        ...timeQuery
      })
      .aggregate()
      .group({
        _id: null,
        totalIncome: dbCmd.sum('$totalAmount'),
        avgOrderValue: dbCmd.avg('$totalAmount'),
        maxOrderValue: dbCmd.max('$totalAmount'),
        minOrderValue: dbCmd.min('$totalAmount')
      })
      .end();

    // 3. 评价统计
    const reviewStats = await db.collection('reviews')
      .where({
        teacherId: teacherId,
        ...timeQuery
      })
      .aggregate()
      .group({
        _id: null,
        totalReviews: dbCmd.sum(1),
        avgRating: dbCmd.avg('$rating'),
        maxRating: dbCmd.max('$rating'),
        minRating: dbCmd.min('$rating'),
        rating5: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 5), 1, 0)),
        rating4: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 4), 1, 0)),
        rating3: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 3), 1, 0)),
        rating2: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 2), 1, 0)),
        rating1: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 1), 1, 0))
      })
      .end();

    // 4. 学生数量统计
    const studentStats = await db.collection('orders')
      .where({
        teacherId: teacherId,
        ...timeQuery
      })
      .aggregate()
      .group({
        _id: '$parentId'
      })
      .group({
        _id: null,
        uniqueStudents: dbCmd.sum(1)
      })
      .end();

    // 5. 按科目统计
    const subjectStats = await db.collection('orders')
      .where({
        teacherId: teacherId,
        ...timeQuery
      })
      .aggregate()
      .group({
        _id: '$subject',
        count: dbCmd.sum(1),
        totalAmount: dbCmd.sum('$totalAmount')
      })
      .sort({
        count: -1
      })
      .end();

    // 6. 按时间统计（每日数据）
    const dailyStats = await db.collection('orders')
      .where({
        teacherId: teacherId,
        ...timeQuery
      })
      .aggregate()
      .addFields({
        dateStr: dbCmd.dateToString({
          date: '$createTime',
          format: '%Y-%m-%d'
        })
      })
      .group({
        _id: '$dateStr',
        orders: dbCmd.sum(1),
        income: dbCmd.sum('$totalAmount')
      })
      .sort({
        _id: 1
      })
      .end();

    return {
      code: 200,
      data: {
        orderStats: orderStats.data[0] || {
          totalOrders: 0,
          completedOrders: 0,
          pendingOrders: 0,
          acceptedOrders: 0,
          teachingOrders: 0,
          totalAmount: 0
        },
        incomeStats: incomeStats.data[0] || {
          totalIncome: 0,
          avgOrderValue: 0,
          maxOrderValue: 0,
          minOrderValue: 0
        },
        reviewStats: reviewStats.data[0] || {
          totalReviews: 0,
          avgRating: 0,
          maxRating: 0,
          minRating: 0,
          rating5: 0,
          rating4: 0,
          rating3: 0,
          rating2: 0,
          rating1: 0
        },
        studentStats: studentStats.data[0] || {
          uniqueStudents: 0
        },
        subjectStats: subjectStats.data || [],
        dailyStats: dailyStats.data || []
      }
    };
  } catch (error) {
    console.error('获取教师统计数据失败:', error);
    return {
      code: 500,
      message: '获取统计数据失败',
      error: error.message
    };
  }
}
