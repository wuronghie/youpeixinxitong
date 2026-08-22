#!/usr/bin/env node
/**
 * 将 uni-app 页面批量导出为 html.to.design 可导入的静态稿。
 *
 * 用法（在 test 目录）：
 *   node scripts/export-h2d.js
 *
 * 导入 Figma（不要拖 .h2d）：
 *   1. 打开插件 html.to.design → File
 *   2. 拖入 dist_html/figma-import.zip
 *      或一次拖入 dist_html/figma/ 里若干 .html
 *
 * 官方 .h2d 只能由该插件的 Chrome 扩展抓页生成，脚本无法伪造。
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'dist_html')
const FIGMA_DIR = path.join(OUT_DIR, 'figma')
const VIEWPORT_W = 375
const VIEWPORT_H = 812
const RPX_RATIO = VIEWPORT_W / 750 // 750rpx = 375px

const TAG_MAP = {
  view: 'div',
  text: 'span',
  image: 'img',
  navigator: 'a',
  button: 'button',
  input: 'input',
  textarea: 'textarea',
  label: 'label',
  form: 'form',
  'scroll-view': 'div',
  swiper: 'div',
  'swiper-item': 'div',
  picker: 'div',
  'picker-view': 'div',
  'picker-view-column': 'div',
  switch: 'input',
  checkbox: 'input',
  radio: 'input',
  slider: 'input',
  progress: 'progress',
  'rich-text': 'div',
  'cover-view': 'div',
  'cover-image': 'img',
  block: 'div',
  slot: 'div',
  canvas: 'div',
  video: 'div',
  map: 'div',
  webview: 'iframe',
  'checkbox-group': 'div',
  'radio-group': 'div',
  'movable-area': 'div',
  'movable-view': 'div',
}

const VOID_HTML = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'progress'])

const DEMO = {
  nickname: '张老师',
  display_name: '李老师',
  name: '王同学',
  label: '家长',
  desc: '为孩子找合适的老师',
  title: '示例标题',
  content: '这是一条示例消息',
  text: '示例文案',
  address: '成都市高新区',
  locationText: '高新区',
  amount: '120.00',
  hourly_rate: '150',
  status: '已确认',
  date: '2026-08-20',
  time: '19:00',
  subject: '数学',
  student_name: '小明',
  phone: '138****0000',
  unreadBadgeText: '2',
  loadingText: '正在加载…',
}

function walkVueFiles(dir, list = []) {
  if (!fs.existsSync(dir)) return list
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walkVueFiles(full, list)
    else if (name.endsWith('.vue')) list.push(full)
  }
  return list
}

function loadComponentIndex() {
  const index = new Map()
  const dirs = [
    path.join(ROOT, 'components'),
    path.join(ROOT, 'uni_modules'),
  ]
  for (const dir of dirs) {
    for (const file of walkVueFiles(dir)) {
      const base = path.basename(file, '.vue')
      index.set(base, file)
      index.set(toKebab(base), file)
    }
  }
  return index
}

function toKebab(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function collectPages() {
  const pagesJson = readJson(path.join(ROOT, 'pages.json'))
  const pages = []
  for (const item of pagesJson.pages || []) {
    pages.push({
      route: item.path,
      title: (item.style && item.style.navigationBarTitleText) || item.path,
      customNav: !!(item.style && item.style.navigationStyle === 'custom'),
    })
  }
  for (const sub of pagesJson.subPackages || []) {
    for (const item of sub.pages || []) {
      const rel = typeof item === 'string' ? item : item.path
      const style = typeof item === 'string' ? {} : (item.style || {})
      pages.push({
        route: `${sub.root}/${rel}`.replace(/\\/g, '/'),
        title: style.navigationBarTitleText || rel,
        customNav: style.navigationStyle === 'custom',
      })
    }
  }
  return pages
}

function extractSfcBlock(source, tag) {
  const re = new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const blocks = []
  let rest = source
  let m
  while ((m = rest.match(re))) {
    blocks.push({ attrs: m[1] || '', content: m[2] || '' })
    rest = rest.slice(m.index + m[0].length)
  }
  return blocks
}

function stripCommentsAndIfdef(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\/ #ifdef[\s\S]*?\/\/ #endif/g, '')
    .replace(/\/\* #ifdef[\s\S]*?#endif \*\//g, '')
}

function rpxToPx(css) {
  return css
    .replace(/(\d+(?:\.\d+)?)(rpx|upx)/gi, (_, n) => `${Math.round(parseFloat(n) * RPX_RATIO * 100) / 100}px`)
}

function placeholderImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="#e8eef6" width="80" height="80"/><text x="50%" y="54%" text-anchor="middle" fill="#8aa0b8" font-size="11" font-family="sans-serif">img</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function demoFromExpr(expr) {
  const clean = String(expr || '').replace(/\s+/g, ' ').trim()
  if (!clean) return '示例'
  const last = clean.split('.').pop().replace(/[^\w\u4e00-\u9fa5]/g, '')
  if (DEMO[last]) return DEMO[last]
  if (/[\u4e00-\u9fa5]/.test(clean)) return clean
  if (/amount|price|fee|rate/.test(clean)) return '120'
  if (/count|num/.test(clean)) return '3'
  if (/time|date/.test(clean)) return '08-20 19:00'
  if (/name|title|label/.test(clean)) return '示例名称'
  return last || '示例'
}

function replaceMustache(html) {
  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => escapeHtml(demoFromExpr(expr)))
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function extractListLabels(script, listName) {
  if (!script || !listName) return []
  const idx = script.indexOf(listName)
  if (idx < 0) return []
  const slice = script.slice(idx, idx + 2500)
  const labels = [...slice.matchAll(/label\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  return labels.slice(0, 8)
}

function fillVForPlaceholders(html, script) {
  const names = [...html.matchAll(/v-for="(?:\([^)]+\)|[^"]+)\s+in\s+([^"]+)"/g)].map((m) => m[1].trim())
  let out = html.replace(/\s+v-for="[^"]*"/g, '')
  for (const listName of names) {
    const labels = extractListLabels(script, listName)
    if (labels[0]) out = out.replace(/\{\{\s*\w+\.label\s*\}\}/, escapeHtml(labels[0]))
  }
  return out
}

function objectStyleToCss(expr) {
  const s = String(expr).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  const map = {}
  const re = /([a-zA-Z-]+)\s*:\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(s))) map[m[1]] = m[2]
  return Object.entries(map).map(([k, v]) => `${toKebab(k)}:${v}`).join(';')
}

function cleanAttrs(raw, tagName) {
  let attrs = raw || ''
  attrs = attrs
    .replace(/\s+(v-if|v-else-if|v-else|v-show|v-cloak|v-once|v-html|v-text|v-model[\w.]*|:key|key|wx:if|wx:elif|wx:else|wx:for|wx:key|wx:for-item|wx:for-index)(="[^"]*")?/g, '')
    .replace(/\s+@(?:click|tap|input|change|confirm|blur|focus|submit|longpress)(?:\.[\w]+)?(="[^"]*")?/g, '')
    .replace(/\s+(?:bind|catch):?\w+(="[^"]*")?/g, '')
    .replace(/\s+hover-class(="[^"]*")?/g, '')
    .replace(/\s+hover-stop-propagation(="[^"]*")?/g, '')

  attrs = attrs.replace(/\s+:class="([^"]*)"/g, (_, expr) => {
    const statics = [...expr.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]).join(' ')
    return statics ? ` class="${statics}"` : ''
  })
  attrs = attrs.replace(/\s+:style="([^"]*)"/g, (_, expr) => {
    const css = objectStyleToCss(expr)
    return css ? ` style="${css}"` : ''
  })
  attrs = attrs.replace(/\s+:src="[^"]*"/g, ` src="${placeholderImage()}"`)
  attrs = attrs.replace(/\s+src="\{\{[^}]+\}\}"/g, ` src="${placeholderImage()}"`)
  attrs = attrs.replace(/\s+:[\w.-]+="[^"]*"/g, '')
  attrs = attrs.replace(/\s+v-[\w.-]+(="[^"]*")?/g, '')
  attrs = attrs.replace(/\s+wx:[\w.-]+(="[^"]*")?/g, '')
  attrs = attrs.replace(/\s+mode="[^"]*"/g, '')
  attrs = attrs.replace(/\s+confirm-type="[^"]*"/g, '')
  attrs = attrs.replace(/\s+placeholder-class="[^"]*"/g, '')
  attrs = attrs.replace(/\s+color="[^"]*"/g, '')

  if (tagName === 'image' || tagName === 'cover-image') {
    if (!/\ssrc=/.test(attrs)) attrs += ` src="${placeholderImage()}"`
  }
  if (tagName === 'switch' || tagName === 'checkbox' || tagName === 'radio') {
    const type = tagName === 'radio' ? 'radio' : 'checkbox'
    if (!/\stype=/.test(attrs)) attrs += ` type="${type}"`
  }
  if (tagName === 'navigator') {
    attrs = attrs.replace(/\s+url="[^"]*"/, '')
    if (!/\shref=/.test(attrs)) attrs += ' href="javascript:void(0)"'
  }
  return attrs
}

function convertUniTags(html) {
  html = html.replace(/<template(\s[^>]*)?>/gi, '<div$1>').replace(/<\/template>/gi, '</div>')

  html = html.replace(/<\/([a-zA-Z][\w-]*)>/g, (all, tag) => {
    const mapped = TAG_MAP[tag] || (/^[a-z][\w]*-[\w-]+$/i.test(tag) ? 'div' : null)
    if (!mapped) return all
    if (VOID_HTML.has(mapped)) return ''
    return `</${mapped}>`
  })

  html = html.replace(/<([a-zA-Z][\w-]*)([^>]*)\/?>/g, (all, tag, attrs) => {
    if (all.startsWith('</')) return all
    const mapped = TAG_MAP[tag] || (/^[a-z][\w]*-[\w-]+$/i.test(tag) ? 'div' : null)
    if (!mapped) return all
    const cleaned = cleanAttrs(attrs, tag)
    const selfClosing = /\/\s*$/.test(attrs) || VOID_HTML.has(mapped)
    if (VOID_HTML.has(mapped) || selfClosing) return `<${mapped}${cleaned} />`
    return `<${mapped}${cleaned}>`
  })
  html = mergeClassAttrs(html)
  return html
}

function mergeClassAttrs(html) {
  return html.replace(/(\sclass="[^"]*")+/g, (seq) => {
    const vals = [...seq.matchAll(/class="([^"]*)"/g)].map((m) => m[1].trim()).filter(Boolean)
    const uniq = [...new Set(vals.join(' ').split(/\s+/).filter(Boolean))]
    return uniq.length ? ` class="${uniq.join(' ')}"` : ''
  })
}

function inlineComponents(html, componentIndex, styles, depth, visiting) {
  if (depth > 4) return html
  const names = [...new Set([...componentIndex.keys()])]
    .filter((n) => n.includes('-') || /^[A-Z]/.test(n))
    .sort((a, b) => b.length - a.length)

  for (const name of names) {
    const file = componentIndex.get(name)
    if (!file) continue
    const kebab = toKebab(path.basename(file, '.vue'))
    const pascal = path.basename(file, '.vue')
    const re = new RegExp(
      `<(${pascal}|${kebab})(\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:${pascal}|${kebab})>)`,
      'gi'
    )
    html = html.replace(re, () => {
      const key = path.normalize(file)
      if (visiting.has(key)) return `<!-- circular ${pascal} -->`
      visiting.add(key)
      const converted = convertVueFile(file, componentIndex, styles, depth + 1, visiting)
      visiting.delete(key)
      return converted.html
    })
  }
  return html
}

function convertVueFile(file, componentIndex, styles, depth = 0, visiting = new Set()) {
  const source = fs.readFileSync(file, 'utf8')
  const templates = extractSfcBlock(source, 'template')
  const styleBlocks = extractSfcBlock(source, 'style')
  const scripts = extractSfcBlock(source, 'script')
  const script = scripts.map((b) => b.content).join('\n')

  let html = templates.length ? templates[0].content : '<view>空模板</view>'
  html = stripCommentsAndIfdef(html)
  html = fillVForPlaceholders(html, script)
  html = inlineComponents(html, componentIndex, styles, depth, visiting)
  html = replaceMustache(html)
  html = convertUniTags(html)
  html = rpxToPx(html)

  for (const block of styleBlocks) {
    styles.push(normalizeCssSelectors(rpxToPx(block.content)))
  }
  return { html, script }
}

function normalizeCssSelectors(css) {
  return css
    .replace(/@import\s+[^;]+;/g, '')
    .replace(/\bpage\b/g, 'body')
    .replace(/(^|[,{\s>+~])view(?=[\s.{:#,[>+~])/gm, '$1div')
    .replace(/(^|[,{\s>+~])text(?=[\s.{:#,[>+~])/gm, '$1span')
    .replace(/(^|[,{\s>+~])image(?=[\s.{:#,[>+~])/gm, '$1img')
}

function loadGlobalCss() {
  const files = [
    path.join(ROOT, 'common/uni.css'),
    path.join(ROOT, 'common/zcm-main.css'),
    path.join(ROOT, 'common/common.css'),
  ]
  const parts = []
  for (const file of files) {
    if (fs.existsSync(file)) parts.push(fs.readFileSync(file, 'utf8'))
  }
  return rpxToPx(normalizeCssSelectors(parts.join('\n')))
}

function wrapHtml({ title, route, body, css, customNav }) {
  const nav = customNav
    ? ''
    : `<header class="h2d-navbar"><div class="h2d-navbar-title">${escapeHtml(title || route)}</div></header>`
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${VIEWPORT_W}, initial-scale=1, maximum-scale=1" />
  <title>${escapeHtml(title || route)}</title>
  <style>
    html, body { margin: 0; padding: 0; }
    body {
      width: ${VIEWPORT_W}px;
      min-height: ${VIEWPORT_H}px;
      background: #F8F8F8;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
      color: #111;
    }
    img { max-width: 100%; display: inline-block; vertical-align: middle; }
    button { appearance: none; border: 0; }
    .h2d-page { min-height: ${VIEWPORT_H}px; background: #F8F8F8; }
    .h2d-navbar {
      height: 44px; display: flex; align-items: center; justify-content: center;
      background: #fff; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 10;
    }
    .h2d-navbar-title { font-size: 16px; font-weight: 600; }
    ${css}
  </style>
</head>
<body>
  <div class="h2d-page" data-route="${escapeHtml(route)}">
    ${nav}
    ${body}
  </div>
</body>
</html>
`
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}

function u16(n) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}
function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n)
  return b
}

function makeStoreZip(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data)
    const crc = crc32(data)
    const local = Buffer.concat([
      Buffer.from('PK\u0003\u0004', 'binary'),
      u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0),
      name, data,
    ])
    const central = Buffer.concat([
      Buffer.from('PK\u0001\u0002', 'binary'),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset),
      name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralBuf = Buffer.concat(centrals)
  const eocd = Buffer.concat([
    Buffer.from('PK\u0005\u0006', 'binary'),
    u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBuf.length), u32(offset), u16(0),
  ])
  return Buffer.concat([...locals, centralBuf, eocd])
}

function findVue(route) {
  const candidates = [
    path.join(ROOT, `${route}.vue`),
    path.join(ROOT, route, 'index.vue'),
  ]
  return candidates.find((f) => fs.existsSync(f))
}

function slug(route) {
  return route.replace(/[\\/]/g, '__')
}

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function writeFigmaZip(sourceDir, zipPath) {
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true })
  try {
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force`],
      { stdio: 'pipe' }
    )
    return true
  } catch (e) {
    console.warn('[zip] Compress-Archive 失败，改用内置 zip：', e.message)
    const files = fs.readdirSync(sourceDir).map((name) => ({
      name,
      data: fs.readFileSync(path.join(sourceDir, name)),
    }))
    fs.writeFileSync(zipPath, makeStoreZip(files))
    return false
  }
}

function main() {
  const started = Date.now()
  const pages = collectPages()
  const componentIndex = loadComponentIndex()
  const globalCss = loadGlobalCss()

  rmDir(path.join(OUT_DIR, 'h2d'))
  rmDir(path.join(OUT_DIR, 'zip'))
  rmDir(FIGMA_DIR)
  ensureDir(OUT_DIR)
  ensureDir(FIGMA_DIR)

  const catalog = []
  let ok = 0
  let skip = 0

  for (const page of pages) {
    const vueFile = findVue(page.route)
    if (!vueFile) {
      console.warn('[skip] 找不到页面', page.route)
      skip++
      continue
    }
    const styles = [globalCss]
    const converted = convertVueFile(vueFile, componentIndex, styles)
    const html = wrapHtml({
      title: page.title,
      route: page.route,
      body: converted.html,
      css: styles.join('\n'),
      customNav: page.customNav,
    })

    const htmlPath = path.join(OUT_DIR, `${page.route}.html`)
    ensureDir(path.dirname(htmlPath))
    fs.writeFileSync(htmlPath, html, 'utf8')

    const flatName = `${slug(page.route)}.html`
    fs.writeFileSync(path.join(FIGMA_DIR, flatName), html, 'utf8')

    catalog.push({ ...page, html: `${page.route}.html`, figma: `figma/${flatName}` })
    ok++
    console.log('[ok]', page.route)
  }

  const zipPath = path.join(OUT_DIR, 'figma-import.zip')
  writeFigmaZip(FIGMA_DIR, zipPath)

  const index = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>页面目录 · 导入 Figma</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 24px; background: #f5f5f5; max-width: 960px; }
    h1 { font-size: 20px; }
    p, li { color: #555; line-height: 1.6; }
    code { background: #eee; padding: 0 4px; border-radius: 4px; }
    .warn { background: #fff3cd; padding: 12px 16px; border-radius: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .card { background: #fff; padding: 14px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
    .title { font-weight: 600; margin-bottom: 6px; }
    .route { font-size: 12px; color: #888; word-break: break-all; margin-bottom: 8px; }
    a { color: #357ABD; font-size: 13px; }
  </style>
</head>
<body>
  <h1>静态页面目录（${catalog.length}）</h1>
  <div class="warn">
    <b>导入 Figma 请不要使用 .h2d。</b>那是 html.to.design 浏览器扩展专用格式，脚本无法生成。<br/>
    请打开插件 → <b>File</b> → 拖入 <code>figma-import.zip</code>，或一次选中 <code>figma/</code> 里的 HTML。
  </div>
  <p>设计稿宽度 ${VIEWPORT_W}px。可先用浏览器打开下面页面检查布局。</p>
  <div class="grid">
    ${catalog.map((p) => `
    <div class="card">
      <div class="title">${escapeHtml(p.title)}</div>
      <div class="route">${escapeHtml(p.route)}</div>
      <a href="${p.html}">预览 HTML</a>
    </div>`).join('')}
  </div>
</body>
</html>`
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), index, 'utf8')

  console.log(`\n完成：${ok} 页，跳过 ${skip}，耗时 ${Date.now() - started}ms`)
  console.log('请导入：', zipPath)
}

main()
