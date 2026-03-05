'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
	const { action, data } = event;
	
	try {
		switch (action) {
			case 'getUserInfo':
				return await getUserInfo(data);
			case 'updateUserInfo':
				return await updateUserInfo(data);
			case 'getUserRole':
				return await getUserRole(data);
			case 'updateUserRole':
				return await updateUserRole(data);
			default:
				return {
					code: 400,
					message: '未知操作'
				};
		}
	} catch (error) {
		console.error('用户服务错误:', error);
		return {
			code: 500,
			message: '服务器内部错误',
			error: error.message
		};
	}
};

// 获取用户信息
async function getUserInfo(data) {
	const { userId } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	const result = await db.collection('user').doc(userId).get();
	
	if (result.data.length === 0) {
		return {
			code: 404,
			message: '用户不存在'
		};
	}
	
	return {
		code: 200,
		message: '获取成功',
		data: result.data[0]
	};
}

// 更新用户信息
async function updateUserInfo(data) {
	const { userId, userInfo } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	userInfo.update_time = new Date();
	
	const result = await db.collection('user').doc(userId).update(userInfo);
	
	if (result.updated === 0) {
		return {
			code: 404,
			message: '用户不存在'
		};
	}
	
	return {
		code: 200,
		message: '更新成功'
	};
}

// 获取用户角色
async function getUserRole(data) {
	const { userId } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	const result = await db.collection('user').doc(userId).field({
		role: true
	}).get();
	
	if (result.data.length === 0) {
		return {
			code: 404,
			message: '用户不存在'
		};
	}
	
	return {
		code: 200,
		message: '获取成功',
		data: {
			role: result.data[0].role
		}
	};
}

// 更新用户角色
async function updateUserRole(data) {
	const { userId, role } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	if (!['parent', 'teacher'].includes(role)) {
		return {
			code: 400,
			message: '角色参数无效'
		};
	}
	
	const result = await db.collection('user').doc(userId).update({
		role: role,
		update_time: new Date()
	});
	
	if (result.updated === 0) {
		return {
			code: 404,
			message: '用户不存在'
		};
	}
	
	return {
		code: 200,
		message: '角色更新成功'
	};
}
