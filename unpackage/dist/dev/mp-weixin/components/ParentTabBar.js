"use strict";
const common_vendor = require("../common/vendor.js");
const utils_imageConfig = require("../utils/imageConfig.js");
const utils_chatPoll = require("../utils/chatPoll.js");
const utils_chatPush = require("../utils/chatPush.js");
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
      ],
      unreadChatCount: 0,
      badgePollTimer: null
    };
  },
  computed: {
    unreadBadgeText() {
      const n = Number(this.unreadChatCount || 0);
      if (n <= 0)
        return "";
      return n > 99 ? "99+" : String(n);
    }
  },
  mounted() {
    this.unreadChatCount = utils_chatPush.getCachedUnreadCount();
    this.loadUnreadChat();
    this.startBadgePolling();
    this.bindChatPush();
  },
  beforeUnmount() {
    this.stopBadgePolling();
    this.unbindChatPush();
  },
  methods: {
    bindChatPush() {
      if (this._onChatPush)
        return;
      this._onChatPush = (payload) => {
        common_vendor.index.__f__("log", "at components/ParentTabBar.vue:125", "[ParentTabBar] 收到 push，刷新角标", payload);
        this.loadUnreadChat();
      };
      this._onChatBadge = (count) => {
        common_vendor.index.__f__("log", "at components/ParentTabBar.vue:129", "[ParentTabBar] 收到 badge 事件", count);
        this.unreadChatCount = Math.max(0, Number(count) || 0);
      };
      utils_chatPush.onChatPush(this._onChatPush);
      utils_chatPush.onChatBadge(this._onChatBadge);
    },
    unbindChatPush() {
      if (this._onChatPush) {
        utils_chatPush.offChatPush(this._onChatPush);
        this._onChatPush = null;
      }
      if (this._onChatBadge) {
        utils_chatPush.offChatBadge(this._onChatBadge);
        this._onChatBadge = null;
      }
    },
    startBadgePolling() {
      this.stopBadgePolling();
      this.badgePollTimer = setInterval(() => {
        this.loadUnreadChat();
      }, utils_chatPoll.CHAT_POLL_INTERVAL.badge);
    },
    stopBadgePolling() {
      if (this.badgePollTimer) {
        clearInterval(this.badgePollTimer);
        this.badgePollTimer = null;
      }
    },
    async loadUnreadChat() {
      var _a;
      try {
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.pollUpdates({ mode: "badge" });
        common_vendor.index.__f__("log", "at components/ParentTabBar.vue:162", "[ParentTabBar] loadUnreadChat=", res);
        if (res.code === 0) {
          this.unreadChatCount = Math.max(0, Number(((_a = res.data) == null ? void 0 : _a.unreadMessages) || 0));
        }
      } catch (e) {
        this.unreadChatCount = 0;
      }
    },
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
            common_vendor.index.__f__("warn", "at components/ParentTabBar.vue:191", "redirectTo 失败，尝试使用 navigateTo:", err);
            common_vendor.index.navigateTo({
              url: item.path,
              fail: (navErr) => {
                common_vendor.index.__f__("error", "at components/ParentTabBar.vue:196", "页面导航失败:", navErr);
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
      } : common_vendor.e({
        d: item.key === $props.current ? item.activeIcon : item.icon,
        e: item.key === "chat" && $data.unreadChatCount > 0
      }, item.key === "chat" && $data.unreadChatCount > 0 ? {
        f: common_vendor.t($options.unreadBadgeText),
        g: $data.unreadChatCount > 9 ? 1 : ""
      } : {}, {
        h: common_vendor.t(item.label)
      }), {
        i: item.key,
        j: item.key === $props.current ? 1 : "",
        k: item.center ? 1 : "",
        l: common_vendor.o(($event) => $options.handleClick(item), item.key)
      });
    })
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-8fb1af6f"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/ParentTabBar.js.map
