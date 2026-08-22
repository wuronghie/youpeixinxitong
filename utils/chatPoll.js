/**
 * 聊天轻量轮询工具
 * push 到达前/失败时的可靠兜底：会话 5s、列表 10s、角标 15s
 */

/** push 失败时的可靠兜底；会话页依赖此开关刷新试课邀请状态 */
export const CHAT_POLL_ENABLED = true

export const CHAT_POLL_INTERVAL = {
	conversation: 5000,
	list: 10000,
	badge: 15000
}

export function createChatPoller({ interval, tick, shouldSkip } = {}) {
	let timer = null
	let running = false

	async function runTick() {
		if (running) return
		if (typeof shouldSkip === 'function' && shouldSkip()) return
		running = true
		try {
			await tick()
		} catch (e) {
			console.warn('[chatPoll] tick failed:', e)
		} finally {
			running = false
		}
	}

	return {
		start() {
			this.stop()
			if (typeof tick !== 'function') return
			timer = setInterval(runTick, interval || CHAT_POLL_INTERVAL.list)
		},
		stop() {
			if (timer) {
				clearInterval(timer)
				timer = null
			}
			running = false
		},
		async poke() {
			await runTick()
		}
	}
}
