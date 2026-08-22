"use strict";
const common_vendor = require("../common/vendor.js");
const utils_chatPush = require("./chatPush.js");
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
    // 性别（uni-id 约定：0=未知, 1=男, 2=女）
    gender: data.gender != null ? data.gender : 0,
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
  utils_chatPush.clearBoundPushClientId();
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
    const phone = userInfo.phone || userInfo.mobile || parentInfo.phone || "";
    const genderCode = userInfo.gender;
    const genderFilled = genderCode === 1 || genderCode === 2 || genderCode === "1" || genderCode === "2" || genderCode === "male" || genderCode === "female";
    const studentGender = parentInfo.student_gender;
    const studentGenderFilled = studentGender === "male" || studentGender === "female" || studentGender === 1 || studentGender === 2 || studentGender === "1" || studentGender === "2";
    const missing = [];
    if (!parentInfo.real_name)
      missing.push("家长姓名");
    if (!genderFilled)
      missing.push("性别");
    if (!phone)
      missing.push("手机号");
    if (!parentInfo.student_name)
      missing.push("学生姓名");
    if (!studentGenderFilled)
      missing.push("孩子性别");
    if (!parentInfo.student_grade)
      missing.push("学生年级");
    common_vendor.index.__f__("log", "at utils/auth.js:80", "[auth] 家长信息检查:", {
      real_name: parentInfo.real_name,
      gender: genderCode,
      phone,
      student_name: parentInfo.student_name,
      student_gender: studentGender,
      student_grade: parentInfo.student_grade,
      missing
    });
    if (missing.length > 0) {
      return {
        isComplete: false,
        message: "请完善资料：" + missing.join("、"),
        redirectUrl: "/pages/common/register"
      };
    }
    return { isComplete: true };
  } else if (userInfo.role === "teacher") {
    try {
      const dashboard = common_vendor.tr.importObject("teacher-dashboard", { customUI: true });
      const res = await dashboard.checkProfileComplete();
      common_vendor.index.__f__("log", "at utils/auth.js:103", "[auth] 教师信息检查结果:", res);
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
        common_vendor.index.__f__("warn", "at utils/auth.js:119", "[auth] 检查教师信息失败，跳转到首页:", res.message);
        return { isComplete: true };
      }
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/auth.js:123", "[auth] 检查教师信息异常:", error);
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
    common_vendor.index.__f__("error", "at utils/auth.js:177", "[auth] 获取远程用户信息失败:", error);
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
