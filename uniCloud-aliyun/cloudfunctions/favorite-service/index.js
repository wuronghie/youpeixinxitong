'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
	const { action, data } = event;
	
	try {
		switch (action) {
			case 'addFavorite':
				return await addFavorite(data);
			case 'removeFavorite':
				return await removeFavorite(data);
			case 'getFavoriteList':
				return await getFavoriteList(data);
			case 'checkFavorite':
				return await checkFavorite(data);
			default:
				return {
					code: 400,
					message: '未知操作'
				};
		}
	} catch (error) {
		console.error('收藏服务错误:', error);
		return {
			code: 500,
			message: '服务器内部错误',
			error: error.message
		};
	}
};

// 添加收藏
async function addFavorite(data) {
	const { userId, teacherId } = data;
	
	if (!userId || !teacherId) {
		return {
			code: 400,
			message: '用户ID和教师ID不能为空'
		};
	}
	
	// 检查是否已收藏
	const existingFavorite = await db.collection('favorite')
		.where({
			user_id: userId,
			teacher_id: teacherId
		})
		.get();
	
	if (existingFavorite.data.length > 0) {
		return {
			code: 400,
			message: '已收藏该教师'
		};
	}
	
	const favoriteData = {
		user_id: userId,
		teacher_id: teacherId,
		create_time: new Date()
	};
	
	const result = await db.collection('favorite').add(favoriteData);
	
	return {
		code: 200,
		message: '收藏成功',
		data: {
			favoriteId: result.id
		}
	};
}

// 取消收藏
async function removeFavorite(data) {
	const { userId, teacherId } = data;
	
	if (!userId || !teacherId) {
		return {
			code: 400,
			message: '用户ID和教师ID不能为空'
		};
	}
	
	const result = await db.collection('favorite')
		.where({
			user_id: userId,
			teacher_id: teacherId
		})
		.remove();
	
	if (result.deleted === 0) {
		return {
			code: 404,
			message: '收藏记录不存在'
		};
	}
	
	return {
		code: 200,
		message: '取消收藏成功'
	};
}

// 获取收藏列表
async function getFavoriteList(data) {
	const { userId, page = 1, pageSize = 10 } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	// 获取收藏记录
	const favoriteResult = await db.collection('favorite')
		.where({ user_id: userId })
		.orderBy('create_time', 'desc')
		.skip((page - 1) * pageSize)
		.limit(pageSize)
		.get();
	
	// 获取教师信息
	const teacherIds = favoriteResult.data.map(item => item.teacher_id);
	const teachersResult = await db.collection('teacher')
		.where({
			_id: dbCmd.in(teacherIds)
		})
		.get();
	
	// 合并数据
	const favoriteList = favoriteResult.data.map(favorite => {
		const teacher = teachersResult.data.find(t => t._id === favorite.teacher_id);
		return {
			...favorite,
			teacher: teacher
		};
	});
	
	// 获取总数
	const countResult = await db.collection('favorite')
		.where({ user_id: userId })
		.count();
	
	return {
		code: 200,
		message: '获取成功',
		data: {
			list: favoriteList,
			total: countResult.total,
			page: page,
			pageSize: pageSize
		}
	};
}

// 检查是否已收藏
async function checkFavorite(data) {
	const { userId, teacherId } = data;
	
	if (!userId || !teacherId) {
		return {
			code: 400,
			message: '用户ID和教师ID不能为空'
		};
	}
	
	const result = await db.collection('favorite')
		.where({
			user_id: userId,
			teacher_id: teacherId
		})
		.get();
	
	return {
		code: 200,
		message: '获取成功',
		data: {
			isFavorited: result.data.length > 0
		}
	};
}
