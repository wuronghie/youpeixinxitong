<template>
	<view class="page">
		<view class="cal-card">
			<view class="cal-nav">
				<view class="nav-btn" @click="changeMonth(-1)">‹</view>
				<text class="cal-month">{{ currentMonth }}</text>
				<view class="nav-btn" @click="changeMonth(1)">›</view>
			</view>
			<view class="legend">
				<view class="legend-item">
					<view class="legend-dot brand"></view>
					<text>有预约</text>
				</view>
				<view class="legend-item">
					<view class="legend-dot today"></view>
					<text>今天</text>
				</view>
				<view class="legend-item">
					<view class="legend-dot selected"></view>
					<text>已选中</text>
				</view>
			</view>
			<view class="week">
				<text v-for="day in weekdays" :key="day" class="week-cell">{{ day }}</text>
			</view>
			<view class="grid">
				<view
					v-for="(day, index) in calendarDays"
					:key="index"
					class="day"
					:class="{
						muted: !day.isCurrentMonth,
						today: day.isToday && !day.isSelected,
						on: day.isSelected,
						dot: day.hasAppointment
					}"
					@click="selectDay(day)"
				>
					<text class="day-num">{{ day.date }}</text>
					<view v-if="day.hasAppointment" class="apt-dot"></view>
				</view>
			</view>
		</view>

		<view class="list-head">
			<text class="list-title">{{ selectedDate ? selectedDateDisplay : '请选择一个日期' }}</text>
			<text v-if="selectedAppointments.length" class="list-count">共 {{ selectedAppointments.length }} 个预约</text>
		</view>

		<view v-if="selectedAppointments.length === 0" class="empty">
			<text class="empty-title">{{ selectedDate ? '当天暂时没有预约安排' : '选择一个日期查看课程安排' }}</text>
		</view>

		<view
			v-for="apt in selectedAppointments"
			:key="apt._id"
			class="a-card"
		>
			<view class="a-head">
				<view class="a-head-main">
					<text class="a-name">{{ apt.student_name || '学生' }} · {{ apt.subject || '未填写科目' }}</text>
					<text class="a-time">{{ apt.appointment_time || '--:--' }}</text>
				</view>
				<text class="status" :class="getStatusClass(apt.status)">{{ formatStatus(apt.status) }}</text>
			</view>
		</view>
	</view>
</template>

<script>
import { mockAppointments, useMockData } from '@/utils/mockData.js'

export default {
	name: 'AppointmentCalendar',
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
				pending_payment: 's-pay',
				pending_confirm: 's-wait',
				confirmed: 's-ing',
				in_progress: 's-ing',
				completed: 's-done',
				cancelled: 's-muted',
				rejected: 's-muted'
			}
			return map[status] || 's-muted'
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
	padding: 24rpx 32rpx 48rpx;
}

.cal-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	padding: 28rpx 20rpx 16rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.cal-nav {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 8rpx 20rpx;
}

.nav-btn {
	width: 64rpx;
	height: 64rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	color: #1F2329;
	font-size: 36rpx;
	line-height: 64rpx;
	text-align: center;
}

.cal-month {
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
}

.legend {
	display: flex;
	align-items: center;
	gap: 24rpx;
	padding: 0 8rpx 20rpx;
}

.legend-item {
	display: flex;
	align-items: center;
	font-size: 22rpx;
	color: #8B919C;
}

.legend-dot {
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
	margin-right: 8rpx;
}

.legend-dot.brand {
	background: #2563EB;
}

.legend-dot.today {
	background: #FA9D3B;
}

.legend-dot.selected {
	background: #FFFFFF;
	box-shadow: 0 0 0 2rpx #2563EB;
}

.week,
.grid {
	display: flex;
	flex-wrap: wrap;
}

.week-cell,
.day {
	width: 14.2857%;
	text-align: center;
}

.week-cell {
	font-size: 22rpx;
	color: #8B919C;
	padding: 8rpx 0 12rpx;
}

.day {
	height: 88rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border-radius: 16rpx;
	position: relative;
}

.day-num {
	font-size: 28rpx;
	color: #1F2329;
	line-height: 1.2;
}

.day.muted .day-num {
	color: #C5C8CE;
}

.day.today {
	background: #FFF4E5;
}

.day.today .day-num {
	color: #C47A12;
}

.day.on {
	background: #2563EB;
}

.day.on .day-num {
	color: #FFFFFF;
}

.apt-dot {
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #2563EB;
	margin-top: 6rpx;
}

.day.on .apt-dot {
	background: #FFFFFF;
}

.day.muted .apt-dot {
	background: #C5C8CE;
}

.list-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 32rpx 8rpx 16rpx;
}

.list-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.list-count {
	font-size: 24rpx;
	color: #8B919C;
}

.empty {
	padding: 48rpx 24rpx;
	text-align: center;
}

.empty-title {
	font-size: 26rpx;
	color: #8B919C;
}

.a-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	padding: 28rpx 32rpx;
	margin-bottom: 24rpx;
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
</style>
