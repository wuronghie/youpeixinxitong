"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const ParentTabBar = () => "../../components/ParentTabBar.js";
const _sfc_main = {
  name: "AppointmentList",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  components: {
    ParentTabBar
  },
  data() {
    return {
      // 状态选项卡配置
      // 修改提示：可以在这里添加更多状态，如"已取消"、"退款中"等
      statusTabs: [
        { label: "全部预约", value: "all" },
        { label: "待支付", value: "pending_payment" },
        { label: "待确认", value: "pending_confirm" },
        { label: "已确认", value: "confirmed" },
        { label: "进行中", value: "in_progress" },
        { label: "已完成", value: "completed" }
      ],
      // 当前选中的状态筛选（'all' 表示全部）
      currentStatus: "all",
      // 预约列表数据
      appointmentList: [],
      // 是否正在加载（首次加载）
      isLoading: false,
      // 是否正在刷新（下拉刷新）
      isRefreshing: false,
      // 当前页码
      currentPage: 1,
      // 每页数据量
      pageSize: 10,
      // 是否还有更多数据
      hasMore: true,
      // 滚动位置（用于下拉刷新判断）
      scrollTop: 0,
      // 是否可以刷新（滚动位置在顶部时才能刷新）
      canRefresh: true
    };
  },
  /**
   * 页面加载时触发
   * @param {Object} options - 页面参数
   * @param {String} options.status - 初始状态筛选（从其他页面跳转时传递）
   * 功能：根据传入的状态参数初始化页面，加载预约列表
   */
  onLoad(options) {
    if (options.status) {
      this.currentStatus = options.status;
    }
    this.$nextTick(() => {
      setTimeout(() => {
        this.loadAppointments(true);
      }, 50);
    });
  },
  onShareAppMessage() {
    return {
      title: "优培信息通 · 我的预约",
      path: "/pages/appointment/list"
    };
  },
  onShareTimeline() {
    return {
      title: "优培信息通 · 我的预约"
    };
  },
  methods: {
    /**
     * 下拉刷新数据
     * 功能：重新加载第一页数据
     */
    async refreshData() {
      common_vendor.index.__f__("log", "at pages/appointment/list.vue:204", "[appointment-list] 下拉刷新：重新加载列表");
      await this.loadAppointments(true);
    },
    /**
     * 加载预约列表
     * @param {Boolean} reset - 是否重置（重置页码和列表）
     * 功能：
     *   1. 根据当前状态筛选获取预约列表
     *   2. 支持分页加载
     *   3. 处理数据映射和格式化
     * 
     * 修改提示：
     *   - 修改分页大小：修改 pageSize 的值
     *   - 修改查询参数：修改传递给云函数的参数
     *   - 修改数据映射：修改 map 函数中的字段映射逻辑
     */
    async loadAppointments(reset = false) {
      if (this.isLoading)
        return;
      if (reset) {
        this.currentPage = 1;
        this.appointmentList = [];
        this.hasMore = true;
      }
      if (!this.hasMore && !reset)
        return;
      this.isLoading = true;
      try {
        const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const res = await appointmentQuery.getParentAppointments({
          // 家长端不展示联系请求（contact_request）和试课邀请（trial_invited），仅展示真实预约记录
          // 试课邀请在家长没有填写并确认预约前不应该显示在预约列表里
          status: this.currentStatus === "all" ? void 0 : this.currentStatus,
          page: this.currentPage,
          pageSize: this.pageSize
        });
        if (res.code === 0) {
          const list = (res.data.list || []).filter((item) => item.status !== "contact_request" && item.status !== "trial_invited").map((item) => {
            var _a, _b, _c;
            return {
              _id: item._id,
              teacher_name: ((_a = item.teacher_info) == null ? void 0 : _a.display_name) || ((_b = item.teacher_info) == null ? void 0 : _b.name) || "教师",
              date: item.date || item.appointment_date,
              time: item.start_time || item.appointment_time,
              course_type: item.course_type,
              amount: item.total_amount || item.total_fee || 0,
              subject: item.subject || ((_c = item.student_info) == null ? void 0 : _c.subject) || "",
              status: item.status,
              parent_paid: !!item.parent_paid,
              deposit_paid: !!item.deposit_paid,
              invited_by: item.invited_by || ""
            };
          });
          if (reset) {
            this.appointmentList = list;
          } else {
            this.appointmentList = [...this.appointmentList, ...list];
          }
          const pagination = res.data.pagination || {};
          this.hasMore = pagination.hasMore !== void 0 ? pagination.hasMore : list.length >= this.pageSize;
          this.currentPage += 1;
        } else {
          throw new Error(res.message || "获取预约失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/appointment/list.vue:269", "获取预约列表失败:", error);
        common_vendor.index.showToast({ title: error.message || "获取预约失败", icon: "none" });
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
      this.loadAppointments(true);
    },
    loadMore() {
      if (this.hasMore && !this.isLoading) {
        this.loadAppointments();
      }
    },
    /**
     * 切换状态筛选
     * @param {String} status - 状态值（'all'、'pending_payment'、'pending_confirm' 等）
     * 功能：更新选中的状态，重新加载列表
     */
    switchStatus(status) {
      if (this.currentStatus === status)
        return;
      this.currentStatus = status;
      this.loadAppointments(true);
    },
    /**
     * 格式化状态文字
     * @param {String} status - 状态值
     * @returns {String} 状态中文描述
     * 修改提示：可以在这里添加更多状态的映射
     */
    formatStatus(status) {
      const map = {
        pending_payment: "待支付",
        pending_confirm: "待确认",
        contact_request: "待确认",
        confirmed: "已确认",
        in_progress: "进行中",
        completed: "已完成",
        cancelled: "已取消",
        rejected: "已拒绝",
        trial_invited: "试课邀请",
        refunding: "退款处理中",
        refunded: "已退款"
      };
      return map[status] || "未知状态";
    },
    /**
     * 获取状态对应的样式类
     * @param {String} status - 状态值
     * @returns {String} CSS类名
     * 修改提示：可以在这里添加不同状态对应的不同颜色样式
     */
    statusClass(status) {
      const map = {
        pending_payment: "status-badge--warning",
        pending_confirm: "status-badge--warning",
        contact_request: "status-badge--warning",
        confirmed: "status-badge--primary",
        in_progress: "status-badge--primary",
        completed: "status-badge--success",
        rejected: "status-badge--muted",
        cancelled: "status-badge--muted",
        refunding: "status-badge--warning",
        refunded: "status-badge--muted"
      };
      return map[status] || "status-badge--muted";
    },
    /**
     * 格式化课程类型
     * @param {String} type - 课程类型：'regular'（正式课程）或 'trial'（试课体验）
     * @returns {String} 课程类型中文描述
     */
    formatCourseType(type) {
      return type === "regular" ? "正式课程" : "试课体验";
    },
    /**
     * 判断是否可以支付
     * @param {Object} item - 预约对象
     * @returns {Boolean} 是否可以支付
     * 功能：检查预约是否已支付，未支付且状态允许时返回true
     */
    canPay(item) {
      if (!item || item.parent_paid) {
        return false;
      }
      if (item.status === "pending_payment") {
        return true;
      }
      if (item.course_type === "trial" && item.invited_by === "teacher") {
        return ["pending_payment", "pending_confirm", "confirmed"].includes(item.status);
      }
      return item.status === "confirmed";
    },
    /**
     * 跳转到预约详情页
     * @param {String} id - 预约ID
     * 功能：导航到预约详情页面查看详细信息
     */
    goToDetail(id) {
      if (!id)
        return;
      common_vendor.index.navigateTo({ url: `/pages/appointment/detail?id=${id}` });
    },
    /**
     * 跳转到支付页面
     * @param {Object} item - 预约对象
     * 功能：导航到预约详情页面进行支付
     * 修改提示：可以改为跳转到专门的支付页面
     */
    goToPayment(item) {
      this.goToDetail(item._id);
    },
    /**
     * 跳转到找教师页面
     * 功能：引导用户去搜索和选择教师
     */
    goSearch() {
      common_vendor.index.navigateTo({ url: "/pages/teacher/list" });
    }
  }
};
if (!Array) {
  const _component_ParentTabBar = common_vendor.resolveComponent("ParentTabBar");
  _component_ParentTabBar();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.f($data.statusTabs, (tab, index, i0) => {
      return {
        a: common_vendor.t(tab.label),
        b: common_vendor.n($data.currentStatus === tab.value ? "status-tab--active" : "status-tab--inactive"),
        c: index,
        d: common_vendor.o(($event) => $options.switchStatus(tab.value), index)
      };
    }),
    b: $data.isLoading && $data.appointmentList.length === 0
  }, $data.isLoading && $data.appointmentList.length === 0 ? {
    c: common_vendor.f(4, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : common_vendor.e({
    d: common_vendor.f($data.appointmentList, (item, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(item.teacher_name || "教师"),
        b: common_vendor.t($options.formatCourseType(item.course_type)),
        c: common_vendor.t(item.date),
        d: common_vendor.t(item.time),
        e: common_vendor.t($options.formatStatus(item.status)),
        f: common_vendor.n($options.statusClass(item.status)),
        g: common_vendor.t(item.subject || "未填写"),
        h: common_vendor.t(item.amount || 0),
        i: $options.canPay(item)
      }, $options.canPay(item) ? {
        j: common_vendor.o(($event) => $options.goToPayment(item), item._id)
      } : {}, {
        k: item.status === "pending_confirm"
      }, item.status === "pending_confirm" ? {
        l: common_vendor.o(($event) => $options.goToDetail(item._id), item._id)
      } : {}, {
        m: item.status === "completed"
      }, item.status === "completed" ? {} : {}, {
        n: item._id,
        o: common_vendor.o(($event) => $options.goToDetail(item._id), item._id)
      });
    }),
    e: !$data.appointmentList.length && !$data.isLoading
  }, !$data.appointmentList.length && !$data.isLoading ? {
    f: common_vendor.o((...args) => $options.goSearch && $options.goSearch(...args))
  } : {}, {
    g: $data.isLoading && $data.appointmentList.length
  }, $data.isLoading && $data.appointmentList.length ? {} : !$data.hasMore && $data.appointmentList.length ? {} : {}, {
    h: !$data.hasMore && $data.appointmentList.length
  }), {
    i: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args)),
    j: common_vendor.p({
      current: "appointment"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-b294f5c2"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/appointment/list.js.map
