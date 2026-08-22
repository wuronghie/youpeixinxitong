<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex flex-column text-white mb-3">
				<text class="font-lg font-weight mb-1">预约管理</text>
				<text class="font-sm" style="opacity: 0.85;">管理所有预约信息</text>
			</view>
			<view class="d-flex a-center">
				<view
					v-for="tab in statusTabs"
					:key="tab.value"
					class="flex-1 text-center rounded py-2 mr-2 font-sm"
					:class="currentStatus === tab.value ? 'tab-active' : 'tab-inactive'"
					@click="switchStatus(tab.value)"
				>
					{{ tab.label }}
				</view>
			</view>
		</view>

		<!-- 预约列表 -->
		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view class="px-2 py-3">
				<view
					v-for="item in appointmentList"
					:key="item._id"
					class="card mb-3"
					@click="goToDetail(item._id)"
				>
					<view class="d-flex a-center j-sb mb-3">
						<view class="flex-1">
							<text class="font-md font-weight d-block mb-1">{{ (item.student_info && item.student_info.name) || item.student_name || '学生' }}</text>
							<text v-if="item.status !== 'contact_request'" class="font-sm text-light-muted d-block mb-1">
								时间：{{ (item.schedule && item.schedule.date) || item.appointment_date || '' }} {{ (item.schedule && item.schedule.start_time) || item.appointment_time || '' }}
							</text>
							<text v-else class="font-sm text-light-muted d-block mb-1">
								联系请求：家长已发送联系请求，等待您确认
							</text>
							<view v-if="item.status !== 'contact_request'" class="d-flex a-center flex-wrap">
								<text class="font-sm text-light-muted mr-2">
									类型：{{ (item.type === 'trial' || item.course_type === 'trial') ? '试课' : '正式课程' }}
								</text>
								<text class="font-sm font-weight main-text-color">
									费用：¥{{ item.total_amount || item.total_fee || 300 }}
								</text>
							</view>
							<view v-else class="d-flex a-center flex-wrap">
								<text class="font-sm text-light-muted">
									学生：{{ (item.student_info && item.student_info.grade) || '待确认' }} | 科目：{{ (item.student_info && item.student_info.subject) || '待确认' }}
								</text>
							</view>
						</view>
						<view class="d-flex flex-column a-end">
							<view class="bg-light-secondary rounded px-2 py-1 font-sm" :class="getStatusClass(item.status)">
								{{ getStatusText(item.status) }}
							</view>
							<view
								v-if="getClockBadge(item)"
								class="rounded-pill px-2 py-1 font-xs mt-2"
								:class="getClockBadge(item).className"
							>
								{{ getClockBadge(item).text }}
							</view>
						</view>
					</view>
					<view v-if="item.status === 'pending_confirm' || item.status === 'contact_request' || item.status === 'pending_payment'" class="d-flex a-center pt-3 border-top">
						<button 
							class="flex-1 border border-light-muted text-light-muted rounded px-3 py-2 font-sm mr-2"
							@click.stop="handleReject(item._id)"
						>
							拒绝
						</button>
						<button 
							class="flex-1 main-bg-color text-white rounded px-3 py-2 font-sm"
							@click.stop="handleConfirm(item._id)"
						>
							{{ item.status === 'contact_request' ? '查看详情' : '确认' }}
						</button>
					</view>
				</view>

				<view v-if="appointmentList.length === 0" class="d-flex flex-column a-center j-center py-5">
					<view class="icon-empty" style="color: #ddd;"></view>
					<text class="text-light-muted font-md mt-3">暂无预约</text>
				</view>

				<view v-if="loading && appointmentList.length" class="text-center text-light-muted font py-3">加载中...</view>
				<view v-else-if="!hasMore && appointmentList.length" class="text-center text-light-muted font py-3">没有更多数据了</view>
			</view>
		</scroll-view>

		<view class="tabbar-spacer"></view>
		<TeacherTabBar current="appointment" />
	</view>
</template>

<script>
import { mockAppointments, useMockData } from '@/utils/mockData.js'
import TeacherTabBar from '@/components/TeacherTabBar.vue'

export default {
	name: 'TeacherAppointmentList',
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
		/**
		 * 计算每条预约的"打卡待办"徽章
		 * 返回 { text, className } 或 null
		 *  - confirmed/in_progress 且未上课打卡 + 已到打卡窗口 → 红色：待上课打卡
		 *  - in_progress 已上课但未下课，且已超过排课结束时间 → 橙色：待下课打卡
		 *  - in_progress 已上课但未下课，未到排课结束 → 灰色：上课中
		 *  - in_progress 已上课已下课 / completed → 绿色：打卡已完成
		 */
		getClockBadge(item) {
			if (!item) return null
			const status = item.status
			if (!['confirmed', 'in_progress', 'completed'].includes(status)) return null
			if (!(item.deposit_paid === true || item.deposit_paid === 'true')) return null
			if (!(item.parent_paid === true || item.parent_paid === 'true')) return null

			const startTs = this.parseScheduleStart(item)
			const endTs = this.parseScheduleEnd(item, startTs)
			const now = Date.now()
			const ALLOW_EARLY_MS = 15 * 60 * 1000

			const started = !!item.class_started_at
			const ended = !!item.class_ended_at

			if (started && ended) {
				return { text: '打卡已完成', className: 'badge-success' }
			}
			if (started && !ended) {
				if (endTs && now >= endTs) {
					return { text: '待下课打卡', className: 'badge-warning' }
				}
				return { text: '上课中', className: 'badge-info' }
			}
			// 未上课打卡
			if (startTs && now >= startTs - ALLOW_EARLY_MS && (!endTs || now < endTs)) {
				return { text: '待上课打卡', className: 'badge-danger' }
			}
			if (endTs && now >= endTs) {
				return { text: '已超时未打卡', className: 'badge-danger' }
			}
			return { text: '未到打卡时间', className: 'badge-muted' }
		},
		parseScheduleStart(item) {
			const schedule = item.schedule || {}
			const date = schedule.date || item.appointment_date || item.date
			const startTime = schedule.start_time || item.appointment_time || item.start_time
			if (!date || !startTime) return 0
			const ts = new Date(`${date}T${startTime}:00`).getTime()
			return Number.isNaN(ts) ? 0 : ts
		},
		parseScheduleEnd(item, startTs) {
			if (!startTs) return 0
			const schedule = item.schedule || {}
			if (schedule.end_time) {
				const date = schedule.date || item.appointment_date
				const ts = new Date(`${date}T${schedule.end_time}:00`).getTime()
				if (!Number.isNaN(ts)) return ts
			}
			const duration = Number(schedule.duration || item.duration || 2)
			return startTs + duration * 3600 * 1000
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
.list-scroll {
	flex: 1;
	height: calc(100vh - 400rpx);
}

/* 选中状态的选项卡样式 */
.tab-active {
	background-color: #FFFFFF;
	color: #07C160;
	font-weight: 600;
}

/* 未选中状态的选项卡样式 */
.tab-inactive {
	background-color: rgba(255, 255, 255, 0.2);
	color: #FFFFFF;
}

.tabbar-spacer {
	height: 140rpx;
}

/* 打卡徽章样式 */
.rounded-pill {
	border-radius: 999rpx;
	font-size: 22rpx;
	white-space: nowrap;
}

.badge-danger {
	background: #fee2e2;
	color: #b91c1c;
}

.badge-warning {
	background: #fef3c7;
	color: #b45309;
}

.badge-success {
	background: #d1fae5;
	color: #047857;
}

.badge-info {
	background: #dbeafe;
	color: #1d4ed8;
}

.badge-muted {
	background: #f3f4f6;
	color: #6b7280;
}

/* CSS图标样式 */
.icon-empty {
	width: 240rpx;
	height: 240rpx;
	position: relative;
	display: inline-block;
	border: 4rpx dashed #ddd;
	border-radius: 20rpx;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-empty::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -60%);
	width: 60rpx;
	height: 60rpx;
	border: 4rpx solid #ddd;
	border-radius: 50%;
}
.icon-empty::after {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -30%);
	width: 80rpx;
	height: 4rpx;
	background: #ddd;
}
</style>