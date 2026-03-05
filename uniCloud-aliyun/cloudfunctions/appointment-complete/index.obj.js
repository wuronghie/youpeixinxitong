/**
 * 完成课程云对象
 * 功能：课程完成、试课结算、退款处理
 */

// 工具函数（内嵌）
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

/**
 * 计算课程结束时间戳
 * @param {Object} appointment 预约信息
 * @returns {Number|null} 结束时间戳（毫秒）
 */
function getAppointmentEndTimestamp(appointment) {
  if (!appointment || !appointment.date || !appointment.start_time) {
    return null
  }
  const startTimeStr = `${appointment.date} ${appointment.start_time}`
  const startDate = new Date(startTimeStr.replace(/-/g, '/'))
  if (Number.isNaN(startDate.getTime())) {
    return null
  }
  const durationHours = Number(appointment.duration) || 0
  if (durationHours <= 0) {
    return null
  }
  return startDate.getTime() + durationHours * 60 * 60 * 1000
}

/**
 * 确保教师钱包存在，如果不存在则创建
 * @param {String} teacherId 教师ID
 * @returns {Object} 钱包对象
 */
async function ensureTeacherWallet(teacherId) {
  const db = uniCloud.database()
  const walletCollection = db.collection('teacher-wallet')
  
  // 查询钱包
  const walletDoc = await walletCollection.where({ teacher_id: teacherId }).get()
  
  if (walletDoc.data && walletDoc.data.length > 0) {
    return walletDoc.data[0]
  }
  
  // 如果不存在，创建钱包
  const now = Date.now()
  const result = await walletCollection.add({
    teacher_id: teacherId,
    balance: 0,
    frozen_amount: 0,
    total_income: 0,
    total_withdraw: 0,
    deposit_total: 0,
    deposit_refunded: 0,
    create_time: now,
    update_time: now
  })
  
  // 返回新创建的钱包
  const newWalletDoc = await walletCollection.doc(result.id).get()
  return newWalletDoc.data[0]
}

/**
 * 更新教师钱包余额
 * @param {String} teacherId 教师ID
 * @param {Number} income 收入金额
 * @param {Number} depositAmount 保证金金额（可选）
 */
async function updateTeacherWallet(teacherId, income = 0, depositAmount = 0) {
  const wallet = await ensureTeacherWallet(teacherId)
  const db = uniCloud.database()
  
  const updateData = {
    update_time: Date.now()
  }
  
  // 确保金额是数字类型，并保留两位小数
  const incomeNum = Number(income) || 0
  const depositNum = Number(depositAmount) || 0
  
  if (incomeNum > 0) {
    // 确保金额精度，保留两位小数
    const incomeRounded = Number(incomeNum.toFixed(2))
    updateData.balance = Number(((wallet.balance || 0) + incomeRounded).toFixed(2))
    updateData.total_income = Number(((wallet.total_income || 0) + incomeRounded).toFixed(2))
    console.log(`[钱包更新] 收入: ${incomeRounded}元, 余额: ${updateData.balance}元, 总收入: ${updateData.total_income}元`)
  }
  
  if (depositNum > 0) {
    const depositRounded = Number(depositNum.toFixed(2))
    updateData.balance = Number(((updateData.balance || wallet.balance || 0) + depositRounded).toFixed(2))
    updateData.deposit_refunded = Number(((wallet.deposit_refunded || 0) + depositRounded).toFixed(2))
    console.log(`[钱包更新] 保证金退还: ${depositRounded}元`)
  }
  
  await db.collection('teacher-wallet').doc(wallet._id).update(updateData)
  
  console.log(`[钱包更新完成] teacherId=${teacherId}, income=${incomeNum}元, deposit=${depositNum}元, 最终余额=${updateData.balance || wallet.balance}元`)
}

module.exports = {
  _before: function() {
    // 云对象前置方法
  },
  
  /**
   * 家长确认试课成功
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @returns {Object}
   */
  async confirmTrialSuccess(params) {
    const { appointment_id } = params
    
    try {
      const db = uniCloud.database()
      
      // 2. 查询预约
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 3. 验证状态（权限验证已在调用方完成）
      
      if (appointment.course_type !== 'trial') {
        return error('只有试课可以确认成功')
      }
      
      if (appointment.status !== 'confirmed' && appointment.status !== 'in_progress') {
        return error('当前预约状态不允许确认')
      }
      
      // 4.1 检查课程是否已结束
      const endTimestamp = getAppointmentEndTimestamp(appointment)
      if (!endTimestamp) {
        return error('课程时间信息缺失，暂不可确认')
      }
      if (Date.now() < endTimestamp) {
        return error('课程尚未结束，请在课程结束后再确认')
      }
      
      // 4. 获取平台费率配置（用于计算平台抽成）
      const configDoc = await db.collection('system-config')
        .where({ config_key: 'platform_fee_rate' })
        .get()
      
      const platformFeeRate = configDoc.data[0]?.config_value || 0.1
      
      // 5. 计算费用
      // 试课成功后，平台抽取一节课的费用作为中介费（目前为 1 节课金额）
      const durationHours = Number(appointment.duration || 2)
      const hourlyRate = Number(appointment.hourly_rate || 0)
      const totalAmount = Number(appointment.total_amount || 0)
      const oneLessonFee = hourlyRate * durationHours
      const platformFee = oneLessonFee
      const teacherIncome = totalAmount - platformFee
      
      console.log('[confirmTrialSuccess] 试课结算计算结果:', {
        appointment_id,
        course_type: appointment.course_type,
        durationHours,
        hourlyRate,
        totalAmount,
        oneLessonFee,
        platformFee,
        teacherIncome
      })
      
      // 6. 更新预约状态与结算字段
      await db.collection('appointments').doc(appointment_id).update({
        status: 'completed',
        complete_time: Date.now(),
        trial_result: 'success',
        platform_fee: platformFee,
        teacher_income: teacherIncome,
        update_time: Date.now()
      })
      
      // 7. 更新教师钱包
      // 注意：保证金为不退还规则，这里只结算教师收入，不再退还保证金
      await updateTeacherWallet(appointment.teacher_id, teacherIncome, 0)
      
      // 8. 更新教师试课统计数据
      // 计算试课统计数据
      const dbCmd = db.command
      const trialAppointments = await db.collection('appointments')
        .where({
          teacher_id: appointment.teacher_id,
          course_type: 'trial',
          status: dbCmd.in(['completed', 'refunded', 'cancelled'])
        })
        .get()
      
      const trialCount = trialAppointments.data ? trialAppointments.data.length : 0
      const trialSuccessCount = trialAppointments.data 
        ? trialAppointments.data.filter(a => a.status === 'completed' && a.trial_result === 'success').length 
        : 0
      const trialSuccessRate = trialCount > 0 ? (trialSuccessCount / trialCount) : 0
      
      await db.collection('teacher-profiles')
        .where({ teacher_id: appointment.teacher_id })
        .update({
          total_courses: db.command.inc(1),
          total_students: db.command.inc(1),
          trial_count: trialCount,
          trial_success_count: trialSuccessCount,
          trial_success_rate: Number(trialSuccessRate.toFixed(2)),
          update_time: Date.now()
        })
      
      console.log('试课成功确认，教师收益已结算')
      
      return success({
        appointment_id,
        status: 'completed',
        platform_fee: platformFee,
        teacher_income: teacherIncome,
        can_review: true
      }, '试课已完成，可以评价教师了')
      
    } catch (e) {
      console.error('确认试课成功失败:', e)
      return error(e.message || '操作失败')
    }
  },
  
  /**
   * 家长确认试课不满意，申请退款
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {String} params.reason 不满意原因
   * @returns {Object}
   */
  async requestRefund(params) {
    const { appointment_id, reason = '' } = params
    
    try {
      const db = uniCloud.database()
      
      // 1. 验证用户登录状态（解析 uniIdToken，兼容简单 token）
      const token = this.getClientInfo().uniIdToken
      let parent_id
      if (!token) {
        return error('请先登录')
      }
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const parts = decoded.split('_')
        parent_id = parts.length >= 1 ? parts[0] : null
      } catch (e) {
        console.error('解析token失败:', e)
        return error('token验证失败，请重新登录')
      }
      if (!parent_id) {
        return error('token验证失败，请重新登录')
      }
      
      // 2. 查询预约
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 3. 验证权限和状态
      if (appointment.parent_id !== parent_id) {
        return error('只能操作自己的预约')
      }
      
      if (appointment.course_type !== 'trial') {
        return error('只有试课可以申请退款')
      }
      
      if (appointment.status !== 'confirmed' && appointment.status !== 'in_progress') {
        return error('当前预约状态不允许退款')
      }
      
      // 4. 获取退款比例配置
      const configDoc = await db.collection('system-config')
        .where({ config_key: 'trial_refund_rate' })
        .get()
      
      const refundRate = configDoc.data[0]?.config_value || 0.5
      
      // 5. 计算退款金额（50%，即1小时费用）
      // 试课价格为2小时费用，不满意退款50%即1小时费用
      const refundAmount = appointment.total_amount * refundRate
      
      // 6. 更新预约状态
      await db.collection('appointments').doc(appointment_id).update({
        status: 'refunded',
        refund_time: Date.now(),
        refund_reason: reason,
        refund_amount: refundAmount,
        trial_result: 'fail',
        update_time: Date.now()
      })
      
      // 7. 创建退款订单
      const refundOrder = {
        order_no: 'RFD' + Date.now() + Math.floor(Math.random() * 10000),
        appointment_id,
        payer_id: 'platform',
        payee_id: parent_id,
        order_type: 'refund',
        total_amount: refundAmount,
        status: 'paid',
        payment_time: Date.now(),
        create_time: Date.now(),
        update_time: Date.now()
      }
      
      await db.collection('payment-orders').add(refundOrder)
      
      // 8. 扣除教师保证金（不退还）
      // 保证金作为违约金不予退还
      
      // 9. 更新教师试课统计数据
      const dbCmd = db.command
      const trialAppointments = await db.collection('appointments')
        .where({
          teacher_id: appointment.teacher_id,
          course_type: 'trial',
          status: dbCmd.in(['completed', 'refunded', 'cancelled'])
        })
        .get()
      
      const trialCount = trialAppointments.data ? trialAppointments.data.length : 0
      const trialSuccessCount = trialAppointments.data 
        ? trialAppointments.data.filter(a => a.status === 'completed' && a.trial_result === 'success').length 
        : 0
      const trialSuccessRate = trialCount > 0 ? (trialSuccessCount / trialCount) : 0
      
      await db.collection('teacher-profiles')
        .where({ teacher_id: appointment.teacher_id })
        .update({
          trial_count: trialCount,
          trial_success_count: trialSuccessCount,
          trial_success_rate: Number(trialSuccessRate.toFixed(2)),
          update_time: Date.now()
        })
      
      console.log('退款申请已处理，退款50%')
      
      return success({
        appointment_id,
        status: 'refunded',
        refund_amount: refundAmount,
        refund_rate: refundRate
      }, `退款成功，已退还${refundRate * 100}%费用`)
      
    } catch (e) {
      console.error('申请退款失败:', e)
      return error(e.message || '退款失败')
    }
  },
  
  /**
   * 正式课程完成
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @returns {Object}
   */
  async completeCourse(params) {
    const { appointment_id } = params
    
    try {
      const db = uniCloud.database()
      
      // 2. 查询预约
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 3. 验证状态
      if (appointment.course_type !== 'regular') {
        return error('只有正式课程可以执行此操作')
      }
      
      if (appointment.status !== 'confirmed' && appointment.status !== 'in_progress') {
        return error('当前预约状态不允许完成')
      }
      
      // 4. 更新预约状态
      await db.collection('appointments').doc(appointment_id).update({
        status: 'completed',
        complete_time: Date.now(),
        update_time: Date.now()
      })
      
      // 5. 计算教师收入（如果预约中没有，则直接等于家长支付总金额，不再扣除平台手续费）
      let teacherIncome = appointment.teacher_income
      if (!teacherIncome || teacherIncome <= 0) {
        const totalAmount = Number(appointment.total_amount || 0)
        teacherIncome = totalAmount
        // 更新预约中的teacher_income，并将平台服务费设为 0（不再扣费）
        await db.collection('appointments').doc(appointment_id).update({
          teacher_income: teacherIncome,
          platform_fee: 0
        })
      }
      
      // 确保 teacherIncome 是数字类型
      teacherIncome = Number(teacherIncome) || 0
      console.log(`[完成课程] 计算教师收入: appointment.total_amount=${appointment.total_amount}, teacherIncome=${teacherIncome}`)
      
      // 6. 更新教师钱包
      if (teacherIncome > 0) {
        await updateTeacherWallet(appointment.teacher_id, teacherIncome, 0)
      } else {
        console.warn(`[完成课程] 教师收入为0或无效，跳过钱包更新: teacherIncome=${teacherIncome}`)
      }
      
      // 7. 更新教师统计
      await db.collection('teacher-profiles')
        .where({ teacher_id: appointment.teacher_id })
        .update({
          total_courses: db.command.inc(1),
          update_time: Date.now()
        })
      
      console.log('正式课程已完成')
      
      return success({
        appointment_id,
        status: 'completed',
        can_review: true
      }, '课程已完成，可以评价教师了')
      
    } catch (e) {
      console.error('完成课程失败:', e)
      return error(e.message || '操作失败')
    }
  },
  
  /**
   * 获取用户信息（内部方法）
   */
  getClientInfo() {
    return this.getUniCloudClientInfo ? this.getUniCloudClientInfo() : {}
  }
}

