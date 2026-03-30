"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const card = () => "../../components/common/card.js";
const defaultAvatar = utils_imageConfig.getDefaultAvatarUrl();
const _sfc_main = {
  name: "TeacherProfileIndex",
  components: {
    card
  },
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      profile: {
        display_name: "",
        avatar: "",
        title: "",
        introduction: "",
        subjects: [],
        grades: [],
        teaching_experience: { years: 0, description: "" },
        education: {},
        qualifications: [],
        teaching_areas: []
      },
      stats: {
        averageRating: 5,
        totalReviews: 0,
        totalStudents: 0,
        recentCompleted: 0,
        totalIncome: 0
      },
      useMock: false,
      loading: false,
      defaultAvatar
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.loadProfile();
  },
  onShareAppMessage() {
    return {
      title: "家教帮 · 教师主页",
      path: "/pages-teacher/profile/index"
    };
  },
  onShareTimeline() {
    return {
      title: "家教帮 · 教师主页"
    };
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/profile/index.vue:192", "[profile] 下拉刷新：重新加载资料");
      await this.loadProfile();
    },
    async loadProfile() {
      if (this.loading)
        return;
      this.loading = true;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mock = utils_mockData.mockTeachers[0];
          this.profile = {
            display_name: mock.display_name,
            avatar: mock.avatar,
            title: mock.title,
            introduction: mock.introduction,
            subjects: mock.subjects,
            grades: mock.grades,
            teaching_experience: { years: mock.experience_years || 0, description: "" },
            education: mock.education || {},
            qualifications: mock.qualifications || [],
            teaching_areas: mock.teaching_areas || []
          };
          this.stats = {
            averageRating: mock.rating || 5,
            totalReviews: 32,
            totalStudents: 18,
            recentCompleted: 5,
            totalIncome: 13500
          };
          return;
        }
        const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
        if (!userInfo.uid || userInfo.role !== "teacher") {
          common_vendor.index.showToast({ title: "请先以教师身份登录", icon: "none" });
          return;
        }
        const dashboard = common_vendor.tr.importObject("teacher-dashboard", { customUI: true });
        const res = await dashboard.getProfileDetail();
        if (res.code === 0) {
          const profileData = res.data.profile || {};
          if (profileData.qualifications && Array.isArray(profileData.qualifications)) {
            const fileIds = profileData.qualifications.filter((q) => q.image && !q.image.startsWith("http")).map((q) => q.image);
            if (fileIds.length > 0) {
              try {
                const tempRes = await common_vendor.tr.getTempFileURL({ fileList: fileIds });
                const urlMap = {};
                if (tempRes.fileList) {
                  tempRes.fileList.forEach((file, index) => {
                    if (file.tempFileURL) {
                      urlMap[fileIds[index]] = file.tempFileURL;
                    }
                  });
                }
                profileData.qualifications.forEach((q) => {
                  if (q.image && !q.image.startsWith("http") && urlMap[q.image]) {
                    q.image = urlMap[q.image];
                  }
                });
              } catch (e) {
                common_vendor.index.__f__("error", "at pages-teacher/profile/index.vue:257", "获取证书图片URL失败:", e);
              }
            }
          }
          this.profile = Object.assign({}, this.profile, profileData);
          this.stats = Object.assign({}, this.stats, res.data.metrics || {});
        } else {
          common_vendor.index.showToast({ title: res.message || "加载失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/profile/index.vue:267", "教师主页加载失败:", error);
        common_vendor.index.showToast({ title: "加载失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    formatCurrency(value) {
      const num = Number(value || 0);
      return num.toFixed(2);
    },
    renderArray(arr) {
      if (!arr || !arr.length)
        return "未设置";
      return arr.join("、");
    },
    renderArea(area = {}) {
      const parts = [area.province, area.city, area.district, area.address];
      return parts.filter(Boolean).join(" ");
    },
    goToEdit() {
      common_vendor.index.navigateTo({ url: "/pages-teacher/profile/edit" });
    },
    goToSchedule() {
      common_vendor.index.navigateTo({ url: "/pages-teacher/profile/schedule" });
    },
    previewImage(url) {
      if (!url)
        return;
      common_vendor.index.previewImage({
        urls: [url],
        current: url
      });
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  return common_vendor.e({
    a: $data.profile.avatar || $data.defaultAvatar,
    b: common_vendor.t($data.profile.display_name || "教师"),
    c: $data.stats.totalReviews > 0
  }, $data.stats.totalReviews > 0 ? {
    d: common_vendor.t($data.stats.averageRating || "0.0")
  } : {}, {
    e: ($data.profile.subjects || []).length
  }, ($data.profile.subjects || []).length ? {
    f: common_vendor.f($data.profile.subjects, (subject, k0, i0) => {
      return {
        a: common_vendor.t(subject),
        b: subject
      };
    })
  } : {}, {
    g: common_vendor.t($options.formatCurrency($data.profile.hourly_rate || 0)),
    h: common_vendor.t($data.stats.totalStudents || 0),
    i: common_vendor.o((...args) => $options.goToEdit && $options.goToEdit(...args)),
    j: $data.profile.introduction
  }, $data.profile.introduction ? {
    k: common_vendor.t($data.profile.introduction)
  } : {}, {
    l: common_vendor.p({
      headTitle: "教师介绍"
    }),
    m: common_vendor.t($options.renderArray($data.profile.subjects)),
    n: common_vendor.t($options.renderArray($data.profile.grades)),
    o: common_vendor.t(((_a = $data.profile.teaching_experience) == null ? void 0 : _a.years) || 0),
    p: common_vendor.t($data.stats.totalReviews),
    q: common_vendor.p({
      headTitle: "教学信息"
    }),
    r: ((_b = $data.profile.education) == null ? void 0 : _b.degree) || ((_c = $data.profile.education) == null ? void 0 : _c.school)
  }, ((_d = $data.profile.education) == null ? void 0 : _d.degree) || ((_e = $data.profile.education) == null ? void 0 : _e.school) ? common_vendor.e({
    s: common_vendor.t(((_f = $data.profile.education) == null ? void 0 : _f.degree) || "学历未填写"),
    t: (_g = $data.profile.education) == null ? void 0 : _g.school
  }, ((_h = $data.profile.education) == null ? void 0 : _h.school) ? {
    v: common_vendor.t($data.profile.education.school)
  } : {}, {
    w: (_i = $data.profile.education) == null ? void 0 : _i.major
  }, ((_j = $data.profile.education) == null ? void 0 : _j.major) ? {
    x: common_vendor.t($data.profile.education.major)
  } : {}, {
    y: (_k = $data.profile.education) == null ? void 0 : _k.graduation_year
  }, ((_l = $data.profile.education) == null ? void 0 : _l.graduation_year) ? {
    z: common_vendor.t($data.profile.education.graduation_year)
  } : {}, {
    A: common_vendor.p({
      headTitle: "教育背景"
    })
  }) : {}, {
    B: ($data.profile.teaching_areas || []).length
  }, ($data.profile.teaching_areas || []).length ? {
    C: common_vendor.f($data.profile.teaching_areas, (area, idx, i0) => {
      return {
        a: common_vendor.t($options.renderArea(area)),
        b: idx
      };
    })
  } : {}, {
    D: common_vendor.p({
      headTitle: "教学地区"
    }),
    E: common_vendor.o((...args) => $options.goToEdit && $options.goToEdit(...args)),
    F: ($data.profile.qualifications || []).length
  }, ($data.profile.qualifications || []).length ? {
    G: common_vendor.f($data.profile.qualifications, (cert, idx, i0) => {
      return common_vendor.e({
        a: common_vendor.t(cert.name || "证书"),
        b: cert.number
      }, cert.number ? {
        c: common_vendor.t(cert.number)
      } : {}, {
        d: cert.image
      }, cert.image ? {
        e: cert.image,
        f: common_vendor.o(($event) => $options.previewImage(cert.image), idx)
      } : {}, {
        g: idx
      });
    })
  } : {}, {
    H: common_vendor.p({
      headTitle: "资质证书"
    }),
    I: common_vendor.o((...args) => $options.goToEdit && $options.goToEdit(...args)),
    J: common_vendor.o((...args) => $options.goToSchedule && $options.goToSchedule(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-c0c69757"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/profile/index.js.map
