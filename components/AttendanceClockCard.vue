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
import { reverseGeocode } from '@/utils/reverseGeocode.js'

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
  return props.status === 'confirmed' || props.status === 'in_progress'
})

const canClockOut = computed(() => {
  if (!props.classStartedAt || props.classEndedAt) return false
  return props.parentPaid
})

const headerHint = computed(() => {
  if (props.classStartedAt && props.classEndedAt) return '已完成'
  if (props.classStartedAt) return '可下课打卡'
  if (!props.parentPaid) return '待家长支付试课费'
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

function resolveAddress(res) {
  if (!res || !res.address) return ''
  if (typeof res.address === 'string') return res.address
  return res.address.formatted_address || [
    res.address.province,
    res.address.city,
    res.address.district,
    res.address.street,
    res.address.street_number,
    res.address.poi_name
  ].filter(Boolean).join('')
}

async function resolveAddressByMap(latitude, longitude) {
  try {
    const info = await reverseGeocode(latitude, longitude)
    if (!info) return ''
    return info.address || [info.province, info.city, info.district].filter(Boolean).join('')
  } catch (e) {
    console.warn('[打卡定位] 逆地理编码失败:', e)
    return ''
  }
}

function locationErrorMessage(err) {
  const msg = String((err && (err.message || err.errMsg)) || '')
  if (!msg) return '获取定位失败，请重试'
  if (/auth deny|authorize|permission|隐私|权限/i.test(msg)) {
    return '需要开启小程序位置权限才能打卡'
  }
  if (/timeout/i.test(msg)) return '定位超时，请到开阔处重试'
  if (/system|GPS|location/i.test(msg) && /fail/i.test(msg)) {
    return '定位失败，请确认手机系统定位已开启'
  }
  return msg.length > 40 ? '获取定位失败，请重试' : msg
}

function ensureLocationPermission() {
  return new Promise((resolve) => {
    uni.getSetting({
      success: (setting) => {
        const authed = setting.authSetting && setting.authSetting['scope.userLocation']
        if (authed === true) {
          resolve(true)
          return
        }
        if (authed === false) {
          uni.showModal({
            title: '需要位置权限',
            content: '打卡需要获取当前位置。请在设置中开启位置权限后重试。',
            confirmText: '去设置',
            success: (modalRes) => {
              if (!modalRes.confirm) {
                resolve(false)
                return
              }
              uni.openSetting({
                success: (r) => resolve(!!(r.authSetting && r.authSetting['scope.userLocation'])),
                fail: () => resolve(false)
              })
            }
          })
          return
        }
        uni.authorize({
          scope: 'scope.userLocation',
          success: () => resolve(true),
          fail: () => {
            uni.showModal({
              title: '需要位置权限',
              content: '打卡需要获取当前位置。请在设置中开启位置权限后重试。',
              confirmText: '去设置',
              success: (modalRes) => {
                if (!modalRes.confirm) {
                  resolve(false)
                  return
                }
                uni.openSetting({
                  success: (r) => resolve(!!(r.authSetting && r.authSetting['scope.userLocation'])),
                  fail: () => resolve(false)
                })
              }
            })
          }
        })
      },
      fail: () => resolve(true)
    })
  })
}

function requestRawLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      // 微信小程序 geocode 无效；高精度在部分机型易超时，先普通定位
      isHighAccuracy: false,
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    })
  })
}

/**
 * 打卡定位：必须有经纬度；文字地址尽量解析，失败时用兜底文案，不阻断打卡
 */
async function getLocationForClock() {
  const ok = await ensureLocationPermission()
  if (!ok) {
    throw new Error('需要开启小程序位置权限才能打卡')
  }

  const res = await requestRawLocation()
  const latitude = Number(res.latitude)
  const longitude = Number(res.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('定位结果无效，请重试')
  }

  let address = resolveAddress(res)
  if (!address) {
    address = await resolveAddressByMap(latitude, longitude)
  }
  if (!address) {
    // 逆地理失败时仍允许打卡，后端只强依赖经纬度
    address = `已定位(${latitude.toFixed(5)},${longitude.toFixed(5)})`
    console.warn('[打卡定位] 文字地址解析失败，使用经纬度兜底')
  }

  return {
    latitude,
    longitude,
    address,
    accuracy: Number(res.accuracy) || 0
  }
}

async function callAttendance(method, payload) {
  const obj = uniCloud.importObject('appointment-attendance', { customUI: true })
  return await obj[method](payload)
}

async function onClockIn() {
  if (!canClockIn.value || loading.value) return
  loading.value = true
  pendingAction.value = 'in'
  try {
    const location = await getLocationForClock().catch((e) => {
      uni.showToast({ icon: 'none', title: locationErrorMessage(e) })
      return null
    })
    if (!location) {
      return
    }
    const res = await callAttendance('clockIn', {
      appointment_id: props.appointmentId,
      location
    })
    if (res && res.code === 0) {
      uni.showToast({ icon: 'success', title: '上课打卡成功' })
      emit('clocked', { type: 'in', data: res.data })
    } else {
      uni.showToast({ icon: 'none', title: (res && res.message) || '打卡失败' })
    }
  } catch (e) {
    uni.showToast({ icon: 'none', title: '打卡异常：' + locationErrorMessage(e) })
  } finally {
    loading.value = false
    pendingAction.value = ''
  }
}

async function onClockOut() {
  if (!canClockOut.value || loading.value) return
  loading.value = true
  pendingAction.value = 'out'
  try {
    const location = await getLocationForClock().catch((e) => {
      uni.showToast({ icon: 'none', title: locationErrorMessage(e) })
      return null
    })
    if (!location) {
      return
    }
    const res = await callAttendance('clockOut', {
      appointment_id: props.appointmentId,
      location
    })
    if (res && res.code === 0) {
      uni.showToast({ icon: 'success', title: '下课打卡成功' })
      emit('clocked', { type: 'out', data: res.data })
    } else {
      uni.showToast({ icon: 'none', title: (res && res.message) || '打卡失败' })
    }
  } catch (e) {
    uni.showToast({ icon: 'none', title: '打卡异常：' + locationErrorMessage(e) })
  } finally {
    loading.value = false
    pendingAction.value = ''
  }
}
</script>

<style>
.clock-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
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
  color: #1f2937;
}

.clock-card__hint {
  font-size: 24rpx;
  color: #6b7280;
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
  border-radius: 999rpx;
  font-size: 28rpx;
  border: none;
}

.clock-card__btn--primary {
  background: #2563eb;
  color: #fff;
}

.clock-card__btn--primary[disabled] {
  background: #93c5fd;
  color: #fff;
}

.clock-card__done {
  font-size: 26rpx;
  color: #10b981;
  text-align: center;
}
</style>
