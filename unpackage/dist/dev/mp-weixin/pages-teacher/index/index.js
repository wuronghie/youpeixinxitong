"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_appPushMixin = require("../../utils/appPushMixin.js");
const utils_chatPush = require("../../utils/chatPush.js");
const TeacherTabBar = () => "../components/TeacherTabBar.js";
const defaultAvatar = utils_imageConfig.getDefaultAvatarUrl();
const _sfc_main = {
  name: "TeacherDashboard",
  mixins: [utils_appPushMixin.createAppPushMixin([utils_chatPush.APP_PUSH_TYPES.APPOINTMENT_UPDATE, utils_chatPush.APP_PUSH_TYPES.SYSTEM_MESSAGE])],
  components: {
    TeacherTabBar
  },
  data() {
    return {
      // 教师资料信息
      profile: {
        display_name: "",
        // 显示名称
        avatar: "",
        // 头像URL
        title: "",
        // 职称/头衔
        subjects: []
        // 擅长科目数组
      },
      // 统计数据
      stats: {
        todayAppointments: 0,
        // 今日预约数
        monthIncome: 0,
        // 本月收入（元）
        totalStudents: 0,
        // 累计学生数
        upcoming3Days: 0,
        // 未来3天预约数
        upcoming7Days: 0,
        // 未来7天预约数
        needClockIn: 0,
        // 待上课打卡数量
        needClockOut: 0
        // 待下课打卡数量
      },
      // 待处理预约列表（需要教师确认或处理的预约）
      pendingAppointments: [],
      // 是否使用模拟数据（开发测试用）
      useMock: false,
      // 是否正在加载
      loading: false,
      _reloadQueued: false,
      // 默认头像路径
      defaultAvatar,
      // 信息完善状态
      profileComplete: {
        isComplete: true,
        missingFields: [],
        missingFieldsText: []
      }
    };
  },
  computed: {
    greetText() {
      const hour = (/* @__PURE__ */ new Date()).getHours();
      if (hour < 12)
        return "上午好";
      if (hour < 18)
        return "下午好";
      return "晚上好";
    },
    /**
     * 统计项配置
     * 功能：将统计数据转换为显示配置
     * 修改提示：
     *   - 添加新统计项：在数组中添加新对象
     *   - 修改图标：修改 icon 字段（使用 iconfont 类名）
     *   - 修改标签：修改 label 字段
     */
    statItems() {
      return [
        {
          label: "今日预约",
          value: this.stats.todayAppointments || 0,
          icon: utils_imageConfig.getIconUrl("calendar.png")
        },
        {
          label: "累计学生",
          value: this.stats.totalStudents || 0,
          icon: utils_imageConfig.getIconUrl("users.png")
        },
        {
          label: "未来3天",
          value: this.stats.upcoming3Days || 0,
          icon: utils_imageConfig.getIconUrl("calendar.png")
        }
      ];
    },
    /**
     * 快捷功能配置
     * 功能：定义工作台快捷功能入口
     * 修改提示：
     *   - 添加新功能：在数组中添加新对象
     *   - 修改路径：修改 path 字段
     *   - 修改图标：修改 icon 字段
     */
    quickActions() {
      return [
        {
          label: "完善资料",
          path: "/pages-teacher/profile/edit",
          icon: utils_imageConfig.getIconUrl("edit.png")
        },
        // 时间设置功能暂未就绪，入口先隐藏
        // {
        // 	label: '时间设置',
        // 	path: '/pages-teacher/profile/schedule',
        // 	icon: getIconUrl('clock.png')
        // },
        {
          label: "我的课酬",
          path: "/pages-teacher/wallet/index",
          icon: utils_imageConfig.getIconUrl("wallet.png")
        },
        {
          label: "评价管理",
          path: "/pages-teacher/review/list",
          icon: utils_imageConfig.getIconUrl("star.png")
        },
        {
          label: "招募广场",
          path: "/pages-teacher/recruitment/list",
          icon: utils_imageConfig.getRecruitmentIconUrl()
        },
        {
          label: "家长沟通",
          path: "/pages-teacher/chat/list",
          icon: utils_imageConfig.getIconUrl("chat.png")
        },
        {
          label: "查看日程",
          path: "/pages-teacher/appointment/calendar",
          icon: utils_imageConfig.getIconUrl("calendar.png")
        }
      ];
    }
  },
  /**
   * 页面加载时触发
   * 功能：初始化模拟数据开关，加载工作台数据
   */
  onLoad() {
    common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:247", "[首页] onLoad 被调用");
    this.useMock = utils_mockData.useMockData() === true;
    common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:249", "[首页] useMock:", this.useMock);
    this.loadData();
    common_vendor.index.$on("teacher-profile-updated", () => {
      common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:253", "[dashboard] 收到资料更新通知，刷新数据");
      this.loadData();
    });
  },
  /**
   * 页面显示时触发
   * 功能：每次显示页面时重新加载数据（确保数据最新）
   */
  onShow() {
    common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:262", "[首页] ========== onShow 被调用 ==========");
    this.loadData();
  },
  onShareAppMessage() {
    return {
      title: "优培信息通 · 教师工作台",
      path: "/pages-teacher/index/index"
    };
  },
  onShareTimeline() {
    return {
      title: "优培信息通 · 教师工作台"
    };
  },
  /**
   * 页面卸载时触发
   * 功能：清理事件监听
   */
  onUnload() {
    common_vendor.index.$off("teacher-profile-updated");
  },
  methods: {
    async refreshData() {
      await this.loadData(true);
    },
    onAppPushPayload() {
      this.loadData();
    },
    /**
     * 加载工作台数据
     * @param {Boolean} fromPullDown - 是否来自下拉刷新
     * 功能：
     *   1. 加载教师资料信息
     *   2. 加载统计数据（今日预约、本月收入、总学生数等）
     *   3. 加载待处理预约列表
     * 
     * 修改提示：
     *   - 添加新的数据加载：在 Promise.all 中添加新的数据加载方法
     *   - 修改数据来源：修改云函数调用
     */
    async loadData(fromPullDown = false) {
      common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:304", "[首页] loadData 被调用, fromPullDown:", fromPullDown, "loading:", this.loading);
      if (this.loading) {
        this._reloadQueued = true;
        common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:307", "[首页] 正在加载中，排队刷新");
        return;
      }
      this.loading = true;
      this._reloadQueued = false;
      common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:312", "[首页] 开始加载数据...");
      try {
        if (this.useMock) {
          common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:315", "[首页] 使用模拟数据");
          await new Promise((resolve) => setTimeout(resolve, 200));
          this.profile = {
            display_name: "张老师",
            title: "资深数学教师",
            subjects: ["数学", "物理"],
            avatar: ""
          };
          this.stats = {
            todayAppointments: 3,
            monthIncome: 2800,
            totalStudents: 12,
            upcoming3Days: 4,
            upcoming7Days: 7,
            needClockIn: 1,
            needClockOut: 0
          };
          this.pendingAppointments = utils_mockData.mockAppointments.filter((apt) => apt.status === "pending_confirm" || apt.status === "pending_payment").slice(0, 5).map((apt) => {
            var _a;
            return {
              _id: apt._id,
              appointment_date: apt.appointment_date,
              appointment_time: apt.appointment_time,
              student_name: ((_a = apt.student_info) == null ? void 0 : _a.name) || "学生",
              subject: apt.subject,
              status: apt.status
            };
          });
          return;
        }
        const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
        common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:347", "[首页] 用户信息:", {
          hasUid: !!userInfo.uid,
          role: userInfo.role,
          uid: userInfo.uid
        });
        if (!userInfo.uid || userInfo.role !== "teacher") {
          common_vendor.index.__f__("warn", "at pages-teacher/index/index.vue:354", "[首页] 用户未登录或不是教师角色");
          common_vendor.index.showToast({ title: "请先以教师身份登录", icon: "none" });
          return;
        }
        const dashboard = common_vendor.tr.importObject("teacher-dashboard", { customUI: true });
        common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:361", "[首页] 开始检查教师信息完善状态...");
        common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:362", "[首页] 调用 dashboard.checkProfileComplete()...");
        const [overviewRes, profileCheckRes] = await Promise.all([
          dashboard.getOverview(),
          dashboard.checkProfileComplete()
        ]);
        common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:370", "[首页] 检查结果:", {
          overviewCode: overviewRes.code,
          overviewMessage: overviewRes.message,
          checkCode: profileCheckRes.code,
          checkMessage: profileCheckRes.message,
          checkData: profileCheckRes.data
        });
        if (overviewRes.code === 0) {
          this.profile = overviewRes.data.profile || this.profile;
          this.stats = Object.assign({}, this.stats, overviewRes.data.stats || {});
          this.pendingAppointments = overviewRes.data.pendingAppointments || [];
        } else {
          common_vendor.index.showToast({ title: overviewRes.message || "加载失败", icon: "none" });
        }
        if (profileCheckRes.code === 0) {
          this.profileComplete = {
            isComplete: profileCheckRes.data.isComplete || false,
            missingFields: profileCheckRes.data.missingFields || [],
            missingFieldsText: profileCheckRes.data.missingFieldsText || []
          };
          if (!this.profileComplete.isComplete) {
            common_vendor.index.__f__("warn", "at pages-teacher/index/index.vue:396", "========================================");
            common_vendor.index.__f__("warn", "at pages-teacher/index/index.vue:397", "[首页] ⚠️ 教师信息未完善");
            common_vendor.index.__f__("warn", "at pages-teacher/index/index.vue:398", "缺失的字段:", this.profileComplete.missingFieldsText.join("、"));
            common_vendor.index.__f__("warn", "at pages-teacher/index/index.vue:399", "缺失字段数量:", this.profileComplete.missingFields.length);
            common_vendor.index.__f__("warn", "at pages-teacher/index/index.vue:400", "请前往编辑页面完善以下信息:");
            this.profileComplete.missingFieldsText.forEach((field, index) => {
              common_vendor.index.__f__("warn", "at pages-teacher/index/index.vue:402", `  ${index + 1}. ${field}`);
            });
            common_vendor.index.__f__("warn", "at pages-teacher/index/index.vue:404", "========================================");
          } else {
            common_vendor.index.__f__("log", "at pages-teacher/index/index.vue:406", "[首页] ✓ 教师信息已完善");
          }
        } else {
          common_vendor.index.__f__("warn", "at pages-teacher/index/index.vue:409", "[首页] 检查信息完善状态失败:", profileCheckRes.message);
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/index/index.vue:412", "教师工作台加载失败:", error);
        common_vendor.index.showToast({ title: "加载失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
        if (fromPullDown) {
          common_vendor.index.stopPullDownRefresh();
        }
        if (this._reloadQueued) {
          this._reloadQueued = false;
          this.loadData();
        }
      }
    },
    /**
     * 格式化金额
     * @param {Number|String} amount - 金额
     * @returns {String} 格式化后的金额字符串（保留2位小数）
     */
    formatCurrency(amount) {
      const num = Number(amount || 0);
      return num.toFixed(2);
    },
    /**
     * 格式化状态文字
     * @param {String} status - 状态值
     * @returns {String} 状态中文描述
     * 修改提示：可以在这里添加更多状态的映射
     */
    formatStatus(status) {
      const map = {
        pending_payment: "待支付",
        pending_confirm: "待确认",
        confirmed: "已确认",
        in_progress: "进行中",
        completed: "已完成",
        cancelled: "已取消",
        rejected: "已拒绝"
      };
      return map[status] || "未定义";
    },
    /**
     * 获取状态对应的样式类
     * @param {String} status - 状态值
     * @returns {String} CSS类名（将下划线替换为横线）
     */
    statusClass(status) {
      return status ? status.replace(/_/g, "-") : "";
    },
    /**
     * 跳转到预约列表页
     * 功能：导航到预约管理页面查看所有预约
     */
    goToAppointments() {
      common_vendor.index.navigateTo({ url: "/pages-teacher/appointment/list" });
    },
    /**
     * 跳转到完善资料页面
     */
    goToEditProfile() {
      common_vendor.index.navigateTo({ url: "/pages-teacher/profile/edit" });
    },
    /**
     * 跳转到预约详情页
     * @param {String} id - 预约ID
     * 功能：导航到预约详情页面查看详细信息
     */
    goToAppointmentDetail(id) {
      common_vendor.index.navigateTo({ url: `/pages-teacher/appointment/detail?id=${id}` });
    },
    /**
     * 通用页面跳转方法
     * @param {String} url - 目标页面路径
     * 修改提示：可以在这里添加跳转前的验证逻辑
     */
    goToPage(url) {
      if (!url)
        return;
      common_vendor.index.navigateTo({ url });
    }
  }
};
if (!Array) {
  const _component_TeacherTabBar = common_vendor.resolveComponent("TeacherTabBar");
  _component_TeacherTabBar();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($options.greetText),
    b: common_vendor.t($data.profile.display_name || "教师"),
    c: common_vendor.t($options.formatCurrency($data.stats.monthIncome)),
    d: common_vendor.o(($event) => $options.goToPage("/pages-teacher/wallet/index")),
    e: common_vendor.f($options.statItems, (item, index, i0) => {
      return {
        a: common_vendor.t(item.value),
        b: common_vendor.t(item.label),
        c: index
      };
    }),
    f: ($data.stats.needClockIn || 0) + ($data.stats.needClockOut || 0) > 0
  }, ($data.stats.needClockIn || 0) + ($data.stats.needClockOut || 0) > 0 ? common_vendor.e({
    g: $data.stats.needClockIn
  }, $data.stats.needClockIn ? {
    h: common_vendor.t($data.stats.needClockIn)
  } : {}, {
    i: $data.stats.needClockIn && $data.stats.needClockOut
  }, $data.stats.needClockIn && $data.stats.needClockOut ? {} : {}, {
    j: $data.stats.needClockOut
  }, $data.stats.needClockOut ? {
    k: common_vendor.t($data.stats.needClockOut)
  } : {}, {
    l: common_vendor.o((...args) => $options.goToAppointments && $options.goToAppointments(...args))
  }) : {}, {
    m: common_vendor.o((...args) => $options.goToAppointments && $options.goToAppointments(...args)),
    n: $data.pendingAppointments.length
  }, $data.pendingAppointments.length ? {
    o: common_vendor.f($data.pendingAppointments, (apt, k0, i0) => {
      return {
        a: common_vendor.t(apt.student_name || "学生"),
        b: common_vendor.t(apt.subject || "未填写科目"),
        c: common_vendor.t(apt.appointment_date || "--"),
        d: common_vendor.t(apt.appointment_time || "--:--"),
        e: common_vendor.t($options.formatStatus(apt.status)),
        f: common_vendor.n($options.statusClass(apt.status)),
        g: apt._id,
        h: common_vendor.o(($event) => $options.goToAppointmentDetail(apt._id), apt._id)
      };
    })
  } : {}, {
    p: common_vendor.f($options.quickActions, (item, index, i0) => {
      return {
        a: item.icon,
        b: common_vendor.t(item.label),
        c: index,
        d: common_vendor.o(($event) => $options.goToPage(item.path), index)
      };
    }),
    q: common_vendor.p({
      current: "dashboard"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-8346769d"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/index/index.js.map
