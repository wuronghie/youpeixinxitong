'use strict';
/**
 * uni-pay 支付成功回调（业务：appointment）
 * 说明：
 * - uni-pay 会根据前端传入的 type，调用 uni-pay-co/notify/<type>.js
 * - 本项目在前端使用 type: 'appointment'
 * - 因此需要本文件来把支付结果同步到业务表 appointments
 *
 * 注意：
 * - 回调要求尽量在 4 秒内完成，避免第三方超时
 * - 这里只做“更新订单状态”的最小逻辑，其他复杂业务建议异步处理
 */

module.exports = async (obj) => {
  let user_order_success = true;
  const startTime = Date.now();
  
  console.log('[notify:appointment] ========== 回调开始 ==========');
  console.log('[notify:appointment] 接收到的参数 obj:', JSON.stringify(obj, null, 2));
  
  try {
    const { data = {} } = obj;
    console.log('[notify:appointment] 解析后的 data:', JSON.stringify(data, null, 2));
    
    const {
      out_trade_no,
      total_fee,
      custom = {},
      order_no,
      status
    } = data; // uni-pay-orders 表内的数据均可获取到

    console.log('[notify:appointment] 提取的关键字段:', {
      out_trade_no,
      total_fee,
      order_no,
      status,
      custom: JSON.stringify(custom)
    });

    const appointment_id = custom.appointment_id;
    const payment_type = custom.payment_type || 'course_fee'; // 'course_fee' | 'deposit'

    console.log('[notify:appointment] 业务参数:', {
      appointment_id,
      payment_type
    });

    if (!appointment_id) {
      console.error('[notify:appointment] ❌ 错误：缺少 custom.appointment_id', { 
        out_trade_no, 
        total_fee, 
        custom: JSON.stringify(custom),
        data: JSON.stringify(data)
      });
      return false;
    }

    const db = uniCloud.database();
    const now = Date.now();

    // 先查询预约是否存在
    console.log('[notify:appointment] 查询预约信息，appointment_id:', appointment_id);
    const appointmentDoc = await db.collection('appointments').doc(appointment_id).get();
    
    if (!appointmentDoc.data || appointmentDoc.data.length === 0) {
      console.error('[notify:appointment] ❌ 错误：预约不存在', { appointment_id });
      return false;
    }

    const appointment = appointmentDoc.data[0];
    console.log('[notify:appointment] 预约当前状态:', {
      _id: appointment._id,
      status: appointment.status,
      parent_paid: appointment.parent_paid,
      deposit_paid: appointment.deposit_paid
    });

    // 基础：记录支付单号、金额、时间（字段不存在也不会报错）
    const baseUpdate = {
      last_pay_out_trade_no: out_trade_no,
      last_pay_total_fee: total_fee,
      last_pay_time: now,
      update_time: now
    };

    let updateData = {};
    
    if (payment_type === 'deposit') {
      // 教师保证金（与 payment-create handlePaySuccess 一致）
      let nextStatus = 'pending_confirm';
      if (appointment.status === 'contact_request') nextStatus = 'contact_request';
      else if (appointment.status === 'trial_invited') nextStatus = 'trial_invited';

      updateData = {
        ...baseUpdate,
        deposit_paid: true,
        deposit_time: now,
        status: nextStatus
      };

      console.log('[notify:appointment] 📝 准备更新预约（保证金）:', JSON.stringify(updateData, null, 2));

      const updateResult = await db.collection('appointments').doc(appointment_id).update(updateData);
      console.log('[notify:appointment] ✅ 更新预约成功（保证金）:', {
        appointment_id,
        updated: updateResult.updated,
        upserted: updateResult.upserted
      });

      try {
        const conversationDoc = await db.collection('chat-conversations').where({ appointment_id }).get();
        if (conversationDoc.data && conversationDoc.data.length > 0) {
          const conversationId = conversationDoc.data[0]._id;
          await db.collection('chat-conversations').doc(conversationId).update({
            chat_enabled: true,
            teacher_deposit_paid: true,
            update_time: now
          });
        }
      } catch (convErr) {
        console.error('[notify:appointment] 更新会话(保证金)失败:', convErr);
      }

      try {
        await db.collection('recruitment-responses').where({ appointment_id }).update({
          deposit_paid: true,
          update_time: now
        });
      } catch (rErr) {
        console.warn('[notify:appointment] 更新招募响应记录:', rErr);
      }
    } else {
      // 家长课程费（默认）
      // 判断下一个状态：参考 payment-create 的逻辑
      // 如果已经支付了保证金或已经是 confirmed，则直接 confirmed；否则 pending_confirm
      const nextStatus = (appointment.deposit_paid || appointment.status === 'confirmed') 
        ? 'confirmed' 
        : 'pending_confirm';
      
      updateData = {
        ...baseUpdate,
        parent_paid: true,
        parent_payment_time: now,
        payment_time: now,
        status: nextStatus
      };
      
      // 如果状态变为 confirmed，设置确认时间
      if (nextStatus === 'confirmed' && !appointment.confirm_time) {
        updateData.confirm_time = now;
      }
      
      console.log('[notify:appointment] 📝 准备更新预约（课程费）:', JSON.stringify(updateData, null, 2));
      console.log('[notify:appointment] 📝 当前预约状态:', {
        current_status: appointment.status,
        deposit_paid: appointment.deposit_paid,
        nextStatus
      });
      
      const updateResult = await db.collection('appointments').doc(appointment_id).update(updateData);
      console.log('[notify:appointment] ✅ 更新预约成功（课程费）:', {
        appointment_id,
        updated: updateResult.updated,
        upserted: updateResult.upserted,
        nextStatus,
        updateResult: JSON.stringify(updateResult)
      });
    }

    // 验证更新结果
    const verifyDoc = await db.collection('appointments').doc(appointment_id).get();
    const verifyAppointment = verifyDoc.data[0];
    console.log('[notify:appointment] 🔍 验证更新后的预约状态:', {
      appointment_id,
      status: verifyAppointment.status,
      parent_paid: verifyAppointment.parent_paid,
      deposit_paid: verifyAppointment.deposit_paid,
      parent_payment_time: verifyAppointment.parent_payment_time,
      deposit_time: verifyAppointment.deposit_time
    });

    const duration = Date.now() - startTime;
    console.log('[notify:appointment] ✅ ========== 回调成功完成 ==========');
    console.log('[notify:appointment] 耗时:', duration + 'ms');
    console.log('[notify:appointment] 最终结果:', {
      appointment_id,
      payment_type,
      out_trade_no,
      total_fee,
      status: verifyAppointment.status
    });
    
  } catch (err) {
    user_order_success = false;
    const duration = Date.now() - startTime;
    console.error('[notify:appointment] ❌ ========== 回调执行失败 ==========');
    console.error('[notify:appointment] 错误信息:', err.message);
    console.error('[notify:appointment] 错误堆栈:', err.stack);
    console.error('[notify:appointment] 错误对象:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    console.error('[notify:appointment] 耗时:', duration + 'ms');
  }
  
  return user_order_success;
};


