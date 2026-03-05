"use strict";
const common_vendor = require("../../common/vendor.js");
const card = () => "../../components/common/card.js";
const dbCollectionName = "teacher-profiles";
const _sfc_main = {
  components: {
    card
  },
  data() {
    let formData = {
      "teacher_id": "",
      "display_name": "",
      "avatar": "",
      "subjects": [],
      "grades": [],
      "hourly_rate": null,
      "rating": 5,
      "review_count": 0,
      "introduction": "",
      "teaching_areas": [],
      "is_verified": false,
      "available": true,
      "total_courses": 0,
      "total_students": 0
    };
    return {
      formData,
      subjectOptions: ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治", "其他"],
      gradeOptions: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"]
    };
  },
  methods: {
    toggleSubject(item) {
      const index = this.formData.subjects.indexOf(item);
      if (index > -1) {
        this.formData.subjects.splice(index, 1);
      } else {
        this.formData.subjects.push(item);
      }
    },
    toggleGrade(item) {
      const index = this.formData.grades.indexOf(item);
      if (index > -1) {
        this.formData.grades.splice(index, 1);
      } else {
        this.formData.grades.push(item);
      }
    },
    validateForm() {
      if (!this.formData.teacher_id) {
        common_vendor.index.showToast({ title: "请输入教师用户ID", icon: "none" });
        return false;
      }
      if (!this.formData.display_name) {
        common_vendor.index.showToast({ title: "请输入显示名称", icon: "none" });
        return false;
      }
      return true;
    },
    submit() {
      if (!this.validateForm())
        return;
      const db = common_vendor.tr.database();
      db.collection(dbCollectionName).add(this.formData).then((res) => {
        common_vendor.index.showToast({ title: "新增成功" });
        this.getOpenerEventChannel().emit("refreshData");
        setTimeout(() => common_vendor.index.navigateBack(), 500);
      }).catch((err) => {
        common_vendor.index.showModal({
          content: err.message || "请求服务失败",
          showCancel: false
        });
      });
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: $data.formData.teacher_id,
    b: common_vendor.o(($event) => $data.formData.teacher_id = $event.detail.value),
    c: $data.formData.display_name,
    d: common_vendor.o(($event) => $data.formData.display_name = $event.detail.value),
    e: $data.formData.avatar,
    f: common_vendor.o(($event) => $data.formData.avatar = $event.detail.value),
    g: common_vendor.p({
      headTitle: "基本信息"
    }),
    h: common_vendor.f($data.subjectOptions, (item, k0, i0) => {
      return {
        a: common_vendor.t(item),
        b: item,
        c: common_vendor.n($data.formData.subjects.includes(item) ? "main-bg-color text-white" : "bg-light-secondary"),
        d: common_vendor.o(($event) => $options.toggleSubject(item), item)
      };
    }),
    i: common_vendor.f($data.gradeOptions, (item, k0, i0) => {
      return {
        a: common_vendor.t(item),
        b: item,
        c: common_vendor.n($data.formData.grades.includes(item) ? "main-bg-color text-white" : "bg-light-secondary"),
        d: common_vendor.o(($event) => $options.toggleGrade(item), item)
      };
    }),
    j: $data.formData.hourly_rate,
    k: common_vendor.o(($event) => $data.formData.hourly_rate = $event.detail.value),
    l: $data.formData.teaching_areas,
    m: common_vendor.o(($event) => $data.formData.teaching_areas = $event.detail.value),
    n: common_vendor.p({
      headTitle: "教学信息"
    }),
    o: $data.formData.rating,
    p: common_vendor.o(($event) => $data.formData.rating = $event.detail.value),
    q: $data.formData.review_count,
    r: common_vendor.o(($event) => $data.formData.review_count = $event.detail.value),
    s: $data.formData.total_courses,
    t: common_vendor.o(($event) => $data.formData.total_courses = $event.detail.value),
    v: $data.formData.total_students,
    w: common_vendor.o(($event) => $data.formData.total_students = $event.detail.value),
    x: $data.formData.introduction,
    y: common_vendor.o(($event) => $data.formData.introduction = $event.detail.value),
    z: $data.formData.is_verified,
    A: common_vendor.o(($event) => $data.formData.is_verified = $event.detail.value),
    B: $data.formData.available,
    C: common_vendor.o(($event) => $data.formData.available = $event.detail.value),
    D: common_vendor.p({
      headTitle: "其他信息"
    }),
    E: common_vendor.o((...args) => $options.submit && $options.submit(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-470d6764"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/teacher-profiles/add.js.map
