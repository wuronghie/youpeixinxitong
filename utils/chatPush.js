/**
 * uni-push 2.0 聊天推送：绑定 cid、解析 payload、页面订阅
 * 关联：chat-send.reportPushClientId、chat-send 发送后推送
 */

export const CHAT_PUSH_EVENT = 'chat:push'
export const CHAT_BADGE_EVENT = 'chat:badge'
export const CHAT_UNREAD_STORAGE_KEY = 'chat_unread_count'

let bindInFlight = null
let lastBoundCid = ''
let listenerReady = false
const listeners = new Set()
const badgeListeners = new Set()

function log(...args) {
	console.log('[chatPush]', ...args)
}

function warn(...args) {
	console.warn('[chatPush]', ...args)
}

/**
 * 页面订阅聊天推送（会话页/列表页）
 */
export function onChatPush(handler) {
	if (typeof handler !== 'function') return
	listeners.add(handler)
	log('订阅 chat:push，当前监听数=', listeners.size)
}

export function offChatPush(handler) {
	if (!handler) return
	listeners.delete(handler)
	log('取消订阅 chat:push，当前监听数=', listeners.size)
}

/**
 * 导航栏角标订阅（可直接收未读数）
 */
export function onChatBadge(handler) {
	if (typeof handler !== 'function') return
	badgeListeners.add(handler)
}

export function offChatBadge(handler) {
	if (!handler) return
	badgeListeners.delete(handler)
}

function emitChatPush(payload) {
	log('分发 chat:push → 页面监听数=', listeners.size, 'payload=', payload)
	listeners.forEach((fn) => {
		try {
			fn(payload)
		} catch (e) {
			warn('页面监听执行失败:', e)
		}
	})
	try {
		uni.$emit(CHAT_PUSH_EVENT, payload)
	} catch (e) {
		// ignore
	}
}

function emitChatBadge(count) {
	const n = Math.max(0, Number(count) || 0)
	try {
		uni.setStorageSync(CHAT_UNREAD_STORAGE_KEY, n)
	} catch (e) {
		// ignore
	}
	log('分发 chat:badge →', n, '角标监听数=', badgeListeners.size)
	badgeListeners.forEach((fn) => {
		try {
			fn(n)
		} catch (e) {
			warn('角标监听执行失败:', e)
		}
	})
	try {
		uni.$emit(CHAT_BADGE_EVENT, n)
	} catch (e) {
		// ignore
	}
}

export function getCachedUnreadCount() {
	try {
		return Math.max(0, Number(uni.getStorageSync(CHAT_UNREAD_STORAGE_KEY) || 0))
	} catch (e) {
		return 0
	}
}

/**
 * 收到推送后刷新未读角标（不依赖 TabBar 是否挂载）
 */
async function refreshBadgeAfterPush(reason) {
	log('开始刷新角标，原因=', reason)
	try {
		const chatSend = uniCloud.importObject('chat-send', { customUI: true })
		const res = await chatSend.pollUpdates({ mode: 'badge' })
		log('角标 pollUpdates 结果=', res)
		if (res && res.code === 0) {
			const count = Math.max(0, Number(res.data?.unreadMessages || 0))
			emitChatBadge(count)
			return count
		}
	} catch (e) {
		warn('刷新角标失败:', e)
	}
	return null
}

/**
 * 会话已读后主动刷新底部「消息」红点（打开会话 / markRead 后调用）
 */
export function refreshChatBadge(reason = 'markRead') {
	return refreshBadgeAfterPush(reason)
}

/**
 * 本地立即改角标（乐观更新，随后仍建议 refreshChatBadge 对齐服务端）
 */
export function setChatBadgeCount(count) {
	emitChatBadge(count)
}

/**
 * 登录后/启动时绑定 push_clientid
 */
export function bindPushClientId() {
	const token = uni.getStorageSync('uni_id_token') || uni.getStorageSync('token')
	if (!token) {
		warn('绑定 cid 跳过：未登录')
		return Promise.resolve(false)
	}
	if (bindInFlight) return bindInFlight

	log('开始 getPushClientId…')
	bindInFlight = new Promise((resolve) => {
		uni.getPushClientId({
			success: async (res) => {
				try {
					log('getPushClientId success=', res)
					const cid = res && res.cid
					if (!cid) {
						warn('无 cid：请确认 manifest.mp-weixin.unipush.enable、socket 合法域名、真机运行')
						resolve(false)
						return
					}
					if (cid === lastBoundCid) {
						log('cid 未变化，跳过上报', cid)
						resolve(true)
						return
					}
					const chatSend = uniCloud.importObject('chat-send', { customUI: true })
					const result = await chatSend.reportPushClientId({ push_clientid: cid })
					log('reportPushClientId 结果=', result)
					if (result && result.code === 0) {
						lastBoundCid = cid
						log('cid 绑定成功', cid)
						resolve(true)
						return
					}
					warn('reportPushClientId 异常:', result)
					resolve(false)
				} catch (e) {
					warn('reportPushClientId 失败:', e)
					resolve(false)
				} finally {
					bindInFlight = null
				}
			},
			fail: (err) => {
				warn('getPushClientId fail=', err)
				bindInFlight = null
				resolve(false)
			}
		})
	})

	return bindInFlight
}

export function clearBoundPushClientId() {
	lastBoundCid = ''
}

/**
 * 从 onPushMessage 回调中解析业务 payload
 */
export function parseChatPushPayload(res) {
	if (!res) return null

	const candidates = []
	if (res.data !== undefined) candidates.push(res.data)
	candidates.push(res)

	for (const item of candidates) {
		if (!item) continue
		let payload = item
		if (payload.payload !== undefined) payload = payload.payload
		if (typeof payload === 'string') {
			try {
				payload = JSON.parse(payload)
			} catch (e) {
				continue
			}
		}
		if (!payload || typeof payload !== 'object') continue
		const conversationId = payload.conversation_id || payload.conversationId || ''
		if (payload.type === 'chat_new' || conversationId) {
			return {
				type: 'chat_new',
				conversation_id: conversationId,
				send_time: Number(payload.send_time || payload.sendTime || 0)
			}
		}
	}
	return null
}

/**
 * App 启动时注册一次
 */
export function setupChatPushListener() {
	if (listenerReady) {
		log('onPushMessage 已注册，跳过重复注册')
		return
	}
	listenerReady = true
	log('注册 uni.onPushMessage')
	uni.onPushMessage((res) => {
		log('★ 收到推送 onPushMessage 原始数据=', typeof res === 'object' ? JSON.stringify(res) : res)
		const payload = parseChatPushPayload(res) || {
			type: 'chat_new',
			conversation_id: '',
			send_time: Date.now()
		}
		log('解析后 payload=', payload)
		emitChatPush(payload)
		refreshBadgeAfterPush('onPushMessage')
	})
}
