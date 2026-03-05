'use strict';

/**
 * 获取用户详情云函数
 * 功能：获取当前登录用户或指定用户的详细信息
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
    const { userId: targetUserId } = event;

    // 2. 获取当前登录用户ID
    const uniIdCommon = require('uni-id-common');
    const uniIdInstance = uniIdCommon.createInstance({
      context
    });

    let currentUserId = null;
    
    // 尝试验证token
    if (context.TOKEN) {
      const payload = await uniIdInstance.checkToken(context.TOKEN);
      if (!payload.errCode) {
        currentUserId = payload.uid;
      }
    }

    // 确定要查询的用户ID
    const queryUserId = targetUserId || currentUserId;

    if (!queryUserId) {
      response.code = 401;
      response.message = '请先登录';
      return response;
    }

    // 3. 查询用户信息
    const userQuery = await db.collection('users').doc(queryUserId).get();

    if (userQuery.data.length === 0) {
      response.code = 404;
      response.message = '用户不存在';
      return response;
    }

    const userInfo = userQuery.data[0];

    // 4. 判断返回哪些字段
    const isOwnProfile = currentUserId === queryUserId;

    // 基础信息（所有人可见）
    const profileData = {
      _id: userInfo._id,
      userType: userInfo.userType,
      nickname: userInfo.nickname,
      avatar: userInfo.avatar,
      gender: userInfo.gender || 0
    };

    // 敏感信息（仅本人可见）
    if (isOwnProfile) {
      profileData.openid = userInfo.openid;
      profileData.phone = userInfo.phone || '';
      profileData.realName = userInfo.realName || '';
      profileData.address = userInfo.address || null;
      profileData.isBlocked = userInfo.isBlocked || false;
      profileData.lastLoginTime = userInfo.lastLoginTime;
      profileData.createTime = userInfo.createTime;
    }

    // 5. 如果是教师，获取教师详细信息
    let teacherInfo = null;
    if (userInfo.userType === 'teacher') {
      const teacherQuery = await db.collection('teachers').where({
        userId: queryUserId
      }).get();
      
      if (teacherQuery.data.length > 0) {
        teacherInfo = teacherQuery.data[0];

        // 如果不是本人，隐藏部分敏感信息
        if (!isOwnProfile) {
          // 只返回公开信息
          teacherInfo = {
            _id: teacherInfo._id,
            userId: teacherInfo.userId,
            education: teacherInfo.education,
            school: teacherInfo.school,
            major: teacherInfo.major,
            teachingAge: teacherInfo.teachingAge,
            subjects: teacherInfo.subjects,
            grades: teacherInfo.grades,
            introduction: teacherInfo.introduction,
            certificates: teacherInfo.certificates,
            teachingPhotos: teacherInfo.teachingPhotos,
            hourlyRate: teacherInfo.hourlyRate,
            rating: teacherInfo.rating,
            reviewCount: teacherInfo.reviewCount,
            orderCount: teacherInfo.orderCount,
            status: teacherInfo.status,
            tags: teacherInfo.tags,
            workTime: teacherInfo.workTime,
            isRecommended: teacherInfo.isRecommended
          };
        }
      }
    }

    // 6. 如果是教师，获取最近评价（最多5条）
    let recentReviews = [];
    if (userInfo.userType === 'teacher' && teacherInfo && teacherInfo.status === 'approved') {
      const reviewQuery = await db.collection('reviews')
        .where({
          teacherId: queryUserId,
          isHidden: false
        })
        .orderBy('createTime', 'desc')
        .limit(5)
        .get();

      recentReviews = reviewQuery.data.map(review => {
        // 如果是匿名评价，隐藏家长信息
        if (review.isAnonymous) {
          return {
            _id: review._id,
            rating: review.rating,
            content: review.content,
            tags: review.tags,
            images: review.images,
            reply: review.reply,
            replyTime: review.replyTime,
            createTime: review.createTime,
            isAnonymous: true
          };
        } else {
          return {
            _id: review._id,
            parentId: review.parentId,
            rating: review.rating,
            content: review.content,
            tags: review.tags,
            images: review.images,
            reply: review.reply,
            replyTime: review.replyTime,
            createTime: review.createTime,
            isAnonymous: false
          };
        }
      });
    }

    // 7. 统计订单数据（仅本人可见）
    let orderStats = null;
    if (isOwnProfile) {
      if (userInfo.userType === 'parent') {
        // 家长的订单统计
        const orderCountQuery = await db.collection('orders')
          .where({
            parentId: queryUserId
          })
          .field('status')
          .get();

        const orders = orderCountQuery.data;
        orderStats = {
          total: orders.length,
          pending: orders.filter(o => o.status === 'pending').length,
          accepted: orders.filter(o => o.status === 'accepted').length,
          paid: orders.filter(o => o.status === 'paid').length,
          teaching: orders.filter(o => o.status === 'teaching').length,
          completed: orders.filter(o => o.status === 'completed').length,
          cancelled: orders.filter(o => o.status === 'cancelled').length
        };
      } else if (userInfo.userType === 'teacher') {
        // 教师的订单统计
        const orderCountQuery = await db.collection('orders')
          .where({
            teacherId: queryUserId
          })
          .field('status')
          .get();

        const orders = orderCountQuery.data;
        orderStats = {
          total: orders.length,
          pending: orders.filter(o => o.status === 'pending').length,
          accepted: orders.filter(o => o.status === 'accepted').length,
          paid: orders.filter(o => o.status === 'paid').length,
          teaching: orders.filter(o => o.status === 'teaching').length,
          completed: orders.filter(o => o.status === 'completed').length,
          cancelled: orders.filter(o => o.status === 'cancelled').length
        };
      }
    }

    // 8. 返回结果
    response.data = {
      userInfo: profileData,
      teacherInfo: teacherInfo,
      recentReviews: recentReviews,
      orderStats: orderStats,
      isOwnProfile: isOwnProfile
    };

    response.message = '获取成功';
    
    return response;

  } catch (error) {
    console.error('user-getProfile错误：', error);
    response.code = 500;
    response.message = '服务器错误：' + error.message;
    return response;
  }
};

