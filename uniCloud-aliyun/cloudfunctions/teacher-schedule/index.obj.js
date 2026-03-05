/**
 * 教师时间设置云对象
 * 功能：获取与保存教师的可预约时间安排
 * 使用 uni-id-common 进行身份校验
 */

const uniID = require('uni-id-common')

function success(data = null, message = 'success') {
  return {
    code: 0,
    message,
    data,
    timestamp: Date.now()
  }
}

function error(message = 'error', code = -1, data = null) {
  return {
    code,
    message,
    data,
    timestamp: Date.now()
  }
}

const DEFAULT_TIME_SLOTS = [
  { start_time: '09:00', end_time: '11:00', is_available: false },
  { start_time: '14:00', end_time: '16:00', is_available: false },
  { start_time: '19:00', end_time: '21:00', is_available: false }
]

function createDefaultSchedule(teacher_id) {
  const week = []
  for (let i = 0; i < 7; i++) {
    week.push({
      day_of_week: i,
      time_slots: DEFAULT_TIME_SLOTS.map(slot => ({ ...slot }))
    })
  }

  return {
    teacher_id,
    available_times: week,
    blocked_dates: [],
    special_available_dates: [],
    update_time: Date.now()
  }
}

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({
      clientInfo
    })
  },

  /**
   * 获取教师的时间设置
   * @returns {Object}
   */
  async getSchedule() {
    const db = uniCloud.database()

    try {
      const token = this.getUniIdToken()
      let teacher_id

      if (!token) {
        return error('未获取到token，请先登录')
      }

      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          throw new Error(payload.message || 'token校验失败')
        }
        teacher_id = payload.uid
      } catch (tokenError) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } catch (decodeError) {
          teacher_id = null
        }
      }

      if (!teacher_id) {
        return error('token验证失败，请重新登录')
      }

      const scheduleCollection = db.collection('teacher-schedule')
      let scheduleDoc = await scheduleCollection.where({ teacher_id }).limit(1).get()

      if (!scheduleDoc.data || scheduleDoc.data.length === 0) {
        const defaultSchedule = createDefaultSchedule(teacher_id)
        const addRes = await scheduleCollection.add(defaultSchedule)
        if (!addRes.id) {
          return error('初始化时间设置失败')
        }
        scheduleDoc = {
          data: [defaultSchedule]
        }
      }

      const schedule = scheduleDoc.data[0]

      // 确保 available_times 按 day_of_week 排序且结构完整
      const weekMap = new Map()
      ;(schedule.available_times || []).forEach(item => {
        if (typeof item.day_of_week === 'number') {
          weekMap.set(item.day_of_week, {
            day_of_week: item.day_of_week,
            time_slots: (item.time_slots || []).map(slot => ({
              start_time: slot.start_time,
              end_time: slot.end_time,
              is_available: slot.is_available === undefined ? true : slot.is_available
            }))
          })
        }
      })

      const normalizedWeek = []
      for (let i = 0; i < 7; i++) {
        if (weekMap.has(i)) {
          const entry = weekMap.get(i)
          normalizedWeek.push({
            day_of_week: i,
            time_slots: entry.time_slots
          })
        } else {
          normalizedWeek.push({
            day_of_week: i,
            time_slots: DEFAULT_TIME_SLOTS.map(slot => ({ ...slot }))
          })
        }
      }

      return success({
        teacher_id,
        available_times: normalizedWeek,
        blocked_dates: schedule.blocked_dates || [],
        special_available_dates: schedule.special_available_dates || []
      })
    } catch (e) {
      console.error('[teacher-schedule] 获取时间设置失败', e)
      return error(e.message || '获取时间设置失败')
    }
  },

  /**
   * 保存教师时间设置
   * @param {Object} params
   * @param {Array} params.available_times
   * @param {Array} params.blocked_dates
   * @param {Array} params.special_available_dates
   */
  async saveSchedule(params) {
    const db = uniCloud.database()

    try {
      const token = this.getUniIdToken()
      let teacher_id

      if (!token) {
        return error('未获取到token，请先登录')
      }

      try {
        const payload = await this.uniID.checkToken(token)
        if (payload.code) {
          throw new Error(payload.message || 'token校验失败')
        }
        teacher_id = payload.uid
      } catch (tokenError) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8')
          const parts = decoded.split('_')
          teacher_id = parts.length >= 1 ? parts[0] : null
        } catch (decodeError) {
          teacher_id = null
        }
      }

      if (!teacher_id) {
        return error('token验证失败，请重新登录')
      }

      const {
        available_times = [],
        blocked_dates = [],
        special_available_dates = []
      } = params

      // 简单校验 available_times 结构
      const normalizedWeek = []
      for (let i = 0; i < 7; i++) {
        normalizedWeek.push({
          day_of_week: i,
          time_slots: DEFAULT_TIME_SLOTS.map(slot => ({ ...slot }))
        })
      }

      available_times.forEach(item => {
        if (
          typeof item.day_of_week === 'number' &&
          item.day_of_week >= 0 &&
          item.day_of_week <= 6
        ) {
          const timeSlots = Array.isArray(item.time_slots) ? item.time_slots : []
          normalizedWeek[item.day_of_week] = {
            day_of_week: item.day_of_week,
            time_slots: timeSlots.map(slot => ({
              start_time: slot.start_time,
              end_time: slot.end_time,
              is_available: slot.is_available === undefined ? true : !!slot.is_available
            }))
          }
        }
      })

      const scheduleCollection = db.collection('teacher-schedule')
      const scheduleDoc = await scheduleCollection.where({ teacher_id }).limit(1).get()

      const dataToSave = {
        available_times: normalizedWeek,
        blocked_dates: Array.isArray(blocked_dates) ? blocked_dates : [],
        special_available_dates: Array.isArray(special_available_dates) ? special_available_dates : [],
        update_time: Date.now()
      }

      if (scheduleDoc.data && scheduleDoc.data.length > 0) {
        await scheduleCollection.doc(scheduleDoc.data[0]._id).update(dataToSave)
      } else {
        await scheduleCollection.add({
          teacher_id,
          ...dataToSave
        })
      }

      return success(null, '保存成功')
    } catch (e) {
      console.error('[teacher-schedule] 保存时间设置失败', e)
      return error(e.message || '保存失败')
    }
  }
}

