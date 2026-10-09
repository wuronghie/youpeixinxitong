"use strict";
const common_vendor = require("../common/vendor.js");
function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}
function isValidCnMobile(value) {
  return /^1[3-9]\d{9}$/.test(normalizePhone(value));
}
function pickUserPhone(user = {}) {
  const parentPhone = user.parent_info && user.parent_info.phone;
  const candidates = [user.phone, user.mobile, parentPhone];
  for (const item of candidates) {
    const phone = normalizePhone(item);
    if (isValidCnMobile(phone))
      return phone;
  }
  return "";
}
async function bindWeixinPhone(event) {
  return bindWeixinPhoneByCode(pickPhoneAuthCode(event));
}
function pickPhoneAuthCode(event) {
  const detail = event && event.detail || {};
  const errMsg = String(detail.errMsg || "");
  if (errMsg && errMsg.indexOf("ok") === -1) {
    if (errMsg.indexOf("deny") !== -1 || errMsg.indexOf("fail user deny") !== -1) {
      throw new Error("您已拒绝授权手机号");
    }
    throw new Error("授权失败，请重试");
  }
  const code = detail.code;
  if (!code) {
    throw new Error("未获取到授权码，请更新微信后重试");
  }
  return code;
}
async function bindWeixinPhoneByCode(code) {
  if (!code) {
    throw new Error("未获取到授权码，请更新微信后重试");
  }
  const uniIdCo = common_vendor.tr.importObject("uni-id-co", { customUI: true });
  const res = await uniIdCo.bindMobileByMpWeixin({ code });
  if (res && res.errCode && res.errCode !== 0) {
    throw new Error(res.errMsg || res.message || "绑定手机号失败");
  }
  return res;
}
async function refreshBoundPhone() {
  const userProfile = common_vendor.tr.importObject("user-profile", { customUI: true });
  const res = await userProfile.getUserProfile();
  if (res && res.code === 0 && res.data) {
    return pickUserPhone(res.data);
  }
  return "";
}
function persistPickedPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!isValidCnMobile(normalized))
    return;
  const stored = common_vendor.index.getStorageSync("userInfo") || {};
  stored.phone = normalized;
  stored.mobile = normalized;
  common_vendor.index.setStorageSync("userInfo", stored);
}
async function bindWeixinPhoneAndSync(event) {
  await bindWeixinPhone(event);
  const phone = await refreshBoundPhone();
  if (phone)
    persistPickedPhone(phone);
  return phone;
}
exports.bindWeixinPhoneAndSync = bindWeixinPhoneAndSync;
exports.bindWeixinPhoneByCode = bindWeixinPhoneByCode;
exports.isValidCnMobile = isValidCnMobile;
exports.persistPickedPhone = persistPickedPhone;
exports.pickUserPhone = pickUserPhone;
exports.refreshBoundPhone = refreshBoundPhone;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/wxPhone.js.map
