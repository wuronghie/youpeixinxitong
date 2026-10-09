"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const _sfc_main = {
  name: "TeacherWalletIncome",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      filters: [
        { label: "全部", value: "all" },
        { label: "收入", value: "income" },
        { label: "退款", value: "refund" }
      ],
      currentFilter: "all",
      list: [],
      displayList: [],
      page: 1,
      pageSize: 20,
      finished: false,
      loading: false,
      _reloadQueued: false,
      useMock: false
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.resetAndLoad();
  },
  onShow() {
    if (this.useMock)
      return;
    this.resetAndLoad();
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/wallet/income.vue:84", "[teacher-wallet-income] 下拉刷新：重新加载收入明细");
      await this.resetAndLoad();
    },
    resetAndLoad() {
      if (this.loading) {
        this._reloadQueued = true;
        return;
      }
      this.page = 1;
      this.finished = false;
      this.list = [];
      this.displayList = [];
      this.loadList();
    },
    async loadList() {
      var _a;
      if (this.loading || this.finished)
        return;
      this.loading = true;
      this._reloadQueued = false;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mockData = Array.from({ length: 8 }).map((_, idx) => ({
            _id: `mock${this.page}-${idx}`,
            title: idx % 2 === 0 ? "课程收入" : "试课收入",
            description: idx % 2 === 0 ? "家长 张三 · 课程" : "家长 李四 · 试课",
            amount: 200 + idx * 10,
            type: "income",
            arrive_status: idx % 3 === 0 ? "wait_confirm" : "arrived",
            arrive_label: idx % 3 === 0 ? "待确认收款" : "已到账",
            create_time: Date.now() - idx * 864e5
          }));
          if (this.page === 1) {
            this.list = mockData;
          } else {
            this.list = [...this.list, ...mockData];
          }
          if (mockData.length < this.pageSize) {
            this.finished = true;
          }
          this.filterList();
          this.page += 1;
          return;
        }
        const walletObj = common_vendor.tr.importObject("teacher-wallet", { customUI: true });
        const res = await walletObj.getTransactions({
          page: this.page,
          pageSize: this.pageSize
        });
        common_vendor.index.__f__("log", "at pages-teacher/wallet/income.vue:133", "[teacher-wallet-income] getTransactions 返回:", res);
        if (res.code === 0 && res.data) {
          const fetched = res.data.list || [];
          common_vendor.index.__f__("log", "at pages-teacher/wallet/income.vue:136", "[teacher-wallet-income] 本次获取记录数:", fetched.length, "当前总数:", this.list.length);
          if (this.page === 1) {
            this.list = fetched;
          } else {
            this.list = [...this.list, ...fetched];
          }
          if (this.list.length >= (((_a = res.data.pagination) == null ? void 0 : _a.total) || 0)) {
            this.finished = true;
          } else {
            this.page += 1;
          }
          this.filterList();
        } else {
          common_vendor.index.showToast({ title: res.message || "获取交易记录失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/wallet/income.vue:152", "获取交易记录失败:", error);
        common_vendor.index.showToast({ title: "获取交易记录失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
        if (this._reloadQueued) {
          this._reloadQueued = false;
          this.resetAndLoad();
        }
      }
    },
    loadMore() {
      this.loadList();
    },
    changeFilter(filter) {
      if (this.currentFilter === filter)
        return;
      this.currentFilter = filter;
      this.filterList();
    },
    filterList() {
      if (this.currentFilter === "all") {
        this.displayList = [...this.list];
      } else if (this.currentFilter === "income") {
        this.displayList = this.list.filter((item) => item.type === "income" || item.type === "withdraw");
      } else {
        this.displayList = this.list.filter((item) => item.type === this.currentFilter);
      }
    },
    formatCurrency(value) {
      const num = Number(value || 0);
      return num.toFixed(2);
    },
    formatTime(timestamp) {
      const date = new Date(timestamp || Date.now());
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}`;
    },
    amountClass(amount) {
      return amount >= 0 ? "amt-plus" : "amt-minus";
    },
    arriveClass(status) {
      if (status === "arrived")
        return "arrive-ok";
      if (status === "wait_confirm" || status === "pending_review")
        return "arrive-warn";
      if (status === "failed")
        return "arrive-fail";
      return "arrive-muted";
    },
    displayTitle(item) {
      if (!item)
        return "流水";
      if (item.type === "withdraw")
        return item.title || "微信到账";
      return item.title || "课程收入";
    },
    defaultDescription(type) {
      if (type === "refund")
        return "退款处理";
      if (type === "withdraw")
        return "课酬转入微信零钱";
      return "课程收入";
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.f($data.filters, (filter, k0, i0) => {
      return {
        a: common_vendor.t(filter.label),
        b: filter.value,
        c: $data.currentFilter === filter.value ? 1 : "",
        d: common_vendor.o(($event) => $options.changeFilter(filter.value), filter.value)
      };
    }),
    b: $data.displayList.length
  }, $data.displayList.length ? {
    c: common_vendor.f($data.displayList, (item, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t($options.displayTitle(item)),
        b: item.arrive_label
      }, item.arrive_label ? {
        c: common_vendor.t(item.arrive_label),
        d: common_vendor.n($options.arriveClass(item.arrive_status))
      } : {}, {
        e: common_vendor.t(item.description || $options.defaultDescription(item.type)),
        f: common_vendor.t($options.formatTime(item.create_time)),
        g: common_vendor.t(item.amount > 0 ? "+" : ""),
        h: common_vendor.t($options.formatCurrency(item.amount)),
        i: common_vendor.n($options.amountClass(item.amount)),
        j: item._id
      });
    })
  } : !$data.loading ? {} : {}, {
    d: !$data.loading,
    e: $data.loading
  }, $data.loading ? {} : $data.finished && $data.displayList.length ? {} : {}, {
    f: $data.finished && $data.displayList.length,
    g: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-34221cb1"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/wallet/income.js.map
