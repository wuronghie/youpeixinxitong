<!--
 * 页面名称：工作台（教师端）
 * 路由路径：pages-teacher/index/index
 * 页面功能：
 *   1. 显示教师基本信息（头像、姓名、职称、本月收入）
 *   2. 显示数据统计（今日预约、总学生数、即将开课）
 *   3. 显示待处理预约列表
 *   4. 提供常用功能快捷入口
 *   5. 支持下拉刷新
 * 
 * 数据结构说明：
 *   - profile: 教师资料信息
 *   - stats: 统计数据（本月收入、今日预约数、总学生数等）
 *   - pendingAppointments: 待处理预约列表
 *   - statItems: 统计项配置
 *   - quickActions: 快捷功能配置
 * 
 * 修改说明：
 *   - 修改统计项：修改 statItems 计算属性
 *   - 修改快捷功能：修改 quickActions 数组
 *   - 修改头部样式：修改第一个 view 的 style
 *   - 添加新的统计：在 stats 中添加新字段，在 statItems 中添加新项
-->
<template>
	<view class="page-container">
		<!-- 头部区域：显示教师信息和本月收入 -->
		<view class="header-section">
			<view class="header-bg"></view>
			<view class="header-content">
				<view class="teacher-info">
					<image 
						:src="profile.avatar || defaultAvatar" 
						class="teacher-avatar"
						mode="aspectFill"
					/>
					<view class="teacher-details">
						<view class="teacher-name">{{ profile.display_name || '教师' }}</view>
					</view>
				</view>
				<view class="income-card">
					<view class="income-label">本月收入</view>
					<view class="income-amount">¥{{ formatCurrency(stats.monthIncome) }}</view>
				</view>
			</view>
		</view>
		
		<!-- 数据统计：今日预约、总学生数、即将开课等 -->
		<view class="stats-section">
			<view class="stats-container">
				<view 
					class="stat-item"
					v-for="(item,index) in statItems" 
					:key="index"
				>
					<image :src="item.icon" class="stat-icon" mode="aspectFit" />
					<view class="stat-value">{{item.value}}</view>
					<view class="stat-label">{{item.label}}</view>
				</view>
			</view>
		</view>
		
		<!-- 打卡待办横幅（仅在有待打卡预约时展示） -->
		<view
			v-if="(stats.needClockIn || 0) + (stats.needClockOut || 0) > 0"
			class="clock-todo-banner"
			@click="goToAppointments"
		>
			<view class="clock-todo-banner__main">
				<text class="clock-todo-banner__title">课堂打卡待办</text>
				<text class="clock-todo-banner__sub">
					<text v-if="stats.needClockIn">{{ stats.needClockIn }} 节待上课打卡</text>
					<text v-if="stats.needClockIn && stats.needClockOut">　·　</text>
					<text v-if="stats.needClockOut">{{ stats.needClockOut }} 节待下课打卡</text>
				</text>
			</view>
			<text class="clock-todo-banner__arrow">→</text>
		</view>

		<!-- 待处理预约 -->
		<view class="appointments-section">
			<view class="section-header">
				<text class="section-title">待处理预约</text>
				<view class="section-more" @click="goToAppointments">
					<text class="more-text">全部预约</text>
					<text class="iconfont icon-arrow-right more-icon"></text>
				</view>
			</view>
			<view v-if="pendingAppointments.length" class="appointments-list">
				<view
					v-for="apt in pendingAppointments"
					:key="apt._id"
					class="appointment-card"
					@click="goToAppointmentDetail(apt._id)"
				>
					<view class="appointment-time">
						<text class="time-date">{{ apt.appointment_date || '--' }}</text>
						<text class="time-clock">{{ apt.appointment_time || '--:--' }}</text>
					</view>
					<view class="appointment-info">
						<text class="info-student">{{ apt.student_name || '学生' }}</text>
						<text class="info-subject">{{ apt.subject || '未填写科目' }}</text>
					</view>
					<view class="appointment-status" :class="statusClass(apt.status)">
						{{ formatStatus(apt.status) }}
					</view>
				</view>
			</view>
			<view v-else class="empty-state">
				<text class="empty-text">当前没有待处理预约</text>
			</view>
		</view>
		
		<!-- 常用功能 -->
		<view class="quick-actions-section">
			<view class="section-header">
				<text class="section-title">常用功能</text>
			</view>
			<view class="actions-grid">
				<view 
					class="action-item"
					v-for="(item,index) in quickActions" 
					:key="index"
					@click="goToPage(item.path)"
				>
					<view class="action-icon-wrapper">
						<image :src="item.icon" class="action-icon" mode="aspectFit" />
					</view>
					<text class="action-label">{{item.label}}</text>
				</view>
			</view>
		</view>
		
		<view class="tabbar-spacer"></view>
		<TeacherTabBar current="dashboard" />
	</view>
</template>

<script>
import { mockAppointments, useMockData } from '@/utils/mockData.js'
import TeacherTabBar from '@/components/TeacherTabBar.vue'
import { getDefaultAvatarUrl, getIconUrl } from '@/utils/imageConfig.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	name: 'TeacherDashboard',
	components: {
		TeacherTabBar
	},
	data() {
		return {
			// 教师资料信息
			profile: {
				display_name: '',  // 显示名称
				avatar: '',        // 头像URL
				title: '',         // 职称/头衔
				subjects: []       // 擅长科目数组
			},
			// 统计数据
			stats: {
				todayAppointments: 0,  // 今日预约数
				monthIncome: 0,        // 本月收入（元）
				totalStudents: 0,     // 累计学生数
				upcoming3Days: 0,     // 未来3天预约数
				upcoming7Days: 0,     // 未来7天预约数
				needClockIn: 0,       // 待上课打卡数量
				needClockOut: 0       // 待下课打卡数量
			},
			// 待处理预约列表（需要教师确认或处理的预约）
			pendingAppointments: [],
			// 是否使用模拟数据（开发测试用）
			useMock: false,
			// 是否正在加载
			loading: false,
			// 默认头像路径
			defaultAvatar,
			// 信息完善状态
			profileComplete: {
				isComplete: true,
				missingFields: [],
				missingFieldsText: []
			}
		}
	},
	computed: {
		/**
		 * 统计项配置
		 * 功能：将统计数据转换为显示配置
		 * 修改提示：
		 *   - 添加新统计项：在数组中添加新对象
		 *   - 修改图标：修改 icon 字段（使用 iconfont 类名）
		 *   - 修改标签：修改 label 字段
		 */
		statItems() {
			return [
				{
					label: '今日预约',
					value: this.stats.todayAppointments || 0,
					icon: getIconUrl('calendar.png')
				},
				{
					label: '累计学生',
					value: this.stats.totalStudents || 0,
					icon: getIconUrl('users.png')
				},
				{
					label: '未来3天',
					value: this.stats.upcoming3Days || 0,
					icon: getIconUrl('calendar.png')
				}
			]
		},
		/**
		 * 快捷功能配置
		 * 功能：定义工作台快捷功能入口
		 * 修改提示：
		 *   - 添加新功能：在数组中添加新对象
		 *   - 修改路径：修改 path 字段
		 *   - 修改图标：修改 icon 字段
		 */
		quickActions() {
			return [
				{
					label: '完善资料',
					path: '/pages-teacher/profile/edit',
					icon: getIconUrl('edit.png')
				},
				{
					label: '时间设置',
					path: '/pages-teacher/profile/schedule',
					icon: getIconUrl('clock.png')
				},
				{
					label: '我的钱包',
					path: '/pages-teacher/wallet/index',
					icon: getIconUrl('wallet.png')
				},
				{
					label: '评价管理',
					path: '/pages-teacher/review/list',
					icon: getIconUrl('star.png')
				},
				{
					label: '招募广场',
					path: '/pages-teacher/recruitment/list',
					icon: getIconUrl('chat.png')
				},
				{
					label: '家长沟通',
					path: '/pages-teacher/chat/list',
					icon: getIconUrl('chat.png')
				},
				{
					label: '查看日程',
					path: '/pages-teacher/appointment/calendar',
					icon: getIconUrl('calendar.png')
				}
			]
		}
	},
	/**
	 * 页面加载时触发
	 * 功能：初始化模拟数据开关，加载工作台数据
	 */
	onLoad() {
		console.log('[首页] onLoad 被调用')
		this.useMock = useMockData() === true
		console.log('[首页] useMock:', this.useMock)
		this.loadData()
		// 监听资料更新事件
		uni.$on('teacher-profile-updated', () => {
			console.log('[dashboard] 收到资料更新通知，刷新数据')
			this.loadData()
		})
	},
	/**
	 * 页面显示时触发
	 * 功能：每次显示页面时重新加载数据（确保数据最新）
	 */
	onShow() {
		console.log('[首页] ========== onShow 被调用 ==========')
		this.loadData()
	},
	onShareAppMessage() {
		return {
			title: '家教帮 · 教师工作台',
			path: '/pages-teacher/index/index'
		}
	},
	onShareTimeline() {
		return {
			title: '家教帮 · 教师工作台'
		}
	},
	/**
	 * 页面卸载时触发
	 * 功能：清理事件监听
	 */
	onUnload() {
		// 移除事件监听
		uni.$off('teacher-profile-updated')
	},
	methods: {
		async refreshData() {
			await this.loadData(true)
		},
		/**
		 * 加载工作台数据
		 * @param {Boolean} fromPullDown - 是否来自下拉刷新
		 * 功能：
		 *   1. 加载教师资料信息
		 *   2. 加载统计数据（今日预约、本月收入、总学生数等）
		 *   3. 加载待处理预约列表
		 * 
		 * 修改提示：
		 *   - 添加新的数据加载：在 Promise.all 中添加新的数据加载方法
		 *   - 修改数据来源：修改云函数调用
		 */
		async loadData(fromPullDown = false) {
			console.log('[首页] loadData 被调用, fromPullDown:', fromPullDown, 'loading:', this.loading)
			if (this.loading) {
				console.log('[首页] 正在加载中，跳过本次调用')
				return
			}
			this.loading = true
			console.log('[首页] 开始加载数据...')
			try {
				if (this.useMock) {
					console.log('[首页] 使用模拟数据')
					await new Promise(resolve => setTimeout(resolve, 200))
					this.profile = {
						display_name: '张老师',
						title: '资深数学教师',
						subjects: ['数学', '物理'],
						avatar: ''
					}
					this.stats = {
						todayAppointments: 3,
						monthIncome: 2800,
						totalStudents: 12,
						upcoming3Days: 4,
						upcoming7Days: 7,
						needClockIn: 1,
						needClockOut: 0
					}
					this.pendingAppointments = mockAppointments
						.filter(apt => apt.status === 'pending_confirm' || apt.status === 'pending_payment')
						.slice(0, 5)
						.map(apt => ({
							_id: apt._id,
							appointment_date: apt.appointment_date,
							appointment_time: apt.appointment_time,
							student_name: apt.student_info?.name || '学生',
							subject: apt.subject,
							status: apt.status
						}))
					return
				}

				const userInfo = uni.getStorageSync('userInfo') || {}
				console.log('[首页] 用户信息:', {
					hasUid: !!userInfo.uid,
					role: userInfo.role,
					uid: userInfo.uid
				})
				
				if (!userInfo.uid || userInfo.role !== 'teacher') {
					console.warn('[首页] 用户未登录或不是教师角色')
					uni.showToast({ title: '请先以教师身份登录', icon: 'none' })
					return
				}

				const dashboard = uniCloud.importObject('teacher-dashboard', { customUI: true })
				
				console.log('[首页] 开始检查教师信息完善状态...')
				console.log('[首页] 调用 dashboard.checkProfileComplete()...')
				
				// 并行加载工作台数据和检查信息完善状态
				const [overviewRes, profileCheckRes] = await Promise.all([
					dashboard.getOverview(),
					dashboard.checkProfileComplete()
				])
				
				console.log('[首页] 检查结果:', {
					overviewCode: overviewRes.code,
					overviewMessage: overviewRes.message,
					checkCode: profileCheckRes.code,
					checkMessage: profileCheckRes.message,
					checkData: profileCheckRes.data
				})

				if (overviewRes.code === 0) {
					this.profile = overviewRes.data.profile || this.profile
					this.stats = Object.assign({}, this.stats, overviewRes.data.stats || {})
					this.pendingAppointments = overviewRes.data.pendingAppointments || []
				} else {
					uni.showToast({ title: overviewRes.message || '加载失败', icon: 'none' })
				}
				
				// 更新信息完善状态
				if (profileCheckRes.code === 0) {
					this.profileComplete = {
						isComplete: profileCheckRes.data.isComplete || false,
						missingFields: profileCheckRes.data.missingFields || [],
						missingFieldsText: profileCheckRes.data.missingFieldsText || []
					}
					
					// 打印缺失信息日志 - 使用 console.warn 使其更明显
					if (!this.profileComplete.isComplete) {
						console.warn('========================================')
						console.warn('[首页] ⚠️ 教师信息未完善')
						console.warn('缺失的字段:', this.profileComplete.missingFieldsText.join('、'))
						console.warn('缺失字段数量:', this.profileComplete.missingFields.length)
						console.warn('请前往编辑页面完善以下信息:')
						this.profileComplete.missingFieldsText.forEach((field, index) => {
							console.warn(`  ${index + 1}. ${field}`)
						})
						console.warn('========================================')
					} else {
						console.log('[首页] ✓ 教师信息已完善')
					}
				} else {
					console.warn('[首页] 检查信息完善状态失败:', profileCheckRes.message)
				}
			} catch (error) {
				console.error('教师工作台加载失败:', error)
				uni.showToast({ title: '加载失败，请稍后再试', icon: 'none' })
			} finally {
				this.loading = false
				if (fromPullDown) {
					uni.stopPullDownRefresh()
				}
			}
		},

		/**
		 * 格式化金额
		 * @param {Number|String} amount - 金额
		 * @returns {String} 格式化后的金额字符串（保留2位小数）
		 */
		formatCurrency(amount) {
			const num = Number(amount || 0)
			return num.toFixed(2)
		},

		/**
		 * 格式化状态文字
		 * @param {String} status - 状态值
		 * @returns {String} 状态中文描述
		 * 修改提示：可以在这里添加更多状态的映射
		 */
		formatStatus(status) {
			const map = {
				pending_payment: '待支付',
				pending_confirm: '待确认',
				confirmed: '已确认',
				in_progress: '进行中',
				completed: '已完成',
				cancelled: '已取消',
				rejected: '已拒绝'
			}
			return map[status] || '未定义'
		},

		/**
		 * 获取状态对应的样式类
		 * @param {String} status - 状态值
		 * @returns {String} CSS类名（将下划线替换为横线）
		 */
		statusClass(status) {
			return status ? status.replace(/_/g, '-') : ''
		},

		/**
		 * 跳转到预约列表页
		 * 功能：导航到预约管理页面查看所有预约
		 */
		goToAppointments() {
			uni.navigateTo({ url: '/pages-teacher/appointment/list' })
		},

		/**
		 * 跳转到完善资料页面
		 */
		goToEditProfile() {
			uni.navigateTo({ url: '/pages-teacher/profile/edit' })
		},
		/**
		 * 跳转到预约详情页
		 * @param {String} id - 预约ID
		 * 功能：导航到预约详情页面查看详细信息
		 */
		goToAppointmentDetail(id) {
			uni.navigateTo({ url: `/pages-teacher/appointment/detail?id=${id}` })
		},

		/**
		 * 通用页面跳转方法
		 * @param {String} url - 目标页面路径
		 * 修改提示：可以在这里添加跳转前的验证逻辑
		 */
		goToPage(url) {
			if (!url) return
			uni.navigateTo({ url })
		}
	}
}
</script>

<style scoped>
/* 页面容器 */
.page-container {
	min-height: 100vh;
	background-color: #F5F5F5;
	padding-bottom: 140rpx;
}

/* 头部区域 */
.header-section {
	position: relative;
	height: 360rpx;
	overflow: hidden;
}

.header-bg {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
}

.header-content {
	position: relative;
	z-index: 1;
	padding: 120rpx 32rpx 40rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.teacher-info {
	display: flex;
	align-items: center;
	flex: 1;
}

.teacher-avatar {
	width: 140rpx;
	height: 140rpx;
	border-radius: 50%;
	border: 6rpx solid rgba(255, 255, 255, 0.3);
	background-color: #fff;
}

.teacher-details {
	margin-left: 24rpx;
	flex: 1;
}

.teacher-name {
	font-size: 36rpx;
	font-weight: 600;
	color: #FFFFFF;
	margin-bottom: 8rpx;
}

.teacher-title {
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.85);
}

.income-card {
	background: linear-gradient(135deg, #FFD43F 0%, #FFC107 100%);
	border-radius: 24rpx;
	padding: 24rpx 32rpx;
	box-shadow: 0 8rpx 24rpx rgba(255, 212, 63, 0.3);
	min-width: 200rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.income-label {
	font-size: 22rpx;
	color: #CC4A00;
	margin-bottom: 8rpx;
	opacity: 0.9;
}

.income-amount {
	font-size: 32rpx;
	font-weight: 700;
	color: #CC4A00;
}

/* 数据统计区域 */
.stats-section {
	padding: 32rpx 24rpx;
	background-color: #FFFFFF;
	margin-top: -40rpx;
	position: relative;
	z-index: 2;
}

.stats-container {
	background-color: #FFFFFF;
	border-radius: 24rpx;
	padding: 32rpx 0;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
	display: flex;
	align-items: center;
	justify-content: space-around;
}

.stat-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	flex: 1;
}

.stat-icon {
	width: 48rpx;
	height: 48rpx;
	margin-bottom: 16rpx;
}

.stat-value {
	font-size: 40rpx;
	font-weight: 700;
	color: #333333;
	margin-bottom: 8rpx;
}

.stat-label {
	font-size: 24rpx;
	color: #999999;
}

/* 打卡待办横幅 */
.clock-todo-banner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 0 24rpx 0 24rpx;
	padding: 24rpx 32rpx;
	border-radius: 20rpx;
	background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
	box-shadow: 0 4rpx 16rpx rgba(217, 119, 6, 0.15);
}

.clock-todo-banner__main {
	display: flex;
	flex-direction: column;
	flex: 1;
}

.clock-todo-banner__title {
	font-size: 30rpx;
	font-weight: 600;
	color: #92400e;
}

.clock-todo-banner__sub {
	font-size: 24rpx;
	color: #b45309;
	margin-top: 4rpx;
}

.clock-todo-banner__arrow {
	font-size: 36rpx;
	color: #b45309;
	margin-left: 16rpx;
}

/* 预约列表区域 */
.appointments-section {
	background-color: #FFFFFF;
	margin: 24rpx;
	border-radius: 24rpx;
	padding: 32rpx;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 32rpx;
}

.section-title {
	font-size: 32rpx;
	font-weight: 600;
	color: #333333;
}

.section-more {
	display: flex;
	align-items: center;
	color: #4A90E2;
	font-size: 26rpx;
}

.more-text {
	margin-right: 8rpx;
}

.more-icon {
	font-size: 24rpx;
}

.appointments-list {
	display: flex;
	flex-direction: column;
	gap: 24rpx;
}

.appointment-card {
	background-color: #F8F9FA;
	border-radius: 20rpx;
	padding: 32rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	transition: all 0.3s ease;
}

.appointment-card:active {
	transform: scale(0.98);
	background-color: #F0F0F0;
}

.appointment-time {
	width: 160rpx;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.time-date {
	font-size: 28rpx;
	font-weight: 600;
	color: #333333;
}

.time-clock {
	font-size: 24rpx;
	color: #999999;
}

.appointment-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.info-student {
	font-size: 30rpx;
	font-weight: 600;
	color: #333333;
}

.info-subject {
	font-size: 24rpx;
	color: #999999;
}

.appointment-status {
	font-size: 24rpx;
	padding: 12rpx 24rpx;
	border-radius: 999rpx;
	font-weight: 500;
	white-space: nowrap;
}

.appointment-status.pending-payment,
.appointment-status.pending-confirm {
	background-color: rgba(74, 144, 226, 0.15);
	color: #4A90E2;
}

.appointment-status.confirmed,
.appointment-status.in-progress {
	background-color: rgba(46, 213, 115, 0.15);
	color: #2ED573;
}

.appointment-status.completed {
	background-color: rgba(102, 126, 234, 0.15);
	color: #667EEA;
}

.appointment-status.cancelled,
.appointment-status.rejected {
	background-color: rgba(255, 107, 129, 0.15);
	color: #FF6B81;
}

.empty-state {
	text-align: center;
	padding: 80rpx 0;
}

.empty-text {
	font-size: 28rpx;
	color: #CCCCCC;
}

/* 快捷功能区域 */
.quick-actions-section {
	background-color: #FFFFFF;
	margin: 24rpx;
	border-radius: 24rpx;
	padding: 32rpx;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.actions-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 32rpx;
	margin-top: 24rpx;
}

.action-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 24rpx;
	border-radius: 20rpx;
	transition: all 0.3s ease;
}

.action-item:active {
	transform: scale(0.95);
	background-color: #F8F9FA;
}

.action-icon-wrapper {
	width: 96rpx;
	height: 96rpx;
	background: linear-gradient(135deg, #F0F7FF 0%, #E6F2FF 100%);
	border-radius: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 16rpx;
}

.action-icon {
	width: 48rpx;
	height: 48rpx;
}

.action-label {
	font-size: 26rpx;
	color: #333333;
	font-weight: 500;
}

.tabbar-spacer {
	height: 140rpx;
}

/* CSS图标样式 */
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

.icon-users {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-users::before {
	content: '';
	position: absolute;
	top: 0;
	left: 4rpx;
	width: 12rpx;
	height: 12rpx;
	border: 2rpx solid currentColor;
	border-radius: 50%;
	background: transparent;
}
.icon-users::after {
	content: '';
	position: absolute;
	top: 0;
	right: 4rpx;
	width: 12rpx;
	height: 12rpx;
	border: 2rpx solid currentColor;
	border-radius: 50%;
	background: transparent;
	box-shadow: -6rpx 16rpx 0 -2rpx currentColor, 0 16rpx 0 -2rpx currentColor, 6rpx 16rpx 0 -2rpx currentColor;
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

.icon-clock {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	border: 2rpx solid currentColor;
	border-radius: 50%;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-clock::before {
	content: '';
	position: absolute;
	top: 12rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 3rpx;
	height: 10rpx;
	background: currentColor;
}
.icon-clock::after {
	content: '';
	position: absolute;
	top: 12rpx;
	left: 50%;
	transform: translate(-50%, -50%) rotate(45deg);
	transform-origin: top center;
	width: 3rpx;
	height: 8rpx;
	background: currentColor;
}

.icon-wallet {
	width: 48rpx;
	height: 48rpx;
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
	width: 48rpx;
	height: 48rpx;
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

.icon-chat {
	width: 48rpx;
	height: 48rpx;
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

.icon-crown {
	width: 32rpx;
	height: 32rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-crown::before {
	content: '';
	position: absolute;
	bottom: 4rpx;
	left: 0;
	right: 0;
	height: 8rpx;
	background: currentColor;
	border-radius: 4rpx 4rpx 0 0;
}
.icon-crown::after {
	content: '';
	position: absolute;
	top: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 0;
	height: 0;
	border-left: 8rpx solid transparent;
	border-right: 8rpx solid transparent;
	border-bottom: 12rpx solid currentColor;
	box-shadow: -12rpx 12rpx 0 -4rpx currentColor, 12rpx 12rpx 0 -4rpx currentColor;
}

.icon-arrow-right {
	width: 32rpx;
	height: 32rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-arrow-right::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%) rotate(-45deg);
	width: 16rpx;
	height: 16rpx;
	border-right: 3rpx solid currentColor;
	border-top: 3rpx solid currentColor;
}

</style>