/**
 * 逆地理编码：经纬度 → 详细地址（街道/门牌/周边 POI）
 * 使用腾讯地图 geocoder；小程序需配置 request 合法域名 https://apis.map.qq.com
 */

import { TENCENT_MAP_KEY, TENCENT_MAP_API_BASE } from '@/utils/mapConfig.js'

function pickDetailedAddress(result) {
	if (!result || typeof result !== 'object') return ''
	const formatted = result.formatted_addresses || {}
	const recommend = String(formatted.recommend || '').trim()
	const standard = String(result.address || '').trim()
	const comp = result.address_component || {}
	const poi = (Array.isArray(result.pois) && result.pois[0]) || {}
	const refs = result.address_reference || {}
	const landmark = refs.landmark_l2 || refs.landmark_l1 || refs.famous_area || {}
	const poiTitle = String(poi.title || landmark.title || '').trim()

	if (recommend) {
		if (poiTitle && recommend.indexOf(poiTitle) === -1) {
			return `${recommend}（${poiTitle}）`
		}
		return recommend
	}

	const city = comp.city && comp.city !== comp.province ? comp.city : ''
	const assembled = [
		comp.province,
		city,
		comp.district,
		comp.street,
		comp.street_number,
		poiTitle
	].filter(Boolean).join('')

	return assembled || standard
}

/**
 * @returns {Promise<{city:string, province:string, district:string, address:string}>}
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

		const poiOptions = encodeURIComponent('address_format=short;radius=300;policy=2')
		const url = `${TENCENT_MAP_API_BASE}/ws/geocoder/v1/?location=${latitude},${longitude}&key=${TENCENT_MAP_KEY}&get_poi=1&poi_options=${poiOptions}`

		uni.request({
			url,
			method: 'GET',
			success: (res) => {
				if (res.statusCode === 200 && res.data && res.data.status === 0) {
					const result = res.data.result || {}
					const addressComponent = result.address_component || {}
					const addressInfo = {
						city: addressComponent.city || '',
						province: addressComponent.province || '',
						district: addressComponent.district || '',
						address: pickDetailedAddress(result)
					}
					resolve(addressInfo)
					return
				}
				console.error('[逆地理编码] API返回错误:', res.data)
				reject(new Error((res.data && res.data.message) || '逆地理编码失败'))
			},
			fail: (err) => {
				console.error('[逆地理编码] 请求失败:', err)
				reject(err)
			}
		})
	})
}
