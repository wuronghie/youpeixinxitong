'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
  const { action, startDate, endDate, timeRange } = event;
  
  try {
    switch (action) {
      case 'getPlatformStats':
        return await getPlatformStats(startDate, endDate, timeRange);
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('平台统计接口错误:', error);
    return {
      code: 500,
      message: '服务器内部错误',
      error: error.message
    };
  }
};

// 获取平台统计数据
async function getPlatformStats(startDate, endDate, timeRange) {
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
    // 1. 用户增长统计
    const userGrowthStats = await db.collection('users')
      .where(timeQuery)
      .aggregate()
      .group({
        _id: null,
        totalUsers: dbCmd.sum(1),
        parentUsers: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$userType', 'parent'),
          1,
          0
        )),
        teacherUsers: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$userType', 'teacher'),
          1,
          0
        ))
      })
      .end();

    // 2. 订单统计
    const orderStats = await db.collection('orders')
      .where(timeQuery)
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
        paidOrders: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$status', 'paid'),
          1,
          0
        )),
        cancelledOrders: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$status', 'cancelled'),
          1,
          0
        )),
        totalAmount: dbCmd.sum(dbCmd.cond(
          dbCmd.in('$status', ['paid', 'teaching', 'completed']),
          '$totalAmount',
          0
        )),
        avgOrderValue: dbCmd.avg(dbCmd.cond(
          dbCmd.in('$status', ['paid', 'teaching', 'completed']),
          '$totalAmount',
          null
        ))
      })
      .end();

    // 3. 热门科目统计
    const subjectStats = await db.collection('orders')
      .where(timeQuery)
      .aggregate()
      .group({
        _id: '$subject',
        count: dbCmd.sum(1),
        totalAmount: dbCmd.sum('$totalAmount'),
        avgAmount: dbCmd.avg('$totalAmount')
      })
      .sort({
        count: -1
      })
      .limit(10)
      .end();

    // 4. 教师统计
    const teacherStats = await db.collection('teachers')
      .where({
        status: 'approved',
        ...timeQuery
      })
      .aggregate()
      .group({
        _id: null,
        totalTeachers: dbCmd.sum(1),
        avgRating: dbCmd.avg('$rating'),
        avgHourlyRate: dbCmd.avg('$hourlyRate'),
        totalReviews: dbCmd.sum('$reviewCount'),
        totalOrders: dbCmd.sum('$orderCount')
      })
      .end();

    // 5. 评价统计
    const reviewStats = await db.collection('reviews')
      .where(timeQuery)
      .aggregate()
      .group({
        _id: null,
        totalReviews: dbCmd.sum(1),
        avgRating: dbCmd.avg('$rating'),
        rating5: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 5), 1, 0)),
        rating4: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 4), 1, 0)),
        rating3: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 3), 1, 0)),
        rating2: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 2), 1, 0)),
        rating1: dbCmd.sum(dbCmd.cond(dbCmd.eq('$rating', 1), 1, 0))
      })
      .end();

    // 6. 按时间统计（每日数据）
    const dailyStats = await db.collection('orders')
      .where(timeQuery)
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

    // 7. 用户增长趋势（按日）
    const userGrowthTrend = await db.collection('users')
      .where(timeQuery)
      .aggregate()
      .addFields({
        dateStr: dbCmd.dateToString({
          date: '$createTime',
          format: '%Y-%m-%d'
        })
      })
      .group({
        _id: '$dateStr',
        users: dbCmd.sum(1),
        parents: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$userType', 'parent'),
          1,
          0
        )),
        teachers: dbCmd.sum(dbCmd.cond(
          dbCmd.eq('$userType', 'teacher'),
          1,
          0
        ))
      })
      .sort({
        _id: 1
      })
      .end();

    // 8. 年级分布统计
    const gradeStats = await db.collection('orders')
      .where(timeQuery)
      .aggregate()
      .group({
        _id: '$grade',
        count: dbCmd.sum(1),
        totalAmount: dbCmd.sum('$totalAmount')
      })
      .sort({
        count: -1
      })
      .end();

    return {
      code: 200,
      data: {
        userGrowthStats: userGrowthStats.data[0] || {
          totalUsers: 0,
          parentUsers: 0,
          teacherUsers: 0
        },
        orderStats: orderStats.data[0] || {
          totalOrders: 0,
          completedOrders: 0,
          pendingOrders: 0,
          acceptedOrders: 0,
          teachingOrders: 0,
          paidOrders: 0,
          cancelledOrders: 0,
          totalAmount: 0,
          avgOrderValue: 0
        },
        subjectStats: subjectStats.data || [],
        teacherStats: teacherStats.data[0] || {
          totalTeachers: 0,
          avgRating: 0,
          avgHourlyRate: 0,
          totalReviews: 0,
          totalOrders: 0
        },
        reviewStats: reviewStats.data[0] || {
          totalReviews: 0,
          avgRating: 0,
          rating5: 0,
          rating4: 0,
          rating3: 0,
          rating2: 0,
          rating1: 0
        },
        dailyStats: dailyStats.data || [],
        userGrowthTrend: userGrowthTrend.data || [],
        gradeStats: gradeStats.data || []
      }
    };
  } catch (error) {
    console.error('获取平台统计数据失败:', error);
    return {
      code: 500,
      message: '获取统计数据失败',
      error: error.message
    };
  }
}
