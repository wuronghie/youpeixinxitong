'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
	const { action, data } = event;
	
	try {
		switch (action) {
			case 'getParentInfo':
				return await getParentInfo(data);
			case 'createParentInfo':
				return await createParentInfo(data);
			case 'updateParentInfo':
				return await updateParentInfo(data);
			case 'addStudent':
				return await addStudent(data);
			case 'updateStudent':
				return await updateStudent(data);
			case 'deleteStudent':
				return await deleteStudent(data);
			case 'getStudentList':
				return await getStudentList(data);
			default:
				return {
					code: 400,
					message: '未知操作'
				};
		}
	} catch (error) {
		console.error('家长服务错误:', error);
		return {
			code: 500,
			message: '服务器内部错误',
			error: error.message
		};
	}
};

// 获取家长信息
async function getParentInfo(data) {
	const { userId } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	const result = await db.collection('parent')
		.where({ user_id: userId })
		.get();
	
	if (result.data.length === 0) {
		return {
			code: 404,
			message: '家长信息不存在'
		};
	}
	
	return {
		code: 200,
		message: '获取成功',
		data: result.data[0]
	};
}

// 创建家长信息
async function createParentInfo(data) {
	const { userId, parentInfo } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	// 检查是否已存在家长信息
	const existingParent = await db.collection('parent')
		.where({ user_id: userId })
		.get();
	
	if (existingParent.data.length > 0) {
		return {
			code: 400,
			message: '家长信息已存在'
		};
	}
	
	const parentData = {
		user_id: userId,
		...parentInfo,
		create_time: new Date(),
		update_time: new Date()
	};
	
	const result = await db.collection('parent').add(parentData);
	
	return {
		code: 200,
		message: '创建成功',
		data: {
			parentId: result.id
		}
	};
}

// 更新家长信息
async function updateParentInfo(data) {
	const { parentId, parentInfo } = data;
	
	if (!parentId) {
		return {
			code: 400,
			message: '家长ID不能为空'
		};
	}
	
	parentInfo.update_time = new Date();
	
	const result = await db.collection('parent').doc(parentId).update(parentInfo);
	
	if (result.updated === 0) {
		return {
			code: 404,
			message: '家长信息不存在'
		};
	}
	
	return {
		code: 200,
		message: '更新成功'
	};
}

// 添加学生信息
async function addStudent(data) {
	const { parentId, studentInfo } = data;
	
	if (!parentId) {
		return {
			code: 400,
			message: '家长ID不能为空'
		};
	}
	
	// 获取家长信息
	const parentResult = await db.collection('parent').doc(parentId).get();
	if (parentResult.data.length === 0) {
		return {
			code: 404,
			message: '家长信息不存在'
		};
	}
	
	const parent = parentResult.data[0];
	const students = parent.students || [];
	
	// 添加新学生
	students.push({
		...studentInfo,
		create_time: new Date()
	});
	
	const result = await db.collection('parent').doc(parentId).update({
		students: students,
		update_time: new Date()
	});
	
	return {
		code: 200,
		message: '学生信息添加成功'
	};
}

// 更新学生信息
async function updateStudent(data) {
	const { parentId, studentIndex, studentInfo } = data;
	
	if (!parentId || studentIndex === undefined) {
		return {
			code: 400,
			message: '家长ID和学生索引不能为空'
		};
	}
	
	// 获取家长信息
	const parentResult = await db.collection('parent').doc(parentId).get();
	if (parentResult.data.length === 0) {
		return {
			code: 404,
			message: '家长信息不存在'
		};
	}
	
	const parent = parentResult.data[0];
	const students = parent.students || [];
	
	if (studentIndex >= students.length) {
		return {
			code: 400,
			message: '学生索引无效'
		};
	}
	
	// 更新学生信息
	students[studentIndex] = {
		...students[studentIndex],
		...studentInfo,
		update_time: new Date()
	};
	
	const result = await db.collection('parent').doc(parentId).update({
		students: students,
		update_time: new Date()
	});
	
	return {
		code: 200,
		message: '学生信息更新成功'
	};
}

// 删除学生信息
async function deleteStudent(data) {
	const { parentId, studentIndex } = data;
	
	if (!parentId || studentIndex === undefined) {
		return {
			code: 400,
			message: '家长ID和学生索引不能为空'
		};
	}
	
	// 获取家长信息
	const parentResult = await db.collection('parent').doc(parentId).get();
	if (parentResult.data.length === 0) {
		return {
			code: 404,
			message: '家长信息不存在'
		};
	}
	
	const parent = parentResult.data[0];
	const students = parent.students || [];
	
	if (studentIndex >= students.length) {
		return {
			code: 400,
			message: '学生索引无效'
		};
	}
	
	// 删除学生信息
	students.splice(studentIndex, 1);
	
	const result = await db.collection('parent').doc(parentId).update({
		students: students,
		update_time: new Date()
	});
	
	return {
		code: 200,
		message: '学生信息删除成功'
	};
}

// 获取学生列表
async function getStudentList(data) {
	const { parentId } = data;
	
	if (!parentId) {
		return {
			code: 400,
			message: '家长ID不能为空'
		};
	}
	
	const result = await db.collection('parent').doc(parentId).get();
	
	if (result.data.length === 0) {
		return {
			code: 404,
			message: '家长信息不存在'
		};
	}
	
	const parent = result.data[0];
	const students = parent.students || [];
	
	return {
		code: 200,
		message: '获取成功',
		data: students
	};
}