'use strict';

const { success, error, paramError, unauthorized, notFound } = require('common');

/**
 * 提交投诉
 * 功能：用户对教师或订单进行投诉
 */
exports.main = async (event, context) => {
  const { 
    type, // 投诉类型：teacher, order, service
    targetId, // 被投诉对象ID（教师ID或订单ID）
    category, // 投诉分类
    title, // 投诉标题
    content, // 投诉内容
    images = [], // 投诉图片
    contactPhone, // 联系电话
    isUrgent = false // 是否紧急
  } = event;

  // 参数验证
  if (!type || !['teacher', 'order', 'service'].includes(type)) {
    return paramError('投诉类型无效');
  }
  
  if (!targetId) {
    return paramError('被投诉对象ID不能为空');
  }
  
  if (!category) {
    return paramError('投诉分类不能为空');
  }
  
  if (!title || title.trim().length < 2) {
    return paramError('投诉标题至少2个字符');
  }
  
  if (!content || content.trim().length < 10) {
    return paramError('投诉内容至少10个字符');
  }
  
  if (title.trim().length > 50) {
    return paramError('投诉标题不能超过50个字符');
  }
  
  if (content.trim().length > 1000) {
    return paramError('投诉内容不能超过1000个字符');
  }
  
  if (images.length > 9) {
    return paramError('最多上传9张图片');
  }
  
  if (contactPhone && !/^1[3-9]\d{9}$/.test(contactPhone)) {
    return paramError('联系电话格式不正确');
  }

  const db = uniCloud.database();
  const dbCmd = db.command;

  try {
    // 1. 验证用户身份
    const { uid } = context;
    if (!uid) {
      return unauthorized('请先登录');
    }

    // 2. 验证被投诉对象是否存在
    let targetExists = false;
    let targetInfo = null;

    if (type === 'teacher') {
      const teacherQuery = await db.collection('teachers')
        .doc(targetId)
        .field('_id, userId, status')
        .get();
      
      if (teacherQuery.data.length > 0) {
        targetExists = true;
        targetInfo = {
          type: 'teacher',
          id: targetId,
          userId: teacherQuery.data[0].userId,
          status: teacherQuery.data[0].status
        };
      }
    } else if (type === 'order') {
      const orderQuery = await db.collection('orders')
        .doc(targetId)
        .field('_id, parentId, teacherId, status')
        .get();
      
      if (orderQuery.data.length > 0) {
        const order = orderQuery.data[0];
        // 验证订单是否属于当前用户
        if (order.parentId !== uid) {
          return unauthorized('无权限投诉此订单');
        }
        targetExists = true;
        targetInfo = {
          type: 'order',
          id: targetId,
          parentId: order.parentId,
          teacherId: order.teacherId,
          status: order.status
        };
      }
    }

    if (!targetExists) {
      return notFound('被投诉对象不存在');
    }

    // 3. 检查是否已经投诉过（同一用户对同一对象只能投诉一次）
    const existingComplaint = await db.collection('complaints')
      .where({
        complainantId: uid,
        type: type,
        targetId: targetId,
        status: dbCmd.in(['pending', 'processing'])
      })
      .get();

    if (existingComplaint.data.length > 0) {
      return paramError('您已经投诉过此对象，请等待处理结果');
    }

    // 4. 创建投诉记录
    const complaintData = {
      type,
      targetId,
      category,
      title: title.trim(),
      content: content.trim(),
      images: images || [],
      contactPhone: contactPhone || '',
      isUrgent: Boolean(isUrgent),
      complainantId: uid,
      status: 'pending', // pending, processing, resolved, rejected
      adminId: null,
      adminReply: '',
      replyTime: null,
      createTime: new Date(),
      updateTime: new Date()
    };

    const complaintResult = await db.collection('complaints').add(complaintData);

    if (!complaintResult.id) {
      return error('投诉提交失败');
    }

    // 5. 如果是教师投诉，更新教师投诉次数
    if (type === 'teacher' && targetInfo.userId) {
      await db.collection('teachers')
        .doc(targetId)
        .update({
          complaintCount: dbCmd.inc(1),
          updateTime: new Date()
        });
    }

    // 6. 发送通知给管理员（这里可以集成消息通知系统）
    // await sendNotificationToAdmin(complaintResult.id, title, isUrgent);

    return success({
      complaintId: complaintResult.id,
      message: '投诉提交成功，我们会尽快处理'
    }, '投诉提交成功');

  } catch (err) {
    console.error('提交投诉失败：', err);
    return error('投诉提交失败，请稍后重试');
  }
};

/**
 * 发送通知给管理员
 * @param {String} complaintId - 投诉ID
 * @param {String} title - 投诉标题
 * @param {Boolean} isUrgent - 是否紧急
 */
async function sendNotificationToAdmin(complaintId, title, isUrgent) {
  try {
    // 这里可以集成消息通知系统
    // 例如：发送邮件、短信、站内信等
    console.log(`新投诉通知：${complaintId} - ${title} ${isUrgent ? '(紧急)' : ''}`);
  } catch (err) {
    console.error('发送通知失败：', err);
    // 不抛出错误，避免影响投诉创建
  }
}
