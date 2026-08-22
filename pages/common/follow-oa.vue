<template>
	<view class="page">
		<view class="hero">
			<text class="title">关注服务号，及时收通知</text>
			<text class="desc">预约、聊天、打卡等重要消息将通过服务号提醒你，避免错过。</text>
		</view>

		<view class="card">
			<view class="row">
				<text class="label">服务号</text>
				<text class="value">{{ oaName || '服务号' }}</text>
			</view>
			<view class="row">
				<text class="label">绑定状态</text>
				<text class="value" :class="bound ? 'ok' : 'warn'">{{ boundText }}</text>
			</view>
		</view>

		<button class="btn-primary" :loading="opening" @click="onFollow">一键关注服务号</button>
		<button class="btn-ghost" :loading="syncing" @click="onSync">我已关注，刷新绑定</button>

		<!-- 扫小程序码进入等场景下，原生关注组件可直接点关注 -->
		<!-- #ifdef MP-WEIXIN -->
		<view class="oa-wrap">
			<text class="oa-tip">若下方出现关注栏，可直接点击关注：</text>
			<official-account class="oa-comp" @load="onOaCompLoad" @error="onOaCompError"></official-account>
		</view>
		<!-- #endif -->

		<view class="steps">
			<text class="steps-title">关注后请确认</text>
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
			opening: false,
			syncing: false,
			boundChecked: false
		}
	},
	computed: {
		boundText() {
			if (!this.boundChecked) return '检测中…'
			return this.bound ? '已绑定，可接收通知' : '未绑定，请先关注'
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
			} catch (e) {
				this.bound = false
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
				title: this.bound ? '绑定成功' : '尚未检测到关注',
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
	padding: 40rpx 32rpx 80rpx;
	background: #f5f6fa;
	box-sizing: border-box;
}
.hero {
	margin-bottom: 32rpx;
}
.title {
	display: block;
	font-size: 40rpx;
	font-weight: 700;
	color: #1f2430;
	margin-bottom: 12rpx;
}
.desc {
	display: block;
	font-size: 26rpx;
	line-height: 1.6;
	color: #7a7f90;
}
.card {
	background: #fff;
	border-radius: 16rpx;
	padding: 8rpx 28rpx;
	margin-bottom: 32rpx;
}
.row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 0;
	border-bottom: 1rpx solid #eef0f5;
}
.row:last-child {
	border-bottom: none;
}
.label {
	font-size: 28rpx;
	color: #7a7f90;
}
.value {
	font-size: 28rpx;
	color: #1f2430;
	font-weight: 600;
}
.value.ok {
	color: #07c160;
}
.value.warn {
	color: #fa9d3b;
}
.btn-primary {
	background: #5a6ff0;
	color: #fff;
	border-radius: 12rpx;
	font-size: 30rpx;
	font-weight: 600;
	margin-bottom: 20rpx;
}
.btn-primary::after,
.btn-ghost::after {
	border: none;
}
.btn-ghost {
	background: #fff;
	color: #5a6ff0;
	border: 1rpx solid #5a6ff0;
	border-radius: 12rpx;
	font-size: 28rpx;
	margin-bottom: 40rpx;
}
.oa-wrap {
	margin-bottom: 40rpx;
}
.oa-tip {
	display: block;
	font-size: 24rpx;
	color: #9aa0b0;
	margin-bottom: 16rpx;
}
.oa-comp {
	width: 100%;
	min-width: 300px;
}
.steps {
	background: #fff;
	border-radius: 16rpx;
	padding: 28rpx;
}
.steps-title {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: #1f2430;
	margin-bottom: 16rpx;
}
.step {
	display: block;
	font-size: 26rpx;
	color: #7a7f90;
	line-height: 1.8;
}
</style>
