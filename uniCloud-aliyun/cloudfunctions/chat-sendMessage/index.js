'use strict';

/**
 * 发送消息云函数
 * 功能：发送消息、创建/更新会话、更新未读数
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

    const senderId = payload.uid;
    const { receiverId, content, type = 'text', mediaUrl, conversationId } = event;

    // 参数验证
    if (!receiverId) {
      response.code = 400;
      response.message = '请指定接收者';
      return response;
    }

    if (!content && !mediaUrl) {
      response.code = 400;
      response.message = '消息内容不能为空';
      return response;
    }

    // 不能给自己发消息
    if (senderId === receiverId) {
      response.code = 400;
      response.message = '不能给自己发消息';
      return response;
    }

    // 1. 查找或创建会话
    let conversation;
    if (conversationId) {
      // 使用提供的会话ID
      const convRes = await db.collection('conversations').doc(conversationId).get();
      if (convRes.data.length > 0) {
        conversation = convRes.data[0];
      }
    }

    if (!conversation) {
      // 查找现有会话
      const existConvRes = await db.collection('conversations')
        .where({
          participants: dbCmd.all([senderId, receiverId])
        })
        .get();

      if (existConvRes.data.length > 0) {
        conversation = existConvRes.data[0];
      } else {
        // 创建新会话
        // 获取参与者信息
        const usersRes = await db.collection('users')
          .where({
            _id: dbCmd.in([senderId, receiverId])
          })
          .field({
            _id: true,
            nickname: true,
            avatar: true
          })
          .get();

        const participantsInfo = usersRes.data.map(user => ({
          userId: user._id,
          nickname: user.nickname || '用户',
          avatar: user.avatar || ''
        }));

        const newConv = {
          participants: [senderId, receiverId],
          type: 'private',
          participantsInfo: participantsInfo,
          unreadCount: {
            [senderId]: 0,
            [receiverId]: 0
          },
          createTime: Date.now(),
          updateTime: Date.now()
        };

        const convResult = await db.collection('conversations').add(newConv);
        conversation = {
          _id: convResult.id,
          ...newConv
        };
      }
    }

    // 2. 创建消息
    const messageData = {
      conversationId: conversation._id,
      senderId: senderId,
      receiverId: receiverId,
      content: content || '',
      type: type,
      mediaUrl: mediaUrl || '',
      status: 'sent',
      isRecalled: false,
      createTime: Date.now(),
      updateTime: Date.now()
    };

    const messageResult = await db.collection('messages').add(messageData);

    // 3. 更新会话信息
    const updateData = {
      lastMessage: {
        content: content || '[图片]',
        senderId: senderId,
        type: type,
        time: Date.now()
      },
      updateTime: Date.now()
    };

    // 更新接收者的未读数
    const currentUnreadCount = conversation.unreadCount || {};
    updateData[`unreadCount.${receiverId}`] = (currentUnreadCount[receiverId] || 0) + 1;

    await db.collection('conversations').doc(conversation._id).update(updateData);

    // 4. 返回消息信息
    response.data = {
      messageId: messageResult.id,
      conversationId: conversation._id,
      ...messageData
    };
    response.message = '发送成功';

  } catch (error) {
    console.error('发送消息失败：', error);
    response.code = 500;
    response.message = error.message || '发送消息失败';
  }

  return response;
};

