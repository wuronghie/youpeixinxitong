"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const _sfc_main = {
  name: "TeacherReviewList",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl(),
      statusTabs: [
        { label: "全部", value: "all" },
        {
          label: "待回复",
          value: "unreplied",
          count: (stats) => stats.unreplied || 0
        },
        {
          label: "已回复",
          value: "replied",
          count: (stats) => stats.replied || 0
        }
      ],
      ratingTabs: [
        { label: "全部星级", value: "all" },
        { label: "5 星", value: 5 },
        { label: "4 星", value: 4 },
        { label: "3 星", value: 3 },
        { label: "2 星", value: 2 },
        { label: "1 星", value: 1 }
      ],
      currentStatus: "all",
      currentRating: "all",
      list: [],
      page: 1,
      pageSize: 10,
      finished: false,
      loading: false,
      stats: {
        total: 0,
        replied: 0,
        unreplied: 0,
        averageRating: "0.0",
        ratingStats: [
          { star: 5, count: 0 },
          { star: 4, count: 0 },
          { star: 3, count: 0 },
          { star: 2, count: 0 },
          { star: 1, count: 0 }
        ]
      },
      useMock: false
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.resetAndLoad();
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/review/list.vue:141", "[teacher-review] 下拉刷新：重新加载评价列表");
      await this.resetAndLoad();
    },
    resetAndLoad() {
      this.page = 1;
      this.finished = false;
      this.list = [];
      this.loadReviews();
    },
    async loadReviews() {
      var _a;
      if (this.loading || this.finished)
        return;
      this.loading = true;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mockList = Array.from({ length: 5 }).map((_, idx) => ({
            review_id: `mock-${this.page}-${idx}`,
            parent_name: ["张女士", "李先生", "王家长"][idx % 3],
            parent_avatar: "",
            rating: 5 - idx % 3,
            content: "孩子上课状态很好，老师讲解深入浅出。",
            tags: idx % 2 === 0 ? ["讲解清晰", "互动性强"] : ["耐心负责"],
            create_time: Date.now() - idx * 864e5,
            teacher_reply: idx % 2 === 0 ? "感谢认可，我们会继续努力~" : "",
            reply_time: idx % 2 === 0 ? Date.now() - idx * 432e5 : null
          }));
          if (this.page === 1) {
            this.list = mockList;
          } else {
            this.list = [...this.list, ...mockList];
          }
          if (mockList.length < this.pageSize) {
            this.finished = true;
          } else {
            this.page += 1;
          }
          this.stats = {
            total: 12,
            replied: 7,
            unreplied: 5,
            averageRating: "4.8",
            ratingStats: [
              { star: 5, count: 8 },
              { star: 4, count: 3 },
              { star: 3, count: 1 },
              { star: 2, count: 0 },
              { star: 1, count: 0 }
            ]
          };
          return;
        }
        const reviewObj = common_vendor.tr.importObject("teacher-review", { customUI: true });
        const res = await reviewObj.getList({
          page: this.page,
          pageSize: this.pageSize,
          status: this.currentStatus,
          rating: this.currentRating === "all" ? void 0 : Number(this.currentRating)
        });
        if (res.code === 0 && res.data) {
          const fetched = res.data.list || [];
          if (this.page === 1) {
            this.list = fetched;
          } else {
            this.list = [...this.list, ...fetched];
          }
          const total = ((_a = res.data.pagination) == null ? void 0 : _a.total) || 0;
          if (this.list.length >= total || fetched.length < this.pageSize) {
            this.finished = true;
          } else {
            this.page += 1;
          }
          this.stats = res.data.stats || this.stats;
        } else {
          common_vendor.index.showToast({ title: res.message || "获取评价失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/review/list.vue:224", "获取评价失败:", error);
        common_vendor.index.showToast({ title: "获取评价失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    loadMore() {
      this.loadReviews();
    },
    changeStatus(value) {
      if (this.currentStatus === value)
        return;
      this.currentStatus = value;
      this.resetAndLoad();
    },
    changeRating(value) {
      if (this.currentRating === value)
        return;
      this.currentRating = value;
      this.resetAndLoad();
    },
    distributionWidth(count) {
      const max = Math.max(...this.stats.ratingStats.map((item) => item.count), 1);
      const safeCount = Number(count || 0);
      return `${Math.round(safeCount / max * 100)}%`;
    },
    formatTime(timestamp) {
      if (!timestamp)
        return "";
      const date = new Date(timestamp);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${month}-${day} ${hour}:${minute}`;
    },
    replyReview(item) {
      common_vendor.index.showModal({
        title: item.teacher_reply ? "修改回复" : "回复评价",
        editable: true,
        placeholderText: "请输入回复内容（最多200字）",
        confirmColor: "#2563EB",
        content: item.teacher_reply || "",
        success: async (res) => {
          var _a;
          if (!res.confirm || !res.content || !res.content.trim())
            return;
          const replyText = res.content.trim();
          if (this.useMock) {
            item.teacher_reply = replyText;
            item.reply_time = Date.now();
            common_vendor.index.showToast({ title: "回复成功", icon: "success" });
            return;
          }
          try {
            const reviewObj = common_vendor.tr.importObject("teacher-review", { customUI: true });
            const result = await reviewObj.reply({
              review_id: item.review_id,
              reply_content: replyText
            });
            if (result.code === 0) {
              item.teacher_reply = replyText;
              item.reply_time = ((_a = result.data) == null ? void 0 : _a.reply_time) || Date.now();
              common_vendor.index.showToast({ title: "回复成功", icon: "success" });
              this.refreshStatsAfterReply();
            } else {
              common_vendor.index.showToast({ title: result.message || "回复失败", icon: "none" });
            }
          } catch (err) {
            common_vendor.index.__f__("error", "at pages-teacher/review/list.vue:289", "回复评价失败:", err);
            common_vendor.index.showToast({ title: "回复失败，请稍后重试", icon: "none" });
          }
        }
      });
    },
    refreshStatsAfterReply() {
      if (this.currentStatus === "unreplied") {
        this.resetAndLoad();
      } else {
        this.reloadStatsOnly();
      }
    },
    async reloadStatsOnly() {
      var _a;
      if (this.useMock)
        return;
      try {
        const reviewObj = common_vendor.tr.importObject("teacher-review", { customUI: true });
        const res = await reviewObj.getList({ page: 1, pageSize: 1 });
        if (res.code === 0 && ((_a = res.data) == null ? void 0 : _a.stats)) {
          this.stats = res.data.stats;
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/review/list.vue:311", "更新统计信息失败:", error);
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.stats.averageRating || "0.0"),
    b: common_vendor.t($data.stats.total || 0),
    c: common_vendor.t($data.stats.unreplied || 0),
    d: common_vendor.f($data.statusTabs, (tab, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(tab.label),
        b: tab.count && tab.count($data.stats)
      }, tab.count && tab.count($data.stats) ? {
        c: common_vendor.t(tab.count($data.stats))
      } : {}, {
        d: tab.value,
        e: $data.currentStatus === tab.value ? 1 : "",
        f: common_vendor.o(($event) => $options.changeStatus(tab.value), tab.value)
      });
    }),
    e: common_vendor.f($data.ratingTabs, (rate, k0, i0) => {
      return {
        a: common_vendor.t(rate.label),
        b: rate.value,
        c: $data.currentRating === rate.value ? 1 : "",
        d: common_vendor.o(($event) => $options.changeRating(rate.value), rate.value)
      };
    }),
    f: common_vendor.f($data.list, (item, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(item.parent_name || "家长"),
        b: common_vendor.f(5, (i, k1, i1) => {
          return {
            a: i,
            b: i <= item.rating ? 1 : ""
          };
        }),
        c: common_vendor.t($options.formatTime(item.create_time)),
        d: common_vendor.t(item.content),
        e: item.tags && item.tags.length
      }, item.tags && item.tags.length ? {
        f: common_vendor.f(item.tags, (tag, k1, i1) => {
          return {
            a: common_vendor.t(tag),
            b: tag
          };
        })
      } : {}, {
        g: item.teacher_reply
      }, item.teacher_reply ? {
        h: common_vendor.t($options.formatTime(item.reply_time)),
        i: common_vendor.t(item.teacher_reply),
        j: common_vendor.o(($event) => $options.replyReview(item), item.review_id)
      } : {
        k: common_vendor.o(($event) => $options.replyReview(item), item.review_id)
      }, {
        l: item.review_id
      });
    }),
    g: !$data.loading && !$data.list.length
  }, !$data.loading && !$data.list.length ? {} : {}, {
    h: $data.loading
  }, $data.loading ? {} : $data.finished && $data.list.length ? {} : {}, {
    i: $data.finished && $data.list.length,
    j: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-ded75a35"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/review/list.js.map
