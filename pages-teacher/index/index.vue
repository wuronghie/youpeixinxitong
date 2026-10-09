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
	<view class="page">
		<view class="dash-band">
			<text class="dash-greet">{{ greetText }}</text>
			<text class="dash-name">{{ profile.display_name || '教师' }}</text>
		</view>

		<view class="income-card">
			<view class="income-main">
				<text class="income-label">本月收入</text>
				<text class="income-amount">¥{{ formatCurrency(stats.monthIncome) }}</text>
			</view>
			<button class="income-btn" @click="goToPage('/pages-teacher/wallet/index')">查看流水</button>
		</view>

		<view class="stats-row">
			<view class="stat-card" v-for="(item, index) in statItems" :key="index">
				<text class="stat-value">{{ item.value }}</text>
				<text class="stat-label">{{ item.label }}</text>
			</view>
		</view>

		<view
			v-if="(stats.needClockIn || 0) + (stats.needClockOut || 0) > 0"
			class="todo-card"
			@click="goToAppointments"
		>
			<view class="todo-main">
				<text class="todo-title">课堂打卡待办</text>
				<text class="todo-sub">
					<text v-if="stats.needClockIn">{{ stats.needClockIn }} 节待上课打卡</text>
					<text v-if="stats.needClockIn && stats.needClockOut"> · </text>
					<text v-if="stats.needClockOut">{{ stats.needClockOut }} 节待下课打卡</text>
				</text>
			</view>
			<text class="todo-arrow">›</text>
		</view>

		<view class="section-card">
			<view class="section-head">
				<text class="section-title">待处理预约</text>
				<text class="section-more" @click="goToAppointments">全部 ›</text>
			</view>
			<view v-if="pendingAppointments.length" class="apt-list">
				<view
					v-for="apt in pendingAppointments"
					:key="apt._id"
					class="apt-row"
					@click="goToAppointmentDetail(apt._id)"
				>
					<view class="apt-main">
						<text class="apt-name">{{ apt.student_name || '学生' }} · {{ apt.subject || '未填写科目' }}</text>
						<text class="apt-time">{{ apt.appointment_date || '--' }} {{ apt.appointment_time || '--:--' }}</text>
					</view>
					<text class="status" :class="statusClass(apt.status)">{{ formatStatus(apt.status) }}</text>
				</view>
			</view>
			<view v-else class="empty">
				<text class="empty-text">当前没有待处理预约</text>
			</view>
		</view>

		<view class="section-card">
			<text class="section-title">常用功能</text>
			<view class="acts">
				<view
					class="act"
					v-for="(item, index) in quickActions"
					:key="index"
					@click="goToPage(item.path)"
				>
					<view class="act-tile">
						<image :src="item.icon" class="act-icon" mode="aspectFit" />
					</view>
					<text class="act-label">{{ item.label }}</text>
				</view>
			</view>
		</view>

		<view class="tabbar-spacer"></view>
		<TeacherTabBar current="dashboard" />
	</view>
</template>

<script>
import { mockAppointments, useMockData } from '@/utils/mockData.js'
import TeacherTabBar from '@/pages-teacher/components/TeacherTabBar.vue'
import { getDefaultAvatarUrl, getIconUrl, getRecruitmentIconUrl } from '@/utils/imageConfig.js'
import { createAppPushMixin } from '@/utils/appPushMixin.js'
import { APP_PUSH_TYPES } from '@/utils/chatPush.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	name: 'TeacherDashboard',
	mixins: [createAppPushMixin([APP_PUSH_TYPES.APPOINTMENT_UPDATE, APP_PUSH_TYPES.SYSTEM_MESSAGE])],
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
			_reloadQueued: false,
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
		greetText() {
			const hour = new Date().getHours()
			if (hour < 12) return '上午好'
			if (hour < 18) return '下午好'
			return '晚上好'
		},
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
				// 时间设置功能暂未就绪，入口先隐藏
				// {
				// 	label: '时间设置',
				// 	path: '/pages-teacher/profile/schedule',
				// 	icon: getIconUrl('clock.png')
				// },
				{
					label: '我的课酬',
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
					icon: getRecruitmentIconUrl()
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
			title: '优培信息通 · 教师工作台',
			path: '/pages-teacher/index/index'
		}
	},
	onShareTimeline() {
		return {
			title: '优培信息通 · 教师工作台'
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
		onAppPushPayload() {
			this.loadData()
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
				this._reloadQueued = true
				console.log('[首页] 正在加载中，排队刷新')
				return
			}
			this.loading = true
			this._reloadQueued = false
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
				if (this._reloadQueued) {
					this._reloadQueued = false
					this.loadData()
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
.page {
	min-height: 100vh;
	background: #F4F6F9;
	padding-bottom: 140rpx;
}

.dash-band {
	background: linear-gradient(160deg, #1D4ED8 0%, #2563EB 58%, #4F7DF3 100%);
	padding: 20rpx 32rpx 72rpx;
	color: #FFFFFF;
}

.dash-greet {
	display: block;
	font-size: 24rpx;
	opacity: 0.82;
}

.dash-name {
	display: block;
	margin-top: 4rpx;
	font-size: 40rpx;
	font-weight: 600;
}

.income-card,
.stat-card,
.todo-card,
.section-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.income-card {
	margin: -48rpx 32rpx 24rpx;
	padding: 32rpx 24rpx 32rpx 32rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	position: relative;
	z-index: 1;
}

.income-main {
	flex: 1;
	min-width: 0;
}

.income-label {
	display: block;
	font-size: 24rpx;
	color: #8B919C;
}

.income-amount {
	display: block;
	margin-top: 8rpx;
	font-size: 48rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.2;
}

.income-btn {
	flex-shrink: 0;
	margin: 0 0 0 auto;
	height: 60rpx;
	padding: 0 24rpx;
	border-radius: 16rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 60rpx;
	border: none;
}

.income-btn::after {
	border: none;
}

.stats-row {
	display: flex;
	gap: 16rpx;
	margin: 0 32rpx 24rpx;
}

.stat-card {
	flex: 1;
	padding: 24rpx 8rpx;
	text-align: center;
}

.stat-value {
	display: block;
	font-size: 36rpx;
	font-weight: 600;
	color: #1F2329;
}

.stat-label {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8B919C;
}

.todo-card {
	margin: 0 32rpx 24rpx;
	padding: 24rpx 28rpx;
	background: #FFF7ED;
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
	box-sizing: border-box;
}

.todo-main {
	flex: 1;
	min-width: 0;
}

.todo-title {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: #1F2329;
}

.todo-sub {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #9A6B2F;
}

.todo-arrow {
	font-size: 36rpx;
	color: #FA9D3B;
	margin-left: 16rpx;
}

.section-card {
	margin: 0 32rpx 24rpx;
	padding: 32rpx;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8rpx;
}

.section-title {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
}

.section-more {
	font-size: 26rpx;
	color: #2563EB;
}

.apt-list {
	margin-top: 8rpx;
}

.apt-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	padding: 24rpx 0;
	min-height: 88rpx;
	box-sizing: border-box;
}

.apt-row + .apt-row {
	border-top: 1rpx solid #EBEDF0;
}

.apt-main {
	flex: 1;
	min-width: 0;
}

.apt-name {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.apt-time {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.status {
	flex-shrink: 0;
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
	line-height: 1.4;
	background: #EEF3FF;
	color: #2563EB;
}

.status.pending-payment {
	background: #FFF1F0;
	color: #FA5151;
}

.status.pending-confirm {
	background: #FFF7ED;
	color: #FA9D3B;
}

.status.confirmed,
.status.in-progress {
	background: #E8F8EF;
	color: #07C160;
}

.status.completed {
	background: #EEF3FF;
	color: #2563EB;
}

.status.cancelled,
.status.rejected {
	background: #F4F6F9;
	color: #8B919C;
}

.empty {
	padding: 48rpx 0 16rpx;
	text-align: center;
}

.empty-text {
	font-size: 26rpx;
	color: #8B919C;
}

.acts {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	margin-top: 20rpx;
}

.act {
	flex: 0 0 25%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 16rpx 8rpx 12rpx;
	box-sizing: border-box;
}

.act-tile {
	width: 80rpx;
	height: 80rpx;
	border-radius: 24rpx;
	background: #EEF3FF;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 12rpx;
}

.act-icon {
	width: 40rpx;
	height: 40rpx;
}

.act-label {
	font-size: 22rpx;
	color: #5C6370;
	line-height: 1.35;
	text-align: center;
}

.tabbar-spacer {
	height: 140rpx;
}
</style>