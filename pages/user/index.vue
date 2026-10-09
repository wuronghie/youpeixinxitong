<!--
 * 页面名称：个人中心（家长端）
 * 路由路径：pages/user/index
 * 页面功能：
 *   1. 显示用户基本信息（头像、姓名、预约统计）
 *   2. 显示预约状态快捷入口（待支付、待确认、进行中、已完成）
 *   3. 提供功能入口（课程订单、我的收藏、完善资料、联系客服）
 *   4. 退出登录功能
 *   5. 支持下拉刷新
 * 
 * 数据结构说明：
 *   - userInfo: 用户基本信息（从本地存储或云函数获取）
 *   - profile: 用户详细资料（包含家长信息、学生信息等）
 *   - overview: 概览数据（预约统计、订单统计、未读消息数）
 * 
 * 修改说明：
 *   - 修改头部样式：修改第一个 view 的 style 和 class
 *   - 添加功能入口：在功能列表区域添加新的 view 项
 *   - 修改预约状态：修改 appointmentOrders 计算属性中的配置
 *   - 修改统计数据：修改 loadOverview() 方法中的数据获取逻辑
 *   - 修改客服信息：修改 contactService() 方法中的联系方式
-->
<template>
	<view class="page">
		<view class="me-band">
			<text class="me-greet">{{ greetText }}</text>
			<text class="me-title">我的</text>
		</view>

		<view class="id-card">
			<view class="id-top">
				<image class="id-avatar" :src="displayAvatar" mode="aspectFill" @click="handleHeaderClick"></image>
				<view class="id-meta" @click="handleHeaderClick">
					<text class="id-name">{{ displayName }}</text>
					<text class="id-hint">{{ isLoggedIn ? '资料可随时修改' : '登录后可完善资料' }}</text>
				</view>
				<button v-if="isLoggedIn" class="me-edit" @click.stop="goToPage('/pages/common/register')">完善资料</button>
				<button v-else class="me-edit" @click.stop="goLogin">点击登录</button>
			</view>
			<view v-if="isLoggedIn && userInfo.uid" class="id-copy" @click.stop="copyUserId">
				<text class="id-copy-text">ID {{ userInfo.uid }}</text>
				<text class="id-copy-btn">复制</text>
			</view>
		</view>

		<view v-if="!isLoggedIn" class="welcome-card">
			<text class="welcome-title">游客浏览中</text>
			<text class="welcome-desc">可先浏览教师列表和详情。登录后可使用预约、收藏、消息、优惠券和个人资料。</text>
			<button class="welcome-btn" @click="goLogin">立即登录</button>
		</view>

		<block v-if="isLoggedIn">
			<view class="apt-card">
				<view class="apt-head">
					<text class="apt-title">我的预约</text>
					<text class="apt-more" @click="goToPage('/pages/appointment/list')">全部 ›</text>
				</view>
				<view class="apt-grid">
					<view
						v-for="(item, index) in appointmentOrders"
						:key="index"
						class="apt-cell"
						@click="openAppointment(item)"
					>
						<text class="apt-num">{{ overview.appointmentStats[item.index] || 0 }}</text>
						<text class="apt-label">{{ item.name }}</text>
					</view>
				</view>
			</view>

			<view class="svc-card">
				<view class="svc-item" @click="goToPage('/pages/order/list')">
					<view class="svc-tile"><text class="iconfont icon-wallet_icon"></text></view>
					<text class="svc-text">课程订单</text>
				</view>
				<view class="svc-item" @click="goToPage('/pages/recruitment/list')">
					<view class="svc-tile">
						<image class="svc-icon" :src="recruitmentIcon" mode="aspectFit"></image>
					</view>
					<text class="svc-text">我的招募</text>
				</view>
				<view class="svc-item" @click="goToPage('/pages-biz/user/collection')">
					<view class="svc-tile"><text class="iconfont icon-huangguan"></text></view>
					<text class="svc-text">我的收藏</text>
				</view>
				<view class="svc-item" @click="goToPage('/pages/coupon/list')">
					<view class="svc-tile"><text class="iconfont icon-wallet_icon"></text></view>
					<text class="svc-text">我的优惠券</text>
				</view>
			</view>

			<view class="menu-card">
				<view class="menu-item" hover-class="menu-item--hover" @click="goToPage('/pages-biz/user/profile')">
					<view class="menu-left">
						<view class="menu-ico"><text class="iconfont icon-service"></text></view>
						<text class="menu-text">个人信息</text>
					</view>
					<text class="iconfont icon-you menu-arrow"></text>
				</view>
				<view class="menu-item" hover-class="menu-item--hover" @click="goToPage('/pages/common/register')">
					<view class="menu-left">
						<view class="menu-ico"><text class="iconfont icon-service"></text></view>
						<text class="menu-text">完善资料</text>
					</view>
					<text class="iconfont icon-you menu-arrow"></text>
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
					<text v-else class="iconfont icon-you menu-arrow"></text>
				</view>
				<view class="menu-item" hover-class="menu-item--hover" @click="goToPage('/pages/common/follow-oa')">
					<view class="menu-left">
						<view class="menu-ico"><text class="iconfont icon-xiaoxi"></text></view>
						<text class="menu-text">关注服务号</text>
					</view>
					<text class="iconfont icon-you menu-arrow"></text>
				</view>
				<view class="menu-item" hover-class="menu-item--hover" @click="goToPage('/pages-biz/user/messages')">
					<view class="menu-left">
						<view class="menu-ico"><text class="iconfont icon-xiaoxi"></text></view>
						<text class="menu-text">系统消息</text>
					</view>
					<view v-if="overview.unreadMessages > 0" class="badge">
						{{ overview.unreadMessages > 99 ? '99+' : overview.unreadMessages }}
					</view>
					<text v-else class="iconfont icon-you menu-arrow"></text>
				</view>
				<view class="menu-item" hover-class="menu-item--hover" @click="contactService">
					<view class="menu-left">
						<view class="menu-ico"><text class="iconfont icon-home"></text></view>
						<text class="menu-text">联系客服</text>
					</view>
					<text class="code-pill">{{ adminWechat }} 复制</text>
				</view>
			</view>

			<view class="menu-card">
				<view class="menu-item" hover-class="menu-item--hover" @click="handleLogout">
					<view class="menu-left">
						<view class="menu-ico"><text class="iconfont icon-icon_set_up"></text></view>
						<text class="menu-text">退出登录</text>
					</view>
					<text class="iconfont icon-you menu-arrow"></text>
				</view>
				<view class="menu-item" hover-class="menu-item--hover" @click="handleDeleteAccount">
					<view class="menu-left">
						<view class="menu-ico danger"><text class="iconfont icon-icon_set_up"></text></view>
						<text class="menu-text danger">注销账号</text>
					</view>
					<text class="iconfont icon-you menu-arrow"></text>
				</view>
			</view>
		</block>

		<view class="icp-footer">
			<text class="icp-text">蜀ICP备2026004236号-1X</text>
		</view>

		<view class="tabbar-spacer"></view>
		<ParentTabBar current="user" />
	</view>
</template>

<script>
import { mockUserInfo, useMockData } from '@/utils/mockData.js'
import { clearStoredAuth, setStoredUserInfo } from '@/utils/auth.js'
import ParentTabBar from '@/components/ParentTabBar.vue'
import { getDefaultAvatarUrl, getRecruitmentIconUrl, getInviteIconUrl } from '@/utils/imageConfig.js'
import { checkPendingTrialConfirmReminder } from '@/utils/trialConfirmReminder.js'
import { createAppPushMixin } from '@/utils/appPushMixin.js'
import { APP_PUSH_TYPES } from '@/utils/chatPush.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	name: 'ParentUserCenter',
	mixins: [createAppPushMixin([APP_PUSH_TYPES.SYSTEM_MESSAGE, APP_PUSH_TYPES.APPOINTMENT_UPDATE])],
	components: {
		ParentTabBar
	},
	data() {
		return {
			recruitmentIcon: getRecruitmentIconUrl(),
			inviteIcon: getInviteIconUrl(),
			// 是否使用模拟数据（开发测试用）
			useMock: false,
			// 用户基本信息
			// 包含：uid, nickname, avatar, role, phone 等
			userInfo: {},
			// 用户详细资料（包含家长信息、学生信息等）
			// 从云函数 user-profile.getUserProfile() 获取
			profile: null,
			// 概览数据：预约统计、订单统计、未读消息
			overview: {
				// 预约状态统计
				appointmentStats: {
					total: 0,              // 预约总数
					pending_payment: 0,    // 待支付
					pending_confirm: 0,    // 待确认
					confirmed: 0,          // 已确认
					in_progress: 0,        // 进行中
					completed: 0,          // 已完成
					cancelled: 0           // 已取消
				},
				// 订单状态统计
				orderStats: {
					pending_payment: 0,    // 待支付订单数
					refund_processing: 0   // 退款处理中订单数
				},
				// 未读消息数
				unreadMessages: 0
			},
			// 当前用户的邀请码（用于分享）
			myInviteCode: '',
			boundInviteCode: '',
			inviteBound: false,
			adminWechat: 'chen18148503231'
		}
	},
	computed: {
		isLoggedIn() {
			return !!(this.userInfo && this.userInfo.uid)
		},
		/**
		 * 显示头像
		 * 优先级：profile.avatar > userInfo.avatar > 默认头像
		 */
		displayAvatar() {
			return (
				this.profile?.avatar ||
				this.userInfo?.avatar ||
				defaultAvatar
			)
		},
		/**
		 * 显示姓名
		 * 优先级：profile.parent_info.real_name > profile.nickname > userInfo.nickname > '微信用户'
		 */
		displayName() {
			return (
				this.profile?.parent_info?.real_name ||
				this.profile?.nickname ||
				this.userInfo?.nickname ||
				(this.isLoggedIn ? '微信用户' : '游客')
			)
		},
		greetText() {
			const hour = new Date().getHours()
			if (hour < 12) return '上午好'
			if (hour < 18) return '下午好'
			return '晚上好'
		},
		/**
		 * 头部统计数据
		 * 用于显示在头部区域的统计信息
		 * 修改提示：可以在这里添加更多统计项，如收藏数、优惠券数等
		 */
		heroStats() {
			const stats = this.overview.appointmentStats || {}
			return [
				{ key: 'total', label: '预约总数', value: stats.total || 0 },
				{ key: 'completed', label: '已完成', value: stats.completed || 0 },
				{ key: 'unread', label: '未读消息', value: this.overview.unreadMessages || 0 }
			]
		},
		/**
		 * 预约状态快捷入口配置
		 * 修改提示：
		 *   - 添加新状态：在数组中添加新对象
		 *   - 修改图标：修改 icon 字段（使用 iconfont 类名）
		 *   - 修改名称：修改 name 字段
		 *   - 修改跳转状态：修改 index 字段（对应 appointment/list 页面的 status 参数）
		 */
		appointmentOrders() {
			return [
				{
					name: '待支付',
					icon: 'icon-wallet_icon',
					index: 'pending_payment'
				},
				{
					name: '待确认',
					icon: 'icon-daishouhuo',
					index: 'pending_confirm'
				},
				{
					name: '进行中',
					icon: 'icon-pinglun',
					index: 'in_progress'
				},
				{
					name: '已完成',
					icon: 'icon-buoumaotubiao46',
					index: 'completed'
				}
			]
		}
	},
	/**
	 * 页面加载时触发
	 * 功能：初始化模拟数据开关
	 */
	onLoad() {
		this.useMock = useMockData() === true
	},
	/**
	 * 页面显示时触发
	 * 功能：检查登录状态，如果已登录则初始化页面数据
	 */
	onShow() {
		if (!this.hasValidParentSession()) {
			this.resetGuestState()
			return
		}
		// 延迟加载数据，避免阻塞页面渲染
		this.$nextTick(() => {
			setTimeout(() => {
				this.initPage()
				this.loadInviteCode()
			}, 50)
		})
		checkPendingTrialConfirmReminder()
	},
	onShareAppMessage() {
		const query = this.myInviteCode ? `?inviteCode=${this.myInviteCode}` : ''
		return {
			title: '优培信息通 · 家长个人中心',
			// 将分享落地页指向登录页，方便新用户注册，并携带邀请码
			path: `/pages/login/index${query}`
		}
	},
	onShareTimeline() {
		const query = this.myInviteCode ? `inviteCode=${this.myInviteCode}` : ''
		return {
			title: '优培信息通 · 家长个人中心',
			query
		}
	},
	methods: {
		async refreshData() {
			await this.initPage(true)
			await this.loadInviteCode()
		},
		onAppPushPayload() {
			if (!this.hasValidParentSession()) return
			this.loadOverview()
		},
		hasValidParentSession() {
			const token = uni.getStorageSync('uni_id_token')
			const stored = uni.getStorageSync('userInfo') || {}
			return !!(token && stored.uid && stored.role === 'parent')
		},
		resetGuestState() {
			this.userInfo = {}
			this.profile = null
			this.myInviteCode = ''
			this.boundInviteCode = ''
			this.inviteBound = false
			this.overview = {
				appointmentStats: {
					total: 0,
					pending_payment: 0,
					pending_confirm: 0,
					confirmed: 0,
					in_progress: 0,
					completed: 0,
					cancelled: 0
				},
				orderStats: {
					pending_payment: 0,
					refund_processing: 0
				},
				unreadMessages: 0
			}
		},
		goLogin() {
			uni.navigateTo({ url: '/pages/login/index' })
		},
		handleHeaderClick() {
			if (!this.isLoggedIn) {
				this.goLogin()
				return
			}
			this.goToPage('/pages/common/register')
		},
		ensureLoginBeforeAction() {
			if (this.isLoggedIn) return true
			uni.showToast({ title: '请先登录后使用', icon: 'none' })
			setTimeout(() => {
				this.goLogin()
			}, 300)
			return false
		},
		/**
		 * 初始化页面数据
		 * @param {Boolean} fromPullDown - 是否来自下拉刷新
		 * 功能：
		 *   1. 加载用户资料
		 *   2. 加载概览数据（预约统计、订单统计等）
		 * 修改提示：可以在这里添加其他数据加载逻辑，如优惠券、积分等
		 */
		async initPage(fromPullDown = false) {
			try {
				await Promise.all([this.loadUserProfile(), this.loadOverview()])
			} catch (error) {
				console.error('初始化家长个人中心失败:', error)
			} finally {
				if (fromPullDown) {
					uni.stopPullDownRefresh()
				}
			}
		},
		/**
		 * 加载当前用户的邀请码（用于分享）
		 */
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
		/**
		 * 加载用户资料
		 * 功能：
		 *   1. 从本地存储获取用户基本信息
		 *   2. 调用云函数获取最新用户资料
		 *   3. 更新本地存储的用户信息
		 * 修改提示：
		 *   - 可以在这里添加用户资料的其他字段处理
		 *   - 可以添加资料验证逻辑
		 */
		async loadUserProfile() {
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 300))
					const stored = uni.getStorageSync('userInfo')
					this.userInfo = stored || mockUserInfo
					this.profile = Object.assign({}, this.userInfo)
					return
				}
				const stored = uni.getStorageSync('userInfo') || {}
				this.userInfo = stored
				if (!stored.uid) {
					uni.showToast({ title: '请先登录', icon: 'none' })
					return
				}
				const userProfile = uniCloud.importObject('user-profile', { customUI: true })
				const res = await userProfile.getUserProfile()
				if (res.code === 0 && res.data) {
					const info = res.data
					this.profile = info
					this.userInfo = {
						...stored,
						nickname: info.nickname || stored.nickname,
						avatar: info.avatar || stored.avatar,
						role: info.role || stored.role || 'parent',
						phone: info.phone || stored.phone || '',
						parent_info: info.parent_info || stored.parent_info || {}
					}
					setStoredUserInfo(this.userInfo)
					if (this.userInfo.role !== 'parent') {
						uni.showToast({ title: '当前账号非家长角色', icon: 'none' })
					}
				}
			} catch (error) {
				console.error('加载用户信息失败:', error)
			}
		},
		/**
		 * 加载概览数据
		 * 功能：获取预约统计、订单统计、未读消息数等数据
		 * 修改提示：
		 *   - 可以在这里添加其他统计数据的获取，如收藏数、优惠券数等
		 *   - 可以修改云函数调用，使用不同的云函数获取数据
		 */
		async loadOverview() {
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					this.overview = {
						appointmentStats: {
							total: 6,
							pending_payment: 1,
							pending_confirm: 1,
							confirmed: 2,
							in_progress: 1,
							completed: 1,
							cancelled: 0
						},
						orderStats: {
							pending_payment: 1,
							refund_processing: 0
						},
						unreadMessages: 2
					}
					return
				}
				const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
				const res = await appointmentQuery.getParentOverview()
				if (res.code === 0 && res.data) {
					const defaultOverview = JSON.parse(JSON.stringify(this.overview))
					this.overview = Object.assign({}, defaultOverview, res.data, {
						appointmentStats: Object.assign(
							{},
							defaultOverview.appointmentStats,
							res.data.appointmentStats || {}
						),
						orderStats: Object.assign(
							{},
							defaultOverview.orderStats,
							res.data.orderStats || {}
						),
						unreadMessages: res.data.unreadMessages || 0
					})
				}
			} catch (error) {
				console.error('加载概览数据失败:', error)
			}
		},
		/**
		 * 打开预约列表（带状态筛选）
		 * @param {Object} item - 预约状态项（包含 index 字段）
		 * 功能：跳转到预约列表页，并传递状态参数进行筛选
		 */
		openAppointment(item) {
			if (!this.ensureLoginBeforeAction()) return
			if (item.index) {
				uni.navigateTo({
					url: `/pages/appointment/list?status=${item.index}`
				})
			}
		},
		/**
		 * 通用页面跳转方法
		 * @param {String} url - 目标页面路径
		 * 修改提示：可以在这里添加跳转前的验证逻辑，如登录检查、权限检查等
		 */
		goToPage(url) {
			if (!url) return
			if (!this.ensureLoginBeforeAction()) return
			uni.navigateTo({ url })
		},
		/**
		 * 联系客服
		 * 修改提示：
		 *   - 修改客服信息：修改 content 中的联系方式
		 *   - 可以改为跳转到客服聊天页面
		 *   - 可以添加复制联系方式到剪贴板的功能
		 */
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
		/**
		 * 复制 / 生成【自己的】邀请码
		 * - 如果已有：直接复制
		 * - 如果还没有：先调用云函数生成，再复制
		 */
		async copyInviteCode() {
			if (!this.ensureLoginBeforeAction()) return
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
		/**
		 * 手动填写好友的邀请码
		 * - 后端已限制：每个账号只能绑定一次邀请人（acceptInvite 内部判断 inviter_uid）
		 */
		async openInviteInput() {
			if (!this.ensureLoginBeforeAction()) return
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

				console.log('[user-index] 开始绑定邀请码:', {
					inviteCode,
					userInfo: uni.getStorageSync('userInfo') || {}
				})

				const inviteCenter = uniCloud.importObject('invite-center', { customUI: true })
				const res = await inviteCenter.acceptInvite({ invite_code: inviteCode })

				console.log('[user-index] 绑定邀请码返回结果:', res)

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
		/**
		 * 处理退出登录
		 * 功能：
		 *   1. 显示确认弹窗
		 *   2. 清除本地存储的认证信息
		 *   3. 跳转到登录页
		 * 修改提示：可以在这里添加退出前的其他逻辑，如清除缓存、发送统计等
		 */
		handleLogout() {
			uni.showModal({
				title: '提示',
				content: '确定要退出登录吗？',
				success: (res) => {
					if (res.confirm) {
						clearStoredAuth()
						uni.reLaunch({
							url: '/pages/login/index'
						})
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
.welcome-card,
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

.welcome-card {
	padding: 32rpx;
}

.welcome-title {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
}

.welcome-desc {
	display: block;
	margin: 16rpx 0 28rpx;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.6;
}

.welcome-btn {
	height: 80rpx;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 30rpx;
	font-weight: 600;
	line-height: 80rpx;
	border: none;
}

.welcome-btn::after {
	border: none;
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

.svc-tile .iconfont {
	font-size: 36rpx;
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
	color: #2563EB;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 20rpx;
	flex-shrink: 0;
}

.menu-ico .iconfont {
	font-size: 30rpx;
}

.menu-ico-img {
	width: 32rpx;
	height: 32rpx;
}

.menu-ico.danger {
	background: #FFF1F0;
	color: #FA5151;
}

.menu-text {
	font-size: 30rpx;
	color: #1F2329;
}

.menu-text.danger {
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

.badge {
	min-width: 32rpx;
	height: 32rpx;
	padding: 0 8rpx;
	border-radius: 16rpx;
	background: #FA5151;
	color: #FFFFFF;
	font-size: 20rpx;
	line-height: 32rpx;
	text-align: center;
}

.tabbar-spacer {
	height: 140rpx;
}

.icp-footer {
	padding: 8rpx 0 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.icp-text {
	font-size: 22rpx;
	color: #B0B4BA;
}
</style>
