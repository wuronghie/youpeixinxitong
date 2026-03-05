'use strict';

const uniID = require('uni-id-common')

exports.main = async (event, context) => {
	console.log('=== 更新教师信息云函数开始执行 ===')
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
		const requiredFields = ['name', 'phone', 'gender', 'education', 'school', 'major', 'graduationYear', 'subjects', 'experience', 'grades', 'hourlyRate']
		for (let field of requiredFields) {
			if (!event[field]) {
				return {
					code: 'FIELD_REQUIRED',
					message: `字段 ${field} 为必填项`
				}
			}
		}
		
		// 检查教师是否存在
		const existingTeacher = await uniCloud.database().collection('teacher').where({
			uid: uid
		}).get()
		
		if (existingTeacher.data.length === 0) {
			return {
				code: 'TEACHER_NOT_FOUND',
				message: '教师信息不存在'
			}
		}
		
		// 构建更新数据
		const updateData = {
			name: event.name,
			phone: event.phone,
			gender: event.gender,
			education: event.education,
			school: event.school,
			major: event.major,
			graduationYear: event.graduationYear,
			subjects: event.subjects,
			experience: event.experience,
			grades: event.grades,
			hourlyRate: parseFloat(event.hourlyRate),
			avatar: event.avatar || existingTeacher.data[0].avatar, // 如果没有新头像，保持原头像
			introduction: event.introduction || '',
			availableTime: event.availableTime || '',
			teachingMethods: event.teachingMethods || [],
			updateTime: new Date()
		}
		
		// 更新教师信息
		const result = await uniCloud.database().collection('teacher').where({
			uid: uid
		}).update(updateData)
		
		if (result.updated > 0) {
			return {
				code: 0,
				message: '教师信息更新成功',
				data: {
					updated: result.updated
				}
			}
		} else {
			return {
				code: 'UPDATE_FAILED',
				message: '更新失败，请重试'
			}
		}
		
	} catch (error) {
		console.error('更新教师信息错误:', error)
		return {
			code: 'SYSTEM_ERROR',
			message: '系统错误，请稍后重试'
		}
	}
};
