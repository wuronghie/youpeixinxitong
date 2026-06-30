/**
 * 家长端：试课结束后未确认结果时，再次进入小程序提醒
 * 引导前往预约详情页完成「确认试课结果 + 评价」，不在弹窗内直接提交
 */

let checking = false
let lastPromptAt = 0

function canPromptNow() {
	const now = Date.now()
	if (checking) return false
	if (now - lastPromptAt < 1500) return false
	return true
}

function isAlreadyOnAppointmentDetail(appointmentId) {
	const pages = getCurrentPages()
	const page = pages.length ? pages[pages.length - 1] : null
	if (!page || page.route !== 'pages/appointment/detail') return false
	const options = page.options || {}
	return options.id === appointmentId
}

function goAppointmentDetail(appointmentId) {
	if (!appointmentId) return
	if (isAlreadyOnAppointmentDetail(appointmentId)) return
	uni.navigateTo({
		url: `/pages/appointment/detail?id=${appointmentId}`
	})
}

function promptTrialConfirm(item) {
	if (!item || !item._id) return
	if (isAlreadyOnAppointmentDetail(item._id)) return

	const teacherName = item.teacher_name || item.teacher_display_name || '老师'
	const content = `您与${teacherName}的试课已结束，请前往预约详情页完成试课结果确认与评价。\n\n· 试课成功：试课费 100% 结算给教师\n· 试课不满意：教师获得 70%，您将收到 30% 退款`

	uni.showModal({
		title: '试课结果待确认',
		content,
		confirmText: '前往预约详情',
		cancelText: '稍后再说',
		success: (res) => {
			if (res.confirm) {
				goAppointmentDetail(item._id)
			}
		}
	})
}

/**
 * 在 App.onShow 中调用
 */
export async function checkPendingTrialConfirmReminder() {
	if (!canPromptNow()) return

	const token = uni.getStorageSync('uni_id_token')
	const userInfo = uni.getStorageSync('userInfo') || {}
	if (!token || userInfo.role !== 'parent') return

	// 启动/bootstrap 页自行跳转，略过
	const pages = getCurrentPages()
	const route = pages.length ? pages[pages.length - 1].route : ''
	if (route === 'pages/login/index' || route === 'pages/common/register') {
		return
	}

	checking = true
	lastPromptAt = Date.now()
	try {
		const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
		const res = await appointmentQuery.listPendingTrialConfirmations()
		if (res.code !== 0 || !res.data || !res.data.list || !res.data.list.length) {
			return
		}
		promptTrialConfirm(res.data.list[0])
	} catch (e) {
		console.warn('[trialConfirmReminder] 检查待确认试课失败:', e)
	} finally {
		checking = false
	}
}

export default { checkPendingTrialConfirmReminder, goAppointmentDetail }
