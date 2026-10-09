<!-- 家长端：我的优惠券。云对象 coupon-center.getAvailableCoupons -->
<template>
	<view class="page">
		<scroll-view
			scroll-y
			class="scroll"
			:refresher-enabled="true"
			:refresher-triggered="refresherTriggered"
			@refresherrefresh="onPullDownRefreshInternal"
		>
			<text class="form-tip">仅支持家长端预约课程支付时使用，满足门槛即可选择。</text>

			<view v-if="!loading && coupons.length === 0" class="empty">
				<text class="empty-title">{{ waitingIssue ? '优惠券正在到账' : '暂无可用优惠券' }}</text>
				<text class="empty-sub">{{ waitingIssue ? '请稍候或下拉刷新' : '可以通过好友邀请、活动发放等方式获得优惠券' }}</text>
			</view>

			<view
				v-for="item in coupons"
				:key="item._id"
				class="coupon"
			>
				<view class="coupon-amt">
					<text class="amount" v-if="item.type === 'amount'">¥{{ formatAmount(item.amount) }}</text>
					<text class="amount" v-else>{{ formatDiscount(item.discount) }}</text>
					<text class="label">{{ item.type === 'amount' ? '满减' : '折扣' }}</text>
				</view>
				<view class="coupon-body">
					<text class="name">{{ item.name || '优惠券' }}</text>
					<text class="desc">{{ item.min_spend && item.min_spend > 0 ? `满 ¥${formatAmount(item.min_spend)} 可用` : '无门槛' }}{{ item.description ? ` · ${item.description}` : '' }}</text>
					<text class="time">有效期至 {{ formatDate(item.valid_to) }}</text>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { ensureLoggedIn } from '@/utils/auth.js'
import { fetchAvailableCoupons, getCachedAvailableCoupons, getPendingIssuedCoupons } from '@/utils/coupons.js'

export default {
	name: 'MyCoupons',
	data() {
		return {
			coupons: [],
			loading: false,
			refresherTriggered: false,
			waitingIssue: false,
			_loadSeq: 0
		}
	},
	onShow() {
		if (!ensureLoggedIn('parent')) {
			return
		}
		const cached = getCachedAvailableCoupons('parent')
		if (cached.length) {
			this.coupons = cached
		}
		this.waitingIssue = !!getPendingIssuedCoupons()
		this.loadCoupons()
	},
	methods: {
		async refreshData() {
			await this.loadCoupons()
		},
		async onPullDownRefreshInternal() {
			this.refresherTriggered = true
			await this.loadCoupons()
			this.refresherTriggered = false
			uni.stopPullDownRefresh()
		},
		async loadCoupons() {
			const seq = ++this._loadSeq
			this.loading = true
			try {
				const { list, message, waiting } = await fetchAvailableCoupons('parent')
				if (seq !== this._loadSeq) return
				this.coupons = list
				this.waitingIssue = waiting && list.length === 0
				if (!list.length && message) {
					uni.showToast({
						title: message,
						icon: 'none'
					})
				}
			} catch (err) {
				console.error('加载优惠券失败:', err)
				if (seq !== this._loadSeq) return
				this.coupons = []
				uni.showToast({
					title: '加载优惠券失败',
					icon: 'none'
				})
			} finally {
				if (seq === this._loadSeq) {
					this.loading = false
				}
			}
		},
		formatAmount(n) {
			const v = Number(n || 0)
			return v.toFixed(2)
		},
		formatDiscount(d) {
			const v = Number(d || 0)
			if (!v) return '折扣券'
			return `${(v * 10).toFixed(1)} 折`
		},
		formatDate(ts) {
			if (!ts) return '--'
			try {
				const date = new Date(ts)
				const y = date.getFullYear()
				const m = String(date.getMonth() + 1).padStart(2, '0')
				const d = String(date.getDate()).padStart(2, '0')
				return `${y}-${m}-${d}`
			} catch (e) {
				return '--'
			}
		},
		defaultDesc(item) {
			if (item.type === 'amount') {
				return `下单立减¥${this.formatAmount(item.amount)}`
			}
			if (item.type === 'discount') {
				return `下单享受${this.formatDiscount(item.discount)}`
			}
			return '下单可用'
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
}

.scroll {
	height: 100vh;
}

.form-tip {
	display: block;
	padding: 20rpx 32rpx 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.empty {
	padding: 80rpx 32rpx;
	text-align: center;
}

.empty-title {
	display: block;
	font-size: 28rpx;
	color: #1F2329;
	margin-bottom: 8rpx;
}

.empty-sub {
	display: block;
	font-size: 24rpx;
	color: #8B919C;
}

.coupon {
	display: flex;
	margin: 24rpx 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	overflow: hidden;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.coupon-amt {
	width: 184rpx;
	background: #2563EB;
	color: #FFFFFF;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 24rpx 12rpx;
}

.amount {
	font-size: 40rpx;
	font-weight: 600;
	line-height: 1.2;
}

.label {
	margin-top: 8rpx;
	font-size: 22rpx;
	opacity: 0.85;
}

.coupon-body {
	flex: 1;
	min-width: 0;
	padding: 24rpx 28rpx;
}

.name {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.desc {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.45;
}

.time {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8B919C;
}
</style>
