"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_auth = require("../../utils/auth.js");
const utils_location = require("../../utils/location.js");
const utils_wxContentSecurity = require("../../utils/wxContentSecurity.js");
const card = () => "../../components/common/card.js";
const defaultAvatar = utils_imageConfig.getDefaultAvatarUrl();
const _sfc_main = {
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  components: {
    card
  },
  name: "ParentRegister",
  data() {
    return {
      useMock: false,
      role: "parent",
      loading: false,
      avatarUploading: false,
      isSubmitting: false,
      gradeIndex: -1,
      gradeOptions: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"],
      subjectOptions: ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治", "其他"],
      goalOptions: ["查漏补缺", "冲刺提分", "习惯培养", "同步辅导", "竞赛备赛", "素质提升"],
      formData: {
        avatar: "",
        avatarFileId: "",
        real_name: "",
        gender: "",
        // 家长性别（必填）：'male' | 'female'
        phone: "",
        student_name: "",
        student_gender: "",
        // 孩子性别（必填）：'male' | 'female'
        student_grade: "",
        student_age: "",
        school_name: "",
        student_subjects: [],
        learning_goal: "",
        address: {
          latitude: "",
          longitude: "",
          name: ""
        },
        address_detail: "",
        // 保留用于兼容，实际使用address对象
        extra_notes: ""
      },
      defaultAvatar
    };
  },
  computed: {
    roleText() {
      return this.role === "parent" ? "家长" : this.role === "teacher" ? "教师" : "访客";
    },
    canEdit() {
      return this.role === "parent" && !this.loading;
    },
    heroSubtitle() {
      if (this.role !== "parent") {
        return "当前账号非家长角色，无法编辑";
      }
      if (this.formData.student_name && this.formData.student_grade) {
        return `${this.formData.student_name} · ${this.formData.student_grade}`;
      }
      return "完善资料以获取更精准的课程推荐";
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
  onLoad(options) {
    this.useMock = utils_mockData.useMockData() === true;
    if (options.role) {
      this.role = options.role;
    }
    const stored = common_vendor.index.getStorageSync("userInfo");
    if (stored == null ? void 0 : stored.role) {
      this.role = stored.role;
    }
    this.initPage();
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages/common/register.vue:364", "[register] 下拉刷新：重新加载资料");
      await this.initPage(true);
    },
    async initPage(fromPullDown = false) {
      if (!fromPullDown) {
        this.loading = true;
      }
      try {
        await this.fetchProfile();
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/common/register.vue:374", "初始化家长资料失败:", error);
      } finally {
        if (fromPullDown) {
          common_vendor.index.stopPullDownRefresh();
        }
        this.loading = false;
      }
    },
    async fetchProfile() {
      if (this.useMock) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const data = utils_mockData.mockUserInfo || {};
        this.fillFormFromProfile(data);
        return;
      }
      const stored = common_vendor.index.getStorageSync("userInfo") || {};
      if (stored.uid) {
        this.role = stored.role || this.role;
      }
      try {
        const userProfile = common_vendor.tr.importObject("user-profile", { customUI: true });
        const res = await userProfile.getUserProfile();
        if (res.code === 0 && res.data) {
          const profile = res.data;
          this.fillFormFromProfile(profile);
          const nextStored = {
            ...stored,
            nickname: profile.nickname || stored.nickname,
            avatar: profile.avatar || stored.avatar,
            role: profile.role || stored.role,
            parent_info: profile.parent_info || stored.parent_info || {},
            phone: profile.phone || stored.phone,
            gender: profile.gender != null ? profile.gender : stored.gender
          };
          common_vendor.index.setStorageSync("userInfo", nextStored);
        } else {
          common_vendor.index.__f__("warn", "at pages/common/register.vue:411", "获取用户信息失败，使用本地存储信息:", res.message);
          if (stored.uid) {
            this.fillFormFromProfile({
              nickname: stored.nickname || "",
              avatar: stored.avatar || "",
              phone: stored.phone || "",
              role: stored.role || "parent",
              parent_info: stored.parent_info || {}
            });
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/common/register.vue:424", "获取家长资料失败:", error);
        const stored2 = common_vendor.index.getStorageSync("userInfo") || {};
        if (stored2.uid) {
          this.fillFormFromProfile({
            nickname: stored2.nickname || "",
            avatar: stored2.avatar || "",
            phone: stored2.phone || "",
            role: stored2.role || "parent",
            parent_info: stored2.parent_info || {}
          });
        }
      }
    },
    async fillFormFromProfile(profile) {
      const pInfo = profile.parent_info || {};
      const avatarFileId = profile.avatar || profile.wx_avatarUrl || "";
      let avatarUrl = avatarFileId;
      if (avatarFileId && !avatarFileId.startsWith("http")) {
        avatarUrl = await this.getTempFileURL(avatarFileId);
      }
      const legacyAddress = pInfo.address || {};
      const hasLegacyAddress = legacyAddress && (legacyAddress.latitude || legacyAddress.name);
      const locationLat = pInfo.location_latitude;
      const locationLon = pInfo.location_longitude;
      const locationName = pInfo.location_name;
      const hasLocation = locationLat !== void 0 && locationLat !== null && locationLat !== "" || locationLon !== void 0 && locationLon !== null && locationLon !== "" || locationName;
      const finalAddressName = pInfo.address_detail || locationName || hasLegacyAddress && legacyAddress.name || "";
      const rawGender = profile.gender;
      let genderStr = "";
      if (rawGender === 1 || rawGender === "1" || rawGender === "male")
        genderStr = "male";
      else if (rawGender === 2 || rawGender === "2" || rawGender === "female")
        genderStr = "female";
      const rawStudentGender = pInfo.student_gender;
      let studentGenderStr = "";
      if (rawStudentGender === 1 || rawStudentGender === "1" || rawStudentGender === "male")
        studentGenderStr = "male";
      else if (rawStudentGender === 2 || rawStudentGender === "2" || rawStudentGender === "female")
        studentGenderStr = "female";
      this.formData = {
        avatar: avatarUrl || defaultAvatar,
        avatarFileId: avatarFileId || "",
        real_name: profile.nickname || pInfo.real_name || "",
        gender: genderStr,
        phone: profile.phone || "",
        student_name: pInfo.student_name || "",
        student_gender: studentGenderStr,
        student_grade: pInfo.student_grade || "",
        student_age: pInfo.student_age || "",
        school_name: pInfo.school_name || "",
        student_subjects: Array.isArray(pInfo.student_subjects) ? pInfo.student_subjects : [],
        learning_goal: pInfo.learning_goal || "",
        address_detail: finalAddressName,
        address: hasLegacyAddress ? {
          latitude: legacyAddress.latitude || "",
          longitude: legacyAddress.longitude || "",
          name: legacyAddress.name || finalAddressName
        } : hasLocation ? {
          latitude: locationLat !== void 0 && locationLat !== null ? String(locationLat) : "",
          longitude: locationLon !== void 0 && locationLon !== null ? String(locationLon) : "",
          name: locationName || finalAddressName
        } : {
          latitude: "",
          longitude: "",
          name: finalAddressName
        },
        extra_notes: pInfo.extra_notes || ""
      };
      this.gradeIndex = this.gradeOptions.indexOf(this.formData.student_grade);
    },
    chooseAvatar() {
      if (!this.canEdit || this.avatarUploading)
        return;
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        success: async (res) => {
          var _a;
          const localPath = (_a = res.tempFilePaths) == null ? void 0 : _a[0];
          if (!localPath)
            return;
          await this.uploadAvatar(localPath);
        }
      });
    },
    async uploadAvatar(localPath) {
      try {
        this.avatarUploading = true;
        try {
          await utils_wxContentSecurity.wxCheckLocalImageBeforeUpload(localPath);
        } catch (secErr) {
          common_vendor.index.showToast({ title: secErr && secErr.message || "图片未通过安全检测", icon: "none" });
          return;
        }
        const extIndex = localPath.lastIndexOf(".");
        const ext = extIndex > -1 ? localPath.substring(extIndex) : "";
        const cloudPath = `parent-avatar/${Date.now()}-${Math.floor(Math.random() * 1e5)}${ext}`;
        const res = await common_vendor.tr.uploadFile({
          filePath: localPath,
          cloudPath
        });
        if (res == null ? void 0 : res.fileID) {
          const tempUrl = await this.getTempFileURL(res.fileID);
          this.formData.avatar = tempUrl;
          this.formData.avatarFileId = res.fileID;
          common_vendor.index.showToast({ title: "头像已更新", icon: "success" });
        } else {
          common_vendor.index.showToast({ title: "上传失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/common/register.vue:541", "上传头像失败:", error);
        common_vendor.index.showToast({ title: "上传失败，请稍后重试", icon: "none" });
      } finally {
        this.avatarUploading = false;
      }
    },
    async getTempFileURL(fileId) {
      var _a;
      if (!fileId)
        return "";
      if (fileId.startsWith("http"))
        return fileId;
      try {
        const res = await common_vendor.tr.getTempFileURL({ fileList: [fileId] });
        const file = (_a = res.fileList) == null ? void 0 : _a[0];
        return (file == null ? void 0 : file.tempFileURL) || fileId;
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/common/register.vue:555", "获取临时链接失败:", error);
        return fileId;
      }
    },
    onGradeChange(event) {
      if (!this.canEdit)
        return;
      const index = Number(event.detail.value);
      this.gradeIndex = index;
      this.formData.student_grade = this.gradeOptions[index];
    },
    selectGender(gender) {
      if (!this.canEdit)
        return;
      if (gender !== "male" && gender !== "female")
        return;
      this.formData.gender = gender;
    },
    selectStudentGender(gender) {
      if (!this.canEdit)
        return;
      if (gender !== "male" && gender !== "female")
        return;
      this.formData.student_gender = gender;
    },
    toggleSubject(subject) {
      if (!this.canEdit)
        return;
      const subjects = this.formData.student_subjects.slice(0);
      const idx = subjects.indexOf(subject);
      if (idx > -1) {
        subjects.splice(idx, 1);
      } else {
        subjects.push(subject);
      }
      this.formData.student_subjects = subjects;
    },
    selectGoal(goal) {
      if (!this.canEdit)
        return;
      this.formData.learning_goal = this.formData.learning_goal === goal ? "" : goal;
    },
    /**
     * 选择位置（打开地图选择）
     */
    async handleChooseLocation() {
      if (!this.canEdit)
        return;
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
        this.formData.address_detail = this.formData.address.name;
        common_vendor.index.showToast({
          title: "选择成功",
          icon: "success"
        });
      } catch (error) {
        if (error.message && !error.message.includes("取消")) {
          common_vendor.index.__f__("error", "at pages/common/register.vue:633", "选择位置失败:", error);
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
      if (!this.canEdit)
        return;
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
      if (!this.formData.real_name) {
        common_vendor.index.showToast({ title: "请填写真实姓名", icon: "none" });
        return false;
      }
      if (this.formData.gender !== "male" && this.formData.gender !== "female") {
        common_vendor.index.showToast({ title: "请选择性别", icon: "none" });
        return false;
      }
      const phoneReg = /^1[3-9]\d{9}$/;
      if (!this.formData.phone || !phoneReg.test(this.formData.phone)) {
        common_vendor.index.showToast({ title: "请填写正确的手机号", icon: "none" });
        return false;
      }
      if (!this.formData.student_name) {
        common_vendor.index.showToast({ title: "请填写学生姓名", icon: "none" });
        return false;
      }
      if (this.formData.student_gender !== "male" && this.formData.student_gender !== "female") {
        common_vendor.index.showToast({ title: "请选择孩子性别", icon: "none" });
        return false;
      }
      if (!this.formData.student_grade) {
        common_vendor.index.showToast({ title: "请选择学生年级", icon: "none" });
        return false;
      }
      return true;
    },
    async submitForm() {
      if (!this.canEdit || this.isSubmitting) {
        common_vendor.index.__f__("log", "at pages/common/register.vue:692", "[register] 保存被阻止:", { canEdit: this.canEdit, isSubmitting: this.isSubmitting });
        return;
      }
      if (!this.validateForm()) {
        common_vendor.index.__f__("log", "at pages/common/register.vue:696", "[register] 表单验证失败");
        return;
      }
      try {
        this.isSubmitting = true;
        common_vendor.index.__f__("log", "at pages/common/register.vue:701", "[register] 开始保存，payload:", {
          real_name: this.formData.real_name,
          phone: this.formData.phone,
          student_name: this.formData.student_name,
          student_grade: this.formData.student_grade
        });
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          common_vendor.index.showToast({ title: "保存成功 (模拟)", icon: "success" });
          this.isSubmitting = false;
          return;
        }
        const payload = {
          real_name: this.formData.real_name,
          phone: this.formData.phone,
          gender: this.formData.gender,
          avatar: this.formData.avatarFileId || this.formData.avatar,
          student_name: this.formData.student_name,
          student_gender: this.formData.student_gender,
          student_grade: this.formData.student_grade,
          student_subjects: this.formData.student_subjects,
          learning_goal: this.formData.learning_goal,
          address_detail: this.formData.address.name || this.formData.address_detail || "",
          address: this.formData.address.latitude && this.formData.address.longitude ? {
            latitude: parseFloat(this.formData.address.latitude),
            longitude: parseFloat(this.formData.address.longitude),
            name: this.formData.address.name || ""
          } : null,
          student_age: this.formData.student_age,
          school_name: this.formData.school_name,
          extra_notes: this.formData.extra_notes
        };
        common_vendor.index.__f__("log", "at pages/common/register.vue:738", "[register] 调用云函数 updateParentProfile");
        const userProfile = common_vendor.tr.importObject("user-profile", { customUI: true });
        const res = await userProfile.updateParentProfile(payload);
        common_vendor.index.__f__("log", "at pages/common/register.vue:741", "[register] 云函数返回:", res);
        if (res.code === 0) {
          try {
            const inviteCenter = common_vendor.tr.importObject("invite-center", { customUI: true });
            await inviteCenter.getMyInviteCode();
          } catch (e) {
            common_vendor.index.__f__("error", "at pages/common/register.vue:749", "[register] 生成邀请码失败（忽略，不影响资料保存）:", e);
          }
          const stored = common_vendor.index.getStorageSync("userInfo") || {};
          const parentInfo = {
            real_name: this.formData.real_name,
            student_name: this.formData.student_name,
            student_gender: this.formData.student_gender,
            student_grade: this.formData.student_grade,
            student_subjects: this.formData.student_subjects,
            learning_goal: this.formData.learning_goal,
            address_detail: this.formData.address.name || this.formData.address_detail || "",
            address: this.formData.address.latitude && this.formData.address.longitude ? {
              latitude: parseFloat(this.formData.address.latitude),
              longitude: parseFloat(this.formData.address.longitude),
              name: this.formData.address.name || ""
            } : null,
            student_age: this.formData.student_age,
            school_name: this.formData.school_name,
            extra_notes: this.formData.extra_notes,
            update_time: Date.now()
          };
          const nextStored = {
            ...stored,
            nickname: this.formData.real_name,
            avatar: this.formData.avatarFileId || this.formData.avatar || stored.avatar,
            phone: this.formData.phone,
            gender: this.formData.gender === "male" ? 1 : 2,
            parent_info: parentInfo,
            role: "parent"
          };
          common_vendor.index.setStorageSync("userInfo", nextStored);
          common_vendor.index.__f__("log", "at pages/common/register.vue:782", "[register] 保存成功，已更新本地存储");
          common_vendor.index.showToast({ title: "保存成功", icon: "success" });
          setTimeout(() => {
            const pages = getCurrentPages();
            if (pages && pages.length > 1) {
              common_vendor.index.navigateBack({
                delta: 1,
                fail: () => {
                  utils_auth.redirectByRole("parent");
                }
              });
            } else {
              utils_auth.redirectByRole("parent");
            }
          }, 1200);
        } else {
          common_vendor.index.__f__("error", "at pages/common/register.vue:799", "[register] 保存失败:", res.message);
          common_vendor.index.showToast({ title: res.message || "保存失败", icon: "none", duration: 3e3 });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/common/register.vue:803", "[register] 保存家长资料异常:", error);
        const errorMsg = error.message || error.errMsg || "保存失败，请稍后再试";
        common_vendor.index.showToast({ title: errorMsg, icon: "none", duration: 3e3 });
      } finally {
        this.isSubmitting = false;
        common_vendor.index.__f__("log", "at pages/common/register.vue:808", "[register] 保存流程结束，isSubmitting:", this.isSubmitting);
      }
    },
    goRolePage() {
      common_vendor.index.navigateTo({ url: "/pages-teacher/profile/edit" });
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.formData.avatar || $data.defaultAvatar,
    b: common_vendor.t($data.avatarUploading ? "上传中..." : "更换头像"),
    c: common_vendor.o((...args) => $options.chooseAvatar && $options.chooseAvatar(...args)),
    d: common_vendor.t($data.formData.real_name || "家长用户"),
    e: common_vendor.t($options.heroSubtitle),
    f: $data.role !== "parent"
  }, $data.role !== "parent" ? {
    g: common_vendor.t($options.roleText)
  } : {}, {
    h: common_vendor.t($data.formData.phone || "未填写"),
    i: common_vendor.t($data.formData.student_name || "未填写"),
    j: common_vendor.t($data.formData.student_grade || "未选择"),
    k: $data.role !== "parent"
  }, $data.role !== "parent" ? {
    l: common_vendor.o((...args) => $options.goRolePage && $options.goRolePage(...args))
  } : {}, {
    m: !$options.canEdit,
    n: $data.formData.real_name,
    o: common_vendor.o(common_vendor.m(($event) => $data.formData.real_name = $event.detail.value, {
      trim: true
    })),
    p: common_vendor.n($data.formData.gender === "male" ? "gender-selected male" : "gender-default"),
    q: common_vendor.o(($event) => $options.selectGender("male")),
    r: common_vendor.n($data.formData.gender === "female" ? "gender-selected female" : "gender-default"),
    s: common_vendor.o(($event) => $options.selectGender("female")),
    t: !$options.canEdit,
    v: $data.formData.phone,
    w: common_vendor.o(common_vendor.m(($event) => $data.formData.phone = $event.detail.value, {
      trim: true
    })),
    x: !$options.canEdit ? 1 : "",
    y: common_vendor.p({
      headTitle: "家长信息"
    }),
    z: !$options.canEdit,
    A: $data.formData.student_name,
    B: common_vendor.o(common_vendor.m(($event) => $data.formData.student_name = $event.detail.value, {
      trim: true
    })),
    C: common_vendor.n($data.formData.student_gender === "male" ? "gender-selected male" : "gender-default"),
    D: common_vendor.o(($event) => $options.selectStudentGender("male")),
    E: common_vendor.n($data.formData.student_gender === "female" ? "gender-selected female" : "gender-default"),
    F: common_vendor.o(($event) => $options.selectStudentGender("female")),
    G: common_vendor.t($data.formData.student_grade || "请选择年级"),
    H: common_vendor.n($data.formData.student_grade ? "" : "text-light-muted"),
    I: $data.gradeOptions,
    J: $data.gradeIndex,
    K: common_vendor.o((...args) => $options.onGradeChange && $options.onGradeChange(...args)),
    L: !$options.canEdit,
    M: !$options.canEdit,
    N: $data.formData.student_age,
    O: common_vendor.o(common_vendor.m(($event) => $data.formData.student_age = $event.detail.value, {
      trim: true
    })),
    P: !$options.canEdit,
    Q: $data.formData.school_name,
    R: common_vendor.o(common_vendor.m(($event) => $data.formData.school_name = $event.detail.value, {
      trim: true
    })),
    S: common_vendor.f($data.subjectOptions, (item, k0, i0) => {
      return {
        a: common_vendor.t(item),
        b: item,
        c: common_vendor.n($data.formData.student_subjects.includes(item) ? "main-bg-color text-white" : "bg-light-secondary"),
        d: common_vendor.o(($event) => $options.toggleSubject(item), item)
      };
    }),
    T: !$options.canEdit ? 1 : "",
    U: common_vendor.p({
      headTitle: "学生信息"
    }),
    V: common_vendor.f($data.goalOptions, (item, k0, i0) => {
      return {
        a: common_vendor.t(item),
        b: item,
        c: common_vendor.n($data.formData.learning_goal === item ? "main-bg-color text-white" : "bg-light-secondary"),
        d: common_vendor.o(($event) => $options.selectGoal(item), item)
      };
    }),
    W: !$options.canEdit,
    X: $data.formData.extra_notes,
    Y: common_vendor.o(common_vendor.m(($event) => $data.formData.extra_notes = $event.detail.value, {
      trim: true
    })),
    Z: common_vendor.t($data.formData.extra_notes.length),
    aa: !$options.canEdit ? 1 : "",
    ab: common_vendor.p({
      headTitle: "学习目标"
    }),
    ac: common_vendor.t($options.addressDisplay || "点击选择地址"),
    ad: common_vendor.o((...args) => $options.handleChooseLocation && $options.handleChooseLocation(...args)),
    ae: $data.formData.address.latitude && $data.formData.address.longitude
  }, $data.formData.address.latitude && $data.formData.address.longitude ? {
    af: parseFloat($data.formData.address.latitude),
    ag: parseFloat($data.formData.address.longitude),
    ah: $options.mapMarkers,
    ai: common_vendor.o((...args) => $options.handleOpenLocation && $options.handleOpenLocation(...args))
  } : {}, {
    aj: !$options.canEdit ? 1 : "",
    ak: common_vendor.p({
      headTitle: "上课地址"
    }),
    al: common_vendor.t($data.isSubmitting ? "保存中..." : "保存信息"),
    am: !$options.canEdit || $data.isSubmitting,
    an: common_vendor.o((...args) => $options.submitForm && $options.submitForm(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-05030230"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/common/register.js.map
