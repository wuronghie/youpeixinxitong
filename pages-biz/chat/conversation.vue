<template>
	<view class="conversation-page">
		<scroll-view
			class="message-scroll"
			scroll-y
			:scroll-into-view="scrollIntoView"
			@scroll="handleScroll"
		>
			<view class="message-container">
				<view v-if="pagination.hasMore && !loadingMore" class="load-more-tip" @click="loadHistory">
					查看更多消息
				</view>
				<view v-else-if="loadingMore" class="load-more-tip">加载中...</view>

				<view v-for="item in formattedMessages" :key="item.id" :id="item.id" class="message-wrapper">
					<view v-if="item.type === 'time'" class="time-divider">
						{{ item.label }}
					</view>
					<view v-else-if="isTrialInviteMessage(item.data)" class="message-item message-center">
						<view class="trial-invite-card">
							<text class="trial-invite-title">试课邀请</text>
							<text class="trial-invite-desc">老师邀请您预约试课，填写信息并支付试课费。</text>
							<view v-if="canRespondTrialInvite(item.data)" class="trial-invite-actions">
								<view class="trial-invite-btn trial-invite-btn-accept" @click="handleAcceptInvite(item.data)">
									<text class="trial-invite-btn-text">通过</text>
								</view>
								<view class="trial-invite-btn trial-invite-btn-reject" @click="handleRejectInvite(item.data)">
									<text class="trial-invite-btn-text trial-invite-btn-reject-text">不通过</text>
								</view>
							</view>
							<view v-else class="trial-invite-status">
								<text class="trial-invite-status-text">{{ getTrialInviteStatusText(item.data) }}</text>
							</view>
						</view>
					</view>
					<view v-else-if="isAttendanceClockMessage(item.data)" class="message-item message-center">
						<view class="attendance-clock-card" @click="goAttendanceAppointment(item.data)">
							<text class="attendance-clock-title">{{ getAttendanceClockTitle(item.data) }}</text>
							<view class="attendance-clock-row">
								<text class="attendance-clock-label">时间</text>
								<text class="attendance-clock-value">{{ getAttendanceClockTime(item.data) }}</text>
							</view>
							<view v-if="getAttendanceClockAddress(item.data)" class="attendance-clock-row">
								<text class="attendance-clock-label">地点</text>
								<text class="attendance-clock-value">{{ getAttendanceClockAddress(item.data) }}</text>
							</view>
							<text class="attendance-clock-tip">{{ getAttendanceClockTip(item.data) }}</text>
						</view>
					</view>
					<view v-else-if="isReviewResultMessage(item.data)" class="message-item message-center">
						<view class="attendance-clock-card" @click="goReviewAppointment(item.data)">
							<text class="attendance-clock-title">{{ getReviewResultTitle(item.data) }}</text>
							<text class="review-stars">{{ getReviewStars(item.data) }}</text>
							<view v-if="getReviewResultLine(item.data)" class="attendance-clock-row">
								<text class="attendance-clock-label">结果</text>
								<text class="attendance-clock-value">{{ getReviewResultLine(item.data) }}</text>
							</view>
							<view v-if="getReviewTags(item.data)" class="attendance-clock-row">
								<text class="attendance-clock-label">标签</text>
								<text class="attendance-clock-value">{{ getReviewTags(item.data) }}</text>
							</view>
							<view v-if="getReviewContent(item.data)" class="attendance-clock-row">
								<text class="attendance-clock-label">评价</text>
								<text class="attendance-clock-value">{{ getReviewContent(item.data) }}</text>
							</view>
							<text class="attendance-clock-tip">{{ getReviewResultTip(item.data) }}</text>
						</view>
					</view>
					<view v-else class="message-item" :class="{ 'message-right': item.data.sender_role === currentUserRole }">
						<template v-if="item.data.sender_role !== currentUserRole">
							<image
								class="message-avatar"
								:src="otherAvatar"
								mode="aspectFill"
							/>
							<view class="message-content-wrapper">
								<view class="message-bubble bubble-left">
									<text class="message-text">{{ item.data.content }}</text>
								</view>
							</view>
						</template>
						<template v-else>
							<view class="message-content-wrapper">
								<view class="message-bubble bubble-right">
									<text class="message-text">{{ item.data.content }}</text>
								</view>
							</view>
							<image
								class="message-avatar"
								:src="currentUserInfo.avatar || defaultAvatarUrl"
								mode="aspectFill"
							/>
						</template>
					</view>
				</view>

				<view v-if="!formattedMessages.length && !loading" class="empty-message">
					<text class="empty-text">暂无消息，先和老师打个招呼吧</text>
				</view>
			</view>
		</scroll-view>

		<view class="input-bar">
			<view v-if="needPayTrialFee" class="pay-tip">
				<text class="pay-tip-text">试课邀请待支付</text>
				<view class="pay-tip-btn" @click="goPayTrialFee">
					<text class="pay-tip-btn-text">去支付</text>
				</view>
			</view>
			<view v-if="needWaitForTeacherReply" class="wait-tip">
				<text class="wait-tip-text">请等待老师回复后再继续发送消息</text>
			</view>
			<view class="input-wrapper">
				<view class="input-box">
					<textarea
						v-model="inputText"
						class="input-textarea"
						auto-height
						:show-confirm-bar="false"
						:cursor-spacing="24"
						confirm-type="send"
						:maxlength="300"
						:placeholder="needWaitForTeacherReply ? '请等待老师回复...' : '发送消息（300字内）'"
						@confirm="sendMessage"
						:disabled="sending || needWaitForTeacherReply"
						placeholder-class="input-placeholder"
					/>
				</view>
				<view
					class="send-btn"
					:class="{ 'send-btn-active': canSendMessage }"
					@click="sendMessage"
				>
					<text class="send-btn-text">{{ sending ? '发送中' : '发送' }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { mockMessages, useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { saveAppointmentTeacherPreview } from '../utils/appointmentTeacherPreview.js'
import { CHAT_POLL_ENABLED, CHAT_POLL_INTERVAL } from '@/utils/chatPoll.js'
import { onChatPush, offChatPush, refreshChatBadge, onAppPush, offAppPush, APP_PUSH_TYPES } from '@/utils/chatPush.js'

export default {
	name: 'ChatConversation',
	mixins: [pullRefreshMixin],
		data() {
		return {
			defaultAvatarUrl: getDefaultAvatarUrl(),
			conversationId: '',
			appointmentId: '',
			messages: [],
			inputText: '',
			useMock: false,
			loading: false,
			sending: false,
			loadingMore: false,
			refreshTipTimer: null,
			refresherTriggered: false,
			showRefreshTip: false,
			refreshTipText: '松开刷新消息',
			scrollIntoView: '',
			scrollTop: 0,
			canRefresh: true,
			currentUserRole: 'parent',
			// 消息轮询定时器（push 为主，长间隔兜底）
			pollTimer: null,
			pollInterval: CHAT_POLL_INTERVAL.conversation,
			currentUserInfo: {},
			otherUserInfo: {
				nickname: '',
				display_name: '',
				avatar: getDefaultAvatarUrl(),
				title: '',
				subjects: []
			},
			conversationInfo: {},
			trialInviteStatusMap: {},
			rejectingInviteIds: {},
			pagination: {
				page: 1,
				pageSize: 30,
				hasMore: true
			},
			isInitialized: false, // 标记是否已初始化完成
			initPromise: null // 保存初始化 Promise
		}
	},
	computed: {
		formattedMessages() {
			const result = []
			let lastLabel = ''
			this.messages.forEach((msg, index) => {
				const label = this.getDateLabel(msg.send_time)
				if (label !== lastLabel) {
					lastLabel = label
					result.push({ id: `time-${msg.message_id || index}`, type: 'time', label })
				}
				result.push({ id: `msg-${index}`, type: 'message', data: msg })
			})
			return result
		},
		needWaitForTeacherReply() {
			if (this.currentUserRole !== 'parent') {
				return false
			}
			const appointmentStatus = this.conversationInfo?.appointment?.status || 
								this.conversationInfo?.appointment_status || 
								this.conversationInfo?.status
			if (appointmentStatus !== 'contact_request') {
				return false
			}
			const hasTeacherMessage = this.messages.some(msg => msg.sender_role === 'teacher')
			const hasParentMessage = this.messages.some(msg => msg.sender_role === 'parent')
			return hasParentMessage && !hasTeacherMessage
		},
		pendingPaymentInviteId() {
			const entries = Object.entries(this.trialInviteStatusMap || {})
			const hit = entries.find(([, item]) => item && item.status === 'pending_payment')
			return hit ? hit[0] : ''
		},
		needPayTrialFee() {
			return this.currentUserRole === 'parent' && !!this.pendingPaymentInviteId
		},
		canSendMessage() {
			if (this.sending) return false
			if (!this.conversationId) return false
			if (!this.inputText.trim()) return false
			if (this.needWaitForTeacherReply) return false
			return true
		},
		otherDisplayName() {
			return (
				this.otherUserInfo.display_name ||
				this.otherUserInfo.nickname ||
				this.conversationInfo.teacher_info?.display_name ||
				'老师'
			)
		},
		otherAvatar() {
			return (
				this.otherUserInfo.avatar ||
				this.conversationInfo.teacher_info?.avatar ||
				this.defaultAvatarUrl
			)
		}
	},
	watch: {
		otherDisplayName: {
			immediate: true,
			handler(val) {
				uni.setNavigationBarTitle({ title: val || '聊天' })
			}
		}
	},
	onLoad(options) {
		this.conversationId = options.conversationId || options.conversation_id || options.id || ''
		this.appointmentId = options.appointmentId || options.appointment_id || ''
		this.useMock = useMockData() === true

		const userInfo = uni.getStorageSync('userInfo')
		if (userInfo) {
			this.currentUserRole = userInfo.role || 'parent'
			this.currentUserInfo = {
				nickname: userInfo.nickname || '我',
				avatar: userInfo.avatar || this.defaultAvatarUrl
			}
		}

		// 立刻启动初始化，保证 onShow 能 await 到 initPromise（否则会永远不绑定 push）
		this.initConversation()
	},
	async onShow() {
		if (!this.isInitialized && !this.initPromise) {
			this.initConversation()
		}
		if (this.initPromise) {
			await this.initPromise
		}
		if (this.isInitialized && this.conversationId && !this.useMock) {
			console.log('[parent-chat] onShow 就绪，绑定 push，conversationId=', this.conversationId)
			this.loadNewMessages()
			this.loadTrialInviteStatuses()
			this.startPolling()
			this.bindChatPush()
		} else {
			console.warn('[parent-chat] onShow 未绑定 push', {
				isInitialized: this.isInitialized,
				conversationId: this.conversationId,
				useMock: this.useMock
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
		if (this.refreshTipTimer) {
			clearTimeout(this.refreshTipTimer)
			this.refreshTipTimer = null
		}
	},
		methods: {
		bindChatPush() {
			if (this._onChatPush) {
				console.log('[parent-chat] push 已绑定，跳过')
				return
			}
			this._onChatPush = (payload) => {
				console.log('[parent-chat] 收到 push，准备拉增量', payload, '当前会话=', this.conversationId)
				if (!this.conversationId) return
				if (payload && payload.conversation_id && payload.conversation_id !== this.conversationId) {
					console.log('[parent-chat] 非本会话 push，忽略')
					return
				}
				this.loadNewMessages()
				this.loadTrialInviteStatuses()
			}
			onChatPush(this._onChatPush)
			this._onAppointmentPush = () => {
				this.loadTrialInviteStatuses()
			}
			onAppPush(APP_PUSH_TYPES.APPOINTMENT_UPDATE, this._onAppointmentPush)
			console.log('[parent-chat] 已订阅 chat:push')
		},
		unbindChatPush() {
			if (!this._onChatPush) return
			offChatPush(this._onChatPush)
			this._onChatPush = null
			if (this._onAppointmentPush) {
				offAppPush(this._onAppointmentPush)
				this._onAppointmentPush = null
			}
			console.log('[parent-chat] 已取消订阅 chat:push')
		},
		/**
		 * 启动消息轮询
		 */
		startPolling() {
			// 如果已有定时器，先清除
			this.stopPolling()
			if (!CHAT_POLL_ENABLED) return
			// 只在非mock模式且有会话ID时轮询
			if (!this.useMock && this.conversationId) {
				this.pollTimer = setInterval(() => {
					// 如果正在加载或发送消息，跳过本次轮询
					if (this.loading || this.sending) {
						return
					}
					this.loadNewMessages()
					this.loadTrialInviteStatuses()
				}, this.pollInterval)
			}
		},
		/**
		 * 停止消息轮询
		 */
		stopPolling() {
			if (this.pollTimer) {
				clearInterval(this.pollTimer)
				this.pollTimer = null
			}
		},
		async refreshData() {
			console.log('[chat-conversation] 下拉刷新：重新加载消息')
			await this.refreshMessages()
		},
		async initConversation() {
			if (this.initPromise) return this.initPromise
			this.initPromise = (async () => {
				try {
					if (this.appointmentId && !this.conversationId && !this.useMock) {
						try {
							const chatSend = uniCloud.importObject('chat-send', { customUI: true })
							const res = await chatSend.getConversation({ appointment_id: this.appointmentId })
							if (res.code === 0) {
								this.conversationId = res.data.conversation_id
								this.conversationInfo = res.data
								await this.loadUserInfo()
								await this.refreshMessages()
							} else {
								uni.showToast({ title: res.message || '获取会话失败', icon: 'none' })
							}
						} catch (error) {
							console.error('获取会话失败:', error)
							uni.showToast({ title: '获取会话失败', icon: 'none' })
						}
					} else {
						await this.loadUserInfo()
						await this.refreshMessages()
					}
				} finally {
					this.isInitialized = true
				}
			})()
			try {
				await this.initPromise
			} finally {
				this.initPromise = null
			}
			return true
		},
		async loadUserInfo() {
			try {
				if (this.useMock) {
					this.otherUserInfo = { nickname: '老师', avatar: this.defaultAvatarUrl }
					return
				}
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const params = {}
				if (this.conversationId) params.conversation_id = this.conversationId
				if (this.appointmentId) params.appointment_id = this.appointmentId
				if (!params.conversation_id && !params.appointment_id) return
				const res = await chatSend.getConversationWithUserInfo(params)
				if (res.code === 0) {
					this.conversationInfo = res.data
					if (res.data.teacher_id) {
						this.conversationInfo.teacher_id = res.data.teacher_id
					}
					if (res.data.current_user) {
						this.currentUserInfo = {
							nickname: res.data.current_user.nickname || '我',
							avatar: res.data.current_user.avatar || '/static/default-avatar.png'
						}
						if (res.data.current_user.role) {
							this.currentUserRole = res.data.current_user.role
						}
					}
					if (res.data.other_user) {
						this.otherUserInfo = {
							nickname: res.data.other_user.nickname || '',
							display_name: res.data.other_user.display_name || '',
							avatar: res.data.other_user.avatar || '/static/default-avatar.png',
							title: res.data.other_user.title || '',
							subjects: res.data.other_user.subjects || []
						}
					}
					if (res.data.teacher_info) {
						this.conversationInfo.teacher_info = res.data.teacher_info
						if (res.data.teacher_info.teacher_id && !this.conversationInfo.teacher_id) {
							this.conversationInfo.teacher_id = res.data.teacher_info.teacher_id
						}
					}
					if (!this.conversationId && res.data.conversation_id) {
						this.conversationId = res.data.conversation_id
					}
				}
			} catch (error) {
				console.error('加载用户信息失败:', error)
			}
		},
		async refreshMessages() {
			if (!this.conversationId) {
				return
			}
			this.pagination.page = 1
			this.pagination.hasMore = true
			this.messages = []
			await this.fetchMessages({ page: 1, reset: true })
			if (!this.messages.length) {
				await this.loadMessagesFromAppointment()
			}
		},
		async loadNewMessages() {
			// 增量拉取新消息（pollUpdates），避免每 5 秒全量 getMessages + markRead
			if (!this.conversationId || this.useMock) {
				return
			}
			if (this.loading || this.sending) {
				console.log('[parent-chat] loadNewMessages 跳过：loading/sending', this.loading, this.sending)
				return
			}

			try {
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const sinceTime = this.messages.length
					? Number(this.messages[this.messages.length - 1].send_time || 0)
					: 0
				console.log('[parent-chat] loadNewMessages since=', sinceTime)
				const res = await chatSend.pollUpdates({
					mode: 'conversation',
					conversation_id: this.conversationId,
					since_time: sinceTime
				})
				console.log('[parent-chat] loadNewMessages 结果=', res && res.code, '条数=', res && res.data && (res.data.messages || []).length)

				if (res.code !== 0 || !res.data) {
					return
				}

				const fetchedMessages = (res.data.messages || []).map(msg => ({
					message_id: msg.message_id,
					conversation_id: msg.conversation_id,
					sender_id: msg.sender_id,
					sender_role: msg.sender_role,
					content: msg.content,
					send_time: msg.send_time,
					is_read: msg.is_read
				}))

				if (!fetchedMessages.length) {
					return
				}

				const messageMap = new Map()
				this.messages.forEach(msg => messageMap.set(msg.message_id, msg))
				let hasBrandNew = false
				fetchedMessages.forEach(msg => {
					if (!messageMap.has(msg.message_id)) hasBrandNew = true
					messageMap.set(msg.message_id, msg)
				})

				if (!hasBrandNew && this.messages.length > 0) {
					return
				}

				this.messages = Array.from(messageMap.values()).sort((a, b) => a.send_time - b.send_time)
				this.$nextTick(() => {
					if (this.messages.length > 0) {
						this.scrollIntoView = `msg-${this.messages.length - 1}`
					}
				})

				// 仅在确有对方新消息时标记已读，避免轮询空转写库
				const hasIncoming = fetchedMessages.some(msg => msg.sender_id && msg.sender_role !== 'parent')
				if (hasIncoming || sinceTime === 0) {
					await chatSend.markRead({ conversation_id: this.conversationId })
					refreshChatBadge('parent-conversation-poll')
				}
				this.loadTrialInviteStatuses()
			} catch (error) {
				console.error('加载新消息失败:', error)
				if (this.messages.length === 0) {
					await this.refreshMessages()
				}
			}
		},
		async loadHistory() {
			if (!this.pagination.hasMore || this.loadingMore || this.useMock) {
				return
			}
			this.loadingMore = true
			await this.fetchMessages({ page: this.pagination.page + 1, prepend: true })
			this.loadingMore = false
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
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					return
				}
				await Promise.all([this.refreshConversationInfo(), this.refreshMessages()])
				this.showRefreshTipWithText('刷新完成')
			} catch (error) {
				console.error('刷新失败:', error)
				uni.showToast({ title: '刷新失败，请稍后再试', icon: 'none' })
				this.showRefreshTipWithText('刷新失败')
			} finally {
				this.refresherTriggered = false
			}
		},
		showRefreshTipWithText(text) {
			this.refreshTipText = text
			this.showRefreshTip = true
			if (this.refreshTipTimer) {
				clearTimeout(this.refreshTipTimer)
			}
			this.refreshTipTimer = setTimeout(() => {
				this.showRefreshTip = false
				this.refreshTipTimer = null
			}, 800)
		},
		async refreshConversationInfo() {
			if (!this.conversationId || this.useMock) return
			try {
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const res = await chatSend.getConversationWithUserInfo({
					conversation_id: this.conversationId
				})
				if (res.code === 0 && res.data) {
					if (res.data.other_user) {
						this.otherUserInfo = {
							nickname: res.data.other_user.nickname || '',
							display_name: res.data.other_user.display_name || '',
							avatar: res.data.other_user.avatar || '/static/default-avatar.png',
							title: res.data.other_user.title || '',
							subjects: res.data.other_user.subjects || []
						}
					}
					this.conversationInfo = res.data
					if (res.data.teacher_id) {
						this.conversationInfo.teacher_id = res.data.teacher_id
					}
					if (res.data.teacher_info?.teacher_id && !this.conversationInfo.teacher_id) {
						this.conversationInfo.teacher_id = res.data.teacher_info.teacher_id
					}
				}
			} catch (error) {
				console.error('刷新会话信息失败:', error)
			}
		},
		async fetchMessages({ page = 1, reset = false, prepend = false } = {}) {
			if (!this.conversationId) return
			try {
				if (this.useMock) {
					const mockData = mockMessages
						.filter(msg => msg.conversation_id === this.conversationId)
						.sort((a, b) => a.send_time - b.send_time)
					this.messages = mockData
					return
				}

				if (this.loading) return
				this.loading = true

				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const res = await chatSend.getMessages({
					conversation_id: this.conversationId,
					page,
					pageSize: this.pagination.pageSize
				})

				if (res.code === 0 && res.data) {
					const fetched = (res.data.messages || []).map(msg => ({
						message_id: msg.message_id,
						conversation_id: msg.conversation_id,
						sender_id: msg.sender_id,
						sender_role: msg.sender_role,
						content: msg.content,
						send_time: msg.send_time,
						is_read: msg.is_read
					}))

					if (prepend) {
						this.messages = [...fetched, ...this.messages]
						this.pagination.page = page
						this.$nextTick(() => {
							if (fetched.length > 0) {
								this.scrollIntoView = `msg-${fetched.length}`
							}
						})
					} else {
						this.messages = fetched
						this.pagination.page = page
						this.$nextTick(() => {
							if (this.messages.length > 0) {
								this.scrollIntoView = `msg-${this.messages.length - 1}`
							}
						})
					}

					this.pagination.hasMore = !!res.data.hasMore

					if (!prepend) {
						await chatSend.markRead({ conversation_id: this.conversationId })
						refreshChatBadge('parent-conversation-open')
						this.loadTrialInviteStatuses()
					}
				} else {
					uni.showToast({ title: res.message || '消息加载失败', icon: 'none' })
				}
			} catch (error) {
				console.error('加载消息失败:', error)
				uni.showToast({ title: '加载失败，请稍后再试', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		async loadMessagesFromAppointment() {
			if (this.useMock || !this.appointmentId) return
			try {
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const res = await chatSend.getConversation({ appointment_id: this.appointmentId })
				if (res.code === 0 && res.data?.conversation_id) {
					this.conversationId = res.data.conversation_id
					this.conversationInfo = res.data
					await this.fetchMessages({ page: 1, reset: true })
				}
			} catch (error) {
				console.error('通过预约加载消息失败:', error)
			}
		},
		async sendMessage() {
			if (!this.inputText.trim() || this.sending || !this.conversationId) return
			const content = this.inputText.trim()
			this.inputText = ''

			const tempMsg = {
				message_id: `temp_${Date.now()}`,
				conversation_id: this.conversationId,
				sender_role: this.currentUserRole,
				content,
				send_time: Date.now(),
				is_read: false
			}
			this.messages = [...this.messages, tempMsg]
			this.$nextTick(() => {
				this.scrollIntoView = `msg-${this.messages.length - 1}`
			})

			if (this.useMock) {
				return
			}

			try {
				this.sending = true
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const res = await chatSend.send({
					conversation_id: this.conversationId,
					message_type: 'text',
					content
				})
				console.log('[parent-chat] send 返回=', res)
				console.log('[parent-chat] push 调试=', res.data && res.data.push)
				if (res.code === 0) {
					const pushInfo = (res.data && res.data.push) || {}
					if (pushInfo.error || !(pushInfo.cids && pushInfo.cids.length)) {
						console.warn('[parent-chat] 推送可能未成功送达对方:', pushInfo)
					} else {
						console.log('[parent-chat] 已触发推送 → receiver=', res.data.receiver_id, 'cids=', pushInfo.cids)
					}
					const index = this.messages.findIndex(msg => msg.message_id === tempMsg.message_id)
					if (index !== -1) {
						this.messages.splice(index, 1, {
							...tempMsg,
							message_id: res.data.message_id,
							send_time: res.data.send_time
						})
					}
				} else {
					this.rollbackTempMessage(tempMsg.message_id, res.message)
				}
			} catch (error) {
				console.error('发送消息失败:', error)
				this.rollbackTempMessage(tempMsg.message_id)
			} finally {
				this.sending = false
			}
		},
		rollbackTempMessage(tempId, message = '发送失败，请稍后再试') {
			const index = this.messages.findIndex(msg => msg.message_id === tempId)
			if (index !== -1) {
				this.messages.splice(index, 1)
			}
			uni.showToast({ title: message, icon: 'none' })
		},
		getDateLabel(timestamp) {
			const date = new Date(timestamp)
			const today = new Date()
			const diff = today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)
			if (diff === 0) {
				return `今天 ${this.formatTime(timestamp)}`
			}
			if (diff === 86400000) {
				return `昨天 ${this.formatTime(timestamp)}`
			}
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${month}-${day} ${hour}:${minute}`
		},
		formatTime(timestamp) {
			const date = new Date(timestamp)
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${hour}:${minute}`
		},
		formatStatus(status) {
			const map = {
				pending_confirm: '待老师确认',
				pending_payment: '待支付',
				confirmed: '进行中',
				completed: '已完成'
			}
			return map[status] || '沟通中'
		},
		goBack() {
			uni.navigateBack()
		},
		/**
		 * 判断消息是否为试课邀请消息
		 * @param {Object} msg - 消息对象
		 * @returns {Boolean}
		 */
		isTrialInviteMessage(msg) {
			if (!msg || !msg.content) return false
			try {
				// 尝试解析 content 为 JSON，判断是否为邀请消息
				const parsed = JSON.parse(msg.content)
				return parsed && parsed.type === 'trial_invite' && parsed.invite_id
			} catch (e) {
				return false
			}
		},
		parseAttendanceClockPayload(msg) {
			if (!msg || !msg.content) return null
			try {
				const parsed = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
				if (parsed && parsed.type === 'attendance_clock') return parsed
			} catch (e) {
				return null
			}
			return null
		},
		isAttendanceClockMessage(msg) {
			return !!this.parseAttendanceClockPayload(msg)
		},
		getAttendanceClockIcon(msg) {
			const p = this.parseAttendanceClockPayload(msg)
			return p && p.action === 'clock_out' ? '🏁' : '📍'
		},
		getAttendanceClockTitle(msg) {
			const p = this.parseAttendanceClockPayload(msg)
			return (p && p.title) || '打卡提醒'
		},
		getAttendanceClockTime(msg) {
			const p = this.parseAttendanceClockPayload(msg)
			const ts = Number(p && p.clock_time)
			if (!ts) return '-'
			const d = new Date(ts)
			const pad = (n) => String(n).padStart(2, '0')
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
		},
		getAttendanceClockAddress(msg) {
			const p = this.parseAttendanceClockPayload(msg)
			return (p && p.address) || ''
		},
		getAttendanceClockTip(msg) {
			const p = this.parseAttendanceClockPayload(msg)
			return (p && p.tip) || '点击查看预约详情'
		},
		goAttendanceAppointment(msg) {
			const p = this.parseAttendanceClockPayload(msg)
			const id = (p && p.appointment_id) || this.appointmentId
			if (!id) {
				uni.showToast({ title: '未关联预约', icon: 'none' })
				return
			}
			uni.navigateTo({ url: `/pages-biz/appointment/detail?id=${id}` })
		},
		parseReviewResultPayload(msg) {
			if (!msg || !msg.content) return null
			try {
				const parsed = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
				if (parsed && parsed.type === 'review_result') return parsed
			} catch (e) {
				return null
			}
			return null
		},
		isReviewResultMessage(msg) {
			return !!this.parseReviewResultPayload(msg)
		},
		getReviewResultTitle(msg) {
			const p = this.parseReviewResultPayload(msg)
			return (p && p.title) || '课程评价'
		},
		getReviewStars(msg) {
			const p = this.parseReviewResultPayload(msg)
			const n = Math.min(5, Math.max(0, Number(p && p.rating) || 0))
			return '★'.repeat(n) + '☆'.repeat(5 - n)
		},
		getReviewResultLine(msg) {
			const p = this.parseReviewResultPayload(msg)
			if (!p) return ''
			if (p.is_auto) return '系统默认好评'
			if (p.is_satisfied === true) return '试课成功'
			if (p.is_satisfied === false) return '试课不满意'
			return ''
		},
		getReviewTags(msg) {
			const p = this.parseReviewResultPayload(msg)
			const tags = (p && Array.isArray(p.tags)) ? p.tags.filter(Boolean) : []
			return tags.join('、')
		},
		getReviewContent(msg) {
			const p = this.parseReviewResultPayload(msg)
			return (p && p.content) || ''
		},
		getReviewResultTip(msg) {
			const p = this.parseReviewResultPayload(msg)
			return (p && p.tip) || '点击查看预约详情'
		},
		goReviewAppointment(msg) {
			const p = this.parseReviewResultPayload(msg)
			const id = (p && p.appointment_id) || this.appointmentId
			if (!id) {
				uni.showToast({ title: '未关联预约', icon: 'none' })
				return
			}
			uni.navigateTo({ url: `/pages-biz/appointment/detail?id=${id}` })
		},
		/**
		 * 从邀请消息中提取邀请ID
		 * @param {Object} msg - 消息对象
		 * @returns {String}
		 */
		getInviteIdFromMessage(msg) {
			if (!this.isTrialInviteMessage(msg)) return ''
			try {
				const parsed = JSON.parse(msg.content)
				return parsed.invite_id || ''
			} catch (e) {
				return ''
			}
		},
		canRespondTrialInvite(msg) {
			if (msg.sender_role === this.currentUserRole) return false
			const inviteId = this.getInviteIdFromMessage(msg)
			if (!inviteId || this.rejectingInviteIds[inviteId]) return false
			return this.trialInviteStatusMap[inviteId]?.status === 'trial_invited'
		},
		getTrialInviteStatusText(msg) {
			const inviteId = this.getInviteIdFromMessage(msg)
			const info = this.trialInviteStatusMap[inviteId] || {}
			const status = info.status
			if (status === 'trial_invited') {
				return msg.sender_role === this.currentUserRole ? '已发送邀请' : '待处理邀请'
			}
			if (status === 'rejected') return '已不通过'
			if (status === 'pending_payment') return '已通过，待支付试课费'
			if (status === 'pending_confirm') return '已支付，等待老师确认'
			if (['confirmed', 'in_progress'].includes(status)) {
				return info.parent_paid ? '试课费已支付，请按约定时间上课' : '已通过'
			}
			if (status === 'completed') return '试课已完成'
			if (status) return '邀请已处理'
			return '加载中...'
		},
		async loadTrialInviteStatuses() {
			const inviteIds = Array.from(new Set((this.messages || [])
				.map(msg => this.getInviteIdFromMessage(msg))
				.filter(Boolean)))
			if (!inviteIds.length || this.useMock) return
			try {
				const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
				const entries = await Promise.all(inviteIds.map(async inviteId => {
					try {
						const res = await appointmentQuery.getAppointmentDetail({ appointment_id: inviteId })
						if (res.code === 0 && res.data) {
							return [inviteId, {
								status: res.data.status,
								parent_paid: !!res.data.parent_paid,
								total_amount: Number(res.data.total_amount || 0)
							}]
						}
					} catch (e) {
						console.warn('[chat-conversation] 加载试课邀请状态失败:', inviteId, e)
					}
					return [inviteId, this.trialInviteStatusMap[inviteId] || { status: '' }]
				}))
				const nextMap = { ...this.trialInviteStatusMap }
				entries.forEach(([inviteId, item]) => {
					nextMap[inviteId] = item
				})
				this.trialInviteStatusMap = nextMap
			} catch (e) {
				console.warn('[chat-conversation] 批量加载试课邀请状态失败:', e)
			}
		},
		goPayTrialFee() {
			const inviteId = this.pendingPaymentInviteId || this.appointmentId
			if (!inviteId) {
				uni.showToast({ title: '未找到待支付试课', icon: 'none' })
				return
			}
			uni.navigateTo({
				url: `/pages-biz/appointment/detail?id=${inviteId}`
			})
		},
		/**
		 * 处理接受邀请（点击邀请卡片）
		 * @param {Object} msg - 邀请消息对象
		 */
		handleAcceptInvite(msg) {
			const inviteId = this.getInviteIdFromMessage(msg)
			if (!inviteId) {
				uni.showToast({ title: '邀请信息无效', icon: 'none' })
				return
			}
			const teacherInfo = this.conversationInfo?.teacher_info || {}
			saveAppointmentTeacherPreview({
				teacherUid: this.conversationInfo?.teacher_id || teacherInfo.teacher_id || '',
				teacher_id: this.conversationInfo?.teacher_id || teacherInfo.teacher_id || '',
				display_name: teacherInfo.display_name || teacherInfo.name || this.otherUserInfo.display_name || this.otherUserInfo.nickname || '',
				name: teacherInfo.name || teacherInfo.display_name || this.otherUserInfo.nickname || '',
				nickname: this.otherUserInfo.nickname || '',
				avatar: teacherInfo.avatar || this.otherUserInfo.avatar || '',
				hourly_rate: teacherInfo.hourly_rate
			})
			uni.navigateTo({
				url: `/pages-biz/appointment/create?invite_id=${inviteId}`
			})
		},
		async handleRejectInvite(msg) {
			const inviteId = this.getInviteIdFromMessage(msg)
			if (!inviteId) {
				uni.showToast({ title: '邀请信息无效', icon: 'none' })
				return
			}
			if (this.rejectingInviteIds[inviteId]) return
			uni.showModal({
				title: '不通过试课邀请',
				content: '确认不通过本次试课邀请？老师之后可以重新发起邀请。',
				success: async (modalRes) => {
					if (!modalRes.confirm) return
					this.rejectingInviteIds = { ...this.rejectingInviteIds, [inviteId]: true }
					try {
						const appointmentCreate = uniCloud.importObject('appointment-create', { customUI: true })
						const res = await appointmentCreate.rejectTrialInvite({ invite_id: inviteId })
						if (res.code !== 0) {
							uni.showToast({ title: res.message || '操作失败', icon: 'none' })
							return
						}
						this.trialInviteStatusMap = {
							...this.trialInviteStatusMap,
							[inviteId]: { status: 'rejected' }
						}
						uni.showToast({ title: '已不通过', icon: 'success' })
						setTimeout(() => this.loadNewMessages(), 500)
					} catch (e) {
						console.error('拒绝试课邀请失败:', e)
						uni.showToast({ title: '操作失败，请稍后再试', icon: 'none' })
					} finally {
						const next = { ...this.rejectingInviteIds }
						delete next[inviteId]
						this.rejectingInviteIds = next
					}
				}
			})
		}
	}
}
</script>

<style scoped>
.conversation-page {
	background: #EDEDED;
	display: flex;
	flex-direction: column;
	height: 100vh;
}

.message-scroll {
	flex: 1;
	overflow-y: auto;
}

.message-container {
	padding: 20rpx 0 40rpx;
}

.load-more-tip {
	text-align: center;
	padding: 20rpx 0;
	font-size: 24rpx;
	color: #8B919C;
}

.time-divider {
	text-align: center;
	padding: 30rpx 0;
	font-size: 22rpx;
	color: #8B919C;
}

.message-wrapper {
	display: flex;
	flex-direction: column;
}

.message-item {
	display: flex;
	align-items: flex-start;
	padding: 0 32rpx;
	margin-bottom: 20rpx;
	width: 100%;
	box-sizing: border-box;
}

.message-item:not(.message-right) {
	justify-content: flex-start;
}

.message-item.message-right {
	justify-content: flex-end;
	margin-left: auto;
	width: auto;
	max-width: 85%;
	padding-right: 32rpx;
	padding-left: 0;
}

.message-avatar {
	width: 80rpx;
	height: 80rpx;
	border-radius: 50%;
	flex-shrink: 0;
	background: #EEF3FF;
}

.message-content-wrapper {
	display: flex;
	flex-direction: column;
	flex: 0 1 auto;
	min-width: 0;
	max-width: 70%;
}

.message-item:not(.message-right) .message-content-wrapper {
	align-items: flex-start;
	margin-left: 20rpx;
	margin-right: 0;
}

.message-item.message-right .message-content-wrapper {
	align-items: flex-end;
	margin-right: 20rpx;
	margin-left: 0;
}

.message-bubble {
	padding: 20rpx 24rpx;
	border-radius: 20rpx;
	word-wrap: break-word;
	word-break: break-all;
	display: inline-block;
}

.bubble-left {
	background: #FFFFFF;
}

.bubble-right {
	background: #95EC69;
}

.message-text {
	font-size: 30rpx;
	line-height: 1.45;
}

.bubble-left .message-text {
	color: #1F2329;
}

.bubble-right .message-text {
	color: #1F2329;
}

.input-bar {
	background: #F7F7F7;
	border-top: 1rpx solid #EBEDF0;
	padding-bottom: env(safe-area-inset-bottom);
}

.wait-tip {
	padding: 20rpx 32rpx;
	background: #FFF7ED;
}

.wait-tip-text {
	font-size: 24rpx;
	color: #9A6B2F;
}

.pay-tip {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	padding: 16rpx 32rpx;
	background: #FFF7ED;
}

.pay-tip-text {
	flex: 1;
	font-size: 24rpx;
	color: #9A6B2F;
}

.pay-tip-btn {
	height: 56rpx;
	padding: 0 24rpx;
	border-radius: 16rpx;
	background: #2563EB;
	display: flex;
	align-items: center;
	justify-content: center;
}

.pay-tip-btn-text {
	font-size: 24rpx;
	font-weight: 600;
	color: #FFFFFF;
}

.input-wrapper {
	display: flex;
	align-items: flex-end;
	gap: 12rpx;
	padding: 16rpx 20rpx;
}

.input-box {
	flex: 1;
	background: #FFFFFF;
	border-radius: 16rpx;
	padding: 12rpx 20rpx;
	min-height: 64rpx;
	max-height: 200rpx;
}

.input-textarea {
	width: 100%;
	font-size: 32rpx;
	color: #1F2329;
	line-height: 1.5;
}

.input-placeholder {
	color: #8B919C;
}

.send-btn {
	width: 100rpx;
	height: 64rpx;
	background: #C6C6C6;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.send-btn-active {
	background: #2563EB;
}

.send-btn-text {
	font-size: 28rpx;
	color: #FFFFFF;
	font-weight: 600;
}

.send-btn:not(.send-btn-active) {
	background: #C6C6C6;
}

.empty-message {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 200rpx 32rpx;
}

.empty-text {
	font-size: 28rpx;
	color: #8B919C;
}

.message-center {
	justify-content: center;
	margin: 20rpx 0;
}

.trial-invite-card,
.attendance-clock-card {
	width: 560rpx;
	padding: 28rpx 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.trial-invite-title,
.attendance-clock-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.trial-invite-desc {
	display: block;
	margin: 12rpx 0 24rpx;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.6;
}

.trial-invite-actions {
	display: flex;
	gap: 16rpx;
}

.trial-invite-btn {
	flex: 1;
	height: 72rpx;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.trial-invite-btn-accept {
	background: #2563EB;
}

.trial-invite-btn-reject {
	background: #FFFFFF;
	border: 1rpx solid #FFD0D0;
}

.trial-invite-btn-text {
	font-size: 28rpx;
	font-weight: 600;
	color: #FFFFFF;
}

.trial-invite-btn-reject-text {
	color: #FA5151;
}

.trial-invite-status {
	height: 72rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	display: flex;
	align-items: center;
	justify-content: center;
}

.trial-invite-status-text {
	font-size: 26rpx;
	color: #8B919C;
}

.attendance-clock-title {
	margin-bottom: 16rpx;
}

.attendance-clock-row {
	display: flex;
	align-items: flex-start;
	margin-bottom: 8rpx;
}

.attendance-clock-label {
	width: 72rpx;
	flex-shrink: 0;
	font-size: 24rpx;
	color: #8B919C;
}

.attendance-clock-value {
	flex: 1;
	font-size: 24rpx;
	color: #5C6370;
	line-height: 1.5;
}

.attendance-clock-tip {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	color: #2563EB;
}

.review-stars {
	display: block;
	margin: 12rpx 0 8rpx;
	font-size: 32rpx;
	color: #F59E0B;
	letter-spacing: 4rpx;
}
</style>