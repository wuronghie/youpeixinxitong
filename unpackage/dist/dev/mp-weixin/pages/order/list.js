"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const _sfc_main = {
  name: "OrderList",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  data() {
    return {
      statusTabs: [
        { label: "全部订单", value: "all" },
        { label: "待支付", value: "unpaid" },
        { label: "已支付", value: "paid" },
        { label: "退款中", value: "refunding" },
        { label: "已退款", value: "refunded" }
      ],
      currentStatus: "all",
      orderList: [],
      isLoading: false,
      isRefreshing: false,
      scrollTop: 0,
      canRefresh: true,
      currentPage: 1,
      pageSize: 10,
      hasMore: true
    };
  },
  onLoad(options) {
    if (options.status) {
      this.currentStatus = options.status;
    }
    this.loadOrders(true);
  },
  methods: {
    async refreshData() {
      common_vendor.index.__f__("log", "at pages/order/list.vue:142", "[order-list] 下拉刷新：重新加载列表");
      await this.loadOrders(true);
    },
    async loadOrders(reset = false) {
      if (this.isLoading)
        return;
      if (reset) {
        this.currentPage = 1;
        this.orderList = [];
        this.hasMore = true;
      }
      if (!this.hasMore && !reset)
        return;
      this.isLoading = true;
      try {
        const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
        const res = await paymentCreate.getOrderList({
          status: this.currentStatus === "all" ? void 0 : this.currentStatus,
          page: this.currentPage,
          pageSize: this.pageSize
        });
        if (res.code === 0) {
          const list = (res.data.list || []).map((item) => {
            var _a;
            return {
              _id: item._id,
              order_no: item.order_no,
              order_type: item.order_type,
              amount: Number(item.amount || item.total_amount || 0),
              status: item.status,
              create_time: item.create_time || Date.now(),
              appointment_id: item.appointment_id,
              appointment_no: (_a = item.appointment_info) == null ? void 0 : _a.appointment_no
            };
          });
          if (reset) {
            this.orderList = list;
          } else {
            this.orderList = [...this.orderList, ...list];
          }
          const pagination = res.data.pagination || {};
          this.hasMore = pagination.hasMore !== void 0 ? pagination.hasMore : list.length >= this.pageSize;
          this.currentPage = pagination.page ? pagination.page + 1 : this.currentPage + 1;
        } else {
          throw new Error(res.message || "获取订单列表失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/order/list.vue:185", "获取订单列表失败:", error);
        common_vendor.index.showToast({ title: error.message || "获取订单失败", icon: "none" });
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
      }
    },
    handleScroll(e) {
      this.scrollTop = e.detail.scrollTop;
      this.canRefresh = e.detail.scrollTop <= 10;
    },
    handleScrollToUpper() {
      this.scrollTop = 0;
      this.canRefresh = true;
    },
    onRefresh() {
      if (!this.canRefresh || this.scrollTop > 10) {
        this.isRefreshing = false;
        return;
      }
      if (this.isRefreshing)
        return;
      this.isRefreshing = true;
      this.loadOrders(true);
    },
    loadMore() {
      if (this.hasMore && !this.isLoading) {
        this.loadOrders();
      }
    },
    switchStatus(status) {
      if (this.currentStatus === status)
        return;
      this.currentStatus = status;
      this.loadOrders(true);
    },
    formatStatus(status) {
      const map = {
        unpaid: "待支付",
        pending: "待支付",
        paid: "已支付",
        success: "已支付",
        refunding: "退款中",
        refunded: "已退款"
      };
      return map[status] || "未知状态";
    },
    formatOrderType(type) {
      const map = {
        trial: "试课订单",
        regular: "正式课程订单",
        deposit: "信息费",
        refund: "退款订单"
      };
      return map[type] || "课程订单";
    },
    formatTime(ts) {
      const date = new Date(ts || Date.now());
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}`;
    },
    getStatusClass(status) {
      const map = {
        unpaid: "status-unpaid",
        pending: "status-unpaid",
        paid: "status-paid",
        success: "status-paid",
        refunding: "status-refunding",
        refunded: "status-refunded"
      };
      return map[status] || "status-default";
    },
    goToDetail(orderId) {
      if (!orderId)
        return;
      common_vendor.index.navigateTo({ url: `/pages/order/detail?id=${orderId}` });
    },
    goToPayment(orderId) {
      this.goToDetail(orderId);
    },
    goAppointment(appointmentId) {
      if (!appointmentId) {
        common_vendor.index.showToast({ title: "预约信息未关联", icon: "none" });
        return;
      }
      common_vendor.index.navigateTo({ url: `/pages/appointment/detail?id=${appointmentId}` });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.f($data.statusTabs, (tab, index, i0) => {
      return {
        a: common_vendor.t(tab.label),
        b: common_vendor.n($data.currentStatus === tab.value ? "tab-active" : ""),
        c: index,
        d: common_vendor.o(($event) => $options.switchStatus(tab.value), index)
      };
    }),
    b: $data.isLoading && !$data.orderList.length
  }, $data.isLoading && !$data.orderList.length ? {
    c: common_vendor.f(4, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : common_vendor.e({
    d: common_vendor.f($data.orderList, (order, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t($options.formatTime(order.create_time)),
        b: common_vendor.t($options.formatStatus(order.status)),
        c: common_vendor.n($options.getStatusClass(order.status)),
        d: common_vendor.t(order.order_no),
        e: common_vendor.t($options.formatOrderType(order.order_type)),
        f: common_vendor.t(order.amount.toFixed(2)),
        g: order.appointment_id
      }, order.appointment_id ? {
        h: common_vendor.t(order.appointment_no || "查看预约"),
        i: common_vendor.o(($event) => $options.goAppointment(order.appointment_id), order._id)
      } : {}, {
        j: order.status === "unpaid" || order.status === "pending"
      }, order.status === "unpaid" || order.status === "pending" ? {
        k: common_vendor.o(($event) => $options.goToPayment(order._id), order._id)
      } : {}, {
        l: common_vendor.o(($event) => $options.goToDetail(order._id), order._id),
        m: order._id,
        n: common_vendor.o(($event) => $options.goToDetail(order._id), order._id)
      });
    }),
    e: !$data.orderList.length && !$data.isLoading
  }, !$data.orderList.length && !$data.isLoading ? {} : {}, {
    f: $data.isLoading && $data.orderList.length
  }, $data.isLoading && $data.orderList.length ? {} : !$data.hasMore && $data.orderList.length ? {} : {}, {
    g: !$data.hasMore && $data.orderList.length
  }), {
    h: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-456ecf67"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/order/list.js.map
