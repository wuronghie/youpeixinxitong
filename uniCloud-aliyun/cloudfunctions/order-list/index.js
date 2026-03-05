'use strict';

/**
 * 订单列表查询云函数
 * 功能：分页查询订单列表、支持状态筛选、支持角色过滤
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

    // 参数处理
    const {
      role = 'parent', // parent: 家长订单, teacher: 教师订单
      status, // 订单状态筛选
      page = 1,
      pageSize = 10
    } = event;

    // 构建查询条件
    const where = {};

    // 根据角色查询
    if (role === 'teacher') {
      where.teacherId = userId;
    } else {
      where.parentId = userId;
    }

    // 状态筛选
    if (status) {
      if (Array.isArray(status)) {
        where.status = dbCmd.in(status);
      } else {
        where.status = status;
      }
    }

    // 计算分页
    const skip = (page - 1) * pageSize;

    // 查询订单总数
    const countRes = await db.collection('orders')
      .where(where)
      .count();
    const total = countRes.total;

    // 查询订单列表
    const ordersRes = await db.collection('orders')
      .where(where)
      .skip(skip)
      .limit(pageSize)
      .orderBy('createTime', 'desc')
      .get();

    const orders = ordersRes.data;

    // 获取关联的用户和教师信息
    const parentIds = [...new Set(orders.map(o => o.parentId))];
    const teacherIds = [...new Set(orders.map(o => o.teacherId))];

    // 查询用户信息
    let usersMap = {};
    if (parentIds.length > 0) {
      const usersRes = await db.collection('users')
        .where({
          _id: dbCmd.in(parentIds)
        })
        .field({
          _id: true,
          nickname: true,
          avatar: true,
          phone: true
        })
        .get();
      
      usersRes.data.forEach(user => {
        usersMap[user._id] = user;
      });
    }

    // 查询教师信息
    let teachersMap = {};
    if (teacherIds.length > 0) {
      const teachersRes = await db.collection('teachers')
        .where({
          _id: dbCmd.in(teacherIds)
        })
        .get();
      
      teachersRes.data.forEach(teacher => {
        teachersMap[teacher._id] = teacher;
      });

      // 获取教师对应的用户信息
      const teacherUserIds = teachersRes.data.map(t => t.userId);
      const teacherUsersRes = await db.collection('users')
        .where({
          _id: dbCmd.in(teacherUserIds)
        })
        .field({
          _id: true,
          nickname: true,
          avatar: true
        })
        .get();
      
      const teacherUsersMap = {};
      teacherUsersRes.data.forEach(user => {
        teacherUsersMap[user._id] = user;
      });

      // 合并教师和用户信息
      Object.keys(teachersMap).forEach(teacherId => {
        const teacher = teachersMap[teacherId];
        teacher.userInfo = teacherUsersMap[teacher.userId] || {};
      });
    }

    // 组装订单数据
    const orderList = orders.map(order => {
      return {
        ...order,
        parentInfo: usersMap[order.parentId] || {},
        teacherInfo: teachersMap[order.teacherId] || {}
      };
    });

    response.data = {
      list: orderList,
      total: total,
      page: page,
      pageSize: pageSize,
      totalPages: Math.ceil(total / pageSize)
    };

  } catch (error) {
    console.error('查询订单列表失败：', error);
    response.code = 500;
    response.message = error.message || '查询订单列表失败';
  }

  return response;
};

