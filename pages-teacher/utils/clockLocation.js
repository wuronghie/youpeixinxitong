/**
 * 教师打卡定位。必须在用户点击回调里立刻启动，不能先 await 其它请求，
 * 否则体验版/正式版会丢掉手势，wx.getLocation 直接失败。
 */
import { reverseGeocode } from '@/utils/reverseGeocode.js'

function getWxSdk() {
	try {
		if (typeof globalThis !== 'undefined' && globalThis.wx) return globalThis.wx
	} catch (e) {}
	try {
		return Function('return typeof wx !== "undefined" ? wx : undefined')()
	} catch (e) {}
	return undefined
}

function errText(err) {
	return String((err && (err.errMsg || err.message || err.errCode)) || '')
}

function callLocationApi(wxApi, name, extra = {}) {
	const nativeFn = wxApi && typeof wxApi[name] === 'function' ? wxApi[name].bind(wxApi) : null
	const uniFn = typeof uni[name] === 'function' ? uni[name].bind(uni) : null
	const api = nativeFn || uniFn
	if (!api) {
		return Promise.reject({ errMsg: name + ':fail not supported' })
	}
	return new Promise((resolve, reject) => {
		api({
			type: 'gcj02',
			...extra,
			success: resolve,
			fail: reject
		})
	})
}

function requestRawLocation(wxApi) {
	// 微信 requiredPrivateInfos 中 getLocation 与 getFuzzyLocation 互斥，项目声明 getLocation
	return callLocationApi(wxApi, 'getLocation', { isHighAccuracy: false })
}

function requirePrivacyThen(wxApi, next) {
	if (!wxApi || typeof wxApi.requirePrivacyAuthorize !== 'function') {
		next()
		return
	}
	wxApi.requirePrivacyAuthorize({
		success: () => next(),
		fail: (err) => {
			const msg = errText(err)
			if (/cancel|deny|拒绝/i.test(msg)) {
				next(new Error('需要同意隐私协议才能打卡'))
				return
			}
			// 未配置隐私指引等：继续走定位，用真实错误提示
			next()
		}
	})
}

function openLocationSetting() {
	return new Promise((resolve) => {
		uni.showModal({
			title: '需要位置权限',
			content: '打卡需要获取当前位置。请在设置中开启位置权限后重试。',
			confirmText: '去设置',
			success: (modalRes) => {
				if (!modalRes.confirm) {
					resolve(false)
					return
				}
				uni.openSetting({
					success: (r) => resolve(!!(r.authSetting && r.authSetting['scope.userLocation'])),
					fail: () => resolve(false)
				})
			},
			fail: () => resolve(false)
		})
	})
}

function resolveAddress(res) {
	if (!res || !res.address) return ''
	if (typeof res.address === 'string') return res.address
	return res.address.formatted_address || [
		res.address.province,
		res.address.city,
		res.address.district,
		res.address.street,
		res.address.street_number,
		res.address.poi_name
	].filter(Boolean).join('')
}

function reverseGeocodeWithTimeout(latitude, longitude, ms = 5000) {
	return Promise.race([
		reverseGeocode(latitude, longitude).catch(() => null),
		new Promise((resolve) => setTimeout(() => resolve(null), ms))
	])
}

async function buildLocationPayload(res) {
	const latitude = Number(res && res.latitude)
	const longitude = Number(res && res.longitude)
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		throw new Error('定位结果无效，请重试')
	}

	let address = resolveAddress(res)
	if (!address) {
		try {
			const info = await reverseGeocodeWithTimeout(latitude, longitude)
			if (info) {
				address = info.address || [info.province, info.city, info.district].filter(Boolean).join('')
			}
		} catch (e) {
			console.warn('[打卡定位] 逆地理编码失败:', e)
		}
	}
	if (!address) {
		address = `已定位(${latitude.toFixed(5)},${longitude.toFixed(5)})`
	}

	return {
		latitude,
		longitude,
		address,
		accuracy: Number(res && res.accuracy) || 0
	}
}

/**
 * 在点击回调里立刻调用。内部先隐私授权，再 getLocation，失败再试模糊定位。
 */
export function getLocationForClock() {
	const wxApi = getWxSdk()
	return new Promise((resolve, reject) => {
		const finish = async (raw) => {
			try {
				resolve(await buildLocationPayload(raw))
			} catch (e) {
				reject(e)
			}
		}

		const locate = () => {
			requestRawLocation(wxApi).then(finish, async (err) => {
				const msg = errText(err)
				if (/auth deny|authorize|permission|隐私|权限/i.test(msg)) {
					const granted = await openLocationSetting()
					if (granted) {
						try {
							finish(await requestRawLocation(wxApi))
							return
						} catch (retryErr) {
							reject(retryErr)
							return
						}
					}
				}
				reject(err)
			})
		}

		requirePrivacyThen(wxApi, (privacyErr) => {
			if (privacyErr) {
				reject(privacyErr)
				return
			}
			locate()
		})
	})
}

export function locationErrorMessage(err) {
	const msg = errText(err)
	if (!msg) return '获取定位失败，请重试'
	if (/隐私协议/.test(msg)) return msg
	if (/privacy/i.test(msg)) return '需要同意隐私协议才能打卡'
	if (/requiredPrivateInfos|declare/i.test(msg)) return '定位接口未声明，请重新进入小程序后再试'
	if (/auth deny|authorize|permission|隐私|权限/i.test(msg)) {
		return '需要开启小程序位置权限才能打卡'
	}
	if (/timeout/i.test(msg)) return '定位超时，请到开阔处重试'
	if (/system|GPS|location/i.test(msg) && /fail/i.test(msg)) {
		return '定位失败，请确认手机系统定位已开启'
	}
	return msg.length > 40 ? '获取定位失败，请重试' : msg
}

export function cloudClockErrorMessage(err) {
	const msg = errText(err)
	if (/未登录|token|login/i.test(msg)) return '登录已过期，请重新登录后再打卡'
	if (/不存在|not found|FUNCTION_NOT_FOUND|云对象/i.test(msg)) return '打卡服务未就绪，请稍后重试'
	if (/timeout|超时/i.test(msg)) return '打卡超时，请稍后重试'
	if (msg && msg.length <= 40) return msg
	return '打卡失败，请重试'
}
