<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3 text-white">
			<view class="d-flex a-center mb-3">
				<image class="rounded-circle border-light mr-3" :src="userInfo.avatar || defaultAvatarUrl" mode="aspectFill" style="width: 120rpx;height: 120rpx;border: 4rpx solid rgba(255,255,255,0.3);"></image>
				<view class="flex-1">
					<text class="font-lg font-weight d-block mb-2">{{ userInfo.displayName }}</text>
					<view class="d-flex a-center flex-wrap">
						<text class="stat-tag rounded px-2 py-1 font-xs mr-2 mb-1 text-white">教师</text>
						<text v-if="teacherStatusText" class="stat-tag rounded px-2 py-1 font-xs mb-1 text-white">{{ teacherStatusText }}</text>
					</view>
					<view class="d-flex a-center mt-2">
						<view v-if="userInfo.phone" class="d-flex a-center font-xs mr-3" style="opacity: 0.85;">
							<view class="icon-phone mr-1" style="width: 28rpx; height: 28rpx;"></view>
							{{ userInfo.phone }}
						</view>
						<text
							v-if="userInfo.uid"
							class="font-xs user-id-copy"
							style="opacity: 0.85;"
							@click.stop="copyUserId"
						>ID: {{ userInfo.uid }}</text>
					</view>
				</view>
			</view>
			<view class="stat-card rounded px-3 py-2">
				<view class="flex-1 text-center">
					<text class="font-md font-weight text-white d-block mb-1">{{ metrics.totalStudents || 0 }}</text>
					<text class="font-xs text-white" style="opacity: 0.9;">学员数</text>
				</view>
				<view style="width: 2rpx; height: 60rpx; background: rgba(255,255,255,0.2);"></view>
				<view class="flex-1 text-center">
					<text class="font-md font-weight text-white d-block mb-1">{{ metrics.totalTrials || 0 }}</text>
					<text class="font-xs text-white" style="opacity: 0.9;">总试课数</text>
				</view>
				<view style="width: 2rpx; height: 60rpx; background: rgba(255,255,255,0.2);"></view>
				<view class="flex-1 text-center">
					<text class="font-md font-weight text-white d-block mb-1">{{ metrics.successfulTrials || 0 }}</text>
					<text class="font-xs text-white" style="opacity: 0.9;">试课成功</text>
				</view>
				<view style="width: 2rpx; height: 60rpx; background: rgba(255,255,255,0.2);"></view>
				<view class="flex-1 text-center">
					<text class="font-md font-weight text-white d-block mb-1">{{ metrics.totalIncome || 0 }}</text>
					<text class="font-xs text-white" style="opacity: 0.9;">累计收入</text>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 快捷功能 -->
				<card headTitle="快捷功能" class="mb-3">
					<view class="d-flex j-sb flex-wrap">
						<view
							v-for="action in actionList"
							:key="action.url"
							class="quick-action-item d-flex flex-column a-center mb-3"
							@click="goToPage(action.url)"
						>
							<image
								:src="action.icon"
								class="quick-action-icon mb-2"
								mode="aspectFit"
							/>
							<text class="font-xs text-center">{{ action.title }}</text>
						</view>
					</view>
				</card>

				<!-- 账号信息 -->
				<card headTitle="账号信息" class="mb-3">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">姓名</text>
						<text class="font-sm text-right">{{ userInfo.displayName || '-' }}</text>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">手机号</text>
						<text class="font-sm text-right">{{ userInfo.phone || '未绑定' }}</text>
					</view>
					<view class="d-flex a-center j-sb py-2">
						<text class="font-sm">认证状态</text>
						<text class="font-sm text-right" :class="metrics.verificationStatus === 'verified' ? 'text-success' : ''">{{ statusTextMap[metrics.verificationStatus] || '待完善' }}</text>
					</view>
				</card>

				<!-- 教师资料 -->
				<card headTitle="教师资料" class="mb-3" v-if="(teacherProfile.subjects && teacherProfile.subjects.length > 0) || (teacherProfile.grades && teacherProfile.grades.length > 0) || teacherProfile.hourly_rate">
					<view v-if="teacherProfile.subjects && teacherProfile.subjects.length > 0" class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">主教科目</text>
						<text class="font-sm text-right">{{ (teacherProfile.subjects || []).join('、') }}</text>
					</view>
					<view v-if="teacherProfile.grades && teacherProfile.grades.length > 0" class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">适合年级</text>
						<text class="font-sm text-right">{{ (teacherProfile.grades || []).join('、') }}</text>
					</view>
					<view v-if="teacherProfile.hourly_rate" class="d-flex a-center j-sb py-2">
						<text class="font-sm">时薪</text>
						<text class="font-sm text-right main-text-color font-weight">¥{{ teacherProfile.hourly_rate }}/小时</text>
					</view>
				</card>

				<!-- 常用设置 -->
				<card headTitle="常用设置" class="mb-3">
					<view
						v-for="item in listMenus"
						:key="item.url"
						class="d-flex a-center j-sb py-3 border-bottom"
						@click="goToPage(item.url)"
					>
						<view class="d-flex a-center">
							<image
								:src="item.icon"
								class="menu-icon mr-3"
								mode="aspectFit"
							/>
							<view class="d-flex flex-column">
								<text class="font-sm font-weight mb-1">{{ item.title }}</text>
								<text class="font-xs text-light-muted">{{ item.desc }}</text>
							</view>
						</view>
						<text class="font-md text-light-muted">›</text>
					</view>
				</card>

				<!-- 退出登录和注销账号 -->
				<view class="mt-3 mb-3">
					<button class="w-100 border border-danger text-danger rounded px-3 py-2 font-sm mb-2" @click="handleLogout">退出登录</button>
					<button class="w-100 border border-warning text-warning rounded px-3 py-2 font-sm" @click="handleDeleteAccount">注销账号</button>
				</view>
			</view>
			<!-- 备案信息 -->
			<view class="icp-footer">
				<text class="icp-text">蜀ICP备2026004236号-1X</text>
			</view>
		</scroll-view>
		<view class="tabbar-spacer"></view>
		<TeacherTabBar current="user" />
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { mockUserInfo, useMockData } from '@/utils/mockData.js'
import { ensureLoggedIn, clearStoredAuth, setStoredUserInfo } from '@/utils/auth.js'
import TeacherTabBar from '@/components/TeacherTabBar.vue'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { getDefaultAvatarUrl, getIconUrl } from '@/utils/imageConfig.js'

export default {
	name: 'TeacherUserCenter',
	components: {
		card,
		TeacherTabBar
	},
	mixins: [pullRefreshMixin],
		data() {
			return {
				// 默认头像URL（从CDN）
				defaultAvatarUrl: getDefaultAvatarUrl(),
			userInfo: {
				displayName: '教师',
				nickname: '',
				avatar: '',
				phone: '',
				uid: '',
				role: 'teacher'
			},
			teacherProfile: {
				title: ''
			},
			metrics: {
				totalStudents: 0,
				totalAppointments: 0,
				totalTrials: 0,
				successfulTrials: 0,
				totalIncome: '0.00',
				verificationStatus: 'pending'
			},
			actionList: [
				{
					title: '工作台',
					icon: getIconUrl('dashboard.png'),
					url: '/pages-teacher/index/index',
					type: 'primary'
				},
				{
					title: '预约管理',
					icon: getIconUrl('calendar.png'),
					url: '/pages-teacher/appointment/list',
					type: 'accent'
				},
				{
					title: '完善资料',
					icon: getIconUrl('edit.png'),
					url: '/pages-teacher/profile/edit',
					type: 'accent'
				},
				{
					title: '课程日历',
					icon: getIconUrl('calendar.png'),
					url: '/pages-teacher/appointment/calendar',
					type: 'primary'
				}
			],
			listMenus: [
				{
					title: '教师主页',
					desc: '展示个人介绍与课程信息',
					icon: getIconUrl('user.png'),
					url: '/pages-teacher/profile/index'
				},
				{
					title: '收款确认',
					desc: '微信转账待确认时在此处理',
					icon: getIconUrl('wallet.png'),
					url: '/pages-teacher/wallet/index'
				},
				{
					title: '我的优惠券',
					desc: '支付信息费时可抵扣使用',
					icon: getIconUrl('wallet.png'),
					url: '/pages-teacher/coupon/list'
				},
				{
					title: '评价管理',
					desc: '查看并回复家长评价',
					icon: getIconUrl('star.png'),
					url: '/pages-teacher/review/list'
				},
				{
					title: '关注服务号',
					desc: '一键关注，接收预约与消息通知',
					icon: getIconUrl('bell.png'),
					url: '/pages/common/follow-oa'
				},
				{
					title: '系统消息',
					desc: '查看平台通知和审核结果',
					icon: getIconUrl('bell.png'),
					url: '/pages-teacher/user/messages'
				},
				{
					title: '消息中心',
					desc: '与家长实时沟通',
					icon: getIconUrl('chat.png'),
					url: '/pages-teacher/chat/list'
				}
			],
			statusTextMap: {
				pending: '待完善资料',
				verifying: '审核中',
				rejected: '审核未通过',
				verified: '已认证'
			},
			useMock: false,
			loading: false
		}
	},
	computed: {
		teacherStatusText() {
			const status = this.metrics.verificationStatus
			return this.statusTextMap[status] || ''
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		if (this.useMock) {
			this.loadData()
			return
		}
		if (ensureLoggedIn('teacher')) {
			this.loadData()
		}
	},
	onShow() {
		if (this.useMock) return
		if (!ensureLoggedIn('teacher')) {
			return
		}
		this.loadData()
	},
	methods: {
		copyUserId() {
			const uid = this.userInfo && this.userInfo.uid
			if (!uid) {
				uni.showToast({ title: '暂无用户ID', icon: 'none' })
				return
			}
			uni.setClipboardData({
				data: String(uid),
				success: () => {
					uni.showToast({ title: '用户ID已复制', icon: 'success' })
				},
				fail: () => {
					uni.showToast({ title: '复制失败', icon: 'none' })
				}
			})
		},
		async refreshData() {
			console.log('[teacher-user-center] 下拉刷新：重新加载个人中心')
			await this.loadUserInfo()
		},
		async loadData() {
			if (this.loading) return
			this.loading = true
			try {
				await Promise.all([this.loadUserInfo(), this.loadTeacherMetrics()])
			} finally {
				this.loading = false
			}
		},
		async loadUserInfo() {
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const stored = uni.getStorageSync('userInfo') || mockUserInfo
					this.userInfo = this.formatUserInfo(stored)
					return
				}

				const profileObj = uniCloud.importObject('user-profile', { customUI: true })
				const res = await profileObj.getUserProfile()
				if (res.code === 0 && res.data) {
					const info = this.formatUserInfo(res.data)
					this.userInfo = info
					setStoredUserInfo({
						...uni.getStorageSync('userInfo'),
						...info,
						role: info.role || 'teacher'
					})
				} else {
					uni.showToast({ title: res.message || '获取用户信息失败', icon: 'none' })
				}
			} catch (error) {
				console.error('加载用户信息失败:', error)
				uni.showToast({ title: '获取用户信息失败', icon: 'none' })
			}
		},
		formatUserInfo(data) {
			const stored = uni.getStorageSync('userInfo') || {}
			// 优先使用云函数返回的数据，如果没有则使用本地存储的数据
			const nickname = data.nickname || data.wx_nickname || stored.nickname || stored.wx_nickname || ''
			const displayName = data.teacher_info?.real_name || data.display_name || nickname || stored.displayName || '教师'
			return {
				displayName: displayName,
				nickname: nickname || displayName, // 如果昵称为空，使用显示名称
				avatar: data.avatar || data.wx_avatarUrl || stored.avatar || stored.wx_avatarUrl || '',
				phone: data.phone || stored.phone || '',
				uid: data._id || data.uid || stored.uid || stored._id || '',
				role: data.role || stored.role || 'teacher'
			}
		},
		async loadTeacherMetrics() {
			try {
				if (this.useMock) {
					this.metrics = {
						totalStudents: 6,
						totalAppointments: 18,
						totalTrials: 12,
						successfulTrials: 8,
						totalIncome: '6580.00',
						verificationStatus: 'verified'
					}
					this.teacherProfile = { title: '数学·物理辅导' }
					return
				}
				const dashboardObj = uniCloud.importObject('teacher-dashboard', { customUI: true })
				const res = await dashboardObj.getProfileDetail()
				if (res.code === 0 && res.data) {
					const { profile, metrics } = res.data
					this.teacherProfile = profile || {}
					
					// 优先使用教师资料中的 display_name 更新显示名称（如果存在且不为空）
					if (profile?.display_name) {
						this.userInfo.displayName = profile.display_name
					}
					
					// 判断资料是否完善：检查必填字段
					const hasQualificationImage = Array.isArray(profile?.qualifications) && profile.qualifications.some(item => item && item.image)
					const isFullTimeTeacher = profile?.school === '专职老师' || profile?.school === '专职老师（已毕业）'
					const gradesComplete = isFullTimeTeacher || (profile?.grades && profile.grades.length > 0)
					const isProfileComplete = profile?.display_name &&
						profile?.subjects && profile.subjects.length > 0 &&
						gradesComplete &&
						profile?.hourly_rate && profile.hourly_rate > 0 &&
						Number(profile?.teaching_experience?.years || 0) > 0 &&
						profile?.introduction &&
						String(profile.introduction).trim() &&
						hasQualificationImage
					
					// 如果资料完善，显示"已认证"；否则根据 is_verified 判断
					let verificationStatus = 'pending'
					if (isProfileComplete || profile?.is_verified) {
						verificationStatus = 'verified'
					} else if (profile?.verification_status) {
						verificationStatus = profile.verification_status
					}
					
					this.metrics = {
						totalStudents: metrics?.totalStudents ?? 0,
						totalAppointments: metrics?.totalAppointments ?? 0,
						totalTrials: metrics?.totalTrials ?? 0,
						successfulTrials: metrics?.successfulTrials ?? 0,
						totalIncome: (metrics?.totalIncome || 0).toFixed ? metrics.totalIncome.toFixed(2) : Number(metrics?.totalIncome || 0).toFixed(2),
						verificationStatus: verificationStatus
					}
				}
			} catch (error) {
				console.error('加载教师统计失败:', error)
			}
		},
		goToPage(url) {
			if (!url) return
			uni.navigateTo({ url })
		},
		handleLogout() {
			uni.showModal({
				title: '提示',
				content: '确定要退出登录吗？',
				success: (res) => {
					if (res.confirm) {
						clearStoredAuth()
						uni.reLaunch({ url: '/pages/login/index' })
					}
				}
			})
		},
		async handleDeleteAccount() {
			uni.showModal({
				title: '注销账号',
				content: '注销账号后将删除所有数据且不可恢复，注销后可以重新注册并选择角色。确定要注销吗？',
				confirmText: '确定注销',
				cancelText: '取消',
				confirmColor: '#ff9500',
				success: async (res) => {
					if (res.confirm) {
						try {
							const userLogin = uniCloud.importObject('user-login', { customUI: true })
							const result = await userLogin.deleteAccount()
							
							if (result.code === 0) {
								uni.showToast({
									title: '账号已注销',
									icon: 'success'
								})
								// 清除本地存储
								clearStoredAuth()
								// 延迟跳转，确保提示显示
								setTimeout(() => {
									uni.reLaunch({ url: '/pages/login/index' })
								}, 1500)
							} else {
								uni.showToast({
									title: result.message || '注销失败',
									icon: 'none'
								})
							}
						} catch (error) {
							console.error('注销账号失败:', error)
							uni.showToast({
								title: '注销失败，请重试',
								icon: 'none'
							})
						}
					}
				}
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

.tabbar-spacer {
	height: 140rpx;
}

.icp-footer {
	padding: 16rpx 0 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.icp-text {
	font-size: 22rpx;
	color: #aaaaaa;
}

/* CSS图标样式 */
.icon-dashboard {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-dashboard::before {
	content: '';
	position: absolute;
	top: 4rpx;
	left: 4rpx;
	width: 12rpx;
	height: 12rpx;
	border: 2rpx solid currentColor;
	border-radius: 2rpx;
}
.icon-dashboard::after {
	content: '';
	position: absolute;
	top: 4rpx;
	right: 4rpx;
	width: 12rpx;
	height: 12rpx;
	border: 2rpx solid currentColor;
	border-radius: 2rpx;
	box-shadow: 0 16rpx 0 -2rpx currentColor, -16rpx 16rpx 0 -2rpx currentColor, -16rpx 0 0 -2rpx currentColor;
}

.icon-calendar {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	border: 2rpx solid currentColor;
	border-radius: 4rpx;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-calendar::before {
	content: '';
	position: absolute;
	top: -2rpx;
	left: -2rpx;
	right: -2rpx;
	height: 8rpx;
	background: currentColor;
	border-radius: 4rpx 4rpx 0 0;
}
.icon-calendar::after {
	content: '';
	position: absolute;
	top: 12rpx;
	left: 6rpx;
	width: 4rpx;
	height: 4rpx;
	background: currentColor;
	border-radius: 50%;
	box-shadow: 8rpx 0 0 currentColor, 0 6rpx 0 currentColor, 8rpx 6rpx 0 currentColor;
}

.icon-edit {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-edit::before {
	content: '';
	position: absolute;
	bottom: 4rpx;
	left: 4rpx;
	width: 24rpx;
	height: 24rpx;
	border: 2rpx solid currentColor;
	border-top: none;
	border-left: none;
	background: transparent;
}
.icon-edit::after {
	content: '';
	position: absolute;
	bottom: 28rpx;
	left: 24rpx;
	width: 12rpx;
	height: 3rpx;
	background: currentColor;
	transform: rotate(45deg);
	transform-origin: left center;
}

.icon-user {
	width: 40rpx;
	height: 40rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-user::before {
	content: '';
	position: absolute;
	top: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 16rpx;
	height: 16rpx;
	border: 2rpx solid currentColor;
	border-radius: 50%;
	background: transparent;
}
.icon-user::after {
	content: '';
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 24rpx;
	height: 16rpx;
	border: 2rpx solid currentColor;
	border-top: none;
	border-radius: 0 0 24rpx 24rpx;
	background: transparent;
}

.icon-wallet {
	width: 40rpx;
	height: 40rpx;
	position: relative;
	display: inline-block;
	border: 2rpx solid currentColor;
	border-radius: 6rpx;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-wallet::before {
	content: '';
	position: absolute;
	top: 6rpx;
	left: 6rpx;
	width: 12rpx;
	height: 8rpx;
	border: 2rpx solid currentColor;
	border-radius: 2rpx;
	background: transparent;
}
.icon-wallet::after {
	content: '';
	position: absolute;
	bottom: 6rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 16rpx;
	height: 3rpx;
	background: currentColor;
}

.icon-star {
	width: 40rpx;
	height: 40rpx;
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
	border-left: 10rpx solid transparent;
	border-right: 10rpx solid transparent;
	border-bottom: 7rpx solid currentColor;
}
.icon-star::after {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%) rotate(180deg);
	width: 0;
	height: 0;
	border-left: 10rpx solid transparent;
	border-right: 10rpx solid transparent;
	border-bottom: 7rpx solid currentColor;
}

.icon-bell {
	width: 40rpx;
	height: 40rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-bell::before {
	content: '';
	position: absolute;
	top: 4rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 20rpx;
	height: 18rpx;
	border: 2rpx solid currentColor;
	border-radius: 10rpx 10rpx 2rpx 2rpx;
	background: transparent;
}
.icon-bell::after {
	content: '';
	position: absolute;
	bottom: 2rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 4rpx;
	height: 6rpx;
	border: 2rpx solid currentColor;
	border-top: none;
	border-radius: 0 0 4rpx 4rpx;
}

.icon-chat {
	width: 40rpx;
	height: 40rpx;
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
	width: 28rpx;
	height: 20rpx;
	border: 2rpx solid currentColor;
	border-radius: 6rpx 6rpx 6rpx 0;
	background: transparent;
}
.icon-chat::after {
	content: '';
	position: absolute;
	bottom: 4rpx;
	left: 6rpx;
	width: 4rpx;
	height: 4rpx;
	background: currentColor;
	border-radius: 50%;
	box-shadow: 6rpx 0 0 currentColor, 12rpx 0 0 currentColor;
}

/* 快捷功能按钮布局 */
.quick-action-item {
	flex: 0 0 25%;
	max-width: 25%;
	min-width: 0;
	padding: 0 10rpx;
	box-sizing: border-box;
}

.quick-action-icon {
	width: 40rpx;
	height: 40rpx;
}

.menu-icon {
	width: 40rpx;
	height: 40rpx;
}

.phone-icon {
	width: 28rpx;
	height: 28rpx;
}
</style>