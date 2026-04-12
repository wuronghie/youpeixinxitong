"use strict";
const common_vendor = require("../common/vendor.js");
const utils_imageConfig = require("../utils/imageConfig.js");
const _sfc_main = {
  name: "ParentTabBar",
  props: {
    current: {
      type: String,
      default: ""
    }
  },
  data() {
    return {
      navItems: [
        {
          key: "teacher",
          label: "找教师",
          icon: utils_imageConfig.getIconUrl("teacher.png"),
          activeIcon: utils_imageConfig.getIconUrl("teacher-active.png"),
          path: "/pages/teacher/list"
        },
        {
          key: "appointment",
          label: "预约",
          icon: utils_imageConfig.getIconUrl("calendar.png"),
          activeIcon: utils_imageConfig.getIconUrl("calendar-active.png"),
          path: "/pages/appointment/list"
        },
        {
          key: "recruitment",
          label: "招募",
          icon: utils_imageConfig.getIconUrl("chat.png"),
          activeIcon: utils_imageConfig.getIconUrl("chat-active.png"),
          path: "/pages/recruitment/list",
          center: true
        },
        {
          key: "chat",
          label: "消息",
          icon: utils_imageConfig.getIconUrl("chat.png"),
          activeIcon: utils_imageConfig.getIconUrl("chat-active.png"),
          path: "/pages/chat/list"
        },
        {
          key: "user",
          label: "我的",
          icon: utils_imageConfig.getIconUrl("user.png"),
          activeIcon: utils_imageConfig.getIconUrl("user-active.png"),
          path: "/pages/user/index"
        }
      ]
    };
  },
  methods: {
    handleClick(item) {
      if (item.key === this.current) {
        return;
      }
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const currentPath = "/" + currentPage.route;
      if (currentPath === item.path) {
        return;
      }
      setTimeout(() => {
        common_vendor.index.redirectTo({
          url: item.path,
          fail: (err) => {
            common_vendor.index.__f__("warn", "at components/ParentTabBar.vue:107", "redirectTo 失败，尝试使用 navigateTo:", err);
            common_vendor.index.navigateTo({
              url: item.path,
              fail: (navErr) => {
                common_vendor.index.__f__("error", "at components/ParentTabBar.vue:112", "页面导航失败:", navErr);
              }
            });
          }
        });
      }, 10);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.f($data.navItems, (item, k0, i0) => {
      return common_vendor.e({
        a: item.center
      }, item.center ? {
        b: item.key === $props.current ? item.activeIcon : item.icon,
        c: common_vendor.t(item.label)
      } : {
        d: item.key === $props.current ? item.activeIcon : item.icon,
        e: common_vendor.t(item.label)
      }, {
        f: item.key,
        g: item.key === $props.current ? 1 : "",
        h: item.center ? 1 : "",
        i: common_vendor.o(($event) => $options.handleClick(item), item.key)
      });
    })
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-8fb1af6f"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/ParentTabBar.js.map
