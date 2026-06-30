"use strict";
const common_vendor = require("../common/vendor.js");
let checking = false;
let lastPromptAt = 0;
function canPromptNow() {
  const now = Date.now();
  if (checking)
    return false;
  if (now - lastPromptAt < 1500)
    return false;
  return true;
}
function isAlreadyOnAppointmentDetail(appointmentId) {
  const pages = getCurrentPages();
  const page = pages.length ? pages[pages.length - 1] : null;
  if (!page || page.route !== "pages/appointment/detail")
    return false;
  const options = page.options || {};
  return options.id === appointmentId;
}
function goAppointmentDetail(appointmentId) {
  if (!appointmentId)
    return;
  if (isAlreadyOnAppointmentDetail(appointmentId))
    return;
  common_vendor.index.navigateTo({
    url: `/pages/appointment/detail?id=${appointmentId}`
  });
}
function promptTrialConfirm(item) {
  if (!item || !item._id)
    return;
  if (isAlreadyOnAppointmentDetail(item._id))
    return;
  const teacherName = item.teacher_name || item.teacher_display_name || "老师";
  const content = `您与${teacherName}的试课已结束，请前往预约详情页完成试课结果确认与评价。

· 试课成功：试课费 100% 结算给教师
· 试课不满意：教师获得 70%，您将收到 30% 退款`;
  common_vendor.index.showModal({
    title: "试课结果待确认",
    content,
    confirmText: "前往预约详情",
    cancelText: "稍后再说",
    success: (res) => {
      if (res.confirm) {
        goAppointmentDetail(item._id);
      }
    }
  });
}
async function checkPendingTrialConfirmReminder() {
  if (!canPromptNow())
    return;
  const token = common_vendor.index.getStorageSync("uni_id_token");
  const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
  if (!token || userInfo.role !== "parent")
    return;
  const pages = getCurrentPages();
  const route = pages.length ? pages[pages.length - 1].route : "";
  if (route === "pages/login/index" || route === "pages/common/register") {
    return;
  }
  checking = true;
  lastPromptAt = Date.now();
  try {
    const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
    const res = await appointmentQuery.listPendingTrialConfirmations();
    if (res.code !== 0 || !res.data || !res.data.list || !res.data.list.length) {
      return;
    }
    promptTrialConfirm(res.data.list[0]);
  } catch (e) {
    common_vendor.index.__f__("warn", "at utils/trialConfirmReminder.js:79", "[trialConfirmReminder] 检查待确认试课失败:", e);
  } finally {
    checking = false;
  }
}
exports.checkPendingTrialConfirmReminder = checkPendingTrialConfirmReminder;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/trialConfirmReminder.js.map
