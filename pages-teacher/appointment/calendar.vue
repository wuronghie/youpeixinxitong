<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex flex-column text-white mb-3">
				<text class="font-lg font-weight mb-1">课程日历</text>
				<text class="font-sm" style="opacity: 0.85;">查看和管理课程安排</text>
			</view>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 日历卡片 -->
				<card class="mb-3">
					<view class="d-flex a-center j-sb mb-3">
						<button class="bg-light-secondary rounded px-2 py-1 font-sm text-primary" @click="changeMonth(-1)">‹</button>
						<text class="font-md font-weight">{{ currentMonth }}</text>
						<button class="bg-light-secondary rounded px-2 py-1 font-sm text-primary" @click="changeMonth(1)">›</button>
					</view>
					<view class="d-flex a-center mb-2">
						<view class="d-flex a-center mr-3">
							<view class="rounded-circle bg-primary mr-1" style="width: 20rpx; height: 20rpx;"></view>
							<text class="font-xs text-light-muted">有预约</text>
						</view>
						<view class="d-flex a-center mr-3">
							<view class="rounded-circle bg-warning mr-1" style="width: 20rpx; height: 20rpx;"></view>
							<text class="font-xs text-light-muted">今天</text>
						</view>
						<view class="d-flex a-center">
							<view class="rounded-circle border border-primary mr-1" style="width: 20rpx; height: 20rpx; background: #fff;"></view>
							<text class="font-xs text-light-muted">已选中</text>
						</view>
					</view>
					<view class="bg-light-secondary rounded px-2 py-2">
						<view class="d-flex a-center mb-2">
							<text v-for="day in weekdays" :key="day" class="flex-1 text-center font-xs text-light-muted">{{ day }}</text>
						</view>
						<view class="d-flex flex-wrap">
							<view
								v-for="(day, index) in calendarDays"
								:key="index"
								class="day-cell"
								:class="{
									'text-light-muted': !day.isCurrentMonth,
									'bg-warning': day.isToday && !day.isSelected,
									'bg-primary text-white': day.isSelected,
									'font-weight': day.hasAppointment || day.isSelected
								}"
								@click="selectDay(day)"
							>
								<text class="font-sm">{{ day.date }}</text>
								<view v-if="day.hasAppointment && !day.isSelected" class="rounded-circle bg-primary mt-1" style="width: 12rpx; height: 12rpx;"></view>
								<view v-else-if="day.hasAppointment && day.isSelected" class="rounded-circle bg-white mt-1" style="width: 12rpx; height: 12rpx;"></view>
							</view>
						</view>
					</view>
				</card>

				<!-- 预约列表 -->
				<card headTitle="预约安排" class="mb-3">
					<view class="d-flex a-center j-sb mb-3">
						<text class="font-md font-weight">{{ selectedDate ? selectedDateDisplay : '请选择一个日期' }}</text>
						<text v-if="selectedAppointments.length > 0" class="font-xs text-light-muted">
							共 {{ selectedAppointments.length }} 个预约
						</text>
					</view>
					<view v-if="selectedAppointments.length === 0" class="d-flex flex-column a-center j-center py-5">
						<view class="icon-empty" style="color: #ddd;"></view>
						<text class="text-light-muted font-md mt-3">
							{{ selectedDate ? '当天暂时没有预约安排' : '选择一个日期查看课程安排' }}
						</text>
					</view>
					<view v-else>
						<view
							v-for="apt in selectedAppointments"
							:key="apt._id"
							class="bg-light-secondary rounded px-3 py-2 mb-2"
						>
							<view class="d-flex a-center j-sb mb-1">
								<text class="font-md font-weight main-text-color">{{ apt.appointment_time || '--:--' }}</text>
								<text class="bg-light-secondary rounded px-2 py-1 font-xs" :class="getStatusClass(apt.status)">
									{{ formatStatus(apt.status) }}
								</text>
							</view>
							<view class="d-flex a-center j-sb">
								<text class="font-sm">{{ apt.student_name || '学生' }}</text>
								<text class="font-sm text-light-muted">{{ apt.subject || '未填写科目' }}</text>
							</view>
						</view>
					</view>
				</card>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { mockAppointments, useMockData } from '@/utils/mockData.js'

export default {
	name: 'AppointmentCalendar',
	components: {
		card
	},
	data() {
		return {
			currentDate: new Date(),
			selectedDate: null,
			weekdays: ['日', '一', '二', '三', '四', '五', '六'],
			calendarDays: [],
			selectedAppointments: [],
			appointments: [],
			useMock: false,
			statusTextMap: {
				pending_payment: '待支付',
				pending_confirm: '待确认',
				confirmed: '已确认',
				in_progress: '进行中',
				completed: '已完成',
				cancelled: '已取消',
				rejected: '已拒绝'
			}
		}
	},
	computed: {
		currentMonth() {
			const date = this.currentDate
			return `${date.getFullYear()}年${date.getMonth() + 1}月`
		},
		selectedDateDisplay() {
			if (!this.selectedDate) return ''
			const [year, month, day] = this.selectedDate.split('-')
			return `${year}年${Number(month)}月${Number(day)}日`
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.generateCalendar()
		this.loadAppointments()
	},
	methods: {
		async refreshData() {
			await this.loadAppointments()
		},
		formatDateString(dateObj) {
			const year = dateObj.getFullYear()
			const month = String(dateObj.getMonth() + 1).padStart(2, '0')
			const day = String(dateObj.getDate()).padStart(2, '0')
			return `${year}-${month}-${day}`
		},
		generateCalendar() {
			const date = new Date(this.currentDate)
			const year = date.getFullYear()
			const month = date.getMonth()
			
			const firstDay = new Date(year, month, 1)
			const firstDayWeek = firstDay.getDay()
			
			const lastDay = new Date(year, month + 1, 0)
			const daysInMonth = lastDay.getDate()
			
			const prevMonthLastDay = new Date(year, month, 0)
			const prevMonthDays = prevMonthLastDay.getDate()
			
			const days = []
			const today = new Date()
			
			for (let i = firstDayWeek - 1; i >= 0; i--) {
				const prevDate = new Date(year, month, prevMonthDays - i)
				days.push({
					date: prevDate.getDate(),
					isCurrentMonth: false,
					isToday: today.toDateString() === prevDate.toDateString(),
					hasAppointment: false,
					fullDate: this.formatDateString(prevDate)
				})
			}
			
			for (let i = 1; i <= daysInMonth; i++) {
				const currentDay = new Date(year, month, i)
				const fullDate = this.formatDateString(currentDay)
				days.push({
					date: i,
					isCurrentMonth: true,
					isToday: today.toDateString() === currentDay.toDateString(),
					hasAppointment: false,
					fullDate: fullDate
				})
			}
			
			const remainingDays = 42 - days.length
			for (let i = 1; i <= remainingDays; i++) {
				const nextDate = new Date(year, month + 1, i)
				days.push({
					date: nextDate.getDate(),
					isCurrentMonth: false,
					isToday: today.toDateString() === nextDate.toDateString(),
					hasAppointment: false,
					fullDate: this.formatDateString(nextDate)
				})
			}
			
			if (!this.selectedDate) {
				const todayItem = days.find(d => d.isToday && d.isCurrentMonth)
				if (todayItem) {
					todayItem.isSelected = true
					this.selectedDate = todayItem.fullDate
				}
			} else {
				const selectedItem = days.find(d => d.fullDate === this.selectedDate)
				if (selectedItem) {
					selectedItem.isSelected = true
				}
			}
			
			this.calendarDays = days
		},
		changeMonth(offset) {
			const newDate = new Date(this.currentDate)
			newDate.setMonth(newDate.getMonth() + offset)
			this.currentDate = newDate
			this.selectedDate = null
			this.generateCalendar()
			this.loadAppointments()
		},
		async loadAppointments() {
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 300))
					this.appointments = mockAppointments.map(apt => ({
						...apt,
						appointment_date: apt.appointment_date || apt.date,
						appointment_time: apt.appointment_time || apt.start_time,
						student_display_name: apt.student_name || apt.student_info?.name || '学生',
						subject: apt.subject || apt.student_info?.subject || ''
					}))
					this.markCalendarAppointments()
					this.loadSelectedAppointments()
				} else {
					const userInfo = uni.getStorageSync('userInfo') || {}
					if (!userInfo.uid || userInfo.role !== 'teacher') {
						uni.showToast({ title: '请先以教师身份登录', icon: 'none' })
						return
					}
					const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
					const res = await appointmentQuery.getTeacherAppointments({ status: 'all' })
					if (res.code === 0) {
						const list = res.data.list || []
						this.appointments = list.map(item => ({
							...item,
							appointment_date: item.date || item.appointment_date,
							appointment_time: item.start_time || item.appointment_time,
							student_display_name: item.student_info?.name || item.student_name || '学生',
							subject: item.subject || item.student_info?.subject || '',
							status: item.status
						}))
						this.markCalendarAppointments()
						this.loadSelectedAppointments()
					} else {
						uni.showToast({ title: res.message || '获取预约失败', icon: 'none' })
					}
				}
			} catch (error) {
				console.error('加载失败:', error)
				uni.showToast({ title: '加载失败', icon: 'none' })
			}
		},
		markCalendarAppointments() {
			const appointmentDates = new Set(
				this.appointments
					.map(apt => apt.appointment_date)
					.filter(Boolean)
			)
			this.calendarDays = this.calendarDays.map(day => ({
				...day,
				hasAppointment: appointmentDates.has(day.fullDate)
			}))
		},
		selectDay(day) {
			if (!day.isCurrentMonth) return
			
			this.calendarDays.forEach(d => d.isSelected = false)
			day.isSelected = true
			
			this.selectedDate = day.fullDate
			this.loadSelectedAppointments()
		},
		loadSelectedAppointments() {
			if (!this.selectedDate) return
			const source = this.useMock ? mockAppointments : this.appointments
			this.selectedAppointments = source
				.filter(apt => {
					const aptDate = apt.appointment_date || apt.date
					return aptDate === this.selectedDate
				})
				.map(apt => ({
					_id: apt._id,
					appointment_time: apt.appointment_time || apt.start_time || '',
					subject: apt.subject || apt.student_info?.subject || '',
					student_name: apt.student_display_name || apt.student_info?.name || apt.student_name || '学生',
					status: apt.status
				}))
		},
		formatStatus(status) {
			return this.statusTextMap[status] || '未定义'
		},
		getStatusClass(status) {
			const map = {
				pending_payment: 'text-warning',
				pending_confirm: 'text-warning',
				confirmed: 'text-success',
				in_progress: 'text-success',
				completed: 'text-primary',
				cancelled: 'text-danger',
				rejected: 'text-danger'
			}
			return map[status] || ''
		}
	}
}
</script>

<style scoped>
.scroll {
	flex: 1;
	height: calc(100vh - 200rpx);
}

.day-cell {
	width: calc(100% / 7);
	height: 100rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border-radius: 8rpx;
	margin-bottom: 8rpx;
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