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
	<view style="background: #F5F5F5;">
		<!-- 状态选项卡：用于筛选不同状态的预约 -->
		<view class="status-tabs-bar d-flex a-center font-md">
			<view 
				class="flex-1 d-flex a-center j-center py-2 status-tab"
				:class="currentStatus === tab.value ? 'status-tab--active' : 'status-tab--inactive'"
				v-for="(tab,index) in statusTabs" 
				:key="index"
				@click="switchStatus(tab.value)"
			>
				{{tab.label}}
			</view>
		</view>
		
		<!-- 预约列表：支持滚动和加载更多 -->
		<scroll-view
			scroll-y
			@scrolltolower="loadMore"
			class="list-scroll"
		>
			<view class="px-2 py-3">
				<view v-if="isLoading && appointmentList.length === 0" class="d-flex flex-column">
					<view v-for="n in 4" :key="n" class="appointment-card mb-3">
						<view class="bg-light-secondary rounded mb-2" style="width: 200rpx;height: 30rpx;"></view>
						<view class="bg-light-secondary rounded mb-2" style="width: 150rpx;height: 24rpx;"></view>
						<view class="bg-light-secondary rounded" style="width: 180rpx;height: 24rpx;"></view>
					</view>
				</view>

				<view v-else>
					<view
						v-for="item in appointmentList"
						:key="item._id"
						class="appointment-card mb-3"
						@click="goToDetail(item._id)"
					>
						<view class="appointment-card-header">
							<view class="appointment-card-title">
								<view class="appointment-card-title-row">
									<text class="appointment-card-teacher-name">{{ item.teacher_name || '教师' }}</text>
									<text class="appointment-card-course-type">{{ formatCourseType(item.course_type) }}</text>
								</view>
								<view class="appointment-card-time">
									<text class="appointment-card-time-label">上课时间：</text>
									<text class="appointment-card-time-value">{{ item.date }} {{ item.time }}</text>
								</view>
							</view>
							<view class="status-badge font-sm" :class="statusClass(item.status)">
								{{ formatStatus(item.status) }}
							</view>
						</view>
						<view class="appointment-card-content">
							<view class="appointment-card-info-row">
								<text class="appointment-card-info-label">学习科目</text>
								<text class="appointment-card-info-value">{{ item.subject || '未填写' }}</text>
							</view>
							<view class="appointment-card-info-row">
								<text class="appointment-card-info-label">课程费用</text>
								<text class="appointment-card-price">¥{{ item.amount || 0 }}</text>
							</view>
						</view>
						<view class="appointment-card-footer">
							<text
								class="appointment-card-action mr-3"
								v-if="canPay(item)"
								@click.stop="goToPayment(item)"
							>
								去支付课程费
							</text>
							<text 
								class="appointment-card-action" 
								v-if="item.status === 'pending_confirm'" 
								@click.stop="goToDetail(item._id)"
							>
								查看详情
							</text>
							<text 
								class="appointment-card-status-text" 
								v-if="item.status === 'completed'"
							>
								已完成
							</text>
						</view>
					</view>

					<view v-if="!appointmentList.length && !isLoading" class="d-flex flex-column a-center j-center py-5">
						<text class="iconfont icon-dingdan" style="font-size: 120rpx;color: #ddd;"></text>
						<text class="text-light-muted font-md mt-3">还没有预约记录</text>
						<text class="text-light-muted font-sm mt-2">快去挑选老师开始体验吧</text>
						<button class="main-bg-color text-white rounded px-4 py-2 mt-3 font-sm" @click="goSearch">去找老师</button>
					</view>

					<view v-if="isLoading && appointmentList.length" class="text-center text-light-muted font py-3">加载中...</view>
					<view v-else-if="!hasMore && appointmentList.length" class="text-center text-light-muted font py-3">已经到底啦</view>
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

export default {
	name: 'AppointmentList',
	mixins: [pullRefreshMixin],
	components: {
		ParentTabBar
	},
	data() {
		return {
			// 状态选项卡配置
			// 修改提示：可以在这里添加更多状态，如"已取消"、"退款中"等
			statusTabs: [
				{ label: '全部预约', value: 'all' },
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
				pending_payment: 'status-badge--warning',
				pending_confirm: 'status-badge--warning',
				contact_request: 'status-badge--warning',
				confirmed: 'status-badge--primary',
				in_progress: 'status-badge--primary',
				completed: 'status-badge--success',
				rejected: 'status-badge--muted',
				cancelled: 'status-badge--muted',
				refunding: 'status-badge--warning',
				refunded: 'status-badge--muted'
			}
			return map[status] || 'status-badge--muted'
		},
		/**
		 * 格式化课程类型
		 * @param {String} type - 课程类型：'regular'（正式课程）或 'trial'（试课体验）
		 * @returns {String} 课程类型中文描述
		 */
		formatCourseType(type) {
			return type === 'regular' ? '正式课程' : '试课体验'
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
			uni.navigateTo({ url: `/pages/appointment/detail?id=${id}` })
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
/* 顶部状态选项卡容器 */
.status-tabs-bar {
	margin: 16rpx 24rpx 0;
	padding: 4rpx;
	background-color: #FFFFFF;
	box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.04);
}

.status-tab {
	border-radius: 8rpx;
	font-size: 26rpx;
}

.status-tab--active {
	background-color: #4A90E2;
	color: #FFFFFF;
	font-weight: 600;
}

.status-tab--inactive {
	color: #666666;
}

/* 预约卡片样式 */
.appointment-card {
	background-color: #FFFFFF;
	border-radius: 16rpx;
	padding: 32rpx;
	overflow: hidden;
	box-sizing: border-box;
}

.appointment-card-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	margin-bottom: 24rpx;
	padding-bottom: 24rpx;
	border-bottom: 1rpx solid #F0F0F0;
}

.appointment-card-title {
	flex: 1;
	min-width: 0;
	margin-right: 16rpx;
}

.appointment-card-title-row {
	display: flex;
	align-items: center;
	margin-bottom: 12rpx;
	flex-wrap: wrap;
}

.appointment-card-teacher-name {
	font-size: 28rpx;
	font-weight: 600;
	color: #333333;
	margin-right: 12rpx;
	flex-shrink: 0;
}

.appointment-card-course-type {
	font-size: 24rpx;
	color: #999999;
	flex-shrink: 0;
}

.appointment-card-time {
	display: flex;
	align-items: center;
	font-size: 24rpx;
}

.appointment-card-time-label {
	color: #999999;
	margin-right: 8rpx;
	flex-shrink: 0;
}

.appointment-card-time-value {
	color: #666666;
	word-break: break-all;
}

.appointment-card-content {
	display: flex;
	flex-direction: column;
	margin-bottom: 24rpx;
}

.appointment-card-info-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16rpx;
}

.appointment-card-info-row:last-child {
	margin-bottom: 0;
}

.appointment-card-info-label {
	font-size: 24rpx;
	color: #999999;
	flex-shrink: 0;
}

.appointment-card-info-value {
	font-size: 24rpx;
	color: #666666;
	flex: 1;
	text-align: right;
	word-break: break-all;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	margin-left: 16rpx;
}

.appointment-card-price {
	font-size: 28rpx;
	font-weight: 600;
	color: #4A90E2;
	flex-shrink: 0;
}

.appointment-card-footer {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	padding-top: 24rpx;
	border-top: 1rpx solid #F0F0F0;
}

.appointment-card-action {
	font-size: 24rpx;
	color: #4A90E2;
	flex-shrink: 0;
}

.appointment-card-status-text {
	font-size: 24rpx;
	color: #999999;
}

/* 状态徽章样式 */
.status-badge {
	border-radius: 999rpx;
	padding: 6rpx 20rpx;
	min-width: 120rpx;
	text-align: center;
	flex-shrink: 0;
	white-space: nowrap;
}

.status-badge--warning {
	background-color: #FFF7E6;
	color: #FA8C16;
}

.status-badge--primary {
	background-color: #E6F4FF;
	color: #1890FF;
}

.status-badge--success {
	background-color: #E6FFFB;
	color: #13C2C2;
}

.status-badge--muted {
	background-color: #F5F5F5;
	color: #8C8C8C;
}

.list-scroll {
	flex: 1;
	height: calc(100vh - 200rpx);
}

.tabbar-spacer {
	height: 140rpx;
}
</style>