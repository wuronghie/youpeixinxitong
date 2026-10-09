"use strict";
const common_vendor = require("../common/vendor.js");
function redirectWithQuery(targetPath, options) {
  const query = Object.keys(options || {}).filter((key) => options[key] !== void 0 && options[key] !== null && options[key] !== "").map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`).join("&");
  common_vendor.index.redirectTo({
    url: query ? `${targetPath}?${query}` : targetPath
  });
}
exports.redirectWithQuery = redirectWithQuery;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/subpackageRedirect.js.map
