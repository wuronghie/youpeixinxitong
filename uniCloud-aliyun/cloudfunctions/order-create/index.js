'use strict';

/**
 * 创建预约订单云函数
 * 功能：验证参数、检查教师可用性、创建订单、生成订单号
 */

const db = uniCloud.database();
const dbCmd = db.command;

// 生成订单号
function generateOrderNo() {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const second = now.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `ORD${year}${month}${day}${hour}${minute}${second}${random}`;
}

exports.main = async (event, context) => {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    // 1. 获取用户ID（从token中获取）
    const uniIdCommon = require('uni-id-common');
    const uniIdInstance = uniIdCommon.createInstance({ context });
    const payload = await uniIdInstance.checkToken(context.TOKEN);
    
    if (payload.errCode) {
      response.code = 401;
      response.message = '登录已过期，请重新登录';
      return response;
    }

    const userId = payload.uid;

    // 2. 参数验证
    const {
      teacherId,
      subject,
      grade,
      appointmentDate,
      startTime,
      endTime,
      duration,
      address,
      contactPhone,
      requirement
    } = event;

    // 验证必填字段
    if (!teacherId) {
      response.code = 400;
      response.message = '请选择教师';
      return response;
    }

    if (!subject) {
      response.code = 400;
      response.message = '请选择科目';
      return response;
    }

    if (!grade) {
      response.code = 400;
      response.message = '请选择年级';
      return response;
    }

    if (!appointmentDate) {
      response.code = 400;
      response.message = '请选择上课日期';
      return response;
    }

    if (!startTime || !endTime) {
      response.code = 400;
      response.message = '请选择上课时间';
      return response;
    }

    if (!duration || duration <= 0) {
      response.code = 400;
      response.message = '请设置上课时长';
      return response;
    }

    if (!address || address.trim().length < 5) {
      response.code = 400;
      response.message = '请填写详细的上课地址';
      return response;
    }

    if (!contactPhone) {
      response.code = 400;
      response.message = '请填写联系电话';
      return response;
    }

    // 验证电话号码格式
    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(contactPhone)) {
      response.code = 400;
      response.message = '请填写正确的手机号';
      return response;
    }

    // 3. 检查教师是否存在
    const teacherRes = await db.collection('teachers').doc(teacherId).get();
    
    if (teacherRes.data.length === 0) {
      response.code = 404;
      response.message = '教师不存在';
      return response;
    }

    const teacherInfo = teacherRes.data[0];

    // 检查教师状态
    if (teacherInfo.status !== 'approved') {
      response.code = 400;
      response.message = '该教师暂时无法接单';
      return response;
    }

    // 检查教师是否教授该科目
    if (!teacherInfo.subjects || !teacherInfo.subjects.includes(subject)) {
      response.code = 400;
      response.message = '该教师不教授此科目';
      return response;
    }

    // 检查教师是否教授该年级
    if (!teacherInfo.grades || !teacherInfo.grades.includes(grade)) {
      response.code = 400;
      response.message = '该教师不教授此年级';
      return response;
    }

    // 4. 检查时间冲突（查询教师在该时间段是否有其他订单）
    const appointmentStart = new Date(`${appointmentDate} ${startTime}`).getTime();
    const appointmentEnd = new Date(`${appointmentDate} ${endTime}`).getTime();

    const conflictOrders = await db.collection('orders')
      .where({
        teacherId: teacherId,
        status: dbCmd.in(['pending', 'accepted', 'paid', 'teaching']),
        appointmentDate: appointmentDate,
        _or: [
          {
            startTime: dbCmd.lte(startTime),
            endTime: dbCmd.gt(startTime)
          },
          {
            startTime: dbCmd.lt(endTime),
            endTime: dbCmd.gte(endTime)
          },
          {
            startTime: dbCmd.gte(startTime),
            endTime: dbCmd.lte(endTime)
          }
        ]
      })
      .get();

    if (conflictOrders.data.length > 0) {
      response.code = 400;
      response.message = '该时间段教师已被预约，请选择其他时间';
      return response;
    }

    // 5. 计算订单金额
    const hourlyRate = teacherInfo.hourlyRate || 0;
    const totalAmount = parseFloat((hourlyRate * duration).toFixed(2));

    // 6. 生成订单号
    const orderNo = generateOrderNo();

    // 7. 创建订单
    const orderData = {
      orderNo: orderNo,
      parentId: userId,
      teacherId: teacherId,
      subject: subject,
      grade: grade,
      appointmentDate: appointmentDate,
      startTime: startTime,
      endTime: endTime,
      duration: duration,
      hourlyRate: hourlyRate,
      totalAmount: totalAmount,
      address: address,
      contactPhone: contactPhone,
      contactName: event.contactName || '',
      requirement: requirement || '',
      status: 'pending',
      createTime: Date.now(),
      updateTime: Date.now()
    };

    const orderResult = await db.collection('orders').add(orderData);

    if (!orderResult.id) {
      response.code = 500;
      response.message = '创建订单失败';
      return response;
    }

    // 8. 返回订单信息
    response.data = {
      orderId: orderResult.id,
      orderNo: orderNo,
      totalAmount: totalAmount,
      ...orderData
    };
    response.message = '订单创建成功';

  } catch (error) {
    console.error('创建订单失败：', error);
    response.code = 500;
    response.message = error.message || '创建订单失败';
  }

  return response;
};

