'use strict';

const db = uniCloud.database();
const usersCollection = db.collection('user');

exports.main = async (event, context) => {
  const { code, userInfo } = event;
  
  try {
    // 1. 通过code获取openid和session_key
    const loginResult = await uniCloud.getWeixinUserInfo({
      code: code
    });
    
    if (!loginResult.openid) {
      return {
        code: -1,
        message: '获取openid失败'
      };
    }
    
    const { openid, unionid } = loginResult;
    
    // 2. 查询用户是否已存在
    const userQuery = await usersCollection.where({
      openid: openid
    }).get();
    
    let userData = {
      openid: openid,
      unionid: unionid || '',
      nickName: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
      gender: userInfo.gender,
      city: userInfo.city,
      province: userInfo.province,
      country: userInfo.country,
      language: userInfo.language,
      last_login_time: new Date()
    };
    
    if (userQuery.data.length > 0) {
      // 用户已存在，更新信息
      const userId = userQuery.data[0]._id;
      await usersCollection.doc(userId).update({
        ...userData,
        update_time: new Date()
      });
      
      return {
        code: 0,
        message: '登录成功',
        data: {
          userId: userId,
          isNewUser: false,
          userInfo: userData
        }
      };
    } else {
      // 新用户，创建记录
      userData.create_time = new Date();
      userData.update_time = new Date();
      
      const createResult = await usersCollection.add(userData);
      
      return {
        code: 0,
        message: '注册并登录成功',
        data: {
          userId: createResult.id,
          isNewUser: true,
          userInfo: userData
        }
      };
    }
    
  } catch (error) {
    console.error('微信登录失败:', error);
    return {
      code: -1,
      message: '登录失败: ' + error.message
    };
  }
};