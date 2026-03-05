'use strict';

/**
 * 教师详情云函数
 * 功能：获取教师完整信息、用户信息、评价列表
 */

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
  // 响应体
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    // 1. 参数验证
    const { teacherId, userId } = event;

    if (!teacherId && !userId) {
      response.code = 400;
      response.message = '缺少必要参数：teacherId或userId';
      return response;
    }

    // 2. 查询教师信息
    let teacherQuery;
    
    if (teacherId) {
      // 通过teacherId查询
      teacherQuery = await db.collection('teachers').doc(teacherId).get();
    } else {
      // 通过userId查询
      teacherQuery = await db.collection('teachers').where({
        userId: userId
      }).get();
    }

    if (teacherQuery.data.length === 0) {
      response.code = 404;
      response.message = '教师信息不存在';
      return response;
    }

    const teacherInfo = teacherQuery.data[0];

    // 3. 获取当前登录用户ID（如果有）
    let currentUserId = null;
    let isOwn = false;

    if (context.TOKEN) {
      try {
        const uniIdCommon = require('uni-id-common');
        const uniIdInstance = uniIdCommon.createInstance({
          context
        });

        const payload = await uniIdInstance.checkToken(context.TOKEN);
        if (!payload.errCode) {
          currentUserId = payload.uid;
          isOwn = currentUserId === teacherInfo.userId;
        }
      } catch (error) {
        // token验证失败，继续作为游客访问
        console.log('token验证失败，作为游客访问');
      }
    }

    // 4. 查询用户基本信息
    const userQuery = await db.collection('users')
      .doc(teacherInfo.userId)
      .field({
        _id: true,
        nickname: true,
        avatar: true,
        gender: true,
        realName: isOwn // 只有本人能看到真实姓名
      })
      .get();

    if (userQuery.data.length === 0) {
      response.code = 404;
      response.message = '用户不存在';
      return response;
    }

    const userInfo = userQuery.data[0];

    // 5. 查询评价列表（最新10条）
    const reviewQuery = await db.collection('reviews')
      .where({
        teacherId: teacherInfo.userId,
        isHidden: false
      })
      .orderBy('createTime', 'desc')
      .limit(10)
      .get();

    const reviews = reviewQuery.data;

    // 6. 如果有评价，获取家长信息
    if (reviews.length > 0) {
      const parentIds = reviews
        .filter(r => !r.isAnonymous)
        .map(r => r.parentId);

      if (parentIds.length > 0) {
        const parentsQuery = await db.collection('users')
          .where({
            _id: dbCmd.in(parentIds)
          })
          .field({
            _id: true,
            nickname: true,
            avatar: true
          })
          .get();

        const parentsMap = {};
        parentsQuery.data.forEach(parent => {
          parentsMap[parent._id] = parent;
        });

        // 合并家长信息到评价列表
        reviews.forEach(review => {
          if (!review.isAnonymous) {
            const parent = parentsMap[review.parentId];
            if (parent) {
              review.parentNickname = parent.nickname;
              review.parentAvatar = parent.avatar;
            }
          } else {
            // 匿名评价
            review.parentNickname = '匿名用户';
            review.parentAvatar = '';
          }
          
          // 删除敏感字段
          delete review.parentId;
          delete review.teacherId;
        });
      }
    }

    // 7. 计算评分分布
    const ratingDistribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0
    };

    if (teacherInfo.reviewCount > 0) {
      const allReviewsQuery = await db.collection('reviews')
        .where({
          teacherId: teacherInfo.userId,
          isHidden: false
        })
        .field('rating')
        .get();

      allReviewsQuery.data.forEach(review => {
        ratingDistribution[review.rating]++;
      });
    }

    // 8. 获取标签统计（从评价中提取）
    const tagStats = {};
    reviews.forEach(review => {
      if (review.tags && Array.isArray(review.tags)) {
        review.tags.forEach(tag => {
          tagStats[tag] = (tagStats[tag] || 0) + 1;
        });
      }
    });

    // 转换为数组并排序
    const popularTags = Object.keys(tagStats)
      .map(tag => ({
        tag: tag,
        count: tagStats[tag]
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // 取前5个热门标签

    // 9. 构建返回数据
    const detailData = {
      // 教师信息
      teacherInfo: {
        _id: teacherInfo._id,
        userId: teacherInfo.userId,
        education: teacherInfo.education,
        school: teacherInfo.school,
        major: teacherInfo.major,
        teachingAge: teacherInfo.teachingAge,
        subjects: teacherInfo.subjects,
        grades: teacherInfo.grades,
        introduction: teacherInfo.introduction,
        certificates: teacherInfo.certificates || [],
        teachingPhotos: teacherInfo.teachingPhotos || [],
        hourlyRate: teacherInfo.hourlyRate,
        rating: teacherInfo.rating,
        reviewCount: teacherInfo.reviewCount,
        orderCount: teacherInfo.orderCount,
        tags: teacherInfo.tags || [],
        workTime: teacherInfo.workTime || null,
        isRecommended: teacherInfo.isRecommended,
        status: isOwn ? teacherInfo.status : undefined, // 只有本人能看到状态
        auditRemark: isOwn ? teacherInfo.auditRemark : undefined // 只有本人能看到审核备注
      },
      
      // 用户信息
      userInfo: {
        _id: userInfo._id,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        gender: userInfo.gender,
        realName: userInfo.realName || undefined
      },
      
      // 评价列表
      reviews: reviews,
      
      // 评分分布
      ratingDistribution: ratingDistribution,
      
      // 热门标签
      popularTags: popularTags,
      
      // 是否为本人
      isOwn: isOwn
    };

    response.data = detailData;
    response.message = '获取成功';
    
    return response;

  } catch (error) {
    console.error('teacher-detail错误：', error);
    response.code = 500;
    response.message = '服务器错误：' + error.message;
    return response;
  }
};

