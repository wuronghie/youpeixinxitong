<template>
	<view style="background: #F5F5F5;">
		<!-- 选项卡 -->
		<view class="status-tabs">
			<view 
				class="tab-item"
				:class="currentStatus === tab.value ? 'tab-active' : ''"
				v-for="(tab,index) in statusTabs" 
				:key="index"
				@click="switchStatus(tab.value)"
			>
				{{tab.label}}
			</view>
		</view>
		
		<!-- 订单列表 -->
		<scroll-view
			scroll-y
			@scrolltolower="loadMore"
			class="list-scroll"
		>
			<view class="px-2 py-3">
				<view v-if="isLoading && !orderList.length" class="d-flex flex-column">
					<view v-for="n in 4" :key="n" class="order-card mb-3">
						<view class="card-content">
							<view class="order-header">
								<view class="bg-light-secondary rounded skeleton" style="width: 200rpx;height: 28rpx;"></view>
								<view class="bg-light-secondary rounded skeleton" style="width: 100rpx;height: 40rpx;"></view>
							</view>
							<view class="order-body">
								<view class="bg-light-secondary rounded mb-2 skeleton" style="width: 100%;height: 24rpx;"></view>
								<view class="bg-light-secondary rounded mb-2 skeleton" style="width: 80%;height: 24rpx;"></view>
								<view class="bg-light-secondary rounded skeleton" style="width: 60%;height: 32rpx;"></view>
							</view>
						</view>
					</view>
				</view>

				<view v-else>
					<view
						v-for="order in orderList"
						:key="order._id"
						class="order-card mb-3"
						@click="goToDetail(order._id)"
					>
						<view class="card-content">
							<!-- 订单头部：时间和状态 -->
							<view class="order-header">
								<text class="order-time">{{ formatTime(order.create_time) }}</text>
								<view class="status-badge" :class="getStatusClass(order.status)">
									{{ formatStatus(order.status) }}
								</view>
							</view>
							
							<!-- 订单信息 -->
							<view class="order-body">
								<view class="order-info-item">
									<text class="info-label">订单号</text>
									<text class="info-value">{{ order.order_no }}</text>
								</view>
								<view class="order-info-item">
									<text class="info-label">订单类型</text>
									<text class="info-value">{{ formatOrderType(order.order_type) }}</text>
								</view>
								<view class="order-info-item highlight">
									<text class="info-label">订单金额</text>
									<text class="amount-value">¥{{ order.amount.toFixed(2) }}</text>
								</view>
								<view v-if="order.appointment_id" class="order-info-item appointment-link" @click.stop="goAppointment(order.appointment_id)">
									<text class="info-label">关联预约</text>
									<text class="link-value">{{ order.appointment_no || '查看预约' }}</text>
								</view>
							</view>
							
							<!-- 操作按钮 -->
							<view class="order-footer">
								<button 
									v-if="order.status === 'unpaid' || order.status === 'pending'"
									class="action-btn primary-btn"
									@click.stop="goToPayment(order._id)"
								>
									去支付
								</button>
								<button 
									class="action-btn default-btn"
									@click.stop="goToDetail(order._id)"
								>
									查看详情
								</button>
							</view>
						</view>
					</view>

					<view v-if="!orderList.length && !isLoading" class="empty-state">
						<text class="iconfont icon-dingdan empty-icon"></text>
						<text class="empty-text">暂无订单记录</text>
						<text class="empty-desc">预约老师成功后，这里会显示支付明细</text>
					</view>

					<view v-if="isLoading && orderList.length" class="loading-text">加载中...</view>
					<view v-else-if="!hasMore && orderList.length" class="loading-text">已经到底啦</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

export default {
	name: 'OrderList',
	mixins: [pullRefreshMixin],
	data() {
		return {
			statusTabs: [
				{ label: '全部订单', value: 'all' },
				{ label: '待支付', value: 'unpaid' },
				{ label: '已支付', value: 'paid' },
				{ label: '退款中', value: 'refunding' },
				{ label: '已退款', value: 'refunded' }
			],
			currentStatus: 'all',
			orderList: [],
			isLoading: false,
			isRefreshing: false,
			scrollTop: 0,
			canRefresh: true,
			currentPage: 1,
			pageSize: 10,
			hasMore: true
		}
	},
	onLoad(options) {
		if (options.status) {
			this.currentStatus = options.status
		}
		this.loadOrders(true)
	},
	methods: {
		async refreshData() {
			console.log('[order-list] 下拉刷新：重新加载列表')
			await this.loadOrders(true)
		},
		async loadOrders(reset = false) {
			if (this.isLoading) return
			if (reset) {
				this.currentPage = 1
				this.orderList = []
				this.hasMore = true
			}
			if (!this.hasMore && !reset) return

			this.isLoading = true
			try {
				const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
				const res = await paymentCreate.getOrderList({
					status: this.currentStatus === 'all' ? undefined : this.currentStatus,
					page: this.currentPage,
					pageSize: this.pageSize
				})
				if (res.code === 0) {
					const list = (res.data.list || []).map(item => ({
						_id: item._id,
						order_no: item.order_no,
						order_type: item.order_type,
						amount: Number(item.amount || item.total_amount || 0),
						status: item.status,
						create_time: item.create_time || Date.now(),
						appointment_id: item.appointment_id,
						appointment_no: item.appointment_info?.appointment_no
					}))
					if (reset) {
						this.orderList = list
					} else {
						this.orderList = [...this.orderList, ...list]
					}
					const pagination = res.data.pagination || {}
					this.hasMore = pagination.hasMore !== undefined ? pagination.hasMore : list.length >= this.pageSize
					this.currentPage = pagination.page ? pagination.page + 1 : this.currentPage + 1
				} else {
					throw new Error(res.message || '获取订单列表失败')
				}
			} catch (error) {
				console.error('获取订单列表失败:', error)
				uni.showToast({ title: error.message || '获取订单失败', icon: 'none' })
			} finally {
				this.isLoading = false
				this.isRefreshing = false
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
			this.loadOrders(true)
		},
		loadMore() {
			if (this.hasMore && !this.isLoading) {
				this.loadOrders()
			}
		},
		switchStatus(status) {
			if (this.currentStatus === status) return
			this.currentStatus = status
			this.loadOrders(true)
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
		formatTime(ts) {
			const date = new Date(ts || Date.now())
			const year = date.getFullYear()
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${year}-${month}-${day} ${hour}:${minute}`
		},
		getStatusClass(status) {
			const map = {
				unpaid: 'status-unpaid',
				pending: 'status-unpaid',
				paid: 'status-paid',
				success: 'status-paid',
				refunding: 'status-refunding',
				refunded: 'status-refunded'
			}
			return map[status] || 'status-default'
		},
		goToDetail(orderId) {
			if (!orderId) return
			uni.navigateTo({ url: `/pages/order/detail?id=${orderId}` })
		},
		goToPayment(orderId) {
			this.goToDetail(orderId)
		},
		goAppointment(appointmentId) {
			if (!appointmentId) {
				uni.showToast({ title: '预约信息未关联', icon: 'none' })
				return
			}
			uni.navigateTo({ url: `/pages/appointment/detail?id=${appointmentId}` })
		}
	}
}
</script>

<style scoped>
/* 状态选项卡 */
.status-tabs {
	display: flex;
	background: #ffffff;
	border-bottom: 1rpx solid #f0f0f0;
}

.tab-item {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24rpx 0;
	font-size: 28rpx;
	color: #666666;
	position: relative;
	transition: color 0.2s ease;
}

.tab-item.tab-active {
	color: #667eea;
	font-weight: 600;
}

.tab-item.tab-active::after {
	content: '';
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 60rpx;
	height: 4rpx;
	background: linear-gradient(135deg, #667eea 0%, #8a7efc 100%);
	border-radius: 2rpx;
}

.list-scroll {
	flex: 1;
	height: calc(100vh - 200rpx);
}

/* 订单卡片 */
.order-card {
	background: #ffffff;
	border-radius: 24rpx;
	overflow: hidden;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.04);
	transition: transform 0.18s ease-out, box-shadow 0.18s ease-out;
}

.order-card:active {
	transform: translateY(-2rpx);
	box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.08);
}

.card-content {
	padding: 24rpx;
}

/* 订单头部 */
.order-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20rpx;
	padding-bottom: 20rpx;
	border-bottom: 1rpx solid #f0f0f0;
}

.order-time {
	font-size: 24rpx;
	color: #8a94a6;
}

.status-badge {
	padding: 8rpx 20rpx;
	border-radius: 999rpx;
	font-size: 24rpx;
	font-weight: 500;
}

.status-unpaid {
	background: #fff4e6;
	color: #ff9800;
}

.status-paid {
	background: #e8f5e9;
	color: #2ea170;
}

.status-refunding {
	background: #fff3e0;
	color: #ff6b35;
}

.status-refunded {
	background: #f5f5f5;
	color: #8a94a6;
}

.status-default {
	background: #f0f2ff;
	color: #667eea;
}

/* 订单信息 */
.order-body {
	margin-bottom: 20rpx;
}

.order-info-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12rpx 0;
}

.order-info-item.highlight {
	padding: 16rpx 0;
	border-top: 1rpx solid #f0f0f0;
	border-bottom: 1rpx solid #f0f0f0;
	margin: 12rpx 0;
}

.order-info-item.appointment-link {
	cursor: pointer;
}

.info-label {
	font-size: 26rpx;
	color: #8a94a6;
}

.info-value {
	font-size: 26rpx;
	color: #2f3542;
	max-width: 400rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.amount-value {
	font-size: 32rpx;
	color: #ff4757;
	font-weight: 600;
}

.link-value {
	font-size: 26rpx;
	color: #667eea;
	max-width: 400rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* 订单底部操作 */
.order-footer {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 16rpx;
	padding-top: 20rpx;
	border-top: 1rpx solid #f0f0f0;
}

.action-btn {
	padding: 16rpx 32rpx;
	border-radius: 999rpx;
	font-size: 26rpx;
	border: none;
	line-height: 1;
	white-space: nowrap;
	transition: all 0.2s ease;
}

.primary-btn {
	background: linear-gradient(135deg, #667eea 0%, #8a7efc 100%);
	color: #ffffff;
}

.primary-btn:active {
	opacity: 0.8;
	transform: scale(0.98);
}

.default-btn {
	background: #ffffff;
	color: #667eea;
	border: 1rpx solid #667eea !important;
}

.default-btn:active {
	background: #f0f2ff;
	transform: scale(0.98);
}

/* 空状态 */
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 100rpx 40rpx;
}

.empty-icon {
	font-size: 120rpx;
	color: #ddd;
}

.empty-text {
	font-size: 28rpx;
	color: #8a94a6;
	margin-top: 24rpx;
	font-weight: 500;
}

.empty-desc {
	font-size: 24rpx;
	color: #b0b7c6;
	margin-top: 12rpx;
	text-align: center;
	line-height: 1.6;
}

.loading-text {
	text-align: center;
	font-size: 24rpx;
	color: #8a94a6;
	padding: 40rpx 0;
}

/* 骨架屏动画 */
.skeleton {
	animation: pulse 1.4s ease-in-out infinite;
	background: linear-gradient(90deg, #eceff9 0%, #f4f6ff 50%, #eceff9 100%);
	border-radius: 8rpx;
}

@keyframes pulse {
	0% {
		opacity: 0.6;
	}
	50% {
		opacity: 1;
	}
	100% {
		opacity: 0.6;
	}
}
</style>