<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3 text-white">
			<view class="d-flex a-center mb-3">
				<view class="stat-card rounded px-3 py-2 mr-3 d-flex flex-column a-center">
					<text class="font-xl font-weight text-white d-block">{{ stats.averageRating || '0.0' }}</text>
					<view class="d-flex a-center mt-1">
						<text
							v-for="i in 5"
							:key="i"
							class="font-xs text-white"
							:style="i <= Math.round(stats.averageRating || 0) ? 'color: #ffd060;' : 'opacity: 0.4;'"
						>★</text>
					</view>
				</view>
				<view class="flex-1 d-flex a-center j-around">
					<view class="text-center">
						<text class="font-md font-weight text-white d-block mb-1">总评价</text>
						<text class="font-sm text-white" style="opacity: 0.9;">{{ stats.total || 0 }}</text>
					</view>
					<view class="text-center">
						<text class="font-md font-weight text-white d-block mb-1">已回复</text>
						<text class="font-sm text-white" style="opacity: 0.9;">{{ stats.replied || 0 }}</text>
					</view>
					<view class="text-center">
						<text class="font-md font-weight text-white d-block mb-1">待回复</text>
						<text class="font-sm text-white" style="opacity: 0.9;">{{ stats.unreplied || 0 }}</text>
					</view>
				</view>
			</view>
			<view class="stat-card rounded px-3 py-2">
				<view v-for="item in stats.ratingStats" :key="item.star" class="d-flex a-center mb-2">
					<text class="font-xs text-white mr-2" style="width: 70rpx; opacity: 0.9;">{{ item.star }} 星</text>
					<view class="flex-1 bg-white rounded" style="height: 14rpx; overflow: hidden; opacity: 0.3;">
						<view
							class="bg-warning"
							:style="{ width: distributionWidth(item.count), height: '100%' }"
						></view>
					</view>
					<text class="font-xs text-white ml-2" style="width: 50rpx; text-align: right; opacity: 0.9;">{{ item.count || 0 }}</text>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="scroll" @scrolltolower="loadMore">
			<view class="px-2 py-3">
				<!-- 筛选栏 -->
				<view class="d-flex a-center mb-3">
					<view
						v-for="tab in statusTabs"
						:key="tab.value"
						class="rounded px-3 py-2 mr-2 font-sm"
						:class="currentStatus === tab.value ? 'tab-active-status' : 'tab-inactive-status'"
						@click="changeStatus(tab.value)"
					>
						{{ tab.label }}<text v-if="tab.count" class="ml-1">{{ tab.count ? tab.count(stats) : '' }}</text>
					</view>
				</view>
				<scroll-view scroll-x class="mb-3">
					<view class="d-flex a-center">
						<view
							v-for="rate in ratingTabs"
							:key="rate.value"
							class="rounded px-3 py-2 mr-2 font-sm"
							:class="currentRating === rate.value ? 'tab-active-rating' : 'tab-inactive-rating'"
							@click="changeRating(rate.value)"
						>
							{{ rate.label }}
						</view>
					</view>
				</scroll-view>

				<!-- 评价列表 -->
				<view class="d-flex flex-column">
					<view v-for="item in list" :key="item.review_id" class="card mb-3">
						<view class="d-flex a-center mb-3">
							<image class="rounded-circle mr-3" :src="item.parent_avatar || defaultAvatarUrl" mode="aspectFill" style="width: 96rpx; height: 96rpx;"></image>
							<view class="flex-1">
								<text class="font-sm font-weight d-block mb-1">{{ item.parent_name }}</text>
								<view class="d-flex a-center">
									<text
										v-for="i in 5"
										:key="i"
										class="font-xs"
										:style="i <= item.rating ? 'color: #ffd060;' : 'color: #ddd;'"
									>★</text>
								</view>
							</view>
							<text class="font-xs text-light-muted">{{ formatTime(item.create_time) }}</text>
						</view>
						<text class="font-sm text-light-muted d-block mb-2" style="line-height: 1.6;">{{ item.content }}</text>
						<view v-if="item.tags && item.tags.length" class="d-flex flex-wrap mb-3">
							<text v-for="tag in item.tags" :key="tag" class="bg-light-secondary rounded px-2 py-1 mr-2 mb-2 font-xs main-text-color">{{ tag }}</text>
						</view>
						<view v-if="item.teacher_reply" class="bg-light-secondary rounded px-3 py-2 mb-2">
							<view class="d-flex a-center j-sb mb-2">
								<text class="font-xs main-text-color font-weight">我的回复</text>
								<text class="font-xs text-light-muted">{{ formatTime(item.reply_time) }}</text>
							</view>
							<text class="font-sm text-light-muted d-block mb-2" style="line-height: 1.6;">{{ item.teacher_reply }}</text>
							<text class="font-xs main-text-color" @click="replyReview(item)">修改回复</text>
						</view>
						<button v-else class="w-100 main-bg-color text-white rounded px-3 py-2 font-sm" @click="replyReview(item)">回复</button>
					</view>

					<view v-if="!loading && !list.length" class="d-flex flex-column a-center j-center py-5">
						<view class="icon-empty" style="color: #ddd;"></view>
						<text class="text-light-muted font-md mt-3">暂时还没有评价记录</text>
					</view>

					<view v-if="loading" class="text-center text-light-muted font py-3">加载中...</view>
					<view v-else-if="finished && list.length" class="text-center text-light-muted font py-3">没有更多了</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

import card from '@/components/common/card.vue'
import { useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'

export default {
	name: 'TeacherReviewList',
	components: {
		card
	},
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
				confirmColor: '#667eea',
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
.scroll {
	flex: 1;
	height: calc(100vh - 500rpx);
}

/* 统计卡片样式 */
.stat-card {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
}

/* 状态选项卡样式 */
.tab-active-status {
	background-color: #07C160;
	color: #FFFFFF;
	font-weight: 600;
}

.tab-inactive-status {
	background-color: #F1F1F1;
	color: #333333;
}

/* 评分筛选选项卡样式 */
.tab-active-rating {
	background-color: #FFFFFF;
	color: #07C160;
	border: 2rpx solid #07C160;
	font-weight: 600;
}

.tab-inactive-rating {
	background-color: #F1F1F1;
	color: #666666;
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