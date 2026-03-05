"use strict";
const common_vendor = require("../common/vendor.js");
const utils_mapConfig = require("./mapConfig.js");
function reverseGeocode(latitude, longitude) {
  return new Promise((resolve, reject) => {
    const url = `${utils_mapConfig.TENCENT_MAP_API_BASE}/ws/geocoder/v1/?location=${latitude},${longitude}&key=${utils_mapConfig.TENCENT_MAP_KEY}&get_poi=0`;
    common_vendor.index.request({
      url,
      method: "GET",
      success: (res) => {
        var _a;
        common_vendor.index.__f__("log", "at utils/reverseGeocode.js:36", "[逆地理编码] API响应:", res.data);
        if (res.statusCode === 200 && res.data && res.data.status === 0) {
          const result = res.data.result;
          const addressComponent = result.address_component || {};
          const addressInfo = {
            city: addressComponent.city || "",
            province: addressComponent.province || "",
            district: addressComponent.district || "",
            address: result.address || ""
          };
          common_vendor.index.__f__("log", "at utils/reverseGeocode.js:46", "[逆地理编码] 解析结果:", addressInfo);
          resolve(addressInfo);
        } else {
          common_vendor.index.__f__("error", "at utils/reverseGeocode.js:49", "[逆地理编码] API返回错误:", res.data);
          reject(new Error(((_a = res.data) == null ? void 0 : _a.message) || "逆地理编码失败"));
        }
      },
      fail: (err) => {
        common_vendor.index.__f__("error", "at utils/reverseGeocode.js:54", "[逆地理编码] 请求失败:", err);
        reject(err);
      }
    });
  });
}
exports.reverseGeocode = reverseGeocode;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/reverseGeocode.js.map
