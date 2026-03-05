"use strict";
const common_vendor = require("../common/vendor.js");
const DEFAULT_ROLE = "parent";
function normalizeUserInfoFromDb(data = {}) {
  const activeRole = data.role || DEFAULT_ROLE;
  return {
    uid: data._id || data.uid,
    nickname: data.nickname || data.wx_nickname || "微信用户",
    avatar: data.avatar || data.wx_avatarUrl || "",
    role: activeRole,
    status: data.status || "active",
    phone: data.phone || "",
    parent_info: data.parent_info || {},
    teacherProfile: data.teacher_info || data.teacherProfile || {},
    wallet: data.wallet || {}
  };
}
function getStoredUserInfo() {
  return common_vendor.index.getStorageSync("userInfo") || {};
}
function setStoredUserInfo(info = {}) {
  if (info && typeof info === "object") {
    common_vendor.index.setStorageSync("userInfo", info);
    if (info.role) {
      common_vendor.index.setStorageSync("last_role", info.role);
    }
  }
}
function clearStoredAuth() {
  common_vendor.index.removeStorageSync("uni_id_token");
  common_vendor.index.removeStorageSync("token");
  common_vendor.index.removeStorageSync("userInfo");
  common_vendor.index.removeStorageSync("last_role");
}
function redirectByRole(role) {
  const url = role === "teacher" ? "/pages-teacher/index/index" : "/pages/teacher/list";
  setTimeout(() => {
    common_vendor.index.reLaunch({ url });
  }, 100);
}
async function checkProfileComplete(userInfo) {
  if (!userInfo || !userInfo.role) {
    return { isComplete: false, message: "用户信息不完整" };
  }
  if (userInfo.role === "parent") {
    const parentInfo = userInfo.parent_info || {};
    if (!parentInfo.student_name || !parentInfo.student_grade) {
      return {
        isComplete: false,
        message: "请完善孩子信息（学生姓名和年级）",
        redirectUrl: "/pages/common/register"
      };
    }
    return { isComplete: true };
  } else if (userInfo.role === "teacher") {
    try {
      const dashboard = common_vendor.tr.importObject("teacher-dashboard", { customUI: true });
      const res = await dashboard.checkProfileComplete();
      common_vendor.index.__f__("log", "at utils/auth.js:75", "[auth] 教师信息检查结果:", res);
      if (res.code === 0 && res.data) {
        const { isComplete, missingFieldsText } = res.data;
        if (!isComplete) {
          return {
            isComplete: false,
            message: `请完善教师资料：${missingFieldsText.join("、")}`,
            redirectUrl: "/pages-teacher/profile/edit",
            missingFields: res.data.missingFields || [],
            missingFieldsText: missingFieldsText || []
          };
        }
        return { isComplete: true };
      } else {
        common_vendor.index.__f__("warn", "at utils/auth.js:91", "[auth] 检查教师信息失败，跳转到首页:", res.message);
        return { isComplete: true };
      }
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/auth.js:95", "[auth] 检查教师信息异常:", error);
      return { isComplete: true };
    }
  }
  return { isComplete: true };
}
function ensureLoggedIn(requiredRole = null) {
  const token = common_vendor.index.getStorageSync("uni_id_token");
  const userInfo = getStoredUserInfo();
  if (!token || !userInfo.uid) {
    common_vendor.index.reLaunch({ url: "/pages/login/index" });
    return false;
  }
  if (requiredRole && userInfo.role !== requiredRole) {
    redirectByRole(userInfo.role || DEFAULT_ROLE);
    return false;
  }
  return true;
}
async function fetchRemoteUserInfo(options = {}) {
  const token = options.token || common_vendor.index.getStorageSync("uni_id_token");
  if (!token) {
    const local = getStoredUserInfo();
    if (local && local.uid) {
      return local;
    }
    throw new Error("未登录或登录已过期");
  }
  try {
    const userProfile = common_vendor.tr.importObject("user-profile", { customUI: true });
    const res = await userProfile.getUserProfile();
    if (res.code === 0 && res.data) {
      const normalized = normalizeUserInfoFromDb(res.data);
      setStoredUserInfo(normalized);
      return normalized;
    }
    const local = getStoredUserInfo();
    if (local && local.uid) {
      return local;
    }
    throw new Error(res.message || "获取用户信息失败");
  } catch (error) {
    common_vendor.index.__f__("error", "at utils/auth.js:149", "[auth] 获取远程用户信息失败:", error);
    const local = getStoredUserInfo();
    if (local && local.uid) {
      return local;
    }
    throw error;
  }
}
exports.checkProfileComplete = checkProfileComplete;
exports.clearStoredAuth = clearStoredAuth;
exports.ensureLoggedIn = ensureLoggedIn;
exports.fetchRemoteUserInfo = fetchRemoteUserInfo;
exports.getStoredUserInfo = getStoredUserInfo;
exports.redirectByRole = redirectByRole;
exports.setStoredUserInfo = setStoredUserInfo;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/auth.js.map
