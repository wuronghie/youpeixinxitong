"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_auth = require("../../utils/auth.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const _sfc_main = {
  name: "Startup",
  data() {
    return {
      // Logo图片URL（使用CDN）
      logoUrl: utils_imageConfig.getLogoUrl(),
      // 加载提示文字，可根据不同状态修改
      loadingText: "正在加载，请稍候...",
      // 是否正在执行启动逻辑（防止重复执行）
      isBootstrapping: false,
      // 是否已经完成启动（防止重复跳转）
      hasBootstrapped: false
    };
  },
  onShareAppMessage() {
    return {
      title: "优培信息通 · 家教帮",
      path: "/pages/index/index"
    };
  },
  onShareTimeline() {
    return {
      title: "优培信息通 · 家教帮"
    };
  },
  /**
   * 页面加载时触发
   * 功能：确保页面渲染完成后再开始执行启动逻辑
   */
  onLoad() {
    this.$nextTick(() => {
      setTimeout(() => {
        this.bootstrap();
      }, 300);
    });
  },
  /**
   * 页面显示时触发
   * 功能：如果页面已经加载过，直接执行启动逻辑
   */
  async onShow() {
    if (this.isBootstrapping || this.hasBootstrapped) {
      return;
    }
    if (!this.isBootstrapping) {
      setTimeout(() => {
        this.bootstrap();
      }, 300);
    }
  },
  methods: {
    /**
     * 启动引导方法
     * 功能：
     *   1. 检查是否有有效的登录token
     *   2. 如果有token，尝试获取最新用户信息
     *   3. 检查用户资料是否完善
     *   4. 根据用户角色跳转到对应页面
     *   5. 如果未登录，跳转到登录页
     */
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
              const profileCheck = await utils_auth.checkProfileComplete(freshInfo);
              if (!profileCheck.isComplete) {
                this.hasBootstrapped = true;
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
                        utils_auth.redirectByRole(freshInfo.role);
                      }
                    }, 100);
                  }
                });
                return;
              } else {
                this.hasBootstrapped = true;
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, minDisplayTime - elapsed);
                setTimeout(() => {
                  utils_auth.redirectByRole(freshInfo.role);
                }, remaining);
                return;
              }
            }
          } catch (error) {
            common_vendor.index.__f__("warn", "at pages/index/index.vue:149", "自动登录失败，尝试使用本地信息", error);
            if (/token/.test(error.message || "")) {
              utils_auth.clearStoredAuth();
            }
          }
        }
        if (cachedInfo && cachedInfo.uid && cachedInfo.role) {
          const profileCheck = await utils_auth.checkProfileComplete(cachedInfo);
          if (!profileCheck.isComplete) {
            this.hasBootstrapped = true;
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
                    utils_auth.redirectByRole(cachedInfo.role);
                  }
                }, 100);
              }
            });
          } else {
            this.hasBootstrapped = true;
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, minDisplayTime - elapsed);
            setTimeout(() => {
              utils_auth.redirectByRole(cachedInfo.role);
            }, remaining);
          }
        } else {
          this.hasBootstrapped = true;
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, minDisplayTime - elapsed);
          setTimeout(() => {
            this.goToLogin();
          }, remaining);
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/index/index.vue:198", "启动失败:", error);
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDisplayTime - elapsed);
        this.hasBootstrapped = true;
        setTimeout(() => {
          this.goToLogin();
        }, remaining);
      } finally {
        this.isBootstrapping = false;
      }
    },
    /**
     * 跳转到登录页
     * 修改提示：可以在这里添加登录前的其他逻辑，如统计、埋点等
     */
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
