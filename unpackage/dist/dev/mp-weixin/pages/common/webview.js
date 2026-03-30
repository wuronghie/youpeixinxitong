"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  name: "CommonWebview",
  data() {
    return {
      url: "",
      title: "网页浏览"
    };
  },
  onLoad(options = {}) {
    const title = options.title ? decodeURIComponent(options.title) : "网页浏览";
    const url = options.url ? decodeURIComponent(options.url) : "";
    this.title = title;
    this.url = url;
    common_vendor.index.setNavigationBarTitle({ title });
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.url
  }, $data.url ? {
    b: $data.url
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-b2eba2b3"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/common/webview.js.map
