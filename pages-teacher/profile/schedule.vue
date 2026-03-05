<template>
	<view style="background: #F5F5F5;">
		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 说明卡片 -->
				<view class="main-bg-color rounded px-3 py-3 mb-3 text-white">
					<text class="font-md font-weight d-block mb-2">设置每周可预约时间</text>
					<text class="font-sm d-block" style="opacity: 0.85;">点击时间段即可切换是否开放预约，保存后家长将以最新时间安排为准</text>
				</view>

				<!-- 每周时间安排 -->
				<card headTitle="每周时间安排" class="mb-3">
					<view
						v-for="day in weekSchedule"
						:key="day.dayIndex"
						class="mb-3 pb-3 border-bottom"
						:class="{ 'mb-0 pb-0 border-bottom-0': day.dayIndex === weekSchedule[weekSchedule.length - 1].dayIndex }"
					>
						<view class="d-flex a-center mb-2">
							<text class="font-md font-weight mr-2">{{ day.name }}</text>
							<text class="font-xs text-light-muted">{{ dayDescription(day.dayIndex) }}</text>
						</view>
						<view class="d-flex flex-wrap">
							<view
								v-for="slot in day.slots"
								:key="slot.id"
								class="rounded px-3 py-2 mr-2 mb-2 font-sm"
								:class="slot.is_available ? 'main-bg-color text-white' : 'bg-light-secondary'"
								@click="toggleSlot(day.dayIndex, slot.id)"
							>
								<text class="font-md font-weight d-block mb-1">{{ slot.start }} - {{ slot.end }}</text>
								<text class="font-xs d-block" style="opacity: 0.75;">{{ slot.is_available ? '开放预约' : '暂不开放' }}</text>
							</view>
						</view>
					</view>
				</card>

				<!-- 不可预约日期 -->
				<card headTitle="不可预约日期" class="mb-3">
					<view slot="right">
						<picker mode="date" @change="handleBlockedDateChange">
							<view class="main-text-color font-sm">+ 添加日期</view>
						</picker>
					</view>
					<view v-if="blockedDates.length" class="d-flex flex-wrap">
						<view v-for="(date, idx) in blockedDates" :key="date" class="bg-light-secondary rounded px-3 py-2 mr-2 mb-2 d-flex a-center">
							<text class="font-sm mr-2">{{ date }}</text>
							<text class="text-danger font-sm" @click="removeBlockedDate(idx)">×</text>
						</view>
					</view>
					<view v-else class="text-center text-light-muted font-sm py-3">当前没有设定不可预约日期</view>
				</card>
			</view>
		</scroll-view>

		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<button class="w-100 main-bg-color text-white rounded px-3 py-2 font-sm" :loading="saving" @click="saveSchedule">保存时间设置</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
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
	components: {
		card
	},
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
.scroll {
	flex: 1;
	height: calc(100vh - 200rpx);
	padding-bottom: 160rpx;
}
</style>