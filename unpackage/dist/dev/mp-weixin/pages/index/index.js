"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_auth = require("../../utils/auth.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const _sfc_main = {
  name: "Startup",
  data() {
    return {
      logoUrl: utils_imageConfig.getLogoUrl(),
      loadingText: "正在加载，请稍候...",
      isBootstrapping: false,
      hasBootstrapped: false
    };
  },
  onShareAppMessage() {
    return {
      title: "优培信息通",
      path: "/pages/index/index"
    };
  },
  onShareTimeline() {
    return {
      title: "优培信息通"
    };
  },
  onLoad() {
    this.$nextTick(() => {
      setTimeout(() => {
        this.bootstrap();
      }, 300);
    });
  },
  async onShow() {
    if (this.isBootstrapping || this.hasBootstrapped) {
      return;
    }
    setTimeout(() => {
      this.bootstrap();
    }, 300);
  },
  methods: {
    async bootstrap() {
      if (this.isBootstrapping || this.hasBootstrapped) {
        return;
      }
      this.isBootstrapping = true;
      const minDisplayTime = 1500;
      const startTime = Date.now();
      try {
        const cachedInfo = utils_auth.getStoredUserInfo();
        const token = common_vendor.index.getStorageSync("uni_id_token");
        if (token) {
          try {
            const freshInfo = await utils_auth.fetchRemoteUserInfo({ token });
            if (freshInfo && freshInfo.role) {
              await this.finishWithUser(freshInfo, startTime, minDisplayTime);
              return;
            }
          } catch (error) {
            common_vendor.index.__f__("warn", "at pages/index/index.vue:78", "自动登录失败，尝试使用本地信息", error);
            if (/token/.test(error.message || "")) {
              utils_auth.clearStoredAuth();
            }
          }
        }
        if (cachedInfo && cachedInfo.uid && cachedInfo.role) {
          await this.finishWithUser(cachedInfo, startTime, minDisplayTime);
          return;
        }
        this.scheduleLogin(startTime, minDisplayTime);
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/index/index.vue:92", "启动失败:", error);
        this.scheduleLogin(startTime, minDisplayTime);
      } finally {
        this.isBootstrapping = false;
      }
    },
    async finishWithUser(userInfo, startTime, minDisplayTime) {
      this.hasBootstrapped = true;
      const profileCheck = await utils_auth.checkProfileComplete(userInfo);
      if (!profileCheck.isComplete) {
        common_vendor.index.showModal({
          title: "提示",
          content: profileCheck.message,
          confirmText: "去完善",
          cancelText: "稍后",
          success: (res) => {
            setTimeout(() => {
              if (res.confirm) {
                common_vendor.index.reLaunch({ url: profileCheck.redirectUrl || "/pages/common/register" });
              } else {
                utils_auth.redirectByRole(userInfo.role);
              }
            }, 100);
          }
        });
        return;
      }
      const remaining = Math.max(0, minDisplayTime - (Date.now() - startTime));
      setTimeout(() => {
        utils_auth.redirectByRole(userInfo.role);
      }, remaining);
    },
    scheduleLogin(startTime, minDisplayTime) {
      this.hasBootstrapped = true;
      const remaining = Math.max(0, minDisplayTime - (Date.now() - startTime));
      setTimeout(() => {
        this.goToLogin();
      }, remaining);
    },
    goToLogin() {
      this.loadingText = "正在进入登录页...";
      setTimeout(() => {
        common_vendor.index.reLaunch({ url: "/pages/login/index" });
      }, 300);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: $data.logoUrl,
    b: common_vendor.t($data.loadingText)
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1cf27b2a"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map
