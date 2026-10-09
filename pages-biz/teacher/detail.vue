<!--
 * 页面名称：教师详情页（家长端）
 * 路由路径：pages-biz/teacher/detail
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
		<view class="detail-hero">
			<view class="hero-card">
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
							{{ [formatSchoolLabel(teacherInfo.school), teacherInfo.experience].filter(Boolean).join(' · ') }}
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
						<text class="hero-metric-value">{{ formatRating(teacherInfo.rating, teacherInfo.review_count) }}</text>
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
			<view class="page-content">
				<view v-if="subjectList.length || gradeList.length" class="section-card">
					<text class="section-h">教学范围</text>
					<view v-if="subjectList.length" class="chip-row">
						<text v-for="subject in subjectList" :key="subject" class="chip">{{ subject }}</text>
					</view>
					<text v-if="gradeList.length" class="section-p">可辅导：{{ gradeList.join('、') }}</text>
				</view>

				<view class="section-card">
					<text class="section-h">教学介绍</text>
					<text class="section-p">{{ teacherInfo.introduction || '老师正在完善介绍，欢迎预约体验课程。' }}</text>
					<view class="stat-row">
						<view class="stat-cell">
							<text class="stat-num">{{ teacherInfo.trial_count || 0 }}</text>
							<text class="stat-label">试课次数</text>
						</view>
						<view class="stat-cell">
							<text class="stat-num">{{ teacherInfo.trial_success_count != null ? teacherInfo.trial_success_count : 0 }}</text>
							<text class="stat-label">试课成功</text>
						</view>
						<view class="stat-cell">
							<text class="stat-num">{{ formatPercent(teacherInfo.trial_success_rate) }}</text>
							<text class="stat-label">成功率</text>
						</view>
						<view class="stat-cell">
							<text class="stat-num">{{ teacherInfo.total_students || 0 }}</text>
							<text class="stat-label">累计学生</text>
						</view>
					</view>
				</view>

				<view class="section-card">
					<view class="section-head">
						<text class="section-h">家长评价</text>
						<text v-if="recentReviews.length" class="section-link" @click="goToReviews">查看全部</text>
					</view>
					<view v-if="!recentReviews.length" class="section-p">暂无家长评价</view>
					<view
						v-for="review in recentReviews"
						:key="review._id || review.review_id"
						class="review-item"
					>
						<view class="review-top">
							<view class="review-user">
								<text class="review-name">{{ review.parent_name || '家长' }}</text>
								<view class="review-stars">
									<text
										v-for="i in 5"
										:key="i"
										class="review-star"
										:class="{ on: i <= (review.rating || 0) }"
									>★</text>
								</view>
							</view>
							<text class="review-time">{{ formatTime(review.create_time) }}</text>
						</view>
						<view v-if="review.tags && review.tags.length" class="chip-row review-tags">
							<text v-for="tag in review.tags" :key="tag" class="chip">{{ tag }}</text>
						</view>
						<text v-if="review.content" class="section-p">{{ review.content }}</text>
						<view v-if="review.teacher_reply" class="review-reply">
							<text class="review-reply__label">老师回复</text>
							<text class="review-reply__text">{{ review.teacher_reply }}</text>
						</view>
					</view>
				</view>

				<view v-if="scheduleSummary.length" class="section-card">
					<text class="section-h">可预约时间</text>
					<text class="section-p">{{ scheduleText }}</text>
				</view>

				<view v-if="(teacherInfo.qualifications || []).length" class="section-card">
					<text class="section-h">资质证书</text>
					<text class="section-p">{{ qualificationText }}</text>
					<view
						v-for="(item, index) in teacherInfo.qualifications"
						:key="index"
						class="cert-block"
					>
						<view
							v-if="qualificationDisplayUrl(item)"
							class="cert-img-wrap"
							@click.stop="previewQualificationCertificates(index)"
						>
							<image
								class="cert-img"
								:src="qualificationDisplayUrl(item)"
								mode="aspectFill"
							/>
							<text class="cert-hint">全屏查看</text>
						</view>
					</view>
				</view>

				<view v-if="teacherAddressText || teacherDistanceText" class="section-card">
					<text class="section-h">教学地址</text>
					<view v-if="teacherAddressText" class="form-row">
						<text class="form-label">教学地址</text>
						<text class="form-value">{{ teacherAddressText }}</text>
					</view>
					<view v-if="teacherDistanceText" class="form-row">
						<text class="form-label">与我距离</text>
						<text class="form-value">约 {{ teacherDistanceText }} km</text>
					</view>
				</view>

				<view v-if="teacherGenderText(teacherInfo.gender) || teacherInfo.school || teacherInfo.experience" class="section-card">
					<text class="section-h">基本信息</text>
					<view v-if="teacherGenderText(teacherInfo.gender)" class="form-row">
						<text class="form-label">性别</text>
						<text class="form-value">{{ teacherGenderText(teacherInfo.gender) }}</text>
					</view>
					<view v-if="teacherInfo.school" class="form-row">
						<text class="form-label">是否在读</text>
						<text class="form-value">{{ formatSchoolLabel(teacherInfo.school) }}</text>
					</view>
					<view v-if="teacherInfo.experience" class="form-row">
						<text class="form-label">教师资历</text>
						<text class="form-value">{{ teacherInfo.experience }}</text>
					</view>
				</view>

				<view v-if="(teacherInfo.tags || []).length" class="section-card">
					<text class="section-h">教学特色</text>
					<view class="chip-row">
						<text v-for="tag in teacherInfo.tags" :key="tag" class="chip">{{ tag }}</text>
					</view>
				</view>

				<view
					v-if="teacherInfo.education && (teacherInfo.education.degree || teacherInfo.education.major || teacherInfo.education.graduation_year)"
					class="section-card"
				>
					<text class="section-h">教育背景</text>
					<view v-if="teacherInfo.education.degree" class="form-row">
						<text class="form-label">学历</text>
						<text class="form-value">{{ teacherInfo.education.degree }}</text>
					</view>
					<view v-if="teacherInfo.education.major" class="form-row">
						<text class="form-label">专业</text>
						<text class="form-value">{{ teacherInfo.education.major }}</text>
					</view>
					<view v-if="teacherInfo.education.graduation_year" class="form-row">
						<text class="form-label">毕业年份</text>
						<text class="form-value">{{ teacherInfo.education.graduation_year }}</text>
					</view>
				</view>

				<view v-if="isLoading" class="text-center text-light-muted font py-5">教师资料加载中...</view>
				<view v-else-if="loadError" class="d-flex flex-column a-center j-center py-5">
					<text class="iconfont icon-jinggao" style="font-size: 100rpx;color: #ddd;"></text>
					<text class="text-light-muted font-md mt-3">{{ loadError }}</text>
					<button class="reload-btn" @click="loadDetail">重新加载</button>
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
import { getDefaultAvatarUrl, getIconUrl } from '@/utils/imageConfig.js'
import { saveAppointmentTeacherPreview } from '../utils/appointmentTeacherPreview.js'

export default {
	name: 'TeacherDetail',
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
		scheduleText() {
			return this.scheduleSummary.map(slot => `${slot.day} ${slot.time}`).join(' · ')
		},
		qualificationText() {
			const list = this.teacherInfo.qualifications || []
			const names = list.map(item => {
				const name = item.name || '证书'
				return item.number ? `${name}（编号 ${item.number}）` : name
			}).filter(Boolean)
			return names.length ? `${names.join(' · ')}（可预览）` : '可预览'
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
		const path = id ? `/pages-biz/teacher/detail?id=${id}` : '/pages/index/index'
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
		async refreshData() {
			this.isRefreshing = true
			try {
				await this.loadDetail()
			} finally {
				this.isRefreshing = false
			}
		},
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
								url: `/pages-biz/chat/conversation?${params.join('&')}`
							})
						} else if (appointmentId) {
							uni.navigateTo({
								url: `/pages-biz/chat/conversation?appointmentId=${appointmentId}`
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
			saveAppointmentTeacherPreview({
				teacherProfileId: this.teacherId,
				teacherUid: this.teacherUid,
				teacher_id: this.teacherUid || this.teacherInfo.teacher_id,
				display_name: this.teacherInfo.display_name || this.teacherInfo.name,
				name: this.teacherInfo.name || this.teacherInfo.display_name,
				avatar: this.teacherInfo.avatar,
				hourly_rate: this.teacherInfo.hourly_rate,
				rating: this.teacherInfo.rating,
				total_students: this.teacherInfo.total_students,
				trial_count: this.teacherInfo.trial_count,
				trial_success_rate: this.teacherInfo.trial_success_rate
			})
			const params = []
			if (this.teacherId) params.push(`teacherProfileId=${this.teacherId}`)
			if (this.teacherUid) params.push(`teacherUid=${this.teacherUid}`)
			uni.navigateTo({ url: `/pages-biz/appointment/create${params.length ? '?' + params.join('&') : ''}` })
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
		formatRating(rating, reviewCount) {
			const count = Number(reviewCount) || 0
			if (count <= 0) return '暂无'
			if (rating === null || rating === undefined || rating === '') return '暂无'
			return Number(rating).toFixed(1)
		},
		teacherGenderText(gender) {
			if (gender === 'male' || gender === 1 || gender === '1') return '男'
			if (gender === 'female' || gender === 2 || gender === '2') return '女'
			return ''
		},
		formatSchoolLabel(school) {
			if (!school) return ''
			return school === '专职老师' ? '专职老师（已毕业）' : school
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
	background: #F4F6F9;
	min-height: 100vh;
}

.scroll {
	flex: 1;
	height: calc(100vh - 430rpx);
	padding-bottom: 200rpx;
}

.page-content {
	padding: 8rpx 0 210rpx;
}

.detail-hero {
	padding: 20rpx 32rpx 12rpx;
	background: linear-gradient(180deg, #2563EB 0%, #3B7BFF 68%, #F4F6F9 100%);
	overflow: hidden;
}

.hero-card {
	padding: 28rpx 28rpx 24rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	border: 1rpx solid #EBEDF0;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.06);
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
	width: 136rpx;
	height: 136rpx;
	padding: 4rpx;
	background: #EEF3FF;
}

.hero-avatar {
	width: 128rpx;
	height: 128rpx;
	border: 2rpx solid #EEF3FF;
}

.hero-name-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	padding-right: 70rpx;
}

.hero-name {
	color: #1F2329;
	font-size: 34rpx;
	font-weight: 600;
	line-height: 1.35;
}

.hero-subtitle {
	display: block;
	margin-top: 8rpx;
	color: #8B919C;
	font-size: 24rpx;
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
	padding: 6rpx 16rpx;
	border-radius: 12rpx;
	background: #EEF3FF;
	color: #2563EB;
	font-size: 24rpx;
	line-height: 1.4;
}

.hero-subject-more {
	margin-left: 10rpx;
	padding: 6rpx 12rpx;
	border-radius: 12rpx;
	background: #F4F6F9;
	color: #5C6370;
	font-size: 22rpx;
	line-height: 1.4;
}

.hero-metrics {
	display: flex;
	align-items: stretch;
	margin-top: 24rpx;
	padding: 20rpx 8rpx;
	border-radius: 16rpx;
	background: #F8FAFC;
	border: 1rpx solid #EBEDF0;
}

.hero-metric-item {
	flex: 1;
	text-align: center;
}

.hero-metric-value {
	display: block;
	color: #1F2329;
	font-size: 30rpx;
	font-weight: 600;
	line-height: 1.25;
}

.hero-metric-label {
	display: block;
	margin-top: 6rpx;
	color: #8B919C;
	font-size: 22rpx;
	line-height: 1.25;
}

.hero-metric-divider {
	width: 1rpx;
	margin: 6rpx 0;
	background: #EBEDF0;
}

.favorite-btn {
	flex-shrink: 0;
	width: 64rpx;
	height: 64rpx;
	border-radius: 999rpx;
	background: #F4F6F9;
	border: 1rpx solid #EBEDF0;
}

.favorite-icon {
	width: 46rpx;
	height: 46rpx;
}

.detail-gender-chip {
	margin-left: 12rpx;
	padding: 4rpx 12rpx;
	border-radius: 12rpx;
	font-size: 20rpx;
	line-height: 1.4;
	font-weight: 600;
}

.detail-gender-chip.male {
	color: #2563EB;
	background: #EEF3FF;
}

.detail-gender-chip.female {
	color: #DB2777;
	background: #FDF2F8;
}

.hero-verify {
	margin-left: 12rpx;
	padding: 4rpx 12rpx;
	border-radius: 12rpx;
	color: #07C160;
	background: #E8F8EF;
	font-size: 20rpx;
	font-weight: 600;
	line-height: 1.35;
}

.section-card {
	margin: 24rpx 32rpx;
	padding: 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20rpx;
}

.section-h {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.4;
	margin-bottom: 20rpx;
}

.section-head .section-h {
	margin-bottom: 0;
}

.section-link {
	font-size: 24rpx;
	color: #2563EB;
	line-height: 1.4;
}

.section-p {
	display: block;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.6;
}

.chip-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-bottom: 20rpx;
}

.chip-row:last-child {
	margin-bottom: 0;
}

.chip {
	display: inline-flex;
	align-items: center;
	height: 44rpx;
	padding: 0 16rpx;
	border-radius: 12rpx;
	background: #EEF3FF;
	color: #2563EB;
	font-size: 22rpx;
	line-height: 44rpx;
}

.stat-row {
	display: flex;
	margin-top: 24rpx;
	padding-top: 24rpx;
	border-top: 1rpx solid #EBEDF0;
}

.stat-cell {
	flex: 1;
	text-align: center;
}

.stat-num {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.25;
}

.stat-label {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #8B919C;
	line-height: 1.3;
}

.review-item + .review-item {
	margin-top: 24rpx;
	padding-top: 24rpx;
	border-top: 1rpx solid #EBEDF0;
}

.review-top {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
}

.review-name {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.4;
}

.review-stars {
	margin-top: 6rpx;
}

.review-star {
	font-size: 24rpx;
	line-height: 1;
	color: #EBEDF0;
	margin-right: 2rpx;
}

.review-star.on {
	color: #F59E0B;
}

.review-time {
	flex-shrink: 0;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.4;
}

.review-tags {
	margin: 16rpx 0 12rpx;
}

.review-reply {
	margin-top: 16rpx;
	padding: 20rpx 24rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
}

.review-reply__label {
	display: block;
	font-size: 22rpx;
	color: #8B919C;
	margin-bottom: 6rpx;
}

.review-reply__text {
	display: block;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.5;
}

.form-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 24rpx;
	min-height: 72rpx;
	padding: 16rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.form-row:last-child {
	border-bottom: none;
	padding-bottom: 0;
}

.form-label {
	flex-shrink: 0;
	font-size: 28rpx;
	color: #5C6370;
	line-height: 1.5;
}

.form-value {
	flex: 1;
	font-size: 28rpx;
	color: #1F2329;
	text-align: right;
	line-height: 1.5;
}

.cert-block + .cert-block {
	margin-top: 16rpx;
}

.cert-img-wrap {
	position: relative;
	margin-top: 20rpx;
	height: 280rpx;
	border-radius: 16rpx;
	overflow: hidden;
	background: #F4F6F9;
}

.cert-img {
	width: 100%;
	height: 100%;
	display: block;
}

.cert-hint {
	position: absolute;
	right: 16rpx;
	bottom: 16rpx;
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	background: rgba(0, 0, 0, 0.45);
	color: #FFFFFF;
	font-size: 22rpx;
}

.action-bar {
	display: flex;
	align-items: center;
	left: 0;
	right: 0;
	bottom: 0;
	background: #FFFFFF;
	border-top: 1rpx solid #EBEDF0;
	padding: 20rpx 32rpx;
	padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
	z-index: 100;
}

.action-price {
	flex: 1;
	min-width: 0;
}

.action-price__label {
	display: block;
	font-size: 22rpx;
	color: #8B919C;
	line-height: 1.3;
}

.action-price__row {
	display: flex;
	align-items: baseline;
	margin-top: 4rpx;
}

.action-price__amount {
	color: #2563EB;
	font-size: 36rpx;
	font-weight: 600;
	line-height: 1.2;
}

.action-price__unit {
	margin-left: 4rpx;
	color: #8B919C;
	font-size: 24rpx;
}

.action-buttons {
	display: flex;
	align-items: center;
	gap: 14rpx;
}

.action-button {
	min-width: 164rpx;
	height: 80rpx;
	padding: 0 28rpx;
	border-radius: 20rpx;
	font-size: 28rpx;
	font-weight: 600;
	line-height: 80rpx;
}

.action-button::after {
	border: none;
}

.secondary-action-btn {
	color: #2563EB;
	background: #EEF3FF;
	border: 1rpx solid #D7E3FF;
	box-shadow: none;
}

.primary-action-btn {
	color: #FFFFFF;
	background: #2563EB;
	border: none;
}

.trial-tip {
	min-width: 164rpx;
	height: 80rpx;
	padding: 0 18rpx;
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #F4F6F9;
	color: #8B919C;
	font-size: 24rpx;
}

.reload-btn {
	margin-top: 24rpx;
	padding: 16rpx 40rpx;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 26rpx;
	line-height: 1.4;
	border: none;
}

.reload-btn::after {
	border: none;
}

/* 统计标签样式 */
.stat-tag {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
}
</style>