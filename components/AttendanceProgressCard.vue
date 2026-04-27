<template>
  <view class="attendance-progress">
    <view class="attendance-progress__header">
      <text class="attendance-progress__title">老师打卡进度</text>
      <text class="attendance-progress__hint" :class="hintClass">{{ headerHint }}</text>
    </view>

    <view class="attendance-progress__steps">
      <!-- 上课打卡 -->
      <view class="attendance-progress__step" :class="{ 'is-done': !!classStartedAt, 'is-active': stage === 'in' }">
        <view class="attendance-progress__dot"></view>
        <view class="attendance-progress__step-body">
          <text class="attendance-progress__step-title">上课打卡</text>
          <text v-if="classStartedAt" class="attendance-progress__step-time">
            {{ formatTime(classStartedAt) }}
          </text>
          <text v-else class="attendance-progress__step-time attendance-progress__step-time--muted">
            由老师完成上课打卡
          </text>
          <text v-if="startedAddress" class="attendance-progress__step-addr">
            位置：{{ startedAddress }}
          </text>
        </view>
      </view>

      <view class="attendance-progress__line" :class="{ 'is-done': !!classEndedAt }"></view>

      <!-- 下课打卡 -->
      <view class="attendance-progress__step" :class="{ 'is-done': !!classEndedAt, 'is-active': stage === 'out' }">
        <view class="attendance-progress__dot"></view>
        <view class="attendance-progress__step-body">
          <text class="attendance-progress__step-title">下课打卡</text>
          <text v-if="classEndedAt" class="attendance-progress__step-time">
            {{ formatTime(classEndedAt) }}
          </text>
          <text v-else class="attendance-progress__step-time attendance-progress__step-time--muted">
            老师完成下课打卡后，您可确认结果
          </text>
          <text v-if="endedAddress" class="attendance-progress__step-addr">
            位置：{{ endedAddress }}
          </text>
        </view>
      </view>
    </view>

    <view v-if="durationText" class="attendance-progress__footer">
      <text class="attendance-progress__footer-text">{{ durationText }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  classStartedAt: {
    type: [Number, String, null],
    default: null
  },
  classStartedLocation: {
    type: Object,
    default: () => null
  },
  classEndedAt: {
    type: [Number, String, null],
    default: null
  },
  classEndedLocation: {
    type: Object,
    default: () => null
  },
  scheduleEndTs: {
    type: Number,
    default: 0
  }
})

const startedAddress = computed(() => (props.classStartedLocation && props.classStartedLocation.address) || '')
const endedAddress = computed(() => (props.classEndedLocation && props.classEndedLocation.address) || '')

const stage = computed(() => {
  if (!props.classStartedAt) return 'in'
  if (!props.classEndedAt) return 'out'
  return 'done'
})

const headerHint = computed(() => {
  if (props.classStartedAt && props.classEndedAt) return '已完成'
  if (props.classStartedAt) return '上课中'
  return '未打卡'
})

const hintClass = computed(() => {
  if (props.classStartedAt && props.classEndedAt) return 'is-success'
  if (props.classStartedAt) return 'is-progress'
  return 'is-pending'
})

const durationText = computed(() => {
  if (!props.classStartedAt || !props.classEndedAt) return ''
  const ms = Number(props.classEndedAt) - Number(props.classStartedAt)
  if (!ms || ms <= 0) return ''
  const minutes = Math.round(ms / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `本节实际上课时长：${h} 小时 ${m} 分钟`
  return `本节实际上课时长：${m} 分钟`
})

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(Number(ts))
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style>
.attendance-progress {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(15, 23, 42, 0.04);
}

.attendance-progress__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.attendance-progress__title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.attendance-progress__hint {
  font-size: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}

.attendance-progress__hint.is-success {
  background: #d1fae5;
  color: #047857;
}

.attendance-progress__hint.is-progress {
  background: #fef3c7;
  color: #b45309;
}

.attendance-progress__hint.is-pending {
  background: #f3f4f6;
  color: #6b7280;
}

.attendance-progress__steps {
  padding: 8rpx 0;
}

.attendance-progress__step {
  display: flex;
  align-items: flex-start;
  padding: 12rpx 0;
}

.attendance-progress__dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  background: #e5e7eb;
  margin-right: 20rpx;
  margin-top: 8rpx;
  flex-shrink: 0;
  border: 4rpx solid #fff;
  box-shadow: 0 0 0 4rpx #e5e7eb;
}

.attendance-progress__step.is-active .attendance-progress__dot {
  background: #f59e0b;
  box-shadow: 0 0 0 4rpx #fde68a;
}

.attendance-progress__step.is-done .attendance-progress__dot {
  background: #10b981;
  box-shadow: 0 0 0 4rpx #a7f3d0;
}

.attendance-progress__line {
  width: 4rpx;
  height: 32rpx;
  background: #e5e7eb;
  margin-left: 14rpx;
}

.attendance-progress__line.is-done {
  background: #10b981;
}

.attendance-progress__step-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.attendance-progress__step-title {
  font-size: 28rpx;
  color: #111827;
  font-weight: 500;
}

.attendance-progress__step-time {
  font-size: 24rpx;
  color: #374151;
  margin-top: 4rpx;
}

.attendance-progress__step-time--muted {
  color: #9ca3af;
}

.attendance-progress__step-addr {
  font-size: 22rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.attendance-progress__footer {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 2rpx dashed #e5e7eb;
}

.attendance-progress__footer-text {
  font-size: 24rpx;
  color: #6b7280;
}
</style>
