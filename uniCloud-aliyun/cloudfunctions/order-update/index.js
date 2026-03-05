'use strict';

/**
 * 更新订单状态云函数
 * 功能：接单、拒单、取消订单、开始上课、完成订单
 */

const db = uniCloud.database();

exports.main = async (event, context) => {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    // 获取用户ID
    const uniIdCommon = require('uni-id-common');
    const uniIdInstance = uniIdCommon.createInstance({ context });
    const payload = await uniIdInstance.checkToken(context.TOKEN);
    
    if (payload.errCode) {
      response.code = 401;
      response.message = '登录已过期，请重新登录';
      return response;
    }

    const userId = payload.uid;
    const { action, orderId, orderNo, reason } = event;

    if (!action) {
      response.code = 400;
      response.message = '请指定操作类型';
      return response;
    }

    // 根据action执行不同操作
    switch (action) {
      case 'accept':
        return await handleAccept(orderId, orderNo, userId);
      case 'reject':
        return await handleReject(orderId, orderNo, userId, reason);
      case 'cancel':
        return await handleCancel(orderId, orderNo, userId, reason);
      case 'start':
        return await handleStart(orderId, orderNo, userId);
      case 'complete':
        return await handleComplete(orderId, orderNo, userId);
      default:
        response.code = 400;
        response.message = '无效的操作类型';
        return response;
    }

  } catch (error) {
    console.error('更新订单状态失败：', error);
    response.code = 500;
    response.message = error.message || '更新订单状态失败';
    return response;
  }
};

// 教师接单
async function handleAccept(orderId, orderNo, userId) {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    // 查询订单
    const order = await getOrder(orderId, orderNo);
    if (!order) {
      response.code = 404;
      response.message = '订单不存在';
      return response;
    }

    // 验证权限（必须是教师本人）
    if (order.teacherId !== userId) {
      response.code = 403;
      response.message = '无权操作此订单';
      return response;
    }

    // 检查订单状态
    if (order.status !== 'pending' && order.status !== 'paid') {
      response.code = 400;
      response.message = '订单状态不允许接单';
      return response;
    }

    // 更新订单状态
    await db.collection('orders').doc(order._id).update({
      status: 'accepted',
      acceptTime: Date.now(),
      updateTime: Date.now()
    });

    response.message = '接单成功';

  } catch (error) {
    console.error('接单失败：', error);
    response.code = 500;
    response.message = error.message || '接单失败';
  }

  return response;
}

// 教师拒单
async function handleReject(orderId, orderNo, userId, reason) {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    // 查询订单
    const order = await getOrder(orderId, orderNo);
    if (!order) {
      response.code = 404;
      response.message = '订单不存在';
      return response;
    }

    // 验证权限（必须是教师本人）
    if (order.teacherId !== userId) {
      response.code = 403;
      response.message = '无权操作此订单';
      return response;
    }

    // 检查订单状态
    if (order.status !== 'pending' && order.status !== 'paid') {
      response.code = 400;
      response.message = '订单状态不允许拒单';
      return response;
    }

    // 更新订单状态
    await db.collection('orders').doc(order._id).update({
      status: 'rejected',
      rejectReason: reason || '',
      rejectTime: Date.now(),
      updateTime: Date.now()
    });

    // TODO: 如果已支付，需要退款

    response.message = '拒单成功';

  } catch (error) {
    console.error('拒单失败：', error);
    response.code = 500;
    response.message = error.message || '拒单失败';
  }

  return response;
}

// 取消订单
async function handleCancel(orderId, orderNo, userId, reason) {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    // 查询订单
    const order = await getOrder(orderId, orderNo);
    if (!order) {
      response.code = 404;
      response.message = '订单不存在';
      return response;
    }

    // 验证权限（家长或教师都可以取消）
    if (order.parentId !== userId && order.teacherId !== userId) {
      response.code = 403;
      response.message = '无权操作此订单';
      return response;
    }

    // 检查订单状态
    if (order.status === 'completed' || order.status === 'cancelled') {
      response.code = 400;
      response.message = '订单状态不允许取消';
      return response;
    }

    // 正在上课不能取消
    if (order.status === 'teaching') {
      response.code = 400;
      response.message = '正在上课中，无法取消订单';
      return response;
    }

    // 更新订单状态
    await db.collection('orders').doc(order._id).update({
      status: 'cancelled',
      cancelReason: reason || '',
      cancelTime: Date.now(),
      cancelBy: userId,
      updateTime: Date.now()
    });

    // TODO: 如果已支付，需要退款

    response.message = '取消订单成功';

  } catch (error) {
    console.error('取消订单失败：', error);
    response.code = 500;
    response.message = error.message || '取消订单失败';
  }

  return response;
}

// 开始上课
async function handleStart(orderId, orderNo, userId) {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    // 查询订单
    const order = await getOrder(orderId, orderNo);
    if (!order) {
      response.code = 404;
      response.message = '订单不存在';
      return response;
    }

    // 验证权限（教师或家长都可以开始）
    if (order.teacherId !== userId && order.parentId !== userId) {
      response.code = 403;
      response.message = '无权操作此订单';
      return response;
    }

    // 检查订单状态
    if (order.status !== 'accepted' && order.status !== 'paid') {
      response.code = 400;
      response.message = '订单状态不允许开始上课';
      return response;
    }

    // 更新订单状态
    await db.collection('orders').doc(order._id).update({
      status: 'teaching',
      startTeachingTime: Date.now(),
      updateTime: Date.now()
    });

    response.message = '开始上课';

  } catch (error) {
    console.error('开始上课失败：', error);
    response.code = 500;
    response.message = error.message || '开始上课失败';
  }

  return response;
}

// 完成订单
async function handleComplete(orderId, orderNo, userId) {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    // 查询订单
    const order = await getOrder(orderId, orderNo);
    if (!order) {
      response.code = 404;
      response.message = '订单不存在';
      return response;
    }

    // 验证权限（教师或家长都可以完成）
    if (order.teacherId !== userId && order.parentId !== userId) {
      response.code = 403;
      response.message = '无权操作此订单';
      return response;
    }

    // 检查订单状态
    if (order.status !== 'teaching') {
      response.code = 400;
      response.message = '订单状态不允许完成';
      return response;
    }

    // 更新订单状态
    await db.collection('orders').doc(order._id).update({
      status: 'completed',
      completeTime: Date.now(),
      updateTime: Date.now()
    });

    response.message = '订单已完成';

  } catch (error) {
    console.error('完成订单失败：', error);
    response.code = 500;
    response.message = error.message || '完成订单失败';
  }

  return response;
}

// 获取订单
async function getOrder(orderId, orderNo) {
  if (orderId) {
    const orderRes = await db.collection('orders').doc(orderId).get();
    return orderRes.data.length > 0 ? orderRes.data[0] : null;
  } else if (orderNo) {
    const orderRes = await db.collection('orders').where({ orderNo }).get();
    return orderRes.data.length > 0 ? orderRes.data[0] : null;
  }
  return null;
}

