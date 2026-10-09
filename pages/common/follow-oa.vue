<!-- 家长/教师：关注服务号。utils/oaFollow.js、oaBind.js -->
<template>
	<view class="page">
		<view class="section-card">
			<text class="section-title">关注服务号，及时收通知</text>
			<text class="intro">预约、聊天、打卡等重要消息会通过服务号提醒，避免错过。</text>
		</view>

		<view class="form-card">
			<view class="form-row">
				<text class="form-label">服务号</text>
				<text class="form-val">{{ oaName || '服务号' }}</text>
			</view>
			<view class="form-row last">
				<text class="form-label">绑定状态</text>
				<text class="form-em" :class="{ ok: bound, warn: boundChecked && !bound }">{{ boundText }}</text>
			</view>
		</view>

		<view class="btn-wrap">
			<button class="btn-primary" :loading="opening" @click="onFollow">一键关注服务号</button>
			<button class="btn-ghost" :loading="syncing" @click="onSync">我已关注，刷新绑定</button>
		</view>

		<!-- 扫小程序码进入等场景下，原生关注组件可直接点关注 -->
		<!-- #ifdef MP-WEIXIN -->
		<view class="oa-wrap">
			<text class="oa-tip">若下方出现关注栏，可直接点击关注：</text>
			<official-account class="oa-comp" @load="onOaCompLoad" @error="onOaCompError"></official-account>
		</view>
		<!-- #endif -->

		<view class="section-card">
			<text class="section-title">关注后请确认</text>
			<text class="step">1. 使用登录小程序的同一微信关注</text>
			<text class="step">2. 关注后返回本页，点「刷新绑定」</text>
			<text class="step">3. 绑定成功后即可接收模板消息</text>
		</view>
	</view>
</template>

<script>
import { openOfficialAccountFollow, loadOaFollowMeta } from '@/utils/oaFollow.js'
import { syncOaBind } from '@/utils/oaBind.js'

export default {
	data() {
		return {
			oaName: '服务号',
			bound: false,
			bindReason: '',
			opening: false,
			syncing: false,
			boundChecked: false
		}
	},
	computed: {
		boundText() {
			if (!this.boundChecked) return '检测中…'
			if (this.bound) return '已绑定，可接收通知'
			if (this.bindReason === 'unsubscribed') return '已取消关注'
			return '未绑定，请先关注'
		}
	},
	onShow() {
		this.initMeta()
		this.refreshBind()
	},
	methods: {
		async initMeta() {
			const meta = await loadOaFollowMeta(true)
			this.oaName = meta.oaName || '服务号'
		},
		async refreshBind() {
			this.syncing = true
			try {
				const res = await syncOaBind({ force: true, minIntervalMs: 0 })
				this.bound = !!(res && res.code === 0 && res.data && res.data.bound)
				this.bindReason = (res && res.data && res.data.reason) || ''
			} catch (e) {
				this.bound = false
				this.bindReason = ''
			} finally {
				this.boundChecked = true
				this.syncing = false
			}
		},
		async onFollow() {
			if (this.opening) return
			this.opening = true
			try {
				await openOfficialAccountFollow()
			} finally {
				this.opening = false
			}
		},
		async onSync() {
			await this.refreshBind()
			uni.showToast({
				title: this.bound
					? '绑定成功'
					: (this.bindReason === 'unsubscribed' ? '已取消关注' : '尚未检测到关注'),
				icon: this.bound ? 'success' : 'none'
			})
		},
		onOaCompLoad() {
			console.log('[follow-oa] official-account load')
		},
		onOaCompError(e) {
			console.log('[follow-oa] official-account error', e)
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	padding: 24rpx 0 80rpx;
	background: #F4F6F9;
	box-sizing: border-box;
}

.section-card,
.form-card {
	margin: 0 32rpx 24rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.section-card {
	padding: 28rpx 32rpx;
}

.form-card {
	padding: 8rpx 32rpx 16rpx;
}

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.intro {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.6;
}

.form-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	min-height: 96rpx;
	padding: 16rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.form-row.last {
	border-bottom: none;
}

.form-label {
	flex-shrink: 0;
	font-size: 28rpx;
	color: #5C6370;
}

.form-val {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	color: #1F2329;
	font-weight: 500;
	text-align: right;
}

.form-em {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	color: #8B919C;
	text-align: right;
}

.form-em.ok {
	color: #07C160;
}

.form-em.warn {
	color: #C47A12;
}

.btn-wrap {
	padding: 8rpx 32rpx 0;
}

.btn-primary,
.btn-ghost {
	width: 100%;
	height: 88rpx;
	margin: 0;
	padding: 0;
	border: none;
	border-radius: 20rpx;
	font-size: 32rpx;
	font-weight: 600;
	line-height: 88rpx;
}

.btn-primary {
	background: #2563EB;
	color: #FFFFFF;
}

.btn-ghost {
	margin-top: 20rpx;
	background: #EEF3FF;
	color: #2563EB;
}

.btn-primary::after,
.btn-ghost::after {
	border: none;
}

.oa-wrap {
	margin: 32rpx 32rpx 24rpx;
}

.oa-tip {
	display: block;
	margin-bottom: 16rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.oa-comp {
	width: 100%;
	min-width: 300px;
}

.step {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.8;
}
</style>
