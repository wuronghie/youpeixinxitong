<template>
	<view class="app">
		<view class="ios-tips">
			注意：苹果手机不支持微信虚拟支付
		</view>
		<view>
			<view class="label">模式：</view>
			<radio-group @change="modeChange">
				<label class="radio">
					<radio value="short_series_coin" checked="true" />代币充值
				</label>
				<label class="radio ml20">
					<radio value="short_series_goods" />道具直购
				</label>
			</radio-group>
		</view>
		<view class="mt20">
			<view class="label">支付单号：</view>
			<view><input v-model="out_trade_no" /></view>
		</view>
		<template v-if="wxpay_virtual.mode === 'short_series_coin'">
			<view>
				<view class="label">充值代币数量（建议设置1 人民币 = 100 代币）：</view>
				<view><input v-model.number="wxpay_virtual.buy_quantity" /></view>
			</view>
		</template>
		<template v-else-if="wxpay_virtual.mode === 'short_series_goods'">
			<view>
				<view class="label">道具选择：</view>
				<radio-group @change="productIdChange">
					<label class="radio">
						<radio value="test001" checked="true" />道具1
					</label>
					<label class="radio ml20">
						<radio value="test002" />道具2
					</label>
				</radio-group>
			</view>
			<view>
				<view class="label">购买道具数量：</view>
				<view><input v-model.number="wxpay_virtual.buy_quantity" /></view>
			</view>
		</template>
		
		<button @click="createOrder('wxpay-virtual')">发起微信虚拟支付</button>

		<button @click="getOrderPopup(true)">查询支付状态</button>
		<template v-if="wxpay_virtual.mode === 'short_series_coin'">
			<button @click="queryUserBalance">查询我的代币余额</button>
			<button @click="currencyPay">扣减代币</button>
		</template>
		<!-- 查询支付的弹窗 -->
		<uni-popup ref="getOrderPopup" type="bottom" :safe-area="false">
			<view class="get-order-popup">
				<view class="label">支付单号：</view>
				<view class="mt20">
					<input v-model="out_trade_no" placeholder="请输入" />
				</view>
				<view class="mt20">
					<button @click="getOrder">查询支付状态</button>
				</view>
				<view class="mt20" v-if="getOrderRes.transaction_id">
					<table class="table">
						<tr class="table-tr">
							<td class="align-left">订单描述</td>
							<td class="align-right">{{ getOrderRes.description }}</td>
						</tr>
						<tr class="table-tr">
							<td class="align-left">支付金额</td>
							<td class="align-right">{{ (getOrderRes.total_fee / 100).toFixed(2) }}</td>
						</tr>
						<tr class="table-tr">
							<td class="align-left">付款时间</td>
							<td class="align-right">{{ timeFormat(getOrderRes.pay_date,'yyyy-MM-dd hh:mm:ss') }}</td>
						</tr>
						<tr class="table-tr">
							<td class="align-left">支付方式</td>
							<td class="align-right">{{ providerFormat(getOrderRes.provider) }}</td>
						</tr>
						<tr class="table-tr">
							<td class="align-left">第三方交易单号</td>
							<td class="align-right">{{ getOrderRes.transaction_id }}</td>
						</tr>
						<tr class="table-tr">
							<td class="align-left">插件支付单号</td>
							<td class="align-right">{{ getOrderRes.out_trade_no }}</td>
						</tr>
						<tr class="table-tr">
							<td class="align-left">回调状态</td>
							<td class="align-right">{{ getOrderRes.user_order_success ? "成功" : "异常" }}</td>
						</tr>
					</table>
				</view>
			</view>
		</uni-popup>

		<!--
		<button @click="refund">发起退款</button>
		<view class="tips">发起退款需要admin权限，本示例未对接登录功能</view>
		<button @click="getRefund">查询退款状态</button>
		-->

		<!-- 统一支付组件，注意：vue3下ref不可以等于组件名，因此这里ref="pay" 而不能是 ref="uniPay" -->
		<uni-pay ref="pay" :adpid="adpid" height="70vh" return-url="/pages/order-detail/order-detail" logo="/static/logo.png" @success="onSuccess" @create="onCreate" @fail="onFail" @cancel="onCancel"></uni-pay>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				wxpay_virtual: {
					mode: "short_series_coin", // 模式 short_series_coin 代币充值 short_series_goods 道具直购
					buy_quantity: 1, // 购买代币数量或道具数量
					product_id: "test001", // 道具id，在微信小程序后台 - 功能 - 虚拟支付 - 基本配置 - 道具配置 中配置道具id
					goods_price: 1, // 道具价格，需要和配置的价格一致才能正常发起支付
				},
				order_no: "", // 业务系统订单号（即你自己业务系统的订单表的订单号）
				out_trade_no: "", // 插件支付单号
				description: "测试订单", // 支付描述
				type: "test", // 支付回调类型 如 recharge 代表余额充值 goods 代表商品订单（可自定义，任意英文单词都可以，只要你在 uni-pay-co/notify/目录下创建对应的 xxx.js文件进行编写对应的回调逻辑即可）
				openid: "", // 微信小程序的用户openid
				adpid: "1000000001", // uni-ad的广告位id
				getOrderRes: {}, // 查询订单支付成功后的返回值
			}
		},
		onLoad(options = {}) {
			
		},
		methods: {
			/**
			 * 发起支付（不唤起收银台，手动指定支付方式）
			 * 在调用此api前，你应该先创建自己的业务系统订单，并获得订单号 order_no，把order_no当参数传给此api，而示例中为了简化跟支付插件无关的代码，这里直接已时间戳生成了order_no
			 */
			createOrder(provider) {
				// #ifndef MP-WEIXIN
				uni.showModal({
					title: "提示",
					content: "请在微信小程序中体验",
					showCancel: false
				});
				return;
				// #endif
				this.order_no = `test` + Date.now();
				this.out_trade_no = `${this.order_no}-1`;
				// 发起支付
				this.$refs.pay.createOrder({
					provider: provider, // 支付供应商
					order_no: this.order_no, // 业务系统订单号（即你自己业务系统的订单表的订单号）
					out_trade_no: this.out_trade_no, // 插件支付单号
					description: this.description, // 支付描述
					type: this.type, // 支付回调类型
					wxpay_virtual: this.wxpay_virtual, // 微信虚拟支付专属字段
					// 自定义数据
					custom: {
						user_id: "001", // 业务系统用户id
					},
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
					out_trade_no: this.out_trade_no, // 插件支付单号 两者传1个即可
					await_notify: false, // 是否等待异步通知
				});
				if (res) {
					this.getOrderRes = res.pay_order;
					if (!res.has_paid) {
						uni.showToast({
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
						uni.showToast({
							title: obj[res.status] || res.errMsg,
							icon: "none"
						});
					} else if (res.user_order_success === false) {
						uni.showModal({
							content: "付款成功，且已接收到异步回调，但自定义回调逻辑执行失败",
							showCancel: false
						});
					} else if (res.status === 0) {
						uni.showModal({
							content: "付款成功，但还未收到异步回调",
							showCancel: false
						});
					} else {
						uni.showModal({
							content: "付款成功，且已接收到异步回调，但自定义回调逻辑还在执行中",
							showCancel: false
						});
					}
				}
			},
			// 发起退款
			async refund() {
				let res = await this.$refs.pay.refund({
					out_trade_no: this.out_trade_no, // 插件支付单号
				});
				if (res) {
					uni.showToast({
						title: res.errMsg,
						icon: "none"
					});
				}
			},
			// 查询退款状态
			async getRefund() {
				let res = await this.$refs.pay.getRefund({
					out_trade_no: this.out_trade_no, // 插件支付单号
				});
				if (res) {
					uni.showModal({
						content: res.errMsg,
						showCancel: false
					});
				}
			},
			// 监听事件 - 支付订单创建成功（此时用户还未支付）
			onCreate(res) {
				console.log('create: ', res);
				
			},
			// 监听事件 - 支付成功
			onSuccess(res) {
				console.log('success: ', res);
				if (res.user_order_success) {
					// 代表用户已付款，且你自己写的回调成功并正确执行了

				} else {
					// 代表用户已付款，但你自己写的回调执行失败（通常是因为你的回调代码有问题）

				}
			},
			onFail(err) {
				console.log('err: ', err)
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
					"-15021": "小程序被限频交易",
				}
				let errMsg = errData[String(err.errCode)] || err.errMsg;
				if (errMsg === "requestVirtualPayment:fail INVALID_PLATFORM") {
					errMsg = "苹果手机不支持微信虚拟支付";
				} else if (errMsg === "requestVirtualPayment:fail no permission") {
					errMsg = "微信基础库 2.19.2 开始才支付微信虚拟支付";
				}
				console.error(errMsg);
				if (err.code !== "FUNCTION_EXCUTE_ERROR") {
					uni.showModal({
						title: "提示",
						content: errMsg,
						showCancel: false
					});
				}
			},
			onCancel(err) {
				console.log('用户取消了支付: ', err)
			},
			// 查询用户微信虚拟支付代币余额（微信虚拟支付的代币余额是通过调用微信API查询的）
			async queryUserBalance() {
				// #ifndef MP-WEIXIN
				uni.showModal({
					title: "提示",
					content: "请在微信小程序中体验",
					showCancel: false
				});
				return;
				// #endif
				const wxpayVirtualCo = uniCloud.importObject("wxpay-virtual-co");
				let queryUserBalanceRes = await wxpayVirtualCo.queryUserBalance({
					openid: this.$refs.pay.openid,
				});
				let { balance, presentBalance } = queryUserBalanceRes;
				let content = `我的余额：${balance}`;
				if (presentBalance) {
					content += `（含赠送余额：${presentBalance}）`;
				}
				uni.showModal({
					title: "提示",
					content,
					showCancel: false
				})
			},
			// 扣减用户代币，扣减用户代币需要保证用户的sessionKey在有效期内（uni-pay组件会自动获取当前微信用户的sessionKey）
			async currencyPay() {
				// #ifndef MP-WEIXIN
				uni.showModal({
					title: "提示",
					content: "请在微信小程序中体验",
					showCancel: false
				});
				return;
				// #endif
				const wxpayVirtualCo = uniCloud.importObject("wxpay-virtual-co");
				// 从uni-pay组件中获取openid
				let { openid } = this.$refs.pay;
				let queryUserBalanceRes = await wxpayVirtualCo.currencyPay({
					openid
				});
				uni.showModal({
					title: "提示",
					content: `成功扣减余额：${queryUserBalanceRes.amount}，还剩余额：${queryUserBalanceRes.balance}`,
					showCancel: false
				})
			},
			// 监听模式选择
			modeChange(e) {
				this.wxpay_virtual.mode = e.detail.value;
			},
			// 监听道具选择
			productIdChange(e) {
				this.wxpay_virtual.product_id = e.detail.value;
				if (e.detail.value === "test002") {
					this.wxpay_virtual.goods_price = 2; // 道具价格
				} else {
					this.wxpay_virtual.goods_price = 1; // 道具价格
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
			timeFormat(time, fmt = 'yyyy-MM-dd hh:mm:ss', targetTimezone = 8) {
				try {
					if (!time) {
						return "";
					}
					if (typeof time === "string" && !isNaN(time)) time = Number(time);
					// 其他更多是格式化有如下:
					// yyyy-MM-dd hh:mm:ss|yyyy年MM月dd日 hh时MM分等,可自定义组合
					let date;
					if (typeof time === "number") {
						if (time.toString().length == 10) time *= 1000;
						date = new Date(time);
					} else {
						date = time;
					}

					const dif = date.getTimezoneOffset();
					const timeDif = dif * 60 * 1000 + (targetTimezone * 60 * 60 * 1000);
					const east8time = date.getTime() + timeDif;

					date = new Date(east8time);
					let opt = {
						"M+": date.getMonth() + 1, //月份
						"d+": date.getDate(), //日
						"h+": date.getHours(), //小时
						"m+": date.getMinutes(), //分
						"s+": date.getSeconds(), //秒
						"q+": Math.floor((date.getMonth() + 3) / 3), //季度
						"S": date.getMilliseconds() //毫秒
					};
					if (/(y+)/.test(fmt)) {
						fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
					}
					for (let k in opt) {
						if (new RegExp("(" + k + ")").test(fmt)) {
							fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (opt[k]) : (("00" + opt[k]).substr(("" + opt[k]).length)));
						}
					}
					return fmt;
				} catch (err) {
					// 若格式错误,则原值显示
					return time;
				}
			},
		},
		computed: {
		
		},
	}
</script>

<style lang="scss" scoped>
	.app {
		padding: 15px;
		font-size: 16px;
	}

	input {
		border: 1px solid #f3f3f3;
		padding: 0 10px;
		width: 100%;
		box-sizing: border-box;
		height: 40px;
	}

	button {
		margin-top: 10px;
	}

	.label {
		margin: 5px 0;
	}

	.tips {
		margin-top: 10px;
		font-size: 12px;
		color: #565656;
	}

	.get-order-popup {
		background-color: #ffffff;
		padding: 15px;
		height: 60vh;
		border-radius: 15px 15px 0 0;
		overflow: hidden;
	}

	.ml20 {
		margin-left: 10px;
	}

	.mt20 {
		margin-top: 10px;
	}

	.table {
		font-size: 12px;
		width: 100%;
	}

	.table-tr {
		display: flex;
		margin-top: 10px;
	}

	.align-left {
		text-align: left;
		width: 50%;
	}

	.align-right {
		text-align: right;
		width: 50%;
	}

	.ios-tips {
		color: #e43d33;
		font-size: 14px;
	}
</style>