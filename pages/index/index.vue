<!--
 * 页面名称：启动页/首页
 * 路由路径：pages/index/index
 * 页面功能：
 *   1. 应用启动时的初始页面，显示加载动画和Logo
 *   2. 自动检测用户登录状态和角色
 *   3. 根据用户角色（家长/教师）自动跳转到对应的工作台
 *   4. 检查用户资料是否完善，未完善则引导去完善资料
 * 
 * 修改说明：
 *   - 修改Logo样式：修改 .logo-box 和 .logo-text 的样式
 *   - 修改加载文字：修改 data 中的 loadingText
 *   - 修改跳转逻辑：修改 bootstrap() 方法中的跳转逻辑
 *   - 添加启动动画：在 template 中添加更多动画类
-->
<template>
	<view class="startup-container d-flex flex-column a-center j-center" style="min-height: 100vh; background: #FFFFFF;">
		<!-- 启动页不需要位置栏，位置栏会在进入主要页面后显示 -->
		<!-- Logo区域 -->
		<view class="logo-box mb-4">
			<image class="logo-image" :src="logoUrl" mode="aspectFit"></image>
		</view>
		<!-- 应用名称 -->
		<view class="font-big mb-2">优培信息通</view>
		<!-- 加载提示文字 -->
		<view class="text-light-muted font mb-5">{{ loadingText }}</view>
	</view>
</template>

<script>
import { getStoredUserInfo, redirectByRole, fetchRemoteUserInfo, clearStoredAuth, checkProfileComplete } from '@/utils/auth.js'
import { getLogoUrl } from '@/utils/imageConfig.js'

export default {
	name: 'Startup',
	data() {
		return {
			// Logo图片URL（使用CDN）
			logoUrl: getLogoUrl(),
			// 加载提示文字，可根据不同状态修改
			loadingText: '正在加载，请稍候...',
			// 是否正在执行启动逻辑（防止重复执行）
			isBootstrapping: false,
			// 是否已经完成启动（防止重复跳转）
			hasBootstrapped: false
		}
	},
	onShareAppMessage() {
		return {
			title: '优培信息通',
			path: '/pages/index/index'
		}
	},
	onShareTimeline() {
		return {
			title: '优培信息通'
		}
	},
	/**
	 * 页面加载时触发
	 * 功能：确保页面渲染完成后再开始执行启动逻辑
	 */
	onLoad() {
		// 延迟执行，确保页面完全渲染
		this.$nextTick(() => {
			setTimeout(() => {
				this.bootstrap()
			}, 300)
		})
	},
	/**
	 * 页面显示时触发
	 * 功能：如果页面已经加载过，直接执行启动逻辑
	 */
	async onShow() {
		// 防止重复执行
		if (this.isBootstrapping || this.hasBootstrapped) {
			return
		}
		// 如果 onLoad 还没执行，延迟执行 bootstrap
		if (!this.isBootstrapping) {
			setTimeout(() => {
				this.bootstrap()
			}, 300)
		}
	},
	methods: {
		/**
		 * 启动引导方法
		 * 功能：
		 *   1. 检查是否有有效的登录token
		 *   2. 如果有token，尝试获取最新用户信息
		 *   3. 检查用户资料是否完善
		 *   4. 根据用户角色跳转到对应页面
		 *   5. 如果未登录，跳转到登录页（登录页可自行选择跳过）
		 */
		async bootstrap() {
			if (this.isBootstrapping || this.hasBootstrapped) {
				return
			}
			this.isBootstrapping = true
			
			// 确保加载页至少显示1.5秒，让用户看到加载动画
			const minDisplayTime = 1500
			const startTime = Date.now()
			
			try {
				const cachedInfo = getStoredUserInfo()
				const token = uni.getStorageSync('uni_id_token')

				if (token) {
					try {
						const freshInfo = await fetchRemoteUserInfo({ token })
						if (freshInfo && freshInfo.role) {
							// 检查信息是否完善
							const profileCheck = await checkProfileComplete(freshInfo)
							if (!profileCheck.isComplete) {
								this.hasBootstrapped = true
								uni.showModal({
									title: '提示',
									content: profileCheck.message,
									confirmText: '去完善',
									cancelText: '稍后',
									success: (res) => {
										// 延迟执行，避免在模态框回调中直接调用导致超时
										setTimeout(() => {
											if (res.confirm) {
												uni.reLaunch({ url: profileCheck.redirectUrl || '/pages/common/register' })
											} else {
												// 用户选择稍后，仍然跳转到对应页面
												redirectByRole(freshInfo.role)
											}
										}, 100)
									}
								})
								return
							} else {
								this.hasBootstrapped = true
								// 确保最小显示时间
								const elapsed = Date.now() - startTime
								const remaining = Math.max(0, minDisplayTime - elapsed)
								setTimeout(() => {
									redirectByRole(freshInfo.role)
								}, remaining)
								return
							}
						}
					} catch (error) {
						console.warn('自动登录失败，尝试使用本地信息', error)
						if (/token/.test(error.message || '')) {
							clearStoredAuth()
						}
					}
				}

				if (cachedInfo && cachedInfo.uid && cachedInfo.role) {
					// 检查信息是否完善
					const profileCheck = await checkProfileComplete(cachedInfo)
					if (!profileCheck.isComplete) {
						this.hasBootstrapped = true
						uni.showModal({
							title: '提示',
							content: profileCheck.message,
							confirmText: '去完善',
							cancelText: '稍后',
							success: (res) => {
								// 延迟执行，避免在模态框回调中直接调用导致超时
								setTimeout(() => {
									if (res.confirm) {
										uni.reLaunch({ url: profileCheck.redirectUrl || '/pages/common/register' })
									} else {
										// 用户选择稍后，仍然跳转到对应页面
										redirectByRole(cachedInfo.role)
									}
								}, 100)
							}
						})
					} else {
						this.hasBootstrapped = true
						// 确保最小显示时间
						const elapsed = Date.now() - startTime
						const remaining = Math.max(0, minDisplayTime - elapsed)
						setTimeout(() => {
							redirectByRole(cachedInfo.role)
						}, remaining)
					}
				} else {
					// 没有登录信息，进入登录页；登录页提供“先逛逛”入口，避免强制授权
					this.hasBootstrapped = true
					// 确保最小显示时间
					const elapsed = Date.now() - startTime
					const remaining = Math.max(0, minDisplayTime - elapsed)
					setTimeout(() => {
						this.goToLogin()
					}, remaining)
				}
			} catch (error) {
				console.error('启动失败:', error)
				// 出错时也要确保最小显示时间
				const elapsed = Date.now() - startTime
				const remaining = Math.max(0, minDisplayTime - elapsed)
				this.hasBootstrapped = true
				setTimeout(() => {
					this.goToLogin()
				}, remaining)
			} finally {
				this.isBootstrapping = false
			}
		},
		/**
		 * 跳转到登录页
		 * 修改提示：可以在这里添加登录前的其他逻辑，如统计、埋点等
		 */
		goToLogin() {
			this.loadingText = '正在进入登录页...'
			// 稍作延迟，让用户看到提示文字
			setTimeout(() => {
				uni.reLaunch({ url: '/pages/login/index' })
			}, 300)
		}
	}
}
</script>

<style scoped>

.logo-box {
	width: 160upx;
	height: 160upx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.logo-image {
	width: 160upx;
	height: 160upx;
	animation: logoFadeIn 0.8s ease-in-out;
}

.startup-container {
	animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}

@keyframes logoFadeIn {
	from {
		opacity: 0;
		transform: scale(0.8);
	}
	to {
		opacity: 1;
		transform: scale(1);
	}
}
</style>
