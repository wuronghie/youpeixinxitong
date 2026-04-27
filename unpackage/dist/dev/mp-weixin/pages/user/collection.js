"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const defaultAvatar = utils_imageConfig.getDefaultAvatarUrl();
const _sfc_main = {
  name: "ParentCollection",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      useMock: false,
      loading: false,
      refresherTriggered: false,
      collectionList: [],
      scrollTop: 0,
      canRefresh: true,
      defaultAvatar
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
  },
  onShow() {
    this.refreshList();
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages/user/collection.vue:152", "[user-collection] 下拉刷新：重新加载收藏列表");
      await this.refreshList();
    },
    async refreshList() {
      this.loading = true;
      await this.loadCollection();
      this.loading = false;
    },
    handleScroll(e) {
      this.scrollTop = e.detail.scrollTop;
      this.canRefresh = e.detail.scrollTop <= 10;
    },
    handleScrollToUpper() {
      this.scrollTop = 0;
      this.canRefresh = true;
    },
    async onRefresh() {
      if (!this.canRefresh || this.scrollTop > 10) {
        this.refresherTriggered = false;
        return;
      }
      if (this.refresherTriggered)
        return;
      this.refresherTriggered = true;
      try {
        await this.loadCollection();
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/collection.vue:178", "刷新失败:", error);
        common_vendor.index.showToast({ title: "刷新失败，请稍后再试", icon: "none" });
      } finally {
        this.refresherTriggered = false;
      }
    },
    loadMore() {
    },
    async loadCollection() {
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          this.collectionList = utils_mockData.mockTeachers.slice(0, 3).map((item, index) => ({
            teacher_id: item.teacher_id || item._id,
            teacher_name: item.display_name || item.name,
            avatar: item.avatar,
            title: item.title,
            subjects: item.subjects || [],
            hourly_rate: item.hourly_rate || 0,
            rating: item.rating || 5,
            order_count: item.order_count || 0,
            is_verified: item.is_verified || false,
            create_time: Date.now(),
            can_contact: index === 0,
            conversation_id: index === 0 ? "mock-conversation-id" : ""
          }));
          return;
        }
        const stored = common_vendor.index.getStorageSync("userInfo") || {};
        if (!stored.uid) {
          common_vendor.index.showToast({ title: "请先登录", icon: "none" });
          this.collectionList = [];
          return;
        }
        const favoriteObj = common_vendor.tr.importObject("teacher-favorite", { customUI: true });
        const res = await favoriteObj.getParentFavorites();
        if (res.code === 0 && res.data) {
          this.collectionList = res.data.list || [];
        } else {
          this.collectionList = [];
          if (res.message) {
            common_vendor.index.showToast({ title: res.message, icon: "none" });
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/user/collection.vue:226", "加载收藏列表失败:", error);
        common_vendor.index.showToast({ title: "加载失败，请稍后再试", icon: "none" });
      }
    },
    removeCollection(teacherId) {
      if (!teacherId)
        return;
      common_vendor.index.showModal({
        title: "取消收藏",
        content: "确定要取消收藏该教师吗？",
        confirmText: "取消收藏",
        confirmColor: "#ff4d4f",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            if (this.useMock) {
              this.collectionList = this.collectionList.filter((item) => item.teacher_id !== teacherId);
              common_vendor.index.showToast({ title: "已取消收藏", icon: "success" });
              return;
            }
            const favoriteObj = common_vendor.tr.importObject("teacher-favorite", { customUI: true });
            const result = await favoriteObj.removeFavorite({ teacher_id: teacherId });
            if (result.code === 0) {
              this.collectionList = this.collectionList.filter((item) => item.teacher_id !== teacherId);
              common_vendor.index.showToast({ title: "已取消收藏", icon: "success" });
            } else {
              common_vendor.index.showToast({ title: result.message || "操作失败", icon: "none" });
            }
          } catch (error) {
            common_vendor.index.__f__("error", "at pages/user/collection.vue:254", "取消收藏失败:", error);
            common_vendor.index.showToast({ title: "取消失败，请稍后再试", icon: "none" });
          }
        }
      });
    },
    goToDetail(id) {
      if (!id)
        return;
      if (this._navigatingDetail)
        return;
      this._navigatingDetail = true;
      common_vendor.index.navigateTo({
        url: `/pages/teacher/detail?id=${id}`,
        success: () => {
          this._navigatingDetail = false;
        },
        fail: (err) => {
          this._navigatingDetail = false;
          common_vendor.index.__f__("warn", "at pages/user/collection.vue:269", "[collection] navigateTo detail failed:", err && err.errMsg);
          if (err && /timeout/i.test(err.errMsg || "")) {
            common_vendor.index.showToast({ title: "加载超时，请重试", icon: "none" });
          }
        }
      });
    },
    goFindTeacher() {
      common_vendor.index.navigateTo({
        url: "/pages/teacher/list"
      });
    },
    goChat(teacher) {
      if (!teacher || !teacher.teacher_id)
        return;
      const conversationId = teacher.conversation_id;
      if (!conversationId) {
        common_vendor.index.showToast({ title: "请从订单详情进入聊天", icon: "none" });
        return;
      }
      common_vendor.index.navigateTo({
        url: `/pages/chat/conversation?conversationId=${conversationId}`
      });
    },
    formatDate(timestamp) {
      if (!timestamp)
        return "刚刚";
      const date = new Date(Number(timestamp));
      if (Number.isNaN(date.getTime()))
        return "刚刚";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.collectionList.length || 0),
    b: common_vendor.o((...args) => $options.goFindTeacher && $options.goFindTeacher(...args)),
    c: common_vendor.t($data.loading ? "刷新中..." : "刷新列表"),
    d: common_vendor.o((...args) => $options.refreshList && $options.refreshList(...args)),
    e: $data.loading && !$data.collectionList.length
  }, $data.loading && !$data.collectionList.length ? {
    f: common_vendor.f(3, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : common_vendor.e({
    g: common_vendor.f($data.collectionList, (teacher, k0, i0) => {
      return common_vendor.e({
        a: teacher.avatar || $data.defaultAvatar,
        b: common_vendor.t(teacher.teacher_name),
        c: teacher.is_verified
      }, teacher.is_verified ? {} : {}, {
        d: common_vendor.t(teacher.rating || "5.0"),
        e: common_vendor.t(teacher.hourly_rate || 0),
        f: teacher.order_count
      }, teacher.order_count ? {
        g: common_vendor.t(teacher.order_count)
      } : {}, {
        h: teacher.subjects && teacher.subjects.length > 0
      }, teacher.subjects && teacher.subjects.length > 0 ? common_vendor.e({
        i: common_vendor.f(teacher.subjects.slice(0, 4), (subject, index, i1) => {
          return {
            a: common_vendor.t(subject),
            b: subject
          };
        }),
        j: teacher.subjects.length > 4
      }, teacher.subjects.length > 4 ? {
        k: common_vendor.t(teacher.subjects.length)
      } : {}) : {}, {
        l: common_vendor.t($options.formatDate(teacher.create_time)),
        m: teacher.can_contact
      }, teacher.can_contact ? {
        n: common_vendor.o(($event) => $options.goChat(teacher), teacher.teacher_id)
      } : {}, {
        o: common_vendor.o(($event) => $options.removeCollection(teacher.teacher_id), teacher.teacher_id),
        p: teacher.teacher_id,
        q: common_vendor.o(($event) => $options.goToDetail(teacher.teacher_id), teacher.teacher_id)
      });
    }),
    h: !$data.loading && $data.collectionList.length === 0
  }, !$data.loading && $data.collectionList.length === 0 ? {
    i: common_vendor.o((...args) => $options.goFindTeacher && $options.goFindTeacher(...args))
  } : {}), {
    j: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-cd66c500"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/user/collection.js.map
