<template>
	<view class="page">
		<scroll-view scroll-x class="tabs" :show-scrollbar="false">
			<view class="tabs-inner">
				<view
					v-for="tab in statusTabs"
					:key="tab.value"
					class="tab"
					:class="{ on: currentStatus === tab.value }"
					@click="switchStatus(tab.value)"
				>
					{{ tab.label }}
				</view>
			</view>
		</scroll-view>

		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view class="list-body">
				<view v-if="loading && appointmentList.length === 0">
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
								<text class="a-name">{{ cardTitle(item) }}</text>
								<text v-if="item.status !== 'contact_request'" class="a-time">
									{{ (item.schedule && item.schedule.date) || item.appointment_date || '' }}
									{{ (item.schedule && item.schedule.start_time) || item.appointment_time || '' }}<text v-if="item.schedule && item.schedule.end_time">–{{ item.schedule.end_time }}</text>
								</text>
								<text v-else class="a-time">联系请求：家长已发送联系请求，等待您确认</text>
							</view>
							<text class="status" :class="statusPillClass(item.status)">{{ getStatusText(item.status) }}</text>
						</view>

						<view v-if="item.status === 'contact_request'" class="a-row">
							<text class="a-label">学生</text>
							<text class="a-value">{{ (item.student_info && item.student_info.grade) || '待确认' }} · {{ (item.student_info && item.student_info.subject) || '待确认' }}</text>
						</view>
						<block v-else>
							<view class="a-row">
								<text class="a-label">课型</text>
								<text class="a-value">{{ (item.type === 'trial' || item.course_type === 'trial') ? '试课' : '正式课程' }}</text>
							</view>
							<view class="a-row">
								<text class="a-label">费用</text>
								<text class="a-price" :class="{ trial: item.type === 'trial' || item.course_type === 'trial' }">¥{{ item.total_amount || item.total_fee || 300 }}</text>
							</view>
						</block>
						<view v-if="getClockBadge(item)" class="a-row">
							<text class="a-label">打卡</text>
							<text class="clock-badge" :class="getClockBadge(item).className">{{ getClockBadge(item).text }}</text>
						</view>

						<view
							v-if="item.status === 'pending_confirm' || item.status === 'contact_request' || item.status === 'pending_payment'"
							class="a-ops"
						>
							<text class="mini mini-danger" @click.stop="handleReject(item._id)">拒绝</text>
							<text class="mini mini-primary" @click.stop="handleConfirm(item._id)">
								{{ item.status === 'contact_request' ? '查看详情' : '确认' }}
							</text>
						</view>
					</view>

					<view v-if="!appointmentList.length && !loading" class="empty">
						<text class="empty-title">暂无预约</text>
						<text class="empty-sub">有新预约时会显示在这里</text>
					</view>

					<view v-if="loading && appointmentList.length" class="list-tip">加载中...</view>
					<view v-else-if="!hasMore && appointmentList.length" class="list-tip">已经到底啦</view>
				</view>
			</view>
		</scroll-view>

		<view class="tabbar-spacer"></view>
		<TeacherTabBar current="appointment" />
	</view>
</template>

<script>
import { mockAppointments, useMockData } from '@/utils/mockData.js'
import TeacherTabBar from '@/pages-teacher/components/TeacherTabBar.vue'
import { getTeacherClockBadge } from '@/pages-teacher/utils/appointmentClock.js'
import { createAppPushMixin } from '@/utils/appPushMixin.js'
import { APP_PUSH_TYPES } from '@/utils/chatPush.js'

export default {
	name: 'TeacherAppointmentList',
	mixins: [createAppPushMixin(APP_PUSH_TYPES.APPOINTMENT_UPDATE)],
	components: {
		TeacherTabBar
	},
	data() {
		return {
			currentStatus: 'all',
			statusTabs: [
				{ label: '全部', value: 'all' },
				{ label: '待确认', value: 'pending_confirm' },
				{ label: '已确认', value: 'confirmed' },
				{ label: '已完成', value: 'completed' }
			],
			appointmentList: [],
			useMock: true,
			loading: false,
			hasMore: true,
			page: 1,
			pageSize: 20
		}
	},
	onLoad() {
		this.useMock = useMockData() !== false
		this.loadAppointments()
	},
	onShow() {
		this.loadAppointments()
	},
	onShareAppMessage() {
		return {
			title: '优培信息通 · 教师预约管理',
			path: '/pages-teacher/appointment/list'
		}
	},
	onShareTimeline() {
		return {
			title: '优培信息通 · 教师预约管理'
		}
	},
	methods: {
		async refreshData() {
			await this.loadAppointments()
		},
		onAppPushPayload() {
			this.page = 1
			this.loadAppointments()
		},
		/**
		 * 计算每条预约的"打卡待办"徽章
		 * 返回 { text, className } 或 null
		 *  - confirmed/in_progress 且未上课打卡 + 已到打卡窗口 → 红色：待上课打卡
		 *  - in_progress 已上课但未下课，且已超过排课结束时间 → 橙色：待下课打卡
		 *  - in_progress 已上课但未下课，未到排课结束 → 灰色：上课中
		 *  - in_progress 已上课已下课 / completed → 绿色：打卡已完成
		 */
		getClockBadge(item) {
			return getTeacherClockBadge(item)
		},
		/**
		 * 将数据库状态映射到筛选状态
		 * @param {String} status - 数据库状态
		 * @returns {String} - 筛选状态：pending_confirm, confirmed, completed
		 */
		mapStatusToFilter(status) {
			// 待确认：待支付、待确认（contact_request 已在加载时过滤，不会进入此方法）
			if (status === 'pending_payment' || status === 'pending_confirm' || status === 'contact_request') {
				return 'pending_confirm'
			}
			// 已确认：已确认、进行中
			if (status === 'confirmed' || status === 'in_progress') {
				return 'confirmed'
			}
			// 已完成：已完成、已拒绝、已取消、退款中、已退款
			if (status === 'completed' || status === 'rejected' || status === 'cancelled' || status === 'refunding' || status === 'refunded') {
				return 'completed'
			}
			// 默认归入待确认
			return 'pending_confirm'
		},
		async loadAppointments() {
			if (this.loading) return
			this.loading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 300))
					let list = [...mockAppointments]
						// 过滤掉联系请求（contact_request），教师端预约页面不展示
						.filter(item => item.status !== 'contact_request')
					
					if (this.currentStatus !== 'all') {
						// 根据筛选状态过滤
						list = list.filter(item => {
							const filterStatus = this.mapStatusToFilter(item.status)
							return filterStatus === this.currentStatus
						})
					}
					
					this.appointmentList = list
					this.hasMore = false
				} else {
					const userInfo = uni.getStorageSync('userInfo') || {}
					if (!userInfo.uid || userInfo.role !== 'teacher') {
						uni.showToast({ title: '请先用教师身份登录', icon: 'none' })
						return
					}
					
					// 根据筛选状态构建查询条件（不再包含 contact_request）
					let queryStatus = undefined
					if (this.currentStatus === 'pending_confirm') {
						// 待确认：包含 pending_payment、pending_confirm（不再包含 contact_request）
						queryStatus = ['pending_payment', 'pending_confirm']
						console.log('[teacher-appointment-list] 查询待确认状态，包含:', queryStatus)
					} else if (this.currentStatus === 'confirmed') {
						// 已确认：包含 confirmed 和 in_progress
						queryStatus = ['confirmed', 'in_progress']
					} else if (this.currentStatus === 'completed') {
						// 已完成：包含 completed, rejected, cancelled, refunding, refunded
						queryStatus = ['completed', 'rejected', 'cancelled', 'refunding', 'refunded']
					}
					// all 时不传 status，查询所有
					
					const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
					const res = await appointmentQuery.getTeacherAppointments({
						status: queryStatus,
						page: this.page,
						pageSize: this.pageSize
					})
					
					console.log('[teacher-appointment-list] 查询结果:', res.code === 0 ? `成功，返回${res.data?.list?.length || 0}条` : res.message)
					if (res.code === 0 && res.data?.list) {
						console.log('[teacher-appointment-list] 返回的状态分布:', res.data.list.map(item => item.status))
					}
					
					if (res.code === 0) {
						const data = res.data || {}
						const list = (data.list || [])
							// 过滤掉联系请求（contact_request），教师端预约页面不展示
							.filter(item => item.status !== 'contact_request')
						if (this.page === 1) {
							this.appointmentList = list
						} else {
							this.appointmentList = [...this.appointmentList, ...list]
						}
						// 使用分页信息判断是否还有更多
						if (data.pagination) {
							this.hasMore = data.pagination.hasMore !== undefined ? data.pagination.hasMore : list.length >= this.pageSize
						} else {
							this.hasMore = list.length >= this.pageSize
						}
					} else {
						uni.showToast({ title: res.message || '加载失败', icon: 'none' })
						this.appointmentList = []
					}
				}
			} catch (error) {
				console.error('加载失败:', error)
				uni.showToast({ title: '加载失败', icon: 'none' })
				this.appointmentList = []
			} finally {
				this.loading = false
			}
		},
		loadMore() {
			if (!this.hasMore || this.loading) return
			this.page += 1
			this.loadAppointments()
		},
		switchStatus(status) {
			if (this.currentStatus === status) return
			this.currentStatus = status
			this.page = 1
			this.hasMore = true
			this.appointmentList = []
			this.loadAppointments()
		},
		getStatusText(status) {
			const map = {
				pending_payment: '待支付',
				pending_confirm: '待确认',
				contact_request: '联系请求',  // 家长直接联系老师但还没预约
				confirmed: '已确认',
				in_progress: '进行中',
				completed: '已完成',
				rejected: '已拒绝',
				cancelled: '已取消',
				refunding: '退款中',
				refunded: '已退款'
			}
			return map[status] || '未知'
		},
		getStatusClass(status) {
			const map = {
				pending_payment: 'text-warning',
				pending_confirm: 'text-warning',
				contact_request: 'text-warning',  // 联系请求使用警告色
				confirmed: 'text-success',
				in_progress: 'text-primary',
				completed: 'text-light-muted',
				rejected: 'text-danger',
				cancelled: 'text-light-muted',
				refunding: 'text-warning',
				refunded: 'text-light-muted'
			}
			return map[status] || ''
		},
		statusPillClass(status) {
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
		cardTitle(item) {
			const name = (item.student_info && item.student_info.name) || item.student_name || '学生'
			const subject = item.subject || (item.student_info && item.student_info.subject)
			return subject ? `${name} · ${subject}` : name
		},
		async handleReject(id) {
			uni.showModal({
				title: '提示',
				content: '确定要拒绝这个预约吗？拒绝后费用将全额退还给家长。',
				success: async (res) => {
					if (res.confirm) {
						try {
							const userInfo = uni.getStorageSync('userInfo') || {}
							if (!userInfo.uid) {
								uni.showToast({ title: '请先登录', icon: 'none' })
								return
							}
							
							const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
							const result = await appointmentQuery.rejectAppointment({
								appointment_id: id,
								reason: '教师拒绝'
							})
							
							if (result.code === 0) {
								uni.showToast({
									title: result.message || '已拒绝',
									icon: 'success'
								})
								this.loadAppointments()
							} else {
								uni.showToast({
									title: result.message || '拒绝失败',
									icon: 'none'
								})
							}
						} catch (error) {
							console.error('拒绝失败:', error)
							uni.showToast({ title: '操作失败', icon: 'none' })
						}
					}
				}
			})
		},
		handleConfirm(id) {
			uni.navigateTo({
				url: `/pages-teacher/appointment/detail?id=${id}`
			})
		},
		goToDetail(id) {
			uni.navigateTo({
				url: `/pages-teacher/appointment/detail?id=${id}`
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

.clock-badge {
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
	line-height: 1.4;
}

.badge-danger {
	background: #FFF1F0;
	color: #FA5151;
}

.badge-warning {
	background: #FFF7ED;
	color: #C47A12;
}

.badge-success {
	background: #E8F8EF;
	color: #07C160;
}

.badge-info {
	background: #EEF3FF;
	color: #2563EB;
}

.badge-muted {
	background: #F4F6F9;
	color: #8B919C;
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

.mini-danger {
	background: #FFFFFF;
	color: #FA5151;
	border: 1rpx solid #FFD0D0;
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

.empty-title {
	font-size: 30rpx;
	color: #5C6370;
}

.empty-sub {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
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