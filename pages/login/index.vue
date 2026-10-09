<!--
 * 页面名称：登录页
 * 路由路径：pages/login/index
 * 页面功能：
 *   1. 显示应用Logo和品牌信息
 *   2. 提供角色选择（家长/教师）
 *   3. 微信一键登录功能
 *   4. 登录成功后根据角色和资料完整性跳转
 *   5. 显示用户协议和隐私政策链接
 * 
 * 修改说明：
 *   - 修改角色选项：修改 data 中的 roleOptions 数组
 *   - 修改登录方式：修改 handleLogin() 方法，可添加其他登录方式（手机号、账号密码等）
 *   - 修改UI样式：修改 template 中的样式类和 style 中的样式
 *   - 添加登录方式：可以在角色选择下方添加更多登录方式按钮
-->
<template>
	<view class="login-page">
		<view class="login-inner">
			<view class="brand-block">
				<view class="logo-box">
					<image class="logo-image" :src="logoUrl" mode="aspectFit"></image>
				</view>
				<text class="brand-name">优培信息通</text>
				<text class="brand-sub">连接家长与专业教师</text>
			</view>

			<view
				v-for="role in roleOptions"
				:key="role.value"
				class="role-card"
				:class="{ on: selectedRole === role.value }"
				@click="selectRole(role.value)"
			>
				<image
					:src="getRoleIconUrl(role.iconName)"
					class="role-icon"
					mode="aspectFit"
				></image>
				<view class="role-copy">
					<text class="role-title">我是{{ role.label }}</text>
					<text class="role-desc">{{ role.desc }}</text>
				</view>
				<view v-if="selectedRole === role.value" class="iconfont icon-iconfontxuanzhong4 role-check"></view>
			</view>

			<view
				v-if="!canStartWxLogin"
				class="btn-login"
				:class="{ disabled: !selectedRole || isLogging }"
				@click="handleLogin"
			>
				<text v-if="isLogging">登录中...</text>
				<text v-else>微信一键登录</text>
			</view>
			<!-- #ifdef MP-WEIXIN -->
			<button
				v-if="canStartWxLogin"
				class="btn-login"
				open-type="getPhoneNumber"
				@getphonenumber="onWxLoginPhone"
			>微信一键登录</button>
			<!-- #endif -->

			<view class="btn-skip" @click="skipLogin">
				<text>先逛逛，暂不登录</text>
			</view>

			<view class="agreement-row">
				<checkbox-group @change="onAgreementChange">
					<label class="checkbox-wrap">
						<checkbox
							value="agree"
							:checked="hasAgreed"
							color="#2563EB"
							style="transform:scale(0.7);margin-right:8rpx;"
						/>
						<text class="agree-text">我已阅读并同意</text>
						<text class="agree-link" @click.stop="openAgreement('service')">《用户协议》</text>
						<text class="agree-text">和</text>
						<text class="agree-link" @click.stop="openAgreement('privacy')">《隐私政策》</text>
					</label>
				</checkbox-group>
			</view>

			<view class="icp-footer">
				<text class="icp-text">蜀ICP备2026004236号-1X</text>
			</view>
		</view>
	</view>
</template>

<script>
import { setStoredUserInfo, persistAuthToken, redirectByRole, fetchRemoteUserInfo, checkProfileComplete } from '@/utils/auth.js'
import { persistIssuedCoupons, prefetchAvailableCoupons } from '@/utils/coupons.js'
import { bindPushClientId } from '@/utils/chatPush.js'
import { getLogoUrl, getIconUrl } from '@/utils/imageConfig.js'
import { bindWeixinPhoneAndSync, bindWeixinPhoneByCode, refreshBoundPhone, persistPickedPhone } from '@/utils/wxPhone.js'

export default {
	name: 'Login',
	data() {
		return {
			// Logo图片URL（使用CDN）
			logoUrl: getLogoUrl(),
			// 当前选中的角色：'parent'（家长）或 'teacher'（教师）
			selectedRole: '',
			// 是否正在登录中，用于防止重复点击
			isLogging: false,
			// 是否已勾选同意用户协议和隐私政策
			hasAgreed: false,
			// 角色选项配置
			// 修改提示：可以在这里添加更多角色，如管理员、机构等
			roleOptions: [
				{
					value: 'parent',      // 角色值，对应后端数据库中的role字段
					label: '家长',        // 显示名称
					desc: '快速匹配合适教师',  // 角色描述
					iconName: 'family'        // 角色图标文件名（不含扩展名）
				},
				{
					value: 'teacher',
					label: '教师',
					desc: '获取更多预约',
					iconName: 'teacher-large'
				}
			]
		}
	},

	computed: {
		canStartWxLogin() {
			let mp = false
			// #ifdef MP-WEIXIN
			mp = true
			// #endif
			return mp && !uni.getStorageSync('pending_wx_phone_code') && !!this.selectedRole && this.hasAgreed && !this.isLogging
		}
	},

	/**
	 * 页面加载时触发
	 * 功能：恢复上次选择的角色，提升用户体验
	 */
	onLoad(options) {
		const lastRole = uni.getStorageSync('last_role')
		if (lastRole) {
			this.selectedRole = lastRole
		}
		// 如果通过带邀请码的分享链接进入，记录 pending_invite_code
		if (options && options.inviteCode) {
			uni.setStorageSync('pending_invite_code', options.inviteCode)
		}
	},
	onShareAppMessage() {
		return {
			title: '优培信息通登录',
			path: '/pages/login/index'
		}
	},
	onShareTimeline() {
		return {
			title: '优培信息通登录'
		}
	},

	methods: {
		/**
		 * 获取角色图标URL
		 * @param {String} iconName 图标文件名
		 * @returns {String} 图标完整URL
		 */
		getRoleIconUrl(iconName) {
			return getIconUrl(`${iconName}.png`)
		},
		/**
		 * 选择角色
		 * @param {String} role - 角色值：'parent' 或 'teacher'
		 */
		selectRole(role) {
			this.selectedRole = role
		},
		/**
		 * 协议勾选变化
		 */
		onAgreementChange(e) {
			// 只要选中包含 'agree'，就认为已同意
			const values = e.detail.value || []
			this.hasAgreed = values.includes('agree')
		},

		/**
		 * 处理登录逻辑
		 * 流程：
		 *   1. 检查是否已选择角色
		 *   2. 调用微信登录获取code
		 *   3. 调用云函数进行登录验证
		 *   4. 保存token和用户信息
		 *   5. 检查资料完整性并跳转
		 * 
		 * 修改提示：
		 *   - 可以在这里添加其他登录方式（手机号、账号密码等）
		 *   - 可以添加登录前的验证逻辑（如协议同意检查）
		 *   - 可以添加登录统计、埋点等
		 */
		async onWxLoginPhone(e) {
			await this.handleLogin(e)
		},
		async bindLoginPhone(phoneEvent) {
			const eventCode = phoneEvent && phoneEvent.detail && phoneEvent.detail.code
			const pendingCode = uni.getStorageSync('pending_wx_phone_code')
			const code = eventCode || pendingCode
			if (!code) return ''
			try {
				if (eventCode) {
					const phone = await bindWeixinPhoneAndSync(phoneEvent)
					if (pendingCode) uni.removeStorageSync('pending_wx_phone_code')
					return phone
				}
				await bindWeixinPhoneByCode(pendingCode)
				uni.removeStorageSync('pending_wx_phone_code')
				const phone = await refreshBoundPhone()
				if (phone) persistPickedPhone(phone)
				return phone
			} catch (error) {
				console.warn('[login] 绑定手机号失败:', error)
				uni.showToast({ title: (error && error.message) || '手机号授权失败，可稍后在资料里补齐', icon: 'none' })
				return ''
			}
		},
		async handleLogin(phoneEvent) {
			if (this.isLogging) {
				return
			}
			if (!this.selectedRole) {
				uni.showToast({ title: '请先选择身份', icon: 'none' })
				return
			}
			if (!this.hasAgreed) {
				uni.showToast({ title: '请先阅读并勾选同意《用户协议》和《隐私政策》', icon: 'none' })
				return
			}

			console.log('[login] 使用角色:', this.selectedRole)
			this.isLogging = true
			try {
				const loginRes = await new Promise((resolve, reject) => {
					uni.login({ provider: 'weixin', success: resolve, fail: reject })
				})
				console.log('[login] 获取到微信code:', loginRes.code)

				const userLogin = uniCloud.importObject('user-login', { customUI: true })
				const res = await userLogin.login({ code: loginRes.code, role: this.selectedRole })
				console.log('[login] 云函数返回:', res)

				if (res.code === 0) {
					let { token, tokenExpired, userInfo, issuedCount, issuedCoupons } = res.data
					persistAuthToken(token, tokenExpired)
					if (userInfo) {
						setStoredUserInfo(userInfo)
					}
					const boundPhone = await this.bindLoginPhone(phoneEvent)
					if (boundPhone) {
						userInfo = { ...(userInfo || {}), phone: boundPhone, mobile: boundPhone }
						setStoredUserInfo(userInfo)
					}
					uni.setStorageSync('last_role', this.selectedRole)
					if (issuedCount > 0) {
						persistIssuedCoupons({
							count: issuedCount,
							names: issuedCoupons || [],
							role: (userInfo && userInfo.role) || this.selectedRole
						})
					}
					bindPushClientId()
					if (issuedCount > 0) {
						uni.showToast({
							title: `登录成功，已发放${issuedCount}张优惠券`,
							icon: 'none',
							duration: 2500
						})
					} else {
						uni.showToast({ title: '登录成功', icon: 'success' })
					}
					try {
						// 优先获取最新的角色信息
						const freshInfo = await fetchRemoteUserInfo({ token })
						userInfo = freshInfo || userInfo
					} catch (fetchError) {
						console.warn('获取最新用户信息失败，使用登录返回的数据', fetchError)
					}
					if (userInfo && userInfo.role) {
						// 如有待处理的邀请码，并且当前为家长角色，则尝试绑定邀请关系
						if (userInfo.role === 'parent' || userInfo.role === 'teacher') {
							const pendingCode = uni.getStorageSync('pending_invite_code')
							if (pendingCode) {
								try {
									const inviteCenter = uniCloud.importObject('invite-center', { customUI: true })
									await inviteCenter.acceptInvite({ invite_code: pendingCode })
									uni.removeStorageSync('pending_invite_code')
									persistIssuedCoupons({
										count: (issuedCount || 0) + 1,
										names: issuedCoupons || [],
										role: userInfo.role
									})
								} catch (inviteErr) {
									console.error('[login] 处理邀请关系失败:', inviteErr)
								}
							}
						}

						// 检查信息是否完善
						const profileCheck = await checkProfileComplete(userInfo)
						console.log('[login] 信息检查结果:', profileCheck)
						
						// 无论信息是否完善，都先跳转到对应角色的首页
						// 首页会显示信息完善提示卡片
						prefetchAvailableCoupons(userInfo.role)
						redirectByRole(userInfo.role)
						
						// 如果信息不完善，延迟显示提示（让页面先加载）
						if (!profileCheck.isComplete) {
							setTimeout(() => {
							uni.showModal({
								title: '提示',
									content: profileCheck.message || '请完善您的资料信息',
								confirmText: '去完善',
								cancelText: '稍后',
								success: (res) => {
										if (res.confirm && profileCheck.redirectUrl) {
											uni.navigateTo({ url: profileCheck.redirectUrl })
									}
								}
							})
							}, 1000)
						}
					} else {
						uni.reLaunch({ url: '/pages/index/index' })
					}
				} else {
					uni.showToast({ title: res.message || '登录失败', icon: 'none' })
				}
			} catch (error) {
				console.error('登录失败:', error)
				uni.showToast({ title: '登录失败，请稍后再试', icon: 'none' })
			} finally {
				this.isLogging = false
			}
		},

		/**
		 * 打开协议页面
		 * @param {String} type - 协议类型：'service'（用户协议）或 'privacy'（隐私政策）
		 * 修改提示：如果协议页面不存在，可以改为打开外部链接或显示弹窗
		 */
		openAgreement(type) {
			const url = type === 'service' ? '/pages/common/agreement?type=service' : '/pages/common/agreement?type=privacy'
			uni.navigateTo({ url })
		},
		skipLogin() {
			uni.reLaunch({ url: '/pages/teacher/list' })
		}
	}
}
</script>

<style scoped>
.login-page {
	min-height: 100vh;
	background: linear-gradient(180deg, #EAF1FF 0%, #F4F6F9 38%, #F4F6F9 100%);
}

.login-inner {
	padding: 144rpx 48rpx 56rpx;
}

.brand-block {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: 56rpx;
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

.role-card {
	display: flex;
	align-items: center;
	padding: 28rpx;
	margin-bottom: 20rpx;
	background: #FFFFFF;
	border: 3rpx solid #EBEDF0;
	border-radius: 24rpx;
}

.role-card.on {
	border-color: #2563EB;
	background: #EEF3FF;
}

.role-icon {
	width: 80rpx;
	height: 80rpx;
	margin-right: 24rpx;
	flex-shrink: 0;
}

.role-copy {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.role-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.4;
}

.role-desc {
	margin-top: 4rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.role-check {
	color: #2563EB;
	font-size: 40rpx;
	margin-left: 12rpx;
}

.btn-login {
	margin-top: 36rpx;
	height: 88rpx;
	padding: 0;
	border: none;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 32rpx;
	font-weight: 600;
	line-height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.btn-login::after {
	border: none;
}

.btn-login.disabled {
	background: #D7DEEA;
	color: #8B919C;
}

.btn-skip {
	margin-top: 20rpx;
	height: 88rpx;
	border-radius: 20rpx;
	background: #EEF3FF;
	color: #2563EB;
	font-size: 32rpx;
	font-weight: 600;
	display: flex;
	align-items: center;
	justify-content: center;
}

.agreement-row {
	margin-top: 32rpx;
}

.checkbox-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
}

.agree-text {
	font-size: 24rpx;
	color: #8B919C;
}

.agree-link {
	font-size: 24rpx;
	color: #2563EB;
	margin: 0 4rpx;
}

.icp-footer {
	margin-top: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.icp-text {
	font-size: 22rpx;
	color: #B0B4BA;
}
</style>