<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3 text-white">
			<view class="d-flex flex-column mb-3">
				<text class="font-sm d-block mb-2" style="opacity: 0.85;">可提现余额</text>
				<text class="font-xl font-weight d-block mb-2">¥{{ formatCurrency(wallet.balance) }}</text>
				<text class="font-xs d-block" style="opacity: 0.75;">提现申请将在2个工作日内完成</text>
			</view>
			<button class="bg-white main-text-color rounded px-4 py-2 font-sm" @click="goToWithdraw">提现</button>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 统计卡片 -->
				<view class="d-flex mb-3">
					<view class="flex-1 bg-white rounded px-3 py-3 mr-2 border-left" style="border-left-width: 6rpx; border-left-color: #667eea;">
						<text class="font-xs text-light-muted d-block mb-1">累计收入</text>
						<text class="font-md font-weight">¥{{ formatCurrency(wallet.total_income) }}</text>
					</view>
					<view class="flex-1 bg-white rounded px-3 py-3 mr-2 border-left" style="border-left-width: 6rpx; border-left-color: #2ecc71;">
						<text class="font-xs text-light-muted d-block mb-1">累计提现</text>
						<text class="font-md font-weight">¥{{ formatCurrency(wallet.total_withdraw) }}</text>
					</view>
					<view class="flex-1 bg-white rounded px-3 py-3 border-left" style="border-left-width: 6rpx; border-left-color: #ffba5a;">
						<text class="font-xs text-light-muted d-block mb-1">冻结金额</text>
						<text class="font-md font-weight">¥{{ formatCurrency(wallet.frozen_amount) }}</text>
					</view>
				</view>

				<!-- 最近交易 -->
				<card headTitle="最近交易" class="mb-3">
					<view slot="right" class="main-text-color font-sm d-flex a-center" @click="goToIncome">查看全部<text class="iconfont icon-you ml-1"></text></view>
					<view v-if="recentTransactions.length" class="d-flex flex-column">
						<view v-for="item in recentTransactions" :key="item._id" class="d-flex a-center j-sb py-3 border-bottom">
							<view class="flex-1">
								<text class="font-sm font-weight d-block mb-1">{{ item.title }}</text>
								<text class="font-xs text-light-muted d-block">{{ item.description || defaultDescription(item.type) }}</text>
							</view>
							<view class="d-flex flex-column a-end">
								<text class="font-sm font-weight mb-1" :class="amountClass(item.amount)">
									{{ item.amount > 0 ? '+' : '' }}¥{{ formatCurrency(item.amount) }}
								</text>
								<text class="font-xs text-light-muted">{{ formatTime(item.create_time) }}</text>
							</view>
						</view>
					</view>
					<view v-else class="d-flex flex-column a-center j-center py-5">
						<view class="icon-empty" style="color: #ddd;"></view>
						<text class="text-light-muted font-md mt-3">暂无收支记录</text>
					</view>
				</card>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

export default {
	name: 'TeacherWalletIndex',
	components: {
		card
	},
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
			useMock: false,
			loading: false
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.loadWallet()
	},
	methods: {
		async refreshData() {
			console.log('[teacher-wallet] 下拉刷新：重新加载钱包')
			await this.loadWallet()
		},
		async loadWallet() {
			if (this.loading) return
			this.loading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					this.wallet = {
						balance: 1280,
						total_income: 5000,
						total_withdraw: 3720,
						frozen_amount: 300
					}
					this.recentTransactions = [
						{
							_id: 'mock1',
							title: '课程收入',
							description: '2025-01-02 数学课程',
							amount: 300,
							type: 'income',
							create_time: Date.now() - 86400000
						},
						{
							_id: 'mock2',
							title: '提现申请',
							description: '微信零钱提现',
							amount: -500,
							type: 'withdraw',
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
			return amount >= 0 ? 'text-success' : 'text-danger'
		},
		defaultDescription(type) {
			if (type === 'withdraw') return '资金提现'
			if (type === 'refund') return '退款处理'
			return '课程收入'
		},
		goToWithdraw() {
			uni.navigateTo({ url: '/pages-teacher/wallet/withdraw' })
		},
		goToIncome() {
			uni.navigateTo({ url: '/pages-teacher/wallet/income' })
		}
	}
}
</script>

<style scoped>
.scroll {
	flex: 1;
	height: calc(100vh - 300rpx);
}

/* CSS图标样式 */
.icon-empty {
	width: 240rpx;
	height: 240rpx;
	position: relative;
	display: inline-block;
	border: 4rpx dashed #ddd;
	border-radius: 20rpx;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-empty::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -60%);
	width: 60rpx;
	height: 60rpx;
	border: 4rpx solid #ddd;
	border-radius: 50%;
}
.icon-empty::after {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -30%);
	width: 80rpx;
	height: 4rpx;
	background: #ddd;
}
</style>