<!-- 兼容服务号/旧链接：转发到分包聊天页 -->
<template>
	<view></view>
</template>
<script>
import { redirectWithQuery } from '@/utils/subpackageRedirect.js'
export default {
	onLoad(options) {
		redirectWithQuery('/pages-biz/chat/conversation', options)
	}
}
</script>
