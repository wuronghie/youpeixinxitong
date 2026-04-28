/**
 * 小程序端：上传图片前调用微信内容安全（经云对象 weixin-content-security）
 */

const USER_MSG = '您所发布的内容含违规信息，请修改后重试'

function readLocalFileBase64(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const fs = uni.getFileSystemManager()
      const base64 = fs.readFileSync(filePath, 'base64')
      resolve(base64)
    } catch (e) {
      reject(e)
    }
  })
}

function getLocalFileSize(filePath) {
  return new Promise((resolve, reject) => {
    uni.getFileInfo({
      filePath,
      success: (r) => resolve(r.size || 0),
      fail: reject
    })
  })
}

/**
 * 本地图片上传 uniCloud 前调用：通过微信 img_sec_check
 * @param {string} filePath 本地临时路径
 */
export async function wxCheckLocalImageBeforeUpload(filePath) {
  const traceId = `wx-sec-${Date.now()}`
  console.log('[wxContentSecurity] 开始图片安全校验', { traceId, filePath: filePath && String(filePath).slice(-48) })
  if (!filePath) {
    throw new Error('未选择图片')
  }
  const size = await getLocalFileSize(filePath)
  console.log('[wxContentSecurity] 本地文件大小', { traceId, size })
  if (size > 1024 * 1024) {
    throw new Error('图片需小于1MB，请压缩后重试')
  }
  const image_base64 = await readLocalFileBase64(filePath)
  console.log('[wxContentSecurity] Base64 长度', { traceId, base64Len: image_base64 ? image_base64.length : 0 })
  const sec = uniCloud.importObject('weixin-content-security', { customUI: true })
  const res = await sec.checkImageBase64({ image_base64 })
  console.log('[wxContentSecurity] 云对象返回', {
    traceId,
    code: res && res.code,
    message: res && res.message,
    data: res && res.data
  })
  if (!res || res.code !== 0) {
    throw new Error((res && res.message) || USER_MSG)
  }
  console.log('[wxContentSecurity] 校验通过', { traceId })
  return true
}

export { USER_MSG as WX_CONTENT_SECURITY_USER_MSG }
