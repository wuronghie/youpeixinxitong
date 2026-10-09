"use strict";
const common_vendor = require("../../common/vendor.js");
const STORAGE_KEY = "appointment_create_teacher_preview";
function saveAppointmentTeacherPreview(preview) {
  if (!preview || typeof preview !== "object")
    return;
  try {
    common_vendor.index.setStorageSync(STORAGE_KEY, preview);
  } catch (e) {
    common_vendor.index.__f__("warn", "at pages-teacher/utils/appointmentTeacherPreview.js:14", "[appointmentTeacherPreview] 保存预览失败:", e);
  }
}
exports.saveAppointmentTeacherPreview = saveAppointmentTeacherPreview;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/utils/appointmentTeacherPreview.js.map
