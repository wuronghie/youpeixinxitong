"use strict";
const common_vendor = require("../common/vendor.js");
const utils_trialConfirmReminder = require("./trialConfirmReminder.js");
const CHAT_PUSH_EVENT = "chat:push";
const CHAT_BADGE_EVENT = "chat:badge";
const CHAT_UNREAD_STORAGE_KEY = "chat_unread_count";
const APP_PUSH_TYPES = {
  CHAT_NEW: "chat_new",
  SYSTEM_MESSAGE: "system_message",
  APPOINTMENT_UPDATE: "appointment_update"
};
let bindInFlight = null;
let lastBoundCid = "";
let listenerReady = false;
const listeners = /* @__PURE__ */ new Set();
const badgeListeners = /* @__PURE__ */ new Set();
const appPushListeners = /* @__PURE__ */ new Set();
function log(...args) {
  common_vendor.index.__f__("log", "at utils/chatPush.js:25", "[chatPush]", ...args);
}
function warn(...args) {
  common_vendor.index.__f__("warn", "at utils/chatPush.js:29", "[chatPush]", ...args);
}
function onChatPush(handler) {
  if (typeof handler !== "function")
    return;
  listeners.add(handler);
  log("订阅 chat:push，当前监听数=", listeners.size);
}
function offChatPush(handler) {
  if (!handler)
    return;
  listeners.delete(handler);
  log("取消订阅 chat:push，当前监听数=", listeners.size);
}
function onAppPush(types, handler) {
  if (typeof handler !== "function")
    return;
  const typeSet = new Set(Array.isArray(types) ? types : [types]);
  appPushListeners.add({ types: typeSet, fn: handler });
  log("订阅 app:push", [...typeSet], "当前监听数=", appPushListeners.size);
}
function offAppPush(handler) {
  if (!handler)
    return;
  for (const item of appPushListeners) {
    if (item.fn === handler)
      appPushListeners.delete(item);
  }
}
function onChatBadge(handler) {
  if (typeof handler !== "function")
    return;
  badgeListeners.add(handler);
}
function offChatBadge(handler) {
  if (!handler)
    return;
  badgeListeners.delete(handler);
}
function emitAppPush(payload) {
  if (!payload || !payload.type)
    return;
  log("分发 app:push type=", payload.type, "页面监听数=", appPushListeners.size);
  appPushListeners.forEach((item) => {
    if (!item.types.has(payload.type) && !item.types.has("*"))
      return;
    try {
      item.fn(payload);
    } catch (e) {
      warn("app:push 监听执行失败:", e);
    }
  });
}
function emitChatPush(payload) {
  log("分发 chat:push → 页面监听数=", listeners.size, "payload=", payload);
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      warn("页面监听执行失败:", e);
    }
  });
  try {
    common_vendor.index.$emit(CHAT_PUSH_EVENT, payload);
  } catch (e) {
  }
}
function emitChatBadge(count) {
  const n = Math.max(0, Number(count) || 0);
  try {
    common_vendor.index.setStorageSync(CHAT_UNREAD_STORAGE_KEY, n);
  } catch (e) {
  }
  log("分发 chat:badge →", n, "角标监听数=", badgeListeners.size);
  badgeListeners.forEach((fn) => {
    try {
      fn(n);
    } catch (e) {
      warn("角标监听执行失败:", e);
    }
  });
  try {
    common_vendor.index.$emit(CHAT_BADGE_EVENT, n);
  } catch (e) {
  }
}
function getCachedUnreadCount() {
  try {
    return Math.max(0, Number(common_vendor.index.getStorageSync(CHAT_UNREAD_STORAGE_KEY) || 0));
  } catch (e) {
    return 0;
  }
}
async function refreshBadgeAfterPush(reason) {
  var _a;
  log("开始刷新角标，原因=", reason);
  try {
    const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
    const res = await chatSend.pollUpdates({ mode: "badge" });
    log("角标 pollUpdates 结果=", res);
    if (res && res.code === 0) {
      const count = Math.max(0, Number(((_a = res.data) == null ? void 0 : _a.unreadMessages) || 0));
      emitChatBadge(count);
      return count;
    }
  } catch (e) {
    warn("刷新角标失败:", e);
  }
  return null;
}
function refreshChatBadge(reason = "markRead") {
  return refreshBadgeAfterPush(reason);
}
function bindPushClientId() {
  const token = common_vendor.index.getStorageSync("uni_id_token") || common_vendor.index.getStorageSync("token");
  if (!token) {
    warn("绑定 cid 跳过：未登录");
    return Promise.resolve(false);
  }
  if (bindInFlight)
    return bindInFlight;
  log("开始 getPushClientId…");
  bindInFlight = new Promise((resolve) => {
    common_vendor.index.getPushClientId({
      success: async (res) => {
        try {
          log("getPushClientId success=", res);
          const cid = res && res.cid;
          if (!cid) {
            warn("无 cid：请确认 manifest.mp-weixin.unipush.enable、socket 合法域名、真机运行");
            resolve(false);
            return;
          }
          if (cid === lastBoundCid) {
            log("cid 未变化，跳过上报", cid);
            resolve(true);
            return;
          }
          const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
          const result = await chatSend.reportPushClientId({ push_clientid: cid });
          log("reportPushClientId 结果=", result);
          if (result && result.code === 0) {
            lastBoundCid = cid;
            log("cid 绑定成功", cid);
            resolve(true);
            return;
          }
          warn("reportPushClientId 异常:", result);
          resolve(false);
        } catch (e) {
          warn("reportPushClientId 失败:", e);
          resolve(false);
        } finally {
          bindInFlight = null;
        }
      },
      fail: (err) => {
        warn("getPushClientId fail=", err);
        bindInFlight = null;
        resolve(false);
      }
    });
  });
  return bindInFlight;
}
function clearBoundPushClientId() {
  lastBoundCid = "";
}
function parseAppPushPayload(res) {
  if (!res)
    return null;
  const candidates = [];
  if (res.data !== void 0)
    candidates.push(res.data);
  candidates.push(res);
  for (const item of candidates) {
    if (!item)
      continue;
    let payload = item;
    if (payload.payload !== void 0)
      payload = payload.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        continue;
      }
    }
    if (!payload || typeof payload !== "object")
      continue;
    const type = payload.type || "";
    const conversationId = payload.conversation_id || payload.conversationId || "";
    const appointmentId = payload.appointment_id || payload.appointmentId || "";
    const sendTime = Number(payload.send_time || payload.sendTime || Date.now());
    if (type === APP_PUSH_TYPES.SYSTEM_MESSAGE) {
      return {
        type: APP_PUSH_TYPES.SYSTEM_MESSAGE,
        message_type: payload.message_type || payload.messageType || "system",
        related_id: payload.related_id || payload.relatedId || "",
        send_time: sendTime
      };
    }
    if (type === APP_PUSH_TYPES.APPOINTMENT_UPDATE) {
      return {
        type: APP_PUSH_TYPES.APPOINTMENT_UPDATE,
        appointment_id: appointmentId,
        status: payload.status || "",
        action: payload.action || "",
        send_time: sendTime
      };
    }
    if (type === APP_PUSH_TYPES.CHAT_NEW || conversationId) {
      return {
        type: APP_PUSH_TYPES.CHAT_NEW,
        conversation_id: conversationId,
        send_time: sendTime
      };
    }
  }
  return null;
}
function setupChatPushListener() {
  if (listenerReady) {
    log("onPushMessage 已注册，跳过重复注册");
    return;
  }
  listenerReady = true;
  log("注册 uni.onPushMessage");
  common_vendor.index.onPushMessage((res) => {
    log("★ 收到推送 onPushMessage 原始数据=", typeof res === "object" ? JSON.stringify(res) : res);
    const payload = parseAppPushPayload(res);
    if (!payload) {
      log("无法识别的推送，忽略");
      return;
    }
    log("解析后 payload=", payload);
    emitAppPush(payload);
    if (payload.type === APP_PUSH_TYPES.CHAT_NEW) {
      emitChatPush(payload);
      refreshBadgeAfterPush("onPushMessage");
    }
    if (payload.type === APP_PUSH_TYPES.APPOINTMENT_UPDATE) {
      const needRemind = payload.action === "clock_out" || payload.status === "in_progress";
      if (needRemind) {
        utils_trialConfirmReminder.checkPendingTrialConfirmReminder({ force: true });
      }
    }
  });
}
exports.APP_PUSH_TYPES = APP_PUSH_TYPES;
exports.bindPushClientId = bindPushClientId;
exports.clearBoundPushClientId = clearBoundPushClientId;
exports.getCachedUnreadCount = getCachedUnreadCount;
exports.offAppPush = offAppPush;
exports.offChatBadge = offChatBadge;
exports.offChatPush = offChatPush;
exports.onAppPush = onAppPush;
exports.onChatBadge = onChatBadge;
exports.onChatPush = onChatPush;
exports.refreshChatBadge = refreshChatBadge;
exports.setupChatPushListener = setupChatPushListener;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/chatPush.js.map
