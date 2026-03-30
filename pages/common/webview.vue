<template>
	<view class="webview-page">
		<web-view v-if="url" :src="url"></web-view>
		<view v-else class="empty-state">
			<text class="empty-text">链接无效，无法打开页面</text>
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
.webview-page {
	height: 100vh;
	background: #f5f5f5;
}

.empty-state {
	display: flex;
	align-items: center;
	justify-content: center;
	height: calc(100vh - 88rpx);
}

.empty-text {
	font-size: 28rpx;
	color: #999;
}
</style>
