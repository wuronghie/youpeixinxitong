'use strict';

const uniID = require('uni-id-common')

exports.main = async (event, context) => {
	// 创建uni-id实例
	context.APPID = context.APPID || '__UNI__xxxxxxx'
	context.PLATFORM = context.PLATFORM || 'web'
	context.LOCALE = context.LOCALE || 'zh-Hans'
	
	const uniIDIns = uniID.createInstance({
		context: context
	})
	
	// 获取教师信息
	try {
		// 获取用户token并验证身份
		const token = event.uniIdToken || event.token
		if (!token) {
			return {
				code: 'TOKEN_INVALID',
				message: '用户未登录'
			}
		}
		
		// 校验token并获取用户信息
		const payload = await uniIDIns.checkToken(token)
		if (payload.code) {
			return {
				code: payload.code,
				message: payload.message || 'token验证失败'
			}
		}
		
		// 获取用户uid
		const uid = payload.uid
		
		// 查询教师信息
		const teacherResult = await uniCloud.database().collection('teacher').where({
			uid: uid
		}).get()
		
		if (teacherResult.data.length === 0) {
			return {
				code: 'NOT_TEACHER',
				message: '用户不是教师'
			}
		}
		
		const teacherInfo = teacherResult.data[0]
		
		// 返回教师信息
		return {
			code: 0,
			message: '获取成功',
			data: {
				teacherId: teacherInfo._id,
				name: teacherInfo.name,
				phone: teacherInfo.phone,
				gender: teacherInfo.gender,
				education: teacherInfo.education,
				school: teacherInfo.school,
				major: teacherInfo.major,
				graduationYear: teacherInfo.graduationYear,
				subjects: teacherInfo.subjects,
				experience: teacherInfo.experience,
				grades: teacherInfo.grades,
				hourlyRate: teacherInfo.hourlyRate,
				introduction: teacherInfo.introduction,
				availableTime: teacherInfo.availableTime,
				teachingMethods: teacherInfo.teachingMethods,
				status: teacherInfo.status,
				createTime: teacherInfo.createTime,
				updateTime: teacherInfo.updateTime,
				// 模拟统计数据
				teachingHours: 2500,
				studentsTaught: 86,
				rating: 99,
				walletBalance: 12500,
				currentHours: 120,
				targetHours: 2500
			}
		}
		
	} catch (error) {
		console.error('获取教师信息错误:', error)
		return {
			code: 'SYSTEM_ERROR',
			message: '系统错误，请稍后重试'
		}
	}
};
