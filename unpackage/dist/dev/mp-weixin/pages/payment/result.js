"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  name: "PaymentResult",
  data() {
    return {
      status: "success",
      message: "",
      returnPage: "",
      appointmentId: "",
      role: ""
    };
  },
  onLoad(options = {}) {
    this.status = options.status === "fail" ? "fail" : "success";
    this.message = options.message || "";
    this.returnPage = options.returnPage || "";
    this.appointmentId = options.appointmentId || "";
    this.role = options.role || "parent";
  },
  computed: {
    displayMessage() {
      if (this.message)
        return this.message;
      return this.status === "success" ? "支付已完成，您可以返回继续浏览订单详情。" : "可返回订单重新支付，或稍后再试。";
    }
  },
  methods: {
    handleBack() {
      if (this.returnPage) {
        let url = this.returnPage;
        if (this.appointmentId) {
          const connector = url.includes("?") ? "&" : "?";
          url = `${url}${connector}id=${this.appointmentId}`;
        }
        common_vendor.index.redirectTo({ url });
        return;
      }
      if (this.appointmentId) {
        if (this.role === "teacher") {
          common_vendor.index.redirectTo({
            url: `/pages-teacher/appointment/detail?id=${this.appointmentId}`
          });
        } else {
          common_vendor.index.redirectTo({
            url: `/pages-biz/appointment/detail?id=${this.appointmentId}`
          });
        }
      } else {
        common_vendor.index.navigateBack({ delta: 1 });
      }
    },
    goHome() {
      if (this.role === "teacher") {
        common_vendor.index.redirectTo({ url: "/pages-teacher/index/index" });
        return;
      }
      common_vendor.index.redirectTo({ url: "/pages/teacher/list" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.status === "success" ? "✓" : "!"),
    b: common_vendor.n($data.status === "success" ? "ok" : "fail"),
    c: common_vendor.t($data.status === "success" ? "支付成功" : "支付失败"),
    d: common_vendor.t($options.displayMessage),
    e: $data.status === "success" && $data.appointmentId
  }, $data.status === "success" && $data.appointmentId ? {
    f: common_vendor.o((...args) => $options.handleBack && $options.handleBack(...args))
  } : {}, {
    g: $data.status === "success" && !$data.appointmentId
  }, $data.status === "success" && !$data.appointmentId ? {
    h: common_vendor.o((...args) => $options.handleBack && $options.handleBack(...args))
  } : {}, {
    i: $data.status === "success"
  }, $data.status === "success" ? {
    j: common_vendor.o((...args) => $options.goHome && $options.goHome(...args))
  } : {}, {
    k: $data.status === "fail"
  }, $data.status === "fail" ? {
    l: common_vendor.o((...args) => $options.handleBack && $options.handleBack(...args))
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-53ffba6a"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/payment/result.js.map
