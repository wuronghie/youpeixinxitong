<template>
	<view class="chat-list-page">
		<!-- 顶部导航栏 -->
		<view class="navbar">
			<view class="navbar-content">
				<text class="navbar-title">家长沟通</text>
			</view>
		</view>

		<!-- 搜索框 -->
		<view class="search-box">
			<view class="search-input-wrapper">
				<view class="icon-search search-icon"></view>
				<input
					class="search-input"
					v-model="searchKeyword"
					placeholder="搜索"
					placeholder-class="search-placeholder"
					confirm-type="search"
				/>
				<view v-if="searchKeyword" class="icon-close clear-icon" @click="clearSearch"></view>
			</view>
		</view>

		<!-- 会话列表 -->
		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view v-if="loading && !displayList.length" class="loading-wrapper">
				<view v-for="n in 5" :key="n" class="conversation-item skeleton">
					<view class="avatar-skeleton"></view>
					<view class="content-skeleton">
						<view class="name-skeleton"></view>
						<view class="message-skeleton"></view>
					</view>
				</view>
			</view>

			<view v-else>
				<view
					v-for="item in displayList"
					:key="item.conversation_id"
					class="conversation-item"
					@click="goToConversation(item)"
				>
					<image 
						class="avatar" 
						:src="item.avatar || defaultAvatarUrl" 
						mode="aspectFill"
					/>
					<view class="content">
						<view class="header">
							<text class="name">{{ item.name }}</text>
							<text class="time">{{ formatTime(item.last_message_time) }}</text>
						</view>
						<view class="footer">
							<text class="message" :class="{ 'unread': item.unread_count > 0 }">
								{{ formatLastMessage(item.last_message) || '暂无消息' }}
							</text>
							<view v-if="item.unread_count > 0" class="badge">
								{{ item.unread_count > 99 ? '99+' : item.unread_count }}
							</view>
						</view>
					</view>
				</view>

				<view v-if="!loading && !displayList.length" class="empty-state">
					<view class="empty-icon icon-chat" style="width: 120rpx; height: 120rpx; color: #ddd;"></view>
					<text class="empty-text">暂无会话</text>
					<text class="empty-hint">开始与家长沟通，建立信任</text>
				</view>

				<view v-if="loading && displayList.length" class="loading-more">加载中...</view>
				<view v-else-if="finished && displayList.length" class="loading-more">没有更多了</view>
			</view>
		</scroll-view>
		
		<view class="tabbar-spacer"></view>
		<TeacherTabBar current="chat" />
	</view>
</template>

<script>
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

import card from '@/components/common/card.vue'
import { mockConversations, useMockData } from '@/utils/mockData.js'
import TeacherTabBar from '@/components/TeacherTabBar.vue'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { CHAT_POLL_ENABLED, CHAT_POLL_INTERVAL } from '@/utils/chatPoll.js'
import { onChatPush, offChatPush } from '@/utils/chatPush.js'

export default {
	name: 'TeacherChatList',
	components: {
		card,
		TeacherTabBar
	},
	mixins: [pullRefreshMixin],
		data() {
			return {
				// 默认头像URL（从CDN）
				defaultAvatarUrl: getDefaultAvatarUrl(),
			searchKeyword: '',
			list: [],
			displayList: [],
			stats: {
				total: 0,
				unreadConversations: 0,
				unreadMessages: 0
			},
			page: 1,
			pageSize: 30,
			finished: false,
			loading: false,
			useMock: false,
			pollTimer: null,
			pollInterval: CHAT_POLL_INTERVAL.list,
			silentPolling: false
		}
	},
	watch: {
		searchKeyword() {
			this.filterList()
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.resetAndLoad()
	},
	onShow() {
		if (!this.useMock) {
			this.bindChatPush()
			this.startPolling()
			this.resetAndLoad()
		}
	},
	onHide() {
		this.stopPolling()
		this.unbindChatPush()
	},
	onUnload() {
		this.stopPolling()
		this.unbindChatPush()
	},
	onShareAppMessage() {
		return {
			title: '优培信息通 · 教师家长沟通',
			path: '/pages-teacher/chat/list'
		}
	},
	onShareTimeline() {
		return {
			title: '优培信息通 · 教师家长沟通'
		}
	},
	methods: {
		bindChatPush() {
			if (this._onChatPush) return
			this._onChatPush = (payload) => {
				console.log('[teacher-chat-list] 收到 push，刷新列表', payload)
				this.refreshConversationsSilently()
			}
			onChatPush(this._onChatPush)
		},
		unbindChatPush() {
			if (!this._onChatPush) return
			offChatPush(this._onChatPush)
			this._onChatPush = null
		},
		startPolling() {
			this.stopPolling()
			if (!CHAT_POLL_ENABLED || this.useMock) return
			this.pollTimer = setInterval(() => {
				if (this.loading || this.silentPolling) return
				this.refreshConversationsSilently()
			}, this.pollInterval)
		},
		stopPolling() {
			if (this.pollTimer) {
				clearInterval(this.pollTimer)
				this.pollTimer = null
			}
		},
		async refreshConversationsSilently() {
			if (this.loading || this.silentPolling || this.useMock) return
			this.silentPolling = true
			try {
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const res = await chatSend.pollUpdates({ mode: 'list' })
				if (res.code !== 0 || !res.data) return

				const listMap = new Map()
				this.list.forEach(item => listMap.set(item.conversation_id, item))
				let hasUnknownConversation = false
				;(res.data.list || []).forEach(item => {
					let lastMessage = ''
					if (item.last_message) {
						if (typeof item.last_message === 'object') {
							lastMessage = item.last_message.content || item.last_message.text || ''
						} else {
							lastMessage = item.last_message
						}
					}
					lastMessage = this.formatLastMessage(lastMessage)
					const prev = listMap.get(item._id)
					if (!prev) hasUnknownConversation = true
					listMap.set(item._id, {
						...(prev || {}),
						conversation_id: item._id,
						appointment_id: item.appointment_id,
						name: (prev && prev.name) || '家长',
						avatar: (prev && prev.avatar) || this.defaultAvatarUrl,
						last_message: lastMessage,
						last_message_time: item.last_message_time || item.update_time || Date.now(),
						unread_count: Number(item.unread_count ?? item.unread_count_teacher ?? 0),
						status: item.status
					})
				})
				this.list = Array.from(listMap.values()).sort((a, b) =>
					(b.last_message_time || 0) - (a.last_message_time || 0)
				)
				this.updateStats()
				this.filterList()
				if (hasUnknownConversation) {
					this.finished = false
					this.$nextTick(() => this.loadConversations())
				}
			} catch (e) {
				console.error('[teacher-chat-list] 静默刷新失败:', e)
			} finally {
				this.silentPolling = false
			}
		},
		async refreshData() {
			console.log('[teacher-chat-list] 下拉刷新：重新加载会话列表')
			await this.loadConversations(true)
		},
		resetAndLoad() {
			this.page = 1
			this.finished = false
			this.list = []
			this.displayList = []
			this.loadConversations()
		},
		async loadConversations() {
			if (this.loading || this.finished) return
			this.loading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const mockData = mockConversations.map(item => {
						let lastMessage = ''
						if (item.last_message) {
							if (typeof item.last_message === 'object') {
								lastMessage = item.last_message.content || item.last_message.text || JSON.stringify(item.last_message)
							} else {
								lastMessage = item.last_message
							}
						}
						lastMessage = this.formatLastMessage(lastMessage)
						return {
							...item,
							last_message: lastMessage,
							unread_count: item.unread_count_teacher || item.unread_count || 0
						}
					})
					this.list = mockData
					this.finished = true
					this.updateStats()
					this.filterList()
					return
				}

				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const res = await chatSend.getConversationList()
				if (res.code === 0) {
				const fetched = (res.data?.list || []).map(item => {
					let lastMessage = ''
					if (item.last_message) {
						if (typeof item.last_message === 'object') {
							lastMessage = item.last_message.content || item.last_message.text || ''
						} else {
							lastMessage = item.last_message
						}
					}
					lastMessage = this.formatLastMessage(lastMessage)
					return {
						conversation_id: item._id,
						appointment_id: item.appointment_id,
						name: item.other_user?.nickname || item.other_user?.display_name || '家长',
						avatar: item.other_user?.avatar || defaultAvatarUrl,
						last_message: lastMessage,
						last_message_time: item.last_message_time || item.update_time || Date.now(),
						unread_count: Number(item.unread_count_teacher ?? item.unread_count_parent ?? 0),
						tag: this.resolveTag(item)
					}
				})
					this.list = fetched
					this.finished = true
					this.updateStats()
					this.filterList()
				} else {
					uni.showToast({ title: res.message || '加载会话失败', icon: 'none' })
				}
			} catch (error) {
				console.error('加载会话列表失败:', error)
				uni.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		loadMore() {
			if (!this.finished) {
				this.loadConversations()
			}
		},
		updateStats() {
			const total = this.list.length
			const unreadConversations = this.list.filter(item => item.unread_count > 0).length
			const unreadMessages = this.list.reduce((sum, item) => sum + Number(item.unread_count || 0), 0)
			this.stats = { total, unreadConversations, unreadMessages }
		},
		filterList() {
			let filtered = [...this.list]

			if (this.searchKeyword) {
				const keyword = this.searchKeyword.trim().toLowerCase()
				filtered = filtered.filter(item => {
					const displayMessage = this.formatLastMessage(item.last_message)
					return item.name.toLowerCase().includes(keyword) ||
						(displayMessage && displayMessage.toLowerCase().includes(keyword))
				})
			}

			this.displayList = filtered
		},
		clearSearch() {
			this.searchKeyword = ''
		},
		formatTime(timestamp) {
			if (!timestamp) return ''
			const date = new Date(timestamp)
			const now = new Date()
			const diff = now - date
			if (diff < 60000) return '刚刚'
			if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
			if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${month}-${day} ${hour}:${minute}`
		},
		resolveTag(item) {
			if (item.deposit_paid === false) {
				return '待支付'
			}
			if (item.status === 'pending_confirm') {
				return '待确认'
			}
			if (item.status === 'completed') {
				return '已完成'
			}
			return ''
		},
		/**
		 * 格式化最后一条消息显示
		 * 如果是试课邀请的JSON消息，显示为"邀请试课"
		 * @param {String|Object} message - 消息内容
		 * @returns {String} 格式化后的消息文本
		 */
		formatLastMessage(message) {
			if (!message) return ''
			
			// 如果是对象，提取content
			if (typeof message === 'object') {
				message = message.content || message.text || JSON.stringify(message)
			}
			
			// 确保是字符串类型
			if (typeof message !== 'string') {
				message = String(message)
			}
			
			const trimmed = message.trim()
			
			// 检查是否为试课邀请消息（包括完整的和被截断的JSON）
			// 只要包含 trial_invite 且看起来像JSON格式，就识别为试课邀请
			if (trimmed.includes('trial_invite') && (trimmed.startsWith('{') || trimmed.includes('"type"') || trimmed.includes('type'))) {
				return '邀请试课'
			}
			if (trimmed.includes('attendance_clock')) {
				if (trimmed.includes('clock_out')) return '已下课打卡'
				return '已上课打卡'
			}
			
			return message
		},
		goToConversation(item) {
			uni.navigateTo({
				url: `/pages-teacher/chat/conversation?conversationId=${item.conversation_id}`
			})
		}
	}
}
</script>

<style scoped>
.chat-list-page {
	background: #EDEDED;
	min-height: 100vh;
}

/* 导航栏 */
.navbar {
	background: #FFFFFF;
	padding-top: var(--status-bar-height, 0);
}

.navbar-content {
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
}

.navbar-title {
	font-size: 36rpx;
	font-weight: 600;
	color: #000000;
}

/* 搜索框 */
.search-box {
	background: #FFFFFF;
	padding: 20rpx 30rpx;
}

.search-input-wrapper {
	background: #F7F7F7;
	border-radius: 10rpx;
	display: flex;
	align-items: center;
	padding: 0 30rpx;
	height: 72rpx;
}

.search-icon {
	font-size: 32rpx;
	color: #999999;
	margin-right: 20rpx;
}

.search-input {
	flex: 1;
	font-size: 28rpx;
	color: #333333;
}

.search-placeholder {
	color: #999999;
}

.clear-icon {
	font-size: 28rpx;
	color: #999999;
	margin-left: 20rpx;
}

/* 列表区域 */
.list-scroll {
	flex: 1;
	height: calc(100vh - 200rpx);
}

/* 会话项 */
.conversation-item {
	background: #FFFFFF;
	display: flex;
	align-items: center;
	padding: 24rpx 30rpx;
	border-bottom: 1rpx solid #EDEDED;
	position: relative;
}

.conversation-item:active {
	background: #F5F5F5;
}

.avatar {
	width: 96rpx;
	height: 96rpx;
	border-radius: 8rpx;
	margin-right: 24rpx;
	flex-shrink: 0;
}

.content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12rpx;
	min-height: 44rpx;
	max-height: 44rpx;
	flex-shrink: 0;
}

.name {
	font-size: 32rpx;
	font-weight: 500;
	color: #000000;
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.time {
	font-size: 24rpx;
	color: #999999;
	margin-left: 20rpx;
	flex-shrink: 0;
}

.footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 40rpx;
	max-height: 40rpx;
}

.message {
	font-size: 28rpx;
	color: #999999;
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	line-height: 40rpx;
	max-height: 40rpx;
}

.message.unread {
	color: #000000;
	font-weight: 500;
}

.badge {
	background: #FA5151;
	color: #FFFFFF;
	font-size: 20rpx;
	min-width: 32rpx;
	height: 32rpx;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 12rpx;
	margin-left: 16rpx;
	flex-shrink: 0;
}

/* 加载状态 */
.loading-wrapper {
	padding: 20rpx 0;
}

.skeleton {
	background: #FFFFFF;
}

.avatar-skeleton {
	width: 96rpx;
	height: 96rpx;
	border-radius: 8rpx;
	background: #F0F0F0;
	margin-right: 24rpx;
}

.content-skeleton {
	flex: 1;
}

.name-skeleton {
	width: 200rpx;
	height: 32rpx;
	background: #F0F0F0;
	border-radius: 4rpx;
	margin-bottom: 12rpx;
}

.message-skeleton {
	width: 300rpx;
	height: 28rpx;
	background: #F0F0F0;
	border-radius: 4rpx;
}

/* 空状态 */
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 200rpx 0;
}

.empty-icon {
	margin-bottom: 40rpx;
}

/* CSS图标样式 */
.icon-search {
	width: 40rpx;
	height: 40rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-search::before {
	content: '';
	position: absolute;
	top: 4rpx;
	left: 4rpx;
	width: 16rpx;
	height: 16rpx;
	border: 2rpx solid currentColor;
	border-radius: 50%;
	background: transparent;
}
.icon-search::after {
	content: '';
	position: absolute;
	bottom: 4rpx;
	right: 4rpx;
	width: 12rpx;
	height: 2rpx;
	background: currentColor;
	transform: rotate(45deg);
	transform-origin: left center;
}

.icon-close {
	width: 40rpx;
	height: 40rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-close::before,
.icon-close::after {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	width: 24rpx;
	height: 2rpx;
	background: currentColor;
}
.icon-close::before {
	transform: translate(-50%, -50%) rotate(45deg);
}
.icon-close::after {
	transform: translate(-50%, -50%) rotate(-45deg);
}

.icon-chat {
	width: 120rpx;
	height: 120rpx;
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
	width: 84rpx;
	height: 60rpx;
	border: 4rpx solid currentColor;
	border-radius: 12rpx 12rpx 12rpx 0;
	background: transparent;
}
.icon-chat::after {
	content: '';
	position: absolute;
	bottom: 8rpx;
	left: 12rpx;
	width: 8rpx;
	height: 8rpx;
	background: currentColor;
	border-radius: 50%;
	box-shadow: 12rpx 0 0 currentColor, 24rpx 0 0 currentColor;
}

.empty-text {
	font-size: 32rpx;
	color: #999999;
	margin-bottom: 16rpx;
}

.empty-hint {
	font-size: 28rpx;
	color: #CCCCCC;
}

.loading-more {
	text-align: center;
	padding: 40rpx 0;
	font-size: 28rpx;
	color: #999999;
}

.tabbar-spacer {
	height: 140rpx;
}
</style>