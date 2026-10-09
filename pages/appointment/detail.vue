<!-- 兼容服务号/旧链接：转发到分包预约详情 -->
<template>
	<view></view>
</template>
<script>
import { redirectWithQuery } from '@/utils/subpackageRedirect.js'
export default {
	onLoad(options) {
		redirectWithQuery('/pages-biz/appointment/detail', options)
	}
}
</script>
