"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const textareaPlaceholder = "可以从课堂氛围、讲解质量、作业反馈等方面分享您的真实体验～";
const maxContentLength = 500;
const _sfc_main = {
  __name: "create",
  setup(__props) {
    const defaultAvatarUrl = utils_imageConfig.getDefaultAvatarUrl();
    const tagOptions = ["讲解清晰", "耐心负责", "课堂有趣", "反馈及时", "备课充分", "专业度高", "善于引导", "课堂纪律好"];
    const ratingTips = ["很不满意", "不太满意", "一般般", "比较满意", "非常满意"];
    const appointmentId = common_vendor.ref("");
    const confirmAppointmentId = common_vendor.ref("");
    const routeCourseType = common_vendor.ref("");
    const useMock = common_vendor.ref(false);
    const isTrial = common_vendor.ref(false);
    const isLoading = common_vendor.ref(true);
    const isSubmitting = common_vendor.ref(false);
    const teacherInfo = common_vendor.reactive({
      id: "",
      name: "教师",
      avatar: "",
      subjectText: "科目待确认",
      experience: ""
    });
    const formData = common_vendor.reactive({
      rating: 5,
      tags: [],
      content: "",
      is_satisfied: null,
      fail_reason: ""
    });
    const canSubmit = common_vendor.computed(() => {
      if (formData.rating < 1)
        return false;
      if (formData.content.trim().length < 10)
        return false;
      if (isTrial.value && formData.is_satisfied === null)
        return false;
      return true;
    });
    const submitText = common_vendor.computed(() => {
      if (isSubmitting.value)
        return "提交中...";
      if (!isTrial.value)
        return "提交评价";
      return formData.is_satisfied === false ? "提交不满意结果与评价" : "确认完成并提交评价";
    });
    common_vendor.onLoad((options) => {
      appointmentId.value = options && options.appointmentId || "";
      routeCourseType.value = options && options.courseType || "";
      if (routeCourseType.value === "trial") {
        isTrial.value = true;
      }
      useMock.value = utils_mockData.useMockData() === true;
      if (!appointmentId.value && !useMock.value) {
        common_vendor.index.showToast({ title: "缺少预约信息", icon: "none" });
        setTimeout(() => common_vendor.index.navigateBack(), 1500);
        return;
      }
      setTimeout(() => {
        loadData();
      }, 0);
    });
    common_vendor.onMounted(() => {
    });
    async function loadData() {
      isLoading.value = true;
      try {
        if (useMock.value) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mockApt = utils_mockData.mockAppointments.find((item) => item._id === appointmentId.value) || utils_mockData.mockAppointments[0];
          const mockTeacher = utils_mockData.mockTeachers.find((item) => item._id === mockApt.teacher_id) || utils_mockData.mockTeachers[0];
          isTrial.value = routeCourseType.value === "trial" || mockApt.course_type === "trial";
          teacherInfo.name = mockTeacher.name;
          teacherInfo.avatar = mockTeacher.avatar;
          teacherInfo.subjectText = (mockApt.subjects || mockTeacher.subjects || ["学科"]).join(" / ");
          teacherInfo.experience = mockTeacher.experience || "经验丰富";
          return;
        }
        const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const appointmentRes = await appointmentQuery.getAppointmentDetail({ appointment_id: appointmentId.value });
        if (appointmentRes.code !== 0 || !appointmentRes.data) {
          throw new Error(appointmentRes.message || "获取预约信息失败");
        }
        const appointment = appointmentRes.data;
        appointmentId.value = appointment._id || appointmentId.value;
        confirmAppointmentId.value = appointment._id || appointmentId.value;
        isTrial.value = routeCourseType.value === "trial" || appointment.course_type === "trial";
        const subjects = appointment.teacher_info && appointment.teacher_info.subjects || appointment.subjects || appointment.subject;
        const subjectText = Array.isArray(subjects) ? subjects.join(" / ") : subjects || "科目待确认";
        teacherInfo.id = appointment.teacher_id;
        teacherInfo.name = appointment.teacher_info && (appointment.teacher_info.display_name || appointment.teacher_info.name) || appointment.teacher_name || "教师";
        teacherInfo.avatar = appointment.teacher_info && appointment.teacher_info.avatar || "";
        teacherInfo.subjectText = subjectText;
        teacherInfo.experience = appointment.teacher_info && appointment.teacher_info.teaching_experience ? `${appointment.teacher_info.teaching_experience}年教龄` : "";
        if (!teacherInfo.avatar && appointment.teacher_id) {
          try {
            const teacherListObj = common_vendor.tr.importObject("teacher-list", { customUI: true });
            const teacherRes = await teacherListObj.getDetail({ teacherId: appointment.teacher_id });
            if (teacherRes.code === 0 && teacherRes.data) {
              teacherInfo.avatar = teacherRes.data.avatar || teacherInfo.avatar;
              if (teacherRes.data.subjects && teacherRes.data.subjects.length > 0) {
                teacherInfo.subjectText = teacherRes.data.subjects.join(" / ");
              }
              if (teacherRes.data.teaching_experience) {
                teacherInfo.experience = `${teacherRes.data.teaching_experience}年教龄`;
              }
            }
          } catch (e) {
          }
        }
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/review/create.vue:256", "加载评价页面失败:", e);
        common_vendor.index.showToast({ title: e.message || "加载失败", icon: "none" });
      } finally {
        isLoading.value = false;
      }
    }
    function setRating(v) {
      formData.rating = v;
    }
    function toggleTag(tag) {
      const idx = formData.tags.indexOf(tag);
      if (idx > -1) {
        formData.tags.splice(idx, 1);
        return;
      }
      if (formData.tags.length >= 4)
        formData.tags.shift();
      formData.tags.push(tag);
    }
    function selectResult(v) {
      formData.is_satisfied = v;
    }
    function validate() {
      if (formData.rating < 1) {
        common_vendor.index.showToast({ title: "请为本次课程打分", icon: "none" });
        return false;
      }
      const content = formData.content.trim();
      if (content.length < 10) {
        common_vendor.index.showToast({ title: "评价内容不少于 10 个字", icon: "none" });
        return false;
      }
      if (isTrial.value && formData.is_satisfied === null) {
        common_vendor.index.showToast({ title: "请选择试课结果", icon: "none" });
        return false;
      }
      return true;
    }
    async function submit() {
      if (isSubmitting.value)
        return;
      if (!validate())
        return;
      if (useMock.value) {
        common_vendor.index.showToast({ title: "评价提交成功", icon: "success" });
        setTimeout(() => common_vendor.index.navigateBack(), 1e3);
        return;
      }
      isSubmitting.value = true;
      try {
        const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const actionId = confirmAppointmentId.value || appointmentId.value;
        const confirmPayload = isTrial.value ? { appointment_id: actionId, is_satisfied: !!formData.is_satisfied, fail_reason: formData.fail_reason || "" } : { appointment_id: actionId, is_satisfied: true };
        const confirmRes = await appointmentQuery.confirmCompletion(confirmPayload);
        const alreadyCompleted = confirmRes && confirmRes.message && /已完成|已结算/.test(confirmRes.message);
        if (!confirmRes || confirmRes.code !== 0 && !alreadyCompleted) {
          throw new Error(confirmRes && confirmRes.message || "确认结果失败");
        }
        const reviewObj = common_vendor.tr.importObject("teacher-review", { customUI: true });
        const reviewRes = await reviewObj.submit({
          appointment_id: actionId,
          rating: formData.rating,
          tags: formData.tags,
          content: formData.content.trim(),
          is_satisfied: isTrial.value ? formData.is_satisfied : null
        });
        if (!reviewRes || reviewRes.code !== 0) {
          throw new Error(reviewRes && reviewRes.message || "提交评价失败");
        }
        common_vendor.index.showToast({ title: "已提交并完成确认", icon: "success" });
        setTimeout(() => common_vendor.index.navigateBack(), 1e3);
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/review/create.vue:342", "[review.submit] 失败:", e);
        common_vendor.index.showToast({ title: e.message || "提交失败", icon: "none" });
      } finally {
        isSubmitting.value = false;
      }
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: teacherInfo.avatar || common_vendor.unref(defaultAvatarUrl),
        b: common_vendor.t(teacherInfo.name || "教师"),
        c: common_vendor.t(teacherInfo.subjectText),
        d: teacherInfo.experience
      }, teacherInfo.experience ? {
        e: common_vendor.t(teacherInfo.experience)
      } : {}, {
        f: isTrial.value
      }, isTrial.value ? common_vendor.e({
        g: formData.is_satisfied === true ? 1 : "",
        h: common_vendor.o(($event) => selectResult(true)),
        i: formData.is_satisfied === false ? 1 : "",
        j: common_vendor.o(($event) => selectResult(false)),
        k: formData.is_satisfied === false
      }, formData.is_satisfied === false ? {
        l: formData.fail_reason,
        m: common_vendor.o(($event) => formData.fail_reason = $event.detail.value)
      } : {}) : {}, {
        n: common_vendor.t(ratingTips[formData.rating - 1]),
        o: common_vendor.f(5, (i, k0, i0) => {
          return {
            a: i,
            b: i <= formData.rating ? 1 : "",
            c: common_vendor.o(($event) => setRating(i), i)
          };
        }),
        p: common_vendor.f(tagOptions, (tag, k0, i0) => {
          return {
            a: common_vendor.t(tag),
            b: tag,
            c: formData.tags.includes(tag) ? 1 : "",
            d: common_vendor.o(($event) => toggleTag(tag), tag)
          };
        }),
        q: maxContentLength,
        r: textareaPlaceholder,
        s: formData.content,
        t: common_vendor.o(($event) => formData.content = $event.detail.value),
        v: common_vendor.t(formData.content.length),
        w: common_vendor.t(maxContentLength),
        x: common_vendor.t(submitText.value),
        y: isSubmitting.value || !canSubmit.value,
        z: common_vendor.o(submit)
      });
    };
  }
};
wx.createPage(_sfc_main);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/review/create.js.map
