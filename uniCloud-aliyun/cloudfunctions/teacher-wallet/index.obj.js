/**
 * 教师钱包云对象
 * 功能：查询教师钱包信息与交易记录
 * 使用 uni-id-common 进行身份校验
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const uniID = require('uni-id-common')

// 商户平台「商家转账」产品设置中的场景 ID，默认佣金报酬(1005)
const DEFAULT_TRANSFER_SCENE_ID = '1005'
const MERCHANT_CERT_SERIAL = '1228C8B4BBBEC0F5CC67715CE438EC8E4E221C20'

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

const WALLET_COLLECTION = 'teacher-wallet'
const TRANSACTION_COLLECTION = 'teacher-transactions'
const WITHDRAW_COLLECTION = 'teacher-withdraw-requests'

function createDefaultWallet(teacher_id) {
  return {
    teacher_id,
    balance: 0,
    total_income: 0,
    total_withdraw: 0,
    frozen_amount: 0,
    update_time: Date.now()
  }
}

function roundCurrency(value) {
  const num = Number(value) || 0
  return Number(num.toFixed(2))
}

async function resolveTeacherId(context) {
  const token = context.getUniIdToken()
  if (!token) {
    throw new Error('未获取到token，请先登录')
  }

  try {
    const payload = await context.uniID.checkToken(token)
    if (payload.code) {
      throw new Error(payload.message || 'token校验失败')
    }
    return payload.uid
  } catch (tokenError) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const parts = decoded.split('_')
      if (parts.length >= 1) {
        return parts[0]
      }
    } catch (decodeError) {
      // ignore
    }
    throw new Error('token验证失败，请重新登录')
  }
}

async function ensureWalletExists(db, teacher_id) {
  const walletCollection = db.collection(WALLET_COLLECTION)
  const walletDoc = await walletCollection.where({ teacher_id }).limit(1).get()
  if (!walletDoc.data || walletDoc.data.length === 0) {
    const newWallet = createDefaultWallet(teacher_id)
    const addRes = await walletCollection.add(newWallet)
    if (!addRes.id) {
      throw new Error('初始化钱包失败')
    }
    return Object.assign({ _id: addRes.id }, newWallet)
  }
  return walletDoc.data[0]
}

async function appendTransaction(db, teacher_id, transaction) {
  const collection = db.collection(TRANSACTION_COLLECTION)
  const now = Date.now()
  const res = await collection.add({
    teacher_id,
    create_time: now,
    update_time: now,
    ...transaction
  })
  return res
}

async function getLatestPaidCourseOrder(db, appointmentId) {
  const dbCmd = db.command
  const orderDoc = await db.collection('payment-orders')
    .where({
      appointment_id: appointmentId,
      order_type: 'course_fee',
      status: dbCmd.in(['paid', 'success'])
    })
    .orderBy('payment_time', 'desc')
    .limit(1)
    .get()
  return orderDoc.data && orderDoc.data.length > 0 ? orderDoc.data[0] : null
}

function buildExpectedSettlement(appointment, paymentOrder) {
  const originalAmount = roundCurrency(
    paymentOrder
      ? Number(paymentOrder.original_amount || paymentOrder.total_amount || appointment.total_amount || 0)
      : Number(appointment.total_amount || 0)
  )
  const actualPaidAmount = roundCurrency(
    paymentOrder
      ? Number(paymentOrder.amount || 0)
      : Number(appointment.total_amount || 0)
  )
  return {
    teacherIncome: actualPaidAmount > 0 ? actualPaidAmount : originalAmount,
    platformFee: 0
  }
}

async function tryRepairLegacyWallet(db, teacher_id) {
  const wallet = await ensureWalletExists(db, teacher_id)
  const transactionCountRes = await db.collection(TRANSACTION_COLLECTION)
    .where({ teacher_id })
    .count()

  const hasWalletData = Number(wallet.balance || 0) > 0 || Number(wallet.total_income || 0) > 0
  const hasTransactions = (transactionCountRes.total || 0) > 0

  if (hasWalletData || hasTransactions) {
    return wallet
  }

  const completedAppointmentsRes = await db.collection('appointments')
    .where({
      teacher_id,
      status: 'completed'
    })
    .orderBy('complete_time', 'asc')
    .get()

  const completedAppointments = completedAppointmentsRes.data || []
  if (completedAppointments.length === 0) {
    return wallet
  }

  const walletCollection = db.collection(WALLET_COLLECTION)
  const transactionCollection = db.collection(TRANSACTION_COLLECTION)
  const _ = db.command
  let repairedAmount = 0
  let repairedCount = 0

  for (const appointment of completedAppointments) {
    const paymentOrder = await getLatestPaidCourseOrder(db, appointment._id)
    const settlement = buildExpectedSettlement(appointment, paymentOrder)
    const teacherIncome = roundCurrency(settlement.teacherIncome)

    if (teacherIncome <= 0) {
      continue
    }

    const existingTransactionRes = await transactionCollection
      .where({
        teacher_id,
        appointment_id: appointment._id,
        type: 'income'
      })
      .limit(1)
      .get()

    if (existingTransactionRes.data && existingTransactionRes.data.length > 0) {
      continue
    }

    const now = Date.now()
    await walletCollection.doc(wallet._id).update({
      balance: _.inc(teacherIncome),
      total_income: _.inc(teacherIncome),
      update_time: now
    })

    await appendTransaction(db, teacher_id, {
      type: 'income',
      title: appointment.course_type === 'trial' ? '试课收入' : '课程收入',
      description: `预约 ${appointment._id} 完成，收入结算`,
      amount: teacherIncome,
      status: 'completed',
      appointment_id: appointment._id,
      source: 'legacy_wallet_repair'
    })

    await db.collection('appointments').doc(appointment._id).update({
      teacher_income: teacherIncome,
      platform_fee: settlement.platformFee,
      wallet_settled: true,
      wallet_settlement_time: now,
      wallet_settlement_amount: teacherIncome,
      update_time: now
    })

    repairedAmount = roundCurrency(repairedAmount + teacherIncome)
    repairedCount += 1
  }

  if (repairedCount > 0) {
    console.log('[teacher-wallet] 已修复历史钱包数据:', {
      teacher_id,
      repairedCount,
      repairedAmount
    })
  }

  const repairedWalletDoc = await db.collection(WALLET_COLLECTION).doc(wallet._id).get()
  return repairedWalletDoc.data && repairedWalletDoc.data.length > 0
    ? repairedWalletDoc.data[0]
    : wallet
}

module.exports = {
  _before() {
    const clientInfo = this.getClientInfo()
    this.uniID = uniID.createInstance({ clientInfo })
  },

  /**
   * 获取钱包概览 + 最新交易
   * @returns {Object}
   */
  async getWallet() {
    const db = uniCloud.database()

    try {
      const teacher_id = await resolveTeacherId(this)
      const wallet = await tryRepairLegacyWallet(db, teacher_id)

      const transactionsRes = await db.collection(TRANSACTION_COLLECTION)
        .where({ teacher_id })
        .orderBy('create_time', 'desc')
        .limit(5)
        .get()

      const transactions = (transactionsRes.data || []).map(item => ({
        _id: item._id,
        type: item.type || 'income',
        title: item.title || (item.type === 'withdraw' ? '提现' : '课程收入'),
        description: item.description || '',
        amount: Number(item.amount || 0),
        status: item.status || 'completed',
        create_time: item.create_time || Date.now()
      }))

      console.log('[teacher-wallet][getWallet] 返回钱包概览与最近交易:', {
        teacher_id,
        balance: wallet.balance,
        total_income: wallet.total_income,
        transaction_count: transactions.length
      })

      return success({
        wallet: {
          balance: Number(wallet.balance || 0),
          total_income: Number(wallet.total_income || 0),
          total_withdraw: Number(wallet.total_withdraw || 0),
          frozen_amount: Number(wallet.frozen_amount || 0)
        },
        recent_transactions: transactions
      })
    } catch (e) {
      console.error('[teacher-wallet] 获取钱包信息失败', e)
      return error(e.message || '获取钱包信息失败')
    }
  },

  /**
   * 分页获取交易记录
   * @param {Object} params
   * @param {Number} params.page
   * @param {Number} params.pageSize
   * @returns {Object}
   */
  async getTransactions(params) {
    const db = uniCloud.database()
    const { page = 1, pageSize = 20 } = params

    try {
      const teacher_id = await resolveTeacherId(this)
      await tryRepairLegacyWallet(db, teacher_id)
      const skip = Math.max(page - 1, 0) * pageSize

      const collection = db.collection(TRANSACTION_COLLECTION)
      const dataRes = await collection
        .where({ teacher_id })
        .orderBy('create_time', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()

      const countRes = await collection.where({ teacher_id }).count()

      const transactions = (dataRes.data || []).map(item => ({
        _id: item._id,
        type: item.type || 'income',
        title: item.title || (item.type === 'withdraw' ? '提现' : '课程收入'),
        description: item.description || '',
        amount: Number(item.amount || 0),
        status: item.status || 'completed',
        create_time: item.create_time || Date.now()
      }))

      return success({
        list: transactions,
        pagination: {
          page,
          pageSize,
          total: countRes.total || 0
        }
      })
    } catch (e) {
      console.error('[teacher-wallet] 获取交易记录失败', e)
      return error(e.message || '获取交易记录失败')
    }
  },

  /**
   * 提交提现申请（立即发起微信转账；失败则回滚到可提现余额）
   * @param {Object} params
   * @param {Number} params.amount 提现金额（元）
   * @param {String} params.method 提现方式（默认 wxpay）
   * @param {String} params.remark 备注
   */
  async applyWithdraw(params = {}) {
    const db = uniCloud.database()
    const { amount, method = 'wxpay', remark = '' } = params

    try {
      const withdrawAmount = Number(amount)
      if (!withdrawAmount || Number.isNaN(withdrawAmount)) {
        return error('请输入合法的提现金额')
      }
      if (withdrawAmount < 0.3) {
        return error('提现金额需不少于0.3元')
      }

      const teacher_id = await resolveTeacherId(this)
      const result = await this._createAndTransfer({
        teacher_id,
        amount: withdrawAmount,
        method,
        remark: remark || '教师提现',
        source: 'manual'
      })
      return result
    } catch (e) {
      console.error('[teacher-wallet] 提现申请失败', e)
      return error(e.message || '提现申请失败')
    }
  },

  /**
   * 课程结算后自动打款到微信零钱（由 appointment-complete 调用）
   * 成功：不增加可提现余额，直接记累计提现
   * 需确认/失败：金额留在钱包余额，教师可手动提现或确认收款
   */
  async settleToWechat(params = {}) {
    const {
      teacher_id,
      amount,
      appointment_id = '',
      remark = '课程收入到账',
      income_title = '',
      income_type = 'income',
      income_source = 'appointment_complete'
    } = params

    try {
      if (!teacher_id) return error('教师ID不能为空')
      const settleAmount = roundCurrency(amount)
      if (settleAmount <= 0) {
        return success({ skipped: true }, '无需打款')
      }

      const db = uniCloud.database()
      await ensureWalletExists(db, teacher_id)

      // 先记收入流水（无论是否立刻到零钱）
      const incomeTx = await appendTransaction(db, teacher_id, {
        type: income_type === 'refund' ? 'refund' : 'income',
        title: income_title || (remark.includes('信息费') ? '信息费退还' : (remark.includes('试课') ? '试课收入' : '课程收入')),
        description: appointment_id
          ? `预约 ${appointment_id} 完成，收入结算`
          : remark,
        amount: settleAmount,
        status: 'completed',
        appointment_id: appointment_id || null,
        source: income_source
      })

      // 累计收入始终增加
      const _ = db.command
      await db.collection(WALLET_COLLECTION)
        .where({ teacher_id })
        .update({
          total_income: _.inc(settleAmount),
          update_time: Date.now()
        })

      // 尝试自动转账（不先加 balance，成功则记 total_withdraw；失败再加 balance）
      const transferRes = await this._createAndTransfer({
        teacher_id,
        amount: settleAmount,
        method: 'wxpay',
        remark,
        source: 'auto_settle',
        appointment_id,
        skipBalanceFreeze: true
      })

      if (transferRes.code === 0 && transferRes.data) {
        const status = transferRes.data.status
        if (status === 'completed') {
          return success({
            ...transferRes.data,
            income_transaction_id: incomeTx && incomeTx.id,
            auto_transferred: true,
            settled: true
          }, '收入已转入微信零钱')
        }
        if (status === 'wait_confirm') {
          // 待确认：金额先入余额，教师确认后扣减
          await db.collection(WALLET_COLLECTION)
            .where({ teacher_id })
            .update({
              balance: _.inc(settleAmount),
              update_time: Date.now()
            })
          return success({
            ...transferRes.data,
            income_transaction_id: incomeTx && incomeTx.id,
            auto_transferred: false,
            need_confirm: true,
            settled: true
          }, '请在钱包中确认收款')
        }
      }

      // 转账失败或处理中：金额入余额兜底
      await db.collection(WALLET_COLLECTION)
        .where({ teacher_id })
        .update({
          balance: _.inc(settleAmount),
          update_time: Date.now()
        })
      return success({
        auto_transferred: false,
        need_confirm: false,
        fail_reason: (transferRes && transferRes.message) || '自动转账未完成，已入钱包',
        income_transaction_id: incomeTx && incomeTx.id,
        settled: true,
        ...(transferRes && transferRes.data ? transferRes.data : {})
      }, '收入已入钱包，可手动提现')
    } catch (e) {
      console.error('[teacher-wallet] settleToWechat 失败', e)
      try {
        const db = uniCloud.database()
        const _ = db.command
        const settleAmount = roundCurrency(amount)
        if (teacher_id && settleAmount > 0) {
          await ensureWalletExists(db, teacher_id)
          await db.collection(WALLET_COLLECTION)
            .where({ teacher_id })
            .update({
              balance: _.inc(settleAmount),
              update_time: Date.now()
            })
        }
        return success({
          auto_transferred: false,
          need_confirm: false,
          settled: true,
          fail_reason: e.message || '自动转账异常，已入钱包'
        }, '收入已入钱包，可手动提现')
      } catch (fallbackErr) {
        console.error('[teacher-wallet] settleToWechat 余额兜底失败', fallbackErr)
      }
      return error(e.message || '自动结算失败')
    }
  },

  /**
   * 获取待确认收款的提现单（教师端拉起微信确认页）
   */
  async getPendingConfirmWithdraws() {
    try {
      const db = uniCloud.database()
      const teacher_id = await resolveTeacherId(this)
      const res = await db.collection(WITHDRAW_COLLECTION)
        .where({
          teacher_id,
          status: 'wait_confirm'
        })
        .orderBy('create_time', 'desc')
        .limit(10)
        .get()

      const config = await this.getWeChatPayConfig()
      const list = (res.data || []).map(item => ({
        _id: item._id,
        amount: item.amount,
        package_info: item.package_info || '',
        out_bill_no: item.out_bill_no || '',
        appointment_id: item.appointment_id || '',
        create_time: item.create_time,
        mchId: config.mchId,
        appId: config.appId
      })).filter(item => item.package_info)

      return success({ list })
    } catch (e) {
      console.error('[teacher-wallet] 获取待确认提现失败', e)
      return error(e.message || '获取待确认提现失败')
    }
  },

  /**
   * 教师确认收款后，同步微信转账结果
   */
  async syncWithdrawStatus(params = {}) {
    const { withdraw_id } = params
    try {
      if (!withdraw_id) return error('提现单ID不能为空')
      const db = uniCloud.database()
      const teacher_id = await resolveTeacherId(this)
      const doc = await db.collection(WITHDRAW_COLLECTION).doc(withdraw_id).get()
      if (!doc.data || !doc.data.length) return error('提现单不存在')
      const withdraw = doc.data[0]
      if (withdraw.teacher_id !== teacher_id) return error('无权操作该提现单')
      if (!withdraw.out_bill_no) return error('缺少商户单号')

      const queryRes = await this.queryWeChatTransfer(withdraw.out_bill_no)
      if (!queryRes.success) {
        return error(queryRes.message || '查询转账状态失败')
      }

      const state = queryRes.state
      const now = Date.now()
      const _ = db.command

      if (state === 'SUCCESS') {
        await this._markWithdrawCompleted(db, withdraw, queryRes.transfer_bill_no || withdraw.payment_no)
        return success({ status: 'completed' }, '已到账')
      }

      if (state === 'FAIL' || state === 'CANCELLED') {
        await db.collection(WITHDRAW_COLLECTION).doc(withdraw._id).update({
          status: 'failed',
          fail_reason: queryRes.fail_reason || state,
          package_info: '',
          update_time: now
        })
        // 若此前从余额冻结过，回滚；auto_settle 且 wait_confirm 时余额已加过，保持余额即可
        if (withdraw.source !== 'auto_settle' || withdraw.status === 'pending') {
          await db.collection(WALLET_COLLECTION)
            .where({ teacher_id })
            .update({
              balance: _.inc(withdraw.amount),
              frozen_amount: _.inc(-Number(withdraw.frozen_amount_delta || withdraw.amount || 0)),
              update_time: now
            })
        }
        return success({ status: 'failed', fail_reason: queryRes.fail_reason || state }, '转账失败')
      }

      return success({ status: withdraw.status, wx_state: state }, '转账处理中')
    } catch (e) {
      console.error('[teacher-wallet] syncWithdrawStatus 失败', e)
      return error(e.message || '同步提现状态失败')
    }
  },

  /**
   * 执行提现转账（兼容旧调用：按 withdraw_id 重试）
   */
  async processWithdraw(params = {}) {
    const db = uniCloud.database()
    const { withdraw_id } = params

    try {
      if (!withdraw_id) return error('提现申请ID不能为空')

      const withdrawDoc = await db.collection(WITHDRAW_COLLECTION).doc(withdraw_id).get()
      if (!withdrawDoc.data || !withdrawDoc.data.length) {
        return error('提现申请不存在')
      }

      const withdraw = withdrawDoc.data[0]
      if (!['pending', 'failed', 'wait_confirm'].includes(withdraw.status)) {
        return error(`该提现申请已处理，当前状态：${withdraw.status}`)
      }

      // wait_confirm：优先查单；仍待确认则返回 package
      if (withdraw.status === 'wait_confirm' && withdraw.out_bill_no) {
        const queryRes = await this.queryWeChatTransfer(withdraw.out_bill_no)
        if (queryRes.success && queryRes.state === 'SUCCESS') {
          await this._markWithdrawCompleted(db, withdraw, queryRes.transfer_bill_no)
          return success({ withdraw_id, status: 'completed' }, '提现已完成')
        }
        const config = await this.getWeChatPayConfig()
        return success({
          withdraw_id,
          status: 'wait_confirm',
          package_info: withdraw.package_info,
          mchId: config.mchId,
          appId: config.appId
        }, '请确认收款')
      }

      // 失败单：重新发起（需余额足够）
      if (withdraw.status === 'failed') {
        const wallet = await ensureWalletExists(db, withdraw.teacher_id)
        if (Number(wallet.balance || 0) < Number(withdraw.amount || 0)) {
          return error('可提现余额不足，无法重试')
        }
        return await this._createAndTransfer({
          teacher_id: withdraw.teacher_id,
          amount: withdraw.amount,
          method: withdraw.method || 'wxpay',
          remark: withdraw.remark || '教师提现',
          source: withdraw.source || 'manual',
          appointment_id: withdraw.appointment_id || '',
          reuseWithdrawId: withdraw._id
        })
      }

      // pending：继续打款
      return await this._transferExistingWithdraw(db, withdraw)
    } catch (e) {
      console.error('[teacher-wallet] 处理提现转账失败:', e)
      return error(e.message || '处理提现转账失败')
    }
  },

  /**
   * 创建提现单并立即转账
   * skipBalanceFreeze=true：用于结算自动打款（余额尚未增加）
   */
  async _createAndTransfer(options = {}) {
    const db = uniCloud.database()
    const {
      teacher_id,
      amount,
      method = 'wxpay',
      remark = '教师提现',
      source = 'manual',
      appointment_id = '',
      skipBalanceFreeze = false,
      reuseWithdrawId = ''
    } = options

    const withdrawAmount = roundCurrency(amount)
    if (withdrawAmount < 0.3) {
      return error('提现金额需不少于0.3元')
    }

    const wallet = await ensureWalletExists(db, teacher_id)
    const _ = db.command
    const now = Date.now()

    if (!skipBalanceFreeze) {
      const currentBalance = Number(wallet.balance || 0)
      if (withdrawAmount > currentBalance) {
        return error('可提现余额不足')
      }
    }

    let withdrawId = reuseWithdrawId
    if (!withdrawId) {
      const withdrawRes = await db.collection(WITHDRAW_COLLECTION).add({
        teacher_id,
        amount: withdrawAmount,
        method,
        remark,
        source,
        appointment_id: appointment_id || '',
        status: 'pending',
        create_time: now,
        update_time: now
      })
      withdrawId = withdrawRes.id
      if (!withdrawId) throw new Error('提现申请创建失败')
    } else {
      await db.collection(WITHDRAW_COLLECTION).doc(withdrawId).update({
        status: 'pending',
        fail_reason: '',
        package_info: '',
        update_time: now
      })
    }

    if (!skipBalanceFreeze) {
      const updateRes = await db.collection(WALLET_COLLECTION).doc(wallet._id).update({
        balance: _.inc(-withdrawAmount),
        frozen_amount: _.inc(withdrawAmount),
        update_time: now
      })
      if (!updateRes.updated) throw new Error('更新钱包信息失败')
    }

    await appendTransaction(db, teacher_id, {
      type: 'withdraw',
      title: source === 'auto_settle' ? '收入自动到账' : '提现',
      description: remark || (source === 'auto_settle' ? '课程收入转入微信零钱' : '提现至微信零钱'),
      amount: -withdrawAmount,
      status: 'pending',
      relate_id: withdrawId,
      appointment_id: appointment_id || null,
      source
    })

    const withdrawDoc = await db.collection(WITHDRAW_COLLECTION).doc(withdrawId).get()
    const withdraw = withdrawDoc.data[0]
    return await this._transferExistingWithdraw(db, withdraw, { skipBalanceFreeze })
  },

  async _transferExistingWithdraw(db, withdraw, options = {}) {
    const { skipBalanceFreeze = false } = options
    const _ = db.command
    const now = Date.now()

    const userDoc = await db.collection('uni-id-users')
      .doc(withdraw.teacher_id)
      .field({ wx_openid: true })
      .get()

    if (!userDoc.data || !userDoc.data.length) {
      return await this._failWithdraw(db, withdraw, '用户信息不存在', { skipBalanceFreeze })
    }

    const openid = userDoc.data[0].wx_openid && userDoc.data[0].wx_openid.mp
    if (!openid) {
      return await this._failWithdraw(db, withdraw, '未获取到教师微信OpenID，请先用微信登录小程序', { skipBalanceFreeze })
    }

    const outBillNo = withdraw.out_bill_no || `TW${Date.now()}${Math.random().toString(36).slice(2, 8)}`.slice(0, 32)
    await db.collection(WITHDRAW_COLLECTION).doc(withdraw._id).update({
      out_bill_no: outBillNo,
      update_time: now
    })

    const transferResult = await this.callWeChatTransfer({
      openid,
      amount: Math.round(Number(withdraw.amount) * 100),
      description: (withdraw.remark || '教师课酬').slice(0, 32),
      partner_trade_no: outBillNo
    })

    if (transferResult.success && transferResult.state === 'SUCCESS') {
      await this._markWithdrawCompleted(db, { ...withdraw, out_bill_no: outBillNo }, transferResult.payment_no, {
        skipBalanceFreeze
      })
      return success({
        request_id: withdraw._id,
        withdraw_id: withdraw._id,
        status: 'completed',
        payment_no: transferResult.payment_no,
        amount: withdraw.amount
      }, '已转入微信零钱')
    }

    if (transferResult.success && (transferResult.state === 'WAIT_USER_CONFIRM' || transferResult.package_info)) {
      await db.collection(WITHDRAW_COLLECTION).doc(withdraw._id).update({
        status: 'wait_confirm',
        package_info: transferResult.package_info || '',
        payment_no: transferResult.payment_no || '',
        update_time: Date.now()
      })
      await this._updateWithdrawTransaction(db, withdraw._id, {
        status: 'pending',
        description: '待确认收款后到账'
      })
      const config = await this.getWeChatPayConfig()
      return success({
        request_id: withdraw._id,
        withdraw_id: withdraw._id,
        status: 'wait_confirm',
        package_info: transferResult.package_info,
        mchId: config.mchId,
        appId: config.appId,
        amount: withdraw.amount
      }, '请确认收款')
    }

    // ACCEPTED / PROCESSING：先记 pending，后续可 sync
    if (transferResult.success && ['ACCEPTED', 'PROCESSING', 'TRANSFERING'].includes(transferResult.state)) {
      await db.collection(WITHDRAW_COLLECTION).doc(withdraw._id).update({
        status: 'pending',
        payment_no: transferResult.payment_no || '',
        update_time: Date.now()
      })
      return success({
        request_id: withdraw._id,
        withdraw_id: withdraw._id,
        status: 'pending',
        payment_no: transferResult.payment_no,
        amount: withdraw.amount
      }, '转账处理中')
    }

    return await this._failWithdraw(
      db,
      { ...withdraw, out_bill_no: outBillNo },
      transferResult.message || '转账失败',
      { skipBalanceFreeze }
    )
  },

  async _markWithdrawCompleted(db, withdraw, paymentNo, options = {}) {
    const { skipBalanceFreeze = false } = options
    const _ = db.command
    const now = Date.now()
    const amount = Number(withdraw.amount || 0)

    await db.collection(WITHDRAW_COLLECTION).doc(withdraw._id).update({
      status: 'completed',
      payment_time: now,
      payment_no: paymentNo || withdraw.payment_no || '',
      package_info: '',
      fail_reason: '',
      update_time: now
    })

    const walletUpdate = {
      total_withdraw: _.inc(amount),
      update_time: now
    }
    if (!skipBalanceFreeze && withdraw.source !== 'auto_settle') {
      walletUpdate.frozen_amount = _.inc(-amount)
    } else if (withdraw.source === 'auto_settle' && withdraw.status === 'wait_confirm') {
      // 自动结算待确认时余额已加过，确认成功后扣余额
      walletUpdate.balance = _.inc(-amount)
    }

    await db.collection(WALLET_COLLECTION)
      .where({ teacher_id: withdraw.teacher_id })
      .update(walletUpdate)

    await this._updateWithdrawTransaction(db, withdraw._id, {
      status: 'completed',
      description: `¥${amount}已到微信零钱`
    })
  },

  async _failWithdraw(db, withdraw, reason, options = {}) {
    const { skipBalanceFreeze = false } = options
    const _ = db.command
    const now = Date.now()
    const amount = Number(withdraw.amount || 0)

    await db.collection(WITHDRAW_COLLECTION).doc(withdraw._id).update({
      status: 'failed',
      fail_reason: reason,
      package_info: '',
      update_time: now
    })

    if (!skipBalanceFreeze) {
      await db.collection(WALLET_COLLECTION)
        .where({ teacher_id: withdraw.teacher_id })
        .update({
          balance: _.inc(amount),
          frozen_amount: _.inc(-amount),
          update_time: now
        })
    }

    await this._updateWithdrawTransaction(db, withdraw._id, {
      status: 'failed',
      description: `提现失败：${reason}`
    })

    return error(reason)
  },

  async _updateWithdrawTransaction(db, withdrawId, patch = {}) {
    const transactionDoc = await db.collection(TRANSACTION_COLLECTION)
      .where({ relate_id: withdrawId, type: 'withdraw' })
      .orderBy('create_time', 'desc')
      .limit(1)
      .get()
    if (transactionDoc.data && transactionDoc.data.length) {
      await db.collection(TRANSACTION_COLLECTION)
        .doc(transactionDoc.data[0]._id)
        .update({
          ...patch,
          update_time: Date.now()
        })
    }
  },

  /**
   * 调用微信商家转账（新版 transfer-bills）
   */
  async callWeChatTransfer(params) {
    const { openid, amount, description, partner_trade_no } = params
    const config = await this.getWeChatPayConfig()

    if (!config.mchId || !config.appId || !config.privateKey || !config.serialNo) {
      console.error('[微信转账] 微信支付配置不完整', {
        hasMchId: !!config.mchId,
        hasAppId: !!config.appId,
        hasPrivateKey: !!config.privateKey,
        hasSerialNo: !!config.serialNo
      })
      return {
        success: false,
        message: '微信支付配置不完整，请联系管理员'
      }
    }

    try {
      const url = 'https://api.mch.weixin.qq.com/v3/fund-app/mch-transfer/transfer-bills'
      const requestBody = {
        appid: config.appId,
        out_bill_no: partner_trade_no,
        transfer_scene_id: config.transferSceneId || DEFAULT_TRANSFER_SCENE_ID,
        openid,
        transfer_amount: amount,
        transfer_remark: (description || '教师课酬').slice(0, 32),
        transfer_scene_report_infos: [
          { info_type: '岗位类型', info_content: '家教老师' },
          { info_type: '报酬说明', info_content: (description || '课程报酬').slice(0, 32) }
        ]
      }

      const bodyStr = JSON.stringify(requestBody)
      const headers = this.buildWeChatPayHeaders(url, 'POST', bodyStr, config)

      const response = await uniCloud.httpclient.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...headers
        },
        data: requestBody,
        dataType: 'json',
        timeout: 20000
      })

      console.log('[微信转账] API响应:', response.status, JSON.stringify(response.data))

      if (response.status === 200 && response.data) {
        return {
          success: true,
          payment_no: response.data.transfer_bill_no || '',
          state: response.data.state || '',
          package_info: response.data.package_info || '',
          message: '转账已受理'
        }
      }

      const errorMsg = (response.data && (response.data.message || response.data.detail)) || `转账失败(${response.status})`
      return { success: false, message: errorMsg }
    } catch (error) {
      console.error('[微信转账] API调用异常:', error)
      return {
        success: false,
        message: error.message || '转账请求失败'
      }
    }
  },

  async queryWeChatTransfer(outBillNo) {
    const config = await this.getWeChatPayConfig()
    if (!config.mchId || !config.privateKey || !config.serialNo) {
      return { success: false, message: '微信支付配置不完整' }
    }
    try {
      const url = `https://api.mch.weixin.qq.com/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/${outBillNo}`
      const headers = this.buildWeChatPayHeaders(url, 'GET', '', config)
      const response = await uniCloud.httpclient.request(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...headers
        },
        dataType: 'json',
        timeout: 15000
      })
      if (response.status === 200 && response.data) {
        return {
          success: true,
          state: response.data.state,
          transfer_bill_no: response.data.transfer_bill_no,
          fail_reason: response.data.fail_reason || '',
          package_info: response.data.package_info || ''
        }
      }
      return {
        success: false,
        message: (response.data && response.data.message) || '查询失败'
      }
    } catch (e) {
      console.error('[微信转账] 查单失败:', e)
      return { success: false, message: e.message || '查询失败' }
    }
  },

  /**
   * 获取微信支付配置（优先复用 uni-pay 配置）
   */
  async getWeChatPayConfig() {
    try {
      // 1) uni-pay 配置（与收款共用）
      try {
        const createConfig = require('uni-config-center')
        const payConfigCenter = createConfig({ pluginId: 'uni-pay' })
        const payConfig = payConfigCenter.requireFile('config.js') || {}
        const mp = (payConfig.wxpay && payConfig.wxpay.mp) || {}
        if (mp.mchId && mp.appId) {
          let privateKey = ''
          if (mp.appPrivateKeyPath && fs.existsSync(mp.appPrivateKeyPath)) {
            privateKey = fs.readFileSync(mp.appPrivateKeyPath, 'utf8')
          }
          let serialNo = MERCHANT_CERT_SERIAL
          if (mp.appCertPath && fs.existsSync(mp.appCertPath)) {
            try {
              const certPem = fs.readFileSync(mp.appCertPath, 'utf8')
              const x509 = new crypto.X509Certificate(certPem)
              serialNo = x509.serialNumber || serialNo
            } catch (certErr) {
              console.warn('[微信支付] 解析证书序列号失败，使用内置序列号', certErr.message)
            }
          }
          return {
            mchId: String(mp.mchId),
            appId: String(mp.appId),
            v3Key: mp.v3Key || '',
            serialNo,
            privateKey,
            transferSceneId: process.env.WXPAY_TRANSFER_SCENE_ID || DEFAULT_TRANSFER_SCENE_ID
          }
        }
      } catch (cfgErr) {
        console.warn('[微信支付] 读取 uni-pay 配置失败，尝试 system-config', cfgErr.message)
      }

      // 2) system-config（key/value）
      const db = uniCloud.database()
      const configDocs = await db.collection('system-config')
        .where({
          key: db.command.in([
            'wxpay_mchId', 'wxpay_appId', 'wxpay_v3Key', 'wxpay_serialNo', 'wxpay_privateKey', 'wxpay_transfer_scene_id'
          ])
        })
        .get()

      if (configDocs.data && configDocs.data.length) {
        const configMap = {}
        configDocs.data.forEach(item => {
          configMap[item.key] = item.value
        })
        if (configMap.wxpay_mchId && configMap.wxpay_appId) {
          return {
            mchId: configMap.wxpay_mchId,
            appId: configMap.wxpay_appId,
            v3Key: configMap.wxpay_v3Key || '',
            serialNo: configMap.wxpay_serialNo || MERCHANT_CERT_SERIAL,
            privateKey: configMap.wxpay_privateKey || '',
            transferSceneId: configMap.wxpay_transfer_scene_id || DEFAULT_TRANSFER_SCENE_ID
          }
        }
      }

      return {
        mchId: process.env.WXPAY_MCH_ID || '',
        appId: process.env.WXPAY_APP_ID || '',
        v3Key: process.env.WXPAY_V3_KEY || '',
        serialNo: process.env.WXPAY_SERIAL_NO || MERCHANT_CERT_SERIAL,
        privateKey: process.env.WXPAY_PRIVATE_KEY || '',
        transferSceneId: process.env.WXPAY_TRANSFER_SCENE_ID || DEFAULT_TRANSFER_SCENE_ID
      }
    } catch (e) {
      console.error('[微信支付] 获取配置失败:', e)
      return {
        mchId: '',
        appId: '',
        v3Key: '',
        serialNo: '',
        privateKey: '',
        transferSceneId: DEFAULT_TRANSFER_SCENE_ID
      }
    }
  },

  buildWeChatPayHeaders(url, method, body, config) {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const nonceStr = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      const urlObj = new URL(url)
      const urlPath = urlObj.pathname + (urlObj.search || '')
      const signStr = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body || ''}\n`

      let privateKey = (config.privateKey || '').trim()
      if (!privateKey) throw new Error('商户私钥未配置')
      if (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('BEGIN RSA PRIVATE KEY')) {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`
      }

      const sign = crypto.createSign('RSA-SHA256')
      sign.update(signStr, 'utf8')
      const signature = sign.sign(privateKey, 'base64')
      const token = `mchid="${config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`

      return {
        Authorization: `WECHATPAY2-SHA256-RSA2048 ${token}`
      }
    } catch (error) {
      console.error('[微信支付] 构建签名失败:', error)
      throw new Error(`签名构建失败: ${error.message}`)
    }
  }
}

