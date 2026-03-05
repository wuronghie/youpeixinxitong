'use strict';

/**
 * 更新用户信息云函数
 * 功能：更新头像、昵称等基本信息、身份切换
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
    // 1. 获取用户ID（从token中获取）
    const uniIdCommon = require('uni-id-common');
    const uniIdInstance = uniIdCommon.createInstance({
      context
    });

    // 验证token并获取用户信息
    const payload = await uniIdInstance.checkToken(context.TOKEN);
    
    if (payload.errCode) {
      response.code = 401;
      response.message = '登录已过期，请重新登录';
      return response;
    }

    const userId = payload.uid;

    if (!userId) {
      response.code = 401;
      response.message = '未登录';
      return response;
    }

    // 2. 参数验证和处理
    const {
      nickname,
      avatar,
      gender,
      phone,
      realName,
      address,
      userType // 身份切换
    } = event;

    // 构建更新对象
    const updateData = {
      updateTime: Date.now()
    };

    // 验证昵称
    if (nickname !== undefined) {
      if (typeof nickname !== 'string' || nickname.trim().length === 0) {
        response.code = 400;
        response.message = '昵称不能为空';
        return response;
      }
      if (nickname.length > 50) {
        response.code = 400;
        response.message = '昵称长度不能超过50个字符';
        return response;
      }
      updateData.nickname = nickname.trim();
    }

    // 验证头像
    if (avatar !== undefined) {
      if (typeof avatar !== 'string') {
        response.code = 400;
        response.message = '头像格式错误';
        return response;
      }
      if (avatar.length > 500) {
        response.code = 400;
        response.message = '头像URL过长';
        return response;
      }
      updateData.avatar = avatar.trim();
    }

    // 验证性别
    if (gender !== undefined) {
      if (![0, 1, 2].includes(gender)) {
        response.code = 400;
        response.message = '性别参数错误';
        return response;
      }
      updateData.gender = gender;
    }

    // 验证手机号
    if (phone !== undefined) {
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        response.code = 400;
        response.message = '手机号格式错误';
        return response;
      }
      updateData.phone = phone;
    }

    // 验证真实姓名
    if (realName !== undefined) {
      if (typeof realName !== 'string') {
        response.code = 400;
        response.message = '真实姓名格式错误';
        return response;
      }
      if (realName.length > 50) {
        response.code = 400;
        response.message = '真实姓名长度不能超过50个字符';
        return response;
      }
      updateData.realName = realName.trim();
    }

    // 验证地址
    if (address !== undefined) {
      if (typeof address !== 'object') {
        response.code = 400;
        response.message = '地址格式错误';
        return response;
      }
      updateData.address = address;
    }

    // 3. 处理身份切换
    if (userType !== undefined) {
      if (!['parent', 'teacher'].includes(userType)) {
        response.code = 400;
        response.message = '用户类型错误';
        return response;
      }

      // 查询当前用户信息
      const userQuery = await db.collection('users').doc(userId).get();
      const currentUser = userQuery.data[0];

      if (!currentUser) {
        response.code = 404;
        response.message = '用户不存在';
        return response;
      }

      // 如果从家长切换到教师
      if (currentUser.userType === 'parent' && userType === 'teacher') {
        // 检查是否已有教师信息
        const teacherQuery = await db.collection('teachers').where({
          userId: userId
        }).get();

        if (teacherQuery.data.length === 0) {
          // 创建教师信息记录
          await db.collection('teachers').add({
            userId: userId,
            status: 'pending',
            rating: 5,
            reviewCount: 0,
            orderCount: 0,
            isRecommended: false,
            createTime: Date.now(),
            updateTime: Date.now()
          });
        }
      }

      updateData.userType = userType;
    }

    // 4. 更新用户信息
    if (Object.keys(updateData).length === 1) {
      // 只有updateTime，说明没有要更新的字段
      response.code = 400;
      response.message = '没有要更新的内容';
      return response;
    }

    await db.collection('users').doc(userId).update(updateData);

    // 5. 获取更新后的用户信息
    const updatedUserQuery = await db.collection('users').doc(userId).get();
    const updatedUser = updatedUserQuery.data[0];

    // 6. 如果是教师，获取教师信息
    let teacherInfo = null;
    if (updatedUser.userType === 'teacher') {
      const teacherQuery = await db.collection('teachers').where({
        userId: userId
      }).get();
      
      if (teacherQuery.data.length > 0) {
        teacherInfo = teacherQuery.data[0];
      }
    }

    // 7. 返回结果
    response.data = {
      userInfo: {
        _id: updatedUser._id,
        openid: updatedUser.openid,
        userType: updatedUser.userType,
        nickname: updatedUser.nickname,
        avatar: updatedUser.avatar,
        phone: updatedUser.phone || '',
        gender: updatedUser.gender || 0,
        realName: updatedUser.realName || '',
        address: updatedUser.address || null,
        isBlocked: updatedUser.isBlocked || false
      },
      teacherInfo: teacherInfo
    };

    response.message = '更新成功';
    
    return response;

  } catch (error) {
    console.error('user-update错误：', error);
    response.code = 500;
    response.message = '服务器错误：' + error.message;
    return response;
  }
};

