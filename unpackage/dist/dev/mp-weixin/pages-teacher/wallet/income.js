"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "TeacherWalletIncome",
  components: {
    card
  },
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      filters: [
        { label: "全部", value: "all" },
        { label: "收入", value: "income" },
        { label: "提现", value: "withdraw" },
        { label: "退款", value: "refund" }
      ],
      currentFilter: "all",
      list: [],
      displayList: [],
      page: 1,
      pageSize: 20,
      finished: false,
      loading: false,
      useMock: false
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.resetAndLoad();
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/wallet/income.vue:92", "[teacher-wallet-income] 下拉刷新：重新加载收入明细");
      await this.resetAndLoad();
    },
    resetAndLoad() {
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
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const mockData = Array.from({ length: 8 }).map((_, idx) => ({
            _id: `mock${this.page}-${idx}`,
            title: idx % 2 === 0 ? "课程收入" : "提现申请",
            description: idx % 2 === 0 ? "数学课程 2025-01-02" : "微信零钱提现",
            amount: idx % 2 === 0 ? 200 + idx * 10 : -300,
            type: idx % 2 === 0 ? "income" : "withdraw",
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
        common_vendor.index.__f__("log", "at pages-teacher/wallet/income.vue:134", "[teacher-wallet-income] getTransactions 返回:", res);
        if (res.code === 0 && res.data) {
          const fetched = res.data.list || [];
          common_vendor.index.__f__("log", "at pages-teacher/wallet/income.vue:137", "[teacher-wallet-income] 本次获取记录数:", fetched.length, "当前总数:", this.list.length);
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
        common_vendor.index.__f__("error", "at pages-teacher/wallet/income.vue:153", "获取交易记录失败:", error);
        common_vendor.index.showToast({ title: "获取交易记录失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
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
    iconText(type) {
      if (type === "withdraw")
        return "提";
      if (type === "refund")
        return "退";
      return "收";
    },
    iconClass(type) {
      if (type === "withdraw")
        return "bg-warning";
      if (type === "refund")
        return "bg-danger";
      return "main-bg-color";
    },
    amountClass(amount) {
      return amount >= 0 ? "text-success" : "text-danger";
    },
    defaultDescription(type) {
      if (type === "withdraw")
        return "提现到账";
      if (type === "refund")
        return "退款处理";
      return "课程收入";
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.f($data.filters, (filter, k0, i0) => {
      return {
        a: common_vendor.t(filter.label),
        b: filter.value,
        c: common_vendor.n($data.currentFilter === filter.value ? "tab-active" : "tab-inactive"),
        d: common_vendor.o(($event) => $options.changeFilter(filter.value), filter.value)
      };
    }),
    b: $data.displayList.length
  }, $data.displayList.length ? {
    c: common_vendor.f($data.displayList, (item, k0, i0) => {
      return {
        a: common_vendor.t($options.iconText(item.type)),
        b: common_vendor.n($options.iconClass(item.type)),
        c: common_vendor.t(item.title),
        d: common_vendor.t(item.amount > 0 ? "+" : ""),
        e: common_vendor.t($options.formatCurrency(item.amount)),
        f: common_vendor.n($options.amountClass(item.amount)),
        g: common_vendor.t(item.description || $options.defaultDescription(item.type)),
        h: common_vendor.t($options.formatTime(item.create_time)),
        i: item._id
      };
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
