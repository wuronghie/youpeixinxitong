"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_appPushMixin = require("../../utils/appPushMixin.js");
const utils_chatPush = require("../../utils/chatPush.js");
const ParentTabBar = () => "../../components/ParentTabBar.js";
const _sfc_main = {
  mixins: [utils_appPushMixin.createAppPushMixin(utils_chatPush.APP_PUSH_TYPES.SYSTEM_MESSAGE)],
  components: {
    ParentTabBar
  },
  data() {
    return {
      tab: "open",
      list: [],
      page: 1,
      pageSize: 20,
      total: 0,
      loading: false,
      _loadSeq: 0
    };
  },
  onShow() {
    this.load(true);
  },
  methods: {
    async refreshData() {
      await this.load(true);
    },
    onAppPushPayload() {
      this.load(true);
    },
    onTabOpen() {
      this.tab = "open";
      this.load(true);
    },
    onTabEnded() {
      this.tab = "ended";
      this.load(true);
    },
    statusText(item) {
      if (item.effective_status === "expired" || item.status === "expired")
        return "已过期";
      if (item.status === "closed")
        return "已关闭";
      const left = item.expire_at ? Math.ceil((item.expire_at - Date.now()) / 864e5) : 0;
      return left > 0 ? `剩余约${left}天` : "即将过期";
    },
    statusClass(item) {
      if (item.effective_status === "expired" || item.status === "expired" || item.status === "closed")
        return "s-muted";
      if (item.audit_status === "rejected")
        return "s-pay";
      if (item.audit_status === "pending")
        return "s-wait";
      return "s-ing";
    },
    auditHint(item) {
      if (item.status !== "open")
        return "";
      const a = item.audit_status;
      if (a === "pending")
        return "审核中";
      if (a === "rejected")
        return "未通过审核";
      return "";
    },
    studentGenderText(gender) {
      if (gender === "male" || gender === 1 || gender === "1")
        return "男孩";
      if (gender === "female" || gender === 2 || gender === "2")
        return "女孩";
      return "";
    },
    metaLine(item) {
      const parts = [];
      parts.push(item.lesson_mode === "online" ? "线上辅导" : "线下辅导");
      const region = item.region || {};
      const place = region.district || region.city || region.name || "";
      if (place && item.lesson_mode !== "online")
        parts.push(place);
      const gender = this.studentGenderText(item.student_gender);
      if (gender)
        parts.push(gender);
      const min = Number(item.budget_min);
      if (Number.isFinite(min) && min > 0)
        parts.push(`${min}元/小时起`);
      const audit = this.auditHint(item);
      if (audit)
        parts.push(audit);
      if (item.time_note)
        parts.push(item.time_note);
      return parts.join(" · ");
    },
    async load(reset) {
      const seq = ++this._loadSeq;
      if (reset) {
        this.page = 1;
        this.list = [];
      }
      this.loading = true;
      try {
        const rc = common_vendor.tr.importObject("recruitment-center", { customUI: true });
        const res = await rc.myList({ tab: this.tab === "open" ? "open" : "ended", page: this.page, pageSize: this.pageSize });
        if (seq !== this._loadSeq)
          return;
        if (res.code !== 0)
          throw new Error(res.message);
        const { list = [], pagination = {} } = res.data || {};
        this.total = pagination.total || 0;
        if (reset) {
          this.list = list;
        } else {
          const seen = new Set(this.list.map((r) => r._id));
          const merged = [...this.list];
          for (const row of list) {
            if (row._id && !seen.has(row._id)) {
              seen.add(row._id);
              merged.push(row);
            }
          }
          this.list = merged;
        }
      } catch (e) {
        if (seq === this._loadSeq) {
          common_vendor.index.showToast({ title: e.message || "加载失败", icon: "none" });
        }
      } finally {
        if (seq === this._loadSeq)
          this.loading = false;
      }
    },
    loadMore() {
      if (this.list.length >= this.total || this.loading)
        return;
      this.page += 1;
      this.load(false);
    },
    goEdit(id) {
      const q = id ? `?id=${id}` : "";
      common_vendor.index.navigateTo({ url: `/pages/recruitment/edit${q}` });
    },
    closeItem(item) {
      common_vendor.index.showModal({
        title: "关闭招募",
        content: "确定结束该条招募吗？",
        success: async (r) => {
          if (!r.confirm)
            return;
          const rc = common_vendor.tr.importObject("recruitment-center", { customUI: true });
          const res = await rc.close({ recruitment_id: item._id, close_reason: "filled" });
          if (res.code === 0) {
            common_vendor.index.showToast({ title: "已关闭" });
            this.load(true);
          } else {
            common_vendor.index.showToast({ title: res.message || "失败", icon: "none" });
          }
        }
      });
    }
  }
};
if (!Array) {
  const _component_ParentTabBar = common_vendor.resolveComponent("ParentTabBar");
  _component_ParentTabBar();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.tab === "open" ? 1 : "",
    b: common_vendor.o((...args) => $options.onTabOpen && $options.onTabOpen(...args)),
    c: $data.tab === "ended" ? 1 : "",
    d: common_vendor.o((...args) => $options.onTabEnded && $options.onTabEnded(...args)),
    e: !$data.list.length && !$data.loading
  }, !$data.list.length && !$data.loading ? common_vendor.e({
    f: common_vendor.t($data.tab === "open" ? "还没有进行中的招募" : "还没有历史招募"),
    g: common_vendor.t($data.tab === "open" ? "先发布一条需求，让合适的老师尽快看到你。" : "结束或过期的招募会展示在这里。"),
    h: $data.tab === "open"
  }, $data.tab === "open" ? {
    i: common_vendor.o(($event) => $options.goEdit())
  } : {}) : {}, {
    j: common_vendor.f($data.list, (item, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(item.subject),
        b: common_vendor.t(item.student_grade),
        c: common_vendor.t($options.metaLine(item)),
        d: common_vendor.t($options.statusText(item)),
        e: common_vendor.n($options.statusClass(item)),
        f: common_vendor.t(item.goal || item.remark || "暂未填写补充说明"),
        g: $data.tab === "open" && item.status === "open"
      }, $data.tab === "open" && item.status === "open" ? {
        h: common_vendor.o(($event) => $options.goEdit(item._id), item._id),
        i: common_vendor.o(($event) => $options.closeItem(item), item._id)
      } : {}, {
        j: item._id,
        k: item.effective_status === "expired" || $data.tab === "ended" ? 1 : ""
      });
    }),
    k: $data.loading
  }, $data.loading ? {} : {}, {
    l: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args)),
    m: common_vendor.o(($event) => $options.goEdit()),
    n: common_vendor.p({
      current: "recruitment"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-61830342"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/recruitment/list.js.map
