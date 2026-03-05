'use strict';

/**
 * 订单支付云函数
 * 功能：微信支付预下单、支付回调处理、模拟支付
 */

const db = uniCloud.database();
const dbCmd = db.command;

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
    const { action, orderId, orderNo } = event;

    // 根据action执行不同操作
    if (action === 'prepay') {
      // 预支付
      return await handlePrepay(orderId, orderNo, userId);
    } else if (action === 'callback') {
      // 支付回调
      return await handleCallback(event);
    } else if (action === 'mock') {
      // 模拟支付（仅用于测试）
      return await handleMockPay(orderId, orderNo, userId);
    } else if (action === 'query') {
      // 查询支付状态
      return await handleQueryPayment(orderId, orderNo, userId);
    } else {
      response.code = 400;
      response.message = '无效的操作类型';
      return response;
    }

  } catch (error) {
    console.error('支付操作失败：', error);
    response.code = 500;
    response.message = error.message || '支付操作失败';
    return response;
  }
};

// 处理预支付
async function handlePrepay(orderId, orderNo, userId) {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
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
    } else if (orderNo) {
      const orderRes = await db.collection('orders').where({ orderNo }).get();
      if (orderRes.data.length === 0) {
        response.code = 404;
        response.message = '订单不存在';
        return response;
      }
      order = orderRes.data[0];
      orderId = order._id;
    } else {
      response.code = 400;
      response.message = '请提供订单ID或订单号';
      return response;
    }

    // 验证订单所有者
    if (order.parentId !== userId) {
      response.code = 403;
      response.message = '无权操作此订单';
      return response;
    }

    // 检查订单状态
    if (order.status !== 'pending' && order.status !== 'accepted') {
      response.code = 400;
      response.message = '订单状态不允许支付';
      return response;
    }

    // 检查订单是否已支付
    if (order.payStatus === 'paid') {
      response.code = 400;
      response.message = '订单已支付';
      return response;
    }

    // TODO: 调用微信支付API
    // 这里需要配置微信支付商户号、密钥等
    // 暂时返回模拟数据
    
    /**
     * 实际微信支付集成步骤：
     * 1. 配置微信支付商户号、API密钥
     * 2. 调用统一下单API
     * 3. 返回支付参数给前端
     * 
     * 示例代码：
     * const wxPay = require('wx-pay'); // 需要安装微信支付SDK
     * const payParams = await wxPay.unifiedOrder({
     *   body: '家教服务-' + order.subject,
     *   out_trade_no: order.orderNo,
     *   total_fee: Math.round(order.totalAmount * 100), // 单位：分
     *   spbill_create_ip: context.CLIENTIP,
     *   notify_url: 'https://your-domain.com/pay-callback',
     *   trade_type: 'JSAPI',
     *   openid: order.parentOpenid
     * });
     */

    // 模拟返回支付参数
    response.data = {
      orderId: orderId,
      orderNo: order.orderNo,
      totalAmount: order.totalAmount,
      // 实际应该返回微信支付参数
      payParams: {
        timeStamp: Date.now().toString(),
        nonceStr: Math.random().toString(36).substr(2, 15),
        package: 'prepay_id=wx_mock_prepay_id',
        signType: 'MD5',
        paySign: 'mock_sign'
      },
      // 提示信息
      _mock: true,
      _message: '当前为模拟支付数据，实际使用需要配置微信支付'
    };
    response.message = '预支付成功';

  } catch (error) {
    console.error('预支付失败：', error);
    response.code = 500;
    response.message = error.message || '预支付失败';
  }

  return response;
}

// 处理支付回调
async function handleCallback(event) {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    // TODO: 验证微信支付回调签名
    // 解析回调数据
    const { orderNo, transactionId, payTime } = event;

    if (!orderNo) {
      response.code = 400;
      response.message = '缺少订单号';
      return response;
    }

    // 查询订单
    const orderRes = await db.collection('orders').where({ orderNo }).get();
    if (orderRes.data.length === 0) {
      response.code = 404;
      response.message = '订单不存在';
      return response;
    }

    const order = orderRes.data[0];

    // 检查订单是否已支付
    if (order.payStatus === 'paid') {
      response.message = '订单已支付';
      return response;
    }

    // 更新订单状态
    await db.collection('orders').doc(order._id).update({
      payStatus: 'paid',
      status: 'paid',
      transactionId: transactionId || '',
      payTime: payTime || Date.now(),
      updateTime: Date.now()
    });

    response.message = '支付成功';

  } catch (error) {
    console.error('支付回调处理失败：', error);
    response.code = 500;
    response.message = error.message || '支付回调处理失败';
  }

  return response;
}

// 处理模拟支付（仅用于测试）
async function handleMockPay(orderId, orderNo, userId) {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
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
    } else if (orderNo) {
      const orderRes = await db.collection('orders').where({ orderNo }).get();
      if (orderRes.data.length === 0) {
        response.code = 404;
        response.message = '订单不存在';
        return response;
      }
      order = orderRes.data[0];
      orderId = order._id;
    } else {
      response.code = 400;
      response.message = '请提供订单ID或订单号';
      return response;
    }

    // 验证订单所有者
    if (order.parentId !== userId) {
      response.code = 403;
      response.message = '无权操作此订单';
      return response;
    }

    // 检查订单状态
    if (order.payStatus === 'paid') {
      response.code = 400;
      response.message = '订单已支付';
      return response;
    }

    // 模拟支付成功，更新订单状态
    await db.collection('orders').doc(orderId).update({
      payStatus: 'paid',
      status: 'paid',
      transactionId: 'MOCK_' + Date.now(),
      payTime: Date.now(),
      updateTime: Date.now()
    });

    response.data = {
      orderId: orderId,
      orderNo: order.orderNo,
      payStatus: 'paid'
    };
    response.message = '模拟支付成功';

  } catch (error) {
    console.error('模拟支付失败：', error);
    response.code = 500;
    response.message = error.message || '模拟支付失败';
  }

  return response;
}

// 查询支付状态
async function handleQueryPayment(orderId, orderNo, userId) {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
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
    } else if (orderNo) {
      const orderRes = await db.collection('orders').where({ orderNo }).get();
      if (orderRes.data.length === 0) {
        response.code = 404;
        response.message = '订单不存在';
        return response;
      }
      order = orderRes.data[0];
    } else {
      response.code = 400;
      response.message = '请提供订单ID或订单号';
      return response;
    }

    // 验证订单所有者
    if (order.parentId !== userId) {
      response.code = 403;
      response.message = '无权操作此订单';
      return response;
    }

    response.data = {
      orderId: order._id,
      orderNo: order.orderNo,
      payStatus: order.payStatus || 'unpaid',
      transactionId: order.transactionId || '',
      payTime: order.payTime || null
    };

  } catch (error) {
    console.error('查询支付状态失败：', error);
    response.code = 500;
    response.message = error.message || '查询支付状态失败';
  }

  return response;
}

