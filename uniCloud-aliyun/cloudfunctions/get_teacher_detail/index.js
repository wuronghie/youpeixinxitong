'use strict';

exports.main = async (event, context) => {
	console.log('=== 获取老师详情云函数开始执行 ===');
	console.log('接收到的参数:', JSON.stringify(event, null, 2));
	
	try {
		const { teacherId } = event;
		
		// 验证参数
		if (!teacherId) {
			return {
				code: -1,
				message: '缺少teacherId参数'
			};
		}
		
		// 查询老师详情
		const db = uniCloud.database();
		const teacherCollection = db.collection('teacher');
		
		const result = await teacherCollection
			.doc(teacherId)
			.get();
		
		if (result.data.length === 0) {
			return {
				code: -1,
				message: '老师不存在'
			};
		}
		
		const teacher = result.data[0];
		
		// 返回老师详情信息
		return {
			code: 0,
			message: '获取成功',
			data: {
				_id: teacher._id,
				name: teacher.name,
				avatar: teacher.avatar || '/static/default-avatar.png',
				phone: teacher.phone,
				gender: teacher.gender,
				education: teacher.education,
				school: teacher.school,
				major: teacher.major,
				graduationYear: teacher.graduationYear,
				subjects: teacher.subjects,
				experience: teacher.experience,
				grades: teacher.grades,
				hourlyRate: teacher.hourlyRate,
				introduction: teacher.introduction,
				availableTime: teacher.availableTime,
				teachingMethods: teacher.teachingMethods || [],
				achievements: teacher.achievements,
				status: teacher.status,
				createTime: teacher.createTime,
				updateTime: teacher.updateTime,
				// 模拟在线状态
				isOnline: Math.random() > 0.3
			}
		};
		
	} catch (error) {
		console.error('获取老师详情失败:', error);
		return {
			code: -1,
			message: '获取失败: ' + error.message
		};
	}
};
