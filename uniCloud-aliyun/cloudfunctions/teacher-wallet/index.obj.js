/**
 * 教师钱包云对象
 * 功能：查询教师钱包信息与交易记录
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
  await collection.add({
    teacher_id,
    create_time: now,
    update_time: now,
    ...transaction
  })
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
   * 提交提现申请
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
      if (withdrawAmount < 100) {
        return error('提现金额需不少于100元')
      }

      const teacher_id = await resolveTeacherId(this)
      const wallet = await ensureWalletExists(db, teacher_id)

      const currentBalance = Number(wallet.balance || 0)
      if (withdrawAmount > currentBalance) {
        return error('可提现余额不足')
      }

      const walletCollection = db.collection(WALLET_COLLECTION)
      const withdrawCollection = db.collection(WITHDRAW_COLLECTION)
      const _ = db.command
      const now = Date.now()

      const withdrawRecord = {
        teacher_id,
        amount: withdrawAmount,
        method,
        remark,
        status: 'pending',
        create_time: now,
        update_time: now
      }

      const withdrawRes = await withdrawCollection.add(withdrawRecord)
      if (!withdrawRes.id) {
        throw new Error('提现申请创建失败')
      }

      const updateRes = await walletCollection.doc(wallet._id).update({
        balance: _.inc(-withdrawAmount),
        frozen_amount: _.inc(withdrawAmount),
        total_withdraw: _.inc(withdrawAmount),
        update_time: now
      })

      if (!updateRes.updated) {
        throw new Error('更新钱包信息失败')
      }

      await appendTransaction(db, teacher_id, {
        type: 'withdraw',
        title: '提现申请',
        description: remark || '提现申请已提交，等待审核',
        amount: -withdrawAmount,
        status: 'pending',
        relate_id: withdrawRes.id
      })

      return success({
        request_id: withdrawRes.id,
        status: 'pending'
      }, '提现申请已提交，等待审核')
    } catch (e) {
      console.error('[teacher-wallet] 提现申请失败', e)
      return error(e.message || '提现申请失败')
    }
  },

  /**
   * 执行提现转账（调用微信支付企业付款到零钱API）
   * 注意：此方法需要管理员权限，或通过定时任务/管理员后台调用
   * @param {Object} params
   * @param {String} params.withdraw_id 提现申请ID
   * @returns {Object}
   */
  async processWithdraw(params = {}) {
    const db = uniCloud.database()
    const { withdraw_id } = params
    
    try {
      if (!withdraw_id) {
        return error('提现申请ID不能为空')
      }

      // 1. 查询提现申请
      const withdrawDoc = await db.collection(WITHDRAW_COLLECTION)
        .doc(withdraw_id)
        .get()
      
      if (!withdrawDoc.data || withdrawDoc.data.length === 0) {
        return error('提现申请不存在')
      }
      
      const withdraw = withdrawDoc.data[0]
      
      if (withdraw.status !== 'pending') {
        return error(`该提现申请已处理，当前状态：${withdraw.status}`)
      }
      
      // 2. 获取教师的微信OpenID
      const userDoc = await db.collection('uni-id-users')
        .doc(withdraw.teacher_id)
        .field({ wx_openid: true })
        .get()
      
      if (!userDoc.data || userDoc.data.length === 0) {
        return error('用户信息不存在')
      }
      
      const openid = userDoc.data[0].wx_openid?.mp
      if (!openid) {
        return error('未获取到教师微信OpenID，无法转账')
      }
      
      // 3. 调用微信支付转账API
      const transferResult = await this.callWeChatTransfer({
        openid: openid,
        amount: Math.round(withdraw.amount * 100), // 转换为分
        description: '教师提现',
        partner_trade_no: `WITHDRAW_${withdraw_id}_${Date.now()}`
      })
      
      const _ = db.command
      const now = Date.now()
      
      if (!transferResult.success) {
        // 转账失败，回滚钱包余额
        await db.collection(WALLET_COLLECTION)
          .where({ teacher_id: withdraw.teacher_id })
          .update({
            balance: _.inc(withdraw.amount),
            frozen_amount: _.inc(-withdraw.amount),
            update_time: now
          })
        
        // 更新提现申请状态
        await db.collection(WITHDRAW_COLLECTION)
          .doc(withdraw_id)
          .update({
            status: 'failed',
            fail_reason: transferResult.message || '转账失败',
            update_time: now
          })
        
        // 更新交易记录状态
        const transactionDoc = await db.collection(TRANSACTION_COLLECTION)
          .where({ teacher_id: withdraw.teacher_id, relate_id: withdraw_id })
          .orderBy('create_time', 'desc')
          .limit(1)
          .get()
        
        if (transactionDoc.data && transactionDoc.data.length > 0) {
          await db.collection(TRANSACTION_COLLECTION)
            .doc(transactionDoc.data[0]._id)
            .update({
              status: 'failed',
              description: `提现失败：${transferResult.message || '转账失败'}`,
              update_time: now
            })
        }
        
        return error(transferResult.message || '转账失败')
      }
      
      // 4. 转账成功，更新提现申请状态
      await db.collection(WITHDRAW_COLLECTION)
        .doc(withdraw_id)
        .update({
          status: 'completed',
          payment_time: now,
          payment_no: transferResult.payment_no || transferResult.batch_id,
          update_time: now
        })
      
      // 5. 更新钱包（解冻金额）
      await db.collection(WALLET_COLLECTION)
        .where({ teacher_id: withdraw.teacher_id })
        .update({
          frozen_amount: _.inc(-withdraw.amount),
          update_time: now
        })
      
      // 6. 更新交易记录状态
      const transactionDoc = await db.collection(TRANSACTION_COLLECTION)
        .where({ teacher_id: withdraw.teacher_id, relate_id: withdraw_id })
        .orderBy('create_time', 'desc')
        .limit(1)
        .get()
      
      if (transactionDoc.data && transactionDoc.data.length > 0) {
        await db.collection(TRANSACTION_COLLECTION)
          .doc(transactionDoc.data[0]._id)
          .update({
            status: 'completed',
            description: `提现¥${withdraw.amount}已到账`,
            update_time: now
          })
      }
      
      return success({
        withdraw_id,
        status: 'completed',
        payment_no: transferResult.payment_no || transferResult.batch_id,
        amount: withdraw.amount
      }, '提现已完成，资金已转入微信零钱')
      
    } catch (e) {
      console.error('[teacher-wallet] 处理提现转账失败:', e)
      return error(e.message || '处理提现转账失败')
    }
  },

  /**
   * 调用微信支付转账API（商家转账到零钱）
   * @param {Object} params
   * @param {String} params.openid 用户微信OpenID
   * @param {Number} params.amount 转账金额（单位：分）
   * @param {String} params.description 转账描述
   * @param {String} params.partner_trade_no 商户订单号
   * @returns {Object} {success: boolean, message: string, payment_no?: string, batch_id?: string}
   */
  async callWeChatTransfer(params) {
    const { openid, amount, description, partner_trade_no } = params
    
    // 从配置中心或数据库获取微信支付参数
    const config = await this.getWeChatPayConfig()
    
    if (!config.mchId || !config.appId || !config.v3Key) {
      console.error('[微信转账] 微信支付配置不完整')
      return {
        success: false,
        message: '微信支付配置不完整，请联系管理员'
      }
    }
    
    try {
      // 使用微信支付API v3接口：商家转账到零钱
      const url = 'https://api.mch.weixin.qq.com/v3/transfer/batches'
      
      const requestBody = {
        appid: config.appId,
        out_batch_no: partner_trade_no,
        batch_name: description || '教师提现',
        batch_remark: description || '教师提现',
        total_amount: amount,
        total_num: 1,
        transfer_detail_list: [{
          out_detail_no: `${partner_trade_no}_1`,
          transfer_amount: amount,
          transfer_remark: description || '教师提现',
          openid: openid
        }]
      }
      
      // 构建请求头（包含签名）
      const headers = this.buildWeChatPayHeaders(url, 'POST', JSON.stringify(requestBody), config)
      
      const response = await uniCloud.httpclient.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers
        },
        data: requestBody,
        dataType: 'json'
      })
      
      console.log('[微信转账] API响应:', JSON.stringify(response.data))
      
      if (response.status === 200 && response.data && response.data.batch_id) {
        return {
          success: true,
          payment_no: response.data.batch_id,
          batch_id: response.data.batch_id,
          message: '转账成功'
        }
      } else {
        const errorMsg = response.data?.message || response.data?.detail || '转账失败'
        console.error('[微信转账] 转账失败:', errorMsg)
        return {
          success: false,
          message: errorMsg
        }
      }
      
    } catch (error) {
      console.error('[微信转账] API调用异常:', error)
      return {
        success: false,
        message: error.message || '转账请求失败'
      }
    }
  },

  /**
   * 获取微信支付配置
   * @returns {Object} 微信支付配置
   */
  async getWeChatPayConfig() {
    const db = uniCloud.database()
    
    try {
      // 方式1：优先从数据库 system-config 表读取（推荐）
      const configDocs = await db.collection('system-config')
        .where({
          config_key: db.command.in(['wxpay_mchId', 'wxpay_appId', 'wxpay_v3Key', 'wxpay_serialNo', 'wxpay_privateKey'])
        })
        .get()
      
      if (configDocs.data && configDocs.data.length > 0) {
        const configMap = {}
        configDocs.data.forEach(item => {
          configMap[item.config_key] = item.config_value
        })
        
        if (configMap['wxpay_mchId'] && configMap['wxpay_appId'] && configMap['wxpay_v3Key']) {
          return {
            mchId: configMap['wxpay_mchId'],
            appId: configMap['wxpay_appId'],
            v3Key: configMap['wxpay_v3Key'],
            serialNo: configMap['wxpay_serialNo'] || '',
            privateKey: configMap['wxpay_privateKey'] || ''
          }
        }
      }
      
      // 方式2：从环境变量读取（备用）
      return {
        mchId: process.env.WXPAY_MCH_ID || '',
        appId: process.env.WXPAY_APP_ID || 'wx6bbabf79ec2ae369',
        v3Key: process.env.WXPAY_V3_KEY || '',
        serialNo: process.env.WXPAY_SERIAL_NO || '',
        privateKey: process.env.WXPAY_PRIVATE_KEY || ''
      }
    } catch (e) {
      console.error('[微信支付] 获取配置失败:', e)
      // 返回空配置，后续会检查
      return {
        mchId: '',
        appId: '',
        v3Key: '',
        serialNo: '',
        privateKey: ''
      }
    }
  },

  /**
   * 构建微信支付API v3请求头（包含签名）
   * @param {String} url 请求URL
   * @param {String} method 请求方法
   * @param {String} body 请求体（JSON字符串）
   * @param {Object} config 微信支付配置
   * @returns {Object} 请求头对象
   */
  buildWeChatPayHeaders(url, method, body, config) {
    // 微信支付API v3签名算法
    // 参考文档：https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_0.shtml
    
    try {
      const crypto = require('crypto')
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const nonceStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      
      // 构建签名字符串
      const urlObj = new URL(url)
      const urlPath = urlObj.pathname + (urlObj.search || '')
      const signStr = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`
      
      // 使用商户私钥对签名字符串进行RSA-SHA256签名
      if (!config.privateKey) {
        throw new Error('商户私钥未配置')
      }
      
      // 确保私钥格式正确
      let privateKey = config.privateKey.trim()
      if (!privateKey.includes('BEGIN PRIVATE KEY')) {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`
      }
      
      const sign = crypto.createSign('RSA-SHA256')
      sign.update(signStr, 'utf8')
      const signature = sign.sign(privateKey, 'base64')
      
      const token = `mchid="${config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`
      
      return {
        'Authorization': `WECHATPAY2-SHA256-RSA2048 ${token}`
      }
    } catch (error) {
      console.error('[微信支付] 构建签名失败:', error)
      throw new Error(`签名构建失败: ${error.message}`)
    }
  }
}

