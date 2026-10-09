"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_auth = require("../../utils/auth.js");
const utils_coupons = require("../../utils/coupons.js");
const utils_chatPush = require("../../utils/chatPush.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_wxPhone = require("../../utils/wxPhone.js");
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
  computed: {
    canStartWxLogin() {
      let mp = false;
      mp = true;
      return mp && !common_vendor.index.getStorageSync("pending_wx_phone_code") && !!this.selectedRole && this.hasAgreed && !this.isLogging;
    }
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
      title: "优培信息通登录",
      path: "/pages/login/index"
    };
  },
  onShareTimeline() {
    return {
      title: "优培信息通登录"
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
    async onWxLoginPhone(e) {
      await this.handleLogin(e);
    },
    async bindLoginPhone(phoneEvent) {
      const eventCode = phoneEvent && phoneEvent.detail && phoneEvent.detail.code;
      const pendingCode = common_vendor.index.getStorageSync("pending_wx_phone_code");
      const code = eventCode || pendingCode;
      if (!code)
        return "";
      try {
        if (eventCode) {
          const phone2 = await utils_wxPhone.bindWeixinPhoneAndSync(phoneEvent);
          if (pendingCode)
            common_vendor.index.removeStorageSync("pending_wx_phone_code");
          return phone2;
        }
        await utils_wxPhone.bindWeixinPhoneByCode(pendingCode);
        common_vendor.index.removeStorageSync("pending_wx_phone_code");
        const phone = await utils_wxPhone.refreshBoundPhone();
        if (phone)
          utils_wxPhone.persistPickedPhone(phone);
        return phone;
      } catch (error) {
        common_vendor.index.__f__("warn", "at pages/login/index.vue:226", "[login] 绑定手机号失败:", error);
        common_vendor.index.showToast({ title: error && error.message || "手机号授权失败，可稍后在资料里补齐", icon: "none" });
        return "";
      }
    },
    async handleLogin(phoneEvent) {
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
      common_vendor.index.__f__("log", "at pages/login/index.vue:244", "[login] 使用角色:", this.selectedRole);
      this.isLogging = true;
      try {
        const loginRes = await new Promise((resolve, reject) => {
          common_vendor.index.login({ provider: "weixin", success: resolve, fail: reject });
        });
        common_vendor.index.__f__("log", "at pages/login/index.vue:250", "[login] 获取到微信code:", loginRes.code);
        const userLogin = common_vendor.tr.importObject("user-login", { customUI: true });
        const res = await userLogin.login({ code: loginRes.code, role: this.selectedRole });
        common_vendor.index.__f__("log", "at pages/login/index.vue:254", "[login] 云函数返回:", res);
        if (res.code === 0) {
          let { token, tokenExpired, userInfo, issuedCount, issuedCoupons } = res.data;
          utils_auth.persistAuthToken(token, tokenExpired);
          if (userInfo) {
            utils_auth.setStoredUserInfo(userInfo);
          }
          const boundPhone = await this.bindLoginPhone(phoneEvent);
          if (boundPhone) {
            userInfo = { ...userInfo || {}, phone: boundPhone, mobile: boundPhone };
            utils_auth.setStoredUserInfo(userInfo);
          }
          common_vendor.index.setStorageSync("last_role", this.selectedRole);
          if (issuedCount > 0) {
            utils_coupons.persistIssuedCoupons({
              count: issuedCount,
              names: issuedCoupons || [],
              role: userInfo && userInfo.role || this.selectedRole
            });
          }
          utils_chatPush.bindPushClientId();
          if (issuedCount > 0) {
            common_vendor.index.showToast({
              title: `登录成功，已发放${issuedCount}张优惠券`,
              icon: "none",
              duration: 2500
            });
          } else {
            common_vendor.index.showToast({ title: "登录成功", icon: "success" });
          }
          try {
            const freshInfo = await utils_auth.fetchRemoteUserInfo({ token });
            userInfo = freshInfo || userInfo;
          } catch (fetchError) {
            common_vendor.index.__f__("warn", "at pages/login/index.vue:290", "获取最新用户信息失败，使用登录返回的数据", fetchError);
          }
          if (userInfo && userInfo.role) {
            if (userInfo.role === "parent" || userInfo.role === "teacher") {
              const pendingCode = common_vendor.index.getStorageSync("pending_invite_code");
              if (pendingCode) {
                try {
                  const inviteCenter = common_vendor.tr.importObject("invite-center", { customUI: true });
                  await inviteCenter.acceptInvite({ invite_code: pendingCode });
                  common_vendor.index.removeStorageSync("pending_invite_code");
                  utils_coupons.persistIssuedCoupons({
                    count: (issuedCount || 0) + 1,
                    names: issuedCoupons || [],
                    role: userInfo.role
                  });
                } catch (inviteErr) {
                  common_vendor.index.__f__("error", "at pages/login/index.vue:307", "[login] 处理邀请关系失败:", inviteErr);
                }
              }
            }
            const profileCheck = await utils_auth.checkProfileComplete(userInfo);
            common_vendor.index.__f__("log", "at pages/login/index.vue:314", "[login] 信息检查结果:", profileCheck);
            utils_coupons.prefetchAvailableCoupons(userInfo.role);
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
        common_vendor.index.__f__("error", "at pages/login/index.vue:344", "登录失败:", error);
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
        c: common_vendor.t(role.desc),
        d: $data.selectedRole === role.value
      }, $data.selectedRole === role.value ? {} : {}, {
        e: role.value,
        f: $data.selectedRole === role.value ? 1 : "",
        g: common_vendor.o(($event) => $options.selectRole(role.value), role.value)
      });
    }),
    c: !$options.canStartWxLogin
  }, !$options.canStartWxLogin ? common_vendor.e({
    d: $data.isLogging
  }, $data.isLogging ? {} : {}, {
    e: !$data.selectedRole || $data.isLogging ? 1 : "",
    f: common_vendor.o((...args) => $options.handleLogin && $options.handleLogin(...args))
  }) : {}, {
    g: $options.canStartWxLogin
  }, $options.canStartWxLogin ? {
    h: common_vendor.o((...args) => $options.onWxLoginPhone && $options.onWxLoginPhone(...args))
  } : {}, {
    i: common_vendor.o((...args) => $options.skipLogin && $options.skipLogin(...args)),
    j: $data.hasAgreed,
    k: common_vendor.o(($event) => $options.openAgreement("service")),
    l: common_vendor.o(($event) => $options.openAgreement("privacy")),
    m: common_vendor.o((...args) => $options.onAgreementChange && $options.onAgreementChange(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-d08ef7d4"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/login/index.js.map
