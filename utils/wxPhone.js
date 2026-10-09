/**
 * 微信手机号授权与号码归一化。
 * 业务字段用 uni-id-users.phone，授权绑定写入 mobile，读取时两者兼容。
 */

export function normalizePhone(value) {
	return String(value || '').replace(/\D/g, '')
}

export function isValidCnMobile(value) {
	return /^1[3-9]\d{9}$/.test(normalizePhone(value))
}

export function pickUserPhone(user = {}) {
	const parentPhone = user.parent_info && user.parent_info.phone
	const candidates = [user.phone, user.mobile, parentPhone]
	for (const item of candidates) {
		const phone = normalizePhone(item)
		if (isValidCnMobile(phone)) return phone
	}
	return ''
}

export function pickContactWechat(user = {}) {
	const fromParent = user.parent_info && user.parent_info.contact_wechat
	const fromTeacher = user.teacherProfile && user.teacherProfile.contact_wechat
	return String(fromParent || user.contact_wechat || fromTeacher || '').trim()
}

/**
 * 是否还缺手机号 / 微信号（开屏收集用）
 */
export function needsContactCollect(user = {}, extra = {}) {
	const phone = pickUserPhone(user) || normalizePhone(extra.phone)
	const wechat = pickContactWechat(user) || String(extra.contact_wechat || '').trim()
	return !isValidCnMobile(phone) || !wechat
}

export async function bindWeixinPhone(event) {
	return bindWeixinPhoneByCode(pickPhoneAuthCode(event))
}

export function pickPhoneAuthCode(event) {
	const detail = (event && event.detail) || {}
	const errMsg = String(detail.errMsg || '')
	if (errMsg && errMsg.indexOf('ok') === -1) {
		if (errMsg.indexOf('deny') !== -1 || errMsg.indexOf('fail user deny') !== -1) {
			throw new Error('您已拒绝授权手机号')
		}
		throw new Error('授权失败，请重试')
	}
	const code = detail.code
	if (!code) {
		throw new Error('未获取到授权码，请更新微信后重试')
	}
	return code
}

export async function bindWeixinPhoneByCode(code) {
	if (!code) {
		throw new Error('未获取到授权码，请更新微信后重试')
	}
	const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true })
	const res = await uniIdCo.bindMobileByMpWeixin({ code })
	if (res && res.errCode && res.errCode !== 0) {
		throw new Error(res.errMsg || res.message || '绑定手机号失败')
	}
	return res
}

export async function refreshBoundPhone() {
	const userProfile = uniCloud.importObject('user-profile', { customUI: true })
	const res = await userProfile.getUserProfile()
	if (res && res.code === 0 && res.data) {
		return pickUserPhone(res.data)
	}
	return ''
}

export function persistPickedPhone(phone) {
	const normalized = normalizePhone(phone)
	if (!isValidCnMobile(normalized)) return
	const stored = uni.getStorageSync('userInfo') || {}
	stored.phone = normalized
	stored.mobile = normalized
	uni.setStorageSync('userInfo', stored)
}

export async function bindWeixinPhoneAndSync(event) {
	await bindWeixinPhone(event)
	const phone = await refreshBoundPhone()
	if (phone) persistPickedPhone(phone)
	return phone
}
