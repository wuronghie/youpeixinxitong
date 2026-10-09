<template>
	<view class="page">
		<view class="result">
			<view class="mark" :class="status === 'success' ? 'ok' : 'fail'">
				<text class="mark-text">{{ status === 'success' ? '✓' : '!' }}</text>
			</view>
			<text class="title">{{ status === 'success' ? '支付成功' : '支付失败' }}</text>
			<text class="message">{{ displayMessage }}</text>

			<button
				v-if="status === 'success' && appointmentId"
				class="btn btn-primary"
				@click="handleBack"
			>查看预约</button>
			<button
				v-if="status === 'success' && !appointmentId"
				class="btn btn-primary"
				@click="handleBack"
			>返回商家</button>
			<button
				v-if="status === 'success'"
				class="btn btn-ghost"
				@click="goHome"
			>返回首页</button>
			<button
				v-if="status === 'fail'"
				class="btn btn-primary"
				@click="handleBack"
			>返回商家</button>
		</view>
	</view>
</template>

<script>
export default {
	name: 'PaymentResult',
	data() {
		return {
			status: 'success',
			message: '',
			returnPage: '',
			appointmentId: '',
			role: ''
		}
	},
	onLoad(options = {}) {
		this.status = options.status === 'fail' ? 'fail' : 'success'
		this.message = options.message || ''
		this.returnPage = options.returnPage || ''
		this.appointmentId = options.appointmentId || ''
		this.role = options.role || 'parent'
	},
	computed: {
		displayMessage() {
			if (this.message) return this.message
			return this.status === 'success'
				? '支付已完成，您可以返回继续浏览订单详情。'
				: '可返回订单重新支付，或稍后再试。'
		}
	},
	methods: {
		handleBack() {
			if (this.returnPage) {
				let url = this.returnPage
				if (this.appointmentId) {
					const connector = url.includes('?') ? '&' : '?'
					url = `${url}${connector}id=${this.appointmentId}`
				}
				uni.redirectTo({ url })
				return
			}

			if (this.appointmentId) {
				if (this.role === 'teacher') {
					uni.redirectTo({
						url: `/pages-teacher/appointment/detail?id=${this.appointmentId}`
					})
				} else {
					uni.redirectTo({
						url: `/pages-biz/appointment/detail?id=${this.appointmentId}`
					})
				}
			} else {
				uni.navigateBack({ delta: 1 })
			}
		},
		goHome() {
			if (this.role === 'teacher') {
				uni.redirectTo({ url: '/pages-teacher/index/index' })
				return
			}
			uni.redirectTo({ url: '/pages/teacher/list' })
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
}

.result {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 128rpx 64rpx 48rpx;
}

.mark {
	width: 144rpx;
	height: 144rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 32rpx;
}

.mark.ok {
	background: #07C160;
}

.mark.fail {
	background: #FA5151;
}

.mark-text {
	color: #FFFFFF;
	font-size: 72rpx;
	font-weight: 600;
	line-height: 1;
}

.title {
	font-size: 40rpx;
	font-weight: 600;
	color: #1F2329;
}

.message {
	margin: 16rpx 0 40rpx;
	font-size: 26rpx;
	color: #5C6370;
	text-align: center;
	line-height: 1.6;
}

.btn {
	width: 100%;
	height: 88rpx;
	margin: 0;
	padding: 0;
	border: none;
	border-radius: 20rpx;
	font-size: 30rpx;
	font-weight: 600;
	line-height: 88rpx;
}

.btn::after {
	border: none;
}

.btn-primary {
	background: #2563EB;
	color: #FFFFFF;
}

.btn-ghost {
	margin-top: 20rpx;
	background: #EEF3FF;
	color: #2563EB;
}
</style>
