<template>
	<view class="page">
		<scroll-view scroll-y class="scroll">
			<text class="form-tip">每天固定 3 段：09:00–11:00 / 14:00–16:00 / 19:00–21:00，点击切换开放。</text>

			<view class="form-card">
				<view
					v-for="day in weekSchedule"
					:key="day.dayIndex"
					class="day-block"
				>
					<view class="day-head">
						<text class="day-name">{{ day.name }}</text>
						<text class="day-summary" :class="{ off: !dayOpenText(day) }">{{ dayOpenText(day) || '全关' }}</text>
					</view>
					<view class="slots">
						<text
							v-for="slot in day.slots"
							:key="slot.id"
							class="slot"
							:class="{ on: slot.is_available }"
							@click="toggleSlot(day.dayIndex, slot.id)"
						>{{ formatSlot(slot) }}</text>
					</view>
				</view>
			</view>

			<view class="section-card">
				<view class="section-head">
					<text class="section-title">不可预约日期</text>
					<picker mode="date" @change="handleBlockedDateChange">
						<text class="section-more">+ 添加日期</text>
					</picker>
				</view>
				<view v-if="blockedDates.length" class="tags">
					<view v-for="(date, idx) in blockedDates" :key="date" class="date-chip">
						<text>{{ date }}</text>
						<text class="date-x" @click="removeBlockedDate(idx)">×</text>
					</view>
				</view>
				<text v-else class="empty">当前没有设定不可预约日期</text>
			</view>
			<view class="scroll-spacer"></view>
		</scroll-view>

		<view class="action-bar">
			<button class="save-btn" :loading="saving" @click="saveSchedule">保存时间设置</button>
		</view>
	</view>
</template>

<script>
import { mockTeachers, useMockData } from '@/utils/mockData.js'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const DEFAULT_SLOTS = [
	{ id: 'slot1', start: '09:00', end: '11:00' },
	{ id: 'slot2', start: '14:00', end: '16:00' },
	{ id: 'slot3', start: '19:00', end: '21:00' }
]

function buildDefaultWeek() {
	return WEEK_ORDER.map((dayIdx, order) => ({
		dayIndex: dayIdx,
		order,
		name: DAY_NAMES[dayIdx],
		slots: DEFAULT_SLOTS.map(slot => ({
			id: slot.id,
			start: slot.start,
			end: slot.end,
			is_available: false
		}))
	}))
}

export default {
	name: 'TeacherSchedule',
	data() {
		return {
			weekSchedule: buildDefaultWeek(),
			blockedDates: [],
			useMock: false,
			loading: false,
			saving: false
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.loadSchedule()
	},
	methods: {
		formatSlot(slot) {
			const start = (slot.start || '').slice(0, 5)
			const end = (slot.end || '').slice(0, 5)
			return `${start.replace(':00', '')}–${end.replace(':00', '')}`
		},
		dayOpenText(day) {
			const open = (day.slots || []).filter(slot => slot.is_available)
			if (!open.length) return ''
			return open.map(slot => `${this.formatSlot(slot)} 开`).join(' / ')
		},
		dayDescription(dayIndex) {
			if (dayIndex === 0 || dayIndex === 6) return '建议全天可约'
			if (dayIndex === 5) return '可安排晚间课程'
			return '可根据课表灵活设置'
		},
		async loadSchedule() {
			if (this.loading) return
			this.loading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					this.weekSchedule = buildDefaultWeek()
					this.weekSchedule.forEach(day => {
						day.slots.forEach(slot => {
							slot.is_available = Math.random() > 0.4
						})
					})
					this.blockedDates = ['2025-01-02']
					return
				}

				const userInfo = uni.getStorageSync('userInfo') || {}
				if (!userInfo.uid || userInfo.role !== 'teacher') {
					uni.showToast({ title: '请先以教师身份登录', icon: 'none' })
					return
				}

				const scheduleObj = uniCloud.importObject('teacher-schedule', { customUI: true })
				const res = await scheduleObj.getSchedule()
				if (res.code === 0 && res.data) {
					this.applyScheduleData(res.data)
				} else {
					uni.showToast({ title: res.message || '加载失败', icon: 'none' })
				}
			} catch (error) {
				console.error('加载时间设置失败:', error)
				uni.showToast({ title: '加载失败，请稍后再试', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		applyScheduleData(data) {
			const weekMap = new Map()
			;(data.available_times || []).forEach(item => {
				if (typeof item.day_of_week === 'number' && item.time_slots) {
					weekMap.set(item.day_of_week, item.time_slots)
				}
			})

			this.weekSchedule = buildDefaultWeek().map(day => {
				const remoteSlots = weekMap.get(day.dayIndex)
				if (remoteSlots && remoteSlots.length) {
					const mapped = remoteSlots.map((slot, idx) => ({
						id: `slot${idx + 1}`,
						start: slot.start_time,
						end: slot.end_time,
						is_available: slot.is_available !== false
					}))
					return {
						...day,
						slots: mapped
					}
				}
				return day
			})

			this.blockedDates = Array.isArray(data.blocked_dates) ? data.blocked_dates : []
		},
		toggleSlot(dayIndex, slotId) {
			const day = this.weekSchedule.find(item => item.dayIndex === dayIndex)
			if (!day) return
			const slot = day.slots.find(item => item.id === slotId)
			if (!slot) return
			slot.is_available = !slot.is_available
		},
		handleBlockedDateChange(e) {
			const value = e.detail.value
			if (!value) return
			if (!this.blockedDates.includes(value)) {
				this.blockedDates.push(value)
			}
		},
		removeBlockedDate(index) {
			this.blockedDates.splice(index, 1)
		},
		buildPayload() {
			const available_times = this.weekSchedule.map(day => ({
				day_of_week: day.dayIndex,
				time_slots: day.slots.map(slot => ({
					start_time: slot.start,
					end_time: slot.end,
					is_available: slot.is_available
				}))
			}))

			return {
				available_times,
				blocked_dates: this.blockedDates,
				special_available_dates: []
			}
		},
		async saveSchedule() {
			if (this.saving) return
			try {
				if (this.useMock) {
					uni.showToast({ title: '保存成功 (模拟)', icon: 'success' })
					return
				}

				const payload = this.buildPayload()
				this.saving = true

				const scheduleObj = uniCloud.importObject('teacher-schedule', { customUI: true })
				const res = await scheduleObj.saveSchedule(payload)
				if (res.code === 0) {
					uni.showToast({ title: '保存成功', icon: 'success' })
					setTimeout(() => uni.navigateBack(), 1200)
				} else {
					uni.showToast({ title: res.message || '保存失败', icon: 'none' })
				}
			} catch (error) {
				console.error('保存时间设置失败:', error)
				uni.showToast({ title: '保存失败，请稍后再试', icon: 'none' })
			} finally {
				this.saving = false
			}
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
}

.scroll {
	height: calc(100vh - 140rpx);
}

.form-tip {
	display: block;
	padding: 20rpx 32rpx 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.form-card,
.section-card {
	margin: 0 32rpx 24rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.form-card {
	padding: 8rpx 32rpx 16rpx;
}

.section-card {
	padding: 28rpx 32rpx;
}

.day-block {
	padding: 20rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.day-block:last-child {
	border-bottom: none;
}

.day-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}

.day-name {
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.day-summary {
	flex: 1;
	text-align: right;
	font-size: 24rpx;
	color: #2563EB;
}

.day-summary.off {
	color: #8B919C;
}

.slots {
	display: flex;
	gap: 12rpx;
	margin-top: 16rpx;
}

.slot {
	flex: 1;
	height: 64rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	color: #8B919C;
	font-size: 24rpx;
	line-height: 64rpx;
	text-align: center;
}

.slot.on {
	background: #EEF3FF;
	color: #2563EB;
	font-weight: 600;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16rpx;
}

.section-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.section-more {
	font-size: 24rpx;
	color: #2563EB;
}

.tags {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.date-chip {
	display: flex;
	align-items: center;
	height: 56rpx;
	padding: 0 16rpx 0 20rpx;
	border-radius: 12rpx;
	background: #F4F6F9;
	font-size: 24rpx;
	color: #1F2329;
}

.date-x {
	margin-left: 12rpx;
	color: #FA5151;
	font-size: 28rpx;
	padding: 0 4rpx;
}

.empty {
	font-size: 24rpx;
	color: #8B919C;
}

.scroll-spacer {
	height: 40rpx;
}

.action-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
	background: #FFFFFF;
	border-top: 1rpx solid #EBEDF0;
}

.save-btn {
	height: 88rpx;
	border: none;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 32rpx;
	font-weight: 600;
	line-height: 88rpx;
}

.save-btn::after {
	border: none;
}
</style>