"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "AppointmentCalendar",
  components: {
    card
  },
  data() {
    return {
      currentDate: /* @__PURE__ */ new Date(),
      selectedDate: null,
      weekdays: ["日", "一", "二", "三", "四", "五", "六"],
      calendarDays: [],
      selectedAppointments: [],
      appointments: [],
      useMock: false,
      statusTextMap: {
        pending_payment: "待支付",
        pending_confirm: "待确认",
        confirmed: "已确认",
        in_progress: "进行中",
        completed: "已完成",
        cancelled: "已取消",
        rejected: "已拒绝"
      }
    };
  },
  computed: {
    currentMonth() {
      const date = this.currentDate;
      return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    },
    selectedDateDisplay() {
      if (!this.selectedDate)
        return "";
      const [year, month, day] = this.selectedDate.split("-");
      return `${year}年${Number(month)}月${Number(day)}日`;
    }
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.generateCalendar();
    this.loadAppointments();
  },
  methods: {
    formatDateString(dateObj) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const day = String(dateObj.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },
    generateCalendar() {
      const date = new Date(this.currentDate);
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const firstDayWeek = firstDay.getDay();
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const prevMonthLastDay = new Date(year, month, 0);
      const prevMonthDays = prevMonthLastDay.getDate();
      const days = [];
      const today = /* @__PURE__ */ new Date();
      for (let i = firstDayWeek - 1; i >= 0; i--) {
        const prevDate = new Date(year, month, prevMonthDays - i);
        days.push({
          date: prevDate.getDate(),
          isCurrentMonth: false,
          isToday: today.toDateString() === prevDate.toDateString(),
          hasAppointment: false,
          fullDate: this.formatDateString(prevDate)
        });
      }
      for (let i = 1; i <= daysInMonth; i++) {
        const currentDay = new Date(year, month, i);
        const fullDate = this.formatDateString(currentDay);
        days.push({
          date: i,
          isCurrentMonth: true,
          isToday: today.toDateString() === currentDay.toDateString(),
          hasAppointment: false,
          fullDate
        });
      }
      const remainingDays = 42 - days.length;
      for (let i = 1; i <= remainingDays; i++) {
        const nextDate = new Date(year, month + 1, i);
        days.push({
          date: nextDate.getDate(),
          isCurrentMonth: false,
          isToday: today.toDateString() === nextDate.toDateString(),
          hasAppointment: false,
          fullDate: this.formatDateString(nextDate)
        });
      }
      if (!this.selectedDate) {
        const todayItem = days.find((d) => d.isToday && d.isCurrentMonth);
        if (todayItem) {
          todayItem.isSelected = true;
          this.selectedDate = todayItem.fullDate;
        }
      } else {
        const selectedItem = days.find((d) => d.fullDate === this.selectedDate);
        if (selectedItem) {
          selectedItem.isSelected = true;
        }
      }
      this.calendarDays = days;
    },
    changeMonth(offset) {
      const newDate = new Date(this.currentDate);
      newDate.setMonth(newDate.getMonth() + offset);
      this.currentDate = newDate;
      this.selectedDate = null;
      this.generateCalendar();
      this.loadAppointments();
    },
    async loadAppointments() {
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          this.appointments = utils_mockData.mockAppointments.map((apt) => {
            var _a, _b;
            return {
              ...apt,
              appointment_date: apt.appointment_date || apt.date,
              appointment_time: apt.appointment_time || apt.start_time,
              student_display_name: apt.student_name || ((_a = apt.student_info) == null ? void 0 : _a.name) || "学生",
              subject: apt.subject || ((_b = apt.student_info) == null ? void 0 : _b.subject) || ""
            };
          });
          this.markCalendarAppointments();
          this.loadSelectedAppointments();
        } else {
          const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
          if (!userInfo.uid || userInfo.role !== "teacher") {
            common_vendor.index.showToast({ title: "请先以教师身份登录", icon: "none" });
            return;
          }
          const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
          const res = await appointmentQuery.getTeacherAppointments({ status: "all" });
          if (res.code === 0) {
            const list = res.data.list || [];
            this.appointments = list.map((item) => {
              var _a, _b;
              return {
                ...item,
                appointment_date: item.date || item.appointment_date,
                appointment_time: item.start_time || item.appointment_time,
                student_display_name: ((_a = item.student_info) == null ? void 0 : _a.name) || item.student_name || "学生",
                subject: item.subject || ((_b = item.student_info) == null ? void 0 : _b.subject) || "",
                status: item.status
              };
            });
            this.markCalendarAppointments();
            this.loadSelectedAppointments();
          } else {
            common_vendor.index.showToast({ title: res.message || "获取预约失败", icon: "none" });
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/appointment/calendar.vue:262", "加载失败:", error);
        common_vendor.index.showToast({ title: "加载失败", icon: "none" });
      }
    },
    markCalendarAppointments() {
      const appointmentDates = new Set(
        this.appointments.map((apt) => apt.appointment_date).filter(Boolean)
      );
      this.calendarDays = this.calendarDays.map((day) => ({
        ...day,
        hasAppointment: appointmentDates.has(day.fullDate)
      }));
    },
    selectDay(day) {
      if (!day.isCurrentMonth)
        return;
      this.calendarDays.forEach((d) => d.isSelected = false);
      day.isSelected = true;
      this.selectedDate = day.fullDate;
      this.loadSelectedAppointments();
    },
    loadSelectedAppointments() {
      if (!this.selectedDate)
        return;
      const source = this.useMock ? utils_mockData.mockAppointments : this.appointments;
      this.selectedAppointments = source.filter((apt) => {
        const aptDate = apt.appointment_date || apt.date;
        return aptDate === this.selectedDate;
      }).map((apt) => {
        var _a, _b;
        return {
          _id: apt._id,
          appointment_time: apt.appointment_time || apt.start_time || "",
          subject: apt.subject || ((_a = apt.student_info) == null ? void 0 : _a.subject) || "",
          student_name: apt.student_display_name || ((_b = apt.student_info) == null ? void 0 : _b.name) || apt.student_name || "学生",
          status: apt.status
        };
      });
    },
    formatStatus(status) {
      return this.statusTextMap[status] || "未定义";
    },
    getStatusClass(status) {
      const map = {
        pending_payment: "text-warning",
        pending_confirm: "text-warning",
        confirmed: "text-success",
        in_progress: "text-success",
        completed: "text-primary",
        cancelled: "text-danger",
        rejected: "text-danger"
      };
      return map[status] || "";
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o(($event) => $options.changeMonth(-1)),
    b: common_vendor.t($options.currentMonth),
    c: common_vendor.o(($event) => $options.changeMonth(1)),
    d: common_vendor.f($data.weekdays, (day, k0, i0) => {
      return {
        a: common_vendor.t(day),
        b: day
      };
    }),
    e: common_vendor.f($data.calendarDays, (day, index, i0) => {
      return common_vendor.e({
        a: common_vendor.t(day.date),
        b: day.hasAppointment && !day.isSelected
      }, day.hasAppointment && !day.isSelected ? {} : day.hasAppointment && day.isSelected ? {} : {}, {
        c: day.hasAppointment && day.isSelected,
        d: index,
        e: !day.isCurrentMonth ? 1 : "",
        f: day.isToday && !day.isSelected ? 1 : "",
        g: day.isSelected ? 1 : "",
        h: day.hasAppointment || day.isSelected ? 1 : "",
        i: common_vendor.o(($event) => $options.selectDay(day), index)
      });
    }),
    f: common_vendor.t($data.selectedDate ? $options.selectedDateDisplay : "请选择一个日期"),
    g: $data.selectedAppointments.length > 0
  }, $data.selectedAppointments.length > 0 ? {
    h: common_vendor.t($data.selectedAppointments.length)
  } : {}, {
    i: $data.selectedAppointments.length === 0
  }, $data.selectedAppointments.length === 0 ? {
    j: common_vendor.t($data.selectedDate ? "当天暂时没有预约安排" : "选择一个日期查看课程安排")
  } : {
    k: common_vendor.f($data.selectedAppointments, (apt, k0, i0) => {
      return {
        a: common_vendor.t(apt.appointment_time || "--:--"),
        b: common_vendor.t($options.formatStatus(apt.status)),
        c: common_vendor.n($options.getStatusClass(apt.status)),
        d: common_vendor.t(apt.student_name || "学生"),
        e: common_vendor.t(apt.subject || "未填写科目"),
        f: apt._id
      };
    })
  }, {
    l: common_vendor.p({
      headTitle: "预约安排"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-89d74025"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/appointment/calendar.js.map
