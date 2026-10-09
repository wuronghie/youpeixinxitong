<template>
  <view class="clock-card">
    <view class="clock-card__header">
      <text class="clock-card__title">课堂打卡</text>
      <text class="clock-card__hint">{{ headerHint }}</text>
    </view>

    <view class="clock-card__row">
      <view class="clock-card__step" :class="{ 'is-done': !!classStartedAt, 'is-active': canClockIn }">
        <view class="clock-card__step-dot"></view>
        <view class="clock-card__step-body">
          <text class="clock-card__step-title">上课打卡</text>
          <text v-if="classStartedAt" class="clock-card__step-time">
            {{ formatTime(classStartedAt) }}
          </text>
          <text v-else class="clock-card__step-time clock-card__step-time--muted">
            老师打卡后记录时间与位置
          </text>
          <text v-if="startedAddress" class="clock-card__step-addr">
            位置：{{ startedAddress }}
          </text>
        </view>
      </view>

      <view class="clock-card__line" :class="{ 'is-done': !!classEndedAt }"></view>

      <view class="clock-card__step" :class="{ 'is-done': !!classEndedAt, 'is-active': canClockOut }">
        <view class="clock-card__step-dot"></view>
        <view class="clock-card__step-body">
          <text class="clock-card__step-title">下课打卡</text>
          <text v-if="classEndedAt" class="clock-card__step-time">
            {{ formatTime(classEndedAt) }}
          </text>
          <text v-else class="clock-card__step-time clock-card__step-time--muted">
            完成上课打卡后可随时打卡
          </text>
          <text v-if="endedAddress" class="clock-card__step-addr">
            位置：{{ endedAddress }}
          </text>
        </view>
      </view>
    </view>

    <view class="clock-card__actions">
      <button
        v-if="!classStartedAt"
        class="clock-card__btn clock-card__btn--primary"
        :disabled="!canClockIn || loading"
        @click="onClockIn"
      >
        {{ loading && pendingAction === 'in' ? '上课打卡中...' : '上课打卡' }}
      </button>
      <button
        v-if="classStartedAt && !classEndedAt"
        class="clock-card__btn clock-card__btn--primary"
        :disabled="!canClockOut || loading"
        @click="onClockOut"
      >
        {{ loading && pendingAction === 'out' ? '下课打卡中...' : '下课打卡' }}
      </button>
      <text v-if="classStartedAt && classEndedAt" class="clock-card__done">
        ✔ 本节课打卡已完成，等待家长确认与评价
      </text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getLocationForClock, locationErrorMessage, cloudClockErrorMessage } from '@/pages-teacher/utils/clockLocation.js'

const props = defineProps({
  appointmentId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: ''
  },
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
  scheduleStartTs: {
    type: Number,
    default: 0
  },
  scheduleEndTs: {
    type: Number,
    default: 0
  },
  parentPaid: {
    type: Boolean,
    default: false
  },
  isTrial: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['clocked'])

const loading = ref(false)
const pendingAction = ref('')

const startedAddress = computed(() => formatLocationText(props.classStartedLocation))
const endedAddress = computed(() => formatLocationText(props.classEndedLocation))

const canClockIn = computed(() => {
  if (props.classStartedAt) return false
  if (!props.parentPaid) return false
  return props.status === 'confirmed' ||
    props.status === 'in_progress' ||
    props.status === 'pending_confirm' ||
    props.status === 'completed'
})

const canClockOut = computed(() => {
  if (!props.classStartedAt || props.classEndedAt) return false
  return props.parentPaid
})

const headerHint = computed(() => {
  if (props.classStartedAt && props.classEndedAt) return '已完成'
  if (props.classStartedAt) return '可下课打卡'
  if (!props.parentPaid) return props.isTrial ? '待家长支付试课费' : '待家长支付课程费'
  if (canClockIn.value) return '可上课打卡'
  return '暂不可打卡'
})

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(Number(ts))
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatLocationText(location) {
  if (!location) return ''
  return location.address || ''
}

async function callAttendance(method, payload) {
  const obj = uniCloud.importObject('appointment-attendance', { customUI: true })
  return await obj[method](payload)
}

async function runClock(action) {
  if (loading.value) return
  if (action === 'in' && !canClockIn.value) return
  if (action === 'out' && !canClockOut.value) return

  loading.value = true
  pendingAction.value = action
  try {
    const location = await getLocationForClock()
    const res = await callAttendance(action === 'in' ? 'clockIn' : 'clockOut', {
      appointment_id: props.appointmentId,
      location
    })
    if (res && res.code === 0) {
      uni.showToast({ icon: 'success', title: action === 'in' ? '上课打卡成功' : '下课打卡成功' })
      emit('clocked', { type: action, data: res.data })
    } else {
      uni.showToast({ icon: 'none', title: (res && res.message) || '打卡失败' })
    }
  } catch (e) {
    const locMsg = locationErrorMessage(e)
    const isLocation = /定位|位置|隐私|权限|GPS|timeout/i.test(locMsg) || /getLocation|getFuzzyLocation|privacy/i.test(String((e && (e.errMsg || e.message)) || ''))
    uni.showToast({
      icon: 'none',
      title: isLocation ? locMsg : ('打卡异常：' + cloudClockErrorMessage(e))
    })
  } finally {
    loading.value = false
    pendingAction.value = ''
  }
}

function onClockIn() {
  runClock('in')
}

function onClockOut() {
  runClock('out')
}
</script>

<style>
.clock-card {
  margin: 24rpx 32rpx 0;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.clock-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.clock-card__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1F2329;
}

.clock-card__hint {
  font-size: 24rpx;
  color: #8B919C;
}

.clock-card__row {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 8rpx 0 16rpx 0;
}

.clock-card__step {
  display: flex;
  align-items: flex-start;
  padding: 12rpx 0;
}

.clock-card__step-dot {
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

.clock-card__step.is-active .clock-card__step-dot {
  background: #f59e0b;
  box-shadow: 0 0 0 4rpx #fde68a;
}

.clock-card__step.is-done .clock-card__step-dot {
  background: #10b981;
  box-shadow: 0 0 0 4rpx #a7f3d0;
}

.clock-card__line {
  width: 4rpx;
  height: 32rpx;
  background: #e5e7eb;
  margin-left: 14rpx;
}

.clock-card__line.is-done {
  background: #10b981;
}

.clock-card__step-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.clock-card__step-title {
  font-size: 28rpx;
  color: #111827;
  font-weight: 500;
}

.clock-card__step-time {
  font-size: 24rpx;
  color: #374151;
  margin-top: 4rpx;
}

.clock-card__step-time--muted {
  color: #9ca3af;
}

.clock-card__step-addr {
  font-size: 22rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.clock-card__actions {
  margin-top: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clock-card__btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
}

.clock-card__btn::after {
  border: none;
}

.clock-card__btn--primary {
  background: #2563EB;
  color: #FFFFFF;
}

.clock-card__btn--primary[disabled] {
  background: #93B4FF;
  color: #FFFFFF;
}

.clock-card__done {
  font-size: 26rpx;
  color: #07C160;
  text-align: center;
}
</style>
