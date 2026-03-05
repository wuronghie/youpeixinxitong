'use strict';

const uniID = require('uni-id-common')

exports.main = async (event, context) => {
	console.log('=== 云函数开始执行 ===')
	console.log('接收到的数据:', JSON.stringify(event, null, 2))
	
	try {
		// 创建uni-id实例
		context.APPID = context.APPID || '__UNI__xxxxxxx'
		context.PLATFORM = context.PLATFORM || 'web'
		context.LOCALE = context.LOCALE || 'zh-Hans'
		
		const uniIDIns = uniID.createInstance({
			context: context
		})
		
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
		
		// 验证必填字段
		const requiredFields = ['name', 'phone', 'idCard', 'gender', 'education', 'school', 'major', 'graduationYear', 'subjects', 'experience', 'grades', 'hourlyRate', 'avatar']
		for (let field of requiredFields) {
			if (!event[field]) {
				return {
					code: 'FIELD_REQUIRED',
					message: `字段 ${field} 为必填项`
				}
			}
		}
		
		// 构建教师数据
		const teacherInfo = {
			uid: uid,
			name: event.name,
			phone: event.phone,
			idCard: event.idCard,
			gender: event.gender,
			education: event.education,
			school: event.school,
			major: event.major,
			graduationYear: event.graduationYear,
			subjects: event.subjects,
			experience: event.experience,
			grades: event.grades,
			hourlyRate: parseFloat(event.hourlyRate),
			avatar: event.avatar,
			introduction: event.introduction || '',
			availableTime: event.availableTime || '',
			teachingMethods: event.teachingMethods || [],
			status: 'pending',
			createTime: new Date(),
			updateTime: new Date()
		}
		
		// 检查是否已经注册过
		const existingTeacher = await uniCloud.database().collection('teacher').where({
			uid: uid
		}).get()
		
		if (existingTeacher.data.length > 0) {
			return {
				code: 'ALREADY_REGISTERED',
				message: '您已经注册过教师账号'
			}
		}
		
		// 保存教师信息到数据库
		const result = await uniCloud.database().collection('teacher').add(teacherInfo)
		
		if (result.id) {
			return {
				code: 0,
				message: '教师注册申请提交成功',
				data: {
					teacherId: result.id
				}
			}
		} else {
			return {
				code: 'DATABASE_ERROR',
				message: '数据库保存失败'
			}
		}
		
	} catch (error) {
		console.error('教师注册错误:', error)
		return {
			code: 'SYSTEM_ERROR',
			message: '系统错误，请稍后重试'
		}
	}
};
