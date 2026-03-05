"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "TeacherReviewList",
  components: {
    card
  },
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
      common_vendor.index.__f__("log", "at pages-teacher/review/list.vue:187", "[teacher-review] 下拉刷新：重新加载评价列表");
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
        common_vendor.index.__f__("error", "at pages-teacher/review/list.vue:270", "获取评价失败:", error);
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
        confirmColor: "#667eea",
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
            common_vendor.index.__f__("error", "at pages-teacher/review/list.vue:335", "回复评价失败:", err);
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
        common_vendor.index.__f__("error", "at pages-teacher/review/list.vue:357", "更新统计信息失败:", error);
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.stats.averageRating || "0.0"),
    b: common_vendor.f(5, (i, k0, i0) => {
      return {
        a: i,
        b: common_vendor.s(i <= Math.round($data.stats.averageRating || 0) ? "color: #ffd060;" : "opacity: 0.4;")
      };
    }),
    c: common_vendor.t($data.stats.total || 0),
    d: common_vendor.t($data.stats.replied || 0),
    e: common_vendor.t($data.stats.unreplied || 0),
    f: common_vendor.f($data.stats.ratingStats, (item, k0, i0) => {
      return {
        a: common_vendor.t(item.star),
        b: $options.distributionWidth(item.count),
        c: common_vendor.t(item.count || 0),
        d: item.star
      };
    }),
    g: common_vendor.f($data.statusTabs, (tab, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(tab.label),
        b: tab.count
      }, tab.count ? {
        c: common_vendor.t(tab.count ? tab.count($data.stats) : "")
      } : {}, {
        d: tab.value,
        e: common_vendor.n($data.currentStatus === tab.value ? "tab-active-status" : "tab-inactive-status"),
        f: common_vendor.o(($event) => $options.changeStatus(tab.value), tab.value)
      });
    }),
    h: common_vendor.f($data.ratingTabs, (rate, k0, i0) => {
      return {
        a: common_vendor.t(rate.label),
        b: rate.value,
        c: common_vendor.n($data.currentRating === rate.value ? "tab-active-rating" : "tab-inactive-rating"),
        d: common_vendor.o(($event) => $options.changeRating(rate.value), rate.value)
      };
    }),
    i: common_vendor.f($data.list, (item, k0, i0) => {
      return common_vendor.e({
        a: item.parent_avatar || $data.defaultAvatarUrl,
        b: common_vendor.t(item.parent_name),
        c: common_vendor.f(5, (i, k1, i1) => {
          return {
            a: i,
            b: common_vendor.s(i <= item.rating ? "color: #ffd060;" : "color: #ddd;")
          };
        }),
        d: common_vendor.t($options.formatTime(item.create_time)),
        e: common_vendor.t(item.content),
        f: item.tags && item.tags.length
      }, item.tags && item.tags.length ? {
        g: common_vendor.f(item.tags, (tag, k1, i1) => {
          return {
            a: common_vendor.t(tag),
            b: tag
          };
        })
      } : {}, {
        h: item.teacher_reply
      }, item.teacher_reply ? {
        i: common_vendor.t($options.formatTime(item.reply_time)),
        j: common_vendor.t(item.teacher_reply),
        k: common_vendor.o(($event) => $options.replyReview(item), item.review_id)
      } : {
        l: common_vendor.o(($event) => $options.replyReview(item), item.review_id)
      }, {
        m: item.review_id
      });
    }),
    j: !$data.loading && !$data.list.length
  }, !$data.loading && !$data.list.length ? {} : {}, {
    k: $data.loading
  }, $data.loading ? {} : $data.finished && $data.list.length ? {} : {}, {
    l: $data.finished && $data.list.length,
    m: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-ded75a35"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/review/list.js.map
