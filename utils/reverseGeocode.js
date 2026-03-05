/**
 * 逆地理编码工具
 * 通过经纬度获取地址信息（城市名称等）
 * 使用腾讯地图逆地理编码API
 */

import { TENCENT_MAP_KEY, TENCENT_MAP_API_BASE } from '@/utils/mapConfig.js'

/**
 * 使用腾讯地图逆地理编码API获取地址信息
 * @param {Number} latitude 纬度
 * @param {Number} longitude 经度
 * @returns {Promise<Object>} 地址信息 {city, province, district, address}
 */
export function reverseGeocode(latitude, longitude) {
	return new Promise((resolve, reject) => {
		if (!TENCENT_MAP_KEY) {
			console.warn('[逆地理编码] 未配置腾讯地图API Key')
			resolve({
				city: '',
				province: '',
				district: '',
				address: ''
			})
			return
		}

		// 腾讯地图逆地理编码API
		// 注意：需要在微信小程序后台配置 request合法域名：https://apis.map.qq.com
		const url = `${TENCENT_MAP_API_BASE}/ws/geocoder/v1/?location=${latitude},${longitude}&key=${TENCENT_MAP_KEY}&get_poi=0`
		
		uni.request({
			url: url,
			method: 'GET',
			success: (res) => {
				console.log('[逆地理编码] API响应:', res.data)
				if (res.statusCode === 200 && res.data && res.data.status === 0) {
					const result = res.data.result
					const addressComponent = result.address_component || {}
					const addressInfo = {
						city: addressComponent.city || '',
						province: addressComponent.province || '',
						district: addressComponent.district || '',
						address: result.address || ''
					}
					console.log('[逆地理编码] 解析结果:', addressInfo)
					resolve(addressInfo)
				} else {
					console.error('[逆地理编码] API返回错误:', res.data)
					reject(new Error(res.data?.message || '逆地理编码失败'))
				}
			},
			fail: (err) => {
				console.error('[逆地理编码] 请求失败:', err)
				reject(err)
			}
		})
	})
}

