'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
	const { action, data } = event;
	
	try {
		switch (action) {
			case 'getTeacherList':
				return await getTeacherList(data);
			case 'getTeacherDetail':
				return await getTeacherDetail(data);
			case 'createTeacherInfo':
				return await createTeacherInfo(data);
			case 'updateTeacherInfo':
				return await updateTeacherInfo(data);
			case 'getTeacherByUserId':
				return await getTeacherByUserId(data);
			default:
				return {
					code: 400,
					message: '未知操作'
				};
		}
	} catch (error) {
		console.error('教师服务错误:', error);
		return {
			code: 500,
			message: '服务器内部错误',
			error: error.message
		};
	}
};

// 获取教师列表
async function getTeacherList(data) {
	const { 
		page = 1, 
		pageSize = 10, 
		subject, 
		grade, 
		priceMin, 
		priceMax, 
		rating,
		sortBy = 'rating',
		sortOrder = 'desc'
	} = data;
	
	let query = db.collection('teacher');
	
	// 构建查询条件
	const where = {};
	
	// 科目筛选
	if (subject) {
		where['subjects.subject'] = subject;
	}
	
	// 年级筛选
	if (grade) {
		where['subjects.grades'] = dbCmd.in([grade]);
	}
	
	// 价格筛选
	if (priceMin || priceMax) {
		const priceCondition = {};
		if (priceMin) priceCondition['subjects.price'] = dbCmd.gte(priceMin);
		if (priceMax) priceCondition['subjects.price'] = dbCmd.lte(priceMax);
		where['subjects'] = dbCmd.elemMatch(priceCondition);
	}
	
	// 评分筛选
	if (rating) {
		where.rating = dbCmd.gte(rating);
	}
	
	// 只显示已认证的教师
	where.verification_status = 2;
	
	// 应用查询条件
	if (Object.keys(where).length > 0) {
		query = query.where(where);
	}
	
	// 排序
	const sortOptions = {};
	if (sortBy === 'rating') {
		sortOptions.rating = sortOrder === 'desc' ? -1 : 1;
	} else if (sortBy === 'price') {
		sortOptions['subjects.price'] = sortOrder === 'desc' ? -1 : 1;
	}
	query = query.orderBy(sortOptions);
	
	// 分页
	const skip = (page - 1) * pageSize;
	query = query.skip(skip).limit(pageSize);
	
	const result = await query.get();
	
	// 获取总数
	const countResult = await db.collection('teacher').where(where).count();
	
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

// 获取教师详情
async function getTeacherDetail(data) {
	const { teacherId } = data;
	
	if (!teacherId) {
		return {
			code: 400,
			message: '教师ID不能为空'
		};
	}
	
	const result = await db.collection('teacher').doc(teacherId).get();
	
	if (result.data.length === 0) {
		return {
			code: 404,
			message: '教师不存在'
		};
	}
	
	// 获取教师评价
	const reviewsResult = await db.collection('review')
		.where({
			to_id: teacherId
		})
		.orderBy('create_time', 'desc')
		.limit(10)
		.get();
	
	const teacherInfo = result.data[0];
	teacherInfo.reviews = reviewsResult.data;
	
	return {
		code: 200,
		message: '获取成功',
		data: teacherInfo
	};
}

// 创建教师信息
async function createTeacherInfo(data) {
	const { userId, teacherInfo } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	// 检查是否已存在教师信息
	const existingTeacher = await db.collection('teacher')
		.where({ user_id: userId })
		.get();
	
	if (existingTeacher.data.length > 0) {
		return {
			code: 400,
			message: '教师信息已存在'
		};
	}
	
	const teacherData = {
		user_id: userId,
		...teacherInfo,
		verification_status: 1, // 待审核
		rating: 0,
		create_time: new Date(),
		update_time: new Date()
	};
	
	const result = await db.collection('teacher').add(teacherData);
	
	return {
		code: 200,
		message: '创建成功',
		data: {
			teacherId: result.id
		}
	};
}

// 更新教师信息
async function updateTeacherInfo(data) {
	const { teacherId, teacherInfo } = data;
	
	if (!teacherId) {
		return {
			code: 400,
			message: '教师ID不能为空'
		};
	}
	
	teacherInfo.update_time = new Date();
	
	const result = await db.collection('teacher').doc(teacherId).update(teacherInfo);
	
	if (result.updated === 0) {
		return {
			code: 404,
			message: '教师信息不存在'
		};
	}
	
	return {
		code: 200,
		message: '更新成功'
	};
}

// 根据用户ID获取教师信息
async function getTeacherByUserId(data) {
	const { userId } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	const result = await db.collection('teacher')
		.where({ user_id: userId })
		.get();
	
	if (result.data.length === 0) {
		return {
			code: 404,
			message: '教师信息不存在'
		};
	}
	
	return {
		code: 200,
		message: '获取成功',
		data: result.data[0]
	};
}
