'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
	const { action, data } = event;
	
	try {
		switch (action) {
			case 'createAppointment':
				return await createAppointment(data);
			case 'getAppointmentList':
				return await getAppointmentList(data);
			case 'getAppointmentDetail':
				return await getAppointmentDetail(data);
			case 'updateAppointmentStatus':
				return await updateAppointmentStatus(data);
			case 'cancelAppointment':
				return await cancelAppointment(data);
			default:
				return {
					code: 400,
					message: '未知操作'
				};
		}
	} catch (error) {
		console.error('预约服务错误:', error);
		return {
			code: 500,
			message: '服务器内部错误',
			error: error.message
		};
	}
};

// 创建预约
async function createAppointment(data) {
	const { 
		teacherId, 
		parentId, 
		studentId, 
		subject, 
		appointmentTime, 
		duration = 120, 
		address, 
		price 
	} = data;
	
	// 验证必填字段
	if (!teacherId || !parentId || !subject || !appointmentTime || !price) {
		return {
			code: 400,
			message: '必填字段不能为空'
		};
	}
	
	// 检查教师是否存在
	const teacherResult = await db.collection('teacher').doc(teacherId).get();
	if (teacherResult.data.length === 0) {
		return {
			code: 404,
			message: '教师不存在'
		};
	}
	
	// 检查家长是否存在
	const parentResult = await db.collection('parent').doc(parentId).get();
	if (parentResult.data.length === 0) {
		return {
			code: 404,
			message: '家长不存在'
		};
	}
	
	const appointmentData = {
		teacher_id: teacherId,
		parent_id: parentId,
		student_id: studentId,
		subject: subject,
		appointment_time: new Date(appointmentTime),
		duration: duration,
		address: address || '',
		price: price,
		status: 0, // 待确认
		create_time: new Date(),
		update_time: new Date()
	};
	
	const result = await db.collection('appointment').add(appointmentData);
	
	// 发送通知消息给教师
	await db.collection('message').add({
		from_id: parentId,
		to_id: teacherId,
		content: `您有一个新的预约请求，科目：${subject}，时间：${appointmentTime}`,
		type: 2, // 系统通知
		read: false,
		create_time: new Date()
	});
	
	return {
		code: 200,
		message: '预约创建成功',
		data: {
			appointmentId: result.id
		}
	};
}

// 获取预约列表
async function getAppointmentList(data) {
	const { 
		userId, 
		role, 
		status, 
		page = 1, 
		pageSize = 10 
	} = data;
	
	if (!userId || !role) {
		return {
			code: 400,
			message: '用户ID和角色不能为空'
		};
	}
	
	let query = db.collection('appointment');
	
	// 根据角色构建查询条件
	if (role === 'teacher') {
		query = query.where({ teacher_id: userId });
	} else if (role === 'parent') {
		query = query.where({ parent_id: userId });
	} else {
		return {
			code: 400,
			message: '角色参数无效'
		};
	}
	
	// 状态筛选
	if (status !== undefined) {
		query = query.where({ status: status });
	}
	
	// 排序
	query = query.orderBy('create_time', 'desc');
	
	// 分页
	const skip = (page - 1) * pageSize;
	query = query.skip(skip).limit(pageSize);
	
	const result = await query.get();
	
	// 获取总数
	const countQuery = db.collection('appointment');
	if (role === 'teacher') {
		countQuery.where({ teacher_id: userId });
	} else if (role === 'parent') {
		countQuery.where({ parent_id: userId });
	}
	if (status !== undefined) {
		countQuery.where({ status: status });
	}
	const countResult = await countQuery.count();
	
	return {
		code: 200,
		message: '获取成功',
		data: {
			list: result.data,
			total: countResult.total,
			page: page,
			pageSize: pageSize
		}
	};
}

// 获取预约详情
async function getAppointmentDetail(data) {
	const { appointmentId } = data;
	
	if (!appointmentId) {
		return {
			code: 400,
			message: '预约ID不能为空'
		};
	}
	
	const result = await db.collection('appointment').doc(appointmentId).get();
	
	if (result.data.length === 0) {
		return {
			code: 404,
			message: '预约不存在'
		};
	}
	
	return {
		code: 200,
		message: '获取成功',
		data: result.data[0]
	};
}

// 更新预约状态
async function updateAppointmentStatus(data) {
	const { appointmentId, status, userId } = data;
	
	if (!appointmentId || status === undefined) {
		return {
			code: 400,
			message: '预约ID和状态不能为空'
		};
	}
	
	// 获取预约信息
	const appointmentResult = await db.collection('appointment').doc(appointmentId).get();
	if (appointmentResult.data.length === 0) {
		return {
			code: 404,
			message: '预约不存在'
		};
	}
	
	const appointment = appointmentResult.data[0];
	
	// 验证权限（只有教师可以确认预约）
	if (status === 1 && appointment.teacher_id !== userId) {
		return {
			code: 403,
			message: '无权限操作'
		};
	}
	
	const result = await db.collection('appointment').doc(appointmentId).update({
		status: status,
		update_time: new Date()
	});
	
	if (result.updated === 0) {
		return {
			code: 404,
			message: '预约不存在'
		};
	}
	
	// 发送状态变更通知
	const notificationContent = getStatusNotification(status);
	await db.collection('message').add({
		from_id: appointment.teacher_id,
		to_id: appointment.parent_id,
		content: notificationContent,
		type: 2, // 系统通知
		read: false,
		create_time: new Date()
	});
	
	return {
		code: 200,
		message: '状态更新成功'
	};
}

// 取消预约
async function cancelAppointment(data) {
	const { appointmentId, userId } = data;
	
	if (!appointmentId) {
		return {
			code: 400,
			message: '预约ID不能为空'
		};
	}
	
	// 获取预约信息
	const appointmentResult = await db.collection('appointment').doc(appointmentId).get();
	if (appointmentResult.data.length === 0) {
		return {
			code: 404,
			message: '预约不存在'
		};
	}
	
	const appointment = appointmentResult.data[0];
	
	// 验证权限（只有预约的教师或家长可以取消）
	if (appointment.teacher_id !== userId && appointment.parent_id !== userId) {
		return {
			code: 403,
			message: '无权限操作'
		};
	}
	
	// 检查预约状态
	if (appointment.status === 2) {
		return {
			code: 400,
			message: '已完成的预约不能取消'
		};
	}
	
	if (appointment.status === 3) {
		return {
			code: 400,
			message: '预约已取消'
		};
	}
	
	const result = await db.collection('appointment').doc(appointmentId).update({
		status: 3, // 已取消
		update_time: new Date()
	});
	
	// 发送取消通知
	await db.collection('message').add({
		from_id: userId,
		to_id: appointment.teacher_id === userId ? appointment.parent_id : appointment.teacher_id,
		content: '预约已取消',
		type: 2, // 系统通知
		read: false,
		create_time: new Date()
	});
	
	return {
		code: 200,
		message: '预约已取消'
	};
}

// 获取状态通知内容
function getStatusNotification(status) {
	switch (status) {
		case 0:
			return '预约请求已提交，等待教师确认';
		case 1:
			return '预约已确认，请按时上课';
		case 2:
			return '课程已完成';
		case 3:
			return '预约已取消';
		default:
			return '预约状态已更新';
	}
}
