<template>
	<view class="conversation-page">
		<!-- 顶部导航栏 -->
		<view class="navbar">
			<view class="navbar-content">
				<view class="navbar-left" @click="goBack">
					<text class="iconfont icon-arrow-left navbar-back"></text>
				</view>
				<view class="navbar-center">
					<image class="navbar-avatar" :src="otherAvatar" mode="aspectFill"></image>
					<text class="navbar-name">{{ otherDisplayName }}</text>
				</view>
				<view class="navbar-right">
					<text class="iconfont icon-more navbar-more"></text>
				</view>
			</view>
		</view>

		<!-- 消息列表 -->
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
						<!-- 试课邀请卡片 -->
						<view class="trial-invite-card">
							<view class="trial-invite-header">
								<text class="trial-invite-icon">🎓</text>
								<text class="trial-invite-title">试课邀请</text>
							</view>
							<view class="trial-invite-content">
								<text class="trial-invite-desc">老师邀请您预约试课，点击填写信息并支付费用</text>
							</view>
							<view 
								v-if="item.data.sender_role !== currentUserRole" 
								class="trial-invite-btn" 
								@click="handleAcceptInvite(item.data)"
							>
								<text class="trial-invite-btn-text">填写信息并预约</text>
							</view>
							<view v-else class="trial-invite-status">
								<text class="trial-invite-status-text">已发送邀请</text>
							</view>
						</view>
					</view>
					<view v-else class="message-item" :class="{ 'message-right': item.data.sender_role === currentUserRole }">
						<!-- 对方消息：头像在左，消息在右 -->
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
						<!-- 自己消息：消息在左，头像在右 -->
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
					<text class="empty-icon">💬</text>
					<text class="empty-text">暂无消息，先和老师打个招呼吧</text>
				</view>
			</view>
		</scroll-view>

		<!-- 输入栏 -->
		<view class="input-bar">
			<view v-if="needWaitForTeacherReply" class="wait-tip">
				<text class="wait-tip-text">请等待老师回复后再继续发送消息</text>
			</view>
			<view class="input-wrapper">
				<view class="input-box">
					<textarea
						v-model="inputText"
						class="input-textarea"
						auto-height
						confirm-type="send"
						:maxlength="300"
						:placeholder="needWaitForTeacherReply ? '请等待老师回复...' : '请输入聊天内容...'"
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
import { saveAppointmentTeacherPreview } from '@/utils/appointmentTeacherPreview.js'

export default {
	name: 'ChatConversation',
	mixins: [pullRefreshMixin],
		data() {
		return {
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
			// 消息轮询定时器
			pollTimer: null,
			pollInterval: 5000, // 5秒轮询一次
			currentUserInfo: {},
			otherUserInfo: {
				nickname: '',
				display_name: '',
				avatar: getDefaultAvatarUrl(),
				title: '',
				subjects: []
			},
			conversationInfo: {},
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
				getDefaultAvatarUrl()
			)
		}
	},
	onLoad(options) {
		this.conversationId = options.conversationId || ''
		this.appointmentId = options.appointmentId || ''
		this.useMock = useMockData() === true

		const userInfo = uni.getStorageSync('userInfo')
		if (userInfo) {
			this.currentUserRole = userInfo.role || 'parent'
			this.currentUserInfo = {
				nickname: userInfo.nickname || '我',
				avatar: userInfo.avatar || defaultAvatarUrl
			}
		}

		// 延迟初始化，避免阻塞页面渲染和显示加载框
		this.$nextTick(() => {
			setTimeout(() => {
				this.initConversation()
			}, 100)
		})
	},
	async onShow() {
		// 等待初始化完成
		if (this.initPromise) {
			await this.initPromise
		}
		// 如果已初始化且有会话ID，加载新消息
		if (this.isInitialized && this.conversationId && !this.useMock) {
			// 只加载新消息，不清空已有消息
			this.loadNewMessages()
			// 启动消息轮询
			this.startPolling()
		}
	},
	onHide() {
		// 页面隐藏时停止轮询
		this.stopPolling()
	},
	onUnload() {
		// 页面卸载时清理定时器
		this.stopPolling()
		if (this.refreshTipTimer) {
			clearTimeout(this.refreshTipTimer)
			this.refreshTipTimer = null
		}
	},
		methods: {
		/**
		 * 启动消息轮询
		 */
		startPolling() {
			// 如果已有定时器，先清除
			this.stopPolling()
			// 只在非mock模式且有会话ID时轮询
			if (!this.useMock && this.conversationId) {
				this.pollTimer = setInterval(() => {
					// 如果正在加载或发送消息，跳过本次轮询
					if (this.loading || this.sending) {
						return
					}
					this.loadNewMessages()
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
			// 保存初始化 Promise
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
					this.initPromise = null
				}
			})()
			await this.initPromise
		},
		async loadUserInfo() {
			try {
				if (this.useMock) {
					this.otherUserInfo = { nickname: '老师', avatar: defaultAvatarUrl }
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
			// 加载新消息，保留已有消息
			if (!this.conversationId || this.useMock) {
				return
			}
			// 如果正在加载，等待加载完成
			if (this.loading) {
				return
			}
			
			try {
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const res = await chatSend.getMessages({
					conversation_id: this.conversationId,
					page: 1,
					pageSize: this.pagination.pageSize
				})
				
				if (res.code === 0 && res.data && res.data.messages) {
					const fetchedMessages = (res.data.messages || []).map(msg => ({
						message_id: msg.message_id,
						conversation_id: msg.conversation_id,
						sender_id: msg.sender_id,
						sender_role: msg.sender_role,
						content: msg.content,
						send_time: msg.send_time,
						is_read: msg.is_read
					}))
					
					// 如果有已有消息，合并去重
					if (this.messages.length > 0) {
						// 合并消息：使用 Map 去重，以 message_id 为 key
						const messageMap = new Map()
						// 先添加已有消息
						this.messages.forEach(msg => {
							messageMap.set(msg.message_id, msg)
						})
						// 再添加新获取的消息（会覆盖重复的）
						fetchedMessages.forEach(msg => {
							messageMap.set(msg.message_id, msg)
						})
						// 转换为数组并按时间排序
						const mergedMessages = Array.from(messageMap.values())
							.sort((a, b) => a.send_time - b.send_time)
						
						// 只有当有新消息时才更新
						if (mergedMessages.length !== this.messages.length || 
							mergedMessages[mergedMessages.length - 1]?.message_id !== this.messages[this.messages.length - 1]?.message_id) {
							this.messages = mergedMessages
							this.$nextTick(() => {
								if (this.messages.length > 0) {
									this.scrollIntoView = `msg-${this.messages.length - 1}`
								}
							})
						}
					} else {
						// 如果没有消息，直接使用获取的消息
						this.messages = fetchedMessages.sort((a, b) => a.send_time - b.send_time)
						this.$nextTick(() => {
							if (this.messages.length > 0) {
								this.scrollIntoView = `msg-${this.messages.length - 1}`
							}
						})
					}
					
					// 标记已读
					await chatSend.markRead({ conversation_id: this.conversationId })
				}
			} catch (error) {
				console.error('加载新消息失败:', error)
				// 如果加载失败且没有消息，尝试重新加载
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
				if (res.code === 0) {
					const index = this.messages.findIndex(msg => msg.message_id === tempMsg.message_id)
					if (index !== -1) {
						this.messages.splice(index, 1, {
							...tempMsg,
							message_id: res.data.message_id,
							send_time: res.data.send_time
						})
					}
					// 发送成功后，等待1秒后检查新消息（避免立即轮询导致的重复请求）
					setTimeout(() => {
						if (!this.loading && !this.sending) {
							this.loadNewMessages()
						}
					}, 1000)
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
				url: `/pages/appointment/create?invite_id=${inviteId}`
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

/* 导航栏 */
.navbar {
	background: #FFFFFF;
	padding-top: var(--status-bar-height, 0);
	border-bottom: 1rpx solid #E5E5E5;
}

.navbar-content {
	height: 88rpx;
	display: flex;
	align-items: center;
	padding: 0 30rpx;
}

.navbar-left {
	width: 60rpx;
	display: flex;
	align-items: center;
}

.navbar-back {
	font-size: 40rpx;
	color: #000000;
}

.navbar-center {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 0 20rpx;
}

.navbar-avatar {
	width: 64rpx;
	height: 64rpx;
	border-radius: 8rpx;
	margin-right: 16rpx;
}

.navbar-name {
	font-size: 32rpx;
	font-weight: 500;
	color: #000000;
}

.navbar-right {
	min-width: 60rpx;
	display: flex;
	align-items: center;
	justify-content: flex-end;
}

.navbar-more {
	font-size: 40rpx;
	color: #000000;
}

.appointment-btn {
	background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
	border-radius: 8rpx;
	padding: 8rpx 20rpx;
	margin-left: 20rpx;
}

.appointment-btn-text {
	font-size: 24rpx;
	color: #FFFFFF;
	font-weight: 500;
	white-space: nowrap;
}

/* 消息列表 */
.message-scroll {
	flex: 1;
	overflow-y: auto;
}

.message-container {
	padding: 20rpx 0 40rpx 0;
}

.load-more-tip {
	text-align: center;
	padding: 20rpx 0;
	font-size: 24rpx;
	color: #999999;
}


.time-divider {
	text-align: center;
	padding: 30rpx 0;
	font-size: 22rpx;
	color: #999999;
}

.message-wrapper {
	display: flex;
	flex-direction: column;
}

.message-item {
	display: flex;
	align-items: flex-start;
	padding: 0 30rpx;
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
	padding-right: 30rpx;
	padding-left: 0;
}

.message-avatar {
	width: 88rpx;
	height: 88rpx;
	border-radius: 6rpx;
	flex-shrink: 0;
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
	padding: 18rpx 24rpx;
	border-radius: 10rpx;
	word-wrap: break-word;
	word-break: break-all;
	display: inline-block;
	position: relative;
	box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.1);
}

.bubble-left {
	background: #FFFFFF;
	border-top-left-radius: 0;
	position: relative;
}

.bubble-left::before {
	content: '';
	position: absolute;
	left: -16rpx;
	top: 20rpx;
	width: 0;
	height: 0;
	border-top: 12rpx solid transparent;
	border-bottom: 12rpx solid transparent;
	border-right: 16rpx solid #FFFFFF;
}

.bubble-right {
	background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
	border-top-right-radius: 0;
	position: relative;
}

.bubble-right::after {
	content: '';
	position: absolute;
	right: -16rpx;
	top: 20rpx;
	width: 0;
	height: 0;
	border-top: 12rpx solid transparent;
	border-bottom: 12rpx solid transparent;
	border-left: 16rpx solid;
	border-left-color: #357ABD;
}

.message-text {
	font-size: 34rpx;
	line-height: 1.6;
}

.bubble-left .message-text {
	color: #000000;
}

.bubble-right .message-text {
	color: #FFFFFF;
}

/* 输入栏 */
.input-bar {
	background: #FFFFFF;
	border-top: 1rpx solid #E5E5E5;
	padding-bottom: env(safe-area-inset-bottom);
}

.wait-tip {
	background: #FFF7E6;
	padding: 20rpx 30rpx;
	border-bottom: 1rpx solid #FFE7A6;
}

.wait-tip-text {
	font-size: 24rpx;
	color: #FF9500;
}

.input-wrapper {
	display: flex;
	align-items: flex-end;
	padding: 16rpx 20rpx;
	background: #F7F7F7;
}

.input-box {
	flex: 1;
	background: #FFFFFF;
	border-radius: 8rpx;
	padding: 16rpx 20rpx;
	margin-right: 16rpx;
	min-height: 72rpx;
	max-height: 200rpx;
}

.input-textarea {
	width: 100%;
	font-size: 32rpx;
	color: #000000;
	line-height: 1.5;
}

.input-placeholder {
	color: #999999;
}

.send-btn {
	width: 100rpx;
	height: 72rpx;
	background: #07C160;
	border-radius: 8rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.send-btn-active {
	background: #07C160;
}

.send-btn-text {
	font-size: 28rpx;
	color: #FFFFFF;
	font-weight: 500;
}

.send-btn:not(.send-btn-active) {
	background: #C6C6C6;
}

.send-btn:not(.send-btn-active) .send-btn-text {
	color: #FFFFFF;
}

/* 空状态 */
.empty-message {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 200rpx 0;
}

.empty-icon {
	font-size: 120rpx;
	margin-bottom: 40rpx;
}

.empty-text {
	font-size: 28rpx;
	color: #999999;
}

/* 试课邀请卡片 */
.message-center {
	justify-content: center;
	margin: 20rpx 0;
}

.trial-invite-card {
	width: 560rpx;
	background-color: #FFFFFF;
	border-radius: 24rpx;
	padding: 32rpx;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.08);
}

.trial-invite-header {
	display: flex;
	align-items: center;
	margin-bottom: 16rpx;
}

.trial-invite-icon {
	font-size: 48rpx;
	margin-right: 12rpx;
}

.trial-invite-title {
	font-size: 32rpx;
	font-weight: 600;
	color: #333333;
}

.trial-invite-content {
	margin-bottom: 24rpx;
}

.trial-invite-desc {
	font-size: 26rpx;
	color: #666666;
	line-height: 1.6;
}

.trial-invite-btn {
	width: 100%;
	height: 72rpx;
	background-color: #4A90E2;
	border-radius: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.trial-invite-btn-text {
	color: #FFFFFF;
	font-size: 28rpx;
	font-weight: 500;
}

.trial-invite-status {
	width: 100%;
	height: 72rpx;
	background-color: #F5F5F5;
	border-radius: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.trial-invite-status-text {
	color: #999999;
	font-size: 26rpx;
}
</style>