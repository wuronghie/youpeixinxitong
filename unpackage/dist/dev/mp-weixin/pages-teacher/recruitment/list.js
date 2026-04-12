"use strict";
const common_vendor = require("../../common/vendor.js");
const TeacherTabBar = () => "../../components/TeacherTabBar.js";
const _sfc_main = {
  components: {
    TeacherTabBar
  },
  data() {
    return {
      filters: { subject: "", city: "", lesson_mode: "", student_grade: "" },
      gradeOptions: [{ label: "不限", value: "" }, { label: "小学", value: "四年级" }, { label: "初中", value: "初二" }, { label: "高中", value: "高二" }],
      gradeIndex: 0,
      list: [],
      page: 1,
      pageSize: 20,
      total: 0,
      loading: false
    };
  },
  computed: {
    gradeLabel() {
      var _a;
      return ((_a = this.gradeOptions[this.gradeIndex]) == null ? void 0 : _a.label) || "不限";
    }
  },
  onShow() {
    this.reload();
  },
  methods: {
    onGradePick(e) {
      this.gradeIndex = Number(e.detail.value);
      this.filters.student_grade = this.gradeOptions[this.gradeIndex].value;
      this.reload();
    },
    formatTime(t) {
      if (!t)
        return "";
      const d = new Date(t);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },
    budgetText(item) {
      if (item.budget_min != null || item.budget_max != null) {
        return `预算 ${item.budget_min || "?"} - ${item.budget_max || "?"} 元/小时`;
      }
      return "预算可协商";
    },
    addressText(item) {
      if (!item || !item.region)
        return "";
      const region = item.region;
      const admin = `${region.province || ""}${region.city || ""}${region.district || ""}`.trim();
      const rawName = String(region.name || "").trim();
      if (!rawName)
        return admin;
      const sep = " · ";
      if (rawName.includes(sep)) {
        const idx = rawName.indexOf(sep);
        const addrPart = rawName.slice(idx + sep.length).trim();
        if (addrPart) {
          if (admin && addrPart.startsWith(admin))
            return addrPart;
          return `${admin}${addrPart}`.trim() || addrPart;
        }
      }
      if (admin && rawName.startsWith(admin))
        return rawName;
      return admin ? `${admin}${rawName}`.trim() : rawName;
    },
    reload() {
      this.page = 1;
      this.list = [];
      this.load(true);
    },
    async load(reset) {
      if (this.loading)
        return;
      this.loading = true;
      try {
        const rc = common_vendor.tr.importObject("recruitment-center", { customUI: true });
        const res = await rc.listForTeacher({
          page: this.page,
          pageSize: this.pageSize,
          subject: this.filters.subject,
          city: this.filters.city,
          lesson_mode: this.filters.lesson_mode || void 0,
          student_grade: this.filters.student_grade || void 0
        });
        if (res.code !== 0)
          throw new Error(res.message);
        const { list = [], pagination = {} } = res.data || {};
        this.total = pagination.total || 0;
        this.list = reset ? list : [...this.list, ...list];
      } catch (e) {
        common_vendor.index.showToast({ title: e.message || "加载失败", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    loadMore() {
      if (this.list.length >= this.total || this.loading)
        return;
      this.page += 1;
      this.load(false);
    },
    goDetail(id) {
      common_vendor.index.navigateTo({ url: `/pages-teacher/recruitment/detail?id=${id}` });
    }
  }
};
if (!Array) {
  const _component_TeacherTabBar = common_vendor.resolveComponent("TeacherTabBar");
  _component_TeacherTabBar();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.reload && $options.reload(...args)),
    b: $data.filters.subject,
    c: common_vendor.o(common_vendor.m(($event) => $data.filters.subject = $event.detail.value, {
      trim: true
    })),
    d: common_vendor.o((...args) => $options.reload && $options.reload(...args)),
    e: $data.filters.city,
    f: common_vendor.o(common_vendor.m(($event) => $data.filters.city = $event.detail.value, {
      trim: true
    })),
    g: common_vendor.t($options.gradeLabel),
    h: $data.gradeOptions,
    i: common_vendor.o((...args) => $options.onGradePick && $options.onGradePick(...args)),
    j: $data.filters.lesson_mode === "" ? 1 : "",
    k: common_vendor.o(($event) => {
      $data.filters.lesson_mode = "";
      $options.reload();
    }),
    l: $data.filters.lesson_mode === "online" ? 1 : "",
    m: common_vendor.o(($event) => {
      $data.filters.lesson_mode = "online";
      $options.reload();
    }),
    n: $data.filters.lesson_mode === "offline" ? 1 : "",
    o: common_vendor.o(($event) => {
      $data.filters.lesson_mode = "offline";
      $options.reload();
    }),
    p: !$data.list.length && !$data.loading
  }, !$data.list.length && !$data.loading ? {} : {}, {
    q: common_vendor.f($data.list, (item, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(item.display_name),
        b: common_vendor.t($options.formatTime(item.create_time)),
        c: common_vendor.t(item.response_count || 0),
        d: common_vendor.t(item.subject),
        e: common_vendor.t(item.student_grade),
        f: common_vendor.t(item.lesson_mode === "online" ? "线上" : "线下"),
        g: item.lesson_mode === "offline" && $options.addressText(item)
      }, item.lesson_mode === "offline" && $options.addressText(item) ? {
        h: common_vendor.t($options.addressText(item))
      } : {}, {
        i: common_vendor.t(item.goal || item.remark || "家长暂未填写更多说明"),
        j: common_vendor.t($options.budgetText(item)),
        k: item._id,
        l: common_vendor.o(($event) => $options.goDetail(item._id), item._id)
      });
    }),
    r: $data.loading
  }, $data.loading ? {} : {}, {
    s: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args)),
    t: common_vendor.p({
      current: "recruitment"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-374b0988"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/recruitment/list.js.map
