<template>
	<view class="page">
		<text class="form-tip">{{ isTrialOrder ? '仅可在确认上课结果前申请。试课退款预计退 30%，70% 给教师。' : '仅可在确认上课结果前申请，提交后由平台审核。' }}</text>

		<view class="form-card">
			<view class="form-row">
				<text class="form-label">订单号</text>
				<text class="form-em">{{ order.order_no || '-' }}</text>
			</view>
			<view v-if="order.appointment_info" class="form-row">
				<text class="form-label">预约教师</text>
				<text class="form-val">{{ teacherLabel }}</text>
			</view>
			<view class="form-row">
				<text class="form-label">订单金额</text>
				<text class="form-val">¥{{ Number(order.amount || 0).toFixed(2) }}</text>
			</view>
			<view class="form-row last">
				<text class="form-label">预计退款</text>
				<text class="form-price">¥{{ refundAmount.toFixed(2) }}</text>
			</view>
			<text v-if="isTrialOrder" class="hint">审核通过后退回 30% 原路退回，其余 70% 结算给教师；当前预约取消后教师可再次邀请试课。</text>
			<text v-else class="hint">正式课程退款由平台审核后按实际情况处理。</text>
		</view>

		<view class="section-card">
			<text class="section-title">退款原因</text>
			<view class="chips">
				<text
					v-for="(item, index) in reasonOptions"
					:key="item"
					class="chip"
					:class="{ on: reasonIndex === index }"
					@click="selectReason(index)"
				>{{ item }}</text>
			</view>
		</view>

		<view class="section-card">
			<text class="section-title">补充说明（选填）</text>
			<textarea
				class="intro-input"
				v-model.trim="form.description"
				placeholder="讲解节奏偏快，孩子跟不上。"
				maxlength="200"
				auto-height
				:show-confirm-bar="false"
				:cursor-spacing="24"
				placeholder-class="ph"
			/>
			<text class="count">{{ form.description.length }}/200</text>
		</view>

		<view class="scroll-spacer"></view>

		<view class="action-bar">
			<button
				class="save-btn"
				:disabled="isSubmitting"
				@click="submitRefund"
			>
				{{ isSubmitting ? '提交中...' : (isTrialOrder ? '提交退款申请（退30%）' : '提交退款申请') }}
			</button>
		</view>
	</view>
</template>

<script>
/** 试课家长退款比例（与 appointment-complete / 业务文案一致） */
const TRIAL_PARENT_REFUND_RATE = 0.3

export default {
	name: 'OrderRefund',
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
			isLoading: false,
			blockedByConfirm: false
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
		},
		teacherLabel() {
			const info = this.order.appointment_info || {}
			const name = info.teacher_name || '教师'
			if (info.course_type === 'trial') return `${name} · 试课`
			if (info.course_type === 'regular' || info.course_type === 'formal') return `${name} · 正式课`
			return name
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
		if (this.blockedByConfirm) return
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
				const res = await paymentCreate.getOrderDetail({ order_id: this.orderId })
				if (res.code !== 0 || !res.data) {
					throw new Error(res.message || '获取订单失败')
				}
				const orderData = res.data

				this.order = {
					_id: orderData._id,
					order_no: orderData.order_no,
					amount: Number(orderData.amount || orderData.total_amount || 0),
					appointment_info: orderData.appointment_info ? {
						course_type: orderData.appointment_info.course_type,
						status: orderData.appointment_info.status,
						has_review: !!orderData.appointment_info.has_review,
						teacher_name: orderData.appointment_info.teacher_info?.display_name || orderData.appointment_info.teacher_info?.name
					} : null
				}
				const apt = this.order.appointment_info || {}
				if (apt.status === 'completed' || apt.has_review) {
					this.blockedByConfirm = true
					uni.showToast({ title: '已确认上课结果，不可再申请退款', icon: 'none' })
					setTimeout(() => this.safeLeave(), 1500)
					return
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
			this.selectReason(Number(e.detail.value))
		},
		selectReason(index) {
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
			const apt = this.order.appointment_info || {}
			if (apt.status === 'completed' || apt.has_review) {
				uni.showToast({ title: '已确认上课结果，不可再申请退款', icon: 'none' })
				return
			}
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
.page {
	min-height: 100vh;
	background: #F4F6F9;
	padding-bottom: calc(148rpx + env(safe-area-inset-bottom));
}

.form-tip {
	display: block;
	padding: 20rpx 32rpx 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.form-card,
.section-card {
	margin: 0 32rpx 24rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.form-card {
	padding: 8rpx 32rpx 16rpx;
}

.section-card {
	padding: 28rpx 32rpx;
}

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.form-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	min-height: 88rpx;
	padding: 16rpx 0;
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
}

.form-em {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	color: #8B919C;
	text-align: right;
}

.form-price {
	flex: 1;
	font-size: 32rpx;
	font-weight: 600;
	color: #FA5151;
	text-align: right;
}

.hint {
	display: block;
	padding: 8rpx 0 12rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.6;
}

.chips {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 20rpx;
}

.chip {
	min-height: 64rpx;
	padding: 0 20rpx;
	border-radius: 12rpx;
	background: #F1F2F4;
	color: #5C6370;
	font-size: 24rpx;
	line-height: 64rpx;
}

.chip.on {
	background: #EEF3FF;
	color: #2563EB;
	font-weight: 600;
}

.intro-input {
	width: 100%;
	min-height: 180rpx;
	margin-top: 16rpx;
	padding: 20rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	font-size: 26rpx;
	color: #1F2329;
	line-height: 1.6;
	box-sizing: border-box;
}

.ph {
	color: #C5C8CE;
}

.count {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8B919C;
	text-align: right;
}

.scroll-spacer {
	height: 24rpx;
}

.action-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 20;
	padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
	background: #FFFFFF;
	border-top: 1rpx solid #EBEDF0;
}

.save-btn {
	width: 100%;
	height: 88rpx;
	margin: 0;
	padding: 0;
	border: none;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 32rpx;
	font-weight: 600;
	line-height: 88rpx;
}

.save-btn::after {
	border: none;
}

.save-btn[disabled] {
	opacity: 0.55;
}
</style>
