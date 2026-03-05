'use strict';

/**
 * 获取聊天记录云函数
 * 功能：获取指定会话的消息记录、标记消息已读
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
    const { 
      conversationId, 
      page = 1, 
      pageSize = 20,
      markRead = true  // 是否标记已读
    } = event;

    // 参数验证
    if (!conversationId) {
      response.code = 400;
      response.message = '请指定会话ID';
      return response;
    }

    // 验证会话权限
    const convRes = await db.collection('conversations').doc(conversationId).get();
    if (convRes.data.length === 0) {
      response.code = 404;
      response.message = '会话不存在';
      return response;
    }

    const conversation = convRes.data[0];
    if (!conversation.participants.includes(userId)) {
      response.code = 403;
      response.message = '无权访问此会话';
      return response;
    }

    // 计算分页
    const skip = (page - 1) * pageSize;

    // 查询消息列表（按时间倒序）
    const messagesRes = await db.collection('messages')
      .where({
        conversationId: conversationId
      })
      .skip(skip)
      .limit(pageSize)
      .orderBy('createTime', 'desc')
      .get();

    // 反转数组，使最新消息在最后
    const messages = messagesRes.data.reverse();

    // 获取消息总数
    const countRes = await db.collection('messages')
      .where({
        conversationId: conversationId
      })
      .count();

    // 标记消息已读
    if (markRead) {
      // 查找未读消息
      const unreadMessages = messages.filter(msg => 
        msg.receiverId === userId && 
        msg.status !== 'read'
      );

      if (unreadMessages.length > 0) {
        // 批量更新消息状态为已读
        const updatePromises = unreadMessages.map(msg => 
          db.collection('messages').doc(msg._id).update({
            status: 'read',
            readTime: Date.now(),
            updateTime: Date.now()
          })
        );

        await Promise.all(updatePromises);

        // 更新会话未读数
        await db.collection('conversations').doc(conversationId).update({
          [`unreadCount.${userId}`]: 0
        });
      }
    }

    response.data = {
      list: messages,
      total: countRes.total,
      page: page,
      pageSize: pageSize
    };

  } catch (error) {
    console.error('获取聊天记录失败：', error);
    response.code = 500;
    response.message = error.message || '获取聊天记录失败';
  }

  return response;
};

