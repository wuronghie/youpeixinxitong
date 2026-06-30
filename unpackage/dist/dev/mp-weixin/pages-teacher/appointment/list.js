"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const TeacherTabBar = () => "../../components/TeacherTabBar.js";
const _sfc_main = {
  name: "TeacherAppointmentList",
  components: {
    TeacherTabBar
  },
  data() {
    return {
      currentStatus: "all",
      statusTabs: [
        { label: "全部", value: "all" },
        { label: "待确认", value: "pending_confirm" },
        { label: "已确认", value: "confirmed" },
        { label: "已完成", value: "completed" }
      ],
      appointmentList: [],
      useMock: true,
      loading: false,
      hasMore: true,
      page: 1,
      pageSize: 20
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() !== false;
    this.loadAppointments();
  },
  onShow() {
    this.loadAppointments();
  },
  onShareAppMessage() {
    return {
      title: "家教帮 · 教师预约管理",
      path: "/pages-teacher/appointment/list"
    };
  },
  onShareTimeline() {
    return {
      title: "家教帮 · 教师预约管理"
    };
  },
  methods: {
    async refreshData() {
      await this.loadAppointments();
    },
    /**
     * 计算每条预约的"打卡待办"徽章
     * 返回 { text, className } 或 null
     *  - confirmed/in_progress 且未上课打卡 + 已到打卡窗口 → 红色：待上课打卡
     *  - in_progress 已上课但未下课，且已超过排课结束时间 → 橙色：待下课打卡
     *  - in_progress 已上课但未下课，未到排课结束 → 灰色：上课中
     *  - in_progress 已上课已下课 / completed → 绿色：打卡已完成
     */
    getClockBadge(item) {
      if (!item)
        return null;
      const status = item.status;
      if (!["confirmed", "in_progress", "completed"].includes(status))
        return null;
      if (!(item.deposit_paid === true || item.deposit_paid === "true"))
        return null;
      if (!(item.parent_paid === true || item.parent_paid === "true"))
        return null;
      const startTs = this.parseScheduleStart(item);
      const endTs = this.parseScheduleEnd(item, startTs);
      const now = Date.now();
      const ALLOW_EARLY_MS = 15 * 60 * 1e3;
      const started = !!item.class_started_at;
      const ended = !!item.class_ended_at;
      if (started && ended) {
        return { text: "打卡已完成", className: "badge-success" };
      }
      if (started && !ended) {
        if (endTs && now >= endTs) {
          return { text: "待下课打卡", className: "badge-warning" };
        }
        return { text: "上课中", className: "badge-info" };
      }
      if (startTs && now >= startTs - ALLOW_EARLY_MS && (!endTs || now < endTs)) {
        return { text: "待上课打卡", className: "badge-danger" };
      }
      if (endTs && now >= endTs) {
        return { text: "已超时未打卡", className: "badge-danger" };
      }
      return { text: "未到打卡时间", className: "badge-muted" };
    },
    parseScheduleStart(item) {
      const schedule = item.schedule || {};
      const date = schedule.date || item.appointment_date || item.date;
      const startTime = schedule.start_time || item.appointment_time || item.start_time;
      if (!date || !startTime)
        return 0;
      const ts = (/* @__PURE__ */ new Date(`${date}T${startTime}:00`)).getTime();
      return Number.isNaN(ts) ? 0 : ts;
    },
    parseScheduleEnd(item, startTs) {
      if (!startTs)
        return 0;
      const schedule = item.schedule || {};
      if (schedule.end_time) {
        const date = schedule.date || item.appointment_date;
        const ts = (/* @__PURE__ */ new Date(`${date}T${schedule.end_time}:00`)).getTime();
        if (!Number.isNaN(ts))
          return ts;
      }
      const duration = Number(schedule.duration || item.duration || 2);
      return startTs + duration * 3600 * 1e3;
    },
    /**
     * 将数据库状态映射到筛选状态
     * @param {String} status - 数据库状态
     * @returns {String} - 筛选状态：pending_confirm, confirmed, completed
     */
    mapStatusToFilter(status) {
      if (status === "pending_payment" || status === "pending_confirm" || status === "contact_request") {
        return "pending_confirm";
      }
      if (status === "confirmed" || status === "in_progress") {
        return "confirmed";
      }
      if (status === "completed" || status === "rejected" || status === "cancelled" || status === "refunding" || status === "refunded") {
        return "completed";
      }
      return "pending_confirm";
    },
    async loadAppointments() {
      var _a, _b, _c;
      if (this.loading)
        return;
      this.loading = true;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          let list = [...utils_mockData.mockAppointments].filter((item) => item.status !== "contact_request");
          if (this.currentStatus !== "all") {
            list = list.filter((item) => {
              const filterStatus = this.mapStatusToFilter(item.status);
              return filterStatus === this.currentStatus;
            });
          }
          this.appointmentList = list;
          this.hasMore = false;
        } else {
          const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
          if (!userInfo.uid || userInfo.role !== "teacher") {
            common_vendor.index.showToast({ title: "请先用教师身份登录", icon: "none" });
            return;
          }
          let queryStatus = void 0;
          if (this.currentStatus === "pending_confirm") {
            queryStatus = ["pending_payment", "pending_confirm"];
            common_vendor.index.__f__("log", "at pages-teacher/appointment/list.vue:259", "[teacher-appointment-list] 查询待确认状态，包含:", queryStatus);
          } else if (this.currentStatus === "confirmed") {
            queryStatus = ["confirmed", "in_progress"];
          } else if (this.currentStatus === "completed") {
            queryStatus = ["completed", "rejected", "cancelled", "refunding", "refunded"];
          }
          const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
          const res = await appointmentQuery.getTeacherAppointments({
            status: queryStatus,
            page: this.page,
            pageSize: this.pageSize
          });
          common_vendor.index.__f__("log", "at pages-teacher/appointment/list.vue:276", "[teacher-appointment-list] 查询结果:", res.code === 0 ? `成功，返回${((_b = (_a = res.data) == null ? void 0 : _a.list) == null ? void 0 : _b.length) || 0}条` : res.message);
          if (res.code === 0 && ((_c = res.data) == null ? void 0 : _c.list)) {
            common_vendor.index.__f__("log", "at pages-teacher/appointment/list.vue:278", "[teacher-appointment-list] 返回的状态分布:", res.data.list.map((item) => item.status));
          }
          if (res.code === 0) {
            const data = res.data || {};
            const list = (data.list || []).filter((item) => item.status !== "contact_request");
            if (this.page === 1) {
              this.appointmentList = list;
            } else {
              this.appointmentList = [...this.appointmentList, ...list];
            }
            if (data.pagination) {
              this.hasMore = data.pagination.hasMore !== void 0 ? data.pagination.hasMore : list.length >= this.pageSize;
            } else {
              this.hasMore = list.length >= this.pageSize;
            }
          } else {
            common_vendor.index.showToast({ title: res.message || "加载失败", icon: "none" });
            this.appointmentList = [];
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/appointment/list.vue:303", "加载失败:", error);
        common_vendor.index.showToast({ title: "加载失败", icon: "none" });
        this.appointmentList = [];
      } finally {
        this.loading = false;
      }
    },
    loadMore() {
      if (!this.hasMore || this.loading)
        return;
      this.page += 1;
      this.loadAppointments();
    },
    switchStatus(status) {
      if (this.currentStatus === status)
        return;
      this.currentStatus = status;
      this.page = 1;
      this.hasMore = true;
      this.appointmentList = [];
      this.loadAppointments();
    },
    getStatusText(status) {
      const map = {
        pending_payment: "待支付",
        pending_confirm: "待确认",
        contact_request: "联系请求",
        // 家长直接联系老师但还没预约
        confirmed: "已确认",
        in_progress: "进行中",
        completed: "已完成",
        rejected: "已拒绝",
        cancelled: "已取消",
        refunding: "退款中",
        refunded: "已退款"
      };
      return map[status] || "未知";
    },
    getStatusClass(status) {
      const map = {
        pending_payment: "text-warning",
        pending_confirm: "text-warning",
        contact_request: "text-warning",
        // 联系请求使用警告色
        confirmed: "text-success",
        in_progress: "text-primary",
        completed: "text-light-muted",
        rejected: "text-danger",
        cancelled: "text-light-muted",
        refunding: "text-warning",
        refunded: "text-light-muted"
      };
      return map[status] || "";
    },
    async handleReject(id) {
      common_vendor.index.showModal({
        title: "提示",
        content: "确定要拒绝这个预约吗？拒绝后费用将全额退还给家长。",
        success: async (res) => {
          if (res.confirm) {
            try {
              const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
              if (!userInfo.uid) {
                common_vendor.index.showToast({ title: "请先登录", icon: "none" });
                return;
              }
              const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
              const result = await appointmentQuery.rejectAppointment({
                appointment_id: id,
                reason: "教师拒绝"
              });
              if (result.code === 0) {
                common_vendor.index.showToast({
                  title: result.message || "已拒绝",
                  icon: "success"
                });
                this.loadAppointments();
              } else {
                common_vendor.index.showToast({
                  title: result.message || "拒绝失败",
                  icon: "none"
                });
              }
            } catch (error) {
              common_vendor.index.__f__("error", "at pages-teacher/appointment/list.vue:385", "拒绝失败:", error);
              common_vendor.index.showToast({ title: "操作失败", icon: "none" });
            }
          }
        }
      });
    },
    handleConfirm(id) {
      common_vendor.index.navigateTo({
        url: `/pages-teacher/appointment/detail?id=${id}`
      });
    },
    goToDetail(id) {
      common_vendor.index.navigateTo({
        url: `/pages-teacher/appointment/detail?id=${id}`
      });
    }
  }
};
if (!Array) {
  const _component_TeacherTabBar = common_vendor.resolveComponent("TeacherTabBar");
  _component_TeacherTabBar();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.f($data.statusTabs, (tab, k0, i0) => {
      return {
        a: common_vendor.t(tab.label),
        b: tab.value,
        c: common_vendor.n($data.currentStatus === tab.value ? "tab-active" : "tab-inactive"),
        d: common_vendor.o(($event) => $options.switchStatus(tab.value), tab.value)
      };
    }),
    b: common_vendor.f($data.appointmentList, (item, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(item.student_info && item.student_info.name || item.student_name || "学生"),
        b: item.status !== "contact_request"
      }, item.status !== "contact_request" ? {
        c: common_vendor.t(item.schedule && item.schedule.date || item.appointment_date || ""),
        d: common_vendor.t(item.schedule && item.schedule.start_time || item.appointment_time || "")
      } : {}, {
        e: item.status !== "contact_request"
      }, item.status !== "contact_request" ? {
        f: common_vendor.t(item.type === "trial" || item.course_type === "trial" ? "试课" : "正式课程"),
        g: common_vendor.t(item.total_amount || item.total_fee || 300)
      } : {
        h: common_vendor.t(item.student_info && item.student_info.grade || "待确认"),
        i: common_vendor.t(item.student_info && item.student_info.subject || "待确认")
      }, {
        j: common_vendor.t($options.getStatusText(item.status)),
        k: common_vendor.n($options.getStatusClass(item.status)),
        l: $options.getClockBadge(item)
      }, $options.getClockBadge(item) ? {
        m: common_vendor.t($options.getClockBadge(item).text),
        n: common_vendor.n($options.getClockBadge(item).className)
      } : {}, {
        o: item.status === "pending_confirm" || item.status === "contact_request" || item.status === "pending_payment"
      }, item.status === "pending_confirm" || item.status === "contact_request" || item.status === "pending_payment" ? {
        p: common_vendor.o(($event) => $options.handleReject(item._id), item._id),
        q: common_vendor.t(item.status === "contact_request" ? "查看详情" : "确认"),
        r: common_vendor.o(($event) => $options.handleConfirm(item._id), item._id)
      } : {}, {
        s: item._id,
        t: common_vendor.o(($event) => $options.goToDetail(item._id), item._id)
      });
    }),
    c: $data.appointmentList.length === 0
  }, $data.appointmentList.length === 0 ? {} : {}, {
    d: $data.loading && $data.appointmentList.length
  }, $data.loading && $data.appointmentList.length ? {} : !$data.hasMore && $data.appointmentList.length ? {} : {}, {
    e: !$data.hasMore && $data.appointmentList.length,
    f: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args)),
    g: common_vendor.p({
      current: "appointment"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-d652b2bb"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/appointment/list.js.map
