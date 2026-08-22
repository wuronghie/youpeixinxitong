"use strict";
const common_vendor = require("../common/vendor.js");
const utils_reverseGeocode = require("../utils/reverseGeocode.js");
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
      return props.status === "confirmed" || props.status === "in_progress";
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
        return "待家长支付试课费";
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
    function resolveAddress(res) {
      if (!res || !res.address)
        return "";
      if (typeof res.address === "string")
        return res.address;
      return res.address.formatted_address || [
        res.address.province,
        res.address.city,
        res.address.district,
        res.address.street,
        res.address.street_number,
        res.address.poi_name
      ].filter(Boolean).join("");
    }
    async function resolveAddressByMap(latitude, longitude) {
      try {
        const info = await utils_reverseGeocode.reverseGeocode(latitude, longitude);
        if (!info)
          return "";
        return info.address || [info.province, info.city, info.district].filter(Boolean).join("");
      } catch (e) {
        common_vendor.index.__f__("warn", "at components/AttendanceClockCard.vue:170", "[打卡定位] 逆地理编码失败:", e);
        return "";
      }
    }
    function locationErrorMessage(err) {
      const msg = String(err && (err.message || err.errMsg) || "");
      if (!msg)
        return "获取定位失败，请重试";
      if (/auth deny|authorize|permission|隐私|权限/i.test(msg)) {
        return "需要开启小程序位置权限才能打卡";
      }
      if (/timeout/i.test(msg))
        return "定位超时，请到开阔处重试";
      if (/system|GPS|location/i.test(msg) && /fail/i.test(msg)) {
        return "定位失败，请确认手机系统定位已开启";
      }
      return msg.length > 40 ? "获取定位失败，请重试" : msg;
    }
    function ensureLocationPermission() {
      return new Promise((resolve) => {
        common_vendor.index.getSetting({
          success: (setting) => {
            const authed = setting.authSetting && setting.authSetting["scope.userLocation"];
            if (authed === true) {
              resolve(true);
              return;
            }
            if (authed === false) {
              common_vendor.index.showModal({
                title: "需要位置权限",
                content: "打卡需要获取当前位置。请在设置中开启位置权限后重试。",
                confirmText: "去设置",
                success: (modalRes) => {
                  if (!modalRes.confirm) {
                    resolve(false);
                    return;
                  }
                  common_vendor.index.openSetting({
                    success: (r) => resolve(!!(r.authSetting && r.authSetting["scope.userLocation"])),
                    fail: () => resolve(false)
                  });
                }
              });
              return;
            }
            common_vendor.index.authorize({
              scope: "scope.userLocation",
              success: () => resolve(true),
              fail: () => {
                common_vendor.index.showModal({
                  title: "需要位置权限",
                  content: "打卡需要获取当前位置。请在设置中开启位置权限后重试。",
                  confirmText: "去设置",
                  success: (modalRes) => {
                    if (!modalRes.confirm) {
                      resolve(false);
                      return;
                    }
                    common_vendor.index.openSetting({
                      success: (r) => resolve(!!(r.authSetting && r.authSetting["scope.userLocation"])),
                      fail: () => resolve(false)
                    });
                  }
                });
              }
            });
          },
          fail: () => resolve(true)
        });
      });
    }
    function requestRawLocation() {
      return new Promise((resolve, reject) => {
        common_vendor.index.getLocation({
          type: "gcj02",
          // 微信小程序 geocode 无效；高精度在部分机型易超时，先普通定位
          isHighAccuracy: false,
          success: (res) => resolve(res),
          fail: (err) => reject(err)
        });
      });
    }
    async function getLocationForClock() {
      const ok = await ensureLocationPermission();
      if (!ok) {
        throw new Error("需要开启小程序位置权限才能打卡");
      }
      const res = await requestRawLocation();
      const latitude = Number(res.latitude);
      const longitude = Number(res.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("定位结果无效，请重试");
      }
      let address = resolveAddress(res);
      if (!address) {
        address = await resolveAddressByMap(latitude, longitude);
      }
      if (!address) {
        address = `已定位(${latitude.toFixed(5)},${longitude.toFixed(5)})`;
        common_vendor.index.__f__("warn", "at components/AttendanceClockCard.vue:277", "[打卡定位] 文字地址解析失败，使用经纬度兜底");
      }
      return {
        latitude,
        longitude,
        address,
        accuracy: Number(res.accuracy) || 0
      };
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
        const location = await getLocationForClock().catch((e) => {
          common_vendor.index.showToast({ icon: "none", title: locationErrorMessage(e) });
          return null;
        });
        if (!location) {
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
        common_vendor.index.showToast({ icon: "none", title: "打卡异常：" + locationErrorMessage(e) });
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
        const location = await getLocationForClock().catch((e) => {
          common_vendor.index.showToast({ icon: "none", title: locationErrorMessage(e) });
          return null;
        });
        if (!location) {
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
        common_vendor.index.showToast({ icon: "none", title: "打卡异常：" + locationErrorMessage(e) });
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
