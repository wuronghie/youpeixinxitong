"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
const utils_trialConfirmReminder = require("./utils/trialConfirmReminder.js");
const utils_pagePullDownRefresh = require("./utils/pagePullDownRefresh.js");
if (!Math) {
  "./pages/index/index.js";
  "./pages/login/index.js";
  "./pages/common/register.js";
  "./pages/common/agreement.js";
  "./pages/common/webview.js";
  "./pages/teacher/list.js";
  "./pages/teacher/detail.js";
  "./pages/appointment/create.js";
  "./pages/appointment/list.js";
  "./pages/appointment/detail.js";
  "./pages/recruitment/list.js";
  "./pages/recruitment/edit.js";
  "./pages/order/list.js";
  "./pages/order/detail.js";
  "./pages/order/refund.js";
  "./pages/review/create.js";
  "./pages/chat/list.js";
  "./pages/chat/conversation.js";
  "./pages/user/index.js";
  "./pages/user/profile.js";
  "./pages/user/collection.js";
  "./pages/user/messages.js";
  "./pages/coupon/list.js";
  "./pages/teacher-profiles/add.js";
  "./pages/teacher-profiles/edit.js";
  "./pages/teacher-profiles/list.js";
  "./pages/payment/result.js";
  "./uni_modules/uni-pay/pages/success/success.js";
  "./uni_modules/uni-pay/pages/pay-desk/pay-desk.js";
  "./pages-teacher/index/index.js";
  "./pages-teacher/appointment/list.js";
  "./pages-teacher/appointment/detail.js";
  "./pages-teacher/appointment/calendar.js";
  "./pages-teacher/profile/index.js";
  "./pages-teacher/profile/edit.js";
  "./pages-teacher/profile/schedule.js";
  "./pages-teacher/wallet/index.js";
  "./pages-teacher/wallet/income.js";
  "./pages-teacher/wallet/withdraw.js";
  "./pages-teacher/coupon/list.js";
  "./pages-teacher/review/list.js";
  "./pages-teacher/recruitment/list.js";
  "./pages-teacher/recruitment/detail.js";
  "./pages-teacher/chat/list.js";
  "./pages-teacher/chat/conversation.js";
  "./pages-teacher/user/index.js";
  "./pages-teacher/user/messages.js";
}
const _sfc_main = {
  onLaunch: function() {
    common_vendor.index.__f__("log", "at App.vue:6", "App Launch");
  },
  onShow: function() {
    common_vendor.index.__f__("log", "at App.vue:9", "App Show");
    setTimeout(() => {
      utils_trialConfirmReminder.checkPendingTrialConfirmReminder();
    }, 600);
  },
  onHide: function() {
    common_vendor.index.__f__("log", "at App.vue:15", "App Hide");
  }
};
function createApp() {
  const app = common_vendor.createSSRApp(_sfc_main);
  app.mixin(utils_pagePullDownRefresh.pagePullDownRefreshMixin);
  return {
    app
  };
}
createApp().app.mount("#app");
exports.createApp = createApp;
//# sourceMappingURL=../.sourcemap/mp-weixin/app.js.map
