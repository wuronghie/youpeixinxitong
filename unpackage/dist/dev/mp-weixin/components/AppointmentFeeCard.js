"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = {
  __name: "AppointmentFeeCard",
  props: {
    appointment: { type: Object, default: () => ({}) },
    infoFeeAmount: { type: [Number, String], default: 0 }
  },
  setup(__props) {
    const props = __props;
    const totalAmount = common_vendor.computed(() => {
      const v = props.appointment.total_amount ?? props.appointment.total_fee;
      return v != null ? v : 300;
    });
    const showInfoFeePending = common_vendor.computed(() => {
      return props.appointment.status === "pending_confirm" && !props.appointment.deposit_paid;
    });
    const isTrial = common_vendor.computed(() => {
      const t = props.appointment.type || props.appointment.course_type;
      return t === "trial";
    });
    const isRegular = common_vendor.computed(() => {
      const t = props.appointment.type || props.appointment.course_type;
      return t === "regular";
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.t(totalAmount.value),
        b: showInfoFeePending.value
      }, showInfoFeePending.value ? {
        c: common_vendor.t(__props.infoFeeAmount)
      } : __props.appointment.deposit_paid ? {
        e: common_vendor.t(__props.infoFeeAmount)
      } : {}, {
        d: __props.appointment.deposit_paid,
        f: isTrial.value
      }, isTrial.value ? {} : {}, {
        g: isRegular.value
      }, isRegular.value ? {} : {});
    };
  }
};
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-d55d31a6"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/AppointmentFeeCard.js.map
