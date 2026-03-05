"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_auth = require("../../utils/auth.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const ParentTabBar = () => "../../components/ParentTabBar.js";
const card = () => "../../components/common/card.js";
const divider = () => "../../components/common/divider.js";
const defaultAvatar = utils_imageConfig.getDefaultAvatarUrl();
const _sfc_main = {
  name: "ParentUserCenter",
  components: {
    ParentTabBar,
    card,
    divider
  },
  data() {
    return {
      // 是否使用模拟数据（开发测试用）
      useMock: false,
      // 用户基本信息
      // 包含：uid, nickname, avatar, role, phone 等
      userInfo: {},
      // 用户详细资料（包含家长信息、学生信息等）
      // 从云函数 user-profile.getUserProfile() 获取
      profile: null,
      // 概览数据：预约统计、订单统计、未读消息
      overview: {
        // 预约状态统计
        appointmentStats: {
          total: 0,
          // 预约总数
          pending_payment: 0,
          // 待支付
          pending_confirm: 0,
          // 待确认
          confirmed: 0,
          // 已确认
          in_progress: 0,
          // 进行中
          completed: 0,
          // 已完成
          cancelled: 0
          // 已取消
        },
        // 订单状态统计
        orderStats: {
          pending_payment: 0,
          // 待支付订单数
          refund_processing: 0
          // 退款处理中订单数
        },
        // 未读消息数
        unreadMessages: 0
      },
      // 当前用户的邀请码（用于分享）
      myInviteCode: ""
    };
  },
  computed: {
    /**
     * 显示头像
     * 优先级：profile.avatar > userInfo.avatar > 默认头像
     */
    displayAvatar() {
      var _a, _b;
      return ((_a = this.profile) == null ? void 0 : _a.avatar) || ((_b = this.userInfo) == null ? void 0 : _b.avatar) || defaultAvatar;
    },
    /**
     * 显示姓名
     * 优先级：profile.parent_info.real_name > profile.nickname > userInfo.nickname > '微信用户'
     */
    displayName() {
      var _a, _b, _c, _d;
      return ((_b = (_a = this.profile) == null ? void 0 : _a.parent_info) == null ? void 0 : _b.real_name) || ((_c = this.profile) == null ? void 0 : _c.nickname) || ((_d = this.userInfo) == null ? void 0 : _d.nickname) || "微信用户";
    },
    /**
     * 头部统计数据
     * 用于显示在头部区域的统计信息
     * 修改提示：可以在这里添加更多统计项，如收藏数、优惠券数等
     */
    heroStats() {
      const stats = this.overview.appointmentStats || {};
      return [
        { key: "total", label: "预约总数", value: stats.total || 0 },
        { key: "completed", label: "已完成", value: stats.completed || 0 },
        { key: "unread", label: "未读消息", value: this.overview.unreadMessages || 0 }
      ];
    },
    /**
     * 预约状态快捷入口配置
     * 修改提示：
     *   - 添加新状态：在数组中添加新对象
     *   - 修改图标：修改 icon 字段（使用 iconfont 类名）
     *   - 修改名称：修改 name 字段
     *   - 修改跳转状态：修改 index 字段（对应 appointment/list 页面的 status 参数）
     */
    appointmentOrders() {
      const stats = this.overview.appointmentStats || {};
      return [
        {
          name: "待支付",
          icon: "icon-wallet_icon",
          index: "pending_payment",
          badge: this.badgeValue(stats.pending_payment || 0)
        },
        {
          name: "待确认",
          icon: "icon-daishouhuo",
          index: "pending_confirm",
          badge: this.badgeValue(stats.pending_confirm || 0)
        },
        {
          name: "进行中",
          icon: "icon-pinglun",
          index: "in_progress",
          badge: this.badgeValue(stats.in_progress || 0)
        },
        {
          name: "已完成",
          icon: "icon-buoumaotubiao46",
          index: "completed",
          badge: ""
        }
      ];
    }
  },
  /**
   * 页面加载时触发
   * 功能：初始化模拟数据开关
   */
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
  },
  /**
   * 页面显示时触发
   * 功能：检查登录状态，如果已登录则初始化页面数据
   */
  onShow() {
    if (!utils_auth.ensureLoggedIn("parent")) {
      return;
    }
    this.$nextTick(() => {
      setTimeout(() => {
        this.initPage();
        this.loadInviteCode();
      }, 50);
    });
  },
  onShareAppMessage() {
    const query = this.myInviteCode ? `?inviteCode=${this.myInviteCode}` : "";
    return {
      title: "家教帮 · 家长个人中心",
      // 将分享落地页指向登录页，方便新用户注册，并携带邀请码
      path: `/pages/login/index${query}`
    };
  },
  onShareTimeline() {
    const query = this.myInviteCode ? `inviteCode=${this.myInviteCode}` : "";
    return {
      title: "家教帮 · 家长个人中心",
      query
    };
  },
  /**
   * 下拉刷新触发
   * 功能：重新加载页面数据
   */
  onPullDownRefresh() {
    this.initPage(true);
  },
  methods: {
    /**
     * 格式化徽章数值
     * @param {Number} count - 数量
     * @returns {String} 格式化后的徽章文字（超过99显示99+）
     */
    badgeValue(count) {
      if (!count)
        return "";
      return count > 99 ? "99+" : String(count);
    },
    /**
     * 初始化页面数据
     * @param {Boolean} fromPullDown - 是否来自下拉刷新
     * 功能：
     *   1. 加载用户资料
     *   2. 加载概览数据（预约统计、订单统计等）
     * 修改提示：可以在这里添加其他数据加载逻辑，如优惠券、积分等
     */
    async initPage(fromPullDown = false) {
      try {
        await Promise.all([this.loadUserProfile(), this.loadOverview()]);
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/index.vue:378", "初始化家长个人中心失败:", error);
      } finally {
        if (fromPullDown) {
          common_vendor.index.stopPullDownRefresh();
        }
      }
    },
    /**
     * 加载当前用户的邀请码（用于分享）
     */
    async loadInviteCode() {
      try {
        if (this.useMock) {
          this.myInviteCode = "DEMO88";
          return;
        }
        const inviteCenter = common_vendor.tr.importObject("invite-center", { customUI: true });
        const res = await inviteCenter.getMyInviteCode();
        if (res.code === 0 && res.data && res.data.invite_code) {
          this.myInviteCode = res.data.invite_code;
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/index.vue:400", "加载邀请码失败:", error);
      }
    },
    /**
     * 加载用户资料
     * 功能：
     *   1. 从本地存储获取用户基本信息
     *   2. 调用云函数获取最新用户资料
     *   3. 更新本地存储的用户信息
     * 修改提示：
     *   - 可以在这里添加用户资料的其他字段处理
     *   - 可以添加资料验证逻辑
     */
    async loadUserProfile() {
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const stored2 = common_vendor.index.getStorageSync("userInfo");
          this.userInfo = stored2 || utils_mockData.mockUserInfo;
          this.profile = Object.assign({}, this.userInfo);
          return;
        }
        const stored = common_vendor.index.getStorageSync("userInfo") || {};
        this.userInfo = stored;
        if (!stored.uid) {
          common_vendor.index.showToast({ title: "请先登录", icon: "none" });
          return;
        }
        const userProfile = common_vendor.tr.importObject("user-profile", { customUI: true });
        const res = await userProfile.getUserProfile();
        if (res.code === 0 && res.data) {
          const info = res.data;
          this.profile = info;
          this.userInfo = {
            ...stored,
            nickname: info.nickname || stored.nickname,
            avatar: info.avatar || stored.avatar,
            role: info.role || stored.role || "parent",
            phone: info.phone || stored.phone || "",
            parent_info: info.parent_info || stored.parent_info || {}
          };
          utils_auth.setStoredUserInfo(this.userInfo);
          if (this.userInfo.role !== "parent") {
            common_vendor.index.showToast({ title: "当前账号非家长角色", icon: "none" });
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/index.vue:447", "加载用户信息失败:", error);
      }
    },
    /**
     * 加载概览数据
     * 功能：获取预约统计、订单统计、未读消息数等数据
     * 修改提示：
     *   - 可以在这里添加其他统计数据的获取，如收藏数、优惠券数等
     *   - 可以修改云函数调用，使用不同的云函数获取数据
     */
    async loadOverview() {
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          this.overview = {
            appointmentStats: {
              total: 6,
              pending_payment: 1,
              pending_confirm: 1,
              confirmed: 2,
              in_progress: 1,
              completed: 1,
              cancelled: 0
            },
            orderStats: {
              pending_payment: 1,
              refund_processing: 0
            },
            unreadMessages: 2
          };
          return;
        }
        const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const res = await appointmentQuery.getParentOverview();
        if (res.code === 0 && res.data) {
          const defaultOverview = JSON.parse(JSON.stringify(this.overview));
          this.overview = Object.assign({}, defaultOverview, res.data, {
            appointmentStats: Object.assign(
              {},
              defaultOverview.appointmentStats,
              res.data.appointmentStats || {}
            ),
            orderStats: Object.assign(
              {},
              defaultOverview.orderStats,
              res.data.orderStats || {}
            ),
            unreadMessages: res.data.unreadMessages || 0
          });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/index.vue:498", "加载概览数据失败:", error);
      }
    },
    /**
     * 打开预约列表（带状态筛选）
     * @param {Object} item - 预约状态项（包含 index 字段）
     * 功能：跳转到预约列表页，并传递状态参数进行筛选
     */
    openAppointment(item) {
      if (item.index) {
        common_vendor.index.navigateTo({
          url: `/pages/appointment/list?status=${item.index}`
        });
      }
    },
    /**
     * 通用页面跳转方法
     * @param {String} url - 目标页面路径
     * 修改提示：可以在这里添加跳转前的验证逻辑，如登录检查、权限检查等
     */
    goToPage(url) {
      if (!url)
        return;
      common_vendor.index.navigateTo({ url });
    },
    /**
     * 联系客服
     * 修改提示：
     *   - 修改客服信息：修改 content 中的联系方式
     *   - 可以改为跳转到客服聊天页面
     *   - 可以添加复制联系方式到剪贴板的功能
     */
    contactService() {
      common_vendor.index.showModal({
        title: "联系客服",
        content: "请添加客服微信：jiajiabang_service 或拨打 400-123-4567",
        showCancel: false,
        confirmText: "我知道了"
      });
    },
    /**
     * 复制 / 生成【自己的】邀请码
     * - 如果已有：直接复制
     * - 如果还没有：先调用云函数生成，再复制
     */
    async copyInviteCode() {
      try {
        if (!this.myInviteCode && !this.useMock) {
          const inviteCenter = common_vendor.tr.importObject("invite-center", { customUI: true });
          const res = await inviteCenter.getMyInviteCode();
          if (res.code === 0 && res.data && res.data.invite_code) {
            this.myInviteCode = res.data.invite_code;
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
        common_vendor.index.__f__("error", "at pages/user/index.vue:566", "生成或复制邀请码失败:", error);
        common_vendor.index.showToast({ title: "生成邀请码失败，请稍后重试", icon: "none" });
      }
    },
    /**
     * 手动填写好友的邀请码
     * - 后端已限制：每个账号只能绑定一次邀请人（acceptInvite 内部判断 inviter_uid）
     */
    async openInviteInput() {
      if (this.useMock) {
        common_vendor.index.showToast({ title: "演示模式下不支持填写邀请码", icon: "none" });
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
          common_vendor.index.showToast({ title: res.message || "邀请码填写成功", icon: "success" });
        } else {
          common_vendor.index.showToast({ title: res.message || "邀请码无效", icon: "none", duration: 3e3 });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/index.vue:612", "填写邀请码失败:", error);
        common_vendor.index.showToast({ title: error.message || "填写邀请码失败", icon: "none" });
      }
    },
    /**
     * 处理退出登录
     * 功能：
     *   1. 显示确认弹窗
     *   2. 清除本地存储的认证信息
     *   3. 跳转到登录页
     * 修改提示：可以在这里添加退出前的其他逻辑，如清除缓存、发送统计等
     */
    handleLogout() {
      common_vendor.index.showModal({
        title: "提示",
        content: "确定要退出登录吗？",
        success: (res) => {
          if (res.confirm) {
            utils_auth.clearStoredAuth();
            common_vendor.index.reLaunch({
              url: "/pages/login/index"
            });
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
              common_vendor.index.__f__("error", "at pages/user/index.vue:669", "注销账号失败:", error);
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
  const _component_divider = common_vendor.resolveComponent("divider");
  const _component_ParentTabBar = common_vendor.resolveComponent("ParentTabBar");
  (_component_card + _component_divider + _component_ParentTabBar)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o(($event) => $options.goToPage("/pages/chat/list")),
    b: $options.displayAvatar,
    c: common_vendor.t($options.displayName),
    d: common_vendor.o(($event) => $options.goToPage("/pages/common/register")),
    e: common_vendor.o(($event) => $options.goToPage("/pages/appointment/list")),
    f: common_vendor.f($options.appointmentOrders, (item, index, i0) => {
      return common_vendor.e({
        a: common_vendor.n(item.icon),
        b: common_vendor.t(item.name),
        c: item.badge
      }, item.badge ? {
        d: common_vendor.t(item.badge)
      } : {}, {
        e: index,
        f: common_vendor.o(($event) => $options.openAppointment(item), index)
      });
    }),
    g: common_vendor.o(($event) => $options.goToPage("/pages/order/list")),
    h: $data.myInviteCode
  }, $data.myInviteCode ? {} : {}, {
    i: common_vendor.t($data.myInviteCode || "--"),
    j: common_vendor.o((...args) => $options.copyInviteCode && $options.copyInviteCode(...args)),
    k: common_vendor.o((...args) => $options.openInviteInput && $options.openInviteInput(...args)),
    l: common_vendor.o(($event) => $options.goToPage("/pages/user/collection")),
    m: common_vendor.o(($event) => $options.goToPage("/pages/coupon/list")),
    n: common_vendor.o(($event) => $options.goToPage("/pages/common/register")),
    o: $data.overview.unreadMessages > 0
  }, $data.overview.unreadMessages > 0 ? {
    p: common_vendor.t($data.overview.unreadMessages > 99 ? "99+" : $data.overview.unreadMessages)
  } : {}, {
    q: common_vendor.o(($event) => $options.goToPage("/pages/user/messages")),
    r: common_vendor.o((...args) => $options.contactService && $options.contactService(...args)),
    s: common_vendor.o((...args) => $options.handleLogout && $options.handleLogout(...args)),
    t: common_vendor.o((...args) => $options.handleDeleteAccount && $options.handleDeleteAccount(...args)),
    v: common_vendor.p({
      current: "user"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-79e6a490"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/user/index.js.map
