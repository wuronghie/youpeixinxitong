<template>
  <view class="tabbar">
    <view
      v-for="item in navItems"
      :key="item.key"
      class="tabbar-item"
      :class="{ active: item.key === current, 'tabbar-item-center': item.center }"
      @click="handleClick(item)"
    >
      <view v-if="item.center" class="center-entry">
        <view class="center-circle">
          <image
            :src="item.key === current ? item.activeIcon : item.icon"
            class="icon center-icon"
            mode="aspectFit"
          ></image>
        </view>
        <text class="label center-label">{{ item.label }}</text>
      </view>
      <template v-else>
        <view class="icon-wrap">
          <image
            :src="item.key === current ? item.activeIcon : item.icon"
            class="icon"
            mode="aspectFit"
          ></image>
          <view v-if="item.key === 'chat' && hasUnreadChat" class="red-dot"></view>
        </view>
        <text class="label">{{ item.label }}</text>
      </template>
    </view>
  </view>
</template>

<script>
import { getIconUrl } from '@/utils/imageConfig.js'

export default {
  name: 'TeacherTabBar',
  props: {
    current: {
      type: String,
      default: ''
    }
  },
		data() {
			return {
				navItems: [
					{
						key: 'dashboard',
						label: '工作台',
						icon: getIconUrl('dashboard.png'),
						activeIcon: getIconUrl('dashboard-active.png'),
						path: '/pages-teacher/index/index'
					},
					{
						key: 'appointment',
						label: '预约',
						icon: getIconUrl('calendar.png'),
						activeIcon: getIconUrl('calendar-active.png'),
						path: '/pages-teacher/appointment/list'
					},
					{
						key: 'recruitment',
						label: '招募',
						icon: getIconUrl('chat.png'),
						activeIcon: getIconUrl('chat-active.png'),
						path: '/pages-teacher/recruitment/list',
						center: true
					},
					{
						key: 'chat',
						label: '消息',
						icon: getIconUrl('chat.png'),
						activeIcon: getIconUrl('chat-active.png'),
						path: '/pages-teacher/chat/list'
					},
					{
						key: 'user',
						label: '我的',
						icon: getIconUrl('user.png'),
						activeIcon: getIconUrl('user-active.png'),
						path: '/pages-teacher/user/index'
					}
				],
				hasUnreadChat: false
			}
		},
  mounted() {
    this.loadUnreadChat()
  },
  methods: {
    async loadUnreadChat() {
      try {
        const chatSend = uniCloud.importObject('chat-send', { customUI: true })
        const res = await chatSend.getUnreadSummary()
        if (res.code === 0) {
          this.hasUnreadChat = Number(res.data?.unreadMessages || 0) > 0
        }
      } catch (e) {
        this.hasUnreadChat = false
      }
    },
    handleClick(item) {
      if (item.key === this.current) {
        return
      }
      // 使用 redirectTo 代替 reLaunch，避免关闭所有页面导致的超时
      // redirectTo 只关闭当前页面，性能更好，更适合 tabbar 切换
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const currentPath = '/' + currentPage.route
      
      // 如果目标页面已经在页面栈中，使用 switchTab（如果配置了）或 navigateBack + navigateTo
      // 否则使用 redirectTo
      if (currentPath === item.path) {
        return
      }
      
      // 延迟执行，避免同步调用导致的超时
      setTimeout(() => {
        uni.redirectTo({ 
          url: item.path,
          fail: (err) => {
            console.warn('redirectTo 失败，尝试使用 navigateTo:', err)
            // 如果 redirectTo 失败（比如目标页面不存在），尝试 navigateTo
            uni.navigateTo({ 
              url: item.path,
              fail: (navErr) => {
                console.error('页面导航失败:', navErr)
              }
            })
          }
        })
      }, 10)
    }
  }
}
</script>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 120rpx;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  background: #ffffff;
  display: flex;
  border-top: 1rpx solid #f0f1f5;
  box-shadow: 0 -8rpx 24rpx rgba(34, 40, 62, 0.08);
  z-index: 999;
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #7b8096;
  font-size: 22rpx;
  transition: all 0.2s ease;
}

.tabbar-item-center {
  position: relative;
}

.tabbar-item .icon {
  width: 32rpx;
  height: 32rpx;
  margin-bottom: 4rpx;
}

.icon-wrap {
  position: relative;
  width: 32rpx;
  height: 38rpx;
  margin-bottom: 4rpx;
}

.icon-wrap .icon {
  margin-bottom: 0;
}

.red-dot {
  position: absolute;
  top: -4rpx;
  right: -8rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #ff3b30;
  border: 2rpx solid #ffffff;
}

.tabbar-item.active {
  color: #ff8a5c;
  font-weight: 600;
}

.tabbar-item.active .icon {
  transform: scale(1.08);
  opacity: 1;
}

.center-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: translateY(-18rpx);
}

.center-circle {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: #ffffff;
  border: 1rpx solid #eef0f5;
  box-shadow: 0 8rpx 18rpx rgba(34, 40, 62, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.center-icon {
  width: 34rpx !important;
  height: 34rpx !important;
  margin-bottom: 0 !important;
}

.center-label {
  margin-top: 6rpx;
}
</style>


