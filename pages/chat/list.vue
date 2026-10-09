<template>
	<view class="chat-list-page">
		<view class="search-box">
			<view class="search-input-wrapper">
				<text class="iconfont icon-sousuo search-icon"></text>
				<input
					class="search-input"
					v-model="searchKeyword"
					placeholder="搜索"
					placeholder-class="search-placeholder"
					confirm-type="search"
				/>
				<text v-if="searchKeyword" class="iconfont icon-guanbi clear-icon" @click="clearSearch"></text>
			</view>
		</view>

		<!-- 会话列表 -->
		<scroll-view
			scroll-y
			@scrolltolower="loadMore"
			class="list-scroll"
		>
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
							<view class="message-wrap">
								<text class="message" :class="{ unread: item.unread_count > 0 }">{{ formatLastMessage(item.last_message) || '暂无消息' }}</text>
							</view>
							<view v-if="item.unread_count > 0" class="badge">
								{{ item.unread_count > 99 ? '99+' : item.unread_count }}
							</view>
						</view>
					</view>
				</view>

				<view v-if="!loading && !displayList.length" class="empty-state">
					<view class="empty-mark"></view>
					<text class="empty-text">暂无会话</text>
					<text class="empty-hint">预约老师后即可开启沟通</text>
				</view>

				<view v-if="loading && displayList.length" class="loading-more">加载中...</view>
				<view v-else-if="finished && displayList.length" class="loading-more">没有更多了</view>
			</view>
		</scroll-view>

		<view class="tabbar-spacer"></view>
		<ParentTabBar current="chat" />
	</view>
</template>

<script>
import { mockConversations, useMockData } from '@/utils/mockData.js'
import ParentTabBar from '@/components/ParentTabBar.vue'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { CHAT_POLL_ENABLED, CHAT_POLL_INTERVAL } from '@/utils/chatPoll.js'
import { onChatPush, offChatPush } from '@/utils/chatPush.js'

export default {
	name: 'ChatList',
	mixins: [pullRefreshMixin],
	components: {
		ParentTabBar
	},
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
			refresherTriggered: false,
			useMock: false,
			scrollTop: 0,
			canRefresh: true,
			// 会话列表轮询定时器（push 为主，长间隔兜底）
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
		// 延迟加载数据，避免阻塞页面渲染
		this.$nextTick(() => {
			setTimeout(() => {
				this.resetAndLoad()
			}, 50)
		})
	},
	onShareAppMessage() {
		return {
			title: '优培信息通 · 老师沟通',
			path: '/pages/chat/list'
		}
	},
	onShareTimeline() {
		return {
			title: '优培信息通 · 老师沟通'
		}
	},
	onShow() {
		if (!this.useMock) {
			// 先绑定 push，再拉列表，避免短窗口内收不到推送
			this.bindChatPush()
			this.startPolling()
			this.$nextTick(() => {
				this.resetAndLoad()
			})
		}
	},
	onHide() {
		// 页面隐藏时停止轮询
		this.stopPolling()
		this.unbindChatPush()
	},
	onUnload() {
		// 页面卸载时清理定时器
		this.stopPolling()
		this.unbindChatPush()
	},
	methods: {
		bindChatPush() {
			if (this._onChatPush) {
				console.log('[parent-chat-list] push 已绑定，跳过')
				return
			}
			this._onChatPush = (payload) => {
				console.log('[parent-chat-list] 收到 push，刷新列表', payload)
				this.refreshConversationsSilently()
			}
			onChatPush(this._onChatPush)
			console.log('[parent-chat-list] 已订阅 chat:push')
		},
		unbindChatPush() {
			if (!this._onChatPush) return
			offChatPush(this._onChatPush)
			this._onChatPush = null
			console.log('[parent-chat-list] 已取消订阅 chat:push')
		},
		/**
		 * 启动会话列表轮询
		 */
		startPolling() {
			// 如果已有定时器，先清除
			this.stopPolling()
			if (!CHAT_POLL_ENABLED) return
			// 只在非mock模式时轮询
			if (!this.useMock) {
				this.pollTimer = setInterval(() => {
					// 如果正在加载，跳过本次轮询
					if (this.loading) {
						return
					}
					// 静默刷新会话列表
					this.refreshConversationsSilently()
				}, this.pollInterval)
			}
		},
		/**
		 * 停止会话列表轮询
		 */
		stopPolling() {
			if (this.pollTimer) {
				clearInterval(this.pollTimer)
				this.pollTimer = null
			}
		},
		async refreshData() {
			console.log('[chat-list] 下拉刷新：重新加载会话列表')
			await this.loadConversations(true)
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
			this.resetAndLoad()
		},
		resetAndLoad() {
			this.page = 1
			this.finished = false
			this.list = []
			this.displayList = []
			this.loadConversations()
		},
		/**
		 * 静默刷新会话列表（用于轮询）
		 */
		async refreshConversationsSilently() {
			if (this.loading || this.silentPolling || this.useMock) return
			this.silentPolling = true
			try {
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				// 轻量摘要：不做对方资料联表，显著降低轮询成本
				const res = await chatSend.pollUpdates({ mode: 'list' })
				if (res.code === 0 && res.data) {
					const listMap = new Map()
					this.list.forEach(item => {
						listMap.set(item.conversation_id, item)
					})
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
							name: (prev && prev.name) || '老师',
							avatar: (prev && prev.avatar) || this.defaultAvatarUrl,
							last_message: lastMessage,
							last_message_time: item.last_message_time || item.update_time || Date.now(),
							unread_count: Number(item.unread_count ?? item.unread_count_parent ?? 0),
							status: item.status,
							deposit_paid: item.deposit_paid,
							tag: (prev && prev.tag) || ''
						})
					})
					this.list = Array.from(listMap.values()).sort((a, b) =>
						(b.last_message_time || 0) - (a.last_message_time || 0)
					)
					this.updateStats()
					this.filterList()
					// 出现全新会话时补一次完整列表，补齐头像昵称
					if (hasUnknownConversation) {
						this.finished = false
						this.$nextTick(() => this.loadConversations())
					}
				}
			} catch (error) {
				console.error('静默刷新会话列表失败:', error)
			} finally {
				this.silentPolling = false
			}
		},
		async loadConversations() {
			if (this.loading || this.finished) {
				if (this.refresherTriggered) this.refresherTriggered = false
				return
			}
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
							conversation_id: item.conversation_id,
							appointment_id: item.appointment_id,
							name: item.teacher_name || '老师',
							avatar: item.avatar || this.defaultAvatarUrl,
							last_message: lastMessage,
							last_message_time: item.last_message_time || Date.now(),
							unread_count: item.unread_count_parent || item.unread_count || 0,
							tag: item.tag || ''
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
							lastMessage = item.last_message.content || item.last_message.text || JSON.stringify(item.last_message)
						} else {
							lastMessage = item.last_message
						}
					}
					lastMessage = this.formatLastMessage(lastMessage)
					return {
						conversation_id: item._id,
						appointment_id: item.appointment_id,
						name: this.resolveName(item, '老师'),
						avatar: this.resolveAvatar(item),
						last_message: lastMessage,
						last_message_time: item.last_message_time || item.update_time || Date.now(),
						unread_count: Number(item.unread_count_parent ?? 0),
						status: item.status,
						deposit_paid: item.deposit_paid,
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
				if (this.refresherTriggered) {
					this.refresherTriggered = false
				}
			}
		},
		loadMore() {
			if (!this.finished) {
				this.loadConversations()
			}
		},
		updateStats() {
			const list = this.list || []
			const total = list.length
			const unreadConversations = list.filter(item => (item.unread_count || 0) > 0).length
			const unreadMessages = list.reduce((sum, item) => sum + Number(item.unread_count || 0), 0)
			this.stats = { 
				total: total || 0, 
				unreadConversations: unreadConversations || 0, 
				unreadMessages: unreadMessages || 0 
			}
			console.log('[chat-list] 统计数据更新:', this.stats)
		},
		filterList() {
			let filtered = [...this.list]

			if (this.searchKeyword) {
				const keyword = this.searchKeyword.trim().toLowerCase()
				filtered = filtered.filter(item => {
					const displayMessage = this.formatLastMessage(item.last_message)
					return (item.name && item.name.toLowerCase().includes(keyword)) ||
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
			const status = item.status || item.appointment_status
			if (status === 'pending_confirm') return '待老师确认'
			if (status === 'pending_payment') return '待支付'
			if (status === 'confirmed') return '已确认'
			if (status === 'completed') return '已完成'
			return ''
		},
		resolveName(item, defaultName = '老师') {
			const other = item.other_user || {}
			const teacher = item.teacher_info || {}
			return other.display_name
				|| other.nickname
				|| teacher.display_name
				|| defaultName
		},
		resolveAvatar(item) {
			const other = item.other_user || {}
			const teacher = item.teacher_info || {}
			const avatars = [
				other.avatar,
				teacher.avatar,
				item.last_teacher_avatar,
				item.last_parent_avatar
			]
			const avatar = avatars.find(src => src && src !== this.defaultAvatarUrl)
			return avatar || this.defaultAvatarUrl
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
				if (trimmed.includes('clock_out')) return '老师已下课打卡'
				return '老师已上课打卡'
			}
			if (trimmed.includes('review_result')) {
				if (trimmed.includes('is_auto') && trimmed.includes('true')) return '系统默认好评'
				return '家长已评价'
			}
			
			return message.replace(/\s+/g, ' ').trim()
		},
		goToConversation(item) {
			const params = [`conversationId=${item.conversation_id}`]
			if (item.appointment_id) {
				params.push(`appointmentId=${item.appointment_id}`)
			}
			uni.navigateTo({
				url: `/pages-biz/chat/conversation?${params.join('&')}`
			})
		}
	}
}
</script>

<style scoped>
.chat-list-page {
	background: #F4F6F9;
	min-height: 100vh;
}

.search-box {
	padding: 16rpx 32rpx 8rpx;
}

.search-input-wrapper {
	background: #FFFFFF;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	padding: 0 24rpx;
	height: 72rpx;
}

.search-icon {
	font-size: 28rpx;
	color: #8B919C;
	margin-right: 12rpx;
}

.search-input {
	flex: 1;
	font-size: 28rpx;
	color: #1F2329;
}

.search-placeholder {
	color: #8B919C;
}

.clear-icon {
	font-size: 28rpx;
	color: #8B919C;
	margin-left: 16rpx;
}

.list-scroll {
	flex: 1;
	height: calc(100vh - 96rpx);
	margin-top: 8rpx;
	background: #FFFFFF;
}

.conversation-item {
	background: #FFFFFF;
	display: flex;
	align-items: center;
	height: 144rpx;
	padding: 0 32rpx;
	border-bottom: 1rpx solid #F2F3F5;
	box-sizing: border-box;
	overflow: hidden;
}

.conversation-item:active {
	background: #F4F6F9;
}

.avatar {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	margin-right: 24rpx;
	flex-shrink: 0;
	background: #EEF3FF;
}

.content {
	flex: 1;
	min-width: 0;
	height: 88rpx;
	display: flex;
	flex-direction: column;
	justify-content: center;
	overflow: hidden;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 44rpx;
	margin-bottom: 4rpx;
	overflow: hidden;
}

.name {
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.time {
	font-size: 22rpx;
	color: #8B919C;
	margin-left: 16rpx;
	flex-shrink: 0;
}

.footer {
	display: flex;
	align-items: center;
	height: 40rpx;
	overflow: hidden;
}

.message-wrap {
	flex: 1;
	min-width: 0;
	overflow: hidden;
}

.message {
	display: block;
	width: 100%;
	font-size: 26rpx;
	color: #8B919C;
	line-height: 40rpx;
	height: 40rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.message.unread {
	color: #5C6370;
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
	padding: 0 8rpx;
	margin-left: 16rpx;
	flex-shrink: 0;
}

.loading-wrapper {
	background: #FFFFFF;
}

.skeleton {
	background: #FFFFFF;
}

.avatar-skeleton {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	background: #EBEDF0;
	margin-right: 24rpx;
}

.content-skeleton {
	flex: 1;
}

.name-skeleton {
	width: 200rpx;
	height: 32rpx;
	background: #EBEDF0;
	border-radius: 8rpx;
	margin-bottom: 16rpx;
}

.message-skeleton {
	width: 300rpx;
	height: 24rpx;
	background: #EBEDF0;
	border-radius: 8rpx;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 160rpx 32rpx;
	background: #FFFFFF;
}

.empty-mark {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	background: #EEF3FF;
	margin-bottom: 28rpx;
}

.empty-text {
	font-size: 30rpx;
	color: #5C6370;
	margin-bottom: 8rpx;
}

.empty-hint {
	font-size: 24rpx;
	color: #8B919C;
}

.loading-more {
	text-align: center;
	padding: 32rpx 0;
	font-size: 24rpx;
	color: #8B919C;
	background: #FFFFFF;
}

.tabbar-spacer {
	height: 140rpx;
}
</style>