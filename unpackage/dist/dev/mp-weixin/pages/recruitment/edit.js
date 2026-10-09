"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_location = require("../../utils/location.js");
const utils_auth = require("../../utils/auth.js");
const _sfc_main = {
  data() {
    return {
      recruitmentId: "",
      gradeOptions: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"],
      gradeIndex: -1,
      validDays: 14,
      studentGender: "",
      /** 地图选点：与预约创建页一致 */
      pickPoi: {
        latitude: "",
        longitude: "",
        name: "",
        address: "",
        province: "",
        city: "",
        district: ""
      },
      form: {
        subject: "",
        student_grade: "",
        lesson_mode: "online",
        goal: "",
        remark: "",
        time_note: "",
        budget_min: "",
        budget_max: ""
      },
      submitting: false
    };
  },
  computed: {
    studentGenderText() {
      const g = this.studentGender;
      if (g === "male" || g === 1 || g === "1")
        return "男";
      if (g === "female" || g === 2 || g === "2")
        return "女";
      return "与个人资料一致";
    },
    hasMapPoint() {
      const p = this.pickPoi;
      return !!(p.latitude && p.longitude);
    },
    /** 连贯中文地址，如：四川省成都市双流区凤凰家园（不展示经纬度） */
    fullAddressDisplay() {
      const p = this.pickPoi;
      const prov = (p.province || "").trim();
      const city = (p.city || "").trim();
      const dist = (p.district || "").trim();
      const name = (p.name || "").trim();
      let addr = (p.address || "").trim();
      const admin = `${prov}${city}${dist}`;
      if (addr) {
        if (admin) {
          if (addr.startsWith(admin)) {
            if (name && !addr.includes(name))
              return addr + name;
            return addr;
          }
          const merged = admin + addr;
          if (name && !merged.includes(name))
            return merged + name;
          return merged;
        }
        let base = addr;
        if (name && !base.includes(name))
          base += name;
        return base;
      }
      if (admin && name)
        return admin + name;
      if (admin)
        return admin;
      if (name)
        return name;
      return "";
    },
    mapCenterLat() {
      const v = parseFloat(this.pickPoi.latitude);
      return Number.isNaN(v) ? 0 : v;
    },
    mapCenterLng() {
      const v = parseFloat(this.pickPoi.longitude);
      return Number.isNaN(v) ? 0 : v;
    },
    mapMarkers() {
      if (!this.hasMapPoint)
        return [];
      const lat = this.mapCenterLat;
      const lng = this.mapCenterLng;
      if (!lat && !lng)
        return [];
      const title = (this.pickPoi.name || this.pickPoi.address || "上课地点").trim();
      return [
        {
          id: 1,
          latitude: lat,
          longitude: lng,
          title,
          width: 28,
          height: 40
        }
      ];
    }
  },
  onLoad(options) {
    this.syncStudentGenderFromProfile();
    if (options.id) {
      this.recruitmentId = options.id;
      common_vendor.index.setNavigationBarTitle({ title: "编辑招募" });
      this.loadOne();
    }
  },
  methods: {
    syncStudentGenderFromProfile() {
      const info = utils_auth.getStoredUserInfo();
      const g = info.parent_info && info.parent_info.student_gender || "";
      if (g)
        this.studentGender = g;
    },
    onGrade(e) {
      const i = Number(e.detail.value);
      this.gradeIndex = i;
      this.form.student_grade = this.gradeOptions[i];
    },
    onValid(e) {
      this.validDays = Number(e.detail.value);
    },
    buildRegionAndLocation() {
      const p = this.pickPoi;
      let province = p.province || "";
      let city = p.city || "";
      let district = p.district || "";
      const full = (p.address || "").trim();
      if (full && (!city || !province)) {
        const parsed = utils_location.parseAddress(full);
        province = province || parsed.province;
        city = city || parsed.city;
        district = district || parsed.district;
      }
      const label = (this.fullAddressDisplay || "").trim() || p.address || p.name || "地图选点";
      return {
        region: {
          province,
          city,
          district,
          name: label
        },
        location: {
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude)
        }
      };
    },
    async handleChooseLocation() {
      try {
        const ok = await utils_location.requestLocationPermission();
        if (!ok) {
          common_vendor.index.showToast({ title: "需要位置权限", icon: "none" });
          return;
        }
        let lat = null;
        let lon = null;
        if (this.pickPoi.latitude && this.pickPoi.longitude) {
          lat = parseFloat(this.pickPoi.latitude);
          lon = parseFloat(this.pickPoi.longitude);
        }
        const loc = await utils_location.chooseLocation({
          latitude: lat,
          longitude: lon
        });
        const name = (loc.name != null ? String(loc.name) : "").trim();
        const address = (loc.address != null ? String(loc.address) : "").trim();
        this.pickPoi = {
          latitude: String(loc.latitude),
          longitude: String(loc.longitude),
          name,
          address,
          province: (loc.province != null ? String(loc.province) : "").trim(),
          city: (loc.city != null ? String(loc.city) : "").trim(),
          district: (loc.district != null ? String(loc.district) : "").trim()
        };
        if (address && (!this.pickPoi.city || !this.pickPoi.province)) {
          const parsed = utils_location.parseAddress(address);
          if (!this.pickPoi.province)
            this.pickPoi.province = parsed.province || "";
          if (!this.pickPoi.city)
            this.pickPoi.city = parsed.city || "";
          if (!this.pickPoi.district)
            this.pickPoi.district = parsed.district || "";
        }
        common_vendor.index.showToast({ title: "已选择地点", icon: "success" });
      } catch (err) {
        if (err && err.message && !String(err.message).includes("取消")) {
          common_vendor.index.showToast({ title: err.message || "选择失败", icon: "none" });
        }
      }
    },
    handleOpenLocation() {
      if (!this.hasMapPoint)
        return;
      utils_location.openLocation({
        latitude: parseFloat(this.pickPoi.latitude),
        longitude: parseFloat(this.pickPoi.longitude),
        name: this.pickPoi.name || "辅导地点",
        address: this.pickPoi.address || this.pickPoi.name || ""
      });
    },
    async loadOne() {
      const rc = common_vendor.tr.importObject("recruitment-center", { customUI: true });
      const res = await rc.myList({ tab: "open", page: 1, pageSize: 50 });
      if (res.code !== 0)
        return;
      const row = (res.data.list || []).find((x) => x._id === this.recruitmentId);
      if (!row) {
        common_vendor.index.showToast({ title: "招募不存在", icon: "none" });
        return;
      }
      this.form.subject = row.subject;
      this.form.student_grade = row.student_grade;
      this.gradeIndex = this.gradeOptions.indexOf(row.student_grade);
      this.form.lesson_mode = row.lesson_mode || "online";
      this.form.goal = row.goal || "";
      this.form.remark = row.remark || "";
      this.form.time_note = row.time_note || "";
      this.form.budget_min = row.budget_min != null ? String(row.budget_min) : "";
      this.form.budget_max = row.budget_max != null ? String(row.budget_max) : "";
      if (row.student_gender)
        this.studentGender = row.student_gender;
      const loc = row.location || {};
      const r = row.region || {};
      let dispName = (r.name || "").trim();
      let dispAddr = "";
      const sep = " · ";
      if (dispName.includes(sep)) {
        const i = dispName.indexOf(sep);
        dispAddr = dispName.slice(i + sep.length).trim();
        dispName = dispName.slice(0, i).trim();
      } else if (dispName) {
        const admin = `${r.province || ""}${r.city || ""}${r.district || ""}`.trim();
        if (!admin || dispName.startsWith(admin)) {
          dispAddr = dispName;
          dispName = "";
        }
      }
      this.pickPoi = {
        latitude: loc.latitude != null ? String(loc.latitude) : "",
        longitude: loc.longitude != null ? String(loc.longitude) : "",
        name: dispName,
        address: dispAddr,
        province: r.province || "",
        city: r.city || "",
        district: r.district || ""
      };
      if (dispAddr && (!this.pickPoi.city || !this.pickPoi.province)) {
        const parsed = utils_location.parseAddress(dispAddr);
        if (!this.pickPoi.province)
          this.pickPoi.province = parsed.province || "";
        if (!this.pickPoi.city)
          this.pickPoi.city = parsed.city || "";
        if (!this.pickPoi.district)
          this.pickPoi.district = parsed.district || "";
      }
    },
    async submit() {
      if (this.submitting)
        return;
      if (!this.form.subject || !this.form.student_grade) {
        common_vendor.index.showToast({ title: "请填写科目和年级", icon: "none" });
        return;
      }
      if (this.form.lesson_mode === "offline" && !this.hasMapPoint) {
        common_vendor.index.showToast({ title: "请在地图上选择上课地点", icon: "none" });
        return;
      }
      const budgetMin = Number(this.form.budget_min);
      if (!Number.isFinite(budgetMin) || budgetMin < 120) {
        common_vendor.index.showToast({ title: "最低预算不能低于 120 元/小时", icon: "none" });
        return;
      }
      if (this.form.budget_max !== "") {
        const budgetMax = Number(this.form.budget_max);
        if (!Number.isFinite(budgetMax) || budgetMax < budgetMin) {
          common_vendor.index.showToast({ title: "最高预算不能低于最低预算", icon: "none" });
          return;
        }
      }
      this.submitting = true;
      try {
        const rc = common_vendor.tr.importObject("recruitment-center", { customUI: true });
        let region = {};
        let location = {};
        if (this.form.lesson_mode === "offline") {
          const built = this.buildRegionAndLocation();
          region = built.region;
          location = built.location;
        }
        const payload = {
          subject: this.form.subject,
          student_grade: this.form.student_grade,
          lesson_mode: this.form.lesson_mode,
          region,
          location,
          goal: this.form.goal,
          remark: this.form.remark,
          time_note: this.form.time_note,
          valid_days: this.validDays,
          budget_min: budgetMin
        };
        if (this.form.budget_max !== "")
          payload.budget_max = Number(this.form.budget_max);
        let res;
        if (this.recruitmentId) {
          res = await rc.update({ recruitment_id: this.recruitmentId, ...payload });
        } else {
          res = await rc.create(payload);
        }
        if (res.code !== 0)
          throw new Error(res.message);
        if (!this.recruitmentId && res.data && res.data.recruitment_id) {
          this.recruitmentId = res.data.recruitment_id;
        }
        common_vendor.index.showToast({ title: res.message || "保存成功" });
        setTimeout(() => {
          common_vendor.index.redirectTo({
            url: "/pages/recruitment/list",
            fail: () => {
              this.submitting = false;
              common_vendor.index.navigateBack();
            }
          });
        }, 600);
      } catch (e) {
        common_vendor.index.showToast({ title: e.message || "失败", icon: "none" });
        this.submitting = false;
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.form.subject,
    b: common_vendor.o(common_vendor.m(($event) => $data.form.subject = $event.detail.value, {
      trim: true
    })),
    c: common_vendor.t($data.form.student_grade || "请选择"),
    d: !!$data.form.student_grade ? 1 : "",
    e: $data.gradeOptions,
    f: $data.gradeIndex,
    g: common_vendor.o((...args) => $options.onGrade && $options.onGrade(...args)),
    h: common_vendor.t($options.studentGenderText),
    i: $options.studentGenderText !== "与个人资料一致" ? 1 : "",
    j: $data.form.lesson_mode === "online" ? 1 : "",
    k: common_vendor.o(($event) => $data.form.lesson_mode = "online"),
    l: $data.form.lesson_mode === "offline" ? 1 : "",
    m: common_vendor.o(($event) => $data.form.lesson_mode = "offline"),
    n: $data.form.lesson_mode === "offline"
  }, $data.form.lesson_mode === "offline" ? common_vendor.e({
    o: common_vendor.o((...args) => $options.handleChooseLocation && $options.handleChooseLocation(...args)),
    p: common_vendor.t($options.fullAddressDisplay || "仅展示大致位置，请选择线下辅导地址"),
    q: $options.hasMapPoint
  }, $options.hasMapPoint ? {
    r: $options.mapCenterLat,
    s: $options.mapCenterLng,
    t: $options.mapMarkers
  } : {}, {
    v: $options.hasMapPoint
  }, $options.hasMapPoint ? {
    w: common_vendor.o((...args) => $options.handleOpenLocation && $options.handleOpenLocation(...args))
  } : {}) : {}, {
    x: $data.form.goal,
    y: common_vendor.o(common_vendor.m(($event) => $data.form.goal = $event.detail.value, {
      trim: true
    })),
    z: $data.form.remark,
    A: common_vendor.o(common_vendor.m(($event) => $data.form.remark = $event.detail.value, {
      trim: true
    })),
    B: $data.form.time_note,
    C: common_vendor.o(common_vendor.m(($event) => $data.form.time_note = $event.detail.value, {
      trim: true
    })),
    D: $data.form.budget_min,
    E: common_vendor.o(($event) => $data.form.budget_min = $event.detail.value),
    F: $data.form.budget_max,
    G: common_vendor.o(($event) => $data.form.budget_max = $event.detail.value),
    H: common_vendor.t($data.validDays),
    I: $data.validDays === 7 ? 1 : "",
    J: common_vendor.o(($event) => $data.validDays = 7),
    K: $data.validDays === 14 ? 1 : "",
    L: common_vendor.o(($event) => $data.validDays = 14),
    M: $data.validDays === 30 ? 1 : "",
    N: common_vendor.o(($event) => $data.validDays = 30),
    O: common_vendor.t($data.submitting ? "提交中..." : $data.recruitmentId ? "保存并重新审核" : "提交审核"),
    P: $data.submitting,
    Q: common_vendor.o((...args) => $options.submit && $options.submit(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-de3cdd3d"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/recruitment/edit.js.map
