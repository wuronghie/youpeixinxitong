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
        ¥{{ infoFeeAmount }}（需支付 · 保证金，一节试课 2 小时费用）
      </text>
    </view>

    <view v-else-if="appointment.deposit_paid" class="fee-card__row">
      <text class="fee-card__label">信息费</text>
      <text class="fee-card__amount fee-card__amount--success">¥{{ infoFeeAmount }}（保证金，已支付）</text>
    </view>

    <view v-if="isTrial" class="fee-card__notice fee-card__notice--warning">
      <text class="fee-card__notice-text">
        试课流程：您须先支付信息费（保证金，= 课时费×2 小时）方可联系家长并发起邀请；家长接受邀请并支付试课费后安排上课。您完成下课打卡后，家长确认结果并完成结算：
        · 试课成功 → 家长支付的试课费 100% 结算到您的钱包；您已付信息费由平台收取；
        · 试课不满意 → 试课费 70% 给您、30% 退还给家长；您已付信息费退回给您。
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
  margin: 24rpx 32rpx 0;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.fee-card__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1F2329;
  margin-bottom: 8rpx;
  display: block;
}

.fee-card__row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #EBEDF0;
}

.fee-card__row:last-of-type {
  border-bottom: none;
}

.fee-card__label {
  flex-shrink: 0;
  font-size: 26rpx;
  color: #8B919C;
}

.fee-card__amount {
  flex: 1;
  font-size: 26rpx;
  text-align: right;
  font-weight: 600;
  color: #1F2329;
}

.fee-card__amount--primary {
  font-size: 32rpx;
  color: #1F2329;
}

.fee-card__amount--warning {
  color: #C47A12;
}

.fee-card__amount--success {
  color: #07C160;
}

.fee-card__notice {
  margin-top: 8rpx;
  padding: 20rpx;
  border-radius: 16rpx;
}

.fee-card__notice--warning {
  background: #FFF7ED;
}

.fee-card__notice--info {
  background: #EEF3FF;
}

.fee-card__notice-text {
  font-size: 24rpx;
  color: #5C6370;
  line-height: 1.6;
}
</style>
