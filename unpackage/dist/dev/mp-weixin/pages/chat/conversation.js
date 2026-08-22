"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_appointmentTeacherPreview = require("../../utils/appointmentTeacherPreview.js");
const utils_chatPoll = require("../../utils/chatPoll.js");
const utils_chatPush = require("../../utils/chatPush.js");
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
      // 消息轮询定时器（push 为主，长间隔兜底）
      pollTimer: null,
      pollInterval: utils_chatPoll.CHAT_POLL_INTERVAL.conversation,
      currentUserInfo: {},
      otherUserInfo: {
        nickname: "",
        display_name: "",
        avatar: utils_imageConfig.getDefaultAvatarUrl(),
        title: "",
        subjects: []
      },
      conversationInfo: {},
      trialInviteStatusMap: {},
      rejectingInviteIds: {},
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
    pendingPaymentInviteId() {
      const entries = Object.entries(this.trialInviteStatusMap || {});
      const hit = entries.find(([, item]) => item && item.status === "pending_payment");
      return hit ? hit[0] : "";
    },
    needPayTrialFee() {
      return this.currentUserRole === "parent" && !!this.pendingPaymentInviteId;
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
    this.conversationId = options.conversationId || options.conversation_id || options.id || "";
    this.appointmentId = options.appointmentId || options.appointment_id || "";
    this.useMock = utils_mockData.useMockData() === true;
    const userInfo = common_vendor.index.getStorageSync("userInfo");
    if (userInfo) {
      this.currentUserRole = userInfo.role || "parent";
      this.currentUserInfo = {
        nickname: userInfo.nickname || "我",
        avatar: userInfo.avatar || defaultAvatarUrl
      };
    }
    this.initConversation();
  },
  async onShow() {
    if (!this.isInitialized && !this.initPromise) {
      this.initConversation();
    }
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.isInitialized && this.conversationId && !this.useMock) {
      common_vendor.index.__f__("log", "at pages/chat/conversation.vue:286", "[parent-chat] onShow 就绪，绑定 push，conversationId=", this.conversationId);
      this.loadNewMessages();
      this.startPolling();
      this.bindChatPush();
    } else {
      common_vendor.index.__f__("warn", "at pages/chat/conversation.vue:291", "[parent-chat] onShow 未绑定 push", {
        isInitialized: this.isInitialized,
        conversationId: this.conversationId,
        useMock: this.useMock
      });
    }
  },
  onHide() {
    this.stopPolling();
    this.unbindChatPush();
  },
  onUnload() {
    this.stopPolling();
    this.unbindChatPush();
    if (this.refreshTipTimer) {
      clearTimeout(this.refreshTipTimer);
      this.refreshTipTimer = null;
    }
  },
  methods: {
    bindChatPush() {
      if (this._onChatPush) {
        common_vendor.index.__f__("log", "at pages/chat/conversation.vue:315", "[parent-chat] push 已绑定，跳过");
        return;
      }
      this._onChatPush = (payload) => {
        common_vendor.index.__f__("log", "at pages/chat/conversation.vue:319", "[parent-chat] 收到 push，准备拉增量", payload, "当前会话=", this.conversationId);
        if (!this.conversationId)
          return;
        if (payload && payload.conversation_id && payload.conversation_id !== this.conversationId) {
          common_vendor.index.__f__("log", "at pages/chat/conversation.vue:322", "[parent-chat] 非本会话 push，忽略");
          return;
        }
        this.loadNewMessages();
      };
      utils_chatPush.onChatPush(this._onChatPush);
      common_vendor.index.__f__("log", "at pages/chat/conversation.vue:328", "[parent-chat] 已订阅 chat:push");
    },
    unbindChatPush() {
      if (!this._onChatPush)
        return;
      utils_chatPush.offChatPush(this._onChatPush);
      this._onChatPush = null;
      common_vendor.index.__f__("log", "at pages/chat/conversation.vue:334", "[parent-chat] 已取消订阅 chat:push");
    },
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
          this.loadTrialInviteStatuses();
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
      common_vendor.index.__f__("log", "at pages/chat/conversation.vue:365", "[chat-conversation] 下拉刷新：重新加载消息");
      await this.refreshMessages();
    },
    async initConversation() {
      if (this.initPromise)
        return this.initPromise;
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
              common_vendor.index.__f__("error", "at pages/chat/conversation.vue:385", "获取会话失败:", error);
              common_vendor.index.showToast({ title: "获取会话失败", icon: "none" });
            }
          } else {
            await this.loadUserInfo();
            await this.refreshMessages();
          }
        } finally {
          this.isInitialized = true;
        }
      })();
      try {
        await this.initPromise;
      } finally {
        this.initPromise = null;
      }
      return true;
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
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:449", "加载用户信息失败:", error);
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
      if (!this.conversationId || this.useMock) {
        return;
      }
      if (this.loading || this.sending) {
        common_vendor.index.__f__("log", "at pages/chat/conversation.vue:470", "[parent-chat] loadNewMessages 跳过：loading/sending", this.loading, this.sending);
        return;
      }
      try {
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const sinceTime = this.messages.length ? Number(this.messages[this.messages.length - 1].send_time || 0) : 0;
        common_vendor.index.__f__("log", "at pages/chat/conversation.vue:479", "[parent-chat] loadNewMessages since=", sinceTime);
        const res = await chatSend.pollUpdates({
          mode: "conversation",
          conversation_id: this.conversationId,
          since_time: sinceTime
        });
        common_vendor.index.__f__("log", "at pages/chat/conversation.vue:485", "[parent-chat] loadNewMessages 结果=", res && res.code, "条数=", res && res.data && (res.data.messages || []).length);
        if (res.code !== 0 || !res.data) {
          return;
        }
        const fetchedMessages = (res.data.messages || []).map((msg) => ({
          message_id: msg.message_id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          sender_role: msg.sender_role,
          content: msg.content,
          send_time: msg.send_time,
          is_read: msg.is_read
        }));
        if (!fetchedMessages.length) {
          return;
        }
        const messageMap = /* @__PURE__ */ new Map();
        this.messages.forEach((msg) => messageMap.set(msg.message_id, msg));
        let hasBrandNew = false;
        fetchedMessages.forEach((msg) => {
          if (!messageMap.has(msg.message_id))
            hasBrandNew = true;
          messageMap.set(msg.message_id, msg);
        });
        if (!hasBrandNew && this.messages.length > 0) {
          return;
        }
        this.messages = Array.from(messageMap.values()).sort((a, b) => a.send_time - b.send_time);
        this.$nextTick(() => {
          if (this.messages.length > 0) {
            this.scrollIntoView = `msg-${this.messages.length - 1}`;
          }
        });
        const hasIncoming = fetchedMessages.some((msg) => msg.sender_id && msg.sender_role !== "parent");
        if (hasIncoming || sinceTime === 0) {
          await chatSend.markRead({ conversation_id: this.conversationId });
          utils_chatPush.refreshChatBadge("parent-conversation-poll");
        }
        this.loadTrialInviteStatuses();
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:532", "加载新消息失败:", error);
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
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:569", "刷新失败:", error);
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
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:613", "刷新会话信息失败:", error);
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
            utils_chatPush.refreshChatBadge("parent-conversation-open");
            this.loadTrialInviteStatuses();
          }
        } else {
          common_vendor.index.showToast({ title: res.message || "消息加载失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:677", "加载消息失败:", error);
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
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:694", "通过预约加载消息失败:", error);
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
        common_vendor.index.__f__("log", "at pages/chat/conversation.vue:727", "[parent-chat] send 返回=", res);
        common_vendor.index.__f__("log", "at pages/chat/conversation.vue:728", "[parent-chat] push 调试=", res.data && res.data.push);
        if (res.code === 0) {
          const pushInfo = res.data && res.data.push || {};
          if (pushInfo.error || !(pushInfo.cids && pushInfo.cids.length)) {
            common_vendor.index.__f__("warn", "at pages/chat/conversation.vue:732", "[parent-chat] 推送可能未成功送达对方:", pushInfo);
          } else {
            common_vendor.index.__f__("log", "at pages/chat/conversation.vue:734", "[parent-chat] 已触发推送 → receiver=", res.data.receiver_id, "cids=", pushInfo.cids);
          }
          const index = this.messages.findIndex((msg) => msg.message_id === tempMsg.message_id);
          if (index !== -1) {
            this.messages.splice(index, 1, {
              ...tempMsg,
              message_id: res.data.message_id,
              send_time: res.data.send_time
            });
          }
        } else {
          this.rollbackTempMessage(tempMsg.message_id, res.message);
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/chat/conversation.vue:748", "发送消息失败:", error);
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
    parseAttendanceClockPayload(msg) {
      if (!msg || !msg.content)
        return null;
      try {
        const parsed = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
        if (parsed && parsed.type === "attendance_clock")
          return parsed;
      } catch (e) {
        return null;
      }
      return null;
    },
    isAttendanceClockMessage(msg) {
      return !!this.parseAttendanceClockPayload(msg);
    },
    getAttendanceClockIcon(msg) {
      const p = this.parseAttendanceClockPayload(msg);
      return p && p.action === "clock_out" ? "🏁" : "📍";
    },
    getAttendanceClockTitle(msg) {
      const p = this.parseAttendanceClockPayload(msg);
      return p && p.title || "打卡提醒";
    },
    getAttendanceClockTime(msg) {
      const p = this.parseAttendanceClockPayload(msg);
      const ts = Number(p && p.clock_time);
      if (!ts)
        return "-";
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    getAttendanceClockAddress(msg) {
      const p = this.parseAttendanceClockPayload(msg);
      return p && p.address || "";
    },
    getAttendanceClockTip(msg) {
      const p = this.parseAttendanceClockPayload(msg);
      return p && p.tip || "点击查看预约详情";
    },
    goAttendanceAppointment(msg) {
      const p = this.parseAttendanceClockPayload(msg);
      const id = p && p.appointment_id || this.appointmentId;
      if (!id) {
        common_vendor.index.showToast({ title: "未关联预约", icon: "none" });
        return;
      }
      common_vendor.index.navigateTo({ url: `/pages/appointment/detail?id=${id}` });
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
    canRespondTrialInvite(msg) {
      var _a;
      if (msg.sender_role === this.currentUserRole)
        return false;
      const inviteId = this.getInviteIdFromMessage(msg);
      if (!inviteId || this.rejectingInviteIds[inviteId])
        return false;
      return ((_a = this.trialInviteStatusMap[inviteId]) == null ? void 0 : _a.status) === "trial_invited";
    },
    getTrialInviteStatusText(msg) {
      const inviteId = this.getInviteIdFromMessage(msg);
      const info = this.trialInviteStatusMap[inviteId] || {};
      const status = info.status;
      if (status === "trial_invited") {
        return msg.sender_role === this.currentUserRole ? "已发送邀请" : "待处理邀请";
      }
      if (status === "rejected")
        return "已不通过";
      if (status === "pending_payment")
        return "已通过，待支付试课费";
      if (status === "pending_confirm")
        return "已支付，等待老师确认";
      if (["confirmed", "in_progress"].includes(status)) {
        return info.parent_paid ? "试课费已支付，请按约定时间上课" : "已通过";
      }
      if (status === "completed")
        return "试课已完成";
      if (status)
        return "邀请已处理";
      return "加载中...";
    },
    async loadTrialInviteStatuses() {
      const inviteIds = Array.from(new Set((this.messages || []).map((msg) => this.getInviteIdFromMessage(msg)).filter(Boolean)));
      if (!inviteIds.length || this.useMock)
        return;
      try {
        const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const entries = await Promise.all(inviteIds.map(async (inviteId) => {
          try {
            const res = await appointmentQuery.getAppointmentDetail({ appointment_id: inviteId });
            if (res.code === 0 && res.data) {
              return [inviteId, {
                status: res.data.status,
                parent_paid: !!res.data.parent_paid,
                total_amount: Number(res.data.total_amount || 0)
              }];
            }
          } catch (e) {
            common_vendor.index.__f__("warn", "at pages/chat/conversation.vue:911", "[chat-conversation] 加载试课邀请状态失败:", inviteId, e);
          }
          return [inviteId, this.trialInviteStatusMap[inviteId] || { status: "" }];
        }));
        const nextMap = { ...this.trialInviteStatusMap };
        entries.forEach(([inviteId, item]) => {
          nextMap[inviteId] = item;
        });
        this.trialInviteStatusMap = nextMap;
      } catch (e) {
        common_vendor.index.__f__("warn", "at pages/chat/conversation.vue:921", "[chat-conversation] 批量加载试课邀请状态失败:", e);
      }
    },
    goPayTrialFee() {
      const inviteId = this.pendingPaymentInviteId || this.appointmentId;
      if (!inviteId) {
        common_vendor.index.showToast({ title: "未找到待支付试课", icon: "none" });
        return;
      }
      common_vendor.index.navigateTo({
        url: `/pages/appointment/detail?id=${inviteId}`
      });
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
    },
    async handleRejectInvite(msg) {
      const inviteId = this.getInviteIdFromMessage(msg);
      if (!inviteId) {
        common_vendor.index.showToast({ title: "邀请信息无效", icon: "none" });
        return;
      }
      if (this.rejectingInviteIds[inviteId])
        return;
      common_vendor.index.showModal({
        title: "不通过试课邀请",
        content: "确认不通过本次试课邀请？老师之后可以重新发起邀请。",
        success: async (modalRes) => {
          if (!modalRes.confirm)
            return;
          this.rejectingInviteIds = { ...this.rejectingInviteIds, [inviteId]: true };
          try {
            const appointmentCreate = common_vendor.tr.importObject("appointment-create", { customUI: true });
            const res = await appointmentCreate.rejectTrialInvite({ invite_id: inviteId });
            if (res.code !== 0) {
              common_vendor.index.showToast({ title: res.message || "操作失败", icon: "none" });
              return;
            }
            this.trialInviteStatusMap = {
              ...this.trialInviteStatusMap,
              [inviteId]: { status: "rejected" }
            };
            common_vendor.index.showToast({ title: "已不通过", icon: "success" });
            setTimeout(() => this.loadNewMessages(), 500);
          } catch (e) {
            common_vendor.index.__f__("error", "at pages/chat/conversation.vue:985", "拒绝试课邀请失败:", e);
            common_vendor.index.showToast({ title: "操作失败，请稍后再试", icon: "none" });
          } finally {
            const next = { ...this.rejectingInviteIds };
            delete next[inviteId];
            this.rejectingInviteIds = next;
          }
        }
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
        d: $options.canRespondTrialInvite(item.data)
      }, $options.canRespondTrialInvite(item.data) ? {
        e: common_vendor.o(($event) => $options.handleRejectInvite(item.data), item.id),
        f: common_vendor.o(($event) => $options.handleAcceptInvite(item.data), item.id)
      } : {
        g: common_vendor.t($options.getTrialInviteStatusText(item.data))
      }) : $options.isAttendanceClockMessage(item.data) ? common_vendor.e({
        i: common_vendor.t($options.getAttendanceClockIcon(item.data)),
        j: common_vendor.t($options.getAttendanceClockTitle(item.data)),
        k: common_vendor.t($options.getAttendanceClockTime(item.data)),
        l: $options.getAttendanceClockAddress(item.data)
      }, $options.getAttendanceClockAddress(item.data) ? {
        m: common_vendor.t($options.getAttendanceClockAddress(item.data))
      } : {}, {
        n: common_vendor.t($options.getAttendanceClockTip(item.data)),
        o: common_vendor.o(($event) => $options.goAttendanceAppointment(item.data), item.id)
      }) : common_vendor.e({
        p: item.data.sender_role !== $data.currentUserRole
      }, item.data.sender_role !== $data.currentUserRole ? {
        q: $options.otherAvatar,
        r: common_vendor.t(item.data.content)
      } : {
        s: common_vendor.t(item.data.content),
        t: $data.currentUserInfo.avatar || _ctx.defaultAvatarUrl
      }, {
        v: item.data.sender_role === $data.currentUserRole ? 1 : ""
      }), {
        c: $options.isTrialInviteMessage(item.data),
        h: $options.isAttendanceClockMessage(item.data),
        w: item.id,
        x: item.id
      });
    }),
    h: !$options.formattedMessages.length && !$data.loading
  }, !$options.formattedMessages.length && !$data.loading ? {} : {}, {
    i: $data.scrollIntoView,
    j: common_vendor.o((...args) => $options.handleScroll && $options.handleScroll(...args)),
    k: $options.needPayTrialFee
  }, $options.needPayTrialFee ? {
    l: common_vendor.o((...args) => $options.goPayTrialFee && $options.goPayTrialFee(...args))
  } : {}, {
    m: $options.needWaitForTeacherReply
  }, $options.needWaitForTeacherReply ? {} : {}, {
    n: $options.needWaitForTeacherReply ? "请等待老师回复..." : "请输入聊天内容...",
    o: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args)),
    p: $data.sending || $options.needWaitForTeacherReply,
    q: $data.inputText,
    r: common_vendor.o(($event) => $data.inputText = $event.detail.value),
    s: common_vendor.t($data.sending ? "发送中" : "发送"),
    t: $options.canSendMessage ? 1 : "",
    v: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-ad2b89bd"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/chat/conversation.js.map
