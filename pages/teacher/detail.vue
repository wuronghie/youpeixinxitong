<!--
 * 页面名称：教师详情页（家长端）
 * 路由路径：pages/teacher/detail
 * 页面功能：
 *   1. 显示教师详细信息（头像、姓名、职称、评分、价格、经验）
 *   2. 显示教师擅长科目、适合年级
 *   3. 显示教学亮点（累计学生、完成课程、家长评价）
 *   4. 显示教育背景、资格证书、可预约时间
 *   5. 显示最近评价列表
 *   6. 收藏/取消收藏功能
 *   7. 联系教师、预约试课功能
 *   8. 支持下拉刷新
 * 
 * 数据结构说明：
 *   - teacherInfo: 教师详细信息
 *   - recentReviews: 最近评价列表
 *   - isFavorited: 是否已收藏
 *   - availableTimes: 可预约时间列表
 * 
 * 修改说明：
 *   - 修改详情展示：修改各个 card 区域的 template
 *   - 添加新的信息展示：在 scroll-view 中添加新的 card
 *   - 修改操作按钮：修改底部 action-bar 中的按钮
 *   - 修改评价展示：修改 recentReviews 的展示方式
-->
<template>
	<view class="teacher-detail-page">
		<!-- 头部区域：教师基本信息、评分、价格、收藏按钮 -->
		<view class="detail-hero position-relative">
			<view class="hero-overlay"></view>
			<view class="hero-card position-relative">
				<view class="d-flex a-center position-relative">
					<view class="avatar-shell rounded-circle d-flex a-center j-center">
						<image 
							class="rounded-circle border-light" 
							:src="teacherInfo.avatar || defaultAvatarUrl" 
							mode="aspectFill"
							style="width: 150rpx;height: 150rpx;border: 4rpx solid rgba(255,255,255,0.3);"
						/>
					</view>
					<view class="ml-3 flex-1 text-white">
						<view class="d-flex a-center mb-1 flex-wrap">
							<text class="font-lg font-weight">{{ teacherInfo.display_name || teacherInfo.name || '教师' }}</text>
							<text v-if="teacherInfo.is_verified" class="ml-2 stat-tag rounded px-2 py-1 font-sm text-white">认证</text>
						</view>
						<text v-if="teacherInfo.school || teacherInfo.experience" class="font-sm d-block mb-2 hero-subtitle">
							{{ [teacherInfo.school, teacherInfo.experience].filter(Boolean).join(' · ') }}
						</text>
						<view class="hero-metrics">
							<view class="hero-metric-item">
								<text class="font-lg font-weight d-block">{{ formatRating(teacherInfo.rating) }}</text>
								<text class="font-sm hero-metric-label">综合评分</text>
							</view>
							<view class="hero-metric-item">
								<text class="font-lg font-weight d-block">¥{{ teacherInfo.hourly_rate || 100 }}</text>
								<text class="font-sm hero-metric-label">课时费/小时</text>
							</view>
							<view class="hero-metric-item">
								<text class="font-lg font-weight d-block">{{ formatExperience() }}</text>
								<text class="font-sm hero-metric-label">教学经验</text>
							</view>
						</view>
					</view>
					<!-- 收藏按钮 -->
					<view
						class="favorite-btn position-absolute d-flex a-center j-center"
						style="top: 0;right: 0;"
						@click.stop="toggleFavorite"
					>
						<image 
							:src="isFavorited ? favoriteFilledUrl : favoriteEmptyUrl"
							mode="aspectFit"
							style="width: 50rpx; height: 50rpx;"
						/>
					</view>
				</view>
			</view>
		</view>

		<scroll-view 
			scroll-y 
			:refresher-enabled="true" 
			:refresher-triggered="isRefreshing" 
			@refresherrefresh="onRefresh"
			class="scroll"
		>
			<view class="page-content px-3 py-3">
				<!-- 擅长科目 -->
				<card v-if="(teacherInfo.subjects || []).length" class="detail-card">
					<view slot="title" class="font-md font-weight">擅长科目</view>
					<view class="d-flex a-center flex-wrap">
						<text 
							v-for="subject in teacherInfo.subjects" 
							:key="subject" 
							class="detail-tag rounded px-3 py-1 font-sm mr-2 mb-2"
						>
							{{ subject }}
						</text>
					</view>
				</card>

				<!-- 适合年级 -->
				<card v-if="gradeText" class="mt-3 detail-card">
					<view slot="title" class="font-md font-weight">适合年级</view>
					<view class="d-flex a-center flex-wrap">
						<text 
							v-for="grade in gradeText" 
							:key="grade" 
							class="detail-outline-tag rounded px-3 py-1 font-sm mr-2 mb-2"
						>
							{{ grade }}
						</text>
					</view>
				</card>

				<!-- 教学亮点 -->
				<card class="mt-3 detail-card">
					<view slot="title" class="font-md font-weight">教学亮点</view>
					<view class="highlight-grid mb-3">
						<view class="highlight-item text-center">
							<text class="font-lg font-weight d-block">{{ formatRating(teacherInfo.rating) }}</text>
							<text class="font-sm text-light-muted d-block mt-1">综合评分</text>
						</view>
						<view class="highlight-item text-center">
							<text class="font-lg font-weight d-block">{{ teacherInfo.trial_count || 0 }}</text>
							<text class="font-sm text-light-muted d-block mt-1">试课次数</text>
						</view>
						<view class="highlight-item text-center">
							<text class="font-lg font-weight d-block">{{ teacherInfo.trial_success_count != null ? teacherInfo.trial_success_count : 0 }}</text>
							<text class="font-sm text-light-muted d-block mt-1">试课成功数</text>
						</view>
						<view class="highlight-item text-center">
							<text class="font-lg font-weight d-block">{{ formatPercent(teacherInfo.trial_success_rate) }}</text>
							<text class="font-sm text-light-muted d-block mt-1">试课成功率</text>
						</view>
					</view>
					<view class="highlight-grid secondary-grid mb-3">
						<view class="highlight-item text-center">
							<text class="font-lg font-weight d-block">{{ teacherInfo.total_students || 0 }}</text>
							<text class="font-sm text-light-muted d-block mt-1">累计学生</text>
						</view>
						<view class="highlight-item text-center">
							<text class="font-lg font-weight d-block">{{ teacherInfo.total_courses || teacherInfo.total_hours || 0 }}</text>
							<text class="font-sm text-light-muted d-block mt-1">完成课程</text>
						</view>
						<view class="highlight-item text-center">
							<text class="font-lg font-weight d-block">{{ teacherInfo.review_count || (recentReviews.length) }}</text>
							<text class="font-sm text-light-muted d-block mt-1">家长评价</text>
						</view>
					</view>
					<view class="intro-box">
						<text class="font text-secondary intro-text">{{ teacherInfo.introduction || '老师正在完善介绍，欢迎预约体验课程。' }}</text>
					</view>
				</card>

				<!-- 教学地址与距离 -->
				<card v-if="teacherAddressText || teacherDistanceText" class="mt-3 detail-card">
					<view slot="title" class="font-md font-weight">教学地址</view>
					<view class="info-list">
						<view v-if="teacherAddressText" class="info-row">
							<text class="info-label">教学地址</text>
							<text class="info-value text-right">📍 {{ teacherAddressText }}</text>
						</view>
						<view v-if="teacherDistanceText" class="info-row no-border">
							<text class="info-label">与我距离</text>
							<text class="info-value text-primary">约 {{ teacherDistanceText }} km</text>
						</view>
					</view>
				</card>

				<!-- 所在院校和资历 -->
				<card v-if="teacherInfo.school || teacherInfo.experience" class="mt-3 detail-card">
					<view slot="title" class="font-md font-weight">基本信息</view>
					<view class="info-list">
						<view v-if="teacherInfo.school" class="info-row">
							<text class="info-label">所在院校</text>
							<text class="info-value">{{ teacherInfo.school }}</text>
						</view>
						<view v-if="teacherInfo.experience" class="info-row no-border">
							<text class="info-label">教师资历</text>
							<text class="info-value">{{ teacherInfo.experience }}</text>
						</view>
					</view>
				</card>

				<!-- 附加标签 -->
				<card v-if="(teacherInfo.tags || []).length" class="mt-3 detail-card">
					<view slot="title" class="font-md font-weight">教学特色</view>
					<view class="d-flex a-center flex-wrap">
						<text 
							v-for="tag in teacherInfo.tags" 
							:key="tag" 
							class="detail-tag rounded px-3 py-1 font-sm mr-2 mb-2"
						>
							{{ tag }}
						</text>
					</view>
				</card>

				<!-- 教育背景 -->
				<card v-if="teacherInfo.education && (teacherInfo.education.degree || teacherInfo.education.major || teacherInfo.education.graduation_year)" class="mt-3 detail-card">
					<view slot="title" class="font-md font-weight">教育背景</view>
					<view class="info-list">
						<view v-if="teacherInfo.education.degree" class="info-row">
							<text class="info-label">学历</text>
							<text class="info-value">{{ teacherInfo.education.degree }}</text>
						</view>
						<view v-if="teacherInfo.education.major" class="info-row">
							<text class="info-label">专业</text>
							<text class="info-value">{{ teacherInfo.education.major }}</text>
						</view>
						<view v-if="teacherInfo.education.graduation_year" class="info-row no-border">
							<text class="info-label">毕业年份</text>
							<text class="info-value">{{ teacherInfo.education.graduation_year }}</text>
						</view>
					</view>
				</card>

				<!-- 资质证书 -->
				<card v-if="(teacherInfo.qualifications || []).length" class="mt-3 detail-card">
					<view slot="title" class="font-md font-weight">资质证书</view>
					<view class="d-flex a-center flex-wrap">
						<text 
							v-for="(item, index) in teacherInfo.qualifications" 
							:key="index" 
							class="detail-tag rounded px-3 py-1 font-sm mr-2 mb-2"
						>
							{{ item.name || '证书' }}
						</text>
					</view>
				</card>

				<!-- 可预约时间 -->
				<card v-if="scheduleSummary.length" class="mt-3 detail-card">
					<view slot="title" class="font-md font-weight">可预约时间</view>
					<view class="d-flex flex-column">
						<view 
							v-for="slot in scheduleSummary" 
							:key="slot.day" 
							class="schedule-item d-flex a-center j-sb rounded px-3 py-2 mb-2"
						>
							<text class="font">{{ slot.day }}</text>
							<text class="font text-primary">{{ slot.time }}</text>
						</view>
					</view>
				</card>

				<!-- 家长评价 -->
				<card v-if="recentReviews.length" class="mt-3 detail-card">
					<view slot="title" class="d-flex a-center j-sb w-100">
						<text class="font-md font-weight">家长评价</text>
						<text class="text-primary font-sm" @click="goToReviews">查看全部</text>
					</view>
					<view v-for="review in recentReviews" :key="review._id" class="review-card rounded p-3 mb-2">
						<view class="d-flex a-center j-sb mb-2">
							<text class="font-sm">{{ review.parent_name || '家长' }}</text>
							<text class="font-sm text-light-muted">{{ formatTime(review.create_time) }}</text>
						</view>
						<view class="text-warning font-sm mb-2">⭐ {{ review.rating || 5 }}</view>
						<text class="font text-secondary">{{ review.content }}</text>
					</view>
				</card>

				<view v-if="isLoading" class="text-center text-light-muted font py-5">教师资料加载中...</view>
				<view v-else-if="loadError" class="d-flex flex-column a-center j-center py-5">
					<text class="iconfont icon-jinggao" style="font-size: 100rpx;color: #ddd;"></text>
					<text class="text-light-muted font-md mt-3">{{ loadError }}</text>
					<button class="main-bg-color text-white rounded px-4 py-2 mt-3 font-sm" @click="loadDetail">重新加载</button>
				</view>
			</view>
		</scroll-view>

		<!-- 底部操作栏 -->
		<view class="action-bar position-fixed bottom-0 left-0 right-0 d-flex a-center px-3 py-3" style="z-index: 100;">
			<view class="flex-1">
				<text class="font-sm text-light-muted d-block">课程费用</text>
				<text class="main-text-color font-md font-weight d-block">¥{{ teacherInfo.hourly_rate || 100 }}/小时</text>
			</view>
			<view class="d-flex a-center">
				<button 
					class="secondary-action-btn border border-primary text-primary rounded px-4 py-2 font-md mr-2" 
					:disabled="isLoading || loadError || isContacting" 
					@click="handleContactTeacher"
					style="min-width: 160rpx;"
				>
					{{ isContacting ? '联系中...' : '联系老师' }}
				</button>
				<button 
					v-if="canMakeAppointment"
					class="primary-action-btn main-bg-color text-white rounded px-4 py-2 font-md font-weight" 
					:disabled="isLoading || loadError" 
					@click="goToAppointment"
					style="min-width: 160rpx;"
				>
					立即预约
				</button>
				<view v-else-if="hasContacted && !hasTrialSuccess" class="text-center" style="min-width: 160rpx;">
					<text class="font-sm text-light-muted">请先完成试课</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { useMockData, mockTeachers } from '@/utils/mockData.js'
import card from '@/components/common/card.vue'
import { getDefaultAvatarUrl, getIconUrl } from '@/utils/imageConfig.js'

export default {
	name: 'TeacherDetail',
	components: {
		card
	},
	data() {
		return {
			teacherId: '',
			teacherUid: '',
			teacherInfo: {},
			isLoading: false,
			loadError: '',
			isRefreshing: false,
			scrollTop: 0,
			canRefresh: true,
			isFavorited: false,
			favoriteLoading: false,
			useMock: false,
			isContacting: false,
			hasContacted: false, // 是否已联系过老师
			hasTrialSuccess: false, // 是否已完成试课并成功
			userLocation: null, // 用户位置（用于距离）
			// 默认头像URL（从CDN）
			defaultAvatarUrl: getDefaultAvatarUrl(),
			// 收藏图标URL（从CDN）
			favoriteFilledUrl: getIconUrl('favorite-filled.png'),
			favoriteEmptyUrl: getIconUrl('favorite-empty.png')
		}
	},
	computed: {
		gradeText() {
			const list = this.teacherInfo.grades || []
			if (!list.length) return null
			return list
		},
		recentReviews() {
			return this.teacherInfo.recent_reviews || []
		},
		scheduleSummary() {
			const schedule = this.teacherInfo.schedule?.week_schedule || []
			return schedule
				.filter(day => (day.slots || []).some(slot => slot.is_available))
				.slice(0, 4)
				.map(day => {
					const times = (day.slots || [])
						.filter(slot => slot.is_available)
						.map(slot => `${slot.start_time}~${slot.end_time}`)
						.join('、')
					return {
						day: day.name || day.day || '周',
						time: times || '全天'
					}
				})
		},
		canMakeAppointment() {
			// 规则调整：只要已完成该老师的试课并且结果为成功，就允许预约正式课程
			// 不再强制要求 hasContacted 为 true，避免会话检测异常导致无法预约
			return this.hasTrialSuccess
		},
		teacherAddressText() {
			const areas = this.teacherInfo.teaching_areas || []
			if (!areas.length) return ''
			const area = areas[0]
			if (area.name && String(area.name).trim()) return String(area.name).trim()
			const parts = [area.province, area.city, area.district, area.address].filter(Boolean)
			return parts.join(' ') || ''
		},
		teacherDistanceText() {
			if (!this.userLocation || this.userLocation.lat == null || this.userLocation.lon == null) return ''
			const areas = this.teacherInfo.teaching_areas || []
			const withCoord = areas.find(a => a.latitude != null && a.longitude != null)
			if (!withCoord) return ''
			const km = this.haversineKm(
				this.userLocation.lat,
				this.userLocation.lon,
				parseFloat(withCoord.latitude),
				parseFloat(withCoord.longitude)
			)
			return km != null ? km.toFixed(1) : ''
		}
	},
	onLoad(options) {
		this.useMock = useMockData() === true
		this.teacherId = options.id || options.teacherProfileId || ''
		this.teacherUid = options.teacherUid || options.teacher_id || ''
		if (!this.teacherId && !this.teacherUid) {
			this.loadError = '未找到教师编号'
			uni.showToast({ title: '教师ID不能为空', icon: 'none' })
			setTimeout(() => uni.navigateBack(), 1500)
			return
		}
		this.fetchUserLocation()
		this.loadDetail()
	},
	onShareAppMessage() {
		// 分享教师详情给好友
		const id = this.teacherId || this.teacherUid || ''
		const path = id ? `/pages/teacher/detail?id=${id}` : '/pages/index/index'
		return {
			title: this.teacherInfo.display_name || this.teacherInfo.name || '优质家教老师推荐',
			path
		}
	},
	onShareTimeline() {
		// 分享到朋友圈，仅支持 title + query
		const id = this.teacherId || this.teacherUid || ''
		const query = id ? `id=${id}` : ''
		return {
			title: this.teacherInfo.display_name || this.teacherInfo.name || '优质家教老师推荐',
			query
		}
	},
	methods: {
		async onRefresh() {
			if (!this.canRefresh || this.scrollTop > 10) {
				this.isRefreshing = false
				return
			}
			if (this.isRefreshing) return
			this.isRefreshing = true
			await this.loadDetail()
			this.isRefreshing = false
		},
		async loadDetail() {
			if (this.isLoading) return
			this.isLoading = true
			this.loadError = ''
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const teacher = mockTeachers[0] || {}
					this.teacherInfo = teacher
					this.teacherId = teacher._id || this.teacherId
					this.teacherUid = teacher.teacher_id || this.teacherUid
					this.isFavorited = true
					return
				}
				const teacherListObj = uniCloud.importObject('teacher-list', { customUI: true })
				const result = await teacherListObj.getDetail({ teacherId: this.teacherId || this.teacherUid })
				if (result.code === 0) {
					this.teacherInfo = result.data
					this.teacherId = result.data._id || this.teacherId
					this.teacherUid = result.data.teacher_id || this.teacherUid
					await this.fetchFavoriteStatus()
					await this.checkContactStatus()
				} else {
					throw new Error(result.message || '加载失败')
				}
			} catch (error) {
				console.error('加载教师详情失败:', error)
				this.loadError = error.message || '加载失败，请稍后重试'
				uni.showToast({ title: this.loadError, icon: 'none' })
			} finally {
				this.isLoading = false
			}
		},
		async handleContactTeacher() {
			if (this.isContacting || this.loadError) return
			
			const stored = uni.getStorageSync('userInfo') || {}
			if (!stored.uid) {
				uni.showToast({ title: '请先登录', icon: 'none' })
				setTimeout(() => {
					uni.reLaunch({ url: '/pages/login/index' })
				}, 1500)
				return
			}
			
			const parentInfo = stored.parent_info || {}
			if (!parentInfo.student_name || !parentInfo.student_grade) {
				uni.showModal({
					title: '提示',
					content: '请先完善孩子信息（学生姓名和年级）才能联系老师',
					confirmText: '去完善',
					cancelText: '取消',
					success: (res) => {
						if (res.confirm) {
							uni.navigateTo({ url: '/pages/common/register' })
						}
					}
				})
				return
			}
			
			this.isContacting = true
			try {
				const teacherId = this.teacherUid || this.teacherId
				if (!teacherId) {
					throw new Error('教师信息不完整')
				}
				
				// 确保所有字段都有值（即使是空字符串）
				const contactParams = {
					teacher_id: teacherId,
					student_name: parentInfo.student_name || '',
					student_grade: parentInfo.student_grade || '',
					student_subjects: Array.isArray(parentInfo.student_subjects) ? parentInfo.student_subjects : [],
					learning_goal: parentInfo.learning_goal || '',
					extra_notes: parentInfo.extra_notes || '',
					address_detail: parentInfo.address_detail || ''
				}
				
				console.log('[teacher-detail] 联系请求参数:', contactParams)
				console.log('[teacher-detail] parentInfo:', parentInfo)
				
				const appointmentObj = uniCloud.importObject('appointment-create', { customUI: true })
				const result = await appointmentObj.createContactRequest(contactParams)
				
				if (result.code === 0) {
					// 检查是否已经存在联系请求
					if (result.data?.already_exists) {
						uni.showToast({ title: result.message || '您已经发送过联系请求', icon: 'none' })
					} else {
						uni.showToast({ title: '已发送联系请求', icon: 'success' })
					}
					
					const conversationId = result.data?.conversation_id || ''
					const appointmentId = result.data?.appointment_id || ''
					
					// 如果有会话ID且不是已存在的请求，发送一条包含详细信息的初始消息
					if (conversationId && !result.data?.already_exists) {
						try {
							// 使用传入的参数构建消息（确保使用实际传入的值）
							const subjects = (contactParams.student_subjects || []).length > 0 
								? contactParams.student_subjects.join('、')
								: '未指定'
							const grade = contactParams.student_grade || '未填写'
							const learningGoal = contactParams.learning_goal || ''
							
							// 处理地址：只保留到小区，屏蔽门牌号
							const rawAddress = contactParams.address_detail || ''
							const safeAddress = this.maskAddress(rawAddress)
							
							// 处理备注：屏蔽电话号码和其他联系方式
							const rawNotes = contactParams.extra_notes || ''
							const safeNotes = this.maskContactInfo(rawNotes)
							
							let messageContent = `您好，我想为孩子咨询课程。\n\n`
							messageContent += `学生姓名：${contactParams.student_name || '未填写'}\n`
							messageContent += `所在年级：${grade}\n`
							messageContent += `学习科目：${subjects}\n`
							// 地址字段始终显示（已处理隐私）
							messageContent += `所在地址：${safeAddress || '未填写'}\n`
							
							if (learningGoal) {
								messageContent += `学习目标：${learningGoal}\n`
							}
							// 备注字段始终显示（已处理隐私）
							messageContent += `备注：${safeNotes || '无'}\n`
							
							messageContent += `\n希望了解您的教学安排，期待您的回复！`
							
							console.log('[teacher-detail] 发送消息内容:', messageContent)
							
							const chatSend = uniCloud.importObject('chat-send', { customUI: true })
							await chatSend.send({
								conversation_id: conversationId,
								message_type: 'text',
								content: messageContent
							})
						} catch (msgError) {
							console.warn('发送初始消息失败:', msgError)
							// 消息发送失败不影响跳转
						}
					}
					
					// 联系成功后，更新联系状态
					this.hasContacted = true
					
					setTimeout(() => {
						if (conversationId) {
							const params = [`conversationId=${conversationId}`]
							if (appointmentId) {
								params.push(`appointmentId=${appointmentId}`)
							}
							uni.navigateTo({
								url: `/pages/chat/conversation?${params.join('&')}`
							})
						} else if (appointmentId) {
							uni.navigateTo({
								url: `/pages/chat/conversation?appointmentId=${appointmentId}`
							})
						} else {
							uni.navigateTo({
								url: `/pages/chat/list`
							})
						}
					}, result.data?.already_exists ? 1500 : 800)
				} else {
					throw new Error(result.message || '发送联系请求失败')
				}
			} catch (error) {
				console.error('联系老师失败:', error)
				uni.showToast({ title: error.message || '联系失败，请稍后再试', icon: 'none' })
			} finally {
				this.isContacting = false
			}
		},
		goToAppointment() {
			if (this.loadError) return
			const params = []
			if (this.teacherId) params.push(`teacherProfileId=${this.teacherId}`)
			if (this.teacherUid) params.push(`teacherUid=${this.teacherUid}`)
			uni.navigateTo({ url: `/pages/appointment/create${params.length ? '?' + params.join('&') : ''}` })
		},
		goToReviews() {
			if (!this.teacherUid && !this.teacherId) return
			uni.navigateTo({ url: `/pages/review/create?teacherId=${this.teacherUid || this.teacherId}` })
		},
		async fetchFavoriteStatus() {
			try {
				if (this.useMock) {
					this.isFavorited = true
					return
				}
				const stored = uni.getStorageSync('userInfo') || {}
				if (!stored.uid) {
					this.isFavorited = false
					return
				}
				const teacherId = this.teacherUid || this.teacherId
				if (!teacherId) {
					this.isFavorited = false
					return
				}
				const favoriteObj = uniCloud.importObject('teacher-favorite', { customUI: true })
				const res = await favoriteObj.checkFavorite({ teacher_id: teacherId })
				if (res.code === 0 && res.data) {
					this.isFavorited = !!res.data.favorited
				} else {
					this.isFavorited = false
				}
			} catch (error) {
				console.error('查询收藏状态失败:', error)
				this.isFavorited = false
			}
		},
		async checkContactStatus() {
			// 检查是否已联系过该老师，以及是否有该老师的试课成功记录
			try {
				if (this.useMock) {
					this.hasContacted = false
					this.hasTrialSuccess = false
					return
				}
				
				const stored = uni.getStorageSync('userInfo') || {}
				if (!stored.uid) {
					this.hasContacted = false
					this.hasTrialSuccess = false
					return
				}
				
				const teacherId = this.teacherUid || this.teacherId
				if (!teacherId) {
					this.hasContacted = false
					this.hasTrialSuccess = false
					return
				}
				
				// 1）使用 chat-send.getConversationList 检查是否有与该老师的会话（用于展示“请先完成试课”等提示）
				try {
					const chatSend = uniCloud.importObject('chat-send', { customUI: true })
					const conversationListRes = await chatSend.getConversationList()
					
					if (conversationListRes.code === 0 && conversationListRes.data) {
						const conversations = conversationListRes.data.list || conversationListRes.data || []
						console.log('[teacher-detail] 会话列表数量:', conversations.length)
						// 检查是否有与当前老师的会话
						const hasConversation = conversations.some(conv => {
							// 检查 teacher_id 字段或 other_user 中的 teacher_id
							return conv.teacher_id === teacherId || 
							       conv.other_user?.teacher_id === teacherId ||
							       conv.teacher_info?.teacher_id === teacherId
						})
						
						this.hasContacted = !!hasConversation
						console.log('[teacher-detail] hasContacted 计算结果:', {
							teacherId,
							hasConversation
						})
					}
				} catch (chatError) {
					console.warn('检查会话列表失败:', chatError)
					// 如果检查失败，默认未联系
					this.hasContacted = false
				}
				
				// 2）无论是否 hasContacted，都检查是否有该老师的试课成功记录
				try {
					const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
					// 查询家长的所有预约（包括已完成和进行中的），避免漏掉历史试课
					const appointmentListRes = await appointmentQuery.getParentAppointments({
						status: 'all',
						page: 1,
						pageSize: 200 // 查询足够多的记录，后续可根据需要调整
					})
					
					if (appointmentListRes.code === 0 && appointmentListRes.data) {
						const appointments = appointmentListRes.data.list || appointmentListRes.data || []
						console.log('[teacher-detail] 家长预约总数:', appointments.length)
						// 过滤出与当前老师相关的预约
						const relatedAppointments = appointments.filter(apt => apt.teacher_id === teacherId)
						console.log('[teacher-detail] 与当前老师相关的预约数:', relatedAppointments.length)
						
						// 检查是否有试课成功记录：
						// - course_type = 'trial'
						// - status = 'completed'
						// - trial_result 为 'success'，或者历史数据中 trial_result 为空但已完成也视为成功
						const hasTrialSuccess = relatedAppointments.some(apt => {
							const isTrialCourse = apt.course_type === 'trial'
							const isCompletedStatus = apt.status === 'completed'
							const isSuccessResult = !apt.trial_result || apt.trial_result === 'success'
							return isTrialCourse && isCompletedStatus && isSuccessResult
						})
						
						this.hasTrialSuccess = !!hasTrialSuccess
						console.log('[teacher-detail] hasTrialSuccess 计算结果:', {
							teacherId,
							hasTrialSuccess,
							trialAppointments: relatedAppointments
								.filter(apt => apt.course_type === 'trial')
								.map(apt => ({
									id: apt._id,
									status: apt.status,
									trial_result: apt.trial_result
								}))
						})
					} else {
						this.hasTrialSuccess = false
					}
				} catch (trialError) {
					console.warn('检查试课成功记录失败:', trialError)
					// 如果检查失败，默认未完成试课
					this.hasTrialSuccess = false
				}
			} catch (error) {
				console.error('检查联系状态失败:', error)
				this.hasContacted = false
				this.hasTrialSuccess = false
			}
		},
		async toggleFavorite() {
			if (this.favoriteLoading) return
			const teacherId = this.teacherUid || this.teacherId
			if (!teacherId) {
				uni.showToast({ title: '教师信息不完整', icon: 'none' })
				return
			}
			try {
				if (this.useMock) {
					this.isFavorited = !this.isFavorited
					uni.showToast({ title: this.isFavorited ? '收藏成功' : '已取消收藏', icon: 'success' })
					return
				}
				const stored = uni.getStorageSync('userInfo') || {}
				if (!stored.uid) {
					uni.showToast({ title: '请先登录', icon: 'none' })
					return
				}
				const favoriteObj = uniCloud.importObject('teacher-favorite', { customUI: true })
				this.favoriteLoading = true
				if (this.isFavorited) {
					const res = await favoriteObj.removeFavorite({ teacher_id: teacherId })
					if (res.code === 0) {
						this.isFavorited = false
						uni.showToast({ title: '已取消收藏', icon: 'success' })
					} else {
						uni.showToast({ title: res.message || '取消失败', icon: 'none' })
					}
				} else {
					const res = await favoriteObj.addFavorite({ teacher_id: teacherId })
					if (res.code === 0) {
						this.isFavorited = true
						uni.showToast({ title: '收藏成功', icon: 'success' })
					} else {
						uni.showToast({ title: res.message || '收藏失败', icon: 'none' })
					}
				}
			} catch (error) {
				console.error('收藏操作失败:', error)
				uni.showToast({ title: '操作失败，请稍后再试', icon: 'none' })
			} finally {
				this.favoriteLoading = false
			}
		},
		formatPercent(rate) {
			if (!rate && rate !== 0) return '0%'
			return `${(Number(rate) * 100).toFixed(0)}%`
		},
		formatRating(rating) {
			if (!rating && rating !== 0) return '5.0'
			return Number(rating).toFixed(1)
		},
		async fetchUserLocation() {
			try {
				const res = await uni.getLocation({ type: 'gcj02' })
				if (res.latitude != null && res.longitude != null) {
					this.userLocation = { lat: res.latitude, lon: res.longitude }
				}
			} catch (e) {}
		},
		haversineKm(lat1, lon1, lat2, lon2) {
			if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
			const R = 6371
			const dLat = (lat2 - lat1) * Math.PI / 180
			const dLon = (lon2 - lon1) * Math.PI / 180
			const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
			const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
			return R * c
		},
		formatExperience() {
			const years = this.teacherInfo?.teaching_experience?.years || this.teacherInfo?.experience_years
			const num = Number(years)
			return !isNaN(num) && num >= 0 ? `${num}年` : '1年'
		},
		formatTime(ts) {
			const date = new Date(ts || Date.now())
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			return `${month}-${day}`
		},
		/**
		 * 屏蔽地址中的门牌号，只保留到小区
		 * @param {String} address 完整地址
		 * @returns {String} 处理后的地址（只到小区，门牌号已删除）
		 */
		maskAddress(address) {
			if (!address || !address.trim()) return ''
			
			let masked = address.trim()
			
			// 匹配并移除门牌号相关的内容（完全删除，不保留）
			// 匹配模式：数字+（号/栋/单元/室/层/楼等）
			const patterns = [
				/\d+[号栋单元室层楼]\d*[单元室层]?\d*[室]?$/,  // 如：1号楼2单元301室
				/\d+号\d*[单元室层]?\d*[室]?$/,              // 如：123号2单元301室
				/\d+[单元室层楼栋]\d*[室]?$/,                // 如：2单元301室、5栋
				/\d+室$/,                                    // 如：301室
				/\d+层$/,                                   // 如：3层
				/第\d+[层楼]$/,                             // 如：第3层
			]
			
			// 尝试匹配并移除
			for (const pattern of patterns) {
				if (pattern.test(masked)) {
					masked = masked.replace(pattern, '').trim()
					// 如果移除后末尾是逗号、空格等，继续清理
					masked = masked.replace(/[，,、\s]+$/, '')
					break
				}
			}
			
			// 如果地址中包含"小区"、"社区"、"花园"等，保留到这些关键词
			const communityKeywords = ['小区', '社区', '花园', '家园', '苑', '园', '里', '新村', '大厦', '广场']
			for (const keyword of communityKeywords) {
				const index = masked.indexOf(keyword)
				if (index !== -1) {
					// 找到关键词后，保留到关键词结束
					const endIndex = index + keyword.length
					masked = masked.substring(0, endIndex)
					break
				}
			}
			
			return masked || '' // 如果处理后为空，返回空字符串
		},
		/**
		 * 屏蔽备注中的电话号码、联系方式、地址信息
		 * @param {String} notes 备注内容
		 * @returns {String} 处理后的备注（已删除所有联系方式和地址信息）
		 */
		maskContactInfo(notes) {
			if (!notes || !notes.trim()) return ''
			
			let masked = notes.trim()
			
			// 1. 删除手机号/电话号码：11位数字，可能包含分隔符
			masked = masked.replace(/(1[3-9]\d)[\s\-]?(\d{4})[\s\-]?(\d{4})/g, '')
			masked = masked.replace(/(0\d{2,3})[\s\-]?(\d{7,8})/g, '')
			
			// 2. 删除微信号/QQ号及其常见格式
			masked = masked.replace(/(微信[号:]?|wx[_:]?|wechat[_:]?)\s*[a-zA-Z0-9_\-]{3,20}/gi, '')
			masked = masked.replace(/(QQ[号:]?)\s*\d{5,12}/gi, '')
			
			// 3. 删除邮箱地址
			masked = masked.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,})/g, '')
			
			// 4. 删除所有联系方式相关关键词（无论后面是否有内容）
			const contactKeywords = ['联系方式', '联系电话', '联系', '电话号码', '电话', '手机号', '手机', '微信号', '微信', 'QQ', 'wx']
			for (const kw of contactKeywords) {
				const pattern = new RegExp(kw + '[:：]?', 'gi')
				masked = masked.replace(pattern, '')
			}
			
			// 5. 删除备注中可能包含的详细地址信息
			// 匹配：xx省/xx市/xx区/xx路/xx号/xx小区/xx栋/xx单元/xx室 等
			// 先删除包含 省/市/区/县 的长串（通常是地址开头）
			masked = masked.replace(/[^，,。.、；;：:\s]+(省|市|区|县|街道|镇|乡)/g, '')
			
			// 再删除常见的地址后缀词及其内容
			const addressKeywords = ['小区', '社区', '花园', '家园', '苑', '园', '里', '新村', '大厦', '广场', '路', '道', '街', '巷', '弄', '号', '栋', '幢', '单元', '室', '房', '层', '楼']
			for (const keyword of addressKeywords) {
				// 匹配关键词前面的一部分文字直到标点符号
				const pattern = new RegExp('[^，,。.、；;：:\\s]*' + keyword, 'gi')
				masked = masked.replace(pattern, '')
			}
			
			// 6. 专门清理孤立的门牌号（通常是2-5位纯数字）
			// 匹配被标点符号、空格包围或处于首尾的 2-5 位数字
			masked = masked.replace(/(^|[\s，,。.、；;：:])\d{2,5}(?=$|[\s，,。.、；;：:])/g, '$1')
			
			// 7. 清理多余的空格、标点符号
			// 多个连续标点或空格合并
			masked = masked.replace(/[，,。.、；;：:]\s*[，,。.、；;：:]+/g, '，')
			masked = masked.replace(/\s{2,}/g, ' ')
			// 移除开头和结尾的孤立标点和空格
			masked = masked.replace(/^[，,。.、；;：:\s]+|[，,。.、；;：:\s]+$/g, '')
			
			return masked.trim()
		}
	}
}
</script>

<style scoped>
.teacher-detail-page {
	background: linear-gradient(180deg, #f7f9fc 0%, #f3f6fb 100%);
	min-height: 100vh;
}

.scroll {
	flex: 1;
	height: calc(100vh - 500rpx);
	padding-bottom: 200rpx;
}

.page-content {
	padding-bottom: 190rpx;
}

.detail-hero {
	padding: 32rpx 24rpx 12rpx;
	background: linear-gradient(135deg, #4f7bff 0%, #3b8cff 55%, #61a7ff 100%);
}

.hero-overlay {
	position: absolute;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	background: radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 40%);
}

.hero-card {
	padding: 28rpx;
	border-radius: 32rpx;
	background: rgba(255, 255, 255, 0.12);
	backdrop-filter: blur(16rpx);
	box-shadow: 0 20rpx 40rpx rgba(27, 72, 168, 0.18);
}

.avatar-shell {
	width: 170rpx;
	height: 170rpx;
	padding: 8rpx;
	background: rgba(255,255,255,0.14);
	box-shadow: 0 12rpx 28rpx rgba(15, 23, 42, 0.12);
}

.hero-subtitle {
	opacity: 0.9;
	line-height: 1.5;
}

.hero-metrics {
	display: flex;
	margin-top: 8rpx;
}

.hero-metric-item {
	flex: 1;
}

.hero-metric-label {
	opacity: 0.76;
}

.favorite-btn {
	width: 76rpx;
	height: 76rpx;
	border-radius: 999rpx;
	background: rgba(255,255,255,0.16);
	backdrop-filter: blur(12rpx);
	box-shadow: 0 8rpx 20rpx rgba(15, 23, 42, 0.12);
}

.detail-card {
	border-radius: 28rpx;
	overflow: hidden;
	box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.05);
}

.detail-tag {
	background: linear-gradient(135deg, #eef4ff 0%, #f5f8ff 100%);
	color: #3f7cff;
	border: 1rpx solid #dce8ff;
}

.detail-outline-tag {
	background: #fff;
	color: #51627a;
	border: 1rpx solid #dfe6f2;
}

.highlight-grid {
	display: flex;
	flex-wrap: wrap;
	margin: 0 -9rpx;
}

.secondary-grid {
	padding-top: 18rpx;
	border-top: 1rpx solid #edf2f7;
}

.highlight-item {
	width: calc(25% - 18rpx);
	margin: 0 9rpx 18rpx;
	padding: 24rpx 12rpx;
	border-radius: 24rpx;
	background: linear-gradient(180deg, #fafcff 0%, #f5f8fc 100%);
	border: 1rpx solid #edf2f7;
}

.secondary-grid .highlight-item {
	width: calc(33.3333% - 18rpx);
}

.intro-box {
	padding: 22rpx 24rpx;
	border-radius: 24rpx;
	background: linear-gradient(180deg, #fafcff 0%, #f7f9fd 100%);
}

.intro-text {
	line-height: 1.8;
}

.info-list {
	border-radius: 24rpx;
	background: linear-gradient(180deg, #fbfcff 0%, #f7f9fd 100%);
	border: 1rpx solid #edf2f7;
	overflow: hidden;
}

.info-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	padding: 24rpx;
	border-bottom: 1rpx solid #edf2f7;
}

.info-row.no-border {
	border-bottom: none;
}

.info-label {
	font-size: 28rpx;
	color: #8a97ab;
	min-width: 132rpx;
}

.info-value {
	flex: 1;
	font-size: 28rpx;
	color: #334155;
	line-height: 1.7;
}

.schedule-item {
	background: linear-gradient(180deg, #f8fbff 0%, #f2f7ff 100%);
	border: 1rpx solid #dfe8ff;
}

.review-card {
	background: linear-gradient(180deg, #fafcff 0%, #f6f8fb 100%);
	border: 1rpx solid #edf2f7;
}

.action-bar {
	background: rgba(255,255,255,0.94);
	backdrop-filter: blur(18rpx);
	border-top: 1rpx solid rgba(226, 232, 240, 0.92);
	box-shadow: 0 -10rpx 30rpx rgba(15, 23, 42, 0.06);
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.secondary-action-btn {
	background: #fff;
}

.primary-action-btn {
	box-shadow: 0 14rpx 24rpx rgba(79, 123, 255, 0.18);
}

/* 统计标签样式 */
.stat-tag {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
}
</style>