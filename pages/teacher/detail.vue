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
			<view class="hero-orb hero-orb--left"></view>
			<view class="hero-orb hero-orb--right"></view>
			<view class="hero-card position-relative">
				<view class="hero-top">
					<view class="avatar-shell rounded-circle d-flex a-center j-center">
						<image
							class="hero-avatar rounded-circle"
							:src="teacherInfo.avatar || defaultAvatarUrl"
							mode="aspectFill"
						/>
					</view>
					<view class="hero-main">
						<view class="hero-name-row">
							<text class="hero-name">{{ teacherInfo.display_name || teacherInfo.name || '教师' }}</text>
							<text v-if="teacherGenderText(teacherInfo.gender)" class="detail-gender-chip" :class="teacherGenderClass(teacherInfo.gender)">{{ teacherGenderText(teacherInfo.gender) }}</text>
							<text v-if="teacherInfo.is_verified" class="hero-verify">已认证</text>
						</view>
						<text v-if="teacherInfo.school || teacherInfo.experience" class="hero-subtitle">
							{{ [teacherInfo.school, teacherInfo.experience].filter(Boolean).join(' · ') }}
						</text>
						<view class="hero-subject-line" v-if="subjectList.length">
							<text class="hero-subject-text">{{ subjectList.slice(0, 3).join(' / ') }}</text>
							<text v-if="subjectList.length > 3" class="hero-subject-more">+{{ subjectList.length - 3 }}</text>
						</view>
					</view>
					<view class="favorite-btn d-flex a-center j-center" @click.stop="toggleFavorite">
						<image
							:src="isFavorited ? favoriteFilledUrl : favoriteEmptyUrl"
							mode="aspectFit"
							class="favorite-icon"
						/>
					</view>
				</view>

				<view class="hero-metrics">
					<view class="hero-metric-item">
						<text class="hero-metric-value">{{ formatRating(teacherInfo.rating) }}</text>
						<text class="hero-metric-label">综合评分</text>
					</view>
					<view class="hero-metric-divider"></view>
					<view class="hero-metric-item">
						<text class="hero-metric-value">¥{{ teacherInfo.hourly_rate || 100 }}</text>
						<text class="hero-metric-label">每小时</text>
					</view>
					<view class="hero-metric-divider"></view>
					<view class="hero-metric-item">
						<text class="hero-metric-value">{{ formatExperience() }}</text>
						<text class="hero-metric-label">教学经验</text>
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
				<view class="detail-zone detail-zone--primary">
					<view class="zone-header">
						<view>
							<text class="zone-title">核心能力</text>
							<text class="zone-subtitle">先看老师能教什么、教学表现怎么样</text>
						</view>
						<text class="zone-badge">能力概览</text>
					</view>
				<!-- 教学范围 -->
				<card v-if="subjectList.length || gradeGroups.length" class="detail-card detail-card--blue teaching-scope-card">
					<view slot="title" class="section-title">
						<view class="section-title__mark section-title__mark--blue"></view>
						<view>
							<text class="section-title__text">教学范围</text>
							<text class="section-title__sub">科目与年级清晰分组</text>
						</view>
					</view>
					<view class="scope-panel">
						<view v-if="subjectList.length" class="scope-section">
							<view class="scope-section__head">
								<view>
									<text class="scope-section__title">教授科目</text>
									<text class="scope-section__desc">老师主要擅长的课程方向</text>
								</view>
								<text class="scope-count">{{ subjectList.length }} 项</text>
							</view>
							<view class="scope-tags">
								<text
									v-for="subject in subjectList"
									:key="subject"
									class="scope-tag scope-tag--subject"
								>
									{{ subject }}
								</text>
							</view>
						</view>

						<view v-if="gradeGroups.length" class="scope-section" :class="{ 'scope-section--with-divider': subjectList.length }">
							<view class="scope-section__head">
								<view>
									<text class="scope-section__title">适合年级</text>
									<text class="scope-section__desc">可辅导的学生阶段</text>
								</view>
								<text class="scope-count scope-count--muted">{{ gradeTotalCount }} 项</text>
							</view>
							<view class="grade-groups">
								<view
									v-for="group in gradeGroups"
									:key="group.key"
									class="grade-group"
								>
									<view class="grade-group__head">
										<text class="grade-group__title">{{ group.label }}</text>
										<text class="grade-group__count">{{ group.items.length }} 个年级</text>
									</view>
									<view class="scope-tags">
										<text
											v-for="grade in group.items"
											:key="grade"
											class="scope-tag scope-tag--grade"
										>
											{{ grade }}
										</text>
									</view>
								</view>
							</view>
						</view>
					</view>
				</card>

				<!-- 教学亮点 -->
				<card class="mt-3 detail-card detail-card--gold">
					<view slot="title" class="section-title">
						<view class="section-title__mark section-title__mark--gold"></view>
						<view>
							<text class="section-title__text">教学亮点</text>
							<text class="section-title__sub">试课表现与教学数据</text>
						</view>
					</view>
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
				</view>

				<view
					v-if="teacherAddressText || teacherDistanceText || teacherGenderText(teacherInfo.gender) || teacherInfo.school || teacherInfo.experience || (teacherInfo.tags || []).length || (teacherInfo.education && (teacherInfo.education.degree || teacherInfo.education.major || teacherInfo.education.graduation_year)) || (teacherInfo.qualifications || []).length"
					class="detail-zone detail-zone--profile"
				>
					<view class="zone-header">
						<view>
							<text class="zone-title">教师资料</text>
							<text class="zone-subtitle">地址、背景、特色与资质分区展示</text>
						</view>
						<text class="zone-badge zone-badge--muted">资料信息</text>
					</view>
				<!-- 教学地址与距离 -->
				<card v-if="teacherAddressText || teacherDistanceText" class="mt-3 detail-card detail-card--green">
					<view slot="title" class="section-title">
						<view class="section-title__mark section-title__mark--green"></view>
						<view>
							<text class="section-title__text">教学地址</text>
							<text class="section-title__sub">线下授课位置参考</text>
						</view>
					</view>
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
				<card v-if="teacherGenderText(teacherInfo.gender) || teacherInfo.school || teacherInfo.experience" class="mt-3 detail-card detail-card--slate">
					<view slot="title" class="section-title">
						<view class="section-title__mark section-title__mark--slate"></view>
						<view>
							<text class="section-title__text">基本信息</text>
							<text class="section-title__sub">老师背景与资历</text>
						</view>
					</view>
					<view class="info-list">
						<view v-if="teacherGenderText(teacherInfo.gender)" class="info-row" :class="{ 'no-border': !teacherInfo.school && !teacherInfo.experience }">
							<text class="info-label">性别</text>
							<text class="info-value">{{ teacherGenderText(teacherInfo.gender) }}</text>
						</view>
						<view v-if="teacherInfo.school" class="info-row" :class="{ 'no-border': !teacherInfo.experience }">
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
				<card v-if="(teacherInfo.tags || []).length" class="mt-3 detail-card detail-card--purple">
					<view slot="title" class="section-title">
						<view class="section-title__mark section-title__mark--purple"></view>
						<view>
							<text class="section-title__text">教学特色</text>
							<text class="section-title__sub">课堂风格与服务标签</text>
						</view>
					</view>
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
				<card v-if="teacherInfo.education && (teacherInfo.education.degree || teacherInfo.education.major || teacherInfo.education.graduation_year)" class="mt-3 detail-card detail-card--cyan">
					<view slot="title" class="section-title">
						<view class="section-title__mark section-title__mark--cyan"></view>
						<view>
							<text class="section-title__text">教育背景</text>
							<text class="section-title__sub">学历、专业与毕业信息</text>
						</view>
					</view>
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
				<card v-if="(teacherInfo.qualifications || []).length" class="mt-3 detail-card detail-card--pink">
					<view slot="title" class="section-title">
						<view class="section-title__mark section-title__mark--pink"></view>
						<view>
							<text class="section-title__text">资质证书</text>
							<text class="section-title__sub">已提交的教学资质 · 点击图片全屏查看</text>
						</view>
					</view>
					<view class="qualification-list">
						<view
							v-for="(item, index) in teacherInfo.qualifications"
							:key="index"
							class="qualification-block"
						>
							<view class="qualification-block__head">
								<text class="qualification-block__name">{{ item.name || '证书' }}</text>
								<text v-if="item.number" class="qualification-block__number">编号 {{ item.number }}</text>
							</view>
							<view
								v-if="qualificationDisplayUrl(item)"
								class="qualification-block__img-wrap"
								@click.stop="previewQualificationCertificates(index)"
							>
								<image
									class="qualification-block__img"
									:src="qualificationDisplayUrl(item)"
									mode="aspectFill"
								/>
								<view class="qualification-block__img-mask">
									<text class="qualification-block__img-hint">全屏查看</text>
								</view>
							</view>
							<text v-else class="qualification-block__empty font-xs text-light-muted">暂无证书图片</text>
						</view>
					</view>
				</card>
				</view>

				<view v-if="scheduleSummary.length || recentReviews.length" class="detail-zone detail-zone--interaction">
					<view class="zone-header">
						<view>
							<text class="zone-title">预约与口碑</text>
							<text class="zone-subtitle">查看可约时间和其他家长反馈</text>
						</view>
						<text class="zone-badge zone-badge--warm">互动信息</text>
					</view>
				<!-- 可预约时间 -->
				<card v-if="scheduleSummary.length" class="mt-3 detail-card detail-card--blue">
					<view slot="title" class="section-title">
						<view class="section-title__mark section-title__mark--blue"></view>
						<view>
							<text class="section-title__text">可预约时间</text>
							<text class="section-title__sub">近期可沟通的授课时段</text>
						</view>
					</view>
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
				<card v-if="recentReviews.length" class="mt-3 detail-card detail-card--gold">
					<view slot="title" class="section-title section-title--between">
						<view class="section-title__left">
							<view class="section-title__mark section-title__mark--gold"></view>
							<view>
								<text class="section-title__text">家长评价</text>
								<text class="section-title__sub">真实课后反馈</text>
							</view>
						</view>
						<text class="section-title__link" @click="goToReviews">查看全部</text>
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
				</view>

				<view v-if="isLoading" class="text-center text-light-muted font py-5">教师资料加载中...</view>
				<view v-else-if="loadError" class="d-flex flex-column a-center j-center py-5">
					<text class="iconfont icon-jinggao" style="font-size: 100rpx;color: #ddd;"></text>
					<text class="text-light-muted font-md mt-3">{{ loadError }}</text>
					<button class="main-bg-color text-white rounded px-4 py-2 mt-3 font-sm" @click="loadDetail">重新加载</button>
				</view>
			</view>
		</scroll-view>

		<!-- 底部操作栏 -->
		<view class="action-bar position-fixed bottom-0 left-0 right-0">
			<view class="action-price">
				<text class="action-price__label">课时费</text>
				<view class="action-price__row">
					<text class="action-price__amount">¥{{ teacherInfo.hourly_rate || 100 }}</text>
					<text class="action-price__unit">/小时</text>
				</view>
			</view>
			<view class="action-buttons">
				<button
					class="secondary-action-btn action-button"
					:disabled="isLoading || loadError || isContacting"
					@click="handleContactTeacher"
				>
					{{ isContacting ? '联系中...' : '联系老师' }}
				</button>
				<button
					v-if="canMakeAppointment"
					class="primary-action-btn action-button"
					:disabled="isLoading || loadError"
					@click="goToAppointment"
				>
					立即预约
				</button>
				<view v-else-if="hasContacted && !hasTrialSuccess" class="trial-tip">
					<text>请先完成试课</text>
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
		subjectList() {
			const list = this.teacherInfo.subjects || []
			if (!Array.isArray(list)) return []
			return list.filter(Boolean)
		},
		gradeList() {
			const list = this.teacherInfo.grades || []
			if (!Array.isArray(list)) return []
			return list.filter(Boolean)
		},
		gradeTotalCount() {
			return this.gradeList.length
		},
		gradeGroups() {
			const primary = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级']
			const junior = ['初一', '初二', '初三']
			const senior = ['高一', '高二', '高三']
			const gradeSet = new Set(this.gradeList)
			const makeGroup = (key, label, order) => ({
				key,
				label,
				items: order.filter(item => gradeSet.has(item))
			})
			const groups = [
				makeGroup('primary', '小学', primary),
				makeGroup('junior', '初中', junior),
				makeGroup('senior', '高中', senior)
			].filter(group => group.items.length > 0)
			const known = new Set([...primary, ...junior, ...senior])
			const other = this.gradeList.filter(item => !known.has(item))
			if (other.length > 0) {
				groups.push({
					key: 'other',
					label: '其他',
					items: other
				})
			}
			return groups
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
		// 优先让首屏渲染完成，再异步加载详情和定位，避免 onLoad 阶段被 cloud / 定位授权阻塞
		// 触发微信小程序 navigateTo:fail timeout（5 秒未完成 onLoad 就会报）
		setTimeout(() => {
			this.loadDetail()
			this.fetchUserLocation()
		}, 0)
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
		qualificationDisplayUrl(item) {
			if (!item) return ''
			const u = item.image_url || item.image
			if (!u || typeof u !== 'string') return ''
			const s = u.trim()
			return s.startsWith('http') ? s : ''
		},
		previewQualificationCertificates(index) {
			const list = this.teacherInfo.qualifications || []
			const urls = list.map((q) => this.qualificationDisplayUrl(q)).filter(Boolean)
			if (!urls.length) {
				uni.showToast({ title: '暂无可预览图片', icon: 'none' })
				return
			}
			const cur = this.qualificationDisplayUrl(list[index])
			uni.previewImage({
				urls,
				current: cur || urls[0]
			})
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
		teacherGenderText(gender) {
			if (gender === 'male' || gender === 1 || gender === '1') return '男'
			if (gender === 'female' || gender === 2 || gender === '2') return '女'
			return ''
		},
		teacherGenderClass(gender) {
			if (gender === 'male' || gender === 1 || gender === '1') return 'male'
			if (gender === 'female' || gender === 2 || gender === '2') return 'female'
			return ''
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
	background: #f4f7fb;
	min-height: 100vh;
}

.scroll {
	flex: 1;
	height: calc(100vh - 430rpx);
	padding-bottom: 200rpx;
}

.page-content {
	padding-bottom: 210rpx;
}

.detail-hero {
	padding: 34rpx 26rpx 38rpx;
	background: linear-gradient(145deg, #2563eb 0%, #3b82f6 52%, #60a5fa 100%);
	overflow: hidden;
}

.hero-orb {
	position: absolute;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.18);
	filter: blur(2rpx);
}

.hero-orb--left {
	width: 260rpx;
	height: 260rpx;
	left: -90rpx;
	top: 38rpx;
}

.hero-orb--right {
	width: 360rpx;
	height: 360rpx;
	right: -160rpx;
	top: -110rpx;
}

.hero-card {
	padding: 30rpx;
	border-radius: 36rpx;
	background: rgba(255, 255, 255, 0.16);
	border: 1rpx solid rgba(255, 255, 255, 0.28);
	box-shadow: 0 24rpx 52rpx rgba(30, 64, 175, 0.22);
}

.hero-top {
	display: flex;
	align-items: flex-start;
}

.hero-main {
	flex: 1;
	min-width: 0;
	margin-left: 24rpx;
}

.avatar-shell {
	width: 166rpx;
	height: 166rpx;
	padding: 8rpx;
	background: rgba(255, 255, 255, 0.18);
	box-shadow: 0 16rpx 30rpx rgba(30, 64, 175, 0.2);
}

.hero-avatar {
	width: 150rpx;
	height: 150rpx;
	border: 4rpx solid rgba(255, 255, 255, 0.42);
}

.hero-name-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	padding-right: 70rpx;
}

.hero-name {
	color: #fff;
	font-size: 38rpx;
	font-weight: 800;
	line-height: 1.35;
	letter-spacing: 1rpx;
}

.hero-subtitle {
	display: block;
	margin-top: 8rpx;
	color: rgba(255, 255, 255, 0.86);
	font-size: 25rpx;
	line-height: 1.5;
}

.hero-subject-line {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	margin-top: 18rpx;
}

.hero-subject-text {
	max-width: 420rpx;
	padding: 8rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.18);
	color: #fff;
	font-size: 24rpx;
	line-height: 1.4;
}

.hero-subject-more {
	margin-left: 10rpx;
	padding: 8rpx 12rpx;
	border-radius: 999rpx;
	background: rgba(15, 23, 42, 0.16);
	color: #fff;
	font-size: 22rpx;
	line-height: 1.4;
}

.hero-metrics {
	display: flex;
	align-items: stretch;
	margin-top: 30rpx;
	padding: 22rpx 10rpx;
	border-radius: 28rpx;
	background: rgba(255, 255, 255, 0.14);
	border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.hero-metric-item {
	flex: 1;
	text-align: center;
}

.hero-metric-value {
	display: block;
	color: #fff;
	font-size: 31rpx;
	font-weight: 800;
	line-height: 1.25;
}

.hero-metric-label {
	display: block;
	margin-top: 8rpx;
	color: rgba(255, 255, 255, 0.72);
	font-size: 23rpx;
	line-height: 1.25;
}

.hero-metric-divider {
	width: 1rpx;
	margin: 6rpx 0;
	background: rgba(255, 255, 255, 0.24);
}

.favorite-btn {
	flex-shrink: 0;
	width: 72rpx;
	height: 72rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.2);
	border: 1rpx solid rgba(255, 255, 255, 0.26);
	box-shadow: 0 10rpx 24rpx rgba(30, 64, 175, 0.16);
}

.favorite-icon {
	width: 46rpx;
	height: 46rpx;
}

.detail-gender-chip {
	margin-left: 12rpx;
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
	font-size: 20rpx;
	line-height: 1.4;
	font-weight: 600;
}

.detail-gender-chip.male {
	color: #1677ff;
	background: rgba(230, 244, 255, 0.92);
}

.detail-gender-chip.female {
	color: #eb2f96;
	background: rgba(255, 240, 246, 0.92);
}

.hero-verify {
	margin-left: 12rpx;
	padding: 7rpx 16rpx;
	border-radius: 999rpx;
	color: #0f766e;
	background: rgba(240, 253, 250, 0.94);
	font-size: 21rpx;
	font-weight: 700;
	line-height: 1.35;
}

.detail-card {
	position: relative;
	border-radius: 30rpx;
	overflow: hidden;
	background: #fff;
	box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.06);
	border: 1rpx solid rgba(226, 232, 240, 0.9);
}

.detail-zone {
	position: relative;
	margin-bottom: 30rpx;
	padding: 26rpx 22rpx 24rpx;
	border-radius: 34rpx;
	border: 1rpx solid rgba(226, 232, 240, 0.95);
	box-shadow: 0 18rpx 42rpx rgba(15, 23, 42, 0.055);
	overflow: hidden;
}

.detail-zone::before {
	content: "";
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 10rpx;
	z-index: 1;
}

.detail-zone--primary {
	background: linear-gradient(180deg, #eff6ff 0%, #ffffff 30%, #f8fbff 100%);
}

.detail-zone--primary::before {
	background: linear-gradient(90deg, #2563eb, #60a5fa);
}

.detail-zone--profile {
	background: linear-gradient(180deg, #f8fafc 0%, #ffffff 34%, #fbfdff 100%);
}

.detail-zone--profile::before {
	background: linear-gradient(90deg, #64748b, #22c55e);
}

.detail-zone--interaction {
	background: linear-gradient(180deg, #fff7ed 0%, #ffffff 34%, #fffaf3 100%);
}

.detail-zone--interaction::before {
	background: linear-gradient(90deg, #f59e0b, #f97316);
}

.zone-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	margin-bottom: 22rpx;
	padding: 4rpx 4rpx 0;
}

.zone-title {
	display: block;
	color: #0f172a;
	font-size: 34rpx;
	font-weight: 900;
	line-height: 1.25;
	letter-spacing: 1rpx;
}

.zone-subtitle {
	display: block;
	margin-top: 8rpx;
	color: #64748b;
	font-size: 24rpx;
	line-height: 1.45;
}

.zone-badge {
	flex-shrink: 0;
	margin-left: 20rpx;
	padding: 9rpx 18rpx;
	border-radius: 999rpx;
	color: #1d4ed8;
	background: #dbeafe;
	font-size: 23rpx;
	font-weight: 700;
	line-height: 1.3;
}

.zone-badge--muted {
	color: #475569;
	background: #e2e8f0;
}

.zone-badge--warm {
	color: #c2410c;
	background: #ffedd5;
}

.detail-zone .detail-card {
	margin-top: 20rpx;
}

.detail-zone .detail-card:first-of-type {
	margin-top: 0;
}

.detail-card::before {
	content: "";
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 8rpx;
	background: #dbeafe;
	z-index: 1;
}

.detail-card--blue::before {
	background: linear-gradient(90deg, #2563eb, #60a5fa);
}

.detail-card--gold::before {
	background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.detail-card--green::before {
	background: linear-gradient(90deg, #10b981, #34d399);
}

.detail-card--slate::before {
	background: linear-gradient(90deg, #64748b, #94a3b8);
}

.detail-card--purple::before {
	background: linear-gradient(90deg, #7c3aed, #a78bfa);
}

.detail-card--cyan::before {
	background: linear-gradient(90deg, #0891b2, #22d3ee);
}

.detail-card--pink::before {
	background: linear-gradient(90deg, #db2777, #f472b6);
}

.section-title {
	display: flex;
	align-items: center;
	width: 100%;
	padding-top: 4rpx;
}

.section-title--between {
	justify-content: space-between;
}

.section-title__left {
	display: flex;
	align-items: center;
}

.section-title__mark {
	width: 12rpx;
	height: 42rpx;
	border-radius: 999rpx;
	margin-right: 16rpx;
	background: #2563eb;
}

.section-title__mark--blue {
	background: linear-gradient(180deg, #2563eb, #60a5fa);
}

.section-title__mark--gold {
	background: linear-gradient(180deg, #f59e0b, #fbbf24);
}

.section-title__mark--green {
	background: linear-gradient(180deg, #10b981, #34d399);
}

.section-title__mark--slate {
	background: linear-gradient(180deg, #64748b, #94a3b8);
}

.section-title__mark--purple {
	background: linear-gradient(180deg, #7c3aed, #a78bfa);
}

.section-title__mark--cyan {
	background: linear-gradient(180deg, #0891b2, #22d3ee);
}

.section-title__mark--pink {
	background: linear-gradient(180deg, #db2777, #f472b6);
}

.section-title__text {
	display: block;
	font-size: 31rpx;
	font-weight: 800;
	color: #0f172a;
	line-height: 1.25;
}

.section-title__sub {
	display: block;
	margin-top: 4rpx;
	font-size: 23rpx;
	color: #94a3b8;
	line-height: 1.3;
}

.section-title__link {
	flex-shrink: 0;
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	background: #eff6ff;
	color: #2563eb;
	font-size: 24rpx;
	line-height: 1.3;
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

.teaching-scope-card {
	overflow: visible;
}

.scope-panel {
	border-radius: 26rpx;
	background: linear-gradient(180deg, #f8fbff 0%, #f3f7ff 100%);
	border: 1rpx solid #e7eefb;
	padding: 24rpx;
}

.scope-section {
	padding: 0;
}

.scope-section--with-divider {
	margin-top: 24rpx;
	padding-top: 24rpx;
	border-top: 1rpx dashed #dce6f5;
}

.scope-section__head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	margin-bottom: 18rpx;
}

.scope-section__title {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	color: #162033;
	line-height: 1.35;
}

.scope-section__desc {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #8a97ab;
	line-height: 1.45;
}

.scope-count {
	flex-shrink: 0;
	margin-left: 20rpx;
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	color: #2f6bff;
	background: #edf4ff;
	border: 1rpx solid #dbe8ff;
	line-height: 1.4;
}

.scope-count--muted {
	color: #64748b;
	background: #f1f5f9;
	border-color: #e2e8f0;
}

.scope-tags {
	display: flex;
	flex-wrap: wrap;
	margin: -8rpx;
}

.scope-tag {
	margin: 8rpx;
	padding: 15rpx 24rpx;
	border-radius: 999rpx;
	font-size: 26rpx;
	line-height: 1.35;
	font-weight: 500;
}

.scope-tag--subject {
	color: #1d4ed8;
	background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
	border: 1rpx solid #bfdbfe;
	box-shadow: 0 6rpx 14rpx rgba(37, 99, 235, 0.06);
}

.scope-tag--grade {
	color: #334155;
	background: #fff;
	border: 1rpx solid #e2e8f0;
}

.grade-groups {
	display: flex;
	flex-direction: column;
	gap: 18rpx;
}

.grade-group {
	padding: 18rpx;
	border-radius: 22rpx;
	background: rgba(255, 255, 255, 0.9);
	border: 1rpx solid #e8eef7;
	box-shadow: 0 8rpx 18rpx rgba(30, 64, 175, 0.035);
}

.grade-group__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12rpx;
}

.grade-group__title {
	font-size: 27rpx;
	font-weight: 700;
	color: #1f2937;
}

.grade-group__count {
	font-size: 22rpx;
	color: #94a3b8;
}

.highlight-grid {
	display: flex;
	flex-wrap: wrap;
	margin: 0 -8rpx;
}

.secondary-grid {
	padding-top: 18rpx;
	border-top: 1rpx solid #edf2f7;
}

.highlight-item {
	width: calc(25% - 16rpx);
	margin: 0 8rpx 16rpx;
	padding: 24rpx 10rpx;
	border-radius: 26rpx;
	background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
	border: 1rpx solid #e6eefc;
	box-shadow: 0 8rpx 18rpx rgba(30, 64, 175, 0.04);
}

.secondary-grid .highlight-item {
	width: calc(33.3333% - 16rpx);
}

.intro-box {
	padding: 26rpx;
	border-radius: 26rpx;
	background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
	border: 1rpx solid #edf2f7;
}

.intro-text {
	line-height: 1.8;
	color: #475569;
}

.qualification-list {
	display: flex;
	flex-direction: column;
	gap: 24rpx;
}

.qualification-block {
	padding: 22rpx;
	border-radius: 20rpx;
	background: linear-gradient(180deg, #fff 0%, #fdf2f8 100%);
	border: 1rpx solid #fce7f3;
}

.qualification-block__head {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	margin-bottom: 16rpx;
}

.qualification-block__name {
	font-size: 30rpx;
	font-weight: 600;
	color: #831843;
}

.qualification-block__number {
	font-size: 24rpx;
	color: #9d174d;
	opacity: 0.85;
}

.qualification-block__img-wrap {
	position: relative;
	width: 100%;
	height: 280rpx;
	border-radius: 16rpx;
	overflow: hidden;
	background: #fce7f3;
}

.qualification-block__img {
	width: 100%;
	height: 100%;
	display: block;
}

.qualification-block__img-mask {
	position: absolute;
	right: 16rpx;
	bottom: 16rpx;
	padding: 10rpx 20rpx;
	border-radius: 999rpx;
	background: rgba(0, 0, 0, 0.45);
}

.qualification-block__img-hint {
	font-size: 22rpx;
	color: #fff;
}

.qualification-block__empty {
	display: block;
	padding: 16rpx 0;
}

.info-list {
	border-radius: 24rpx;
	background: #f8fafc;
	border: 1rpx solid #edf2f7;
	overflow: hidden;
}

.info-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	padding: 26rpx 24rpx;
	border-bottom: 1rpx solid #edf2f7;
	background: #fff;
}

.info-row:nth-child(2n) {
	background: #fbfdff;
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
	background: linear-gradient(180deg, #f8fbff 0%, #eff6ff 100%);
	border: 1rpx solid #dbeafe;
	box-shadow: 0 8rpx 16rpx rgba(37, 99, 235, 0.04);
	position: relative;
	padding-left: 28rpx !important;
}

.schedule-item::before {
	content: "";
	position: absolute;
	left: 12rpx;
	top: 50%;
	width: 8rpx;
	height: 34rpx;
	border-radius: 999rpx;
	background: #3b82f6;
	transform: translateY(-50%);
}

.review-card {
	background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
	border: 1rpx solid #edf2f7;
	box-shadow: 0 8rpx 16rpx rgba(15, 23, 42, 0.035);
	position: relative;
	padding-left: 28rpx !important;
}

.review-card::before {
	content: "";
	position: absolute;
	left: 12rpx;
	top: 24rpx;
	bottom: 24rpx;
	width: 6rpx;
	border-radius: 999rpx;
	background: #f59e0b;
}

.action-bar {
	display: flex;
	align-items: center;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(255,255,255,0.94);
	backdrop-filter: blur(18rpx);
	border-top: 1rpx solid rgba(226, 232, 240, 0.92);
	box-shadow: 0 -10rpx 30rpx rgba(15, 23, 42, 0.06);
	padding: 22rpx 28rpx;
	padding-bottom: calc(22rpx + env(safe-area-inset-bottom));
	z-index: 100;
}

.action-price {
	flex: 1;
	min-width: 0;
}

.action-price__label {
	display: block;
	font-size: 23rpx;
	color: #94a3b8;
	line-height: 1.3;
}

.action-price__row {
	display: flex;
	align-items: baseline;
	margin-top: 4rpx;
}

.action-price__amount {
	color: #2563eb;
	font-size: 38rpx;
	font-weight: 800;
	line-height: 1.2;
}

.action-price__unit {
	margin-left: 4rpx;
	color: #64748b;
	font-size: 24rpx;
}

.action-buttons {
	display: flex;
	align-items: center;
	gap: 14rpx;
}

.action-button {
	min-width: 164rpx;
	height: 78rpx;
	padding: 0 26rpx;
	border-radius: 999rpx;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 78rpx;
}

.action-button::after {
	border: none;
}

.secondary-action-btn {
	color: #2563eb;
	background: #eef5ff;
	border: 1rpx solid #bfdbfe;
	box-shadow: none;
}

.primary-action-btn {
	color: #fff;
	background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
	border: none;
	box-shadow: 0 14rpx 24rpx rgba(37, 99, 235, 0.22);
}

.trial-tip {
	min-width: 164rpx;
	height: 72rpx;
	padding: 0 18rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f1f5f9;
	color: #94a3b8;
	font-size: 24rpx;
}

/* 统计标签样式 */
.stat-tag {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
}
</style>