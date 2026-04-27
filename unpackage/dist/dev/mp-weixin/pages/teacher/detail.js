"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "TeacherDetail",
  components: {
    card
  },
  data() {
    return {
      teacherId: "",
      teacherUid: "",
      teacherInfo: {},
      isLoading: false,
      loadError: "",
      isRefreshing: false,
      scrollTop: 0,
      canRefresh: true,
      isFavorited: false,
      favoriteLoading: false,
      useMock: false,
      isContacting: false,
      hasContacted: false,
      // 是否已联系过老师
      hasTrialSuccess: false,
      // 是否已完成试课并成功
      userLocation: null,
      // 用户位置（用于距离）
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl(),
      // 收藏图标URL（从CDN）
      favoriteFilledUrl: utils_imageConfig.getIconUrl("favorite-filled.png"),
      favoriteEmptyUrl: utils_imageConfig.getIconUrl("favorite-empty.png")
    };
  },
  computed: {
    subjectList() {
      const list = this.teacherInfo.subjects || [];
      if (!Array.isArray(list))
        return [];
      return list.filter(Boolean);
    },
    gradeList() {
      const list = this.teacherInfo.grades || [];
      if (!Array.isArray(list))
        return [];
      return list.filter(Boolean);
    },
    gradeTotalCount() {
      return this.gradeList.length;
    },
    gradeGroups() {
      const primary = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"];
      const junior = ["初一", "初二", "初三"];
      const senior = ["高一", "高二", "高三"];
      const gradeSet = new Set(this.gradeList);
      const makeGroup = (key, label, order) => ({
        key,
        label,
        items: order.filter((item) => gradeSet.has(item))
      });
      const groups = [
        makeGroup("primary", "小学", primary),
        makeGroup("junior", "初中", junior),
        makeGroup("senior", "高中", senior)
      ].filter((group) => group.items.length > 0);
      const known = /* @__PURE__ */ new Set([...primary, ...junior, ...senior]);
      const other = this.gradeList.filter((item) => !known.has(item));
      if (other.length > 0) {
        groups.push({
          key: "other",
          label: "其他",
          items: other
        });
      }
      return groups;
    },
    recentReviews() {
      return this.teacherInfo.recent_reviews || [];
    },
    scheduleSummary() {
      var _a;
      const schedule = ((_a = this.teacherInfo.schedule) == null ? void 0 : _a.week_schedule) || [];
      return schedule.filter((day) => (day.slots || []).some((slot) => slot.is_available)).slice(0, 4).map((day) => {
        const times = (day.slots || []).filter((slot) => slot.is_available).map((slot) => `${slot.start_time}~${slot.end_time}`).join("、");
        return {
          day: day.name || day.day || "周",
          time: times || "全天"
        };
      });
    },
    canMakeAppointment() {
      return this.hasTrialSuccess;
    },
    teacherAddressText() {
      const areas = this.teacherInfo.teaching_areas || [];
      if (!areas.length)
        return "";
      const area = areas[0];
      if (area.name && String(area.name).trim())
        return String(area.name).trim();
      const parts = [area.province, area.city, area.district, area.address].filter(Boolean);
      return parts.join(" ") || "";
    },
    teacherDistanceText() {
      if (!this.userLocation || this.userLocation.lat == null || this.userLocation.lon == null)
        return "";
      const areas = this.teacherInfo.teaching_areas || [];
      const withCoord = areas.find((a) => a.latitude != null && a.longitude != null);
      if (!withCoord)
        return "";
      const km = this.haversineKm(
        this.userLocation.lat,
        this.userLocation.lon,
        parseFloat(withCoord.latitude),
        parseFloat(withCoord.longitude)
      );
      return km != null ? km.toFixed(1) : "";
    }
  },
  onLoad(options) {
    this.useMock = utils_mockData.useMockData() === true;
    this.teacherId = options.id || options.teacherProfileId || "";
    this.teacherUid = options.teacherUid || options.teacher_id || "";
    if (!this.teacherId && !this.teacherUid) {
      this.loadError = "未找到教师编号";
      common_vendor.index.showToast({ title: "教师ID不能为空", icon: "none" });
      setTimeout(() => common_vendor.index.navigateBack(), 1500);
      return;
    }
    setTimeout(() => {
      this.loadDetail();
      this.fetchUserLocation();
    }, 0);
  },
  onShareAppMessage() {
    const id = this.teacherId || this.teacherUid || "";
    const path = id ? `/pages/teacher/detail?id=${id}` : "/pages/index/index";
    return {
      title: this.teacherInfo.display_name || this.teacherInfo.name || "优质家教老师推荐",
      path
    };
  },
  onShareTimeline() {
    const id = this.teacherId || this.teacherUid || "";
    const query = id ? `id=${id}` : "";
    return {
      title: this.teacherInfo.display_name || this.teacherInfo.name || "优质家教老师推荐",
      query
    };
  },
  methods: {
    async onRefresh() {
      if (!this.canRefresh || this.scrollTop > 10) {
        this.isRefreshing = false;
        return;
      }
      if (this.isRefreshing)
        return;
      this.isRefreshing = true;
      await this.loadDetail();
      this.isRefreshing = false;
    },
    async loadDetail() {
      if (this.isLoading)
        return;
      this.isLoading = true;
      this.loadError = "";
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const teacher = utils_mockData.mockTeachers[0] || {};
          this.teacherInfo = teacher;
          this.teacherId = teacher._id || this.teacherId;
          this.teacherUid = teacher.teacher_id || this.teacherUid;
          this.isFavorited = true;
          return;
        }
        const teacherListObj = common_vendor.tr.importObject("teacher-list", { customUI: true });
        const result = await teacherListObj.getDetail({ teacherId: this.teacherId || this.teacherUid });
        if (result.code === 0) {
          this.teacherInfo = result.data;
          this.teacherId = result.data._id || this.teacherId;
          this.teacherUid = result.data.teacher_id || this.teacherUid;
          await this.fetchFavoriteStatus();
          await this.checkContactStatus();
        } else {
          throw new Error(result.message || "加载失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/teacher/detail.vue:617", "加载教师详情失败:", error);
        this.loadError = error.message || "加载失败，请稍后重试";
        common_vendor.index.showToast({ title: this.loadError, icon: "none" });
      } finally {
        this.isLoading = false;
      }
    },
    async handleContactTeacher() {
      var _a, _b, _c, _d, _e;
      if (this.isContacting || this.loadError)
        return;
      const stored = common_vendor.index.getStorageSync("userInfo") || {};
      if (!stored.uid) {
        common_vendor.index.showToast({ title: "请先登录", icon: "none" });
        setTimeout(() => {
          common_vendor.index.reLaunch({ url: "/pages/login/index" });
        }, 1500);
        return;
      }
      const parentInfo = stored.parent_info || {};
      if (!parentInfo.student_name || !parentInfo.student_grade) {
        common_vendor.index.showModal({
          title: "提示",
          content: "请先完善孩子信息（学生姓名和年级）才能联系老师",
          confirmText: "去完善",
          cancelText: "取消",
          success: (res) => {
            if (res.confirm) {
              common_vendor.index.navigateTo({ url: "/pages/common/register" });
            }
          }
        });
        return;
      }
      this.isContacting = true;
      try {
        const teacherId = this.teacherUid || this.teacherId;
        if (!teacherId) {
          throw new Error("教师信息不完整");
        }
        const contactParams = {
          teacher_id: teacherId,
          student_name: parentInfo.student_name || "",
          student_grade: parentInfo.student_grade || "",
          student_subjects: Array.isArray(parentInfo.student_subjects) ? parentInfo.student_subjects : [],
          learning_goal: parentInfo.learning_goal || "",
          extra_notes: parentInfo.extra_notes || "",
          address_detail: parentInfo.address_detail || ""
        };
        common_vendor.index.__f__("log", "at pages/teacher/detail.vue:670", "[teacher-detail] 联系请求参数:", contactParams);
        common_vendor.index.__f__("log", "at pages/teacher/detail.vue:671", "[teacher-detail] parentInfo:", parentInfo);
        const appointmentObj = common_vendor.tr.importObject("appointment-create", { customUI: true });
        const result = await appointmentObj.createContactRequest(contactParams);
        if (result.code === 0) {
          if ((_a = result.data) == null ? void 0 : _a.already_exists) {
            common_vendor.index.showToast({ title: result.message || "您已经发送过联系请求", icon: "none" });
          } else {
            common_vendor.index.showToast({ title: "已发送联系请求", icon: "success" });
          }
          const conversationId = ((_b = result.data) == null ? void 0 : _b.conversation_id) || "";
          const appointmentId = ((_c = result.data) == null ? void 0 : _c.appointment_id) || "";
          if (conversationId && !((_d = result.data) == null ? void 0 : _d.already_exists)) {
            try {
              const subjects = (contactParams.student_subjects || []).length > 0 ? contactParams.student_subjects.join("、") : "未指定";
              const grade = contactParams.student_grade || "未填写";
              const learningGoal = contactParams.learning_goal || "";
              const rawAddress = contactParams.address_detail || "";
              const safeAddress = this.maskAddress(rawAddress);
              const rawNotes = contactParams.extra_notes || "";
              const safeNotes = this.maskContactInfo(rawNotes);
              let messageContent = `您好，我想为孩子咨询课程。

`;
              messageContent += `学生姓名：${contactParams.student_name || "未填写"}
`;
              messageContent += `所在年级：${grade}
`;
              messageContent += `学习科目：${subjects}
`;
              messageContent += `所在地址：${safeAddress || "未填写"}
`;
              if (learningGoal) {
                messageContent += `学习目标：${learningGoal}
`;
              }
              messageContent += `备注：${safeNotes || "无"}
`;
              messageContent += `
希望了解您的教学安排，期待您的回复！`;
              common_vendor.index.__f__("log", "at pages/teacher/detail.vue:720", "[teacher-detail] 发送消息内容:", messageContent);
              const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
              await chatSend.send({
                conversation_id: conversationId,
                message_type: "text",
                content: messageContent
              });
            } catch (msgError) {
              common_vendor.index.__f__("warn", "at pages/teacher/detail.vue:729", "发送初始消息失败:", msgError);
            }
          }
          this.hasContacted = true;
          setTimeout(() => {
            if (conversationId) {
              const params = [`conversationId=${conversationId}`];
              if (appointmentId) {
                params.push(`appointmentId=${appointmentId}`);
              }
              common_vendor.index.navigateTo({
                url: `/pages/chat/conversation?${params.join("&")}`
              });
            } else if (appointmentId) {
              common_vendor.index.navigateTo({
                url: `/pages/chat/conversation?appointmentId=${appointmentId}`
              });
            } else {
              common_vendor.index.navigateTo({
                url: `/pages/chat/list`
              });
            }
          }, ((_e = result.data) == null ? void 0 : _e.already_exists) ? 1500 : 800);
        } else {
          throw new Error(result.message || "发送联系请求失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/teacher/detail.vue:760", "联系老师失败:", error);
        common_vendor.index.showToast({ title: error.message || "联系失败，请稍后再试", icon: "none" });
      } finally {
        this.isContacting = false;
      }
    },
    goToAppointment() {
      if (this.loadError)
        return;
      const params = [];
      if (this.teacherId)
        params.push(`teacherProfileId=${this.teacherId}`);
      if (this.teacherUid)
        params.push(`teacherUid=${this.teacherUid}`);
      common_vendor.index.navigateTo({ url: `/pages/appointment/create${params.length ? "?" + params.join("&") : ""}` });
    },
    goToReviews() {
      if (!this.teacherUid && !this.teacherId)
        return;
      common_vendor.index.navigateTo({ url: `/pages/review/create?teacherId=${this.teacherUid || this.teacherId}` });
    },
    async fetchFavoriteStatus() {
      try {
        if (this.useMock) {
          this.isFavorited = true;
          return;
        }
        const stored = common_vendor.index.getStorageSync("userInfo") || {};
        if (!stored.uid) {
          this.isFavorited = false;
          return;
        }
        const teacherId = this.teacherUid || this.teacherId;
        if (!teacherId) {
          this.isFavorited = false;
          return;
        }
        const favoriteObj = common_vendor.tr.importObject("teacher-favorite", { customUI: true });
        const res = await favoriteObj.checkFavorite({ teacher_id: teacherId });
        if (res.code === 0 && res.data) {
          this.isFavorited = !!res.data.favorited;
        } else {
          this.isFavorited = false;
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/teacher/detail.vue:801", "查询收藏状态失败:", error);
        this.isFavorited = false;
      }
    },
    async checkContactStatus() {
      try {
        if (this.useMock) {
          this.hasContacted = false;
          this.hasTrialSuccess = false;
          return;
        }
        const stored = common_vendor.index.getStorageSync("userInfo") || {};
        if (!stored.uid) {
          this.hasContacted = false;
          this.hasTrialSuccess = false;
          return;
        }
        const teacherId = this.teacherUid || this.teacherId;
        if (!teacherId) {
          this.hasContacted = false;
          this.hasTrialSuccess = false;
          return;
        }
        try {
          const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
          const conversationListRes = await chatSend.getConversationList();
          if (conversationListRes.code === 0 && conversationListRes.data) {
            const conversations = conversationListRes.data.list || conversationListRes.data || [];
            common_vendor.index.__f__("log", "at pages/teacher/detail.vue:835", "[teacher-detail] 会话列表数量:", conversations.length);
            const hasConversation = conversations.some((conv) => {
              var _a, _b;
              return conv.teacher_id === teacherId || ((_a = conv.other_user) == null ? void 0 : _a.teacher_id) === teacherId || ((_b = conv.teacher_info) == null ? void 0 : _b.teacher_id) === teacherId;
            });
            this.hasContacted = !!hasConversation;
            common_vendor.index.__f__("log", "at pages/teacher/detail.vue:845", "[teacher-detail] hasContacted 计算结果:", {
              teacherId,
              hasConversation
            });
          }
        } catch (chatError) {
          common_vendor.index.__f__("warn", "at pages/teacher/detail.vue:851", "检查会话列表失败:", chatError);
          this.hasContacted = false;
        }
        try {
          const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
          const appointmentListRes = await appointmentQuery.getParentAppointments({
            status: "all",
            page: 1,
            pageSize: 200
            // 查询足够多的记录，后续可根据需要调整
          });
          if (appointmentListRes.code === 0 && appointmentListRes.data) {
            const appointments = appointmentListRes.data.list || appointmentListRes.data || [];
            common_vendor.index.__f__("log", "at pages/teacher/detail.vue:868", "[teacher-detail] 家长预约总数:", appointments.length);
            const relatedAppointments = appointments.filter((apt) => apt.teacher_id === teacherId);
            common_vendor.index.__f__("log", "at pages/teacher/detail.vue:871", "[teacher-detail] 与当前老师相关的预约数:", relatedAppointments.length);
            const hasTrialSuccess = relatedAppointments.some((apt) => {
              const isTrialCourse = apt.course_type === "trial";
              const isCompletedStatus = apt.status === "completed";
              const isSuccessResult = !apt.trial_result || apt.trial_result === "success";
              return isTrialCourse && isCompletedStatus && isSuccessResult;
            });
            this.hasTrialSuccess = !!hasTrialSuccess;
            common_vendor.index.__f__("log", "at pages/teacher/detail.vue:885", "[teacher-detail] hasTrialSuccess 计算结果:", {
              teacherId,
              hasTrialSuccess,
              trialAppointments: relatedAppointments.filter((apt) => apt.course_type === "trial").map((apt) => ({
                id: apt._id,
                status: apt.status,
                trial_result: apt.trial_result
              }))
            });
          } else {
            this.hasTrialSuccess = false;
          }
        } catch (trialError) {
          common_vendor.index.__f__("warn", "at pages/teacher/detail.vue:900", "检查试课成功记录失败:", trialError);
          this.hasTrialSuccess = false;
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/teacher/detail.vue:905", "检查联系状态失败:", error);
        this.hasContacted = false;
        this.hasTrialSuccess = false;
      }
    },
    async toggleFavorite() {
      if (this.favoriteLoading)
        return;
      const teacherId = this.teacherUid || this.teacherId;
      if (!teacherId) {
        common_vendor.index.showToast({ title: "教师信息不完整", icon: "none" });
        return;
      }
      try {
        if (this.useMock) {
          this.isFavorited = !this.isFavorited;
          common_vendor.index.showToast({ title: this.isFavorited ? "收藏成功" : "已取消收藏", icon: "success" });
          return;
        }
        const stored = common_vendor.index.getStorageSync("userInfo") || {};
        if (!stored.uid) {
          common_vendor.index.showToast({ title: "请先登录", icon: "none" });
          return;
        }
        const favoriteObj = common_vendor.tr.importObject("teacher-favorite", { customUI: true });
        this.favoriteLoading = true;
        if (this.isFavorited) {
          const res = await favoriteObj.removeFavorite({ teacher_id: teacherId });
          if (res.code === 0) {
            this.isFavorited = false;
            common_vendor.index.showToast({ title: "已取消收藏", icon: "success" });
          } else {
            common_vendor.index.showToast({ title: res.message || "取消失败", icon: "none" });
          }
        } else {
          const res = await favoriteObj.addFavorite({ teacher_id: teacherId });
          if (res.code === 0) {
            this.isFavorited = true;
            common_vendor.index.showToast({ title: "收藏成功", icon: "success" });
          } else {
            common_vendor.index.showToast({ title: res.message || "收藏失败", icon: "none" });
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/teacher/detail.vue:948", "收藏操作失败:", error);
        common_vendor.index.showToast({ title: "操作失败，请稍后再试", icon: "none" });
      } finally {
        this.favoriteLoading = false;
      }
    },
    formatPercent(rate) {
      if (!rate && rate !== 0)
        return "0%";
      return `${(Number(rate) * 100).toFixed(0)}%`;
    },
    formatRating(rating) {
      if (!rating && rating !== 0)
        return "5.0";
      return Number(rating).toFixed(1);
    },
    teacherGenderText(gender) {
      if (gender === "male" || gender === 1 || gender === "1")
        return "男";
      if (gender === "female" || gender === 2 || gender === "2")
        return "女";
      return "";
    },
    teacherGenderClass(gender) {
      if (gender === "male" || gender === 1 || gender === "1")
        return "male";
      if (gender === "female" || gender === 2 || gender === "2")
        return "female";
      return "";
    },
    async fetchUserLocation() {
      try {
        const res = await common_vendor.index.getLocation({ type: "gcj02" });
        if (res.latitude != null && res.longitude != null) {
          this.userLocation = { lat: res.latitude, lon: res.longitude };
        }
      } catch (e) {
      }
    },
    haversineKm(lat1, lon1, lat2, lon2) {
      if (lat1 == null || lon1 == null || lat2 == null || lon2 == null)
        return null;
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    formatExperience() {
      var _a, _b, _c;
      const years = ((_b = (_a = this.teacherInfo) == null ? void 0 : _a.teaching_experience) == null ? void 0 : _b.years) || ((_c = this.teacherInfo) == null ? void 0 : _c.experience_years);
      const num = Number(years);
      return !isNaN(num) && num >= 0 ? `${num}年` : "1年";
    },
    formatTime(ts) {
      const date = new Date(ts || Date.now());
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${month}-${day}`;
    },
    /**
     * 屏蔽地址中的门牌号，只保留到小区
     * @param {String} address 完整地址
     * @returns {String} 处理后的地址（只到小区，门牌号已删除）
     */
    maskAddress(address) {
      if (!address || !address.trim())
        return "";
      let masked = address.trim();
      const patterns = [
        /\d+[号栋单元室层楼]\d*[单元室层]?\d*[室]?$/,
        // 如：1号楼2单元301室
        /\d+号\d*[单元室层]?\d*[室]?$/,
        // 如：123号2单元301室
        /\d+[单元室层楼栋]\d*[室]?$/,
        // 如：2单元301室、5栋
        /\d+室$/,
        // 如：301室
        /\d+层$/,
        // 如：3层
        /第\d+[层楼]$/
        // 如：第3层
      ];
      for (const pattern of patterns) {
        if (pattern.test(masked)) {
          masked = masked.replace(pattern, "").trim();
          masked = masked.replace(/[，,、\s]+$/, "");
          break;
        }
      }
      const communityKeywords = ["小区", "社区", "花园", "家园", "苑", "园", "里", "新村", "大厦", "广场"];
      for (const keyword of communityKeywords) {
        const index = masked.indexOf(keyword);
        if (index !== -1) {
          const endIndex = index + keyword.length;
          masked = masked.substring(0, endIndex);
          break;
        }
      }
      return masked || "";
    },
    /**
     * 屏蔽备注中的电话号码、联系方式、地址信息
     * @param {String} notes 备注内容
     * @returns {String} 处理后的备注（已删除所有联系方式和地址信息）
     */
    maskContactInfo(notes) {
      if (!notes || !notes.trim())
        return "";
      let masked = notes.trim();
      masked = masked.replace(/(1[3-9]\d)[\s\-]?(\d{4})[\s\-]?(\d{4})/g, "");
      masked = masked.replace(/(0\d{2,3})[\s\-]?(\d{7,8})/g, "");
      masked = masked.replace(/(微信[号:]?|wx[_:]?|wechat[_:]?)\s*[a-zA-Z0-9_\-]{3,20}/gi, "");
      masked = masked.replace(/(QQ[号:]?)\s*\d{5,12}/gi, "");
      masked = masked.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,})/g, "");
      const contactKeywords = ["联系方式", "联系电话", "联系", "电话号码", "电话", "手机号", "手机", "微信号", "微信", "QQ", "wx"];
      for (const kw of contactKeywords) {
        const pattern = new RegExp(kw + "[:：]?", "gi");
        masked = masked.replace(pattern, "");
      }
      masked = masked.replace(/[^，,。.、；;：:\s]+(省|市|区|县|街道|镇|乡)/g, "");
      const addressKeywords = ["小区", "社区", "花园", "家园", "苑", "园", "里", "新村", "大厦", "广场", "路", "道", "街", "巷", "弄", "号", "栋", "幢", "单元", "室", "房", "层", "楼"];
      for (const keyword of addressKeywords) {
        const pattern = new RegExp("[^，,。.、；;：:\\s]*" + keyword, "gi");
        masked = masked.replace(pattern, "");
      }
      masked = masked.replace(/(^|[\s，,。.、；;：:])\d{2,5}(?=$|[\s，,。.、；;：:])/g, "$1");
      masked = masked.replace(/[，,。.、；;：:]\s*[，,。.、；;：:]+/g, "，");
      masked = masked.replace(/\s{2,}/g, " ");
      masked = masked.replace(/^[，,。.、；;：:\s]+|[，,。.、；;：:\s]+$/g, "");
      return masked.trim();
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.teacherInfo.avatar || $data.defaultAvatarUrl,
    b: common_vendor.t($data.teacherInfo.display_name || $data.teacherInfo.name || "教师"),
    c: $options.teacherGenderText($data.teacherInfo.gender)
  }, $options.teacherGenderText($data.teacherInfo.gender) ? {
    d: common_vendor.t($options.teacherGenderText($data.teacherInfo.gender)),
    e: common_vendor.n($options.teacherGenderClass($data.teacherInfo.gender))
  } : {}, {
    f: $data.teacherInfo.is_verified
  }, $data.teacherInfo.is_verified ? {} : {}, {
    g: $data.teacherInfo.school || $data.teacherInfo.experience
  }, $data.teacherInfo.school || $data.teacherInfo.experience ? {
    h: common_vendor.t([$data.teacherInfo.school, $data.teacherInfo.experience].filter(Boolean).join(" · "))
  } : {}, {
    i: $options.subjectList.length
  }, $options.subjectList.length ? common_vendor.e({
    j: common_vendor.t($options.subjectList.slice(0, 3).join(" / ")),
    k: $options.subjectList.length > 3
  }, $options.subjectList.length > 3 ? {
    l: common_vendor.t($options.subjectList.length - 3)
  } : {}) : {}, {
    m: $data.isFavorited ? $data.favoriteFilledUrl : $data.favoriteEmptyUrl,
    n: common_vendor.o((...args) => $options.toggleFavorite && $options.toggleFavorite(...args)),
    o: common_vendor.t($options.formatRating($data.teacherInfo.rating)),
    p: common_vendor.t($data.teacherInfo.hourly_rate || 100),
    q: common_vendor.t($options.formatExperience()),
    r: $options.subjectList.length || $options.gradeGroups.length
  }, $options.subjectList.length || $options.gradeGroups.length ? common_vendor.e({
    s: $options.subjectList.length
  }, $options.subjectList.length ? {
    t: common_vendor.t($options.subjectList.length),
    v: common_vendor.f($options.subjectList, (subject, k0, i0) => {
      return {
        a: common_vendor.t(subject),
        b: subject
      };
    })
  } : {}, {
    w: $options.gradeGroups.length
  }, $options.gradeGroups.length ? {
    x: common_vendor.t($options.gradeTotalCount),
    y: common_vendor.f($options.gradeGroups, (group, k0, i0) => {
      return {
        a: common_vendor.t(group.label),
        b: common_vendor.t(group.items.length),
        c: common_vendor.f(group.items, (grade, k1, i1) => {
          return {
            a: common_vendor.t(grade),
            b: grade
          };
        }),
        d: group.key
      };
    }),
    z: $options.subjectList.length ? 1 : ""
  } : {}) : {}, {
    A: common_vendor.t($options.formatRating($data.teacherInfo.rating)),
    B: common_vendor.t($data.teacherInfo.trial_count || 0),
    C: common_vendor.t($data.teacherInfo.trial_success_count != null ? $data.teacherInfo.trial_success_count : 0),
    D: common_vendor.t($options.formatPercent($data.teacherInfo.trial_success_rate)),
    E: common_vendor.t($data.teacherInfo.total_students || 0),
    F: common_vendor.t($data.teacherInfo.total_courses || $data.teacherInfo.total_hours || 0),
    G: common_vendor.t($data.teacherInfo.review_count || $options.recentReviews.length),
    H: common_vendor.t($data.teacherInfo.introduction || "老师正在完善介绍，欢迎预约体验课程。"),
    I: $options.teacherAddressText || $options.teacherDistanceText || $options.teacherGenderText($data.teacherInfo.gender) || $data.teacherInfo.school || $data.teacherInfo.experience || ($data.teacherInfo.tags || []).length || $data.teacherInfo.education && ($data.teacherInfo.education.degree || $data.teacherInfo.education.major || $data.teacherInfo.education.graduation_year) || ($data.teacherInfo.qualifications || []).length
  }, $options.teacherAddressText || $options.teacherDistanceText || $options.teacherGenderText($data.teacherInfo.gender) || $data.teacherInfo.school || $data.teacherInfo.experience || ($data.teacherInfo.tags || []).length || $data.teacherInfo.education && ($data.teacherInfo.education.degree || $data.teacherInfo.education.major || $data.teacherInfo.education.graduation_year) || ($data.teacherInfo.qualifications || []).length ? common_vendor.e({
    J: $options.teacherAddressText || $options.teacherDistanceText
  }, $options.teacherAddressText || $options.teacherDistanceText ? common_vendor.e({
    K: $options.teacherAddressText
  }, $options.teacherAddressText ? {
    L: common_vendor.t($options.teacherAddressText)
  } : {}, {
    M: $options.teacherDistanceText
  }, $options.teacherDistanceText ? {
    N: common_vendor.t($options.teacherDistanceText)
  } : {}) : {}, {
    O: $options.teacherGenderText($data.teacherInfo.gender) || $data.teacherInfo.school || $data.teacherInfo.experience
  }, $options.teacherGenderText($data.teacherInfo.gender) || $data.teacherInfo.school || $data.teacherInfo.experience ? common_vendor.e({
    P: $options.teacherGenderText($data.teacherInfo.gender)
  }, $options.teacherGenderText($data.teacherInfo.gender) ? {
    Q: common_vendor.t($options.teacherGenderText($data.teacherInfo.gender)),
    R: !$data.teacherInfo.school && !$data.teacherInfo.experience ? 1 : ""
  } : {}, {
    S: $data.teacherInfo.school
  }, $data.teacherInfo.school ? {
    T: common_vendor.t($data.teacherInfo.school),
    U: !$data.teacherInfo.experience ? 1 : ""
  } : {}, {
    V: $data.teacherInfo.experience
  }, $data.teacherInfo.experience ? {
    W: common_vendor.t($data.teacherInfo.experience)
  } : {}) : {}, {
    X: ($data.teacherInfo.tags || []).length
  }, ($data.teacherInfo.tags || []).length ? {
    Y: common_vendor.f($data.teacherInfo.tags, (tag, k0, i0) => {
      return {
        a: common_vendor.t(tag),
        b: tag
      };
    })
  } : {}, {
    Z: $data.teacherInfo.education && ($data.teacherInfo.education.degree || $data.teacherInfo.education.major || $data.teacherInfo.education.graduation_year)
  }, $data.teacherInfo.education && ($data.teacherInfo.education.degree || $data.teacherInfo.education.major || $data.teacherInfo.education.graduation_year) ? common_vendor.e({
    aa: $data.teacherInfo.education.degree
  }, $data.teacherInfo.education.degree ? {
    ab: common_vendor.t($data.teacherInfo.education.degree)
  } : {}, {
    ac: $data.teacherInfo.education.major
  }, $data.teacherInfo.education.major ? {
    ad: common_vendor.t($data.teacherInfo.education.major)
  } : {}, {
    ae: $data.teacherInfo.education.graduation_year
  }, $data.teacherInfo.education.graduation_year ? {
    af: common_vendor.t($data.teacherInfo.education.graduation_year)
  } : {}) : {}, {
    ag: ($data.teacherInfo.qualifications || []).length
  }, ($data.teacherInfo.qualifications || []).length ? {
    ah: common_vendor.f($data.teacherInfo.qualifications, (item, index, i0) => {
      return {
        a: common_vendor.t(item.name || "证书"),
        b: index
      };
    })
  } : {}) : {}, {
    ai: $options.scheduleSummary.length || $options.recentReviews.length
  }, $options.scheduleSummary.length || $options.recentReviews.length ? common_vendor.e({
    aj: $options.scheduleSummary.length
  }, $options.scheduleSummary.length ? {
    ak: common_vendor.f($options.scheduleSummary, (slot, k0, i0) => {
      return {
        a: common_vendor.t(slot.day),
        b: common_vendor.t(slot.time),
        c: slot.day
      };
    })
  } : {}, {
    al: $options.recentReviews.length
  }, $options.recentReviews.length ? {
    am: common_vendor.o((...args) => $options.goToReviews && $options.goToReviews(...args)),
    an: common_vendor.f($options.recentReviews, (review, k0, i0) => {
      return {
        a: common_vendor.t(review.parent_name || "家长"),
        b: common_vendor.t($options.formatTime(review.create_time)),
        c: common_vendor.t(review.rating || 5),
        d: common_vendor.t(review.content),
        e: review._id
      };
    })
  } : {}) : {}, {
    ao: $data.isLoading
  }, $data.isLoading ? {} : $data.loadError ? {
    aq: common_vendor.t($data.loadError),
    ar: common_vendor.o((...args) => $options.loadDetail && $options.loadDetail(...args))
  } : {}, {
    ap: $data.loadError,
    as: $data.isRefreshing,
    at: common_vendor.o((...args) => $options.onRefresh && $options.onRefresh(...args)),
    av: common_vendor.t($data.teacherInfo.hourly_rate || 100),
    aw: common_vendor.t($data.isContacting ? "联系中..." : "联系老师"),
    ax: $data.isLoading || $data.loadError || $data.isContacting,
    ay: common_vendor.o((...args) => $options.handleContactTeacher && $options.handleContactTeacher(...args)),
    az: $options.canMakeAppointment
  }, $options.canMakeAppointment ? {
    aA: $data.isLoading || $data.loadError,
    aB: common_vendor.o((...args) => $options.goToAppointment && $options.goToAppointment(...args))
  } : $data.hasContacted && !$data.hasTrialSuccess ? {} : {}, {
    aC: $data.hasContacted && !$data.hasTrialSuccess
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-0cbe3d9e"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/teacher/detail.js.map
