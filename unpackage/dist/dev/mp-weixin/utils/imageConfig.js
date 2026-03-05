"use strict";
const CDN_BASE_URL = "https://mp-feefb659-358b-4c0f-938b-e3764472432b.cdn.bspapp.com";
function getStaticImageUrl(path) {
  if (path && (path.startsWith("http://") || path.startsWith("https://"))) {
    return path;
  }
  if (path && path.startsWith("/static/")) {
    return `${CDN_BASE_URL}${path}`;
  }
  if (path && path.startsWith("static/")) {
    return `${CDN_BASE_URL}/${path}`;
  }
  return path;
}
function getLogoUrl() {
  return getStaticImageUrl("/static/logo.png");
}
function getDefaultAvatarUrl() {
  return getStaticImageUrl("/static/default-avatar.png");
}
function getIconUrl(iconName) {
  return getStaticImageUrl(`/static/icons/${iconName}`);
}
exports.getDefaultAvatarUrl = getDefaultAvatarUrl;
exports.getIconUrl = getIconUrl;
exports.getLogoUrl = getLogoUrl;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/imageConfig.js.map
