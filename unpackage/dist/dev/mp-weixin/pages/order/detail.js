"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  name: "OrderDetail",
  data() {
    return {
      orderId: "",
      order: {},
      refundInfo: null,
      isLoading: false,
      isRefreshing: false,
      scrollTop: 0,
      canRefresh: true,
      adminWechat: "chen18148503231"
    };
  },
  onLoad(options) {
    this.orderId = options.id || options.orderNo || "";
    if (!this.orderId) {
      common_vendor.index.showToast({ title: "订单ID不能为空", icon: "none" });
      setTimeout(() => common_vendor.index.navigateBack(), 1500);
      return;
    }
    this.loadDetail();
  },
  computed: {
    statusTip() {
      const map = {
        unpaid: "请尽快完成支付，预约才可确认",
        pending: "订单待支付，请尽快完成支付",
        paid: "订单已支付，请在课程结束后及时确认",
        success: "课程已完成，可前往评价或查看课程记录",
        refunding: "退款申请处理中，请耐心等待",
        refunded: "订单已退款，资金将在 1-3 个工作日内退回"
      };
      if (this.isResultConfirmed && ["paid", "success"].includes(this.order.status)) {
        return "已确认上课结果，不可再申请退款";
      }
      return map[this.order.status] || "";
    },
    statusTone() {
      const map = {
        unpaid: "tone-pay",
        pending: "tone-pay",
        paid: "tone-done",
        success: "tone-done",
        refunding: "tone-wait",
        refunded: "tone-muted"
      };
      return map[this.order.status] || "";
    },
    teacherName() {
      var _a, _b;
      const info = this.order.appointment_info || {};
      return ((_a = info.teacher_info) == null ? void 0 : _a.display_name) || ((_b = info.teacher_info) == null ? void 0 : _b.name) || info.teacher_name || "";
    },
    courseLabel() {
      var _a;
      const info = this.order.appointment_info || {};
      const subjects = (_a = info.teacher_info) == null ? void 0 : _a.subjects;
      const subject = Array.isArray(subjects) ? subjects[0] || "" : typeof subjects === "string" ? subjects : "";
      const typeMap = {
        trial: "试课",
        regular: "正式课",
        formal: "正式课",
        deposit: "信息费",
        refund: "退款"
      };
      const type = typeMap[info.course_type || this.order.order_type] || this.formatOrderType(this.order.order_type);
      return subject ? `${subject} · ${type}` : type;
    },
    hasCoupon() {
      return Number(this.order.discount_amount || 0) > 0 || !!this.order.user_coupon_id;
    },
    couponText() {
      const discount = Number(this.order.discount_amount || 0);
      if (discount > 0)
        return `已减 ¥${discount.toFixed(2)}`;
      if (this.order.user_coupon_id)
        return "已使用";
      return "未使用";
    },
    isResultConfirmed() {
      var _a;
      const appointment = ((_a = this.order) == null ? void 0 : _a.appointment_info) || {};
      return appointment.status === "completed" || appointment.has_review === true || this.order.has_review === true;
    },
    canApplyRefund() {
      if (!["paid", "success"].includes(this.order.status) || this.refundInfo)
        return false;
      if (this.isResultConfirmed)
        return false;
      return true;
    },
    canReview() {
      var _a;
      const appointment = ((_a = this.order) == null ? void 0 : _a.appointment_info) || {};
      if (!appointment._id)
        return false;
      if (appointment.has_review || this.order.has_review)
        return false;
      const orderStatusAllow = ["paid", "success"];
      const appointmentStatusAllow = ["completed"];
      return orderStatusAllow.includes(this.order.status) && appointmentStatusAllow.includes(appointment.status);
    },
    canConfirmCompletion() {
      var _a;
      const appointment = ((_a = this.order) == null ? void 0 : _a.appointment_info) || {};
      if (!appointment._id)
        return false;
      if (appointment.has_review)
        return false;
      const orderStatusAllow = ["paid", "success"];
      const appointmentStatusAllow = ["confirmed", "in_progress"];
      return orderStatusAllow.includes(this.order.status) && appointmentStatusAllow.includes(appointment.status);
    },
    primaryAction() {
      if (["unpaid", "pending"].includes(this.order.status))
        return "pay";
      if (["paid", "success"].includes(this.order.status))
        return "contact";
      if (this.order.status === "refunded")
        return "refunded";
      if (this.order.status === "refunding")
        return "refunding";
      return "";
    },
    refundSteps() {
      if (!this.refundInfo) {
        return [];
      }
      return [
        {
          key: "apply",
          title: "提交退款申请",
          time: this.formatTime(this.refundInfo.create_time),
          active: true
        },
        {
          key: "review",
          title: "平台审核",
          time: this.refundInfo.review_time ? this.formatTime(this.refundInfo.review_time) : "",
          active: ["approved", "success", "processing"].includes(this.refundInfo.status)
        },
        {
          key: "result",
          title: this.refundInfo.status === "rejected" ? "退款已驳回" : "退款完成",
          time: this.refundInfo.status === "success" ? this.formatTime(this.refundInfo.finish_time || this.order.refund_time) : "",
          active: ["success"].includes(this.refundInfo.status)
        }
      ];
    }
  },
  methods: {
    async refreshData() {
      if (this.orderId) {
        await this.loadDetail();
      }
    },
    async loadDetail() {
      if (this.isLoading)
        return;
      this.isLoading = true;
      try {
        const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
        const res = await paymentCreate.getOrderDetail({ order_id: this.orderId });
        if (res.code === 0 && res.data) {
          this.order = {
            ...res.data,
            has_review: !!res.data.has_review,
            appointment_info: res.data.appointment_info ? {
              ...res.data.appointment_info,
              has_review: !!res.data.appointment_info.has_review
            } : null
          };
          if (res.data.refund_info) {
            this.refundInfo = res.data.refund_info;
          }
        } else {
          throw new Error(res.message || "获取订单失败");
        }
        await this.loadRefundDetail();
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/order/detail.vue:303", "获取订单详情失败:", error);
        common_vendor.index.showToast({ title: error.message || "获取订单失败", icon: "none" });
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
      }
    },
    async loadRefundDetail() {
      try {
        const refundObj = common_vendor.tr.importObject("payment-refund", { customUI: true });
        const res = await refundObj.getDetail({ order_id: this.orderId });
        if (res.code === 0 && res.data) {
          this.refundInfo = res.data;
        }
      } catch (error) {
      }
    },
    handleScroll(e) {
      this.scrollTop = e.detail.scrollTop;
      this.canRefresh = e.detail.scrollTop <= 10;
    },
    handleScrollToUpper() {
      this.scrollTop = 0;
      this.canRefresh = true;
    },
    onRefresh() {
      if (!this.canRefresh || this.scrollTop > 10) {
        this.isRefreshing = false;
        return;
      }
      if (this.isRefreshing)
        return;
      this.isRefreshing = true;
      this.loadDetail();
    },
    formatStatus(status) {
      const map = {
        unpaid: "待支付",
        pending: "待支付",
        paid: "已支付",
        success: "已支付",
        refunding: "退款中",
        refunded: "已退款"
      };
      return map[status] || "未知状态";
    },
    formatOrderType(type) {
      const map = {
        trial: "试课订单",
        regular: "正式课程订单",
        deposit: "信息费",
        refund: "退款订单"
      };
      return map[type] || "课程订单";
    },
    formatPayChannel(channel) {
      const map = {
        wechat: "微信支付",
        alipay: "支付宝",
        balance: "余额支付"
      };
      return map[channel] || "其他支付";
    },
    formatTime(ts) {
      if (!ts)
        return "-";
      const date = new Date(ts);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}`;
    },
    goAppointment(appointmentId) {
      if (!appointmentId)
        return;
      common_vendor.index.navigateTo({ url: `/pages-biz/appointment/detail?id=${appointmentId}` });
    },
    goRefund() {
      if (!this.canApplyRefund) {
        common_vendor.index.showToast({ title: "已确认上课结果，不可再申请退款", icon: "none" });
        return;
      }
      common_vendor.index.navigateTo({ url: `/pages/order/refund?id=${this.orderId}` });
    },
    gotoPay() {
      common_vendor.index.showToast({ title: "跳转支付中...", icon: "none" });
    },
    goReview() {
      var _a, _b, _c;
      const appointmentId = ((_b = (_a = this.order) == null ? void 0 : _a.appointment_info) == null ? void 0 : _b._id) || ((_c = this.order) == null ? void 0 : _c.appointment_id);
      if (!appointmentId) {
        common_vendor.index.showToast({ title: "未找到对应预约", icon: "none" });
        return;
      }
      common_vendor.index.navigateTo({ url: `/pages/review/create?appointmentId=${appointmentId}` });
    },
    confirmCompletion() {
      var _a, _b;
      const appointmentId = (_b = (_a = this.order) == null ? void 0 : _a.appointment_info) == null ? void 0 : _b._id;
      if (!appointmentId) {
        common_vendor.index.showToast({ title: "未找到对应预约", icon: "none" });
        return;
      }
      common_vendor.index.showModal({
        title: "确认课程完成",
        content: "确认课程已顺利完成？确认后将开启评价并结束订单。",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
            const result = await appointmentQuery.confirmCompletion({ appointment_id: appointmentId });
            if (result.code === 0) {
              common_vendor.index.showToast({ title: "已确认完成", icon: "success" });
              setTimeout(() => {
                this.loadDetail();
              }, 600);
            } else {
              common_vendor.index.showToast({ title: result.message || "确认失败", icon: "none" });
            }
          } catch (error) {
            common_vendor.index.__f__("error", "at pages/order/detail.vue:421", "确认课程完成失败:", error);
            common_vendor.index.showToast({ title: "确认失败，请稍后重试", icon: "none" });
          }
        }
      });
    },
    contactService() {
      const wechat = this.adminWechat;
      if (!wechat) {
        common_vendor.index.showToast({ title: "暂无客服微信", icon: "none" });
        return;
      }
      common_vendor.index.setClipboardData({
        data: wechat,
        success: () => {
          common_vendor.index.showToast({ title: "微信号已复制", icon: "success" });
        },
        fail: () => {
          common_vendor.index.showToast({ title: "复制失败", icon: "none" });
        }
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  var _a, _b;
  return common_vendor.e({
    a: $options.statusTip
  }, $options.statusTip ? {
    b: common_vendor.t($options.statusTip)
  } : {}, {
    c: common_vendor.t($data.order.order_no || "-"),
    d: common_vendor.t($options.formatStatus($data.order.status)),
    e: common_vendor.n($options.statusTone),
    f: $options.teacherName
  }, $options.teacherName ? {
    g: common_vendor.t($options.teacherName)
  } : {}, {
    h: common_vendor.t($options.courseLabel),
    i: $data.order.appointment_info
  }, $data.order.appointment_info ? {
    j: common_vendor.t($data.order.appointment_info.date),
    k: common_vendor.t($data.order.appointment_info.time)
  } : {}, {
    l: common_vendor.t($options.formatTime($data.order.create_time)),
    m: $data.order.pay_time
  }, $data.order.pay_time ? {
    n: common_vendor.t($options.formatTime($data.order.pay_time))
  } : {}, {
    o: $data.order.refund_time
  }, $data.order.refund_time ? {
    p: common_vendor.t($options.formatTime($data.order.refund_time))
  } : {}, {
    q: common_vendor.t(Number($data.order.amount || 0).toFixed(2)),
    r: !$data.order.appointment_info && !$data.order.refund_amount ? 1 : "",
    s: $data.order.refund_amount
  }, $data.order.refund_amount ? {
    t: common_vendor.t(Number($data.order.refund_amount || 0).toFixed(2)),
    v: !$data.order.appointment_info ? 1 : ""
  } : {}, {
    w: $data.order.appointment_info
  }, $data.order.appointment_info ? {
    x: common_vendor.o(($event) => $options.goAppointment($data.order.appointment_info._id))
  } : {}, {
    y: $data.order.pay_channel || $options.hasCoupon || $data.order.platform_fee || $data.order.teacher_income
  }, $data.order.pay_channel || $options.hasCoupon || $data.order.platform_fee || $data.order.teacher_income ? common_vendor.e({
    z: $data.order.pay_channel
  }, $data.order.pay_channel ? {
    A: common_vendor.t($options.formatPayChannel($data.order.pay_channel))
  } : {}, {
    B: $data.order.transaction_id
  }, $data.order.transaction_id ? {
    C: common_vendor.t($data.order.transaction_id)
  } : {}, {
    D: common_vendor.t($options.couponText),
    E: !$data.order.platform_fee && !$data.order.teacher_income ? 1 : "",
    F: $data.order.platform_fee
  }, $data.order.platform_fee ? {
    G: common_vendor.t(Number($data.order.platform_fee || 0).toFixed(2)),
    H: !$data.order.teacher_income ? 1 : ""
  } : {}, {
    I: $data.order.teacher_income
  }, $data.order.teacher_income ? {
    J: common_vendor.t(Number($data.order.teacher_income || 0).toFixed(2))
  } : {}) : {}, {
    K: $data.order.refund_info || $data.refundInfo
  }, $data.order.refund_info || $data.refundInfo ? common_vendor.e({
    L: common_vendor.f($options.refundSteps, (step, index, i0) => {
      return {
        a: step.active ? 1 : "",
        b: common_vendor.t(step.title),
        c: common_vendor.t(step.time || "待处理"),
        d: step.key,
        e: index === $options.refundSteps.length - 1 ? 1 : ""
      };
    }),
    M: ((_a = $data.refundInfo) == null ? void 0 : _a.status) === "pending"
  }, ((_b = $data.refundInfo) == null ? void 0 : _b.status) === "pending" ? {
    N: common_vendor.o((...args) => $options.contactService && $options.contactService(...args))
  } : {}) : {}, {
    O: $options.canConfirmCompletion || $options.canReview || $options.canApplyRefund || $options.primaryAction
  }, $options.canConfirmCompletion || $options.canReview || $options.canApplyRefund || $options.primaryAction ? common_vendor.e({
    P: $options.primaryAction === "pay"
  }, $options.primaryAction === "pay" ? {
    Q: common_vendor.o((...args) => $options.gotoPay && $options.gotoPay(...args))
  } : {}, {
    R: $options.canConfirmCompletion
  }, $options.canConfirmCompletion ? {
    S: common_vendor.o((...args) => $options.confirmCompletion && $options.confirmCompletion(...args))
  } : {}, {
    T: $options.canReview
  }, $options.canReview ? {
    U: common_vendor.o((...args) => $options.goReview && $options.goReview(...args))
  } : {}, {
    V: $options.canApplyRefund
  }, $options.canApplyRefund ? {
    W: common_vendor.o((...args) => $options.goRefund && $options.goRefund(...args))
  } : {}, {
    X: $options.primaryAction === "contact"
  }, $options.primaryAction === "contact" ? {
    Y: common_vendor.o((...args) => $options.contactService && $options.contactService(...args))
  } : {}, {
    Z: $options.primaryAction === "refunded"
  }, $options.primaryAction === "refunded" ? {} : {}, {
    aa: $options.primaryAction === "refunding"
  }, $options.primaryAction === "refunding" ? {} : {}) : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-6b23c96c"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/order/detail.js.map
