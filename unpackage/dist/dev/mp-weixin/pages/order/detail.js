"use strict";
const common_vendor = require("../../common/vendor.js");
const card = () => "../../components/common/card.js";
const divider = () => "../../components/common/divider.js";
const _sfc_main = {
  name: "OrderDetail",
  components: {
    card,
    divider
  },
  data() {
    return {
      orderId: "",
      order: {},
      refundInfo: null,
      isLoading: false,
      isRefreshing: false,
      scrollTop: 0,
      canRefresh: true
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
      return map[this.order.status] || "";
    },
    canApplyRefund() {
      return ["paid", "success"].includes(this.order.status) && !this.refundInfo;
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
        common_vendor.index.__f__("error", "at pages/order/detail.vue:300", "获取订单详情失败:", error);
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
      common_vendor.index.navigateTo({ url: `/pages/appointment/detail?id=${appointmentId}` });
    },
    goRefund() {
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
            common_vendor.index.__f__("error", "at pages/order/detail.vue:414", "确认课程完成失败:", error);
            common_vendor.index.showToast({ title: "确认失败，请稍后重试", icon: "none" });
          }
        }
      });
    },
    contactService() {
      common_vendor.index.showToast({ title: "请联系平台客服协助处理", icon: "none" });
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  const _component_divider = common_vendor.resolveComponent("divider");
  (_component_card + _component_divider)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  var _a, _b;
  return common_vendor.e({
    a: common_vendor.t($options.formatStatus($data.order.status)),
    b: common_vendor.t($options.statusTip),
    c: common_vendor.t($data.order.order_no || "-"),
    d: common_vendor.t($options.formatOrderType($data.order.order_type)),
    e: common_vendor.t($options.formatTime($data.order.create_time)),
    f: $data.order.pay_time
  }, $data.order.pay_time ? {
    g: common_vendor.t($options.formatTime($data.order.pay_time))
  } : {}, {
    h: $data.order.refund_time
  }, $data.order.refund_time ? {
    i: common_vendor.t($options.formatTime($data.order.refund_time))
  } : {}, {
    j: common_vendor.p({
      headTitle: "订单信息"
    }),
    k: common_vendor.t(($data.order.amount || 0).toFixed(2)),
    l: $data.order.platform_fee
  }, $data.order.platform_fee ? {
    m: common_vendor.t($data.order.platform_fee.toFixed(2))
  } : {}, {
    n: $data.order.teacher_income
  }, $data.order.teacher_income ? {
    o: common_vendor.t($data.order.teacher_income.toFixed(2))
  } : {}, {
    p: $data.order.refund_amount
  }, $data.order.refund_amount ? {
    q: common_vendor.t($data.order.refund_amount.toFixed(2))
  } : {}, {
    r: common_vendor.p({
      headTitle: "费用明细"
    }),
    s: $data.order.appointment_info
  }, $data.order.appointment_info ? {
    t: common_vendor.t($data.order.appointment_info.appointment_no || "-"),
    v: common_vendor.t($data.order.appointment_info.teacher_name || "教师"),
    w: common_vendor.t($data.order.appointment_info.date),
    x: common_vendor.t($data.order.appointment_info.time),
    y: common_vendor.o(($event) => $options.goAppointment($data.order.appointment_info._id)),
    z: common_vendor.p({
      headTitle: "关联预约"
    })
  } : {}, {
    A: $data.order.pay_channel
  }, $data.order.pay_channel ? {
    B: common_vendor.t($options.formatPayChannel($data.order.pay_channel)),
    C: common_vendor.t($data.order.transaction_id || "-"),
    D: common_vendor.p({
      headTitle: "支付信息"
    })
  } : {}, {
    E: $data.order.refund_info || $data.refundInfo
  }, $data.order.refund_info || $data.refundInfo ? common_vendor.e({
    F: common_vendor.f($options.refundSteps, (step, k0, i0) => {
      return {
        a: common_vendor.n(step.active ? "main-bg-color" : "bg-light-secondary"),
        b: common_vendor.t(step.title),
        c: common_vendor.t(step.time || "待处理"),
        d: step.key,
        e: step !== $options.refundSteps[$options.refundSteps.length - 1] ? 1 : ""
      };
    }),
    G: ((_a = $data.refundInfo) == null ? void 0 : _a.status) === "pending"
  }, ((_b = $data.refundInfo) == null ? void 0 : _b.status) === "pending" ? {
    H: common_vendor.o((...args) => $options.contactService && $options.contactService(...args))
  } : {}, {
    I: common_vendor.p({
      headTitle: "退款进度"
    })
  }) : {}, {
    J: $options.canConfirmCompletion || $options.canReview || $options.canApplyRefund || $options.primaryAction
  }, $options.canConfirmCompletion || $options.canReview || $options.canApplyRefund || $options.primaryAction ? {} : {}, {
    K: $options.canConfirmCompletion || $options.canReview || $options.canApplyRefund || $options.primaryAction
  }, $options.canConfirmCompletion || $options.canReview || $options.canApplyRefund || $options.primaryAction ? common_vendor.e({
    L: $options.canConfirmCompletion
  }, $options.canConfirmCompletion ? {
    M: common_vendor.o((...args) => $options.confirmCompletion && $options.confirmCompletion(...args))
  } : {}, {
    N: $options.canReview
  }, $options.canReview ? {
    O: common_vendor.o((...args) => $options.goReview && $options.goReview(...args))
  } : {}, {
    P: $options.canApplyRefund
  }, $options.canApplyRefund ? {
    Q: common_vendor.o((...args) => $options.goRefund && $options.goRefund(...args))
  } : {}, {
    R: $options.primaryAction === "pay"
  }, $options.primaryAction === "pay" ? {
    S: common_vendor.o((...args) => $options.gotoPay && $options.gotoPay(...args))
  } : {}, {
    T: $options.primaryAction === "contact"
  }, $options.primaryAction === "contact" ? {
    U: common_vendor.o((...args) => $options.contactService && $options.contactService(...args))
  } : {}, {
    V: $options.primaryAction === "refunded"
  }, $options.primaryAction === "refunded" ? {} : {}, {
    W: $options.primaryAction === "refunding"
  }, $options.primaryAction === "refunding" ? {} : {}) : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/order/detail.js.map
