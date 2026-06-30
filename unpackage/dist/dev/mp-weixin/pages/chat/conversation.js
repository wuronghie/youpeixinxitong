"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_appointmentTeacherPreview = require("../../utils/appointmentTeacherPreview.js");
const _sfc_main = {
  name: "ChatConversation",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      conversationId: "",
      appointmentId: "",
      messages: [],
      inputText: "",
      useMock: false,
      loading: false,
      sending: false,
      loadingMore: false,
      refreshTipTimer: null,
      refresherTriggered: false,
      showRefreshTip: false,
      refreshTipText: "松开刷新消息",
      scrollIntoView: "",
      scrollTop: 0,
      canRefresh: true,
      currentUserRole: "parent",
      // 消息轮询定时器
      pollTimer: null,
      pollInterval: 5e3,
      // 5秒轮询一次
      currentUserInfo: {},
      otherUserInfo: {
        nickname: "",
        display_name: "",
        avatar: utils_imageConfig.getDefaultAvatarUrl(),
        title: "",
        subjects: []
      },
      conversationInfo: {},
      pagination: {
        page: 1,
        pageSize: 30,
        hasMore: true
      },
      isInitialized: false,
      // 标记是否已初始化完成
      initPromise: null
      // 保存初始化 Promise
    };
  },
  computed: {
    formattedMessages() {
      const result = [];
      let lastLabel = "";
      this.messages.forEach((msg, index) => {
        const label = this.getDateLabel(msg.send_time);
        if (label !== lastLabel) {
          lastLabel = label;
          result.push({ id: `time-${msg.message_id || index}`, type: "time", label });
        }
        result.push({ id: `msg-${index}`, type: "message", data: msg });
      });
      return result;
    },
    needWaitForTeacherReply() {
      var _a, _b, _c, _d;
      if (this.currentUserRole !== "parent") {
        return false;
      }
      const appointmentStatus = ((_b = (_a = this.conversationInfo) == null ? void 0 : _a.appointment) == null ? void 0 : _b.status) || ((_c = this.conversationInfo) == null ? void 0 : _c.appointment_status) || ((_d = this.conversationInfo) == null ? void 0 : _d.status);
      if (appointmentStatus !== "contact_request") {
        return false;
      }
      const hasTeacherMessage = this.messages.some((msg) => msg.sender_role === "teacher");
      const hasParentMessage = this.messages.some((msg) => msg.sender_role === "parent");
      return hasParentMessage && !hasTeacherMessage;
    },
    canSendMessage() {
      if (this.sending)
        return false;
      if (!this.conversationId)
        return false;
      if (!this.inputText.trim())
        return false;
      if (this.needWaitForTeacherReply)
        return false;
      return true;
    },
    otherDisplayName() {
      var _a;
      return this.otherUserInfo.display_name || this.otherUserInfo.nickname || ((_a = this.conversationInfo.teacher_info) == null ? void 0 : _a.display_name) || "老师";
    },
    otherAvatar() {
      var _a;
      return this.otherUserInfo.avatar || ((_a = this.conversationInfo.teacher_info) == null ? void 0 : _a.avatar) || utils_imageConfig.getDefaultAvatarUrl();
    }
  },
  onLoad(options) {
    this.conversationId = options.conversationId || "";
    this.appointmentId = options.appointmentId || "";
    this.useMock = utils_mockData.useMockData() === true;
    const userInfo = common_vendor.index.getStorageSync("userInfo");
    if (userInfo) {
      this.currentUserRole = userInfo.role || "parent";
      this.currentUserInfo = {
        nickname: userInfo.nickname || "我",
        avatar: userInfo.avatar || defaultAvatarUrl
      };
    }
    this.$nextTick(() => {
      setTimeout(() => {
        this.initConversation();
      }, 100);
    });
  },
  async onShow() {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.isInitialized && this.conversationId && !this.useMock) {
      this.loadNewMessages();
      this.startPolling();
    }
  },
  onHide() {
    this.stopPolling();
  },
  onUnload() {
    this.stopPolling();
    if (this.refreshTipTimer) {
      clearTimeout(this.refreshTipTimer);
      this.refreshTipTimer = null;
    }
  },
  methods: {
    /**
     * 启动消息轮询
     */
    startPolling() {
      this.stopPolling();
      if (!this.useMock && this.conversationId) {
        this.pollTimer = setInterval(() => {
          if (this.loading || this.sending) {
            return;
          }
          this.loadNewMessages();
        }, this.pollInterval);
      }
    },
    /**
     * 停止消息轮询
     */
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    async refreshData() {
      common_vendor.index.__f__("log", "at pages/chat/conversation.vue:299", "[chat-conversation] 下拉刷新：重新加载消息");
      await this.refreshMessages();
    },
    async initConversation() {
      this.initPromise = (async () => {
        try {
          if (this.appointmentId && !this.conversationId && !this.useMock) {
            try {
              const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
              const res = await chatSend.getConversation({ appointment_id: this.appointmentId });
              if (res.code === 0) {
                this.conversationId = res.data.conversation_id;
                this.conversationInfo = res.data;
                await this.loadUserInfo();
                await this.refreshMessages();
              } else {
                common_vendor.index.showToast({ title: res.message || "获取会话失败", icon: "none" });
              }
            } catch (error) {
              common_vendor.index.__f__("error", "at pages/chat/conversation.vue:319", "获取会话失败:", error);
              common_vendor.index.showToast({ title: "获取会话失败", icon: "none" });
            }
          } else {
            await this.loadUserInfo();
            await this.refreshMessages();
          }
        } finally {
          this.isInitialized = true;
          this.initPromise = null;
        }
      })();
      await this.initPromise;
    },
    async loadUserInfo() {
      try {
        if (this.useMock) {
          this.otherUserInfo = { nickname: "老师", avatar: defaultAvatarUrl };
          return;
        }
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const params = {};
        if (this.conversationId)
          params.conversation_id = this.conversationId;
        if (this.appointmentId)
          params.appointment_id = this.appointmentId;
        if (!params.conversation_id && !params.appointment_id)
          return;
        const res = await chatSend.getConversationWithUserInfo(params);
        if (res.code === 0) {
          this.conversationInfo = res.data;
          if (res.data.teacher_id) {
            this.conversationInfo.teacher_id = res.data.teacher_id;
          }
          if (res.data.current_user) {
            this.currentUserInfo = {
              nickname: res.data.current_user.nickname || "我",
              avatar: res.data.current_user.avatar || "/static/default-avatar.png"
            };
            if (res.data.current_user.role) {
              this.currentUserRole = res.data.current_user.role;
            }
          }
          if (res.data.other_user) {
            this.otherUserInfo = {
              nickname: res.data.other_user.nickname || "",
              display_name: res.data.other_user.display_name || "",
              avatar: res.data.other_user.avatar || "/static/default-avatar.png",
              title: res.data.other_user.title || "",
              subjects: res.data.other_user.subjects || []
            };
          }
          if (res.data.teacher_info) {
            this.conversationInfo.teacher_info = res.data.teacher_info;
            if (res.data.teacher_info.teacher_id && !this.conversationInfo.teacher_id) {
              this.conversationInfo.teacher_id = res.data.teacher_info.teacher_id;
            }
          }
          if (!this.conversationId && res.data.conversation_id) {
            this.conversationId = res.data.conversation_id;
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:379", "加载用户信息失败:", error);
      }
    },
    async refreshMessages() {
      if (!this.conversationId) {
        return;
      }
      this.pagination.page = 1;
      this.pagination.hasMore = true;
      this.messages = [];
      await this.fetchMessages({ page: 1, reset: true });
      if (!this.messages.length) {
        await this.loadMessagesFromAppointment();
      }
    },
    async loadNewMessages() {
      var _a, _b;
      if (!this.conversationId || this.useMock) {
        return;
      }
      if (this.loading) {
        return;
      }
      try {
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.getMessages({
          conversation_id: this.conversationId,
          page: 1,
          pageSize: this.pagination.pageSize
        });
        if (res.code === 0 && res.data && res.data.messages) {
          const fetchedMessages = (res.data.messages || []).map((msg) => ({
            message_id: msg.message_id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            sender_role: msg.sender_role,
            content: msg.content,
            send_time: msg.send_time,
            is_read: msg.is_read
          }));
          if (this.messages.length > 0) {
            const messageMap = /* @__PURE__ */ new Map();
            this.messages.forEach((msg) => {
              messageMap.set(msg.message_id, msg);
            });
            fetchedMessages.forEach((msg) => {
              messageMap.set(msg.message_id, msg);
            });
            const mergedMessages = Array.from(messageMap.values()).sort((a, b) => a.send_time - b.send_time);
            if (mergedMessages.length !== this.messages.length || ((_a = mergedMessages[mergedMessages.length - 1]) == null ? void 0 : _a.message_id) !== ((_b = this.messages[this.messages.length - 1]) == null ? void 0 : _b.message_id)) {
              this.messages = mergedMessages;
              this.$nextTick(() => {
                if (this.messages.length > 0) {
                  this.scrollIntoView = `msg-${this.messages.length - 1}`;
                }
              });
            }
          } else {
            this.messages = fetchedMessages.sort((a, b) => a.send_time - b.send_time);
            this.$nextTick(() => {
              if (this.messages.length > 0) {
                this.scrollIntoView = `msg-${this.messages.length - 1}`;
              }
            });
          }
          await chatSend.markRead({ conversation_id: this.conversationId });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:463", "加载新消息失败:", error);
        if (this.messages.length === 0) {
          await this.refreshMessages();
        }
      }
    },
    async loadHistory() {
      if (!this.pagination.hasMore || this.loadingMore || this.useMock) {
        return;
      }
      this.loadingMore = true;
      await this.fetchMessages({ page: this.pagination.page + 1, prepend: true });
      this.loadingMore = false;
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
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return;
        }
        await Promise.all([this.refreshConversationInfo(), this.refreshMessages()]);
        this.showRefreshTipWithText("刷新完成");
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:501", "刷新失败:", error);
        common_vendor.index.showToast({ title: "刷新失败，请稍后再试", icon: "none" });
        this.showRefreshTipWithText("刷新失败");
      } finally {
        this.refresherTriggered = false;
      }
    },
    showRefreshTipWithText(text) {
      this.refreshTipText = text;
      this.showRefreshTip = true;
      if (this.refreshTipTimer) {
        clearTimeout(this.refreshTipTimer);
      }
      this.refreshTipTimer = setTimeout(() => {
        this.showRefreshTip = false;
        this.refreshTipTimer = null;
      }, 800);
    },
    async refreshConversationInfo() {
      var _a;
      if (!this.conversationId || this.useMock)
        return;
      try {
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.getConversationWithUserInfo({
          conversation_id: this.conversationId
        });
        if (res.code === 0 && res.data) {
          if (res.data.other_user) {
            this.otherUserInfo = {
              nickname: res.data.other_user.nickname || "",
              display_name: res.data.other_user.display_name || "",
              avatar: res.data.other_user.avatar || "/static/default-avatar.png",
              title: res.data.other_user.title || "",
              subjects: res.data.other_user.subjects || []
            };
          }
          this.conversationInfo = res.data;
          if (res.data.teacher_id) {
            this.conversationInfo.teacher_id = res.data.teacher_id;
          }
          if (((_a = res.data.teacher_info) == null ? void 0 : _a.teacher_id) && !this.conversationInfo.teacher_id) {
            this.conversationInfo.teacher_id = res.data.teacher_info.teacher_id;
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:545", "刷新会话信息失败:", error);
      }
    },
    async fetchMessages({ page = 1, reset = false, prepend = false } = {}) {
      if (!this.conversationId)
        return;
      try {
        if (this.useMock) {
          const mockData = utils_mockData.mockMessages.filter((msg) => msg.conversation_id === this.conversationId).sort((a, b) => a.send_time - b.send_time);
          this.messages = mockData;
          return;
        }
        if (this.loading)
          return;
        this.loading = true;
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.getMessages({
          conversation_id: this.conversationId,
          page,
          pageSize: this.pagination.pageSize
        });
        if (res.code === 0 && res.data) {
          const fetched = (res.data.messages || []).map((msg) => ({
            message_id: msg.message_id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            sender_role: msg.sender_role,
            content: msg.content,
            send_time: msg.send_time,
            is_read: msg.is_read
          }));
          if (prepend) {
            this.messages = [...fetched, ...this.messages];
            this.pagination.page = page;
            this.$nextTick(() => {
              if (fetched.length > 0) {
                this.scrollIntoView = `msg-${fetched.length}`;
              }
            });
          } else {
            this.messages = fetched;
            this.pagination.page = page;
            this.$nextTick(() => {
              if (this.messages.length > 0) {
                this.scrollIntoView = `msg-${this.messages.length - 1}`;
              }
            });
          }
          this.pagination.hasMore = !!res.data.hasMore;
          if (!prepend) {
            await chatSend.markRead({ conversation_id: this.conversationId });
          }
        } else {
          common_vendor.index.showToast({ title: res.message || "消息加载失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:607", "加载消息失败:", error);
        common_vendor.index.showToast({ title: "加载失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    async loadMessagesFromAppointment() {
      var _a;
      if (this.useMock || !this.appointmentId)
        return;
      try {
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.getConversation({ appointment_id: this.appointmentId });
        if (res.code === 0 && ((_a = res.data) == null ? void 0 : _a.conversation_id)) {
          this.conversationId = res.data.conversation_id;
          this.conversationInfo = res.data;
          await this.fetchMessages({ page: 1, reset: true });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:624", "通过预约加载消息失败:", error);
      }
    },
    async sendMessage() {
      if (!this.inputText.trim() || this.sending || !this.conversationId)
        return;
      const content = this.inputText.trim();
      this.inputText = "";
      const tempMsg = {
        message_id: `temp_${Date.now()}`,
        conversation_id: this.conversationId,
        sender_role: this.currentUserRole,
        content,
        send_time: Date.now(),
        is_read: false
      };
      this.messages = [...this.messages, tempMsg];
      this.$nextTick(() => {
        this.scrollIntoView = `msg-${this.messages.length - 1}`;
      });
      if (this.useMock) {
        return;
      }
      try {
        this.sending = true;
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.send({
          conversation_id: this.conversationId,
          message_type: "text",
          content
        });
        if (res.code === 0) {
          const index = this.messages.findIndex((msg) => msg.message_id === tempMsg.message_id);
          if (index !== -1) {
            this.messages.splice(index, 1, {
              ...tempMsg,
              message_id: res.data.message_id,
              send_time: res.data.send_time
            });
          }
          setTimeout(() => {
            if (!this.loading && !this.sending) {
              this.loadNewMessages();
            }
          }, 1e3);
        } else {
          this.rollbackTempMessage(tempMsg.message_id, res.message);
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:676", "发送消息失败:", error);
        this.rollbackTempMessage(tempMsg.message_id);
      } finally {
        this.sending = false;
      }
    },
    rollbackTempMessage(tempId, message = "发送失败，请稍后再试") {
      const index = this.messages.findIndex((msg) => msg.message_id === tempId);
      if (index !== -1) {
        this.messages.splice(index, 1);
      }
      common_vendor.index.showToast({ title: message, icon: "none" });
    },
    getDateLabel(timestamp) {
      const date = new Date(timestamp);
      const today = /* @__PURE__ */ new Date();
      const diff = today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0);
      if (diff === 0) {
        return `今天 ${this.formatTime(timestamp)}`;
      }
      if (diff === 864e5) {
        return `昨天 ${this.formatTime(timestamp)}`;
      }
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${month}-${day} ${hour}:${minute}`;
    },
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${hour}:${minute}`;
    },
    formatStatus(status) {
      const map = {
        pending_confirm: "待老师确认",
        pending_payment: "待支付",
        confirmed: "进行中",
        completed: "已完成"
      };
      return map[status] || "沟通中";
    },
    goBack() {
      common_vendor.index.navigateBack();
    },
    /**
     * 判断消息是否为试课邀请消息
     * @param {Object} msg - 消息对象
     * @returns {Boolean}
     */
    isTrialInviteMessage(msg) {
      if (!msg || !msg.content)
        return false;
      try {
        const parsed = JSON.parse(msg.content);
        return parsed && parsed.type === "trial_invite" && parsed.invite_id;
      } catch (e) {
        return false;
      }
    },
    /**
     * 从邀请消息中提取邀请ID
     * @param {Object} msg - 消息对象
     * @returns {String}
     */
    getInviteIdFromMessage(msg) {
      if (!this.isTrialInviteMessage(msg))
        return "";
      try {
        const parsed = JSON.parse(msg.content);
        return parsed.invite_id || "";
      } catch (e) {
        return "";
      }
    },
    /**
     * 处理接受邀请（点击邀请卡片）
     * @param {Object} msg - 邀请消息对象
     */
    handleAcceptInvite(msg) {
      var _a, _b, _c;
      const inviteId = this.getInviteIdFromMessage(msg);
      if (!inviteId) {
        common_vendor.index.showToast({ title: "邀请信息无效", icon: "none" });
        return;
      }
      const teacherInfo = ((_a = this.conversationInfo) == null ? void 0 : _a.teacher_info) || {};
      utils_appointmentTeacherPreview.saveAppointmentTeacherPreview({
        teacherUid: ((_b = this.conversationInfo) == null ? void 0 : _b.teacher_id) || teacherInfo.teacher_id || "",
        teacher_id: ((_c = this.conversationInfo) == null ? void 0 : _c.teacher_id) || teacherInfo.teacher_id || "",
        display_name: teacherInfo.display_name || teacherInfo.name || this.otherUserInfo.display_name || this.otherUserInfo.nickname || "",
        name: teacherInfo.name || teacherInfo.display_name || this.otherUserInfo.nickname || "",
        nickname: this.otherUserInfo.nickname || "",
        avatar: teacherInfo.avatar || this.otherUserInfo.avatar || "",
        hourly_rate: teacherInfo.hourly_rate
      });
      common_vendor.index.navigateTo({
        url: `/pages/appointment/create?invite_id=${inviteId}`
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.goBack && $options.goBack(...args)),
    b: $options.otherAvatar,
    c: common_vendor.t($options.otherDisplayName),
    d: $data.pagination.hasMore && !$data.loadingMore
  }, $data.pagination.hasMore && !$data.loadingMore ? {
    e: common_vendor.o((...args) => $options.loadHistory && $options.loadHistory(...args))
  } : $data.loadingMore ? {} : {}, {
    f: $data.loadingMore,
    g: common_vendor.f($options.formattedMessages, (item, k0, i0) => {
      return common_vendor.e({
        a: item.type === "time"
      }, item.type === "time" ? {
        b: common_vendor.t(item.label)
      } : $options.isTrialInviteMessage(item.data) ? common_vendor.e({
        d: item.data.sender_role !== $data.currentUserRole
      }, item.data.sender_role !== $data.currentUserRole ? {
        e: common_vendor.o(($event) => $options.handleAcceptInvite(item.data), item.id)
      } : {}) : common_vendor.e({
        f: item.data.sender_role !== $data.currentUserRole
      }, item.data.sender_role !== $data.currentUserRole ? {
        g: $options.otherAvatar,
        h: common_vendor.t(item.data.content)
      } : {
        i: common_vendor.t(item.data.content),
        j: $data.currentUserInfo.avatar || _ctx.defaultAvatarUrl
      }, {
        k: item.data.sender_role === $data.currentUserRole ? 1 : ""
      }), {
        c: $options.isTrialInviteMessage(item.data),
        l: item.id,
        m: item.id
      });
    }),
    h: !$options.formattedMessages.length && !$data.loading
  }, !$options.formattedMessages.length && !$data.loading ? {} : {}, {
    i: $data.scrollIntoView,
    j: common_vendor.o((...args) => $options.handleScroll && $options.handleScroll(...args)),
    k: $options.needWaitForTeacherReply
  }, $options.needWaitForTeacherReply ? {} : {}, {
    l: $options.needWaitForTeacherReply ? "请等待老师回复..." : "请输入聊天内容...",
    m: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args)),
    n: $data.sending || $options.needWaitForTeacherReply,
    o: $data.inputText,
    p: common_vendor.o(($event) => $data.inputText = $event.detail.value),
    q: common_vendor.t($data.sending ? "发送中" : "发送"),
    r: $options.canSendMessage ? 1 : "",
    s: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-ad2b89bd"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/chat/conversation.js.map
