<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex a-center j-sb text-white mb-3">
				<view>
					<text class="font-lg font-weight d-block mb-1">系统消息</text>
					<text class="font-sm" style="opacity: 0.85;">平台通知、预约提醒、交易动态一目了然</text>
				</view>
				<view class="stat-card rounded px-3 py-2">
					<text class="font-md font-weight text-white d-block">{{ stats.unread || 0 }}</text>
					<text class="font-sm text-white" style="opacity: 0.9;">未读消息</text>
				</view>
			</view>
			<view class="d-flex a-center flex-wrap">
				<view
					v-for="tab in tabs"
					:key="tab.value"
					class="rounded px-3 py-2 mr-2 mb-2 font-sm"
					:class="currentTab === tab.value ? 'tab-active' : 'tab-inactive'"
					@click="switchTab(tab.value)"
				>
					{{ tab.label }}
					<text v-if="tab.unread > 0" class="main-bg-color text-white rounded-circle px-2 ml-1 font-sm" style="min-width: 32rpx;display: inline-block;text-align: center;">
						{{ tab.unread }}
					</text>
				</view>
				<view class="tab-inactive rounded px-3 py-2 mb-2 font-sm" @click="markAllRead">
					{{ markingAll ? '处理中...' : '全部已读' }}
				</view>
			</view>
		</view>

		<!-- 消息列表 -->
		<scroll-view
			scroll-y
			@scrolltolower="loadMore"
			class="list-scroll"
		>
			<view class="px-2 py-3">
				<view v-if="loading && messageList.length === 0" class="d-flex flex-column">
					<view v-for="n in 4" :key="n" class="card mb-3 d-flex a-center">
						<view class="rounded bg-light-secondary mr-3" style="width: 90rpx;height: 90rpx;"></view>
						<view class="flex-1">
							<view class="bg-light-secondary rounded mb-2" style="width: 200rpx;height: 30rpx;"></view>
							<view class="bg-light-secondary rounded mb-2" style="width: 150rpx;height: 24rpx;"></view>
							<view class="bg-light-secondary rounded" style="width: 180rpx;height: 24rpx;"></view>
						</view>
					</view>
				</view>

				<view v-else>
					<view
						v-for="msg in messageList"
						:key="msg.message_id"
						class="card mb-3"
						:class="{ 'border border-primary': !msg.is_read }"
						@click="openMessage(msg)"
					>
						<view class="d-flex a-center">
							<view class="rounded d-flex a-center j-center mr-3 font-lg" style="width: 90rpx;height: 90rpx;background: rgba(102, 126, 234, 0.1);">
								{{ getTypeIcon(msg.type) }}
							</view>
							<view class="flex-1">
								<view class="d-flex a-center j-sb mb-1">
									<view class="d-flex a-center">
										<text class="font-md font-weight mr-2">{{ msg.title }}</text>
										<view v-if="!msg.is_read" class="rounded-circle bg-danger" style="width: 12rpx;height: 12rpx;"></view>
									</view>
									<text class="font-sm text-light-muted">{{ formatTime(msg.create_time) }}</text>
								</view>
								<text class="font-sm text-light-muted d-block mb-2">{{ msg.content }}</text>
								<view class="d-flex a-center flex-wrap">
									<text class="bg-light-secondary rounded px-2 py-1 font-sm mr-2 mb-2">{{ getTypeLabel(msg.type) }}</text>
									<text v-if="msg.status === 'action_required'" class="bg-warning rounded px-2 py-1 font-sm mr-2 mb-2 text-warning">待处理</text>
									<text v-if="msg.ext_data?.appointment_id" class="main-text-color font-sm mr-2 mb-2" @click.stop="goAppointment(msg.ext_data.appointment_id)">
										查看预约
									</text>
									<text v-if="msg.ext_data?.order_id" class="main-text-color font-sm mb-2" @click.stop="goOrder(msg.ext_data.order_id)">
										查看订单
									</text>
								</view>
							</view>
							<view class="ml-2" @click.stop="toggleActions(msg.message_id)">
								<text class="iconfont icon-gengduo text-light-muted font-lg"></text>
							</view>
						</view>
						<view v-if="activeActionId === msg.message_id" class="position-absolute bg-white rounded border mt-2" style="top: 100%;right: 0;z-index: 10;min-width: 200rpx;">
							<view class="px-3 py-2 border-bottom font-sm" @click.stop="markSingleRead(msg)">
								{{ msg.is_read ? '标记未读' : '标记已读' }}
							</view>
							<view class="px-3 py-2 font-sm" @click.stop="removeMessage(msg)">
								删除消息
							</view>
						</view>
					</view>

					<view v-if="!loading && !messageList.length" class="d-flex flex-column a-center j-center py-5">
						<text class="iconfont icon-xiaoxi" style="font-size: 120rpx;color: #ddd;"></text>
						<text class="text-light-muted font-md mt-3">暂无消息</text>
						<text class="text-light-muted font-sm mt-2">平台通知、预约提醒或交易动态会在这里出现，敬请关注</text>
					</view>

					<view v-if="loading && messageList.length" class="text-center text-light-muted font py-3">加载中...</view>
					<view v-else-if="!hasMore && messageList.length" class="text-center text-light-muted font py-3">没有更多消息了</view>
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
.list-scroll {
	flex: 1;
	height: calc(100vh - 400rpx);
}

/* 统计卡片样式 */
.stat-card {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
}

/* 选中状态的选项卡样式 */
.tab-active {
	background-color: #FFFFFF;
	color: #07C160;
	font-weight: 600;
}

/* 未选中状态的选项卡样式 */
.tab-inactive {
	background-color: rgba(255, 255, 255, 0.2);
	color: #FFFFFF;
}
</style>