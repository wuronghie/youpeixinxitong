<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3 text-white">
			<view class="d-flex a-center mb-3">
				<image class="rounded-circle mr-3" :src="profile.avatar || defaultAvatar" mode="aspectFill" style="width: 120rpx; height: 120rpx; border: 4rpx solid rgba(255,255,255,0.3);"></image>
				<view class="flex-1">
					<view class="d-flex a-center mb-1">
						<text class="font-lg font-weight mr-2">{{ profile.display_name || '教师' }}</text>
						<text v-if="stats.totalReviews > 0" class="stat-tag rounded px-2 py-1 font-xs text-white d-flex a-center">
							<view class="icon-star mr-1" style="width: 24rpx; height: 24rpx;"></view>
							{{ stats.averageRating || '0.0' }}
						</text>
					</view>
					<text class="font-sm d-block mb-2" style="opacity: 0.85;">{{ profile.title || '专业家教教师' }}</text>
					<view v-if="(profile.subjects || []).length" class="d-flex flex-wrap">
						<text v-for="subject in profile.subjects" :key="subject" class="stat-tag rounded px-2 py-1 font-xs mr-1 mb-1 text-white">{{ subject }}</text>
					</view>
				</view>
			</view>
			<view class="stat-card rounded px-3 py-2">
				<view class="flex-1 text-center">
					<text class="font-md font-weight text-white d-block mb-1">¥{{ formatCurrency(profile.hourly_rate || 0) }}</text>
					<text class="font-xs text-white" style="opacity: 0.9;">课时费</text>
				</view>
				<view style="width: 2rpx; height: 60rpx; background: rgba(255,255,255,0.2);"></view>
				<view class="flex-1 text-center">
					<text class="font-md font-weight text-white d-block mb-1">{{ stats.totalStudents || 0 }}</text>
					<text class="font-xs text-white" style="opacity: 0.9;">服务学生</text>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 教师介绍 -->
				<card headTitle="教师介绍" class="mb-3">
					<view class="d-flex a-center j-sb mb-2">
						<text class="font-sm text-light-muted">个人介绍</text>
						<text class="font-sm main-text-color" @click="goToEdit">编辑</text>
					</view>
					<text v-if="profile.introduction" class="font-sm text-light-muted" style="line-height: 1.8;">{{ profile.introduction }}</text>
					<view v-else class="bg-light-secondary rounded px-3 py-2">
						<text class="font-sm text-light-muted">还没有填写个人介绍，点击右上角按钮完善资料，让家长更了解你。</text>
					</view>
				</card>

				<!-- 教学信息 -->
				<card headTitle="教学信息" class="mb-3">
					<view class="d-flex flex-wrap">
						<view class="w-50 px-2 mb-2">
							<view class="bg-light-secondary rounded px-3 py-2">
								<text class="font-xs text-light-muted d-block mb-1">主教科目</text>
								<text class="font-sm">{{ renderArray(profile.subjects) }}</text>
							</view>
						</view>
						<view class="w-50 px-2 mb-2">
							<view class="bg-light-secondary rounded px-3 py-2">
								<text class="font-xs text-light-muted d-block mb-1">适合年级</text>
								<text class="font-sm">{{ renderArray(profile.grades) }}</text>
							</view>
						</view>
						<view class="w-50 px-2 mb-2">
							<view class="bg-light-secondary rounded px-3 py-2">
								<text class="font-xs text-light-muted d-block mb-1">教龄</text>
								<text class="font-sm">{{ profile.teaching_experience?.years || 0 }} 年</text>
							</view>
						</view>
						<view class="w-50 px-2 mb-2">
							<view class="bg-light-secondary rounded px-3 py-2">
								<text class="font-xs text-light-muted d-block mb-1">累计评价</text>
								<text class="font-sm">{{ stats.totalReviews }} 条</text>
							</view>
						</view>
					</view>
				</card>

				<!-- 教育背景 -->
				<card v-if="profile.education?.degree || profile.education?.school" headTitle="教育背景" class="mb-3">
					<view class="bg-warning rounded px-3 py-2">
						<text class="font-md font-weight text-dark d-block mb-1">{{ profile.education?.degree || '学历未填写' }}</text>
						<text v-if="profile.education?.school" class="font-sm text-dark d-block mb-1">{{ profile.education.school }}</text>
						<view class="d-flex flex-wrap">
							<text v-if="profile.education?.major" class="font-xs text-dark mr-2">专业：{{ profile.education.major }}</text>
							<text v-if="profile.education?.graduation_year" class="font-xs text-dark">毕业年份：{{ profile.education.graduation_year }}</text>
						</view>
					</view>
				</card>

				<!-- 教学地区 -->
				<card headTitle="教学地区" class="mb-3">
					<view v-if="(profile.teaching_areas || []).length" class="d-flex flex-wrap">
						<view v-for="(area, idx) in profile.teaching_areas" :key="idx" class="bg-light-secondary rounded px-3 py-2 mr-2 mb-2">
							<text class="font-sm">{{ renderArea(area) }}</text>
						</view>
					</view>
					<view v-else class="text-center text-light-muted font-sm py-3">暂未设置教学地区</view>
				</card>

				<!-- 资质证书 -->
				<card headTitle="资质证书" class="mb-3">
					<view class="d-flex a-center j-sb mb-2">
						<text class="font-sm text-light-muted">证书列表</text>
						<text class="font-sm main-text-color" @click="goToEdit">去上传 ></text>
					</view>
					<view v-if="(profile.qualifications || []).length" class="d-flex flex-column">
						<view v-for="(cert, idx) in profile.qualifications" :key="idx" class="bg-light-secondary rounded px-3 py-2 mb-2">
							<view class="d-flex flex-column mb-2">
								<text class="font-sm font-weight mb-1">{{ cert.name || '证书' }}</text>
								<text v-if="cert.number" class="font-xs text-light-muted">编号：{{ cert.number }}</text>
							</view>
							<image
								v-if="cert.image"
								class="rounded"
								:src="cert.image"
								mode="aspectFit"
								@click="previewImage(cert.image)"
								style="width: 100%; min-height: 300rpx; max-height: 600rpx;"
							></image>
						</view>
					</view>
					<view v-else class="text-center text-light-muted font-sm py-3">尚未上传任何证书</view>
				</card>

				<!-- 操作按钮 -->
				<view class="d-flex a-center mt-3 mb-3">
					<button class="flex-1 main-bg-color text-white rounded px-3 py-2 font-sm mr-2" @click="goToEdit">完善资料</button>
					<button class="flex-1 border border-light-muted text-light-muted rounded px-3 py-2 font-sm" @click="goToSchedule">设置授课时间</button>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { mockTeachers, useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	name: 'TeacherProfileIndex',
	components: {
		card
	},
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
	onLoad() {
		this.useMock = useMockData() === true
		this.loadProfile()
	},
	onShareAppMessage() {
		return {
			title: '家教帮 · 教师主页',
			path: '/pages-teacher/profile/index'
		}
	},
	onShareTimeline() {
		return {
			title: '家教帮 · 教师主页'
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
		goToSchedule() {
			uni.navigateTo({ url: '/pages-teacher/profile/schedule' })
		},
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
.scroll {
	flex: 1;
	height: calc(100vh - 400rpx);
}

/* 统计卡片样式 */
.stat-card {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
	display: flex;
	align-items: center;
}

/* 统计标签样式 */
.stat-tag {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
}

/* CSS图标样式 */
.icon-star {
	width: 24rpx;
	height: 24rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-star::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 0;
	height: 0;
	border-left: 6rpx solid transparent;
	border-right: 6rpx solid transparent;
	border-bottom: 4rpx solid currentColor;
}
.icon-star::after {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%) rotate(180deg);
	width: 0;
	height: 0;
	border-left: 6rpx solid transparent;
	border-right: 6rpx solid transparent;
	border-bottom: 4rpx solid currentColor;
}
</style>