<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3 text-white">
			<view class="d-flex flex-column mb-3">
				<text class="font-lg font-weight mb-1">收支明细</text>
				<text class="font-sm" style="opacity: 0.85;">查看所有课程收入、提现和退款记录</text>
			</view>
			<view class="d-flex a-center">
				<view
					v-for="filter in filters"
					:key="filter.value"
					class="flex-1 text-center rounded py-2 mr-2 font-sm"
					:class="currentFilter === filter.value ? 'tab-active' : 'tab-inactive'"
					@click="changeFilter(filter.value)"
				>
					{{ filter.label }}
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="scroll" @scrolltolower="loadMore">
			<view class="px-2 py-3">
				<card class="mb-3">
					<view v-if="displayList.length" class="d-flex flex-column">
						<view v-for="item in displayList" :key="item._id" class="d-flex a-center py-3 border-bottom">
							<view class="rounded-circle d-flex a-center j-center mr-3 font-sm text-white" :class="iconClass(item.type)" style="width: 70rpx; height: 70rpx;">
								{{ iconText(item.type) }}
							</view>
							<view class="flex-1">
								<view class="d-flex a-center j-sb mb-1">
									<text class="font-sm font-weight">{{ item.title }}</text>
									<text class="font-sm font-weight" :class="amountClass(item.amount)">
										{{ item.amount > 0 ? '+' : '' }}¥{{ formatCurrency(item.amount) }}
									</text>
								</view>
								<view class="d-flex a-center j-sb">
									<text class="font-xs text-light-muted">{{ item.description || defaultDescription(item.type) }}</text>
									<text class="font-xs text-light-muted">{{ formatTime(item.create_time) }}</text>
								</view>
							</view>
						</view>
					</view>
					<view v-else-if="!loading" class="d-flex flex-column a-center j-center py-5">
						<view class="icon-empty" style="color: #ddd;"></view>
						<text class="text-light-muted font-md mt-3">暂无相关记录</text>
					</view>
				</card>

				<view v-if="loading" class="text-center text-light-muted font py-3">加载中...</view>
				<view v-else-if="finished && displayList.length" class="text-center text-light-muted font py-3">没有更多了</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

export default {
	name: 'TeacherWalletIncome',
	components: {
		card
	},
	mixins: [pullRefreshMixin],
	data() {
		return {
			filters: [
				{ label: '全部', value: 'all' },
				{ label: '收入', value: 'income' },
				{ label: '提现', value: 'withdraw' },
				{ label: '退款', value: 'refund' }
			],
			currentFilter: 'all',
			list: [],
			displayList: [],
			page: 1,
			pageSize: 20,
			finished: false,
			loading: false,
			useMock: false
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.resetAndLoad()
	},
	methods: {
		async refreshData() {
			console.log('[teacher-wallet-income] 下拉刷新：重新加载收入明细')
			await this.resetAndLoad()
		},
		resetAndLoad() {
			this.page = 1
			this.finished = false
			this.list = []
			this.displayList = []
			this.loadList()
		},
		async loadList() {
			if (this.loading || this.finished) return
			this.loading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const mockData = Array.from({ length: 8 }).map((_, idx) => ({
						_id: `mock${this.page}-${idx}`,
						title: idx % 2 === 0 ? '课程收入' : '提现申请',
						description: idx % 2 === 0 ? '数学课程 2025-01-02' : '微信零钱提现',
						amount: idx % 2 === 0 ? 200 + idx * 10 : -300,
						type: idx % 2 === 0 ? 'income' : 'withdraw',
						create_time: Date.now() - idx * 86400000
					}))
					if (this.page === 1) {
						this.list = mockData
					} else {
						this.list = [...this.list, ...mockData]
					}
					if (mockData.length < this.pageSize) {
						this.finished = true
					}
					this.filterList()
					this.page += 1
					return
				}

				const walletObj = uniCloud.importObject('teacher-wallet', { customUI: true })
				const res = await walletObj.getTransactions({
					page: this.page,
					pageSize: this.pageSize
				})
				console.log('[teacher-wallet-income] getTransactions 返回:', res)
				if (res.code === 0 && res.data) {
					const fetched = res.data.list || []
					console.log('[teacher-wallet-income] 本次获取记录数:', fetched.length, '当前总数:', this.list.length)
					if (this.page === 1) {
						this.list = fetched
					} else {
						this.list = [...this.list, ...fetched]
					}
					if (this.list.length >= (res.data.pagination?.total || 0)) {
						this.finished = true
					} else {
						this.page += 1
					}
					this.filterList()
				} else {
					uni.showToast({ title: res.message || '获取交易记录失败', icon: 'none' })
				}
			} catch (error) {
				console.error('获取交易记录失败:', error)
				uni.showToast({ title: '获取交易记录失败，请稍后再试', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		loadMore() {
			this.loadList()
		},
		changeFilter(filter) {
			if (this.currentFilter === filter) return
			this.currentFilter = filter
			this.filterList()
		},
		filterList() {
			if (this.currentFilter === 'all') {
				this.displayList = [...this.list]
			} else {
				this.displayList = this.list.filter(item => item.type === this.currentFilter)
			}
		},
		formatCurrency(value) {
			const num = Number(value || 0)
			return num.toFixed(2)
		},
		formatTime(timestamp) {
			const date = new Date(timestamp || Date.now())
			const year = date.getFullYear()
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${year}-${month}-${day} ${hour}:${minute}`
		},
		iconText(type) {
			if (type === 'withdraw') return '提'
			if (type === 'refund') return '退'
			return '收'
		},
		iconClass(type) {
			if (type === 'withdraw') return 'bg-warning'
			if (type === 'refund') return 'bg-danger'
			return 'main-bg-color'
		},
		amountClass(amount) {
			return amount >= 0 ? 'text-success' : 'text-danger'
		},
		defaultDescription(type) {
			if (type === 'withdraw') return '提现到账'
			if (type === 'refund') return '退款处理'
			return '课程收入'
		}
	}
}
</script>

<style scoped>
.scroll {
	flex: 1;
	height: calc(100vh - 300rpx);
}

/* 选中状态的选项卡样式 */
.tab-active {
	background-color: #FFFFFF;
	color: #07C160;
	font-weight: 600;
}

/* 未选中状态的选项卡样式 */
.tab-inactive {
	background-color: rgba(255, 255, 255, 0.2);
	color: #FFFFFF;
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