"use strict";
const common_vendor = require("../../common/vendor.js");
const card = () => "../../components/common/card.js";
const TRIAL_PARENT_REFUND_RATE = 0.3;
const _sfc_main = {
  name: "OrderRefund",
  components: {
    card
  },
  data() {
    return {
      orderId: "",
      order: {
        amount: 0,
        appointment_info: null
      },
      form: {
        reason: "",
        description: ""
      },
      reasonOptions: ["试课不满意", "教师爽约/未按时上课", "时间冲突需要调整", "其他原因"],
      reasonIndex: -1,
      isSubmitting: false,
      isLoading: false
    };
  },
  computed: {
    isTrialOrder() {
      var _a;
      return ((_a = this.order.appointment_info) == null ? void 0 : _a.course_type) === "trial";
    },
    refundAmount() {
      if (!this.order.amount)
        return 0;
      if (this.isTrialOrder) {
        return Math.round(this.order.amount * TRIAL_PARENT_REFUND_RATE * 100) / 100;
      }
      return this.order.amount;
    }
  },
  async onLoad(options) {
    this.orderId = options.id || options.orderNo || "";
    if (!this.orderId) {
      common_vendor.index.showToast({ title: "订单ID不能为空", icon: "none" });
      setTimeout(() => this.safeLeave(), 1500);
      return;
    }
    await this.loadOrder();
    await this.loadRefundDetail();
  },
  methods: {
    /** 有上一页则返回，否则跳转预约列表，避免首屏 navigateBack 报错 */
    safeLeave() {
      const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
      if (pages && pages.length > 1) {
        common_vendor.index.navigateBack({
          delta: 1,
          fail: () => {
            common_vendor.index.redirectTo({ url: "/pages/appointment/list" });
          }
        });
        return;
      }
      common_vendor.index.redirectTo({
        url: "/pages/appointment/list",
        fail: () => {
          common_vendor.index.reLaunch({ url: "/pages/appointment/list" });
        }
      });
    },
    async loadOrder() {
      var _a, _b, _c, _d;
      if (this.isLoading)
        return;
      this.isLoading = true;
      try {
        const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
        const res = await paymentCreate.getOrderList({ status: "all", page: 1, pageSize: 1, order_id: this.orderId });
        let orderData;
        if (res.code === 0 && ((_b = (_a = res.data) == null ? void 0 : _a.list) == null ? void 0 : _b.length)) {
          orderData = res.data.list.find((item) => item._id === this.orderId || item.order_no === this.orderId) || res.data.list[0];
        }
        if (!orderData) {
          throw new Error(res.message || "获取订单失败");
        }
        this.order = {
          _id: orderData._id,
          order_no: orderData.order_no,
          amount: Number(orderData.amount || orderData.total_amount || 0),
          appointment_info: orderData.appointment_info ? {
            course_type: orderData.appointment_info.course_type,
            teacher_name: ((_c = orderData.appointment_info.teacher_info) == null ? void 0 : _c.display_name) || ((_d = orderData.appointment_info.teacher_info) == null ? void 0 : _d.name)
          } : null
        };
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/order/refund.vue:183", "[退款申请] 加载订单失败:", error);
        common_vendor.index.showToast({ title: error.message || "加载订单失败", icon: "none" });
      } finally {
        this.isLoading = false;
      }
    },
    async loadRefundDetail() {
      try {
        const refundObj = common_vendor.tr.importObject("payment-refund", { customUI: true });
        const res = await refundObj.getDetail({ order_id: this.orderId });
        if (res.code === 0 && res.data) {
          const detail = res.data;
          this.form.reason = detail.reason || "";
          this.reasonIndex = this.reasonOptions.indexOf(this.form.reason);
          this.form.description = detail.description || "";
          common_vendor.index.showToast({ title: "已存在退款申请", icon: "none" });
        }
      } catch (error) {
      }
    },
    onReasonChange(e) {
      const index = Number(e.detail.value);
      this.reasonIndex = index;
      this.form.reason = this.reasonOptions[index];
    },
    validateForm() {
      if (!this.form.reason) {
        return "请选择退款原因";
      }
      return "";
    },
    async submitRefund() {
      if (this.isSubmitting)
        return;
      const msg = this.validateForm();
      if (msg) {
        common_vendor.index.showToast({ title: msg, icon: "none" });
        return;
      }
      const confirmContent = this.isTrialOrder ? `确认提交退款申请？

· 预计退回试课费 30%（¥${this.refundAmount.toFixed(2)}）
· 其余 70% 审核通过后结算给教师
· 需平台审核通过后才会退款` : `确认提交退款申请？预计退款 ¥${this.refundAmount.toFixed(2)}，需平台审核通过后原路退回。`;
      const confirmed = await new Promise((resolve) => {
        common_vendor.index.showModal({
          title: "提交退款申请",
          content: confirmContent,
          confirmText: "提交申请",
          success: (res) => resolve(!!res.confirm),
          fail: () => resolve(false)
        });
      });
      if (!confirmed)
        return;
      try {
        this.isSubmitting = true;
        const refundObj = common_vendor.tr.importObject("payment-refund", { customUI: true });
        const res = await refundObj.apply({
          order_id: this.orderId,
          refund_type: "refund_cancel",
          reason: this.form.reason,
          description: this.form.description
        });
        if (res.code === 0) {
          common_vendor.index.showModal({
            title: "已提交",
            content: res.message || "退款申请已提交，请等待平台审核",
            showCancel: false,
            success: () => this.safeLeave()
          });
        } else {
          throw new Error(res.message || "提交失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/order/refund.vue:259", "[退款申请] 提交退款异常:", error);
        common_vendor.index.showModal({
          title: "提交失败",
          content: (error.message || error.errMsg || "提交退款失败") + "\n\n请稍后重试。如问题持续，请联系客服。",
          showCancel: false
        });
      } finally {
        this.isSubmitting = false;
      }
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.order.order_no || "-"),
    b: common_vendor.t($data.order.amount.toFixed(2)),
    c: $data.order.appointment_info
  }, $data.order.appointment_info ? {
    d: common_vendor.t($data.order.appointment_info.teacher_name || "教师")
  } : {}, {
    e: common_vendor.p({
      headTitle: "订单信息"
    }),
    f: common_vendor.t($options.refundAmount.toFixed(2)),
    g: $options.isTrialOrder
  }, $options.isTrialOrder ? {} : {}, {
    h: common_vendor.p({
      headTitle: "退款说明"
    }),
    i: common_vendor.t($data.form.reason || "请选择退款原因"),
    j: common_vendor.n($data.form.reason ? "" : "text-light-muted"),
    k: $data.reasonOptions,
    l: $data.reasonIndex,
    m: common_vendor.o((...args) => $options.onReasonChange && $options.onReasonChange(...args)),
    n: $data.form.description,
    o: common_vendor.o(common_vendor.m(($event) => $data.form.description = $event.detail.value, {
      trim: true
    })),
    p: common_vendor.t($data.form.description.length),
    q: common_vendor.p({
      headTitle: "退款原因"
    }),
    r: common_vendor.t($data.isSubmitting ? "提交中..." : $options.isTrialOrder ? "提交退款申请（退30%）" : "提交退款申请"),
    s: $data.isSubmitting,
    t: common_vendor.o((...args) => $options.submitRefund && $options.submitRefund(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-397736d7"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/order/refund.js.map
