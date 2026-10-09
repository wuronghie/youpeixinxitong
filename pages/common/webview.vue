<!-- 公共：外链 WebView。无 url 时展示空态 -->
<template>
	<view class="page">
		<web-view v-if="url" :src="url"></web-view>
		<view v-else class="empty-wrap">
			<view class="section-card">
				<text class="empty-title">链接无效</text>
				<text class="empty-sub">无法打开该页面</text>
			</view>
		</view>
	</view>
</template>

<script>
export default {
	name: 'CommonWebview',
	data() {
		return {
			url: '',
			title: '网页浏览'
		}
	},
	onLoad(options = {}) {
		const title = options.title ? decodeURIComponent(options.title) : '网页浏览'
		const url = options.url ? decodeURIComponent(options.url) : ''
		this.title = title
		this.url = url
		uni.setNavigationBarTitle({ title })
	}
}
</script>

<style scoped>
.page {
	height: 100vh;
	background: #F4F6F9;
}

.empty-wrap {
	padding: 24rpx 32rpx;
}

.section-card {
	min-height: 720rpx;
	padding: 48rpx 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.empty-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.empty-sub {
	margin-top: 12rpx;
	font-size: 26rpx;
	color: #8B919C;
}
</style>
