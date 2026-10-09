<!-- 兼容分享/旧链接：转发到分包教师详情 -->
<template>
	<view></view>
</template>
<script>
import { redirectWithQuery } from '@/utils/subpackageRedirect.js'
export default {
	onLoad(options) {
		redirectWithQuery('/pages-biz/teacher/detail', options)
	}
}
</script>
