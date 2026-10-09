<template>
	<view class="page">
		<view class="metrics-card">
			<view class="metric">
				<text class="metric-num">{{ stats.total || 0 }}</text>
				<text class="metric-label">全部</text>
			</view>
			<view class="metric">
				<text class="metric-num">{{ stats.unread || 0 }}</text>
				<text class="metric-label">未读</text>
			</view>
		</view>

		<view class="tabs">
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

		<view class="mark-row">
			<text class="mark-all" @click="markAllRead">全部标记已读</text>
		</view>

		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view v-if="loading && !list.length" class="footer-tip">加载中...</view>

			<view
				v-for="item in list"
				:key="item.message_id"
				class="conv-item"
				:class="{ unread: !item.is_read }"
				@click="goToDetail(item)"
			>
				<view class="avatar" :class="avatarClass(item.type)">{{ typeMark(item.type) }}</view>
				<view class="conv-main">
					<view class="conv-head">
						<text class="conv-title">{{ item.title }}</text>
						<text class="conv-time">{{ formatTime(item.create_time) }}</text>
					</view>
					<text class="conv-msg">{{ item.content }}</text>
				</view>
			</view>

			<view v-if="!loading && !list.length" class="empty">
				<text class="empty-title">暂无相关消息</text>
			</view>
			<view v-if="loading && list.length" class="footer-tip">加载中...</view>
			<view v-else-if="finished && list.length" class="footer-tip">已经到底啦</view>
		</scroll-view>
	</view>
</template>

<script>
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { createAppPushMixin } from '@/utils/appPushMixin.js'
import { APP_PUSH_TYPES } from '@/utils/chatPush.js'

export default {
	name: 'TeacherMessages',
	mixins: [pullRefreshMixin, createAppPushMixin([APP_PUSH_TYPES.SYSTEM_MESSAGE, APP_PUSH_TYPES.APPOINTMENT_UPDATE])],
	data() {
		return {
			tabs: [
				{ label: '全部', value: 'all', unread: 0 },
				{ label: '系统', value: 'system', unread: 0 },
				{ label: '预约', value: 'appointment', unread: 0 },
				{ label: '交易', value: 'payment', unread: 0 }
			],
			currentTab: 'all',
			list: [],
			stats: {
				total: 0,
				unread: 0
			},
			pagination: {
				page: 1,
				pageSize: 20,
				total: 0
			},
			loading: false,
			finished: false,
			useMock: false
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.resetAndLoad()
	},
	onShow() {
		if (!this.useMock) {
			this.resetAndLoad()
		}
	},
	methods: {
		async refreshData() {
			console.log('[teacher-messages] 下拉刷新：重新加载消息')
			await this.resetAndLoad()
		},
		onAppPushPayload() {
			this.resetAndLoad()
		},
		resetAndLoad() {
			this.pagination.page = 1
			this.finished = false
			this.list = []
			this.loadMessages()
		},
		switchTab(tabValue) {
			if (this.currentTab === tabValue) return
			this.currentTab = tabValue
			this.resetAndLoad()
		},
		async loadMessages() {
			if (this.loading || this.finished) return
			this.loading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const mockData = [
						{
							message_id: 'mock-1',
							type: 'system',
							title: '系统通知',
							content: '欢迎加入优培信息通，完善资料可提升曝光率',
							is_read: false,
							create_time: Date.now() - 60 * 60 * 1000
						},
						{
							message_id: 'mock-2',
							type: 'appointment',
							title: '新的预约申请',
							content: '家长【李女士】提交了试课预约申请，请及时确认。',
							is_read: true,
							create_time: Date.now() - 3 * 60 * 60 * 1000
						}
					]
					this.list = mockData
					this.stats = { total: mockData.length, unread: mockData.filter(item => !item.is_read).length }
					this.tabs = this.tabs.map(tab => ({
						...tab,
						unread:
							tab.value === 'all'
								? this.stats.unread
								: mockData.filter(item => item.type === tab.value && !item.is_read).length
					}))
					this.finished = true
					return
				}

				const messageObj = uniCloud.importObject('teacher-message', { customUI: true })
				const res = await messageObj.getList({
					type: this.currentTab,
					page: this.pagination.page,
					pageSize: this.pagination.pageSize
				})

				if (res.code === 0 && res.data) {
					const fetched = res.data.list || []
					if (this.pagination.page === 1) {
						this.list = fetched
					} else {
						this.list = [...this.list, ...fetched]
					}

					this.pagination.total = res.data.pagination?.total || 0
					this.stats = {
						total: res.data.stats?.total || 0,
						unread: res.data.stats?.unread || 0
					}

					const perType = res.data.stats?.perType || {}
					this.tabs = this.tabs.map(tab => {
						if (tab.value === 'all') {
							return { ...tab, unread: this.stats.unread }
						}
						return {
							...tab,
							unread: perType[tab.value]?.unread || 0
						}
					})

					if (this.list.length >= this.pagination.total || fetched.length < this.pagination.pageSize) {
						this.finished = true
					} else {
						this.pagination.page += 1
					}
				} else {
					uni.showToast({ title: res.message || '获取消息失败', icon: 'none' })
				}
			} catch (error) {
				console.error('获取消息失败:', error)
				uni.showToast({ title: '获取消息失败，请稍后再试', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		loadMore() {
			this.loadMessages()
		},
		async markAllRead() {
			if (this.useMock || !this.list.some(item => !item.is_read)) return
			try {
				const messageObj = uniCloud.importObject('teacher-message', { customUI: true })
				const res = await messageObj.markAllRead({ type: this.currentTab })
				if (res.code === 0) {
					this.list = this.list.map(item => ({ ...item, is_read: true }))
					this.tabs = this.tabs.map(tab => ({ ...tab, unread: tab.value === 'all' ? 0 : 0 }))
					this.stats.unread = 0
					uni.showToast({ title: '已全部标记为已读', icon: 'none' })
				} else {
					uni.showToast({ title: res.message || '操作失败', icon: 'none' })
				}
			} catch (error) {
				console.error('批量标记失败:', error)
				uni.showToast({ title: '操作失败，请稍后再试', icon: 'none' })
			}
		},
		typeMark(type) {
			if (type === 'appointment') return '约'
			if (type === 'payment') return '交'
			return '通'
		},
		avatarClass(type) {
			if (type === 'appointment') return 'av-amber'
			if (type === 'payment') return 'av-ok'
			return 'av-brand'
		},
		getTypeIcon(type) {
			const icons = {
				system: 'icon-bell',
				appointment: 'icon-calendar',
				payment: 'icon-wallet'
			}
			return icons[type] || 'icon-chat'
		},
		getTypeClass(type) {
			const classes = {
				system: 'bg-warning',
				appointment: 'main-bg-color',
				payment: 'bg-success'
			}
			return classes[type] || 'bg-light-secondary'
		},
		formatTime(timestamp) {
			const date = new Date(timestamp || Date.now())
			const now = new Date()
			const diff = now - date
			if (diff < 60000) return '刚刚'
			if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
			if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			return `${month}-${day}`
		},
		async goToDetail(msg) {
			if (!msg.is_read && !this.useMock) {
				try {
					const messageObj = uniCloud.importObject('teacher-message', { customUI: true })
					const res = await messageObj.markRead({ message_id: msg.message_id })
					if (res.code === 0) {
						msg.is_read = true
						this.stats.unread = Math.max(this.stats.unread - 1, 0)
						this.tabs = this.tabs.map(tab => ({
							...tab,
							unread: tab.value === 'all'
								? Math.max(tab.unread - 1, 0)
								: tab.value === msg.type
									? Math.max(tab.unread - 1, 0)
									: tab.unread
						}))
					}
				} catch (error) {
					console.error('标记消息已读失败:', error)
				}
			} else {
				msg.is_read = true
			}

			if (msg.action_url) {
				uni.navigateTo({ url: msg.action_url })
			}
		}
	}
}
</script>

<style scoped>
.page {
	background: #F4F6F9;
	min-height: 100vh;
}

.metrics-card {
	margin: 24rpx 32rpx 0;
	padding: 28rpx 12rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
	display: flex;
}

.metric {
	flex: 1;
	text-align: center;
}

.metric-num {
	display: block;
	font-size: 40rpx;
	font-weight: 600;
	color: #1F2329;
}

.metric-label {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #8B919C;
}

.tabs {
	display: flex;
	margin-top: 16rpx;
	background: #FFFFFF;
	border-bottom: 1rpx solid #EBEDF0;
}

.tab {
	flex: 1;
	height: 88rpx;
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
	padding: 16rpx 32rpx 0;
	text-align: right;
}

.mark-all {
	font-size: 24rpx;
	color: #2563EB;
}

.list-scroll {
	height: calc(100vh - 380rpx);
	margin-top: 8rpx;
	background: #FFFFFF;
}

.conv-item {
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

.conv-title {
	flex: 1;
	min-width: 0;
	font-size: 30rpx;
	color: #1F2329;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
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

.empty,
.footer-tip {
	padding: 40rpx 32rpx;
	text-align: center;
	font-size: 26rpx;
	color: #8B919C;
}
</style>