'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
	const count = event.count || 30; // 默认生成30个
	const clear = event.clear || false; // 是否清空旧数据
	
	if (clear) {
		console.log('清空旧数据...');
		// 注意：实际使用时请谨慎操作，这里仅清空模拟数据（通过备注或特定标记识别）
		await db.collection('teacher-profiles').where({
			introduction: dbCmd.regex({
				regex: '模拟生成',
				options: 'i'
			})
		}).remove();
	}

	const subjects = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"];
	const grades = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"];
	const schools = ["四川大学", "电子科技大学", "西南交通大学", "四川农业大学", "西南财经大学", "其他985/211", "专职老师"];
	const experiences = ["大二至大四（1年以内）", "大二至大四（1-2年）", "大二至大四（2年以上）", "专职老师（1-3年）", "专职老师（3-5年）", "专职老师（5年以上）"];
	const tags = ["有试课视频", "家长好评50+", "可上门辅导", "擅长提分（中高考）", "耐心教基础薄弱生"];
	const surnames = ["张", "王", "李", "赵", "陈", "周", "吴", "郑", "孙", "钱", "何", "高", "林", "徐", "朱"];
	const names = ["伟", "芳", "娜", "秀英", "敏", "静", "丽", "强", "军", "洋", "勇", "杰", "娟", "涛", "涛"];

	const mockTeachers = [];
	const now = Date.now();

	for (let i = 0; i < count; i++) {
		const surname = surnames[Math.floor(Math.random() * surnames.length)];
		const name = names[Math.floor(Math.random() * names.length)];
		const displayName = surname + name + "老师";
		const uid = "mock_teacher_" + now + "_" + i;
		
		// 随机生成头像 (AI人脸)
		const avatar = `https://i.pravatar.cc/300?u=${uid}`;
		
		// 随机生成科目 (1-3个)
		const teacherSubjects = [];
		const subCount = Math.floor(Math.random() * 3) + 1;
		for(let j=0; j<subCount; j++) {
			const s = subjects[Math.floor(Math.random() * subjects.length)];
			if(!teacherSubjects.includes(s)) teacherSubjects.push(s);
		}
		
		// 随机生成年级 (3-6个)
		const teacherGrades = [];
		const gradeCount = Math.floor(Math.random() * 4) + 3;
		for(let j=0; j<gradeCount; j++) {
			const g = grades[Math.floor(Math.random() * grades.length)];
			if(!teacherGrades.includes(g)) teacherGrades.push(g);
		}

		const hourlyRate = (Math.floor(Math.random() * 15) + 8) * 10; // 80-220
		const rating = (4 + Math.random()).toFixed(1);
		const reviewCount = Math.floor(Math.random() * 100);
		
		mockTeachers.push({
			teacher_id: uid,
			display_name: displayName,
			avatar: avatar,
			subjects: teacherSubjects,
			grades: teacherGrades,
			hourly_rate: hourlyRate,
			rating: parseFloat(rating),
			review_count: reviewCount,
			introduction: `[模拟生成] 我是${displayName}，拥有多年的${teacherSubjects[0]}教学经验。擅长因材施教，帮助学生建立知识体系，提升学习兴趣。`,
			school: schools[Math.floor(Math.random() * schools.length)],
			experience: experiences[Math.floor(Math.random() * experiences.length)],
			tags: [tags[Math.floor(Math.random() * tags.length)], tags[Math.floor(Math.random() * tags.length)]],
			is_verified: Math.random() > 0.3,
			available: true,
			total_courses: Math.floor(Math.random() * 500),
			total_students: Math.floor(Math.random() * 100),
			create_time: now,
			update_time: now
		});
		
		// 同时插入到用户表以确保关联查询不报错
		await db.collection('uni-id-users').add({
			_id: uid,
			nickname: displayName,
			avatar: avatar,
			role: 'teacher',
			status: 1,
			create_date: now
		});
	}

	const res = await db.collection('teacher-profiles').add(mockTeachers);

	return {
		code: 0,
		message: `成功录入 ${mockTeachers.length} 条模拟教师数据`,
		data: res
	};
};
