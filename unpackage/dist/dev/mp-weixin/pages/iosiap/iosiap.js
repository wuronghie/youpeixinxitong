"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      order_no: "",
      // 业务系统订单号（即你自己业务系统的订单表的订单号）
      out_trade_no: "",
      // 插件支付单号
      adpid: "1000000001",
      // uni-ad的广告位id
      loading: false,
      // 支付按钮是否在loading中
      disabled: true,
      // 支付按钮是否禁用
      productid: "",
      // 用户选择的商品id
      // 出售的ios内购商品列表
      productList: [
        {
          "description": "为DCloud提供的免费软件进行赞助",
          "price": 8,
          "productid": "io_dcloud_hellouniapp_pay_like1",
          "title": "赞赏"
        },
        {
          "description": "为DCloud提供的免费软件进行赞助",
          "price": 6,
          "productid": "io_dcloud_hellouniapp_pay_like6",
          "title": "赞赏"
        }
      ]
    };
  },
  onLoad: function() {
  },
  onShow() {
    if (this.$refs.uniPay && this.$refs.uniPay.appleiapRestore) {
      this.$refs.uniPay.appleiapRestore();
    }
  },
  onUnload() {
  },
  methods: {
    // 支付组件加载完毕后执行
    onMounted(insideData) {
      this.init();
    },
    // 初始化
    async init() {
      this.productList[0].checked = true;
      this.productid = this.productList[0].productid;
      this.disabled = false;
      if (this.$refs.uniPay && this.$refs.uniPay.appleiapRestore) {
        this.$refs.uniPay.appleiapRestore();
      }
    },
    /**
     * 发起支付
     * 在调用此api前，你应该先创建自己的业务系统订单，并获得订单号 order_no，把order_no当参数传给此api，而示例中为了简化跟支付插件无关的代码，这里直接已时间戳生成了order_no
     */
    createOrder() {
      this.order_no = `test` + Date.now();
      this.out_trade_no = this.order_no;
      this.$refs.uniPay.createOrder({
        provider: "appleiap",
        // 支付供应商（这里固定为appleiap，代表ios内购支付）
        order_no: this.order_no,
        // 业务系统订单号（即你自己业务系统的订单表的订单号）
        out_trade_no: this.out_trade_no,
        // 插件支付单号
        type: "appleiap",
        // 支付回调类型（可自定义，建议填写appleiap）
        productid: this.productid,
        // ios内购产品id（仅ios内购生效）
        // 自定义数据
        custom: {}
      });
    },
    // 监听事件 - 支付成功
    onSuccess(res) {
      common_vendor.index.__f__("log", "at pages/iosiap/iosiap.vue:93", "success: ", res);
      if (res.user_order_success)
        ;
    },
    // 监听-多选框选中的值改变
    applePriceChange(e) {
      this.productid = e.detail.value;
    }
  }
};
if (!Array) {
  const _easycom_uni_pay2 = common_vendor.resolveComponent("uni-pay");
  _easycom_uni_pay2();
}
const _easycom_uni_pay = () => "../../uni_modules/uni-pay/components/uni-pay/uni-pay.js";
if (!Math) {
  _easycom_uni_pay();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.f($data.productList, (item, index, i0) => {
      return {
        a: item.productid,
        b: item.checked,
        c: common_vendor.t(item.title),
        d: common_vendor.t(item.price),
        e: index
      };
    }),
    b: common_vendor.o((...args) => $options.applePriceChange && $options.applePriceChange(...args)),
    c: common_vendor.o((...args) => $options.createOrder && $options.createOrder(...args)),
    d: $data.loading,
    e: $data.disabled,
    f: common_vendor.sr("uniPay", "5c09085a-0"),
    g: common_vendor.o($options.onMounted),
    h: common_vendor.o($options.onSuccess),
    i: common_vendor.p({
      debug: true,
      adpid: $data.adpid,
      ["return-url"]: "/pages/order-detail/order-detail"
    })
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/iosiap/iosiap.js.map
