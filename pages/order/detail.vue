<template>
	<view>
		<!-- 状态头部 -->
		<view class="main-bg-color text-white p-4 d-flex a-end j-sb" style="height: 300rpx;">
			<view class="mb-3">
				<view class="font-lg font-weight">{{ formatStatus(order.status) }}</view>
				<view class="font-sm mt-2" style="opacity: 0.85;">{{ statusTip }}</view>
			</view>
			<view class="iconfont icon-dingdan line-h mb-3" style="font-size: 100rpx;opacity: 0.3;"></view>
		</view>

		<!-- 订单信息 -->
		<card headTitle="订单信息">
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">订单编号</text>
				<text class="font-sm">{{ order.order_no || '-' }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">订单类型</text>
				<text class="font-sm">{{ formatOrderType(order.order_type) }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">创建时间</text>
				<text class="font-sm">{{ formatTime(order.create_time) }}</text>
			</view>
			<view v-if="order.pay_time" class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">支付时间</text>
				<text class="font-sm">{{ formatTime(order.pay_time) }}</text>
			</view>
			<view v-if="order.refund_time" class="d-flex a-center j-sb py-2">
				<text class="font-sm text-light-muted">退款时间</text>
				<text class="font-sm">{{ formatTime(order.refund_time) }}</text>
			</view>
		</card>

		<divider></divider>

		<!-- 费用明细 -->
		<card headTitle="费用明细">
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">订单金额</text>
				<text class="font-sm main-text-color font-weight">¥{{ (order.amount || 0).toFixed(2) }}</text>
			</view>
			<view v-if="order.platform_fee" class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">平台服务费</text>
				<text class="font-sm">¥{{ order.platform_fee.toFixed(2) }}</text>
			</view>
			<view v-if="order.teacher_income" class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">教师收入</text>
				<text class="font-sm">¥{{ order.teacher_income.toFixed(2) }}</text>
			</view>
			<view v-if="order.refund_amount" class="d-flex a-center j-sb py-2">
				<text class="font-sm text-light-muted">退款金额</text>
				<text class="font-sm text-danger font-weight">¥{{ order.refund_amount.toFixed(2) }}</text>
			</view>
		</card>

		<divider></divider>

		<!-- 关联预约 -->
		<card v-if="order.appointment_info" headTitle="关联预约">
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">预约编号</text>
				<text class="font-sm">{{ order.appointment_info.appointment_no || '-' }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">教师</text>
				<text class="font-sm">{{ order.appointment_info.teacher_name || '教师' }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2">
				<text class="font-sm text-light-muted">上课时间</text>
				<text class="font-sm">{{ order.appointment_info.date }} {{ order.appointment_info.time }}</text>
			</view>
			<view class="d-flex j-end mt-2 pt-2 border-top">
				<text class="main-text-color font-sm" @click="goAppointment(order.appointment_info._id)">查看预约详情</text>
			</view>
		</card>

		<divider></divider>

		<!-- 支付信息 -->
		<card v-if="order.pay_channel" headTitle="支付信息">
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">支付方式</text>
				<text class="font-sm">{{ formatPayChannel(order.pay_channel) }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2">
				<text class="font-sm text-light-muted">订单流水号</text>
				<text class="font-sm">{{ order.transaction_id || '-' }}</text>
			</view>
		</card>

		<divider></divider>

		<!-- 退款进度 -->
		<card v-if="order.refund_info || refundInfo" headTitle="退款进度">
			<view v-for="step in refundSteps" :key="step.key" class="d-flex a-start py-2" :class="{'border-bottom': step !== refundSteps[refundSteps.length - 1]}">
				<view 
					class="rounded-circle mr-3 mt-1" 
					:class="step.active ? 'main-bg-color' : 'bg-light-secondary'"
					style="width: 18rpx;height: 18rpx;"
				></view>
				<view class="flex-1">
					<text class="font-sm d-block">{{ step.title }}</text>
					<text class="font-sm text-light-muted d-block mt-1">{{ step.time || '待处理' }}</text>
				</view>
			</view>
			<view v-if="refundInfo?.status === 'pending'" class="d-flex j-end mt-2 pt-2 border-top">
				<text class="main-text-color font-sm" @click="contactService">客服处理进度</text>
			</view>
		</card>

		<divider></divider>

		<!-- 底部操作栏 -->
		<view v-if="canConfirmCompletion || canReview || canApplyRefund || primaryAction" style="height: 100rpx;"></view>
		<view 
			v-if="canConfirmCompletion || canReview || canApplyRefund || primaryAction" 
			class="bg-white position-fixed bottom-0 left-0 right-0 d-flex a-center j-end px-3" 
			style="height: 100rpx;z-index: 100;"
		>
			<button 
				v-if="canConfirmCompletion" 
				class="main-bg-color text-white rounded px-4 py-2 font-sm mr-2" 
				@click="confirmCompletion"
			>
				确认课程完成
			</button>
			<button 
				v-if="canReview" 
				class="main-bg-color text-white rounded px-4 py-2 font-sm mr-2" 
				@click="goReview"
			>
				写评价
			</button>
			<button 
				v-if="canApplyRefund" 
				class="main-bg-color text-white rounded px-4 py-2 font-sm mr-2" 
				@click="goRefund"
			>
				申请退款
			</button>
			<button 
				v-if="primaryAction === 'pay'" 
				class="main-bg-color text-white rounded px-4 py-2 font-sm" 
				@click="gotoPay"
			>
				立即支付
			</button>
			<button 
				v-if="primaryAction === 'contact'" 
				class="border border-primary text-primary rounded px-4 py-2 font-sm" 
				@click="contactService"
			>
				联系客服
			</button>
			<button 
				v-if="primaryAction === 'refunded'" 
				class="border border-light-secondary text-light-muted rounded px-4 py-2 font-sm" 
				disabled
			>
				订单已退款
			</button>
			<button 
				v-if="primaryAction === 'refunding'" 
				class="border border-light-secondary text-light-muted rounded px-4 py-2 font-sm" 
				disabled
			>
				退款处理中
			</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import divider from '@/components/common/divider.vue'

export default {
	name: 'OrderDetail',
	components: {
		card,
		divider
	},
	data() {
		return {
			orderId: '',
			order: {},
			refundInfo: null,
			isLoading: false,
			isRefreshing: false,
			scrollTop: 0,
			canRefresh: true
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
			return map[this.order.status] || ''
		},
		canApplyRefund() {
			return ['paid', 'success'].includes(this.order.status) && !this.refundInfo
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
				deposit: '保证金',
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
			uni.navigateTo({ url: `/pages/appointment/detail?id=${appointmentId}` })
		},
		goRefund() {
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
			uni.showToast({ title: '请联系平台客服协助处理', icon: 'none' })
		}
	}
}
</script>

<style scoped>
</style>