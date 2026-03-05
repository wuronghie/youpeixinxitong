<template>
  <view class="payment-result-page">
    <view class="content">
      <image
        class="icon"
        :src="status === 'success' ? successIcon : failIcon"
        mode="aspectFit"
      />
      <text class="title">
        {{ status === 'success' ? '支付成功' : '支付失败' }}
      </text>
      <text class="message">
        {{ displayMessage }}
      </text>
    </view>

    <view class="footer">
      <button class="btn-main" @click="handleBack">
        返回商家
      </button>
    </view>
  </view>
</template>

<script>
export default {
  name: 'PaymentResult',
  data() {
    return {
      status: 'success', // success | fail
      message: '',
      returnPage: '',
      appointmentId: '',
      role: '', // parent | teacher
      successIcon: '/static/logo.png',
      failIcon: '/static/logo.png'
    }
  },
  onLoad(options = {}) {
    this.status = options.status === 'fail' ? 'fail' : 'success'
    this.message = options.message || ''
    this.returnPage = options.returnPage || ''
    this.appointmentId = options.appointmentId || ''
    this.role = options.role || 'parent'
  },
  computed: {
    displayMessage() {
      if (this.message) return this.message
      return this.status === 'success'
        ? '支付已完成，您可以返回继续浏览订单详情。'
        : '支付未完成，您可以返回重新发起支付或联系商家。'
    }
  },
  methods: {
    handleBack() {
      // 优先按 returnPage + appointmentId 跳转
      if (this.returnPage) {
        let url = this.returnPage
        if (this.appointmentId) {
          const connector = url.includes('?') ? '&' : '?'
          url = `${url}${connector}id=${this.appointmentId}`
        }
        uni.redirectTo({ url })
        return
      }

      // 兜底：根据角色返回默认详情页
      if (this.appointmentId) {
        if (this.role === 'teacher') {
          uni.redirectTo({
            url: `/pages-teacher/appointment/detail?id=${this.appointmentId}`
          })
        } else {
          uni.redirectTo({
            url: `/pages/appointment/detail?id=${this.appointmentId}`
          })
        }
      } else {
        // 再兜底：直接返回上一页
        uni.navigateBack({ delta: 1 })
      }
    }
  }
}
</script>

<style scoped>
.payment-result-page {
  min-height: 100vh;
  background-color: #f8f8f8;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.content {
  flex: 1;
  padding: 80rpx 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.icon {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 40rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}

.message {
  font-size: 26rpx;
  color: #888;
  text-align: center;
  line-height: 1.6;
}

.footer {
  padding: 20rpx 40rpx 40rpx;
}

.btn-main {
  width: 100%;
  background-color: #4a90e2;
  color: #fff;
  border-radius: 999rpx;
  font-size: 30rpx;
  padding: 20rpx 0;
}
</style>


