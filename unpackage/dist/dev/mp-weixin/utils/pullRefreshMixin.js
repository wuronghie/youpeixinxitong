"use strict";
const common_vendor = require("../common/vendor.js");
const pullRefreshMixin = {
  data() {
    return {
      scrollTop: 0,
      // 当前滚动位置
      isAtTop: true,
      // 是否在顶部
      // 下拉刷新相关
      touchStartY: 0,
      // 触摸开始Y坐标
      touchCurrentY: 0,
      // 当前触摸Y坐标
      pullDistance: 0,
      // 下拉距离
      pullRefreshStatus: "none",
      // 下拉状态: none, pulling, canRefresh, refreshing
      pullRefreshThreshold: 80,
      // 触发刷新的阈值(px)
      isRefreshing: false
      // 是否正在刷新
    };
  },
  computed: {
    pullRefreshText() {
      switch (this.pullRefreshStatus) {
        case "pulling":
          return "下拉刷新";
        case "canRefresh":
          return "松开刷新";
        case "refreshing":
          return "刷新中...";
        default:
          return "";
      }
    },
    // 指示器的transform位置（跟随下拉距离）
    pullRefreshTransform() {
      if (this.pullRefreshStatus === "none") {
        return "translateY(-100%)";
      }
      const distance = Math.min(this.pullDistance, 120);
      return `translateY(${distance - 80}rpx)`;
    }
  },
  methods: {
    /**
     * 处理滚动事件 - 记录滚动位置
     */
    handleScroll(e) {
      const scrollTop = e.detail.scrollTop || 0;
      this.scrollTop = scrollTop;
      this.isAtTop = scrollTop === 0;
      if (scrollTop > 0 && this.pullRefreshStatus !== "none") {
        this.pullRefreshStatus = "none";
        this.pullDistance = 0;
      }
    },
    /**
     * 处理触摸开始
     */
    handleTouchStart(e) {
      if (this.scrollTop === 0 && !this.isRefreshing) {
        this.touchStartY = e.touches[0].pageY;
        this.touchCurrentY = e.touches[0].pageY;
        common_vendor.index.__f__("log", "at utils/pullRefreshMixin.js:86", "[pullRefresh] touchStart at top, Y =", this.touchStartY);
      }
    },
    /**
     * 处理触摸移动
     */
    handleTouchMove(e) {
      if (this.scrollTop !== 0 || this.isRefreshing) {
        return;
      }
      if (!this.touchStartY) {
        return;
      }
      this.touchCurrentY = e.touches[0].pageY;
      const deltaY = this.touchCurrentY - this.touchStartY;
      if (deltaY > 0) {
        const query = common_vendor.index.createSelectorQuery().in(this);
        query.select(".scroll-area").scrollOffset();
        query.exec((res) => {
          const scrollOffset = res && res[0] ? res[0] : null;
          const realScrollTop = scrollOffset ? scrollOffset.scrollTop : this.scrollTop;
          if (realScrollTop === 0) {
            this.pullDistance = deltaY;
            if (deltaY >= this.pullRefreshThreshold) {
              this.pullRefreshStatus = "canRefresh";
            } else {
              this.pullRefreshStatus = "pulling";
            }
            common_vendor.index.__f__("log", "at utils/pullRefreshMixin.js:127", "[pullRefresh] pulling: distance =", deltaY, "status =", this.pullRefreshStatus);
          } else {
            common_vendor.index.__f__("log", "at utils/pullRefreshMixin.js:129", "[pullRefresh] not at top, realScrollTop =", realScrollTop);
          }
        });
      }
    },
    /**
     * 处理触摸结束
     */
    handleTouchEnd(e) {
      common_vendor.index.__f__("log", "at utils/pullRefreshMixin.js:139", "[pullRefresh] touchEnd: status =", this.pullRefreshStatus, "distance =", this.pullDistance);
      if (this.pullRefreshStatus === "canRefresh" && !this.isRefreshing) {
        this._startRefresh();
      } else {
        this.pullRefreshStatus = "none";
        this.pullDistance = 0;
        this.touchStartY = 0;
        this.touchCurrentY = 0;
      }
    },
    /**
     * 开始刷新
     */
    async _startRefresh() {
      if (this.isRefreshing) {
        common_vendor.index.__f__("log", "at utils/pullRefreshMixin.js:158", "[pullRefresh] 已在刷新中");
        return;
      }
      common_vendor.index.__f__("log", "at utils/pullRefreshMixin.js:162", "[pullRefresh] 开始刷新");
      this.pullRefreshStatus = "refreshing";
      this.isRefreshing = true;
      try {
        if (typeof this.refreshData === "function") {
          await this.refreshData();
        } else {
          common_vendor.index.__f__("warn", "at utils/pullRefreshMixin.js:171", "[pullRefresh] 未找到 refreshData 方法");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at utils/pullRefreshMixin.js:174", "[pullRefresh] 刷新失败:", error);
        common_vendor.index.showToast({
          title: "刷新失败",
          icon: "none"
        });
      } finally {
        setTimeout(() => {
          this.pullRefreshStatus = "none";
          this.pullDistance = 0;
          this.isRefreshing = false;
          this.touchStartY = 0;
          this.touchCurrentY = 0;
          common_vendor.index.__f__("log", "at utils/pullRefreshMixin.js:188", "[pullRefresh] 刷新完成");
        }, 300);
      }
    },
    /**
     * 手动重置刷新状态
     */
    resetRefreshState() {
      this.pullRefreshStatus = "none";
      this.pullDistance = 0;
      this.isRefreshing = false;
      this.touchStartY = 0;
      this.touchCurrentY = 0;
    }
  }
};
exports.pullRefreshMixin = pullRefreshMixin;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/pullRefreshMixin.js.map
