<template>
	<view class="page">
		<view v-if="!pageReady" class="page-loading">
			<view class="page-loading-spinner"></view>
			<text class="page-loading-text">加载教师信息...</text>
		</view>

		<template v-else>
			<view class="hero">
				<image class="hero-avatar" :src="teacherInfo.avatar || defaultAvatarUrl" mode="aspectFill"></image>
				<view class="hero-main">
					<text class="hero-name">{{ teacherDisplayName }}</text>
					<text class="hero-meta">{{ heroMetaText }}</text>
				</view>
			</view>

			<text class="form-tip">{{ formData.invite_id ? '老师已发出试课邀请，本页填写试课预约信息。' : '试课预约需由老师发起邀请。本页仅预约正式课程（2 小时）。' }}</text>

			<view v-if="!formData.invite_id" class="section-card">
				<text class="section-title">课程类型</text>
				<view class="choice">
					<view class="choice-item on" @click="changeCourseType('formal')">
						<text class="choice-title">正式课程</text>
						<text class="choice-sub">完整 2 小时 · ¥{{ formalPrice }}</text>
					</view>
				</view>
			</view>

			<view v-else class="section-card">
				<text class="section-title">试课邀请</text>
				<text class="intro">老师邀请您预约试课。2 小时试课，不满意可退 30%。</text>
				<view class="form-row last">
					<text class="form-label">试课费用</text>
					<text class="form-price">¥{{ trialPrice }}</text>
				</view>
			</view>

			<view class="form-card">
				<picker mode="date" :value="formData.date" :start="dateOptions.start" :end="dateOptions.end" @change="onDateChange">
					<view class="form-row">
						<text class="form-label">上课日期</text>
						<text class="form-em">{{ formData.date || '请选择' }}</text>
					</view>
				</picker>
				<picker mode="time" :value="formData.time" :start="timePickerStart" :end="timePickerEnd" @change="onTimeChange">
					<view class="form-row last">
						<text class="form-label">开始时间</text>
						<text class="form-em">{{ formData.time || '请选择' }}</text>
					</view>
				</picker>
				<text class="hint">{{ bookingTimeTip }}</text>
			</view>

			<view class="form-card">
				<view class="form-row">
					<text class="form-label">学生姓名</text>
					<input class="form-input" v-model.trim="formData.studentName" placeholder="请输入学生姓名" placeholder-class="ph" />
				</view>
				<picker mode="selector" :range="gradeOptions" :value="gradeIndex" @change="onGradeChange">
					<view class="form-row">
						<text class="form-label">所在年级</text>
						<text class="form-em">{{ formData.studentGrade || '选择年级' }}</text>
					</view>
				</picker>
				<view class="form-row last">
					<text class="form-label">学习科目</text>
					<input class="form-input" v-model.trim="formData.subject" placeholder="如：数学" placeholder-class="ph" />
				</view>
			</view>

			<view class="choice">
				<view class="choice-item" :class="{ on: formData.lessonMode === 'online' }" @click="formData.lessonMode = 'online'">
					<text class="choice-title">线上授课</text>
					<text class="choice-sub">灵活排课</text>
				</view>
				<view class="choice-item" :class="{ on: formData.lessonMode === 'offline' }" @click="formData.lessonMode = 'offline'">
					<text class="choice-title">线下授课</text>
					<text class="choice-sub">地图选点</text>
				</view>
			</view>

			<view v-if="formData.lessonMode === 'offline'" class="form-card">
				<view class="form-row last" @click="handleChooseLocation">
					<text class="form-label">上课地址</text>
					<text class="form-em">{{ addressDisplay || '点击选择地址' }}</text>
				</view>
				<view v-if="formData.address.latitude && formData.address.longitude" class="map-preview">
					<map
						:latitude="parseFloat(formData.address.latitude)"
						:longitude="parseFloat(formData.address.longitude)"
						:markers="mapMarkers"
						:scale="15"
						:show-location="true"
						style="width: 100%; height: 240rpx;"
						@tap="handleOpenLocation"
					></map>
				</view>
			</view>

			<view class="section-card">
				<text class="section-title">补充说明</text>
				<textarea
					class="intro-input"
					v-model.trim="formData.requirements"
					placeholder="请带上次月考试卷，方便针对性讲解。"
					maxlength="200"
					:show-confirm-bar="false"
					:cursor-spacing="24"
					placeholder-class="ph"
				/>
			</view>

			<view class="form-card">
				<view class="form-row">
					<text class="form-label">课程费用</text>
					<text class="form-price">¥{{ totalAmount }}</text>
				</view>
				<view class="form-row last">
					<text class="form-label">优惠券</text>
					<text class="form-em">支付时在详情页选择</text>
				</view>
				<text class="hint">{{ formData.courseType === 'trial' ? '试课为 2 小时价格。不满意可退 30%，其余 70% 结算给教师。' : '优惠券请在预约详情支付前选择，本页不选券。' }}</text>
			</view>

			<view class="scroll-spacer"></view>

			<view class="action-bar">
				<view class="pay-sum">
					<text class="pay-label">合计</text>
					<text class="pay-amount">¥{{ totalAmount }}</text>
				</view>
				<button class="save-btn" :disabled="isSubmitting" @click="submitAppointment">
					{{ isSubmitting ? '提交中...' : (formData.invite_id ? '确认预约试课' : '确认预约') }}
				</button>
			</view>
		</template>
	</view>
</template>

<script>
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import {
	readAppointmentTeacherPreview,
	clearAppointmentTeacherPreview,
	applyAppointmentTeacherPreview
} from '../utils/appointmentTeacherPreview.js'
import { 
	chooseLocation, 
	openLocation, 
	requestLocationPermission 
} from '@/utils/location.js'

export default {
	name: 'AppointmentCreate',
	data() {
		return {
			teacherProfileId: '',
			teacherUid: '',
			routeInviteId: '',
			pageReady: false,
			teacherInfo: {},
			formData: {
				courseType: 'formal', // 默认正式课程，试课只能通过邀请创建
				invite_id: '', // 试课邀请ID（如果是从邀请创建）
				date: '',
				time: '',
				studentName: '',
				studentGrade: '',
				subject: '',
				lessonMode: 'offline',
				address: {
					latitude: '',
					longitude: '',
					name: ''
				},
				requirements: ''
			},
			gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
			gradeIndex: -1,
			dateOptions: {
				start: '',
				end: ''
			},
			isSubmitting: false,
			isLoading: false,
			isRefreshing: false,
			scrollTop: 0,
			canRefresh: true,
			// 默认头像URL（从CDN）
			defaultAvatarUrl: getDefaultAvatarUrl(),
			inviteHourlyRate: 0,
			inviteTotalAmount: 0
		}
	},
	computed: {
		teacherDisplayName() {
			return this.teacherInfo.display_name || this.teacherInfo.name || this.teacherInfo.nickname || '教师'
		},
		heroMetaText() {
			const rate = this.formatRating(this.teacherInfo.rating)
			const hourly = this.teacherInfo.hourly_rate || 100
			let text = `${rate} 分 · ¥${hourly}/小时`
			if (this.teacherInfo.trial_success_rate > 0) {
				text += ` · 试课成功率 ${this.formatPercent(this.teacherInfo.trial_success_rate)}`
			}
			return text
		},
		hourlyRate() {
			if (this.formData.invite_id && this.inviteHourlyRate > 0) {
				return this.inviteHourlyRate
			}
			const rate = Number(this.teacherInfo?.hourly_rate)
			return Number.isFinite(rate) && rate > 0 ? rate : 100
		},
		/** 试课（含邀请）不限制时段；正式课仍要求提前约 */
		isTrialBooking() {
			return this.formData.courseType === 'trial' || !!this.formData.invite_id || !!this.routeInviteId
		},
		bookingTimeTip() {
			if (this.isTrialBooking) {
				return '试课上课时间不限，可随时预约；课程默认持续 2 小时，如需调整可与老师沟通修改。'
			}
			return '最早可约一小时后开课；可选时段 08:00–21:00；课程默认持续 2 小时，如需调整可与老师沟通修改。'
		},
		/** 最早可约时刻（正式课：当前 + 1 小时；试课：不限） */
		earliestBookableAt() {
			if (this.isTrialBooking) return new Date(0)
			return new Date(Date.now() + 60 * 60 * 1000)
		},
		timePickerStart() {
			if (this.isTrialBooking) return '00:00'
			const earliest = this.earliestBookableAt
			const earliestDate = this.formatDate(earliest)
			if (this.formData.date === earliestDate) {
				const hh = String(earliest.getHours()).padStart(2, '0')
				const mm = String(earliest.getMinutes()).padStart(2, '0')
				const minTime = `${hh}:${mm}`
				return minTime > '08:00' ? minTime : '08:00'
			}
			return '08:00'
		},
		timePickerEnd() {
			return this.isTrialBooking ? '23:59' : '21:00'
		},
		trialPrice() {
			if (this.formData.invite_id && this.inviteTotalAmount > 0) {
				return this.inviteTotalAmount
			}
			return this.hourlyRate * 2
		},
		formalPrice() {
			return this.hourlyRate * 2
		},
		totalAmount() {
			return this.formData.courseType === 'trial' ? this.trialPrice : this.formalPrice
		},
		/**
		 * 地址显示文本
		 */
		addressDisplay() {
			return this.formData.address.name || ''
		},
		/**
		 * 地图标记点
		 */
		mapMarkers() {
			if (!this.formData.address.latitude || !this.formData.address.longitude) {
				return []
			}
			return [{
				id: 1,
				latitude: parseFloat(this.formData.address.latitude),
				longitude: parseFloat(this.formData.address.longitude),
				width: 30,
				height: 30,
				title: this.formData.address.name || '上课地址',
				callout: {
					content: this.formData.address.name || '上课地址',
					color: '#333',
					fontSize: 14,
					borderRadius: 4,
					bgColor: '#fff',
					padding: 8,
					display: 'ALWAYS'
				}
			}]
		}
	},
	async onLoad(options) {
		this.pageReady = false
		this.routeInviteId = options.invite_id || ''
		this.teacherProfileId = options.teacherProfileId || options.id || options.teacherId || ''
		this.teacherUid = options.teacherUid || options.teacher_id || ''
		applyAppointmentTeacherPreview(this, readAppointmentTeacherPreview())
		this.setupDateRange()

		try {
			if (this.routeInviteId) {
				this.formData.invite_id = this.routeInviteId
				this.formData.courseType = 'trial'
				// 邀请试课：按不限时段重算可选日期
				this.setupDateRange()
				const ok = await this.loadInviteInfo(this.routeInviteId)
				if (!ok) return
				if (this.shouldFetchTeacherDetail()) {
					await this.loadTeacher()
				}
			} else {
				await this.ensureTeacher()
			}
			this.prefillFromProfile()
			this.pageReady = true
		} catch (error) {
			console.error('[appointment/create] 页面初始化失败:', error)
			uni.showToast({ title: error.message || '加载失败', icon: 'none' })
			setTimeout(() => uni.navigateBack(), 1500)
		}
	},
	onUnload() {
		clearAppointmentTeacherPreview()
	},
	methods: {
		setupDateRange() {
			const now = new Date()
			let startDate = now
			// 正式课：最早一小时后；超过当日 21:00 则从次日开始。试课不限。
			if (!this.isTrialBooking) {
				const earliest = new Date(now.getTime() + 60 * 60 * 1000)
				startDate = earliest
				const earliestHm = `${String(earliest.getHours()).padStart(2, '0')}:${String(earliest.getMinutes()).padStart(2, '0')}`
				if (earliestHm > '21:00') {
					startDate = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate() + 1)
				}
			}
			const oneMonthLater = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
			this.dateOptions.start = this.formatDate(startDate)
			this.dateOptions.end = this.formatDate(oneMonthLater)
			this.formData.date = this.dateOptions.start
		},
		async ensureTeacher() {
			if (this.routeInviteId || this.formData.invite_id) {
				if (!this.teacherUid && !this.teacherProfileId) {
					uni.showToast({ title: '未找到邀请对应的教师', icon: 'none' })
					setTimeout(() => uni.navigateBack(), 1500)
				}
				return
			}
			if (!this.teacherProfileId && !this.teacherUid) {
				await this.initTeacherFromCloud()
			}
			if (!this.teacherProfileId && !this.teacherUid) {
				uni.showToast({ title: '未找到可预约教师', icon: 'none' })
				setTimeout(() => uni.navigateBack(), 1500)
				return
			}
			await this.loadTeacher()
		},
		shouldFetchTeacherDetail() {
			const info = this.teacherInfo || {}
			const hasName = !!(info.display_name || info.name || info.nickname)
			const hasRate = info.hourly_rate != null && Number(info.hourly_rate) > 0
			return !hasName || !hasRate
		},
		prefillFromProfile() {
			const profile = uni.getStorageSync('userInfo')
			if (profile?.parent_info) {
				this.formData.studentName = profile.parent_info.student_name || ''
				this.formData.studentGrade = profile.parent_info.student_grade || ''
				this.gradeIndex = this.gradeOptions.indexOf(this.formData.studentGrade)
			}
		},
		/**
		 * 加载试课邀请信息
		 * @param {String} invite_id 邀请ID
		 */
		async loadInviteInfo(invite_id) {
			if (!invite_id) return false
			try {
				const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
				const res = await appointmentQuery.getAppointmentDetail({ appointment_id: invite_id })
				if (res.code === 0 && res.data) {
					const invite = res.data
					if (invite.status !== 'trial_invited') {
						uni.showToast({ title: '该试课邀请已处理', icon: 'none' })
						setTimeout(() => uni.navigateBack(), 1500)
						return false
					}
					if (invite.teacher_id) {
						this.teacherUid = invite.teacher_id
					}
					const inviteRate = Number(invite.trial_invite_hourly_rate || invite.hourly_rate || 0)
					const inviteAmount = Number(invite.total_amount || 0)
					this.inviteHourlyRate = inviteRate > 0 ? inviteRate : 0
					this.inviteTotalAmount = inviteAmount > 0 ? inviteAmount : (inviteRate > 0 ? inviteRate * 2 : 0)
					if (invite.teacher_info) {
						applyAppointmentTeacherPreview(this, {
							...invite.teacher_info,
							display_name: invite.teacher_info.display_name || invite.teacher_info.name,
							name: invite.teacher_info.name || invite.teacher_info.display_name,
							teacher_id: invite.teacher_id,
							hourly_rate: this.inviteHourlyRate || invite.teacher_info.hourly_rate
						})
					}
					this.formData.courseType = 'trial'
					this.formData.invite_id = invite._id
					return true
				}
				throw new Error(res.message || '加载邀请信息失败')
			} catch (error) {
				console.error('加载试课邀请信息失败:', error)
				uni.showToast({ title: error.message || '加载失败', icon: 'none' })
				setTimeout(() => uni.navigateBack(), 1500)
				return false
			}
		},
		async initTeacherFromCloud() {
			try {
				const teacherListObj = uniCloud.importObject('teacher-list', { customUI: true })
				const res = await teacherListObj.getList({ page: 1, pageSize: 1 })
				if (res.code === 0 && res.data.list?.length) {
					const teacher = res.data.list[0]
					this.teacherProfileId = teacher._id || teacher.id || ''
					this.teacherUid = teacher.teacher_id || ''
				}
			} catch (error) {
				console.error('自动获取教师失败:', error)
			}
		},
		async loadTeacher() {
			if (this.isLoading) return
			this.isLoading = true
			const previousInfo = { ...(this.teacherInfo || {}) }
			try {
				const teacherListObj = uniCloud.importObject('teacher-list', { customUI: true })
				const res = await teacherListObj.getDetail({ teacherId: this.teacherProfileId || this.teacherUid })
				if (res.code === 0) {
					const merged = {
						...previousInfo,
						...res.data,
						display_name: res.data.display_name || res.data.name || previousInfo.display_name || previousInfo.name,
						name: res.data.name || res.data.display_name || previousInfo.name || previousInfo.display_name
					}
					if (this.formData.invite_id && this.inviteHourlyRate > 0) {
						merged.hourly_rate = this.inviteHourlyRate
					}
					this.teacherInfo = merged
					this.teacherProfileId = res.data._id || this.teacherProfileId
					this.teacherUid = res.data.teacher_id || this.teacherUid
				} else {
					throw new Error(res.message || '加载教师失败')
				}
			} catch (error) {
				console.error('加载教师失败:', error)
				if (!(previousInfo.display_name || previousInfo.name)) {
					uni.showToast({ title: error.message || '加载教师失败', icon: 'none' })
					throw error
				}
			} finally {
				this.isLoading = false
				this.isRefreshing = false
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
		async onRefresh() {
			if (!this.canRefresh || this.scrollTop > 10) {
				this.isRefreshing = false
				return
			}
			if (this.isRefreshing) return
			this.isRefreshing = true
			await this.loadTeacher()
		},
		onDateChange(e) {
			this.formData.date = e.detail.value
			// 切换日期后，若已选时间早于最早可约时刻则清空
			if (this.formData.time && this.formData.time < this.timePickerStart) {
				this.formData.time = ''
			}
		},
		onTimeChange(e) {
			const time = e.detail.value
			if (!this.isTrialBooking && time < this.timePickerStart) {
				uni.showToast({ title: '请选择一小时后的时间', icon: 'none' })
				this.formData.time = ''
				return
			}
			this.formData.time = time
		},
		onGradeChange(e) {
			const index = Number(e.detail.value)
			this.gradeIndex = index
			this.formData.studentGrade = this.gradeOptions[index]
		},
		changeCourseType(type) {
			// 如果不是从邀请创建，只能选择正式课程
			if (!this.formData.invite_id && type === 'trial') {
				uni.showToast({ 
					title: '试课预约需由老师发起邀请，请先联系老师', 
					icon: 'none',
					duration: 3000
				})
				return
			}
			this.formData.courseType = type
		},
		formatDate(date) {
			const year = date.getFullYear()
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			return `${year}-${month}-${day}`
		},
		formatRating(rating) {
			if (!rating && rating !== 0) return '5.0'
			return Number(rating).toFixed(1)
		},
		formatPercent(rate) {
			if (!rate && rate !== 0) return '0%'
			return `${(Number(rate) * 100).toFixed(0)}%`
		},
		/**
		 * 选择位置（打开地图选择）
		 */
		async handleChooseLocation() {
			try {
				// 先检查并请求权限
				const hasPermission = await requestLocationPermission()
				if (!hasPermission) {
					uni.showToast({
						title: '需要位置权限',
						icon: 'none'
					})
					return
				}

				// 如果有已选位置，使用已选位置作为地图初始位置
				let initialLat = null
				let initialLon = null
				if (this.formData.address.latitude && this.formData.address.longitude) {
					initialLat = parseFloat(this.formData.address.latitude)
					initialLon = parseFloat(this.formData.address.longitude)
				}

				const location = await chooseLocation({
					latitude: initialLat,
					longitude: initialLon
				})

				// 更新表单数据
				this.formData.address = {
					latitude: location.latitude.toString(),
					longitude: location.longitude.toString(),
					name: location.name || location.address || ''
				}

				uni.showToast({
					title: '选择成功',
					icon: 'success'
				})
			} catch (error) {
				if (error.message && !error.message.includes('取消')) {
					console.error('选择位置失败:', error)
					uni.showToast({
						title: error.message || '选择失败',
						icon: 'none'
					})
				}
			}
		},
		/**
		 * 打开地图查看位置
		 */
		handleOpenLocation() {
			const addr = this.formData.address
			if (!addr.latitude || !addr.longitude) {
				uni.showToast({
					title: '位置信息不完整',
					icon: 'none'
				})
				return
			}

			openLocation({
				latitude: parseFloat(addr.latitude),
				longitude: parseFloat(addr.longitude),
				name: addr.name || '上课地址',
				address: addr.name || '上课地址'
			})
		},
		validateForm() {
			if (!this.formData.date || !this.formData.time) {
				return '请选择上课日期与时间'
			}
			const scheduleTs = new Date(`${this.formData.date} ${this.formData.time}`.replace(/-/g, '/')).getTime()
			if (!scheduleTs || Number.isNaN(scheduleTs)) {
				return '上课时间格式不正确'
			}
			// 试课不限制上课时间；正式课仍须至少提前一小时
			if (!this.isTrialBooking && scheduleTs < Date.now() + 60 * 60 * 1000) {
				return '上课时间须至少在一小时之后'
			}
			if (!this.formData.studentName) {
				return '请输入学生姓名'
			}
			if (!this.formData.studentGrade) {
				return '请选择或输入学生年级'
			}
			if (!this.formData.subject) {
				return '请输入学习科目'
			}
			if (this.formData.lessonMode === 'offline') {
				if (!this.formData.address.latitude || !this.formData.address.longitude || !this.formData.address.name) {
					return '请选择上课地址'
				}
			}
			return ''
		},
		async submitAppointment() {
			if (this.isSubmitting) return
			const message = this.validateForm()
			if (message) {
				uni.showToast({ title: message, icon: 'none' })
				return
			}
			this.isSubmitting = true
			try {
				const appointmentCreateObj = uniCloud.importObject('appointment-create', { customUI: true })
				// 构建基础参数对象
				const baseParams = {
					teacher_id: this.teacherInfo.teacher_id || this.teacherUid || this.teacherProfileId,
					course_type: this.formData.courseType === 'trial' ? 'trial' : 'regular',
					date: this.formData.date,
					start_time: this.formData.time,
					duration: 2,
					lesson_mode: this.formData.lessonMode,
					student_name: this.formData.studentName,
					student_grade: this.formData.studentGrade,
					subject: this.formData.subject,
					requirements: this.formData.requirements || ''
				}
				
				// 构建可选参数
				const optionalParams = {}
				if (this.formData.invite_id) {
					optionalParams.invite_id = this.formData.invite_id
				}
				// 如果是线下授课，传递地址信息（云函数期望的参数名是 address，不是 location）
				if (this.formData.lessonMode === 'offline' && this.formData.address.latitude && this.formData.address.longitude) {
					optionalParams.address = {
						latitude: parseFloat(this.formData.address.latitude),
						longitude: parseFloat(this.formData.address.longitude),
						name: this.formData.address.name || ''
					}
				}
				
				// 合并参数
				const params = { ...baseParams, ...optionalParams }
				const res = await appointmentCreateObj.create(params)
				if (res.code === 0) {
					uni.showToast({ title: '预约成功，请完成支付', icon: 'success' })
					setTimeout(() => {
						if (res.data?.appointment_id) {
							uni.redirectTo({ url: `/pages-biz/appointment/detail?id=${res.data.appointment_id}` })
						} else {
							uni.redirectTo({ url: '/pages/appointment/list?status=pending_payment' })
						}
					}, 1200)
				} else {
					throw new Error(res.message || '预约失败')
				}
			} catch (error) {
				console.error('预约失败:', error)
				uni.showToast({ title: error.message || '预约失败，请稍后再试', icon: 'none' })
			} finally {
				this.isSubmitting = false
			}
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
	padding-bottom: calc(148rpx + env(safe-area-inset-bottom));
}

.page-loading {
	min-height: 100vh;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: #F4F6F9;
}

.page-loading-spinner {
	width: 56rpx;
	height: 56rpx;
	border: 4rpx solid #EBEDF0;
	border-top-color: #2563EB;
	border-radius: 50%;
	animation: page-loading-spin 0.8s linear infinite;
}

.page-loading-text {
	margin-top: 24rpx;
	font-size: 28rpx;
	color: #8B919C;
}

@keyframes page-loading-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

.hero {
	display: flex;
	align-items: center;
	gap: 24rpx;
	padding: 28rpx 32rpx 32rpx;
	background: linear-gradient(180deg, #2B62E8 0%, #3B7BFF 100%);
}

.hero-avatar {
	width: 112rpx;
	height: 112rpx;
	border-radius: 50%;
	background: #4C6FFF;
	flex-shrink: 0;
}

.hero-main {
	flex: 1;
	min-width: 0;
}

.hero-name {
	display: block;
	font-size: 34rpx;
	font-weight: 600;
	color: #FFFFFF;
	line-height: 1.35;
}

.hero-meta {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.8);
	line-height: 1.4;
}

.form-tip {
	display: block;
	padding: 20rpx 32rpx 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.form-card,
.section-card {
	margin: 0 32rpx 24rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.form-card {
	padding: 8rpx 32rpx 16rpx;
}

.section-card {
	padding: 28rpx 32rpx;
}

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.intro {
	display: block;
	margin: 16rpx 0 0;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.6;
}

.form-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	min-height: 96rpx;
	padding: 16rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.form-row.last {
	border-bottom: none;
}

.form-label {
	flex-shrink: 0;
	font-size: 28rpx;
	color: #5C6370;
}

.form-em {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	color: #8B919C;
	text-align: right;
}

.form-price {
	flex: 1;
	font-size: 32rpx;
	font-weight: 600;
	color: #FA5151;
	text-align: right;
}

.form-input {
	flex: 1;
	min-width: 0;
	text-align: right;
	font-size: 28rpx;
	color: #1F2329;
}

.ph {
	color: #C5C8CE;
}

.hint {
	display: block;
	margin: 8rpx 0 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.choice {
	display: flex;
	gap: 16rpx;
	margin: 0 32rpx 24rpx;
}

.section-card .choice {
	margin: 16rpx 0 0;
}

.choice-item {
	flex: 1;
	min-height: 128rpx;
	padding: 20rpx 16rpx;
	border: 2rpx solid #EBEDF0;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-sizing: border-box;
}

.choice-item.on {
	border-color: #2563EB;
	background: #EEF3FF;
}

.choice-title {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: #1F2329;
}

.choice-sub {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8B919C;
}

.intro-input {
	width: 100%;
	min-height: 180rpx;
	margin-top: 16rpx;
	padding: 20rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	font-size: 26rpx;
	color: #1F2329;
	line-height: 1.6;
	box-sizing: border-box;
}

.map-preview {
	margin: 0 0 16rpx;
	height: 240rpx;
	border-radius: 16rpx;
	overflow: hidden;
	background: #F4F6F9;
}

.scroll-spacer {
	height: 40rpx;
}

.action-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 20;
	display: flex;
	align-items: center;
	gap: 24rpx;
	padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
	background: #FFFFFF;
	border-top: 1rpx solid #EBEDF0;
}

.pay-sum {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: baseline;
	gap: 12rpx;
}

.pay-label {
	font-size: 26rpx;
	color: #5C6370;
}

.pay-amount {
	font-size: 36rpx;
	font-weight: 600;
	color: #FA5151;
}

.save-btn {
	width: 280rpx;
	height: 88rpx;
	margin: 0;
	padding: 0;
	border: none;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 32rpx;
	font-weight: 600;
	line-height: 88rpx;
}

.save-btn::after {
	border: none;
}

.save-btn[disabled] {
	opacity: 0.55;
}
</style>