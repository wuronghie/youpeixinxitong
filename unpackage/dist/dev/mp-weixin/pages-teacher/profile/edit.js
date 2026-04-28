"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_location = require("../../utils/location.js");
const utils_wxContentSecurity = require("../../utils/wxContentSecurity.js");
const card = () => "../../components/common/card.js";
const defaultAvatar = utils_imageConfig.getDefaultAvatarUrl();
const _sfc_main = {
  name: "TeacherProfileEdit",
  components: {
    card
  },
  data() {
    return {
      formData: {
        avatar: "",
        avatarFileId: "",
        name: "",
        gender: "",
        // 性别（必填）：male / female
        contact_mobile: "",
        // 联系手机号（必填），供家长/后台联系
        introduction: "",
        subjects: [],
        grades: [],
        hourly_rate: 0,
        experience_years: 0,
        school: "",
        // 所在院校
        experience: "",
        // 教师资历
        tags: [],
        // 附加标签
        education: { degree: "", school: "", major: "", graduation_year: null },
        teaching_areas: [{ latitude: "", longitude: "", name: "" }],
        qualifications: []
      },
      errors: {},
      // 错误信息
      scrollIntoView: "",
      // 滚动定位
      subjectOptions: [
        { label: "语文", value: "语文" },
        { label: "数学", value: "数学" },
        { label: "英语", value: "英语" },
        { label: "物理", value: "物理" },
        { label: "化学", value: "化学" },
        { label: "生物", value: "生物" },
        { label: "历史", value: "历史" },
        { label: "地理", value: "地理" },
        { label: "政治", value: "政治" },
        { label: "其他", value: "其他" }
      ],
      gradeOptions: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"],
      degreeOptions: ["高中", "大专", "本科", "本科在读", "硕士", "硕士研究生在读", "博士", "博士研究生在读"],
      // 所在院校选项
      schoolOptions: [
        { label: "四川大学", value: "四川大学" },
        { label: "电子科技大学", value: "电子科技大学" },
        { label: "西南交通大学", value: "西南交通大学" },
        { label: "四川农业大学", value: "四川农业大学" },
        { label: "西南财经大学", value: "西南财经大学" },
        { label: "其他985/211", value: "其他985/211" },
        { label: "专职老师", value: "专职老师" }
      ],
      // 教师资历选项
      experienceOptions: [
        { label: "大一（高考刚结束）", value: "大一（高考刚结束）" },
        { label: "大二至大四（1年以内）", value: "大二至大四（1年以内）" },
        { label: "大二至大四（1-2年）", value: "大二至大四（1-2年）" },
        { label: "大二至大四（2年以上）", value: "大二至大四（2年以上）" },
        { label: "专职老师（1-3年）", value: "专职老师（1-3年）" },
        { label: "专职老师（3-5年）", value: "专职老师（3-5年）" },
        { label: "专职老师（5年以上）", value: "专职老师（5年以上）" }
      ],
      // 附加标签选项
      tagOptions: [
        { label: "有试课视频", value: "有试课视频" },
        { label: "家长好评50+", value: "家长好评50+" },
        { label: "可上门辅导", value: "可上门辅导" },
        { label: "擅长提分（中高考）", value: "擅长提分（中高考）" },
        { label: "耐心教基础薄弱生", value: "耐心教基础薄弱生" }
      ],
      verificationLinks: [
        { title: "学籍查询", url: "https://my.chsi.com.cn/archive/index.action" },
        { title: "学历查询", url: "https://www.chsi.com.cn/xlcx/index.jsp" },
        { title: "教师资格证查询", url: "https://sso1.jszg.edu.cn/sso/websitelogin.html" }
      ],
      useMock: false,
      saving: false,
      defaultAvatar,
      avatarUploading: false,
      qualificationUploading: false,
      adminWechat: "chen18148503231"
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.loadProfile();
  },
  methods: {
    async loadProfile() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const teacher = utils_mockData.mockTeachers[0];
          const schoolValue = teacher.school || ((_a = teacher.education) == null ? void 0 : _a.school) || "";
          const defaultAvatarData = this.resolveAvatarData(teacher.avatar || "", {});
          this.formData = {
            avatar: defaultAvatarData.avatar,
            avatarFileId: defaultAvatarData.avatarFileId,
            name: teacher.display_name || teacher.name || "",
            gender: teacher.gender || "",
            contact_mobile: teacher.contact_mobile || "",
            introduction: teacher.introduction || "",
            subjects: teacher.subjects || [],
            grades: teacher.grades || [],
            hourly_rate: teacher.hourly_rate || 0,
            experience_years: teacher.experience_years || 0,
            school: schoolValue,
            experience: teacher.experience || "",
            tags: Array.isArray(teacher.tags) ? teacher.tags : [],
            education: {
              degree: ((_b = teacher.education) == null ? void 0 : _b.degree) || "",
              school: "",
              // 不再使用 education.school，统一使用 school 字段
              major: ((_c = teacher.education) == null ? void 0 : _c.major) || "",
              graduation_year: ((_d = teacher.education) == null ? void 0 : _d.graduation_year) || null
            },
            teaching_areas: teacher.teaching_areas && teacher.teaching_areas.length ? this.normalizeTeachingAreas(teacher.teaching_areas) : [{ latitude: "", longitude: "", name: "" }],
            qualifications: teacher.qualifications || []
          };
          return;
        }
        const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
        if (!userInfo.uid || userInfo.role !== "teacher") {
          common_vendor.index.showToast({ title: "请先以教师身份登录", icon: "none" });
          return;
        }
        common_vendor.index.__f__("log", "at pages-teacher/profile/edit.vue:456", "[编辑页面] 开始加载教师资料...");
        const teacherProfile = common_vendor.tr.importObject("teacher-profile", { customUI: true });
        const res = await teacherProfile.getProfile();
        common_vendor.index.__f__("log", "at pages-teacher/profile/edit.vue:461", "[编辑页面] 获取资料结果:", {
          code: res.code,
          hasData: !!res.data
        });
        if (res.code === 0 && res.data) {
          const p = res.data;
          const missingFields = [];
          const missingFieldsText = [];
          if (!p.display_name || p.display_name.trim() === "") {
            missingFields.push("display_name");
            missingFieldsText.push("姓名");
          }
          if (!p.subjects || !Array.isArray(p.subjects) || p.subjects.length === 0) {
            missingFields.push("subjects");
            missingFieldsText.push("教学科目");
          }
          if (!p.grades || !Array.isArray(p.grades) || p.grades.length === 0) {
            missingFields.push("grades");
            missingFieldsText.push("适合年级");
          }
          if (!p.hourly_rate || Number(p.hourly_rate) <= 0) {
            missingFields.push("hourly_rate");
            missingFieldsText.push("课时费");
          }
          if (!((_e = p.teaching_experience) == null ? void 0 : _e.years) || Number(p.teaching_experience.years) <= 0) {
            missingFields.push("experience_years");
            missingFieldsText.push("教龄");
          }
          if (!p.introduction || !String(p.introduction).trim()) {
            missingFields.push("introduction");
            missingFieldsText.push("自我介绍");
          }
          const qualificationHasImage = Array.isArray(p.qualifications) && p.qualifications.some((item) => item && item.image);
          if (!qualificationHasImage) {
            missingFields.push("qualifications");
            missingFieldsText.push("资质证书截图");
          }
          if (missingFields.length > 0) {
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:504", "========================================");
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:505", "[编辑页面] ⚠️ 检测到缺失的必填字段");
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:506", "缺失的字段:", missingFieldsText.join("、"));
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:507", "当前值:");
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:508", "  - 姓名:", p.display_name || "未设置");
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:509", "  - 教学科目:", Array.isArray(p.subjects) ? `[${p.subjects.join(", ")}]` : "未设置");
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:510", "  - 适合年级:", Array.isArray(p.grades) ? `[${p.grades.join(", ")}]` : "未设置");
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:511", "  - 课时费:", p.hourly_rate || "0");
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:512", "请填写以上必填字段后保存");
            common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:513", "========================================");
          } else {
            common_vendor.index.__f__("log", "at pages-teacher/profile/edit.vue:515", "[编辑页面] ✓ 所有必填字段已填写");
          }
          const resolvedAvatar = this.resolveAvatarData(p.avatar || "", userInfo);
          let avatarUrl = resolvedAvatar.avatar;
          const avatarFileId = resolvedAvatar.avatarFileId;
          if (avatarFileId && !avatarFileId.startsWith("http")) {
            avatarUrl = await this.getTempFileURL(avatarFileId);
          }
          const schoolValue = p.school || ((_f = p.education) == null ? void 0 : _f.school) || "";
          this.formData = {
            avatar: avatarUrl,
            avatarFileId,
            name: p.display_name || p.name || "",
            gender: p.gender || "",
            contact_mobile: p.contact_mobile || "",
            introduction: p.introduction || "",
            subjects: p.subjects || [],
            grades: p.grades || [],
            hourly_rate: p.hourly_rate || 0,
            experience_years: ((_g = p.teaching_experience) == null ? void 0 : _g.years) || 0,
            school: schoolValue,
            experience: p.experience || "",
            tags: Array.isArray(p.tags) ? p.tags : [],
            education: {
              degree: ((_h = p.education) == null ? void 0 : _h.degree) || "",
              school: "",
              // 不再使用 education.school，统一使用 school 字段
              major: ((_i = p.education) == null ? void 0 : _i.major) || "",
              graduation_year: ((_j = p.education) == null ? void 0 : _j.graduation_year) || null
            },
            teaching_areas: Array.isArray(p.teaching_areas) && p.teaching_areas.length ? this.normalizeTeachingAreas(p.teaching_areas) : [{ latitude: "", longitude: "", name: "" }],
            qualifications: await this.processQualifications(p.qualifications || [])
          };
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/profile/edit.vue:554", "加载教师资料失败:", error);
      }
    },
    resolveAvatarData(profileAvatar, userInfo = {}) {
      const wxAvatar = userInfo.avatar || userInfo.wx_avatarUrl || "";
      if (profileAvatar) {
        return {
          avatar: profileAvatar,
          avatarFileId: profileAvatar
        };
      }
      if (wxAvatar) {
        return {
          avatar: wxAvatar,
          avatarFileId: ""
        };
      }
      return {
        avatar: "",
        avatarFileId: ""
      };
    },
    chooseAvatar() {
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        success: async (res) => {
          var _a;
          const localPath = (_a = res.tempFilePaths) == null ? void 0 : _a[0];
          if (!localPath)
            return;
          if (this.useMock) {
            this.formData.avatar = localPath;
            this.formData.avatarFileId = localPath;
            return;
          }
          await this.uploadAvatar(localPath);
        }
      });
    },
    async uploadAvatar(localPath) {
      if (this.avatarUploading) {
        common_vendor.index.showToast({ title: "正在上传，请稍候", icon: "none" });
        return;
      }
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
        const cloudPath = `teacher-avatar/${Date.now()}-${Math.floor(Math.random() * 1e5)}${ext}`;
        const uploadRes = await common_vendor.tr.uploadFile({
          filePath: localPath,
          cloudPath
        });
        if (uploadRes && uploadRes.fileID) {
          const tempUrl = await this.getTempFileURL(uploadRes.fileID);
          this.formData.avatar = tempUrl;
          this.formData.avatarFileId = uploadRes.fileID;
          common_vendor.index.showToast({ title: "头像已更新", icon: "success" });
        } else {
          common_vendor.index.showToast({ title: "上传失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/profile/edit.vue:621", "上传头像失败:", error);
        common_vendor.index.showToast({ title: "上传失败", icon: "none" });
      } finally {
        this.avatarUploading = false;
      }
    },
    async getTempFileURL(fileId) {
      if (!fileId) {
        return "";
      }
      try {
        const res = await common_vendor.tr.getTempFileURL({
          fileList: [fileId]
        });
        const file = res.fileList && res.fileList[0];
        if (file && file.tempFileURL) {
          return file.tempFileURL;
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/profile/edit.vue:640", "获取头像临时链接失败:", error);
      }
      return fileId;
    },
    selectGender(gender) {
      if (gender !== "male" && gender !== "female")
        return;
      this.formData.gender = gender;
      this.clearError("gender");
    },
    toggleSubject(subject) {
      const idx = this.formData.subjects.indexOf(subject);
      if (idx > -1) {
        this.formData.subjects.splice(idx, 1);
      } else {
        this.formData.subjects.push(subject);
      }
      this.clearError("subjects");
    },
    toggleGrade(grade) {
      const idx = this.formData.grades.indexOf(grade);
      if (idx > -1) {
        this.formData.grades.splice(idx, 1);
      } else {
        this.formData.grades.push(grade);
      }
      this.clearError("grades");
    },
    onDegreeChange(event) {
      const idx = Number(event.detail.value);
      this.formData.education.degree = this.degreeOptions[idx];
    },
    onSchoolChange(event) {
      var _a;
      const idx = Number(event.detail.value);
      this.formData.school = ((_a = this.schoolOptions[idx]) == null ? void 0 : _a.value) || "";
      this.clearError("school");
    },
    onExperienceChange(event) {
      var _a;
      const idx = Number(event.detail.value);
      this.formData.experience = ((_a = this.experienceOptions[idx]) == null ? void 0 : _a.value) || "";
      this.clearError("experience");
    },
    toggleTag(tagValue) {
      const index = this.formData.tags.indexOf(tagValue);
      if (index > -1) {
        this.formData.tags.splice(index, 1);
      } else {
        this.formData.tags.push(tagValue);
      }
    },
    getSchoolLabel(value) {
      const option = this.schoolOptions.find((opt) => opt.value === value);
      return option ? option.label : "";
    },
    getExperienceLabel(value) {
      const option = this.experienceOptions.find((opt) => opt.value === value);
      return option ? option.label : "";
    },
    addTeachingArea() {
      this.formData.teaching_areas.push({ latitude: "", longitude: "", name: "" });
    },
    removeTeachingArea(index) {
      this.formData.teaching_areas.splice(index, 1);
      if (!this.formData.teaching_areas.length) {
        this.formData.teaching_areas.push({ latitude: "", longitude: "", name: "" });
      }
    },
    /**
     * 获取地区显示文本
     */
    getAreaDisplay(area) {
      return area.name || "";
    },
    /**
     * 获取地区地图标记点
     */
    getAreaMarkers(area, index) {
      if (!area.latitude || !area.longitude) {
        return [];
      }
      return [{
        id: index + 1,
        latitude: parseFloat(area.latitude),
        longitude: parseFloat(area.longitude),
        width: 30,
        height: 30,
        title: area.name || "教学地址",
        callout: {
          content: area.name || "教学地址",
          color: "#333",
          fontSize: 14,
          borderRadius: 4,
          bgColor: "#fff",
          padding: 8,
          display: "ALWAYS"
        }
      }];
    },
    /**
     * 选择教学地址
     */
    async handleChooseLocation(index) {
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
        const area = this.formData.teaching_areas[index];
        if (area && area.latitude && area.longitude) {
          initialLat = parseFloat(area.latitude);
          initialLon = parseFloat(area.longitude);
        }
        const location = await utils_location.chooseLocation({
          latitude: initialLat,
          longitude: initialLon
        });
        this.formData.teaching_areas[index] = {
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          name: location.name || location.address || ""
        };
        common_vendor.index.showToast({
          title: "选择成功",
          icon: "success"
        });
      } catch (error) {
        if (error.message && !error.message.includes("取消")) {
          common_vendor.index.__f__("error", "at pages-teacher/profile/edit.vue:778", "选择位置失败:", error);
          common_vendor.index.showToast({
            title: error.message || "选择失败",
            icon: "none"
          });
        }
      }
    },
    /**
     * 打开地图查看教学地址
     */
    handleOpenAreaLocation(index) {
      const area = this.formData.teaching_areas[index];
      if (!area || !area.latitude || !area.longitude) {
        common_vendor.index.showToast({
          title: "位置信息不完整",
          icon: "none"
        });
        return;
      }
      utils_location.openLocation({
        latitude: parseFloat(area.latitude),
        longitude: parseFloat(area.longitude),
        name: area.name || "教学地址",
        address: area.name || "教学地址"
      });
    },
    /**
     * 规范化教学地区数据格式（兼容旧数据）
     */
    normalizeTeachingAreas(areas) {
      if (!Array.isArray(areas)) {
        return [{ latitude: "", longitude: "", name: "" }];
      }
      return areas.map((area) => {
        if (area.latitude && area.longitude) {
          return {
            latitude: area.latitude.toString(),
            longitude: area.longitude.toString(),
            name: area.name || ""
          };
        }
        if (area.province || area.city || area.district || area.address) {
          const parts = [];
          if (area.province)
            parts.push(area.province);
          if (area.city)
            parts.push(area.city);
          if (area.district)
            parts.push(area.district);
          if (area.address)
            parts.push(area.address);
          return {
            latitude: "",
            longitude: "",
            name: parts.join(" ")
          };
        }
        return { latitude: "", longitude: "", name: "" };
      });
    },
    async processQualifications(qualifications) {
      if (!Array.isArray(qualifications) || qualifications.length === 0) {
        return [];
      }
      const processed = [];
      for (const q of qualifications) {
        const processedQ = { ...q };
        if (q.image) {
          if (!q.image.startsWith("http")) {
            try {
              const tempUrl = await this.getTempFileURL(q.image);
              processedQ.image = tempUrl;
              processedQ.image_fileId = q.image;
            } catch (e) {
              common_vendor.index.__f__("error", "at pages-teacher/profile/edit.vue:857", "获取证书图片URL失败:", e);
              processedQ.image = q.image;
              processedQ.image_fileId = q.image;
            }
          } else {
            processedQ.image_fileId = q.image;
          }
        }
        processed.push(processedQ);
      }
      return processed;
    },
    addQualification() {
      this.formData.qualifications.push({ name: "", number: "", image: "", image_fileId: "" });
      this.clearError("qualifications");
    },
    removeQualification(index) {
      this.formData.qualifications.splice(index, 1);
      this.clearError("qualifications");
    },
    openVerificationLink(link) {
      if (!link || !link.url)
        return;
      common_vendor.index.showModal({
        title: link.title || "官方查询",
        content: "该官方页面在小程序发布版中可能无法直接打开。点击“复制链接”后，请粘贴到手机浏览器中打开，查询完成后再返回上传截图。",
        confirmText: "复制链接",
        cancelText: "取消",
        success: (res) => {
          if (!res.confirm)
            return;
          common_vendor.index.setClipboardData({
            data: link.url,
            success: () => {
              common_vendor.index.showToast({
                title: "链接已复制",
                icon: "success"
              });
            }
          });
        }
      });
    },
    copyAdminWechat() {
      common_vendor.index.setClipboardData({
        data: this.adminWechat,
        success: () => {
          common_vendor.index.showToast({
            title: "微信号已复制",
            icon: "success"
          });
        }
      });
    },
    uploadQualificationImage(index) {
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        success: async (res) => {
          var _a;
          const localPath = (_a = res.tempFilePaths) == null ? void 0 : _a[0];
          if (!localPath)
            return;
          if (this.useMock) {
            try {
              await utils_wxContentSecurity.wxCheckLocalImageBeforeUpload(localPath);
            } catch (secErr) {
              common_vendor.index.showToast({ title: secErr && secErr.message || "图片未通过安全检测", icon: "none" });
              return;
            }
            this.formData.qualifications[index].image = localPath;
            this.formData.qualifications[index].image_fileId = localPath;
            this.clearError("qualifications");
            return;
          }
          await this.uploadQualificationImageFile(localPath, index);
        }
      });
    },
    async uploadQualificationImageFile(localPath, index) {
      if (this.qualificationUploading) {
        common_vendor.index.showToast({ title: "正在上传，请稍候", icon: "none" });
        return;
      }
      try {
        this.qualificationUploading = true;
        try {
          await utils_wxContentSecurity.wxCheckLocalImageBeforeUpload(localPath);
        } catch (secErr) {
          common_vendor.index.showToast({ title: secErr && secErr.message || "图片未通过安全检测", icon: "none" });
          return;
        }
        const extIndex = localPath.lastIndexOf(".");
        const ext = extIndex > -1 ? localPath.substring(extIndex) : "";
        const cloudPath = `teacher-cert/${Date.now()}-${Math.floor(Math.random() * 1e5)}${ext}`;
        const uploadRes = await common_vendor.tr.uploadFile({
          filePath: localPath,
          cloudPath
        });
        if (uploadRes && uploadRes.fileID) {
          const tempUrl = await this.getTempFileURL(uploadRes.fileID);
          this.formData.qualifications[index].image = tempUrl;
          this.formData.qualifications[index].image_fileId = uploadRes.fileID;
          this.clearError("qualifications");
          common_vendor.index.showToast({ title: "上传成功", icon: "success" });
        } else {
          common_vendor.index.showToast({ title: "上传失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/profile/edit.vue:962", "上传证书图片失败:", error);
        common_vendor.index.showToast({ title: "上传失败", icon: "none" });
      } finally {
        this.qualificationUploading = false;
      }
    },
    removeQualificationImage(index) {
      this.formData.qualifications[index].image = "";
      this.formData.qualifications[index].image_fileId = "";
      this.clearError("qualifications");
    },
    hasQualificationImage() {
      return Array.isArray(this.formData.qualifications) && this.formData.qualifications.some((q) => q && (q.image || q.image_fileId));
    },
    clearError(field) {
      if (this.errors[field]) {
        this.$delete(this.errors, field);
      }
    },
    scrollToError(fieldId) {
      this.scrollIntoView = "";
      this.$nextTick(() => {
        this.scrollIntoView = fieldId;
      });
    },
    validateForm() {
      this.errors = {};
      let isValid = true;
      let firstErrorField = "";
      const missingFields = [];
      if (!this.formData.avatar || !String(this.formData.avatar).trim()) {
        this.errors.avatar = "请上传本人证件照或自拍照";
        missingFields.push("本人头像");
        if (!firstErrorField)
          firstErrorField = "field-avatar";
        isValid = false;
      }
      if (!this.formData.name || !this.formData.name.trim()) {
        this.errors.name = "请填写姓名";
        missingFields.push("姓名");
        if (!firstErrorField)
          firstErrorField = "field-name";
        isValid = false;
      }
      if (this.formData.gender !== "male" && this.formData.gender !== "female") {
        this.errors.gender = "请选择性别";
        missingFields.push("性别");
        if (!firstErrorField)
          firstErrorField = "field-gender";
        isValid = false;
      }
      const mobileReg = /^1[3-9]\d{9}$/;
      const mobileVal = this.formData.contact_mobile ? String(this.formData.contact_mobile).trim() : "";
      if (!mobileVal) {
        this.errors.contact_mobile = "请填写联系手机号";
        missingFields.push("联系手机号");
        if (!firstErrorField)
          firstErrorField = "field-contact-mobile";
        isValid = false;
      } else if (!mobileReg.test(mobileVal)) {
        this.errors.contact_mobile = "手机号格式不正确";
        missingFields.push("手机号格式不正确");
        if (!firstErrorField)
          firstErrorField = "field-contact-mobile";
        isValid = false;
      }
      if (!this.formData.subjects || this.formData.subjects.length === 0) {
        this.errors.subjects = "请选择至少一个教学科目";
        missingFields.push("教学科目");
        if (!firstErrorField)
          firstErrorField = "field-subjects";
        isValid = false;
      }
      if (!this.formData.grades || this.formData.grades.length === 0) {
        this.errors.grades = "请选择至少一个适合年级";
        missingFields.push("适合年级");
        if (!firstErrorField)
          firstErrorField = "field-grades";
        isValid = false;
      }
      if (!this.formData.hourly_rate || this.formData.hourly_rate <= 0) {
        this.errors.hourly_rate = "请填写正确的课时费";
        missingFields.push("课时费");
        if (!firstErrorField)
          firstErrorField = "field-hourly_rate";
        isValid = false;
      }
      if (!this.formData.experience_years || Number(this.formData.experience_years) <= 0) {
        this.errors.experience_years = "请填写教龄";
        missingFields.push("教龄");
        if (!firstErrorField)
          firstErrorField = "field-experience-years";
        isValid = false;
      }
      if (!this.formData.introduction || !this.formData.introduction.trim()) {
        this.errors.introduction = "请填写自我介绍";
        missingFields.push("自我介绍");
        if (!firstErrorField)
          firstErrorField = "field-introduction";
        isValid = false;
      }
      if (!this.hasQualificationImage()) {
        this.errors.qualifications = "请至少上传 1 张资质证书截图";
        missingFields.push("资质证书截图");
        if (!firstErrorField)
          firstErrorField = "field-qualifications";
        isValid = false;
      }
      if (!isValid) {
        common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:1081", "========================================");
        common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:1082", "[表单验证] ❌ 验证失败，以下字段未填写:");
        missingFields.forEach((field, index) => {
          common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:1084", `  ${index + 1}. ${field}`);
        });
        common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:1086", "当前表单值:");
        common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:1087", "  - 姓名:", this.formData.name || "未填写");
        common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:1088", "  - 教学科目:", this.formData.subjects.length > 0 ? `[${this.formData.subjects.join(", ")}]` : "未选择");
        common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:1089", "  - 适合年级:", this.formData.grades.length > 0 ? `[${this.formData.grades.join(", ")}]` : "未选择");
        common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:1090", "  - 课时费:", this.formData.hourly_rate || "0");
        common_vendor.index.__f__("warn", "at pages-teacher/profile/edit.vue:1091", "========================================");
        if (firstErrorField) {
          this.scrollToError(firstErrorField);
        }
        const errorMessages = Object.values(this.errors);
        if (errorMessages.length > 0) {
          common_vendor.index.showToast({
            title: errorMessages[0],
            icon: "none",
            duration: 2e3
          });
        }
      } else {
        common_vendor.index.__f__("log", "at pages-teacher/profile/edit.vue:1106", "[表单验证] ✓ 所有必填字段验证通过");
      }
      return isValid;
    },
    async saveProfile() {
      if (this.saving)
        return;
      if (!this.validateForm())
        return;
      try {
        if (this.useMock) {
          common_vendor.index.showToast({ title: "保存成功 (模拟)", icon: "success" });
          return;
        }
        const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
        if (!userInfo.uid) {
          common_vendor.index.showToast({ title: "请先登录", icon: "none" });
          return;
        }
        this.saving = true;
        const teacherProfile = common_vendor.tr.importObject("teacher-profile", { customUI: true });
        const res = await teacherProfile.submitProfile({
          avatar: this.formData.avatarFileId || this.formData.avatar,
          display_name: this.formData.name,
          gender: this.formData.gender,
          contact_mobile: String(this.formData.contact_mobile || "").trim(),
          subjects: this.formData.subjects,
          grades: this.formData.grades,
          hourly_rate: Number(this.formData.hourly_rate) || 0,
          introduction: this.formData.introduction,
          school: this.formData.school,
          experience: this.formData.experience,
          tags: this.formData.tags,
          teaching_experience: {
            years: Number(this.formData.experience_years) || 0,
            description: ""
          },
          education: this.formData.education,
          qualifications: this.formData.qualifications.map((q) => ({
            name: q.name || "",
            number: q.number || "",
            image: q.image_fileId || q.image || ""
          })),
          teaching_areas: this.formData.teaching_areas
        });
        if (res.code === 0) {
          const updatedUserInfo = {
            ...userInfo,
            avatar: this.formData.avatarFileId || userInfo.avatar || ""
          };
          common_vendor.index.setStorageSync("userInfo", updatedUserInfo);
          if (res.data && res.data.status === "no_change") {
            common_vendor.index.showToast({ title: "资料未修改", icon: "success" });
          } else {
            common_vendor.index.showToast({
              title: "资料保存成功",
              icon: "success",
              duration: 2e3
            });
          }
          setTimeout(() => {
            common_vendor.index.$emit("teacher-profile-updated");
            const pages = getCurrentPages();
            if (pages && pages.length > 1) {
              common_vendor.index.navigateBack({
                delta: 1,
                fail: () => {
                  common_vendor.index.reLaunch({ url: "/pages-teacher/index/index" });
                }
              });
            } else {
              common_vendor.index.reLaunch({ url: "/pages-teacher/index/index" });
            }
          }, 1500);
        } else {
          common_vendor.index.showToast({ title: res.message || "保存失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/profile/edit.vue:1192", "保存教师资料失败:", error);
        common_vendor.index.showToast({ title: "保存失败，请稍后重试", icon: "none" });
      } finally {
        this.saving = false;
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
    a: $data.formData.avatar || $data.defaultAvatar,
    b: common_vendor.t($data.avatarUploading ? "上传中..." : $data.formData.avatar ? "点击更换头像" : "点击上传头像"),
    c: $data.errors.avatar
  }, $data.errors.avatar ? {
    d: common_vendor.t($data.errors.avatar)
  } : {}, {
    e: $data.errors.avatar ? 1 : "",
    f: common_vendor.o((...args) => $options.chooseAvatar && $options.chooseAvatar(...args)),
    g: $data.errors.name ? 1 : "",
    h: common_vendor.o([common_vendor.m(($event) => $data.formData.name = $event.detail.value, {
      trim: true
    }), ($event) => $options.clearError("name")]),
    i: $data.formData.name,
    j: $data.errors.name ? 1 : "",
    k: common_vendor.n($data.formData.gender === "male" ? "gender-selected male" : "gender-default"),
    l: common_vendor.o(($event) => $options.selectGender("male")),
    m: common_vendor.n($data.formData.gender === "female" ? "gender-selected female" : "gender-default"),
    n: common_vendor.o(($event) => $options.selectGender("female")),
    o: $data.errors.gender ? 1 : "",
    p: $data.errors.gender
  }, $data.errors.gender ? {
    q: common_vendor.t($data.errors.gender)
  } : {}, {
    r: $data.errors.contact_mobile ? 1 : "",
    s: common_vendor.o([($event) => $data.formData.contact_mobile = $event.detail.value, ($event) => $options.clearError("contact_mobile")]),
    t: $data.formData.contact_mobile,
    v: $data.errors.contact_mobile ? 1 : "",
    w: $data.errors.contact_mobile
  }, $data.errors.contact_mobile ? {
    x: common_vendor.t($data.errors.contact_mobile)
  } : {}, {
    y: $data.errors.name || $data.errors.avatar || $data.errors.gender || $data.errors.contact_mobile ? 1 : "",
    z: common_vendor.f($data.subjectOptions, (subject, k0, i0) => {
      return {
        a: common_vendor.t(subject.label),
        b: subject.value,
        c: common_vendor.n($data.formData.subjects.includes(subject.value) ? "tag-selected" : "tag-default"),
        d: common_vendor.o(($event) => $options.toggleSubject(subject.value), subject.value)
      };
    }),
    A: $data.errors.subjects
  }, $data.errors.subjects ? {
    B: common_vendor.t($data.errors.subjects)
  } : {}, {
    C: $data.errors.subjects ? 1 : "",
    D: common_vendor.f($data.gradeOptions, (grade, k0, i0) => {
      return {
        a: common_vendor.t(grade),
        b: grade,
        c: common_vendor.n($data.formData.grades.includes(grade) ? "tag-selected" : "tag-default"),
        d: common_vendor.o(($event) => $options.toggleGrade(grade), grade)
      };
    }),
    E: $data.errors.grades
  }, $data.errors.grades ? {
    F: common_vendor.t($data.errors.grades)
  } : {}, {
    G: $data.errors.grades ? 1 : "",
    H: $data.errors.hourly_rate ? 1 : "",
    I: common_vendor.o([common_vendor.m(($event) => $data.formData.hourly_rate = $event.detail.value, {
      number: true
    }), ($event) => $options.clearError("hourly_rate")]),
    J: $data.formData.hourly_rate,
    K: $data.errors.hourly_rate ? 1 : "",
    L: $data.errors.hourly_rate
  }, $data.errors.hourly_rate ? {
    M: common_vendor.t($data.errors.hourly_rate)
  } : {}, {
    N: $data.errors.experience_years ? 1 : "",
    O: common_vendor.o([common_vendor.m(($event) => $data.formData.experience_years = $event.detail.value, {
      number: true
    }), ($event) => $options.clearError("experience_years")]),
    P: $data.formData.experience_years,
    Q: $data.errors.experience_years ? 1 : "",
    R: $data.errors.experience_years
  }, $data.errors.experience_years ? {
    S: common_vendor.t($data.errors.experience_years)
  } : {}, {
    T: $data.errors.subjects || $data.errors.grades || $data.errors.hourly_rate || $data.errors.experience_years ? 1 : "",
    U: common_vendor.p({
      headTitle: "教学信息"
    }),
    V: $data.errors.introduction ? 1 : "",
    W: common_vendor.o([common_vendor.m(($event) => $data.formData.introduction = $event.detail.value, {
      trim: true
    }), ($event) => $options.clearError("introduction")]),
    X: $data.formData.introduction,
    Y: $data.errors.introduction
  }, $data.errors.introduction ? {
    Z: common_vendor.t($data.errors.introduction)
  } : {}, {
    aa: $data.errors.introduction ? 1 : "",
    ab: common_vendor.t($options.getSchoolLabel($data.formData.school) || "请选择所在院校（可选）"),
    ac: common_vendor.n($data.formData.school ? "" : "text-light-muted"),
    ad: $data.schoolOptions,
    ae: common_vendor.o((...args) => $options.onSchoolChange && $options.onSchoolChange(...args)),
    af: common_vendor.t($options.getExperienceLabel($data.formData.experience) || "请选择教师资历（可选）"),
    ag: common_vendor.n($data.formData.experience ? "" : "text-light-muted"),
    ah: $data.experienceOptions,
    ai: common_vendor.o((...args) => $options.onExperienceChange && $options.onExperienceChange(...args)),
    aj: common_vendor.t($data.formData.education.degree || "请选择"),
    ak: common_vendor.n($data.formData.education.degree ? "" : "text-light-muted"),
    al: $data.degreeOptions,
    am: common_vendor.o((...args) => $options.onDegreeChange && $options.onDegreeChange(...args)),
    an: $data.formData.education.major,
    ao: common_vendor.o(common_vendor.m(($event) => $data.formData.education.major = $event.detail.value, {
      trim: true
    })),
    ap: $data.formData.education.graduation_year,
    aq: common_vendor.o(common_vendor.m(($event) => $data.formData.education.graduation_year = $event.detail.value, {
      number: true
    })),
    ar: common_vendor.p({
      headTitle: "教育背景"
    }),
    as: common_vendor.f($data.tagOptions, (tag, k0, i0) => {
      return {
        a: common_vendor.t(tag.label),
        b: tag.value,
        c: common_vendor.n($data.formData.tags.includes(tag.value) ? "tag-selected" : "tag-default"),
        d: common_vendor.o(($event) => $options.toggleTag(tag.value), tag.value)
      };
    }),
    at: common_vendor.p({
      headTitle: "附加标签"
    }),
    av: common_vendor.o((...args) => $options.addTeachingArea && $options.addTeachingArea(...args)),
    aw: $data.formData.teaching_areas.length
  }, $data.formData.teaching_areas.length ? {
    ax: common_vendor.f($data.formData.teaching_areas, (area, index, i0) => {
      return common_vendor.e({
        a: common_vendor.t($options.getAreaDisplay(area) || "点击选择地址"),
        b: common_vendor.o(($event) => $options.handleChooseLocation(index), index),
        c: area.latitude && area.longitude
      }, area.latitude && area.longitude ? {
        d: parseFloat(area.latitude),
        e: parseFloat(area.longitude),
        f: $options.getAreaMarkers(area, index),
        g: common_vendor.o(($event) => $options.handleOpenAreaLocation(index), index)
      } : {}, $data.formData.teaching_areas.length > 1 ? {
        h: common_vendor.o(($event) => $options.removeTeachingArea(index), index)
      } : {}, {
        i: index
      });
    }),
    ay: $data.formData.teaching_areas.length > 1
  } : {}, {
    az: common_vendor.p({
      headTitle: "教学地区"
    }),
    aA: common_vendor.o((...args) => $options.addQualification && $options.addQualification(...args)),
    aB: common_vendor.f($data.verificationLinks, (link, k0, i0) => {
      return {
        a: common_vendor.t(link.title),
        b: link.url,
        c: common_vendor.o(($event) => $options.openVerificationLink(link), link.url)
      };
    }),
    aC: $data.formData.qualifications.length
  }, $data.formData.qualifications.length ? {
    aD: common_vendor.f($data.formData.qualifications, (q, index, i0) => {
      return common_vendor.e({
        a: q.name,
        b: common_vendor.o(common_vendor.m(($event) => q.name = $event.detail.value, {
          trim: true
        }), index),
        c: q.number,
        d: common_vendor.o(common_vendor.m(($event) => q.number = $event.detail.value, {
          trim: true
        }), index),
        e: q.image
      }, q.image ? {
        f: q.image
      } : {}, {
        g: q.image
      }, q.image ? {
        h: common_vendor.o(($event) => $options.removeQualificationImage(index), index)
      } : {}, {
        i: common_vendor.o(($event) => $options.uploadQualificationImage(index), index),
        j: common_vendor.o(($event) => $options.removeQualification(index), index),
        k: index
      });
    })
  } : {}, {
    aE: $data.errors.qualifications
  }, $data.errors.qualifications ? {
    aF: common_vendor.t($data.errors.qualifications)
  } : {}, {
    aG: $data.errors.qualifications ? 1 : "",
    aH: common_vendor.t($data.adminWechat),
    aI: common_vendor.o((...args) => $options.copyAdminWechat && $options.copyAdminWechat(...args)),
    aJ: $data.scrollIntoView,
    aK: $data.saving,
    aL: common_vendor.o((...args) => $options.saveProfile && $options.saveProfile(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1a0f7470"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/profile/edit.js.map
