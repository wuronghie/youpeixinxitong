"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const ParentTabBar = () => "../../components/ParentTabBar.js";
const _sfc_main = {
  name: "ChatList",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  components: {
    ParentTabBar
  },
  data() {
    return {
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl(),
      searchKeyword: "",
      list: [],
      displayList: [],
      stats: {
        total: 0,
        unreadConversations: 0,
        unreadMessages: 0
      },
      page: 1,
      pageSize: 30,
      finished: false,
      loading: false,
      refresherTriggered: false,
      useMock: false,
      scrollTop: 0,
      canRefresh: true,
      // 会话列表轮询定时器
      pollTimer: null,
      pollInterval: 1e4
      // 10秒轮询一次（列表更新频率可以稍低）
    };
  },
  watch: {
    searchKeyword() {
      this.filterList();
    }
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.$nextTick(() => {
      setTimeout(() => {
        this.resetAndLoad();
      }, 50);
    });
  },
  onShareAppMessage() {
    return {
      title: "家教帮 · 老师沟通",
      path: "/pages/chat/list"
    };
  },
  onShareTimeline() {
    return {
      title: "家教帮 · 老师沟通"
    };
  },
  onShow() {
    if (!this.useMock) {
      this.$nextTick(() => {
        setTimeout(() => {
          this.resetAndLoad();
          this.startPolling();
        }, 50);
      });
    }
  },
  onHide() {
    this.stopPolling();
  },
  onUnload() {
    this.stopPolling();
  },
  methods: {
    /**
     * 启动会话列表轮询
     */
    startPolling() {
      this.stopPolling();
      if (!this.useMock) {
        this.pollTimer = setInterval(() => {
          if (this.loading) {
            return;
          }
          this.refreshConversationsSilently();
        }, this.pollInterval);
      }
    },
    /**
     * 停止会话列表轮询
     */
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    async refreshData() {
      common_vendor.index.__f__("log", "at pages/chat/list.vue:196", "[chat-list] 下拉刷新：重新加载会话列表");
      await this.loadConversations(true);
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
      this.resetAndLoad();
    },
    resetAndLoad() {
      this.page = 1;
      this.finished = false;
      this.list = [];
      this.displayList = [];
      this.loadConversations();
    },
    /**
     * 静默刷新会话列表（用于轮询）
     */
    async refreshConversationsSilently() {
      var _a;
      if (this.loading || this.useMock)
        return;
      this.loading = true;
      try {
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.getConversationList();
        if (res.code === 0) {
          const fetched = (((_a = res.data) == null ? void 0 : _a.list) || []).map((item) => {
            let lastMessage = "";
            if (item.last_message) {
              if (typeof item.last_message === "object") {
                lastMessage = item.last_message.content || item.last_message.text || JSON.stringify(item.last_message);
              } else {
                lastMessage = item.last_message;
              }
            }
            lastMessage = this.formatLastMessage(lastMessage);
            return {
              conversation_id: item._id,
              appointment_id: item.appointment_id,
              name: this.resolveName(item, "老师"),
              avatar: this.resolveAvatar(item),
              last_message: lastMessage,
              last_message_time: item.last_message_time || item.update_time || Date.now(),
              unread_count: Number(item.unread_count_parent ?? 0),
              status: item.status,
              deposit_paid: item.deposit_paid,
              tag: this.resolveTag(item)
            };
          });
          const listMap = /* @__PURE__ */ new Map();
          this.list.forEach((item) => {
            listMap.set(item.conversation_id, item);
          });
          fetched.forEach((item) => {
            listMap.set(item.conversation_id, item);
          });
          this.list = Array.from(listMap.values()).sort(
            (a, b) => (b.last_message_time || 0) - (a.last_message_time || 0)
          );
          this.updateStats();
          this.filterList();
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/list.vue:272", "静默刷新会话列表失败:", error);
      } finally {
        this.loading = false;
      }
    },
    async loadConversations() {
      var _a;
      if (this.loading || this.finished) {
        if (this.refresherTriggered)
          this.refresherTriggered = false;
        return;
      }
      this.loading = true;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mockData = utils_mockData.mockConversations.map((item) => {
            let lastMessage = "";
            if (item.last_message) {
              if (typeof item.last_message === "object") {
                lastMessage = item.last_message.content || item.last_message.text || JSON.stringify(item.last_message);
              } else {
                lastMessage = item.last_message;
              }
            }
            lastMessage = this.formatLastMessage(lastMessage);
            return {
              conversation_id: item.conversation_id,
              appointment_id: item.appointment_id,
              name: item.teacher_name || "老师",
              avatar: item.avatar || this.defaultAvatarUrl,
              last_message: lastMessage,
              last_message_time: item.last_message_time || Date.now(),
              unread_count: item.unread_count_parent || item.unread_count || 0,
              tag: item.tag || ""
            };
          });
          this.list = mockData;
          this.finished = true;
          this.updateStats();
          this.filterList();
          return;
        }
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.getConversationList();
        if (res.code === 0) {
          const fetched = (((_a = res.data) == null ? void 0 : _a.list) || []).map((item) => {
            let lastMessage = "";
            if (item.last_message) {
              if (typeof item.last_message === "object") {
                lastMessage = item.last_message.content || item.last_message.text || JSON.stringify(item.last_message);
              } else {
                lastMessage = item.last_message;
              }
            }
            lastMessage = this.formatLastMessage(lastMessage);
            return {
              conversation_id: item._id,
              appointment_id: item.appointment_id,
              name: this.resolveName(item, "老师"),
              avatar: this.resolveAvatar(item),
              last_message: lastMessage,
              last_message_time: item.last_message_time || item.update_time || Date.now(),
              unread_count: Number(item.unread_count_parent ?? 0),
              status: item.status,
              deposit_paid: item.deposit_paid,
              tag: this.resolveTag(item)
            };
          });
          this.list = fetched;
          this.finished = true;
          this.updateStats();
          this.filterList();
        } else {
          common_vendor.index.showToast({ title: res.message || "加载会话失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/list.vue:349", "加载会话列表失败:", error);
        common_vendor.index.showToast({ title: "加载失败，请稍后重试", icon: "none" });
      } finally {
        this.loading = false;
        if (this.refresherTriggered) {
          this.refresherTriggered = false;
        }
      }
    },
    loadMore() {
      if (!this.finished) {
        this.loadConversations();
      }
    },
    updateStats() {
      const list = this.list || [];
      const total = list.length;
      const unreadConversations = list.filter((item) => (item.unread_count || 0) > 0).length;
      const unreadMessages = list.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);
      this.stats = {
        total: total || 0,
        unreadConversations: unreadConversations || 0,
        unreadMessages: unreadMessages || 0
      };
      common_vendor.index.__f__("log", "at pages/chat/list.vue:373", "[chat-list] 统计数据更新:", this.stats);
    },
    filterList() {
      let filtered = [...this.list];
      if (this.searchKeyword) {
        const keyword = this.searchKeyword.trim().toLowerCase();
        filtered = filtered.filter((item) => {
          const displayMessage = this.formatLastMessage(item.last_message);
          return item.name && item.name.toLowerCase().includes(keyword) || displayMessage && displayMessage.toLowerCase().includes(keyword);
        });
      }
      this.displayList = filtered;
    },
    clearSearch() {
      this.searchKeyword = "";
    },
    formatTime(timestamp) {
      if (!timestamp)
        return "";
      const date = new Date(timestamp);
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
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${month}-${day} ${hour}:${minute}`;
    },
    resolveTag(item) {
      const status = item.status || item.appointment_status;
      if (status === "pending_confirm")
        return "待老师确认";
      if (status === "pending_payment")
        return "待支付";
      if (status === "confirmed")
        return "已确认";
      if (status === "completed")
        return "已完成";
      return "";
    },
    resolveName(item, defaultName = "老师") {
      const other = item.other_user || {};
      const teacher = item.teacher_info || {};
      return other.display_name || other.nickname || teacher.display_name || defaultName;
    },
    resolveAvatar(item) {
      const other = item.other_user || {};
      const teacher = item.teacher_info || {};
      const avatars = [
        other.avatar,
        teacher.avatar,
        item.last_teacher_avatar,
        item.last_parent_avatar
      ];
      const avatar = avatars.find((src) => src && src !== this.defaultAvatarUrl);
      return avatar || this.defaultAvatarUrl;
    },
    /**
     * 格式化最后一条消息显示
     * 如果是试课邀请的JSON消息，显示为"邀请试课"
     * @param {String|Object} message - 消息内容
     * @returns {String} 格式化后的消息文本
     */
    formatLastMessage(message) {
      if (!message)
        return "";
      if (typeof message === "object") {
        message = message.content || message.text || JSON.stringify(message);
      }
      if (typeof message !== "string") {
        message = String(message);
      }
      const trimmed = message.trim();
      if (trimmed.includes("trial_invite") && (trimmed.startsWith("{") || trimmed.includes('"type"') || trimmed.includes("type"))) {
        return "邀请试课";
      }
      return message;
    },
    goToConversation(item) {
      const params = [`conversationId=${item.conversation_id}`];
      if (item.appointment_id) {
        params.push(`appointmentId=${item.appointment_id}`);
      }
      common_vendor.index.navigateTo({
        url: `/pages/chat/conversation?${params.join("&")}`
      });
    }
  }
};
if (!Array) {
  const _component_ParentTabBar = common_vendor.resolveComponent("ParentTabBar");
  _component_ParentTabBar();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.searchKeyword,
    b: common_vendor.o(($event) => $data.searchKeyword = $event.detail.value),
    c: $data.searchKeyword
  }, $data.searchKeyword ? {
    d: common_vendor.o((...args) => $options.clearSearch && $options.clearSearch(...args))
  } : {}, {
    e: $data.loading && !$data.displayList.length
  }, $data.loading && !$data.displayList.length ? {
    f: common_vendor.f(5, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : common_vendor.e({
    g: common_vendor.f($data.displayList, (item, k0, i0) => {
      return common_vendor.e({
        a: item.avatar || $data.defaultAvatarUrl,
        b: common_vendor.t(item.name),
        c: common_vendor.t($options.formatTime(item.last_message_time)),
        d: common_vendor.t($options.formatLastMessage(item.last_message) || "暂无消息"),
        e: item.unread_count > 0 ? 1 : "",
        f: item.unread_count > 0
      }, item.unread_count > 0 ? {
        g: common_vendor.t(item.unread_count > 99 ? "99+" : item.unread_count)
      } : {}, {
        h: item.conversation_id,
        i: common_vendor.o(($event) => $options.goToConversation(item), item.conversation_id)
      });
    }),
    h: !$data.loading && !$data.displayList.length
  }, !$data.loading && !$data.displayList.length ? {} : {}, {
    i: $data.loading && $data.displayList.length
  }, $data.loading && $data.displayList.length ? {} : $data.finished && $data.displayList.length ? {} : {}, {
    j: $data.finished && $data.displayList.length
  }), {
    k: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args)),
    l: common_vendor.p({
      current: "chat"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-32c40775"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/chat/list.js.map
