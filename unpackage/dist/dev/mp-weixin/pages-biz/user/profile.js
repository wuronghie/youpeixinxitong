"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const _sfc_main = {
  name: "UserProfile",
  data() {
    return {
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
        common_vendor.index.__f__("error", "at pages-biz/user/profile.vue:110", "加载失败:", error);
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
        common_vendor.index.__f__("error", "at pages-biz/user/profile.vue:152", "保存失败:", error);
        common_vendor.index.showToast({
          title: error.message || "保存失败",
          icon: "none"
        });
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.formData.avatar || $data.defaultAvatarUrl,
    b: common_vendor.o((...args) => $options.chooseAvatar && $options.chooseAvatar(...args)),
    c: $data.formData.nickname,
    d: common_vendor.o(($event) => $data.formData.nickname = $event.detail.value),
    e: $data.formData.phone,
    f: common_vendor.o(($event) => $data.formData.phone = $event.detail.value),
    g: $data.formData.gender === "male" ? 1 : "",
    h: common_vendor.o(($event) => $data.formData.gender = "male"),
    i: $data.formData.gender === "female" ? 1 : "",
    j: common_vendor.o(($event) => $data.formData.gender = "female"),
    k: $data.userInfo.role !== "parent" ? 1 : "",
    l: $data.userInfo.role === "parent"
  }, $data.userInfo.role === "parent" ? {
    m: $data.formData.student_name,
    n: common_vendor.o(($event) => $data.formData.student_name = $event.detail.value),
    o: common_vendor.t($data.formData.student_grade || "请选择"),
    p: !!$data.formData.student_grade ? 1 : "",
    q: $data.gradeOptions,
    r: common_vendor.o((...args) => $options.onGradeChange && $options.onGradeChange(...args))
  } : {}, {
    s: common_vendor.o((...args) => $options.saveProfile && $options.saveProfile(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-66cd72dd"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-biz/user/profile.js.map
