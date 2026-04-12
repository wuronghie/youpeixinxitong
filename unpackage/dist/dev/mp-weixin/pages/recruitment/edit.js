"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_location = require("../../utils/location.js");
const _sfc_main = {
  data() {
    return {
      recruitmentId: "",
      gradeOptions: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"],
      gradeIndex: -1,
      validDays: 14,
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
    addressPreviewLines() {
      const s = (this.fullAddressDisplay || "").trim();
      return s ? [s] : [];
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
    if (options.id) {
      this.recruitmentId = options.id;
      this.loadOne();
    }
  },
  methods: {
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
          valid_days: this.validDays
        };
        if (this.form.budget_min !== "")
          payload.budget_min = Number(this.form.budget_min);
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
    a: common_vendor.t($data.recruitmentId ? "编辑招募" : "发布招募"),
    b: $data.form.subject,
    c: common_vendor.o(common_vendor.m(($event) => $data.form.subject = $event.detail.value, {
      trim: true
    })),
    d: common_vendor.t($data.form.student_grade || "请选择年级"),
    e: !$data.form.student_grade ? 1 : "",
    f: $data.gradeOptions,
    g: $data.gradeIndex,
    h: common_vendor.o((...args) => $options.onGrade && $options.onGrade(...args)),
    i: $data.form.lesson_mode === "online" ? 1 : "",
    j: common_vendor.o(($event) => $data.form.lesson_mode = "online"),
    k: $data.form.lesson_mode === "offline" ? 1 : "",
    l: common_vendor.o(($event) => $data.form.lesson_mode = "offline"),
    m: $data.form.lesson_mode === "offline"
  }, $data.form.lesson_mode === "offline" ? common_vendor.e({
    n: common_vendor.o((...args) => $options.handleChooseLocation && $options.handleChooseLocation(...args)),
    o: $options.addressPreviewLines.length
  }, $options.addressPreviewLines.length ? {
    p: common_vendor.f($options.addressPreviewLines, (line, idx, i0) => {
      return {
        a: common_vendor.t(line),
        b: idx
      };
    })
  } : {}, {
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
    H: $data.validDays === 7 ? 1 : "",
    I: common_vendor.o(($event) => $data.validDays = 7),
    J: $data.validDays === 14 ? 1 : "",
    K: common_vendor.o(($event) => $data.validDays = 14),
    L: $data.validDays === 30 ? 1 : "",
    M: common_vendor.o(($event) => $data.validDays = 30),
    N: common_vendor.t($data.submitting ? "提交中..." : $data.recruitmentId ? "保存并重新审核" : "提交审核"),
    O: $data.submitting,
    P: common_vendor.o((...args) => $options.submit && $options.submit(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-de3cdd3d"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/recruitment/edit.js.map
