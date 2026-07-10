"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "TeacherWalletIndex",
  components: {
    card
  },
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      wallet: {
        balance: 0,
        total_income: 0,
        total_withdraw: 0,
        frozen_amount: 0
      },
      recentTransactions: [],
      pendingConfirms: [],
      confirmingId: "",
      useMock: false,
      loading: false
    };
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.loadWallet();
  },
  onShow() {
    if (!this.useMock) {
      this.loadPendingConfirms();
    }
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages-teacher/wallet/index.vue:117", "[teacher-wallet] 下拉刷新：重新加载钱包");
      await Promise.all([this.loadWallet(), this.loadPendingConfirms()]);
    },
    async loadPendingConfirms() {
      try {
        const walletObj = common_vendor.tr.importObject("teacher-wallet", { customUI: true });
        const res = await walletObj.getPendingConfirmWithdraws();
        if (res.code === 0 && res.data) {
          this.pendingConfirms = res.data.list || [];
        }
      } catch (e) {
        common_vendor.index.__f__("warn", "at pages-teacher/wallet/index.vue:128", "[teacher-wallet] 加载待确认收款失败", e);
      }
    },
    requestMerchantTransfer(item) {
      return new Promise((resolve, reject) => {
        if (typeof common_vendor.wx$1 !== "undefined" && common_vendor.wx$1.canIUse && common_vendor.wx$1.canIUse("requestMerchantTransfer")) {
          common_vendor.wx$1.requestMerchantTransfer({
            mchId: item.mchId,
            appId: item.appId || common_vendor.wx$1.getAccountInfoSync && common_vendor.wx$1.getAccountInfoSync().miniProgram.appId,
            package: item.package_info,
            success: (res) => resolve(res),
            fail: (err) => reject(err)
          });
          return;
        }
        reject(new Error("当前微信版本过低，请更新微信后重试"));
      });
    },
    async confirmReceive(item) {
      if (!item || !item.package_info || this.confirmingId)
        return;
      this.confirmingId = item._id;
      try {
        await this.requestMerchantTransfer(item);
        const walletObj = common_vendor.tr.importObject("teacher-wallet", { customUI: true });
        const syncRes = await walletObj.syncWithdrawStatus({ withdraw_id: item._id });
        if (syncRes.code === 0 && syncRes.data && syncRes.data.status === "completed") {
          common_vendor.index.showToast({ title: "已到账", icon: "success" });
        } else {
          common_vendor.index.showToast({ title: syncRes && syncRes.message || "已提交确认，稍后刷新查看", icon: "none" });
        }
        await Promise.all([this.loadWallet(), this.loadPendingConfirms()]);
      } catch (e) {
        common_vendor.index.__f__("error", "at pages-teacher/wallet/index.vue:162", "确认收款失败", e);
        const msg = e && (e.errMsg || e.message) || "确认收款失败";
        if (String(msg).includes("cancel")) {
          common_vendor.index.showToast({ title: "已取消确认", icon: "none" });
        } else {
          common_vendor.index.showToast({ title: msg, icon: "none" });
        }
      } finally {
        this.confirmingId = "";
      }
    },
    async loadWallet() {
      if (this.loading)
        return;
      this.loading = true;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          this.wallet = {
            balance: 1280,
            total_income: 5e3,
            total_withdraw: 3720,
            frozen_amount: 300
          };
          this.recentTransactions = [
            {
              _id: "mock1",
              title: "课程收入",
              description: "2025-01-02 数学课程",
              amount: 300,
              type: "income",
              create_time: Date.now() - 864e5
            },
            {
              _id: "mock2",
              title: "提现申请",
              description: "微信零钱提现",
              amount: -500,
              type: "withdraw",
              create_time: Date.now() - 1728e5
            }
          ];
          return;
        }
        const userInfo = common_vendor.index.getStorageSync("userInfo") || {};
        if (!userInfo.uid || userInfo.role !== "teacher") {
          common_vendor.index.showToast({ title: "请先以教师身份登录", icon: "none" });
          return;
        }
        const walletObj = common_vendor.tr.importObject("teacher-wallet", { customUI: true });
        const res = await walletObj.getWallet();
        if (res.code === 0 && res.data) {
          this.wallet = Object.assign({}, this.wallet, res.data.wallet || {});
          this.recentTransactions = res.data.recent_transactions || [];
        } else {
          common_vendor.index.showToast({ title: res.message || "获取钱包信息失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/wallet/index.vue:221", "获取钱包信息失败:", error);
        common_vendor.index.showToast({ title: "获取钱包信息失败，请稍后再试", icon: "none" });
      } finally {
        this.loading = false;
      }
    },
    formatCurrency(value) {
      const num = Number(value || 0);
      return num.toFixed(2);
    },
    formatTime(timestamp) {
      const date = new Date(timestamp || Date.now());
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${month}-${day} ${hour}:${minute}`;
    },
    amountClass(amount) {
      return amount >= 0 ? "text-success" : "text-danger";
    },
    defaultDescription(type) {
      if (type === "withdraw")
        return "资金提现";
      if (type === "refund")
        return "退款处理";
      return "课程收入";
    },
    goToWithdraw() {
      common_vendor.index.navigateTo({ url: "/pages-teacher/wallet/withdraw" });
    },
    goToIncome() {
      common_vendor.index.navigateTo({ url: "/pages-teacher/wallet/income" });
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($options.formatCurrency($data.wallet.balance)),
    b: common_vendor.o((...args) => $options.goToWithdraw && $options.goToWithdraw(...args)),
    c: $data.pendingConfirms.length
  }, $data.pendingConfirms.length ? {
    d: common_vendor.t($data.pendingConfirms.length),
    e: common_vendor.f($data.pendingConfirms, (item, k0, i0) => {
      return {
        a: common_vendor.t($options.formatCurrency(item.amount)),
        b: common_vendor.t($options.formatTime(item.create_time)),
        c: $data.confirmingId === item._id,
        d: common_vendor.o(($event) => $options.confirmReceive(item), item._id),
        e: item._id
      };
    })
  } : {}, {
    f: common_vendor.t($options.formatCurrency($data.wallet.total_income)),
    g: common_vendor.t($options.formatCurrency($data.wallet.total_withdraw)),
    h: common_vendor.t($options.formatCurrency($data.wallet.frozen_amount)),
    i: common_vendor.o((...args) => $options.goToIncome && $options.goToIncome(...args)),
    j: $data.recentTransactions.length
  }, $data.recentTransactions.length ? {
    k: common_vendor.f($data.recentTransactions, (item, k0, i0) => {
      return {
        a: common_vendor.t(item.title),
        b: common_vendor.t(item.description || $options.defaultDescription(item.type)),
        c: common_vendor.t(item.amount > 0 ? "+" : ""),
        d: common_vendor.t($options.formatCurrency(item.amount)),
        e: common_vendor.n($options.amountClass(item.amount)),
        f: common_vendor.t($options.formatTime(item.create_time)),
        g: item._id
      };
    })
  } : {}, {
    l: common_vendor.p({
      headTitle: "最近交易"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-4389612a"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/wallet/index.js.map
