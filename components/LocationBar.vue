<template>
	<view class="location-bar" @click="handleLocationClick">
		<view class="location-content">
			<view class="icon-location"></view>
			<text class="location-text">{{ locationText }}</text>
			<view class="icon-arrow-down" :class="{ 'rotating': loading }"></view>
		</view>
	</view>
</template>

<script>
import { getCurrentLocation, requestLocationPermission, parseAddress, chooseLocation } from '@/utils/location.js'
import { reverseGeocode } from '@/utils/reverseGeocode.js'

export default {
	name: 'LocationBar',
	data() {
		return {
			loading: false,
			location: null,
			locationText: '定位中...'
		}
	},
	mounted() {
		this.loadLocation()
	},
	onShow() {
		// 页面显示时重新加载位置（如果位置信息过期）
		this.loadLocation()
	},
	methods: {
		/**
		 * 加载位置信息
		 */
		async loadLocation() {
			// 先从缓存读取
			const cachedLocation = uni.getStorageSync('currentLocation')
			console.log('[LocationBar] 从缓存读取位置:', cachedLocation)
			if (cachedLocation) {
				this.location = cachedLocation
				this.updateLocationText()
			} else {
				// 如果缓存中没有，先显示"定位中..."
				this.locationText = '定位中...'
			}

			// 尝试获取最新位置（但不强制，避免频繁请求）
			// 如果已经有缓存位置，延迟一点再获取最新位置
			if (cachedLocation) {
				setTimeout(() => {
					this.getLocation()
				}, 500)
			} else {
				await this.getLocation()
			}
		},
		/**
		 * 获取当前位置
		 */
		async getLocation() {
			if (this.loading) return
			
			this.loading = true
			try {
				// 请求权限
				const hasPermission = await requestLocationPermission()
				if (!hasPermission) {
					this.locationText = '定位失败'
					this.loading = false
					return
				}

				// 获取位置
				const location = await getCurrentLocation({
					highAccuracy: false, // 使用普通精度，更快
					timeout: 5000
				})

				console.log('[LocationBar] 获取到位置数据:', location)
				
				// 如果uni.getLocation没有返回地址信息，使用腾讯地图API逆地理编码获取
				let locationData = {
					latitude: location.latitude,
					longitude: location.longitude,
					address: location.address || '',
					city: location.city || '',
					province: location.province || '',
					district: location.district || '',
					speed: location.speed || 0,
					accuracy: location.accuracy || 0
				}
				
				// 如果没有地址信息，调用逆地理编码API
				if ((!locationData.city && !locationData.address) && locationData.latitude && locationData.longitude) {
					try {
						console.log('[LocationBar] 调用逆地理编码API获取地址信息...')
						const addressInfo = await reverseGeocode(
							parseFloat(locationData.latitude),
							parseFloat(locationData.longitude)
						)
						
						// 合并地址信息（API返回的信息优先级更高）
						locationData = {
							...locationData,
							city: addressInfo.city || locationData.city || '',
							province: addressInfo.province || locationData.province || '',
							district: addressInfo.district || locationData.district || '',
							address: addressInfo.address || locationData.address || ''
						}
						
						console.log('[LocationBar] 逆地理编码结果:', locationData)
					} catch (error) {
						console.error('[LocationBar] 逆地理编码失败:', error)
						// 逆地理编码失败不影响定位，继续使用原有数据
					}
				}
				
				this.location = locationData
				uni.setStorageSync('currentLocation', locationData)
				
				console.log('[LocationBar] 保存的位置数据:', locationData)
				
				// 更新显示文本
				this.updateLocationText()
			} catch (error) {
				console.error('[位置栏] 获取位置失败:', error)
				
				// 如果获取失败，尝试使用缓存
				const cachedLocation = uni.getStorageSync('currentLocation')
				if (cachedLocation) {
					this.location = cachedLocation
					this.updateLocationText()
				} else {
					this.locationText = '定位失败'
				}
			} finally {
				this.loading = false
			}
		},
		/**
		 * 更新位置显示文本
		 */
		updateLocationText() {
			if (!this.location) {
				this.locationText = '定位中...'
				return
			}

			// 优先使用直接的城市字段（如果 uni.getLocation 返回了 city）
			if (this.location.city && this.location.city.trim()) {
				this.locationText = this.location.city.replace(/市$/, '')
				return
			}

			// 如果有地址信息，解析并显示城市
			if (this.location.address && this.location.address.trim()) {
				// 解析地址，提取城市
				const addressInfo = parseAddress(this.location.address)
				
				// 优先显示城市（移除"市"字）
				if (addressInfo.city) {
					this.locationText = addressInfo.city.replace(/市$/, '')
				} else if (addressInfo.district) {
					// 如果没有城市，显示区（移除"区"或"县"字）
					this.locationText = addressInfo.district.replace(/区$|县$/, '')
				} else if (this.location.address) {
					// 如果解析失败，尝试从地址中提取城市信息
					// 常见的地址格式：省+市+区+详细地址
					const cityMatch = this.location.address.match(/(.+?市)/)
					if (cityMatch) {
						this.locationText = cityMatch[1].replace(/市$/, '')
					} else {
						// 如果还是提取不到，使用地址的前部分（最多10个字符）
						const addrText = this.location.address.trim()
						if (addrText.length > 10) {
							this.locationText = addrText.substring(0, 10) + '...'
						} else {
							this.locationText = addrText
						}
					}
				} else {
					this.locationText = '定位失败'
				}
			} else if (this.location.latitude && this.location.longitude) {
				// 如果只有经纬度，没有地址，尝试从缓存中获取之前的地址
				const cachedLocation = uni.getStorageSync('currentLocation')
				if (cachedLocation) {
					// 优先使用缓存中的 city 字段
					if (cachedLocation.city && cachedLocation.city.trim()) {
						this.locationText = cachedLocation.city.replace(/市$/, '')
						return
					}
					if (cachedLocation.address && cachedLocation.address.trim()) {
						const addressInfo = parseAddress(cachedLocation.address)
						// 优先显示城市
						if (addressInfo.city) {
							this.locationText = addressInfo.city.replace(/市$/, '')
							return
						} else if (addressInfo.district) {
							this.locationText = addressInfo.district.replace(/区$|县$/, '')
							return
						} else {
							// 如果缓存中也没有可解析的地址，尝试从地址字符串中提取
							const cityMatch = cachedLocation.address.match(/(.+?市)/)
							if (cityMatch) {
								this.locationText = cityMatch[1].replace(/市$/, '')
								return
							}
						}
					}
				}
				// 如果都没有，但有经纬度，显示"定位成功"
				// 正常情况下，应该已经通过逆地理编码API获取到城市名称了
				// 如果没有，可能是API调用失败或网络问题
				this.locationText = '定位成功'
			} else {
				this.locationText = '定位失败'
			}
		},
		/**
		 * 点击位置栏
		 */
		async handleLocationClick() {
			// 如果已经有位置但缺少地址信息，尝试使用chooseLocation获取
			if (this.location && this.location.latitude && this.location.longitude && !this.location.city && !this.location.address) {
				try {
					const hasPermission = await requestLocationPermission()
					if (!hasPermission) {
						uni.showToast({
							title: '需要位置权限',
							icon: 'none'
						})
						return
					}

					// 使用chooseLocation可以获取到完整的地址信息（包括city字段）
					const location = await chooseLocation({
						latitude: parseFloat(this.location.latitude),
						longitude: parseFloat(this.location.longitude)
					})

					// 更新位置信息，包含城市信息
					const locationData = {
						latitude: location.latitude.toString(),
						longitude: location.longitude.toString(),
						address: location.address || '',
						city: location.city || '',
						province: location.province || '',
						district: location.district || '',
						speed: this.location.speed || 0,
						accuracy: this.location.accuracy || 0
					}

					this.location = locationData
					uni.setStorageSync('currentLocation', locationData)
					
					console.log('[LocationBar] 通过chooseLocation获取到地址信息:', locationData)
					
					// 更新显示文本
					this.updateLocationText()
				} catch (error) {
					if (error.message && !error.message.includes('取消')) {
						console.error('[LocationBar] 选择位置失败:', error)
						// 如果用户取消或失败，继续使用原来的位置
						this.getLocation()
					}
				}
			} else {
				// 重新定位
				this.getLocation()
			}
		}
	}
}
</script>

<style scoped>
.location-bar {
	flex-shrink: 0;
}

.location-content {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	padding: 4rpx 12rpx;
	border-radius: 30rpx;
	background-color: #F5F5F5;
}

.icon-location {
	width: 28rpx;
	height: 28rpx;
	background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234A90E2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>');
	background-size: contain;
	background-repeat: no-repeat;
	background-position: center;
	margin-right: 6rpx;
}

.location-text {
	font-size: 24rpx;
	font-weight: 500;
	color: #333;
	white-space: nowrap;
}

.icon-arrow-down {
	width: 20rpx;
	height: 20rpx;
	margin-left: 6rpx;
	transition: transform 0.3s;
	background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"><path d="M7 10l5 5 5-5z"/></svg>');
	background-size: contain;
	background-repeat: no-repeat;
	background-position: center;
}

.icon-arrow-down.rotating {
	animation: rotate 1s linear infinite;
}

@keyframes rotate {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}
</style>
