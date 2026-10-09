<!--
 * 页面名称：我的预约列表（家长端）
 * 路由路径：pages/appointment/list
 * 页面功能：
 *   1. 显示预约列表，支持按状态筛选（全部、待支付、待确认、进行中、已完成、已取消）
 *   2. 显示预约详情（教师、课程类型、时间、科目、费用、状态）
 *   3. 支持下拉刷新和上拉加载更多
 *   4. 提供快捷操作（去支付、查看详情）
 *   5. 空状态提示和引导
 * 
 * 数据结构说明：
 *   - appointmentList: 预约列表数据
 *   - currentStatus: 当前选中的状态筛选
 *   - statusTabs: 状态选项卡配置
 *   - page: 当前页码
 *   - hasMore: 是否还有更多数据
 * 
 * 修改说明：
 *   - 修改状态选项：修改 statusTabs 数组
 *   - 修改列表样式：修改预约卡片的 template 和 style
 *   - 添加操作按钮：在预约卡片底部添加新的操作按钮
 *   - 修改筛选逻辑：修改 switchStatus() 方法
-->
<template>
	<view class="page">
		<scroll-view scroll-x class="tabs" :show-scrollbar="false">
			<view class="tabs-inner">
				<view
					v-for="(tab, index) in statusTabs"
					:key="index"
					class="tab"
					:class="{ on: currentStatus === tab.value }"
					@click="switchStatus(tab.value)"
				>
					{{ tab.label }}
				</view>
			</view>
		</scroll-view>

		<scroll-view
			scroll-y
			@scrolltolower="loadMore"
			class="list-scroll"
		>
			<view class="list-body">
				<view v-if="isLoading && appointmentList.length === 0">
					<view v-for="n in 4" :key="n" class="a-card skeleton">
						<view class="sk sk-title"></view>
						<view class="sk sk-line"></view>
						<view class="sk sk-line short"></view>
					</view>
				</view>

				<view v-else>
					<view
						v-for="item in appointmentList"
						:key="item._id"
						class="a-card"
						@click="goToDetail(item._id)"
					>
						<view class="a-head">
							<view class="a-head-main">
								<text class="a-name">{{ item.teacher_name || '教师' }} · {{ formatCourseType(item.course_type) }}</text>
								<text class="a-time">{{ item.date }} {{ item.time }}</text>
							</view>
							<text class="status" :class="statusClass(item.status)">{{ formatStatus(item.status) }}</text>
						</view>
						<view class="a-row">
							<text class="a-label">学习科目</text>
							<text class="a-value">{{ item.subject || '未填写' }}</text>
						</view>
						<view class="a-row">
							<text class="a-label">费用</text>
							<text class="a-price" :class="{ trial: item.course_type === 'trial' }">
								¥{{ item.amount || 0 }}<text v-if="item.course_type === 'trial'"> 试课</text>
							</text>
						</view>
						<view class="a-ops">
							<text
								v-if="canPay(item)"
								class="mini mini-primary"
								@click.stop="goToPayment(item)"
							>去支付</text>
							<text
								v-if="item.status === 'pending_confirm'"
								class="mini mini-ghost"
								@click.stop="goToDetail(item._id)"
							>查看详情</text>
						</view>
					</view>

					<view v-if="!appointmentList.length && !isLoading" class="empty">
						<text class="iconfont icon-dingdan empty-icon"></text>
						<text class="empty-title">还没有预约记录</text>
						<text class="empty-sub">快去挑选老师开始体验吧</text>
						<button class="empty-btn" @click="goSearch">去找老师</button>
					</view>

					<view v-if="isLoading && appointmentList.length" class="list-tip">加载中...</view>
					<view v-else-if="!hasMore && appointmentList.length" class="list-tip">已经到底啦</view>
				</view>
			</view>
		</scroll-view>

		<view class="tabbar-spacer"></view>
		<ParentTabBar current="appointment" />
	</view>
</template>

<script>
import ParentTabBar from '@/components/ParentTabBar.vue'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { createAppPushMixin } from '@/utils/appPushMixin.js'
import { APP_PUSH_TYPES } from '@/utils/chatPush.js'

export default {
	name: 'AppointmentList',
	mixins: [pullRefreshMixin, createAppPushMixin(APP_PUSH_TYPES.APPOINTMENT_UPDATE)],
	components: {
		ParentTabBar
	},
	data() {
		return {
			// 状态选项卡配置
			// 修改提示：可以在这里添加更多状态，如"已取消"、"退款中"等
			statusTabs: [
				{ label: '全部', value: 'all' },
				{ label: '待支付', value: 'pending_payment' },
				{ label: '待确认', value: 'pending_confirm' },
				{ label: '已确认', value: 'confirmed' },
				{ label: '进行中', value: 'in_progress' },
				{ label: '已完成', value: 'completed' }
			],
			// 当前选中的状态筛选（'all' 表示全部）
			currentStatus: 'all',
			// 预约列表数据
			appointmentList: [],
			// 是否正在加载（首次加载）
			isLoading: false,
			// 是否正在刷新（下拉刷新）
			isRefreshing: false,
			// 当前页码
			currentPage: 1,
			// 每页数据量
			pageSize: 10,
			// 是否还有更多数据
			hasMore: true,
			// 滚动位置（用于下拉刷新判断）
			scrollTop: 0,
			// 是否可以刷新（滚动位置在顶部时才能刷新）
			canRefresh: true
		}
	},
	/**
	 * 页面加载时触发
	 * @param {Object} options - 页面参数
	 * @param {String} options.status - 初始状态筛选（从其他页面跳转时传递）
	 * 功能：根据传入的状态参数初始化页面，加载预约列表
	 */
	onLoad(options) {
		if (options.status) {
			this.currentStatus = options.status
		}
		// 延迟加载数据，避免阻塞页面渲染
		this.$nextTick(() => {
			setTimeout(() => {
				this.loadAppointments(true)
			}, 50)
		})
	},
	onShareAppMessage() {
		return {
			title: '优培信息通 · 我的预约',
			path: '/pages/appointment/list'
		}
	},
	onShareTimeline() {
		return {
			title: '优培信息通 · 我的预约'
		}
	},
	methods: {
		/**
		 * 下拉刷新数据
		 * 功能：重新加载第一页数据
		 */
		async refreshData() {
			console.log('[appointment-list] 下拉刷新：重新加载列表')
			await this.loadAppointments(true)
		},
		onAppPushPayload() {
			this.loadAppointments(true)
		},
		/**
		 * 加载预约列表
		 * @param {Boolean} reset - 是否重置（重置页码和列表）
		 * 功能：
		 *   1. 根据当前状态筛选获取预约列表
		 *   2. 支持分页加载
		 *   3. 处理数据映射和格式化
		 * 
		 * 修改提示：
		 *   - 修改分页大小：修改 pageSize 的值
		 *   - 修改查询参数：修改传递给云函数的参数
		 *   - 修改数据映射：修改 map 函数中的字段映射逻辑
		 */
		async loadAppointments(reset = false) {
			if (this.isLoading) return
			if (reset) {
				this.currentPage = 1
				this.appointmentList = []
				this.hasMore = true
			}
			if (!this.hasMore && !reset) return

			this.isLoading = true
			try {
				const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
				const res = await appointmentQuery.getParentAppointments({
					// 家长端不展示联系请求（contact_request）和试课邀请（trial_invited），仅展示真实预约记录
					// 试课邀请在家长没有填写并确认预约前不应该显示在预约列表里
					status: this.currentStatus === 'all' ? undefined : this.currentStatus,
					page: this.currentPage,
					pageSize: this.pageSize
				})
				if (res.code === 0) {
					const list = (res.data.list || [])
						.filter(item => item.status !== 'contact_request' && item.status !== 'trial_invited')
						.map(item => ({
						_id: item._id,
						teacher_name: item.teacher_info?.display_name || item.teacher_info?.name || '教师',
						date: item.date || item.appointment_date,
						time: item.start_time || item.appointment_time,
						course_type: item.course_type,
						amount: item.total_amount || item.total_fee || 0,
						subject: item.subject || item.student_info?.subject || '',
						status: item.status,
						parent_paid: !!item.parent_paid,
						deposit_paid: !!item.deposit_paid,
						invited_by: item.invited_by || ''
					}))
					if (reset) {
						this.appointmentList = list
					} else {
						this.appointmentList = [...this.appointmentList, ...list]
					}
					const pagination = res.data.pagination || {}
					this.hasMore = pagination.hasMore !== undefined
						? pagination.hasMore
						: list.length >= this.pageSize
					this.currentPage += 1
				} else {
					throw new Error(res.message || '获取预约失败')
				}
			} catch (error) {
				console.error('获取预约列表失败:', error)
				uni.showToast({ title: error.message || '获取预约失败', icon: 'none' })
			} finally {
				this.isLoading = false
				this.isRefreshing = false
			}
		},
		handleScroll(e) {
			this.scrollTop = e.detail.scrollTop
			this.canRefresh = e.detail.scrollTop <= 10
		},
		handleScrollToUpper() {
			this.scrollTop = 0
			this.canRefresh = true
		},
		onRefresh() {
			if (!this.canRefresh || this.scrollTop > 10) {
				this.isRefreshing = false
				return
			}
			if (this.isRefreshing) return
			this.isRefreshing = true
			this.loadAppointments(true)
		},
		loadMore() {
			if (this.hasMore && !this.isLoading) {
				this.loadAppointments()
			}
		},
		/**
		 * 切换状态筛选
		 * @param {String} status - 状态值（'all'、'pending_payment'、'pending_confirm' 等）
		 * 功能：更新选中的状态，重新加载列表
		 */
		switchStatus(status) {
			if (this.currentStatus === status) return
			this.currentStatus = status
			this.loadAppointments(true)
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
				contact_request: '待确认',
				confirmed: '已确认',
				in_progress: '进行中',
				completed: '已完成',
				cancelled: '已取消',
				rejected: '已拒绝',
				trial_invited: '试课邀请',
				refunding: '退款处理中',
				refunded: '已退款'
			}
			return map[status] || '未知状态'
		},
		/**
		 * 获取状态对应的样式类
		 * @param {String} status - 状态值
		 * @returns {String} CSS类名
		 * 修改提示：可以在这里添加不同状态对应的不同颜色样式
		 */
		statusClass(status) {
			const map = {
				pending_payment: 's-pay',
				pending_confirm: 's-wait',
				contact_request: 's-wait',
				confirmed: 's-ing',
				in_progress: 's-ing',
				completed: 's-done',
				rejected: 's-muted',
				cancelled: 's-muted',
				refunding: 's-wait',
				refunded: 's-muted'
			}
			return map[status] || 's-muted'
		},
		/**
		 * 格式化课程类型
		 * @param {String} type - 课程类型：'regular'（正式课程）或 'trial'（试课体验）
		 * @returns {String} 课程类型中文描述
		 */
		formatCourseType(type) {
			return type === 'regular' ? '正式课' : '试课'
		},
		/**
		 * 判断是否可以支付
		 * @param {Object} item - 预约对象
		 * @returns {Boolean} 是否可以支付
		 * 功能：检查预约是否已支付，未支付且状态允许时返回true
		 */
		canPay(item) {
			if (!item || item.parent_paid) {
				return false
			}
			if (item.status === 'pending_payment') {
				return true
			}
			if (item.course_type === 'trial' && item.invited_by === 'teacher') {
				return ['pending_payment', 'pending_confirm', 'confirmed'].includes(item.status)
			}
			return item.status === 'confirmed'
		},
		/**
		 * 跳转到预约详情页
		 * @param {String} id - 预约ID
		 * 功能：导航到预约详情页面查看详细信息
		 */
		goToDetail(id) {
			if (!id) return
			uni.navigateTo({ url: `/pages-biz/appointment/detail?id=${id}` })
		},
		/**
		 * 跳转到支付页面
		 * @param {Object} item - 预约对象
		 * 功能：导航到预约详情页面进行支付
		 * 修改提示：可以改为跳转到专门的支付页面
		 */
		goToPayment(item) {
			this.goToDetail(item._id)
		},
		/**
		 * 跳转到找教师页面
		 * 功能：引导用户去搜索和选择教师
		 */
		goSearch() {
			uni.navigateTo({ url: '/pages/teacher/list' })
		}
	}
}
</script>

<style scoped>
.page {
	background: #F4F6F9;
	min-height: 100vh;
}

.tabs {
	background: #FFFFFF;
	white-space: nowrap;
	border-bottom: 1rpx solid #EBEDF0;
}

.tabs-inner {
	display: flex;
	padding: 0 16rpx;
}

.tab {
	flex-shrink: 0;
	height: 88rpx;
	padding: 0 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 26rpx;
	color: #5C6370;
	position: relative;
}

.tab.on {
	color: #2563EB;
	font-weight: 600;
}

.tab.on::after {
	content: "";
	position: absolute;
	left: 22%;
	right: 22%;
	bottom: 8rpx;
	height: 4rpx;
	background: #2563EB;
	border-radius: 4rpx;
}

.list-scroll {
	flex: 1;
	height: calc(100vh - 228rpx);
}

.list-body {
	padding: 8rpx 0 24rpx;
}

.a-card {
	margin: 24rpx 32rpx;
	padding: 28rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.a-head {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16rpx;
}

.a-head-main {
	flex: 1;
	min-width: 0;
}

.a-name {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.4;
}

.a-time {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #5C6370;
	line-height: 1.4;
}

.status {
	flex-shrink: 0;
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
	line-height: 1.4;
}

.s-pay {
	background: #FFF1F0;
	color: #FA5151;
}

.s-wait {
	background: #FFF6E8;
	color: #C47A12;
}

.s-ing {
	background: #EEF3FF;
	color: #2563EB;
}

.s-done {
	background: #E8F8EF;
	color: #07C160;
}

.s-muted {
	background: #F4F6F9;
	color: #8B919C;
}

.a-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 16rpx;
}

.a-label {
	font-size: 26rpx;
	color: #8B919C;
}

.a-value {
	font-size: 26rpx;
	font-weight: 600;
	color: #1F2329;
}

.a-price {
	font-size: 26rpx;
	font-weight: 600;
	color: #1F2329;
}

.a-price.trial {
	color: #FA5151;
}

.a-ops {
	display: flex;
	justify-content: flex-end;
	gap: 16rpx;
	margin-top: 24rpx;
}

.mini {
	height: 60rpx;
	padding: 0 24rpx;
	border-radius: 16rpx;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 60rpx;
	text-align: center;
}

.mini-primary {
	background: #2563EB;
	color: #FFFFFF;
}

.mini-ghost {
	background: #FFFFFF;
	color: #2563EB;
	border: 1rpx solid #D7E3FF;
}

.skeleton .sk {
	background: #EBEDF0;
	border-radius: 8rpx;
}

.sk-title {
	width: 280rpx;
	height: 32rpx;
	margin-bottom: 16rpx;
}

.sk-line {
	width: 360rpx;
	height: 24rpx;
	margin-bottom: 12rpx;
}

.sk-line.short {
	width: 200rpx;
	margin-bottom: 0;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 80rpx 32rpx;
}

.empty-icon {
	font-size: 120rpx;
	color: #EBEDF0;
}

.empty-title {
	margin-top: 24rpx;
	font-size: 30rpx;
	color: #5C6370;
}

.empty-sub {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.empty-btn {
	margin-top: 32rpx;
	height: 72rpx;
	padding: 0 40rpx;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 26rpx;
	line-height: 72rpx;
	border: none;
}

.empty-btn::after {
	border: none;
}

.list-tip {
	text-align: center;
	padding: 24rpx 0;
	font-size: 24rpx;
	color: #8B919C;
}

.tabbar-spacer {
	height: 140rpx;
}
</style>