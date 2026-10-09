"use strict";
const utils_subpackageRedirect = require("../../utils/subpackageRedirect.js");
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  onLoad(options) {
    utils_subpackageRedirect.redirectWithQuery("/pages-biz/teacher/detail", options);
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {};
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/teacher/detail.js.map
