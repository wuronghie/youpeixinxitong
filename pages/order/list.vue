<template>
	<view class="page">
		<scroll-view scroll-x class="tabs" :show-scrollbar="false">
			<view class="tabs-inner">
				<view
					v-for="(tab, index) in statusTabs"
					:key="index"
					class="tab"
					:class="{ on: currentStatus === tab.value }"
					@click="switchStatus(tab.value)"
				>
					{{ tab.label }}
				</view>
			</view>
		</scroll-view>

		<scroll-view
			scroll-y
			@scrolltolower="loadMore"
			class="list-scroll"
		>
			<view class="list-body">
				<view v-if="isLoading && !orderList.length">
					<view v-for="n in 4" :key="n" class="a-card skeleton">
						<view class="sk sk-title"></view>
						<view class="sk sk-line"></view>
						<view class="sk sk-line short"></view>
					</view>
				</view>

				<view v-else>
					<view
						v-for="order in orderList"
						:key="order._id"
						class="a-card"
						@click="goToDetail(order._id)"
					>
						<view class="a-head">
							<view class="a-head-main">
								<text class="a-name">{{ formatOrderTitle(order) }}</text>
								<text class="a-time">订单号 {{ order.order_no }}</text>
							</view>
							<text class="status" :class="statusClass(order.status)">{{ formatStatus(order.status) }}</text>
						</view>
						<view class="a-row">
							<text class="a-label">金额</text>
							<text class="a-price" :class="{ danger: isUnpaid(order) }">¥{{ Number(order.amount || 0).toFixed(2) }}</text>
						</view>
						<view v-if="isUnpaid(order)" class="a-ops">
							<text class="mini mini-primary" @click.stop="goToPayment(order._id)">去支付</text>
						</view>
					</view>

					<view v-if="!orderList.length && !isLoading" class="empty">
						<text class="iconfont icon-dingdan empty-icon"></text>
						<text class="empty-title">暂无订单记录</text>
						<text class="empty-sub">预约老师成功后，这里会显示支付明细</text>
					</view>

					<view v-if="isLoading && orderList.length" class="list-tip">加载中...</view>
					<view v-else-if="!hasMore && orderList.length" class="list-tip">已经到底啦</view>
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
				{ label: '全部', value: 'all' },
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
						appointment_no: item.appointment_info?.appointment_no,
						teacher_name: item.appointment_info?.teacher_info?.display_name || item.appointment_info?.teacher_info?.name || ''
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
		formatOrderTitle(order) {
			const typeMap = {
				trial: '试课',
				regular: '正式课',
				formal: '正式课',
				deposit: '信息费',
				refund: '退款'
			}
			const type = typeMap[order.order_type] || '课程'
			if (order.teacher_name) return `${order.teacher_name} · ${type}`
			return this.formatOrderType(order.order_type)
		},
		isUnpaid(order) {
			return order.status === 'unpaid' || order.status === 'pending'
		},
		statusClass(status) {
			const map = {
				unpaid: 's-pay',
				pending: 's-pay',
				paid: 's-done',
				success: 's-done',
				refunding: 's-wait',
				refunded: 's-muted'
			}
			return map[status] || 's-muted'
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
			uni.navigateTo({ url: `/pages-biz/appointment/detail?id=${appointmentId}` })
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
}

.tabs {
	background: #FFFFFF;
	border-bottom: 1rpx solid #EBEDF0;
	white-space: nowrap;
}

.tabs-inner {
	display: flex;
	padding: 0 16rpx;
}

.tab {
	flex: 1;
	flex-shrink: 0;
	height: 88rpx;
	padding: 0 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 26rpx;
	color: #5C6370;
	position: relative;
}

.tab.on {
	color: #2563EB;
	font-weight: 600;
}

.tab.on::after {
	content: "";
	position: absolute;
	left: 22%;
	right: 22%;
	bottom: 8rpx;
	height: 4rpx;
	background: #2563EB;
	border-radius: 4rpx;
}

.list-scroll {
	flex: 1;
	height: calc(100vh - 88rpx);
}

.list-body {
	padding: 8rpx 0 24rpx;
}

.a-card {
	margin: 24rpx 32rpx;
	padding: 28rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.a-head {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16rpx;
}

.a-head-main {
	flex: 1;
	min-width: 0;
}

.a-name {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.4;
}

.a-time {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #5C6370;
	line-height: 1.4;
}

.status {
	flex-shrink: 0;
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
	line-height: 1.4;
}

.s-pay {
	background: #FFF1F0;
	color: #FA5151;
}

.s-wait {
	background: #FFF6E8;
	color: #C47A12;
}

.s-done {
	background: #E8F8EF;
	color: #07C160;
}

.s-muted {
	background: #F4F6F9;
	color: #8B919C;
}

.a-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 16rpx;
}

.a-label {
	font-size: 26rpx;
	color: #8B919C;
}

.a-price {
	font-size: 26rpx;
	font-weight: 600;
	color: #1F2329;
}

.a-price.danger {
	color: #FA5151;
}

.a-ops {
	display: flex;
	justify-content: flex-end;
	gap: 16rpx;
	margin-top: 24rpx;
}

.mini {
	height: 60rpx;
	padding: 0 24rpx;
	border-radius: 16rpx;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 60rpx;
	text-align: center;
}

.mini-primary {
	background: #2563EB;
	color: #FFFFFF;
}

.skeleton .sk {
	background: #EBEDF0;
	border-radius: 8rpx;
}

.sk-title {
	width: 280rpx;
	height: 32rpx;
	margin-bottom: 16rpx;
}

.sk-line {
	width: 360rpx;
	height: 24rpx;
	margin-bottom: 12rpx;
}

.sk-line.short {
	width: 200rpx;
	margin-bottom: 0;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 80rpx 32rpx;
}

.empty-icon {
	font-size: 120rpx;
	color: #EBEDF0;
}

.empty-title {
	margin-top: 24rpx;
	font-size: 30rpx;
	color: #5C6370;
}

.empty-sub {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.list-tip {
	text-align: center;
	padding: 24rpx 0;
	font-size: 24rpx;
	color: #8B919C;
}
</style>