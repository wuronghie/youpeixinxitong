<template>
	<view class="page">
		<view class="metrics-card">
			<view class="metric">
				<text class="metric-num">{{ stats.averageRating || '0.0' }}</text>
				<text class="metric-label">平均分</text>
			</view>
			<view class="metric">
				<text class="metric-num">{{ stats.total || 0 }}</text>
				<text class="metric-label">总评价</text>
			</view>
			<view class="metric">
				<text class="metric-num">{{ stats.unreplied || 0 }}</text>
				<text class="metric-label">待回复</text>
			</view>
		</view>

		<view class="tabs">
			<view
				v-for="tab in statusTabs"
				:key="tab.value"
				class="tab"
				:class="{ on: currentStatus === tab.value }"
				@click="changeStatus(tab.value)"
			>
				{{ tab.label }}<text v-if="tab.count && tab.count(stats)"> {{ tab.count(stats) }}</text>
			</view>
		</view>

		<scroll-view scroll-x class="filters" :show-scrollbar="false">
			<view class="filters-inner">
				<text
					v-for="rate in ratingTabs"
					:key="rate.value"
					class="filter"
					:class="{ on: currentRating === rate.value }"
					@click="changeRating(rate.value)"
				>{{ rate.label }}</text>
			</view>
		</scroll-view>

		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view
				v-for="item in list"
				:key="item.review_id"
				class="a-card"
			>
				<text class="a-name">{{ item.parent_name || '家长' }}</text>
				<text class="a-time">
					<text v-for="i in 5" :key="i" class="star" :class="{ on: i <= item.rating }">★</text>
					 · {{ formatTime(item.create_time) }}
				</text>
				<text class="a-content">{{ item.content }}</text>
				<view v-if="item.tags && item.tags.length" class="tags">
					<text v-for="tag in item.tags" :key="tag" class="chip">{{ tag }}</text>
				</view>
				<view v-if="item.teacher_reply" class="reply-box">
					<view class="reply-head">
						<text class="reply-label">我的回复</text>
						<text class="reply-time">{{ formatTime(item.reply_time) }}</text>
					</view>
					<text class="reply-text">{{ item.teacher_reply }}</text>
					<text class="reply-edit" @click="replyReview(item)">修改回复</text>
				</view>
				<view v-else class="a-ops">
					<text class="mini" @click="replyReview(item)">回复</text>
				</view>
			</view>

			<view v-if="!loading && !list.length" class="empty">
				<text class="empty-title">暂时还没有评价记录</text>
			</view>
			<view v-if="loading" class="footer-tip">加载中...</view>
			<view v-else-if="finished && list.length" class="footer-tip">没有更多了</view>
		</scroll-view>
	</view>
</template>

<script>
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

export default {
	name: 'TeacherReviewList',
	mixins: [pullRefreshMixin],
		data() {
			return {
				// 默认头像URL（从CDN）
				defaultAvatarUrl: getDefaultAvatarUrl(),
			statusTabs: [
				{ label: '全部', value: 'all' },
				{
					label: '待回复',
					value: 'unreplied',
					count: stats => stats.unreplied || 0
				},
				{
					label: '已回复',
					value: 'replied',
					count: stats => stats.replied || 0
				}
			],
			ratingTabs: [
				{ label: '全部星级', value: 'all' },
				{ label: '5 星', value: 5 },
				{ label: '4 星', value: 4 },
				{ label: '3 星', value: 3 },
				{ label: '2 星', value: 2 },
				{ label: '1 星', value: 1 }
			],
			currentStatus: 'all',
			currentRating: 'all',
			list: [],
			page: 1,
			pageSize: 10,
			finished: false,
			loading: false,
			stats: {
				total: 0,
				replied: 0,
				unreplied: 0,
				averageRating: '0.0',
				ratingStats: [
					{ star: 5, count: 0 },
					{ star: 4, count: 0 },
					{ star: 3, count: 0 },
					{ star: 2, count: 0 },
					{ star: 1, count: 0 }
				]
			},
			useMock: false
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.resetAndLoad()
	},
	methods: {
		async refreshData() {
			console.log('[teacher-review] 下拉刷新：重新加载评价列表')
			await this.resetAndLoad()
		},
		resetAndLoad() {
			this.page = 1
			this.finished = false
			this.list = []
			this.loadReviews()
		},
		async loadReviews() {
			if (this.loading || this.finished) return
			this.loading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const mockList = Array.from({ length: 5 }).map((_, idx) => ({
						review_id: `mock-${this.page}-${idx}`,
						parent_name: ['张女士', '李先生', '王家长'][idx % 3],
						parent_avatar: '',
						rating: 5 - (idx % 3),
						content: '孩子上课状态很好，老师讲解深入浅出。',
						tags: idx % 2 === 0 ? ['讲解清晰', '互动性强'] : ['耐心负责'],
						create_time: Date.now() - idx * 86400000,
						teacher_reply: idx % 2 === 0 ? '感谢认可，我们会继续努力~' : '',
						reply_time: idx % 2 === 0 ? Date.now() - idx * 43200000 : null
					}))

					if (this.page === 1) {
						this.list = mockList
					} else {
						this.list = [...this.list, ...mockList]
					}

					if (mockList.length < this.pageSize) {
						this.finished = true
					} else {
						this.page += 1
					}

					this.stats = {
						total: 12,
						replied: 7,
						unreplied: 5,
						averageRating: '4.8',
						ratingStats: [
							{ star: 5, count: 8 },
							{ star: 4, count: 3 },
							{ star: 3, count: 1 },
							{ star: 2, count: 0 },
							{ star: 1, count: 0 }
						]
					}
					return
				}

				const reviewObj = uniCloud.importObject('teacher-review', { customUI: true })
				const res = await reviewObj.getList({
					page: this.page,
					pageSize: this.pageSize,
					status: this.currentStatus,
					rating: this.currentRating === 'all' ? undefined : Number(this.currentRating)
				})

				if (res.code === 0 && res.data) {
					const fetched = res.data.list || []
					if (this.page === 1) {
						this.list = fetched
					} else {
						this.list = [...this.list, ...fetched]
					}

					const total = res.data.pagination?.total || 0
					if (this.list.length >= total || fetched.length < this.pageSize) {
						this.finished = true
					} else {
						this.page += 1
					}

					this.stats = res.data.stats || this.stats
				} else {
					uni.showToast({ title: res.message || '获取评价失败', icon: 'none' })
				}
			} catch (error) {
				console.error('获取评价失败:', error)
				uni.showToast({ title: '获取评价失败，请稍后再试', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		loadMore() {
			this.loadReviews()
		},
		changeStatus(value) {
			if (this.currentStatus === value) return
			this.currentStatus = value
			this.resetAndLoad()
		},
		changeRating(value) {
			if (this.currentRating === value) return
			this.currentRating = value
			this.resetAndLoad()
		},
		distributionWidth(count) {
			const max = Math.max(...this.stats.ratingStats.map(item => item.count), 1)
			const safeCount = Number(count || 0)
			return `${Math.round((safeCount / max) * 100)}%`
		},
		formatTime(timestamp) {
			if (!timestamp) return ''
			const date = new Date(timestamp)
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${month}-${day} ${hour}:${minute}`
		},
		replyReview(item) {
			uni.showModal({
				title: item.teacher_reply ? '修改回复' : '回复评价',
				editable: true,
				placeholderText: '请输入回复内容（最多200字）',
				confirmColor: '#2563EB',
				content: item.teacher_reply || '',
				success: async res => {
					if (!res.confirm || !res.content || !res.content.trim()) return
					const replyText = res.content.trim()
					if (this.useMock) {
						item.teacher_reply = replyText
						item.reply_time = Date.now()
						uni.showToast({ title: '回复成功', icon: 'success' })
						return
					}

					try {
						const reviewObj = uniCloud.importObject('teacher-review', { customUI: true })
						const result = await reviewObj.reply({
							review_id: item.review_id,
							reply_content: replyText
						})
						if (result.code === 0) {
							item.teacher_reply = replyText
							item.reply_time = result.data?.reply_time || Date.now()
							uni.showToast({ title: '回复成功', icon: 'success' })
							this.refreshStatsAfterReply()
						} else {
							uni.showToast({ title: result.message || '回复失败', icon: 'none' })
						}
					} catch (err) {
						console.error('回复评价失败:', err)
						uni.showToast({ title: '回复失败，请稍后重试', icon: 'none' })
					}
				}
			})
		},
		refreshStatsAfterReply() {
			if (this.currentStatus === 'unreplied') {
				this.resetAndLoad()
			} else {
				this.reloadStatsOnly()
			}
		},
		async reloadStatsOnly() {
			if (this.useMock) return
			try {
				const reviewObj = uniCloud.importObject('teacher-review', { customUI: true })
				const res = await reviewObj.getList({ page: 1, pageSize: 1 })
				if (res.code === 0 && res.data?.stats) {
					this.stats = res.data.stats
				}
			} catch (error) {
				console.error('更新统计信息失败:', error)
			}
		}
	}
}
</script>

<style scoped>
.page {
	background: #F4F6F9;
	min-height: 100vh;
}

.metrics-card {
	margin: 24rpx 32rpx 0;
	padding: 28rpx 12rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
	display: flex;
}

.metric {
	flex: 1;
	text-align: center;
}

.metric-num {
	display: block;
	font-size: 40rpx;
	font-weight: 600;
	color: #1F2329;
}

.metric-label {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #8B919C;
}

.tabs {
	display: flex;
	margin-top: 16rpx;
	background: #FFFFFF;
	border-bottom: 1rpx solid #EBEDF0;
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

.filters {
	white-space: nowrap;
	background: #F4F6F9;
}

.filters-inner {
	display: flex;
	gap: 12rpx;
	padding: 16rpx 32rpx 8rpx;
}

.filter {
	flex-shrink: 0;
	height: 56rpx;
	padding: 0 20rpx;
	border-radius: 999rpx;
	background: #FFFFFF;
	color: #5C6370;
	font-size: 24rpx;
	line-height: 56rpx;
	border: 1rpx solid #EBEDF0;
}

.filter.on {
	background: #EEF3FF;
	color: #2563EB;
	border-color: transparent;
	font-weight: 600;
}

.list-scroll {
	height: calc(100vh - 420rpx);
}

.a-card {
	margin: 16rpx 32rpx 24rpx;
	padding: 28rpx 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.a-name {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
}

.a-time {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.star {
	color: #EBEDF0;
}

.star.on {
	color: #F59E0B;
}

.a-content {
	display: block;
	margin-top: 16rpx;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.6;
}

.tags {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 16rpx;
}

.chip {
	height: 44rpx;
	padding: 0 16rpx;
	border-radius: 12rpx;
	background: #F1F2F4;
	color: #5C6370;
	font-size: 22rpx;
	line-height: 44rpx;
}

.reply-box {
	margin-top: 20rpx;
	padding: 20rpx;
	background: #F4F6F9;
	border-radius: 16rpx;
}

.reply-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.reply-label {
	font-size: 22rpx;
	font-weight: 600;
	color: #2563EB;
}

.reply-time {
	font-size: 22rpx;
	color: #8B919C;
}

.reply-text {
	display: block;
	margin-top: 8rpx;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.6;
}

.reply-edit {
	display: inline-block;
	margin-top: 12rpx;
	font-size: 24rpx;
	color: #2563EB;
}

.a-ops {
	display: flex;
	justify-content: flex-end;
	margin-top: 20rpx;
}

.mini {
	height: 60rpx;
	padding: 0 28rpx;
	border-radius: 16rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 60rpx;
}

.empty,
.footer-tip {
	padding: 40rpx 32rpx;
	text-align: center;
	font-size: 26rpx;
	color: #8B919C;
}
</style>