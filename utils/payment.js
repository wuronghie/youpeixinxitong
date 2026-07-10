/**
 * 支付工具类
 * 基于 uni-pay 组件实现统一支付接口
 * 所有非 0 元支付必须通过 uni-pay 收银台完成
 */

/**
 * 创建支付订单（开发模式 - 模拟）
 * @param {Object} options 支付参数
 * @param {String} options.appointment_id 预约ID
 * @param {String} options.payment_type 支付类型
 * @param {Number} options.amount 支付金额（分）
 * @returns {Promise<Object>} 支付订单信息
 */
async function createPaymentOrderDev(options) {
	// 模拟创建订单
	return new Promise((resolve) => {
		setTimeout(() => {
			const orderNo = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
			resolve({
				code: 0,
				message: '订单创建成功',
				data: {
					order_no: orderNo,
					appointment_id: options.appointment_id,
					amount: options.amount,
					payment_type: options.payment_type
				}
			})
		}, 300)
	})
}

/**
 * 创建支付订单（生产模式 - 调用云服务）
 * @param {Object} options 支付参数
 * @param {String} options.appointment_id 预约ID
 * @param {String} options.payment_type 支付类型
 * @param {Number} options.amount 支付金额（元）
 * @returns {Promise<Object>} 支付订单信息
 */
async function createPaymentOrderProd(options) {
	try {
		console.log('[创建订单] 调用云服务创建订单:', {
			appointment_id: options.appointment_id,
			payment_type: options.payment_type,
			amount: options.amount,
			user_coupon_id: options.user_coupon_id || null
		})
		
		const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
		const res = await paymentCreate.create({
			appointment_id: options.appointment_id,
			payment_type: options.payment_type,
			amount: options.amount, // 云函数期望的是元
			user_coupon_id: options.user_coupon_id || null
		})
		
		console.log('[创建订单] 云服务返回:', {
			code: res.code,
			message: res.message,
			hasData: !!res.data,
			order_no: res.data?.order_no,
			order_id: res.data?.order_id
		})
		
		if (res.code !== 0) {
			throw new Error(res.message || '创建订单失败')
		}
		
		return res
	} catch (error) {
		console.error('[创建订单] 失败:', error)
		throw error
	}
}

/**
 * 模拟支付开关（仅供开发调试）
 *
 * 默认关闭——生产环境一律走 uni-pay 真实收银台；
 * 启用后，`createAndPay` 不会跳转支付页面，而是弹出确认框直接调用云端
 * `payment-create.mockPaySuccess` 标记订单为已支付，方便本地调试。
 *
 * 启用方式（任选其一）：
 *   1) 调用 `enableMockPayForDev()`（推荐，立即生效）
 *   2) 在控制台执行：`uni.setStorageSync('__dev_mock_pay__', true)`
 * 关闭：
 *   - `disableMockPayForDev()` 或清除 storage 的同名 key
 */
const MOCK_PAY_STORAGE_KEY = '__dev_mock_pay__'

function isDevMode() {
	try {
		return uni.getStorageSync(MOCK_PAY_STORAGE_KEY) === true
	} catch (e) {
		return false
	}
}

export function enableMockPayForDev() {
	try {
		uni.setStorageSync(MOCK_PAY_STORAGE_KEY, true)
		console.warn('[支付] 已开启「模拟支付」模式，所有支付将跳过真实收银台。生产环境请勿启用！')
	} catch (e) {
		console.warn('[支付] 开启模拟支付失败:', e)
	}
}

export function disableMockPayForDev() {
	try {
		uni.removeStorageSync(MOCK_PAY_STORAGE_KEY)
		console.info('[支付] 已关闭「模拟支付」模式，恢复真实支付。')
	} catch (e) {
		console.warn('[支付] 关闭模拟支付失败:', e)
	}
}

export function isMockPayEnabled() {
	return isDevMode()
}

// 挂到 uni 全局，方便在小程序开发者工具控制台里直接调用：
//   uni.$enableMockPay()    // 打开模拟支付（仅本机生效）
//   uni.$disableMockPay()   // 关闭，恢复真实支付
//   uni.$isMockPayEnabled() // 查看当前模式
try {
	if (typeof uni !== 'undefined') {
		uni.$enableMockPay = enableMockPayForDev
		uni.$disableMockPay = disableMockPayForDev
		uni.$isMockPayEnabled = isMockPayEnabled
	}
} catch (e) {
	// 某些非 uni 环境下 uni 可能不可用，忽略即可
}

/**
 * 使用 uni-pay 组件发起支付
 * 注意：此方法需要页面中通过 @success、@fail 事件监听支付结果
 * 建议直接使用 createAndPayWithUniPay 方法，它会自动处理事件监听
 * @param {Object} payComponent uni-pay 组件实例（通过 this.$refs.pay 获取）
 * @param {Object} options 支付参数
 * @param {String} options.order_no 业务订单号
 * @param {String} options.out_trade_no 支付单号
 * @param {Number} options.total_fee 支付金额（分）
 * @param {String} options.description 支付描述
 * @param {String} options.type 支付回调类型
 * @param {String} options.provider 支付供应商（可选，不传则打开收银台）
 * @param {Object} options.custom 自定义数据
 */
export function payWithUniPay(payComponent, options) {
	if (!payComponent) {
		throw new Error('uni-pay 组件未找到，请确保页面中已引入 uni-pay 组件')
	}

	const {
		order_no,
		out_trade_no,
		total_fee,
		description = '课程费用',
		type = 'appointment',
		provider = null,
		custom = {}
	} = options

	// 发起支付
	const payParams = {
		total_fee: total_fee, // 支付金额，单位分
		order_no: order_no, // 业务系统订单号
		out_trade_no: out_trade_no, // 插件支付单号
		description: description, // 支付描述
		type: type, // 支付回调类型
		custom: {
			appointment_id: custom.appointment_id,
			payment_type: custom.payment_type,
			...custom
		}
	}

	if (provider) {
		// 指定支付方式，直接发起支付
		payComponent.createOrder({
			provider: provider,
			...payParams
		})
	} else {
		// 不指定支付方式，打开收银台
		payComponent.open(payParams)
	}
}

/**
 * 生成支付单号（确保不超过32字节）
 * @param {String} appointment_id 预约ID
 * @param {String} payment_type 支付类型
 * @returns {String} 支付单号
 */
function generateOutTradeNo(appointment_id, payment_type) {
	// 提取预约ID的短标识（取后8位或全部，如果较短）
	const aptIdShort = appointment_id.length > 8 ? appointment_id.slice(-8) : appointment_id
	// 支付类型简写
	const typeMap = {
		'course_fee': 'CF',
		'deposit': 'DP',
		'refund': 'RF'
	}
	const typeShort = typeMap[payment_type] || 'PAY'
	// 时间戳后10位（秒级）
	const timestamp = String(Date.now()).slice(-10)
	// 组合：类型(2) + 时间戳(10) + 预约ID(最多8) = 最多20字节，远小于32字节限制
	return `${typeShort}${timestamp}${aptIdShort}`.slice(0, 32)
}

/**
 * 使用已有待支付订单发起 uni-pay 收银台
 * @param {Object} payComponent uni-pay 组件实例
 * @param {Object} options 支付参数
 * @param {String} options.order_no 业务订单号
 * @param {String} options.appointment_id 预约ID
 * @param {String} options.payment_type 支付类型
 * @param {Number} options.amount 支付金额（分）
 * @param {String} options.description 支付描述
 * @param {String} options.order_id 订单ID（可选）
 * @returns {Promise<Object>} 返回订单信息，实际支付结果通过组件事件返回
 */
export async function payExistingOrderWithUniPay(payComponent, options) {
	const {
		order_no,
		appointment_id,
		payment_type,
		amount,
		description,
		order_id,
		provider
	} = options

	if (!order_no || !appointment_id || amount == null || amount < 0) {
		throw new Error('支付参数不完整')
	}

	if (!payComponent) {
		throw new Error('uni-pay 组件未找到')
	}

	const amountInYuan = parseFloat((amount / 100).toFixed(2))
	if (amountInYuan <= 0 || isNaN(amountInYuan)) {
		throw new Error(`支付金额必须大于0，当前金额：${amount}分（${amountInYuan}元）`)
	}

	const out_trade_no = generateOutTradeNo(appointment_id, payment_type || 'course_fee')

	payWithUniPay(payComponent, {
		order_no,
		out_trade_no,
		total_fee: amount,
		description: description || (payment_type === 'deposit' ? '支付信息费' : '支付课程费用'),
		type: 'appointment',
		provider,
		custom: {
			appointment_id,
			payment_type: payment_type || 'course_fee',
			order_id
		}
	})

	return {
		code: 0,
		message: '请完成支付',
		data: {
			order_no,
			out_trade_no,
			order_id
		}
	}
}

/**
 * 创建并支付订单（使用 uni-pay 组件）
 * 注意：此方法会调用 uni-pay 组件发起支付，支付结果通过组件的 @success、@fail 事件返回
 * 建议在页面中监听这些事件来处理支付结果
 * @param {Object} payComponent uni-pay 组件实例
 * @param {Object} options 支付参数
 * @param {String} options.appointment_id 预约ID
 * @param {String} options.payment_type 支付类型（course_fee: 课程费, deposit: 信息费）
 * @param {Number} options.amount 支付金额（分）
 * @param {String} options.description 支付描述
 * @param {String} options.provider 支付供应商（可选）
 * @returns {Promise<Object>} 返回订单信息，实际支付结果通过组件事件返回
 */
export async function createAndPayWithUniPay(payComponent, options) {
	const { appointment_id, payment_type, amount, description, provider, user_coupon_id } = options
	
	// 允许 0 元支付（全额优惠），仅校验金额不为负且参数存在
	if (!appointment_id || amount == null || amount < 0) {
		throw new Error('支付参数不完整')
	}

	if (!payComponent && amount > 0) {
		throw new Error('uni-pay 组件未找到')
	}

	try {
		// 1. 先创建业务订单（必须在支付前创建）
		console.log('[支付流程] 开始创建业务订单...')
		// 金额转换：amount 是分，需要转换为元
		// 使用更精确的转换方式，支持小于1元的金额（如0.5元 = 50分）
		// 保留2位小数，避免浮点数精度问题
		const amountInYuan = parseFloat((amount / 100).toFixed(2))
		
		console.log('[支付流程] 金额转换:', {
			原始金额_分: amount,
			转换后金额_元: amountInYuan
		})
		
		if (amountInYuan < 0 || isNaN(amountInYuan)) {
			throw new Error(`支付金额不合法，当前金额：${amount}分（${amountInYuan}元）`)
		}
		
		const createRes = await createPaymentOrderProd({
			appointment_id,
			payment_type: payment_type || 'course_fee',
			amount: amountInYuan, // 云函数期望的是元
			user_coupon_id
		})
		
		if (createRes.code !== 0 || !createRes.data) {
			// 如果错误是"已支付过"，抛出特殊错误，让调用方处理
			const errorMessage = createRes.message || '创建订单失败'
			if (errorMessage.includes('已支付过')) {
				const error = new Error(errorMessage)
				error.code = 'ALREADY_PAID'
				error.createRes = createRes
				throw error
			}
			throw new Error(errorMessage)
		}
		
		const orderInfo = createRes.data
		const order_no = orderInfo.order_no
		const order_id = orderInfo.order_id
		
		console.log('[支付流程] 业务订单创建成功:', {
			order_id,
			order_no,
			amount: orderInfo.amount
		})
		
		if (amountInYuan === 0) {
			const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
			const payRes = await paymentCreate.mockPaySuccess({ order_no })
			if (payRes.code !== 0) {
				throw new Error(payRes.message || '优惠券抵扣失败')
			}
			return {
				code: 0,
				message: '优惠券已全额抵扣',
				data: {
					order_id,
					order_no,
					zero_pay: true
				}
			}
		}

		// 2. 生成支付单号（必须不超过32字节）
		const out_trade_no = generateOutTradeNo(appointment_id, payment_type || 'course_fee')
		
		// 3. 使用 uni-pay 组件发起支付
		// 注意：uni-pay 的 order_no 使用业务订单号，out_trade_no 使用短支付单号
		payWithUniPay(payComponent, {
			order_no, // 使用业务订单号
			out_trade_no, // 使用短支付单号
			total_fee: amount, // uni-pay 需要的是分
			description: description || (payment_type === 'deposit' ? '支付信息费' : '支付课程费用'),
			type: 'appointment',
			provider: provider, // 不传则打开收银台
			custom: {
				appointment_id,
				payment_type: payment_type || 'course_fee',
				order_id, // 保存订单ID，供支付成功后使用
				user_coupon_id: user_coupon_id || null
			}
		})

		// 返回订单信息，实际支付结果通过组件事件返回
		return {
			code: 0,
			message: '订单创建成功，请完成支付',
			data: {
				order_id,
				order_no,
				out_trade_no
			}
		}
	} catch (error) {
		console.error('[支付流程] 失败:', error)
		throw error
	}
}

/**
 * 创建并支付订单（兼容旧接口）
 * 已废弃模拟支付，请使用 createAndPayWithUniPay + uni-pay 组件
 * @param {Object} options 支付参数
 * @returns {Promise<Object>} 支付结果
 */
export async function createAndPay(options) {
	const { appointment_id, amount } = options

	if (!appointment_id || amount == null || amount < 0) {
		return {
			code: -1,
			message: '支付参数不完整'
		}
	}

	return {
		code: -1,
		message: '请通过支付界面完成支付',
		errorType: 'NO_PAY_CHANNEL'
	}
}
