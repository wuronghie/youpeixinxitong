// 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
// jsdoc语法提示教程：https://ask.dcloud.net.cn/docs/#//ask.dcloud.net.cn/article/129
const uniID = require('uni-id-common')

module.exports = {
	_before: function () { // 通用预处理器
		const clientInfo = this.getClientInfo()
		this.uniID = uniID.createInstance({ // 创建uni-id实例
			clientInfo
		})
	},
	/**
	 * 保存家长信息
	 * @param {object} parentData 家长信息
	 * @param {string} parentData.name 家长姓名
	 * @param {string} parentData.phone 手机号
	 * @param {string} parentData.grade 孩子年级
	 * @param {string} parentData.subjects 需要辅导的科目
	 * @param {string} uniIdToken 用户token
	 * @returns {object} 返回值描述
	 */
	async saveParentInfo(parentData, uniIdToken) {
		try {
			// 校验token获取用户信息
			const payload = await this.uniID.checkToken(uniIdToken)
			if (payload.code) {
				return {
					code: payload.code,
					message: payload.message || 'token校验失败'
				}
			}
			
			const uid = payload.uid
			
			// 参数校验
			if (!parentData || !parentData.name || !parentData.phone) {
				return {
					code: 'PARAM_ERROR',
					message: '姓名和手机号不能为空'
				}
			}
			
			// 检查是否已存在家长信息
			const db = uniCloud.database()
			const existingData = await db.collection('parent').where({
				uid: uid
			}).get()
			
			let result
			if (existingData.data.length > 0) {
				// 更新现有数据
				result = await db.collection('parent').doc(existingData.data[0]._id).update({
					name: parentData.name,
					phone: parentData.phone,
					grade: parentData.grade || '',
					subjects: parentData.subjects || '',
					updateTime: new Date()
				})
			} else {
				// 新增数据
				result = await db.collection('parent').add({
					uid: uid,
					name: parentData.name,
					phone: parentData.phone,
					grade: parentData.grade || '',
					subjects: parentData.subjects || '',
					createTime: new Date(),
					updateTime: new Date()
				})
			}
			
			return {
				code: 0,
				message: existingData.data.length > 0 ? '更新成功' : '保存成功',
				data: result
			}
		} catch (error) {
			console.error('保存家长信息失败:', error)
			return {
				code: 'SYSTEM_ERROR',
				message: '系统错误，请稍后重试'
			}
		}
	},
	
	/**
	 * 获取家长信息
	 * @param {string} uniIdToken 用户token
	 * @returns {object} 返回值描述
	 */
	async getParentInfo(uniIdToken) {
		try {
			// 校验token获取用户信息
			const payload = await this.uniID.checkToken(uniIdToken)
			if (payload.code) {
				return {
					code: payload.code,
					message: payload.message || 'token校验失败'
				}
			}
			
			const uid = payload.uid
			
			// 从数据库获取家长信息
			const db = uniCloud.database()
			const result = await db.collection('parent').where({
				uid: uid
			}).get()
			
			if (result.data.length > 0) {
				return {
					code: 0,
					message: '获取成功',
					data: result.data[0]
				}
			} else {
				return {
					code: 'NO_DATA',
					message: '暂无家长信息',
					data: null
				}
			}
		} catch (error) {
			console.error('获取家长信息失败:', error)
			return {
				code: 'SYSTEM_ERROR',
				message: '系统错误，请稍后重试'
			}
		}
	}
}
