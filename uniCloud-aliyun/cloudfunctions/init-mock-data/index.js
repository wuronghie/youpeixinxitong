'use strict';

/**
 * 初始化模拟数据云函数
 * 功能：一键创建模拟用户和教师数据
 * 
 * 使用方法：
 * 1. 上传此云函数
 * 2. 在HBuilderX中右键运行，或在控制台调用
 * 3. 传入参数 { action: 'init' }
 */

const db = uniCloud.database();

exports.main = async (event, context) => {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    const { action } = event;

    if (action === 'init') {
      // 初始化数据
      return await initMockData();
    } else if (action === 'clear') {
      // 清空数据（谨慎使用）
      return await clearMockData();
    } else {
      response.code = 400;
      response.message = '请指定操作类型：init 或 clear';
      return response;
    }

  } catch (error) {
    console.error('操作失败：', error);
    response.code = 500;
    response.message = error.message || '操作失败';
    return response;
  }
};

// 初始化模拟数据
async function initMockData() {
  const response = {
    code: 0,
    message: '操作成功',
    data: {
      userIds: [],
      teacherIds: []
    }
  };

  try {
    console.log('开始初始化模拟数据...');

    // 模拟用户数据
    const mockUsers = [
      {
        openid: 'mock_openid_teacher_001',
        userType: 'teacher',
        phone: '13800001001',
        avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL3JEag1iboRUjT9Uwo9s5bXtbGcFLibUicicgpWjqqBYib67CPRqibibT0VJbmNJfvlcWCJEwRXKCdLdzg/132',
        nickname: '张老师',
        gender: 1,
        realName: '张明',
        isBlocked: false,
        lastLoginTime: Date.now(),
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        openid: 'mock_openid_teacher_002',
        userType: 'teacher',
        phone: '13800001002',
        avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL3JEag1iboRUjT9Uwo9s5bXtbGcFLibUicicgpWjqqBYib67CPRqibibT0VJbmNJfvlcWCJEwRXKCdLdzg/132',
        nickname: '李老师',
        gender: 2,
        realName: '李红',
        isBlocked: false,
        lastLoginTime: Date.now(),
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        openid: 'mock_openid_teacher_003',
        userType: 'teacher',
        phone: '13800001003',
        avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL3JEag1iboRUjT9Uwo9s5bXtbGcFLibUicicgpWjqqBYib67CPRqibibT0VJbmNJfvlcWCJEwRXKCdLdzg/132',
        nickname: '王老师',
        gender: 1,
        realName: '王强',
        isBlocked: false,
        lastLoginTime: Date.now(),
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        openid: 'mock_openid_teacher_004',
        userType: 'teacher',
        phone: '13800001004',
        avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL3JEag1iboRUjT9Uwo9s5bXtbGcFLibUicicgpWjqqBYib67CPRqibibT0VJbmNJfvlcWCJEwRXKCdLdzg/132',
        nickname: '刘老师',
        gender: 2,
        realName: '刘芳',
        isBlocked: false,
        lastLoginTime: Date.now(),
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        openid: 'mock_openid_teacher_005',
        userType: 'teacher',
        phone: '13800001005',
        avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL3JEag1iboRUjT9Uwo9s5bXtbGcFLibUicicgpWjqqBYib67CPRqibibT0VJbmNJfvlcWCJEwRXKCdLdzg/132',
        nickname: '陈老师',
        gender: 1,
        realName: '陈浩',
        isBlocked: false,
        lastLoginTime: Date.now(),
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        openid: 'mock_openid_teacher_006',
        userType: 'teacher',
        phone: '13800001006',
        avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLL3JEag1iboRUjT9Uwo9s5bXtbGcFLibUicicgpWjqqBYib67CPRqibibT0VJbmNJfvlcWCJEwRXKCdLdzg/132',
        nickname: '赵老师',
        gender: 2,
        realName: '赵敏',
        isBlocked: false,
        lastLoginTime: Date.now(),
        createTime: Date.now(),
        updateTime: Date.now()
      }
    ];

    // 1. 创建用户
    console.log('创建用户数据...');
    const userIds = [];
    for (const userData of mockUsers) {
      // 检查是否已存在
      const existUser = await db.collection('users').where({
        openid: userData.openid
      }).get();

      let userId;
      if (existUser.data.length > 0) {
        userId = existUser.data[0]._id;
        console.log(`用户 ${userData.nickname} 已存在`);
      } else {
        const userResult = await db.collection('users').add(userData);
        userId = userResult.id;
        console.log(`创建用户 ${userData.nickname}，ID: ${userId}`);
      }
      userIds.push(userId);
    }

    // 2. 创建教师数据
    console.log('创建教师数据...');
    const teacherIds = [];
    
    const teacherDataList = [
      {
        // 数学教师 - 张老师
        userIndex: 0,
        education: 'master',
        school: '北京师范大学',
        major: '数学与应用数学',
        teachingAge: 5,
        subjects: ['math', 'physics'],
        grades: ['grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12'],
        introduction: '北京师范大学数学系硕士毕业，拥有5年高中数学教学经验。曾在重点中学任教，熟悉中高考数学命题规律。擅长针对不同层次学生制定个性化教学方案，注重培养学生的数学思维和解题能力。帮助多名学生数学成绩提高30-50分，考入理想大学。',
        certificates: [],
        teachingPhotos: [],
        hourlyRate: 200,
        rating: 4.9,
        reviewCount: 48,
        orderCount: 120,
        status: 'approved',
        tags: ['经验丰富', '提分快', '逻辑清晰', '耐心负责'],
        workTime: {
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          timeSlots: ['afternoon', 'evening']
        },
        isRecommended: true
      },
      {
        // 英语教师 - 李老师
        userIndex: 1,
        education: 'bachelor',
        school: '外交学院',
        major: '英语',
        teachingAge: 3,
        subjects: ['english'],
        grades: ['grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12'],
        introduction: '外交学院英语专业毕业，英语专业八级，雅思8分。曾在国际学校任教3年，熟悉中学英语教学大纲和新课标。注重听说读写全面发展，善于激发学生学习英语的兴趣。课堂氛围轻松活跃，采用情景教学法，让学生在实际运用中掌握英语。',
        certificates: [],
        teachingPhotos: [],
        hourlyRate: 180,
        rating: 4.8,
        reviewCount: 36,
        orderCount: 95,
        status: 'approved',
        tags: ['口语流利', '寓教于乐', '气氛活跃', '方法独特'],
        workTime: {
          weekdays: [1, 3, 5, 6, 7],
          timeSlots: ['morning', 'afternoon', 'evening']
        },
        isRecommended: true
      },
      {
        // 物理教师 - 王老师
        userIndex: 2,
        education: 'doctor',
        school: '清华大学',
        major: '物理学',
        teachingAge: 8,
        subjects: ['physics', 'math'],
        grades: ['grade9', 'grade10', 'grade11', 'grade12'],
        introduction: '清华大学物理系博士，拥有8年高中物理教学经验。精通高中物理知识体系，擅长解决学生的疑难问题。注重物理思维的培养，帮助学生理解物理本质。曾指导多名学生参加物理竞赛获奖，培养出多名考入清北的学生。教学严谨而不失幽默。',
        certificates: [],
        teachingPhotos: [],
        hourlyRate: 250,
        rating: 5.0,
        reviewCount: 62,
        orderCount: 156,
        status: 'approved',
        tags: ['名校博士', '竞赛教练', '深入浅出', '提分显著'],
        workTime: {
          weekdays: [6, 7],
          timeSlots: ['morning', 'afternoon', 'evening']
        },
        isRecommended: true
      },
      {
        // 化学教师 - 刘老师
        userIndex: 3,
        education: 'master',
        school: '北京大学',
        major: '化学',
        teachingAge: 4,
        subjects: ['chemistry', 'biology'],
        grades: ['grade10', 'grade11', 'grade12'],
        introduction: '北京大学化学系硕士毕业，4年高中化学教学经验。擅长化学实验教学和化学思维训练。注重知识的系统性和连贯性，帮助学生构建完整的化学知识体系。善于用生活中的例子解释化学现象，让化学变得生动有趣。',
        certificates: [],
        teachingPhotos: [],
        hourlyRate: 190,
        rating: 4.7,
        reviewCount: 28,
        orderCount: 72,
        status: 'approved',
        tags: ['实验专家', '思维训练', '系统讲解', '贴近生活'],
        workTime: {
          weekdays: [1, 2, 3, 4, 5],
          timeSlots: ['evening']
        },
        isRecommended: false
      },
      {
        // 编程教师 - 陈老师
        userIndex: 4,
        education: 'bachelor',
        school: '清华大学',
        major: '计算机科学与技术',
        teachingAge: 2,
        subjects: ['programming'],
        grades: ['grade7', 'grade8', 'grade9', 'grade10', 'adult'],
        introduction: '清华大学计算机系毕业，现任某互联网公司高级工程师。业余时间热衷于青少年编程教育，擅长Python、C++、算法竞赛指导。教学注重实践，培养学生编程思维和解决问题的能力。已帮助多名学生获得信息学竞赛奖项。',
        certificates: [],
        teachingPhotos: [],
        hourlyRate: 220,
        rating: 4.9,
        reviewCount: 18,
        orderCount: 45,
        status: 'approved',
        tags: ['大厂工程师', '算法专家', '注重实践', '思维训练'],
        workTime: {
          weekdays: [6, 7],
          timeSlots: ['morning', 'afternoon', 'evening']
        },
        isRecommended: true
      },
      {
        // 语文教师 - 赵老师
        userIndex: 5,
        education: 'master',
        school: '北京师范大学',
        major: '汉语言文学',
        teachingAge: 6,
        subjects: ['chinese', 'history'],
        grades: ['grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12'],
        introduction: '北京师范大学汉语言文学硕士，6年中学语文教学经验。熟悉中高考语文命题方向，擅长作文指导和阅读理解。注重培养学生的文学素养和语文思维。教学风格细腻，善于发现学生的闪光点，激发学生对语文的兴趣。',
        certificates: [],
        teachingPhotos: [],
        hourlyRate: 170,
        rating: 4.8,
        reviewCount: 42,
        orderCount: 108,
        status: 'approved',
        tags: ['文学功底深', '作文指导', '阅读理解', '细腻耐心'],
        workTime: {
          weekdays: [1, 2, 3, 4, 5, 6],
          timeSlots: ['afternoon', 'evening']
        },
        isRecommended: false
      }
    ];

    for (const teacherData of teacherDataList) {
      const { userIndex, ...data } = teacherData;
      const userId = userIds[userIndex];

      // 检查是否已存在
      const existTeacher = await db.collection('teachers').where({
        userId: userId
      }).get();

      if (existTeacher.data.length > 0) {
        console.log(`教师 ${mockUsers[userIndex].nickname} 已存在`);
        teacherIds.push(existTeacher.data[0]._id);
      } else {
        const teacherResult = await db.collection('teachers').add({
          userId: userId,
          ...data,
          createTime: Date.now(),
          updateTime: Date.now()
        });
        console.log(`创建教师 ${mockUsers[userIndex].nickname}，ID: ${teacherResult.id}`);
        teacherIds.push(teacherResult.id);
      }
    }

    response.data = {
      userIds,
      teacherIds,
      message: `成功创建 ${userIds.length} 个用户和 ${teacherIds.length} 个教师`
    };
    response.message = '模拟数据初始化成功';

    console.log('模拟数据初始化完成！');

  } catch (error) {
    console.error('初始化失败：', error);
    response.code = 500;
    response.message = error.message || '初始化失败';
  }

  return response;
}

// 清空模拟数据
async function clearMockData() {
  const response = {
    code: 0,
    message: '操作成功',
    data: null
  };

  try {
    console.log('开始清空模拟数据...');

    // 删除模拟用户
    const deleteUsersResult = await db.collection('users').where({
      openid: db.command.startsWith('mock_openid_teacher_')
    }).remove();

    console.log(`删除了 ${deleteUsersResult.deleted} 个模拟用户`);

    response.message = `清空完成，删除了 ${deleteUsersResult.deleted} 个用户及关联的教师数据`;

  } catch (error) {
    console.error('清空失败：', error);
    response.code = 500;
    response.message = error.message || '清空失败';
  }

  return response;
}

