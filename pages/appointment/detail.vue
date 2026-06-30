<template>
	<view>
		<!-- 状态头部 -->
		<view class="main-bg-color text-white p-4 d-flex a-end j-sb" style="height: 300rpx;">
			<view class="mb-3">
				<view class="font-lg font-weight">{{ formatStatus(appointment.status) }}</view>
				<view class="font-sm mt-2" style="opacity: 0.85;">{{ statusTip }}</view>
			</view>
			<view class="iconfont icon-dingdan line-h mb-3" style="font-size: 100rpx;opacity: 0.3;"></view>
		</view>

		<!-- 教师信息 -->
		<view class="bg-white mb-2" style="padding: 24rpx 32rpx;">
			<view class="d-flex a-center">
				<image 
					class="rounded-circle" 
					:src="appointment.teacher_avatar || defaultAvatarUrl" 
					mode="aspectFill"
					style="width: 120rpx;height: 120rpx;"
				/>
				<view class="ml-3 flex-1">
					<view class="d-flex a-center mb-1">
						<text class="font-md font-weight">{{ appointment.teacher_name || '教师' }}</text>
						<text v-if="appointment.teacher_verified" class="ml-2 bg-light-secondary text-primary rounded px-2 py-1 font-sm">认证</text>
					</view>
					<text class="font-sm text-light-muted mb-1 d-block">{{ appointment.subject || '科目待确认' }}</text>
					<view class="d-flex a-center">
						<text class="main-text-color font-sm mr-3">¥{{ appointment.hourly_rate || 100 }}/小时</text>
						<text class="text-light-muted font-sm">课程类型：{{ formatCourseType(appointment.course_type) }}</text>
					</view>
				</view>
			</view>
		</view>

		<divider></divider>

		<!-- 预约信息 -->
		<card headTitle="预约信息" bodyPadding>
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">预约号</text>
				<text class="font-sm">{{ appointment.appointment_no || '-' }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">预约时间</text>
				<text class="font-sm">{{ appointment.date }} {{ appointment.time }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">课时长度</text>
				<text class="font-sm">{{ appointment.duration || 2 }} 小时</text>
			</view>
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">授课方式</text>
				<text class="font-sm">{{ appointment.lesson_mode === 'online' ? '线上授课' : '线下授课' }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2" v-if="appointment.lesson_mode !== 'online'">
				<text class="font-sm text-light-muted">上课地址</text>
				<text class="font-sm">{{ appointment.address || '待教师确认' }}</text>
			</view>
		</card>

		<divider></divider>

		<!-- 学生信息 -->
		<card headTitle="学生信息" bodyPadding>
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">学生姓名</text>
				<text class="font-sm">{{ appointment.student_name || '未填写' }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2 border-bottom">
				<text class="font-sm text-light-muted">年级</text>
				<text class="font-sm">{{ appointment.student_grade || '未填写' }}</text>
			</view>
			<view class="d-flex a-center j-sb py-2">
				<text class="font-sm text-light-muted">备注</text>
				<text class="font-sm">{{ appointment.requirements || '暂无' }}</text>
			</view>
		</card>

		<divider></divider>

		<!-- 费用信息 -->
		<card headTitle="费用信息" bodyPadding>
			<view class="d-flex a-center j-sb py-2">
				<text class="font-md main-text-color">课程费用</text>
				<text class="font-md main-text-color font-weight">¥{{ Number(appointment.amount || 0).toFixed(2) }}</text>
			</view>
			<!-- 优惠券选择 -->
			<view 
				class="d-flex a-center j-sb py-2 border-top"
				v-if="canPayCourse"
				@click="openCouponSelector"
			>
				<text class="font-sm">优惠券</text>
				<view class="d-flex a-center">
					<text 
						class="font-sm"
						:class="canUseCoupon ? 'main-text-color' : 'text-light-muted'"
					>
						{{ couponDisplayText }}
					</text>
					<text class="iconfont icon-you text-light-muted ml-1"></text>
				</view>
			</view>
			<!-- 已选优惠券与实付金额展示 -->
			<view v-if="couponDiscountAmount > 0" class="d-flex a-center j-sb py-2">
				<text class="font-sm text-light-muted">已减优惠</text>
				<text class="font-sm main-text-color">-¥{{ Number(couponDiscountAmount || 0).toFixed(2) }}</text>
			</view>
			<view v-if="couponDiscountAmount > 0" class="d-flex a-center j-sb py-2">
				<text class="font-sm text-light-muted">应付金额</text>
				<text class="font-md main-text-color font-weight">¥{{ Number(payableAmount || 0).toFixed(2) }}</text>
			</view>
			<view class="mt-2 pt-2 border-top">
				<text class="font-sm text-light-muted" v-if="appointment.course_type === 'trial'">
					课程结束后由您确认结果：
					· 试课成功 → 教师拿 70%、平台收 30%，教师之前支付的信息费由平台收取；
					· 试课不满意 → 同样 70%/30% 分账，教师之前支付的信息费全额退回教师钱包，平台不会自动退您的钱；
					· 如遇老师爽约/欺诈等异常情况，请在确认结果之前使用「异常情况申请退款」入口，由平台管理员审核后处理；
					· 一旦您点击「去评价并确认结果」提交，视为认可本次结算，将不可再申请退款。
				</text>
				<text class="font-sm text-light-muted" v-else>
					您与该老师试课成功一次后，后续正式课平台不收费。优惠券由平台承担，老师获得完整课程金额；家长确认课程完成后结算到教师钱包并生成收支流水。一旦您点击「去评价并确认完成」提交，将不可再申请退款。
				</text>
			</view>
		</card>

		<!-- 老师打卡进度（只读） -->
		<attendance-progress-card
			v-if="showAttendanceProgress"
			:class-started-at="appointment.class_started_at || null"
			:class-started-location="appointment.class_started_location || null"
			:class-ended-at="appointment.class_ended_at || null"
			:class-ended-location="appointment.class_ended_location || null"
			:schedule-end-ts="scheduleEndTs"
		/>

		<divider></divider>

		<!-- 底部操作栏 -->
		<view 
			v-if="hasActionButtons" 
			class="action-bar-placeholder"
		></view>
		<view 
			v-if="hasActionButtons" 
			class="action-bar"
		>
			<view class="action-buttons">
				<view class="action-buttons__main">
				<!-- 主要操作按钮（实心） -->
				<button 
					v-if="canPayCourse" 
					class="action-btn action-btn-primary" 
					@click="handlePay"
				>
					{{ payButtonText }}
				</button>
				<!-- 已支付课程费 + 老师已下课打卡后，单一“去评价并确认结果”入口（合并 家长确认 + 评价） -->
				<button
					v-if="canShowConfirmButton"
					class="action-btn action-btn-primary"
					@click="goReviewAndConfirm"
				>
					{{ appointment.course_type === 'trial' ? '去评价并确认结果' : '去评价并确认完成' }}
				</button>
				<view
					v-else-if="canShowWaitingClockOut"
					class="action-btn action-btn-disabled"
				>
					等待老师下课打卡
				</view>
				<button
					v-if="canRefund"
					class="action-refund-link"
					@click="handleRefund"
				>
					遇到老师爽约等异常？申请退款
				</button>
				</view>
				<button 
					v-if="appointment.status === 'completed' && !appointment.has_review" 
					class="action-btn action-btn-primary" 
					@click="createReview"
				>
					发表评价
				</button>
				
				<!-- 次要操作按钮（边框）：仅在未支付且待确认时显示“联系老师” -->
				<button 
					v-if="appointment.status === 'pending_confirm' && !canPayCourse && !isParentPaid" 
					class="action-btn action-btn-outline" 
					@click="contactTeacher"
				>
					联系老师
				</button>
			</view>
		</view>
		
		<!-- uni-pay 支付组件 -->
		<uni-pay 
			ref="pay" 
			height="70vh" 
			:to-success-page="false"
			return-url="/pages/appointment/detail" 
			logo="/static/logo.png" 
			@success="onPaySuccess" 
			@create="onPayCreate" 
			@fail="onPayFail"
		></uni-pay>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import divider from '@/components/common/divider.vue'
import AttendanceProgressCard from '@/components/AttendanceProgressCard.vue'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { createAndPay, createAndPayWithUniPay } from '@/utils/payment.js'

export default {
	name: 'AppointmentDetail',
	components: {
		card,
		divider,
		AttendanceProgressCard
	},
	data() {
		return {
			appointmentId: '',
			confirmAppointmentId: '',
			appointment: {},
			// 优惠券相关
			availableCoupons: [],
			couponPreview: null, // 试算结果：originalAmount / discountAmount / payableAmount 等
			couponLoading: false,
			isLoading: false,
			isRefreshing: false,
			scrollTop: 0,
			canRefresh: true,
			// 默认头像URL（从CDN）
			defaultAvatarUrl: getDefaultAvatarUrl()
		}
	},
	onLoad(options) {
		this.appointmentId = options.id || ''
		if (!this.appointmentId) {
			uni.showToast({ title: '预约ID不能为空', icon: 'none' })
			setTimeout(() => uni.navigateBack(), 1500)
			return
		}
		this.loadDetail()
	},
	// 从其他页面返回（例如提交评价后）时刷新一次详情，确保状态最新
	onShow() {
		if (this.appointmentId) {
			this.loadDetail()
		}
	},
	computed: {
		statusTip() {
			const map = {
				pending_payment: this.isTeacherInvitedTrial
					? '请尽快完成试课费用支付，支付后即可安排试课'
					: '请尽快完成课程费用支付，确认预约信息',
				pending_confirm: this.isTeacherInvitedTrial
					? '请尽快完成试课费用支付'
					: '老师正在确认中，稍后请留意消息',
				confirmed: '预约已确认，等待上课',
				in_progress: '课程进行中，如有变更请及时联系老师',
				completed: '课程已完成，欢迎给予评价',
				rejected: '预约已被教师拒绝，课程费用将原路退回',
				cancelled: '预约已取消，可重新选择老师',
				refunding: '退款申请处理中，请耐心等待平台或教师处理',
				refunded: '预约已退款，资金将在 1-3 个工作日内退回'
			}
			return map[this.appointment.status] || ''
		},
		canConfirmCompletion() {
			// 必须同时满足：本单已支付 + 教师已下课打卡 + 未评价
			if (!this.appointment || !this.isParentPaid) {
				return false
			}
			if (!this.appointment.class_ended_at) {
				return false
			}
			if (this.appointment.has_review) {
				return false
			}
			const blockedStatuses = ['completed', 'cancelled', 'refunded', 'refunding', 'rejected', 'pending_payment', 'trial_invited']
			return !blockedStatuses.includes(this.appointment.status)
		},
		isParentPaid() {
			const apt = this.appointment || {}
			return apt.parent_paid === true ||
				apt.parent_paid === 'true' ||
				!!apt.parent_paid_from_order ||
				!!apt.parent_paid_from_record ||
				!!(apt.parent_payment_time || apt.payment_time)
		},
		confirmActionId() {
			return this.appointmentId
		},
		canPayCourse() {
			if (!this.appointment || this.isParentPaid) {
				return false
			}
			if (['pending_payment', 'confirmed', 'in_progress'].includes(this.appointment.status)) {
				return true
			}
			if (this.isTeacherInvitedTrial) {
				return ['pending_payment', 'pending_confirm', 'confirmed', 'in_progress'].includes(this.appointment.status)
			}
			return false
		},
		isTeacherInvitedTrial() {
			const apt = this.appointment || {}
			return apt.course_type === 'trial' && apt.invited_by === 'teacher'
		},
		// 是否有可用优惠券（根据列表和金额动态判断）
		canUseCoupon() {
			if (!this.appointment) return false
			const amount = Number(this.appointment.amount || 0)
			if (!amount) return false
			if (!this.availableCoupons || this.availableCoupons.length === 0) return false
			// 简单按最低消费本地筛一遍
			return this.availableCoupons.some(c => {
				const min = Number(c.min_spend || 0)
				return !min || amount >= min
			})
		},
		// 实际应付金额（考虑优惠券）
		payableAmount() {
			const base = Number(this.appointment?.amount || 0)
			if (!this.couponPreview) return base
			const pRaw = this.couponPreview.payableAmount
			const p = Number(pRaw)
			// 仅当 pay 为空或不是数字时才回退到原价，0 元也是合法值，不能被当成“无效”
			if (pRaw === undefined || pRaw === null || Number.isNaN(p)) return base
			return p
		},
		// 优惠金额
		couponDiscountAmount() {
			const base = Number(this.appointment?.amount || 0)
			const pay = Number(this.payableAmount)
			if (!base || Number.isNaN(pay) || pay < 0) return 0
			const diff = base - pay
			return diff > 0 ? diff : 0
		},
		// 费用区块里优惠券行的展示文案
		couponDisplayText() {
			if (!this.canUseCoupon) {
				return '暂无可用优惠券'
			}
			if (this.couponPreview && this.couponPreview.couponName) {
				const discount = Number(this.couponDiscountAmount || 0)
				if (discount > 0) {
					return `${this.couponPreview.couponName} 已减¥${discount.toFixed(2)}`
				}
				return this.couponPreview.couponName
			}
			return '请选择优惠券'
		},
		canRefund() {
			if (!this.appointment || !this.isParentPaid) {
				return false
			}
			if (this.appointment.has_review) {
				return false
			}
			const allowStatuses = ['pending_confirm', 'confirmed', 'in_progress']
			const disallowStatuses = ['refunding', 'refunded', 'cancelled', 'rejected', 'completed']
			return allowStatuses.includes(this.appointment.status) && !disallowStatuses.includes(this.appointment.status)
		},
		payButtonText() {
			return '支付课程费'
		},
		canTrialRefund() {
			if (!this.appointment || this.appointment.course_type !== 'trial') {
				return false
			}
			if (!this.isParentPaid) {
				return false
			}
			if (this.appointment.has_review) {
				return false
			}
			const allowStatuses = ['confirmed', 'in_progress']
			return allowStatuses.includes(this.appointment.status)
		},
		hasActionButtons() {
			return this.canPayCourse ||
			       this.canShowWaitingClockOut ||
			       this.canShowConfirmButton ||
			       (this.appointment.status === 'completed' && !this.appointment.has_review) ||
			       this.canRefund ||
			       (this.appointment.status === 'pending_confirm' && !this.isParentPaid && !this.canPayCourse)
		},
		canShowConfirmButton() {
			return !this.canPayCourse && this.canConfirmCompletion && !!this.appointment.class_ended_at
		},
		canShowWaitingClockOut() {
			return this.isParentPaid && !this.canPayCourse && !this.appointment.class_ended_at &&
				!this.appointment.has_review &&
				['pending_confirm', 'confirmed', 'in_progress'].includes(this.appointment.status)
		},
		// 排课结束时间戳（毫秒），仅供打卡进度卡片展示用
		scheduleEndTs() {
			const apt = this.appointment || {}
			const schedule = apt.schedule || {}
			const date = schedule.date || apt.appointment_date || apt.date
			const startTime = schedule.start_time || apt.appointment_time || apt.start_time
			if (!date || !startTime) return 0
			const startTs = new Date(`${date}T${startTime}:00`).getTime()
			if (Number.isNaN(startTs)) return 0
			if (schedule.end_time) {
				const ts = new Date(`${date}T${schedule.end_time}:00`).getTime()
				if (!Number.isNaN(ts)) return ts
			}
			const duration = Number(schedule.duration || apt.duration || 2)
			return startTs + duration * 3600 * 1000
		},
		// 打卡进度：家长已支付后展示
		showAttendanceProgress() {
			const apt = this.appointment || {}
			if (!apt._id || !this.isParentPaid) return false
			if (apt.class_started_at || apt.class_ended_at) return true
			return ['confirmed', 'in_progress', 'pending_confirm', 'completed'].includes(apt.status)
		},
		hasAttendanceInfo() {
			const apt = this.appointment || {}
			return !!(apt.class_started_at || apt.class_ended_at)
		},
	},
	methods: {
		async refreshData() {
			if (this.appointmentId) {
				await this.loadDetail()
			}
		},
		async loadDetail() {
			if (this.isLoading) return
			this.isLoading = true
			
			// 仅在同一条预约刷新时保留本地支付状态，避免串单
			const isSameAppointment = this.appointment?._id === this.appointmentId
			const currentParentPaid = isSameAppointment ? this.appointment?.parent_paid : false
			const currentStatus = isSameAppointment ? this.appointment?.status : null
			
			try {
				const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
				const res = await appointmentQuery.getAppointmentDetail({ appointment_id: this.appointmentId })
				if (res.code === 0 && res.data) {
					const data = res.data
					console.log('[appointment/detail] getAppointmentDetail 返回:', {
						requestAppointmentId: this.appointmentId,
						returnedAppointmentId: data._id,
						status: data.status,
						parent_paid: data.parent_paid,
						has_review: data.has_review,
						class_started_at: data.class_started_at || null,
						class_started_location: data.class_started_location || null,
						class_ended_at: data.class_ended_at || null,
						class_ended_location: data.class_ended_location || null
					})
					this.appointment = {
						_id: data._id,
						appointment_no: data.appointment_no,
						teacher_name: data.teacher_info?.display_name || data.teacher_info?.name,
						teacher_avatar: data.teacher_info?.avatar,
						teacher_verified: data.teacher_info?.is_verified,
						subject: data.subject,
						date: data.date || data.appointment_date,
						time: data.start_time || data.appointment_time,
						duration: data.duration,
						amount: data.total_amount || data.total_fee,
						houry_rate: data.trial_invite_hourly_rate || data.hourly_rate || data.teacher_info?.hourly_rate,
						hourly_rate: data.trial_invite_hourly_rate || data.hourly_rate || data.teacher_info?.hourly_rate,
						address: this.formatAddress(data.lesson_mode, data.address),
						status: data.status,
						course_type: data.course_type,
						invited_by: data.invited_by || '',
						student_name: data.student_info?.name || data.student_name,
						student_grade: data.student_info?.grade || data.student_grade,
						requirements: data.requirements,
						lesson_mode: data.lesson_mode,
						// 评价状态（用于控制“退款”和“发表评价”按钮）
						has_review: !!data.has_review,
						parent_paid: (isSameAppointment && currentParentPaid) || !!data.parent_paid,
						parent_paid_from_order: !!data.parent_paid_from_order,
						parent_paid_from_record: !!data.parent_paid_from_record,
						parent_payment_time: data.parent_payment_time || data.payment_time || null,
						deposit_paid: !!data.deposit_paid,
						class_started_at: data.class_started_at || null,
						class_started_location: data.class_started_location || null,
						class_ended_at: data.class_ended_at || null,
						class_ended_location: data.class_ended_location || null,
						// 流程进度不再显示，但保留数据以防其他地方使用
						flow: this.buildFlow(data),
						conversation_id: data.conversation_id
					}
					this.confirmAppointmentId = data.confirm_appointment_id || data._id || this.appointmentId
					console.log('[appointment/detail] 映射到页面 appointment:', {
						pageAppointmentId: this.appointmentId,
						localAppointmentId: this.appointment._id,
						status: this.appointment.status,
						parent_paid: this.appointment.parent_paid,
						has_review: this.appointment.has_review,
						class_started_at: this.appointment.class_started_at,
						class_ended_at: this.appointment.class_ended_at
					})
					
					// 支付刚完成、云端尚未同步时，保留本单已支付状态
					if (isSameAppointment && currentParentPaid && !data.parent_paid) {
						this.appointment.parent_paid = true
						if (currentStatus === 'pending_payment') {
							this.appointment.status = 'pending_confirm'
						}
					} else if (data.parent_paid || data.parent_paid_from_order || data.parent_paid_from_record) {
						this.appointment.parent_paid = true
					}
					await this.syncAttendanceStatus()
				} else {
					throw new Error(res.message || '获取预约详情失败')
				}
			} catch (error) {
				console.error('获取预约详情失败:', error)
				// 如果获取失败，保留当前状态（避免覆盖已支付状态）
				if (currentParentPaid && this.appointment && this.appointment._id === this.appointmentId) {
					this.appointment.parent_paid = currentParentPaid
					if (currentStatus) {
						this.appointment.status = currentStatus
					}
				}
				// 只在非支付相关错误时显示提示
				if (!error.message || !error.message.includes('云服务')) {
					uni.showToast({ title: error.message || '获取详情失败', icon: 'none' })
				}
			} finally {
				this.isLoading = false
				this.isRefreshing = false
			}
		},
		async syncAttendanceStatus() {
			if (!this.appointmentId || !this.appointment || !this.appointment._id) {
				console.warn('[appointment/detail] 跳过同步打卡状态：缺少 appointmentId 或本地预约', {
					appointmentId: this.appointmentId,
					localAppointmentId: this.appointment && this.appointment._id
				})
				return
			}
			try {
				console.log('[appointment/detail] 开始同步打卡状态:', {
					requestAppointmentId: this.appointmentId,
					localAppointmentId: this.appointment._id,
					beforeStatus: this.appointment.status,
					beforeClassStartedAt: this.appointment.class_started_at || null,
					beforeClassEndedAt: this.appointment.class_ended_at || null
				})
				const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
				const res = await appointmentQuery.getAttendanceStatus({ appointment_id: this.appointmentId })
				console.log('[appointment/detail] appointment-query.getAttendanceStatus 返回:', {
					requestAppointmentId: this.appointmentId,
					code: res && res.code,
					message: res && res.message,
					data: res && res.data ? {
						status: res.data.status,
						class_started_at: res.data.class_started_at || null,
						class_ended_at: res.data.class_ended_at || null,
						can_clock_in: res.data.can_clock_in,
						can_clock_out: res.data.can_clock_out
					} : null
				})
				if (res && res.code === 0 && res.data) {
					const data = res.data
					if (data.class_started_at) {
						this.appointment.class_started_at = data.class_started_at
						this.appointment.class_started_location = data.class_started_location || null
					}
					if (data.class_ended_at) {
						this.appointment.class_ended_at = data.class_ended_at
						this.appointment.class_ended_location = data.class_ended_location || null
					}
					if (data.parent_paid === true || data.parent_paid === 'true') {
						this.appointment.parent_paid = true
					}
					if (data.parent_paid_from_order || data.parent_paid_from_record) {
						this.appointment.parent_paid_from_order = !!data.parent_paid_from_order
						this.appointment.parent_paid_from_record = !!data.parent_paid_from_record
						this.appointment.parent_paid = true
					}
					if (data.status) {
						this.appointment.status = data.status
					}
					console.log('[appointment/detail] 同步打卡状态后:', {
						localAppointmentId: this.appointment._id,
						status: this.appointment.status,
						parent_paid: this.appointment.parent_paid,
						has_review: this.appointment.has_review,
						class_started_at: this.appointment.class_started_at,
						class_ended_at: this.appointment.class_ended_at,
						canConfirmCompletion: this.canConfirmCompletion,
						shouldShowReviewButton: !this.canPayCourse && this.canConfirmCompletion && !!this.appointment.class_ended_at,
						shouldShowWaitingClockOut: !this.canPayCourse && this.canConfirmCompletion && !this.appointment.class_ended_at
					})
				} else {
					console.warn('[appointment/detail] 同步打卡状态失败:', res && res.message)
				}
			} catch (e) {
				console.warn('[appointment/detail] 同步打卡状态异常:', e)
			}
		},
		handleScroll(e) {
			this.scrollTop = e.detail.scrollTop
			this.canRefresh = e.detail.scrollTop <= 10
		},
		handleScrollToUpper() {
			this.scrollTop = 0
			this.canRefresh = true
		},
		onRefresh() {
			if (!this.canRefresh || this.scrollTop > 10) {
				this.isRefreshing = false
				return
			}
			if (this.isRefreshing) return
			this.isRefreshing = true
			this.loadDetail()
		},
		formatStatus(status) {
			const map = {
				pending_payment: '待支付',
				pending_confirm: '待确认',
				contact_request: '待确认',
				confirmed: '已确认',
				in_progress: '进行中',
				completed: '已完成',
				rejected: '已取消',
				cancelled: '已取消',
				refunding: '退款处理中',
				refunded: '已退款'
			}
			return map[status] || '未知状态'
		},
		formatCourseType(type) {
			return type === 'regular' ? '正式课程' : '试课体验'
		},
		formatAddress(mode, address) {
			if (mode === 'online') return '线上授课'
			if (!address) return '待确认'
			// 如果address是字符串，直接返回（去重后）
			if (typeof address === 'string') {
				return this.removeDuplicateAddress(address)
			}
			// 如果address是对象（家长预约时多为 { name, latitude, longitude }）
			if (typeof address === 'object') {
				// 家长预约的地址常用 name 表示完整地址
				if (address.name && String(address.name).trim()) {
					return this.removeDuplicateAddress(String(address.name).trim())
				}
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
				
				return parts.join(' ')
			}
			return '待确认'
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
		buildFlow(data) {
			const steps = [
				{ key: 'created', title: '提交预约', time: this.formatTime(data.create_time), active: true },
				{ key: 'parent_pay', title: '家长支付课程费', time: data.parent_paid ? this.formatTime(data.parent_payment_time || data.payment_time) : '', active: !!data.parent_paid },
				{ key: 'deposit', title: '教师支付信息费', time: data.deposit_paid ? this.formatTime(data.deposit_time) : '', active: !!data.deposit_paid },
				{ key: 'confirm', title: '教师确认', time: data.status !== 'pending_confirm' ? this.formatTime(data.confirm_time) : '', active: ['confirmed', 'in_progress', 'completed'].includes(data.status) },
				{ key: 'finished', title: '课程完成', time: data.status === 'completed' ? this.formatTime(data.complete_time) : '', active: data.status === 'completed' }
			]
			return steps
		},
		formatTime(ts) {
			if (!ts) return ''
			const date = new Date(ts)
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${month}-${day} ${hour}:${minute}`
		},
		// 打开优惠券选择
		async openCouponSelector() {
			if (!this.canPayCourse) return
			if (!this.appointmentId) {
				uni.showToast({ title: '预约信息异常', icon: 'none' })
				return
			}
			if (this.couponLoading) return
			
			const amount = Number(this.appointment.amount || 0)
			if (!amount) {
				uni.showToast({ title: '课程金额异常，无法使用优惠券', icon: 'none' })
				return
			}
			
			try {
				this.couponLoading = true
				// 首次打开时从云端拉取可用优惠券
				if (!this.availableCoupons || this.availableCoupons.length === 0) {
					const couponCenter = uniCloud.importObject('coupon-center', { customUI: true })
					const res = await couponCenter.getAvailableCoupons()
					if (res.code === 0 && res.data && Array.isArray(res.data.list)) {
						this.availableCoupons = res.data.list
					} else {
						this.availableCoupons = []
					}
				}
				
				if (!this.canUseCoupon) {
					uni.showToast({ title: '暂无可用优惠券', icon: 'none' })
					return
				}
				
				// 本地按金额过滤一遍可用券
				const usableCoupons = this.availableCoupons.filter(c => {
					const min = Number(c.min_spend || 0)
					return !min || amount >= min
				})
				
				if (!usableCoupons.length) {
					uni.showToast({ title: '当前金额未达到优惠券使用门槛', icon: 'none' })
					return
				}
				
				const itemList = ['不使用优惠券', ...usableCoupons.map(c => {
					const min = Number(c.min_spend || 0)
					const title = c.type === 'amount'
						? `减¥${Number(c.amount || 0).toFixed(2)}`
						: `${Number(c.discount * 10 || 0).toFixed(1)}折`
					const minText = min > 0 ? `（满¥${min.toFixed(2)}可用）` : ''
					return `${c.name || '优惠券'} ${title}${minText}`
				})]
				
				uni.showActionSheet({
					itemList,
					success: async (res) => {
						const index = res.tapIndex
						if (index === 0) {
							// 不使用优惠券
							this.couponPreview = null
							return
						}
						const couponRecord = usableCoupons[index - 1]
						if (!couponRecord) return
						
						try {
							const couponCenter = uniCloud.importObject('coupon-center', { customUI: true })
							const previewRes = await couponCenter.previewForAppointment({
								appointment_id: this.appointmentId,
								user_coupon_id: couponRecord._id
							})
							if (previewRes.code === 0 && previewRes.data) {
								this.couponPreview = {
									...previewRes.data,
									couponName: couponRecord.name || previewRes.data.couponName
								}
							} else {
								uni.showToast({ title: previewRes.message || '优惠券不可用', icon: 'none' })
							}
						} catch (e) {
							console.error('试算优惠券失败:', e)
							uni.showToast({ title: '优惠券试算失败，请稍后重试', icon: 'none' })
						}
					}
				})
			} catch (error) {
				console.error('打开优惠券选择失败:', error)
				uni.showToast({ title: '加载优惠券失败', icon: 'none' })
			} finally {
				this.couponLoading = false
			}
		},
		async handlePay() {
			if (!this.appointmentId) return
			const baseAmount = Number(this.appointment.amount || 0)
			// 优先使用优惠后应付金额（即使为 0 元也视为合法），否则回退到原价
			const hasCouponPreview = !!this.couponPreview
			const rawPayable = hasCouponPreview ? this.payableAmount : baseAmount
			const amount = Number(rawPayable)
			if (Number.isNaN(amount) || amount < 0) {
				uni.showToast({ title: '课程金额异常，无法支付', icon: 'none' })
				return
			}

			const discount = Number(this.couponDiscountAmount || 0)
			let content = ''
			if (discount > 0) {
				content = `课程原价：¥${baseAmount.toFixed(2)}\n优惠券减免：-¥${discount.toFixed(2)}\n实付金额：¥${amount.toFixed(2)}\n\n确认支付？试课满意后可继续安排正式课程。`
			} else {
				content = `确认支付 ¥${amount.toFixed(2)} 课程费用？试课满意后可继续安排正式课程。`
			}

			uni.showModal({
				title: '支付课程费用',
				content,
				success: async res => {
					if (!res.confirm) return
					
					// 显示加载提示
					uni.showLoading({ title: '创建订单中...', mask: true })
					
					try {
						const amountInCents = Math.round(amount * 100) // 转换为分
						const userCouponId = this.couponPreview ? this.couponPreview.user_coupon_id : null
						
						// 0 元订单：不调微信支付，直接在后台落订单并标记为已支付
						if (amountInCents === 0) {
							const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
							
							// 1. 创建 0 元课程费订单（会做金额和优惠券校验）
							const createRes = await paymentCreate.create({
								appointment_id: this.appointmentId,
								payment_type: 'course_fee',
								amount: 0,
								user_coupon_id: userCouponId
							})
							
							if (createRes.code !== 0 || !createRes.data || !createRes.data.order_no) {
								throw new Error(createRes.message || '创建支付订单失败')
							}
							
							// 2. 直接模拟支付成功，触发后端统一结算逻辑
							const payRes = await paymentCreate.mockPaySuccess({
								order_no: createRes.data.order_no
							})
							
							if (payRes.code === 0) {
								// 本地同步状态
								if (this.appointment) {
									this.appointment.parent_paid = true
									this.appointment.status = payRes.data?.appointment_status || 'pending_confirm'
								}
								
								uni.hideLoading()
								uni.showToast({ 
									title: '支付成功，等待老师确认', 
									icon: 'success',
									duration: 2000
								})
								setTimeout(() => {
									this.loadDetail()
								}, 1000)
							} else {
								uni.hideLoading()
								throw new Error(payRes.message || '支付失败')
							}
							return
						}
						
						// 非 0 元订单，走正常微信支付 / uni-pay 流程
						const payComponent = this.$refs.pay
						
						// 检查 uni-pay 组件是否可用
						if (payComponent && typeof payComponent.open === 'function') {
							uni.hideLoading()
							try {
								// uni-pay 组件支付，结果通过 @success、@fail 事件返回
								await createAndPayWithUniPay(payComponent, {
									appointment_id: this.appointmentId,
									payment_type: 'course_fee',
									amount: amountInCents,
									description: '支付课程费用',
									user_coupon_id: userCouponId
								})
								// 支付结果会在 onPaySuccess 或 onPayFail 中处理
								return // 成功调用 uni-pay，等待事件回调
							} catch (error) {
								console.warn('uni-pay 组件调用失败:', error)
								// 真实支付失败时进入下方降级路径：
								//   - 默认（生产）：createAndPay 返回错误码，提示用户重试
								//   - 开发者主动调用 uni.$enableMockPay() 后：弹模拟支付 modal，模拟成功
							}
						}
						
						// 降级处理（默认提示重试；开发模式开启后会走模拟支付）
						uni.hideLoading()
						const payResult = await createAndPay({
							appointment_id: this.appointmentId,
							payment_type: 'course_fee',
							amount: amountInCents,
							user_coupon_id: userCouponId
						})
						
						if (payResult.code === 0) {
							// 模拟支付成功，更新本地状态
							if (this.appointment) {
								this.appointment.parent_paid = true
								this.appointment.status = this.appointment.status === 'pending_payment' ? 'pending_confirm' : this.appointment.status
							}
							
							uni.showToast({ 
								title: '支付成功，等待老师确认', 
								icon: 'success',
								duration: 2000
							})
							setTimeout(() => {
								this.loadDetail()
							}, 1000)
						} else {
							if (payResult.message && !payResult.message.includes('取消')) {
								uni.showToast({ 
									title: payResult.message || '支付失败', 
									icon: 'none',
									duration: 2000
								})
							}
						}
					} catch (error) {
						uni.hideLoading()
						console.error('支付课程费失败:', error)
						uni.showToast({ 
							title: error.message || '支付失败，请稍后重试', 
							icon: 'none',
							duration: 2000
						})
					}
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
				appointment_id: custom.appointment_id
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
						payment_type: 'course_fee',
						status: 'all',
						page: 1,
						pageSize: 1
					})
					
					if (orderListRes.code === 0 && orderListRes.data && orderListRes.data.list && orderListRes.data.list.length > 0) {
						finalOrderNo = orderListRes.data.list[0].order_no
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
					
					// out_trade_no 已经在 mockPaySuccess 中保存，这里不需要再次保存
					if (out_trade_no) {
						console.log('[支付成功] out_trade_no 已通过 mockPaySuccess 保存:', out_trade_no)
					}
					
					// 更新本地状态
					if (this.appointment) {
						this.appointment.parent_paid = true
						this.appointment.status = payRes.data?.appointment_status || 'pending_confirm'
					}
					
					uni.showToast({ 
						title: '支付成功，等待老师确认', 
						icon: 'success',
						duration: 2000
					})
					
					setTimeout(() => {
						this.loadDetail()
					}, 1000)
				} else {
					throw new Error(payRes.message || '更新预约状态失败')
				}
			} catch (error) {
				console.error('[支付成功] 更新数据库失败:', error)
				// 即使更新失败，也更新本地状态，避免用户困惑
				if (this.appointment) {
					this.appointment.parent_paid = true
					this.appointment.status = this.appointment.status === 'pending_payment' ? 'pending_confirm' : this.appointment.status
				}
				
				uni.showToast({ 
					title: '支付成功，等待老师确认', 
					icon: 'success',
					duration: 2000
				})
				
				setTimeout(() => {
					this.loadDetail()
				}, 1000)
			}
		},
		// uni-pay 组件事件：支付失败（包含用户取消）
		onPayFail(err) {
			console.error('支付失败:', err)
			const msg = err && err.errMsg ? err.errMsg : ''
			// 用户取消支付
			if (msg.includes('cancel')) {
				uni.redirectTo({
					url: `/pages/payment/result?status=fail&role=parent&appointmentId=${this.appointmentId}&returnPage=/pages/appointment/detail&message=${encodeURIComponent('您已取消支付，可返回继续浏览订单')}`
				})
				return
			}
			// 其它失败
			if (msg) {
				uni.redirectTo({
					url: `/pages/payment/result?status=fail&role=parent&appointmentId=${this.appointmentId}&returnPage=/pages/appointment/detail&message=${encodeURIComponent(msg)}`
				})
			} else {
				uni.showToast({ 
					title: '支付失败', 
					icon: 'none',
					duration: 2000
				})
			}
		},
		async contactTeacher() {
			// 1. 已有会话，直接跳转到聊天页面
			if (this.appointment?.conversation_id) {
				uni.navigateTo({ 
					url: `/pages/chat/conversation?conversationId=${this.appointment.conversation_id}` 
				})
				return
			}
			
			// 2. 没有会话，尝试通过云对象获取或创建会话
			try {
				uni.showLoading({ title: '正在加载...', mask: true })
				const chatSend = uniCloud.importObject('chat-send', { customUI: true })
				const res = await chatSend.getConversation({ appointment_id: this.appointmentId })
				uni.hideLoading()
				
				if (res.code === 0 && res.data?.conversation_id) {
					// 获取到会话，直接跳转到聊天页面
					uni.navigateTo({ 
						url: `/pages/chat/conversation?conversationId=${res.data.conversation_id}` 
					})
				} else {
					// 获取会话失败，给出提示
					uni.showModal({
						title: '提示',
						content: res.message || '无法联系老师，请先支付课程费用',
						showCancel: false
					})
				}
			} catch (error) {
				uni.hideLoading()
				console.error('获取会话失败:', error)
				// 获取会话失败时，退回到预约详情本身，不再直接访问数据库
				uni.showToast({
					title: '无法加载聊天会话，请稍后重试',
					icon: 'none'
				})
			}
		},
		createReview() {
			const actionId = this.confirmActionId
			if (!actionId) return
			const courseType = this.appointment && this.appointment.course_type ? this.appointment.course_type : ''
			uni.navigateTo({ url: `/pages/review/create?appointmentId=${actionId}&courseType=${encodeURIComponent(courseType)}` })
		},
		// 一步合并入口：去评价页同时完成「确认结果（结算） + 评价」
		goReviewAndConfirm() {
			const actionId = this.confirmActionId
			if (!actionId) return
			if (!this.appointment.class_ended_at) {
				uni.showToast({ title: '老师尚未下课打卡', icon: 'none' })
				return
			}
			const courseType = this.appointment && this.appointment.course_type ? this.appointment.course_type : ''
			uni.navigateTo({ url: `/pages/review/create?appointmentId=${actionId}&courseType=${encodeURIComponent(courseType)}` })
		},
		async handleRefund() {
			if (!this.appointmentId) return
			
			// 检查是否已支付
			if (!this.appointment.parent_paid) {
				uni.showToast({ title: '该预约尚未支付，无法申请退款', icon: 'none' })
				return
			}

			// 家长一旦确认订单（合并的「评价 + 确认结果」提交后状态切到 completed），
			// 视为已认可本次结算，不再允许申请退款
			if (this.appointment.status === 'completed' || this.appointment.has_review) {
				uni.showToast({ title: '订单已确认，不可再申请退款', icon: 'none' })
				return
			}
			
			// 查找对应的支付订单
			try {
				uni.showLoading({ title: '查找订单中...', mask: true })
				
				console.log('[申请退款] 开始查找订单, appointment_id:', this.appointmentId)
				
				// 方法1: 通过云对象查询（会验证用户权限）
				const paymentCreate = uniCloud.importObject('payment-create', { customUI: true })
				const orderRes = await paymentCreate.getOrderList({
					appointment_id: this.appointmentId,
					payment_type: 'course_fee',
					status: 'all', // 查询所有状态，包括 paid
					page: 1,
					pageSize: 10
				})
				
				console.log('[申请退款] 方法1-云对象查询结果:', {
					code: orderRes.code,
					message: orderRes.message,
					hasData: orderRes.data?.list?.length > 0,
					listLength: orderRes.data?.list?.length,
					orders: orderRes.data?.list
				})
				
				uni.hideLoading()
				
				if (orderRes.code !== 0) {
					console.warn('[申请退款] 方法1查询失败，尝试方法2')
					throw new Error(orderRes.message || '查询订单失败')
				}
				
				// 查找已支付的订单（支持多种状态）
				let paidOrder = null
				if (orderRes.data && orderRes.data.list) {
					// 优先查找 paid 或 success 状态的订单
					paidOrder = orderRes.data.list.find(order => 
						order.status === 'paid' || order.status === 'success'
					)
					
					// 如果没找到，也接受其他已支付状态（如 refunding，说明已支付但正在退款）
					if (!paidOrder) {
						paidOrder = orderRes.data.list.find(order => 
							order.status !== 'pending' && 
							order.status !== 'unpaid' &&
							order.status !== 'cancelled'
						)
					}
					
					console.log('[申请退款] 方法1-找到的订单:', paidOrder ? {
						order_id: paidOrder._id,
						order_no: paidOrder.order_no,
						status: paidOrder.status,
						amount: paidOrder.amount
					} : '无')
				}
				
				if (paidOrder) {
					// 检查是否已有退款申请
					try {
						const refundObj = uniCloud.importObject('payment-refund', { customUI: true })
						const refundRes = await refundObj.getDetail({ order_id: paidOrder._id })
						
						if (refundRes.code === 0 && refundRes.data) {
							const refund = refundRes.data
							console.log('[申请退款] 已存在退款申请:', {
								refund_id: refund._id,
								status: refund.status
							})
							
							if (refund.status === 'pending' || refund.status === 'processing') {
								uni.showModal({
									title: '提示',
									content: '您已提交退款申请，正在处理中',
									showCancel: false
								})
								return
							} else if (refund.status === 'approved' || refund.status === 'completed' || refund.status === 'success') {
								uni.showModal({
									title: '提示',
									content: '退款已完成，无法再次申请',
									showCancel: false
								})
								return
							}
						}
					} catch (error) {
						// 没有退款记录，继续处理
						console.log('[申请退款] 查询退款记录（无记录）:', error.message)
					}
					
					// 跳转到退款页面
					console.log('[申请退款] 跳转到退款页面, order_id:', paidOrder._id)
					uni.navigateTo({
						url: `/pages/order/refund?id=${paidOrder._id}`
					})
				} else {
					// 方法2: 如果方法1没找到，尝试直接查询数据库（不限制 payer_id）
					console.warn('[申请退款] 方法1未找到订单，尝试方法2-直接查询数据库', {
						appointment_id: this.appointmentId,
						parent_paid: this.appointment.parent_paid,
						orders: orderRes.data?.list
					})
					
					try {
						const db = uniCloud.database()
						const directOrderRes = await db.collection('payment-orders')
							.where({
								appointment_id: this.appointmentId,
								order_type: 'course_fee'
							})
							.orderBy('create_time', 'desc')
							.limit(5)
							.get()
						
						console.log('[申请退款] 方法2-直接查询结果:', {
							count: directOrderRes.data?.length || 0,
							orders: directOrderRes.data?.map(o => ({
								_id: o._id,
								order_no: o.order_no,
								status: o.status,
								payer_id: o.payer_id,
								amount: o.amount
							}))
						})
						
						if (directOrderRes.data && directOrderRes.data.length > 0) {
							// 找到订单，优先选择已支付状态的
							let foundOrder = directOrderRes.data.find(o => 
								o.status === 'paid' || o.status === 'success'
							)
							if (!foundOrder) {
								foundOrder = directOrderRes.data.find(o => 
									o.status !== 'pending' && o.status !== 'unpaid' && o.status !== 'cancelled'
								)
							}
							if (!foundOrder) {
								foundOrder = directOrderRes.data[0] // 使用最新的
							}
							
							console.log('[申请退款] 方法2-找到订单:', {
								order_id: foundOrder._id,
								order_no: foundOrder.order_no,
								status: foundOrder.status,
								payer_id: foundOrder.payer_id
							})
							
							// 跳转到退款页面
							uni.navigateTo({
								url: `/pages/order/refund?id=${foundOrder._id}`
							})
							return
						} else {
							console.warn('[申请退款] 方法2也未找到订单')
						}
					} catch (dbError) {
						console.error('[申请退款] 方法2-直接查询失败:', {
							error: dbError,
							message: dbError.message
						})
					}
					
					// 如果还是找不到，提示用户
					uni.showModal({
						title: '提示',
						content: `未找到对应的支付订单，无法申请退款。\n\n预约ID: ${this.appointmentId}\n\n可能的原因：\n1. 订单尚未创建\n2. 订单状态异常\n3. 数据不同步\n\n建议：\n1. 刷新页面后重试\n2. 联系客服处理`,
						showCancel: false
					})
				}
			} catch (error) {
				uni.hideLoading()
				console.error('[申请退款] 查找订单失败:', {
					error,
					message: error.message,
					appointment_id: this.appointmentId
				})
				uni.showModal({
					title: '查找订单失败',
					content: error.message || '查找订单失败，请稍后重试。如问题持续，请联系客服。',
					showCancel: false
				})
			}
		},
		async handleTrialRefund() {
			if (!this.appointmentId) return
			
			// 仅试课支持该入口
			if (!this.appointment || this.appointment.course_type !== 'trial') {
				return
			}
			
			uni.showModal({
				title: '确认试课不满意',
				content: '确认本次试课不满意？\n\n· 教师获得 70% 试课费；\n· 您将获得 30% 试课费自动退款；\n· 教师之前支付的信息费会全额退回教师钱包；\n· 教师可再次向您发起试课邀请。',
				confirmText: '确认不满意',
				cancelText: '再想想',
				success: async res => {
					if (!res.confirm) return
					try {
						const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
						const result = await appointmentQuery.confirmCompletion({
							appointment_id: this.appointmentId,
							is_satisfied: false,
							fail_reason: '试课不满意'
						})
						if (result.code === 0) {
							uni.showToast({ title: '已确认结果', icon: 'success' })
							if (this.appointment) {
								this.appointment.status = 'completed'
								this.appointment.trial_result = 'fail'
							}
							setTimeout(() => {
								this.loadDetail()
							}, 800)
						} else {
							uni.showToast({ title: result.message || '操作失败', icon: 'none' })
						}
					} catch (error) {
						console.error('试课不满意确认失败:', error)
						uni.showToast({ title: '操作失败，请稍后重试', icon: 'none' })
					}
				}
			})
		},
		handleConfirmCompletion() {
			if (!this.appointmentId) {
				uni.showToast({ title: '未找到对应预约', icon: 'none' })
				return
			}
			const isTrial = this.appointment && this.appointment.course_type === 'trial'
			uni.showModal({
				title: isTrial ? '确认试课成功' : '确认课程完成',
				content: isTrial
					? '确认本次试课成功？\n\n· 教师将获得 70% 试课费、平台收取 30%；\n· 教师之前支付的「信息费」由平台收取，不退回；\n· 确认后您可以发表评价。'
					: '确认课程已顺利完成？确认后将开启评价。',
				confirmText: '确认',
				success: async res => {
					if (!res.confirm) return
					try {
						const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
						const result = await appointmentQuery.confirmCompletion({
							appointment_id: this.appointmentId,
							is_satisfied: true
						})
						if (result.code === 0) {
							uni.showToast({ title: '已确认完成', icon: 'success' })
							// 本地先更新状态，避免等待网络刷新时按钮状态不一致
							if (this.appointment) {
								this.appointment.status = 'completed'
							}
							setTimeout(() => {
								this.loadDetail()
							}, 600)
						} else {
							uni.showToast({ title: result.message || '确认失败', icon: 'none' })
						}
					} catch (error) {
						console.error('确认课程完成失败:', error)
						uni.showToast({ title: '确认失败，请稍后重试', icon: 'none' })
					}
				}
			})
		}
	}
}
</script>

<style scoped>
/* 底部操作栏 */
.action-bar-placeholder {
	height: 120rpx;
}

.action-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	background: #FFFFFF;
	border-top: 1rpx solid #F0F0F0;
	padding: 20rpx 32rpx;
	padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
	z-index: 100;
	box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.action-buttons {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 20rpx;
}

.action-buttons__main {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 12rpx;
}

/* 统一按钮样式 */
.action-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24rpx 48rpx;
	border-radius: 48rpx;
	font-size: 30rpx;
	font-weight: 500;
	line-height: 1;
	border: none;
	outline: none;
	transition: all 0.3s ease;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
	min-width: 180rpx;
}

.action-btn::after {
	border: none;
}

/* 主要按钮（实心） */
.action-btn-primary {
	background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
	color: #FFFFFF;
}

.action-btn-primary:active {
	background: linear-gradient(135deg, #357ABD 0%, #2A5F8F 100%);
	transform: scale(0.98);
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
}

/* 警告按钮（退款） */
.action-btn-warning {
	background: linear-gradient(135deg, #FF9500 0%, #FF7A00 100%);
	color: #FFFFFF;
}

.action-btn-warning:active {
	background: linear-gradient(135deg, #FF7A00 0%, #E66A00 100%);
	transform: scale(0.98);
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
}

/* 次要按钮（边框） */
.action-btn-outline {
	background: #FFFFFF;
	color: #4A90E2;
	border: 2rpx solid #4A90E2;
	box-shadow: 0 2rpx 8rpx rgba(74, 144, 226, 0.15);
}

.action-btn-outline:active {
	background: #F5F9FF;
	transform: scale(0.98);
	box-shadow: 0 2rpx 6rpx rgba(74, 144, 226, 0.2);
}

.action-refund-link {
	background: transparent;
	color: #9ca3af;
	font-size: 24rpx;
	line-height: 1.4;
	padding: 4rpx 0;
	border: none;
	box-shadow: none;
	text-align: center;
}

.action-refund-link::after {
	border: none;
}

.action-refund-link:active {
	color: #6b7280;
	background: transparent;
}

.action-btn-disabled {
	background: #f3f4f6;
	color: #9ca3af;
	border: 2rpx dashed #d1d5db;
	display: flex;
	align-items: center;
	justify-content: center;
}


/* 响应式调整 */
@media screen and (max-width: 750rpx) {
	.action-btn {
		padding: 20rpx 40rpx;
		font-size: 28rpx;
		min-width: 160rpx;
	}
	
	.action-buttons {
		gap: 16rpx;
	}
}
</style>