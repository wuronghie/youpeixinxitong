"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_auth = require("../../utils/auth.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const TeacherTabBar = () => "../components/TeacherTabBar.js";
const _sfc_main = {
  name: "TeacherUserCenter",
  components: {
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
          title: "我的课酬",
          desc: "查看课酬流水与到账状态",
          icon: utils_imageConfig.getIconUrl("wallet.png"),
          url: "/pages-teacher/wallet/index"
        },
        {
          title: "我的优惠券",
          desc: "支付信息费时可抵扣使用",
          icon: utils_imageConfig.getIconUrl("wallet.png"),
          url: "/pages-teacher/coupon/list"
        },
        {
          title: "评价管理",
          desc: "查看并回复家长评价",
          icon: utils_imageConfig.getIconUrl("star.png"),
          url: "/pages-teacher/review/list"
        },
        {
          title: "关注服务号",
          desc: "一键关注，接收预约与消息通知",
          icon: utils_imageConfig.getIconUrl("bell.png"),
          url: "/pages/common/follow-oa"
        },
        {
          title: "系统消息",
          desc: "查看平台通知和审核结果",
          icon: utils_imageConfig.getIconUrl("bell.png"),
          url: "/pages-teacher/user/messages"
        }
      ],
      serviceIcon: utils_imageConfig.getIconUrl("chat.png"),
      inviteIcon: utils_imageConfig.getInviteIconUrl(),
      myInviteCode: "",
      boundInviteCode: "",
      inviteBound: false,
      adminWechat: "chen18148503231",
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
    },
    greetText() {
      const hour = (/* @__PURE__ */ new Date()).getHours();
      if (hour < 12)
        return "上午好";
      if (hour < 18)
        return "下午好";
      return "晚上好";
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
    contactService() {
      const wechat = this.adminWechat;
      if (!wechat) {
        common_vendor.index.showToast({ title: "暂无客服微信", icon: "none" });
        return;
      }
      common_vendor.index.setClipboardData({
        data: wechat,
        success: () => {
          common_vendor.index.showToast({ title: "微信号已复制", icon: "success" });
        },
        fail: () => {
          common_vendor.index.showToast({ title: "复制失败", icon: "none" });
        }
      });
    },
    copyUserId() {
      const uid = this.userInfo && this.userInfo.uid;
      if (!uid) {
        common_vendor.index.showToast({ title: "暂无用户ID", icon: "none" });
        return;
      }
      common_vendor.index.setClipboardData({
        data: String(uid),
        success: () => {
          common_vendor.index.showToast({ title: "用户ID已复制", icon: "success" });
        },
        fail: () => {
          common_vendor.index.showToast({ title: "复制失败", icon: "none" });
        }
      });
    },
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/user/index.vue:309", "[teacher-user-center] 下拉刷新：重新加载个人中心");
      await Promise.all([this.loadUserInfo(), this.loadInviteCode()]);
    },
    async loadData() {
      if (this.loading)
        return;
      this.loading = true;
      try {
        await Promise.all([this.loadUserInfo(), this.loadTeacherMetrics(), this.loadInviteCode()]);
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
        common_vendor.index.__f__("error", "at pages-teacher/user/index.vue:344", "加载用户信息失败:", error);
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
          const isFullTimeTeacher = (profile == null ? void 0 : profile.school) === "专职老师" || (profile == null ? void 0 : profile.school) === "专职老师（已毕业）";
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
        common_vendor.index.__f__("error", "at pages-teacher/user/index.vue:418", "加载教师统计失败:", error);
      }
    },
    applyInviteBind(data = {}) {
      const uid = this.userInfo && this.userInfo.uid || (common_vendor.index.getStorageSync("userInfo") || {}).uid;
      const bound = data.bound === true || !!data.bound_invite_code;
      if (data.bound_invite_code) {
        this.boundInviteCode = data.bound_invite_code;
      }
      if (bound) {
        this.inviteBound = true;
        if (uid && this.boundInviteCode) {
          common_vendor.index.setStorageSync(`bound_invite_code_${uid}`, this.boundInviteCode);
        }
      } else if (data.bound === false) {
        this.inviteBound = false;
        this.boundInviteCode = "";
      }
    },
    async loadInviteCode() {
      try {
        if (this.useMock) {
          this.myInviteCode = "DEMO88";
          this.boundInviteCode = "";
          this.inviteBound = false;
          return;
        }
        const uid = this.userInfo && this.userInfo.uid || (common_vendor.index.getStorageSync("userInfo") || {}).uid;
        const cached = uid ? common_vendor.index.getStorageSync(`bound_invite_code_${uid}`) : "";
        if (cached) {
          this.boundInviteCode = cached;
          this.inviteBound = true;
        }
        const inviteCenter = common_vendor.tr.importObject("invite-center", { customUI: true });
        const res = await inviteCenter.getMyInviteCode();
        if (res.code === 0 && res.data) {
          if (res.data.invite_code)
            this.myInviteCode = res.data.invite_code;
          this.applyInviteBind(res.data);
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/user/index.vue:458", "加载邀请码失败:", error);
      }
    },
    async copyInviteCode() {
      try {
        if (!this.myInviteCode && !this.useMock) {
          const inviteCenter = common_vendor.tr.importObject("invite-center", { customUI: true });
          const res = await inviteCenter.getMyInviteCode();
          if (res.code === 0 && res.data && res.data.invite_code) {
            this.myInviteCode = res.data.invite_code;
            this.applyInviteBind(res.data);
          } else {
            common_vendor.index.showToast({ title: res.message || "生成邀请码失败", icon: "none" });
            return;
          }
        }
        const codeToCopy = this.myInviteCode || (this.useMock ? "DEMO88" : "");
        if (!codeToCopy) {
          common_vendor.index.showToast({ title: "邀请码生成中，请稍后再试", icon: "none" });
          return;
        }
        common_vendor.index.setClipboardData({
          data: codeToCopy,
          success: () => {
            common_vendor.index.showToast({ title: "邀请码已复制", icon: "success" });
          }
        });
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/user/index.vue:486", "生成或复制邀请码失败:", error);
        common_vendor.index.showToast({ title: "生成邀请码失败，请稍后重试", icon: "none" });
      }
    },
    async openInviteInput() {
      if (this.useMock) {
        common_vendor.index.showToast({ title: "演示模式下不支持填写邀请码", icon: "none" });
        return;
      }
      if (this.inviteBound || this.boundInviteCode) {
        common_vendor.index.showModal({
          title: "已填写邀请码",
          content: this.boundInviteCode ? `您已填写邀请码：${this.boundInviteCode}` : "您已填写过邀请码，不能再次填写",
          showCancel: false,
          confirmText: "知道了"
        });
        return;
      }
      try {
        const modalRes = await new Promise((resolve) => {
          common_vendor.index.showModal({
            title: "填写好友邀请码",
            editable: true,
            placeholderText: "请输入 6 位邀请码（不区分大小写）",
            cancelText: "取消",
            confirmText: "确定",
            success: resolve
          });
        });
        if (!modalRes.confirm)
          return;
        const raw = (modalRes.content || "").trim();
        if (!raw) {
          common_vendor.index.showToast({ title: "请输入邀请码", icon: "none" });
          return;
        }
        const inviteCode = raw.toUpperCase();
        if (inviteCode.length < 4 || inviteCode.length > 10) {
          common_vendor.index.showToast({ title: "邀请码格式不正确", icon: "none" });
          return;
        }
        const inviteCenter = common_vendor.tr.importObject("invite-center", { customUI: true });
        const res = await inviteCenter.acceptInvite({ invite_code: inviteCode });
        if (res.code === 0) {
          this.applyInviteBind({
            bound: true,
            bound_invite_code: res.data && res.data.bound_invite_code || inviteCode
          });
          common_vendor.index.showToast({ title: res.message || "邀请码填写成功", icon: "success" });
        } else {
          common_vendor.index.showToast({ title: res.message || "邀请码无效", icon: "none", duration: 3e3 });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/user/index.vue:540", "填写邀请码失败:", error);
        common_vendor.index.showToast({ title: error.message || "填写邀请码失败", icon: "none" });
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
              common_vendor.index.__f__("error", "at pages-teacher/user/index.vue:591", "注销账号失败:", error);
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
  const _component_TeacherTabBar = common_vendor.resolveComponent("TeacherTabBar");
  _component_TeacherTabBar();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($options.greetText),
    b: $data.userInfo.avatar || $data.defaultAvatarUrl,
    c: common_vendor.t($data.userInfo.displayName),
    d: common_vendor.t($options.teacherStatusText || "待完善资料"),
    e: common_vendor.o(($event) => $options.goToPage("/pages-teacher/profile/edit")),
    f: $data.userInfo.uid
  }, $data.userInfo.uid ? {
    g: common_vendor.t($data.userInfo.uid),
    h: common_vendor.o((...args) => $options.copyUserId && $options.copyUserId(...args))
  } : {}, {
    i: common_vendor.o(($event) => $options.goToPage("/pages-teacher/index/index")),
    j: common_vendor.t($data.metrics.totalStudents || 0),
    k: common_vendor.o(($event) => $options.goToPage("/pages-teacher/appointment/list")),
    l: common_vendor.t($data.metrics.totalTrials || 0),
    m: common_vendor.o(($event) => $options.goToPage("/pages-teacher/appointment/list")),
    n: common_vendor.t($data.metrics.successfulTrials || 0),
    o: common_vendor.o(($event) => $options.goToPage("/pages-teacher/appointment/list")),
    p: common_vendor.t($data.metrics.totalIncome || 0),
    q: common_vendor.o(($event) => $options.goToPage("/pages-teacher/wallet/index")),
    r: common_vendor.f($data.actionList, (action, k0, i0) => {
      return {
        a: action.icon,
        b: common_vendor.t(action.title),
        c: action.url,
        d: common_vendor.o(($event) => $options.goToPage(action.url), action.url)
      };
    }),
    s: common_vendor.f($data.listMenus, (item, k0, i0) => {
      return {
        a: item.icon,
        b: common_vendor.t(item.title),
        c: item.url,
        d: common_vendor.o(($event) => $options.goToPage(item.url), item.url)
      };
    }),
    t: $data.inviteIcon,
    v: common_vendor.t($data.myInviteCode || "--"),
    w: common_vendor.o((...args) => $options.copyInviteCode && $options.copyInviteCode(...args)),
    x: $data.inviteIcon,
    y: $data.inviteBound || $data.boundInviteCode
  }, $data.inviteBound || $data.boundInviteCode ? {
    z: common_vendor.t($data.boundInviteCode ? "已填写 " + $data.boundInviteCode : "已填写")
  } : {}, {
    A: common_vendor.o((...args) => $options.openInviteInput && $options.openInviteInput(...args)),
    B: $data.serviceIcon,
    C: common_vendor.t($data.adminWechat),
    D: common_vendor.o((...args) => $options.contactService && $options.contactService(...args)),
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
