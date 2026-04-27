"use strict";
const common_vendor = require("../common/vendor.js");
async function createPaymentOrderProd(options) {
  var _a, _b;
  try {
    common_vendor.index.__f__("log", "at utils/payment.js:44", "[创建订单] 调用云服务创建订单:", {
      appointment_id: options.appointment_id,
      payment_type: options.payment_type,
      amount: options.amount
    });
    const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
    const res = await paymentCreate.create({
      appointment_id: options.appointment_id,
      payment_type: options.payment_type,
      amount: options.amount,
      // 云函数期望的是元
      user_coupon_id: options.user_coupon_id || null
    });
    common_vendor.index.__f__("log", "at utils/payment.js:58", "[创建订单] 云服务返回:", {
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
    common_vendor.index.__f__("error", "at utils/payment.js:72", "[创建订单] 失败:", error);
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
    common_vendor.index.__f__("warn", "at utils/payment.js:103", "[支付] 已开启「模拟支付」模式，所有支付将跳过真实收银台。生产环境请勿启用！");
  } catch (e) {
    common_vendor.index.__f__("warn", "at utils/payment.js:105", "[支付] 开启模拟支付失败:", e);
  }
}
function disableMockPayForDev() {
  try {
    common_vendor.index.removeStorageSync(MOCK_PAY_STORAGE_KEY);
    common_vendor.index.__f__("info", "at utils/payment.js:112", "[支付] 已关闭「模拟支付」模式，恢复真实支付。");
  } catch (e) {
    common_vendor.index.__f__("warn", "at utils/payment.js:114", "[支付] 关闭模拟支付失败:", e);
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
async function createAndPayWithUniPay(payComponent, options) {
  const { appointment_id, payment_type, amount, description, provider, user_coupon_id } = options;
  if (!appointment_id || amount == null || amount < 0) {
    throw new Error("支付参数不完整");
  }
  if (!payComponent) {
    throw new Error("uni-pay 组件未找到");
  }
  try {
    common_vendor.index.__f__("log", "at utils/payment.js:240", "[支付流程] 开始创建业务订单...");
    const amountInYuan = parseFloat((amount / 100).toFixed(2));
    common_vendor.index.__f__("log", "at utils/payment.js:246", "[支付流程] 金额转换:", {
      原始金额_分: amount,
      转换后金额_元: amountInYuan
    });
    if (amountInYuan <= 0 || isNaN(amountInYuan)) {
      throw new Error(`支付金额必须大于0，当前金额：${amount}分（${amountInYuan}元）`);
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
    common_vendor.index.__f__("log", "at utils/payment.js:278", "[支付流程] 业务订单创建成功:", {
      order_id,
      order_no,
      amount: orderInfo.amount
    });
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
        order_id
        // 保存订单ID，供支付成功后使用
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
    common_vendor.index.__f__("error", "at utils/payment.js:314", "[支付流程] 失败:", error);
    throw error;
  }
}
async function createAndPay(options) {
  const { appointment_id, payment_type, amount, user_coupon_id } = options;
  if (!appointment_id || amount == null || amount < 0) {
    return {
      code: -1,
      message: "支付参数不完整"
    };
  }
  const isDev = isDevMode();
  if (isDev) {
    return new Promise((resolve) => {
      common_vendor.index.hideLoading();
      setTimeout(() => {
        common_vendor.index.showModal({
          title: "模拟支付",
          content: `预约ID：${appointment_id}
支付类型：${payment_type === "deposit" ? "信息费" : "课程费"}
金额：¥${(amount / 100).toFixed(2)}

这是开发模式，点击确认模拟支付成功`,
          confirmText: "确认支付",
          cancelText: "取消",
          success: async (res) => {
            if (res.confirm) {
              try {
                const amountInYuan = parseFloat((amount / 100).toFixed(2));
                const createRes = await createPaymentOrderProd({
                  appointment_id,
                  payment_type,
                  amount: amountInYuan,
                  user_coupon_id
                });
                if (createRes.code !== 0 || !createRes.data || !createRes.data.order_no) {
                  return resolve({
                    code: -1,
                    message: createRes.message || "创建支付订单失败"
                  });
                }
                const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
                const mockRes = await paymentCreate.mockPaySuccess({
                  order_no: createRes.data.order_no
                });
                return resolve({
                  code: mockRes.code,
                  message: mockRes.message,
                  data: mockRes.data
                });
              } catch (e) {
                common_vendor.index.__f__("error", "at utils/payment.js:384", "模拟支付失败:", e);
                return resolve({
                  code: -1,
                  message: e.message || "支付失败"
                });
              }
            } else {
              resolve({
                code: -1,
                message: "用户取消支付"
              });
            }
          },
          fail: (err) => {
            common_vendor.index.__f__("error", "at utils/payment.js:399", "显示支付弹窗失败:", err);
            resolve({
              code: 0,
              message: "支付成功（模拟，弹窗显示失败）",
              data: {
                order_no: `ORDER_${Date.now()}`,
                transaction_id: `TXN_${Date.now()}`,
                pay_time: (/* @__PURE__ */ new Date()).toISOString()
              }
            });
          }
        });
      }, 100);
    });
  }
  return {
    code: -1,
    message: "当前环境无法发起支付，请稍后重试或联系客服",
    errorType: "NO_PAY_CHANNEL"
  };
}
exports.createAndPay = createAndPay;
exports.createAndPayWithUniPay = createAndPayWithUniPay;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/payment.js.map
