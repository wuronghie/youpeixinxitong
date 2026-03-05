/**
 * 教师确认预约云对象
 * 功能：教师确认预约，需支付保证金
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

module.exports = {
  _before: function() {
    // 云对象前置方法
  },
  
  /**
   * 教师获取待确认的预约列表
   * @returns {Object}
   */
  async getPendingList() {
    try {
      const db = uniCloud.database()
      const uniIdCommon = require('uni-id-common')
      
      // 1. 验证用户登录状态
      const payload = await uniIdCommon.checkToken(this.getClientInfo().uniIdToken)
      if (!payload || !payload.uid) {
        return error('请先登录')
      }
      
      const teacher_id = payload.uid
      
      // 验证教师角色
      const userDoc = await db.collection('uni-id-users').doc(teacher_id).get()
      if (!userDoc.data || userDoc.data.length === 0 || userDoc.data[0].role !== 'teacher') {
        return error('只有教师可以查看预约')
      }
      
      // 2. 查询待确认的预约
      const result = await db.collection('appointments')
        .where({
          teacher_id,
          status: 'pending_confirm'
        })
        .orderBy('create_time', 'desc')
        .get()
      
      // 3. 关联家长信息
      if (result.data && result.data.length > 0) {
        const parentIds = [...new Set(result.data.map(item => item.parent_id))]
        const parents = await db.collection('uni-id-users')
          .where({ _id: db.command.in(parentIds) })
          .field({ _id: true, nickname: true, avatar: true })
          .get()
        
        const parentMap = {}
        parents.data.forEach(p => {
          parentMap[p._id] = p
        })
        
        result.data.forEach(item => {
          item.parent_info = parentMap[item.parent_id] || {}
        })
      }
      
      console.log(`查询到${result.data.length}条待确认预约`)
      
      return success({
        list: result.data,
        total: result.data.length
      })
      
    } catch (e) {
      console.error('查询待确认预约失败:', e)
      return error(e.message || '查询失败')
    }
  },
  
  /**
   * 教师确认预约（需要先支付保证金）
   * 这个方法仅检查状态，实际确认在支付保证金后自动完成
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @returns {Object}
   */
  async confirm(params) {
    const { appointment_id } = params
    
    try {
      const db = uniCloud.database()
      const uniIdCommon = require('uni-id-common')
      
      // 1. 验证用户登录状态
      const payload = await uniIdCommon.checkToken(this.getClientInfo().uniIdToken)
      if (!payload || !payload.uid) {
        return error('请先登录')
      }
      
      const teacher_id = payload.uid
      
      // 2. 查询预约
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 3. 验证权限
      if (appointment.teacher_id !== teacher_id) {
        return error('只能确认自己的预约')
      }
      
      if (appointment.status !== 'pending_confirm') {
        return error('当前预约状态不允许确认')
      }
      
      // 4. 获取保证金金额
      const configDoc = await db.collection('system-config')
        .where({ config_key: 'teacher_deposit_amount' })
        .get()
      
      const depositAmount = configDoc.data[0]?.config_value || 1
      
      // 5. 返回需要支付保证金的信息
      return success({
        appointment_id,
        appointment_no: appointment.appointment_no,
        deposit_amount: depositAmount,
        need_pay_deposit: true,
        tips: '请先支付保证金以确认预约并开启聊天功能'
      }, '请支付保证金')
      
    } catch (e) {
      console.error('确认预约失败:', e)
      return error(e.message || '确认预约失败')
    }
  },
  
  /**
   * 教师拒绝预约
   * @param {Object} params
   * @param {String} params.appointment_id 预约ID
   * @param {String} params.reason 拒绝原因
   * @returns {Object}
   */
  async reject(params) {
    const { appointment_id, reason = '' } = params
    
    try {
      const db = uniCloud.database()
      const uniIdCommon = require('uni-id-common')
      
      // 1. 验证用户登录状态
      const payload = await uniIdCommon.checkToken(this.getClientInfo().uniIdToken)
      if (!payload || !payload.uid) {
        return error('请先登录')
      }
      
      const teacher_id = payload.uid
      
      // 2. 查询预约
      const appointmentDoc = await db.collection('appointments').doc(appointment_id).get()
      
      if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
        return error('预约不存在')
      }
      
      const appointment = appointmentDoc.data[0]
      
      // 3. 验证权限
      if (appointment.teacher_id !== teacher_id) {
        return error('只能操作自己的预约')
      }
      
      if (appointment.status !== 'pending_confirm') {
        return error('当前预约状态不允许拒绝')
      }
      
      // 4. 更新预约状态为已拒绝
      await db.collection('appointments').doc(appointment_id).update({
        status: 'rejected',
        reject_reason: reason,
        reject_time: Date.now(),
        update_time: Date.now()
      })
      
      // 5. 退款给家长（试课费全额退款）
      // 创建退款订单
      const refundOrder = {
        order_no: 'RFD' + Date.now() + Math.floor(Math.random() * 10000),
        appointment_id,
        payer_id: 'platform',  // 平台退款
        payee_id: appointment.parent_id,  // 退给家长
        order_type: 'refund',
        total_amount: appointment.total_amount,
        status: 'paid',  // 直接标记为已完成
        payment_time: Date.now(),
        create_time: Date.now(),
        update_time: Date.now()
      }
      
      await db.collection('payment-orders').add(refundOrder)
      
      console.log('预约已拒绝，费用已退款')
      
      return success({
        appointment_id,
        status: 'rejected',
        refund_amount: appointment.total_amount
      }, '预约已拒绝，费用已全额退款给家长')
      
    } catch (e) {
      console.error('拒绝预约失败:', e)
      return error(e.message || '拒绝预约失败')
    }
  },
  
  /**
   * 获取用户信息（内部方法）
   */
  getClientInfo() {
    return this.getUniCloudClientInfo ? this.getUniCloudClientInfo() : {}
  }
}

