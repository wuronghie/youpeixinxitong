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

const PUBLIC_PAY_PENDING_REVIEW = '待商家审核'

function isMerchantFundShortage(text, code) {
  const s = `${text || ''} ${code || ''}`
  return /NOT_ENOUGH|NOTENOUGH|NO_ENOUGH|FUND_NOT_ENOUGH|ACCOUNT_NOT_ENOUGH|余额不足|账户余额|商户余额|资金不足|没钱|not enough/i.test(s)
}

function toPublicPayMessage(raw, code) {
  if (isMerchantFundShortage(raw, code)) return PUBLIC_PAY_PENDING_REVIEW
  return String(raw || '').trim() || '打款未完成'
}

/**
 * 云对象被其他云对象 importObject 调用时，this 上常无私有方法。
 * 优先用当前 this；否则回退到 module.exports，保证 _createAndTransfer 等可调用。
 */
function getLocalRunner(ctx, methodName) {
  if (ctx && typeof ctx[methodName] === 'function') return ctx
  if (typeof module.exports[methodName] === 'function') return module.exports
  throw new Error(`${methodName} is not a function`)
}

async function runLocal(ctx, methodName, ...args) {
  const runner = getLocalRunner(ctx, methodName)
  return runner[methodName].call(runner, ...args)
}

async function assertStaff(context) {
  const token = context.getUniIdToken()
  if (!token) throw new Error('未登录')
  const payload = await context.uniID.checkToken(token)
  if (payload.code) throw new Error(payload.message || 'token 无效')
  const uid = payload.uid
  if (!uid) throw new Error('未登录')
  const db = uniCloud.database()
  const userRes = await db.collection('uni-id-users').doc(uid).field({ _id: true, role: true }).get()
  const userData = (userRes.data && userRes.data[0]) || {}
  const roles = Array.isArray(userData.role) ? userData.role : (userData.role ? [userData.role] : [])
  const isStaff = roles.some((r) => r === 'admin' || r === 'auditor')
  if (!isStaff) throw new Error('无权限')
  return uid
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

/**
 * 解析家长展示名：真实姓名 > 昵称 > 用户名
 */
function pickParentDisplayName(user) {
  if (!user) return ''
  const parentInfo = user.parent_info || {}
  const name = String(
    parentInfo.real_name ||
    user.nickname ||
    user.username ||
    ''
  ).trim()
  if (!name || name === '家长' || name === '用户' || name === '微信用户') return ''
  return name.slice(0, 20)
}

/**
 * 收入流水说明改为家长姓名（历史记录里常写预约 ID，教师看不懂）
 */
async function enrichTransactionsWithParentName(db, transactions) {
  const list = Array.isArray(transactions) ? transactions : []
  if (!list.length) return list

  const appointmentIds = [...new Set(
    list
      .map((item) => String(item.appointment_id || '').trim())
      .filter(Boolean)
  )]
  if (!appointmentIds.length) return list

  const appointmentMap = {}
  try {
    const aptRes = await db.collection('appointments')
      .where({ _id: db.command.in(appointmentIds) })
      .field({ parent_id: true, course_type: true })
      .limit(appointmentIds.length)
      .get()
    ;(aptRes.data || []).forEach((apt) => {
      appointmentMap[apt._id] = apt
    })
  } catch (e) {
    console.warn('[teacher-wallet] 补充预约家长信息失败', e && (e.message || e))
    return list
  }

  const parentIds = [...new Set(
    Object.values(appointmentMap)
      .map((apt) => String(apt.parent_id || '').trim())
      .filter(Boolean)
  )]
  const parentNameMap = {}
  if (parentIds.length) {
    try {
      const userRes = await db.collection('uni-id-users')
        .where({ _id: db.command.in(parentIds) })
        .field({ nickname: true, username: true, parent_info: true })
        .limit(parentIds.length)
        .get()
      ;(userRes.data || []).forEach((user) => {
        parentNameMap[user._id] = pickParentDisplayName(user)
      })
    } catch (e) {
      console.warn('[teacher-wallet] 查询家长姓名失败', e && (e.message || e))
    }
  }

  return list.map((item) => {
    const apt = item.appointment_id ? appointmentMap[item.appointment_id] : null
    const parentName = apt && apt.parent_id ? parentNameMap[apt.parent_id] : ''
    if (!parentName) return item

    const courseLabel = (apt && apt.course_type === 'trial') || item.title === '试课收入'
      ? '试课'
      : '课程'
    const next = Object.assign({}, item)
    if (item.type === 'income' || item.type === 'refund') {
      next.description = `家长 ${parentName} · ${courseLabel}`
      next.parent_name = parentName
    }
    return next
  })
}

/**
 * 补充到账状态：已到账 / 待确认收款 / 处理中 / 到账失败
 * 依据同预约的微信转账单（teacher-withdraw-requests）
 */
async function enrichTransactionsWithArriveStatus(db, teacherId, transactions) {
  const list = Array.isArray(transactions) ? transactions : []
  if (!list.length || !teacherId) return list

  const appointmentIds = [...new Set(
    list
      .map((item) => String(item.appointment_id || '').trim())
      .filter(Boolean)
  )]
  const relateIds = [...new Set(
    list
      .map((item) => String(item.relate_id || '').trim())
      .filter(Boolean)
  )]

  const withdrawByAppointment = {}
  const withdrawById = {}

  try {
    const orConditions = []
    if (appointmentIds.length) {
      orConditions.push({
        teacher_id: teacherId,
        appointment_id: db.command.in(appointmentIds)
      })
    }
    if (relateIds.length) {
      orConditions.push({
        teacher_id: teacherId,
        _id: db.command.in(relateIds)
      })
    }
    if (!orConditions.length) {
      return list.map((item) => attachArriveStatus(item, null))
    }

    const where = orConditions.length === 1
      ? orConditions[0]
      : db.command.or(orConditions)
    const withdrawRes = await db.collection(WITHDRAW_COLLECTION)
      .where(where)
      .orderBy('create_time', 'desc')
      .limit(100)
      .get()

    ;(withdrawRes.data || []).forEach((row) => {
      withdrawById[row._id] = row
      const aptId = String(row.appointment_id || '').trim()
      if (aptId && !withdrawByAppointment[aptId]) {
        withdrawByAppointment[aptId] = row
      }
    })
  } catch (e) {
    console.warn('[teacher-wallet] 补充到账状态失败', e && (e.message || e))
  }

  return list.map((item) => {
    const withdraw =
      (item.relate_id && withdrawById[item.relate_id]) ||
      (item.appointment_id && withdrawByAppointment[item.appointment_id]) ||
      null
    return attachArriveStatus(item, withdraw)
  })
}

function attachArriveStatus(item, withdraw) {
  const next = Object.assign({}, item)
  const type = item.type || 'income'

  if (type === 'withdraw') {
    next.title = next.title === '提现' ? '微信到账' : (next.title || '微信到账')
    if (String(next.description || '').includes('提现')) {
      next.description = '课酬转入微信零钱'
    }
  }

  if (isMerchantFundShortage(next.description) || isMerchantFundShortage(withdraw && withdraw.fail_reason)) {
    next.description = PUBLIC_PAY_PENDING_REVIEW
  }

  let arriveStatus = 'unknown'
  let arriveLabel = ''

  if (withdraw) {
    const st = String(withdraw.status || '')
    if (st === 'completed') {
      arriveStatus = 'arrived'
      arriveLabel = '已到账'
    } else if (st === 'wait_confirm') {
      arriveStatus = 'wait_confirm'
      arriveLabel = '待确认收款'
    } else if (st === 'pending') {
      arriveStatus = 'pending'
      arriveLabel = '到账处理中'
    } else if (st === 'failed') {
      if (isMerchantFundShortage(withdraw.fail_reason)) {
        arriveStatus = 'pending_review'
        arriveLabel = PUBLIC_PAY_PENDING_REVIEW
      } else {
        arriveStatus = 'failed'
        arriveLabel = '到账失败'
      }
    }
  } else if (type === 'income' || type === 'refund') {
    // 无转账单：按流水自身状态兜底
    if (item.status === 'completed') {
      arriveStatus = 'recorded'
      arriveLabel = '已入账'
    } else if (item.status === 'pending') {
      arriveStatus = 'pending'
      arriveLabel = '处理中'
    } else if (item.status === 'failed') {
      arriveStatus = 'failed'
      arriveLabel = '失败'
    }
  } else if (type === 'withdraw') {
    if (item.status === 'completed') {
      arriveStatus = 'arrived'
      arriveLabel = '已到账'
    } else if (item.status === 'pending') {
      arriveStatus = 'pending'
      arriveLabel = '到账处理中'
    } else if (item.status === 'failed') {
      arriveStatus = 'failed'
      arriveLabel = '到账失败'
    }
  }

  next.arrive_status = arriveStatus
  next.arrive_label = arriveLabel
  return next
}

async function resolveIncomeDescription(db, appointmentId, fallback = '课程完成收入结算') {
  if (!appointmentId) return fallback
  try {
    const aptDoc = await db.collection('appointments')
      .doc(appointmentId)
      .field({ parent_id: true, course_type: true })
      .get()
    const apt = aptDoc.data && aptDoc.data[0]
    if (!apt || !apt.parent_id) return fallback
    const userDoc = await db.collection('uni-id-users')
      .doc(apt.parent_id)
      .field({ nickname: true, username: true, parent_info: true })
      .get()
    const parentName = pickParentDisplayName(userDoc.data && userDoc.data[0])
    if (!parentName) return fallback
    const courseLabel = apt.course_type === 'trial' ? '试课' : '课程'
    return `家长 ${parentName} · ${courseLabel}`
  } catch (e) {
    return fallback
  }
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
      description: await resolveIncomeDescription(
        db,
        appointment._id,
        `预约完成，收入结算`
      ),
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

      const transactions = await enrichTransactionsWithArriveStatus(
        db,
        teacher_id,
        await enrichTransactionsWithParentName(
          db,
          (transactionsRes.data || []).map(item => ({
            _id: item._id,
            type: item.type || 'income',
            title: item.title || (item.type === 'withdraw' ? '微信到账' : '课程收入'),
            description: item.description || '',
            amount: Number(item.amount || 0),
            status: item.status || 'completed',
            appointment_id: item.appointment_id || '',
            relate_id: item.relate_id || '',
            create_time: item.create_time || Date.now()
          }))
        )
      )

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

      const transactions = await enrichTransactionsWithArriveStatus(
        db,
        teacher_id,
        await enrichTransactionsWithParentName(
          db,
          (dataRes.data || []).map(item => ({
            _id: item._id,
            type: item.type || 'income',
            title: item.title || (item.type === 'withdraw' ? '微信到账' : '课程收入'),
            description: item.description || '',
            amount: Number(item.amount || 0),
            status: item.status || 'completed',
            appointment_id: item.appointment_id || '',
            relate_id: item.relate_id || '',
            create_time: item.create_time || Date.now()
          }))
        )
      )

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
  async applyWithdraw() {
    // 钱包暂时停用：课酬统一打微信零钱，不再支持余额提现
    return error('钱包提现已暂时停用，课酬将直接打入微信零钱')
  },

  /**
   * 直接商家转账到教师微信零钱（不入钱包余额）
   * 供 payment-refund 试课退款 70% 打款使用
   */
  async directPayTeacher(params = {}) {
    const {
      teacher_id,
      amount,
      appointment_id = '',
      remark = '试课课酬到账'
    } = params

    const logPrefix = '[teacher-wallet.directPayTeacher]'
    try {
      if (!teacher_id) {
        console.warn(logPrefix, '失败：教师ID为空')
        return error('教师ID不能为空', -1, { transfer_ok: false, fail_reason: '教师ID为空' })
      }
      const payAmount = roundCurrency(amount)
      if (payAmount < 0.3) {
        console.warn(logPrefix, '失败：金额过低', { teacher_id, payAmount })
        return error('打款金额需不少于0.3元', -1, {
          transfer_ok: false,
          fail_reason: `金额过低：${payAmount}`
        })
      }

      console.log(logPrefix, '开始转账', {
        teacher_id,
        amount: payAmount,
        appointment_id,
        remark
      })

      const db = uniCloud.database()
      await ensureWalletExists(db, teacher_id)

      // 退款云对象跨调用时 this._createAndTransfer 不存在，必须走 runLocal
      const transferRes = await runLocal(this, '_createAndTransfer', {
        teacher_id,
        amount: payAmount,
        method: 'wxpay',
        remark,
        source: 'auto_settle',
        appointment_id,
        skipBalanceFreeze: true
      })

      const data = (transferRes && transferRes.data) || {}
      const status = data.status || ''
      const code = transferRes && transferRes.code

      // 打款已受理时记入累计收入（与 settleToWechat 一致，避免「累计收入」不更新）
      const recordIncomeIfNeeded = async () => {
        try {
          if (appointment_id) {
            const existTx = await db.collection(TRANSACTION_COLLECTION)
              .where({
                teacher_id,
                appointment_id,
                type: db.command.in(['income', 'refund'])
              })
              .limit(1)
              .get()
            if (existTx.data && existTx.data.length) return
          }
          await appendTransaction(db, teacher_id, {
            type: 'income',
            title: '试课课酬',
            description: remark || '试课退款课酬70%',
            amount: payAmount,
            status: 'completed',
            appointment_id: appointment_id || null,
            source: 'trial_refund_pay'
          })
          await db.collection(WALLET_COLLECTION)
            .where({ teacher_id })
            .update({
              total_income: db.command.inc(payAmount),
              update_time: Date.now()
            })
        } catch (incomeErr) {
          console.warn(logPrefix, '记累计收入失败（不影响打款）', incomeErr.message)
        }
      }

      if (code === 0 && status === 'completed') {
        await recordIncomeIfNeeded()
        console.log(logPrefix, '成功：已转入微信零钱', {
          teacher_id,
          amount: payAmount,
          withdraw_id: data.withdraw_id || data.request_id,
          payment_no: data.payment_no
        })
        return success({
          transfer_ok: true,
          status: 'completed',
          auto_transferred: true,
          need_confirm: false,
          amount: payAmount,
          withdraw_id: data.withdraw_id || data.request_id || '',
          payment_no: data.payment_no || '',
          fail_reason: ''
        }, '已转入教师微信零钱')
      }

      if (code === 0 && status === 'wait_confirm') {
        await recordIncomeIfNeeded()
        console.log(logPrefix, '待确认：需教师在微信确认收款', {
          teacher_id,
          amount: payAmount,
          withdraw_id: data.withdraw_id || data.request_id,
          has_package: !!data.package_info
        })
        return success({
          transfer_ok: true,
          status: 'wait_confirm',
          auto_transferred: false,
          need_confirm: true,
          amount: payAmount,
          withdraw_id: data.withdraw_id || data.request_id || '',
          package_info: data.package_info || '',
          mchId: data.mchId || '',
          appId: data.appId || '',
          fail_reason: '需教师在微信确认收款后到账'
        }, '已发起转账，待教师确认收款')
      }

      if (code === 0 && status === 'pending') {
        await recordIncomeIfNeeded()
        console.log(logPrefix, '处理中：微信受理转账', {
          teacher_id,
          amount: payAmount,
          payment_no: data.payment_no
        })
        return success({
          transfer_ok: true,
          status: 'pending',
          auto_transferred: false,
          need_confirm: false,
          amount: payAmount,
          withdraw_id: data.withdraw_id || data.request_id || '',
          payment_no: data.payment_no || '',
          fail_reason: '微信转账处理中'
        }, '转账处理中')
      }

      const failReason = (transferRes && transferRes.data && transferRes.data.fail_reason)
        || (transferRes && transferRes.message)
        || data.fail_reason
        || status
        || '转账失败'
      console.error(logPrefix, '失败', {
        teacher_id,
        amount: payAmount,
        appointment_id,
        code,
        status,
        fail_reason: failReason,
        raw: transferRes
      })
      return error(toPublicPayMessage(failReason), -1, {
        transfer_ok: false,
        status: status || 'failed',
        auto_transferred: false,
        need_confirm: false,
        amount: payAmount,
        fail_reason: failReason,
        fail_reason_public: toPublicPayMessage(failReason),
        merchant_fund_short: isMerchantFundShortage(failReason)
      })
    } catch (e) {
      console.error(logPrefix, '异常', {
        teacher_id,
        amount,
        appointment_id,
        message: e.message,
        stack: e.stack
      })
      return error(toPublicPayMessage(e.message || '直接打款异常'), -1, {
        transfer_ok: false,
        fail_reason: e.message || '直接打款异常',
        fail_reason_public: toPublicPayMessage(e.message || '直接打款异常'),
        merchant_fund_short: isMerchantFundShortage(e.message)
      })
    }
  },

  /**
   * 后台：对失败的打款单重新发起微信转账
   */
  async retryFailedPayout(params = {}) {
    try {
      await assertStaff(this)
      const withdraw_id = params.withdraw_id || ''
      if (!withdraw_id) return error('打款单ID不能为空')

      const db = uniCloud.database()
      const doc = await db.collection(WITHDRAW_COLLECTION).doc(withdraw_id).get()
      const withdraw = doc.data && doc.data[0]
      if (!withdraw) return error('打款单不存在')
      if (withdraw.status !== 'failed') return error('仅支持失败单重新打款')
      if (withdraw.handled) return success({ already: true }, '该失败单已处理')

      const payRes = await runLocal(this, 'directPayTeacher', {
        teacher_id: withdraw.teacher_id,
        amount: withdraw.amount,
        appointment_id: withdraw.appointment_id || '',
        remark: withdraw.remark || '补打课酬'
      })
      if (!payRes || payRes.code !== 0) {
        return error(
          (payRes && payRes.data && payRes.data.fail_reason) || (payRes && payRes.message) || '重新打款失败',
          -1,
          payRes && payRes.data
        )
      }

      const status = (payRes.data && payRes.data.status) || ''
      await db.collection(WITHDRAW_COLLECTION).doc(withdraw_id).update({
        handled: true,
        handled_time: Date.now(),
        handled_remark: status === 'wait_confirm' ? '已重新发起，待教师确认收款' : '已重新打款',
        update_time: Date.now()
      })
      return success(payRes.data, payRes.message || '已重新打款')
    } catch (e) {
      return error(e.message || '重新打款失败')
    }
  },

  /**
   * 课程结算后自动打款到微信零钱（由 appointment-complete 调用）
   * 钱包暂时停用：不再把失败金额写入 balance，统一打零钱（含待确认）
   */
  async settleToWechat(params = {}) {
    const {
      teacher_id,
      amount,
      appointment_id = '',
      remark = '课程收入到账',
      income_title = '',
      income_type = 'income',
      income_source = 'appointment_complete',
      disable_wallet_fallback = true
    } = params

    try {
      if (!teacher_id) return error('教师ID不能为空')
      const settleAmount = roundCurrency(amount)
      if (settleAmount <= 0) {
        return success({ skipped: true, settled: true }, '无需打款')
      }

      const db = uniCloud.database()
      await ensureWalletExists(db, teacher_id)

      // 先记收入流水（无论是否立刻到零钱）
      const incomeDescription = await resolveIncomeDescription(
        db,
        appointment_id,
        remark
      )
      const incomeTx = await appendTransaction(db, teacher_id, {
        type: income_type === 'refund' ? 'refund' : 'income',
        title: income_title || (remark.includes('信息费') ? '信息费退还' : (remark.includes('试课') ? '试课收入' : '课程收入')),
        description: incomeDescription,
        amount: settleAmount,
        status: 'completed',
        appointment_id: appointment_id || null,
        source: income_source
      })

      // 累计收入始终增加（统计用，不增加可提现余额）
      const _ = db.command
      await db.collection(WALLET_COLLECTION)
        .where({ teacher_id })
        .update({
          total_income: _.inc(settleAmount),
          update_time: Date.now()
        })

      const transferRes = await runLocal(this, '_createAndTransfer', {
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
            need_confirm: false,
            settled: true
          }, '收入已转入微信零钱')
        }
        if (status === 'wait_confirm') {
          // 待微信确认收款：不入钱包余额
          return success({
            ...transferRes.data,
            income_transaction_id: incomeTx && incomeTx.id,
            auto_transferred: false,
            need_confirm: true,
            settled: true
          }, '已发起转账，请教师在微信确认收款')
        }
        if (status === 'pending') {
          return success({
            ...transferRes.data,
            income_transaction_id: incomeTx && incomeTx.id,
            auto_transferred: false,
            need_confirm: false,
            settled: true
          }, '转账处理中')
        }
      }

      const failReason = (transferRes && transferRes.data && transferRes.data.fail_reason)
        || (transferRes && transferRes.message)
        || '自动转账未完成'
      if (!disable_wallet_fallback) {
        await db.collection(WALLET_COLLECTION)
          .where({ teacher_id })
          .update({
            balance: _.inc(settleAmount),
            update_time: Date.now()
          })
        return success({
          auto_transferred: false,
          need_confirm: false,
          fail_reason: failReason,
          income_transaction_id: incomeTx && incomeTx.id,
          settled: true,
          ...(transferRes && transferRes.data ? transferRes.data : {})
        }, '收入已入钱包，可手动提现')
      }

      console.error('[teacher-wallet] settleToWechat 打款失败且已禁用钱包兜底:', failReason)
      return error(toPublicPayMessage(failReason), -1, {
        auto_transferred: false,
        need_confirm: false,
        settled: false,
        fail_reason: failReason,
        fail_reason_public: toPublicPayMessage(failReason),
        merchant_fund_short: isMerchantFundShortage(failReason),
        income_transaction_id: incomeTx && incomeTx.id
      })
    } catch (e) {
      console.error('[teacher-wallet] settleToWechat 失败', e)
      if (!disable_wallet_fallback) {
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

      const config = await runLocal(this, 'getWeChatPayConfig')
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

      const queryRes = await runLocal(this, 'queryWeChatTransfer', withdraw.out_bill_no)
      if (!queryRes.success) {
        return error(queryRes.message || '查询转账状态失败')
      }

      const state = queryRes.state
      const now = Date.now()
      const _ = db.command

      if (state === 'SUCCESS') {
        await runLocal(this, '_markWithdrawCompleted', db, withdraw, queryRes.transfer_bill_no || withdraw.payment_no)
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
        const queryRes = await runLocal(this, 'queryWeChatTransfer', withdraw.out_bill_no)
        if (queryRes.success && queryRes.state === 'SUCCESS') {
          await runLocal(this, '_markWithdrawCompleted', db, withdraw, queryRes.transfer_bill_no)
          return success({ withdraw_id, status: 'completed' }, '提现已完成')
        }
        const config = await runLocal(this, 'getWeChatPayConfig')
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
        return await runLocal(this, '_createAndTransfer', {
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
      return await runLocal(this, '_transferExistingWithdraw', db, withdraw)
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
    return await runLocal(this, '_transferExistingWithdraw', db, withdraw, { skipBalanceFreeze })
  },

  async _transferExistingWithdraw(db, withdraw, options = {}) {
    const { skipBalanceFreeze = false } = options
    const now = Date.now()

    const userDoc = await db.collection('uni-id-users')
      .doc(withdraw.teacher_id)
      .field({ wx_openid: true })
      .get()

    if (!userDoc.data || !userDoc.data.length) {
      return await runLocal(this, '_failWithdraw', db, withdraw, '用户信息不存在', { skipBalanceFreeze })
    }

    const openid = userDoc.data[0].wx_openid && userDoc.data[0].wx_openid.mp
    if (!openid) {
      return await runLocal(this, '_failWithdraw', db, withdraw, '未获取到教师微信OpenID，请先用微信登录小程序', { skipBalanceFreeze })
    }

    const outBillNo = withdraw.out_bill_no || `TW${Date.now()}${Math.random().toString(36).slice(2, 8)}`.slice(0, 32)
    await db.collection(WITHDRAW_COLLECTION).doc(withdraw._id).update({
      out_bill_no: outBillNo,
      update_time: now
    })

    const transferResult = await runLocal(this, 'callWeChatTransfer', {
      openid,
      amount: Math.round(Number(withdraw.amount) * 100),
      description: (withdraw.remark || '教师课酬').slice(0, 32),
      partner_trade_no: outBillNo
    })

    if (transferResult.success && transferResult.state === 'SUCCESS') {
      await runLocal(this, '_markWithdrawCompleted', db, { ...withdraw, out_bill_no: outBillNo }, transferResult.payment_no, {
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
      await runLocal(this, '_updateWithdrawTransaction', db, withdraw._id, {
        status: 'pending',
        description: '待确认收款后到账'
      })
      const config = await runLocal(this, 'getWeChatPayConfig')
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

    return await runLocal(
      this,
      '_failWithdraw',
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
    }
    // auto_settle 已统一打零钱、不再入余额，确认到账时无需再扣 balance

    await db.collection(WALLET_COLLECTION)
      .where({ teacher_id: withdraw.teacher_id })
      .update(walletUpdate)

    await runLocal(this, '_updateWithdrawTransaction', db, withdraw._id, {
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

    await runLocal(this, '_updateWithdrawTransaction', db, withdraw._id, {
      status: 'failed',
      description: isMerchantFundShortage(reason)
        ? PUBLIC_PAY_PENDING_REVIEW
        : `到账未完成：${toPublicPayMessage(reason)}`
    })

    return error(toPublicPayMessage(reason), -1, {
      fail_reason: reason,
      fail_reason_public: toPublicPayMessage(reason),
      merchant_fund_short: isMerchantFundShortage(reason)
    })
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
   * 阿里云必须走固定出口 IP 代理，否则微信商家转账会报「此IP地址不允许调用接口」
   * 文档：https://doc.dcloud.net.cn/uniCloud/cf-functions.html#eip
   * 需将代理 IP 全部加入商户平台「商家转账」IP 白名单：
   * 47.92.132.2 / 47.92.152.34 / 47.92.87.58 / 47.92.207.183 / 8.142.185.204
   */
  async _requestWeChatPayEip(method, url, bodyStr, authHeaders) {
    const headers = {
      Accept: 'application/json',
      ...(authHeaders || {})
    }
    let eipRes
    if (method === 'GET') {
      try {
        eipRes = await uniCloud.httpProxyForEip.get(url, null, headers)
      } catch (getErr) {
        eipRes = await uniCloud.httpProxyForEip.get(url, {}, headers)
      }
    } else {
      // 用 post + 原始 bodyStr，保证与签名原文一致（勿用 postJson 二次序列化）
      headers['Content-Type'] = 'application/json'
      eipRes = await uniCloud.httpProxyForEip.post(url, bodyStr || '', headers)
    }

    const status = eipRes.statusCodeValue != null
      ? Number(eipRes.statusCodeValue)
      : (eipRes.status != null ? Number(eipRes.status) : (eipRes.statusCode != null ? Number(eipRes.statusCode) : 0))
    let data = eipRes.body
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (e) {
        data = { message: data }
      }
    }
    if (data == null) data = {}
    return { status, data, headers: eipRes.headers || {} }
  },

  /**
   * 调用微信商家转账（新版 transfer-bills）
   */
  async callWeChatTransfer(params) {
    const { openid, amount, description, partner_trade_no } = params
    const config = await runLocal(this, 'getWeChatPayConfig')

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
      const runner = getLocalRunner(this, 'buildWeChatPayHeaders')
      const headers = runner.buildWeChatPayHeaders(url, 'POST', bodyStr, config)
      const response = await runLocal(this, '_requestWeChatPayEip', 'POST', url, bodyStr, headers)

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

      const errorMsg = (response.data && (response.data.message || response.data.detail || response.data.code)) ||
        `转账失败(${response.status})`
      const errCode = (response.data && response.data.code) || ''
      return {
        success: false,
        message: errorMsg,
        code: errCode,
        merchant_fund_short: isMerchantFundShortage(errorMsg, errCode)
      }
    } catch (error) {
      console.error('[微信转账] API调用异常:', error)
      return {
        success: false,
        message: error.message || '转账请求失败'
      }
    }
  },

  async queryWeChatTransfer(outBillNo) {
    const config = await runLocal(this, 'getWeChatPayConfig')
    if (!config.mchId || !config.privateKey || !config.serialNo) {
      return { success: false, message: '微信支付配置不完整' }
    }
    try {
      const url = `https://api.mch.weixin.qq.com/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/${outBillNo}`
      const runner = getLocalRunner(this, 'buildWeChatPayHeaders')
      const headers = runner.buildWeChatPayHeaders(url, 'GET', '', config)
      const response = await runLocal(this, '_requestWeChatPayEip', 'GET', url, '', headers)
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
        message: (response.data && (response.data.message || response.data.detail)) || '查询失败'
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

