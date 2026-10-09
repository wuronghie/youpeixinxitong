/**
 * 优惠券客户端读取：登录刚发券时可能读不到，需短重试
 */

const PENDING_KEY = 'just_issued_coupons'
const CACHE_KEY = 'cached_available_coupons'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function persistIssuedCoupons({ count = 0, names = [], role = '' } = {}) {
  if (!count) return
  uni.setStorageSync(PENDING_KEY, {
    at: Date.now(),
    count,
    names: Array.isArray(names) ? names : [],
    role
  })
}

export function getPendingIssuedCoupons() {
  const data = uni.getStorageSync(PENDING_KEY)
  if (!data || !data.at) return null
  if (Date.now() - data.at > 5 * 60 * 1000) {
    uni.removeStorageSync(PENDING_KEY)
    return null
  }
  return data
}

export function getCachedAvailableCoupons(role) {
  const cache = uni.getStorageSync(CACHE_KEY)
  if (!cache || cache.role !== role || !Array.isArray(cache.list)) return []
  if (Date.now() - (cache.at || 0) > 2 * 60 * 1000) return []
  return cache.list
}

export async function fetchAvailableCoupons(role) {
  const couponCenter = uniCloud.importObject('coupon-center', { customUI: true })
  const pending = getPendingIssuedCoupons()
  const waiting = !!(pending && (!pending.role || pending.role === role) && pending.count > 0)
  const attempts = waiting ? 4 : 1
  let list = []
  let message = ''

  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await sleep(400 * i)
    }
    const res = await couponCenter.getAvailableCoupons({ role })
    if (res && res.code === 0 && res.data && Array.isArray(res.data.list)) {
      list = res.data.list
      if (list.length) break
    } else if (res && res.message) {
      message = res.message
    }
  }

  if (list.length) {
    uni.removeStorageSync(PENDING_KEY)
    uni.setStorageSync(CACHE_KEY, { role, list, at: Date.now() })
  }

  return { list, message, waiting }
}

export function prefetchAvailableCoupons(role) {
  if (role !== 'parent' && role !== 'teacher') return
  setTimeout(() => {
    fetchAvailableCoupons(role).catch((err) => {
      console.warn('[coupons] prefetch failed:', err)
    })
  }, 400)
}
