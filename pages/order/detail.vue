<template>
	<view class="page">
		<text v-if="statusTip" class="form-tip">{{ statusTip }}</text>

		<view class="form-card">
			<view class="form-row">
				<text class="form-label">订单号</text>
				<text class="form-val">{{ order.order_no || '-' }}</text>
			</view>
			<view class="form-row">
				<text class="form-label">状态</text>
				<text class="form-val" :class="statusTone">{{ formatStatus(order.status) }}</text>
			</view>
			<view v-if="teacherName" class="form-row">
				<text class="form-label">教师</text>
				<text class="form-val">{{ teacherName }}</text>
			</view>
			<view class="form-row">
				<text class="form-label">课程</text>
				<text class="form-val">{{ courseLabel }}</text>
			</view>
			<view v-if="order.appointment_info" class="form-row">
				<text class="form-label">上课时间</text>
				<text class="form-em">{{ order.appointment_info.date }} {{ order.appointment_info.time }}</text>
			</view>
			<view class="form-row">
				<text class="form-label">创建时间</text>
				<text class="form-em">{{ formatTime(order.create_time) }}</text>
			</view>
			<view v-if="order.pay_time" class="form-row">
				<text class="form-label">支付时间</text>
				<text class="form-em">{{ formatTime(order.pay_time) }}</text>
			</view>
			<view v-if="order.refund_time" class="form-row">
				<text class="form-label">退款时间</text>
				<text class="form-em">{{ formatTime(order.refund_time) }}</text>
			</view>
			<view class="form-row" :class="{ last: !order.appointment_info && !order.refund_amount }">
				<text class="form-label">实付</text>
				<text class="form-price">¥{{ Number(order.amount || 0).toFixed(2) }}</text>
			</view>
			<view v-if="order.refund_amount" class="form-row" :class="{ last: !order.appointment_info }">
				<text class="form-label">退款金额</text>
				<text class="form-price">¥{{ Number(order.refund_amount || 0).toFixed(2) }}</text>
			</view>
			<view v-if="order.appointment_info" class="form-row last" @click="goAppointment(order.appointment_info._id)">
				<text class="form-label">关联预约</text>
				<text class="form-em brand">查看预约详情 ›</text>
			</view>
		</view>

		<view v-if="order.pay_channel || hasCoupon || order.platform_fee || order.teacher_income" class="form-card">
			<view v-if="order.pay_channel" class="form-row">
				<text class="form-label">支付方式</text>
				<text class="form-em">{{ formatPayChannel(order.pay_channel) }}</text>
			</view>
			<view v-if="order.transaction_id" class="form-row">
				<text class="form-label">流水号</text>
				<text class="form-em">{{ order.transaction_id }}</text>
			</view>
			<view class="form-row" :class="{ last: !order.platform_fee && !order.teacher_income }">
				<text class="form-label">优惠券</text>
				<text class="form-em">{{ couponText }}</text>
			</view>
			<view v-if="order.platform_fee" class="form-row" :class="{ last: !order.teacher_income }">
				<text class="form-label">平台服务费</text>
				<text class="form-em">¥{{ Number(order.platform_fee || 0).toFixed(2) }}</text>
			</view>
			<view v-if="order.teacher_income" class="form-row last">
				<text class="form-label">教师收入</text>
				<text class="form-em">¥{{ Number(order.teacher_income || 0).toFixed(2) }}</text>
			</view>
		</view>

		<view v-if="order.refund_info || refundInfo" class="form-card">
			<text class="section-title">退款进度</text>
			<view
				v-for="(step, index) in refundSteps"
				:key="step.key"
				class="step-row"
				:class="{ last: index === refundSteps.length - 1 }"
			>
				<view class="step-dot" :class="{ on: step.active }"></view>
				<view class="step-main">
					<text class="step-title">{{ step.title }}</text>
					<text class="step-time">{{ step.time || '待处理' }}</text>
				</view>
			</view>
			<view v-if="refundInfo?.status === 'pending'" class="form-row last" @click="contactService">
				<text class="form-label">客服</text>
				<text class="form-em brand">查看处理进度 ›</text>
			</view>
		</view>

		<view v-if="canConfirmCompletion || canReview || canApplyRefund || primaryAction" class="action-stack">
			<button
				v-if="primaryAction === 'pay'"
				class="btn btn-primary"
				@click="gotoPay"
			>立即支付</button>
			<button
				v-if="canConfirmCompletion"
				class="btn btn-ghost"
				@click="confirmCompletion"
			>确认课程完成</button>
			<button
				v-if="canReview"
				class="btn btn-line"
				@click="goReview"
			>写评价</button>
			<button
				v-if="canApplyRefund"
				class="btn btn-line"
				@click="goRefund"
			>异常情况申请退款</button>
			<button
				v-if="primaryAction === 'contact'"
				class="btn btn-line"
				@click="contactService"
			>联系客服</button>
			<button
				v-if="primaryAction === 'refunded'"
				class="btn btn-disabled"
				disabled
			>订单已退款</button>
			<button
				v-if="primaryAction === 'refunding'"
				class="btn btn-disabled"
				disabled
			>退款处理中</button>
		</view>
	</view>
</template>

<script>
export default {
	name: 'OrderDetail',
	data() {
		return {
			orderId: '',
			order: {},
			refundInfo: null,
			isLoading: false,
			isRefreshing: false,
			scrollTop: 0,
			canRefresh: true,
			adminWechat: 'chen18148503231'
		}
	},
	onLoad(options) {
		this.orderId = options.id || options.orderNo || ''
		if (!this.orderId) {
			uni.showToast({ title: '订单ID不能为空', icon: 'none' })
			setTimeout(() => uni.navigateBack(), 1500)
			return
		}
		this.loadDetail()
	},
	computed: {
		statusTip() {
			const map = {
				unpaid: '请尽快完成支付，预约才可确认',
				pending: '订单待支付，请尽快完成支付',
				paid: '订单已支付，请在课程结束后及时确认',
				success: '课程已完成，可前往评价或查看课程记录',
				refunding: '退款申请处理中，请耐心等待',
				refunded: '订单已退款，资金将在 1-3 个工作日内退回'
			}
			if (this.isResultConfirmed && ['paid', 'success'].includes(this.order.status)) {
				return '已确认上课结果，不可再申请退款'
			}
			return map[this.order.status] || ''
		},
		statusTone() {
			const map = {
				unpaid: 'tone-pay',
				pending: 'tone-pay',
				paid: 'tone-done',
				success: 'tone-done',
				refunding: 'tone-wait',
				refunded: 'tone-muted'
			}
			return map[this.order.status] || ''
		},
		teacherName() {
			const info = this.order.appointment_info || {}
			return info.teacher_info?.display_name || info.teacher_info?.name || info.teacher_name || ''
		},
		courseLabel() {
			const info = this.order.appointment_info || {}
			const subjects = info.teacher_info?.subjects
			const subject = Array.isArray(subjects) ? (subjects[0] || '') : (typeof subjects === 'string' ? subjects : '')
			const typeMap = {
				trial: '试课',
				regular: '正式课',
				formal: '正式课',
				deposit: '信息费',
				refund: '退款'
			}
			const type = typeMap[info.course_type || this.order.order_type] || this.formatOrderType(this.order.order_type)
			return subject ? `${subject} · ${type}` : type
		},
		hasCoupon() {
			return Number(this.order.discount_amount || 0) > 0 || !!this.order.user_coupon_id
		},
		couponText() {
			const discount = Number(this.order.discount_amount || 0)
			if (discount > 0) return `已减 ¥${discount.toFixed(2)}`
			if (this.order.user_coupon_id) return '已使用'
			return '未使用'
		},
		isResultConfirmed() {
			const appointment = this.order?.appointment_info || {}
			return appointment.status === 'completed' ||
				appointment.has_review === true ||
				this.order.has_review === true
		},
		canApplyRefund() {
			if (!['paid', 'success'].includes(this.order.status) || this.refundInfo) return false
			if (this.isResultConfirmed) return false
			return true
		},
		canReview() {
			const appointment = this.order?.appointment_info || {}
			if (!appointment._id) return false
			if (appointment.has_review || this.order.has_review) return false
			const orderStatusAllow = ['paid', 'success']
			const appointmentStatusAllow = ['completed']
			return orderStatusAllow.includes(this.order.status) && appointmentStatusAllow.includes(appointment.status)
		},
		canConfirmCompletion() {
			const appointment = this.order?.appointment_info || {}
			if (!appointment._id) return false
			if (appointment.has_review) return false
			const orderStatusAllow = ['paid', 'success']
			const appointmentStatusAllow = ['confirmed', 'in_progress']
			return orderStatusAllow.includes(this.order.status) && appointmentStatusAllow.includes(appointment.status)
		},
		primaryAction() {
			if (['unpaid', 'pending'].includes(this.order.status)) return 'pay'
			if (['paid', 'success'].includes(this.order.status)) return 'contact'
			if (this.order.status === 'refunded') return 'refunded'
			if (this.order.status === 'refunding') return 'refunding'
			return ''
		},
		refundSteps() {
			if (!this.refundInfo) {
				return []
			}
			return [
				{
					key: 'apply',
					title: '提交退款申请',
					time: this.formatTime(this.refundInfo.create_time),
					active: true
				},
				{
					key: 'review',
					title: '平台审核',
					time: this.refundInfo.review_time ? this.formatTime(this.refundInfo.review_time) : '',
					active: ['approved', 'success', 'processing'].includes(this.refundInfo.status)
				},
				{
					key: 'result',
					title: this.refundInfo.status === 'rejected' ? '退款已驳回' : '退款完成',
					time: this.refundInfo.status === 'success' ? this.formatTime(this.refundInfo.finish_time || this.order.refund_time) : '',
					active: ['success'].includes(this.refundInfo.status)
				}
			]
		}
	},
	methods: {
		async refreshData() {
			if (this.orderId) {
				await this.loadDetail()
			}
		},
		async loadDetail() {
			if (this.isLoading) return
			this.isLoading = true
			try {
				const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
				const res = await paymentCreate.getOrderDetail({ order_id: this.orderId })
				if (res.code === 0 && res.data) {
					this.order = {
						...res.data,
						has_review: !!res.data.has_review,
						appointment_info: res.data.appointment_info
							? {
									...res.data.appointment_info,
									has_review: !!res.data.appointment_info.has_review
								}
							: null
					}
					if (res.data.refund_info) {
						this.refundInfo = res.data.refund_info
					}
				} else {
					throw new Error(res.message || '获取订单失败')
				}
				await this.loadRefundDetail()
			} catch (error) {
				console.error('获取订单详情失败:', error)
				uni.showToast({ title: error.message || '获取订单失败', icon: 'none' })
			} finally {
				this.isLoading = false
				this.isRefreshing = false
			}
		},
		async loadRefundDetail() {
			try {
				const refundObj = uniCloud.importObject('payment-refund', { customUI: true })
				const res = await refundObj.getDetail({ order_id: this.orderId })
				if (res.code === 0 && res.data) {
					this.refundInfo = res.data
				}
			} catch (error) {
				// 未申请退款无需提示
			}
		},
		handleScroll(e) {
			this.scrollTop = e.detail.scrollTop
			this.canRefresh = e.detail.scrollTop <= 10
		},
		handleScrollToUpper() {
			this.scrollTop = 0
			this.canRefresh = true
		},
		onRefresh() {
			if (!this.canRefresh || this.scrollTop > 10) {
				this.isRefreshing = false
				return
			}
			if (this.isRefreshing) return
			this.isRefreshing = true
			this.loadDetail()
		},
		formatStatus(status) {
			const map = {
				unpaid: '待支付',
				pending: '待支付',
				paid: '已支付',
				success: '已支付',
				refunding: '退款中',
				refunded: '已退款'
			}
			return map[status] || '未知状态'
		},
		formatOrderType(type) {
			const map = {
				trial: '试课订单',
				regular: '正式课程订单',
				deposit: '信息费',
				refund: '退款订单'
			}
			return map[type] || '课程订单'
		},
		formatPayChannel(channel) {
			const map = {
				wechat: '微信支付',
				alipay: '支付宝',
				balance: '余额支付'
			}
			return map[channel] || '其他支付'
		},
		formatTime(ts) {
			if (!ts) return '-'
			const date = new Date(ts)
			const year = date.getFullYear()
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${year}-${month}-${day} ${hour}:${minute}`
		},
		goAppointment(appointmentId) {
			if (!appointmentId) return
			uni.navigateTo({ url: `/pages-biz/appointment/detail?id=${appointmentId}` })
		},
		goRefund() {
			if (!this.canApplyRefund) {
				uni.showToast({ title: '已确认上课结果，不可再申请退款', icon: 'none' })
				return
			}
			uni.navigateTo({ url: `/pages/order/refund?id=${this.orderId}` })
		},
		gotoPay() {
			uni.showToast({ title: '跳转支付中...', icon: 'none' })
		},
		goReview() {
			const appointmentId = this.order?.appointment_info?._id || this.order?.appointment_id
			if (!appointmentId) {
				uni.showToast({ title: '未找到对应预约', icon: 'none' })
				return
			}
			uni.navigateTo({ url: `/pages/review/create?appointmentId=${appointmentId}` })
		},
		confirmCompletion() {
			const appointmentId = this.order?.appointment_info?._id
			if (!appointmentId) {
				uni.showToast({ title: '未找到对应预约', icon: 'none' })
				return
			}
			uni.showModal({
				title: '确认课程完成',
				content: '确认课程已顺利完成？确认后将开启评价并结束订单。',
				success: async res => {
					if (!res.confirm) return
					try {
						const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
						const result = await appointmentQuery.confirmCompletion({ appointment_id: appointmentId })
						if (result.code === 0) {
							uni.showToast({ title: '已确认完成', icon: 'success' })
							setTimeout(() => {
								this.loadDetail()
							}, 600)
						} else {
							uni.showToast({ title: result.message || '确认失败', icon: 'none' })
						}
					} catch (error) {
						console.error('确认课程完成失败:', error)
						uni.showToast({ title: '确认失败，请稍后重试', icon: 'none' })
					}
				}
			})
		},
		contactService() {
			const wechat = this.adminWechat
			if (!wechat) {
				uni.showToast({ title: '暂无客服微信', icon: 'none' })
				return
			}
			uni.setClipboardData({
				data: wechat,
				success: () => {
					uni.showToast({ title: '微信号已复制', icon: 'success' })
				},
				fail: () => {
					uni.showToast({ title: '复制失败', icon: 'none' })
				}
			})
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
	padding: 8rpx 0 48rpx;
}

.form-tip {
	display: block;
	padding: 20rpx 32rpx 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.form-card {
	margin: 0 32rpx 24rpx;
	padding: 8rpx 32rpx 16rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.section-title {
	display: block;
	padding: 20rpx 0 8rpx;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.form-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
	min-height: 88rpx;
	padding: 20rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.form-row.last {
	border-bottom: none;
}

.form-label {
	flex-shrink: 0;
	font-size: 28rpx;
	color: #5C6370;
}

.form-val {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	font-weight: 500;
	color: #1F2329;
	text-align: right;
	line-height: 1.5;
}

.form-em {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	color: #8B919C;
	text-align: right;
	line-height: 1.5;
	word-break: break-all;
}

.form-em.brand {
	color: #2563EB;
}

.form-price {
	flex: 1;
	font-size: 32rpx;
	font-weight: 600;
	color: #FA5151;
	text-align: right;
}

.tone-pay {
	color: #FA5151;
}

.tone-done {
	color: #07C160;
}

.tone-wait {
	color: #C47A12;
}

.tone-muted {
	color: #8B919C;
}

.step-row {
	display: flex;
	align-items: flex-start;
	gap: 16rpx;
	padding: 16rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.step-row.last {
	border-bottom: none;
}

.step-dot {
	width: 16rpx;
	height: 16rpx;
	margin-top: 10rpx;
	border-radius: 50%;
	background: #EBEDF0;
	flex-shrink: 0;
}

.step-dot.on {
	background: #2563EB;
}

.step-main {
	flex: 1;
	min-width: 0;
}

.step-title {
	display: block;
	font-size: 28rpx;
	color: #1F2329;
}

.step-time {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.action-stack {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
	padding: 8rpx 32rpx 24rpx;
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
	text-align: center;
}

.btn::after {
	border: none;
}

.btn-primary {
	background: #2563EB;
	color: #FFFFFF;
}

.btn-ghost {
	background: #EEF3FF;
	color: #2563EB;
}

.btn-line {
	background: #FFFFFF;
	color: #1F2329;
	border: 1rpx solid #EBEDF0;
}

.btn-disabled {
	background: #F4F6F9;
	color: #8B919C;
}
</style>