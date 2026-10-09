/**
 * 腾讯地图逆地理：把经纬度转成含街道/门牌/POI 的详细地址
 * 打卡放在云端做，避免体验版未配 request 合法域名导致解析失败
 */

const TENCENT_MAP_KEY = 'TEFBZ-IGS6L-EUIPR-MUGXC-KRCRS-W4FRX'

function pickDetailedAddress(result) {
  if (!result || typeof result !== 'object') return ''
  const formatted = result.formatted_addresses || {}
  const recommend = String(formatted.recommend || '').trim()
  const standard = String(result.address || '').trim()
  const comp = result.address_component || {}
  const poi = (Array.isArray(result.pois) && result.pois[0]) || {}
  const refs = result.address_reference || {}
  const landmark = refs.landmark_l2 || refs.landmark_l1 || refs.famous_area || {}
  const poiTitle = String(poi.title || landmark.title || '').trim()

  if (recommend) {
    if (poiTitle && recommend.indexOf(poiTitle) === -1) {
      return recommend + '（' + poiTitle + '）'
    }
    return recommend
  }

  const city = comp.city && comp.city !== comp.province ? comp.city : ''
  const assembled = [
    comp.province,
    city,
    comp.district,
    comp.street,
    comp.street_number,
    poiTitle
  ].filter(Boolean).join('')

  return assembled || standard
}

function isWeakAddress(address) {
  const text = String(address || '').trim()
  if (!text) return true
  if (/^已定位\s*\(/i.test(text)) return true
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(text)) return true
  return text.length < 8
}

async function reverseGeocodeDetailed(latitude, longitude) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''

  const poiOptions = encodeURIComponent('address_format=short;radius=300;policy=2')
  const url =
    'https://apis.map.qq.com/ws/geocoder/v1/?location=' +
    encodeURIComponent(lat + ',' + lng) +
    '&key=' + encodeURIComponent(TENCENT_MAP_KEY) +
    '&get_poi=1&poi_options=' + poiOptions

  try {
    const res = await uniCloud.httpclient.request(url, {
      method: 'GET',
      dataType: 'json',
      timeout: 8000
    })
    const data = res && res.data
    if (!data || Number(data.status) !== 0) {
      console.warn('[appointment-attendance] 逆地理失败', data && (data.status + ' ' + data.message))
      return ''
    }
    const address = pickDetailedAddress(data.result)
    console.log('[appointment-attendance] 逆地理成功', {
      address,
      hasRecommend: !!(data.result && data.result.formatted_addresses && data.result.formatted_addresses.recommend),
      poiCount: (data.result && data.result.pois && data.result.pois.length) || 0
    })
    return address
  } catch (e) {
    console.warn('[appointment-attendance] 逆地理请求异常', e && (e.message || e))
    return ''
  }
}

module.exports = {
  pickDetailedAddress,
  isWeakAddress,
  reverseGeocodeDetailed
}
