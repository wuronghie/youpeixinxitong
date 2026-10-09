/**
 * 引导关注微信服务号
 * - 优先：wx.openOfficialAccountProfile（基础库 ≥ 3.7.10）
 * - 配置：uni-config-center/wx-oa 的 username（gh_ 原始ID）、oaName
 * - 进入小程序未绑定时弹窗提示
 */

import { syncOaBind } from '@/utils/oaBind.js'

const CACHE_KEY = 'wx_oa_follow_meta'
const SNOOZE_KEY = 'wx_oa_follow_prompt_snooze_until'
const FALLBACK_META = {
  username: 'gh_d8aa03b3fd59',
  oaName: '叁谦'
}

let metaCache = null
let promptedThisSession = false
let promptInFlight = false

/** 启动页 / 登录页上弹窗会被 reLaunch 立刻关掉 */
const UNSTABLE_ROUTES = ['pages/index/index', 'pages/login/index']

function getCurrentRoute() {
  try {
    const pages = getCurrentPages()
    if (!pages || !pages.length) return ''
    const cur = pages[pages.length - 1]
    return String((cur && cur.route) || '').replace(/^\//, '')
  } catch (e) {
    return ''
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForStablePage(timeoutMs = 12000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const route = getCurrentRoute()
    if (route && UNSTABLE_ROUTES.indexOf(route) === -1) return route
    await sleep(250)
  }
  return getCurrentRoute()
}

export async function loadOaFollowMeta(force = false) {
  if (!force && metaCache && metaCache.username) return metaCache
  try {
    const cached = uni.getStorageSync(CACHE_KEY)
    if (!force && cached && cached.username) {
      metaCache = cached
      return cached
    }
  } catch (e) {}

  try {
    const oa = uniCloud.importObject('wx-oa-notify', { customUI: true })
    const res = await oa.getSetupHint()
    if (res && res.code === 0 && res.data) {
      metaCache = {
        username: String(res.data.username || '').trim() || FALLBACK_META.username,
        oaName: String(res.data.oaName || '').trim() || FALLBACK_META.oaName
      }
      try {
        uni.setStorageSync(CACHE_KEY, metaCache)
      } catch (e) {}
      return metaCache
    }
  } catch (e) {
    console.warn('[oaFollow] load meta fail', e)
  }
  metaCache = { ...FALLBACK_META }
  return metaCache
}

function getWxSdk() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.wx) return globalThis.wx
  } catch (e) {}
  try {
    // 避免打包器把 wx 换成垫片，导致 openOfficialAccountProfile 丢失
    return Function('return typeof wx !== "undefined" ? wx : undefined')()
  } catch (e) {}
  return undefined
}

function showSearchHint(oaName) {
  uni.showModal({
    title: '请手动关注',
    content: `请在微信中搜索「${oaName || '服务号'}」并关注，然后返回小程序。`,
    showCancel: false
  })
}

/**
 * 同步打开公众号资料页。必须在用户点击回调里立刻调用，不能先 await，否则会丢掉手势。
 */
export function openOfficialAccountProfileNow(meta = {}) {
  const username = String(meta.username || '').trim()
  const oaName = meta.oaName || '服务号'
  if (!username) {
    uni.showModal({
      title: '暂未配置',
      content: '请先在服务号后台查看「原始ID」（gh_ 开头），填入 wx-oa/config.json 的 username。',
      showCancel: false
    })
    return { ok: false, reason: 'no_username' }
  }

  const wxSdk = getWxSdk()
  const openProfile = wxSdk && wxSdk.openOfficialAccountProfile
  if (typeof openProfile !== 'function') {
    console.warn('[oaFollow] openOfficialAccountProfile 不可用')
    showSearchHint(oaName)
    return { ok: false, reason: 'unsupported' }
  }

  try {
    openProfile.call(wxSdk, {
      username,
      success: () => {},
      fail: (err) => {
        console.warn('[oaFollow] openOfficialAccountProfile fail', err)
        showSearchHint(oaName)
      }
    })
    return { ok: true, reason: 'opened' }
  } catch (e) {
    console.warn('[oaFollow] openOfficialAccountProfile throw', e)
    showSearchHint(oaName)
    return { ok: false, reason: 'throw' }
  }
}

/**
 * 一键打开公众号主页（用户可在页内点关注）
 */
export async function openOfficialAccountFollow() {
  const cached = metaCache && metaCache.username ? metaCache : null
  const meta = cached || await loadOaFollowMeta()
  return openOfficialAccountProfileNow(meta)
}

function isSnoozed() {
  try {
    const until = Number(uni.getStorageSync(SNOOZE_KEY) || 0)
    return until > Date.now()
  } catch (e) {
    return false
  }
}

export function snoozeFollowPrompt(ms = 24 * 60 * 60 * 1000) {
  try {
    uni.setStorageSync(SNOOZE_KEY, Date.now() + ms)
  } catch (e) {}
}

/**
 * 进入小程序时：未关注则弹窗，可跳转公众号关注
 */
export async function promptFollowOfficialAccount(options = {}) {
  const { force = false, delayMs = 400 } = options

  const run = async () => {
    if (promptInFlight && !force) return { skipped: true, reason: 'in_flight' }
    promptInFlight = true
    try {
      const token = uni.getStorageSync('uni_id_token')
      if (!token) return { skipped: true, reason: 'no_token' }
      if (!force && promptedThisSession) return { skipped: true, reason: 'session' }
      if (!force && isSnoozed()) return { skipped: true, reason: 'snoozed' }

      const bindRes = await syncOaBind({ force: true, minIntervalMs: 0 })
      if (bindRes && bindRes.code === 0 && bindRes.data && bindRes.data.bound) {
        promptedThisSession = true
        return { skipped: true, reason: 'already_bound' }
      }

      // 等离开启动页再弹，避免 reLaunch 把弹窗关掉并误记成已提醒
      const route = await waitForStablePage()
      if (!route || UNSTABLE_ROUTES.indexOf(route) !== -1) {
        return { skipped: true, reason: 'unstable_page' }
      }
      if (!force && promptedThisSession) return { skipped: true, reason: 'session' }

      await sleep(320)

      promptedThisSession = true
      const meta = await loadOaFollowMeta()
      const oaName = meta.oaName || '服务号'

      return await new Promise((resolve) => {
        uni.showModal({
          title: '关注服务号，及时收通知',
          content: `关注「${oaName}」后，可收到预约、聊天、打卡等重要提醒，避免错过。`,
          confirmText: '去关注',
          cancelText: '稍后',
          success: (res) => {
            if (res.confirm) {
              const opened = openOfficialAccountProfileNow(meta)
              resolve({ prompted: true, action: 'follow', ...opened })
              return
            }
            snoozeFollowPrompt()
            resolve({ prompted: true, action: 'snooze' })
          },
          fail: () => {
            promptedThisSession = false
            resolve({ prompted: false, reason: 'modal_fail' })
          }
        })
      })
    } catch (e) {
      console.warn('[oaFollow] prompt fail', e)
      return { skipped: true, reason: 'error' }
    } finally {
      promptInFlight = false
    }
  }

  if (delayMs > 0) {
    return new Promise((resolve) => {
      setTimeout(() => {
        run().then(resolve)
      }, delayMs)
    })
  }
  return run()
}
