'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
	const { action, data } = event;
	
	try {
		switch (action) {
			case 'createReview':
				return await createReview(data);
			case 'getReviewList':
				return await getReviewList(data);
			case 'getReviewByAppointment':
				return await getReviewByAppointment(data);
			case 'updateReview':
				return await updateReview(data);
			case 'deleteReview':
				return await deleteReview(data);
			default:
				return {
					code: 400,
					message: '未知操作'
				};
		}
	} catch (error) {
		console.error('评价服务错误:', error);
		return {
			code: 500,
			message: '服务器内部错误',
			error: error.message
		};
	}
};

// 创建评价
async function createReview(data) {
	const { appointmentId, fromId, toId, rating, content } = data;
	
	if (!appointmentId || !fromId || !toId || !rating) {
		return {
			code: 400,
			message: '必填字段不能为空'
		};
	}
	
	// 验证评分范围
	if (rating < 1 || rating > 5) {
		return {
			code: 400,
			message: '评分必须在1-5之间'
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
	if (appointment.status !== 2) {
		return {
			code: 400,
			message: '只有已完成的预约才能评价'
		};
	}
	
	// 检查是否已评价
	const existingReview = await db.collection('review')
		.where({
			appointment_id: appointmentId,
			from_id: fromId
		})
		.get();
	
	if (existingReview.data.length > 0) {
		return {
			code: 400,
			message: '该预约已评价'
		};
	}
	
	const reviewData = {
		appointment_id: appointmentId,
		from_id: fromId,
		to_id: toId,
		rating: rating,
		content: content || '',
		create_time: new Date()
	};
	
	const result = await db.collection('review').add(reviewData);
	
	// 更新教师评分
	await updateTeacherRating(toId);
	
	return {
		code: 200,
		message: '评价成功',
		data: {
			reviewId: result.id
		}
	};
}

// 获取评价列表
async function getReviewList(data) {
	const { teacherId, page = 1, pageSize = 10 } = data;
	
	if (!teacherId) {
		return {
			code: 400,
			message: '教师ID不能为空'
		};
	}
	
	const result = await db.collection('review')
		.where({ to_id: teacherId })
		.orderBy('create_time', 'desc')
		.skip((page - 1) * pageSize)
		.limit(pageSize)
		.get();
	
	// 获取评价者信息
	const fromIds = result.data.map(item => item.from_id);
	const usersResult = await db.collection('user')
		.where({
			_id: dbCmd.in(fromIds)
		})
		.get();
	
	// 合并数据
	const reviewList = result.data.map(review => {
		const user = usersResult.data.find(u => u._id === review.from_id);
		return {
			...review,
			from_user: user
		};
	});
	
	// 获取总数
	const countResult = await db.collection('review')
		.where({ to_id: teacherId })
		.count();
	
	return {
		code: 200,
		message: '获取成功',
		data: {
			list: reviewList,
			total: countResult.total,
			page: page,
			pageSize: pageSize
		}
	};
}

// 根据预约获取评价
async function getReviewByAppointment(data) {
	const { appointmentId } = data;
	
	if (!appointmentId) {
		return {
			code: 400,
			message: '预约ID不能为空'
		};
	}
	
	const result = await db.collection('review')
		.where({ appointment_id: appointmentId })
		.get();
	
	return {
		code: 200,
		message: '获取成功',
		data: result.data
	};
}

// 更新评价
async function updateReview(data) {
	const { reviewId, rating, content } = data;
	
	if (!reviewId) {
		return {
			code: 400,
			message: '评价ID不能为空'
		};
	}
	
	// 验证评分范围
	if (rating && (rating < 1 || rating > 5)) {
		return {
			code: 400,
			message: '评分必须在1-5之间'
		};
	}
	
	const updateData = {};
	if (rating !== undefined) updateData.rating = rating;
	if (content !== undefined) updateData.content = content;
	
	const result = await db.collection('review').doc(reviewId).update(updateData);
	
	if (result.updated === 0) {
		return {
			code: 404,
			message: '评价不存在'
		};
	}
	
	// 如果更新了评分，重新计算教师评分
	if (rating !== undefined) {
		const reviewResult = await db.collection('review').doc(reviewId).get();
		if (reviewResult.data.length > 0) {
			await updateTeacherRating(reviewResult.data[0].to_id);
		}
	}
	
	return {
		code: 200,
		message: '更新成功'
	};
}

// 删除评价
async function deleteReview(data) {
	const { reviewId } = data;
	
	if (!reviewId) {
		return {
			code: 400,
			message: '评价ID不能为空'
		};
	}
	
	// 获取评价信息
	const reviewResult = await db.collection('review').doc(reviewId).get();
	if (reviewResult.data.length === 0) {
		return {
			code: 404,
			message: '评价不存在'
		};
	}
	
	const review = reviewResult.data[0];
	
	// 删除评价
	const result = await db.collection('review').doc(reviewId).remove();
	
	if (result.deleted === 0) {
		return {
			code: 404,
			message: '评价不存在'
		};
	}
	
	// 重新计算教师评分
	await updateTeacherRating(review.to_id);
	
	return {
		code: 200,
		message: '删除成功'
	};
}

// 更新教师评分
async function updateTeacherRating(teacherId) {
	// 获取该教师的所有评价
	const reviewsResult = await db.collection('review')
		.where({ to_id: teacherId })
		.get();
	
	if (reviewsResult.data.length === 0) {
		// 如果没有评价，设置评分为0
		await db.collection('teacher').doc(teacherId).update({
			rating: 0
		});
		return;
	}
	
	// 计算平均评分
	const totalRating = reviewsResult.data.reduce((sum, review) => sum + review.rating, 0);
	const averageRating = totalRating / reviewsResult.data.length;
	
	// 更新教师评分
	await db.collection('teacher').doc(teacherId).update({
		rating: Math.round(averageRating * 10) / 10 // 保留一位小数
	});
}
