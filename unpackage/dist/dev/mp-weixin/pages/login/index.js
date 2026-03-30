"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_auth = require("../../utils/auth.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const _sfc_main = {
  name: "Login",
  data() {
    return {
      // Logo图片URL（使用CDN）
      logoUrl: utils_imageConfig.getLogoUrl(),
      // 当前选中的角色：'parent'（家长）或 'teacher'（教师）
      selectedRole: "",
      // 是否正在登录中，用于防止重复点击
      isLogging: false,
      // 是否已勾选同意用户协议和隐私政策
      hasAgreed: false,
      // 角色选项配置
      // 修改提示：可以在这里添加更多角色，如管理员、机构等
      roleOptions: [
        {
          value: "parent",
          // 角色值，对应后端数据库中的role字段
          label: "家长",
          // 显示名称
          desc: "快速匹配合适教师",
          // 角色描述
          iconName: "family"
          // 角色图标文件名（不含扩展名）
        },
        {
          value: "teacher",
          label: "教师",
          desc: "获取更多预约",
          iconName: "teacher-large"
        }
      ]
    };
  },
  /**
   * 页面加载时触发
   * 功能：恢复上次选择的角色，提升用户体验
   */
  onLoad(options) {
    const lastRole = common_vendor.index.getStorageSync("last_role");
    if (lastRole) {
      this.selectedRole = lastRole;
    }
    if (options && options.inviteCode) {
      common_vendor.index.setStorageSync("pending_invite_code", options.inviteCode);
    }
  },
  onShareAppMessage() {
    return {
      title: "叁谦 · 家教帮登录",
      path: "/pages/login/index"
    };
  },
  onShareTimeline() {
    return {
      title: "叁谦 · 家教帮登录"
    };
  },
  methods: {
    /**
     * 获取角色图标URL
     * @param {String} iconName 图标文件名
     * @returns {String} 图标完整URL
     */
    getRoleIconUrl(iconName) {
      return utils_imageConfig.getIconUrl(`${iconName}.png`);
    },
    /**
     * 选择角色
     * @param {String} role - 角色值：'parent' 或 'teacher'
     */
    selectRole(role) {
      this.selectedRole = role;
    },
    /**
     * 协议勾选变化
     */
    onAgreementChange(e) {
      const values = e.detail.value || [];
      this.hasAgreed = values.includes("agree");
    },
    /**
     * 处理登录逻辑
     * 流程：
     *   1. 检查是否已选择角色
     *   2. 调用微信登录获取code
     *   3. 调用云函数进行登录验证
     *   4. 保存token和用户信息
     *   5. 检查资料完整性并跳转
     * 
     * 修改提示：
     *   - 可以在这里添加其他登录方式（手机号、账号密码等）
     *   - 可以添加登录前的验证逻辑（如协议同意检查）
     *   - 可以添加登录统计、埋点等
     */
    async handleLogin() {
      if (this.isLogging) {
        return;
      }
      if (!this.selectedRole) {
        common_vendor.index.showToast({ title: "请先选择身份", icon: "none" });
        return;
      }
      if (!this.hasAgreed) {
        common_vendor.index.showToast({ title: "请先阅读并勾选同意《用户协议》和《隐私政策》", icon: "none" });
        return;
      }
      common_vendor.index.__f__("log", "at pages/login/index.vue:214", "[login] 使用角色:", this.selectedRole);
      this.isLogging = true;
      try {
        const loginRes = await new Promise((resolve, reject) => {
          common_vendor.index.login({ provider: "weixin", success: resolve, fail: reject });
        });
        common_vendor.index.__f__("log", "at pages/login/index.vue:220", "[login] 获取到微信code:", loginRes.code);
        const userLogin = common_vendor.tr.importObject("user-login", { customUI: true });
        const res = await userLogin.login({ code: loginRes.code, role: this.selectedRole });
        common_vendor.index.__f__("log", "at pages/login/index.vue:224", "[login] 云函数返回:", res);
        if (res.code === 0) {
          let { token, userInfo } = res.data;
          if (token) {
            common_vendor.index.setStorageSync("uni_id_token", token);
            common_vendor.index.setStorageSync("token", token);
          }
          if (userInfo) {
            utils_auth.setStoredUserInfo(userInfo);
          }
          common_vendor.index.setStorageSync("last_role", this.selectedRole);
          common_vendor.index.showToast({ title: "登录成功", icon: "success" });
          try {
            const freshInfo = await utils_auth.fetchRemoteUserInfo({ token });
            userInfo = freshInfo || userInfo;
          } catch (fetchError) {
            common_vendor.index.__f__("warn", "at pages/login/index.vue:242", "获取最新用户信息失败，使用登录返回的数据", fetchError);
          }
          if (userInfo && userInfo.role) {
            if (userInfo.role === "parent") {
              const pendingCode = common_vendor.index.getStorageSync("pending_invite_code");
              if (pendingCode) {
                try {
                  const inviteCenter = common_vendor.tr.importObject("invite-center", { customUI: true });
                  await inviteCenter.acceptInvite({ invite_code: pendingCode });
                  common_vendor.index.removeStorageSync("pending_invite_code");
                } catch (inviteErr) {
                  common_vendor.index.__f__("error", "at pages/login/index.vue:254", "[login] 处理邀请关系失败:", inviteErr);
                }
              }
            }
            const profileCheck = await utils_auth.checkProfileComplete(userInfo);
            common_vendor.index.__f__("log", "at pages/login/index.vue:261", "[login] 信息检查结果:", profileCheck);
            utils_auth.redirectByRole(userInfo.role);
            if (!profileCheck.isComplete) {
              setTimeout(() => {
                common_vendor.index.showModal({
                  title: "提示",
                  content: profileCheck.message || "请完善您的资料信息",
                  confirmText: "去完善",
                  cancelText: "稍后",
                  success: (res2) => {
                    if (res2.confirm && profileCheck.redirectUrl) {
                      common_vendor.index.navigateTo({ url: profileCheck.redirectUrl });
                    }
                  }
                });
              }, 1e3);
            }
          } else {
            common_vendor.index.reLaunch({ url: "/pages/index/index" });
          }
        } else {
          common_vendor.index.showToast({ title: res.message || "登录失败", icon: "none" });
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/login/index.vue:290", "登录失败:", error);
        common_vendor.index.showToast({ title: "登录失败，请稍后再试", icon: "none" });
      } finally {
        this.isLogging = false;
      }
    },
    /**
     * 打开协议页面
     * @param {String} type - 协议类型：'service'（用户协议）或 'privacy'（隐私政策）
     * 修改提示：如果协议页面不存在，可以改为打开外部链接或显示弹窗
     */
    openAgreement(type) {
      const url = type === "service" ? "/pages/common/agreement?type=service" : "/pages/common/agreement?type=privacy";
      common_vendor.index.navigateTo({ url });
    },
    skipLogin() {
      common_vendor.index.reLaunch({ url: "/pages/teacher/list" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.logoUrl,
    b: common_vendor.f($data.roleOptions, (role, k0, i0) => {
      return common_vendor.e({
        a: $options.getRoleIconUrl(role.iconName),
        b: common_vendor.t(role.label),
        c: common_vendor.n($data.selectedRole === role.value ? "text-white" : "text-dark"),
        d: common_vendor.t(role.desc),
        e: common_vendor.n($data.selectedRole === role.value ? "text-white" : "text-light-muted"),
        f: $data.selectedRole === role.value
      }, $data.selectedRole === role.value ? {} : {}, {
        g: role.value,
        h: common_vendor.n($data.selectedRole === role.value ? "main-bg-color" : "bg-light"),
        i: common_vendor.o(($event) => $options.selectRole(role.value), role.value)
      });
    }),
    c: $data.isLogging
  }, $data.isLogging ? {} : {}, {
    d: common_vendor.n(!$data.selectedRole || $data.isLogging ? "bg-light-secondary text-muted" : ""),
    e: common_vendor.o((...args) => $options.handleLogin && $options.handleLogin(...args)),
    f: common_vendor.o((...args) => $options.skipLogin && $options.skipLogin(...args)),
    g: $data.hasAgreed,
    h: common_vendor.o(($event) => $options.openAgreement("service")),
    i: common_vendor.o(($event) => $options.openAgreement("privacy")),
    j: common_vendor.o((...args) => $options.onAgreementChange && $options.onAgreementChange(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-d08ef7d4"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/login/index.js.map
