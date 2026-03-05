/**
 * 图片资源配置
 * 所有图片已上传到CDN，使用URL引入
 * 
 * 使用说明：
 * - static文件夹已删除，所有图片都从CDN加载
 * - 使用 getStaticImageUrl() 函数将 /static/ 路径转换为CDN URL
 */

// ========== CDN配置 ==========
// uniCloud云存储下载域名
const CDN_BASE_URL = 'https://mp-feefb659-358b-4c0f-938b-e3764472432b.cdn.bspapp.com'
// =============================

/**
 * 将 static 路径转换为CDN URL
 * @param {String} path 图片路径（如：/static/logo.png 或 /static/icons/xxx.png）
 * @returns {String} 完整的CDN URL
 */
export function getStaticImageUrl(path) {
  // 如果已经是完整URL（http:// 或 https://），直接返回
  if (path && (path.startsWith('http://') || path.startsWith('https://'))) {
    return path
  }
  
  // 如果是 /static/ 路径，转换为CDN URL
  if (path && path.startsWith('/static/')) {
    return `${CDN_BASE_URL}${path}`
  }
  
  // 如果没有 /static/ 前缀但有 static/，也处理
  if (path && path.startsWith('static/')) {
    return `${CDN_BASE_URL}/${path}`
  }
  
  // 其他情况返回原路径（可能是完整URL或其他格式）
  return path
}

/**
 * 获取Logo图片URL
 * @returns {String} Logo图片URL
 */
export function getLogoUrl() {
  return getStaticImageUrl('/static/logo.png')
}

/**
 * 获取默认头像URL
 * @returns {String} 默认头像URL
 */
export function getDefaultAvatarUrl() {
  return getStaticImageUrl('/static/default-avatar.png')
}

/**
 * 获取图标URL
 * @param {String} iconName 图标文件名（如：favorite-filled.png）
 * @returns {String} 图标完整URL
 */
export function getIconUrl(iconName) {
  return getStaticImageUrl(`/static/icons/${iconName}`)
}

// 导出CDN基础URL，供其他地方使用
export { CDN_BASE_URL }

