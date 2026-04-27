"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_location = require("../../utils/location.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "AppointmentCreate",
  components: {
    card
  },
  data() {
    return {
      teacherProfileId: "",
      teacherUid: "",
      teacherInfo: {},
      formData: {
        courseType: "formal",
        // 默认正式课程，试课只能通过邀请创建
        invite_id: "",
        // 试课邀请ID（如果是从邀请创建）
        date: "",
        time: "",
        studentName: "",
        studentGrade: "",
        subject: "",
        lessonMode: "offline",
        address: {
          latitude: "",
          longitude: "",
          name: ""
        },
        requirements: ""
      },
      gradeOptions: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"],
      gradeIndex: -1,
      dateOptions: {
        start: "",
        end: ""
      },
      isSubmitting: false,
      isLoading: false,
      isRefreshing: false,
      scrollTop: 0,
      canRefresh: true,
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl()
    };
  },
  computed: {
    hourlyRate() {
      var _a;
      const rate = Number((_a = this.teacherInfo) == null ? void 0 : _a.hourly_rate);
      return Number.isFinite(rate) && rate > 0 ? rate : 100;
    },
    trialPrice() {
      return this.hourlyRate * 2;
    },
    formalPrice() {
      return this.hourlyRate * 2;
    },
    totalAmount() {
      return this.formData.courseType === "trial" ? this.trialPrice : this.formalPrice;
    },
    /**
     * 地址显示文本
     */
    addressDisplay() {
      return this.formData.address.name || "";
    },
    /**
     * 地图标记点
     */
    mapMarkers() {
      if (!this.formData.address.latitude || !this.formData.address.longitude) {
        return [];
      }
      return [{
        id: 1,
        latitude: parseFloat(this.formData.address.latitude),
        longitude: parseFloat(this.formData.address.longitude),
        width: 30,
        height: 30,
        title: this.formData.address.name || "上课地址",
        callout: {
          content: this.formData.address.name || "上课地址",
          color: "#333",
          fontSize: 14,
          borderRadius: 4,
          bgColor: "#fff",
          padding: 8,
          display: "ALWAYS"
        }
      }];
    }
  },
  async onLoad(options) {
    this.teacherProfileId = options.teacherProfileId || options.id || options.teacherId || "";
    this.teacherUid = options.teacherUid || options.teacher_id || "";
    if (options.invite_id) {
      this.formData.invite_id = options.invite_id;
      await this.loadInviteInfo(options.invite_id);
    }
    this.setupDateRange();
    await this.ensureTeacher();
    this.prefillFromProfile();
  },
  methods: {
    setupDateRange() {
      const today = /* @__PURE__ */ new Date();
      const oneMonthLater = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const todayStr = this.formatDate(today);
      this.dateOptions.start = todayStr;
      this.dateOptions.end = this.formatDate(oneMonthLater);
      this.formData.date = todayStr;
    },
    async ensureTeacher() {
      if (!this.teacherProfileId && !this.teacherUid) {
        await this.initTeacherFromCloud();
      }
      if (!this.teacherProfileId && !this.teacherUid) {
        common_vendor.index.showToast({ title: "未找到可预约教师", icon: "none" });
        setTimeout(() => common_vendor.index.navigateBack(), 1500);
        return;
      }
      await this.loadTeacher();
    },
    prefillFromProfile() {
      const profile = common_vendor.index.getStorageSync("userInfo");
      if (profile == null ? void 0 : profile.parent_info) {
        this.formData.studentName = profile.parent_info.student_name || "";
        this.formData.studentGrade = profile.parent_info.student_grade || "";
        this.gradeIndex = this.gradeOptions.indexOf(this.formData.studentGrade);
      }
    },
    /**
     * 加载试课邀请信息
     * @param {String} invite_id 邀请ID
     */
    async loadInviteInfo(invite_id) {
      if (!invite_id)
        return;
      try {
        const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const res = await appointmentQuery.getAppointmentDetail({ appointment_id: invite_id });
        if (res.code === 0 && res.data) {
          const invite = res.data;
          if (invite.status !== "trial_invited") {
            common_vendor.index.showToast({ title: "该试课邀请已处理", icon: "none" });
            setTimeout(() => common_vendor.index.navigateBack(), 1500);
            return;
          }
          if (invite.teacher_id) {
            this.teacherUid = invite.teacher_id;
          }
          this.formData.courseType = "trial";
          this.formData.invite_id = invite._id;
        } else {
          throw new Error(res.message || "加载邀请信息失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/appointment/create.vue:358", "加载试课邀请信息失败:", error);
        common_vendor.index.showToast({ title: error.message || "加载失败", icon: "none" });
      }
    },
    async initTeacherFromCloud() {
      var _a;
      try {
        const teacherListObj = common_vendor.tr.importObject("teacher-list", { customUI: true });
        const res = await teacherListObj.getList({ page: 1, pageSize: 1 });
        if (res.code === 0 && ((_a = res.data.list) == null ? void 0 : _a.length)) {
          const teacher = res.data.list[0];
          this.teacherProfileId = teacher._id || teacher.id || "";
          this.teacherUid = teacher.teacher_id || "";
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/appointment/create.vue:372", "自动获取教师失败:", error);
      }
    },
    async loadTeacher() {
      if (this.isLoading)
        return;
      this.isLoading = true;
      try {
        const teacherListObj = common_vendor.tr.importObject("teacher-list", { customUI: true });
        const res = await teacherListObj.getDetail({ teacherId: this.teacherProfileId || this.teacherUid });
        if (res.code === 0) {
          this.teacherInfo = res.data;
          this.teacherProfileId = res.data._id || this.teacherProfileId;
          this.teacherUid = res.data.teacher_id || this.teacherUid;
        } else {
          throw new Error(res.message || "加载教师失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/appointment/create.vue:389", "加载教师失败:", error);
        common_vendor.index.showToast({ title: error.message || "加载教师失败", icon: "none" });
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
      }
    },
    handleScroll(e) {
      this.scrollTop = e.detail.scrollTop;
      this.canRefresh = e.detail.scrollTop <= 10;
    },
    handleScrollToUpper() {
      this.scrollTop = 0;
      this.canRefresh = true;
    },
    async onRefresh() {
      if (!this.canRefresh || this.scrollTop > 10) {
        this.isRefreshing = false;
        return;
      }
      if (this.isRefreshing)
        return;
      this.isRefreshing = true;
      await this.loadTeacher();
    },
    onDateChange(e) {
      this.formData.date = e.detail.value;
    },
    onTimeChange(e) {
      this.formData.time = e.detail.value;
    },
    onGradeChange(e) {
      const index = Number(e.detail.value);
      this.gradeIndex = index;
      this.formData.studentGrade = this.gradeOptions[index];
    },
    changeCourseType(type) {
      if (!this.formData.invite_id && type === "trial") {
        common_vendor.index.showToast({
          title: "试课预约需由老师发起邀请，请先联系老师",
          icon: "none",
          duration: 3e3
        });
        return;
      }
      this.formData.courseType = type;
    },
    formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },
    formatRating(rating) {
      if (!rating && rating !== 0)
        return "5.0";
      return Number(rating).toFixed(1);
    },
    formatPercent(rate) {
      if (!rate && rate !== 0)
        return "0%";
      return `${(Number(rate) * 100).toFixed(0)}%`;
    },
    /**
     * 选择位置（打开地图选择）
     */
    async handleChooseLocation() {
      try {
        const hasPermission = await utils_location.requestLocationPermission();
        if (!hasPermission) {
          common_vendor.index.showToast({
            title: "需要位置权限",
            icon: "none"
          });
          return;
        }
        let initialLat = null;
        let initialLon = null;
        if (this.formData.address.latitude && this.formData.address.longitude) {
          initialLat = parseFloat(this.formData.address.latitude);
          initialLon = parseFloat(this.formData.address.longitude);
        }
        const location = await utils_location.chooseLocation({
          latitude: initialLat,
          longitude: initialLon
        });
        this.formData.address = {
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          name: location.name || location.address || ""
        };
        common_vendor.index.showToast({
          title: "选择成功",
          icon: "success"
        });
      } catch (error) {
        if (error.message && !error.message.includes("取消")) {
          common_vendor.index.__f__("error", "at pages/appointment/create.vue:491", "选择位置失败:", error);
          common_vendor.index.showToast({
            title: error.message || "选择失败",
            icon: "none"
          });
        }
      }
    },
    /**
     * 打开地图查看位置
     */
    handleOpenLocation() {
      const addr = this.formData.address;
      if (!addr.latitude || !addr.longitude) {
        common_vendor.index.showToast({
          title: "位置信息不完整",
          icon: "none"
        });
        return;
      }
      utils_location.openLocation({
        latitude: parseFloat(addr.latitude),
        longitude: parseFloat(addr.longitude),
        name: addr.name || "上课地址",
        address: addr.name || "上课地址"
      });
    },
    validateForm() {
      if (!this.formData.date || !this.formData.time) {
        return "请选择上课日期与时间";
      }
      if (!this.formData.studentName) {
        return "请输入学生姓名";
      }
      if (!this.formData.studentGrade) {
        return "请选择或输入学生年级";
      }
      if (!this.formData.subject) {
        return "请输入学习科目";
      }
      if (this.formData.lessonMode === "offline") {
        if (!this.formData.address.latitude || !this.formData.address.longitude || !this.formData.address.name) {
          return "请选择上课地址";
        }
      }
      return "";
    },
    async submitAppointment() {
      if (this.isSubmitting)
        return;
      const message = this.validateForm();
      if (message) {
        common_vendor.index.showToast({ title: message, icon: "none" });
        return;
      }
      this.isSubmitting = true;
      try {
        const appointmentCreateObj = common_vendor.tr.importObject("appointment-create", { customUI: true });
        const baseParams = {
          teacher_id: this.teacherInfo.teacher_id || this.teacherUid || this.teacherProfileId,
          course_type: this.formData.courseType === "trial" ? "trial" : "regular",
          date: this.formData.date,
          start_time: this.formData.time,
          duration: 2,
          lesson_mode: this.formData.lessonMode,
          student_name: this.formData.studentName,
          student_grade: this.formData.studentGrade,
          subject: this.formData.subject,
          requirements: this.formData.requirements || ""
        };
        const optionalParams = {};
        if (this.formData.invite_id) {
          optionalParams.invite_id = this.formData.invite_id;
        }
        if (this.formData.lessonMode === "offline" && this.formData.address.latitude && this.formData.address.longitude) {
          optionalParams.address = {
            latitude: parseFloat(this.formData.address.latitude),
            longitude: parseFloat(this.formData.address.longitude),
            name: this.formData.address.name || ""
          };
        }
        const params = { ...baseParams, ...optionalParams };
        const res = await appointmentCreateObj.create(params);
        if (res.code === 0) {
          common_vendor.index.showToast({ title: "预约成功", icon: "success" });
          setTimeout(() => {
            var _a;
            if ((_a = res.data) == null ? void 0 : _a.appointment_id) {
              common_vendor.index.redirectTo({ url: `/pages/appointment/detail?id=${res.data.appointment_id}` });
            } else {
              common_vendor.index.redirectTo({ url: "/pages/appointment/list" });
            }
          }, 1200);
        } else {
          throw new Error(res.message || "预约失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/appointment/create.vue:594", "预约失败:", error);
        common_vendor.index.showToast({ title: error.message || "预约失败，请稍后再试", icon: "none" });
      } finally {
        this.isSubmitting = false;
      }
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.teacherInfo.avatar || $data.defaultAvatarUrl,
    b: common_vendor.t($data.teacherInfo.display_name || $data.teacherInfo.name || "教师"),
    c: common_vendor.t($options.formatRating($data.teacherInfo.rating)),
    d: common_vendor.t($data.teacherInfo.hourly_rate || 100),
    e: common_vendor.t($data.teacherInfo.total_students || 0),
    f: $data.teacherInfo.trial_count > 0
  }, $data.teacherInfo.trial_count > 0 ? {
    g: common_vendor.t($data.teacherInfo.trial_count)
  } : {}, {
    h: $data.teacherInfo.trial_success_rate > 0
  }, $data.teacherInfo.trial_success_rate > 0 ? {
    i: common_vendor.t($options.formatPercent($data.teacherInfo.trial_success_rate))
  } : {}, {
    j: !$data.formData.invite_id
  }, !$data.formData.invite_id ? {
    k: common_vendor.t($options.formalPrice),
    l: common_vendor.s($data.formData.courseType === "formal" ? "color: #FFD700;" : "color: #FFB800;"),
    m: common_vendor.n($data.formData.courseType === "formal" ? "main-bg-color text-white" : "bg-light-secondary"),
    n: common_vendor.o(($event) => $options.changeCourseType("formal")),
    o: common_vendor.p({
      headTitle: "课程类型"
    })
  } : {}, {
    p: $data.formData.invite_id
  }, $data.formData.invite_id ? {
    q: common_vendor.t($options.trialPrice),
    r: common_vendor.p({
      headTitle: "试课邀请"
    })
  } : {}, {
    s: common_vendor.t($data.formData.date || "请选择"),
    t: common_vendor.n($data.formData.date ? "" : "text-light-muted"),
    v: $data.formData.date,
    w: $data.dateOptions.start,
    x: $data.dateOptions.end,
    y: common_vendor.o((...args) => $options.onDateChange && $options.onDateChange(...args)),
    z: common_vendor.t($data.formData.time || "请选择"),
    A: common_vendor.n($data.formData.time ? "" : "text-light-muted"),
    B: $data.formData.time,
    C: common_vendor.o((...args) => $options.onTimeChange && $options.onTimeChange(...args)),
    D: common_vendor.p({
      headTitle: "预约时间"
    }),
    E: $data.formData.studentName,
    F: common_vendor.o(common_vendor.m(($event) => $data.formData.studentName = $event.detail.value, {
      trim: true
    })),
    G: common_vendor.t($data.formData.studentGrade || "选择年级"),
    H: common_vendor.n($data.formData.studentGrade ? "" : "text-light-muted"),
    I: $data.gradeOptions,
    J: $data.gradeIndex,
    K: common_vendor.o((...args) => $options.onGradeChange && $options.onGradeChange(...args)),
    L: $data.formData.subject,
    M: common_vendor.o(common_vendor.m(($event) => $data.formData.subject = $event.detail.value, {
      trim: true
    })),
    N: common_vendor.p({
      headTitle: "学生信息"
    }),
    O: common_vendor.n($data.formData.lessonMode === "online" ? "main-bg-color text-white" : "bg-light-secondary"),
    P: common_vendor.o(($event) => $data.formData.lessonMode = "online"),
    Q: common_vendor.n($data.formData.lessonMode === "offline" ? "main-bg-color text-white" : "bg-light-secondary"),
    R: common_vendor.o(($event) => $data.formData.lessonMode = "offline"),
    S: $data.formData.lessonMode === "offline"
  }, $data.formData.lessonMode === "offline" ? common_vendor.e({
    T: common_vendor.t($options.addressDisplay || "点击选择地址"),
    U: common_vendor.o((...args) => $options.handleChooseLocation && $options.handleChooseLocation(...args)),
    V: $data.formData.address.latitude && $data.formData.address.longitude
  }, $data.formData.address.latitude && $data.formData.address.longitude ? {
    W: parseFloat($data.formData.address.latitude),
    X: parseFloat($data.formData.address.longitude),
    Y: $options.mapMarkers,
    Z: common_vendor.o((...args) => $options.handleOpenLocation && $options.handleOpenLocation(...args))
  } : {}) : {}, {
    aa: common_vendor.p({
      headTitle: "上课方式"
    }),
    ab: $data.formData.requirements,
    ac: common_vendor.o(common_vendor.m(($event) => $data.formData.requirements = $event.detail.value, {
      trim: true
    })),
    ad: common_vendor.p({
      headTitle: "补充说明"
    }),
    ae: common_vendor.t($options.totalAmount),
    af: $data.formData.courseType === "trial"
  }, $data.formData.courseType === "trial" ? {
    ag: common_vendor.t($options.hourlyRate)
  } : {}, {
    ah: common_vendor.p({
      headTitle: "费用概览"
    }),
    ai: common_vendor.t($options.totalAmount),
    aj: common_vendor.t($data.isSubmitting ? "提交中..." : "确认预约"),
    ak: $data.isSubmitting,
    al: common_vendor.o((...args) => $options.submitAppointment && $options.submitAppointment(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-14356573"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/appointment/create.js.map
