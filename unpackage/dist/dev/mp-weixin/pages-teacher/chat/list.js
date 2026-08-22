"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_chatPoll = require("../../utils/chatPoll.js");
const utils_chatPush = require("../../utils/chatPush.js");
const card = () => "../../components/common/card.js";
const TeacherTabBar = () => "../../components/TeacherTabBar.js";
const _sfc_main = {
  name: "TeacherChatList",
  components: {
    card,
    TeacherTabBar
  },
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
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
      useMock: false,
      pollTimer: null,
      pollInterval: utils_chatPoll.CHAT_POLL_INTERVAL.list,
      silentPolling: false
    };
  },
  watch: {
    searchKeyword() {
      this.filterList();
    }
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.resetAndLoad();
  },
  onShow() {
    if (!this.useMock) {
      this.bindChatPush();
      this.startPolling();
      this.resetAndLoad();
    }
  },
  onHide() {
    this.stopPolling();
    this.unbindChatPush();
  },
  onUnload() {
    this.stopPolling();
    this.unbindChatPush();
  },
  onShareAppMessage() {
    return {
      title: "优培信息通 · 教师家长沟通",
      path: "/pages-teacher/chat/list"
    };
  },
  onShareTimeline() {
    return {
      title: "优培信息通 · 教师家长沟通"
    };
  },
  methods: {
    bindChatPush() {
      if (this._onChatPush)
        return;
      this._onChatPush = (payload) => {
        common_vendor.index.__f__("log", "at pages-teacher/chat/list.vue:159", "[teacher-chat-list] 收到 push，刷新列表", payload);
        this.refreshConversationsSilently();
      };
      utils_chatPush.onChatPush(this._onChatPush);
    },
    unbindChatPush() {
      if (!this._onChatPush)
        return;
      utils_chatPush.offChatPush(this._onChatPush);
      this._onChatPush = null;
    },
    startPolling() {
      this.stopPolling();
      if (this.useMock)
        return;
      this.pollTimer = setInterval(() => {
        if (this.loading || this.silentPolling)
          return;
        this.refreshConversationsSilently();
      }, this.pollInterval);
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    async refreshConversationsSilently() {
      if (this.loading || this.silentPolling || this.useMock)
        return;
      this.silentPolling = true;
      try {
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.pollUpdates({ mode: "list" });
        if (res.code !== 0 || !res.data)
          return;
        const listMap = /* @__PURE__ */ new Map();
        this.list.forEach((item) => listMap.set(item.conversation_id, item));
        let hasUnknownConversation = false;
        (res.data.list || []).forEach((item) => {
          let lastMessage = "";
          if (item.last_message) {
            if (typeof item.last_message === "object") {
              lastMessage = item.last_message.content || item.last_message.text || "";
            } else {
              lastMessage = item.last_message;
            }
          }
          lastMessage = this.formatLastMessage(lastMessage);
          const prev = listMap.get(item._id);
          if (!prev)
            hasUnknownConversation = true;
          listMap.set(item._id, {
            ...prev || {},
            conversation_id: item._id,
            appointment_id: item.appointment_id,
            name: prev && prev.name || "家长",
            avatar: prev && prev.avatar || this.defaultAvatarUrl,
            last_message: lastMessage,
            last_message_time: item.last_message_time || item.update_time || Date.now(),
            unread_count: Number(item.unread_count ?? item.unread_count_teacher ?? 0),
            status: item.status
          });
        });
        this.list = Array.from(listMap.values()).sort(
          (a, b) => (b.last_message_time || 0) - (a.last_message_time || 0)
        );
        this.updateStats();
        this.filterList();
        if (hasUnknownConversation) {
          this.finished = false;
          this.$nextTick(() => this.loadConversations());
        }
      } catch (e) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/list.vue:228", "[teacher-chat-list] 静默刷新失败:", e);
      } finally {
        this.silentPolling = false;
      }
    },
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/chat/list.vue:234", "[teacher-chat-list] 下拉刷新：重新加载会话列表");
      await this.loadConversations(true);
    },
    resetAndLoad() {
      this.page = 1;
      this.finished = false;
      this.list = [];
      this.displayList = [];
      this.loadConversations();
    },
    async loadConversations() {
      var _a;
      if (this.loading || this.finished)
        return;
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
              ...item,
              last_message: lastMessage,
              unread_count: item.unread_count_teacher || item.unread_count || 0
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
            var _a2, _b, _c;
            let lastMessage = "";
            if (item.last_message) {
              if (typeof item.last_message === "object") {
                lastMessage = item.last_message.content || item.last_message.text || "";
              } else {
                lastMessage = item.last_message;
              }
            }
            lastMessage = this.formatLastMessage(lastMessage);
            return {
              conversation_id: item._id,
              appointment_id: item.appointment_id,
              name: ((_a2 = item.other_user) == null ? void 0 : _a2.nickname) || ((_b = item.other_user) == null ? void 0 : _b.display_name) || "家长",
              avatar: ((_c = item.other_user) == null ? void 0 : _c.avatar) || defaultAvatarUrl,
              last_message: lastMessage,
              last_message_time: item.last_message_time || item.update_time || Date.now(),
              unread_count: Number(item.unread_count_teacher ?? item.unread_count_parent ?? 0),
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
        common_vendor.index.__f__("error", "at pages-teacher/chat/list.vue:305", "加载会话列表失败:", error);
        common_vendor.index.showToast({ title: "加载失败，请稍后重试", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    loadMore() {
      if (!this.finished) {
        this.loadConversations();
      }
    },
    updateStats() {
      const total = this.list.length;
      const unreadConversations = this.list.filter((item) => item.unread_count > 0).length;
      const unreadMessages = this.list.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);
      this.stats = { total, unreadConversations, unreadMessages };
    },
    filterList() {
      let filtered = [...this.list];
      if (this.searchKeyword) {
        const keyword = this.searchKeyword.trim().toLowerCase();
        filtered = filtered.filter((item) => {
          const displayMessage = this.formatLastMessage(item.last_message);
          return item.name.toLowerCase().includes(keyword) || displayMessage && displayMessage.toLowerCase().includes(keyword);
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
      if (item.deposit_paid === false) {
        return "待支付";
      }
      if (item.status === "pending_confirm") {
        return "待确认";
      }
      if (item.status === "completed") {
        return "已完成";
      }
      return "";
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
      if (trimmed.includes("attendance_clock")) {
        if (trimmed.includes("clock_out"))
          return "已下课打卡";
        return "已上课打卡";
      }
      return message;
    },
    goToConversation(item) {
      common_vendor.index.navigateTo({
        url: `/pages-teacher/chat/conversation?conversationId=${item.conversation_id}`
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
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-88a60026"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/chat/list.js.map
