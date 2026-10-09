<!-- 家长端：系统消息。云对象 user-message.getList / markRead / markAllRead -->
<template>
	<view class="page">
		<scroll-view scroll-x class="tabs" :show-scrollbar="false">
			<view class="tabs-inner">
				<view
					v-for="tab in tabs"
					:key="tab.value"
					class="tab"
					:class="{ on: currentTab === tab.value }"
					@click="switchTab(tab.value)"
				>
					{{ tab.label }}
					<text v-if="tab.unread > 0" class="tab-badge">{{ tab.unread > 99 ? '99+' : tab.unread }}</text>
				</view>
			</view>
		</scroll-view>

		<view class="mark-row">
			<text class="mark-all" @click="markAllRead">{{ markingAll ? '处理中...' : '全部已读' }}</text>
		</view>

		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view v-if="loading && messageList.length === 0" class="footer-tip">加载中...</view>

			<view
				v-for="msg in messageList"
				:key="msg.message_id"
				class="conv-item"
				:class="{ unread: !msg.is_read }"
				@click="openMessage(msg)"
			>
				<view class="avatar" :class="avatarClass(msg.type)">{{ typeMark(msg.type) }}</view>
				<view class="conv-main">
					<view class="conv-head">
						<view class="title-wrap">
							<text class="conv-title">{{ msg.title }}</text>
							<view v-if="!msg.is_read" class="unread-dot"></view>
						</view>
						<text class="conv-time">{{ formatTime(msg.create_time) }}</text>
					</view>
					<text class="conv-msg">{{ msg.content }}</text>
					<view v-if="msg.status === 'action_required' || msg.ext_data?.appointment_id || msg.ext_data?.order_id" class="conv-ops">
						<text v-if="msg.status === 'action_required'" class="chip-warn">待处理</text>
						<text v-if="msg.ext_data?.appointment_id" class="link" @click.stop="goAppointment(msg.ext_data.appointment_id)">查看预约</text>
						<text v-if="msg.ext_data?.order_id" class="link" @click.stop="goOrder(msg.ext_data.order_id)">查看订单</text>
					</view>
				</view>
				<text class="more" @click.stop="toggleActions(msg.message_id)">···</text>
				<view v-if="activeActionId === msg.message_id" class="action-panel">
					<view class="action-item" @click.stop="markSingleRead(msg)">{{ msg.is_read ? '标记未读' : '标记已读' }}</view>
					<view class="action-item danger" @click.stop="removeMessage(msg)">删除消息</view>
				</view>
			</view>

			<view v-if="!loading && !messageList.length" class="empty">
				<text class="empty-title">暂无消息</text>
				<text class="empty-sub">平台通知、预约提醒或交易动态会在这里出现</text>
			</view>
			<view v-if="loading && messageList.length" class="footer-tip">加载中...</view>
			<view v-else-if="!hasMore && messageList.length" class="footer-tip">没有更多消息了</view>
		</scroll-view>
	</view>
</template>

<script>
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { createAppPushMixin } from '@/utils/appPushMixin.js'
import { APP_PUSH_TYPES } from '@/utils/chatPush.js'

const defaultTabs = [
	{ label: '全部', value: 'all', unread: 0 },
	{ label: '系统', value: 'system', unread: 0 },
	{ label: '预约', value: 'appointment', unread: 0 },
	{ label: '招募', value: 'recruitment', unread: 0 },
	{ label: '交易', value: 'payment', unread: 0 },
	{ label: '评价', value: 'review', unread: 0 },
	{ label: '退款', value: 'refund', unread: 0 }
]

export default {
	name: 'ParentSystemMessages',
	mixins: [pullRefreshMixin, createAppPushMixin([APP_PUSH_TYPES.SYSTEM_MESSAGE, APP_PUSH_TYPES.APPOINTMENT_UPDATE])],
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
		onAppPushPayload() {
			this.initPage(true)
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
		typeMark(type) {
			const map = {
				system: '通',
				appointment: '约',
				recruitment: '审',
				payment: '订',
				review: '评',
				refund: '退'
			}
			return map[type] || '讯'
		},
		avatarClass(type) {
			if (type === 'appointment') return 'av-amber'
			if (type === 'recruitment' || type === 'review') return 'av-ok'
			if (type === 'refund') return 'av-danger'
			if (type === 'payment') return 'av-brand'
			return 'av-brand'
		},
		getTypeIcon(type) {
			const map = {
				system: '🔔',
				appointment: '📅',
				recruitment: '📣',
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
				recruitment: '招募动态',
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
			uni.navigateTo({ url: `/pages-biz/appointment/detail?id=${appointmentId}` })
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
.page {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	background: #F4F6F9;
}

.tabs {
	background: #FFFFFF;
	white-space: nowrap;
	border-bottom: 1rpx solid #EBEDF0;
}

.tabs-inner {
	display: flex;
	padding: 0 16rpx;
}

.tab {
	flex-shrink: 0;
	height: 88rpx;
	padding: 0 24rpx;
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

.tab-badge {
	min-width: 28rpx;
	height: 28rpx;
	margin-left: 8rpx;
	padding: 0 8rpx;
	border-radius: 14rpx;
	background: #FA5151;
	color: #FFFFFF;
	font-size: 18rpx;
	line-height: 28rpx;
	text-align: center;
}

.mark-row {
	padding: 16rpx 32rpx 8rpx;
	text-align: right;
	background: #FFFFFF;
}

.mark-all {
	font-size: 24rpx;
	color: #2563EB;
}

.list-scroll {
	flex: 1;
	height: calc(100vh - 160rpx);
	background: #FFFFFF;
}

.conv-item {
	position: relative;
	display: flex;
	gap: 24rpx;
	padding: 24rpx 32rpx;
	border-bottom: 1rpx solid #F2F3F5;
	min-height: 144rpx;
	box-sizing: border-box;
}

.conv-item.unread .conv-title {
	font-weight: 600;
}

.avatar {
	width: 88rpx;
	height: 88rpx;
	border-radius: 50%;
	color: #FFFFFF;
	font-size: 28rpx;
	font-weight: 600;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.av-brand {
	background: #2563EB;
}

.av-amber {
	background: #FA9D3B;
}

.av-ok {
	background: #07C160;
}

.av-danger {
	background: #FA5151;
}

.conv-main {
	flex: 1;
	min-width: 0;
}

.conv-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}

.title-wrap {
	display: flex;
	align-items: center;
	gap: 10rpx;
	flex: 1;
	min-width: 0;
}

.conv-title {
	flex: 1;
	min-width: 0;
	font-size: 30rpx;
	color: #1F2329;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.unread-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	background: #FA5151;
	flex-shrink: 0;
}

.conv-time {
	flex-shrink: 0;
	font-size: 22rpx;
	color: #8B919C;
}

.conv-msg {
	display: block;
	margin-top: 8rpx;
	font-size: 26rpx;
	color: #8B919C;
	line-height: 1.4;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.conv-ops {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 16rpx;
	margin-top: 12rpx;
}

.chip-warn {
	height: 36rpx;
	padding: 0 12rpx;
	border-radius: 8rpx;
	background: #FFF6E8;
	color: #C47A12;
	font-size: 20rpx;
	line-height: 36rpx;
}

.link {
	font-size: 24rpx;
	color: #2563EB;
	font-weight: 500;
}

.more {
	flex-shrink: 0;
	width: 48rpx;
	height: 48rpx;
	line-height: 40rpx;
	text-align: center;
	font-size: 32rpx;
	color: #8B919C;
	letter-spacing: 2rpx;
}

.action-panel {
	position: absolute;
	top: 72rpx;
	right: 24rpx;
	z-index: 10;
	min-width: 200rpx;
	background: #FFFFFF;
	border-radius: 16rpx;
	box-shadow: 0 12rpx 28rpx rgba(31, 35, 41, 0.12);
	overflow: hidden;
}

.action-item {
	padding: 22rpx 24rpx;
	font-size: 24rpx;
	color: #1F2329;
}

.action-item.danger {
	color: #FA5151;
	border-top: 1rpx solid #F2F3F5;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 80rpx 32rpx;
}

.empty-title {
	font-size: 30rpx;
	color: #5C6370;
}

.empty-sub {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	text-align: center;
	line-height: 1.6;
}

.footer-tip {
	padding: 40rpx 32rpx;
	text-align: center;
	font-size: 26rpx;
	color: #8B919C;
}
</style>
