"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const card = () => "../../components/common/card.js";
const _sfc_main = {
  name: "TeacherWalletWithdraw",
  components: {
    card
  },
  data() {
    return {
      walletInfo: {
        balance: 0,
        frozen_amount: 0,
        total_income: 0,
        total_withdraw: 0
      },
      withdrawAmount: "",
      quickAmounts: [50, 100, 200, 500],
      selectedMethod: "wxpay",
      minAmount: 0.3,
      isSubmitting: false,
      useMock: false
    };
  },
  computed: {
    availableBalance() {
      return Number(this.walletInfo.balance || 0);
    },
    submitDisabled() {
      const amount = Number(this.withdrawAmount);
      return !amount || Number.isNaN(amount) || amount < this.minAmount || amount > this.availableBalance;
    }
  },
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    this.loadWallet();
  },
  methods: {
    requestMerchantTransfer(payload) {
      return new Promise((resolve, reject) => {
        if (typeof common_vendor.wx$1 !== "undefined" && common_vendor.wx$1.canIUse && common_vendor.wx$1.canIUse("requestMerchantTransfer")) {
          common_vendor.wx$1.requestMerchantTransfer({
            mchId: payload.mchId,
            appId: payload.appId || common_vendor.wx$1.getAccountInfoSync && common_vendor.wx$1.getAccountInfoSync().miniProgram.appId,
            package: payload.package_info,
            success: (res) => resolve(res),
            fail: (err) => reject(err)
          });
          return;
        }
        reject(new Error("当前微信版本过低，请更新微信后重试"));
      });
    },
    async loadWallet() {
      var _a, _b, _c, _d;
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          this.walletInfo = {
            balance: 1680.5,
            frozen_amount: 200,
            total_income: 8860,
            total_withdraw: 3200
          };
          return;
        }
        const walletObj = common_vendor.tr.importObject("teacher-wallet", { customUI: true });
        const res = await walletObj.getWallet();
        if (res.code === 0 && res.data) {
          this.walletInfo = {
            balance: Number(((_a = res.data.wallet) == null ? void 0 : _a.balance) || 0),
            frozen_amount: Number(((_b = res.data.wallet) == null ? void 0 : _b.frozen_amount) || 0),
            total_income: Number(((_c = res.data.wallet) == null ? void 0 : _c.total_income) || 0),
            total_withdraw: Number(((_d = res.data.wallet) == null ? void 0 : _d.total_withdraw) || 0)
          };
        } else {
          common_vendor.index.showToast({ title: res.message || "获取钱包信息失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/wallet/withdraw.vue:182", "获取钱包信息失败:", error);
        common_vendor.index.showToast({ title: "获取钱包信息失败，请稍后再试", icon: "none" });
      }
    },
    setQuickAmount(amount) {
      const value = Number(amount);
      if (Number.isNaN(value) || value <= 0)
        return;
      if (value > this.availableBalance) {
        common_vendor.index.showToast({ title: "超出可提现金额", icon: "none" });
        return;
      }
      this.withdrawAmount = value.toFixed(2);
    },
    selectMethod(method) {
      this.selectedMethod = method;
    },
    onAmountInput() {
      const raw = this.withdrawAmount.replace(/[^0-9.]/g, "");
      const firstDot = raw.indexOf(".");
      let filtered = raw;
      if (firstDot !== -1) {
        const integerPart = raw.slice(0, firstDot + 1);
        const decimalPart = raw.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
        filtered = integerPart + decimalPart;
      }
      this.withdrawAmount = filtered;
      const amount = Number(filtered);
      if (!Number.isNaN(amount) && amount > this.availableBalance) {
        this.withdrawAmount = this.availableBalance.toFixed(2);
        common_vendor.index.showToast({ title: "超出可提现金额", icon: "none" });
      }
    },
    formatCurrency(value) {
      return Number(value || 0).toFixed(2);
    },
    async submitWithdraw() {
      if (this.submitDisabled || this.isSubmitting)
        return;
      const amount = Number(this.withdrawAmount);
      const content = `提现金额：¥${this.formatCurrency(amount)}
到账方式：微信零钱`;
      try {
        const confirmRes = await new Promise((resolve) => {
          common_vendor.index.showModal({
            title: "确认提现",
            content,
            confirmColor: "#667eea",
            success: (res2) => resolve(res2)
          });
        });
        if (!confirmRes || !confirmRes.confirm)
          return;
        this.isSubmitting = true;
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          common_vendor.index.showToast({ title: "提现申请已提交", icon: "success" });
          this.walletInfo.balance = Math.max(this.availableBalance - amount, 0);
          this.withdrawAmount = "";
          setTimeout(() => {
            common_vendor.index.navigateBack();
          }, 800);
          return;
        }
        const walletObj = common_vendor.tr.importObject("teacher-wallet", { customUI: true });
        const res = await walletObj.applyWithdraw({
          amount,
          method: this.selectedMethod
        });
        if (res.code === 0) {
          const data = res.data || {};
          if (data.status === "wait_confirm" && data.package_info) {
            try {
              await this.requestMerchantTransfer(data);
              await walletObj.syncWithdrawStatus({ withdraw_id: data.withdraw_id || data.request_id });
              common_vendor.index.showToast({ title: "请完成确认后查看到账", icon: "none" });
            } catch (confirmErr) {
              common_vendor.index.showToast({ title: "请到钱包页完成确认收款", icon: "none" });
            }
          } else if (data.status === "completed") {
            common_vendor.index.showToast({ title: "已转入微信零钱", icon: "success" });
          } else {
            common_vendor.index.showToast({ title: res.message || "提现已提交", icon: "success" });
          }
          this.withdrawAmount = "";
          await this.loadWallet();
          setTimeout(() => {
            common_vendor.index.navigateBack();
          }, 800);
        } else {
          common_vendor.index.showToast({ title: res.message || "提现失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages-teacher/wallet/withdraw.vue:278", "提现提交失败:", error);
        common_vendor.index.showToast({ title: "提现申请失败，请稍后再试", icon: "none" });
      } finally {
        this.isSubmitting = false;
      }
    }
  }
};
if (!Array) {
  const _component_card = common_vendor.resolveComponent("card");
  _component_card();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.t($options.formatCurrency($options.availableBalance)),
    b: common_vendor.t($options.formatCurrency($data.walletInfo.frozen_amount || 0)),
    c: common_vendor.t($options.formatCurrency($data.walletInfo.total_withdraw || 0)),
    d: common_vendor.t($options.formatCurrency($data.minAmount)),
    e: common_vendor.o([($event) => $data.withdrawAmount = $event.detail.value, (...args) => $options.onAmountInput && $options.onAmountInput(...args)]),
    f: $data.withdrawAmount,
    g: common_vendor.f($data.quickAmounts, (amount, k0, i0) => {
      return {
        a: common_vendor.t(amount),
        b: amount,
        c: common_vendor.n(amount > $options.availableBalance ? "bg-light-secondary text-light-muted" : "bg-light-secondary main-text-color"),
        d: common_vendor.o(($event) => $options.setQuickAmount(amount), amount)
      };
    }),
    h: common_vendor.o(($event) => $options.setQuickAmount($options.availableBalance)),
    i: common_vendor.p({
      headTitle: "提现金额"
    }),
    j: common_vendor.n($data.selectedMethod === "wxpay" ? "border border-primary" : ""),
    k: common_vendor.o(($event) => $options.selectMethod("wxpay")),
    l: common_vendor.p({
      headTitle: "提现方式"
    }),
    m: common_vendor.t($options.formatCurrency($data.minAmount)),
    n: common_vendor.p({
      headTitle: "到账说明"
    }),
    o: common_vendor.t($data.isSubmitting ? "处理中..." : "立即提现到微信零钱"),
    p: $options.submitDisabled || $data.isSubmitting,
    q: common_vendor.o((...args) => $options.submitWithdraw && $options.submitWithdraw(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-a5295f0a"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/wallet/withdraw.js.map
