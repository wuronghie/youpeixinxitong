"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "ReviewCreate",
  components: {
    card
  },
  data() {
    return {
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl(),
      appointmentId: "",
      teacherInfo: {
        name: "教师",
        avatar: "",
        subjectText: "科目待确认",
        experience: ""
      },
      isTrial: false,
      formData: {
        rating: 5,
        tags: [],
        content: "",
        is_satisfied: null
      },
      tagOptions: ["讲解清晰", "耐心负责", "课堂有趣", "反馈及时", "备课充分", "专业度高", "善于引导", "课堂纪律好"],
      ratingTips: ["很不满意", "不太满意", "一般般", "比较满意", "非常满意"],
      textareaPlaceholder: "可以从课堂氛围、讲解质量、作业反馈等方面分享您的真实体验～",
      maxContentLength: 500,
      useMock: false,
      isLoading: true,
      isSubmitting: false,
      isRefreshing: false,
      scrollTop: 0,
      canRefresh: true
    };
  },
  onLoad(options) {
    this.appointmentId = options.appointmentId || "";
    this.useMock = utils_mockData.useMockData() === true;
    if (!this.appointmentId && !this.useMock) {
      common_vendor.index.showToast({ title: "缺少预约信息", icon: "none" });
      setTimeout(() => common_vendor.index.navigateBack(), 1500);
      return;
    }
    this.loadData();
  },
  methods: {
    async loadData() {
      var _a, _b, _c, _d, _e;
      this.isLoading = true;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mockApt = utils_mockData.mockAppointments.find((item) => item._id === this.appointmentId) || utils_mockData.mockAppointments[0];
          const mockTeacher = utils_mockData.mockTeachers.find((item) => item._id === mockApt.teacher_id) || utils_mockData.mockTeachers[0];
          this.isTrial = mockApt.course_type === "trial";
          this.teacherInfo = {
            name: mockTeacher.name,
            avatar: mockTeacher.avatar,
            subjectText: (mockApt.subjects || mockTeacher.subjects || ["学科"]).join(" / "),
            experience: mockTeacher.experience || "经验丰富"
          };
          return;
        }
        const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const appointmentRes = await appointmentQuery.getAppointmentDetail({ appointment_id: this.appointmentId });
        if (appointmentRes.code !== 0 || !appointmentRes.data) {
          throw new Error(appointmentRes.message || "获取预约信息失败");
        }
        const appointment = appointmentRes.data;
        this.isTrial = appointment.course_type === "trial";
        const subjects = ((_a = appointment.teacher_info) == null ? void 0 : _a.subjects) || appointment.subjects || appointment.subject;
        const subjectText = Array.isArray(subjects) ? subjects.join(" / ") : subjects || "科目待确认";
        this.teacherInfo = {
          id: appointment.teacher_id,
          name: ((_b = appointment.teacher_info) == null ? void 0 : _b.display_name) || ((_c = appointment.teacher_info) == null ? void 0 : _c.name) || appointment.teacher_name || "教师",
          avatar: ((_d = appointment.teacher_info) == null ? void 0 : _d.avatar) || "",
          subjectText,
          experience: ((_e = appointment.teacher_info) == null ? void 0 : _e.teaching_experience) ? `${appointment.teacher_info.teaching_experience}年教龄` : ""
        };
        if (!this.teacherInfo.avatar && appointment.teacher_id) {
          const teacherListObj = common_vendor.tr.importObject("teacher-list", { customUI: true });
          const teacherRes = await teacherListObj.getDetail({ teacherId: appointment.teacher_id });
          if (teacherRes.code === 0 && teacherRes.data) {
            this.teacherInfo.avatar = teacherRes.data.avatar || this.teacherInfo.avatar;
            if (teacherRes.data.subjects && teacherRes.data.subjects.length > 0) {
              this.teacherInfo.subjectText = teacherRes.data.subjects.join(" / ");
            }
            if (teacherRes.data.teaching_experience) {
              this.teacherInfo.experience = `${teacherRes.data.teaching_experience}年教龄`;
            }
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/review/create.vue:230", "加载评价页面失败:", error);
        common_vendor.index.showToast({ title: error.message || "加载失败", icon: "none" });
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
    onRefresh() {
      if (!this.canRefresh || this.scrollTop > 10) {
        this.isRefreshing = false;
        return;
      }
      if (this.isRefreshing)
        return;
      this.isRefreshing = true;
      this.loadData();
    },
    setRating(value) {
      this.formData.rating = value;
    },
    toggleTag(tag) {
      const tags = this.formData.tags.slice();
      const index = tags.indexOf(tag);
      if (index > -1) {
        tags.splice(index, 1);
      } else {
        if (tags.length >= 4) {
          tags.shift();
        }
        tags.push(tag);
      }
      this.formData.tags = tags;
    },
    selectResult(isSatisfied) {
      this.formData.is_satisfied = isSatisfied;
    },
    validateForm() {
      if (!this.formData.rating || this.formData.rating < 1) {
        common_vendor.index.showToast({ title: "请为本次课程打分", icon: "none" });
        return false;
      }
      const content = this.formData.content.trim();
      if (!content || content.length < 10) {
        common_vendor.index.showToast({ title: "评价内容不少于10个字", icon: "none" });
        return false;
      }
      if (this.isTrial && this.formData.is_satisfied === null) {
        common_vendor.index.showToast({ title: "请选择试课结果", icon: "none" });
        return false;
      }
      return true;
    },
    async submitReview() {
      if (this.isSubmitting)
        return;
      if (!this.validateForm())
        return;
      if (this.useMock) {
        common_vendor.index.showToast({ title: "评价提交成功", icon: "success" });
        setTimeout(() => common_vendor.index.navigateBack(), 1200);
        return;
      }
      try {
        this.isSubmitting = true;
        const reviewObj = common_vendor.tr.importObject("teacher-review", { customUI: true });
        const payload = {
          appointment_id: this.appointmentId,
          rating: this.formData.rating,
          tags: this.formData.tags,
          content: this.formData.content.trim(),
          is_satisfied: this.isTrial ? this.formData.is_satisfied : null
        };
        const res = await reviewObj.submit(payload);
        if (res.code === 0) {
          common_vendor.index.showToast({ title: "评价提交成功", icon: "success" });
          setTimeout(() => {
            common_vendor.index.navigateBack();
          }, 1e3);
        } else {
          throw new Error(res.message || "提交评价失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/review/create.vue:319", "提交评价失败:", error);
        common_vendor.index.showToast({ title: error.message || "提交失败", icon: "none" });
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
    b: common_vendor.t($data.teacherInfo.name || "教师"),
    c: common_vendor.t($data.teacherInfo.subjectText),
    d: $data.teacherInfo.experience
  }, $data.teacherInfo.experience ? {
    e: common_vendor.t($data.teacherInfo.experience)
  } : {}, {
    f: common_vendor.t($data.ratingTips[$data.formData.rating - 1]),
    g: common_vendor.f(5, (i, k0, i0) => {
      return {
        a: i,
        b: common_vendor.n(i <= $data.formData.rating ? "main-bg-color text-white" : "bg-light-secondary"),
        c: common_vendor.o(($event) => $options.setRating(i), i)
      };
    }),
    h: common_vendor.p({
      headTitle: "课程满意度"
    }),
    i: common_vendor.f($data.tagOptions, (tag, k0, i0) => {
      return {
        a: common_vendor.t(tag),
        b: tag,
        c: common_vendor.n($data.formData.tags.includes(tag) ? "main-bg-color text-white" : "bg-light-secondary"),
        d: common_vendor.o(($event) => $options.toggleTag(tag), tag)
      };
    }),
    j: common_vendor.p({
      headTitle: "老师最值得点赞的地方"
    }),
    k: $data.maxContentLength,
    l: $data.textareaPlaceholder,
    m: $data.formData.content,
    n: common_vendor.o(($event) => $data.formData.content = $event.detail.value),
    o: common_vendor.t($data.formData.content.length),
    p: common_vendor.t($data.maxContentLength),
    q: common_vendor.p({
      headTitle: "详细评价"
    }),
    r: $data.isTrial
  }, $data.isTrial ? {
    s: common_vendor.n($data.formData.is_satisfied === true ? "border-primary bg-light" : "border-light-secondary"),
    t: common_vendor.o(($event) => $options.selectResult(true)),
    v: common_vendor.n($data.formData.is_satisfied === false ? "border-primary bg-light" : "border-light-secondary"),
    w: common_vendor.o(($event) => $options.selectResult(false)),
    x: common_vendor.p({
      headTitle: "试课结果"
    })
  } : {}, {
    y: common_vendor.p({
      headTitle: "评价说明"
    }),
    z: common_vendor.t($data.isSubmitting ? "提交中..." : "提交评价"),
    A: $data.isSubmitting,
    B: common_vendor.o((...args) => $options.submitReview && $options.submitReview(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-6a700c41"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/review/create.js.map
