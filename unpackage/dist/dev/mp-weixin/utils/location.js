"use strict";
const common_vendor = require("../common/vendor.js");
function getCurrentLocation(options = {}) {
  return new Promise((resolve, reject) => {
    const {
      highAccuracy = false,
      timeout = 1e4
    } = options;
    common_vendor.index.getLocation({
      type: highAccuracy ? "gcj02" : "wgs84",
      altitude: false,
      geocode: true,
      // 是否解析地址信息
      success: (res) => {
        common_vendor.index.__f__("log", "at utils/location.js:25", "[位置] 获取当前位置成功:", res);
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          address: res.address || "",
          city: res.city || "",
          province: res.province || "",
          district: res.district || "",
          speed: res.speed || 0,
          accuracy: res.accuracy || 0
        });
      },
      fail: (err) => {
        common_vendor.index.__f__("error", "at utils/location.js:38", "[位置] 获取当前位置失败:", err);
        let errorMessage = "获取位置失败";
        if (err.errMsg) {
          if (err.errMsg.includes("auth deny")) {
            errorMessage = "需要位置权限，请在设置中开启";
          } else if (err.errMsg.includes("timeout")) {
            errorMessage = "定位超时，请稍后重试";
          } else if (err.errMsg.includes("fail")) {
            errorMessage = "定位失败，请检查GPS是否开启";
          }
        }
        reject({
          code: err.errCode || -1,
          message: errorMessage,
          errMsg: err.errMsg
        });
      },
      complete: () => {
      }
    });
  });
}
function chooseLocation(options = {}) {
  return new Promise((resolve, reject) => {
    const {
      latitude,
      longitude
    } = options;
    common_vendor.index.chooseLocation({
      latitude,
      longitude,
      success: (res) => {
        common_vendor.index.__f__("log", "at utils/location.js:83", "[位置] 选择位置成功:", res);
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          name: res.name || "",
          address: res.address || "",
          province: res.province || "",
          city: res.city || "",
          district: res.district || ""
        });
      },
      fail: (err) => {
        common_vendor.index.__f__("error", "at utils/location.js:95", "[位置] 选择位置失败:", err);
        let errorMessage = "选择位置失败";
        if (err.errMsg) {
          if (err.errMsg.includes("cancel")) {
            errorMessage = "已取消选择";
          } else if (err.errMsg.includes("auth deny")) {
            errorMessage = "需要位置权限，请在设置中开启";
          }
        }
        reject({
          code: err.errCode || -1,
          message: errorMessage,
          errMsg: err.errMsg
        });
      }
    });
  });
}
function openLocation(options) {
  const {
    latitude,
    longitude,
    name = "目标位置",
    address = "",
    scale = 18
  } = options;
  if (!latitude || !longitude) {
    common_vendor.index.showToast({
      title: "位置信息不完整",
      icon: "none"
    });
    return;
  }
  common_vendor.index.openLocation({
    latitude,
    longitude,
    name,
    address,
    scale,
    success: () => {
      common_vendor.index.__f__("log", "at utils/location.js:149", "[位置] 打开地图成功");
    },
    fail: (err) => {
      common_vendor.index.__f__("error", "at utils/location.js:152", "[位置] 打开地图失败:", err);
      common_vendor.index.showToast({
        title: "打开地图失败",
        icon: "none"
      });
    }
  });
}
function parseAddress(address) {
  if (!address || typeof address !== "string") {
    return {
      province: "",
      city: "",
      district: "",
      detail: ""
    };
  }
  const addressObj = {
    province: "",
    city: "",
    district: "",
    detail: ""
  };
  const provinceMatch = address.match(/^(.+?省|.+?自治区|.+?市)/);
  if (provinceMatch) {
    addressObj.province = provinceMatch[1];
    address = address.replace(provinceMatch[1], "");
  }
  const cityMatch = address.match(/^(.+?市|.+?州)/);
  if (cityMatch) {
    addressObj.city = cityMatch[1];
    address = address.replace(cityMatch[1], "");
  }
  const districtMatch = address.match(/^(.+?区|.+?县|.+?市)/);
  if (districtMatch) {
    addressObj.district = districtMatch[1];
    address = address.replace(districtMatch[1], "");
  }
  addressObj.detail = address.trim();
  return addressObj;
}
function requestLocationPermission() {
  return new Promise((resolve) => {
    common_vendor.index.authorize({
      scope: "scope.userLocation",
      success: () => {
        common_vendor.index.__f__("log", "at utils/location.js:273", "[位置] 位置权限授权成功");
        resolve(true);
      },
      fail: (err) => {
        common_vendor.index.__f__("error", "at utils/location.js:277", "[位置] 位置权限授权失败:", err);
        common_vendor.index.showModal({
          title: "需要位置权限",
          content: "为了提供更好的服务，需要获取您的位置信息。请在设置中开启位置权限。",
          confirmText: "去设置",
          success: (modalRes) => {
            if (modalRes.confirm) {
              common_vendor.index.openSetting({
                success: (settingRes) => {
                  const authorized = settingRes.authSetting["scope.userLocation"];
                  resolve(authorized === true);
                },
                fail: () => {
                  resolve(false);
                }
              });
            } else {
              resolve(false);
            }
          }
        });
      }
    });
  });
}
exports.chooseLocation = chooseLocation;
exports.getCurrentLocation = getCurrentLocation;
exports.openLocation = openLocation;
exports.parseAddress = parseAddress;
exports.requestLocationPermission = requestLocationPermission;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/location.js.map
