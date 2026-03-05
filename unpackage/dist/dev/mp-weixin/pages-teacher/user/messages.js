"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "TeacherMessages",
  components: {
    card
  },
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      tabs: [
        { label: "全部", value: "all", unread: 0 },
        { label: "系统", value: "system", unread: 0 },
        { label: "预约", value: "appointment", unread: 0 },
        { label: "交易", value: "payment", unread: 0 }
      ],
      currentTab: "all",
      list: [],
      stats: {
        total: 0,
        unread: 0
      },
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0
      },
      loading: false,
      finished: false,
      useMock: false
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.resetAndLoad();
  },
  onShow() {
    if (!this.useMock) {
      this.resetAndLoad();
    }
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/user/messages.vue:134", "[teacher-messages] 下拉刷新：重新加载消息");
      await this.resetAndLoad();
    },
    resetAndLoad() {
      this.pagination.page = 1;
      this.finished = false;
      this.list = [];
      this.loadMessages();
    },
    switchTab(tabValue) {
      if (this.currentTab === tabValue)
        return;
      this.currentTab = tabValue;
      this.resetAndLoad();
    },
    async loadMessages() {
      var _a, _b, _c, _d;
      if (this.loading || this.finished)
        return;
      this.loading = true;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mockData = [
            {
              message_id: "mock-1",
              type: "system",
              title: "系统通知",
              content: "欢迎加入家教帮，完善资料可提升曝光率",
              is_read: false,
              create_time: Date.now() - 60 * 60 * 1e3
            },
            {
              message_id: "mock-2",
              type: "appointment",
              title: "新的预约申请",
              content: "家长【李女士】提交了试课预约申请，请及时确认。",
              is_read: true,
              create_time: Date.now() - 3 * 60 * 60 * 1e3
            }
          ];
          this.list = mockData;
          this.stats = { total: mockData.length, unread: mockData.filter((item) => !item.is_read).length };
          this.tabs = this.tabs.map((tab) => ({
            ...tab,
            unread: tab.value === "all" ? this.stats.unread : mockData.filter((item) => item.type === tab.value && !item.is_read).length
          }));
          this.finished = true;
          return;
        }
        const messageObj = common_vendor.tr.importObject("teacher-message", { customUI: true });
        const res = await messageObj.getList({
          type: this.currentTab,
          page: this.pagination.page,
          pageSize: this.pagination.pageSize
        });
        if (res.code === 0 && res.data) {
          const fetched = res.data.list || [];
          if (this.pagination.page === 1) {
            this.list = fetched;
          } else {
            this.list = [...this.list, ...fetched];
          }
          this.pagination.total = ((_a = res.data.pagination) == null ? void 0 : _a.total) || 0;
          this.stats = {
            total: ((_b = res.data.stats) == null ? void 0 : _b.total) || 0,
            unread: ((_c = res.data.stats) == null ? void 0 : _c.unread) || 0
          };
          const perType = ((_d = res.data.stats) == null ? void 0 : _d.perType) || {};
          this.tabs = this.tabs.map((tab) => {
            var _a2;
            if (tab.value === "all") {
              return { ...tab, unread: this.stats.unread };
            }
            return {
              ...tab,
              unread: ((_a2 = perType[tab.value]) == null ? void 0 : _a2.unread) || 0
            };
          });
          if (this.list.length >= this.pagination.total || fetched.length < this.pagination.pageSize) {
            this.finished = true;
          } else {
            this.pagination.page += 1;
          }
        } else {
          common_vendor.index.showToast({ title: res.message || "获取消息失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/user/messages.vue:226", "获取消息失败:", error);
        common_vendor.index.showToast({ title: "获取消息失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    loadMore() {
      this.loadMessages();
    },
    async markAllRead() {
      if (this.useMock || !this.list.some((item) => !item.is_read))
        return;
      try {
        const messageObj = common_vendor.tr.importObject("teacher-message", { customUI: true });
        const res = await messageObj.markAllRead({ type: this.currentTab });
        if (res.code === 0) {
          this.list = this.list.map((item) => ({ ...item, is_read: true }));
          this.tabs = this.tabs.map((tab) => ({ ...tab, unread: tab.value === "all" ? 0 : 0 }));
          this.stats.unread = 0;
          common_vendor.index.showToast({ title: "已全部标记为已读", icon: "none" });
        } else {
          common_vendor.index.showToast({ title: res.message || "操作失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/user/messages.vue:249", "批量标记失败:", error);
        common_vendor.index.showToast({ title: "操作失败，请稍后再试", icon: "none" });
      }
    },
    getTypeIcon(type) {
      const icons = {
        system: "icon-bell",
        appointment: "icon-calendar",
        payment: "icon-wallet"
      };
      return icons[type] || "icon-chat";
    },
    getTypeClass(type) {
      const classes = {
        system: "bg-warning",
        appointment: "main-bg-color",
        payment: "bg-success"
      };
      return classes[type] || "bg-light-secondary";
    },
    formatTime(timestamp) {
      const date = new Date(timestamp || Date.now());
      const now = /* @__PURE__ */ new Date();
      const diff = now - date;
      if (diff < 6e4)
        return "刚刚";
      if (diff < 36e5)
        return `${Math.floor(diff / 6e4)}分钟前`;
      if (diff < 864e5)
        return `${Math.floor(diff / 36e5)}小时前`;
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${month}-${day}`;
    },
    async goToDetail(msg) {
      if (!msg.is_read && !this.useMock) {
        try {
          const messageObj = common_vendor.tr.importObject("teacher-message", { customUI: true });
          const res = await messageObj.markRead({ message_id: msg.message_id });
          if (res.code === 0) {
            msg.is_read = true;
            this.stats.unread = Math.max(this.stats.unread - 1, 0);
            this.tabs = this.tabs.map((tab) => ({
              ...tab,
              unread: tab.value === "all" ? Math.max(tab.unread - 1, 0) : tab.value === msg.type ? Math.max(tab.unread - 1, 0) : tab.unread
            }));
          }
        } catch (error) {
          common_vendor.index.__f__("error", "at pages-teacher/user/messages.vue:298", "标记消息已读失败:", error);
        }
      } else {
        msg.is_read = true;
      }
      if (msg.action_url) {
        common_vendor.index.navigateTo({ url: msg.action_url });
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.stats.total || 0),
    b: common_vendor.t($data.stats.unread || 0),
    c: common_vendor.f($data.tabs, (tab, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(tab.label),
        b: tab.unread > 0
      }, tab.unread > 0 ? {
        c: common_vendor.t(tab.unread > 99 ? "99+" : tab.unread)
      } : {}, {
        d: tab.value,
        e: common_vendor.n($data.currentTab === tab.value ? "tab-active" : "tab-inactive"),
        f: common_vendor.o(($event) => $options.switchTab(tab.value), tab.value)
      });
    }),
    d: $data.list.length
  }, $data.list.length ? {
    e: common_vendor.t($data.pagination.total),
    f: common_vendor.o((...args) => $options.markAllRead && $options.markAllRead(...args))
  } : {}, {
    g: $data.loading && !$data.list.length
  }, $data.loading && !$data.list.length ? {
    h: common_vendor.f(4, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : common_vendor.e({
    i: common_vendor.f($data.list, (item, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.n($options.getTypeIcon(item.type)),
        b: common_vendor.n($options.getTypeClass(item.type)),
        c: common_vendor.t(item.title),
        d: common_vendor.t($options.formatTime(item.create_time)),
        e: common_vendor.t(item.content),
        f: item.type === "appointment"
      }, item.type === "appointment" ? {} : {}, {
        g: item.type === "payment"
      }, item.type === "payment" ? {} : {}, {
        h: item.type === "system"
      }, item.type === "system" ? {} : {}, {
        i: !item.is_read
      }, !item.is_read ? {} : {}, {
        j: item.message_id,
        k: !item.is_read ? 1 : "",
        l: common_vendor.o(($event) => $options.goToDetail(item), item.message_id)
      });
    }),
    j: !$data.loading && !$data.list.length
  }, !$data.loading && !$data.list.length ? {} : {}, {
    k: $data.loading && $data.list.length
  }, $data.loading && $data.list.length ? {} : $data.finished && $data.list.length ? {} : {}, {
    l: $data.finished && $data.list.length
  }), {
    m: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1e08efc7"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/user/messages.js.map
