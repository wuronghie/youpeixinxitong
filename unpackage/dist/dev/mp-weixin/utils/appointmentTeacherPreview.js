"use strict";
const common_vendor = require("../common/vendor.js");
const STORAGE_KEY = "appointment_create_teacher_preview";
function saveAppointmentTeacherPreview(preview) {
  if (!preview || typeof preview !== "object")
    return;
  try {
    common_vendor.index.setStorageSync(STORAGE_KEY, preview);
  } catch (e) {
    common_vendor.index.__f__("warn", "at utils/appointmentTeacherPreview.js:11", "[appointmentTeacherPreview] 保存预览失败:", e);
  }
}
function readAppointmentTeacherPreview() {
  try {
    const data = common_vendor.index.getStorageSync(STORAGE_KEY);
    return data && typeof data === "object" ? data : null;
  } catch (e) {
    return null;
  }
}
function clearAppointmentTeacherPreview() {
  try {
    common_vendor.index.removeStorageSync(STORAGE_KEY);
  } catch (e) {
  }
}
function applyAppointmentTeacherPreview(vm, preview) {
  var _a, _b;
  if (!preview || !vm)
    return;
  if (preview.teacherProfileId)
    vm.teacherProfileId = preview.teacherProfileId;
  if (preview.teacherUid)
    vm.teacherUid = preview.teacherUid;
  if (preview.teacher_id && !vm.teacherUid)
    vm.teacherUid = preview.teacher_id;
  const displayName = preview.display_name || preview.name || preview.nickname || "";
  vm.teacherInfo = {
    ...vm.teacherInfo || {},
    ...preview,
    display_name: displayName,
    name: preview.name || displayName,
    teacher_id: preview.teacher_id || preview.teacherUid || vm.teacherUid || "",
    avatar: preview.avatar || ((_a = vm.teacherInfo) == null ? void 0 : _a.avatar) || "",
    hourly_rate: preview.hourly_rate != null ? preview.hourly_rate : (_b = vm.teacherInfo) == null ? void 0 : _b.hourly_rate
  };
}
exports.applyAppointmentTeacherPreview = applyAppointmentTeacherPreview;
exports.clearAppointmentTeacherPreview = clearAppointmentTeacherPreview;
exports.readAppointmentTeacherPreview = readAppointmentTeacherPreview;
exports.saveAppointmentTeacherPreview = saveAppointmentTeacherPreview;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/appointmentTeacherPreview.js.map
