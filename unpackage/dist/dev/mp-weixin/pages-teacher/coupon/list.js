"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_auth = require("../../utils/auth.js");
const _sfc_main = {
  name: "TeacherCoupons",
  data() {
    return {
      coupons: [],
      loading: false,
      refresherTriggered: false
    };
  },
  onShow() {
    if (!utils_auth.ensureLoggedIn("teacher")) {
      return;
    }
    this.loadCoupons();
  },
  methods: {
    async onPullDownRefresh() {
      this.refresherTriggered = true;
      await this.loadCoupons();
      this.refresherTriggered = false;
      common_vendor.index.stopPullDownRefresh();
    },
    async loadCoupons() {
      if (this.loading)
        return;
      this.loading = true;
      try {
        const couponCenter = common_vendor.tr.importObject("coupon-center", { customUI: true });
        const res = await couponCenter.getAvailableCoupons({ role: "teacher" });
        if (res.code === 0 && res.data && Array.isArray(res.data.list)) {
          this.coupons = res.data.list;
        } else {
          this.coupons = [];
          if (res && res.message) {
            common_vendor.index.showToast({ title: res.message, icon: "none" });
          }
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages-teacher/coupon/list.vue:83", "加载教师优惠券失败:", err);
        this.coupons = [];
        common_vendor.index.showToast({ title: "加载优惠券失败", icon: "none" });
      } finally {
        this.loading = false;
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
        return `支付信息费立减¥${this.formatAmount(item.amount)}`;
      }
      if (item.type === "discount") {
        return `支付信息费享受${this.formatDiscount(item.discount)}`;
      }
      return "支付信息费可用";
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: !$data.loading && $data.coupons.length === 0
  }, !$data.loading && $data.coupons.length === 0 ? {} : {
    b: common_vendor.f($data.coupons, (item, k0, i0) => {
      return common_vendor.e({
        a: item.type === "amount"
      }, item.type === "amount" ? {
        b: common_vendor.t($options.formatAmount(item.amount))
      } : {
        c: common_vendor.t($options.formatDiscount(item.discount))
      }, {
        d: common_vendor.t(item.name || "优惠券"),
        e: common_vendor.t(item.description || $options.defaultDesc(item)),
        f: common_vendor.t(item.min_spend && item.min_spend > 0 ? `满¥${$options.formatAmount(item.min_spend)}可用` : "无门槛"),
        g: common_vendor.t($options.formatDate(item.valid_from)),
        h: common_vendor.t($options.formatDate(item.valid_to)),
        i: item._id
      });
    })
  }, {
    c: common_vendor.o((...args) => $options.onPullDownRefresh && $options.onPullDownRefresh(...args)),
    d: $data.refresherTriggered
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-85f1aec4"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/coupon/list.js.map
