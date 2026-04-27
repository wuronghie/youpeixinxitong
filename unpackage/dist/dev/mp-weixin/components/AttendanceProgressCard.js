"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = {
  __name: "AttendanceProgressCard",
  props: {
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
    scheduleEndTs: {
      type: Number,
      default: 0
    }
  },
  setup(__props) {
    const props = __props;
    const startedAddress = common_vendor.computed(() => formatLocationText(props.classStartedLocation));
    const endedAddress = common_vendor.computed(() => formatLocationText(props.classEndedLocation));
    const stage = common_vendor.computed(() => {
      if (!props.classStartedAt)
        return "in";
      if (!props.classEndedAt)
        return "out";
      return "done";
    });
    const headerHint = common_vendor.computed(() => {
      if (props.classStartedAt && props.classEndedAt)
        return "已完成";
      if (props.classStartedAt)
        return "上课中";
      return "未打卡";
    });
    const hintClass = common_vendor.computed(() => {
      if (props.classStartedAt && props.classEndedAt)
        return "is-success";
      if (props.classStartedAt)
        return "is-progress";
      return "is-pending";
    });
    const durationText = common_vendor.computed(() => {
      if (!props.classStartedAt || !props.classEndedAt)
        return "";
      const ms = Number(props.classEndedAt) - Number(props.classStartedAt);
      if (!ms || ms <= 0)
        return "";
      const minutes = Math.round(ms / 6e4);
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h > 0)
        return `本节实际上课时长：${h} 小时 ${m} 分钟`;
      return `本节实际上课时长：${m} 分钟`;
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
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.t(headerHint.value),
        b: common_vendor.n(hintClass.value),
        c: __props.classStartedAt
      }, __props.classStartedAt ? {
        d: common_vendor.t(formatTime(__props.classStartedAt))
      } : {}, {
        e: startedAddress.value
      }, startedAddress.value ? {
        f: common_vendor.t(startedAddress.value)
      } : {}, {
        g: !!__props.classStartedAt ? 1 : "",
        h: stage.value === "in" ? 1 : "",
        i: !!__props.classEndedAt ? 1 : "",
        j: __props.classEndedAt
      }, __props.classEndedAt ? {
        k: common_vendor.t(formatTime(__props.classEndedAt))
      } : {}, {
        l: endedAddress.value
      }, endedAddress.value ? {
        m: common_vendor.t(endedAddress.value)
      } : {}, {
        n: !!__props.classEndedAt ? 1 : "",
        o: stage.value === "out" ? 1 : "",
        p: durationText.value
      }, durationText.value ? {
        q: common_vendor.t(durationText.value)
      } : {});
    };
  }
};
wx.createComponent(_sfc_main);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/AttendanceProgressCard.js.map
