"use strict";
const common_vendor = require("../common/vendor.js");
const PULL_REFRESH_EXCLUDED_ROUTES = [
  "pages/login/index",
  "pages/common/register",
  "pages/common/webview",
  "pages/appointment/create",
  "pages/recruitment/edit",
  "pages/user/profile",
  "pages/review/create",
  "pages/order/refund",
  "pages-teacher/profile/edit",
  "pages-teacher/profile/schedule",
  "pages-teacher/wallet/withdraw",
  "pages/teacher-profiles/add",
  "pages/teacher-profiles/edit",
  "pages/index/index",
  "pages/payment/result",
  "uni_modules/uni-pay/pages/success/success",
  "uni_modules/uni-pay/pages/pay-desk/pay-desk"
];
function getCurrentPageRoute() {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  return page && page.route || "";
}
function isPullRefreshExcluded(route) {
  if (!route)
    return true;
  const path = route.startsWith("/") ? route.slice(1) : route;
  return PULL_REFRESH_EXCLUDED_ROUTES.includes(path);
}
function invokePageRefresh(vm) {
  if (!vm)
    return Promise.resolve();
  if (typeof vm.refreshData === "function") {
    return Promise.resolve(vm.refreshData());
  }
  if (typeof vm.loadDetail === "function") {
    return Promise.resolve(vm.loadDetail());
  }
  if (typeof vm.loadAppointments === "function") {
    return Promise.resolve(vm.loadAppointments());
  }
  if (typeof vm.loadData === "function") {
    return Promise.resolve(vm.loadData(true));
  }
  if (typeof vm.initPage === "function") {
    return Promise.resolve(vm.initPage(true));
  }
  if (typeof vm.load === "function") {
    return Promise.resolve(vm.load(true));
  }
  if (typeof vm.reload === "function") {
    vm.reload();
    return Promise.resolve();
  }
  return Promise.resolve();
}
const pagePullDownRefreshMixin = {
  onPullDownRefresh() {
    const route = getCurrentPageRoute();
    if (isPullRefreshExcluded(route)) {
      common_vendor.index.stopPullDownRefresh();
      return;
    }
    invokePageRefresh(this).finally(() => {
      common_vendor.index.stopPullDownRefresh();
    });
  }
};
exports.pagePullDownRefreshMixin = pagePullDownRefreshMixin;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/pagePullDownRefresh.js.map
