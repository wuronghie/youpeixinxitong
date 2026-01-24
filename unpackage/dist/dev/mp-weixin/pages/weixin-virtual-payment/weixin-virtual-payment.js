"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      wxpay_virtual: {
        mode: "short_series_coin",
        // 模式 short_series_coin 代币充值 short_series_goods 道具直购
        buy_quantity: 1,
        // 购买代币数量或道具数量
        product_id: "test001",
        // 道具id，在微信小程序后台 - 功能 - 虚拟支付 - 基本配置 - 道具配置 中配置道具id
        goods_price: 1
        // 道具价格，需要和配置的价格一致才能正常发起支付
      },
      order_no: "",
      // 业务系统订单号（即你自己业务系统的订单表的订单号）
      out_trade_no: "",
      // 插件支付单号
      description: "测试订单",
      // 支付描述
      type: "test",
      // 支付回调类型 如 recharge 代表余额充值 goods 代表商品订单（可自定义，任意英文单词都可以，只要你在 uni-pay-co/notify/目录下创建对应的 xxx.js文件进行编写对应的回调逻辑即可）
      openid: "",
      // 微信小程序的用户openid
      adpid: "1000000001",
      // uni-ad的广告位id
      getOrderRes: {}
      // 查询订单支付成功后的返回值
    };
  },
  onLoad(options = {}) {
  },
  methods: {
    /**
     * 发起支付（不唤起收银台，手动指定支付方式）
     * 在调用此api前，你应该先创建自己的业务系统订单，并获得订单号 order_no，把order_no当参数传给此api，而示例中为了简化跟支付插件无关的代码，这里直接已时间戳生成了order_no
     */
    createOrder(provider) {
      this.order_no = `test` + Date.now();
      this.out_trade_no = `${this.order_no}-1`;
      this.$refs.pay.createOrder({
        provider,
        // 支付供应商
        order_no: this.order_no,
        // 业务系统订单号（即你自己业务系统的订单表的订单号）
        out_trade_no: this.out_trade_no,
        // 插件支付单号
        description: this.description,
        // 支付描述
        type: this.type,
        // 支付回调类型
        wxpay_virtual: this.wxpay_virtual,
        // 微信虚拟支付专属字段
        // 自定义数据
        custom: {
          user_id: "001"
          // 业务系统用户id
        }
      });
    },
    // 打开查询订单的弹窗
    getOrderPopup(key) {
      if (key) {
        this.$refs.getOrderPopup.open();
      } else {
        this.$refs.getOrderPopup.close();
      }
    },
    // 查询支付状态
    async getOrder() {
      this.getOrderRes = {};
      let res = await this.$refs.pay.getOrder({
        out_trade_no: this.out_trade_no,
        // 插件支付单号 两者传1个即可
        await_notify: false
        // 是否等待异步通知
      });
      if (res) {
        this.getOrderRes = res.pay_order;
        if (!res.has_paid) {
          common_vendor.index.showToast({
            title: "未付款",
            icon: "none"
          });
          return;
        }
        if (res.user_order_success === true) {
          let obj = {
            "-1": "已关闭",
            "1": "已支付",
            "0": "未支付",
            "2": "已部分退款",
            "3": "已全额退款"
          };
          common_vendor.index.showToast({
            title: obj[res.status] || res.errMsg,
            icon: "none"
          });
        } else if (res.user_order_success === false) {
          common_vendor.index.showModal({
            content: "付款成功，且已接收到异步回调，但自定义回调逻辑执行失败",
            showCancel: false
          });
        } else if (res.status === 0) {
          common_vendor.index.showModal({
            content: "付款成功，但还未收到异步回调",
            showCancel: false
          });
        } else {
          common_vendor.index.showModal({
            content: "付款成功，且已接收到异步回调，但自定义回调逻辑还在执行中",
            showCancel: false
          });
        }
      }
    },
    // 发起退款
    async refund() {
      let res = await this.$refs.pay.refund({
        out_trade_no: this.out_trade_no
        // 插件支付单号
      });
      if (res) {
        common_vendor.index.showToast({
          title: res.errMsg,
          icon: "none"
        });
      }
    },
    // 查询退款状态
    async getRefund() {
      let res = await this.$refs.pay.getRefund({
        out_trade_no: this.out_trade_no
        // 插件支付单号
      });
      if (res) {
        common_vendor.index.showModal({
          content: res.errMsg,
          showCancel: false
        });
      }
    },
    // 监听事件 - 支付订单创建成功（此时用户还未支付）
    onCreate(res) {
      common_vendor.index.__f__("log", "at pages/weixin-virtual-payment/weixin-virtual-payment.vue:240", "create: ", res);
    },
    // 监听事件 - 支付成功
    onSuccess(res) {
      common_vendor.index.__f__("log", "at pages/weixin-virtual-payment/weixin-virtual-payment.vue:245", "success: ", res);
      if (res.user_order_success)
        ;
    },
    onFail(err) {
      common_vendor.index.__f__("log", "at pages/weixin-virtual-payment/weixin-virtual-payment.vue:255", "err: ", err);
      let errData = {
        "-5": "开通签约结果未知",
        "-15002": "outTradeNo重复使用,请换新单号重试",
        "-15003": "系统错误",
        "-15005": "支付配置错误",
        "-15006": "支付配置错误",
        "-15007": "session_key过期，用户需要重新登录",
        "-15008": "二级商户进件未完成",
        "-15009": "代币未发布",
        "-15010": "道具productId未发布",
        "-15012": "调用米大师失败导致关单,请换新单号重试",
        "-15013": "道具价格错误",
        "-15014": "道具/代币发布未生效，禁止下单，大概10分钟后生效",
        "-15017": "此商家涉嫌违规，收款功能已被限制，暂无法支付。商家可以登录微信商户平台/微信支付商家助手小程序查看原因和解决方案",
        "-15018": "代币或者道具productId审核不通过",
        "-15019": "调微信报商户受限,商家可以登录微信商户平台/微信支付商家助手小程序查看原因和解决方案",
        "-15020": "操作过快，请稍候再试",
        "-15021": "小程序被限频交易"
      };
      let errMsg = errData[String(err.errCode)] || err.errMsg;
      if (errMsg === "requestVirtualPayment:fail INVALID_PLATFORM") {
        errMsg = "苹果手机不支持微信虚拟支付";
      } else if (errMsg === "requestVirtualPayment:fail no permission") {
        errMsg = "微信基础库 2.19.2 开始才支付微信虚拟支付";
      }
      common_vendor.index.__f__("error", "at pages/weixin-virtual-payment/weixin-virtual-payment.vue:281", errMsg);
      if (err.code !== "FUNCTION_EXCUTE_ERROR") {
        common_vendor.index.showModal({
          title: "提示",
          content: errMsg,
          showCancel: false
        });
      }
    },
    onCancel(err) {
      common_vendor.index.__f__("log", "at pages/weixin-virtual-payment/weixin-virtual-payment.vue:291", "用户取消了支付: ", err);
    },
    // 查询用户微信虚拟支付代币余额（微信虚拟支付的代币余额是通过调用微信API查询的）
    async queryUserBalance() {
      const wxpayVirtualCo = common_vendor.tr.importObject("wxpay-virtual-co");
      let queryUserBalanceRes = await wxpayVirtualCo.queryUserBalance({
        openid: this.$refs.pay.openid
      });
      let { balance, presentBalance } = queryUserBalanceRes;
      let content = `我的余额：${balance}`;
      if (presentBalance) {
        content += `（含赠送余额：${presentBalance}）`;
      }
      common_vendor.index.showModal({
        title: "提示",
        content,
        showCancel: false
      });
    },
    // 扣减用户代币，扣减用户代币需要保证用户的sessionKey在有效期内（uni-pay组件会自动获取当前微信用户的sessionKey）
    async currencyPay() {
      const wxpayVirtualCo = common_vendor.tr.importObject("wxpay-virtual-co");
      let { openid } = this.$refs.pay;
      let queryUserBalanceRes = await wxpayVirtualCo.currencyPay({
        openid
      });
      common_vendor.index.showModal({
        title: "提示",
        content: `成功扣减余额：${queryUserBalanceRes.amount}，还剩余额：${queryUserBalanceRes.balance}`,
        showCancel: false
      });
    },
    // 监听模式选择
    modeChange(e) {
      this.wxpay_virtual.mode = e.detail.value;
    },
    // 监听道具选择
    productIdChange(e) {
      this.wxpay_virtual.product_id = e.detail.value;
      if (e.detail.value === "test002") {
        this.wxpay_virtual.goods_price = 2;
      } else {
        this.wxpay_virtual.goods_price = 1;
      }
    },
    providerFormat(provider) {
      let providerObj = {
        "wxpay": "微信支付",
        "alipay": "支付宝支付",
        "appleiap": "ios内购",
        "wxpay-virtual": "微信虚拟支付"
      };
      let providerStr = providerObj[provider] || "未知";
      return providerStr;
    },
    /**
     * 日期格式化
     * @params {Date || Number} date 需要格式化的时间
     * timeFormat(new Date(),"yyyy-MM-dd hh:mm:ss");
     */
    timeFormat(time, fmt = "yyyy-MM-dd hh:mm:ss", targetTimezone = 8) {
      try {
        if (!time) {
          return "";
        }
        if (typeof time === "string" && !isNaN(time))
          time = Number(time);
        let date;
        if (typeof time === "number") {
          if (time.toString().length == 10)
            time *= 1e3;
          date = new Date(time);
        } else {
          date = time;
        }
        const dif = date.getTimezoneOffset();
        const timeDif = dif * 60 * 1e3 + targetTimezone * 60 * 60 * 1e3;
        const east8time = date.getTime() + timeDif;
        date = new Date(east8time);
        let opt = {
          "M+": date.getMonth() + 1,
          //月份
          "d+": date.getDate(),
          //日
          "h+": date.getHours(),
          //小时
          "m+": date.getMinutes(),
          //分
          "s+": date.getSeconds(),
          //秒
          "q+": Math.floor((date.getMonth() + 3) / 3),
          //季度
          "S": date.getMilliseconds()
          //毫秒
        };
        if (/(y+)/.test(fmt)) {
          fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
        }
        for (let k in opt) {
          if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, RegExp.$1.length == 1 ? opt[k] : ("00" + opt[k]).substr(("" + opt[k]).length));
          }
        }
        return fmt;
      } catch (err) {
        return time;
      }
    }
  },
  computed: {}
};
if (!Array) {
  const _easycom_uni_popup2 = common_vendor.resolveComponent("uni-popup");
  const _easycom_uni_pay2 = common_vendor.resolveComponent("uni-pay");
  (_easycom_uni_popup2 + _easycom_uni_pay2)();
}
const _easycom_uni_popup = () => "../../uni_modules/uni-popup/components/uni-popup/uni-popup.js";
const _easycom_uni_pay = () => "../../uni_modules/uni-pay/components/uni-pay/uni-pay.js";
if (!Math) {
  (_easycom_uni_popup + _easycom_uni_pay)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.modeChange && $options.modeChange(...args)),
    b: $data.out_trade_no,
    c: common_vendor.o(($event) => $data.out_trade_no = $event.detail.value),
    d: $data.wxpay_virtual.mode === "short_series_coin"
  }, $data.wxpay_virtual.mode === "short_series_coin" ? {
    e: $data.wxpay_virtual.buy_quantity,
    f: common_vendor.o(common_vendor.m(($event) => $data.wxpay_virtual.buy_quantity = $event.detail.value, {
      number: true
    }))
  } : $data.wxpay_virtual.mode === "short_series_goods" ? {
    h: common_vendor.o((...args) => $options.productIdChange && $options.productIdChange(...args)),
    i: $data.wxpay_virtual.buy_quantity,
    j: common_vendor.o(common_vendor.m(($event) => $data.wxpay_virtual.buy_quantity = $event.detail.value, {
      number: true
    }))
  } : {}, {
    g: $data.wxpay_virtual.mode === "short_series_goods",
    k: common_vendor.o(($event) => $options.createOrder("wxpay-virtual")),
    l: common_vendor.o(($event) => $options.getOrderPopup(true)),
    m: $data.wxpay_virtual.mode === "short_series_coin"
  }, $data.wxpay_virtual.mode === "short_series_coin" ? {
    n: common_vendor.o((...args) => $options.queryUserBalance && $options.queryUserBalance(...args)),
    o: common_vendor.o((...args) => $options.currencyPay && $options.currencyPay(...args))
  } : {}, {
    p: $data.out_trade_no,
    q: common_vendor.o(($event) => $data.out_trade_no = $event.detail.value),
    r: common_vendor.o((...args) => $options.getOrder && $options.getOrder(...args)),
    s: $data.getOrderRes.transaction_id
  }, $data.getOrderRes.transaction_id ? {
    t: common_vendor.t($data.getOrderRes.description),
    v: common_vendor.t(($data.getOrderRes.total_fee / 100).toFixed(2)),
    w: common_vendor.t($options.timeFormat($data.getOrderRes.pay_date, "yyyy-MM-dd hh:mm:ss")),
    x: common_vendor.t($options.providerFormat($data.getOrderRes.provider)),
    y: common_vendor.t($data.getOrderRes.transaction_id),
    z: common_vendor.t($data.getOrderRes.out_trade_no),
    A: common_vendor.t($data.getOrderRes.user_order_success ? "成功" : "异常")
  } : {}, {
    B: common_vendor.sr("getOrderPopup", "faf83f22-0"),
    C: common_vendor.p({
      type: "bottom",
      ["safe-area"]: false
    }),
    D: common_vendor.sr("pay", "faf83f22-1"),
    E: common_vendor.o($options.onSuccess),
    F: common_vendor.o($options.onCreate),
    G: common_vendor.o($options.onFail),
    H: common_vendor.o($options.onCancel),
    I: common_vendor.p({
      adpid: $data.adpid,
      height: "70vh",
      ["return-url"]: "/pages/order-detail/order-detail",
      logo: "/static/logo.png"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-faf83f22"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/weixin-virtual-payment/weixin-virtual-payment.js.map
