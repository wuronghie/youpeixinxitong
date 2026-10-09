/**
 * 主包旧路径转到 pages-biz 分包，保留 query（兼容服务号/分享旧链接）
 */
export function redirectWithQuery(targetPath, options) {
	const query = Object.keys(options || {})
		.filter((key) => options[key] !== undefined && options[key] !== null && options[key] !== '')
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
		.join('&')
	uni.redirectTo({
		url: query ? `${targetPath}?${query}` : targetPath
	})
}

export default { redirectWithQuery }
