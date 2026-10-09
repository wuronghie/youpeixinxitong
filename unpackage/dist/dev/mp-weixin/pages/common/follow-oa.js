"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_oaFollow = require("../../utils/oaFollow.js");
const utils_oaBind = require("../../utils/oaBind.js");
const _sfc_main = {
  data() {
    return {
      oaName: "服务号",
      bound: false,
      bindReason: "",
      opening: false,
      syncing: false,
      boundChecked: false
    };
  },
  computed: {
    boundText() {
      if (!this.boundChecked)
        return "检测中…";
      if (this.bound)
        return "已绑定，可接收通知";
      if (this.bindReason === "unsubscribed")
        return "已取消关注";
      return "未绑定，请先关注";
    }
  },
  onShow() {
    this.initMeta();
    this.refreshBind();
  },
  methods: {
    async initMeta() {
      const meta = await utils_oaFollow.loadOaFollowMeta(true);
      this.oaName = meta.oaName || "服务号";
    },
    async refreshBind() {
      this.syncing = true;
      try {
        const res = await utils_oaBind.syncOaBind({ force: true, minIntervalMs: 0 });
        this.bound = !!(res && res.code === 0 && res.data && res.data.bound);
        this.bindReason = res && res.data && res.data.reason || "";
      } catch (e) {
        this.bound = false;
        this.bindReason = "";
      } finally {
        this.boundChecked = true;
        this.syncing = false;
      }
    },
    async onFollow() {
      if (this.opening)
        return;
      this.opening = true;
      try {
        await utils_oaFollow.openOfficialAccountFollow();
      } finally {
        this.opening = false;
      }
    },
    async onSync() {
      await this.refreshBind();
      common_vendor.index.showToast({
        title: this.bound ? "绑定成功" : this.bindReason === "unsubscribed" ? "已取消关注" : "尚未检测到关注",
        icon: this.bound ? "success" : "none"
      });
    },
    onOaCompLoad() {
      common_vendor.index.__f__("log", "at pages/common/follow-oa.vue:107", "[follow-oa] official-account load");
    },
    onOaCompError(e) {
      common_vendor.index.__f__("log", "at pages/common/follow-oa.vue:110", "[follow-oa] official-account error", e);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.t($data.oaName || "服务号"),
    b: common_vendor.t($options.boundText),
    c: $data.bound ? 1 : "",
    d: $data.boundChecked && !$data.bound ? 1 : "",
    e: $data.opening,
    f: common_vendor.o((...args) => $options.onFollow && $options.onFollow(...args)),
    g: $data.syncing,
    h: common_vendor.o((...args) => $options.onSync && $options.onSync(...args)),
    i: common_vendor.o((...args) => $options.onOaCompLoad && $options.onOaCompLoad(...args)),
    j: common_vendor.o((...args) => $options.onOaCompError && $options.onOaCompError(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-30054922"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/common/follow-oa.js.map
