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

/**
 * 一键打开公众号主页（用户可在页内点关注）
 */
export async function openOfficialAccountFollow() {
  const meta = await loadOaFollowMeta()
  const username = meta.username
  if (!username) {
    uni.showModal({
      title: '暂未配置',
      content: '请先在服务号后台查看「原始ID」（gh_ 开头），填入 wx-oa/config.json 的 username。',
      showCancel: false
    })
    return { ok: false, reason: 'no_username' }
  }

  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && typeof wx.openOfficialAccountProfile === 'function') {
    return new Promise((resolve) => {
      wx.openOfficialAccountProfile({
        username,
        success: () => resolve({ ok: true, reason: 'opened' }),
        fail: (err) => {
          console.warn('[oaFollow] openOfficialAccountProfile fail', err)
          uni.navigateTo({
            url: '/pages/common/follow-oa',
            fail: () => {
              uni.showModal({
                title: '无法打开',
                content: `请在微信中搜索「${meta.oaName}」并关注。`,
                showCancel: false
              })
            }
          })
          resolve({ ok: false, reason: 'api_fail', err })
        }
      })
    })
  }
  // #endif

  uni.navigateTo({
    url: '/pages/common/follow-oa',
    fail: () => {
      uni.showModal({
        title: '请手动关注',
        content: `请搜索公众号「${meta.oaName}」并关注，然后返回小程序。`,
        showCancel: false
      })
    }
  })
  return { ok: false, reason: 'unsupported' }
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
  const { force = false, delayMs = 1200 } = options

  const run = async () => {
    try {
      const token = uni.getStorageSync('uni_id_token')
      if (!token) return { skipped: true, reason: 'no_token' }
      if (!force && promptedThisSession) return { skipped: true, reason: 'session' }
      if (!force && isSnoozed()) return { skipped: true, reason: 'snoozed' }

      const bindRes = await syncOaBind({ force: true, minIntervalMs: 0 })
      if (bindRes && bindRes.code === 0 && bindRes.data && bindRes.data.bound) {
        return { skipped: true, reason: 'already_bound' }
      }

      promptedThisSession = true
      const meta = await loadOaFollowMeta()
      const oaName = meta.oaName || '服务号'

      return await new Promise((resolve) => {
        uni.showModal({
          title: '关注服务号，及时收通知',
          content: `关注「${oaName}」后，可收到预约、聊天、打卡等重要提醒，避免错过。`,
          confirmText: '去关注',
          cancelText: '稍后',
          success: async (res) => {
            if (res.confirm) {
              const opened = await openOfficialAccountFollow()
              resolve({ prompted: true, action: 'follow', ...opened })
              return
            }
            snoozeFollowPrompt()
            resolve({ prompted: true, action: 'snooze' })
          },
          fail: () => resolve({ prompted: false, reason: 'modal_fail' })
        })
      })
    } catch (e) {
      console.warn('[oaFollow] prompt fail', e)
      return { skipped: true, reason: 'error' }
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
