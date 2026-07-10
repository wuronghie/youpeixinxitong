<template>
	<view style="background: #F5F5F5;">
		<!-- 状态栏 -->
		<view class="main-bg-color py-4 px-3 text-white text-center" :class="getStatusClass(appointment.status)">
			<text class="font-lg font-weight d-block">{{ getStatusText(appointment.status) }}</text>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 学生 + 预约信息（拆分为 setup 子组件） -->
				<appointment-basic-card :appointment="appointment" class="mb-3" />

				<!-- 费用信息（拆分为 setup 子组件） -->
				<appointment-fee-card
					:appointment="appointment"
					:info-fee-amount="infoFeeAmount"
					class="mb-3"
				/>

				<view v-if="showWaitingParentPay" class="mb-3 px-3 py-3 bg-white rounded">
					<text class="font-sm text-warning d-block">等待家长支付试课费</text>
					<text class="font-sm text-light-muted d-block mt-1">家长完成支付后，您才可以进行上课/下课打卡。</text>
				</view>

				<!-- 课堂打卡（家长已支付课程费 + 已确认/进行中） -->
				<attendance-clock-card
					v-if="showClockCard"
					:appointment-id="appointment._id"
					:status="appointment.status"
					:parent-paid="isParentCoursePaid"
					:class-started-at="appointment.class_started_at || null"
					:class-started-location="appointment.class_started_location || null"
					:class-ended-at="appointment.class_ended_at || null"
					:class-ended-location="appointment.class_ended_location || null"
					:schedule-start-ts="scheduleStartTs"
					:schedule-end-ts="scheduleEndTs"
					@clocked="onClocked"
				/>

				<!-- 退款信息 -->
				<card v-if="refundInfo" headTitle="退款申请" class="mb-3 border-left border-warning" style="border-left-width: 6rpx;">
					<view class="py-2 border-bottom">
						<text class="font-sm text-warning d-block mb-2">状态：{{ formatRefundStatus(refundInfo.status, refundInfo.teacher_review_status) }}</text>
						<text class="font-sm text-light-muted d-block mb-1">原因：{{ refundInfo.reason || '无' }}</text>
						<text class="font-sm text-light-muted d-block mb-1">说明：{{ refundInfo.description || '无' }}</text>
						<text class="font-sm text-light-muted d-block mb-1">退款金额：¥{{ (refundInfo.amount || 0).toFixed(2) }}</text>
						<text class="font-sm text-light-muted d-block mb-1">申请时间：{{ formatTime(refundInfo.create_time) }}</text>
						<text v-if="refundInfo.teacher_review_time" class="font-sm text-light-muted d-block mb-1">教师处理：{{ formatTime(refundInfo.teacher_review_time) }}</text>
						<text v-if="refundInfo.review_time" class="font-sm text-light-muted d-block">平台审核：{{ formatTime(refundInfo.review_time) }}</text>
					</view>
				</card>
			</view>
		</scroll-view>

		<!-- 操作按钮 -->
		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<button 
				v-if="(appointment.status === 'pending_confirm' || appointment.status === 'pending_payment') && !appointment.parent_paid"
				class="flex-1 border border-light-muted text-light-muted rounded px-3 py-2 font-sm mr-2"
				@click="handleReject"
			>
				拒绝预约
			</button>
			<button 
				v-if="(appointment.status === 'pending_confirm' || appointment.status === 'pending_payment') && !appointment.deposit_paid"
				class="flex-1 main-bg-color text-white rounded px-3 py-2 font-sm"
				@click="handlePayDeposit"
			>
				支付信息费（¥{{ infoFeeAmount }}）
			</button>
			<button 
				v-if="!isTeacherInvitedTrial && (appointment.status === 'pending_confirm' || appointment.status === 'pending_payment') && !appointment.parent_paid"
				class="flex-1 main-bg-color text-white rounded px-3 py-2 font-sm"
				@click="handleConfirm"
			>
				确认预约
			</button>
			<button 
				v-if="appointment.status === 'confirmed' && (appointment.deposit_paid === true || appointment.deposit_paid === 'true')"
				class="w-100 main-bg-color text-white rounded px-3 py-2 font-sm"
				@click="startChat"
			>
				开始聊天
			</button>
			<button
				v-if="refundInfo && refundInfo.status === 'pending' && refundInfo.teacher_review_status === 'pending'"
				class="flex-1 border border-light-muted text-light-muted rounded px-3 py-2 font-sm mr-2"
				@click="handleRefundReview('reject')"
			>
				拒绝退款
			</button>
			<button
				v-if="refundInfo && refundInfo.status === 'pending' && refundInfo.teacher_review_status === 'pending'"
				class="flex-1 main-bg-color text-white rounded px-3 py-2 font-sm"
				@click="handleRefundReview('approve')"
			>
				同意退款
			</button>
		</view>
		
		<!-- uni-pay 支付组件 -->
		<uni-pay 
			ref="pay" 
			height="70vh" 
			:to-success-page="false"
			return-url="/pages-teacher/appointment/detail" 
			logo="/static/logo.png" 
			@success="onPaySuccess" 
			@create="onPayCreate" 
			@fail="onPayFail"
		></uni-pay>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import AttendanceClockCard from '@/components/AttendanceClockCard.vue'
import AppointmentBasicCard from '@/components/AppointmentBasicCard.vue'
import AppointmentFeeCard from '@/components/AppointmentFeeCard.vue'
import { mockAppointments, useMockData } from '@/utils/mockData.js'
import { createAndPayWithUniPay, payExistingOrderWithUniPay } from '@/utils/payment.js'

export default {
	name: 'TeacherAppointmentDetail',
	components: {
		card,
		AttendanceClockCard,
		AppointmentBasicCard,
		AppointmentFeeCard
	},
	data() {
		return {
			appointmentId: '',
			appointment: {},
			refundInfo: null,
			useMock: true,
			isLoadingRefund: false,
			// 老师端自身课时费（元/小时），用于计算信息费 = 课时费 × 2（一节试课 2 小时费用）
			teacherHourlyRate: 0
		}
	},
	computed: {
		isTeacherInvitedTrial() {
			const apt = this.appointment || {}
			return apt.course_type === 'trial' && apt.invited_by === 'teacher'
		},
		// 信息费金额（元）= 老师课时费 × 2；老师未设置时按 1 元兜底（与后端 fallback 一致）
		infoFeeAmount() {
			const fromAppt = Number(this.appointment && this.appointment.hourly_rate) || 0
			const rate = fromAppt > 0 ? fromAppt : (Number(this.teacherHourlyRate) || 0)
			const fee = rate > 0 ? Number((rate * 2).toFixed(2)) : 0
			return fee > 0 ? fee : 1
		},
		infoFeeAmountCents() {
			return Math.round(this.infoFeeAmount * 100)
		},
		// 排课开始/结束时间戳（毫秒），供打卡卡片做时间窗口校验
		scheduleStartTs() {
			const apt = this.appointment || {}
			const schedule = apt.schedule || {}
			const date = schedule.date || apt.appointment_date || apt.date
			const startTime = schedule.start_time || apt.appointment_time || apt.start_time
			if (!date || !startTime) return 0
			const ts = new Date(`${date}T${startTime}:00`).getTime()
			return Number.isNaN(ts) ? 0 : ts
		},
		scheduleEndTs() {
			const start = this.scheduleStartTs
			if (!start) return 0
			const apt = this.appointment || {}
			const schedule = apt.schedule || {}
			if (schedule.end_time && (schedule.date || apt.appointment_date)) {
				const date = schedule.date || apt.appointment_date
				const ts = new Date(`${date}T${schedule.end_time}:00`).getTime()
				if (!Number.isNaN(ts)) return ts
			}
			const duration = Number(schedule.duration || apt.duration || 2)
			return start + duration * 3600 * 1000
		},
		// 打卡卡片：信息费已付 + 家长已付课程费（或已在打卡中）；未支付时隐藏打卡入口
		isParentCoursePaid() {
			const apt = this.appointment || {}
			return apt.parent_paid === true || apt.parent_paid === 'true' || !!apt.parent_paid_from_order
		},
		showClockCard() {
			const apt = this.appointment || {}
			if (!apt._id) return false
			const depositOk = apt.deposit_paid === true || apt.deposit_paid === 'true'
			if (!depositOk && !apt.class_started_at) return false
			if (!this.isParentCoursePaid && !apt.class_started_at) return false
			if (apt.class_started_at || apt.class_ended_at) return true
			return ['confirmed', 'in_progress'].includes(apt.status)
		},
		showWaitingParentPay() {
			const apt = this.appointment || {}
			if (!apt._id || this.isParentCoursePaid) return false
			if (apt.class_started_at || apt.class_ended_at) return false
			const depositOk = apt.deposit_paid === true || apt.deposit_paid === 'true'
			if (!depositOk) return false
			return ['confirmed', 'pending_confirm', 'pending_payment', 'in_progress'].includes(apt.status)
		}
	},
	onLoad(options) {
		this.appointmentId = options.id || 'appointment_001'
		this.useMock = useMockData() !== false
		this.loadTeacherHourlyRate()
		this.loadDetail()
	},
	onShow() {
		if (this.appointmentId) {
			this.loadDetail()
		}
	},
	methods: {
		async refreshData() {
			await this.loadDetail()
		},
		// 打卡成功后刷新详情，获取最新 class_started_at / class_ended_at
		onClocked() {
			this.loadDetail()
		},
		// 读取当前教师的 hourly_rate，供信息费金额展示用
		async loadTeacherHourlyRate() {
			try {
				const teacherProfile = uniCloud.importObject('teacher-profile', { customUI: true })
				const res = await teacherProfile.getProfile()
				if (res && res.code === 0 && res.data) {
					this.teacherHourlyRate = Number(res.data.hourly_rate) || 0
				}
			} catch (e) {
				// 忽略，保持 0；后端会二次校验金额
				console.warn('[信息费] 获取教师课时费失败，后续以预约 hourly_rate 为准:', e)
			}
		},
		async loadDetail() {
			// 保存当前支付状态（如果已支付）
			const currentDepositPaid = this.appointment?.deposit_paid
			const currentStatus = this.appointment?.status
			
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 300))
					const apt = mockAppointments.find(a => a._id === this.appointmentId) || mockAppointments[0]
					this.appointment = {
						...apt,
						student_name: '小明',
						student_grade: '初二',
						address: '深圳市南山区科技园',
						status: apt.status || 'pending_confirm',
						// 如果本地已标记为已支付，保留状态
						deposit_paid: currentDepositPaid !== undefined ? currentDepositPaid : (apt.deposit_paid || false)
					}
				} else {
					const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
					const res = await appointmentQuery.getAppointmentDetail({
						appointment_id: this.appointmentId
					})
					
					if (res.code === 0) {
						this.appointment = res.data
						
						// 1）检查当前预约绑定的会话中的 teacher_deposit_paid 状态
						try {
							const chatSend = uniCloud.importObject('chat-send', { customUI: true })
							const conversationRes = await chatSend.getConversation({ 
								appointment_id: this.appointmentId 
							})
							
							if (conversationRes.code === 0 && conversationRes.data) {
								// 如果会话中标记为已支付，更新预约状态
								if (conversationRes.data.teacher_deposit_paid) {
									this.appointment.deposit_paid = true
								}
							}
						} catch (error) {
							console.warn('检查会话状态失败:', error)
							// 如果检查失败，使用预约的 deposit_paid 状态
						}
						
						// 如果本地已标记为已支付，保留状态（云服务可能还没更新）
						if (currentDepositPaid !== undefined && currentDepositPaid) {
							this.appointment.deposit_paid = true
							if (currentStatus === 'pending_confirm') {
								this.appointment.status = 'confirmed'
							}
						}
						await this.loadRefund()
					} else {
						// 如果获取失败，保留当前状态
						if (currentDepositPaid !== undefined && currentDepositPaid && this.appointment) {
							this.appointment.deposit_paid = true
							if (currentStatus) {
								this.appointment.status = currentStatus
							}
						}
						uni.showToast({
							title: res.message || '加载失败',
							icon: 'none'
						})
					}
				}
			} catch (error) {
				console.error('加载失败:', error)
				// 如果获取失败，保留当前状态（避免覆盖已支付状态）
				if (currentDepositPaid !== undefined && currentDepositPaid && this.appointment) {
					this.appointment.deposit_paid = true
					if (currentStatus) {
						this.appointment.status = currentStatus
					}
				}
				uni.showToast({
					title: '加载失败',
					icon: 'none'
				})
			}
		},
		getStatusText(status) {
			const map = {
				pending_payment: '待家长支付',
				pending_confirm: '待确认',
				contact_request: '联系请求',  // 家长直接联系老师但还没预约
				confirmed: '已确认',
				in_progress: '进行中',
				completed: '已完成',
				rejected: '已拒绝',
				cancelled: '已取消',
				refunding: '退款中',
				refunded: '已退款'
			}
			return map[status] || '未知'
		},
		getStatusClass(status) {
			const map = {
				pending_payment: 'bg-warning',
				pending_confirm: 'bg-warning',
				contact_request: 'bg-warning',  // 联系请求使用警告色
				confirmed: 'bg-success',
				in_progress: 'bg-primary',
				completed: 'bg-success',
				rejected: 'bg-danger',
				cancelled: 'bg-light',
				refunding: 'bg-warning',
				refunded: 'bg-light'
			}
			return map[status] || ''
		},
		formatAddress(address) {
			if (!address) return ''
			if (typeof address === 'string') {
				// 对字符串地址进行去重处理
				return this.removeDuplicateAddress(address)
			}
			if (typeof address === 'object') {
				// 优先使用完整地址字段
				if (address.full || address.address) {
					const fullAddr = address.full || address.address
					return this.removeDuplicateAddress(fullAddr)
				}
				
				const detail = address.detail || ''
				const province = address.province || ''
				const city = address.city || ''
				const district = address.district || ''
				
				// 如果detail字段已包含完整地址（包含省市区），直接返回detail（去重后）
				if (detail) {
					const hasProvince = province && detail.includes(province)
					const hasCity = city && detail.includes(city)
					const hasDistrict = district && detail.includes(district)
					// 如果detail已包含省市区信息，说明是完整地址，直接返回（去重后）
					if (hasProvince || (hasCity && hasDistrict)) {
						return this.removeDuplicateAddress(detail)
					}
				}
				
				// 否则拼接省市区详细地址，避免重复
				const parts = []
				if (province) parts.push(province)
				if (city && city !== province) parts.push(city)
				if (district && district !== city && district !== province) parts.push(district)
				
				// 只有当detail不包含已添加的部分时才添加
				if (detail) {
					const hasAnyPart = parts.some(part => detail.includes(part))
					if (!hasAnyPart) {
						parts.push(detail)
					}
				}
				
				return parts.join('')
			}
			return ''
		},
		// 去除地址字符串中的重复内容（专门处理旧数据中的重复问题）
		removeDuplicateAddress(addressStr) {
			if (!addressStr || typeof addressStr !== 'string') return addressStr
			
			let result = addressStr.trim()
			if (result.length < 10) return result
			
			// 1. 首先移除地址单位的重复，如 "市市"、"区区"、"省省" 等
			result = result.replace(/([省市县区街道镇乡])\1+/g, '$1')
			
			// 2. 检查是否有完全重复（前后半部分完全相同）
			const mid = Math.floor(result.length / 2)
			const firstHalf = result.substring(0, mid)
			const secondHalf = result.substring(mid)
			
			if (firstHalf === secondHalf) {
				return firstHalf.trim()
			}
			
			// 3. 检查后半部分是否包含前半部分（处理部分重复）
			if (firstHalf.length >= 5 && secondHalf.includes(firstHalf)) {
				const index = secondHalf.indexOf(firstHalf)
				if (index === 0) {
					// 后半部分以前半部分开头，说明完全重复
					return firstHalf.trim()
				} else {
					// 部分重复，移除重复部分
					return (firstHalf + secondHalf.substring(0, index) + secondHalf.substring(index + firstHalf.length)).trim()
				}
			}
			
			// 4. 使用滑动窗口检测重复片段（从长到短）
			for (let len = Math.min(25, Math.floor(result.length / 2)); len >= 4; len--) {
				const pattern = new RegExp(`(.{${len}})(\\1)+`, 'g')
				let changed = false
				result = result.replace(pattern, (match, segment) => {
					changed = true
					return segment
				})
				// 如果发现并移除了重复，重新开始检查（可能有多层重复）
				if (changed) {
					len = Math.min(25, Math.floor(result.length / 2)) + 1
					// 再次清理地址单位重复
					result = result.replace(/([省市县区街道镇乡])\1+/g, '$1')
				}
			}
			
			// 5. 特殊处理常见地址重复模式
			// 匹配类似 "广东省深圳市南山区广东省深圳市南山区" 的模式
			const duplicatePattern = /^(.+?)(省|市|区|县|街道|镇|乡)(.+?)(省|市|区|县|街道|镇|乡)(.+?)(省|市|区|县|街道|镇|乡)(\1\2\3\4\5\6)/g
			result = result.replace(duplicatePattern, '$1$2$3$4$5$6')
			
			// 6. 最后清理地址单位重复和空格
			result = result.replace(/([省市县区街道镇乡])\1+/g, '$1').replace(/\s+/g, '').trim()
			
			return result || addressStr
		},
		async loadRefund() {
			if (!this.appointmentId) return
			this.isLoadingRefund = true
			try {
				const refundObj = uniCloud.importObject('payment-refund', { customUI: true })
				const orderId = this.appointment.parent_payment_order_id
					|| this.appointment.course_order_id
					|| this.appointment.payment_order_id
					|| this.appointment.order_id
				const refundId = this.appointment.refund_id || this.appointment.refund_request_id
				const params = {}
				if (orderId) params.order_id = orderId
				if (refundId) params.refund_id = refundId
				const res = await refundObj.getDetail(params)
				if (res.code === 0 && res.data) {
					this.refundInfo = res.data
				} else {
					this.refundInfo = null
				}
			} catch (error) {
				this.refundInfo = null
			} finally {
				this.isLoadingRefund = false
			}
		},
		async handleReject() {
			uni.showModal({
				title: '拒绝预约',
				placeholderText: '请输入拒绝原因（可选）',
				editable: true,
				success: async (res) => {
					if (res.confirm) {
						try {
							const userInfo = uni.getStorageSync('userInfo') || {}
							if (!userInfo.uid) {
								uni.showToast({ title: '请先登录', icon: 'none' })
								return
							}
							
							const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
							const result = await appointmentQuery.rejectAppointment({
								appointment_id: this.appointmentId,
								reason: res.content || '教师拒绝'
							})
							
							if (result.code === 0) {
								uni.showToast({
									title: result.message || '已拒绝',
									icon: 'success'
								})
								setTimeout(() => {
									uni.navigateBack()
								}, 1500)
							} else {
								uni.showToast({
									title: result.message || '拒绝失败',
									icon: 'none'
								})
							}
						} catch (error) {
							console.error('拒绝失败:', error)
							uni.showToast({ title: '操作失败', icon: 'none' })
						}
					}
				}
			})
		},
		async handlePayDeposit() {
			// 检查登录状态
							const userInfo = uni.getStorageSync('userInfo') || {}
							if (!userInfo.uid) {
								uni.showToast({ title: '请先登录', icon: 'none' })
								return
							}
							
			// 先检查会话中的 teacher_deposit_paid 状态（最准确）
			try {
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const conversationRes = await chatSend.getConversation({ 
					appointment_id: this.appointmentId 
				})
				
				if (conversationRes.code === 0 && conversationRes.data && conversationRes.data.teacher_deposit_paid) {
					// 已支付过信息费，更新本地状态并提示
					this.appointment.deposit_paid = true
					uni.showModal({
						title: '提示',
						content: '您已支付过信息费，无需重复支付。',
						showCancel: false,
						confirmText: '确定',
						success: () => {
							this.loadDetail()
						}
					})
					return
				}
			} catch (error) {
				console.warn('[支付信息费] 检查会话状态失败，继续检查订单:', error)
			}
			
			// 再检查是否已有已支付的订单
			try {
				const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
				const orderListRes = await paymentCreate.getOrderList({
					appointment_id: this.appointmentId,
					payment_type: 'deposit',
					status: 'all',
					page: 1,
					pageSize: 10
				})
				
				if (orderListRes.code === 0 && orderListRes.data && orderListRes.data.list) {
					// 查找已支付的订单
					const paidOrder = orderListRes.data.list.find(order => 
						order.status === 'paid' || order.status === 'success'
					)
					
					if (paidOrder) {
						uni.showModal({
							title: '提示',
							content: '您已支付过信息费，无需重复支付。',
							showCancel: false,
							confirmText: '确定',
							success: () => {
								// 刷新页面状态
								this.loadDetail()
							}
						})
						return
					}
					
					// 查找待支付的订单
					const pendingOrder = orderListRes.data.list.find(order => 
						order.status === 'pending' || order.status === 'unpaid'
					)
					
					if (pendingOrder) {
						// 如果有待支付的订单，直接使用该订单进行支付
						console.log('[支付信息费] 找到待支付订单，使用现有订单:', pendingOrder.order_no)
						// 直接使用现有订单进行支付
						uni.showModal({
							title: '支付信息费',
							content: `支付${this.infoFeeAmount}元信息费（= 课时费 ¥${this.teacherHourlyRate || (this.appointment && this.appointment.hourly_rate) || 0} × 2，一节 2 小时）后可开启与家长的聊天。\n信息费由平台收取，试课成功或失败均不退回。`,
							success: async (res) => {
								if (!res.confirm) return
								await this.payWithExistingOrder(pendingOrder.order_no)
							}
						})
						return
					}
				}
			} catch (error) {
				console.warn('[支付信息费] 检查现有订单失败，继续创建新订单:', error)
			}
			
			uni.showModal({
				title: '支付信息费',
				content: `支付${this.infoFeeAmount}元信息费（= 课时费 ¥${this.teacherHourlyRate || (this.appointment && this.appointment.hourly_rate) || 0} × 2，一节 2 小时）后可开启与家长的聊天。\n信息费由平台收取，试课成功或失败均不退回。`,
				success: async (res) => {
					if (!res.confirm) return
					
					// 显示加载提示
					uni.showLoading({ title: '创建订单中...', mask: true })
					
					try {
						const payComponent = this.$refs.pay
						
						// 检查 uni-pay 组件是否可用
						// 如果组件存在但可能未初始化，也使用模拟支付
						if (payComponent && typeof payComponent.open === 'function') {
							uni.hideLoading()
							try {
								// uni-pay 组件支付，结果通过 @success、@fail 事件返回
								await createAndPayWithUniPay(payComponent, {
									appointment_id: this.appointmentId,
									payment_type: 'deposit',
									amount: this.infoFeeAmountCents, // 信息费 = hourly_rate × 2（单位：分）
									description: '支付信息费'
								})
								// 支付结果会在 onPaySuccess 或 onPayFail 中处理
								return // 成功调用 uni-pay，等待事件回调
							} catch (error) {
								console.warn('uni-pay 组件调用失败:', error)
								
								// 检查错误信息，如果是"已支付过"，查找现有订单
								if (error.message && error.message.includes('已支付过')) {
									uni.hideLoading()
									try {
							const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
										const orderListRes = await paymentCreate.getOrderList({
											appointment_id: this.appointmentId,
											payment_type: 'deposit',
											status: 'all',
											page: 1,
											pageSize: 10
										})
										
										if (orderListRes.code === 0 && orderListRes.data && orderListRes.data.list) {
											const paidOrder = orderListRes.data.list.find(order => 
												order.status === 'paid' || order.status === 'success'
											)
											
											if (paidOrder) {
												uni.showModal({
													title: '提示',
													content: '您已支付过信息费，无需重复支付。',
													showCancel: false,
													confirmText: '确定',
													success: () => {
														this.loadDetail()
													}
												})
												return // 已支付，直接返回
											}
											
											// 如果有待支付的订单，使用它
											const pendingOrder = orderListRes.data.list.find(order => 
												order.status === 'pending' || order.status === 'unpaid'
											)
											
											if (pendingOrder) {
												// 使用现有订单进行支付
												await this.payWithExistingOrder(pendingOrder.order_no)
												return // 使用现有订单支付，直接返回
											}
										}
										
										// 如果找不到订单，提示用户
										uni.showModal({
											title: '提示',
											content: '您已支付过信息费，无需重复支付。',
											showCancel: false,
											confirmText: '确定',
											success: () => {
												this.loadDetail()
											}
										})
										return // 找不到订单但提示已支付，直接返回
									} catch (checkError) {
										console.error('[支付信息费] 检查现有订单失败:', checkError)
										// 检查失败，也提示用户
										uni.showModal({
											title: '提示',
											content: '您已支付过信息费，无需重复支付。',
											showCancel: false,
											confirmText: '确定',
											success: () => {
												this.loadDetail()
											}
										})
										return // 检查失败，直接返回
									}
								}
								
								// 如果 uni-pay 调用失败，且不是"已支付过"的错误，提示用户重试
								uni.showToast({
									title: error.message || '无法打开支付界面，请稍后重试',
									icon: 'none',
									duration: 2000
								})
								return
							}
						}

						uni.hideLoading()
						uni.showToast({
							title: '支付组件未就绪，请稍后重试',
							icon: 'none',
							duration: 2000
						})
					} catch (error) {
						uni.hideLoading()
						console.error('支付信息费失败:', error)
						uni.showToast({ 
							title: error.message || '支付失败，请稍后重试', 
							icon: 'none',
							duration: 2000
						})
					}
				},
				fail: () => {
					// 用户取消弹窗
					uni.hideLoading()
				}
			})
		},
		// uni-pay 组件事件：订单创建成功
		onPayCreate(res) {
			console.log('支付订单创建成功:', res)
		},
		// uni-pay 组件事件：支付成功
		async onPaySuccess(res) {
			console.log('[支付成功] uni-pay 回调:', res)
			
			// 检查是否真的支付成功
			const isPaid = res.has_paid || res.status === 1 || res.user_order_success
			if (!isPaid) {
				console.warn('[支付成功] 支付成功事件但状态异常:', res)
				return
			}

			// 获取订单信息
			const order_no = res.order_no || res.pay_order?.order_no
			const out_trade_no = res.out_trade_no
			const custom = res.custom || {}
			const order_id = custom.order_id // 从 custom 中获取订单ID
			
			console.log('[支付成功] 订单信息:', {
				order_no,
				out_trade_no,
				order_id,
				appointment_id: custom.appointment_id,
				payment_type: custom.payment_type
			})
			
			try {
				const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
				
				// 方法1: 如果有 order_no，直接使用
				let finalOrderNo = order_no
				
				// 方法2: 如果没有 order_no，通过 appointment_id 查找订单
				if (!finalOrderNo) {
					console.log('[支付成功] 未找到 order_no，通过 appointment_id 查找订单...')
					const orderListRes = await paymentCreate.getOrderList({
						appointment_id: this.appointmentId || custom.appointment_id,
						payment_type: custom.payment_type || 'deposit',
						status: 'all',
						page: 1,
						pageSize: 10 // 扩大搜索范围
					})
					
					if (orderListRes.code === 0 && orderListRes.data && orderListRes.data.list && orderListRes.data.list.length > 0) {
						// 优先使用待支付的订单
						const pendingOrder = orderListRes.data.list.find(order => 
							order.status === 'pending' || order.status === 'unpaid'
						)
						finalOrderNo = pendingOrder ? pendingOrder.order_no : orderListRes.data.list[0].order_no
						console.log('[支付成功] 找到订单:', finalOrderNo)
					}
				}
				
				if (!finalOrderNo) {
					throw new Error('无法获取订单号，请稍后刷新页面查看支付状态')
				}
				
				// 更新订单状态（将 pending 状态更新为 paid）
				console.log('[支付成功] 更新订单状态，order_no:', finalOrderNo)
				const payRes = await paymentCreate.mockPaySuccess({
					order_no: finalOrderNo,
					out_trade_no: out_trade_no, // 传递 out_trade_no，供退款时使用
					uni_pay_order_no: order_no
				})
				
				if (payRes.code === 0) {
					console.log('[支付成功] 数据库更新成功:', {
						appointment_status: payRes.data?.appointment_status,
						order_no: finalOrderNo
					})
					
					// 更新本地状态
					if (this.appointment) {
						this.appointment.deposit_paid = true
						// 支付信息费后不自动确认，保持 pending_confirm 状态，需要老师手动确认
						// this.appointment.status = this.appointment.status === 'pending_confirm' ? 'confirmed' : this.appointment.status
					}
					
					uni.showToast({ 
						title: '支付成功，请确认预约', 
						icon: 'success',
						duration: 2000
								})
								
					// 延迟刷新详情，确保状态更新
					setTimeout(() => {
						this.loadDetail()
					}, 1000)
				} else {
					throw new Error(payRes.message || '更新订单状态失败')
				}
			} catch (error) {
				console.error('[支付成功] 更新数据库失败:', error)
				uni.showToast({ 
					title: error.message || '支付成功，但更新状态失败，请刷新页面查看', 
					icon: 'none',
					duration: 3000
				})
				// 即使更新失败，也刷新页面，可能云函数已经更新了
				setTimeout(() => {
					this.loadDetail()
				}, 2000)
			}
		},
		// uni-pay 组件事件：支付失败
		onPayFail(err) {
			console.error('支付失败:', err)
			if (err.errMsg && !err.errMsg.includes('cancel')) {
				uni.showToast({ 
					title: err.errMsg || '支付失败', 
					icon: 'none',
					duration: 2000
				})
			}
		},
		async handleConfirm() {
			uni.showModal({
				title: '确认预约',
				content: '确认接受该预约？确认后家长将收到通知，可以开始准备上课。',
				success: async (res) => {
					if (!res.confirm) return
					
					try {
						uni.showLoading({ title: '确认中...', mask: true })
						
						const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
						const result = await appointmentQuery.confirmAppointment({
							appointment_id: this.appointmentId
						})
						
						uni.hideLoading()
						
						if (result.code === 0) {
							uni.showToast({
								title: '预约已确认',
								icon: 'success'
							})
								setTimeout(() => {
									this.loadDetail()
								}, 1000)
							} else {
								uni.showToast({
								title: result.message || '确认失败',
									icon: 'none'
								})
							}
						} catch (error) {
						uni.hideLoading()
						console.error('确认预约失败:', error)
						uni.showToast({ title: '操作失败', icon: 'none' })
					}
				}
			})
		},
		startChat() {
			uni.navigateTo({
				url: `/pages-teacher/chat/conversation?appointmentId=${this.appointmentId}`
			})
		},
		async handleRefundReview(action) {
			if (!this.refundInfo) return
			const confirmText = action === 'approve' ? '确认同意退款？' : '确认驳回退款申请？'
			uni.showModal({
				title: '退款审核',
				content: confirmText,
				editable: action === 'reject',
				placeholderText: '请输入处理意见（选填）',
				success: async res => {
					if (!res.confirm) return
					try {
						const refundObj = uniCloud.importObject('payment-refund', { customUI: true })
						const result = await refundObj.teacherReview({
							refund_id: this.refundInfo._id,
							action,
							opinion: res.content || ''
						})
						if (result.code === 0) {
							uni.showToast({ title: action === 'approve' ? '已同意退款' : '已驳回退款', icon: 'success' })
							await this.loadRefund()
						} else {
							uni.showToast({ title: result.message || '操作失败', icon: 'none' })
						}
					} catch (error) {
						console.error('教师审核退款失败:', error)
						uni.showToast({ title: '操作失败', icon: 'none' })
					}
				}
			})
		},
		formatRefundStatus(status, teacherStatus) {
			if (status === 'pending') {
				return teacherStatus === 'pending' ? '待教师处理' : '待平台审核'
			}
			if (status === 'processing') {
				return '平台处理中'
			}
			if (status === 'success') {
				return '已退款'
			}
			if (status === 'rejected') {
				return teacherStatus === 'rejected' ? '教师驳回' : '平台驳回'
			}
			return '处理中'
		},
		formatTime(timestamp) {
			if (!timestamp) return ''
			const date = new Date(timestamp)
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${month}-${day} ${hour}:${minute}`
		},
		/**
		 * 使用现有订单进行支付
		 */
		async payWithExistingOrder(orderNo) {
			const payComponent = this.$refs.pay
			if (!payComponent || typeof payComponent.open !== 'function') {
				uni.showToast({
					title: '支付组件未就绪，请稍后重试',
					icon: 'none',
					duration: 2000
				})
				return
			}

			try {
				await payExistingOrderWithUniPay(payComponent, {
					order_no: orderNo,
					appointment_id: this.appointmentId,
					payment_type: 'deposit',
					amount: this.infoFeeAmountCents,
					description: '支付信息费'
				})
			} catch (error) {
				console.error('[支付信息费] 打开支付界面失败:', error)
				uni.showToast({
					title: error.message || '支付失败，请稍后重试',
					icon: 'none',
					duration: 2000
				})
			}
		}
	}
}
</script>

<style scoped>
.scroll {
	flex: 1;
	height: calc(100vh - 300rpx);
	padding-bottom: 160rpx;
}
</style>