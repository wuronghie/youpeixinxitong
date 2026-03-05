'use strict';

/**
 * 获取会话列表云函数
 * 功能：获取用户的所有会话，按最后消息时间排序
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
    const { page = 1, pageSize = 20 } = event;

    // 计算分页
    const skip = (page - 1) * pageSize;

    // 查询用户参与的所有会话
    const conversationsRes = await db.collection('conversations')
      .where({
        participants: userId
      })
      .skip(skip)
      .limit(pageSize)
      .orderBy('updateTime', 'desc')
      .get();

    const conversations = conversationsRes.data;

    // 获取会话总数
    const countRes = await db.collection('conversations')
      .where({
        participants: userId
      })
      .count();

    // 处理会话数据，添加对方用户信息
    const conversationList = conversations.map(conv => {
      // 找出对方用户
      const otherUserId = conv.participants.find(id => id !== userId);
      const otherUserInfo = conv.participantsInfo?.find(info => info.userId === otherUserId) || {};

      return {
        ...conv,
        otherUser: {
          userId: otherUserId,
          nickname: otherUserInfo.nickname || '用户',
          avatar: otherUserInfo.avatar || ''
        },
        unreadCount: conv.unreadCount?.[userId] || 0
      };
    });

    response.data = {
      list: conversationList,
      total: countRes.total,
      page: page,
      pageSize: pageSize
    };

  } catch (error) {
    console.error('获取会话列表失败：', error);
    response.code = 500;
    response.message = error.message || '获取会话列表失败';
  }

  return response;
};

