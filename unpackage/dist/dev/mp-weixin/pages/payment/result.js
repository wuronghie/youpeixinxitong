"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  name: "PaymentResult",
  data() {
    return {
      status: "success",
      // success | fail
      message: "",
      returnPage: "",
      appointmentId: "",
      role: "",
      // parent | teacher
      successIcon: "/static/logo.png",
      failIcon: "/static/logo.png"
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
      return this.status === "success" ? "支付已完成，您可以返回继续浏览订单详情。" : "支付未完成，您可以返回重新发起支付或联系商家。";
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
            url: `/pages/appointment/detail?id=${this.appointmentId}`
          });
        }
      } else {
        common_vendor.index.navigateBack({ delta: 1 });
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: $data.status === "success" ? $data.successIcon : $data.failIcon,
    b: common_vendor.t($data.status === "success" ? "支付成功" : "支付失败"),
    c: common_vendor.t($options.displayMessage),
    d: common_vendor.o((...args) => $options.handleBack && $options.handleBack(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-53ffba6a"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/payment/result.js.map
