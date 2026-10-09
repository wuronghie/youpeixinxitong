"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_auth = require("../../utils/auth.js");
const utils_coupons = require("../../utils/coupons.js");
const _sfc_main = {
  name: "MyCoupons",
  data() {
    return {
      coupons: [],
      loading: false,
      refresherTriggered: false,
      waitingIssue: false,
      _loadSeq: 0
    };
  },
  onShow() {
    if (!utils_auth.ensureLoggedIn("parent")) {
      return;
    }
    const cached = utils_coupons.getCachedAvailableCoupons("parent");
    if (cached.length) {
      this.coupons = cached;
    }
    this.waitingIssue = !!utils_coupons.getPendingIssuedCoupons();
    this.loadCoupons();
  },
  methods: {
    async refreshData() {
      await this.loadCoupons();
    },
    async onPullDownRefreshInternal() {
      this.refresherTriggered = true;
      await this.loadCoupons();
      this.refresherTriggered = false;
      common_vendor.index.stopPullDownRefresh();
    },
    async loadCoupons() {
      const seq = ++this._loadSeq;
      this.loading = true;
      try {
        const { list, message, waiting } = await utils_coupons.fetchAvailableCoupons("parent");
        if (seq !== this._loadSeq)
          return;
        this.coupons = list;
        this.waitingIssue = waiting && list.length === 0;
        if (!list.length && message) {
          common_vendor.index.showToast({
            title: message,
            icon: "none"
          });
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/coupon/list.vue:89", "加载优惠券失败:", err);
        if (seq !== this._loadSeq)
          return;
        this.coupons = [];
        common_vendor.index.showToast({
          title: "加载优惠券失败",
          icon: "none"
        });
      } finally {
        if (seq === this._loadSeq) {
          this.loading = false;
        }
      }
    },
    formatAmount(n) {
      const v = Number(n || 0);
      return v.toFixed(2);
    },
    formatDiscount(d) {
      const v = Number(d || 0);
      if (!v)
        return "折扣券";
      return `${(v * 10).toFixed(1)} 折`;
    },
    formatDate(ts) {
      if (!ts)
        return "--";
      try {
        const date = new Date(ts);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      } catch (e) {
        return "--";
      }
    },
    defaultDesc(item) {
      if (item.type === "amount") {
        return `下单立减¥${this.formatAmount(item.amount)}`;
      }
      if (item.type === "discount") {
        return `下单享受${this.formatDiscount(item.discount)}`;
      }
      return "下单可用";
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: !$data.loading && $data.coupons.length === 0
  }, !$data.loading && $data.coupons.length === 0 ? {
    b: common_vendor.t($data.waitingIssue ? "优惠券正在到账" : "暂无可用优惠券"),
    c: common_vendor.t($data.waitingIssue ? "请稍候或下拉刷新" : "可以通过好友邀请、活动发放等方式获得优惠券")
  } : {}, {
    d: common_vendor.f($data.coupons, (item, k0, i0) => {
      return common_vendor.e({
        a: item.type === "amount"
      }, item.type === "amount" ? {
        b: common_vendor.t($options.formatAmount(item.amount))
      } : {
        c: common_vendor.t($options.formatDiscount(item.discount))
      }, {
        d: common_vendor.t(item.type === "amount" ? "满减" : "折扣"),
        e: common_vendor.t(item.name || "优惠券"),
        f: common_vendor.t(item.min_spend && item.min_spend > 0 ? `满 ¥${$options.formatAmount(item.min_spend)} 可用` : "无门槛"),
        g: common_vendor.t(item.description ? ` · ${item.description}` : ""),
        h: common_vendor.t($options.formatDate(item.valid_to)),
        i: item._id
      });
    }),
    e: $data.refresherTriggered,
    f: common_vendor.o((...args) => $options.onPullDownRefreshInternal && $options.onPullDownRefreshInternal(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-019d569f"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/coupon/list.js.map
