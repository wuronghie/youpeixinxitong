"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  props: {
    bodyStyle: String,
    // 头部标题
    headTitle: String,
    // 封面图
    bodyCover: String,
    // 是否显示头部
    showhead: {
      type: Boolean,
      default: true
    },
    // 是否显示下边线
    headBorderBottom: {
      type: Boolean,
      default: true
    },
    // 标题是否加粗
    headTitleWeight: {
      type: Boolean,
      default: true
    },
    // 是否给body加padding
    bodyPadding: {
      type: Boolean,
      default: false
    },
    cardStyle: {
      type: String,
      default: ""
    }
  },
  computed: {
    getHeadClass() {
      let BorderBottom = this.headBorderBottom ? "border-bottom" : "";
      return `${BorderBottom}`;
    },
    getBodyClass() {
      let padding = this.bodyPadding ? "p-3" : "";
      return `${padding}`;
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $props.showhead
  }, $props.showhead ? common_vendor.e({
    b: $props.headTitle
  }, $props.headTitle ? {
    c: common_vendor.t($props.headTitle),
    d: common_vendor.n($props.headTitleWeight ? "font-weight" : "")
  } : {}, {
    e: common_vendor.n($options.getHeadClass)
  }) : {}, {
    f: $props.bodyCover
  }, $props.bodyCover ? {
    g: $props.bodyCover
  } : {}, {
    h: common_vendor.n($options.getBodyClass),
    i: common_vendor.s($props.bodyStyle),
    j: common_vendor.s($props.cardStyle)
  });
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createComponent(Component);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/components/common/card.js.map
