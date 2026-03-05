'use strict';

/**
 * 教师注册云函数
 * 功能：验证用户身份、创建教师记录、更新用户类型
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

    // 2. 参数验证
    const {
      education,
      school,
      major,
      teachingAge,
      subjects,
      grades,
      introduction,
      hourlyRate
    } = event;

    // 验证必填字段
    if (!education) {
      response.code = 400;
      response.message = '请选择学历';
      return response;
    }

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      response.code = 400;
      response.message = '请至少选择一个教授科目';
      return response;
    }

    if (subjects.length > 10) {
      response.code = 400;
      response.message = '最多选择10个科目';
      return response;
    }

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      response.code = 400;
      response.message = '请至少选择一个教授年级';
      return response;
    }

    if (grades.length > 13) {
      response.code = 400;
      response.message = '最多选择13个年级';
      return response;
    }

    if (!introduction || introduction.trim().length < 10) {
      response.code = 400;
      response.message = '自我介绍至少10个字符';
      return response;
    }

    if (introduction.length > 1000) {
      response.code = 400;
      response.message = '自我介绍不能超过1000个字符';
      return response;
    }

    if (!hourlyRate || hourlyRate < 0 || hourlyRate > 10000) {
      response.code = 400;
      response.message = '请设置合理的课时费（0-10000元）';
      return response;
    }

    // 验证教龄
    if (teachingAge !== undefined && (teachingAge < 0 || teachingAge > 50)) {
      response.code = 400;
      response.message = '教龄范围错误（0-50年）';
      return response;
    }

    // 3. 查询用户信息
    const userQuery = await db.collection('users').doc(userId).get();
    
    if (userQuery.data.length === 0) {
      response.code = 404;
      response.message = '用户不存在';
      return response;
    }

    const userInfo = userQuery.data[0];

    // 检查是否被封禁
    if (userInfo.isBlocked) {
      response.code = 403;
      response.message = '账号已被封禁';
      return response;
    }

    // 4. 检查是否已有教师记录
    const teacherQuery = await db.collection('teachers').where({
      userId: userId
    }).get();

    let teacherId;
    let isUpdate = false;

    if (teacherQuery.data.length > 0) {
      // 已有教师记录，更新
      isUpdate = true;
      teacherId = teacherQuery.data[0]._id;
      
      const updateData = {
        education: education,
        school: school || '',
        major: major || '',
        teachingAge: teachingAge || 0,
        subjects: subjects,
        grades: grades,
        introduction: introduction.trim(),
        hourlyRate: hourlyRate,
        status: 'pending', // 重新提交审核
        updateTime: Date.now()
      };

      await db.collection('teachers').doc(teacherId).update(updateData);

    } else {
      // 创建新的教师记录
      const teacherData = {
        userId: userId,
        education: education,
        school: school || '',
        major: major || '',
        teachingAge: teachingAge || 0,
        subjects: subjects,
        grades: grades,
        introduction: introduction.trim(),
        hourlyRate: hourlyRate,
        rating: 5,
        reviewCount: 0,
        orderCount: 0,
        status: 'pending',
        isRecommended: false,
        createTime: Date.now(),
        updateTime: Date.now()
      };

      const addResult = await db.collection('teachers').add(teacherData);
      teacherId = addResult.id;
    }

    // 5. 更新用户类型为教师
    if (userInfo.userType !== 'teacher') {
      await db.collection('users').doc(userId).update({
        userType: 'teacher',
        updateTime: Date.now()
      });
    }

    // 6. 获取完整的教师信息
    const teacherInfoQuery = await db.collection('teachers').doc(teacherId).get();
    const teacherInfo = teacherInfoQuery.data[0];

    // 7. 返回结果
    response.data = {
      teacherInfo: teacherInfo,
      message: isUpdate ? '教师信息已更新，等待审核' : '教师注册成功，等待审核'
    };

    response.message = isUpdate ? '更新成功' : '注册成功';
    
    return response;

  } catch (error) {
    console.error('teacher-register错误：', error);
    response.code = 500;
    response.message = '服务器错误：' + error.message;
    return response;
  }
};

