/**
 * 下拉刷新防误触 Mixin - 最终版
 * 参考微信小程序最佳实践，完全手动控制下拉刷新
 * 只在滚动视图顶部时允许下拉刷新
 * 
 * 使用方法：
 * 1. 在组件中引入：import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
 * 2. 在 mixins 中添加：mixins: [pullRefreshMixin]
 * 3. 在 scroll-view 上添加：
 *    - scroll-y
 *    - @scroll="handleScroll"
 *    - @touchstart="handleTouchStart"
 *    - @touchmove="handleTouchMove"
 *    - @touchend="handleTouchEnd"
 *    - @touchcancel="handleTouchEnd"
 * 4. 在页面顶部添加刷新指示器：
 *    <view v-if="pullRefreshStatus !== 'none'" class="pull-refresh-indicator">
 *      {{ pullRefreshText }}
 *    </view>
 * 5. 实现 refreshData 方法（实际刷新逻辑）
 */
export default {
  data() {
    return {
      scrollTop: 0, // 当前滚动位置
      isAtTop: true, // 是否在顶部
      
      // 下拉刷新相关
      touchStartY: 0, // 触摸开始Y坐标
      touchCurrentY: 0, // 当前触摸Y坐标
      pullDistance: 0, // 下拉距离
      pullRefreshStatus: 'none', // 下拉状态: none, pulling, canRefresh, refreshing
      pullRefreshThreshold: 80, // 触发刷新的阈值(px)
      isRefreshing: false // 是否正在刷新
    }
  },
  
  computed: {
    pullRefreshText() {
      switch (this.pullRefreshStatus) {
        case 'pulling':
          return '下拉刷新'
        case 'canRefresh':
          return '松开刷新'
        case 'refreshing':
          return '刷新中...'
        default:
          return ''
      }
    },
    // 指示器的transform位置（跟随下拉距离）
    pullRefreshTransform() {
      if (this.pullRefreshStatus === 'none') {
        return 'translateY(-100%)'
      }
      // 下拉时跟随手指移动，最多移动到 pullDistance 的位置
      const distance = Math.min(this.pullDistance, 120) // 最多显示120rpx
      return `translateY(${distance - 80}rpx)` // 80rpx是指示器高度
    }
  },

  methods: {
    /**
     * 处理滚动事件 - 记录滚动位置
     */
    handleScroll(e) {
      const scrollTop = e.detail.scrollTop || 0
      this.scrollTop = scrollTop
      this.isAtTop = scrollTop === 0
      
      // 如果离开顶部，立即重置下拉状态
      if (scrollTop > 0 && this.pullRefreshStatus !== 'none') {
        this.pullRefreshStatus = 'none'
        this.pullDistance = 0
      }
    },

    /**
     * 处理触摸开始
     */
    handleTouchStart(e) {
      // 只有在顶部时才记录触摸
      if (this.scrollTop === 0 && !this.isRefreshing) {
        this.touchStartY = e.touches[0].pageY
        this.touchCurrentY = e.touches[0].pageY
        console.log('[pullRefresh] touchStart at top, Y =', this.touchStartY)
      }
    },

    /**
     * 处理触摸移动
     */
    handleTouchMove(e) {
      // 只有在顶部且未在刷新中才处理
      if (this.scrollTop !== 0 || this.isRefreshing) {
        return
      }

      // 必须有touchStart记录
      if (!this.touchStartY) {
        return
      }

      this.touchCurrentY = e.touches[0].pageY
      const deltaY = this.touchCurrentY - this.touchStartY

      // 只处理向下拉的情况
      if (deltaY > 0) {
        // 实时查询scrollTop，确保真的在顶部
        const query = uni.createSelectorQuery().in(this)
        query.select('.scroll-area').scrollOffset()
        query.exec((res) => {
          const scrollOffset = res && res[0] ? res[0] : null
          const realScrollTop = scrollOffset ? scrollOffset.scrollTop : this.scrollTop

          // 必须真的在顶部
          if (realScrollTop === 0) {
            this.pullDistance = deltaY
            
            // 更新下拉状态
            if (deltaY >= this.pullRefreshThreshold) {
              this.pullRefreshStatus = 'canRefresh'
            } else {
              this.pullRefreshStatus = 'pulling'
            }
            
            console.log('[pullRefresh] pulling: distance =', deltaY, 'status =', this.pullRefreshStatus)
          } else {
            console.log('[pullRefresh] not at top, realScrollTop =', realScrollTop)
          }
        })
      }
    },

    /**
     * 处理触摸结束
     */
    handleTouchEnd(e) {
      console.log('[pullRefresh] touchEnd: status =', this.pullRefreshStatus, 'distance =', this.pullDistance)
      
      // 如果满足刷新条件，触发刷新
      if (this.pullRefreshStatus === 'canRefresh' && !this.isRefreshing) {
        this._startRefresh()
      } else {
        // 重置状态
        this.pullRefreshStatus = 'none'
        this.pullDistance = 0
        this.touchStartY = 0
        this.touchCurrentY = 0
      }
    },

    /**
     * 开始刷新
     */
    async _startRefresh() {
      if (this.isRefreshing) {
        console.log('[pullRefresh] 已在刷新中')
        return
      }

      console.log('[pullRefresh] 开始刷新')
      this.pullRefreshStatus = 'refreshing'
      this.isRefreshing = true

      try {
        // 调用子组件实现的刷新方法
        if (typeof this.refreshData === 'function') {
          await this.refreshData()
        } else {
          console.warn('[pullRefresh] 未找到 refreshData 方法')
        }
      } catch (error) {
        console.error('[pullRefresh] 刷新失败:', error)
        uni.showToast({
          title: '刷新失败',
          icon: 'none'
        })
      } finally {
        
        // 延迟重置状态，确保动画流畅
        setTimeout(() => {
          this.pullRefreshStatus = 'none'
          this.pullDistance = 0
          this.isRefreshing = false
          this.touchStartY = 0
          this.touchCurrentY = 0
          console.log('[pullRefresh] 刷新完成')
        }, 300)
      }
    },

    /**
     * 手动重置刷新状态
     */
    resetRefreshState() {
      this.pullRefreshStatus = 'none'
      this.pullDistance = 0
      this.isRefreshing = false
      this.touchStartY = 0
      this.touchCurrentY = 0
    }
  }
}

