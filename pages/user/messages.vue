<template>
	<view class="message-page">
		<!-- 头部 -->
		<view class="message-header">
			<view class="header-top">
				<view class="header-copy">
					<text class="header-title">系统消息</text>
					<text class="header-desc">平台通知、预约提醒、交易动态一目了然</text>
				</view>
				<view class="header-top-action" @click="markAllRead">
					{{ markingAll ? '处理中...' : '全部已读' }}
				</view>
			</view>
			<view class="header-meta-row">
				<view class="meta-pill meta-pill-primary">
					<text class="meta-pill-label">未读</text>
					<text class="meta-pill-value">{{ stats.unread || 0 }}</text>
				</view>
				<view class="meta-pill">
					<text class="meta-pill-label">总数</text>
					<text class="meta-pill-value">{{ stats.total || 0 }}</text>
				</view>
				<view class="meta-pill">
					<text class="meta-pill-label">当前分类</text>
					<text class="meta-pill-value">{{ getCurrentTabLabel() }}</text>
				</view>
			</view>
			<scroll-view scroll-x class="tab-scroll" show-scrollbar="false">
				<view class="tab-row">
					<view
						v-for="tab in tabs"
						:key="tab.value"
						class="tab-pill"
						:class="currentTab === tab.value ? 'tab-pill-active' : 'tab-pill-inactive'"
						@click="switchTab(tab.value)"
					>
						<text>{{ tab.label }}</text>
						<text v-if="tab.unread > 0" class="tab-badge">{{ tab.unread }}</text>
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 消息列表 -->
		<scroll-view
			scroll-y
			@scrolltolower="loadMore"
			class="list-scroll"
		>
			<view class="message-content">
				<view v-if="loading && messageList.length === 0" class="d-flex flex-column">
					<view v-for="n in 4" :key="n" class="message-card message-card-skeleton mb-3 d-flex a-center">
						<view class="rounded skeleton-icon mr-3"></view>
						<view class="flex-1">
							<view class="skeleton-line skeleton-line-lg mb-2"></view>
							<view class="skeleton-line skeleton-line-md mb-2"></view>
							<view class="skeleton-line skeleton-line-sm"></view>
						</view>
					</view>
				</view>

				<view v-else>
					<view
						v-for="msg in messageList"
						:key="msg.message_id"
						class="message-card mb-3"
						:class="{ 'message-card-unread': !msg.is_read }"
						@click="openMessage(msg)"
					>
						<view class="message-card-top">
							<text class="message-type-title">{{ getTypeLabel(msg.type) }}</text>
							<text class="message-time">{{ formatTime(msg.create_time) }}</text>
						</view>
						<view class="d-flex a-center">
							<view class="message-icon-box mr-3 font-lg">
								{{ getTypeIcon(msg.type) }}
							</view>
							<view class="flex-1">
								<view class="d-flex a-center j-sb mb-1">
									<view class="d-flex a-center">
										<text class="message-title mr-2">{{ msg.title }}</text>
										<view v-if="!msg.is_read" class="message-unread-dot"></view>
									</view>
								</view>
								<text class="message-content-text d-block mb-2">{{ msg.content }}</text>
								<view class="d-flex a-center flex-wrap">
									<text class="message-tag mr-2 mb-2">{{ getTypeLabel(msg.type) }}</text>
									<text v-if="msg.status === 'action_required'" class="message-tag message-tag-warning mr-2 mb-2">待处理</text>
									<text v-if="msg.ext_data?.appointment_id" class="message-link mr-2 mb-2" @click.stop="goAppointment(msg.ext_data.appointment_id)">
										查看预约
									</text>
									<text v-if="msg.ext_data?.order_id" class="message-link mb-2" @click.stop="goOrder(msg.ext_data.order_id)">
										查看订单
									</text>
								</view>
							</view>
							<view class="message-more ml-2" @click.stop="toggleActions(msg.message_id)">
								<text class="iconfont icon-gengduo text-light-muted font-lg"></text>
							</view>
						</view>
						<view v-if="activeActionId === msg.message_id" class="message-action-panel">
							<view class="message-action-item message-action-border" @click.stop="markSingleRead(msg)">
								{{ msg.is_read ? '标记未读' : '标记已读' }}
							</view>
							<view class="message-action-item message-action-delete" @click.stop="removeMessage(msg)">
								删除消息
							</view>
						</view>
					</view>

					<view v-if="!loading && !messageList.length" class="empty-state">
						<view class="empty-icon-wrap">
							<text class="iconfont icon-xiaoxi empty-icon"></text>
						</view>
						<text class="empty-title">暂无消息</text>
						<text class="empty-desc">平台通知、预约提醒或交易动态会在这里出现，敬请关注</text>
					</view>

					<view v-if="loading && messageList.length" class="list-footer">加载中...</view>
					<view v-else-if="!hasMore && messageList.length" class="list-footer">没有更多消息了</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

const defaultTabs = [
	{ label: '全部', value: 'all', unread: 0 },
	{ label: '系统', value: 'system', unread: 0 },
	{ label: '预约', value: 'appointment', unread: 0 },
	{ label: '交易', value: 'payment', unread: 0 },
	{ label: '评价', value: 'review', unread: 0 },
	{ label: '退款', value: 'refund', unread: 0 }
]

export default {
	name: 'ParentSystemMessages',
	mixins: [pullRefreshMixin],
	data() {
		return {
			useMock: false,
			loading: false,
			markingAll: false,
			refresherTriggered: false,
			messageList: [],
			currentTab: 'all',
			tabs: defaultTabs,
			stats: {
				total: 0,
				unread: 0
			},
			pagination: {
				page: 1,
				pageSize: 20,
				total: 0
			},
			hasMore: true,
			activeActionId: '',
			errorMessage: '',
			scrollTop: 0,
			canRefresh: true
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
	},
	onShow() {
		this.initPage()
	},
	methods: {
		async refreshData() {
			console.log('[user-messages] 下拉刷新：重新加载消息')
			await this.initPage(true)
		},
		async initPage(reset = true) {
			if (reset) {
				this.pagination.page = 1
				this.hasMore = true
				this.messageList = []
			}
			await this.loadMessages()
		},
		handleScroll(e) {
			this.scrollTop = e.detail.scrollTop
			this.canRefresh = e.detail.scrollTop <= 10
		},
		handleScrollToUpper() {
			this.scrollTop = 0
			this.canRefresh = true
		},
		async onRefresh() {
			if (!this.canRefresh || this.scrollTop > 10) {
				this.refresherTriggered = false
				return
			}
			if (this.refresherTriggered) return
			this.refresherTriggered = true
			try {
				await this.initPage(true)
			} catch (error) {
				console.error('刷新失败:', error)
				uni.showToast({ title: '刷新失败，请稍后再试', icon: 'none' })
			} finally {
				this.refresherTriggered = false
			}
		},
		async loadMore() {
			if (this.loading || !this.hasMore) return
			this.pagination.page += 1
			await this.loadMessages(false)
		},
		async loadMessages(merge = true) {
			if (this.loading) return
			this.loading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const mockList = [
						{
							message_id: 'mock1',
							type: 'appointment',
							title: '预约已确认',
							content: '老师已经确认了本周三的试课预约，请按时参加。',
							is_read: false,
							create_time: Date.now() - 1000 * 60 * 60,
							status: 'normal',
							ext_data: { appointment_id: 'apt_mock1' }
						},
						{
							message_id: 'mock2',
							type: 'payment',
							title: '支付成功',
							content: '您已成功支付课程费用，点击查看订单详情。',
							is_read: true,
							create_time: Date.now() - 1000 * 60 * 120,
							status: 'normal',
							ext_data: { order_id: 'order_mock1' }
						}
					]
					this.messageList = merge ? mockList : [...this.messageList, ...mockList]
					this.stats = { total: mockList.length, unread: 1 }
					this.tabs = defaultTabs.map(tab => {
						if (tab.value === 'appointment') {
							return { ...tab, unread: 1 }
						}
						return { ...tab, unread: 0 }
					})
					this.hasMore = false
					return
				}

				const userInfo = uni.getStorageSync('userInfo') || {}
				if (!userInfo.uid) {
					uni.showToast({ title: '请先登录', icon: 'none' })
					return
				}

				const messageObj = uniCloud.importObject('user-message', { customUI: true })
				const res = await messageObj.getList({
					type: this.currentTab,
					page: this.pagination.page,
					pageSize: this.pagination.pageSize
				})
				if (res.code === 0 && res.data) {
					const { list = [], pagination = {}, stats = {} } = res.data
					if (merge || this.pagination.page === 1) {
						this.messageList = list
					} else {
						this.messageList = [...this.messageList, ...list]
					}
					this.pagination.total = pagination.total || 0
					this.hasMore = (this.pagination.page * this.pagination.pageSize) < this.pagination.total
					this.stats.total = stats.total || 0
					this.stats.unread = stats.unread || 0
					const perType = stats.perType || {}
					this.tabs = defaultTabs.map(tab => ({
						...tab,
						unread: perType[tab.value]?.unread || 0
					}))
				} else {
					throw new Error(res.message || '加载消息失败')
				}
			} catch (error) {
				console.error('加载消息失败:', error)
				this.showError(error.message || '消息加载失败，请稍后重试')
			} finally {
				this.loading = false
			}
		},
		async switchTab(tabValue) {
			if (this.currentTab === tabValue) return
			this.currentTab = tabValue
			this.pagination.page = 1
			this.hasMore = true
			this.messageList = []
			await this.loadMessages()
		},
		getTypeIcon(type) {
			const map = {
				system: '🔔',
				appointment: '📅',
				payment: '💰',
				review: '⭐',
				refund: '💵'
			}
			return map[type] || '📧'
		},
		getTypeLabel(type) {
			const map = {
				system: '系统通知',
				appointment: '预约提醒',
				payment: '交易信息',
				review: '评价管理',
				refund: '退款进度'
			}
			return map[type] || '其他'
		},
		getCurrentTabLabel() {
			const current = this.tabs.find(item => item.value === this.currentTab)
			return current ? current.label : '全部'
		},
		formatTime(timestamp) {
			const time = Number(timestamp)
			if (!time || Number.isNaN(time)) return ''
			const date = new Date(time)
			const now = Date.now()
			const diff = now - time
			if (diff < 60 * 1000) return '刚刚'
			if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`
			if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${month}-${day} ${hour}:${minute}`
		},
		async openMessage(msg) {
			if (!msg) return
			if (!msg.is_read) {
				await this.markSingleRead(msg)
			}
			if (msg.action_url) {
				uni.navigateTo({ url: msg.action_url })
			}
		},
		async markSingleRead(msg) {
			if (msg.is_read && !this.useMock) return
			try {
				if (this.useMock) {
					msg.is_read = true
					this.refreshTabStats()
					return
				}
				const messageObj = uniCloud.importObject('user-message', { customUI: true })
				if (msg.is_read) {
					return
				}
				const res = await messageObj.markRead({ message_id: msg.message_id })
				if (res.code === 0) {
					msg.is_read = true
					this.refreshTabStats()
				} else {
					throw new Error(res.message || '标记失败')
				}
			} catch (error) {
				console.error('标记消息失败:', error)
				this.showError(error.message || '操作失败')
			}
		},
		async markAllRead() {
			if (this.markingAll) return
			this.markingAll = true
			try {
				if (this.useMock) {
					this.messageList.forEach(msg => (msg.is_read = true))
					this.refreshTabStats()
					return
				}
				const messageObj = uniCloud.importObject('user-message', { customUI: true })
				const res = await messageObj.markAllRead({ type: this.currentTab })
				if (res.code === 0) {
					this.messageList.forEach(msg => { msg.is_read = true })
					await this.loadMessages()
				} else {
					throw new Error(res.message || '操作失败')
				}
			} catch (error) {
				console.error('批量标记失败:', error)
				this.showError(error.message || '操作失败')
			} finally {
				this.markingAll = false
			}
		},
		refreshTabStats() {
			const unreadCounts = this.messageList.reduce((acc, msg) => {
				const type = msg.type || 'system'
				if (!msg.is_read) {
					acc.total += 1
					acc[type] = (acc[type] || 0) + 1
				}
				return acc
			}, { total: 0 })
			this.stats.unread = unreadCounts.total || 0
			this.tabs = defaultTabs.map(tab => ({
				...tab,
				unread: unreadCounts[tab.value] || 0
			}))
		},
		toggleActions(messageId) {
			this.activeActionId = this.activeActionId === messageId ? '' : messageId
		},
		removeMessage(msg) {
			if (!msg) return
			uni.showToast({ title: '删除功能暂未开放', icon: 'none' })
			this.activeActionId = ''
		},
		goAppointment(appointmentId) {
			if (!appointmentId) return
			uni.navigateTo({ url: `/pages/appointment/detail?id=${appointmentId}` })
		},
		goOrder(orderId) {
			if (!orderId) return
			uni.navigateTo({ url: `/pages/order/detail?id=${orderId}` })
		},
		showError(message) {
			this.errorMessage = message
			setTimeout(() => {
				this.errorMessage = ''
			}, 2000)
		}
	}
}
</script>

<style scoped>
.message-page {
	height: 100vh;
	display: flex;
	flex-direction: column;
	background: #f3f4f6;
}

.list-scroll {
	flex: 1;
	min-height: 0;
}

.message-header {
	padding: 24rpx 24rpx 16rpx;
	background: #ffffff;
	border-bottom: 1rpx solid #eceef2;
}

.header-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 18rpx;
}

.header-copy {
	flex: 1;
	padding-right: 16rpx;
}

.header-title {
	display: block;
	font-size: 36rpx;
	font-weight: 700;
	color: #1f2329;
	margin-bottom: 6rpx;
}

.header-desc {
	display: block;
	font-size: 23rpx;
	line-height: 1.5;
	color: #8b93a6;
}

.header-top-action {
	flex-shrink: 0;
	padding: 14rpx 22rpx;
	border-radius: 999rpx;
	background: #f7f8fa;
	border: 1rpx solid #e7ebf1;
	font-size: 23rpx;
	color: #576072;
}

.header-meta-row {
	display: flex;
	align-items: center;
	gap: 14rpx;
	margin-bottom: 16rpx;
}

.meta-pill {
	flex: 1;
	min-width: 0;
	padding: 14rpx 18rpx;
	border-radius: 16rpx;
	background: #f7f8fa;
	border: 1rpx solid #e9edf3;
}

.meta-pill-primary {
	background: #eef7f1;
	border-color: #d6ebdd;
}

.meta-pill-label {
	display: block;
	font-size: 21rpx;
	color: #8b93a6;
	margin-bottom: 6rpx;
}

.meta-pill-value {
	display: block;
	font-size: 26rpx;
	font-weight: 600;
	color: #1f2329;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.tab-scroll {
	white-space: nowrap;
}

.tab-row {
	display: inline-flex;
	align-items: center;
	padding-right: 12rpx;
}

.tab-pill,
.tab-pill {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 12rpx 22rpx;
	border-radius: 999rpx;
	font-size: 23rpx;
	margin-right: 12rpx;
	transition: all 0.2s ease;
}

.tab-pill-active {
	background: #e8f3ec;
	color: #07c160;
	font-weight: 600;
	border: 1rpx solid #cfeeda;
}

.tab-pill-inactive {
	background: #f5f6f8;
	color: #596273;
	border: 1rpx solid #e8ebf0;
}

.tab-badge {
	min-width: 32rpx;
	height: 32rpx;
	line-height: 32rpx;
	padding: 0 8rpx;
	margin-left: 10rpx;
	border-radius: 999rpx;
	font-size: 20rpx;
	text-align: center;
	background: #ff4d4f;
	color: #ffffff;
}

.message-content {
	padding: 20rpx 24rpx 28rpx;
}

.message-card {
	position: relative;
	padding: 24rpx;
	border-radius: 18rpx;
	background: #ffffff;
	box-shadow: 0 4rpx 14rpx rgba(15, 23, 42, 0.04);
	border: 1rpx solid #ebeef3;
}

.message-card-unread {
	border-color: #d8eadf;
	box-shadow: 0 6rpx 16rpx rgba(7, 193, 96, 0.08);
}

.message-card-skeleton {
	padding: 24rpx;
}

.message-card-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20rpx;
	padding-bottom: 14rpx;
	border-bottom: 1rpx solid #f1f3f6;
}

.message-type-title {
	font-size: 23rpx;
	color: #8b93a6;
}

.skeleton-icon {
	width: 90rpx;
	height: 90rpx;
	background: linear-gradient(90deg, #f1f3f8 0%, #f7f8fc 50%, #f1f3f8 100%);
}

.skeleton-line {
	height: 24rpx;
	border-radius: 999rpx;
	background: linear-gradient(90deg, #f1f3f8 0%, #f7f8fc 50%, #f1f3f8 100%);
}

.skeleton-line-lg {
	width: 220rpx;
	height: 30rpx;
}

.skeleton-line-md {
	width: 320rpx;
}

.skeleton-line-sm {
	width: 200rpx;
}

.message-icon-box {
	width: 84rpx;
	height: 84rpx;
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f5f8ff;
	color: #576b95;
	font-size: 34rpx;
}

.message-title {
	font-size: 29rpx;
	font-weight: 600;
	color: #1f2430;
}

.message-unread-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	background: #ff4d4f;
}

.message-time {
	font-size: 22rpx;
	color: #9aa3b2;
}

.message-content-text {
	font-size: 25rpx;
	line-height: 1.75;
	color: #667085;
}

.message-tag {
	display: inline-flex;
	align-items: center;
	padding: 8rpx 14rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	color: #657084;
	background: #f6f7f9;
}

.message-tag-warning {
	color: #c57b00;
	background: #fff7e8;
}

.message-link {
	font-size: 23rpx;
	font-weight: 500;
	color: #576b95;
}

.message-more {
	width: 52rpx;
	height: 52rpx;
	border-radius: 14rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f7f8fa;
}

.message-action-panel {
	position: absolute;
	top: calc(100% - 8rpx);
	right: 0;
	z-index: 10;
	min-width: 220rpx;
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 12rpx 28rpx rgba(16, 24, 40, 0.12);
	overflow: hidden;
	border: 1rpx solid #eceff4;
}

.message-action-item {
	padding: 22rpx 24rpx;
	font-size: 24rpx;
	color: #344054;
}

.message-action-border {
	border-bottom: 1rpx solid #eef2f7;
}

.message-action-delete {
	color: #f04438;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 120rpx 40rpx;
}

.empty-icon-wrap {
	width: 180rpx;
	height: 180rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #ffffff;
	box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.06);
}

.empty-icon {
	font-size: 92rpx;
	color: #b8c0d4;
}

.empty-title {
	margin-top: 28rpx;
	font-size: 32rpx;
	font-weight: 600;
	color: #2a3242;
}

.empty-desc {
	margin-top: 14rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #98a2b3;
	text-align: center;
}

.list-footer {
	padding: 12rpx 0 24rpx;
	text-align: center;
	font-size: 24rpx;
	color: #98a2b3;
}
</style>