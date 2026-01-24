<template>
	<view class="app">
		<view>
			<view class="label">支付单号：</view>
			<view><input v-model="out_trade_no" /></view>
		</view>
		<view>
			<view class="label">支付金额（单位分，100=1元）：</view>
			<view><input v-model.number="total_fee" /></view>
		</view>
		
		<!-- #ifdef APP-HARMONY -->
		<button @click="createOrder('wxpay')">发起微信支付</button>
		<button @click="createOrder('alipay')">发起支付宝支付</button>
		<!-- #endif -->
		
		<button @click="createOrder('huawei')">发起华为支付</button>
		
		<button @click="getOrderPopup(true)">查询支付状态</button>
		<!-- 查询支付的弹窗 -->
		<view class="get-order-popup-box" v-if="getOrderPopupShow">
			<view class="get-order-popup-mask" @click="getOrderPopupShow=false"></view>
			<view class="get-order-popup">
				<view class="label">插件支付单号：</view>
				<view class="mt20">
					<input class="pd1015" v-model="out_trade_no" placeholder="请输入" />
				</view>
				<view class="mt20">
					<button @click="getOrder">查询支付状态</button>
				</view>
				<view class="mt20" v-if="getOrderRes.transaction_id">
					<table class="table">
						<tr class="tr">
							<td class="align-left">订单描述</td>
							<td class="align-right">{{ getOrderRes.description }}</td>
						</tr>
						<tr class="tr">
							<td class="align-left">支付金额</td>
							<td class="align-right">{{ (getOrderRes.total_fee / 100).toFixed(2) }}</td>
						</tr>
						<tr class="tr">
							<td class="align-left">付款时间</td>
							<td class="align-right">{{ timeFormat(getOrderRes.pay_date,'yyyy-MM-dd hh:mm:ss') }}</td>
						</tr>
						<tr class="tr">
							<td class="align-left">支付方式</td>
							<td class="align-right">{{ providerFormat(getOrderRes.provider) }}</td>
						</tr>
						<tr class="tr">
							<td class="align-left">第三方交易单号</td>
							<td class="align-right">{{ getOrderRes.transaction_id }}</td>
						</tr>
						<tr class="tr">
							<td class="align-left">插件支付单号</td>
							<td class="align-right">{{ getOrderRes.out_trade_no }}</td>
						</tr>
						<tr class="tr">
							<td class="align-left">回调状态</td>
							<td class="align-right">{{ getOrderRes.user_order_success ? "成功" : "异常" }}</td>
						</tr>
					</table>
				</view>
			</view>
		</view>
		

		<!-- <button @click="refund">发起退款</button>
		<view class="tips">发起退款需要admin权限，本示例未对接登录功能</view>
		<button @click="getRefund">查询退款状态</button> -->

		
		<!-- 统一支付组件，注意：vue3下ref不可以等于组件名，因此这里ref="pay" 而不能是 ref="uniPay" -->
		<uni-pay ref="pay" :adpid="adpid" height="70vh" return-url="/pages/order-detail/order-detail" logo="/static/logo.png" @success="onSuccess" @create="onCreate" @fail="onFail"></uni-pay>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				total_fee: 1, // 支付金额，单位分 100 = 1元
				order_no: "", // 业务系统订单号（即你自己业务系统的订单表的订单号）
				out_trade_no: "", // 插件支付单号
				description: "测试订单", // 支付描述
				type: "test", // 支付回调类型 如 recharge 代表余额充值 goods 代表商品订单（可自定义，任意英文单词都可以，只要你在 uni-pay-co/notify/目录下创建对应的 xxx.js文件进行编写对应的回调逻辑即可）
				//qr_code: true, // 是否强制使用扫码支付
				biz_type: "100002", // 业务类型，华为支付必传
				custom: {
					a: "a",
					b: 1
				},
				adpid: "1000000001", // uni-ad的广告位id
				
				transaction_id:"", // 查询订单接口的查询条件
				getOrderRes:{}, // 查询订单支付成功后的返回值
				getOrderPopupShow: false
			}
		},
		onLoad(options={}) {
			
		},
		methods: {
			/**
			 * 发起支付（唤起收银台，如果只有一种支付方式，则收银台不会弹出来，会直接使用此支付方式）
			 * 在调用此api前，你应该先创建自己的业务系统订单，并获得订单号 order_no，把order_no当参数传给此api，而示例中为了简化跟支付插件无关的代码，这里直接已时间戳生成了order_no
			 */
			open() {
				this.order_no = `test`+Date.now();
				this.out_trade_no = `${this.order_no}-1`;
				// 打开支付收银台
				this.$refs.pay.open({
					total_fee: this.total_fee, // 支付金额，单位分 100 = 1元
					order_no: this.order_no, // 业务系统订单号（即你自己业务系统的订单表的订单号）
					out_trade_no: this.out_trade_no, // 插件支付单号
					description: this.description, // 支付描述
					type: this.type, // 支付回调类型
					qr_code: this.qr_code, // 是否强制使用扫码支付
					openid: this.openid, // 微信公众号需要
					custom: this.custom, // 自定义数据
				});
			},
			/**
			 * 发起支付（不唤起收银台，手动指定支付方式）
			 * 在调用此api前，你应该先创建自己的业务系统订单，并获得订单号 order_no，把order_no当参数传给此api，而示例中为了简化跟支付插件无关的代码，这里直接已时间戳生成了order_no
			 */
			createOrder(provider){
				this.order_no = `test`+Date.now();
				this.out_trade_no = `${this.order_no}-1`;
				// 发起支付
				this.$refs.pay.createOrder({
					provider: provider, // 支付供应商
					total_fee: this.total_fee, // 支付金额，单位分 100 = 1元
					order_no: this.order_no, // 业务系统订单号（即你自己业务系统的订单表的订单号）
					out_trade_no: this.out_trade_no, // 插件支付单号
					description: this.description, // 支付描述
					type: this.type, // 支付回调类型
					qr_code: this.qr_code, // 是否强制使用扫码支付
					openid: this.openid, // 微信公众号需要
					custom: this.custom, // 自定义数据
					biz_type: this.biz_type, // 业务类型，华为支付必传
				});
			},
			// 打开查询订单的弹窗
			getOrderPopup(key){
				this.getOrderPopupShow = key;
				if (key && this.out_trade_no) {
					this.getOrder();
				}
			},
			// 查询支付状态
			async getOrder() {
				this.getOrderRes = {};
				let res = await this.$refs.pay.getOrder({
					out_trade_no: this.out_trade_no, // 插件支付单号 两者传1个即可
					//transaction_id: this.transaction_id, // 第三方单号 两者传1个即可
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
					uni.showToast({
						title: obj[res.status] || res.errMsg,
						icon: "none"
					});
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
			// 关闭订单
			async closeOrder() {
				let res = await this.$refs.pay.closeOrder({
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
			onCreate(res){
				console.log('create: ', res);
				// 如果只是想生成支付二维码，不需要组件自带的弹窗，则在这里可以获取到支付二维码 qr_code_image
			},
			// 监听事件 - 支付成功
			onSuccess(res){
				console.log('success: ', res);
				if (res.user_order_success) {
					// 代表用户已付款，且你自己写的回调成功并正确执行了
					
				} else {
					// 代表用户已付款，但你自己写的回调执行失败（通常是因为你的回调代码有问题）
	
				}
			},
			onFail(err){
				console.log('err: ', err)
				
			},
			pageTo(url){
				uni.navigateTo({
					url
				});
			},
			providerFormat(provider){
				let providerObj = {
					"wxpay": "微信支付",
					"alipay": "支付宝支付",
					"appleiap": "ios内购",
					"huawei": "华为支付"
				};
				let providerStr = providerObj[provider] || "未知";
				return providerStr;
			},
			/**
			 * 日期格式化
			 * @params {Date || Number} date 需要格式化的时间
			 * timeFormat(new Date(),"yyyy-MM-dd hh:mm:ss");
			 */
			timeFormat(time, fmt = 'yyyy-MM-dd hh:mm:ss', targetTimezone = 8){
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
			h5Env(){
				// #ifdef H5
				let ua = window.navigator.userAgent.toLowerCase();
				if (ua.match(/MicroMessenger/i) == 'micromessenger' && (ua.match(/miniprogram/i) == 'miniprogram')) {
					// 微信小程序
					return "mp-weixin";
				}
				if (ua.match(/MicroMessenger/i) == 'micromessenger') {
					// 微信公众号
					return "h5-weixin";
				}
				if (ua.match(/alipay/i) == 'alipay' && ua.match(/miniprogram/i) == 'miniprogram') {
					return "mp-alipay";
				}
				if (ua.match(/alipay/i) == 'alipay') {
					return "h5-alipay";
				}
				// 外部 H5
				return "h5";
				// #endif
			},
			// 计算当前是否是ios app
			isIosAppCom(){
				let info = uni.getSystemInfoSync();
				return info.uniPlatform === 'app' && info.osName === 'ios' ? true : false;
			},
			// 计算当前是否是PC环境
			isPcCom(){
				// #ifdef H5
				let info = uni.getSystemInfoSync();
				return info.deviceType === 'pc' ? true : false;
				// #endif
				return false;
			}
		},
	}
</script>

<style lang="scss" scoped>
	.app{
		padding: 15px;
		font-size: 16px;
	}
	input {
		border: 1px solid #f3f3f3;
		padding: 5px;
		width: 100%;
		box-sizing: border-box;
		height: 40px;
	}

	button {
		margin-top: 10px;
	}
	
	.label{
		margin: 10rpx 0;
	}
	
	.tips{
		margin-top: 10px;
		font-size: 12px;
		color: #565656;
	}
	.get-order-popup-box {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0,0,0,0.5);
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.get-order-popup-mask {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		background-color: rgba(0,0,0,0.5);
	}
	.get-order-popup{
		width: 80%;
		max-width: 800px;
		position: relative;
		z-index: 2;
		background-color: #ffffff;
		padding: 15px;
		height: 60vh;
		border-radius: 15px;
		overflow: hidden;
	}
	.mt20{
		margin-top: 10px;
	}
	
	.pd1015{
		padding: 10px 15px;
	}
	
	.table{
		width: 100%;
		font-size: 12px;
	}
	.tr {
		display: flex;
		width: 100%;
	}
	.align-left{
		text-align: left;
		width: 100px;
	}
	.align-right{
		text-align: right;
		flex: 1;
	}
	
	
</style>
