<template>
	<view class="page">
		<view class="me-band">
			<text class="me-greet">{{ greetText }}</text>
			<text class="me-title">我的</text>
		</view>

		<view class="id-card">
			<view class="id-top">
				<image class="id-avatar" :src="userInfo.avatar || defaultAvatarUrl" mode="aspectFill"></image>
				<view class="id-meta">
					<text class="id-name">{{ userInfo.displayName }}</text>
					<text class="id-hint">教师 · {{ teacherStatusText || '待完善资料' }}</text>
				</view>
				<button class="me-edit" @click.stop="goToPage('/pages-teacher/profile/edit')">完善资料</button>
			</view>
			<view v-if="userInfo.uid" class="id-copy" @click.stop="copyUserId">
				<text class="id-copy-text">ID {{ userInfo.uid }}</text>
				<text class="id-copy-btn">复制</text>
			</view>
		</view>

		<view class="apt-card">
			<view class="apt-head">
				<text class="apt-title">教学数据</text>
				<text class="apt-more" @click="goToPage('/pages-teacher/index/index')">工作台 ›</text>
			</view>
			<view class="apt-grid">
				<view class="apt-cell" @click="goToPage('/pages-teacher/appointment/list')">
					<text class="apt-num">{{ metrics.totalStudents || 0 }}</text>
					<text class="apt-label">学员</text>
				</view>
				<view class="apt-cell" @click="goToPage('/pages-teacher/appointment/list')">
					<text class="apt-num">{{ metrics.totalTrials || 0 }}</text>
					<text class="apt-label">试课</text>
				</view>
				<view class="apt-cell" @click="goToPage('/pages-teacher/appointment/list')">
					<text class="apt-num">{{ metrics.successfulTrials || 0 }}</text>
					<text class="apt-label">成功</text>
				</view>
				<view class="apt-cell" @click="goToPage('/pages-teacher/wallet/index')">
					<text class="apt-num">{{ metrics.totalIncome || 0 }}</text>
					<text class="apt-label">收入</text>
				</view>
			</view>
		</view>

		<view class="svc-card">
			<view
				v-for="action in actionList"
				:key="action.url"
				class="svc-item"
				@click="goToPage(action.url)"
			>
				<view class="svc-tile">
					<image class="svc-icon" :src="action.icon" mode="aspectFit"></image>
				</view>
				<text class="svc-text">{{ action.title }}</text>
			</view>
		</view>

		<view class="menu-card">
			<view
				v-for="item in listMenus"
				:key="item.url"
				class="menu-item"
				hover-class="menu-item--hover"
				@click="goToPage(item.url)"
			>
				<view class="menu-left">
					<view class="menu-ico">
						<image class="menu-ico-img" :src="item.icon" mode="aspectFit"></image>
					</view>
					<text class="menu-text">{{ item.title }}</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" hover-class="menu-item--hover" @click="copyInviteCode">
				<view class="menu-left">
					<view class="menu-ico">
						<image class="menu-ico-img" :src="inviteIcon" mode="aspectFit"></image>
					</view>
					<text class="menu-text">我的邀请码</text>
				</view>
				<text class="code-pill">{{ myInviteCode || '--' }} 复制</text>
			</view>
			<view class="menu-item" hover-class="menu-item--hover" @click="openInviteInput">
				<view class="menu-left">
					<view class="menu-ico">
						<image class="menu-ico-img" :src="inviteIcon" mode="aspectFit"></image>
					</view>
					<text class="menu-text">填写好友邀请码</text>
				</view>
				<text v-if="inviteBound || boundInviteCode" class="code-pill">{{ boundInviteCode ? ('已填写 ' + boundInviteCode) : '已填写' }}</text>
				<text v-else class="menu-arrow">›</text>
			</view>
			<view class="menu-item" hover-class="menu-item--hover" @click="contactService">
				<view class="menu-left">
					<view class="menu-ico">
						<image class="menu-ico-img" :src="serviceIcon" mode="aspectFit"></image>
					</view>
					<text class="menu-text">联系客服</text>
				</view>
				<text class="code-pill">{{ adminWechat }} 复制</text>
			</view>
		</view>

		<view class="menu-card">
			<view class="menu-item" hover-class="menu-item--hover" @click="handleLogout">
				<view class="menu-left">
					<text class="menu-text">退出登录</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item danger" hover-class="menu-item--hover" @click="handleDeleteAccount">
				<view class="menu-left">
					<text class="menu-text">注销账号</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>
		</view>

		<text class="icp">蜀ICP备2026004236号-1X</text>

		<view class="tabbar-spacer"></view>
		<TeacherTabBar current="user" />
	</view>
</template>

<script>
import { mockUserInfo, useMockData } from '@/utils/mockData.js'
import { ensureLoggedIn, clearStoredAuth, setStoredUserInfo } from '@/utils/auth.js'
import TeacherTabBar from '@/pages-teacher/components/TeacherTabBar.vue'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { getDefaultAvatarUrl, getIconUrl, getInviteIconUrl } from '@/utils/imageConfig.js'

export default {
	name: 'TeacherUserCenter',
	components: {
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
					title: '我的课酬',
					desc: '查看课酬流水与到账状态',
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
				}
			],
			serviceIcon: getIconUrl('chat.png'),
			inviteIcon: getInviteIconUrl(),
			myInviteCode: '',
			boundInviteCode: '',
			inviteBound: false,
			adminWechat: 'chen18148503231',
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
		},
		greetText() {
			const hour = new Date().getHours()
			if (hour < 12) return '上午好'
			if (hour < 18) return '下午好'
			return '晚上好'
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
		contactService() {
			const wechat = this.adminWechat
			if (!wechat) {
				uni.showToast({ title: '暂无客服微信', icon: 'none' })
				return
			}
			uni.setClipboardData({
				data: wechat,
				success: () => {
					uni.showToast({ title: '微信号已复制', icon: 'success' })
				},
				fail: () => {
					uni.showToast({ title: '复制失败', icon: 'none' })
				}
			})
		},
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
			await Promise.all([this.loadUserInfo(), this.loadInviteCode()])
		},
		async loadData() {
			if (this.loading) return
			this.loading = true
			try {
				await Promise.all([this.loadUserInfo(), this.loadTeacherMetrics(), this.loadInviteCode()])
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
		applyInviteBind(data = {}) {
			const uid = (this.userInfo && this.userInfo.uid) || (uni.getStorageSync('userInfo') || {}).uid
			const bound = data.bound === true || !!data.bound_invite_code
			if (data.bound_invite_code) {
				this.boundInviteCode = data.bound_invite_code
			}
			if (bound) {
				this.inviteBound = true
				if (uid && this.boundInviteCode) {
					uni.setStorageSync(`bound_invite_code_${uid}`, this.boundInviteCode)
				}
			} else if (data.bound === false) {
				this.inviteBound = false
				this.boundInviteCode = ''
			}
		},
		async loadInviteCode() {
			try {
				if (this.useMock) {
					this.myInviteCode = 'DEMO88'
					this.boundInviteCode = ''
					this.inviteBound = false
					return
				}
				const uid = (this.userInfo && this.userInfo.uid) || (uni.getStorageSync('userInfo') || {}).uid
				const cached = uid ? uni.getStorageSync(`bound_invite_code_${uid}`) : ''
				if (cached) {
					this.boundInviteCode = cached
					this.inviteBound = true
				}
				const inviteCenter = uniCloud.importObject('invite-center', { customUI: true })
				const res = await inviteCenter.getMyInviteCode()
				if (res.code === 0 && res.data) {
					if (res.data.invite_code) this.myInviteCode = res.data.invite_code
					this.applyInviteBind(res.data)
				}
			} catch (error) {
				console.error('加载邀请码失败:', error)
			}
		},
		async copyInviteCode() {
			try {
				if (!this.myInviteCode && !this.useMock) {
					const inviteCenter = uniCloud.importObject('invite-center', { customUI: true })
					const res = await inviteCenter.getMyInviteCode()
					if (res.code === 0 && res.data && res.data.invite_code) {
						this.myInviteCode = res.data.invite_code
						this.applyInviteBind(res.data)
					} else {
						uni.showToast({ title: res.message || '生成邀请码失败', icon: 'none' })
						return
					}
				}
				const codeToCopy = this.myInviteCode || (this.useMock ? 'DEMO88' : '')
				if (!codeToCopy) {
					uni.showToast({ title: '邀请码生成中，请稍后再试', icon: 'none' })
					return
				}
				uni.setClipboardData({
					data: codeToCopy,
					success: () => {
						uni.showToast({ title: '邀请码已复制', icon: 'success' })
					}
				})
			} catch (error) {
				console.error('生成或复制邀请码失败:', error)
				uni.showToast({ title: '生成邀请码失败，请稍后重试', icon: 'none' })
			}
		},
		async openInviteInput() {
			if (this.useMock) {
				uni.showToast({ title: '演示模式下不支持填写邀请码', icon: 'none' })
				return
			}
			if (this.inviteBound || this.boundInviteCode) {
				uni.showModal({
					title: '已填写邀请码',
					content: this.boundInviteCode ? `您已填写邀请码：${this.boundInviteCode}` : '您已填写过邀请码，不能再次填写',
					showCancel: false,
					confirmText: '知道了'
				})
				return
			}
			try {
				const modalRes = await new Promise(resolve => {
					uni.showModal({
						title: '填写好友邀请码',
						editable: true,
						placeholderText: '请输入 6 位邀请码（不区分大小写）',
						cancelText: '取消',
						confirmText: '确定',
						success: resolve
					})
				})
				if (!modalRes.confirm) return

				const raw = (modalRes.content || '').trim()
				if (!raw) {
					uni.showToast({ title: '请输入邀请码', icon: 'none' })
					return
				}
				const inviteCode = raw.toUpperCase()
				if (inviteCode.length < 4 || inviteCode.length > 10) {
					uni.showToast({ title: '邀请码格式不正确', icon: 'none' })
					return
				}

				const inviteCenter = uniCloud.importObject('invite-center', { customUI: true })
				const res = await inviteCenter.acceptInvite({ invite_code: inviteCode })
				if (res.code === 0) {
					this.applyInviteBind({
						bound: true,
						bound_invite_code: (res.data && res.data.bound_invite_code) || inviteCode
					})
					uni.showToast({ title: res.message || '邀请码填写成功', icon: 'success' })
				} else {
					uni.showToast({ title: res.message || '邀请码无效', icon: 'none', duration: 3000 })
				}
			} catch (error) {
				console.error('填写邀请码失败:', error)
				uni.showToast({ title: error.message || '填写邀请码失败', icon: 'none' })
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
.page {
	background: #F4F6F9;
	min-height: 100vh;
}

.me-band {
	background: linear-gradient(160deg, #1D4ED8 0%, #2563EB 58%, #4F7DF3 100%);
	padding: 20rpx 32rpx 72rpx;
	color: #FFFFFF;
}

.me-greet {
	display: block;
	font-size: 24rpx;
	opacity: 0.82;
}

.me-title {
	display: block;
	margin-top: 4rpx;
	font-size: 40rpx;
	font-weight: 600;
}

.id-card,
.apt-card,
.svc-card,
.menu-card {
	margin: 0 32rpx 24rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.id-card {
	margin-top: -48rpx;
	padding: 32rpx;
}

.id-top {
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.id-avatar {
	width: 112rpx;
	height: 112rpx;
	border-radius: 50%;
	background: #93B4FF;
	flex-shrink: 0;
	box-shadow: 0 0 0 6rpx #EEF3FF;
}

.id-meta {
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

.id-hint {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.me-edit {
	flex-shrink: 0;
	height: 60rpx;
	padding: 0 24rpx;
	border-radius: 16rpx;
	background: #EEF3FF;
	color: #2563EB;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 60rpx;
	border: none;
}

.me-edit::after {
	border: none;
}

.id-copy {
	margin-top: 24rpx;
	padding: 16rpx 20rpx;
	background: #F4F6F9;
	border-radius: 16rpx;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}

.id-copy-text {
	flex: 1;
	min-width: 0;
	font-size: 22rpx;
	color: #8B919C;
	line-height: 1.45;
	word-break: break-all;
}

.id-copy-btn {
	flex-shrink: 0;
	font-size: 24rpx;
	font-weight: 600;
	color: #2563EB;
}

.apt-card {
	padding: 28rpx 20rpx 16rpx;
}

.apt-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 12rpx 20rpx;
}

.apt-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.apt-more {
	font-size: 24rpx;
	color: #8B919C;
}

.apt-grid {
	display: flex;
}

.apt-cell {
	flex: 1;
	text-align: center;
	position: relative;
	padding: 8rpx 0 12rpx;
}

.apt-cell + .apt-cell::before {
	content: '';
	position: absolute;
	left: 0;
	top: 16rpx;
	bottom: 24rpx;
	width: 1rpx;
	background: #EBEDF0;
}

.apt-num {
	display: block;
	font-size: 40rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.2;
}

.apt-label {
	display: block;
	margin-top: 4rpx;
	font-size: 22rpx;
	color: #8B919C;
}

.svc-card {
	padding: 28rpx 16rpx 20rpx;
	display: flex;
}

.svc-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.svc-tile {
	width: 80rpx;
	height: 80rpx;
	border-radius: 24rpx;
	background: #EEF3FF;
	color: #2563EB;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 12rpx;
}

.svc-icon {
	width: 40rpx;
	height: 40rpx;
}

.svc-text {
	font-size: 22rpx;
	color: #5C6370;
}

.menu-card {
	padding: 0;
	overflow: hidden;
}

.menu-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 104rpx;
	padding: 20rpx 32rpx;
	border-bottom: 1rpx solid #F3F4F6;
}

.menu-item:last-child {
	border-bottom: none;
}

.menu-item--hover {
	background: #F8FAFC;
}

.menu-left {
	display: flex;
	align-items: center;
	min-width: 0;
	flex: 1;
}

.menu-ico {
	width: 56rpx;
	height: 56rpx;
	border-radius: 16rpx;
	background: #EEF3FF;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 20rpx;
	flex-shrink: 0;
}

.menu-ico-img {
	width: 32rpx;
	height: 32rpx;
}

.menu-text {
	font-size: 30rpx;
	color: #1F2329;
}

.menu-item.danger .menu-text {
	color: #FA5151;
}

.menu-arrow {
	color: #C5C8CE;
	font-size: 24rpx;
	margin-left: 12rpx;
}

.code-pill {
	flex-shrink: 0;
	height: 56rpx;
	padding: 0 20rpx;
	border-radius: 16rpx;
	background: #EEF3FF;
	color: #2563EB;
	font-size: 22rpx;
	font-weight: 600;
	line-height: 56rpx;
	max-width: 360rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.icp {
	display: block;
	text-align: center;
	padding: 8rpx 0 24rpx;
	font-size: 22rpx;
	color: #B0B4BA;
}

.tabbar-spacer {
	height: 140rpx;
}
</style>