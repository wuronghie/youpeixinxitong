"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "UserProfile",
  components: {
    card
  },
  data() {
    return {
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl(),
      userInfo: {},
      formData: {
        avatar: "",
        nickname: "",
        phone: "",
        gender: "",
        student_name: "",
        student_grade: ""
      },
      gradeOptions: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"],
      useMock: true
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() !== false;
    this.loadUserInfo();
  },
  methods: {
    async loadUserInfo() {
      var _a, _b;
      try {
        const stored = common_vendor.index.getStorageSync("userInfo");
        this.userInfo = stored || utils_mockData.mockUserInfo;
        this.formData = {
          avatar: this.userInfo.avatar || "",
          nickname: this.userInfo.nickname || "",
          phone: this.userInfo.phone || "",
          gender: this.userInfo.gender || "",
          student_name: this.userInfo.student_name || ((_a = this.userInfo.parent_info) == null ? void 0 : _a.student_name) || "",
          student_grade: this.userInfo.student_grade || ((_b = this.userInfo.parent_info) == null ? void 0 : _b.student_grade) || ""
        };
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/profile.vue:144", "加载失败:", error);
      }
    },
    chooseAvatar() {
      common_vendor.index.chooseImage({
        count: 1,
        success: (res) => {
          this.formData.avatar = res.tempFilePaths[0];
        }
      });
    },
    onGradeChange(e) {
      this.formData.student_grade = this.gradeOptions[e.detail.value];
    },
    async saveProfile() {
      try {
        if (!this.useMock) {
          const userProfile = common_vendor.tr.importObject("user-profile", { customUI: true });
          const res = await userProfile.updateUserProfile({
            avatar: this.formData.avatar,
            nickname: this.formData.nickname,
            phone: this.formData.phone,
            gender: this.formData.gender,
            parent_info: {
              student_name: this.formData.student_name,
              student_grade: this.formData.student_grade
            }
          });
          if (res.code !== 0) {
            throw new Error(res.message || "保存失败");
          }
        }
        common_vendor.index.showToast({
          title: "保存成功",
          icon: "success"
        });
        setTimeout(() => {
          common_vendor.index.navigateBack();
        }, 1500);
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/profile.vue:186", "保存失败:", error);
        common_vendor.index.showToast({
          title: error.message || "保存失败",
          icon: "none"
        });
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
    a: $data.formData.avatar || $data.defaultAvatarUrl,
    b: common_vendor.o((...args) => $options.chooseAvatar && $options.chooseAvatar(...args)),
    c: common_vendor.p({
      headTitle: "头像"
    }),
    d: $data.formData.nickname,
    e: common_vendor.o(($event) => $data.formData.nickname = $event.detail.value),
    f: $data.formData.phone,
    g: common_vendor.o(($event) => $data.formData.phone = $event.detail.value),
    h: common_vendor.n($data.formData.gender === "male" ? "main-bg-color text-white" : "bg-light-secondary"),
    i: common_vendor.o(($event) => $data.formData.gender = "male"),
    j: common_vendor.n($data.formData.gender === "female" ? "main-bg-color text-white" : "bg-light-secondary"),
    k: common_vendor.o(($event) => $data.formData.gender = "female"),
    l: common_vendor.p({
      headTitle: "基本信息"
    }),
    m: $data.userInfo.role === "parent"
  }, $data.userInfo.role === "parent" ? {
    n: $data.formData.student_name,
    o: common_vendor.o(($event) => $data.formData.student_name = $event.detail.value),
    p: common_vendor.t($data.formData.student_grade || "请选择"),
    q: common_vendor.n($data.formData.student_grade ? "" : "text-light-muted"),
    r: $data.gradeOptions,
    s: common_vendor.o((...args) => $options.onGradeChange && $options.onGradeChange(...args)),
    t: common_vendor.p({
      headTitle: "学生信息"
    })
  } : {}, {
    v: common_vendor.o((...args) => $options.saveProfile && $options.saveProfile(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-036958a5"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/user/profile.js.map
