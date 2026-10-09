"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DEFAULT_SLOTS = [
  { id: "slot1", start: "09:00", end: "11:00" },
  { id: "slot2", start: "14:00", end: "16:00" },
  { id: "slot3", start: "19:00", end: "21:00" }
];
function buildDefaultWeek() {
  return WEEK_ORDER.map((dayIdx, order) => ({
    dayIndex: dayIdx,
    order,
    name: DAY_NAMES[dayIdx],
    slots: DEFAULT_SLOTS.map((slot) => ({
      id: slot.id,
      start: slot.start,
      end: slot.end,
      is_available: false
    }))
  }));
}
const _sfc_main = {
  name: "TeacherSchedule",
  data() {
    return {
      weekSchedule: buildDefaultWeek(),
      blockedDates: [],
      useMock: false,
      loading: false,
      saving: false
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.loadSchedule();
  },
  methods: {
    formatSlot(slot) {
      const start = (slot.start || "").slice(0, 5);
      const end = (slot.end || "").slice(0, 5);
      return `${start.replace(":00", "")}–${end.replace(":00", "")}`;
    },
    dayOpenText(day) {
      const open = (day.slots || []).filter((slot) => slot.is_available);
      if (!open.length)
        return "";
      return open.map((slot) => `${this.formatSlot(slot)} 开`).join(" / ");
    },
    dayDescription(dayIndex) {
      if (dayIndex === 0 || dayIndex === 6)
        return "建议全天可约";
      if (dayIndex === 5)
        return "可安排晚间课程";
      return "可根据课表灵活设置";
    },
    async loadSchedule() {
      if (this.loading)
        return;
      this.loading = true;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          this.weekSchedule = buildDefaultWeek();
          this.weekSchedule.forEach((day) => {
            day.slots.forEach((slot) => {
              slot.is_available = Math.random() > 0.4;
            });
          });
          this.blockedDates = ["2025-01-02"];
          return;
        }
        const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
        if (!userInfo.uid || userInfo.role !== "teacher") {
          common_vendor.index.showToast({ title: "请先以教师身份登录", icon: "none" });
          return;
        }
        const scheduleObj = common_vendor.tr.importObject("teacher-schedule", { customUI: true });
        const res = await scheduleObj.getSchedule();
        if (res.code === 0 && res.data) {
          this.applyScheduleData(res.data);
        } else {
          common_vendor.index.showToast({ title: res.message || "加载失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/profile/schedule.vue:138", "加载时间设置失败:", error);
        common_vendor.index.showToast({ title: "加载失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    applyScheduleData(data) {
      const weekMap = /* @__PURE__ */ new Map();
      (data.available_times || []).forEach((item) => {
        if (typeof item.day_of_week === "number" && item.time_slots) {
          weekMap.set(item.day_of_week, item.time_slots);
        }
      });
      this.weekSchedule = buildDefaultWeek().map((day) => {
        const remoteSlots = weekMap.get(day.dayIndex);
        if (remoteSlots && remoteSlots.length) {
          const mapped = remoteSlots.map((slot, idx) => ({
            id: `slot${idx + 1}`,
            start: slot.start_time,
            end: slot.end_time,
            is_available: slot.is_available !== false
          }));
          return {
            ...day,
            slots: mapped
          };
        }
        return day;
      });
      this.blockedDates = Array.isArray(data.blocked_dates) ? data.blocked_dates : [];
    },
    toggleSlot(dayIndex, slotId) {
      const day = this.weekSchedule.find((item) => item.dayIndex === dayIndex);
      if (!day)
        return;
      const slot = day.slots.find((item) => item.id === slotId);
      if (!slot)
        return;
      slot.is_available = !slot.is_available;
    },
    handleBlockedDateChange(e) {
      const value = e.detail.value;
      if (!value)
        return;
      if (!this.blockedDates.includes(value)) {
        this.blockedDates.push(value);
      }
    },
    removeBlockedDate(index) {
      this.blockedDates.splice(index, 1);
    },
    buildPayload() {
      const available_times = this.weekSchedule.map((day) => ({
        day_of_week: day.dayIndex,
        time_slots: day.slots.map((slot) => ({
          start_time: slot.start,
          end_time: slot.end,
          is_available: slot.is_available
        }))
      }));
      return {
        available_times,
        blocked_dates: this.blockedDates,
        special_available_dates: []
      };
    },
    async saveSchedule() {
      if (this.saving)
        return;
      try {
        if (this.useMock) {
          common_vendor.index.showToast({ title: "保存成功 (模拟)", icon: "success" });
          return;
        }
        const payload = this.buildPayload();
        this.saving = true;
        const scheduleObj = common_vendor.tr.importObject("teacher-schedule", { customUI: true });
        const res = await scheduleObj.saveSchedule(payload);
        if (res.code === 0) {
          common_vendor.index.showToast({ title: "保存成功", icon: "success" });
          setTimeout(() => common_vendor.index.navigateBack(), 1200);
        } else {
          common_vendor.index.showToast({ title: res.message || "保存失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/profile/schedule.vue:224", "保存时间设置失败:", error);
        common_vendor.index.showToast({ title: "保存失败，请稍后再试", icon: "none" });
      } finally {
        this.saving = false;
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.f($data.weekSchedule, (day, k0, i0) => {
      return {
        a: common_vendor.t(day.name),
        b: common_vendor.t($options.dayOpenText(day) || "全关"),
        c: !$options.dayOpenText(day) ? 1 : "",
        d: common_vendor.f(day.slots, (slot, k1, i1) => {
          return {
            a: common_vendor.t($options.formatSlot(slot)),
            b: slot.id,
            c: slot.is_available ? 1 : "",
            d: common_vendor.o(($event) => $options.toggleSlot(day.dayIndex, slot.id), slot.id)
          };
        }),
        e: day.dayIndex
      };
    }),
    b: common_vendor.o((...args) => $options.handleBlockedDateChange && $options.handleBlockedDateChange(...args)),
    c: $data.blockedDates.length
  }, $data.blockedDates.length ? {
    d: common_vendor.f($data.blockedDates, (date, idx, i0) => {
      return {
        a: common_vendor.t(date),
        b: common_vendor.o(($event) => $options.removeBlockedDate(idx), date),
        c: date
      };
    })
  } : {}, {
    e: $data.saving,
    f: common_vendor.o((...args) => $options.saveSchedule && $options.saveSchedule(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-fdc0b670"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/profile/schedule.js.map
