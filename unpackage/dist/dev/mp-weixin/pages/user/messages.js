"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const defaultTabs = [
  { label: "全部", value: "all", unread: 0 },
  { label: "系统", value: "system", unread: 0 },
  { label: "预约", value: "appointment", unread: 0 },
  { label: "交易", value: "payment", unread: 0 },
  { label: "评价", value: "review", unread: 0 },
  { label: "退款", value: "refund", unread: 0 }
];
const _sfc_main = {
  name: "ParentSystemMessages",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      useMock: false,
      loading: false,
      markingAll: false,
      refresherTriggered: false,
      messageList: [],
      currentTab: "all",
      tabs: defaultTabs,
      stats: {
        total: 0,
        unread: 0
      },
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0
      },
      hasMore: true,
      activeActionId: "",
      errorMessage: "",
      scrollTop: 0,
      canRefresh: true
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
  },
  onShow() {
    this.initPage();
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages/user/messages.vue:176", "[user-messages] 下拉刷新：重新加载消息");
      await this.initPage(true);
    },
    async initPage(reset = true) {
      if (reset) {
        this.pagination.page = 1;
        this.hasMore = true;
        this.messageList = [];
      }
      await this.loadMessages();
    },
    handleScroll(e) {
      this.scrollTop = e.detail.scrollTop;
      this.canRefresh = e.detail.scrollTop <= 10;
    },
    handleScrollToUpper() {
      this.scrollTop = 0;
      this.canRefresh = true;
    },
    async onRefresh() {
      if (!this.canRefresh || this.scrollTop > 10) {
        this.refresherTriggered = false;
        return;
      }
      if (this.refresherTriggered)
        return;
      this.refresherTriggered = true;
      try {
        await this.initPage(true);
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/messages.vue:205", "刷新失败:", error);
        common_vendor.index.showToast({ title: "刷新失败，请稍后再试", icon: "none" });
      } finally {
        this.refresherTriggered = false;
      }
    },
    async loadMore() {
      if (this.loading || !this.hasMore)
        return;
      this.pagination.page += 1;
      await this.loadMessages(false);
    },
    async loadMessages(merge = true) {
      if (this.loading)
        return;
      this.loading = true;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mockList = [
            {
              message_id: "mock1",
              type: "appointment",
              title: "预约已确认",
              content: "老师已经确认了本周三的试课预约，请按时参加。",
              is_read: false,
              create_time: Date.now() - 1e3 * 60 * 60,
              status: "normal",
              ext_data: { appointment_id: "apt_mock1" }
            },
            {
              message_id: "mock2",
              type: "payment",
              title: "支付成功",
              content: "您已成功支付课程费用，点击查看订单详情。",
              is_read: true,
              create_time: Date.now() - 1e3 * 60 * 120,
              status: "normal",
              ext_data: { order_id: "order_mock1" }
            }
          ];
          this.messageList = merge ? mockList : [...this.messageList, ...mockList];
          this.stats = { total: mockList.length, unread: 1 };
          this.tabs = defaultTabs.map((tab) => {
            if (tab.value === "appointment") {
              return { ...tab, unread: 1 };
            }
            return { ...tab, unread: 0 };
          });
          this.hasMore = false;
          return;
        }
        const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
        if (!userInfo.uid) {
          common_vendor.index.showToast({ title: "请先登录", icon: "none" });
          return;
        }
        const messageObj = common_vendor.tr.importObject("user-message", { customUI: true });
        const res = await messageObj.getList({
          type: this.currentTab,
          page: this.pagination.page,
          pageSize: this.pagination.pageSize
        });
        if (res.code === 0 && res.data) {
          const { list = [], pagination = {}, stats = {} } = res.data;
          if (merge || this.pagination.page === 1) {
            this.messageList = list;
          } else {
            this.messageList = [...this.messageList, ...list];
          }
          this.pagination.total = pagination.total || 0;
          this.hasMore = this.pagination.page * this.pagination.pageSize < this.pagination.total;
          this.stats.total = stats.total || 0;
          this.stats.unread = stats.unread || 0;
          const perType = stats.perType || {};
          this.tabs = defaultTabs.map((tab) => {
            var _a;
            return {
              ...tab,
              unread: ((_a = perType[tab.value]) == null ? void 0 : _a.unread) || 0
            };
          });
        } else {
          throw new Error(res.message || "加载消息失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/messages.vue:288", "加载消息失败:", error);
        this.showError(error.message || "消息加载失败，请稍后重试");
      } finally {
        this.loading = false;
      }
    },
    async switchTab(tabValue) {
      if (this.currentTab === tabValue)
        return;
      this.currentTab = tabValue;
      this.pagination.page = 1;
      this.hasMore = true;
      this.messageList = [];
      await this.loadMessages();
    },
    getTypeIcon(type) {
      const map = {
        system: "🔔",
        appointment: "📅",
        payment: "💰",
        review: "⭐",
        refund: "💵"
      };
      return map[type] || "📧";
    },
    getTypeLabel(type) {
      const map = {
        system: "系统通知",
        appointment: "预约提醒",
        payment: "交易信息",
        review: "评价管理",
        refund: "退款进度"
      };
      return map[type] || "其他";
    },
    getCurrentTabLabel() {
      const current = this.tabs.find((item) => item.value === this.currentTab);
      return current ? current.label : "全部";
    },
    formatTime(timestamp) {
      const time = Number(timestamp);
      if (!time || Number.isNaN(time))
        return "";
      const date = new Date(time);
      const now = Date.now();
      const diff = now - time;
      if (diff < 60 * 1e3)
        return "刚刚";
      if (diff < 60 * 60 * 1e3)
        return `${Math.floor(diff / (60 * 1e3))}分钟前`;
      if (diff < 24 * 60 * 60 * 1e3)
        return `${Math.floor(diff / (60 * 60 * 1e3))}小时前`;
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${month}-${day} ${hour}:${minute}`;
    },
    async openMessage(msg) {
      if (!msg)
        return;
      if (!msg.is_read) {
        await this.markSingleRead(msg);
      }
      if (msg.action_url) {
        common_vendor.index.navigateTo({ url: msg.action_url });
      }
    },
    async markSingleRead(msg) {
      if (msg.is_read && !this.useMock)
        return;
      try {
        if (this.useMock) {
          msg.is_read = true;
          this.refreshTabStats();
          return;
        }
        const messageObj = common_vendor.tr.importObject("user-message", { customUI: true });
        if (msg.is_read) {
          return;
        }
        const res = await messageObj.markRead({ message_id: msg.message_id });
        if (res.code === 0) {
          msg.is_read = true;
          this.refreshTabStats();
        } else {
          throw new Error(res.message || "标记失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/messages.vue:370", "标记消息失败:", error);
        this.showError(error.message || "操作失败");
      }
    },
    async markAllRead() {
      if (this.markingAll)
        return;
      this.markingAll = true;
      try {
        if (this.useMock) {
          this.messageList.forEach((msg) => msg.is_read = true);
          this.refreshTabStats();
          return;
        }
        const messageObj = common_vendor.tr.importObject("user-message", { customUI: true });
        const res = await messageObj.markAllRead({ type: this.currentTab });
        if (res.code === 0) {
          this.messageList.forEach((msg) => {
            msg.is_read = true;
          });
          await this.loadMessages();
        } else {
          throw new Error(res.message || "操作失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/messages.vue:392", "批量标记失败:", error);
        this.showError(error.message || "操作失败");
      } finally {
        this.markingAll = false;
      }
    },
    refreshTabStats() {
      const unreadCounts = this.messageList.reduce((acc, msg) => {
        const type = msg.type || "system";
        if (!msg.is_read) {
          acc.total += 1;
          acc[type] = (acc[type] || 0) + 1;
        }
        return acc;
      }, { total: 0 });
      this.stats.unread = unreadCounts.total || 0;
      this.tabs = defaultTabs.map((tab) => ({
        ...tab,
        unread: unreadCounts[tab.value] || 0
      }));
    },
    toggleActions(messageId) {
      this.activeActionId = this.activeActionId === messageId ? "" : messageId;
    },
    removeMessage(msg) {
      if (!msg)
        return;
      common_vendor.index.showToast({ title: "删除功能暂未开放", icon: "none" });
      this.activeActionId = "";
    },
    goAppointment(appointmentId) {
      if (!appointmentId)
        return;
      common_vendor.index.navigateTo({ url: `/pages/appointment/detail?id=${appointmentId}` });
    },
    goOrder(orderId) {
      if (!orderId)
        return;
      common_vendor.index.navigateTo({ url: `/pages/order/detail?id=${orderId}` });
    },
    showError(message) {
      this.errorMessage = message;
      setTimeout(() => {
        this.errorMessage = "";
      }, 2e3);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.markingAll ? "处理中..." : "全部已读"),
    b: common_vendor.o((...args) => $options.markAllRead && $options.markAllRead(...args)),
    c: common_vendor.t($data.stats.unread || 0),
    d: common_vendor.t($data.stats.total || 0),
    e: common_vendor.t($options.getCurrentTabLabel()),
    f: common_vendor.f($data.tabs, (tab, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(tab.label),
        b: tab.unread > 0
      }, tab.unread > 0 ? {
        c: common_vendor.t(tab.unread)
      } : {}, {
        d: tab.value,
        e: common_vendor.n($data.currentTab === tab.value ? "tab-pill-active" : "tab-pill-inactive"),
        f: common_vendor.o(($event) => $options.switchTab(tab.value), tab.value)
      });
    }),
    g: $data.loading && $data.messageList.length === 0
  }, $data.loading && $data.messageList.length === 0 ? {
    h: common_vendor.f(4, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : common_vendor.e({
    i: common_vendor.f($data.messageList, (msg, k0, i0) => {
      var _a, _b, _c, _d;
      return common_vendor.e({
        a: common_vendor.t($options.getTypeLabel(msg.type)),
        b: common_vendor.t($options.formatTime(msg.create_time)),
        c: common_vendor.t($options.getTypeIcon(msg.type)),
        d: common_vendor.t(msg.title),
        e: !msg.is_read
      }, !msg.is_read ? {} : {}, {
        f: common_vendor.t(msg.content),
        g: common_vendor.t($options.getTypeLabel(msg.type)),
        h: msg.status === "action_required"
      }, msg.status === "action_required" ? {} : {}, {
        i: (_a = msg.ext_data) == null ? void 0 : _a.appointment_id
      }, ((_b = msg.ext_data) == null ? void 0 : _b.appointment_id) ? {
        j: common_vendor.o(($event) => $options.goAppointment(msg.ext_data.appointment_id), msg.message_id)
      } : {}, {
        k: (_c = msg.ext_data) == null ? void 0 : _c.order_id
      }, ((_d = msg.ext_data) == null ? void 0 : _d.order_id) ? {
        l: common_vendor.o(($event) => $options.goOrder(msg.ext_data.order_id), msg.message_id)
      } : {}, {
        m: common_vendor.o(($event) => $options.toggleActions(msg.message_id), msg.message_id),
        n: $data.activeActionId === msg.message_id
      }, $data.activeActionId === msg.message_id ? {
        o: common_vendor.t(msg.is_read ? "标记未读" : "标记已读"),
        p: common_vendor.o(($event) => $options.markSingleRead(msg), msg.message_id),
        q: common_vendor.o(($event) => $options.removeMessage(msg), msg.message_id)
      } : {}, {
        r: msg.message_id,
        s: !msg.is_read ? 1 : "",
        t: common_vendor.o(($event) => $options.openMessage(msg), msg.message_id)
      });
    }),
    j: !$data.loading && !$data.messageList.length
  }, !$data.loading && !$data.messageList.length ? {} : {}, {
    k: $data.loading && $data.messageList.length
  }, $data.loading && $data.messageList.length ? {} : !$data.hasMore && $data.messageList.length ? {} : {}, {
    l: !$data.hasMore && $data.messageList.length
  }), {
    m: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-b802e1e2"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/user/messages.js.map
