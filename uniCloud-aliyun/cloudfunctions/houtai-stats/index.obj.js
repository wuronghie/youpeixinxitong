'use strict';

/**
 * 后台管理统计云对象
 * 专为 houtai 管理端提供业务数据聚合接口
 *
 * 数据来源：
 *   - uni-id-users：用户注册/登录/角色
 *   - teacher-profiles：教师资料与审核状态
 *   - parent-recruitments：家长招募审核状态
 *   - payment-orders：支付订单金额与数量
 *
 * 权限：仅限后台管理员（role 包含 admin 或具备 READ_UNI_ID_USERS 权限）调用
 */

const uniID = require('uni-id-common');

const db = uniCloud.database();
const dbCmd = db.command;
const $ = dbCmd.aggregate;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfDaysAgo(days) {
  return startOfToday() - days * DAY_MS;
}

function toDateStr(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function success(data = null, message = 'ok') {
  return { code: 0, message, data };
}

function fail(message = '操作失败', code = -1) {
  return { code, message, data: null };
}

/**
 * 鉴权：必须是后台管理员（role 包含 admin）才允许访问
 * 注意：不能用 _ 前缀的方法放在 module.exports 里，否则云对象 this 访问不到
 */
async function assertAdmin(ctx) {
  const token = ctx.getUniIdToken();
  if (!token) {
    throw new Error('未登录');
  }
  const payload = await ctx.uniID.checkToken(token);
  if (payload.code) {
    throw new Error(payload.message || 'token 无效');
  }
  const uid = payload.uid;
  if (!uid) {
    throw new Error('未登录');
  }
  const userRes = await db.collection('uni-id-users').doc(uid).field({ _id: true, role: true }).get();
  const userData = (userRes.data && userRes.data[0]) || (userRes.result && userRes.result.data && userRes.result.data[0]);
  if (!userData) {
    throw new Error('用户不存在');
  }
  const roles = Array.isArray(userData.role) ? userData.role : (userData.role ? [userData.role] : []);
  const isAdmin = roles.some(r => {
    if (typeof r === 'string') {
      return r === 'admin';
    }
    return false;
  });
  if (!isAdmin) {
    throw new Error('无权限访问后台统计');
  }
  return uid;
}

module.exports = {
  _before: function () {
    const clientInfo = this.getClientInfo();
    this.uniID = uniID.createInstance({ clientInfo });
  },

  /**
   * 首页仪表盘所需的核心指标
   * 返回：累计用户/今日新增/今日活跃/待审核教师/待审核招募/今日订单/今日成交金额/在线教师，以及
   * 已通过审核教师男女人数、在招且已审核通过招募中孩子男女人数
   */
  async getDashboardMetrics() {
    try {
      await assertAdmin(this);

      const today = startOfToday();
      const tomorrow = today + DAY_MS;

      const [
        totalUsersRes,
        todayNewUsersRes,
        todayActiveRes,
        pendingTeacherRes,
        pendingRecruitmentRes,
        todayOrderCountRes,
        todayOrderAmountRes,
        onlineTeacherRes,
        teacherMaleRes,
        teacherFemaleRes,
        recruitmentMaleRes,
        recruitmentFemaleRes
      ] = await Promise.all([
        db.collection('uni-id-users').where({}).count(),
        db.collection('uni-id-users').where({
          register_date: dbCmd.gte(today).and(dbCmd.lt(tomorrow))
        }).count(),
        db.collection('uni-id-users').where({
          last_login_date: dbCmd.gte(today).and(dbCmd.lt(tomorrow))
        }).count(),
        db.collection('teacher-profiles').where({
          audit_status: 'pending'
        }).count(),
        db.collection('parent-recruitments').where({
          audit_status: 'pending',
          status: 'open'
        }).count(),
        db.collection('payment-orders').where({
          create_time: dbCmd.gte(today).and(dbCmd.lt(tomorrow))
        }).count(),
        db.collection('payment-orders').aggregate()
          .match({
            create_time: dbCmd.gte(today).and(dbCmd.lt(tomorrow)),
            status: dbCmd.in(['paid', 'completed', 'success'])
          })
          .group({ _id: null, total: $.sum('$amount') })
          .end(),
        db.collection('teacher-profiles').where({
          audit_status: 'approved',
          available: true
        }).count(),
        // 已审核通过教师，按性别
        db.collection('teacher-profiles').where({ audit_status: 'approved', gender: 'male' }).count(),
        db.collection('teacher-profiles').where({ audit_status: 'approved', gender: 'female' }).count(),
        // 在招且已通过审核的招募，按孩子性别
        db.collection('parent-recruitments').where({
          status: 'open',
          audit_status: 'approved',
          student_gender: 'male'
        }).count(),
        db.collection('parent-recruitments').where({
          status: 'open',
          audit_status: 'approved',
          student_gender: 'female'
        }).count()
      ]);

      const todayOrderAmount = (todayOrderAmountRes.data && todayOrderAmountRes.data[0] && todayOrderAmountRes.data[0].total) || 0;

      // 打卡 KPI 全平台聚合
      //   needClockIn:    confirmed/in_progress + 已支付信息费 + 还没上课打卡
      //   needClockOut:   in_progress + 已支付信息费 + 已上课打卡 + 还没下课打卡
      //   overdueClockOut: 排课结束时间已过 24 小时但仍没下课打卡（异常情况，需要管理员关注）
      const overdueDeadline = Date.now() - 24 * 3600 * 1000
      const overdueDateStr = toDateStr(overdueDeadline)
      const [needClockInRes, needClockOutRes, overdueClockOutRes] = await Promise.all([
        db.collection('appointments').where({
          status: dbCmd.in(['confirmed', 'in_progress']),
          deposit_paid: true,
          class_started_at: dbCmd.exists(false)
        }).count(),
        db.collection('appointments').where({
          status: 'in_progress',
          deposit_paid: true,
          class_started_at: dbCmd.exists(true),
          class_ended_at: dbCmd.exists(false)
        }).count(),
        db.collection('appointments').where({
          status: 'in_progress',
          deposit_paid: true,
          class_started_at: dbCmd.exists(true),
          class_ended_at: dbCmd.exists(false),
          date: dbCmd.lte(overdueDateStr)
        }).count()
      ]);

      return success({
        totalUsers: totalUsersRes.total || 0,
        todayNewUsers: todayNewUsersRes.total || 0,
        todayActiveUsers: todayActiveRes.total || 0,
        pendingTeacherCount: pendingTeacherRes.total || 0,
        pendingRecruitmentCount: pendingRecruitmentRes.total || 0,
        todayOrderCount: todayOrderCountRes.total || 0,
        todayOrderAmount,
        onlineTeacherCount: onlineTeacherRes.total || 0,
        teacherMaleCount: teacherMaleRes.total || 0,
        teacherFemaleCount: teacherFemaleRes.total || 0,
        studentRecruitmentMaleCount: recruitmentMaleRes.total || 0,
        studentRecruitmentFemaleCount: recruitmentFemaleRes.total || 0,
        needClockInCount: needClockInRes.total || 0,
        needClockOutCount: needClockOutRes.total || 0,
        overdueClockOutCount: overdueClockOutRes.total || 0
      });
    } catch (e) {
      return fail(e.message || '获取仪表盘数据失败');
    }
  },

  /**
   * 近 N 天每日趋势，用于首页/统计页折线图
   * @param {number} days 天数（默认 30），最大 90
   */
  async getDailyTrend({ days = 30 } = {}) {
    try {
      await assertAdmin(this);

      days = Math.max(1, Math.min(Number(days) || 30, 90));
      const startTs = startOfDaysAgo(days - 1);
      const endTs = startOfToday() + DAY_MS;

      const [newUsersRaw, activeUsersRaw, rolesAllRes] = await Promise.all([
        db.collection('uni-id-users')
          .where({ register_date: dbCmd.gte(startTs).and(dbCmd.lt(endTs)) })
          .field({ _id: true, register_date: true, role: true, parent_info: true })
          .limit(10000)
          .get(),
        db.collection('uni-id-users')
          .where({ last_login_date: dbCmd.gte(startTs).and(dbCmd.lt(endTs)) })
          .field({ _id: true, last_login_date: true })
          .limit(10000)
          .get(),
        db.collection('uni-id-roles').field({ role_id: true, role_name: true }).limit(100).get()
      ]);

      const roleNameMap = {};
      ((rolesAllRes.data) || (rolesAllRes.result && rolesAllRes.result.data) || []).forEach(r => {
        roleNameMap[r.role_id] = r.role_name || '';
      });

      const newUsers = newUsersRaw.data || (newUsersRaw.result && newUsersRaw.result.data) || [];
      const activeUsers = activeUsersRaw.data || (activeUsersRaw.result && activeUsersRaw.result.data) || [];

      const dayBucket = {};
      for (let i = 0; i < days; i++) {
        const ts = startOfDaysAgo(days - 1 - i);
        dayBucket[toDateStr(ts)] = {
          date: toDateStr(ts),
          newUsers: 0,
          activeUsers: 0,
          newParents: 0,
          newTeachers: 0,
          newAdmins: 0
        };
      }

      const isParentUser = (u) => {
        const roles = Array.isArray(u.role) ? u.role : [];
        const hasParentRole = roles.some(r => typeof r === 'string' && (r === 'parent' || r.includes('家长')));
        if (hasParentRole) return true;
        return !!(u.parent_info && u.parent_info.real_name);
      };
      const isAdminUser = (u) => {
        const roles = Array.isArray(u.role) ? u.role : [];
        return roles.some(r => typeof r === 'string' && (r === 'admin' || (roleNameMap[r] || '').includes('管理员')));
      };

      newUsers.forEach(u => {
        const key = toDateStr(u.register_date);
        if (!dayBucket[key]) return;
        dayBucket[key].newUsers += 1;
        if (isAdminUser(u)) {
          dayBucket[key].newAdmins += 1;
        } else if (isParentUser(u)) {
          dayBucket[key].newParents += 1;
        } else {
          dayBucket[key].newTeachers += 1;
        }
      });

      activeUsers.forEach(u => {
        const key = toDateStr(u.last_login_date);
        if (!dayBucket[key]) return;
        dayBucket[key].activeUsers += 1;
      });

      return success(Object.keys(dayBucket).sort().map(k => dayBucket[k]));
    } catch (e) {
      return fail(e.message || '获取趋势数据失败');
    }
  },

  /**
   * 指定时间区间的用户注册概览
   * @param {number} startTime 开始时间戳（毫秒，含）
   * @param {number} endTime 结束时间戳（毫秒，不含）
   */
  async getRegisterOverview({ startTime, endTime } = {}) {
    try {
      await assertAdmin(this);

      const end = endTime ? Number(endTime) : startOfToday() + DAY_MS;
      const start = startTime ? Number(startTime) : end - 30 * DAY_MS;
      if (end - start > 366 * DAY_MS) {
        return fail('查询区间过长，不得超过 366 天');
      }
      if (start >= end) {
        return fail('开始时间必须早于结束时间');
      }

      const rangeWhere = { register_date: dbCmd.gte(start).and(dbCmd.lt(end)) };

      const [totalRes, rangeRes, usersRaw, rolesAllRes, teacherMaleRes, teacherFemaleRes, recruitmentMaleRes, recruitmentFemaleRes] = await Promise.all([
        db.collection('uni-id-users').where({}).count(),
        db.collection('uni-id-users').where(rangeWhere).count(),
        db.collection('uni-id-users')
          .where(rangeWhere)
          .field({ _id: true, register_date: true, role: true, parent_info: true })
          .limit(10000)
          .get(),
        db.collection('uni-id-roles').field({ role_id: true, role_name: true }).limit(100).get(),
        db.collection('teacher-profiles').where({ audit_status: 'approved', gender: 'male' }).count(),
        db.collection('teacher-profiles').where({ audit_status: 'approved', gender: 'female' }).count(),
        db.collection('parent-recruitments').where({
          status: 'open',
          audit_status: 'approved',
          student_gender: 'male'
        }).count(),
        db.collection('parent-recruitments').where({
          status: 'open',
          audit_status: 'approved',
          student_gender: 'female'
        }).count()
      ]);

      const roleNameMap = {};
      ((rolesAllRes.data) || (rolesAllRes.result && rolesAllRes.result.data) || []).forEach(r => {
        roleNameMap[r.role_id] = r.role_name || '';
      });

      const users = usersRaw.data || (usersRaw.result && usersRaw.result.data) || [];
      let parentCount = 0, teacherCount = 0, adminCount = 0;

      users.forEach(u => {
        const roles = Array.isArray(u.role) ? u.role : [];
        const isAdmin = roles.some(r => typeof r === 'string' && (r === 'admin' || (roleNameMap[r] || '').includes('管理员')));
        if (isAdmin) { adminCount += 1; return; }
        const isParent = roles.some(r => typeof r === 'string' && (r === 'parent' || r.includes('家长'))) || !!(u.parent_info && u.parent_info.real_name);
        if (isParent) { parentCount += 1; return; }
        teacherCount += 1;
      });

      const days = Math.max(1, Math.round((end - start) / DAY_MS));
      const avgDaily = Math.round((rangeRes.total || 0) / days);

      return success({
        totalUsers: totalRes.total || 0,
        rangeNewUsers: rangeRes.total || 0,
        rangeParentUsers: parentCount,
        rangeTeacherUsers: teacherCount,
        rangeAdminUsers: adminCount,
        avgDailyNewUsers: avgDaily,
        startTime: start,
        endTime: end,
        days,
        teacherMaleCount: teacherMaleRes.total || 0,
        teacherFemaleCount: teacherFemaleRes.total || 0,
        studentRecruitmentMaleCount: recruitmentMaleRes.total || 0,
        studentRecruitmentFemaleCount: recruitmentFemaleRes.total || 0
      });
    } catch (e) {
      return fail(e.message || '获取注册概览失败');
    }
  },

  /**
   * 全局角色分布（不限时间）
   */
  async getRoleBreakdown() {
    try {
      await assertAdmin(this);

      const [usersRaw, rolesAllRes] = await Promise.all([
        db.collection('uni-id-users')
          .field({ _id: true, role: true, parent_info: true })
          .limit(20000)
          .get(),
        db.collection('uni-id-roles').field({ role_id: true, role_name: true }).limit(100).get()
      ]);

      const roleNameMap = {};
      ((rolesAllRes.data) || (rolesAllRes.result && rolesAllRes.result.data) || []).forEach(r => {
        roleNameMap[r.role_id] = r.role_name || '';
      });

      const users = usersRaw.data || (usersRaw.result && usersRaw.result.data) || [];
      let parentCount = 0, teacherCount = 0, adminCount = 0;
      users.forEach(u => {
        const roles = Array.isArray(u.role) ? u.role : [];
        const isAdmin = roles.some(r => typeof r === 'string' && (r === 'admin' || (roleNameMap[r] || '').includes('管理员')));
        if (isAdmin) { adminCount += 1; return; }
        const isParent = roles.some(r => typeof r === 'string' && (r === 'parent' || r.includes('家长'))) || !!(u.parent_info && u.parent_info.real_name);
        if (isParent) { parentCount += 1; return; }
        teacherCount += 1;
      });

      return success({
        total: users.length,
        parent: parentCount,
        teacher: teacherCount,
        admin: adminCount
      });
    } catch (e) {
      return fail(e.message || '获取角色分布失败');
    }
  },

  /**
   * 待办事项：待审核教师 + 待审核招募 TOP N
   * @param {number} limit 每类条数（默认 5）
   */
  async getPendingTasks({ limit = 5 } = {}) {
    try {
      await assertAdmin(this);

      limit = Math.max(1, Math.min(Number(limit) || 5, 20));

      const [teacherRes, recruitmentRes] = await Promise.all([
        db.collection('teacher-profiles')
          .where({ audit_status: 'pending' })
          .field({ _id: true, teacher_id: true, display_name: true, avatar: true, subjects: true, grades: true, create_date: true })
          .orderBy('create_date', 'desc')
          .limit(limit)
          .get(),
        db.collection('parent-recruitments')
          .where({ audit_status: 'pending', status: 'open' })
          .field({ _id: true, display_name: true, subject: true, student_grade: true, create_time: true })
          .orderBy('create_time', 'desc')
          .limit(limit)
          .get()
      ]);

      return success({
        pendingTeachers: teacherRes.data || (teacherRes.result && teacherRes.result.data) || [],
        pendingRecruitments: recruitmentRes.data || (recruitmentRes.result && recruitmentRes.result.data) || []
      });
    } catch (e) {
      return fail(e.message || '获取待办任务失败');
    }
  },

  /**
   * 列出当前动态菜单（opendb-admin-menus 表）
   * 返回根级分组（parent_id 为空），便于用户挑选需要禁用的
   */
  async listAdminMenus() {
    try {
      await assertAdmin(this);
      const res = await db.collection('opendb-admin-menus')
        .field({ _id: true, menu_id: true, name: true, parent_id: true, url: true, icon: true, sort: true, enable: true })
        .orderBy('sort', 'asc')
        .limit(500)
        .get();
      const list = res.data || (res.result && res.result.data) || [];
      const roots = list.filter(m => !m.parent_id);
      const childrenMap = {};
      list.forEach(m => {
        if (m.parent_id) {
          if (!childrenMap[m.parent_id]) childrenMap[m.parent_id] = [];
          childrenMap[m.parent_id].push(m);
        }
      });
      const result = roots.map(r => ({
        _id: r._id,
        menu_id: r.menu_id,
        name: r.name,
        enable: r.enable !== false,
        childrenCount: (childrenMap[r.menu_id] || []).length
      }));
      return success({ total: list.length, roots: result });
    } catch (e) {
      return fail(e.message || '获取动态菜单失败');
    }
  },

  /**
   * 批量禁用指定根菜单及其所有子项（非物理删除，可在菜单管理里恢复）
   * @param {Object} params
   * @param {string[]} params.rootMenuIds - 根菜单的 menu_id 数组
   */
  async disableAdminMenuTrees(params) {
    try {
      await assertAdmin(this);
      const rootIds = (params && params.rootMenuIds) || [];
      if (!Array.isArray(rootIds) || !rootIds.length) {
        return fail('rootMenuIds 不能为空');
      }
      // 查询所有菜单，以 menu_id 为 key 建立树（递归收集所有后代）
      const allRes = await db.collection('opendb-admin-menus')
        .field({ _id: true, menu_id: true, parent_id: true })
        .limit(500)
        .get();
      const all = allRes.data || (allRes.result && allRes.result.data) || [];
      const childrenMap = {};
      all.forEach(m => {
        if (!m.parent_id) return;
        if (!childrenMap[m.parent_id]) childrenMap[m.parent_id] = [];
        childrenMap[m.parent_id].push(m.menu_id);
      });
      const toDisable = new Set();
      function collect(menuId) {
        toDisable.add(menuId);
        (childrenMap[menuId] || []).forEach(collect);
      }
      rootIds.forEach(collect);
      if (!toDisable.size) {
        return success({ affected: 0 });
      }
      const updRes = await db.collection('opendb-admin-menus')
        .where({ menu_id: dbCmd.in(Array.from(toDisable)) })
        .update({ enable: false });
      return success({
        affected: updRes.updated || (updRes.result && updRes.result.updated) || 0,
        disabled: Array.from(toDisable)
      });
    } catch (e) {
      return fail(e.message || '禁用菜单失败');
    }
  }
};
