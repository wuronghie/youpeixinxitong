'use strict';

const { success, error, paramError, unauthorized, notFound } = require('common');

/**
 * 创建评价
 * 功能：家长对已完成的订单进行评价
 */
exports.main = async (event, context) => {
  const { 
    orderId, 
    rating, 
    content, 
    tags = [], 
    images = [], 
    isAnonymous = false 
  } = event;

  // 参数验证
  if (!orderId) {
    return paramError('订单ID不能为空');
  }
  
  if (!rating || rating < 1 || rating > 5) {
    return paramError('评分必须在1-5分之间');
  }
  
  if (!content || content.trim().length < 5) {
    return paramError('评价内容至少5个字符');
  }
  
  if (content.trim().length > 500) {
    return paramError('评价内容不能超过500个字符');
  }
  
  if (tags.length > 5) {
    return paramError('最多选择5个标签');
  }
  
  if (images.length > 9) {
    return paramError('最多上传9张图片');
  }

  const db = uniCloud.database();
  const dbCmd = db.command;

  try {
    // 1. 验证用户身份
    const { uid } = context;
    if (!uid) {
      return unauthorized('请先登录');
    }

    // 2. 验证订单是否存在且属于当前用户
    const orderQuery = await db.collection('orders')
      .doc(orderId)
      .field('_id, parentId, teacherId, status, createTime')
      .get();

    if (orderQuery.data.length === 0) {
      return notFound('订单不存在');
    }

    const order = orderQuery.data[0];
    
    // 验证订单是否属于当前用户
    if (order.parentId !== uid) {
      return unauthorized('无权限评价此订单');
    }

    // 验证订单状态（只有已完成的订单才能评价）
    if (order.status !== 'completed') {
      return paramError('只有已完成的订单才能评价');
    }

    // 3. 检查是否已经评价过
    const existingReview = await db.collection('reviews')
      .where({
        orderId: orderId,
        parentId: uid
      })
      .get();

    if (existingReview.data.length > 0) {
      return paramError('该订单已经评价过了');
    }

    // 4. 创建评价记录
    const reviewData = {
      orderId,
      parentId: uid,
      teacherId: order.teacherId,
      rating: parseInt(rating),
      content: content.trim(),
      tags: tags || [],
      images: images || [],
      isAnonymous: Boolean(isAnonymous),
      isHidden: false,
      createTime: new Date(),
      updateTime: new Date()
    };

    const reviewResult = await db.collection('reviews').add(reviewData);

    if (!reviewResult.id) {
      return error('评价创建失败');
    }

    // 5. 更新教师评分统计
    await updateTeacherRating(db, order.teacherId, rating);

    // 6. 更新订单状态为已评价
    await db.collection('orders').doc(orderId).update({
      status: 'reviewed',
      updateTime: new Date()
    });

    return success({
      reviewId: reviewResult.id,
      message: '评价提交成功'
    }, '评价创建成功');

  } catch (err) {
    console.error('创建评价失败：', err);
    return error('创建评价失败，请稍后重试');
  }
};

/**
 * 更新教师评分统计
 * @param {Object} db - 数据库实例
 * @param {String} teacherId - 教师ID
 * @param {Number} newRating - 新评分
 */
async function updateTeacherRating(db, teacherId, newRating) {
  try {
    // 获取教师当前评分信息
    const teacherQuery = await db.collection('teachers')
      .doc(teacherId)
      .field('rating, reviewCount')
      .get();

    if (teacherQuery.data.length === 0) {
      return;
    }

    const teacher = teacherQuery.data[0];
    const currentRating = teacher.rating || 0;
    const currentCount = teacher.reviewCount || 0;

    // 计算新的平均评分
    const newAverageRating = calculateNewRating(currentRating, currentCount, newRating);
    const newCount = currentCount + 1;

    // 更新教师评分
    await db.collection('teachers').doc(teacherId).update({
      rating: newAverageRating,
      reviewCount: newCount,
      updateTime: new Date()
    });

  } catch (err) {
    console.error('更新教师评分失败：', err);
    // 不抛出错误，避免影响评价创建
  }
}

/**
 * 计算新的平均评分
 * @param {Number} currentRating - 当前平均评分
 * @param {Number} currentCount - 当前评价数量
 * @param {Number} newRating - 新评分
 */
function calculateNewRating(currentRating, currentCount, newRating) {
  if (currentCount === 0) {
    return newRating;
  }
  
  const totalScore = currentRating * currentCount + newRating;
  const newCount = currentCount + 1;
  return Math.round((totalScore / newCount) * 10) / 10; // 保留一位小数
}
