"use strict";
const common_vendor = require("../common/vendor.js");
const USER_MSG = "您所发布的内容含违规信息，请修改后重试";
function readLocalFileBase64(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const fs = common_vendor.index.getFileSystemManager();
      const base64 = fs.readFileSync(filePath, "base64");
      resolve(base64);
    } catch (e) {
      reject(e);
    }
  });
}
function getLocalFileSize(filePath) {
  return new Promise((resolve, reject) => {
    common_vendor.index.getFileInfo({
      filePath,
      success: (r) => resolve(r.size || 0),
      fail: reject
    });
  });
}
async function wxCheckLocalImageBeforeUpload(filePath) {
  const traceId = `wx-sec-${Date.now()}`;
  common_vendor.index.__f__("log", "at utils/wxContentSecurity.js:35", "[wxContentSecurity] 开始图片安全校验", { traceId, filePath: filePath && String(filePath).slice(-48) });
  if (!filePath) {
    throw new Error("未选择图片");
  }
  const size = await getLocalFileSize(filePath);
  common_vendor.index.__f__("log", "at utils/wxContentSecurity.js:40", "[wxContentSecurity] 本地文件大小", { traceId, size });
  if (size > 1024 * 1024) {
    throw new Error("图片需小于1MB，请压缩后重试");
  }
  const image_base64 = await readLocalFileBase64(filePath);
  common_vendor.index.__f__("log", "at utils/wxContentSecurity.js:45", "[wxContentSecurity] Base64 长度", { traceId, base64Len: image_base64 ? image_base64.length : 0 });
  const sec = common_vendor.tr.importObject("weixin-content-security", { customUI: true });
  const res = await sec.checkImageBase64({ image_base64 });
  common_vendor.index.__f__("log", "at utils/wxContentSecurity.js:48", "[wxContentSecurity] 云对象返回", {
    traceId,
    code: res && res.code,
    message: res && res.message,
    data: res && res.data
  });
  if (!res || res.code !== 0) {
    throw new Error(res && res.message || USER_MSG);
  }
  common_vendor.index.__f__("log", "at utils/wxContentSecurity.js:57", "[wxContentSecurity] 校验通过", { traceId });
  return true;
}
exports.wxCheckLocalImageBeforeUpload = wxCheckLocalImageBeforeUpload;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/wxContentSecurity.js.map
