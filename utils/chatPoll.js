/**
 * 聊天轮询开关。已接 uni-push：进入小程序 / 打开页面读一次，之后靠推送刷新。
 * 需要兜底时再把 CHAT_POLL_ENABLED 设为 true。
 */

export const CHAT_POLL_ENABLED = false

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
