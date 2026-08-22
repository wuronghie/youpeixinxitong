<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3 text-white">
			<view class="d-flex flex-column mb-3">
				<text class="font-lg font-weight mb-1">系统消息</text>
				<text class="font-sm" style="opacity: 0.85;">及时查看平台通知，掌握最新状态</text>
			</view>
			<view class="stat-card rounded px-3 py-2">
				<view class="flex-1 text-center">
					<text class="font-md font-weight text-white d-block mb-1">{{ stats.total || 0 }}</text>
					<text class="font-xs text-white" style="opacity: 0.9;">全部消息</text>
				</view>
				<view style="width: 2rpx; height: 60rpx; background: rgba(255,255,255,0.2);"></view>
				<view class="flex-1 text-center">
					<text class="font-md font-weight text-white d-block mb-1">{{ stats.unread || 0 }}</text>
					<text class="font-xs text-white" style="opacity: 0.9;">未读</text>
				</view>
			</view>
			<view class="d-flex a-center mt-3">
				<view
					v-for="tab in tabs"
					:key="tab.value"
					class="flex-1 text-center rounded py-2 mr-2 font-sm d-flex a-center j-center"
					:class="currentTab === tab.value ? 'tab-active' : 'tab-inactive'"
					@click="switchTab(tab.value)"
				>
					<text>{{ tab.label }}</text>
					<view v-if="tab.unread > 0" class="rounded-circle bg-danger text-white d-flex a-center j-center font-xs ml-1" style="min-width: 32rpx; height: 32rpx; padding: 0 8rpx;">{{ tab.unread > 99 ? '99+' : tab.unread }}</view>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="scroll" @scrolltolower="loadMore">
			<view class="px-2 py-3">
				<view v-if="list.length" class="d-flex a-center j-sb mb-3">
					<text class="font-xs text-light-muted">共 {{ pagination.total }} 条</text>
					<text class="font-xs main-text-color" @click="markAllRead">全部标记已读</text>
				</view>

				<view v-if="loading && !list.length" class="d-flex flex-column">
					<view v-for="n in 4" :key="n" class="card mb-3">
						<view class="d-flex a-center">
							<view class="rounded bg-light-secondary mr-3" style="width: 88rpx; height: 88rpx;"></view>
							<view class="flex-1">
								<view class="bg-light-secondary rounded mb-2" style="width: 40%; height: 30rpx;"></view>
								<view class="bg-light-secondary rounded" style="width: 70%; height: 30rpx;"></view>
							</view>
						</view>
					</view>
				</view>
				<view v-else>
					<view v-for="item in list" :key="item.message_id" class="card mb-3" :class="{ 'border border-primary': !item.is_read }" @click="goToDetail(item)">
						<view class="d-flex a-center">
							<view class="rounded d-flex a-center j-center mr-3" :class="getTypeClass(item.type)" style="width: 88rpx; height: 88rpx;">
								<view :class="getTypeIcon(item.type)" style="width: 48rpx; height: 48rpx;"></view>
							</view>
							<view class="flex-1">
								<view class="d-flex a-center j-sb mb-1">
									<text class="font-sm font-weight">{{ item.title }}</text>
									<text class="font-xs text-light-muted">{{ formatTime(item.create_time) }}</text>
								</view>
								<text class="font-xs text-light-muted d-block mb-2" style="line-height: 1.6;">{{ item.content }}</text>
								<view class="d-flex flex-wrap">
									<text class="bg-light-secondary rounded px-2 py-1 mr-2 mb-2 font-xs main-text-color" v-if="item.type === 'appointment'">预约通知</text>
									<text class="bg-light-secondary rounded px-2 py-1 mr-2 mb-2 font-xs main-text-color" v-if="item.type === 'payment'">交易提醒</text>
									<text class="bg-light-secondary rounded px-2 py-1 mr-2 mb-2 font-xs main-text-color" v-if="item.type === 'system'">系统通知</text>
									<text class="bg-danger rounded px-2 py-1 mr-2 mb-2 font-xs text-white" v-if="!item.is_read">未读</text>
								</view>
							</view>
						</view>
					</view>

					<view v-if="!loading && !list.length" class="d-flex flex-column a-center j-center py-5">
						<view class="icon-empty" style="color: #ddd;"></view>
						<text class="text-light-muted font-md mt-3">暂无相关消息</text>
						<text class="text-light-muted font-xs mt-2">等待平台发布新的通知</text>
					</view>

					<view v-if="loading && list.length" class="text-center text-light-muted font py-3">加载中...</view>
					<view v-else-if="finished && list.length" class="text-center text-light-muted font py-3">已经到底啦</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

export default {
	name: 'TeacherMessages',
	components: {
		card
	},
	mixins: [pullRefreshMixin],
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
.scroll {
	flex: 1;
	height: calc(100vh - 400rpx);
}

/* 统计卡片样式 */
.stat-card {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
	display: flex;
	align-items: center;
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

/* CSS图标样式 */
.icon-empty {
	width: 240rpx;
	height: 240rpx;
	position: relative;
	display: inline-block;
	border: 4rpx dashed #ddd;
	border-radius: 20rpx;
}
.icon-empty::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -60%);
	width: 60rpx;
	height: 60rpx;
	border: 4rpx solid #ddd;
	border-radius: 50%;
}
.icon-empty::after {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -30%);
	width: 80rpx;
	height: 4rpx;
	background: #ddd;
}

.icon-bell {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-bell::before {
	content: '';
	position: absolute;
	top: 4rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 20rpx;
	height: 18rpx;
	border: 2rpx solid currentColor;
	border-radius: 10rpx 10rpx 2rpx 2rpx;
	background: transparent;
}
.icon-bell::after {
	content: '';
	position: absolute;
	bottom: 2rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 4rpx;
	height: 6rpx;
	border: 2rpx solid currentColor;
	border-top: none;
	border-radius: 0 0 4rpx 4rpx;
}

.icon-calendar {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	border: 2rpx solid currentColor;
	border-radius: 4rpx;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-calendar::before {
	content: '';
	position: absolute;
	top: -2rpx;
	left: -2rpx;
	right: -2rpx;
	height: 8rpx;
	background: currentColor;
	border-radius: 4rpx 4rpx 0 0;
}
.icon-calendar::after {
	content: '';
	position: absolute;
	top: 12rpx;
	left: 6rpx;
	width: 4rpx;
	height: 4rpx;
	background: currentColor;
	border-radius: 50%;
	box-shadow: 8rpx 0 0 currentColor, 0 6rpx 0 currentColor, 8rpx 6rpx 0 currentColor;
}

.icon-wallet {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	border: 2rpx solid currentColor;
	border-radius: 6rpx;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-wallet::before {
	content: '';
	position: absolute;
	top: 6rpx;
	left: 6rpx;
	width: 12rpx;
	height: 8rpx;
	border: 2rpx solid currentColor;
	border-radius: 2rpx;
	background: transparent;
}
.icon-wallet::after {
	content: '';
	position: absolute;
	bottom: 6rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 16rpx;
	height: 3rpx;
	background: currentColor;
}

.icon-chat {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-chat::before {
	content: '';
	position: absolute;
	bottom: 0;
	left: 0;
	width: 28rpx;
	height: 20rpx;
	border: 2rpx solid currentColor;
	border-radius: 6rpx 6rpx 6rpx 0;
	background: transparent;
}
.icon-chat::after {
	content: '';
	position: absolute;
	bottom: 4rpx;
	left: 6rpx;
	width: 4rpx;
	height: 4rpx;
	background: currentColor;
	border-radius: 50%;
	box-shadow: 6rpx 0 0 currentColor, 12rpx 0 0 currentColor;
}
</style>