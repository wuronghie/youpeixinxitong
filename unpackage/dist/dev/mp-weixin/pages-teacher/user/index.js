"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_auth = require("../../utils/auth.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const card = () => "../../components/common/card.js";
const TeacherTabBar = () => "../../components/TeacherTabBar.js";
const _sfc_main = {
  name: "TeacherUserCenter",
  components: {
    card,
    TeacherTabBar
  },
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl(),
      userInfo: {
        displayName: "教师",
        nickname: "",
        avatar: "",
        phone: "",
        uid: "",
        role: "teacher"
      },
      teacherProfile: {
        title: ""
      },
      metrics: {
        totalStudents: 0,
        totalAppointments: 0,
        totalTrials: 0,
        successfulTrials: 0,
        totalIncome: "0.00",
        verificationStatus: "pending"
      },
      actionList: [
        {
          title: "工作台",
          icon: utils_imageConfig.getIconUrl("dashboard.png"),
          url: "/pages-teacher/index/index",
          type: "primary"
        },
        {
          title: "预约管理",
          icon: utils_imageConfig.getIconUrl("calendar.png"),
          url: "/pages-teacher/appointment/list",
          type: "accent"
        },
        {
          title: "完善资料",
          icon: utils_imageConfig.getIconUrl("edit.png"),
          url: "/pages-teacher/profile/edit",
          type: "accent"
        },
        {
          title: "课程日历",
          icon: utils_imageConfig.getIconUrl("calendar.png"),
          url: "/pages-teacher/appointment/calendar",
          type: "primary"
        }
      ],
      listMenus: [
        {
          title: "教师主页",
          desc: "展示个人介绍与课程信息",
          icon: utils_imageConfig.getIconUrl("user.png"),
          url: "/pages-teacher/profile/index"
        },
        {
          title: "我的钱包",
          desc: "查看余额与交易明细",
          icon: utils_imageConfig.getIconUrl("wallet.png"),
          url: "/pages-teacher/wallet/index"
        },
        {
          title: "评价管理",
          desc: "查看并回复家长评价",
          icon: utils_imageConfig.getIconUrl("star.png"),
          url: "/pages-teacher/review/list"
        },
        {
          title: "系统消息",
          desc: "查看平台通知和审核结果",
          icon: utils_imageConfig.getIconUrl("bell.png"),
          url: "/pages-teacher/user/messages"
        },
        {
          title: "消息中心",
          desc: "与家长实时沟通",
          icon: utils_imageConfig.getIconUrl("chat.png"),
          url: "/pages-teacher/chat/list"
        }
      ],
      statusTextMap: {
        pending: "待完善资料",
        verifying: "审核中",
        rejected: "审核未通过",
        verified: "已认证"
      },
      useMock: false,
      loading: false
    };
  },
  computed: {
    teacherStatusText() {
      const status = this.metrics.verificationStatus;
      return this.statusTextMap[status] || "";
    }
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    if (this.useMock) {
      this.loadData();
      return;
    }
    if (utils_auth.ensureLoggedIn("teacher")) {
      this.loadData();
    }
  },
  onShow() {
    if (this.useMock)
      return;
    if (!utils_auth.ensureLoggedIn("teacher")) {
      return;
    }
    this.loadData();
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/user/index.vue:268", "[teacher-user-center] 下拉刷新：重新加载个人中心");
      await this.loadUserInfo();
    },
    async loadData() {
      if (this.loading)
        return;
      this.loading = true;
      try {
        await Promise.all([this.loadUserInfo(), this.loadTeacherMetrics()]);
      } finally {
        this.loading = false;
      }
    },
    async loadUserInfo() {
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const stored = common_vendor.index.getStorageSync("userInfo") || utils_mockData.mockUserInfo;
          this.userInfo = this.formatUserInfo(stored);
          return;
        }
        const profileObj = common_vendor.tr.importObject("user-profile", { customUI: true });
        const res = await profileObj.getUserProfile();
        if (res.code === 0 && res.data) {
          const info = this.formatUserInfo(res.data);
          this.userInfo = info;
          utils_auth.setStoredUserInfo({
            ...common_vendor.index.getStorageSync("userInfo"),
            ...info,
            role: info.role || "teacher"
          });
        } else {
          common_vendor.index.showToast({ title: res.message || "获取用户信息失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/user/index.vue:303", "加载用户信息失败:", error);
        common_vendor.index.showToast({ title: "获取用户信息失败", icon: "none" });
      }
    },
    formatUserInfo(data) {
      var _a;
      const stored = common_vendor.index.getStorageSync("userInfo") || {};
      const nickname = data.nickname || data.wx_nickname || stored.nickname || stored.wx_nickname || "";
      const displayName = ((_a = data.teacher_info) == null ? void 0 : _a.real_name) || data.display_name || nickname || stored.displayName || "教师";
      return {
        displayName,
        nickname: nickname || displayName,
        // 如果昵称为空，使用显示名称
        avatar: data.avatar || data.wx_avatarUrl || stored.avatar || stored.wx_avatarUrl || "",
        phone: data.phone || stored.phone || "",
        uid: data._id || data.uid || stored.uid || stored._id || "",
        role: data.role || stored.role || "teacher"
      };
    },
    async loadTeacherMetrics() {
      var _a;
      try {
        if (this.useMock) {
          this.metrics = {
            totalStudents: 6,
            totalAppointments: 18,
            totalTrials: 12,
            successfulTrials: 8,
            totalIncome: "6580.00",
            verificationStatus: "verified"
          };
          this.teacherProfile = { title: "数学·物理辅导" };
          return;
        }
        const dashboardObj = common_vendor.tr.importObject("teacher-dashboard", { customUI: true });
        const res = await dashboardObj.getProfileDetail();
        if (res.code === 0 && res.data) {
          const { profile, metrics } = res.data;
          this.teacherProfile = profile || {};
          if (profile == null ? void 0 : profile.display_name) {
            this.userInfo.displayName = profile.display_name;
          }
          const hasQualificationImage = Array.isArray(profile == null ? void 0 : profile.qualifications) && profile.qualifications.some((item) => item && item.image);
          const isFullTimeTeacher = (profile == null ? void 0 : profile.school) === "专职老师";
          const gradesComplete = isFullTimeTeacher || (profile == null ? void 0 : profile.grades) && profile.grades.length > 0;
          const isProfileComplete = (profile == null ? void 0 : profile.display_name) && (profile == null ? void 0 : profile.subjects) && profile.subjects.length > 0 && gradesComplete && (profile == null ? void 0 : profile.hourly_rate) && profile.hourly_rate > 0 && Number(((_a = profile == null ? void 0 : profile.teaching_experience) == null ? void 0 : _a.years) || 0) > 0 && (profile == null ? void 0 : profile.introduction) && String(profile.introduction).trim() && hasQualificationImage;
          let verificationStatus = "pending";
          if (isProfileComplete || (profile == null ? void 0 : profile.is_verified)) {
            verificationStatus = "verified";
          } else if (profile == null ? void 0 : profile.verification_status) {
            verificationStatus = profile.verification_status;
          }
          this.metrics = {
            totalStudents: (metrics == null ? void 0 : metrics.totalStudents) ?? 0,
            totalAppointments: (metrics == null ? void 0 : metrics.totalAppointments) ?? 0,
            totalTrials: (metrics == null ? void 0 : metrics.totalTrials) ?? 0,
            successfulTrials: (metrics == null ? void 0 : metrics.successfulTrials) ?? 0,
            totalIncome: ((metrics == null ? void 0 : metrics.totalIncome) || 0).toFixed ? metrics.totalIncome.toFixed(2) : Number((metrics == null ? void 0 : metrics.totalIncome) || 0).toFixed(2),
            verificationStatus
          };
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/user/index.vue:377", "加载教师统计失败:", error);
      }
    },
    goToPage(url) {
      if (!url)
        return;
      common_vendor.index.navigateTo({ url });
    },
    handleLogout() {
      common_vendor.index.showModal({
        title: "提示",
        content: "确定要退出登录吗？",
        success: (res) => {
          if (res.confirm) {
            utils_auth.clearStoredAuth();
            common_vendor.index.reLaunch({ url: "/pages/login/index" });
          }
        }
      });
    },
    async handleDeleteAccount() {
      common_vendor.index.showModal({
        title: "注销账号",
        content: "注销账号后将删除所有数据且不可恢复，注销后可以重新注册并选择角色。确定要注销吗？",
        confirmText: "确定注销",
        cancelText: "取消",
        confirmColor: "#ff9500",
        success: async (res) => {
          if (res.confirm) {
            try {
              const userLogin = common_vendor.tr.importObject("user-login", { customUI: true });
              const result = await userLogin.deleteAccount();
              if (result.code === 0) {
                common_vendor.index.showToast({
                  title: "账号已注销",
                  icon: "success"
                });
                utils_auth.clearStoredAuth();
                setTimeout(() => {
                  common_vendor.index.reLaunch({ url: "/pages/login/index" });
                }, 1500);
              } else {
                common_vendor.index.showToast({
                  title: result.message || "注销失败",
                  icon: "none"
                });
              }
            } catch (error) {
              common_vendor.index.__f__("error", "at pages-teacher/user/index.vue:427", "注销账号失败:", error);
              common_vendor.index.showToast({
                title: "注销失败，请重试",
                icon: "none"
              });
            }
          }
        }
      });
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  const _component_TeacherTabBar = common_vendor.resolveComponent("TeacherTabBar");
  (_component_card + _component_TeacherTabBar)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.userInfo.avatar || $data.defaultAvatarUrl,
    b: common_vendor.t($data.userInfo.displayName),
    c: $options.teacherStatusText
  }, $options.teacherStatusText ? {
    d: common_vendor.t($options.teacherStatusText)
  } : {}, {
    e: $data.userInfo.phone
  }, $data.userInfo.phone ? {
    f: common_vendor.t($data.userInfo.phone)
  } : {}, {
    g: $data.userInfo.uid
  }, $data.userInfo.uid ? {
    h: common_vendor.t($data.userInfo.uid)
  } : {}, {
    i: common_vendor.t($data.metrics.totalStudents || 0),
    j: common_vendor.t($data.metrics.totalTrials || 0),
    k: common_vendor.t($data.metrics.successfulTrials || 0),
    l: common_vendor.t($data.metrics.totalIncome || 0),
    m: common_vendor.f($data.actionList, (action, k0, i0) => {
      return {
        a: action.icon,
        b: common_vendor.t(action.title),
        c: action.url,
        d: common_vendor.o(($event) => $options.goToPage(action.url), action.url)
      };
    }),
    n: common_vendor.p({
      headTitle: "快捷功能"
    }),
    o: common_vendor.t($data.userInfo.displayName || "-"),
    p: common_vendor.t($data.userInfo.phone || "未绑定"),
    q: common_vendor.t($data.statusTextMap[$data.metrics.verificationStatus] || "待完善"),
    r: common_vendor.n($data.metrics.verificationStatus === "verified" ? "text-success" : ""),
    s: common_vendor.p({
      headTitle: "账号信息"
    }),
    t: $data.teacherProfile.subjects && $data.teacherProfile.subjects.length > 0 || $data.teacherProfile.grades && $data.teacherProfile.grades.length > 0 || $data.teacherProfile.hourly_rate
  }, $data.teacherProfile.subjects && $data.teacherProfile.subjects.length > 0 || $data.teacherProfile.grades && $data.teacherProfile.grades.length > 0 || $data.teacherProfile.hourly_rate ? common_vendor.e({
    v: $data.teacherProfile.subjects && $data.teacherProfile.subjects.length > 0
  }, $data.teacherProfile.subjects && $data.teacherProfile.subjects.length > 0 ? {
    w: common_vendor.t(($data.teacherProfile.subjects || []).join("、"))
  } : {}, {
    x: $data.teacherProfile.grades && $data.teacherProfile.grades.length > 0
  }, $data.teacherProfile.grades && $data.teacherProfile.grades.length > 0 ? {
    y: common_vendor.t(($data.teacherProfile.grades || []).join("、"))
  } : {}, {
    z: $data.teacherProfile.hourly_rate
  }, $data.teacherProfile.hourly_rate ? {
    A: common_vendor.t($data.teacherProfile.hourly_rate)
  } : {}, {
    B: common_vendor.p({
      headTitle: "教师资料"
    })
  }) : {}, {
    C: common_vendor.f($data.listMenus, (item, k0, i0) => {
      return {
        a: item.icon,
        b: common_vendor.t(item.title),
        c: common_vendor.t(item.desc),
        d: item.url,
        e: common_vendor.o(($event) => $options.goToPage(item.url), item.url)
      };
    }),
    D: common_vendor.p({
      headTitle: "常用设置"
    }),
    E: common_vendor.o((...args) => $options.handleLogout && $options.handleLogout(...args)),
    F: common_vendor.o((...args) => $options.handleDeleteAccount && $options.handleDeleteAccount(...args)),
    G: common_vendor.p({
      current: "user"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-9007a54d"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/user/index.js.map
