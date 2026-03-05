'use strict';

const { success, error, paramError, handlePagination, formatPageResult } = require('common');

/**
 * 教师高级搜索云函数
 * 功能：支持多条件组合查询，包括科目、年级、地区、评分、时薪、教龄等筛选
 */
exports.main = async (event, context) => {
  const { 
    // 基础搜索条件
    keyword,           // 关键词搜索
    subjects,          // 科目筛选（数组）
    grades,            // 年级筛选（数组）
    education,         // 学历筛选
    regions,           // 地区筛选（数组）
    
    // 评分和价格筛选
    minRating,         // 最低评分
    maxRating,         // 最高评分
    minHourlyRate,     // 最低时薪
    maxHourlyRate,     // 最高时薪
    
    // 教龄筛选
    minTeachingAge,    // 最低教龄
    maxTeachingAge,    // 最高教龄
    
    // 其他筛选条件
    gender,            // 性别筛选
    isRecommended,     // 是否推荐
    hasCertificates,   // 是否有证书
    isOnline,          // 是否在线
    
    // 排序和分页
    sortBy,            // 排序字段
    sortOrder,         // 排序方向
    page,              // 页码
    pageSize           // 每页数量
  } = event;

  const db = uniCloud.database();
  const dbCmd = db.command;

  try {
    // 1. 处理分页参数
    const { page: currentPage, pageSize: currentPageSize, skip } = handlePagination(page, pageSize);

    // 2. 构建查询条件
    const whereCondition = {
      status: 'approved'  // 只查询已审核的教师
    };

    // 关键词搜索（支持教师姓名、学校、专业、介绍等）
    if (keyword && keyword.trim()) {
      const keywordTrim = keyword.trim();
      whereCondition[dbCmd.or] = [
        { introduction: new RegExp(keywordTrim, 'i') },
        { school: new RegExp(keywordTrim, 'i') },
        { major: new RegExp(keywordTrim, 'i') }
      ];
    }

    // 科目筛选（支持多选）
    if (subjects && subjects.length > 0) {
      whereCondition.subjects = dbCmd.in(subjects);
    }

    // 年级筛选（支持多选）
    if (grades && grades.length > 0) {
      whereCondition.grades = dbCmd.in(grades);
    }

    // 学历筛选
    if (education) {
      whereCondition.education = education;
    }

    // 地区筛选（支持多选）
    if (regions && regions.length > 0) {
      whereCondition.region = dbCmd.in(regions);
    }

    // 评分范围筛选
    if (minRating !== undefined || maxRating !== undefined) {
      whereCondition.rating = {};
      if (minRating !== undefined) {
        whereCondition.rating[dbCmd.gte] = minRating;
      }
      if (maxRating !== undefined) {
        whereCondition.rating[dbCmd.lte] = maxRating;
      }
    }

    // 时薪范围筛选
    if (minHourlyRate !== undefined || maxHourlyRate !== undefined) {
      whereCondition.hourlyRate = {};
      if (minHourlyRate !== undefined) {
        whereCondition.hourlyRate[dbCmd.gte] = minHourlyRate;
      }
      if (maxHourlyRate !== undefined) {
        whereCondition.hourlyRate[dbCmd.lte] = maxHourlyRate;
      }
    }

    // 教龄范围筛选
    if (minTeachingAge !== undefined || maxTeachingAge !== undefined) {
      whereCondition.teachingAge = {};
      if (minTeachingAge !== undefined) {
        whereCondition.teachingAge[dbCmd.gte] = minTeachingAge;
      }
      if (maxTeachingAge !== undefined) {
        whereCondition.teachingAge[dbCmd.lte] = maxTeachingAge;
      }
    }

    // 性别筛选
    if (gender) {
      whereCondition.gender = gender;
    }

    // 推荐筛选
    if (isRecommended !== undefined) {
      whereCondition.isRecommended = isRecommended;
    }

    // 证书筛选
    if (hasCertificates !== undefined) {
      if (hasCertificates) {
        whereCondition.certificates = dbCmd.neq([]);
      } else {
        whereCondition.certificates = dbCmd.eq([]);
      }
    }

    // 在线状态筛选
    if (isOnline !== undefined) {
      whereCondition.isOnline = isOnline;
    }

    // 3. 构建排序条件
    const sortCondition = {};
    const validSortFields = ['rating', 'hourlyRate', 'reviewCount', 'orderCount', 'teachingAge', 'createTime'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'rating';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    sortCondition[sortField] = sortDirection;

    // 4. 查询教师列表
    const teachersQuery = await db.collection('teachers')
      .where(whereCondition)
      .field({
        _id: true,
        userId: true,
        education: true,
        school: true,
        major: true,
        teachingAge: true,
        subjects: true,
        grades: true,
        region: true,
        introduction: true,
        hourlyRate: true,
        rating: true,
        reviewCount: true,
        orderCount: true,
        tags: true,
        isRecommended: true,
        teachingPhotos: true,
        certificates: true,
        isOnline: true,
        createTime: true
      })
      .orderBy(sortCondition)
      .skip(skip)
      .limit(currentPageSize)
      .get();

    // 5. 获取总数
    const countQuery = await db.collection('teachers')
      .where(whereCondition)
      .count();

    // 6. 获取关联的用户信息
    const teachers = teachersQuery.data;
    let users = [];
    
    if (teachers.length > 0) {
      const userIds = [...new Set(teachers.map(teacher => teacher.userId))];
      const usersQuery = await db.collection('users')
        .where({
          _id: dbCmd.in(userIds)
        })
        .field({
          _id: true,
          nickname: true,
          avatar: true,
          gender: true,
          userType: true
        })
        .get();
      users = usersQuery.data;
    }

    // 7. 组装返回数据
    const teacherList = teachers.map(teacher => {
      const user = users.find(u => u._id === teacher.userId);
      return {
        _id: teacher._id,
        userId: teacher.userId,
        nickname: user?.nickname || '未知用户',
        avatar: user?.avatar || '',
        gender: user?.gender || 'unknown',
        education: teacher.education,
        school: teacher.school,
        major: teacher.major,
        teachingAge: teacher.teachingAge,
        subjects: teacher.subjects || [],
        grades: teacher.grades || [],
        region: teacher.region,
        introduction: teacher.introduction,
        hourlyRate: teacher.hourlyRate,
        rating: teacher.rating || 0,
        reviewCount: teacher.reviewCount || 0,
        orderCount: teacher.orderCount || 0,
        tags: teacher.tags || [],
        isRecommended: teacher.isRecommended || false,
        teachingPhotos: teacher.teachingPhotos || [],
        certificates: teacher.certificates || [],
        isOnline: teacher.isOnline || false,
        createTime: teacher.createTime
      };
    });

    // 8. 计算筛选统计信息
    const stats = await calculateSearchStats(db, whereCondition);

    return success({
      list: teacherList,
      total: countQuery.total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(countQuery.total / currentPageSize),
      stats
    });

  } catch (err) {
    console.error('高级搜索失败：', err);
    return error('搜索失败，请稍后重试');
  }
};

/**
 * 计算搜索统计信息
 * @param {Object} db - 数据库实例
 * @param {Object} whereCondition - 查询条件
 */
async function calculateSearchStats(db, whereCondition) {
  try {
    // 获取基础统计
    const statsQuery = await db.collection('teachers')
      .where(whereCondition)
      .field({
        rating: true,
        hourlyRate: true,
        teachingAge: true,
        subjects: true,
        grades: true,
        region: true,
        education: true
      })
      .get();

    const teachers = statsQuery.data;
    const total = teachers.length;

    if (total === 0) {
      return {
        total: 0,
        averageRating: 0,
        averageHourlyRate: 0,
        averageTeachingAge: 0,
        subjectDistribution: {},
        gradeDistribution: {},
        regionDistribution: {},
        educationDistribution: {}
      };
    }

    // 计算平均评分
    const totalRating = teachers.reduce((sum, teacher) => sum + (teacher.rating || 0), 0);
    const averageRating = totalRating / total;

    // 计算平均时薪
    const totalHourlyRate = teachers.reduce((sum, teacher) => sum + (teacher.hourlyRate || 0), 0);
    const averageHourlyRate = totalHourlyRate / total;

    // 计算平均教龄
    const totalTeachingAge = teachers.reduce((sum, teacher) => sum + (teacher.teachingAge || 0), 0);
    const averageTeachingAge = totalTeachingAge / total;

    // 计算科目分布
    const subjectDistribution = {};
    teachers.forEach(teacher => {
      (teacher.subjects || []).forEach(subject => {
        subjectDistribution[subject] = (subjectDistribution[subject] || 0) + 1;
      });
    });

    // 计算年级分布
    const gradeDistribution = {};
    teachers.forEach(teacher => {
      (teacher.grades || []).forEach(grade => {
        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
      });
    });

    // 计算地区分布
    const regionDistribution = {};
    teachers.forEach(teacher => {
      if (teacher.region) {
        regionDistribution[teacher.region] = (regionDistribution[teacher.region] || 0) + 1;
      }
    });

    // 计算学历分布
    const educationDistribution = {};
    teachers.forEach(teacher => {
      if (teacher.education) {
        educationDistribution[teacher.education] = (educationDistribution[teacher.education] || 0) + 1;
      }
    });

    return {
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      averageHourlyRate: Math.round(averageHourlyRate),
      averageTeachingAge: Math.round(averageTeachingAge * 10) / 10,
      subjectDistribution,
      gradeDistribution,
      regionDistribution,
      educationDistribution
    };

  } catch (err) {
    console.error('计算搜索统计失败：', err);
    return null;
  }
}
