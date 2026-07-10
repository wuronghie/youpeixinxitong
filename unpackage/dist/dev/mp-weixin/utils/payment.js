"use strict";
const common_vendor = require("../common/vendor.js");
async function createPaymentOrderProd(options) {
  var _a, _b;
  try {
    common_vendor.index.__f__("log", "at utils/payment.js:44", "[创建订单] 调用云服务创建订单:", {
      appointment_id: options.appointment_id,
      payment_type: options.payment_type,
      amount: options.amount,
      user_coupon_id: options.user_coupon_id || null
    });
    const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
    const res = await paymentCreate.create({
      appointment_id: options.appointment_id,
      payment_type: options.payment_type,
      amount: options.amount,
      // 云函数期望的是元
      user_coupon_id: options.user_coupon_id || null
    });
    common_vendor.index.__f__("log", "at utils/payment.js:59", "[创建订单] 云服务返回:", {
      code: res.code,
      message: res.message,
      hasData: !!res.data,
      order_no: (_a = res.data) == null ? void 0 : _a.order_no,
      order_id: (_b = res.data) == null ? void 0 : _b.order_id
    });
    if (res.code !== 0) {
      throw new Error(res.message || "创建订单失败");
    }
    return res;
  } catch (error) {
    common_vendor.index.__f__("error", "at utils/payment.js:73", "[创建订单] 失败:", error);
    throw error;
  }
}
const MOCK_PAY_STORAGE_KEY = "__dev_mock_pay__";
function isDevMode() {
  try {
    return common_vendor.index.getStorageSync(MOCK_PAY_STORAGE_KEY) === true;
  } catch (e) {
    return false;
  }
}
function enableMockPayForDev() {
  try {
    common_vendor.index.setStorageSync(MOCK_PAY_STORAGE_KEY, true);
    common_vendor.index.__f__("warn", "at utils/payment.js:104", "[支付] 已开启「模拟支付」模式，所有支付将跳过真实收银台。生产环境请勿启用！");
  } catch (e) {
    common_vendor.index.__f__("warn", "at utils/payment.js:106", "[支付] 开启模拟支付失败:", e);
  }
}
function disableMockPayForDev() {
  try {
    common_vendor.index.removeStorageSync(MOCK_PAY_STORAGE_KEY);
    common_vendor.index.__f__("info", "at utils/payment.js:113", "[支付] 已关闭「模拟支付」模式，恢复真实支付。");
  } catch (e) {
    common_vendor.index.__f__("warn", "at utils/payment.js:115", "[支付] 关闭模拟支付失败:", e);
  }
}
function isMockPayEnabled() {
  return isDevMode();
}
try {
  if (typeof common_vendor.index !== "undefined") {
    common_vendor.index.$enableMockPay = enableMockPayForDev;
    common_vendor.index.$disableMockPay = disableMockPayForDev;
    common_vendor.index.$isMockPayEnabled = isMockPayEnabled;
  }
} catch (e) {
}
function payWithUniPay(payComponent, options) {
  if (!payComponent) {
    throw new Error("uni-pay 组件未找到，请确保页面中已引入 uni-pay 组件");
  }
  const {
    order_no,
    out_trade_no,
    total_fee,
    description = "课程费用",
    type = "appointment",
    provider = null,
    custom = {}
  } = options;
  const payParams = {
    total_fee,
    // 支付金额，单位分
    order_no,
    // 业务系统订单号
    out_trade_no,
    // 插件支付单号
    description,
    // 支付描述
    type,
    // 支付回调类型
    custom: {
      appointment_id: custom.appointment_id,
      payment_type: custom.payment_type,
      ...custom
    }
  };
  if (provider) {
    payComponent.createOrder({
      provider,
      ...payParams
    });
  } else {
    payComponent.open(payParams);
  }
}
function generateOutTradeNo(appointment_id, payment_type) {
  const aptIdShort = appointment_id.length > 8 ? appointment_id.slice(-8) : appointment_id;
  const typeMap = {
    "course_fee": "CF",
    "deposit": "DP",
    "refund": "RF"
  };
  const typeShort = typeMap[payment_type] || "PAY";
  const timestamp = String(Date.now()).slice(-10);
  return `${typeShort}${timestamp}${aptIdShort}`.slice(0, 32);
}
async function payExistingOrderWithUniPay(payComponent, options) {
  const {
    order_no,
    appointment_id,
    payment_type,
    amount,
    description,
    order_id,
    provider
  } = options;
  if (!order_no || !appointment_id || amount == null || amount < 0) {
    throw new Error("支付参数不完整");
  }
  if (!payComponent) {
    throw new Error("uni-pay 组件未找到");
  }
  const amountInYuan = parseFloat((amount / 100).toFixed(2));
  if (amountInYuan <= 0 || isNaN(amountInYuan)) {
    throw new Error(`支付金额必须大于0，当前金额：${amount}分（${amountInYuan}元）`);
  }
  const out_trade_no = generateOutTradeNo(appointment_id, payment_type || "course_fee");
  payWithUniPay(payComponent, {
    order_no,
    out_trade_no,
    total_fee: amount,
    description: description || (payment_type === "deposit" ? "支付信息费" : "支付课程费用"),
    type: "appointment",
    provider,
    custom: {
      appointment_id,
      payment_type: payment_type || "course_fee",
      order_id
    }
  });
  return {
    code: 0,
    message: "请完成支付",
    data: {
      order_no,
      out_trade_no,
      order_id
    }
  };
}
async function createAndPayWithUniPay(payComponent, options) {
  const { appointment_id, payment_type, amount, description, provider, user_coupon_id } = options;
  if (!appointment_id || amount == null || amount < 0) {
    throw new Error("支付参数不完整");
  }
  if (!payComponent && amount > 0) {
    throw new Error("uni-pay 组件未找到");
  }
  try {
    common_vendor.index.__f__("log", "at utils/payment.js:304", "[支付流程] 开始创建业务订单...");
    const amountInYuan = parseFloat((amount / 100).toFixed(2));
    common_vendor.index.__f__("log", "at utils/payment.js:310", "[支付流程] 金额转换:", {
      原始金额_分: amount,
      转换后金额_元: amountInYuan
    });
    if (amountInYuan < 0 || isNaN(amountInYuan)) {
      throw new Error(`支付金额不合法，当前金额：${amount}分（${amountInYuan}元）`);
    }
    const createRes = await createPaymentOrderProd({
      appointment_id,
      payment_type: payment_type || "course_fee",
      amount: amountInYuan,
      // 云函数期望的是元
      user_coupon_id
    });
    if (createRes.code !== 0 || !createRes.data) {
      const errorMessage = createRes.message || "创建订单失败";
      if (errorMessage.includes("已支付过")) {
        const error = new Error(errorMessage);
        error.code = "ALREADY_PAID";
        error.createRes = createRes;
        throw error;
      }
      throw new Error(errorMessage);
    }
    const orderInfo = createRes.data;
    const order_no = orderInfo.order_no;
    const order_id = orderInfo.order_id;
    common_vendor.index.__f__("log", "at utils/payment.js:342", "[支付流程] 业务订单创建成功:", {
      order_id,
      order_no,
      amount: orderInfo.amount
    });
    if (amountInYuan === 0) {
      const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
      const payRes = await paymentCreate.mockPaySuccess({ order_no });
      if (payRes.code !== 0) {
        throw new Error(payRes.message || "优惠券抵扣失败");
      }
      return {
        code: 0,
        message: "优惠券已全额抵扣",
        data: {
          order_id,
          order_no,
          zero_pay: true
        }
      };
    }
    const out_trade_no = generateOutTradeNo(appointment_id, payment_type || "course_fee");
    payWithUniPay(payComponent, {
      order_no,
      // 使用业务订单号
      out_trade_no,
      // 使用短支付单号
      total_fee: amount,
      // uni-pay 需要的是分
      description: description || (payment_type === "deposit" ? "支付信息费" : "支付课程费用"),
      type: "appointment",
      provider,
      // 不传则打开收银台
      custom: {
        appointment_id,
        payment_type: payment_type || "course_fee",
        order_id,
        // 保存订单ID，供支付成功后使用
        user_coupon_id: user_coupon_id || null
      }
    });
    return {
      code: 0,
      message: "订单创建成功，请完成支付",
      data: {
        order_id,
        order_no,
        out_trade_no
      }
    };
  } catch (error) {
    common_vendor.index.__f__("error", "at utils/payment.js:396", "[支付流程] 失败:", error);
    throw error;
  }
}
async function createAndPay(options) {
  const { appointment_id, amount } = options;
  if (!appointment_id || amount == null || amount < 0) {
    return {
      code: -1,
      message: "支付参数不完整"
    };
  }
  return {
    code: -1,
    message: "请通过支付界面完成支付",
    errorType: "NO_PAY_CHANNEL"
  };
}
exports.createAndPay = createAndPay;
exports.createAndPayWithUniPay = createAndPayWithUniPay;
exports.payExistingOrderWithUniPay = payExistingOrderWithUniPay;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/payment.js.map
