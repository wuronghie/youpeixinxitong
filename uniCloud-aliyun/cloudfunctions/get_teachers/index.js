'use strict';

// 缓存所有教师数据，避免频繁数据库查询
let cachedTeachers = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 获取所有教师数据（带缓存）
async function getAllTeachers() {
	const now = Date.now();
	
	// 如果缓存存在且未过期，直接返回缓存数据
	if (cachedTeachers && (now - cacheTime) < CACHE_DURATION) {
		console.log('=== 使用缓存数据 ===');
		return cachedTeachers;
	}
	
	console.log('=== 从数据库获取数据并缓存 ===');
	const db = uniCloud.database();
	const teacherCollection = db.collection('teacher');
	
	// 一次性获取所有数据
	const result = await teacherCollection
		.orderBy('createTime', 'desc')
		.limit(100)
		.get();
	
	// 更新缓存
	cachedTeachers = result.data;
	cacheTime = now;
	
	console.log('缓存了', cachedTeachers.length, '条教师数据');
	return cachedTeachers;
}

// 在内存中筛选数据
function filterTeachers(teachers, filters) {
	console.log('=== 开始内存筛选 ===');
	console.log('筛选条件:', filters);
	console.log('筛选前数据量:', teachers.length);
	
	let filtered = teachers;
	
	// 学校筛选
	if (filters.schools && filters.schools.length > 0) {
		filtered = filtered.filter(teacher => 
			filters.schools.includes(teacher.school)
		);
		console.log('学校筛选后:', filtered.length, '条记录');
	}
	
	// 教龄筛选
	if (filters.experience && filters.experience.length > 0) {
		filtered = filtered.filter(teacher => 
			filters.experience.includes(teacher.experience)
		);
		console.log('教龄筛选后:', filtered.length, '条记录');
	}
	
	// 年级筛选（字符串包含匹配）
	if (filters.grades && filters.grades.length > 0) {
		filtered = filtered.filter(teacher => {
			if (!teacher.grades) return false;
			return filters.grades.some(grade => 
				teacher.grades.includes(grade)
			);
		});
		console.log('年级筛选后:', filtered.length, '条记录');
	}
	
	// 科目筛选（字符串包含匹配）
	if (filters.subjects && filters.subjects.length > 0) {
		filtered = filtered.filter(teacher => {
			if (!teacher.subjects) return false;
			return filters.subjects.some(subject => 
				teacher.subjects.includes(subject)
			);
		});
		console.log('科目筛选后:', filtered.length, '条记录');
	}
	
	console.log('=== 内存筛选完成 ===');
	console.log('最终结果:', filtered.length, '条记录');
	return filtered;
}

exports.main = async (event, context) => {
	console.log('=== 获取教师数据云函数开始执行 ===');
	console.log('接收到的参数:', JSON.stringify(event, null, 2));
	
	try {
		// 获取所有教师数据（带缓存）
		const allTeachers = await getAllTeachers();
		
		// 如果没有数据，直接返回
		if (allTeachers.length === 0) {
			return {
				code: 0,
				message: '数据库中没有教师数据',
				data: [],
				debug: {
					filterApplied: false,
					totalCount: 0
				}
			};
		}
		
		// 构建筛选条件
		const filters = {
			schools: event.schools || [],
			experience: event.experience || [],
			grades: event.grades || [],
			subjects: event.subjects || []
		};
		
		// 检查是否有筛选条件
		const hasFilters = filters.schools.length > 0 || filters.experience.length > 0 || 
			filters.grades.length > 0 || filters.subjects.length > 0;
		
		let result;
		
		if (hasFilters) {
			// 有筛选条件，进行内存筛选
			console.log('=== 有筛选条件，开始内存筛选 ===');
			result = filterTeachers(allTeachers, filters);
		} else {
			// 无筛选条件，返回所有数据
			console.log('=== 无筛选条件，返回所有数据 ===');
			result = allTeachers;
		}
		
		// 限制返回数量
		result = result.slice(0, 50);
		
		console.log('=== 返回最终结果 ===');
		console.log('筛选条件:', filters);
		console.log('结果数量:', result.length);
		
		// 如果筛选后没有结果
		if (hasFilters && result.length === 0) {
			return {
				code: 0,
				message: '筛选无结果',
				data: [],
				debug: {
					filterApplied: true,
					filterConditions: filters,
					noMatch: true,
					totalCount: allTeachers.length
				}
			};
		}
		
		return {
			code: 0,
			message: hasFilters ? '筛选成功' : '获取成功',
			data: result,
			debug: {
				filterApplied: hasFilters,
				filterConditions: filters,
				totalCount: allTeachers.length,
				resultCount: result.length
			}
		};
	} catch (error) {
		console.error('获取老师列表失败:', error);
		return {
			code: -1,
			message: '获取失败: ' + error.message,
			data: []
		};
	}
};
