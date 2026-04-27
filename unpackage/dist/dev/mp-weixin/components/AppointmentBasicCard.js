"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = {
  __name: "AppointmentBasicCard",
  props: {
    appointment: { type: Object, default: () => ({}) }
  },
  setup(__props) {
    const props = __props;
    const studentInfo = common_vendor.computed(() => props.appointment.student_info || {});
    const studentName = common_vendor.computed(() => studentInfo.value.name || props.appointment.student_name || "学生");
    const studentGrade = common_vendor.computed(() => studentInfo.value.grade || props.appointment.student_grade || "--");
    const studentSubject = common_vendor.computed(() => studentInfo.value.subject || props.appointment.subject || "--");
    const studentRequirement = common_vendor.computed(() => studentInfo.value.requirements || "");
    const courseTypeText = common_vendor.computed(() => {
      const type = props.appointment.type || props.appointment.course_type;
      return type === "trial" ? "试课" : "正式课程";
    });
    const schedule = common_vendor.computed(() => props.appointment.schedule || {});
    const scheduleTime = common_vendor.computed(() => {
      const date = schedule.value.date || props.appointment.appointment_date || "";
      const time = schedule.value.start_time || props.appointment.appointment_time || "";
      return [date, time].filter(Boolean).join(" ");
    });
    const duration = common_vendor.computed(() => schedule.value.duration || props.appointment.duration || 2);
    const formattedAddress = common_vendor.computed(() => {
      const addr = props.appointment.address;
      if (!addr)
        return "";
      if (typeof addr === "string")
        return addr;
      if (typeof addr === "object") {
        const parts = [addr.province, addr.city, addr.district, addr.detail].filter(Boolean);
        return parts.join("") || addr.address || "";
      }
      return "";
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.t(studentName.value),
        b: common_vendor.t(studentGrade.value),
        c: common_vendor.t(studentSubject.value),
        d: common_vendor.t(__props.appointment.appointment_no || "--"),
        e: common_vendor.t(courseTypeText.value),
        f: common_vendor.t(scheduleTime.value || "--"),
        g: common_vendor.t(duration.value),
        h: common_vendor.t(formattedAddress.value || "待确认"),
        i: !studentRequirement.value ? 1 : "",
        j: studentRequirement.value
      }, studentRequirement.value ? {
        k: common_vendor.t(studentRequirement.value)
      } : {});
    };
  }
};
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-7834942a"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/AppointmentBasicCard.js.map
