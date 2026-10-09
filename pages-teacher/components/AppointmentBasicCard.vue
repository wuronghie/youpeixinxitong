<template>
  <view class="basic-card">
    <view class="basic-card__section">
      <text class="basic-card__title">学生信息</text>
      <view class="basic-card__row">
        <text class="basic-card__label">学生姓名</text>
        <text class="basic-card__value">{{ studentName }}</text>
      </view>
      <view class="basic-card__row">
        <text class="basic-card__label">年级</text>
        <text class="basic-card__value">{{ studentGrade }}</text>
      </view>
      <view class="basic-card__row basic-card__row--last">
        <text class="basic-card__label">科目</text>
        <text class="basic-card__value">{{ studentSubject }}</text>
      </view>
    </view>

    <view class="basic-card__section">
      <text class="basic-card__title">预约信息</text>
      <view class="basic-card__row">
        <text class="basic-card__label">预约号</text>
        <text class="basic-card__value">{{ appointment.appointment_no || '--' }}</text>
      </view>
      <view class="basic-card__row">
        <text class="basic-card__label">课程类型</text>
        <text class="basic-card__value">{{ courseTypeText }}</text>
      </view>
      <view class="basic-card__row">
        <text class="basic-card__label">上课时间</text>
        <text class="basic-card__value">{{ scheduleTime || '--' }}</text>
      </view>
      <view class="basic-card__row">
        <text class="basic-card__label">课程时长</text>
        <text class="basic-card__value">{{ duration }}小时</text>
      </view>
      <view class="basic-card__row" :class="{ 'basic-card__row--last': !studentRequirement }">
        <text class="basic-card__label">上课地址</text>
        <text class="basic-card__value">{{ formattedAddress || '待确认' }}</text>
      </view>
      <view v-if="studentRequirement" class="basic-card__remark">
        <text class="basic-card__remark-title">辅导需求</text>
        <text class="basic-card__remark-body">{{ studentRequirement }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  appointment: { type: Object, default: () => ({}) }
})

const studentInfo = computed(() => props.appointment.student_info || {})
const studentName = computed(() => studentInfo.value.name || props.appointment.student_name || '学生')
const studentGrade = computed(() => studentInfo.value.grade || props.appointment.student_grade || '--')
const studentSubject = computed(() => studentInfo.value.subject || props.appointment.subject || '--')
const studentRequirement = computed(() => studentInfo.value.requirements || '')

const courseTypeText = computed(() => {
  const type = props.appointment.type || props.appointment.course_type
  return type === 'trial' ? '试课' : '正式课程'
})

const schedule = computed(() => props.appointment.schedule || {})
const scheduleTime = computed(() => {
  const date = schedule.value.date || props.appointment.appointment_date || ''
  const time = schedule.value.start_time || props.appointment.appointment_time || ''
  return [date, time].filter(Boolean).join(' ')
})

const duration = computed(() => schedule.value.duration || props.appointment.duration || 2)

const formattedAddress = computed(() => {
  const addr = props.appointment.address
  if (!addr) return ''
  if (typeof addr === 'string') return addr
  if (typeof addr === 'object') {
    const parts = [addr.province, addr.city, addr.district, addr.detail].filter(Boolean)
    return parts.join('') || addr.address || ''
  }
  return ''
})
</script>

<style scoped>
.basic-card {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin: 24rpx 32rpx 0;
}

.basic-card__section {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 8rpx 32rpx 12rpx;
  box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.basic-card__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1F2329;
  margin: 20rpx 0 4rpx;
  display: block;
}

.basic-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #EBEDF0;
}

.basic-card__row--last,
.basic-card__row:last-child {
  border-bottom: none;
}

.basic-card__label {
  font-size: 26rpx;
  color: #8B919C;
}

.basic-card__value {
  font-size: 26rpx;
  color: #1F2329;
  font-weight: 600;
  text-align: right;
  max-width: 60%;
}

.basic-card__remark {
  padding: 8rpx 0 20rpx;
}

.basic-card__remark-title {
  font-size: 26rpx;
  color: #8B919C;
  display: block;
  margin-bottom: 8rpx;
}

.basic-card__remark-body {
  font-size: 26rpx;
  color: #1F2329;
  line-height: 1.6;
  display: block;
}
</style>
