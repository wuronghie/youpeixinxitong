"use strict";
const common_vendor = require("../common/vendor.js");
let lastSyncAt = 0;
async function syncOaBind(options = {}) {
  const { force = false, minIntervalMs = 30 * 1e3 } = options;
  const token = common_vendor.index.getStorageSync("uni_id_token");
  if (!token)
    return { skipped: true, reason: "no_token" };
  const now = Date.now();
  if (!force && lastSyncAt && now - lastSyncAt < minIntervalMs) {
    return { skipped: true, reason: "throttled" };
  }
  lastSyncAt = now;
  try {
    const oa = common_vendor.tr.importObject("wx-oa-notify", { customUI: true });
    const res = await oa.syncMyOaBind();
    common_vendor.index.__f__("log", "at utils/oaBind.js:21", "[oaBind.sync]", res);
    return res;
  } catch (e) {
    common_vendor.index.__f__("warn", "at utils/oaBind.js:24", "[oaBind.sync] fail", e && (e.message || e));
    return { code: -1, message: e && (e.message || e.errMsg) };
  }
}
exports.syncOaBind = syncOaBind;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/oaBind.js.map
