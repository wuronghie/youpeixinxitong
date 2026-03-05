'use strict';

/**
 * 订单详情查询云函数
 * 功能：获取订单完整信息，包括家长、教师、评价等关联数据
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
    const { orderId, orderNo } = event;

    // 参数验证
    if (!orderId && !orderNo) {
      response.code = 400;
      response.message = '请提供订单ID或订单号';
      return response;
    }

    // 查询订单
    let order;
    if (orderId) {
      const orderRes = await db.collection('orders').doc(orderId).get();
      if (orderRes.data.length === 0) {
        response.code = 404;
        response.message = '订单不存在';
        return response;
      }
      order = orderRes.data[0];
    } else {
      const orderRes = await db.collection('orders').where({ orderNo }).get();
      if (orderRes.data.length === 0) {
        response.code = 404;
        response.message = '订单不存在';
        return response;
      }
      order = orderRes.data[0];
    }

    // 验证权限（家长或教师）
    if (order.parentId !== userId && order.teacherId !== userId) {
      response.code = 403;
      response.message = '无权查看此订单';
      return response;
    }

    // 获取家长信息
    const parentRes = await db.collection('users')
      .doc(order.parentId)
      .field({
        _id: true,
        nickname: true,
        avatar: true,
        phone: true,
        realName: true
      })
      .get();
    
    const parentInfo = parentRes.data.length > 0 ? parentRes.data[0] : {};

    // 获取教师信息
    const teacherRes = await db.collection('teachers')
      .doc(order.teacherId)
      .get();
    
    let teacherInfo = {};
    if (teacherRes.data.length > 0) {
      teacherInfo = teacherRes.data[0];
      
      // 获取教师对应的用户信息
      const teacherUserRes = await db.collection('users')
        .doc(teacherInfo.userId)
        .field({
          _id: true,
          nickname: true,
          avatar: true
        })
        .get();
      
      if (teacherUserRes.data.length > 0) {
        teacherInfo.userInfo = teacherUserRes.data[0];
      }
    }

    // 获取评价信息（如果有）
    let reviewInfo = null;
    if (order.status === 'completed') {
      const reviewRes = await db.collection('reviews')
        .where({
          orderId: order._id
        })
        .get();
      
      if (reviewRes.data.length > 0) {
        reviewInfo = reviewRes.data[0];
      }
    }

    // 组装返回数据
    response.data = {
      ...order,
      parentInfo,
      teacherInfo,
      reviewInfo
    };

  } catch (error) {
    console.error('查询订单详情失败：', error);
    response.code = 500;
    response.message = error.message || '查询订单详情失败';
  }

  return response;
};

