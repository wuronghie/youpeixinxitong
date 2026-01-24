"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      total_fee: 1,
      // 支付金额，单位分 100 = 1元
      order_no: "",
      // 业务系统订单号（即你自己业务系统的订单表的订单号）
      out_trade_no: "",
      // 插件支付单号
      description: "测试订单",
      // 支付描述
      type: "test",
      // 支付回调类型 如 recharge 代表余额充值 goods 代表商品订单（可自定义，任意英文单词都可以，只要你在 uni-pay-co/notify/目录下创建对应的 xxx.js文件进行编写对应的回调逻辑即可）
      //qr_code: true, // 是否强制使用扫码支付
      openid: "",
      // 微信公众号需要
      custom: {
        a: "a",
        b: 1
      },
      adpid: "1000000001",
      // uni-ad的广告位id
      transaction_id: "",
      // 查询订单接口的查询条件
      getOrderRes: {}
      // 查询订单支付成功后的返回值
    };
  },
  onLoad(options = {}) {
  },
  methods: {
    /**
     * 发起支付（唤起收银台，如果只有一种支付方式，则收银台不会弹出来，会直接使用此支付方式）
     * 在调用此api前，你应该先创建自己的业务系统订单，并获得订单号 order_no，把order_no当参数传给此api，而示例中为了简化跟支付插件无关的代码，这里直接已时间戳生成了order_no
     */
    open() {
      this.order_no = `test` + Date.now();
      this.out_trade_no = `${this.order_no}-1`;
      this.$refs.pay.open({
        total_fee: this.total_fee,
        // 支付金额，单位分 100 = 1元
        order_no: this.order_no,
        // 业务系统订单号（即你自己业务系统的订单表的订单号）
        out_trade_no: this.out_trade_no,
        // 插件支付单号
        description: this.description,
        // 支付描述
        type: this.type,
        // 支付回调类型
        qr_code: this.qr_code,
        // 是否强制使用扫码支付
        openid: this.openid,
        // 微信公众号需要
        custom: this.custom
        // 自定义数据
      });
    },
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
        total_fee: this.total_fee,
        // 支付金额，单位分 100 = 1元
        order_no: this.order_no,
        // 业务系统订单号（即你自己业务系统的订单表的订单号）
        out_trade_no: this.out_trade_no,
        // 插件支付单号
        description: this.description,
        // 支付描述
        type: this.type,
        // 支付回调类型
        qr_code: this.qr_code,
        // 是否强制使用扫码支付
        openid: this.openid,
        // 微信公众号需要
        custom: this.custom
        // 自定义数据
      });
    },
    /**
     * 生成支付独立二维码（只返回支付二维码）
     * 在调用此api前，你应该先创建自己的业务系统订单，并获得订单号 order_no，把order_no当参数传给此api，而示例中为了简化跟支付插件无关的代码，这里直接已时间戳生成了order_no
     */
    createQRcode(provider) {
      this.order_no = `test` + Date.now();
      this.out_trade_no = `${this.order_no}-1`;
      this.$refs.pay.createOrder({
        provider,
        // 支付供应商
        total_fee: this.total_fee,
        // 支付金额，单位分 100 = 1元
        order_no: this.order_no,
        // 业务系统订单号（即你自己业务系统的订单表的订单号）
        out_trade_no: this.out_trade_no,
        // 插件支付单号
        description: this.description,
        // 支付描述
        type: this.type,
        // 支付回调类型
        qr_code: true,
        // 是否强制使用扫码支付
        cancel_popup: true,
        // 配合qr_code:true使用，是否只生成支付二维码，没有二维码弹窗
        openid: this.openid,
        // 微信公众号需要
        custom: this.custom
        // 自定义数据
      });
    },
    /**
     * 前往自定义收银台页面
     * 在调用此api前，你应该先创建自己的业务系统订单，并获得订单号 order_no，把order_no当参数传给此api，而示例中为了简化跟支付插件无关的代码，这里直接已时间戳生成了order_no
     */
    toPayDesk() {
      this.order_no = `test` + Date.now();
      this.out_trade_no = `${this.order_no}-1`;
      let options = {
        total_fee: this.total_fee,
        // 支付金额，单位分 100 = 1元
        order_no: this.order_no,
        // 业务系统订单号（即你自己业务系统的订单表的订单号）
        out_trade_no: this.out_trade_no,
        // 插件支付单号
        description: this.description,
        // 支付描述
        type: this.type,
        // 支付回调类型
        qr_code: this.qr_code,
        // 是否强制使用扫码支付
        openid: this.openid,
        // 微信公众号需要
        custom: this.custom
        // 自定义数据
      };
      let optionsStr = encodeURI(JSON.stringify(options));
      common_vendor.index.navigateTo({
        url: `/uni_modules/uni-pay/pages/pay-desk/pay-desk?options=${optionsStr}`
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
        //out_trade_no: this.out_trade_no, // 插件支付单号 两者传1个即可
        transaction_id: this.transaction_id,
        // 第三方单号 两者传1个即可
        await_notify: true
      });
      if (res) {
        this.getOrderRes = res.pay_order;
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
    // 关闭订单
    async closeOrder() {
      let res = await this.$refs.pay.closeOrder({
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
    // 获取公众号code
    async getWeiXinJsCode(scope = "snsapi_base") {
      let res = await this.$refs.pay.getProviderAppId({
        provider: "wxpay",
        provider_pay_type: "jsapi"
      });
      if (res.appid) {
        let appid = res.appid;
        let redirect_uri = window.location.href.split("?")[0];
        let url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirect_uri}&response_type=code&scope=${scope}&state=STATE#wechat_redirect`;
        window.location.href = url;
      }
    },
    // 获取公众号openid
    async getOpenid(data = {}) {
      let res = await this.$refs.pay.getOpenid(data);
      if (res) {
        this.openid = res.openid;
        common_vendor.index.setStorageSync("uni-pay-weixin-h5-openid", this.openid);
        common_vendor.index.setStorageSync("uni-pay-weixin-h5-code", data.code);
        common_vendor.index.showToast({
          title: "已获取到openid，可以开始支付",
          icon: "none"
        });
      }
    },
    // 监听事件 - 支付订单创建成功（此时用户还未支付）
    onCreate(res) {
      common_vendor.index.__f__("log", "at pages/index/index.vue:327", "create: ", res);
    },
    // 监听事件 - 支付成功
    onSuccess(res) {
      common_vendor.index.__f__("log", "at pages/index/index.vue:332", "success: ", res);
      if (res.user_order_success)
        ;
    },
    onFail(err) {
      common_vendor.index.__f__("log", "at pages/index/index.vue:342", "err: ", err);
    },
    pageTo(url) {
      common_vendor.index.navigateTo({
        url
      });
    },
    providerFormat(provider) {
      let providerObj = {
        "wxpay": "微信支付",
        "alipay": "支付宝支付",
        "appleiap": "ios内购"
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
  computed: {
    h5Env() {
    },
    // 计算当前是否是ios app
    isIosAppCom() {
      let info = common_vendor.index.getSystemInfoSync();
      return info.uniPlatform === "app" && info.osName === "ios" ? true : false;
    },
    // 计算当前是否是PC环境
    isPcCom() {
      return false;
    }
  }
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
    a: $data.out_trade_no,
    b: common_vendor.o(($event) => $data.out_trade_no = $event.detail.value),
    c: $data.total_fee,
    d: common_vendor.o(common_vendor.m(($event) => $data.total_fee = $event.detail.value, {
      number: true
    })),
    e: common_vendor.o(($event) => $options.createOrder("wxpay")),
    f: common_vendor.o(($event) => $options.getOrderPopup(true)),
    g: $data.transaction_id,
    h: common_vendor.o(($event) => $data.transaction_id = $event.detail.value),
    i: common_vendor.o((...args) => $options.getOrder && $options.getOrder(...args)),
    j: $data.getOrderRes.transaction_id
  }, $data.getOrderRes.transaction_id ? {
    k: common_vendor.t($data.getOrderRes.description),
    l: common_vendor.t(($data.getOrderRes.total_fee / 100).toFixed(2)),
    m: common_vendor.t($options.timeFormat($data.getOrderRes.pay_date, "yyyy-MM-dd hh:mm:ss")),
    n: common_vendor.t($options.providerFormat($data.getOrderRes.provider)),
    o: common_vendor.t($data.getOrderRes.transaction_id),
    p: common_vendor.t($data.getOrderRes.out_trade_no),
    q: common_vendor.t($data.getOrderRes.user_order_success ? "成功" : "异常")
  } : {}, {
    r: common_vendor.sr("getOrderPopup", "1cf27b2a-0"),
    s: common_vendor.p({
      type: "bottom",
      ["safe-area"]: false
    }),
    t: common_vendor.o(($event) => $options.pageTo("/pages/weixin-virtual-payment/weixin-virtual-payment")),
    v: common_vendor.sr("pay", "1cf27b2a-1"),
    w: common_vendor.o($options.onSuccess),
    x: common_vendor.o($options.onCreate),
    y: common_vendor.o($options.onFail),
    z: common_vendor.p({
      adpid: $data.adpid,
      height: "70vh",
      ["return-url"]: "/pages/order-detail/order-detail",
      logo: "/static/logo.png"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1cf27b2a"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map
