"use strict";
const common_vendor = require("../common/vendor.js");
const utils_mapConfig = require("./mapConfig.js");
function pickDetailedAddress(result) {
  if (!result || typeof result !== "object")
    return "";
  const formatted = result.formatted_addresses || {};
  const recommend = String(formatted.recommend || "").trim();
  const standard = String(result.address || "").trim();
  const comp = result.address_component || {};
  const poi = Array.isArray(result.pois) && result.pois[0] || {};
  const refs = result.address_reference || {};
  const landmark = refs.landmark_l2 || refs.landmark_l1 || refs.famous_area || {};
  const poiTitle = String(poi.title || landmark.title || "").trim();
  if (recommend) {
    if (poiTitle && recommend.indexOf(poiTitle) === -1) {
      return `${recommend}（${poiTitle}）`;
    }
    return recommend;
  }
  const city = comp.city && comp.city !== comp.province ? comp.city : "";
  const assembled = [
    comp.province,
    city,
    comp.district,
    comp.street,
    comp.street_number,
    poiTitle
  ].filter(Boolean).join("");
  return assembled || standard;
}
function reverseGeocode(latitude, longitude) {
  return new Promise((resolve, reject) => {
    const poiOptions = encodeURIComponent("address_format=short;radius=300;policy=2");
    const url = `${utils_mapConfig.TENCENT_MAP_API_BASE}/ws/geocoder/v1/?location=${latitude},${longitude}&key=${utils_mapConfig.TENCENT_MAP_KEY}&get_poi=1&poi_options=${poiOptions}`;
    common_vendor.index.request({
      url,
      method: "GET",
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.status === 0) {
          const result = res.data.result || {};
          const addressComponent = result.address_component || {};
          const addressInfo = {
            city: addressComponent.city || "",
            province: addressComponent.province || "",
            district: addressComponent.district || "",
            address: pickDetailedAddress(result)
          };
          resolve(addressInfo);
          return;
        }
        common_vendor.index.__f__("error", "at utils/reverseGeocode.js:74", "[逆地理编码] API返回错误:", res.data);
        reject(new Error(res.data && res.data.message || "逆地理编码失败"));
      },
      fail: (err) => {
        common_vendor.index.__f__("error", "at utils/reverseGeocode.js:78", "[逆地理编码] 请求失败:", err);
        reject(err);
      }
    });
  });
}
exports.reverseGeocode = reverseGeocode;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/reverseGeocode.js.map
