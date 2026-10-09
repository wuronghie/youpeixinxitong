"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_reverseGeocode = require("../../utils/reverseGeocode.js");
function getWxSdk() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.wx)
      return globalThis.wx;
  } catch (e) {
  }
  try {
    return Function('return typeof wx !== "undefined" ? wx : undefined')();
  } catch (e) {
  }
  return void 0;
}
function errText(err) {
  return String(err && (err.errMsg || err.message || err.errCode) || "");
}
function callLocationApi(wxApi, name, extra = {}) {
  const nativeFn = wxApi && typeof wxApi[name] === "function" ? wxApi[name].bind(wxApi) : null;
  const uniFn = typeof common_vendor.index[name] === "function" ? common_vendor.index[name].bind(common_vendor.index) : null;
  const api = nativeFn || uniFn;
  if (!api) {
    return Promise.reject({ errMsg: name + ":fail not supported" });
  }
  return new Promise((resolve, reject) => {
    api({
      type: "gcj02",
      ...extra,
      success: resolve,
      fail: reject
    });
  });
}
function requestRawLocation(wxApi) {
  return callLocationApi(wxApi, "getLocation", { isHighAccuracy: false });
}
function requirePrivacyThen(wxApi, next) {
  if (!wxApi || typeof wxApi.requirePrivacyAuthorize !== "function") {
    next();
    return;
  }
  wxApi.requirePrivacyAuthorize({
    success: () => next(),
    fail: (err) => {
      const msg = errText(err);
      if (/cancel|deny|拒绝/i.test(msg)) {
        next(new Error("需要同意隐私协议才能打卡"));
        return;
      }
      next();
    }
  });
}
function openLocationSetting() {
  return new Promise((resolve) => {
    common_vendor.index.showModal({
      title: "需要位置权限",
      content: "打卡需要获取当前位置。请在设置中开启位置权限后重试。",
      confirmText: "去设置",
      success: (modalRes) => {
        if (!modalRes.confirm) {
          resolve(false);
          return;
        }
        common_vendor.index.openSetting({
          success: (r) => resolve(!!(r.authSetting && r.authSetting["scope.userLocation"])),
          fail: () => resolve(false)
        });
      },
      fail: () => resolve(false)
    });
  });
}
function resolveAddress(res) {
  if (!res || !res.address)
    return "";
  if (typeof res.address === "string")
    return res.address;
  return res.address.formatted_address || [
    res.address.province,
    res.address.city,
    res.address.district,
    res.address.street,
    res.address.street_number,
    res.address.poi_name
  ].filter(Boolean).join("");
}
function reverseGeocodeWithTimeout(latitude, longitude, ms = 5e3) {
  return Promise.race([
    utils_reverseGeocode.reverseGeocode(latitude, longitude).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}
async function buildLocationPayload(res) {
  const latitude = Number(res && res.latitude);
  const longitude = Number(res && res.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("定位结果无效，请重试");
  }
  let address = resolveAddress(res);
  if (!address) {
    try {
      const info = await reverseGeocodeWithTimeout(latitude, longitude);
      if (info) {
        address = info.address || [info.province, info.city, info.district].filter(Boolean).join("");
      }
    } catch (e) {
      common_vendor.index.__f__("warn", "at pages-teacher/utils/clockLocation.js:118", "[打卡定位] 逆地理编码失败:", e);
    }
  }
  if (!address) {
    address = `已定位(${latitude.toFixed(5)},${longitude.toFixed(5)})`;
  }
  return {
    latitude,
    longitude,
    address,
    accuracy: Number(res && res.accuracy) || 0
  };
}
function getLocationForClock() {
  const wxApi = getWxSdk();
  return new Promise((resolve, reject) => {
    const finish = async (raw) => {
      try {
        resolve(await buildLocationPayload(raw));
      } catch (e) {
        reject(e);
      }
    };
    const locate = () => {
      requestRawLocation(wxApi).then(finish, async (err) => {
        const msg = errText(err);
        if (/auth deny|authorize|permission|隐私|权限/i.test(msg)) {
          const granted = await openLocationSetting();
          if (granted) {
            try {
              finish(await requestRawLocation(wxApi));
              return;
            } catch (retryErr) {
              reject(retryErr);
              return;
            }
          }
        }
        reject(err);
      });
    };
    requirePrivacyThen(wxApi, (privacyErr) => {
      if (privacyErr) {
        reject(privacyErr);
        return;
      }
      locate();
    });
  });
}
function locationErrorMessage(err) {
  const msg = errText(err);
  if (!msg)
    return "获取定位失败，请重试";
  if (/隐私协议/.test(msg))
    return msg;
  if (/privacy/i.test(msg))
    return "需要同意隐私协议才能打卡";
  if (/requiredPrivateInfos|declare/i.test(msg))
    return "定位接口未声明，请重新进入小程序后再试";
  if (/auth deny|authorize|permission|隐私|权限/i.test(msg)) {
    return "需要开启小程序位置权限才能打卡";
  }
  if (/timeout/i.test(msg))
    return "定位超时，请到开阔处重试";
  if (/system|GPS|location/i.test(msg) && /fail/i.test(msg)) {
    return "定位失败，请确认手机系统定位已开启";
  }
  return msg.length > 40 ? "获取定位失败，请重试" : msg;
}
function cloudClockErrorMessage(err) {
  const msg = errText(err);
  if (/未登录|token|login/i.test(msg))
    return "登录已过期，请重新登录后再打卡";
  if (/不存在|not found|FUNCTION_NOT_FOUND|云对象/i.test(msg))
    return "打卡服务未就绪，请稍后重试";
  if (/timeout|超时/i.test(msg))
    return "打卡超时，请稍后重试";
  if (msg && msg.length <= 40)
    return msg;
  return "打卡失败，请重试";
}
exports.cloudClockErrorMessage = cloudClockErrorMessage;
exports.getLocationForClock = getLocationForClock;
exports.locationErrorMessage = locationErrorMessage;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/utils/clockLocation.js.map
