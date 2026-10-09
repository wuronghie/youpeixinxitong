<template>
	<view class="page">
		<view class="tabs">
			<view
				v-for="filter in filters"
				:key="filter.value"
				class="tab"
				:class="{ on: currentFilter === filter.value }"
				@click="changeFilter(filter.value)"
			>
				{{ filter.label }}
			</view>
		</view>

		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view v-if="displayList.length" class="form-card">
				<view
					v-for="item in displayList"
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
						<text class="tx-desc">{{ item.description || defaultDescription(item.type) }} · {{ formatTime(item.create_time) }}</text>
					</view>
					<text class="tx-amount" :class="amountClass(item.amount)">
						{{ item.amount > 0 ? '+' : '' }}¥{{ formatCurrency(item.amount) }}
					</text>
				</view>
			</view>

			<view v-else-if="!loading" class="empty">
				<text class="empty-title">暂无相关记录</text>
			</view>

			<view v-if="loading" class="footer-tip">加载中...</view>
			<view v-else-if="finished && displayList.length" class="footer-tip">没有更多了</view>
		</scroll-view>
	</view>
</template>

<script>
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

export default {
	name: 'TeacherWalletIncome',
	mixins: [pullRefreshMixin],
	data() {
		return {
			filters: [
				{ label: '全部', value: 'all' },
				{ label: '收入', value: 'income' },
				{ label: '退款', value: 'refund' }
			],
			currentFilter: 'all',
			list: [],
			displayList: [],
			page: 1,
			pageSize: 20,
			finished: false,
			loading: false,
			_reloadQueued: false,
			useMock: false
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.resetAndLoad()
	},
	onShow() {
		if (this.useMock) return
		this.resetAndLoad()
	},
	methods: {
		async refreshData() {
			console.log('[teacher-wallet-income] 下拉刷新：重新加载收入明细')
			await this.resetAndLoad()
		},
		resetAndLoad() {
			if (this.loading) {
				this._reloadQueued = true
				return
			}
			this.page = 1
			this.finished = false
			this.list = []
			this.displayList = []
			this.loadList()
		},
		async loadList() {
			if (this.loading || this.finished) return
			this.loading = true
			this._reloadQueued = false
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const mockData = Array.from({ length: 8 }).map((_, idx) => ({
						_id: `mock${this.page}-${idx}`,
						title: idx % 2 === 0 ? '课程收入' : '试课收入',
						description: idx % 2 === 0 ? '家长 张三 · 课程' : '家长 李四 · 试课',
						amount: 200 + idx * 10,
						type: 'income',
						arrive_status: idx % 3 === 0 ? 'wait_confirm' : 'arrived',
						arrive_label: idx % 3 === 0 ? '待确认收款' : '已到账',
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
				if (this._reloadQueued) {
					this._reloadQueued = false
					this.resetAndLoad()
				}
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
				// 旧「提现」流水对外视为到账记录，一并展示
				this.displayList = [...this.list]
			} else if (this.currentFilter === 'income') {
				this.displayList = this.list.filter(item => item.type === 'income' || item.type === 'withdraw')
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
		}
	}
}
</script>

<style scoped>
.page {
	background: #F4F6F9;
	min-height: 100vh;
}

.tabs {
	display: flex;
	background: #FFFFFF;
	border-bottom: 1rpx solid #EBEDF0;
	padding: 0 8rpx;
}

.tab {
	flex: 1;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 26rpx;
	color: #5C6370;
	position: relative;
}

.tab.on {
	color: #2563EB;
	font-weight: 600;
}

.tab.on::after {
	content: "";
	position: absolute;
	left: 22%;
	right: 22%;
	bottom: 8rpx;
	height: 4rpx;
	background: #2563EB;
	border-radius: 4rpx;
}

.list-scroll {
	height: calc(100vh - 176rpx);
}

.form-card {
	margin: 24rpx 32rpx;
	padding: 8rpx 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.tx-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
	padding: 28rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.tx-row:last-child {
	border-bottom: none;
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
	line-height: 1.4;
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

.tx-amount {
	flex-shrink: 0;
	font-size: 28rpx;
	font-weight: 600;
}

.amt-plus {
	color: #07C160;
}

.amt-minus {
	color: #FA5151;
}

.empty {
	padding: 80rpx 32rpx;
	text-align: center;
}

.empty-title {
	font-size: 26rpx;
	color: #8B919C;
}

.footer-tip {
	padding: 16rpx 0 40rpx;
	text-align: center;
	font-size: 22rpx;
	color: #8B919C;
}
</style>