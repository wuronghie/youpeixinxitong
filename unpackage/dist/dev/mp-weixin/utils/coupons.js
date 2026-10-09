"use strict";
const common_vendor = require("../common/vendor.js");
const PENDING_KEY = "just_issued_coupons";
const CACHE_KEY = "cached_available_coupons";
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function persistIssuedCoupons({ count = 0, names = [], role = "" } = {}) {
  if (!count)
    return;
  common_vendor.index.setStorageSync(PENDING_KEY, {
    at: Date.now(),
    count,
    names: Array.isArray(names) ? names : [],
    role
  });
}
function getPendingIssuedCoupons() {
  const data = common_vendor.index.getStorageSync(PENDING_KEY);
  if (!data || !data.at)
    return null;
  if (Date.now() - data.at > 5 * 60 * 1e3) {
    common_vendor.index.removeStorageSync(PENDING_KEY);
    return null;
  }
  return data;
}
function getCachedAvailableCoupons(role) {
  const cache = common_vendor.index.getStorageSync(CACHE_KEY);
  if (!cache || cache.role !== role || !Array.isArray(cache.list))
    return [];
  if (Date.now() - (cache.at || 0) > 2 * 60 * 1e3)
    return [];
  return cache.list;
}
async function fetchAvailableCoupons(role) {
  const couponCenter = common_vendor.tr.importObject("coupon-center", { customUI: true });
  const pending = getPendingIssuedCoupons();
  const waiting = !!(pending && (!pending.role || pending.role === role) && pending.count > 0);
  const attempts = waiting ? 4 : 1;
  let list = [];
  let message = "";
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await sleep(400 * i);
    }
    const res = await couponCenter.getAvailableCoupons({ role });
    if (res && res.code === 0 && res.data && Array.isArray(res.data.list)) {
      list = res.data.list;
      if (list.length)
        break;
    } else if (res && res.message) {
      message = res.message;
    }
  }
  if (list.length) {
    common_vendor.index.removeStorageSync(PENDING_KEY);
    common_vendor.index.setStorageSync(CACHE_KEY, { role, list, at: Date.now() });
  }
  return { list, message, waiting };
}
function prefetchAvailableCoupons(role) {
  if (role !== "parent" && role !== "teacher")
    return;
  setTimeout(() => {
    fetchAvailableCoupons(role).catch((err) => {
      common_vendor.index.__f__("warn", "at utils/coupons.js:72", "[coupons] prefetch failed:", err);
    });
  }, 400);
}
exports.fetchAvailableCoupons = fetchAvailableCoupons;
exports.getCachedAvailableCoupons = getCachedAvailableCoupons;
exports.getPendingIssuedCoupons = getPendingIssuedCoupons;
exports.persistIssuedCoupons = persistIssuedCoupons;
exports.prefetchAvailableCoupons = prefetchAvailableCoupons;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/coupons.js.map
