<template>
	<view>
		<!-- 教师信息头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex a-center text-white">
				<image 
					class="rounded-circle border-light" 
					:src="teacherInfo.avatar || defaultAvatarUrl" 
					mode="aspectFill"
					style="width: 140rpx;height: 140rpx;border: 4rpx solid rgba(255,255,255,0.3);"
				/>
				<view class="ml-3 flex-1">
					<text class="font-lg font-weight d-block mb-1">{{ teacherInfo.display_name || teacherInfo.name || '教师' }}</text>
					<view class="d-flex a-center flex-wrap">
						<text class="font-sm mr-3">⭐ {{ formatRating(teacherInfo.rating) }}</text>
						<text class="font-sm mr-3">¥{{ teacherInfo.hourly_rate || 100 }}/小时</text>
						<text class="font-sm mr-3">{{ teacherInfo.total_students || 0 }} 位学生</text>
						<text v-if="teacherInfo.trial_count > 0" class="font-sm mr-3">试课 {{ teacherInfo.trial_count }} 次</text>
						<text v-if="teacherInfo.trial_success_rate > 0" class="font-sm">成功率 {{ formatPercent(teacherInfo.trial_success_rate) }}</text>
					</view>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 课程类型 -->
				<card headTitle="课程类型" v-if="!formData.invite_id">
					<view class="d-flex a-center">
						<view 
							class="flex-1 text-center py-3 rounded"
							:class="formData.courseType === 'formal' ? 'main-bg-color text-white' : 'bg-light-secondary'"
							@click="changeCourseType('formal')"
						>
							<text class="font-md font-weight d-block mb-1">正式课程</text>
							<text class="font-sm d-block mb-1">完整 2 小时课程</text>
							<text class="font-md font-weight" :style="formData.courseType === 'formal' ? 'color: #FFD700;' : 'color: #FFB800;'">¥{{ formalPrice }}</text>
						</view>
					</view>
					<view class="text-light-muted font-sm mt-2 pt-2 border-top">
						提示：试课预约需由老师发起邀请，请先联系老师。
					</view>
				</card>
				<!-- 试课邀请信息（如果是从邀请创建） -->
				<card headTitle="试课邀请" v-if="formData.invite_id" class="mt-3">
					<view class="d-flex a-center py-2">
						<text class="iconfont icon-huangguan main-text-color mr-2" style="font-size: 40rpx;"></text>
						<view class="flex-1">
							<text class="font-md font-weight d-block mb-1">老师邀请您预约试课</text>
							<text class="font-sm text-light-muted">2小时试课，不满意可退一半</text>
						</view>
						<text class="font-md font-weight main-text-color">¥{{ trialPrice }}</text>
					</view>
				</card>

				<!-- 预约时间 -->
				<card headTitle="预约时间" class="mt-3">
					<view class="text-light-muted font-sm mb-2">推荐选择老师空闲时段</view>
					<picker mode="date" :value="formData.date" :start="dateOptions.start" :end="dateOptions.end" @change="onDateChange">
						<view class="d-flex a-center j-sb py-3 border-bottom">
							<text class="font-sm">上课日期</text>
							<text class="font-sm" :class="formData.date ? '' : 'text-light-muted'">{{ formData.date || '请选择' }}</text>
						</view>
					</picker>
					<picker mode="time" :value="formData.time" start="08:00" end="21:00" @change="onTimeChange">
						<view class="d-flex a-center j-sb py-3">
							<text class="font-sm">开始时间</text>
							<text class="font-sm" :class="formData.time ? '' : 'text-light-muted'">{{ formData.time || '请选择' }}</text>
						</view>
					</picker>
					<view class="text-light-muted font-sm mt-2">课程默认持续 2 小时，如需调整可与老师沟通修改。</view>
				</card>

				<!-- 学生信息 -->
				<card headTitle="学生信息" class="mt-3">
					<view class="text-light-muted font-sm mb-2">请填写真实信息，方便老师备课</view>
					<view class="d-flex a-center j-sb py-3 border-bottom">
						<text class="font-sm">学生姓名</text>
						<input 
							class="text-right font-sm flex-1 ml-3" 
							v-model.trim="formData.studentName" 
							placeholder="请输入学生姓名"
							placeholder-class="text-light-muted"
						/>
					</view>
					<picker mode="selector" :range="gradeOptions" :value="gradeIndex" @change="onGradeChange">
						<view class="d-flex a-center j-sb py-3 border-bottom">
							<text class="font-sm">所在年级</text>
							<text class="font-sm" :class="formData.studentGrade ? '' : 'text-light-muted'">{{ formData.studentGrade || '选择年级' }}</text>
							<text class="iconfont icon-you text-light-muted ml-2"></text>
						</view>
					</picker>
					<view class="d-flex a-center j-sb py-3">
						<text class="font-sm">学习科目</text>
						<input 
							class="text-right font-sm flex-1 ml-3" 
							v-model.trim="formData.subject" 
							placeholder="如：数学"
							placeholder-class="text-light-muted"
						/>
					</view>
				</card>

				<!-- 上课方式 -->
				<card headTitle="上课方式" class="mt-3">
					<view class="d-flex a-center">
						<view 
							class="flex-1 text-center py-3 rounded mr-2"
							:class="formData.lessonMode === 'online' ? 'main-bg-color text-white' : 'bg-light-secondary'"
							@click="formData.lessonMode = 'online'"
						>
							<text class="font-sm">线上授课</text>
						</view>
						<view 
							class="flex-1 text-center py-3 rounded"
							:class="formData.lessonMode === 'offline' ? 'main-bg-color text-white' : 'bg-light-secondary'"
							@click="formData.lessonMode = 'offline'"
						>
							<text class="font-sm">线下授课</text>
						</view>
					</view>
					<view v-if="formData.lessonMode === 'offline'" class="mt-3">
						<!-- 地址选择按钮 -->
						<view class="d-flex a-center j-sb py-2 border-bottom mb-3">
							<text class="font-sm">上课地址</text>
							<view class="d-flex a-center" @click="handleChooseLocation">
								<text class="font-sm main-text-color mr-2">{{ addressDisplay || '点击选择地址' }}</text>
								<text class="iconfont icon-arrow-right font-sm text-light-muted"></text>
							</view>
						</view>
						<!-- 地图预览 -->
						<view v-if="formData.address.latitude && formData.address.longitude" class="map-preview-container">
							<map
								:latitude="parseFloat(formData.address.latitude)"
								:longitude="parseFloat(formData.address.longitude)"
								:markers="mapMarkers"
								:scale="15"
								:show-location="true"
								style="width: 100%; height: 300rpx; border-radius: 12rpx;"
								@tap="handleOpenLocation"
							></map>
						</view>
					</view>
				</card>

				<!-- 补充说明 -->
				<card headTitle="补充说明" class="mt-3">
					<view class="text-light-muted font-sm mb-2">可描述孩子情况、希望教师重点关注内容</view>
					<textarea 
						class="w-100 border rounded p-2 font-sm" 
						v-model.trim="formData.requirements" 
						placeholder="示例：孩子基础薄弱，希望重点巩固概念。" 
						maxlength="200"
						style="min-height: 140rpx;"
						placeholder-class="text-light-muted"
					/>
				</card>

				<!-- 费用概览 -->
				<card headTitle="费用概览" class="mt-3">
					<view class="d-flex a-center j-sb py-2">
						<text class="font-sm">课程费用</text>
						<text class="main-text-color font-md font-weight">¥{{ totalAmount }}</text>
					</view>
					<view class="text-light-muted font-sm mt-2 pt-2 border-top" v-if="formData.courseType === 'trial'">
						试课费用为2小时价格（{{ hourlyRate }}元/小时 × 2小时）。如不满意可申请退款，将退还1小时费用（50%）。
					</view>
					<view class="text-light-muted font-sm mt-2 pt-2 border-top" v-else>
						正式课程结束后，如正式长线合作，费用将根据课时套餐调整。
					</view>
				</card>
			</view>
		</scroll-view>

		<!-- 底部操作栏 -->
		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<view class="flex-1">
				<text class="font-sm text-light-muted d-block">应付金额</text>
				<text class="main-text-color font-md font-weight d-block">¥{{ totalAmount }}</text>
			</view>
			<button 
				class="main-bg-color text-white rounded px-4 py-2 font-md font-weight" 
				:disabled="isSubmitting" 
				@click="submitAppointment"
				style="min-width: 220rpx;"
			>
				{{ isSubmitting ? '提交中...' : '确认预约' }}
			</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { 
	chooseLocation, 
	openLocation, 
	requestLocationPermission 
} from '@/utils/location.js'

export default {
	name: 'AppointmentCreate',
	components: {
		card
	},
	data() {
		return {
			teacherProfileId: '',
			teacherUid: '',
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
			defaultAvatarUrl: getDefaultAvatarUrl()
		}
	},
	computed: {
		hourlyRate() {
			const rate = Number(this.teacherInfo?.hourly_rate)
			return Number.isFinite(rate) && rate > 0 ? rate : 100
		},
		trialPrice() {
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
		this.teacherProfileId = options.teacherProfileId || options.id || options.teacherId || ''
		this.teacherUid = options.teacherUid || options.teacher_id || ''
		// 支持从试课邀请创建（传入 invite_id）
		if (options.invite_id) {
			this.formData.invite_id = options.invite_id
			await this.loadInviteInfo(options.invite_id)
		}
		this.setupDateRange()
		await this.ensureTeacher()
		this.prefillFromProfile()
	},
	methods: {
		setupDateRange() {
			const today = new Date()
			const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
			const oneMonthLater = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
			this.dateOptions.start = this.formatDate(tomorrow)
			this.dateOptions.end = this.formatDate(oneMonthLater)
			this.formData.date = this.dateOptions.start
		},
		async ensureTeacher() {
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
			if (!invite_id) return
			try {
				const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
				const res = await appointmentQuery.getAppointmentDetail({ appointment_id: invite_id })
				if (res.code === 0 && res.data) {
					const invite = res.data
					// 验证是试课邀请状态
					if (invite.status !== 'trial_invited') {
						uni.showToast({ title: '该试课邀请已处理', icon: 'none' })
						setTimeout(() => uni.navigateBack(), 1500)
						return
					}
					// 预填充教师ID（从预约数据中获取 teacher_id）
					if (invite.teacher_id) {
						this.teacherUid = invite.teacher_id
					}
					// 课程类型固定为试课（从邀请创建）
					this.formData.courseType = 'trial'
					this.formData.invite_id = invite._id
				} else {
					throw new Error(res.message || '加载邀请信息失败')
				}
			} catch (error) {
				console.error('加载试课邀请信息失败:', error)
				uni.showToast({ title: error.message || '加载失败', icon: 'none' })
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
			try {
				const teacherListObj = uniCloud.importObject('teacher-list', { customUI: true })
				const res = await teacherListObj.getDetail({ teacherId: this.teacherProfileId || this.teacherUid })
				if (res.code === 0) {
					this.teacherInfo = res.data
					this.teacherProfileId = res.data._id || this.teacherProfileId
					this.teacherUid = res.data.teacher_id || this.teacherUid
				} else {
					throw new Error(res.message || '加载教师失败')
				}
			} catch (error) {
				console.error('加载教师失败:', error)
				uni.showToast({ title: error.message || '加载教师失败', icon: 'none' })
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
		},
		onTimeChange(e) {
			this.formData.time = e.detail.value
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
					uni.showToast({ title: '预约成功', icon: 'success' })
					setTimeout(() => {
						if (res.data?.appointment_id) {
							uni.redirectTo({ url: `/pages/appointment/detail?id=${res.data.appointment_id}` })
						} else {
							uni.redirectTo({ url: '/pages/appointment/list' })
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
.scroll {
	flex: 1;
	height: calc(100vh - 500rpx);
	padding-bottom: 160rpx;
}

/* 地图预览容器 */
.map-preview-container {
	width: 100%;
	height: 300rpx;
	border-radius: 12rpx;
	overflow: hidden;
	background-color: #F5F5F5;
	margin-top: 16rpx;
}
</style>