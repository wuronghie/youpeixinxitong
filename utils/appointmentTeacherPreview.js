const STORAGE_KEY = 'appointment_create_teacher_preview'

/**
 * 跳转预约页前写入教师预览信息，避免页面先显示占位/错误教师
 */
export function saveAppointmentTeacherPreview(preview) {
	if (!preview || typeof preview !== 'object') return
	try {
		uni.setStorageSync(STORAGE_KEY, preview)
	} catch (e) {
		console.warn('[appointmentTeacherPreview] 保存预览失败:', e)
	}
}

export function readAppointmentTeacherPreview() {
	try {
		const data = uni.getStorageSync(STORAGE_KEY)
		return data && typeof data === 'object' ? data : null
	} catch (e) {
		return null
	}
}

export function clearAppointmentTeacherPreview() {
	try {
		uni.removeStorageSync(STORAGE_KEY)
	} catch (e) {
		// ignore
	}
}

/**
 * 将预览数据合并到预约页 teacherInfo / id 字段
 */
export function applyAppointmentTeacherPreview(vm, preview) {
	if (!preview || !vm) return
	if (preview.teacherProfileId) vm.teacherProfileId = preview.teacherProfileId
	if (preview.teacherUid) vm.teacherUid = preview.teacherUid
	if (preview.teacher_id && !vm.teacherUid) vm.teacherUid = preview.teacher_id

	const displayName = preview.display_name || preview.name || preview.nickname || ''
	vm.teacherInfo = {
		...(vm.teacherInfo || {}),
		...preview,
		display_name: displayName,
		name: preview.name || displayName,
		teacher_id: preview.teacher_id || preview.teacherUid || vm.teacherUid || '',
		avatar: preview.avatar || vm.teacherInfo?.avatar || '',
		hourly_rate: preview.hourly_rate != null ? preview.hourly_rate : vm.teacherInfo?.hourly_rate
	}
}
