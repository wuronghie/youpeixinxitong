"use strict";
const common_vendor = require("../../common/vendor.js");
const card = () => "../../components/common/card.js";
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
        refundType: "only_refund",
        reason: "",
        description: ""
      },
      reasonOptions: ["教师未确认预约", "时间冲突需要调整", "课程内容与预期不符", "其他原因"],
      reasonIndex: -1,
      isSubmitting: false,
      isLoading: false
    };
  },
  computed: {
    refundAmount() {
      var _a;
      if (!this.order.amount)
        return 0;
      if (((_a = this.order.appointment_info) == null ? void 0 : _a.course_type) === "trial") {
        return Math.round(this.order.amount * 0.5 * 100) / 100;
      }
      return this.order.amount;
    }
  },
  async onLoad(options) {
    this.orderId = options.id || options.orderNo || "";
    if (!this.orderId) {
      common_vendor.index.showToast({ title: "订单ID不能为空", icon: "none" });
      setTimeout(() => common_vendor.index.navigateBack(), 1500);
      return;
    }
    await this.loadOrder();
    await this.loadRefundDetail();
  },
  methods: {
    async loadOrder() {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (this.isLoading)
        return;
      this.isLoading = true;
      try {
        common_vendor.index.__f__("log", "at pages/order/refund.vue:154", "[退款申请] 开始加载订单, order_id:", this.orderId);
        const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
        const res = await paymentCreate.getOrderList({ status: "all", page: 1, pageSize: 1, order_id: this.orderId });
        common_vendor.index.__f__("log", "at pages/order/refund.vue:158", "[退款申请] 订单查询结果:", {
          code: res.code,
          hasData: ((_b = (_a = res.data) == null ? void 0 : _a.list) == null ? void 0 : _b.length) > 0,
          listLength: (_d = (_c = res.data) == null ? void 0 : _c.list) == null ? void 0 : _d.length
        });
        let orderData;
        if (res.code === 0 && ((_f = (_e = res.data) == null ? void 0 : _e.list) == null ? void 0 : _f.length)) {
          orderData = res.data.list.find((item) => item._id === this.orderId || item.order_no === this.orderId) || res.data.list[0];
        }
        if (!orderData) {
          common_vendor.index.__f__("error", "at pages/order/refund.vue:169", "[退款申请] 未找到订单数据:", {
            orderId: this.orderId,
            response: res
          });
          throw new Error(res.message || "获取订单失败");
        }
        common_vendor.index.__f__("log", "at pages/order/refund.vue:176", "[退款申请] 订单数据加载成功:", {
          order_id: orderData._id,
          order_no: orderData.order_no,
          status: orderData.status,
          amount: orderData.amount || orderData.total_amount
        });
        this.order = {
          _id: orderData._id,
          order_no: orderData.order_no,
          amount: Number(orderData.amount || orderData.total_amount || 0),
          appointment_info: orderData.appointment_info ? {
            course_type: orderData.appointment_info.course_type,
            teacher_name: ((_g = orderData.appointment_info.teacher_info) == null ? void 0 : _g.display_name) || ((_h = orderData.appointment_info.teacher_info) == null ? void 0 : _h.name)
          } : null
        };
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/order/refund.vue:193", "[退款申请] 加载订单失败:", {
          error,
          message: error.message,
          orderId: this.orderId
        });
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
          this.form.refundType = detail.refund_type || "only_refund";
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
      var _a, _b;
      if (this.isSubmitting)
        return;
      const msg = this.validateForm();
      if (msg) {
        common_vendor.index.showToast({ title: msg, icon: "none" });
        return;
      }
      try {
        this.isSubmitting = true;
        common_vendor.index.__f__("log", "at pages/order/refund.vue:239", "[退款申请] 开始提交退款申请:", {
          order_id: this.orderId,
          refund_type: this.form.refundType,
          reason: this.form.reason,
          description: this.form.description
        });
        const refundObj = common_vendor.tr.importObject("payment-refund", { customUI: true });
        const res = await refundObj.apply({
          order_id: this.orderId,
          refund_type: this.form.refundType,
          reason: this.form.reason,
          description: this.form.description
        });
        common_vendor.index.__f__("log", "at pages/order/refund.vue:254", "[退款申请] 云对象返回结果:", res);
        if (res.code === 0) {
          common_vendor.index.__f__("log", "at pages/order/refund.vue:257", "[退款申请] 退款申请提交成功:", {
            refund_id: (_a = res.data) == null ? void 0 : _a.refund_id,
            refund_amount: (_b = res.data) == null ? void 0 : _b.refund_amount
          });
          common_vendor.index.showToast({ title: "退款申请已提交", icon: "success" });
          setTimeout(() => {
            common_vendor.index.navigateBack({ delta: 1 });
          }, 1200);
        } else {
          common_vendor.index.__f__("error", "at pages/order/refund.vue:268", "[退款申请] 提交失败:", {
            code: res.code,
            message: res.message,
            data: res.data
          });
          throw new Error(res.message || "提交失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/order/refund.vue:276", "[退款申请] 提交退款异常:", {
          error,
          message: error.message,
          errCode: error.errCode,
          errMsg: error.errMsg,
          stack: error.stack
        });
        let errorMsg = "提交退款失败";
        if (error.message) {
          errorMsg = error.message;
        } else if (error.errMsg) {
          errorMsg = error.errMsg;
        } else if (error.errCode) {
          errorMsg = `错误代码: ${error.errCode}`;
        }
        common_vendor.index.showModal({
          title: "提交失败",
          content: errorMsg + "\n\n请检查网络连接或稍后重试。如问题持续，请联系客服。",
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
    f: common_vendor.s($data.form.refundType === "only_refund" ? "opacity: 0.9;" : ""),
    g: common_vendor.n($data.form.refundType === "only_refund" ? "main-bg-color text-white" : "bg-light-secondary"),
    h: common_vendor.o(($event) => $data.form.refundType = "only_refund"),
    i: common_vendor.s($data.form.refundType === "refund_cancel" ? "opacity: 0.9;" : ""),
    j: common_vendor.n($data.form.refundType === "refund_cancel" ? "main-bg-color text-white" : "bg-light-secondary"),
    k: common_vendor.o(($event) => $data.form.refundType = "refund_cancel"),
    l: common_vendor.p({
      headTitle: "退款类型"
    }),
    m: common_vendor.t($data.form.reason || "请选择退款原因"),
    n: common_vendor.n($data.form.reason ? "" : "text-light-muted"),
    o: $data.reasonOptions,
    p: $data.reasonIndex,
    q: common_vendor.o((...args) => $options.onReasonChange && $options.onReasonChange(...args)),
    r: $data.form.description,
    s: common_vendor.o(common_vendor.m(($event) => $data.form.description = $event.detail.value, {
      trim: true
    })),
    t: common_vendor.t($data.form.description.length),
    v: common_vendor.p({
      headTitle: "退款原因"
    }),
    w: common_vendor.t($options.refundAmount.toFixed(2)),
    x: $data.order.appointment_info && $data.order.appointment_info.course_type === "trial"
  }, $data.order.appointment_info && $data.order.appointment_info.course_type === "trial" ? {} : {}, {
    y: common_vendor.p({
      headTitle: "退款金额"
    }),
    z: common_vendor.t($data.isSubmitting ? "提交中..." : "提交申请"),
    A: $data.isSubmitting,
    B: common_vendor.o((...args) => $options.submitRefund && $options.submitRefund(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-397736d7"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/order/refund.js.map
