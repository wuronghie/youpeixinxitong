/**
 * 小程序端：上传图片前调用微信内容安全（经云对象 weixin-content-security）
 */

const USER_MSG = '您所发布的内容含违规信息，请修改后重试'
const AVATAR_MSG = '头像未通过微信安全检测，请换一张清晰正面照片，或裁剪压缩后重试'
const CLOUD_TIMEOUT_MS = 45000

function readLocalFileBase64(filePath) {
  try {
    const fs = uni.getFileSystemManager()
    return fs.readFileSync(filePath, 'base64')
  } catch (e) {
    throw new Error('无法读取图片文件，请重新选择')
  }
}

function getLocalFileSize(filePath) {
  const fs = uni.getFileSystemManager()
  try {
    const stat = fs.statSync(filePath)
    return stat.size || 0
  } catch (e) {
    throw new Error('无法读取图片文件，请重新选择')
  }
}

function compressImage(filePath, quality = 80) {
  return new Promise((resolve, reject) => {
    uni.compressImage({
      src: filePath,
      quality,
      success: (res) => resolve(res.tempFilePath || filePath),
      fail: (err) => reject(err || new Error('图片压缩失败'))
    })
  })
}

function isPngPath(filePath) {
  return /\.png$/i.test(String(filePath || ''))
}

/**
 * 压缩至微信 img_sec_check 要求的 ≤1MB
 * @returns {Promise<{ path: string, size: number }>}
 */
async function prepareImageForSecurityCheck(filePath) {
  let path = filePath
  let size = getLocalFileSize(path)
  const needCompress = size > 800 * 1024 || isPngPath(path)

  if (needCompress) {
    path = await compressImage(path, size > 1024 * 1024 ? 60 : 80)
    size = getLocalFileSize(path)
  }
  if (size > 1024 * 1024) {
    path = await compressImage(path, 50)
    size = getLocalFileSize(path)
  }
  if (size > 1024 * 1024) {
    throw new Error('图片需小于1MB，请压缩后重试')
  }
  if (!size) {
    throw new Error('图片文件无效，请重新选择')
  }
  return { path, size }
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms)
    })
  ])
}

/**
 * 本地图片上传 uniCloud 前调用：通过微信 img_sec_check
 * @param {string} filePath 本地临时路径
 * @param {{ scene?: 'avatar' }} [options]
 * @returns {Promise<string>} 校验通过后的本地路径（可能经压缩）
 */
export async function wxCheckLocalImageBeforeUpload(filePath, options = {}) {
  const traceId = `wx-sec-${Date.now()}`
  const scene = options.scene || ''
  console.log('[wxContentSecurity] 开始图片安全校验', { traceId, filePath: filePath && String(filePath).slice(-48), scene })
  if (!filePath) {
    throw new Error('未选择图片')
  }

  const { path: preparedPath, size } = await prepareImageForSecurityCheck(filePath)
  console.log('[wxContentSecurity] 本地文件大小', { traceId, size, prepared: preparedPath !== filePath })

  const image_base64 = readLocalFileBase64(preparedPath)
  console.log('[wxContentSecurity] Base64 长度', { traceId, base64Len: image_base64 ? image_base64.length : 0 })

  const sec = uniCloud.importObject('weixin-content-security', { customUI: true })
  const res = await withTimeout(
    sec.checkImageBase64({ image_base64, scene }),
    CLOUD_TIMEOUT_MS,
    '内容安全检测超时，请稍后重试'
  )
  console.log('[wxContentSecurity] 云对象返回', {
    traceId,
    code: res && res.code,
    message: res && res.message,
    data: res && res.data
  })

  if (!res || res.code !== 0) {
    const fallback = scene === 'avatar' ? AVATAR_MSG : USER_MSG
    throw new Error((res && res.message) || fallback)
  }
  console.log('[wxContentSecurity] 校验通过', { traceId })
  return preparedPath
}

export { USER_MSG as WX_CONTENT_SECURITY_USER_MSG, AVATAR_MSG as WX_CONTENT_SECURITY_AVATAR_MSG }
