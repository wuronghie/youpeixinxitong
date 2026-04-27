"use strict";
const common_vendor = require("../common/vendor.js");
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
    }
  },
  emits: ["clocked"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const loading = common_vendor.ref(false);
    const pendingAction = common_vendor.ref("");
    const startedAddress = common_vendor.computed(() => props.classStartedLocation && props.classStartedLocation.address || "");
    const endedAddress = common_vendor.computed(() => props.classEndedLocation && props.classEndedLocation.address || "");
    const canClockIn = common_vendor.computed(() => {
      if (props.classStartedAt)
        return false;
      return props.status === "pending_confirm" || props.status === "confirmed" || props.status === "in_progress";
    });
    const canClockOut = common_vendor.computed(() => {
      if (!props.classStartedAt || props.classEndedAt)
        return false;
      return true;
    });
    const headerHint = common_vendor.computed(() => {
      if (props.classStartedAt && props.classEndedAt)
        return "已完成";
      if (props.classStartedAt)
        return "可下课打卡";
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
    function getLocation() {
      return new Promise((resolve, reject) => {
        common_vendor.index.getLocation({
          type: "gcj02",
          isHighAccuracy: true,
          geocode: true,
          success: (res) => {
            resolve({
              latitude: res.latitude,
              longitude: res.longitude,
              address: res.address && (res.address.formatted_address || [
                res.address.province,
                res.address.city,
                res.address.district,
                res.address.street
              ].filter(Boolean).join("")) || "",
              accuracy: res.accuracy || 0
            });
          },
          fail: (err) => reject(err)
        });
      });
    }
    async function callAttendance(method, payload) {
      const obj = common_vendor.tr.importObject("appointment-attendance", { customUI: true });
      return await obj[method](payload);
    }
    async function onClockIn() {
      if (!canClockIn.value || loading.value)
        return;
      loading.value = true;
      pendingAction.value = "in";
      try {
        const location = await getLocation().catch(() => null);
        if (!location) {
          common_vendor.index.showToast({ icon: "none", title: "需要授权定位才能打卡" });
          return;
        }
        const res = await callAttendance("clockIn", {
          appointment_id: props.appointmentId,
          location
        });
        if (res && res.code === 0) {
          common_vendor.index.showToast({ icon: "success", title: "上课打卡成功" });
          emit("clocked", { type: "in", data: res.data });
        } else {
          common_vendor.index.showToast({ icon: "none", title: res && res.message || "打卡失败" });
        }
      } catch (e) {
        common_vendor.index.showToast({ icon: "none", title: "打卡异常：" + (e && e.message || e) });
      } finally {
        loading.value = false;
        pendingAction.value = "";
      }
    }
    async function onClockOut() {
      if (!canClockOut.value || loading.value)
        return;
      loading.value = true;
      pendingAction.value = "out";
      try {
        const location = await getLocation().catch(() => null);
        if (!location) {
          common_vendor.index.showToast({ icon: "none", title: "需要授权定位才能打卡" });
          return;
        }
        const res = await callAttendance("clockOut", {
          appointment_id: props.appointmentId,
          location
        });
        if (res && res.code === 0) {
          common_vendor.index.showToast({ icon: "success", title: "下课打卡成功" });
          emit("clocked", { type: "out", data: res.data });
        } else {
          common_vendor.index.showToast({ icon: "none", title: res && res.message || "打卡失败" });
        }
      } catch (e) {
        common_vendor.index.showToast({ icon: "none", title: "打卡异常：" + (e && e.message || e) });
      } finally {
        loading.value = false;
        pendingAction.value = "";
      }
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
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/AttendanceClockCard.js.map
