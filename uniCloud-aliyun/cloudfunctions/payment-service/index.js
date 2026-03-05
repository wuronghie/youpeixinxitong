'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
	const { action, data } = event;
	
	try {
		switch (action) {
			case 'createPayment':
				return await createPayment(data);
			case 'processPayment':
				return await processPayment(data);
			case 'getPaymentList':
				return await getPaymentList(data);
			case 'refundPayment':
				return await refundPayment(data);
			default:
				return {
					code: 400,
					message: '未知操作'
				};
		}
	} catch (error) {
		console.error('支付服务错误:', error);
		return {
			code: 500,
			message: '服务器内部错误',
			error: error.message
		};
	}
};

// 创建支付订单
async function createPayment(data) {
	const { appointmentId, parentId, teacherId, amount } = data;
	
	if (!appointmentId || !parentId || !teacherId || !amount) {
		return {
			code: 400,
			message: '必填字段不能为空'
		};
	}
	
	// 检查预约是否存在
	const appointmentResult = await db.collection('appointment').doc(appointmentId).get();
	if (appointmentResult.data.length === 0) {
		return {
			code: 404,
			message: '预约不存在'
		};
	}
	
	const appointment = appointmentResult.data[0];
	
	// 检查预约状态
	if (appointment.status !== 1) {
		return {
			code: 400,
			message: '只有已确认的预约才能支付'
		};
	}
	
	// 检查是否已存在支付记录
	const existingPayment = await db.collection('transaction')
		.where({ appointment_id: appointmentId })
		.get();
	
	if (existingPayment.data.length > 0) {
		return {
			code: 400,
			message: '该预约已存在支付记录'
		};
	}
	
	// 计算平台费用和教师收入
	const platformFee = Math.floor(amount * 0.2); // 平台收取20%费用
	const teacherIncome = amount - platformFee;
	
	const transactionData = {
		appointment_id: appointmentId,
		parent_id: parentId,
		teacher_id: teacherId,
		amount: amount,
		platform_fee: platformFee,
		teacher_income: teacherIncome,
		status: 0, // 待支付
		create_time: new Date()
	};
	
	const result = await db.collection('transaction').add(transactionData);
	
	// 这里应该调用微信支付API创建支付订单
	// 暂时返回模拟的支付信息
	const paymentInfo = {
		transactionId: result.id,
		amount: amount,
		// 实际项目中这里应该是微信支付的参数
		paymentParams: {
			timeStamp: Date.now().toString(),
			nonceStr: generateNonceStr(),
			package: `prepay_id=mock_prepay_id_${result.id}`,
			signType: 'MD5',
			paySign: 'mock_pay_sign'
		}
	};
	
	return {
		code: 200,
		message: '支付订单创建成功',
		data: paymentInfo
	};
}

// 处理支付结果
async function processPayment(data) {
	const { transactionId, paymentResult } = data;
	
	if (!transactionId) {
		return {
			code: 400,
			message: '交易ID不能为空'
		};
	}
	
	// 获取交易记录
	const transactionResult = await db.collection('transaction').doc(transactionId).get();
	if (transactionResult.data.length === 0) {
		return {
			code: 404,
			message: '交易记录不存在'
		};
	}
	
	const transaction = transactionResult.data[0];
	
	// 检查交易状态
	if (transaction.status !== 0) {
		return {
			code: 400,
			message: '交易状态异常'
		};
	}
	
	// 模拟支付成功处理
	// 实际项目中需要验证微信支付回调的真实性
	if (paymentResult === 'success') {
		// 更新交易状态
		await db.collection('transaction').doc(transactionId).update({
			status: 1, // 已支付
			pay_time: new Date()
		});
		
		// 更新预约状态为已完成
		await db.collection('appointment').doc(transaction.appointment_id).update({
			status: 2, // 已完成
			update_time: new Date()
		});
		
		// 发送支付成功通知
		await db.collection('message').add({
			from_id: transaction.teacher_id,
			to_id: transaction.parent_id,
			content: '支付成功，课程已完成',
			type: 2, // 系统通知
			read: false,
			create_time: new Date()
		});
		
		return {
			code: 200,
			message: '支付成功'
		};
	} else {
		return {
			code: 400,
			message: '支付失败'
		};
	}
}

// 获取支付记录列表
async function getPaymentList(data) {
	const { userId, role, page = 1, pageSize = 10 } = data;
	
	if (!userId || !role) {
		return {
			code: 400,
			message: '用户ID和角色不能为空'
		};
	}
	
	let query = db.collection('transaction');
	
	// 根据角色构建查询条件
	if (role === 'parent') {
		query = query.where({ parent_id: userId });
	} else if (role === 'teacher') {
		query = query.where({ teacher_id: userId });
	} else {
		return {
			code: 400,
			message: '角色参数无效'
		};
	}
	
	// 排序
	query = query.orderBy('create_time', 'desc');
	
	// 分页
	const skip = (page - 1) * pageSize;
	query = query.skip(skip).limit(pageSize);
	
	const result = await query.get();
	
	// 获取总数
	const countQuery = db.collection('transaction');
	if (role === 'parent') {
		countQuery.where({ parent_id: userId });
	} else if (role === 'teacher') {
		countQuery.where({ teacher_id: userId });
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

// 退款处理
async function refundPayment(data) {
	const { transactionId, reason } = data;
	
	if (!transactionId) {
		return {
			code: 400,
			message: '交易ID不能为空'
		};
	}
	
	// 获取交易记录
	const transactionResult = await db.collection('transaction').doc(transactionId).get();
	if (transactionResult.data.length === 0) {
		return {
			code: 404,
			message: '交易记录不存在'
		};
	}
	
	const transaction = transactionResult.data[0];
	
	// 检查交易状态
	if (transaction.status !== 1) {
		return {
			code: 400,
			message: '只有已支付的交易才能退款'
		};
	}
	
	// 计算退款金额（退还一半费用）
	const refundAmount = Math.floor(transaction.amount * 0.5);
	
	// 更新交易状态为已退款
	await db.collection('transaction').doc(transactionId).update({
		status: 2, // 已退款
		refund_amount: refundAmount,
		refund_reason: reason,
		refund_time: new Date()
	});
	
	// 发送退款通知
	await db.collection('message').add({
		from_id: transaction.teacher_id,
		to_id: transaction.parent_id,
		content: `退款申请已处理，退款金额：${refundAmount / 100}元`,
		type: 2, // 系统通知
		read: false,
		create_time: new Date()
	});
	
	return {
		code: 200,
		message: '退款处理成功',
		data: {
			refundAmount: refundAmount
		}
	};
}

// 生成随机字符串
function generateNonceStr() {
	return Math.random().toString(36).substr(2, 15);
}
