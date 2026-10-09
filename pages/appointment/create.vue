<!-- 兼容旧链接：转发到分包创建预约 -->
<template>
	<view></view>
</template>
<script>
import { redirectWithQuery } from '@/utils/subpackageRedirect.js'
export default {
	onLoad(options) {
		redirectWithQuery('/pages-biz/appointment/create', options)
	}
}
</script>
