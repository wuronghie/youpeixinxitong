<template>
	<view class="page">
		<view class="wallet-band">
			<text class="wallet-label">课酬到账方式</text>
			<text class="wallet-title">微信零钱</text>
			<text class="wallet-desc">课酬结算后直接打入微信零钱。若微信提示确认收款，请在下方处理。</text>
		</view>

		<view v-if="pendingConfirms.length" class="section-card pending-card">
			<text class="section-title">待确认收款（{{ pendingConfirms.length }}）</text>
			<text class="section-tip">微信要求确认后才能到账，请点击按钮完成收款</text>
			<view
				v-for="item in pendingConfirms"
				:key="item._id"
				class="pending-row"
			>
				<view class="pending-main">
					<text class="pending-amount">¥{{ formatCurrency(item.amount) }}</text>
					<text class="pending-time">{{ formatTime(item.create_time) }}</text>
				</view>
				<button
					class="confirm-btn"
					:loading="confirmingId === item._id"
					@click="confirmReceive(item)"
				>确认收款</button>
			</view>
		</view>

		<view class="stats-row" :class="{ 'stats-alone': !pendingConfirms.length }">
			<view class="stat-card">
				<text class="stat-value">¥{{ formatCurrency(wallet.total_income) }}</text>
				<text class="stat-label">累计收入</text>
			</view>
		</view>

		<view class="section-card">
			<view class="section-head">
				<text class="section-title">课酬流水</text>
				<text class="section-more" @click="goToIncome">查看全部 ›</text>
			</view>
			<view v-if="recentTransactions.length">
				<view
					v-for="item in recentTransactions"
					:key="item._id"
					class="tx-row"
				>
					<view class="tx-main">
						<view class="tx-title-row">
							<text class="tx-title">{{ displayTitle(item) }}</text>
							<text
								v-if="item.arrive_label"
								class="arrive-tag"
								:class="arriveClass(item.arrive_status)"
							>{{ item.arrive_label }}</text>
						</view>
						<text class="tx-desc">{{ item.description || defaultDescription(item.type) }}</text>
					</view>
					<view class="tx-side">
						<text class="tx-amount" :class="amountClass(item.amount)">
							{{ item.amount > 0 ? '+' : '' }}¥{{ formatCurrency(item.amount) }}
						</text>
						<text class="tx-time">{{ formatTime(item.create_time) }}</text>
					</view>
				</view>
			</view>
			<view v-else class="empty">
				<text class="empty-title">暂无流水记录</text>
			</view>
		</view>
	</view>
</template>

<script>
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

export default {
	name: 'TeacherWalletIndex',
	mixins: [pullRefreshMixin],
	data() {
		return {
			wallet: {
				balance: 0,
				total_income: 0,
				total_withdraw: 0,
				frozen_amount: 0
			},
			recentTransactions: [],
			pendingConfirms: [],
			confirmingId: '',
			useMock: false,
			loading: false,
			_walletReloadQueued: false
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.loadWallet()
	},
	onShow() {
		if (!this.useMock) {
			this.loadWallet()
			this.loadPendingConfirms()
		}
	},
	methods: {
		async refreshData() {
			console.log('[teacher-wallet] 下拉刷新：重新加载钱包')
			await Promise.all([this.loadWallet(), this.loadPendingConfirms()])
		},
		async loadPendingConfirms() {
			try {
				const walletObj = uniCloud.importObject('teacher-wallet', { customUI: true })
				const res = await walletObj.getPendingConfirmWithdraws()
				if (res.code === 0 && res.data) {
					this.pendingConfirms = res.data.list || []
				}
			} catch (e) {
				console.warn('[teacher-wallet] 加载待确认收款失败', e)
			}
		},
		requestMerchantTransfer(item) {
			return new Promise((resolve, reject) => {
				// #ifdef MP-WEIXIN
				if (typeof wx !== 'undefined' && wx.canIUse && wx.canIUse('requestMerchantTransfer')) {
					wx.requestMerchantTransfer({
						mchId: item.mchId,
						appId: item.appId || (wx.getAccountInfoSync && wx.getAccountInfoSync().miniProgram.appId),
						package: item.package_info,
						success: (res) => resolve(res),
						fail: (err) => reject(err)
					})
					return
				}
				// #endif
				reject(new Error('当前微信版本过低，请更新微信后重试'))
			})
		},
		async confirmReceive(item) {
			if (!item || !item.package_info || this.confirmingId) return
			this.confirmingId = item._id
			try {
				await this.requestMerchantTransfer(item)
				const walletObj = uniCloud.importObject('teacher-wallet', { customUI: true })
				const syncRes = await walletObj.syncWithdrawStatus({ withdraw_id: item._id })
				if (syncRes.code === 0 && syncRes.data && syncRes.data.status === 'completed') {
					uni.showToast({ title: '已到账', icon: 'success' })
				} else {
					uni.showToast({ title: (syncRes && syncRes.message) || '已提交确认，稍后刷新查看', icon: 'none' })
				}
				await Promise.all([this.loadWallet(), this.loadPendingConfirms()])
			} catch (e) {
				console.error('确认收款失败', e)
				const msg = (e && (e.errMsg || e.message)) || '确认收款失败'
				if (String(msg).includes('cancel')) {
					uni.showToast({ title: '已取消确认', icon: 'none' })
				} else {
					uni.showToast({ title: msg, icon: 'none' })
				}
			} finally {
				this.confirmingId = ''
			}
		},
		async loadWallet() {
			if (this.loading) {
				this._walletReloadQueued = true
				return
			}
			this.loading = true
			this._walletReloadQueued = false
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					this.wallet = {
						balance: 0,
						total_income: 5000,
						total_withdraw: 0,
						frozen_amount: 0
					}
					this.recentTransactions = [
						{
							_id: 'mock1',
							title: '课程收入',
							description: '家长 张三 · 课程',
							amount: 300,
							type: 'income',
							arrive_status: 'arrived',
							arrive_label: '已到账',
							create_time: Date.now() - 86400000
						},
						{
							_id: 'mock2',
							title: '试课收入',
							description: '家长 李四 · 试课',
							amount: 200,
							type: 'income',
							arrive_status: 'wait_confirm',
							arrive_label: '待确认收款',
							create_time: Date.now() - 172800000
						}
					]
					return
				}

				const userInfo = uni.getStorageSync('userInfo') || {}
				if (!userInfo.uid || userInfo.role !== 'teacher') {
					uni.showToast({ title: '请先以教师身份登录', icon: 'none' })
					return
				}

				const walletObj = uniCloud.importObject('teacher-wallet', { customUI: true })
				const res = await walletObj.getWallet()
				if (res.code === 0 && res.data) {
					this.wallet = Object.assign({}, this.wallet, res.data.wallet || {})
					this.recentTransactions = res.data.recent_transactions || []
				} else {
					uni.showToast({ title: res.message || '获取钱包信息失败', icon: 'none' })
				}
			} catch (error) {
				console.error('获取钱包信息失败:', error)
				uni.showToast({ title: '获取钱包信息失败，请稍后再试', icon: 'none' })
			} finally {
				this.loading = false
				if (this._walletReloadQueued) {
					this._walletReloadQueued = false
					this.loadWallet()
				}
			}
		},
		formatCurrency(value) {
			const num = Number(value || 0)
			return num.toFixed(2)
		},
		formatTime(timestamp) {
			const date = new Date(timestamp || Date.now())
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${month}-${day} ${hour}:${minute}`
		},
		amountClass(amount) {
			return amount >= 0 ? 'amt-plus' : 'amt-minus'
		},
		arriveClass(status) {
			if (status === 'arrived') return 'arrive-ok'
			if (status === 'wait_confirm' || status === 'pending_review') return 'arrive-warn'
			if (status === 'failed') return 'arrive-fail'
			return 'arrive-muted'
		},
		displayTitle(item) {
			if (!item) return '流水'
			if (item.type === 'withdraw') return item.title || '微信到账'
			return item.title || '课程收入'
		},
		defaultDescription(type) {
			if (type === 'refund') return '退款处理'
			if (type === 'withdraw') return '课酬转入微信零钱'
			return '课程收入'
		},
		goToIncome() {
			uni.navigateTo({ url: '/pages-teacher/wallet/income' })
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
	padding-bottom: 48rpx;
}

.wallet-band {
	background: linear-gradient(160deg, #1D4ED8 0%, #2563EB 58%, #4F7DF3 100%);
	padding: 24rpx 32rpx 72rpx;
	color: #FFFFFF;
}

.wallet-label {
	display: block;
	font-size: 24rpx;
	opacity: 0.82;
}

.wallet-title {
	display: block;
	margin-top: 8rpx;
	font-size: 48rpx;
	font-weight: 600;
	line-height: 1.2;
}

.wallet-desc {
	display: block;
	margin-top: 16rpx;
	font-size: 24rpx;
	line-height: 1.5;
	opacity: 0.82;
}

.section-card,
.stat-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.section-card {
	margin: 0 32rpx 24rpx;
	padding: 28rpx 32rpx;
}

.pending-card {
	margin-top: -48rpx;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8rpx;
}

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.section-tip {
	display: block;
	margin: 8rpx 0 8rpx;
	font-size: 22rpx;
	color: #8B919C;
	line-height: 1.4;
}

.section-more {
	font-size: 24rpx;
	color: #8B919C;
}

.pending-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	padding: 20rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
	min-height: 88rpx;
}

.pending-row:last-child {
	border-bottom: none;
	padding-bottom: 0;
}

.pending-main {
	flex: 1;
	min-width: 0;
}

.pending-amount {
	display: block;
	font-size: 34rpx;
	font-weight: 600;
	color: #1F2329;
}

.pending-time {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #8B919C;
}

.confirm-btn {
	margin: 0;
	padding: 0 28rpx;
	height: 64rpx;
	line-height: 64rpx;
	border-radius: 32rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 26rpx;
	font-weight: 600;
}

.confirm-btn::after {
	border: none;
}

.stats-row {
	display: flex;
	gap: 16rpx;
	margin: 0 32rpx 24rpx;
}

.stats-alone {
	margin-top: -48rpx;
}

.stat-card {
	flex: 1;
	padding: 28rpx 24rpx;
	text-align: center;
}

.stat-value {
	display: block;
	font-size: 36rpx;
	font-weight: 600;
	color: #1F2329;
}

.stat-label {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8B919C;
}

.tx-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
	padding: 24rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.tx-row:last-child {
	border-bottom: none;
	padding-bottom: 0;
}

.tx-main {
	flex: 1;
	min-width: 0;
}

.tx-title-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12rpx;
}

.tx-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #1F2329;
}

.arrive-tag {
	padding: 2rpx 12rpx;
	border-radius: 8rpx;
	font-size: 20rpx;
	line-height: 1.6;
}

.arrive-ok {
	background: #E8F8EF;
	color: #07C160;
}

.arrive-warn {
	background: #FFF7E8;
	color: #ED6A0C;
}

.arrive-fail {
	background: #FDECEC;
	color: #FA5151;
}

.arrive-muted {
	background: #F4F6F9;
	color: #8B919C;
}

.tx-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8B919C;
	line-height: 1.4;
}

.tx-side {
	text-align: right;
	flex-shrink: 0;
}

.tx-amount {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
}

.amt-plus {
	color: #07C160;
}

.amt-minus {
	color: #1F2329;
}

.tx-time {
	display: block;
	margin-top: 8rpx;
	font-size: 20rpx;
	color: #8B919C;
}

.empty {
	padding: 48rpx 0 24rpx;
	text-align: center;
}

.empty-title {
	font-size: 26rpx;
	color: #8B919C;
}
</style>
