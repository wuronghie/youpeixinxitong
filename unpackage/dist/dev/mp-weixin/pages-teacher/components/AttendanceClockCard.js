"use strict";
const common_vendor = require("../../common/vendor.js");
const pagesTeacher_utils_clockLocation = require("../utils/clockLocation.js");
const _sfc_main = {
  __name: "AttendanceClockCard",
  props: {
    appointmentId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      default: ""
    },
    classStartedAt: {
      type: [Number, String, null],
      default: null
    },
    classStartedLocation: {
      type: Object,
      default: () => null
    },
    classEndedAt: {
      type: [Number, String, null],
      default: null
    },
    classEndedLocation: {
      type: Object,
      default: () => null
    },
    scheduleStartTs: {
      type: Number,
      default: 0
    },
    scheduleEndTs: {
      type: Number,
      default: 0
    },
    parentPaid: {
      type: Boolean,
      default: false
    },
    isTrial: {
      type: Boolean,
      default: false
    }
  },
  emits: ["clocked"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const loading = common_vendor.ref(false);
    const pendingAction = common_vendor.ref("");
    const startedAddress = common_vendor.computed(() => formatLocationText(props.classStartedLocation));
    const endedAddress = common_vendor.computed(() => formatLocationText(props.classEndedLocation));
    const canClockIn = common_vendor.computed(() => {
      if (props.classStartedAt)
        return false;
      if (!props.parentPaid)
        return false;
      return props.status === "confirmed" || props.status === "in_progress" || props.status === "pending_confirm" || props.status === "completed";
    });
    const canClockOut = common_vendor.computed(() => {
      if (!props.classStartedAt || props.classEndedAt)
        return false;
      return props.parentPaid;
    });
    const headerHint = common_vendor.computed(() => {
      if (props.classStartedAt && props.classEndedAt)
        return "已完成";
      if (props.classStartedAt)
        return "可下课打卡";
      if (!props.parentPaid)
        return props.isTrial ? "待家长支付试课费" : "待家长支付课程费";
      if (canClockIn.value)
        return "可上课打卡";
      return "暂不可打卡";
    });
    function formatTime(ts) {
      if (!ts)
        return "";
      const d = new Date(Number(ts));
      if (Number.isNaN(d.getTime()))
        return "";
      const pad = (n) => n < 10 ? "0" + n : "" + n;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function formatLocationText(location) {
      if (!location)
        return "";
      return location.address || "";
    }
    async function callAttendance(method, payload) {
      const obj = common_vendor.tr.importObject("appointment-attendance", { customUI: true });
      return await obj[method](payload);
    }
    async function runClock(action) {
      if (loading.value)
        return;
      if (action === "in" && !canClockIn.value)
        return;
      if (action === "out" && !canClockOut.value)
        return;
      loading.value = true;
      pendingAction.value = action;
      try {
        const location = await pagesTeacher_utils_clockLocation.getLocationForClock();
        const res = await callAttendance(action === "in" ? "clockIn" : "clockOut", {
          appointment_id: props.appointmentId,
          location
        });
        if (res && res.code === 0) {
          common_vendor.index.showToast({ icon: "success", title: action === "in" ? "上课打卡成功" : "下课打卡成功" });
          emit("clocked", { type: action, data: res.data });
        } else {
          common_vendor.index.showToast({ icon: "none", title: res && res.message || "打卡失败" });
        }
      } catch (e) {
        const locMsg = pagesTeacher_utils_clockLocation.locationErrorMessage(e);
        const isLocation = /定位|位置|隐私|权限|GPS|timeout/i.test(locMsg) || /getLocation|getFuzzyLocation|privacy/i.test(String(e && (e.errMsg || e.message) || ""));
        common_vendor.index.showToast({
          icon: "none",
          title: isLocation ? locMsg : "打卡异常：" + pagesTeacher_utils_clockLocation.cloudClockErrorMessage(e)
        });
      } finally {
        loading.value = false;
        pendingAction.value = "";
      }
    }
    function onClockIn() {
      runClock("in");
    }
    function onClockOut() {
      runClock("out");
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.t(headerHint.value),
        b: __props.classStartedAt
      }, __props.classStartedAt ? {
        c: common_vendor.t(formatTime(__props.classStartedAt))
      } : {}, {
        d: startedAddress.value
      }, startedAddress.value ? {
        e: common_vendor.t(startedAddress.value)
      } : {}, {
        f: !!__props.classStartedAt ? 1 : "",
        g: canClockIn.value ? 1 : "",
        h: !!__props.classEndedAt ? 1 : "",
        i: __props.classEndedAt
      }, __props.classEndedAt ? {
        j: common_vendor.t(formatTime(__props.classEndedAt))
      } : {}, {
        k: endedAddress.value
      }, endedAddress.value ? {
        l: common_vendor.t(endedAddress.value)
      } : {}, {
        m: !!__props.classEndedAt ? 1 : "",
        n: canClockOut.value ? 1 : "",
        o: !__props.classStartedAt
      }, !__props.classStartedAt ? {
        p: common_vendor.t(loading.value && pendingAction.value === "in" ? "上课打卡中..." : "上课打卡"),
        q: !canClockIn.value || loading.value,
        r: common_vendor.o(onClockIn)
      } : {}, {
        s: __props.classStartedAt && !__props.classEndedAt
      }, __props.classStartedAt && !__props.classEndedAt ? {
        t: common_vendor.t(loading.value && pendingAction.value === "out" ? "下课打卡中..." : "下课打卡"),
        v: !canClockOut.value || loading.value,
        w: common_vendor.o(onClockOut)
      } : {}, {
        x: __props.classStartedAt && __props.classEndedAt
      }, __props.classStartedAt && __props.classEndedAt ? {} : {});
    };
  }
};
wx.createComponent(_sfc_main);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/components/AttendanceClockCard.js.map
