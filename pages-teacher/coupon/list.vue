<template>
	<view class="page">
		<scroll-view scroll-y class="scroll" @refresherrefresh="onPullDownRefresh" :refresher-enabled="true" :refresher-triggered="refresherTriggered">
			<view class="px-3 py-3">
				<view class="tips-card mb-3">
					<text class="tips-title">我的优惠券</text>
					<text class="tips-desc">教师优惠券可在支付信息费时抵扣，满足使用门槛即可选择。</text>
				</view>

				<view v-if="!loading && coupons.length === 0" class="empty-box">
					<text class="empty-title">暂无可用优惠券</text>
					<text class="empty-sub">平台活动或后台发放后，会展示在这里</text>
				</view>

				<view v-else>
					<view
						v-for="item in coupons"
						:key="item._id"
						class="coupon-card"
					>
						<view class="coupon-left">
							<text class="amount" v-if="item.type === 'amount'">¥{{ formatAmount(item.amount) }}</text>
							<text class="amount" v-else>{{ formatDiscount(item.discount) }}</text>
							<text class="label">信息费券</text>
						</view>
						<view class="coupon-right">
							<text class="name">{{ item.name || '优惠券' }}</text>
							<text class="desc">{{ item.description || defaultDesc(item) }}</text>
							<view class="meta-row">
								<text class="meta-text">
									{{ item.min_spend && item.min_spend > 0 ? `满¥${formatAmount(item.min_spend)}可用` : '无门槛' }}
								</text>
							</view>
							<text class="time">有效期：{{ formatDate(item.valid_from) }} ~ {{ formatDate(item.valid_to) }}</text>
						</view>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { ensureLoggedIn } from '@/utils/auth.js'

export default {
	name: 'TeacherCoupons',
	data() {
		return {
			coupons: [],
			loading: false,
			refresherTriggered: false
		}
	},
	onShow() {
		if (!ensureLoggedIn('teacher')) {
			return
		}
		this.loadCoupons()
	},
	methods: {
		async onPullDownRefresh() {
			this.refresherTriggered = true
			await this.loadCoupons()
			this.refresherTriggered = false
			uni.stopPullDownRefresh()
		},
		async loadCoupons() {
			if (this.loading) return
			this.loading = true
			try {
				const couponCenter = uniCloud.importObject('coupon-center', { customUI: true })
				const res = await couponCenter.getAvailableCoupons({ role: 'teacher' })
				if (res.code === 0 && res.data && Array.isArray(res.data.list)) {
					this.coupons = res.data.list
				} else {
					this.coupons = []
					if (res && res.message) {
						uni.showToast({ title: res.message, icon: 'none' })
					}
				}
			} catch (err) {
				console.error('加载教师优惠券失败:', err)
				this.coupons = []
				uni.showToast({ title: '加载优惠券失败', icon: 'none' })
			} finally {
				this.loading = false
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
				return `支付信息费立减¥${this.formatAmount(item.amount)}`
			}
			if (item.type === 'discount') {
				return `支付信息费享受${this.formatDiscount(item.discount)}`
			}
			return '支付信息费可用'
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background-color: #f5f5f5;
}

.scroll {
	height: 100vh;
}

.tips-card {
	background: #fffbe8;
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
	border: 1rpx solid #ffe58f;
}

.tips-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #ad6800;
	margin-bottom: 8rpx;
	display: block;
}

.tips-desc {
	font-size: 24rpx;
	color: #ad6800;
	line-height: 1.5;
}

.empty-box {
	margin-top: 80rpx;
	padding: 0 24rpx;
	text-align: center;
	color: #999999;
}

.empty-title {
	display: block;
	font-size: 28rpx;
	margin-bottom: 8rpx;
}

.empty-sub {
	font-size: 24rpx;
}

.coupon-card {
	display: flex;
	flex-direction: row;
	background-color: #ffffff;
	border-radius: 16rpx;
	overflow: hidden;
	margin-bottom: 20rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.coupon-left {
	width: 200rpx;
	background: linear-gradient(135deg, #ff9f43, #ff6b01);
	color: #ffffff;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 20rpx 10rpx;
}

.amount {
	font-size: 40rpx;
	font-weight: 700;
	margin-bottom: 8rpx;
}

.label {
	font-size: 22rpx;
	opacity: 0.9;
}

.coupon-right {
	flex: 1;
	padding: 20rpx 24rpx;
	display: flex;
	flex-direction: column;
	justify-content: center;
}

.name {
	font-size: 30rpx;
	font-weight: 600;
	color: #333333;
	margin-bottom: 6rpx;
}

.desc {
	font-size: 24rpx;
	color: #666666;
	margin-bottom: 8rpx;
}

.meta-row {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin-bottom: 6rpx;
}

.meta-text {
	font-size: 22rpx;
	color: #999999;
}

.time {
	font-size: 22rpx;
	color: #bbbbbb;
}
</style>
