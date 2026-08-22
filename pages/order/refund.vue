<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex flex-column text-white">
				<text class="font-lg font-weight mb-1">申请退款</text>
				<text class="font-sm" style="opacity: 0.85;">提交后由平台审核，通过后原路退回</text>
			</view>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 订单信息 -->
				<card headTitle="订单信息" class="mb-3">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">订单号</text>
						<text class="font-sm text-right">{{ order.order_no || '-' }}</text>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">订单金额</text>
						<text class="font-sm font-weight main-text-color text-right">¥{{ order.amount.toFixed(2) }}</text>
					</view>
					<view v-if="order.appointment_info" class="d-flex a-center j-sb py-2">
						<text class="font-sm">预约教师</text>
						<text class="font-sm text-right">{{ order.appointment_info.teacher_name || '教师' }}</text>
					</view>
				</card>

				<!-- 退款说明 -->
				<card headTitle="退款说明" class="mb-3">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">预计退款</text>
						<text class="font-sm font-weight main-text-color text-right">¥{{ refundAmount.toFixed(2) }}</text>
					</view>
					<view class="refund-rule mt-2">
						<template v-if="isTrialOrder">
							<text class="font-sm d-block mb-1">试课退款规则：</text>
							<text class="font-sm text-light-muted d-block">· 提交后需平台审核</text>
							<text class="font-sm text-light-muted d-block">· 审核通过后退回试课费 30%（原路退回）</text>
							<text class="font-sm text-light-muted d-block">· 其余 70% 结算给教师微信零钱</text>
							<text class="font-sm text-light-muted d-block">· 审核通过后当前预约取消，教师可再次邀请试课</text>
						</template>
						<template v-else>
							<text class="font-sm text-light-muted d-block">正式课程退款将由平台审核后按实际情况处理。</text>
						</template>
					</view>
				</card>

				<!-- 退款原因 -->
				<card headTitle="退款原因" class="mb-3">
					<picker mode="selector" :range="reasonOptions" :value="reasonIndex" @change="onReasonChange">
						<view class="d-flex a-center j-sb py-2 bg-light-secondary rounded px-3">
							<text class="font-sm" :class="form.reason ? '' : 'text-light-muted'">
								{{ form.reason || '请选择退款原因' }}
							</text>
							<text class="iconfont icon-you text-light-muted"></text>
						</view>
					</picker>
					<view class="mt-3">
						<textarea
							class="w-100 bg-light-secondary rounded px-3 py-2 font-sm mb-1"
							v-model.trim="form.description"
							placeholder="补充说明（选填）"
							maxlength="200"
							auto-height
							placeholder-class="text-light-muted"
							style="min-height: 140rpx;"
						/>
						<text class="font-sm text-light-muted text-right d-block">{{ form.description.length }}/200</text>
					</view>
				</card>
			</view>
		</scroll-view>

		<!-- 唯一退款按钮 -->
		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<button
				class="main-bg-color text-white rounded px-4 py-2 font-md font-weight w-100"
				:disabled="isSubmitting"
				@click="submitRefund"
			>
				{{ isSubmitting ? '提交中...' : (isTrialOrder ? '提交退款申请（退30%）' : '提交退款申请') }}
			</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'

/** 试课家长退款比例（与 appointment-complete / 业务文案一致） */
const TRIAL_PARENT_REFUND_RATE = 0.3

export default {
	name: 'OrderRefund',
	components: {
		card
	},
	data() {
		return {
			orderId: '',
			order: {
				amount: 0,
				appointment_info: null
			},
			form: {
				reason: '',
				description: ''
			},
			reasonOptions: ['试课不满意', '教师爽约/未按时上课', '时间冲突需要调整', '其他原因'],
			reasonIndex: -1,
			isSubmitting: false,
			isLoading: false
		}
	},
	computed: {
		isTrialOrder() {
			return this.order.appointment_info?.course_type === 'trial'
		},
		refundAmount() {
			if (!this.order.amount) return 0
			if (this.isTrialOrder) {
				return Math.round(this.order.amount * TRIAL_PARENT_REFUND_RATE * 100) / 100
			}
			return this.order.amount
		}
	},
	async onLoad(options) {
		this.orderId = options.id || options.orderNo || ''
		if (!this.orderId) {
			uni.showToast({ title: '订单ID不能为空', icon: 'none' })
			setTimeout(() => this.safeLeave(), 1500)
			return
		}
		await this.loadOrder()
		await this.loadRefundDetail()
	},
	methods: {
		/** 有上一页则返回，否则跳转预约列表，避免首屏 navigateBack 报错 */
		safeLeave() {
			const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
			if (pages && pages.length > 1) {
				uni.navigateBack({
					delta: 1,
					fail: () => {
						uni.redirectTo({ url: '/pages/appointment/list' })
					}
				})
				return
			}
			uni.redirectTo({
				url: '/pages/appointment/list',
				fail: () => {
					uni.reLaunch({ url: '/pages/appointment/list' })
				}
			})
		},
		async loadOrder() {
			if (this.isLoading) return
			this.isLoading = true
			try {
				const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
				const res = await paymentCreate.getOrderList({ status: 'all', page: 1, pageSize: 1, order_id: this.orderId })

				let orderData
				if (res.code === 0 && res.data?.list?.length) {
					orderData = res.data.list.find(item => item._id === this.orderId || item.order_no === this.orderId) || res.data.list[0]
				}
				if (!orderData) {
					throw new Error(res.message || '获取订单失败')
				}

				this.order = {
					_id: orderData._id,
					order_no: orderData.order_no,
					amount: Number(orderData.amount || orderData.total_amount || 0),
					appointment_info: orderData.appointment_info ? {
						course_type: orderData.appointment_info.course_type,
						teacher_name: orderData.appointment_info.teacher_info?.display_name || orderData.appointment_info.teacher_info?.name
					} : null
				}
			} catch (error) {
				console.error('[退款申请] 加载订单失败:', error)
				uni.showToast({ title: error.message || '加载订单失败', icon: 'none' })
			} finally {
				this.isLoading = false
			}
		},
		async loadRefundDetail() {
			try {
				const refundObj = uniCloud.importObject('payment-refund', { customUI: true })
				const res = await refundObj.getDetail({ order_id: this.orderId })
				if (res.code === 0 && res.data) {
					const detail = res.data
					this.form.reason = detail.reason || ''
					this.reasonIndex = this.reasonOptions.indexOf(this.form.reason)
					this.form.description = detail.description || ''
					uni.showToast({ title: '已存在退款申请', icon: 'none' })
				}
			} catch (error) {
				// 没有退款记录不提示
			}
		},
		onReasonChange(e) {
			const index = Number(e.detail.value)
			this.reasonIndex = index
			this.form.reason = this.reasonOptions[index]
		},
		validateForm() {
			if (!this.form.reason) {
				return '请选择退款原因'
			}
			return ''
		},
		async submitRefund() {
			if (this.isSubmitting) return
			const msg = this.validateForm()
			if (msg) {
				uni.showToast({ title: msg, icon: 'none' })
				return
			}

			const confirmContent = this.isTrialOrder
				? `确认提交退款申请？\n\n· 预计退回试课费 30%（¥${this.refundAmount.toFixed(2)}）\n· 其余 70% 审核通过后结算给教师\n· 需平台审核通过后才会退款`
				: `确认提交退款申请？预计退款 ¥${this.refundAmount.toFixed(2)}，需平台审核通过后原路退回。`

			const confirmed = await new Promise((resolve) => {
				uni.showModal({
					title: '提交退款申请',
					content: confirmContent,
					confirmText: '提交申请',
					success: (res) => resolve(!!res.confirm),
					fail: () => resolve(false)
				})
			})
			if (!confirmed) return

			try {
				this.isSubmitting = true
				const refundObj = uniCloud.importObject('payment-refund', { customUI: true })
				const res = await refundObj.apply({
					order_id: this.orderId,
					refund_type: 'refund_cancel',
					reason: this.form.reason,
					description: this.form.description
				})

				if (res.code === 0) {
					uni.showModal({
						title: '已提交',
						content: res.message || '退款申请已提交，请等待平台审核',
						showCancel: false,
						success: () => this.safeLeave()
					})
				} else {
					throw new Error(res.message || '提交失败')
				}
			} catch (error) {
				console.error('[退款申请] 提交退款异常:', error)
				uni.showModal({
					title: '提交失败',
					content: (error.message || error.errMsg || '提交退款失败') + '\n\n请稍后重试。如问题持续，请联系客服。',
					showCancel: false
				})
			} finally {
				this.isSubmitting = false
			}
		}
	}
}
</script>

<style scoped>
.scroll {
	flex: 1;
	height: calc(100vh - 300rpx);
	padding-bottom: 160rpx;
}
.refund-rule {
	line-height: 1.7;
}
</style>
