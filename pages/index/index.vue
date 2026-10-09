<!--
 * 启动页：检测登录与角色后跳转。路由 pages/index/index
-->
<template>
	<view class="page">
		<view class="brand-block">
			<view class="logo-box">
				<image class="logo-image" :src="logoUrl" mode="aspectFit"></image>
			</view>
			<text class="brand-name">优培信息通</text>
			<text class="brand-sub">{{ loadingText }}</text>
		</view>
	</view>
</template>

<script>
import { getStoredUserInfo, redirectByRole, fetchRemoteUserInfo, clearStoredAuth, checkProfileComplete } from '@/utils/auth.js'
import { getLogoUrl } from '@/utils/imageConfig.js'

export default {
	name: 'Startup',
	data() {
		return {
			logoUrl: getLogoUrl(),
			loadingText: '正在加载，请稍候...',
			isBootstrapping: false,
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
	onLoad() {
		this.$nextTick(() => {
			setTimeout(() => {
				this.bootstrap()
			}, 300)
		})
	},
	async onShow() {
		if (this.isBootstrapping || this.hasBootstrapped) {
			return
		}
		setTimeout(() => {
			this.bootstrap()
		}, 300)
	},
	methods: {
		async bootstrap() {
			if (this.isBootstrapping || this.hasBootstrapped) {
				return
			}
			this.isBootstrapping = true

			const minDisplayTime = 1500
			const startTime = Date.now()

			try {
				const cachedInfo = getStoredUserInfo()
				const token = uni.getStorageSync('uni_id_token')

				if (token) {
					try {
						const freshInfo = await fetchRemoteUserInfo({ token })
						if (freshInfo && freshInfo.role) {
							await this.finishWithUser(freshInfo, startTime, minDisplayTime)
							return
						}
					} catch (error) {
						console.warn('自动登录失败，尝试使用本地信息', error)
						if (/token/.test(error.message || '')) {
							clearStoredAuth()
						}
					}
				}

				if (cachedInfo && cachedInfo.uid && cachedInfo.role) {
					await this.finishWithUser(cachedInfo, startTime, minDisplayTime)
					return
				}

				this.scheduleLogin(startTime, minDisplayTime)
			} catch (error) {
				console.error('启动失败:', error)
				this.scheduleLogin(startTime, minDisplayTime)
			} finally {
				this.isBootstrapping = false
			}
		},
		async finishWithUser(userInfo, startTime, minDisplayTime) {
			this.hasBootstrapped = true
			const profileCheck = await checkProfileComplete(userInfo)
			if (!profileCheck.isComplete) {
				uni.showModal({
					title: '提示',
					content: profileCheck.message,
					confirmText: '去完善',
					cancelText: '稍后',
					success: (res) => {
						setTimeout(() => {
							if (res.confirm) {
								uni.reLaunch({ url: profileCheck.redirectUrl || '/pages/common/register' })
							} else {
								redirectByRole(userInfo.role)
							}
						}, 100)
					}
				})
				return
			}
			const remaining = Math.max(0, minDisplayTime - (Date.now() - startTime))
			setTimeout(() => {
				redirectByRole(userInfo.role)
			}, remaining)
		},
		scheduleLogin(startTime, minDisplayTime) {
			this.hasBootstrapped = true
			const remaining = Math.max(0, minDisplayTime - (Date.now() - startTime))
			setTimeout(() => {
				this.goToLogin()
			}, remaining)
		},
		goToLogin() {
			this.loadingText = '正在进入登录页...'
			setTimeout(() => {
				uni.reLaunch({ url: '/pages/login/index' })
			}, 300)
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: linear-gradient(180deg, #EAF1FF 0%, #F4F6F9 38%, #F4F6F9 100%);
	display: flex;
	align-items: center;
	justify-content: center;
}

.brand-block {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding-bottom: 80rpx;
}

.logo-box {
	width: 128rpx;
	height: 128rpx;
	border-radius: 36rpx;
	background: #EEF3FF;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 32rpx;
	overflow: hidden;
}

.logo-image {
	width: 128rpx;
	height: 128rpx;
}

.brand-name {
	font-size: 48rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.3;
}

.brand-sub {
	margin-top: 16rpx;
	font-size: 26rpx;
	color: #5C6370;
}
</style>
