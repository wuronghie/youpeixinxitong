<template>
	<view class="page">
		<view class="id-card">
			<image class="avatar" :src="profile.avatar || defaultAvatar" mode="aspectFill"></image>
			<view class="id-main">
				<text class="id-name">{{ profile.display_name || '教师' }}</text>
				<text v-if="stats.totalReviews > 0" class="id-rating">综合评分 {{ stats.averageRating || '0.0' }}</text>
				<text class="id-meta">¥{{ formatCurrency(profile.hourly_rate || 0) }}/小时 · {{ stats.totalStudents || 0 }} 位学生</text>
				<view v-if="(profile.subjects || []).length" class="tags">
					<text v-for="subject in profile.subjects" :key="subject" class="chip">{{ subject }}</text>
				</view>
			</view>
		</view>

		<view class="section-card">
			<view class="section-head">
				<text class="section-title">教师介绍</text>
				<text class="section-more" @click="goToEdit">编辑 ›</text>
			</view>
			<text v-if="profile.introduction" class="intro">{{ profile.introduction }}</text>
			<text v-else class="intro muted">还没有填写个人介绍，完善资料后家长会更容易了解你。</text>
		</view>

		<view class="form-card">
			<view class="form-row">
				<text class="form-label">主教科目</text>
				<text class="form-value">{{ renderArray(profile.subjects) }}</text>
			</view>
			<view class="form-row">
				<text class="form-label">适合年级</text>
				<text class="form-value muted">{{ renderArray(profile.grades) }}</text>
			</view>
			<view class="form-row">
				<text class="form-label">教龄</text>
				<text class="form-value muted">{{ profile.teaching_experience?.years || 0 }} 年</text>
			</view>
			<view class="form-row">
				<text class="form-label">学历 / 学校</text>
				<text class="form-value muted">{{ educationText }}</text>
			</view>
			<view v-if="profile.education?.major" class="form-row">
				<text class="form-label">专业</text>
				<text class="form-value muted">{{ profile.education.major }}</text>
			</view>
			<view class="form-row">
				<text class="form-label">累计评价</text>
				<text class="form-value muted">{{ stats.totalReviews || 0 }} 条</text>
			</view>
		</view>

		<view class="section-card">
			<text class="section-title">教学地区 / 证书</text>
			<text v-if="(profile.teaching_areas || []).length" class="intro">
				{{ (profile.teaching_areas || []).map(renderArea).join(' · ') }}
			</text>
			<text v-else class="intro muted">暂未设置教学地区</text>

			<view v-if="(profile.qualifications || []).length" class="cert-list">
				<view v-for="(cert, idx) in profile.qualifications" :key="idx" class="cert-item">
					<view class="cert-copy">
						<text class="cert-name">{{ cert.name || '证书' }}</text>
						<text v-if="cert.number" class="cert-no">编号 {{ cert.number }}</text>
					</view>
					<image
						v-if="cert.image"
						class="cert-thumb"
						:src="cert.image"
						mode="aspectFill"
						@click="previewImage(cert.image)"
					></image>
				</view>
			</view>
			<text v-else class="intro muted">尚未上传证书，可在完善资料中添加。</text>
		</view>

		<view class="actions">
			<button class="btn btn-primary" @click="goToEdit">完善资料</button>
			<!-- 时间设置功能暂未就绪，入口先隐藏
			<button class="btn btn-primary" @click="goToSchedule">设置授课时间</button>
			-->
		</view>
	</view>
</template>

<script>
import { mockTeachers, useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	name: 'TeacherProfileIndex',
	mixins: [pullRefreshMixin],
	data() {
		return {
			profile: {
				display_name: '',
				avatar: '',
				title: '',
				introduction: '',
				subjects: [],
				grades: [],
				teaching_experience: { years: 0, description: '' },
				education: {},
				qualifications: [],
				teaching_areas: []
			},
			stats: {
				averageRating: 5.0,
				totalReviews: 0,
				totalStudents: 0,
				recentCompleted: 0,
				totalIncome: 0
			},
			useMock: false,
			loading: false,
			defaultAvatar
		}
	},
	computed: {
		educationText() {
			const edu = this.profile.education || {}
			const parts = [edu.degree, edu.school].filter(Boolean)
			if (edu.graduation_year) parts.push(String(edu.graduation_year))
			return parts.length ? parts.join(' · ') : '未设置'
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.loadProfile()
	},
	onShareAppMessage() {
		return {
			title: '优培信息通 · 教师主页',
			path: '/pages-teacher/profile/index'
		}
	},
	onShareTimeline() {
		return {
			title: '优培信息通 · 教师主页'
		}
	},
	methods: {
		async refreshData() {
			console.log('[profile] 下拉刷新：重新加载资料')
			await this.loadProfile()
		},
		async loadProfile() {
			if (this.loading) return
			this.loading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const mock = mockTeachers[0]
					this.profile = {
						display_name: mock.display_name,
						avatar: mock.avatar,
						title: mock.title,
						introduction: mock.introduction,
						subjects: mock.subjects,
						grades: mock.grades,
						teaching_experience: { years: mock.experience_years || 0, description: '' },
						education: mock.education || {},
						qualifications: mock.qualifications || [],
						teaching_areas: mock.teaching_areas || []
					}
					this.stats = {
						averageRating: mock.rating || 5.0,
						totalReviews: 32,
						totalStudents: 18,
						recentCompleted: 5,
						totalIncome: 13500
					}
					return
				}

				const userInfo = uni.getStorageSync('userInfo') || {}
				if (!userInfo.uid || userInfo.role !== 'teacher') {
					uni.showToast({ title: '请先以教师身份登录', icon: 'none' })
					return
				}

				const dashboard = uniCloud.importObject('teacher-dashboard', { customUI: true })
				const res = await dashboard.getProfileDetail()

				if (res.code === 0) {
					const profileData = res.data.profile || {}
					if (profileData.qualifications && Array.isArray(profileData.qualifications)) {
						const fileIds = profileData.qualifications
							.filter(q => q.image && !q.image.startsWith('http'))
							.map(q => q.image)
						
						if (fileIds.length > 0) {
							try {
								const tempRes = await uniCloud.getTempFileURL({ fileList: fileIds })
								const urlMap = {}
								if (tempRes.fileList) {
									tempRes.fileList.forEach((file, index) => {
										if (file.tempFileURL) {
											urlMap[fileIds[index]] = file.tempFileURL
										}
									})
								}
								profileData.qualifications.forEach(q => {
									if (q.image && !q.image.startsWith('http') && urlMap[q.image]) {
										q.image = urlMap[q.image]
									}
								})
							} catch (e) {
								console.error('获取证书图片URL失败:', e)
							}
						}
					}
					this.profile = Object.assign({}, this.profile, profileData)
					this.stats = Object.assign({}, this.stats, res.data.metrics || {})
				} else {
					uni.showToast({ title: res.message || '加载失败', icon: 'none' })
				}
			} catch (error) {
				console.error('教师主页加载失败:', error)
				uni.showToast({ title: '加载失败，请稍后再试', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		formatCurrency(value) {
			const num = Number(value || 0)
			return num.toFixed(2)
		},
		renderArray(arr) {
			if (!arr || !arr.length) return '未设置'
			return arr.join('、')
		},
		renderArea(area = {}) {
			const parts = [area.province, area.city, area.district, area.address]
			return parts.filter(Boolean).join(' ')
		},
		goToEdit() {
			uni.navigateTo({ url: '/pages-teacher/profile/edit' })
		},
		// 时间设置功能暂未就绪
		// goToSchedule() {
		// 	uni.navigateTo({ url: '/pages-teacher/profile/schedule' })
		// },
		previewImage(url) {
			if (!url) return
			uni.previewImage({
				urls: [url],
				current: url
			})
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
	padding: 24rpx 32rpx 48rpx;
}

.id-card,
.section-card,
.form-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
	margin-bottom: 24rpx;
}

.id-card {
	display: flex;
	gap: 24rpx;
	padding: 32rpx;
}

.avatar {
	width: 128rpx;
	height: 128rpx;
	border-radius: 50%;
	background: #93B4FF;
	flex-shrink: 0;
}

.id-main {
	flex: 1;
	min-width: 0;
}

.id-name {
	display: block;
	font-size: 36rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.3;
}

.id-rating {
	display: block;
	margin-top: 8rpx;
	font-size: 26rpx;
	color: #5C6370;
}

.id-meta {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.tags {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 12rpx;
}

.chip {
	height: 44rpx;
	padding: 0 16rpx;
	border-radius: 12rpx;
	background: #EEF3FF;
	color: #2563EB;
	font-size: 22rpx;
	line-height: 44rpx;
}

.section-card {
	padding: 28rpx 32rpx;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12rpx;
}

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.section-more {
	font-size: 24rpx;
	color: #2563EB;
}

.intro {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.7;
}

.intro.muted {
	color: #8B919C;
}

.form-card {
	padding: 8rpx 32rpx;
}

.form-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
	padding: 24rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.form-row:last-child {
	border-bottom: none;
}

.form-label {
	flex-shrink: 0;
	font-size: 28rpx;
	color: #8B919C;
}

.form-value {
	flex: 1;
	text-align: right;
	font-size: 28rpx;
	color: #1F2329;
	line-height: 1.45;
}

.form-value.muted {
	color: #8B919C;
	font-weight: 400;
}

.cert-list {
	margin-top: 16rpx;
}

.cert-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	padding: 16rpx 0;
	border-top: 1rpx solid #F3F4F6;
}

.cert-copy {
	flex: 1;
	min-width: 0;
}

.cert-name {
	display: block;
	font-size: 28rpx;
	color: #1F2329;
}

.cert-no {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #8B919C;
}

.cert-thumb {
	width: 96rpx;
	height: 96rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	flex-shrink: 0;
}

.actions {
	display: flex;
	gap: 16rpx;
	padding: 8rpx 0 24rpx;
}

.btn {
	flex: 1;
	height: 88rpx;
	border-radius: 20rpx;
	font-size: 30rpx;
	font-weight: 600;
	line-height: 88rpx;
	border: none;
}

.btn::after {
	border: none;
}

.btn-ghost {
	background: #EEF3FF;
	color: #2563EB;
}

.btn-primary {
	background: #2563EB;
	color: #FFFFFF;
}
</style>