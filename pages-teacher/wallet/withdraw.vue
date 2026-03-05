<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3 text-white">
			<view class="d-flex flex-column mb-3">
				<text class="font-sm d-block mb-2" style="opacity: 0.85;">可提现金额</text>
				<text class="font-xl font-weight d-block mb-2">¥{{ formatCurrency(availableBalance) }}</text>
			</view>
			<view class="stat-card rounded px-3 py-2">
				<view class="flex-1 text-center">
					<text class="font-xs text-white d-block mb-1" style="opacity: 0.9;">冻结金额</text>
					<text class="font-sm font-weight text-white">¥{{ formatCurrency(walletInfo.frozen_amount || 0) }}</text>
				</view>
				<view style="width: 2rpx; height: 60rpx; background: rgba(255,255,255,0.2);"></view>
				<view class="flex-1 text-center">
					<text class="font-xs text-white d-block mb-1" style="opacity: 0.9;">累计提现</text>
					<text class="font-sm font-weight text-white">¥{{ formatCurrency(walletInfo.total_withdraw || 0) }}</text>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 提现金额 -->
				<card headTitle="提现金额" class="mb-3">
					<view class="d-flex a-center j-sb mb-2">
						<text class="font-sm text-light-muted">最低提现 {{ formatCurrency(minAmount) }} 元</text>
					</view>
					<view class="d-flex a-center bg-light-secondary rounded px-3 py-3 mb-3">
						<text class="font-lg font-weight main-text-color mr-2">¥</text>
						<input
							class="flex-1 font-lg font-weight"
							type="digit"
							v-model="withdrawAmount"
							placeholder="请输入提现金额"
							placeholder-class="text-light-muted"
							@input="onAmountInput"
							confirm-type="done"
						/>
					</view>
					<view class="d-flex flex-wrap">
						<view
							v-for="amount in quickAmounts"
							:key="amount"
							class="rounded px-3 py-2 mr-2 mb-2 font-sm"
							:class="amount > availableBalance ? 'bg-light-secondary text-light-muted' : 'bg-light-secondary main-text-color'"
							@click="setQuickAmount(amount)"
						>
							¥{{ amount }}
						</view>
						<view class="rounded px-3 py-2 mr-2 mb-2 font-sm bg-light-secondary main-text-color" @click="setQuickAmount(availableBalance)">全部提现</view>
					</view>
				</card>

				<!-- 提现方式 -->
				<card headTitle="提现方式" class="mb-3">
					<view
						class="d-flex a-center bg-light-secondary rounded px-3 py-3"
						:class="selectedMethod === 'wxpay' ? 'border border-primary' : ''"
						@click="selectMethod('wxpay')"
					>
						<view class="rounded-circle d-flex a-center j-center mr-3 main-bg-color text-white font-sm" style="width: 72rpx; height: 72rpx;">💳</view>
						<view class="flex-1">
							<text class="font-sm font-weight d-block mb-1">微信零钱</text>
							<text class="font-xs text-light-muted">系统默认提现至认证微信账号</text>
						</view>
						<text class="font-xs main-text-color">快速到账</text>
					</view>
				</card>

				<!-- 到账说明 -->
				<card headTitle="到账说明" class="mb-3">
					<view class="d-flex flex-column">
						<text class="font-xs text-light-muted mb-2">• 提现申请提交后 1-3 个工作日内到账</text>
						<text class="font-xs text-light-muted mb-2">• 单次提现金额需 ≥ {{ formatCurrency(minAmount) }} 元</text>
						<text class="font-xs text-light-muted mb-2">• 每日最多可提现 3 次，超出将自动顺延</text>
						<text class="font-xs text-light-muted">• 提现期间金额将转入冻结账户，请耐心等待审核</text>
					</view>
				</card>
			</view>
		</scroll-view>

		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<button
				class="w-100 main-bg-color text-white rounded px-3 py-2 font-sm"
				:disabled="submitDisabled || isSubmitting"
				@click="submitWithdraw"
			>
				{{ isSubmitting ? '提交中...' : '提交提现申请' }}
			</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { useMockData } from '@/utils/mockData.js'

export default {
	name: 'TeacherWalletWithdraw',
	components: {
		card
	},
	data() {
		return {
			walletInfo: {
				balance: 0,
				frozen_amount: 0,
				total_income: 0,
				total_withdraw: 0
			},
			withdrawAmount: '',
			quickAmounts: [100, 200, 500, 1000],
			selectedMethod: 'wxpay',
			minAmount: 100,
			isSubmitting: false,
			useMock: false
		}
	},
	computed: {
		availableBalance() {
			return Number(this.walletInfo.balance || 0)
		},
		submitDisabled() {
			const amount = Number(this.withdrawAmount)
			return (
				!amount ||
				Number.isNaN(amount) ||
				amount < this.minAmount ||
				amount > this.availableBalance
			)
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.loadWallet()
	},
	methods: {
		async loadWallet() {
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					this.walletInfo = {
						balance: 1680.5,
						frozen_amount: 200,
						total_income: 8860,
						total_withdraw: 3200
					}
					return
				}

				const walletObj = uniCloud.importObject('teacher-wallet', { customUI: true })
				const res = await walletObj.getWallet()
				if (res.code === 0 && res.data) {
					this.walletInfo = {
						balance: Number(res.data.wallet?.balance || 0),
						frozen_amount: Number(res.data.wallet?.frozen_amount || 0),
						total_income: Number(res.data.wallet?.total_income || 0),
						total_withdraw: Number(res.data.wallet?.total_withdraw || 0)
					}
				} else {
					uni.showToast({ title: res.message || '获取钱包信息失败', icon: 'none' })
				}
			} catch (error) {
				console.error('获取钱包信息失败:', error)
				uni.showToast({ title: '获取钱包信息失败，请稍后再试', icon: 'none' })
			}
		},
		setQuickAmount(amount) {
			const value = Number(amount)
			if (Number.isNaN(value) || value <= 0) return
			if (value > this.availableBalance) {
				uni.showToast({ title: '超出可提现金额', icon: 'none' })
				return
			}
			this.withdrawAmount = value.toFixed(2)
		},
		selectMethod(method) {
			this.selectedMethod = method
		},
		onAmountInput() {
			const raw = this.withdrawAmount.replace(/[^0-9.]/g, '')
			const firstDot = raw.indexOf('.')
			let filtered = raw
			if (firstDot !== -1) {
				const integerPart = raw.slice(0, firstDot + 1)
				const decimalPart = raw
					.slice(firstDot + 1)
					.replace(/\./g, '')
					.slice(0, 2)
				filtered = integerPart + decimalPart
			}
			this.withdrawAmount = filtered
			const amount = Number(filtered)
			if (!Number.isNaN(amount) && amount > this.availableBalance) {
				this.withdrawAmount = this.availableBalance.toFixed(2)
				uni.showToast({ title: '超出可提现金额', icon: 'none' })
			}
		},
		formatCurrency(value) {
			return Number(value || 0).toFixed(2)
		},
		async submitWithdraw() {
			if (this.submitDisabled || this.isSubmitting) return
			const amount = Number(this.withdrawAmount)

			const content = `提现金额：¥${this.formatCurrency(amount)}\n到账方式：微信零钱`
			try {
				const confirmRes = await new Promise(resolve => {
					uni.showModal({
						title: '确认提现',
						content,
						confirmColor: '#667eea',
						success: res => resolve(res)
					})
				})
				if (!confirmRes || !confirmRes.confirm) return

				this.isSubmitting = true

				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 600))
					uni.showToast({ title: '提现申请已提交', icon: 'success' })
					this.walletInfo.balance = Math.max(this.availableBalance - amount, 0)
					this.withdrawAmount = ''
					setTimeout(() => {
						uni.navigateBack()
					}, 800)
					return
				}

				const walletObj = uniCloud.importObject('teacher-wallet', { customUI: true })
				const res = await walletObj.applyWithdraw({
					amount,
					method: this.selectedMethod
				})
				if (res.code === 0) {
					uni.showToast({ title: '提现申请已提交', icon: 'success' })
					this.withdrawAmount = ''
					await this.loadWallet()
					setTimeout(() => {
						uni.navigateBack()
					}, 800)
				} else {
					uni.showToast({ title: res.message || '提现申请失败', icon: 'none' })
				}
			} catch (error) {
				console.error('提现提交失败:', error)
				uni.showToast({ title: '提现申请失败，请稍后再试', icon: 'none' })
			} finally {
				this.isSubmitting = false
			}
		}
	}
}
</script>

<style scoped>
.scroll {
	flex: 1;
	height: calc(100vh - 400rpx);
	padding-bottom: 160rpx;
}

/* 统计卡片样式 */
.stat-card {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
	display: flex;
	align-items: center;
}
</style>