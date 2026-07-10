"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_payment = require("../../utils/payment.js");
const card = () => "../../components/common/card.js";
const AttendanceClockCard = () => "../../components/AttendanceClockCard.js";
const AppointmentBasicCard = () => "../../components/AppointmentBasicCard.js";
const AppointmentFeeCard = () => "../../components/AppointmentFeeCard.js";
const _sfc_main = {
  name: "TeacherAppointmentDetail",
  components: {
    card,
    AttendanceClockCard,
    AppointmentBasicCard,
    AppointmentFeeCard
  },
  data() {
    return {
      appointmentId: "",
      appointment: {},
      refundInfo: null,
      useMock: true,
      isLoadingRefund: false,
      // 老师端自身课时费（元/小时），用于计算信息费 = 课时费 × 2（一节试课 2 小时费用）
      teacherHourlyRate: 0
    };
  },
  computed: {
    isTeacherInvitedTrial() {
      const apt = this.appointment || {};
      return apt.course_type === "trial" && apt.invited_by === "teacher";
    },
    // 信息费金额（元）= 老师课时费 × 2；老师未设置时按 1 元兜底（与后端 fallback 一致）
    infoFeeAmount() {
      const fromAppt = Number(this.appointment && this.appointment.hourly_rate) || 0;
      const rate = fromAppt > 0 ? fromAppt : Number(this.teacherHourlyRate) || 0;
      const fee = rate > 0 ? Number((rate * 2).toFixed(2)) : 0;
      return fee > 0 ? fee : 1;
    },
    infoFeeAmountCents() {
      return Math.round(this.infoFeeAmount * 100);
    },
    // 排课开始/结束时间戳（毫秒），供打卡卡片做时间窗口校验
    scheduleStartTs() {
      const apt = this.appointment || {};
      const schedule = apt.schedule || {};
      const date = schedule.date || apt.appointment_date || apt.date;
      const startTime = schedule.start_time || apt.appointment_time || apt.start_time;
      if (!date || !startTime)
        return 0;
      const ts = (/* @__PURE__ */ new Date(`${date}T${startTime}:00`)).getTime();
      return Number.isNaN(ts) ? 0 : ts;
    },
    scheduleEndTs() {
      const start = this.scheduleStartTs;
      if (!start)
        return 0;
      const apt = this.appointment || {};
      const schedule = apt.schedule || {};
      if (schedule.end_time && (schedule.date || apt.appointment_date)) {
        const date = schedule.date || apt.appointment_date;
        const ts = (/* @__PURE__ */ new Date(`${date}T${schedule.end_time}:00`)).getTime();
        if (!Number.isNaN(ts))
          return ts;
      }
      const duration = Number(schedule.duration || apt.duration || 2);
      return start + duration * 3600 * 1e3;
    },
    // 打卡卡片：信息费已付 + 家长已付课程费（或已在打卡中）；未支付时隐藏打卡入口
    isParentCoursePaid() {
      const apt = this.appointment || {};
      return apt.parent_paid === true || apt.parent_paid === "true" || !!apt.parent_paid_from_order;
    },
    showClockCard() {
      const apt = this.appointment || {};
      if (!apt._id)
        return false;
      const depositOk = apt.deposit_paid === true || apt.deposit_paid === "true";
      if (!depositOk && !apt.class_started_at)
        return false;
      if (!this.isParentCoursePaid && !apt.class_started_at)
        return false;
      if (apt.class_started_at || apt.class_ended_at)
        return true;
      return ["confirmed", "in_progress"].includes(apt.status);
    },
    showWaitingParentPay() {
      const apt = this.appointment || {};
      if (!apt._id || this.isParentCoursePaid)
        return false;
      if (apt.class_started_at || apt.class_ended_at)
        return false;
      const depositOk = apt.deposit_paid === true || apt.deposit_paid === "true";
      if (!depositOk)
        return false;
      return ["confirmed", "pending_confirm", "pending_payment", "in_progress"].includes(apt.status);
    }
  },
  onLoad(options) {
    this.appointmentId = options.id || "appointment_001";
    this.useMock = utils_mockData.useMockData() !== false;
    this.loadTeacherHourlyRate();
    this.loadDetail();
  },
  onShow() {
    if (this.appointmentId) {
      this.loadDetail();
    }
  },
  methods: {
    async refreshData() {
      await this.loadDetail();
    },
    // 打卡成功后刷新详情，获取最新 class_started_at / class_ended_at
    onClocked() {
      this.loadDetail();
    },
    // 读取当前教师的 hourly_rate，供信息费金额展示用
    async loadTeacherHourlyRate() {
      try {
        const teacherProfile = common_vendor.tr.importObject("teacher-profile", { customUI: true });
        const res = await teacherProfile.getProfile();
        if (res && res.code === 0 && res.data) {
          this.teacherHourlyRate = Number(res.data.hourly_rate) || 0;
        }
      } catch (e) {
        common_vendor.index.__f__("warn", "at pages-teacher/appointment/detail.vue:232", "[信息费] 获取教师课时费失败，后续以预约 hourly_rate 为准:", e);
      }
    },
    async loadDetail() {
      var _a, _b;
      const currentDepositPaid = (_a = this.appointment) == null ? void 0 : _a.deposit_paid;
      const currentStatus = (_b = this.appointment) == null ? void 0 : _b.status;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const apt = utils_mockData.mockAppointments.find((a) => a._id === this.appointmentId) || utils_mockData.mockAppointments[0];
          this.appointment = {
            ...apt,
            student_name: "小明",
            student_grade: "初二",
            address: "深圳市南山区科技园",
            status: apt.status || "pending_confirm",
            // 如果本地已标记为已支付，保留状态
            deposit_paid: currentDepositPaid !== void 0 ? currentDepositPaid : apt.deposit_paid || false
          };
        } else {
          const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
          const res = await appointmentQuery.getAppointmentDetail({
            appointment_id: this.appointmentId
          });
          if (res.code === 0) {
            this.appointment = res.data;
            try {
              const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
              const conversationRes = await chatSend.getConversation({
                appointment_id: this.appointmentId
              });
              if (conversationRes.code === 0 && conversationRes.data) {
                if (conversationRes.data.teacher_deposit_paid) {
                  this.appointment.deposit_paid = true;
                }
              }
            } catch (error) {
              common_vendor.index.__f__("warn", "at pages-teacher/appointment/detail.vue:276", "检查会话状态失败:", error);
            }
            if (currentDepositPaid !== void 0 && currentDepositPaid) {
              this.appointment.deposit_paid = true;
              if (currentStatus === "pending_confirm") {
                this.appointment.status = "confirmed";
              }
            }
            await this.loadRefund();
          } else {
            if (currentDepositPaid !== void 0 && currentDepositPaid && this.appointment) {
              this.appointment.deposit_paid = true;
              if (currentStatus) {
                this.appointment.status = currentStatus;
              }
            }
            common_vendor.index.showToast({
              title: res.message || "加载失败",
              icon: "none"
            });
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/appointment/detail.vue:303", "加载失败:", error);
        if (currentDepositPaid !== void 0 && currentDepositPaid && this.appointment) {
          this.appointment.deposit_paid = true;
          if (currentStatus) {
            this.appointment.status = currentStatus;
          }
        }
        common_vendor.index.showToast({
          title: "加载失败",
          icon: "none"
        });
      }
    },
    getStatusText(status) {
      const map = {
        pending_payment: "待家长支付",
        pending_confirm: "待确认",
        contact_request: "联系请求",
        // 家长直接联系老师但还没预约
        confirmed: "已确认",
        in_progress: "进行中",
        completed: "已完成",
        rejected: "已拒绝",
        cancelled: "已取消",
        refunding: "退款中",
        refunded: "已退款"
      };
      return map[status] || "未知";
    },
    getStatusClass(status) {
      const map = {
        pending_payment: "bg-warning",
        pending_confirm: "bg-warning",
        contact_request: "bg-warning",
        // 联系请求使用警告色
        confirmed: "bg-success",
        in_progress: "bg-primary",
        completed: "bg-success",
        rejected: "bg-danger",
        cancelled: "bg-light",
        refunding: "bg-warning",
        refunded: "bg-light"
      };
      return map[status] || "";
    },
    formatAddress(address) {
      if (!address)
        return "";
      if (typeof address === "string") {
        return this.removeDuplicateAddress(address);
      }
      if (typeof address === "object") {
        if (address.full || address.address) {
          const fullAddr = address.full || address.address;
          return this.removeDuplicateAddress(fullAddr);
        }
        const detail = address.detail || "";
        const province = address.province || "";
        const city = address.city || "";
        const district = address.district || "";
        if (detail) {
          const hasProvince = province && detail.includes(province);
          const hasCity = city && detail.includes(city);
          const hasDistrict = district && detail.includes(district);
          if (hasProvince || hasCity && hasDistrict) {
            return this.removeDuplicateAddress(detail);
          }
        }
        const parts = [];
        if (province)
          parts.push(province);
        if (city && city !== province)
          parts.push(city);
        if (district && district !== city && district !== province)
          parts.push(district);
        if (detail) {
          const hasAnyPart = parts.some((part) => detail.includes(part));
          if (!hasAnyPart) {
            parts.push(detail);
          }
        }
        return parts.join("");
      }
      return "";
    },
    // 去除地址字符串中的重复内容（专门处理旧数据中的重复问题）
    removeDuplicateAddress(addressStr) {
      if (!addressStr || typeof addressStr !== "string")
        return addressStr;
      let result = addressStr.trim();
      if (result.length < 10)
        return result;
      result = result.replace(/([省市县区街道镇乡])\1+/g, "$1");
      const mid = Math.floor(result.length / 2);
      const firstHalf = result.substring(0, mid);
      const secondHalf = result.substring(mid);
      if (firstHalf === secondHalf) {
        return firstHalf.trim();
      }
      if (firstHalf.length >= 5 && secondHalf.includes(firstHalf)) {
        const index = secondHalf.indexOf(firstHalf);
        if (index === 0) {
          return firstHalf.trim();
        } else {
          return (firstHalf + secondHalf.substring(0, index) + secondHalf.substring(index + firstHalf.length)).trim();
        }
      }
      for (let len = Math.min(25, Math.floor(result.length / 2)); len >= 4; len--) {
        const pattern = new RegExp(`(.{${len}})(\\1)+`, "g");
        let changed = false;
        result = result.replace(pattern, (match, segment) => {
          changed = true;
          return segment;
        });
        if (changed) {
          len = Math.min(25, Math.floor(result.length / 2)) + 1;
          result = result.replace(/([省市县区街道镇乡])\1+/g, "$1");
        }
      }
      const duplicatePattern = /^(.+?)(省|市|区|县|街道|镇|乡)(.+?)(省|市|区|县|街道|镇|乡)(.+?)(省|市|区|县|街道|镇|乡)(\1\2\3\4\5\6)/g;
      result = result.replace(duplicatePattern, "$1$2$3$4$5$6");
      result = result.replace(/([省市县区街道镇乡])\1+/g, "$1").replace(/\s+/g, "").trim();
      return result || addressStr;
    },
    async loadRefund() {
      if (!this.appointmentId)
        return;
      this.isLoadingRefund = true;
      try {
        const refundObj = common_vendor.tr.importObject("payment-refund", { customUI: true });
        const orderId = this.appointment.parent_payment_order_id || this.appointment.course_order_id || this.appointment.payment_order_id || this.appointment.order_id;
        const refundId = this.appointment.refund_id || this.appointment.refund_request_id;
        const params = {};
        if (orderId)
          params.order_id = orderId;
        if (refundId)
          params.refund_id = refundId;
        const res = await refundObj.getDetail(params);
        if (res.code === 0 && res.data) {
          this.refundInfo = res.data;
        } else {
          this.refundInfo = null;
        }
      } catch (error) {
        this.refundInfo = null;
      } finally {
        this.isLoadingRefund = false;
      }
    },
    async handleReject() {
      common_vendor.index.showModal({
        title: "拒绝预约",
        placeholderText: "请输入拒绝原因（可选）",
        editable: true,
        success: async (res) => {
          if (res.confirm) {
            try {
              const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
              if (!userInfo.uid) {
                common_vendor.index.showToast({ title: "请先登录", icon: "none" });
                return;
              }
              const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
              const result = await appointmentQuery.rejectAppointment({
                appointment_id: this.appointmentId,
                reason: res.content || "教师拒绝"
              });
              if (result.code === 0) {
                common_vendor.index.showToast({
                  title: result.message || "已拒绝",
                  icon: "success"
                });
                setTimeout(() => {
                  common_vendor.index.navigateBack();
                }, 1500);
              } else {
                common_vendor.index.showToast({
                  title: result.message || "拒绝失败",
                  icon: "none"
                });
              }
            } catch (error) {
              common_vendor.index.__f__("error", "at pages-teacher/appointment/detail.vue:511", "拒绝失败:", error);
              common_vendor.index.showToast({ title: "操作失败", icon: "none" });
            }
          }
        }
      });
    },
    async handlePayDeposit() {
      const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
      if (!userInfo.uid) {
        common_vendor.index.showToast({ title: "请先登录", icon: "none" });
        return;
      }
      try {
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const conversationRes = await chatSend.getConversation({
          appointment_id: this.appointmentId
        });
        if (conversationRes.code === 0 && conversationRes.data && conversationRes.data.teacher_deposit_paid) {
          this.appointment.deposit_paid = true;
          common_vendor.index.showModal({
            title: "提示",
            content: "您已支付过信息费，无需重复支付。",
            showCancel: false,
            confirmText: "确定",
            success: () => {
              this.loadDetail();
            }
          });
          return;
        }
      } catch (error) {
        common_vendor.index.__f__("warn", "at pages-teacher/appointment/detail.vue:548", "[支付信息费] 检查会话状态失败，继续检查订单:", error);
      }
      try {
        const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
        const orderListRes = await paymentCreate.getOrderList({
          appointment_id: this.appointmentId,
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
            common_vendor.index.showModal({
              title: "提示",
              content: "您已支付过信息费，无需重复支付。",
              showCancel: false,
              confirmText: "确定",
              success: () => {
                this.loadDetail();
              }
            });
            return;
          }
          const pendingOrder = orderListRes.data.list.find(
            (order) => order.status === "pending" || order.status === "unpaid"
          );
          if (pendingOrder) {
            common_vendor.index.__f__("log", "at pages-teacher/appointment/detail.vue:589", "[支付信息费] 找到待支付订单，使用现有订单:", pendingOrder.order_no);
            common_vendor.index.showModal({
              title: "支付信息费",
              content: `支付${this.infoFeeAmount}元信息费（= 课时费 ¥${this.teacherHourlyRate || this.appointment && this.appointment.hourly_rate || 0} × 2，一节 2 小时）后可开启与家长的聊天。
信息费由平台收取，试课成功或失败均不退回。`,
              success: async (res) => {
                if (!res.confirm)
                  return;
                await this.payWithExistingOrder(pendingOrder.order_no);
              }
            });
            return;
          }
        }
      } catch (error) {
        common_vendor.index.__f__("warn", "at pages-teacher/appointment/detail.vue:603", "[支付信息费] 检查现有订单失败，继续创建新订单:", error);
      }
      common_vendor.index.showModal({
        title: "支付信息费",
        content: `支付${this.infoFeeAmount}元信息费（= 课时费 ¥${this.teacherHourlyRate || this.appointment && this.appointment.hourly_rate || 0} × 2，一节 2 小时）后可开启与家长的聊天。
信息费由平台收取，试课成功或失败均不退回。`,
        success: async (res) => {
          if (!res.confirm)
            return;
          common_vendor.index.showLoading({ title: "创建订单中...", mask: true });
          try {
            const payComponent = this.$refs.pay;
            if (payComponent && typeof payComponent.open === "function") {
              common_vendor.index.hideLoading();
              try {
                await utils_payment.createAndPayWithUniPay(payComponent, {
                  appointment_id: this.appointmentId,
                  payment_type: "deposit",
                  amount: this.infoFeeAmountCents,
                  // 信息费 = hourly_rate × 2（单位：分）
                  description: "支付信息费"
                });
                return;
              } catch (error) {
                common_vendor.index.__f__("warn", "at pages-teacher/appointment/detail.vue:633", "uni-pay 组件调用失败:", error);
                if (error.message && error.message.includes("已支付过")) {
                  common_vendor.index.hideLoading();
                  try {
                    const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
                    const orderListRes = await paymentCreate.getOrderList({
                      appointment_id: this.appointmentId,
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
                        common_vendor.index.showModal({
                          title: "提示",
                          content: "您已支付过信息费，无需重复支付。",
                          showCancel: false,
                          confirmText: "确定",
                          success: () => {
                            this.loadDetail();
                          }
                        });
                        return;
                      }
                      const pendingOrder = orderListRes.data.list.find(
                        (order) => order.status === "pending" || order.status === "unpaid"
                      );
                      if (pendingOrder) {
                        await this.payWithExistingOrder(pendingOrder.order_no);
                        return;
                      }
                    }
                    common_vendor.index.showModal({
                      title: "提示",
                      content: "您已支付过信息费，无需重复支付。",
                      showCancel: false,
                      confirmText: "确定",
                      success: () => {
                        this.loadDetail();
                      }
                    });
                    return;
                  } catch (checkError) {
                    common_vendor.index.__f__("error", "at pages-teacher/appointment/detail.vue:690", "[支付信息费] 检查现有订单失败:", checkError);
                    common_vendor.index.showModal({
                      title: "提示",
                      content: "您已支付过信息费，无需重复支付。",
                      showCancel: false,
                      confirmText: "确定",
                      success: () => {
                        this.loadDetail();
                      }
                    });
                    return;
                  }
                }
                common_vendor.index.showToast({
                  title: error.message || "无法打开支付界面，请稍后重试",
                  icon: "none",
                  duration: 2e3
                });
                return;
              }
            }
            common_vendor.index.hideLoading();
            common_vendor.index.showToast({
              title: "支付组件未就绪，请稍后重试",
              icon: "none",
              duration: 2e3
            });
          } catch (error) {
            common_vendor.index.hideLoading();
            common_vendor.index.__f__("error", "at pages-teacher/appointment/detail.vue:723", "支付信息费失败:", error);
            common_vendor.index.showToast({
              title: error.message || "支付失败，请稍后重试",
              icon: "none",
              duration: 2e3
            });
          }
        },
        fail: () => {
          common_vendor.index.hideLoading();
        }
      });
    },
    // uni-pay 组件事件：订单创建成功
    onPayCreate(res) {
      common_vendor.index.__f__("log", "at pages-teacher/appointment/detail.vue:739", "支付订单创建成功:", res);
    },
    // uni-pay 组件事件：支付成功
    async onPaySuccess(res) {
      var _a, _b;
      common_vendor.index.__f__("log", "at pages-teacher/appointment/detail.vue:743", "[支付成功] uni-pay 回调:", res);
      const isPaid = res.has_paid || res.status === 1 || res.user_order_success;
      if (!isPaid) {
        common_vendor.index.__f__("warn", "at pages-teacher/appointment/detail.vue:748", "[支付成功] 支付成功事件但状态异常:", res);
        return;
      }
      const order_no = res.order_no || ((_a = res.pay_order) == null ? void 0 : _a.order_no);
      const out_trade_no = res.out_trade_no;
      const custom = res.custom || {};
      const order_id = custom.order_id;
      common_vendor.index.__f__("log", "at pages-teacher/appointment/detail.vue:758", "[支付成功] 订单信息:", {
        order_no,
        out_trade_no,
        order_id,
        appointment_id: custom.appointment_id,
        payment_type: custom.payment_type
      });
      try {
        const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
        let finalOrderNo = order_no;
        if (!finalOrderNo) {
          common_vendor.index.__f__("log", "at pages-teacher/appointment/detail.vue:774", "[支付成功] 未找到 order_no，通过 appointment_id 查找订单...");
          const orderListRes = await paymentCreate.getOrderList({
            appointment_id: this.appointmentId || custom.appointment_id,
            payment_type: custom.payment_type || "deposit",
            status: "all",
            page: 1,
            pageSize: 10
            // 扩大搜索范围
          });
          if (orderListRes.code === 0 && orderListRes.data && orderListRes.data.list && orderListRes.data.list.length > 0) {
            const pendingOrder = orderListRes.data.list.find(
              (order) => order.status === "pending" || order.status === "unpaid"
            );
            finalOrderNo = pendingOrder ? pendingOrder.order_no : orderListRes.data.list[0].order_no;
            common_vendor.index.__f__("log", "at pages-teacher/appointment/detail.vue:789", "[支付成功] 找到订单:", finalOrderNo);
          }
        }
        if (!finalOrderNo) {
          throw new Error("无法获取订单号，请稍后刷新页面查看支付状态");
        }
        common_vendor.index.__f__("log", "at pages-teacher/appointment/detail.vue:798", "[支付成功] 更新订单状态，order_no:", finalOrderNo);
        const payRes = await paymentCreate.mockPaySuccess({
          order_no: finalOrderNo,
          out_trade_no,
          // 传递 out_trade_no，供退款时使用
          uni_pay_order_no: order_no
        });
        if (payRes.code === 0) {
          common_vendor.index.__f__("log", "at pages-teacher/appointment/detail.vue:806", "[支付成功] 数据库更新成功:", {
            appointment_status: (_b = payRes.data) == null ? void 0 : _b.appointment_status,
            order_no: finalOrderNo
          });
          if (this.appointment) {
            this.appointment.deposit_paid = true;
          }
          common_vendor.index.showToast({
            title: "支付成功，请确认预约",
            icon: "success",
            duration: 2e3
          });
          setTimeout(() => {
            this.loadDetail();
          }, 1e3);
        } else {
          throw new Error(payRes.message || "更新订单状态失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/appointment/detail.vue:832", "[支付成功] 更新数据库失败:", error);
        common_vendor.index.showToast({
          title: error.message || "支付成功，但更新状态失败，请刷新页面查看",
          icon: "none",
          duration: 3e3
        });
        setTimeout(() => {
          this.loadDetail();
        }, 2e3);
      }
    },
    // uni-pay 组件事件：支付失败
    onPayFail(err) {
      common_vendor.index.__f__("error", "at pages-teacher/appointment/detail.vue:846", "支付失败:", err);
      if (err.errMsg && !err.errMsg.includes("cancel")) {
        common_vendor.index.showToast({
          title: err.errMsg || "支付失败",
          icon: "none",
          duration: 2e3
        });
      }
    },
    async handleConfirm() {
      common_vendor.index.showModal({
        title: "确认预约",
        content: "确认接受该预约？确认后家长将收到通知，可以开始准备上课。",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            common_vendor.index.showLoading({ title: "确认中...", mask: true });
            const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
            const result = await appointmentQuery.confirmAppointment({
              appointment_id: this.appointmentId
            });
            common_vendor.index.hideLoading();
            if (result.code === 0) {
              common_vendor.index.showToast({
                title: "预约已确认",
                icon: "success"
              });
              setTimeout(() => {
                this.loadDetail();
              }, 1e3);
            } else {
              common_vendor.index.showToast({
                title: result.message || "确认失败",
                icon: "none"
              });
            }
          } catch (error) {
            common_vendor.index.hideLoading();
            common_vendor.index.__f__("error", "at pages-teacher/appointment/detail.vue:888", "确认预约失败:", error);
            common_vendor.index.showToast({ title: "操作失败", icon: "none" });
          }
        }
      });
    },
    startChat() {
      common_vendor.index.navigateTo({
        url: `/pages-teacher/chat/conversation?appointmentId=${this.appointmentId}`
      });
    },
    async handleRefundReview(action) {
      if (!this.refundInfo)
        return;
      const confirmText = action === "approve" ? "确认同意退款？" : "确认驳回退款申请？";
      common_vendor.index.showModal({
        title: "退款审核",
        content: confirmText,
        editable: action === "reject",
        placeholderText: "请输入处理意见（选填）",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            const refundObj = common_vendor.tr.importObject("payment-refund", { customUI: true });
            const result = await refundObj.teacherReview({
              refund_id: this.refundInfo._id,
              action,
              opinion: res.content || ""
            });
            if (result.code === 0) {
              common_vendor.index.showToast({ title: action === "approve" ? "已同意退款" : "已驳回退款", icon: "success" });
              await this.loadRefund();
            } else {
              common_vendor.index.showToast({ title: result.message || "操作失败", icon: "none" });
            }
          } catch (error) {
            common_vendor.index.__f__("error", "at pages-teacher/appointment/detail.vue:923", "教师审核退款失败:", error);
            common_vendor.index.showToast({ title: "操作失败", icon: "none" });
          }
        }
      });
    },
    formatRefundStatus(status, teacherStatus) {
      if (status === "pending") {
        return teacherStatus === "pending" ? "待教师处理" : "待平台审核";
      }
      if (status === "processing") {
        return "平台处理中";
      }
      if (status === "success") {
        return "已退款";
      }
      if (status === "rejected") {
        return teacherStatus === "rejected" ? "教师驳回" : "平台驳回";
      }
      return "处理中";
    },
    formatTime(timestamp) {
      if (!timestamp)
        return "";
      const date = new Date(timestamp);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${month}-${day} ${hour}:${minute}`;
    },
    /**
     * 使用现有订单进行支付
     */
    async payWithExistingOrder(orderNo) {
      const payComponent = this.$refs.pay;
      if (!payComponent || typeof payComponent.open !== "function") {
        common_vendor.index.showToast({
          title: "支付组件未就绪，请稍后重试",
          icon: "none",
          duration: 2e3
        });
        return;
      }
      try {
        await utils_payment.payExistingOrderWithUniPay(payComponent, {
          order_no: orderNo,
          appointment_id: this.appointmentId,
          payment_type: "deposit",
          amount: this.infoFeeAmountCents,
          description: "支付信息费"
        });
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/appointment/detail.vue:976", "[支付信息费] 打开支付界面失败:", error);
        common_vendor.index.showToast({
          title: error.message || "支付失败，请稍后重试",
          icon: "none",
          duration: 2e3
        });
      }
    }
  }
};
if (!Array) {
  const _component_appointment_basic_card = common_vendor.resolveComponent("appointment-basic-card");
  const _component_appointment_fee_card = common_vendor.resolveComponent("appointment-fee-card");
  const _component_attendance_clock_card = common_vendor.resolveComponent("attendance-clock-card");
  const _component_card = common_vendor.resolveComponent("card");
  const _easycom_uni_pay2 = common_vendor.resolveComponent("uni-pay");
  (_component_appointment_basic_card + _component_appointment_fee_card + _component_attendance_clock_card + _component_card + _easycom_uni_pay2)();
}
const _easycom_uni_pay = () => "../../uni_modules/uni-pay/components/uni-pay/uni-pay.js";
if (!Math) {
  _easycom_uni_pay();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($options.getStatusText($data.appointment.status)),
    b: common_vendor.n($options.getStatusClass($data.appointment.status)),
    c: common_vendor.p({
      appointment: $data.appointment
    }),
    d: common_vendor.p({
      appointment: $data.appointment,
      ["info-fee-amount"]: $options.infoFeeAmount
    }),
    e: $options.showWaitingParentPay
  }, $options.showWaitingParentPay ? {} : {}, {
    f: $options.showClockCard
  }, $options.showClockCard ? {
    g: common_vendor.o($options.onClocked),
    h: common_vendor.p({
      ["appointment-id"]: $data.appointment._id,
      status: $data.appointment.status,
      ["parent-paid"]: $options.isParentCoursePaid,
      ["class-started-at"]: $data.appointment.class_started_at || null,
      ["class-started-location"]: $data.appointment.class_started_location || null,
      ["class-ended-at"]: $data.appointment.class_ended_at || null,
      ["class-ended-location"]: $data.appointment.class_ended_location || null,
      ["schedule-start-ts"]: $options.scheduleStartTs,
      ["schedule-end-ts"]: $options.scheduleEndTs
    })
  } : {}, {
    i: $data.refundInfo
  }, $data.refundInfo ? common_vendor.e({
    j: common_vendor.t($options.formatRefundStatus($data.refundInfo.status, $data.refundInfo.teacher_review_status)),
    k: common_vendor.t($data.refundInfo.reason || "无"),
    l: common_vendor.t($data.refundInfo.description || "无"),
    m: common_vendor.t(($data.refundInfo.amount || 0).toFixed(2)),
    n: common_vendor.t($options.formatTime($data.refundInfo.create_time)),
    o: $data.refundInfo.teacher_review_time
  }, $data.refundInfo.teacher_review_time ? {
    p: common_vendor.t($options.formatTime($data.refundInfo.teacher_review_time))
  } : {}, {
    q: $data.refundInfo.review_time
  }, $data.refundInfo.review_time ? {
    r: common_vendor.t($options.formatTime($data.refundInfo.review_time))
  } : {}, {
    s: common_vendor.p({
      headTitle: "退款申请"
    })
  }) : {}, {
    t: ($data.appointment.status === "pending_confirm" || $data.appointment.status === "pending_payment") && !$data.appointment.parent_paid
  }, ($data.appointment.status === "pending_confirm" || $data.appointment.status === "pending_payment") && !$data.appointment.parent_paid ? {
    v: common_vendor.o((...args) => $options.handleReject && $options.handleReject(...args))
  } : {}, {
    w: ($data.appointment.status === "pending_confirm" || $data.appointment.status === "pending_payment") && !$data.appointment.deposit_paid
  }, ($data.appointment.status === "pending_confirm" || $data.appointment.status === "pending_payment") && !$data.appointment.deposit_paid ? {
    x: common_vendor.t($options.infoFeeAmount),
    y: common_vendor.o((...args) => $options.handlePayDeposit && $options.handlePayDeposit(...args))
  } : {}, {
    z: !$options.isTeacherInvitedTrial && ($data.appointment.status === "pending_confirm" || $data.appointment.status === "pending_payment") && !$data.appointment.parent_paid
  }, !$options.isTeacherInvitedTrial && ($data.appointment.status === "pending_confirm" || $data.appointment.status === "pending_payment") && !$data.appointment.parent_paid ? {
    A: common_vendor.o((...args) => $options.handleConfirm && $options.handleConfirm(...args))
  } : {}, {
    B: $data.appointment.status === "confirmed" && ($data.appointment.deposit_paid === true || $data.appointment.deposit_paid === "true")
  }, $data.appointment.status === "confirmed" && ($data.appointment.deposit_paid === true || $data.appointment.deposit_paid === "true") ? {
    C: common_vendor.o((...args) => $options.startChat && $options.startChat(...args))
  } : {}, {
    D: $data.refundInfo && $data.refundInfo.status === "pending" && $data.refundInfo.teacher_review_status === "pending"
  }, $data.refundInfo && $data.refundInfo.status === "pending" && $data.refundInfo.teacher_review_status === "pending" ? {
    E: common_vendor.o(($event) => $options.handleRefundReview("reject"))
  } : {}, {
    F: $data.refundInfo && $data.refundInfo.status === "pending" && $data.refundInfo.teacher_review_status === "pending"
  }, $data.refundInfo && $data.refundInfo.status === "pending" && $data.refundInfo.teacher_review_status === "pending" ? {
    G: common_vendor.o(($event) => $options.handleRefundReview("approve"))
  } : {}, {
    H: common_vendor.sr("pay", "db498b74-4"),
    I: common_vendor.o($options.onPaySuccess),
    J: common_vendor.o($options.onPayCreate),
    K: common_vendor.o($options.onPayFail),
    L: common_vendor.p({
      height: "70vh",
      ["to-success-page"]: false,
      ["return-url"]: "/pages-teacher/appointment/detail",
      logo: "/static/logo.png"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-db498b74"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/appointment/detail.js.map
