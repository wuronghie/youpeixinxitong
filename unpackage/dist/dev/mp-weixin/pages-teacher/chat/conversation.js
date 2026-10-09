"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const pagesTeacher_utils_appointmentTeacherPreview = require("../utils/appointmentTeacherPreview.js");
const pagesTeacher_utils_payment = require("../utils/payment.js");
const utils_chatPoll = require("../../utils/chatPoll.js");
const utils_chatPush = require("../../utils/chatPush.js");
const _sfc_main = {
  name: "TeacherChatConversation",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl(),
      conversationId: "",
      appointmentId: "",
      messages: [],
      inputText: "",
      useMock: false,
      loading: false,
      sending: false,
      loadingMore: false,
      scrollIntoView: "",
      currentUserRole: "teacher",
      currentUserInfo: {},
      otherUserInfo: {},
      conversationInfo: {},
      inviteSource: "",
      trialInviteStatusMap: {},
      payingDeposit: false,
      couponPreview: null,
      couponLoading: false,
      ignorePayUntil: 0,
      invitingTrial: false,
      // 是否正在发送试课邀请
      hasTrialSuccess: false,
      // 与当前家长是否已有试课成功记录
      hasActiveTrial: false,
      // 是否有进行中的试课
      showTrialFeeModal: false,
      trialInviteHourlyRateInput: "",
      pendingInviteParentId: "",
      pagination: {
        page: 1,
        pageSize: 30,
        hasMore: true
      },
      isInitialized: false,
      // 标记是否已初始化完成
      pollTimer: null,
      pollInterval: utils_chatPoll.CHAT_POLL_INTERVAL.conversation,
      initPromise: null,
      // 保存初始化 Promise
      // 老师端自身课时费（元/小时），用于计算信息费 = 课时费 × 2
      teacherHourlyRate: 0,
      // 招募场景：按家长预算下限计算信息费
      recruitmentHourlyRate: 0
    };
  },
  computed: {
    // 信息费金额（元）= 课时费 × 2（一节试课 2 小时）；招募按家长下限，其余按老师定价
    infoFeeAmount() {
      const rate = Number(this.recruitmentHourlyRate) > 0 ? Number(this.recruitmentHourlyRate) : Number(this.teacherHourlyRate) || 0;
      const fee = rate > 0 ? Number((rate * 2).toFixed(2)) : 0;
      return fee > 0 ? fee : 1;
    },
    depositFeeHint() {
      if (Number(this.recruitmentHourlyRate) > 0) {
        return `招募信息费 = 家长预算下限 ¥${Number(this.recruitmentHourlyRate)} × 2。可用优惠券抵扣。`;
      }
      return "信息费 = 课时费 × 2。可用优惠券抵扣。";
    },
    trialInviteTotalAmount() {
      const rate = Number(this.trialInviteHourlyRateInput) || 0;
      if (rate <= 0)
        return "0.00";
      return (rate * 2).toFixed(2);
    },
    infoFeeAmountCents() {
      return Math.round(this.payableInfoFeeAmount * 100);
    },
    canUseCoupon() {
      return this.infoFeeAmount > 0;
    },
    payableInfoFeeAmount() {
      if (!this.couponPreview)
        return this.infoFeeAmount;
      const payable = Number(this.couponPreview.payableAmount || 0);
      return payable >= 0 ? payable : this.infoFeeAmount;
    },
    couponDiscountAmount() {
      if (!this.couponPreview)
        return 0;
      return Number(this.couponPreview.discountAmount || 0);
    },
    couponDisplayText() {
      if (!this.canUseCoupon)
        return "暂无可用优惠券";
      if (this.couponPreview && this.couponPreview.couponName) {
        const discount = Number(this.couponDiscountAmount || 0);
        return discount > 0 ? `${this.couponPreview.couponName} 已减¥${discount.toFixed(2)}` : this.couponPreview.couponName;
      }
      return "请选择优惠券";
    },
    payDepositButtonText() {
      if (this.payingDeposit)
        return "支付中...";
      const payable = Number(this.payableInfoFeeAmount || 0);
      if (this.couponPreview && payable <= 0)
        return "确认支付（优惠券全额抵扣）";
      return `支付信息费（¥${payable.toFixed(2)}）`;
    },
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
    needPayDeposit() {
      if (!this.isInitialized)
        return false;
      if (this.currentUserRole !== "teacher")
        return false;
      return this.conversationInfo.chat_enabled !== true;
    },
    waitingParentPay() {
      if (!this.isInitialized)
        return false;
      if (this.currentUserRole !== "teacher")
        return false;
      return Object.values(this.trialInviteStatusMap || {}).some((item) => item && item.status === "pending_payment");
    },
    canSend() {
      if (!this.isInitialized)
        return false;
      if (!this.conversationInfo.chat_enabled) {
        return false;
      }
      return true;
    },
    canSendMessage() {
      if (this.sending)
        return false;
      if (!this.conversationId)
        return false;
      if (!this.inputText.trim())
        return false;
      if (!this.canSend)
        return false;
      return true;
    },
    canShowInviteTrial() {
      var _a;
      if (this.currentUserRole !== "teacher")
        return false;
      if (!this.conversationId)
        return false;
      const parentId = this.conversationInfo.parent_id || ((_a = this.otherUserInfo) == null ? void 0 : _a.user_id);
      if (this.hasTrialSuccess)
        return false;
      if (this.hasActiveTrial)
        return false;
      return !!parentId;
    }
  },
  onLoad(options) {
    this.conversationId = options.conversationId || options.conversation_id || options.id || "";
    this.appointmentId = options.appointmentId || options.appointment_id || "";
    this.inviteSource = options.inviteSource || "";
    this.useMock = utils_mockData.useMockData() === true;
    const userInfo = common_vendor.index.getStorageSync("userInfo");
    if (userInfo) {
      this.currentUserRole = userInfo.role || "teacher";
      this.currentUserInfo = {
        nickname: userInfo.nickname || "我",
        avatar: userInfo.avatar || this.defaultAvatarUrl
      };
    }
    this.initConversation().then(() => this.loadRecruitmentHourlyRate());
    this.loadTeacherHourlyRate();
    this.syncNavTitle();
  },
  async onShow() {
    if (!this.isInitialized && !this.initPromise) {
      this.initConversation();
    }
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.isInitialized && this.conversationId && !this.useMock) {
      common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:406", "[teacher-chat] onShow 就绪，绑定 push，conversationId=", this.conversationId);
      this.loadNewMessages();
      this.loadTrialInviteStatuses();
      this.startPolling();
      this.bindChatPush();
    } else {
      common_vendor.index.__f__("warn", "at pages-teacher/chat/conversation.vue:412", "[teacher-chat] onShow 未绑定 push", {
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
  },
  methods: {
    bindChatPush() {
      if (this._onChatPush)
        return;
      this._onChatPush = (payload) => {
        common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:431", "[teacher-chat] 收到 push，准备拉增量", payload, "当前会话=", this.conversationId);
        if (!this.conversationId)
          return;
        if (payload && payload.conversation_id && payload.conversation_id !== this.conversationId) {
          common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:434", "[teacher-chat] 非本会话 push，忽略");
          return;
        }
        this.loadNewMessages();
        this.loadTrialInviteStatuses();
      };
      utils_chatPush.onChatPush(this._onChatPush);
      this._onAppointmentPush = () => {
        this.loadTrialInviteStatuses();
      };
      utils_chatPush.onAppPush(utils_chatPush.APP_PUSH_TYPES.APPOINTMENT_UPDATE, this._onAppointmentPush);
    },
    unbindChatPush() {
      if (!this._onChatPush)
        return;
      utils_chatPush.offChatPush(this._onChatPush);
      this._onChatPush = null;
      if (this._onAppointmentPush) {
        utils_chatPush.offAppPush(this._onAppointmentPush);
        this._onAppointmentPush = null;
      }
    },
    startPolling() {
      this.stopPolling();
      return;
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:474", "[teacher-chat-conversation] 下拉刷新：重新加载消息");
      await this.refreshMessages();
    },
    // 读取当前教师的 hourly_rate，供信息费金额展示和支付用
    async loadTeacherHourlyRate() {
      try {
        const teacherProfile = common_vendor.tr.importObject("teacher-profile", { customUI: true });
        const res = await teacherProfile.getProfile();
        if (res && res.code === 0 && res.data) {
          this.teacherHourlyRate = Number(res.data.hourly_rate) || 0;
        }
      } catch (e) {
        common_vendor.index.__f__("warn", "at pages-teacher/chat/conversation.vue:486", "[信息费] 获取教师课时费失败，使用兜底金额:", e);
      }
    },
    async loadRecruitmentHourlyRate() {
      const aptId = this.appointmentId || this.conversationInfo && this.conversationInfo.appointment_id;
      if (!aptId || this.useMock)
        return;
      try {
        const query = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const res = await query.getAppointmentDetail({ appointment_id: aptId });
        const apt = res && res.data;
        if (!apt)
          return;
        const isRecruitment = !!(apt.recruitment_id || apt.invited_via === "recruitment" || this.inviteSource === "recruitment");
        if (!isRecruitment)
          return;
        const rate = Number(apt.trial_invite_hourly_rate || apt.hourly_rate || 0);
        if (rate > 0)
          this.recruitmentHourlyRate = rate;
      } catch (e) {
        common_vendor.index.__f__("warn", "at pages-teacher/chat/conversation.vue:502", "[信息费] 获取招募课时费失败:", e);
      }
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
                await this.checkTrialStatus();
                await this.refreshMessages();
              } else {
                common_vendor.index.showToast({ title: res.message || "获取会话失败", icon: "none" });
              }
            } catch (error) {
              common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:523", "获取会话失败:", error);
              common_vendor.index.showToast({ title: "获取会话失败", icon: "none" });
            }
          } else {
            await this.loadUserInfo();
            await this.checkTrialStatus();
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
          this.otherUserInfo = { nickname: "家长", avatar: "/static/default-avatar.png" };
          this.syncNavTitle();
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
              nickname: res.data.other_user.nickname || res.data.other_user.display_name || "家长",
              avatar: res.data.other_user.avatar || "/static/default-avatar.png"
            };
            this.syncNavTitle();
          }
          if (!this.conversationId && res.data.conversation_id) {
            this.conversationId = res.data.conversation_id;
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:578", "加载用户信息失败:", error);
      }
    },
    // 检查与当前会话家长是否已有试课成功记录，用于控制“邀请试课”按钮显示
    async checkTrialStatus() {
      try {
        if (this.useMock) {
          this.hasTrialSuccess = false;
          return;
        }
        if (this.currentUserRole !== "teacher") {
          this.hasTrialSuccess = false;
          return;
        }
        const parentId = this.conversationInfo.parent_id;
        if (!parentId) {
          this.hasTrialSuccess = false;
          return;
        }
        const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const res = await appointmentQuery.checkTrialStatusForParent({ parent_id: parentId });
        if (res.code === 0 && res.data) {
          this.hasTrialSuccess = !!res.data.hasTrialSuccess;
          this.hasActiveTrial = !!res.data.hasActiveTrial;
          common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:602", "[teacher-chat-conversation] 试课状态检查结果:", res.data);
        } else {
          this.hasTrialSuccess = false;
          this.hasActiveTrial = false;
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:608", "[teacher-chat-conversation] 检查试课状态失败:", error);
        this.hasTrialSuccess = false;
        this.hasActiveTrial = false;
      }
    },
    async refreshMessages() {
      this.pagination.page = 1;
      this.pagination.hasMore = true;
      this.messages = [];
      await this.fetchMessages({ page: 1, reset: true });
    },
    async loadNewMessages() {
      if (!this.conversationId || this.useMock) {
        return;
      }
      if (this.loading || this.sending) {
        return;
      }
      try {
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const sinceTime = this.messages.length ? Number(this.messages[this.messages.length - 1].send_time || 0) : 0;
        const res = await chatSend.pollUpdates({
          mode: "conversation",
          conversation_id: this.conversationId,
          since_time: sinceTime
        });
        if (res.code !== 0 || !res.data)
          return;
        const fetchedMessages = (res.data.messages || []).map((msg) => ({
          message_id: msg.message_id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          sender_role: msg.sender_role,
          content: msg.content,
          send_time: msg.send_time,
          is_read: msg.is_read
        }));
        if (!fetchedMessages.length)
          return;
        const messageMap = /* @__PURE__ */ new Map();
        this.messages.forEach((msg) => messageMap.set(msg.message_id, msg));
        let hasBrandNew = false;
        fetchedMessages.forEach((msg) => {
          if (!messageMap.has(msg.message_id))
            hasBrandNew = true;
          messageMap.set(msg.message_id, msg);
        });
        if (!hasBrandNew && this.messages.length > 0)
          return;
        this.messages = Array.from(messageMap.values()).sort((a, b) => a.send_time - b.send_time);
        this.$nextTick(() => {
          if (this.messages.length > 0) {
            this.scrollIntoView = `msg-${this.messages.length - 1}`;
          }
        });
        const hasIncoming = fetchedMessages.some((msg) => msg.sender_role !== "teacher");
        if (hasIncoming || sinceTime === 0) {
          await chatSend.markRead({ conversation_id: this.conversationId });
          utils_chatPush.refreshChatBadge("teacher-conversation-poll");
        }
        this.loadTrialInviteStatuses();
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:676", "加载新消息失败:", error);
        if (this.messages.length === 0) {
          await this.refreshMessages();
        }
      }
    },
    async loadMoreHistory() {
      if (!this.pagination.hasMore || this.loadingMore || this.useMock) {
        return;
      }
      this.loadingMore = true;
      await this.fetchMessages({ page: this.pagination.page + 1, prepend: true });
      this.loadingMore = false;
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
            utils_chatPush.refreshChatBadge("teacher-conversation-open");
            this.loadTrialInviteStatuses();
          }
        } else {
          common_vendor.index.showToast({ title: res.message || "消息加载失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:751", "加载消息失败:", error);
        common_vendor.index.showToast({ title: "加载失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
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
        common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:787", "[teacher-chat] send 返回=", res);
        common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:788", "[teacher-chat] push 调试=", res.data && res.data.push);
        common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:789", "[teacher-chat] oa 调试=", res.data && res.data.oa);
        if (res.code === 0) {
          const pushInfo = res.data && res.data.push || {};
          const oaInfo = res.data && res.data.oa || {};
          if (pushInfo.error || !(pushInfo.cids && pushInfo.cids.length)) {
            common_vendor.index.__f__("warn", "at pages-teacher/chat/conversation.vue:794", "[teacher-chat] 推送可能未成功送达对方:", pushInfo);
          } else {
            common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:796", "[teacher-chat] 已触发推送 → receiver=", res.data.receiver_id, "cids=", pushInfo.cids);
          }
          if (oaInfo.skipped || oaInfo.ok === false) {
            common_vendor.index.__f__("warn", "at pages-teacher/chat/conversation.vue:799", "[teacher-chat] 服务号通知未送达家长:", oaInfo);
          } else if (oaInfo.ok) {
            common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:801", "[teacher-chat] 服务号通知已发送");
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
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:815", "发送消息失败:", error);
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
        pending_confirm: "待确认",
        pending_payment: "待支付",
        confirmed: "进行中",
        completed: "已完成"
      };
      return map[status] || "沟通中";
    },
    goBack() {
      common_vendor.index.navigateBack();
    },
    syncNavTitle() {
      common_vendor.index.setNavigationBarTitle({
        title: this.otherUserInfo && this.otherUserInfo.nickname || "家长"
      });
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
      common_vendor.index.navigateTo({ url: `/pages-teacher/appointment/detail?id=${id}` });
    },
    parseReviewResultPayload(msg) {
      if (!msg || !msg.content)
        return null;
      try {
        const parsed = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
        if (parsed && parsed.type === "review_result")
          return parsed;
      } catch (e) {
        return null;
      }
      return null;
    },
    isReviewResultMessage(msg) {
      return !!this.parseReviewResultPayload(msg);
    },
    getReviewResultTitle(msg) {
      const p = this.parseReviewResultPayload(msg);
      return p && p.title || "课程评价";
    },
    getReviewStars(msg) {
      const p = this.parseReviewResultPayload(msg);
      const n = Math.min(5, Math.max(0, Number(p && p.rating) || 0));
      return "★".repeat(n) + "☆".repeat(5 - n);
    },
    getReviewResultLine(msg) {
      const p = this.parseReviewResultPayload(msg);
      if (!p)
        return "";
      if (p.is_auto)
        return "系统默认好评";
      if (p.is_satisfied === true)
        return "试课成功";
      if (p.is_satisfied === false)
        return "试课不满意";
      return "";
    },
    getReviewTags(msg) {
      const p = this.parseReviewResultPayload(msg);
      const tags = p && Array.isArray(p.tags) ? p.tags.filter(Boolean) : [];
      return tags.join("、");
    },
    getReviewContent(msg) {
      const p = this.parseReviewResultPayload(msg);
      return p && p.content || "";
    },
    getReviewResultTip(msg) {
      const p = this.parseReviewResultPayload(msg);
      return p && p.tip || "点击查看预约详情";
    },
    goReviewAppointment(msg) {
      const p = this.parseReviewResultPayload(msg);
      const id = p && p.appointment_id || this.appointmentId;
      if (!id) {
        common_vendor.index.showToast({ title: "未关联预约", icon: "none" });
        return;
      }
      common_vendor.index.navigateTo({ url: `/pages-teacher/appointment/detail?id=${id}` });
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
    getTrialInviteStatus(msg) {
      var _a;
      const inviteId = this.getInviteIdFromMessage(msg);
      return ((_a = this.trialInviteStatusMap[inviteId]) == null ? void 0 : _a.status) || "";
    },
    getTrialInviteStatusText(msg) {
      const status = this.getTrialInviteStatus(msg);
      const inviteId = this.getInviteIdFromMessage(msg);
      const info = this.trialInviteStatusMap[inviteId] || {};
      if (status === "trial_invited") {
        return msg.sender_role === this.currentUserRole ? "已发送邀请" : "待处理邀请";
      }
      if (status === "rejected")
        return "家长未通过，可重新邀请";
      if (status === "pending_payment")
        return "家长已确认，待支付试课费";
      if (status === "pending_confirm")
        return "家长已支付，等待确认";
      if (["confirmed", "in_progress"].includes(status)) {
        return info.parent_paid ? "家长已支付试课费，请按约定时间上课" : "家长已通过";
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
            common_vendor.index.__f__("warn", "at pages-teacher/chat/conversation.vue:1033", "[teacher-chat-conversation] 加载试课邀请状态失败:", inviteId, e);
          }
          return [inviteId, this.trialInviteStatusMap[inviteId] || { status: "" }];
        }));
        const nextMap = { ...this.trialInviteStatusMap };
        entries.forEach(([inviteId, item]) => {
          nextMap[inviteId] = item;
        });
        this.trialInviteStatusMap = nextMap;
        if (entries.some(([, item]) => item.status === "rejected")) {
          this.checkTrialStatus();
        }
      } catch (e) {
        common_vendor.index.__f__("warn", "at pages-teacher/chat/conversation.vue:1046", "[teacher-chat-conversation] 批量加载试课邀请状态失败:", e);
      }
    },
    /**
     * 处理邀请试课
     * 功能：调用云函数创建试课邀请，并发送邀请卡片消息
     */
    async handleInviteTrial() {
      var _a;
      if (this.invitingTrial || !this.conversationId)
        return;
      const parentId = this.conversationInfo.parent_id || ((_a = this.otherUserInfo) == null ? void 0 : _a.user_id);
      if (!parentId && (this.inviteSource !== "recruitment" || !this.appointmentId)) {
        common_vendor.index.showToast({ title: "未找到家长信息", icon: "none" });
        return;
      }
      if (this.appointmentId && this.inviteSource === "recruitment") {
        await this.sendTrialInviteCard(this.appointmentId);
        return;
      }
      const defaultRate = Number(this.teacherHourlyRate) || "";
      this.trialInviteHourlyRateInput = defaultRate ? String(defaultRate) : "";
      this.pendingInviteParentId = parentId;
      this.showTrialFeeModal = true;
    },
    closeTrialFeeModal() {
      this.showTrialFeeModal = false;
      this.pendingInviteParentId = "";
    },
    async confirmInviteTrial() {
      var _a;
      const rate = Number(this.trialInviteHourlyRateInput);
      if (!rate || rate <= 0) {
        common_vendor.index.showToast({ title: "请填写有效的试课课时费", icon: "none" });
        return;
      }
      const parentId = this.pendingInviteParentId;
      if (!parentId) {
        common_vendor.index.showToast({ title: "未找到家长信息", icon: "none" });
        return;
      }
      this.showTrialFeeModal = false;
      this.invitingTrial = true;
      try {
        const appointmentCreate = common_vendor.tr.importObject("appointment-create", { customUI: true });
        const inviteRes = await appointmentCreate.inviteTrial({
          parent_id: parentId,
          trial_hourly_rate: rate
        });
        if (inviteRes.code !== 0) {
          common_vendor.index.showToast({ title: inviteRes.message || "发送邀请失败", icon: "none" });
          return;
        }
        const inviteId = (_a = inviteRes.data) == null ? void 0 : _a.appointment_id;
        if (!inviteId) {
          common_vendor.index.showToast({ title: "邀请创建失败", icon: "none" });
          return;
        }
        await this.sendTrialInviteCard(inviteId);
        this.hasActiveTrial = true;
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:1109", "发送试课邀请失败:", error);
        common_vendor.index.showToast({ title: "发送失败，请稍后再试", icon: "none" });
      } finally {
        this.invitingTrial = false;
        this.pendingInviteParentId = "";
      }
    },
    async sendTrialInviteCard(inviteId) {
      const inviteMessageContent = JSON.stringify({
        type: "trial_invite",
        invite_id: inviteId
      });
      const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
      const sendRes = await chatSend.send({
        conversation_id: this.conversationId,
        message_type: "text",
        content: inviteMessageContent
      });
      if (sendRes.code === 0) {
        this.appointmentId = inviteId;
        this.trialInviteStatusMap = {
          ...this.trialInviteStatusMap,
          [inviteId]: { status: "trial_invited" }
        };
        common_vendor.index.showToast({ title: "邀请已发送", icon: "success" });
        setTimeout(() => {
          this.loadNewMessages();
          this.checkTrialStatus();
        }, 500);
      } else {
        common_vendor.index.showToast({ title: sendRes.message || "发送失败", icon: "none" });
      }
    },
    /**
     * 处理接受邀请（家长端使用）
     * @param {Object} msg - 邀请消息对象
     */
    handleAcceptInvite(msg) {
      var _a, _b;
      const inviteId = this.getInviteIdFromMessage(msg);
      if (!inviteId) {
        common_vendor.index.showToast({ title: "邀请信息无效", icon: "none" });
        return;
      }
      pagesTeacher_utils_appointmentTeacherPreview.saveAppointmentTeacherPreview({
        teacherUid: ((_a = this.conversationInfo) == null ? void 0 : _a.teacher_id) || "",
        teacher_id: ((_b = this.conversationInfo) == null ? void 0 : _b.teacher_id) || "",
        display_name: this.otherUserInfo.nickname || "",
        name: this.otherUserInfo.nickname || "",
        nickname: this.otherUserInfo.nickname || "",
        avatar: this.otherUserInfo.avatar || ""
      });
      common_vendor.index.navigateTo({
        url: `/pages-biz/appointment/create?invite_id=${inviteId}`
      });
    },
    async openCouponSelector() {
      if (this.couponLoading)
        return;
      if (!this.canUseCoupon) {
        common_vendor.index.showToast({ title: "信息费金额异常，无法使用优惠券", icon: "none" });
        return;
      }
      this.couponLoading = true;
      try {
        const couponCenter = common_vendor.tr.importObject("coupon-center", { customUI: true });
        const res = await couponCenter.getAvailableCoupons({ role: "teacher" });
        if (res.code !== 0) {
          common_vendor.index.showToast({ title: res.message || "加载优惠券失败", icon: "none" });
          return;
        }
        const list = res.data && res.data.list || [];
        if (!list.length) {
          common_vendor.index.showToast({ title: "暂无可用优惠券", icon: "none" });
          return;
        }
        const usableCoupons = list.filter((c) => {
          const minSpend = Number(c.min_spend || 0);
          return minSpend <= 0 || this.infoFeeAmount >= minSpend;
        });
        if (!usableCoupons.length) {
          common_vendor.index.showToast({ title: "当前信息费未达到优惠券使用门槛", icon: "none" });
          return;
        }
        const itemList = ["不使用优惠券", ...usableCoupons.map((c) => {
          const title = c.type === "amount" ? `减¥${Number(c.amount || 0).toFixed(2)}` : `${(Number(c.discount || 0) * 10).toFixed(1)}折`;
          const minText = Number(c.min_spend || 0) > 0 ? ` 满¥${Number(c.min_spend).toFixed(2)}可用` : " 无门槛";
          return `${c.name || "优惠券"} ${title}${minText}`;
        })];
        common_vendor.index.showActionSheet({
          itemList,
          success: ({ tapIndex }) => {
            this.ignorePayUntil = Date.now() + 800;
            if (tapIndex === 0) {
              this.couponPreview = null;
              return;
            }
            const couponRecord = usableCoupons[tapIndex - 1];
            if (!couponRecord)
              return;
            setTimeout(async () => {
              try {
                const previewRes = await couponCenter.previewForInfoFee({
                  amount: this.infoFeeAmount,
                  user_coupon_id: couponRecord._id
                });
                if (previewRes.code === 0 && previewRes.data) {
                  this.couponPreview = {
                    ...previewRes.data,
                    couponName: couponRecord.name || previewRes.data.couponName
                  };
                  common_vendor.index.showToast({ title: "已选择优惠券，请点击支付完成抵扣", icon: "none" });
                } else {
                  common_vendor.index.showToast({ title: previewRes.message || "优惠券不可用", icon: "none" });
                }
              } catch (e) {
                common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:1231", "试算教师优惠券失败:", e);
                common_vendor.index.showToast({ title: "优惠券试算失败，请稍后重试", icon: "none" });
              }
            }, 50);
          }
        });
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:1238", "打开教师优惠券选择失败:", error);
        common_vendor.index.showToast({ title: "加载优惠券失败", icon: "none" });
      } finally {
        this.couponLoading = false;
      }
    },
    async handlePayDeposit() {
      var _a;
      if (this.payingDeposit)
        return;
      if (Date.now() < this.ignorePayUntil)
        return;
      const appointmentId = this.appointmentId || ((_a = this.conversationInfo) == null ? void 0 : _a.appointment_id);
      if (!appointmentId) {
        common_vendor.index.showToast({ title: "未找到预约信息", icon: "none" });
        return;
      }
      const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
      if (!userInfo.uid) {
        common_vendor.index.showToast({ title: "请先登录", icon: "none" });
        return;
      }
      const hasCouponPreview = !!this.couponPreview;
      const discount = Number(this.couponDiscountAmount || 0);
      const payableAmount = Number(this.payableInfoFeeAmount || 0);
      const confirmContent = hasCouponPreview ? `信息费：¥${Number(this.infoFeeAmount || 0).toFixed(2)}
优惠券减免：-¥${discount.toFixed(2)}
应付金额：¥${payableAmount.toFixed(2)}

支付后可开启与家长的聊天。
信息费由平台收取，试课成功或失败均不退回。` : `支付${this.infoFeeAmount}元信息费（= 课时费 × 2，一节 2 小时）后可开启与家长的聊天。
信息费由平台收取，试课成功或失败均不退回。`;
      common_vendor.index.showModal({
        title: "支付信息费",
        content: confirmContent,
        success: async (res) => {
          if (!res.confirm)
            return;
          this.payingDeposit = true;
          common_vendor.index.showLoading({ title: "创建订单中...", mask: true });
          try {
            const payComponent = this.$refs.pay;
            if (payableAmount > 0 && (!payComponent || typeof payComponent.open !== "function")) {
              throw new Error("支付组件未就绪，请稍后重试");
            }
            const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
            const orderListRes = await paymentCreate.getOrderList({
              appointment_id: appointmentId,
              payment_type: "deposit",
              status: "all",
              page: 1,
              pageSize: 10
            });
            if (orderListRes.code === 0 && orderListRes.data && orderListRes.data.list) {
              const paidOrder = orderListRes.data.list.find(
                (order) => order.status === "paid" || order.status === "success"
              );
              if (paidOrder) {
                common_vendor.index.hideLoading();
                this.payingDeposit = false;
                common_vendor.index.showToast({ title: "您已支付过信息费", icon: "none" });
                await this.loadUserInfo();
                return;
              }
              const pendingOrder = !hasCouponPreview && orderListRes.data.list.find(
                (order) => order.status === "pending" || order.status === "unpaid"
              );
              if (pendingOrder) {
                common_vendor.index.hideLoading();
                await pagesTeacher_utils_payment.payExistingOrderWithUniPay(payComponent, {
                  order_no: pendingOrder.order_no,
                  appointment_id: appointmentId,
                  payment_type: "deposit",
                  amount: this.infoFeeAmountCents,
                  description: "支付信息费",
                  order_id: pendingOrder._id
                });
                return;
              }
            }
            common_vendor.index.hideLoading();
            const payRes = await pagesTeacher_utils_payment.createAndPayWithUniPay(payComponent, {
              appointment_id: appointmentId,
              payment_type: "deposit",
              amount: this.infoFeeAmountCents,
              description: "支付信息费",
              user_coupon_id: this.couponPreview ? this.couponPreview.user_coupon_id : null
            });
            if (payRes && payRes.data && payRes.data.zero_pay) {
              if (this.conversationInfo) {
                this.conversationInfo.chat_enabled = true;
                this.conversationInfo.teacher_deposit_paid = true;
              }
              common_vendor.index.showToast({ title: "优惠券已抵扣信息费", icon: "success" });
              this.couponPreview = null;
              await this.loadUserInfo();
              await this.refreshMessages();
            }
          } catch (error) {
            common_vendor.index.hideLoading();
            common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:1340", "支付失败:", error);
            const raw = error && error.message ? String(error.message) : "";
            common_vendor.index.showToast({
              title: /is not a function/i.test(raw) ? "支付已完成，请刷新页面查看" : raw || "支付失败，请稍后再试",
              icon: "none"
            });
          } finally {
            this.payingDeposit = false;
          }
        }
      });
    },
    onPayCreate(res) {
      common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:1353", "[聊天页] 支付订单创建成功:", res);
    },
    async onPaySuccess(res) {
      var _a, _b;
      common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:1356", "[聊天页] uni-pay 支付成功:", res);
      const isPaid = res.has_paid || res.status === 1 || res.user_order_success;
      if (!isPaid) {
        common_vendor.index.__f__("warn", "at pages-teacher/chat/conversation.vue:1360", "[聊天页] 支付成功事件但状态异常:", res);
        return;
      }
      const order_no = res.order_no || ((_a = res.pay_order) == null ? void 0 : _a.order_no);
      const out_trade_no = res.out_trade_no;
      const custom = res.custom || {};
      const appointmentId = this.appointmentId || custom.appointment_id || ((_b = this.conversationInfo) == null ? void 0 : _b.appointment_id);
      try {
        const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
        let finalOrderNo = order_no;
        if (!finalOrderNo && appointmentId) {
          const orderListRes = await paymentCreate.getOrderList({
            appointment_id: appointmentId,
            payment_type: "deposit",
            status: "all",
            page: 1,
            pageSize: 10
          });
          if (orderListRes.code === 0 && orderListRes.data && orderListRes.data.list && orderListRes.data.list.length > 0) {
            const pendingOrder = orderListRes.data.list.find(
              (order) => order.status === "pending" || order.status === "unpaid"
            );
            finalOrderNo = pendingOrder ? pendingOrder.order_no : orderListRes.data.list[0].order_no;
          }
        }
        if (finalOrderNo) {
          await paymentCreate.mockPaySuccess({
            order_no: finalOrderNo,
            out_trade_no,
            uni_pay_order_no: order_no
          });
        }
        common_vendor.index.showToast({
          title: "支付成功，聊天功能已开启",
          icon: "success"
        });
        setTimeout(() => {
          this.loadUserInfo();
          this.refreshMessages();
        }, 1e3);
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:1407", "[聊天页] 同步支付状态失败:", error);
        common_vendor.index.showToast({
          title: "支付成功，请刷新页面查看状态",
          icon: "none"
        });
        setTimeout(() => {
          this.loadUserInfo();
          this.refreshMessages();
        }, 1e3);
      }
    },
    onPayFail(err) {
      common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:1419", "[聊天页] 支付失败:", err);
      if (err.errMsg && !err.errMsg.includes("cancel")) {
        common_vendor.index.showToast({
          title: err.errMsg || "支付失败",
          icon: "none"
        });
      }
    }
  }
};
if (!Array) {
  const _easycom_uni_pay2 = common_vendor.resolveComponent("uni-pay");
  _easycom_uni_pay2();
}
const _easycom_uni_pay = () => "../../uni_modules/uni-pay/components/uni-pay/uni-pay.js";
if (!Math) {
  _easycom_uni_pay();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: !$data.isInitialized
  }, !$data.isInitialized ? {} : common_vendor.e({
    b: $data.pagination.hasMore && !$data.loadingMore
  }, $data.pagination.hasMore && !$data.loadingMore ? {
    c: common_vendor.o((...args) => $options.loadMoreHistory && $options.loadMoreHistory(...args))
  } : $data.loadingMore ? {} : {}, {
    d: $data.loadingMore,
    e: common_vendor.f($options.formattedMessages, (item, k0, i0) => {
      return common_vendor.e({
        a: item.type === "time"
      }, item.type === "time" ? {
        b: common_vendor.t(item.label)
      } : $options.isTrialInviteMessage(item.data) ? common_vendor.e({
        d: item.data.sender_role !== $data.currentUserRole && $options.getTrialInviteStatus(item.data) === "trial_invited"
      }, item.data.sender_role !== $data.currentUserRole && $options.getTrialInviteStatus(item.data) === "trial_invited" ? {
        e: common_vendor.o(($event) => $options.handleAcceptInvite(item.data), item.id)
      } : {
        f: common_vendor.t($options.getTrialInviteStatusText(item.data))
      }) : $options.isAttendanceClockMessage(item.data) ? common_vendor.e({
        h: common_vendor.t($options.getAttendanceClockTitle(item.data)),
        i: common_vendor.t($options.getAttendanceClockTime(item.data)),
        j: $options.getAttendanceClockAddress(item.data)
      }, $options.getAttendanceClockAddress(item.data) ? {
        k: common_vendor.t($options.getAttendanceClockAddress(item.data))
      } : {}, {
        l: common_vendor.t($options.getAttendanceClockTip(item.data)),
        m: common_vendor.o(($event) => $options.goAttendanceAppointment(item.data), item.id)
      }) : $options.isReviewResultMessage(item.data) ? common_vendor.e({
        o: common_vendor.t($options.getReviewResultTitle(item.data)),
        p: common_vendor.t($options.getReviewStars(item.data)),
        q: $options.getReviewResultLine(item.data)
      }, $options.getReviewResultLine(item.data) ? {
        r: common_vendor.t($options.getReviewResultLine(item.data))
      } : {}, {
        s: $options.getReviewTags(item.data)
      }, $options.getReviewTags(item.data) ? {
        t: common_vendor.t($options.getReviewTags(item.data))
      } : {}, {
        v: $options.getReviewContent(item.data)
      }, $options.getReviewContent(item.data) ? {
        w: common_vendor.t($options.getReviewContent(item.data))
      } : {}, {
        x: common_vendor.t($options.getReviewResultTip(item.data)),
        y: common_vendor.o(($event) => $options.goReviewAppointment(item.data), item.id)
      }) : common_vendor.e({
        z: item.data.sender_role !== $data.currentUserRole
      }, item.data.sender_role !== $data.currentUserRole ? {
        A: $data.otherUserInfo.avatar || $data.defaultAvatarUrl,
        B: common_vendor.t(item.data.content)
      } : {
        C: common_vendor.t(item.data.content),
        D: $data.currentUserInfo.avatar || $data.defaultAvatarUrl
      }, {
        E: item.data.sender_role === $data.currentUserRole ? 1 : ""
      }), {
        c: $options.isTrialInviteMessage(item.data),
        g: $options.isAttendanceClockMessage(item.data),
        n: $options.isReviewResultMessage(item.data),
        F: item.id,
        G: item.id
      });
    }),
    f: !$options.formattedMessages.length && !$data.loading
  }, !$options.formattedMessages.length && !$data.loading ? {} : {}, {
    g: $data.scrollIntoView,
    h: $options.needPayDeposit
  }, $options.needPayDeposit ? common_vendor.e({
    i: common_vendor.t($options.depositFeeHint),
    j: common_vendor.t($options.infoFeeAmount),
    k: common_vendor.t($options.couponDisplayText),
    l: common_vendor.n($options.canUseCoupon ? "deposit-coupon-active" : "deposit-coupon-muted"),
    m: common_vendor.o((...args) => $options.openCouponSelector && $options.openCouponSelector(...args)),
    n: $options.couponDiscountAmount > 0
  }, $options.couponDiscountAmount > 0 ? {
    o: common_vendor.t(Number($options.couponDiscountAmount || 0).toFixed(2))
  } : {}, {
    p: $options.couponDiscountAmount > 0
  }, $options.couponDiscountAmount > 0 ? {
    q: common_vendor.t(Number($options.payableInfoFeeAmount || 0).toFixed(2))
  } : {}, {
    r: common_vendor.t($options.payDepositButtonText),
    s: common_vendor.o((...args) => $options.handlePayDeposit && $options.handlePayDeposit(...args)),
    t: $data.payingDeposit ? 1 : ""
  }) : $options.waitingParentPay ? {} : common_vendor.e({
    w: $options.canShowInviteTrial
  }, $options.canShowInviteTrial ? {
    x: common_vendor.t($data.invitingTrial ? "发送中" : "邀请试课"),
    y: $data.invitingTrial ? 1 : "",
    z: common_vendor.o((...args) => $options.handleInviteTrial && $options.handleInviteTrial(...args))
  } : {}, {
    A: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args)),
    B: $data.sending || !$options.canSend,
    C: $data.inputText,
    D: common_vendor.o(($event) => $data.inputText = $event.detail.value),
    E: common_vendor.t($data.sending ? "发送中" : "发送"),
    F: $options.canSendMessage ? 1 : "",
    G: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args))
  }), {
    v: $options.waitingParentPay
  }), {
    H: common_vendor.sr("pay", "83c710d1-0"),
    I: common_vendor.o($options.onPaySuccess),
    J: common_vendor.o($options.onPayCreate),
    K: common_vendor.o($options.onPayFail),
    L: common_vendor.p({
      height: "70vh",
      ["to-success-page"]: false,
      ["return-url"]: "/pages-teacher/chat/conversation",
      logo: "/static/logo.png"
    }),
    M: $data.showTrialFeeModal
  }, $data.showTrialFeeModal ? {
    N: $data.trialInviteHourlyRateInput,
    O: common_vendor.o(($event) => $data.trialInviteHourlyRateInput = $event.detail.value),
    P: common_vendor.t($options.trialInviteTotalAmount),
    Q: common_vendor.o((...args) => $options.closeTrialFeeModal && $options.closeTrialFeeModal(...args)),
    R: common_vendor.o((...args) => $options.confirmInviteTrial && $options.confirmInviteTrial(...args)),
    S: common_vendor.o(() => {
    }),
    T: common_vendor.o((...args) => $options.closeTrialFeeModal && $options.closeTrialFeeModal(...args))
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-83c710d1"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/chat/conversation.js.map
