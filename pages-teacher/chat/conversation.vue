<template>
	<view class="conversation-page">
		<!-- 顶部导航栏 -->
		<view class="navbar">
			<view class="navbar-content">
				<view class="navbar-left" @click="goBack">
					<view class="icon-arrow-left navbar-back"></view>
				</view>
				<view class="navbar-center">
					<image class="navbar-avatar" :src="otherUserInfo.avatar || defaultAvatarUrl" mode="aspectFill"></image>
					<text class="navbar-name">{{ otherUserInfo.nickname || '家长' }}</text>
				</view>
				<view class="navbar-right">
					<view class="icon-more navbar-more"></view>
				</view>
			</view>
		</view>

		<!-- 消息列表 -->
		<scroll-view
			scroll-y
			class="message-scroll"
			:scroll-into-view="scrollIntoView"
		>
			<view class="message-container">
				<view v-if="pagination.hasMore && !loadingMore" class="load-more-tip" @click="loadMoreHistory">
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
								:src="otherUserInfo.avatar || defaultAvatarUrl"
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
					<view class="empty-icon icon-chat" style="width: 120rpx; height: 120rpx; color: #ddd;"></view>
					<text class="empty-text">尚未开始对话，先和家长打个招呼吧</text>
				</view>
			</view>
		</scroll-view>

		<!-- 输入栏 -->
		<view class="input-bar">
			<view v-if="needPayDeposit" class="deposit-tip">
				<text class="deposit-tip-text">支付信息费后才能开始聊天</text>
				<view class="deposit-btn" @click="handlePayDeposit" :class="{ 'deposit-btn-disabled': payingDeposit }">
					<text class="deposit-btn-text">{{ payingDeposit ? '支付中...' : `支付信息费（¥${infoFeeAmount}）` }}</text>
				</view>
			</view>
			<view v-else>
				<!-- 邀请试课按钮 -->
				<view v-if="canShowInviteTrial" class="invite-trial-bar">
					<view class="invite-trial-btn" @click="handleInviteTrial" :class="{ 'invite-trial-btn-disabled': invitingTrial }">
						<text class="invite-trial-btn-text">{{ invitingTrial ? '发送中...' : '邀请试课' }}</text>
					</view>
				</view>
				<view class="input-wrapper">
					<view class="input-box">
						<textarea
							v-model="inputText"
							class="input-textarea"
							auto-height
							confirm-type="send"
							:maxlength="300"
							placeholder="请输入聊天内容..."
							@confirm="sendMessage"
							:disabled="sending || !canSend"
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
	</view>
</template>

<script>
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

import { mockMessages, useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

export default {
	name: 'TeacherChatConversation',
	mixins: [pullRefreshMixin],
		data() {
			return {
				// 默认头像URL（从CDN）
				defaultAvatarUrl: getDefaultAvatarUrl(),
			conversationId: '',
			appointmentId: '',
			messages: [],
			inputText: '',
			useMock: false,
			loading: false,
			sending: false,
			loadingMore: false,
			scrollIntoView: '',
			currentUserRole: 'teacher',
			currentUserInfo: {},
			otherUserInfo: {},
			conversationInfo: {},
			inviteSource: '',
			payingDeposit: false,
			invitingTrial: false, // 是否正在发送试课邀请
			hasTrialSuccess: false, // 与当前家长是否已有试课成功记录
			pagination: {
				page: 1,
				pageSize: 30,
				hasMore: true
			},
			isInitialized: false, // 标记是否已初始化完成
			initPromise: null, // 保存初始化 Promise
			// 老师端自身课时费（元/小时），用于计算信息费 = 课时费 × 2
			teacherHourlyRate: 0
		}
	},
	computed: {
		// 信息费金额（元）= 老师课时费 × 2（一节试课 2 小时）；老师未设置时兜底 1 元，与后端兜底一致
		infoFeeAmount() {
			const rate = Number(this.teacherHourlyRate) || 0
			const fee = rate > 0 ? Number((rate * 2).toFixed(2)) : 0
			return fee > 0 ? fee : 1
		},
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
		needPayDeposit() {
			if (this.currentUserRole !== 'teacher') {
				return false
			}
			return !this.conversationInfo.chat_enabled
		},
		canSend() {
			if (!this.conversationInfo.chat_enabled) {
				return false
			}
			return true
		},
		canSendMessage() {
			if (this.sending) return false
			if (!this.conversationId) return false
			if (!this.inputText.trim()) return false
			if (!this.canSend) return false
			return true
		},
		canShowInviteTrial() {
			// 教师端可以显示邀请试课按钮（需要会话已存在且有家长ID）
			if (this.currentUserRole !== 'teacher') return false
			if (!this.conversationId) return false
			// 需要有家长ID（从会话信息中获取）
			const parentId = this.conversationInfo.parent_id || this.otherUserInfo?.user_id
			// 如果已经有试课成功记录，则不再显示邀请试课按钮
			if (this.hasTrialSuccess) return false
			// 会话里已经发过试课邀请卡片时，不再重复显示
			if (this.messages.some(msg => this.isTrialInviteMessage(msg))) return false
			return !!parentId
		}
	},
	onLoad(options) {
		this.conversationId = options.conversationId || ''
		this.appointmentId = options.appointmentId || ''
		this.inviteSource = options.inviteSource || ''
		this.useMock = useMockData() === true

		const userInfo = uni.getStorageSync('userInfo')
		if (userInfo) {
			this.currentUserRole = userInfo.role || 'teacher'
			this.currentUserInfo = {
				nickname: userInfo.nickname || '我',
				avatar: userInfo.avatar || this.defaultAvatarUrl
			}
		}

		this.initConversation()
		this.loadTeacherHourlyRate()
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
		}
	},
	methods: {
		async refreshData() {
			console.log('[teacher-chat-conversation] 下拉刷新：重新加载消息')
			await this.refreshMessages()
		},
		// 读取当前教师的 hourly_rate，供信息费金额展示和支付用
		async loadTeacherHourlyRate() {
			try {
				const teacherProfile = uniCloud.importObject('teacher-profile', { customUI: true })
				const res = await teacherProfile.getProfile()
				if (res && res.code === 0 && res.data) {
					this.teacherHourlyRate = Number(res.data.hourly_rate) || 0
				}
			} catch (e) {
				console.warn('[信息费] 获取教师课时费失败，使用兜底金额:', e)
			}
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
								await this.checkTrialStatus()
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
						await this.checkTrialStatus()
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
					this.otherUserInfo = { nickname: '家长', avatar: '/static/default-avatar.png' }
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
							nickname: res.data.other_user.nickname || res.data.other_user.display_name || '家长',
							avatar: res.data.other_user.avatar || '/static/default-avatar.png'
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
		// 检查与当前会话家长是否已有试课成功记录，用于控制“邀请试课”按钮显示
		async checkTrialStatus() {
			try {
				if (this.useMock) {
					this.hasTrialSuccess = false
					return
				}
				if (this.currentUserRole !== 'teacher') {
					this.hasTrialSuccess = false
					return
				}
				const parentId = this.conversationInfo.parent_id
				if (!parentId) {
					this.hasTrialSuccess = false
					return
				}
				const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
				const res = await appointmentQuery.checkTrialStatusForParent({ parent_id: parentId })
				if (res.code === 0 && res.data) {
					this.hasTrialSuccess = !!res.data.hasTrialSuccess
					console.log('[teacher-chat-conversation] 试课状态检查结果:', res.data)
				} else {
					this.hasTrialSuccess = false
				}
			} catch (error) {
				console.error('[teacher-chat-conversation] 检查试课状态失败:', error)
				this.hasTrialSuccess = false
			}
		},
		async refreshMessages() {
			this.pagination.page = 1
			this.pagination.hasMore = true
			this.messages = []
			await this.fetchMessages({ page: 1, reset: true })
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
		async loadMoreHistory() {
			if (!this.pagination.hasMore || this.loadingMore || this.useMock) {
				return
			}
			this.loadingMore = true
			await this.fetchMessages({ page: this.pagination.page + 1, prepend: true })
			this.loadingMore = false
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
				pending_confirm: '待确认',
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
		 * 处理邀请试课
		 * 功能：调用云函数创建试课邀请，并发送邀请卡片消息
		 */
		async handleInviteTrial() {
			if (this.invitingTrial || !this.conversationId) return
			
			try {
				this.invitingTrial = true

				let inviteId = this.appointmentId || this.conversationInfo?.appointment_id || ''
				if (!inviteId || this.inviteSource !== 'recruitment') {
					// 获取家长ID（从会话信息中获取）
					const parentId = this.conversationInfo.parent_id
					if (!parentId) {
						uni.showToast({ title: '未找到家长信息', icon: 'none' })
						this.invitingTrial = false
						return
					}
					
					// 非招募入口沿用原逻辑，创建新的试课邀请
					const appointmentCreate = uniCloud.importObject('appointment-create', { customUI: true })
					const inviteRes = await appointmentCreate.inviteTrial({ parent_id: parentId })
					
					if (inviteRes.code !== 0) {
						uni.showToast({ title: inviteRes.message || '发送邀请失败', icon: 'none' })
						this.invitingTrial = false
						return
					}
					
					inviteId = inviteRes.data?.appointment_id || inviteRes.data?.invite_id
				}

				if (!inviteId) {
					uni.showToast({ title: '邀请创建失败', icon: 'none' })
					this.invitingTrial = false
					return
				}
				
				// 发送邀请卡片消息（使用特殊格式的 content）
				const inviteMessageContent = JSON.stringify({
					type: 'trial_invite',
					invite_id: inviteId
				})
				
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const sendRes = await chatSend.send({
					conversation_id: this.conversationId,
					message_type: 'text',
					content: inviteMessageContent
				})
				
				this.invitingTrial = false
				
				if (sendRes.code === 0) {
					this.appointmentId = inviteId
					uni.showToast({ title: '邀请已发送', icon: 'success' })
					// 刷新消息列表以显示邀请卡片
					setTimeout(() => {
						this.loadNewMessages()
					}, 500)
				} else {
					uni.showToast({ title: sendRes.message || '发送失败', icon: 'none' })
				}
			} catch (error) {
				this.invitingTrial = false
				console.error('发送试课邀请失败:', error)
				uni.showToast({ title: '发送失败，请稍后再试', icon: 'none' })
			}
		},
		/**
		 * 处理接受邀请（家长端使用）
		 * @param {Object} msg - 邀请消息对象
		 */
		handleAcceptInvite(msg) {
			const inviteId = this.getInviteIdFromMessage(msg)
			if (!inviteId) {
				uni.showToast({ title: '邀请信息无效', icon: 'none' })
				return
			}
			// 跳转到预约试课页面，带上 invite_id
			uni.navigateTo({
				url: `/pages/appointment/create?invite_id=${inviteId}`
			})
		},
		async handlePayDeposit() {
			if (this.payingDeposit) return
			
			uni.showModal({
				title: '支付信息费',
				content: `支付${this.infoFeeAmount}元信息费（= 课时费 × 2，一节试课 2 小时费用）可开启与家长的聊天窗口。\n试课成功 → 由平台收取；试课失败 → 全额退回您的钱包。`,
				success: async (res) => {
					if (res.confirm) {
						try {
							const userInfo = uni.getStorageSync('userInfo') || {}
							if (!userInfo.uid) {
								uni.showToast({ title: '请先登录', icon: 'none' })
								return
							}
							
							const appointmentId = this.appointmentId || this.conversationInfo?.appointment_id
							if (!appointmentId) {
								uni.showToast({ title: '未找到预约信息', icon: 'none' })
								return
							}
							
							this.payingDeposit = true
							const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
							const createRes = await paymentCreate.create({
								appointment_id: appointmentId,
								payment_type: 'deposit',
								amount: this.infoFeeAmount
							})
							
							if (createRes.code !== 0) {
								this.payingDeposit = false
								uni.showToast({
									title: createRes.message || '创建订单失败',
									icon: 'none'
								})
								return
							}
							
							const payRes = await paymentCreate.mockPaySuccess({
								order_no: createRes.data.order_no
							})
							
							this.payingDeposit = false
							
							if (payRes.code === 0) {
								uni.showToast({
									title: '支付成功，聊天功能已开启',
									icon: 'success'
								})
								
								setTimeout(() => {
									this.loadUserInfo()
									this.refreshMessages()
								}, 1000)
							} else {
								uni.showToast({
									title: payRes.message || '支付失败',
									icon: 'none'
								})
							}
						} catch (error) {
							this.payingDeposit = false
							console.error('支付失败:', error)
							uni.showToast({ title: '支付失败，请稍后再试', icon: 'none' })
						}
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
	width: 40rpx;
	height: 40rpx;
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
	width: 60rpx;
	display: flex;
	align-items: center;
	justify-content: flex-end;
}

.navbar-more {
	width: 40rpx;
	height: 40rpx;
	color: #000000;
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

.deposit-tip {
	background: #FFF7E6;
	padding: 30rpx;
	border-bottom: 1rpx solid #FFE7A6;
}

.deposit-tip-text {
	font-size: 28rpx;
	color: #FF9500;
	display: block;
	margin-bottom: 20rpx;
	text-align: center;
}

.deposit-btn {
	background: #FF9500;
	border-radius: 10rpx;
	padding: 24rpx;
	text-align: center;
}

.deposit-btn-disabled {
	background: #E5E5E5;
	opacity: 0.6;
}

.deposit-btn-text {
	font-size: 28rpx;
	color: #FFFFFF;
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
	margin-bottom: 40rpx;
}

.empty-text {
	font-size: 28rpx;
	color: #999999;
}

/* CSS图标样式 */
.icon-arrow-left {
	width: 40rpx;
	height: 40rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-arrow-left::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%) rotate(45deg);
	width: 16rpx;
	height: 16rpx;
	border-left: 3rpx solid currentColor;
	border-bottom: 3rpx solid currentColor;
}

.icon-more {
	width: 40rpx;
	height: 40rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-more::before {
	content: '';
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-150%, -50%);
	width: 6rpx;
	height: 6rpx;
	background: currentColor;
	border-radius: 50%;
}
.icon-more::after {
	content: '';
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	width: 6rpx;
	height: 6rpx;
	background: currentColor;
	border-radius: 50%;
	box-shadow: 12rpx 0 0 currentColor;
}

/* 邀请试课按钮栏 */
.invite-trial-bar {
	padding: 12rpx 24rpx;
	background-color: #F5F5F5;
	border-bottom: 1rpx solid #E5E5E5;
}

.invite-trial-btn {
	width: 100%;
	height: 72rpx;
	background-color: #4A90E2;
	border-radius: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.invite-trial-btn-disabled {
	opacity: 0.6;
}

.invite-trial-btn-text {
	color: #FFFFFF;
	font-size: 28rpx;
	font-weight: 500;
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
</style>