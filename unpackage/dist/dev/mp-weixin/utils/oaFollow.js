"use strict";
const common_vendor = require("../common/vendor.js");
const utils_oaBind = require("./oaBind.js");
const CACHE_KEY = "wx_oa_follow_meta";
const SNOOZE_KEY = "wx_oa_follow_prompt_snooze_until";
const FALLBACK_META = {
  username: "gh_d8aa03b3fd59",
  oaName: "叁谦"
};
let metaCache = null;
let promptedThisSession = false;
async function loadOaFollowMeta(force = false) {
  if (!force && metaCache && metaCache.username)
    return metaCache;
  try {
    const cached = common_vendor.index.getStorageSync(CACHE_KEY);
    if (!force && cached && cached.username) {
      metaCache = cached;
      return cached;
    }
  } catch (e) {
  }
  try {
    const oa = common_vendor.tr.importObject("wx-oa-notify", { customUI: true });
    const res = await oa.getSetupHint();
    if (res && res.code === 0 && res.data) {
      metaCache = {
        username: String(res.data.username || "").trim() || FALLBACK_META.username,
        oaName: String(res.data.oaName || "").trim() || FALLBACK_META.oaName
      };
      try {
        common_vendor.index.setStorageSync(CACHE_KEY, metaCache);
      } catch (e) {
      }
      return metaCache;
    }
  } catch (e) {
    common_vendor.index.__f__("warn", "at utils/oaFollow.js:44", "[oaFollow] load meta fail", e);
  }
  metaCache = { ...FALLBACK_META };
  return metaCache;
}
async function openOfficialAccountFollow() {
  const meta = await loadOaFollowMeta();
  const username = meta.username;
  if (!username) {
    common_vendor.index.showModal({
      title: "暂未配置",
      content: "请先在服务号后台查看「原始ID」（gh_ 开头），填入 wx-oa/config.json 的 username。",
      showCancel: false
    });
    return { ok: false, reason: "no_username" };
  }
  if (typeof common_vendor.wx$1 !== "undefined" && typeof common_vendor.wx$1.openOfficialAccountProfile === "function") {
    return new Promise((resolve) => {
      common_vendor.wx$1.openOfficialAccountProfile({
        username,
        success: () => resolve({ ok: true, reason: "opened" }),
        fail: (err) => {
          common_vendor.index.__f__("warn", "at utils/oaFollow.js:72", "[oaFollow] openOfficialAccountProfile fail", err);
          common_vendor.index.navigateTo({
            url: "/pages/common/follow-oa",
            fail: () => {
              common_vendor.index.showModal({
                title: "无法打开",
                content: `请在微信中搜索「${meta.oaName}」并关注。`,
                showCancel: false
              });
            }
          });
          resolve({ ok: false, reason: "api_fail", err });
        }
      });
    });
  }
  common_vendor.index.navigateTo({
    url: "/pages/common/follow-oa",
    fail: () => {
      common_vendor.index.showModal({
        title: "请手动关注",
        content: `请搜索公众号「${meta.oaName}」并关注，然后返回小程序。`,
        showCancel: false
      });
    }
  });
  return { ok: false, reason: "unsupported" };
}
function isSnoozed() {
  try {
    const until = Number(common_vendor.index.getStorageSync(SNOOZE_KEY) || 0);
    return until > Date.now();
  } catch (e) {
    return false;
  }
}
function snoozeFollowPrompt(ms = 24 * 60 * 60 * 1e3) {
  try {
    common_vendor.index.setStorageSync(SNOOZE_KEY, Date.now() + ms);
  } catch (e) {
  }
}
async function promptFollowOfficialAccount(options = {}) {
  const { force = false, delayMs = 1200 } = options;
  const run = async () => {
    try {
      const token = common_vendor.index.getStorageSync("uni_id_token");
      if (!token)
        return { skipped: true, reason: "no_token" };
      if (!force && promptedThisSession)
        return { skipped: true, reason: "session" };
      if (!force && isSnoozed())
        return { skipped: true, reason: "snoozed" };
      const bindRes = await utils_oaBind.syncOaBind({ force: true, minIntervalMs: 0 });
      if (bindRes && bindRes.code === 0 && bindRes.data && bindRes.data.bound) {
        return { skipped: true, reason: "already_bound" };
      }
      promptedThisSession = true;
      const meta = await loadOaFollowMeta();
      const oaName = meta.oaName || "服务号";
      return await new Promise((resolve) => {
        common_vendor.index.showModal({
          title: "关注服务号，及时收通知",
          content: `关注「${oaName}」后，可收到预约、聊天、打卡等重要提醒，避免错过。`,
          confirmText: "去关注",
          cancelText: "稍后",
          success: async (res) => {
            if (res.confirm) {
              const opened = await openOfficialAccountFollow();
              resolve({ prompted: true, action: "follow", ...opened });
              return;
            }
            snoozeFollowPrompt();
            resolve({ prompted: true, action: "snooze" });
          },
          fail: () => resolve({ prompted: false, reason: "modal_fail" })
        });
      });
    } catch (e) {
      common_vendor.index.__f__("warn", "at utils/oaFollow.js:159", "[oaFollow] prompt fail", e);
      return { skipped: true, reason: "error" };
    }
  };
  if (delayMs > 0) {
    return new Promise((resolve) => {
      setTimeout(() => {
        run().then(resolve);
      }, delayMs);
    });
  }
  return run();
}
exports.loadOaFollowMeta = loadOaFollowMeta;
exports.openOfficialAccountFollow = openOfficialAccountFollow;
exports.promptFollowOfficialAccount = promptFollowOfficialAccount;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/oaFollow.js.map
