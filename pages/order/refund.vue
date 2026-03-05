<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex flex-column text-white">
				<text class="font-lg font-weight mb-1">申请退款</text>
				<text class="font-sm" style="opacity: 0.85;">填写退款原因，平台将尽快协助处理</text>
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

				<!-- 退款类型 -->
				<card headTitle="退款类型" class="mb-3">
					<view class="d-flex flex-column">
						<view 
							class="rounded px-3 py-3 mb-2"
							:class="form.refundType === 'only_refund' ? 'main-bg-color text-white' : 'bg-light-secondary'"
							@click="form.refundType = 'only_refund'"
						>
							<text class="font-md font-weight d-block mb-1">仅退款</text>
							<text class="font-sm" :style="form.refundType === 'only_refund' ? 'opacity: 0.9;' : ''">保留预约记录，如仍需上课可再次预约</text>
						</view>
						<view 
							class="rounded px-3 py-3"
							:class="form.refundType === 'refund_cancel' ? 'main-bg-color text-white' : 'bg-light-secondary'"
							@click="form.refundType = 'refund_cancel'"
						>
							<text class="font-md font-weight d-block mb-1">退款并取消预约</text>
							<text class="font-sm" :style="form.refundType === 'refund_cancel' ? 'opacity: 0.9;' : ''">取消当前预约，费用全部退回</text>
						</view>
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
							placeholder="补充说明（选填），例如具体情况或与教师沟通结果"
							maxlength="200"
							auto-height
							placeholder-class="text-light-muted"
							style="min-height: 140rpx;"
						/>
						<text class="font-sm text-light-muted text-right d-block">{{ form.description.length }}/200</text>
					</view>
				</card>

				<!-- 退款金额 -->
				<card headTitle="退款金额" class="mb-3">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">预计退款</text>
						<text class="font-sm font-weight main-text-color text-right">¥{{ refundAmount.toFixed(2) }}</text>
					</view>
					<text class="font-sm text-light-muted d-block mt-2" v-if="order.appointment_info && order.appointment_info.course_type === 'trial'">
						试课订单申请退款将按照平台规则退回 50% 费用。
					</text>
					<text class="font-sm text-light-muted d-block mt-2" v-else>
						正式课程退款将由平台审核后按实际情况处理。
					</text>
				</card>
			</view>
		</scroll-view>

		<!-- 提交按钮 -->
		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<button 
				class="main-bg-color text-white rounded px-4 py-2 font-md font-weight w-100" 
				:disabled="isSubmitting"
				@click="submitRefund"
			>
				{{ isSubmitting ? '提交中...' : '提交申请' }}
			</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'

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
				refundType: 'only_refund',
				reason: '',
				description: ''
			},
			reasonOptions: ['教师未确认预约', '时间冲突需要调整', '课程内容与预期不符', '其他原因'],
			reasonIndex: -1,
			isSubmitting: false,
			isLoading: false
		}
	},
	computed: {
		refundAmount() {
			if (!this.order.amount) return 0
			if (this.order.appointment_info?.course_type === 'trial') {
				return Math.round(this.order.amount * 0.5 * 100) / 100
			}
			return this.order.amount
		}
	},
	async onLoad(options) {
		this.orderId = options.id || options.orderNo || ''
		if (!this.orderId) {
			uni.showToast({ title: '订单ID不能为空', icon: 'none' })
			setTimeout(() => uni.navigateBack(), 1500)
			return
		}
		await this.loadOrder()
		await this.loadRefundDetail()
	},
	methods: {
		async loadOrder() {
			if (this.isLoading) return
			this.isLoading = true
			try {
				console.log('[退款申请] 开始加载订单, order_id:', this.orderId)
				const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
				const res = await paymentCreate.getOrderList({ status: 'all', page: 1, pageSize: 1, order_id: this.orderId })
				
				console.log('[退款申请] 订单查询结果:', {
					code: res.code,
					hasData: res.data?.list?.length > 0,
					listLength: res.data?.list?.length
				})
				
				let orderData
				if (res.code === 0 && res.data?.list?.length) {
					orderData = res.data.list.find(item => item._id === this.orderId || item.order_no === this.orderId) || res.data.list[0]
				}
				if (!orderData) {
					console.error('[退款申请] 未找到订单数据:', {
						orderId: this.orderId,
						response: res
					})
					throw new Error(res.message || '获取订单失败')
				}
				
				console.log('[退款申请] 订单数据加载成功:', {
					order_id: orderData._id,
					order_no: orderData.order_no,
					status: orderData.status,
					amount: orderData.amount || orderData.total_amount
				})
				
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
				console.error('[退款申请] 加载订单失败:', {
					error,
					message: error.message,
					orderId: this.orderId
				})
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
					this.form.refundType = detail.refund_type || 'only_refund'
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
			try {
				this.isSubmitting = true
				console.log('[退款申请] 开始提交退款申请:', {
					order_id: this.orderId,
					refund_type: this.form.refundType,
					reason: this.form.reason,
					description: this.form.description
				})
				
				const refundObj = uniCloud.importObject('payment-refund', { customUI: true })
				const res = await refundObj.apply({
					order_id: this.orderId,
					refund_type: this.form.refundType,
					reason: this.form.reason,
					description: this.form.description
				})
				
				console.log('[退款申请] 云对象返回结果:', res)
				
				if (res.code === 0) {
					console.log('[退款申请] 退款申请提交成功:', {
						refund_id: res.data?.refund_id,
						refund_amount: res.data?.refund_amount
					})
					uni.showToast({ title: '退款申请已提交', icon: 'success' })
					
					// 延迟返回，确保用户看到成功提示
					setTimeout(() => {
						uni.navigateBack({ delta: 1 })
					}, 1200)
				} else {
					console.error('[退款申请] 提交失败:', {
						code: res.code,
						message: res.message,
						data: res.data
					})
					throw new Error(res.message || '提交失败')
				}
			} catch (error) {
				console.error('[退款申请] 提交退款异常:', {
					error,
					message: error.message,
					errCode: error.errCode,
					errMsg: error.errMsg,
					stack: error.stack
				})
				
				let errorMsg = '提交退款失败'
				if (error.message) {
					errorMsg = error.message
				} else if (error.errMsg) {
					errorMsg = error.errMsg
				} else if (error.errCode) {
					errorMsg = `错误代码: ${error.errCode}`
				}
				
				uni.showModal({
					title: '提交失败',
					content: errorMsg + '\n\n请检查网络连接或稍后重试。如问题持续，请联系客服。',
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
</style>