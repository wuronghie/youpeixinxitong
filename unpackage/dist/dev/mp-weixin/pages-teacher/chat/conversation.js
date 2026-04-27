"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
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
      payingDeposit: false,
      invitingTrial: false,
      // 是否正在发送试课邀请
      hasTrialSuccess: false,
      // 与当前家长是否已有试课成功记录
      pagination: {
        page: 1,
        pageSize: 30,
        hasMore: true
      },
      isInitialized: false,
      // 标记是否已初始化完成
      initPromise: null,
      // 保存初始化 Promise
      // 老师端自身课时费（元/小时），用于计算信息费 = 课时费 × 2
      teacherHourlyRate: 0
    };
  },
  computed: {
    // 信息费金额（元）= 老师课时费 × 2（一节试课 2 小时）；老师未设置时兜底 1 元，与后端兜底一致
    infoFeeAmount() {
      const rate = Number(this.teacherHourlyRate) || 0;
      const fee = rate > 0 ? Number((rate * 2).toFixed(2)) : 0;
      return fee > 0 ? fee : 1;
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
      if (this.currentUserRole !== "teacher") {
        return false;
      }
      return !this.conversationInfo.chat_enabled;
    },
    canSend() {
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
      if (this.messages.some((msg) => this.isTrialInviteMessage(msg)))
        return false;
      return !!parentId;
    }
  },
  onLoad(options) {
    this.conversationId = options.conversationId || "";
    this.appointmentId = options.appointmentId || "";
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
    this.initConversation();
    this.loadTeacherHourlyRate();
  },
  async onShow() {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.isInitialized && this.conversationId && !this.useMock) {
      this.loadNewMessages();
    }
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:260", "[teacher-chat-conversation] 下拉刷新：重新加载消息");
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
        common_vendor.index.__f__("warn", "at pages-teacher/chat/conversation.vue:272", "[信息费] 获取教师课时费失败，使用兜底金额:", e);
      }
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
                await this.checkTrialStatus();
                await this.refreshMessages();
              } else {
                common_vendor.index.showToast({ title: res.message || "获取会话失败", icon: "none" });
              }
            } catch (error) {
              common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:293", "获取会话失败:", error);
              common_vendor.index.showToast({ title: "获取会话失败", icon: "none" });
            }
          } else {
            await this.loadUserInfo();
            await this.checkTrialStatus();
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
          this.otherUserInfo = { nickname: "家长", avatar: "/static/default-avatar.png" };
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
          }
          if (!this.conversationId && res.data.conversation_id) {
            this.conversationId = res.data.conversation_id;
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:342", "加载用户信息失败:", error);
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
          common_vendor.index.__f__("log", "at pages-teacher/chat/conversation.vue:365", "[teacher-chat-conversation] 试课状态检查结果:", res.data);
        } else {
          this.hasTrialSuccess = false;
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:370", "[teacher-chat-conversation] 检查试课状态失败:", error);
        this.hasTrialSuccess = false;
      }
    },
    async refreshMessages() {
      this.pagination.page = 1;
      this.pagination.hasMore = true;
      this.messages = [];
      await this.fetchMessages({ page: 1, reset: true });
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
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:449", "加载新消息失败:", error);
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
          }
        } else {
          common_vendor.index.showToast({ title: res.message || "消息加载失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:523", "加载消息失败:", error);
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
        if (res.code === 0) {
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
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:572", "发送消息失败:", error);
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
     * 处理邀请试课
     * 功能：调用云函数创建试课邀请，并发送邀请卡片消息
     */
    async handleInviteTrial() {
      var _a, _b, _c;
      if (this.invitingTrial || !this.conversationId)
        return;
      try {
        this.invitingTrial = true;
        let inviteId = this.appointmentId || ((_a = this.conversationInfo) == null ? void 0 : _a.appointment_id) || "";
        if (!inviteId || this.inviteSource !== "recruitment") {
          const parentId = this.conversationInfo.parent_id;
          if (!parentId) {
            common_vendor.index.showToast({ title: "未找到家长信息", icon: "none" });
            this.invitingTrial = false;
            return;
          }
          const appointmentCreate = common_vendor.tr.importObject("appointment-create", { customUI: true });
          const inviteRes = await appointmentCreate.inviteTrial({ parent_id: parentId });
          if (inviteRes.code !== 0) {
            common_vendor.index.showToast({ title: inviteRes.message || "发送邀请失败", icon: "none" });
            this.invitingTrial = false;
            return;
          }
          inviteId = ((_b = inviteRes.data) == null ? void 0 : _b.appointment_id) || ((_c = inviteRes.data) == null ? void 0 : _c.invite_id);
        }
        if (!inviteId) {
          common_vendor.index.showToast({ title: "邀请创建失败", icon: "none" });
          this.invitingTrial = false;
          return;
        }
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
        this.invitingTrial = false;
        if (sendRes.code === 0) {
          this.appointmentId = inviteId;
          common_vendor.index.showToast({ title: "邀请已发送", icon: "success" });
          setTimeout(() => {
            this.loadNewMessages();
          }, 500);
        } else {
          common_vendor.index.showToast({ title: sendRes.message || "发送失败", icon: "none" });
        }
      } catch (error) {
        this.invitingTrial = false;
        common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:714", "发送试课邀请失败:", error);
        common_vendor.index.showToast({ title: "发送失败，请稍后再试", icon: "none" });
      }
    },
    /**
     * 处理接受邀请（家长端使用）
     * @param {Object} msg - 邀请消息对象
     */
    handleAcceptInvite(msg) {
      const inviteId = this.getInviteIdFromMessage(msg);
      if (!inviteId) {
        common_vendor.index.showToast({ title: "邀请信息无效", icon: "none" });
        return;
      }
      common_vendor.index.navigateTo({
        url: `/pages/appointment/create?invite_id=${inviteId}`
      });
    },
    async handlePayDeposit() {
      if (this.payingDeposit)
        return;
      common_vendor.index.showModal({
        title: "支付信息费",
        content: `支付${this.infoFeeAmount}元信息费（= 课时费 × 2，一节试课 2 小时费用）可开启与家长的聊天窗口。
试课成功 → 由平台收取；试课失败 → 全额退回您的钱包。`,
        success: async (res) => {
          var _a;
          if (res.confirm) {
            try {
              const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
              if (!userInfo.uid) {
                common_vendor.index.showToast({ title: "请先登录", icon: "none" });
                return;
              }
              const appointmentId = this.appointmentId || ((_a = this.conversationInfo) == null ? void 0 : _a.appointment_id);
              if (!appointmentId) {
                common_vendor.index.showToast({ title: "未找到预约信息", icon: "none" });
                return;
              }
              this.payingDeposit = true;
              const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
              const createRes = await paymentCreate.create({
                appointment_id: appointmentId,
                payment_type: "deposit",
                amount: this.infoFeeAmount
              });
              if (createRes.code !== 0) {
                this.payingDeposit = false;
                common_vendor.index.showToast({
                  title: createRes.message || "创建订单失败",
                  icon: "none"
                });
                return;
              }
              const payRes = await paymentCreate.mockPaySuccess({
                order_no: createRes.data.order_no
              });
              this.payingDeposit = false;
              if (payRes.code === 0) {
                common_vendor.index.showToast({
                  title: "支付成功，聊天功能已开启",
                  icon: "success"
                });
                setTimeout(() => {
                  this.loadUserInfo();
                  this.refreshMessages();
                }, 1e3);
              } else {
                common_vendor.index.showToast({
                  title: payRes.message || "支付失败",
                  icon: "none"
                });
              }
            } catch (error) {
              this.payingDeposit = false;
              common_vendor.index.__f__("error", "at pages-teacher/chat/conversation.vue:795", "支付失败:", error);
              common_vendor.index.showToast({ title: "支付失败，请稍后再试", icon: "none" });
            }
          }
        }
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.goBack && $options.goBack(...args)),
    b: $data.otherUserInfo.avatar || $data.defaultAvatarUrl,
    c: common_vendor.t($data.otherUserInfo.nickname || "家长"),
    d: $data.pagination.hasMore && !$data.loadingMore
  }, $data.pagination.hasMore && !$data.loadingMore ? {
    e: common_vendor.o((...args) => $options.loadMoreHistory && $options.loadMoreHistory(...args))
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
        g: $data.otherUserInfo.avatar || $data.defaultAvatarUrl,
        h: common_vendor.t(item.data.content)
      } : {
        i: common_vendor.t(item.data.content),
        j: $data.currentUserInfo.avatar || $data.defaultAvatarUrl
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
    j: $options.needPayDeposit
  }, $options.needPayDeposit ? {
    k: common_vendor.t($data.payingDeposit ? "支付中..." : `支付信息费（¥${$options.infoFeeAmount}）`),
    l: common_vendor.o((...args) => $options.handlePayDeposit && $options.handlePayDeposit(...args)),
    m: $data.payingDeposit ? 1 : ""
  } : common_vendor.e({
    n: $options.canShowInviteTrial
  }, $options.canShowInviteTrial ? {
    o: common_vendor.t($data.invitingTrial ? "发送中..." : "邀请试课"),
    p: common_vendor.o((...args) => $options.handleInviteTrial && $options.handleInviteTrial(...args)),
    q: $data.invitingTrial ? 1 : ""
  } : {}, {
    r: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args)),
    s: $data.sending || !$options.canSend,
    t: $data.inputText,
    v: common_vendor.o(($event) => $data.inputText = $event.detail.value),
    w: common_vendor.t($data.sending ? "发送中" : "发送"),
    x: $options.canSendMessage ? 1 : "",
    y: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args))
  }));
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-83c710d1"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/chat/conversation.js.map
