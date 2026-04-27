<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex a-center j-sb text-white mb-3">
				<view>
					<text class="font-lg font-weight d-block mb-1">我的收藏</text>
					<text class="font-sm" style="opacity: 0.85;">常逛的老师都在这里，随时预约更方便</text>
				</view>
				<view class="stat-card rounded px-3 py-2">
					<text class="font-md font-weight text-white d-block">{{ collectionList.length || 0 }}</text>
					<text class="font-sm text-white" style="opacity: 0.9;">位教师</text>
				</view>
			</view>
			<view class="d-flex a-center">
				<view class="stat-card rounded px-3 py-2 mr-2 font-sm text-white" @click="goFindTeacher">
					发现更多老师
				</view>
				<view class="stat-card rounded px-3 py-2 font-sm text-white" @click="refreshList">
					{{ loading ? '刷新中...' : '刷新列表' }}
				</view>
			</view>
		</view>

		<!-- 收藏列表 -->
		<scroll-view
			scroll-y
			@scrolltolower="loadMore"
			class="list-scroll"
		>
			<view class="px-2 py-3">
				<view v-if="loading && !collectionList.length" class="d-flex flex-column">
					<view v-for="n in 3" :key="n" class="collection-card mb-3">
						<view class="card-content">
							<view class="card-header">
								<view class="teacher-avatar bg-light-secondary skeleton"></view>
								<view class="teacher-info">
									<view class="bg-light-secondary rounded mb-2 skeleton" style="width: 200rpx;height: 32rpx;"></view>
									<view class="bg-light-secondary rounded mb-2 skeleton" style="width: 150rpx;height: 26rpx;"></view>
									<view class="bg-light-secondary rounded skeleton" style="width: 180rpx;height: 24rpx;"></view>
								</view>
							</view>
						</view>
					</view>
				</view>

				<view v-else>
					<view
						v-for="teacher in collectionList"
						:key="teacher.teacher_id"
						class="collection-card mb-3"
						@click="goToDetail(teacher.teacher_id)"
					>
						<view class="card-content">
							<!-- 头部：头像和基本信息 -->
							<view class="card-header">
								<image 
									class="teacher-avatar" 
									:src="teacher.avatar || defaultAvatar"
									mode="aspectFill"
								/>
								<view class="teacher-info">
									<view class="name-row">
										<text class="teacher-name">{{ teacher.teacher_name }}</text>
										<text v-if="teacher.is_verified" class="verified-badge">认证</text>
									</view>
									<view class="rating-row">
										<text class="rating-text">⭐ {{ teacher.rating || '5.0' }}</text>
										<text class="price-text">¥{{ teacher.hourly_rate || 0 }}/时</text>
										<text v-if="teacher.order_count" class="order-count">已辅导{{ teacher.order_count }}次</text>
									</view>
								</view>
							</view>
							
							<!-- 科目标签 -->
							<view v-if="teacher.subjects && teacher.subjects.length > 0" class="subjects-tags">
								<text
									v-for="(subject, index) in teacher.subjects.slice(0, 4)"
									:key="subject"
									class="subject-tag"
								>
									{{ subject }}
								</text>
								<text v-if="teacher.subjects.length > 4" class="subject-tag more-tag">
									等{{ teacher.subjects.length }}科
								</text>
							</view>
							
							<!-- 底部操作栏 -->
							<view class="card-footer">
								<text class="favorite-time">收藏于 {{ formatDate(teacher.create_time) }}</text>
								<view class="action-buttons">
									<button 
										v-if="teacher.can_contact"
										class="action-btn contact-btn"
										@click.stop="goChat(teacher)"
									>
										联系老师
									</button>
									<button 
										class="action-btn cancel-btn"
										@click.stop="removeCollection(teacher.teacher_id)"
									>
										取消收藏
									</button>
								</view>
							</view>
						</view>
					</view>

					<view v-if="!loading && collectionList.length === 0" class="d-flex flex-column a-center j-center py-5">
						<text class="iconfont icon-shoucang" style="font-size: 120rpx;color: #ddd;"></text>
						<text class="text-light-muted font-md mt-3">还没有收藏的老师</text>
						<text class="text-light-muted font-sm mt-2">浏览教师列表，挑选合适的老师收藏，方便下次快速预约</text>
						<button class="main-bg-color text-white rounded px-4 py-2 mt-3 font-sm" @click="goFindTeacher">去找老师</button>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { mockTeachers, useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	name: 'ParentCollection',
	mixins: [pullRefreshMixin],
	data() {
		return {
			useMock: false,
			loading: false,
			refresherTriggered: false,
			collectionList: [],
			scrollTop: 0,
			canRefresh: true,
			defaultAvatar
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
	},
	onShow() {
		this.refreshList()
	},
	methods: {
		async refreshData() {
			console.log('[user-collection] 下拉刷新：重新加载收藏列表')
			await this.refreshList()
		},
		async refreshList() {
			this.loading = true
			await this.loadCollection()
			this.loading = false
		},
		handleScroll(e) {
			this.scrollTop = e.detail.scrollTop
			this.canRefresh = e.detail.scrollTop <= 10
		},
		handleScrollToUpper() {
			this.scrollTop = 0
			this.canRefresh = true
		},
		async onRefresh() {
			if (!this.canRefresh || this.scrollTop > 10) {
				this.refresherTriggered = false
				return
			}
			if (this.refresherTriggered) return
			this.refresherTriggered = true
			try {
				await this.loadCollection()
			} catch (error) {
				console.error('刷新失败:', error)
				uni.showToast({ title: '刷新失败，请稍后再试', icon: 'none' })
			} finally {
				this.refresherTriggered = false
			}
		},
		loadMore() {
			// 收藏列表通常不需要分页加载
		},
		async loadCollection() {
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					this.collectionList = mockTeachers.slice(0, 3).map((item, index) => ({
						teacher_id: item.teacher_id || item._id,
						teacher_name: item.display_name || item.name,
						avatar: item.avatar,
						title: item.title,
						subjects: item.subjects || [],
						hourly_rate: item.hourly_rate || 0,
						rating: item.rating || 5,
						order_count: item.order_count || 0,
						is_verified: item.is_verified || false,
						create_time: Date.now(),
						can_contact: index === 0,
						conversation_id: index === 0 ? 'mock-conversation-id' : ''
					}))
					return
				}

				const stored = uni.getStorageSync('userInfo') || {}
				if (!stored.uid) {
					uni.showToast({ title: '请先登录', icon: 'none' })
					this.collectionList = []
					return
				}

				const favoriteObj = uniCloud.importObject('teacher-favorite', { customUI: true })
				const res = await favoriteObj.getParentFavorites()
				if (res.code === 0 && res.data) {
					this.collectionList = res.data.list || []
				} else {
					this.collectionList = []
					if (res.message) {
						uni.showToast({ title: res.message, icon: 'none' })
					}
				}
			} catch (error) {
				console.error('加载收藏列表失败:', error)
				uni.showToast({ title: '加载失败，请稍后再试', icon: 'none' })
			}
		},
		removeCollection(teacherId) {
			if (!teacherId) return
			uni.showModal({
				title: '取消收藏',
				content: '确定要取消收藏该教师吗？',
				confirmText: '取消收藏',
				confirmColor: '#ff4d4f',
				success: async (res) => {
					if (!res.confirm) return
					try {
						if (this.useMock) {
							this.collectionList = this.collectionList.filter(item => item.teacher_id !== teacherId)
							uni.showToast({ title: '已取消收藏', icon: 'success' })
							return
						}
						const favoriteObj = uniCloud.importObject('teacher-favorite', { customUI: true })
						const result = await favoriteObj.removeFavorite({ teacher_id: teacherId })
						if (result.code === 0) {
							this.collectionList = this.collectionList.filter(item => item.teacher_id !== teacherId)
							uni.showToast({ title: '已取消收藏', icon: 'success' })
						} else {
							uni.showToast({ title: result.message || '操作失败', icon: 'none' })
						}
					} catch (error) {
						console.error('取消收藏失败:', error)
						uni.showToast({ title: '取消失败，请稍后再试', icon: 'none' })
					}
				}
			})
		},
		goToDetail(id) {
			if (!id) return
			if (this._navigatingDetail) return
			this._navigatingDetail = true
			uni.navigateTo({
				url: `/pages/teacher/detail?id=${id}`,
				success: () => { this._navigatingDetail = false },
				fail: (err) => {
					this._navigatingDetail = false
					console.warn('[collection] navigateTo detail failed:', err && err.errMsg)
					if (err && /timeout/i.test(err.errMsg || '')) {
						uni.showToast({ title: '加载超时，请重试', icon: 'none' })
					}
				}
			})
		},
		goFindTeacher() {
			uni.navigateTo({
				url: '/pages/teacher/list'
			})
		},
		goChat(teacher) {
			if (!teacher || !teacher.teacher_id) return
			const conversationId = teacher.conversation_id
			if (!conversationId) {
				uni.showToast({ title: '请从订单详情进入聊天', icon: 'none' })
				return
			}
			uni.navigateTo({
				url: `/pages/chat/conversation?conversationId=${conversationId}`
			})
		},
		formatDate(timestamp) {
			if (!timestamp) return '刚刚'
			const date = new Date(Number(timestamp))
			if (Number.isNaN(date.getTime())) return '刚刚'
			const year = date.getFullYear()
			const month = String(date.getMonth() + 1).padStart(2, '0')
			const day = String(date.getDate()).padStart(2, '0')
			const hour = String(date.getHours()).padStart(2, '0')
			const minute = String(date.getMinutes()).padStart(2, '0')
			return `${year}-${month}-${day} ${hour}:${minute}`
		}
	}
}
</script>

<style scoped>
.list-scroll {
	flex: 1;
	height: calc(100vh - 400rpx);
}

/* 统计卡片样式 */
.stat-card {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
}

/* 收藏卡片样式 */
.collection-card {
	background: #ffffff;
	border-radius: 24rpx;
	overflow: hidden;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.04);
	transition: transform 0.18s ease-out, box-shadow 0.18s ease-out;
}

.collection-card:active {
	transform: translateY(-2rpx);
	box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.08);
}

.card-content {
	padding: 24rpx;
}

/* 卡片头部 */
.card-header {
	display: flex;
	align-items: flex-start;
	margin-bottom: 20rpx;
}

.teacher-avatar {
	width: 120rpx;
	height: 120rpx;
	border-radius: 24rpx;
	border: 2rpx solid #f0f0f0;
	flex-shrink: 0;
	margin-right: 24rpx;
}

.teacher-info {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.name-row {
	display: flex;
	align-items: center;
	margin-bottom: 8rpx;
	flex-wrap: wrap;
}

.teacher-name {
	font-size: 32rpx;
	font-weight: 600;
	color: #2f3542;
	margin-right: 12rpx;
}

.verified-badge {
	font-size: 20rpx;
	color: #667eea;
	background: #f0f2ff;
	padding: 4rpx 12rpx;
	border-radius: 999rpx;
	flex-shrink: 0;
}

.teacher-title {
	font-size: 26rpx;
	color: #8a94a6;
	margin-bottom: 12rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.rating-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 16rpx;
}

.rating-text {
	font-size: 24rpx;
	color: #ffa500;
}

.price-text {
	font-size: 24rpx;
	color: #2ea170;
	font-weight: 600;
}

.order-count {
	font-size: 22rpx;
	color: #8a94a6;
}

/* 科目标签 */
.subjects-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-bottom: 20rpx;
	overflow: hidden;
}

.subject-tag {
	font-size: 22rpx;
	color: #667eea;
	background: #f4f6ff;
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	flex-shrink: 0;
}

.subject-tag.more-tag {
	color: #8a94a6;
	background: #f5f5f5;
}

/* 卡片底部 */
.card-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 16rpx;
	padding-top: 20rpx;
	border-top: 1rpx solid #f0f0f0;
}

.favorite-time {
	font-size: 22rpx;
	color: #8a94a6;
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.action-buttons {
	display: flex;
	align-items: center;
	gap: 12rpx;
	flex-shrink: 0;
}

.action-btn {
	padding: 12rpx 24rpx;
	border-radius: 999rpx;
	font-size: 24rpx;
	border: none;
	line-height: 1;
	white-space: nowrap;
	transition: all 0.2s ease;
}

.contact-btn {
	background: linear-gradient(135deg, #667eea 0%, #8a7efc 100%);
	color: #ffffff;
}

.contact-btn:active {
	opacity: 0.8;
	transform: scale(0.98);
}

.cancel-btn {
	background: #ffffff;
	color: #ff4757;
	border: 1rpx solid #ff4757 !important;
}

.cancel-btn:active {
	background: #fff5f5;
	transform: scale(0.98);
}

/* 骨架屏动画 */
.skeleton {
	animation: pulse 1.4s ease-in-out infinite;
	background: linear-gradient(90deg, #eceff9 0%, #f4f6ff 50%, #eceff9 100%);
	border-radius: 8rpx;
}

@keyframes pulse {
	0% {
		opacity: 0.6;
	}
	50% {
		opacity: 1;
	}
	100% {
		opacity: 0.6;
	}
}
</style>