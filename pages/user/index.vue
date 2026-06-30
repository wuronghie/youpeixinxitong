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
	<view>
		<!-- 头部区域：显示用户信息和统计 -->
		<view class="position-relative d-flex a-center animated fadeIn faster" style="height: 320rpx;">
			<!-- 消息列表入口 -->
			<view @click="goToPage('/pages/chat/list')"
			class="iconfont icon-xiaoxi position-absolute text-white" 
			style="font-size: 50rpx;top: 75rpx;right: 20rpx;z-index: 100;"
			></view>
			
			<view class="main-bg-color" style="height: 320rpx;width: 100%;position: absolute;top: 0;left: 0;"></view>
			
			<view class="d-flex a-center position-absolute left-0 right-0" style="bottom: 50rpx;">
				<image :src="displayAvatar" style="height: 145rpx;width: 145rpx;border: 5rpx solid;" class="rounded-circle border-light ml-4"></image>
				<view class="ml-2 text-white">
					<view class="font-md mb-1" @click="handleHeaderClick">
						{{ displayName }}
					</view>
					<view v-if="!isLoggedIn" class="guest-login-btn rounded px-3 py-1 d-inline-flex a-center" @click="goLogin">
						<text class="font-sm">点击登录</text>
					</view>
					<view v-else class="font-sm" style="opacity: 0.88;" @click="goToPage('/pages/common/register')">
						查看或完善资料
					</view>
				</view>
			</view>
		</view>

		<view v-if="!isLoggedIn" class="bg-white mx-2 mt-3 rounded px-3 py-3 guest-card">
			<view class="font-md font-weight mb-2">游客浏览中</view>
			<text class="font-sm text-light-muted d-block mb-3">当前可先浏览教师列表、教师详情等内容。登录后可使用预约、收藏、消息、优惠券和个人资料功能。</text>
			<button class="main-bg-color text-white rounded px-3 py-2 font-md" @click="goLogin">立即登录</button>
		</view>
		
		<!-- 图标分类 -->
		<card>
			<view slot="title" class="d-flex a-center j-sb w-100">
				<text class="font-md font-weight">我的预约</text>
				<view class="text-secondary font ml-auto" 
				@click="goToPage('/pages/appointment/list')">
					全部预约 <text class="iconfont icon-you font"></text>
				</view>
			</view>
			<view class="d-flex a-center">
				<view 
				class="flex-1 d-flex flex-column a-center j-center py-3"
				hover-class="bg-light-secondary"
				v-for="(item,index) in appointmentOrders" :key="index"
				@click="openAppointment(item)">
					<view class="iconfont font-lg line-h"
					:class="item.icon"></view>
					<view>{{item.name}}</view>
					<view v-if="item.badge" class="badge">{{item.badge}}</view>
				</view>
			</view>
		</card>
		
		<divider></divider>
		
		<view class="bg-white">
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" 
			hover-class="bg-light-secondary"
			@click="goToPage('/pages/order/list')">
				<view class="d-flex a-center">
					<view class="iconfont icon-wallet_icon mr-2" style="color:#FDBF2E;font-size: 40rpx;"></view>
					<text class="font-md">课程订单</text>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" 
			hover-class="bg-light-secondary"
			@click="goToPage('/pages/recruitment/list')">
				<view class="d-flex a-center">
					<view class="iconfont icon-bangzhu mr-2" style="color:#3C9CFF;font-size: 40rpx;"></view>
					<text class="font-md">我的招募</text>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
			<!-- 我的邀请码展示 -->
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" hover-class="bg-light-secondary" @click="copyInviteCode">
				<view class="d-flex a-center">
					<view class="iconfont icon-yaoqing mr-2" style="color:#07C160;font-size: 40rpx;"></view>
					<view class="d-flex flex-column">
						<text class="font-md">我的邀请码</text>
						<text class="font-sm text-light-muted" v-if="myInviteCode">长按复制或点击复制后分享给好友</text>
						<text class="font-sm text-light-muted" v-else>生成中，如未出现请下拉刷新重试</text>
					</view>
				</view>
				<view class="d-flex a-center">
					<text class="font-md main-text-color mr-2">{{ myInviteCode || '--' }}</text>
					<text class="iconfont icon-you text-light-muted"></text>
				</view>
			</view>
			<!-- 手动填写好友邀请码 -->
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" hover-class="bg-light-secondary" @click="openInviteInput">
				<view class="d-flex a-center">
					<view class="iconfont icon-yaoqing mr-2" style="color:#3C9CFF;font-size: 40rpx;"></view>
					<view class="d-flex flex-column">
						<text class="font-md">填写好友邀请码</text>
						<text class="font-sm text-light-muted">每个账户只能填写一次，用于绑定邀请关系</text>
					</view>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" 
			hover-class="bg-light-secondary"
			@click="goToPage('/pages/user/collection')">
				<view class="d-flex a-center">
					<view class="iconfont icon-huangguan mr-2" style="color:#FCBE2D;font-size: 40rpx;"></view>
					<text class="font-md">我的收藏</text>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" 
			hover-class="bg-light-secondary"
			@click="goToPage('/pages/coupon/list')">
				<view class="d-flex a-center">
					<view class="iconfont icon-wallet_icon mr-2" style="color:#FF8F1F;font-size: 40rpx;"></view>
					<text class="font-md">我的优惠券</text>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" 
			hover-class="bg-light-secondary"
			@click="goToPage('/pages/common/register')">
				<view class="d-flex a-center">
					<view class="iconfont icon-service mr-2" style="color:#FA6C5E;font-size: 40rpx;"></view>
					<text class="font-md">完善资料</text>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" 
			hover-class="bg-light-secondary"
			@click="goToPage('/pages/user/messages')">
				<view class="d-flex a-center">
					<view class="iconfont icon-xiaoxi mr-2" style="color:#07C160;font-size: 40rpx;"></view>
					<text class="font-md">系统消息</text>
					<view v-if="overview.unreadMessages > 0" class="rounded-circle bg-danger text-white d-flex a-center j-center font-xs ml-2" style="min-width: 32rpx; height: 32rpx; padding: 0 8rpx;">{{ overview.unreadMessages > 99 ? '99+' : overview.unreadMessages }}</view>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" 
			hover-class="bg-light-secondary"
			@click="contactService">
				<view class="d-flex a-center">
					<view class="iconfont icon-home mr-2" style="color:#FE8B42;font-size: 40rpx;"></view>
					<text class="font-md">联系客服</text>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
		</view>
		
		<divider></divider>
		
		<view class="bg-white mb-3">
			<view class="d-flex a-center j-sb py-3 px-3 border-bottom" 
			hover-class="bg-light-secondary"
			@click="handleLogout">
				<view class="d-flex a-center">
					<view class="iconfont icon-icon_set_up mr-2" style="color:#808C98;font-size: 40rpx;"></view>
					<text class="font-md">退出登录</text>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
			<view class="d-flex a-center j-sb py-3 px-3" 
			hover-class="bg-light-secondary"
			@click="handleDeleteAccount">
				<view class="d-flex a-center">
					<view class="iconfont icon-icon_set_up mr-2" style="color:#ff9500;font-size: 40rpx;"></view>
					<text class="font-md" style="color:#ff9500;">注销账号</text>
				</view>
				<text class="iconfont icon-you text-light-muted"></text>
			</view>
		</view>
		
		<!-- 备案信息 -->
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
import card from '@/components/common/card.vue'
import divider from '@/components/common/divider.vue'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { checkPendingTrialConfirmReminder } from '@/utils/trialConfirmReminder.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	name: 'ParentUserCenter',
	components: {
		ParentTabBar,
		card,
		divider
	},
	data() {
		return {
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
			myInviteCode: ''
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
			const stats = this.overview.appointmentStats || {}
			return [
				{
					name: '待支付',
					icon: 'icon-wallet_icon',
					index: 'pending_payment',
					badge: this.badgeValue(stats.pending_payment || 0)
				},
				{
					name: '待确认',
					icon: 'icon-daishouhuo',
					index: 'pending_confirm',
					badge: this.badgeValue(stats.pending_confirm || 0)
				},
				{
					name: '进行中',
					icon: 'icon-pinglun',
					index: 'in_progress',
					badge: this.badgeValue(stats.in_progress || 0)
				},
				{
					name: '已完成',
					icon: 'icon-buoumaotubiao46',
					index: 'completed',
					badge: ''
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
			title: '家教帮 · 家长个人中心',
			// 将分享落地页指向登录页，方便新用户注册，并携带邀请码
			path: `/pages/login/index${query}`
		}
	},
	onShareTimeline() {
		const query = this.myInviteCode ? `inviteCode=${this.myInviteCode}` : ''
		return {
			title: '家教帮 · 家长个人中心',
			query
		}
	},
	methods: {
		async refreshData() {
			await this.initPage(true)
			await this.loadInviteCode()
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
		 * 格式化徽章数值
		 * @param {Number} count - 数量
		 * @returns {String} 格式化后的徽章文字（超过99显示99+）
		 */
		badgeValue(count) {
			if (!count) return ''
			return count > 99 ? '99+' : String(count)
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
		async loadInviteCode() {
			try {
				if (this.useMock) {
					this.myInviteCode = 'DEMO88'
					return
				}
				const inviteCenter = uniCloud.importObject('invite-center', { customUI: true })
				const res = await inviteCenter.getMyInviteCode()
				if (res.code === 0 && res.data && res.data.invite_code) {
					this.myInviteCode = res.data.invite_code
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
			uni.showModal({
				title: '联系客服',
				content: '请添加客服微信：jiajiabang_service 或拨打 400-123-4567',
				showCancel: false,
				confirmText: '我知道了'
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
					uni.showToast({ title: res.message || '邀请码填写成功', icon: 'success' })
					// 绑定成功后提示刷新优惠券列表，便于联调排查
					setTimeout(() => {
						console.log('[user-index] 邀请码绑定成功，建议前往“我的优惠券”页查看是否到账')
					}, 300)
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
.badge {
	position: absolute;
	top: 8rpx;
	right: 20rpx;
	background: #ff4757;
	color: #fff;
	font-size: 20rpx;
	border-radius: 999rpx;
	padding: 2rpx 10rpx;
	min-width: 32rpx;
	text-align: center;
	line-height: 1.2;
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

.guest-card {
	box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.05);
}

.guest-login-btn {
	background: rgba(255, 255, 255, 0.18);
	border: 1rpx solid rgba(255, 255, 255, 0.35);
}
</style>