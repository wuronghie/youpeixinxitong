// 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
// jsdoc语法提示教程：https://ask.dcloud.net.cn/docs/#//ask.dcloud.net.cn/article/129
module.exports = {
	_before: function () { // 通用预处理器
		console.log('teacher_data 云对象被调用');
	},
	/**
	 * 获取老师列表数据
	 * @param {object} params 查询参数
	 * @param {array} params.schools 学校筛选
	 * @param {array} params.experience 教龄筛选
	 * @param {array} params.subjects 科目筛选
	 * @returns {object} 返回值描述
	 */
	async getTeacherList(params = {}) {
		try {
			console.log('开始获取老师列表，参数:', JSON.stringify(params));
			
			const db = uniCloud.database();
			const teacherCollection = db.collection('teacher');
			
			// 构建查询条件
			let whereCondition = {};
			
			// 学校筛选
			if (params.schools && params.schools.length > 0) {
				whereCondition.school = db.command.in(params.schools);
			}
			
			// 教龄筛选
			if (params.experience && params.experience.length > 0) {
				whereCondition.experience = db.command.in(params.experience);
			}
			
			// 科目筛选
			if (params.subjects && params.subjects.length > 0) {
				whereCondition.subjects = db.command.in(params.subjects);
			}
			
			// 只获取已审核通过的老师
			whereCondition.status = 'approved';
			
			console.log('查询条件:', JSON.stringify(whereCondition));
			
			// 查询数据
			const result = await teacherCollection
				.where(whereCondition)
				.orderBy('createTime', 'desc')
				.limit(50)
				.get();
			
			console.log('查询结果:', result.data.length, '条记录');
			console.log('查询到的老师:', result.data.map(t => t.name));
			
			return {
				code: 0,
				message: '获取成功',
				data: result.data
			};
		} catch (error) {
			console.error('获取老师列表失败:', error);
			return {
				code: -1,
				message: '获取失败: ' + error.message,
				data: []
			};
		}
	},
	
	/**
	 * 获取筛选选项数据
	 * @returns {object} 返回值描述
	 */
	async getFilterOptions() {
		try {
			const db = uniCloud.database();
			const teacherCollection = db.collection('teacher');
			
			// 获取所有已审核通过的老师
			const result = await teacherCollection
				.where({
					status: 'approved'
				})
				.field({
					school: true,
					experience: true,
					subjects: true
				})
				.get();
			
			// 提取唯一的学校列表
			const schools = [...new Set(result.data.map(teacher => teacher.school))];
			
			// 提取唯一的教龄列表
			const experiences = [...new Set(result.data.map(teacher => teacher.experience))];
			
			// 提取唯一的科目列表
			const subjects = [...new Set(result.data.map(teacher => teacher.subjects))];
			
			return {
				code: 0,
				message: '获取成功',
				data: {
					schools,
					experiences,
					subjects
				}
			};
		} catch (error) {
			console.error('获取筛选选项失败:', error);
			return {
				code: -1,
				message: '获取失败: ' + error.message,
				data: {
					schools: [],
					experiences: [],
					subjects: []
				}
			};
		}
	},
	
	/**
	 * 简单测试方法
	 * @returns {object} 返回值描述
	 */
	async hello() {
		console.log('hello 方法被调用');
		return {
			code: 0,
			message: '云对象调用成功',
			data: 'Hello from teacher_data cloud object!'
		};
	},
	
	/**
	 * 测试方法 - 检查数据库连接和基本查询
	 * @returns {object} 返回值描述
	 */
	async testConnection() {
		try {
			console.log('开始测试数据库连接...');
			
			const db = uniCloud.database();
			console.log('数据库对象创建成功');
			
			const teacherCollection = db.collection('teacher');
			console.log('teacher集合引用创建成功');
			
			// 尝试获取所有数据（不限制条件）
			const allResult = await teacherCollection.limit(10).get();
			console.log('查询所有数据结果:', allResult.data.length, '条记录');
			
			// 尝试获取已审核的数据
			const approvedResult = await teacherCollection
				.where({
					status: 'approved'
				})
				.limit(10)
				.get();
			console.log('查询已审核数据结果:', approvedResult.data.length, '条记录');
			
			return {
				code: 0,
				message: '测试成功',
				data: {
					totalCount: allResult.data.length,
					approvedCount: approvedResult.data.length,
					allData: allResult.data,
					approvedData: approvedResult.data
				}
			};
		} catch (error) {
			console.error('测试数据库连接失败:', error);
			return {
				code: -1,
				message: '测试失败: ' + error.message,
				data: null
			};
		}
	}
}
