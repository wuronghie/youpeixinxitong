/**
 * 服务号 openid 补绑（关注后 / App 显示时调用）
 */

let lastSyncAt = 0

export async function syncOaBind(options = {}) {
  const { force = false, minIntervalMs = 30 * 1000 } = options
  const token = uni.getStorageSync('uni_id_token')
  if (!token) return { skipped: true, reason: 'no_token' }

  const now = Date.now()
  if (!force && lastSyncAt && now - lastSyncAt < minIntervalMs) {
    return { skipped: true, reason: 'throttled' }
  }
  lastSyncAt = now

  try {
    const oa = uniCloud.importObject('wx-oa-notify', { customUI: true })
    const res = await oa.syncMyOaBind()
    console.log('[oaBind.sync]', res)
    return res
  } catch (e) {
    console.warn('[oaBind.sync] fail', e && (e.message || e))
    return { code: -1, message: e && (e.message || e.errMsg) }
  }
}
