/**
 * 位置服务工具类
 * 提供获取位置、选择位置、打开地图等功能
 */

/**
 * 获取当前位置
 * @param {Object} options 配置选项
 * @param {Boolean} options.highAccuracy 是否高精度定位，默认false
 * @param {Number} options.timeout 超时时间（毫秒），默认10000
 * @returns {Promise<Object>} 位置信息 { latitude, longitude, address }
 */
export function getCurrentLocation(options = {}) {
	return new Promise((resolve, reject) => {
		const {
			highAccuracy = false,
			timeout = 10000
		} = options

		uni.getLocation({
			type: highAccuracy ? 'gcj02' : 'wgs84',
			altitude: false,
			geocode: true, // 是否解析地址信息
			success: (res) => {
				console.log('[位置] 获取当前位置成功:', res)
				resolve({
					latitude: res.latitude,
					longitude: res.longitude,
					address: res.address || '',
					city: res.city || '',
					province: res.province || '',
					district: res.district || '',
					speed: res.speed || 0,
					accuracy: res.accuracy || 0
				})
			},
			fail: (err) => {
				console.error('[位置] 获取当前位置失败:', err)
				
				// 根据错误码提供友好的错误提示
				let errorMessage = '获取位置失败'
				if (err.errMsg) {
					if (err.errMsg.includes('auth deny')) {
						errorMessage = '需要位置权限，请在设置中开启'
					} else if (err.errMsg.includes('timeout')) {
						errorMessage = '定位超时，请稍后重试'
					} else if (err.errMsg.includes('fail')) {
						errorMessage = '定位失败，请检查GPS是否开启'
					}
				}
				
				reject({
					code: err.errCode || -1,
					message: errorMessage,
					errMsg: err.errMsg
				})
			},
			complete: () => {
				// 可以在这里添加定位完成的回调
			}
		})
	})
}

/**
 * 打开地图选择位置
 * @param {Object} options 配置选项
 * @param {Number} options.latitude 初始纬度
 * @param {Number} options.longitude 初始经度
 * @returns {Promise<Object>} 选择的位置信息 { latitude, longitude, name, address }
 */
export function chooseLocation(options = {}) {
	return new Promise((resolve, reject) => {
		const {
			latitude,
			longitude
		} = options

		uni.chooseLocation({
			latitude: latitude,
			longitude: longitude,
			success: (res) => {
				console.log('[位置] 选择位置成功:', res)
				resolve({
					latitude: res.latitude,
					longitude: res.longitude,
					name: res.name || '',
					address: res.address || '',
					province: res.province || '',
					city: res.city || '',
					district: res.district || ''
				})
			},
			fail: (err) => {
				console.error('[位置] 选择位置失败:', err)
				
				let errorMessage = '选择位置失败'
				if (err.errMsg) {
					if (err.errMsg.includes('cancel')) {
						errorMessage = '已取消选择'
					} else if (err.errMsg.includes('auth deny')) {
						errorMessage = '需要位置权限，请在设置中开启'
					}
				}
				
				reject({
					code: err.errCode || -1,
					message: errorMessage,
					errMsg: err.errMsg
				})
			}
		})
	})
}

/**
 * 使用地图查看位置
 * @param {Object} options 位置信息
 * @param {Number} options.latitude 纬度（必填）
 * @param {Number} options.longitude 经度（必填）
 * @param {String} options.name 位置名称
 * @param {String} options.address 位置地址
 * @param {Number} options.scale 缩放级别，默认18
 */
export function openLocation(options) {
	const {
		latitude,
		longitude,
		name = '目标位置',
		address = '',
		scale = 18
	} = options

	if (!latitude || !longitude) {
		uni.showToast({
			title: '位置信息不完整',
			icon: 'none'
		})
		return
	}

	uni.openLocation({
		latitude: latitude,
		longitude: longitude,
		name: name,
		address: address,
		scale: scale,
		success: () => {
			console.log('[位置] 打开地图成功')
		},
		fail: (err) => {
			console.error('[位置] 打开地图失败:', err)
			uni.showToast({
				title: '打开地图失败',
				icon: 'none'
			})
		}
	})
}

/**
 * 解析地址信息（将完整地址字符串解析为省市区详细地址）
 * @param {String} address 完整地址字符串
 * @returns {Object} { province, city, district, detail }
 */
export function parseAddress(address) {
	if (!address || typeof address !== 'string') {
		return {
			province: '',
			city: '',
			district: '',
			detail: ''
		}
	}

	// 简单的地址解析逻辑（可以根据实际情况优化）
	const addressObj = {
		province: '',
		city: '',
		district: '',
		detail: ''
	}

	// 匹配省
	const provinceMatch = address.match(/^(.+?省|.+?自治区|.+?市)/)
	if (provinceMatch) {
		addressObj.province = provinceMatch[1]
		address = address.replace(provinceMatch[1], '')
	}

	// 匹配市
	const cityMatch = address.match(/^(.+?市|.+?州)/)
	if (cityMatch) {
		addressObj.city = cityMatch[1]
		address = address.replace(cityMatch[1], '')
	}

	// 匹配区/县
	const districtMatch = address.match(/^(.+?区|.+?县|.+?市)/)
	if (districtMatch) {
		addressObj.district = districtMatch[1]
		address = address.replace(districtMatch[1], '')
	}

	// 剩余部分作为详细地址
	addressObj.detail = address.trim()

	return addressObj
}

/**
 * 计算两点之间的距离（米）
 * @param {Number} lat1 点1纬度
 * @param {Number} lon1 点1经度
 * @param {Number} lat2 点2纬度
 * @param {Number} lon2 点2经度
 * @returns {Number} 距离（米）
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
	const R = 6371000 // 地球半径（米）
	const dLat = (lat2 - lat1) * Math.PI / 180
	const dLon = (lon2 - lon1) * Math.PI / 180
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	return Math.round(R * c)
}

/**
 * 格式化距离显示
 * @param {Number} distance 距离（米）
 * @returns {String} 格式化后的距离字符串
 */
export function formatDistance(distance) {
	if (!distance || distance < 0) return ''
	
	if (distance < 1000) {
		return `${distance}米`
	} else {
		return `${(distance / 1000).toFixed(1)}公里`
	}
}

/**
 * 检查位置权限
 * @returns {Promise<Boolean>} 是否有权限
 */
export function checkLocationPermission() {
	return new Promise((resolve) => {
		uni.getSetting({
			success: (res) => {
				const locationAuthorized = res.authSetting['scope.userLocation']
				resolve(locationAuthorized === true || locationAuthorized === undefined)
			},
			fail: () => {
				resolve(false)
			}
		})
	})
}

/**
 * 请求位置权限
 * @returns {Promise<Boolean>} 是否授权成功
 */
export function requestLocationPermission() {
	return new Promise((resolve) => {
		uni.authorize({
			scope: 'scope.userLocation',
			success: () => {
				console.log('[位置] 位置权限授权成功')
				resolve(true)
			},
			fail: (err) => {
				console.error('[位置] 位置权限授权失败:', err)
				
				// 如果用户拒绝，引导用户到设置页面
				uni.showModal({
					title: '需要位置权限',
					content: '为了提供更好的服务，需要获取您的位置信息。请在设置中开启位置权限。',
					confirmText: '去设置',
					success: (modalRes) => {
						if (modalRes.confirm) {
							uni.openSetting({
								success: (settingRes) => {
									const authorized = settingRes.authSetting['scope.userLocation']
									resolve(authorized === true)
								},
								fail: () => {
									resolve(false)
								}
							})
						} else {
							resolve(false)
						}
					}
				})
			}
		})
	})
}

