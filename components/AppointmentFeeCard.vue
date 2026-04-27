<template>
  <view class="fee-card">
    <text class="fee-card__title">费用信息</text>

    <view class="fee-card__row">
      <text class="fee-card__label">课程费用</text>
      <text class="fee-card__amount fee-card__amount--primary">¥{{ totalAmount }}</text>
    </view>

    <view v-if="showInfoFeePending" class="fee-card__row">
      <text class="fee-card__label">信息费</text>
      <text class="fee-card__amount fee-card__amount--warning">
        ¥{{ infoFeeAmount }}（需支付 · 一节试课 2 小时费用）
      </text>
    </view>

    <view v-else-if="appointment.deposit_paid" class="fee-card__row">
      <text class="fee-card__label">信息费</text>
      <text class="fee-card__amount fee-card__amount--success">¥{{ infoFeeAmount }}（已支付）</text>
    </view>

    <view v-if="isTrial" class="fee-card__notice fee-card__notice--warning">
      <text class="fee-card__notice-text">
        试课说明：平台收取一节试课完整费用作为中介费（仅该家长与您首次试课成功时收取），本单试课收入为 0；确认完成后会记录流水。
      </text>
    </view>

    <view v-if="isRegular" class="fee-card__notice fee-card__notice--info">
      <text class="fee-card__notice-text">
        正式课程说明：试课成功一次后平台不收费；若家长使用优惠券由平台承担，您将获得完整课程金额。家长确认完成后结算到钱包并生成收入流水。
      </text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  appointment: { type: Object, default: () => ({}) },
  infoFeeAmount: { type: [Number, String], default: 0 }
})

const totalAmount = computed(() => {
  const v = props.appointment.total_amount ?? props.appointment.total_fee
  return v != null ? v : 300
})

const showInfoFeePending = computed(() => {
  return props.appointment.status === 'pending_confirm' && !props.appointment.deposit_paid
})

const isTrial = computed(() => {
  const t = props.appointment.type || props.appointment.course_type
  return t === 'trial'
})

const isRegular = computed(() => {
  const t = props.appointment.type || props.appointment.course_type
  return t === 'regular'
})
</script>

<style scoped>
.fee-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.fee-card__title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
  display: block;
}

.fee-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1px solid #f3f4f6;
}

.fee-card__row:last-of-type {
  border-bottom: none;
}

.fee-card__label {
  font-size: 26rpx;
  color: #6b7280;
}

.fee-card__amount {
  font-size: 26rpx;
  text-align: right;
  font-weight: 500;
}

.fee-card__amount--primary {
  font-size: 32rpx;
  color: #2563eb;
  font-weight: 600;
}

.fee-card__amount--warning {
  color: #d97706;
}

.fee-card__amount--success {
  color: #16a34a;
}

.fee-card__notice {
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
}

.fee-card__notice--warning {
  background: #fef3c7;
}

.fee-card__notice--info {
  background: #dbeafe;
}

.fee-card__notice-text {
  font-size: 24rpx;
  color: #1f2937;
  line-height: 1.6;
}
</style>
