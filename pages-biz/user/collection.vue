<!-- 家长端：我的收藏。云对象 teacher-favorite.getParentFavorites / removeFavorite -->
<template>
	<view class="page">
		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view class="page-body">
				<view class="hero-card">
					<text class="hero-title">已收藏 {{ collectionList.length || 0 }} 位老师</text>
					<text class="hero-btn" @click="goFindTeacher">发现更多老师</text>
				</view>

				<view v-if="loading && !collectionList.length">
					<view v-for="n in 3" :key="n" class="t-card skeleton">
						<view class="sk sk-avatar"></view>
						<view class="sk-lines">
							<view class="sk sk-title"></view>
							<view class="sk sk-line"></view>
						</view>
					</view>
				</view>

				<view v-else-if="!collectionList.length" class="empty">
					<text class="empty-title">还没有收藏的老师</text>
					<text class="empty-sub">浏览教师列表，挑选合适的老师收藏，方便下次快速预约</text>
					<button class="empty-btn" @click="goFindTeacher">去找老师</button>
				</view>

				<view v-else>
					<view
						v-for="teacher in collectionList"
						:key="teacher.teacher_id"
						class="t-card"
						@click="goToDetail(teacher.teacher_id)"
					>
						<view class="t-top">
							<image
								class="avatar"
								:src="teacher.avatar || defaultAvatar"
								mode="aspectFill"
							/>
							<view class="t-main">
								<view class="t-name-row">
									<text class="t-name">{{ teacher.teacher_name || '教师' }}</text>
									<text v-if="teacher.is_verified" class="chip-ok">认证</text>
								</view>
								<text class="t-meta">{{ metaLine(teacher) }}</text>
							</view>
						</view>
						<view class="a-ops">
							<text
								v-if="teacher.can_contact"
								class="mini mini-ghost"
								@click.stop="goChat(teacher)"
							>联系老师</text>
							<text
								class="mini mini-danger"
								@click.stop="removeCollection(teacher.teacher_id)"
							>取消收藏</text>
						</view>
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
				confirmColor: '#FA5151',
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
				url: `/pages-biz/teacher/detail?id=${id}`,
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
				url: `/pages-biz/chat/conversation?conversationId=${conversationId}`
			})
		},
		formatDate(timestamp) {
			if (!timestamp) return ''
			const date = new Date(Number(timestamp))
			if (Number.isNaN(date.getTime())) return ''
			return `${date.getMonth() + 1}月${date.getDate()}日`
		},
		metaLine(teacher) {
			const parts = []
			const subjects = (teacher.subjects || []).slice(0, 2).join('、')
			if (subjects) parts.push(subjects)
			if (teacher.hourly_rate != null) parts.push(`¥${teacher.hourly_rate}/小时`)
			const day = this.formatDate(teacher.create_time)
			if (day) parts.push(`收藏于 ${day}`)
			return parts.join(' · ')
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
}

.list-scroll {
	height: 100vh;
}

.page-body {
	padding: 24rpx 32rpx 48rpx;
}

.hero-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	margin-bottom: 24rpx;
	padding: 28rpx 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.hero-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.hero-btn {
	flex-shrink: 0;
	height: 56rpx;
	padding: 0 20rpx;
	border-radius: 12rpx;
	background: #EEF3FF;
	color: #2563EB;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 56rpx;
}

.t-card {
	margin-bottom: 24rpx;
	padding: 28rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.t-card.skeleton {
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.t-top {
	display: flex;
	align-items: flex-start;
	gap: 24rpx;
}

.avatar,
.sk-avatar {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	flex-shrink: 0;
	background: #EEF3FF;
}

.t-main {
	flex: 1;
	min-width: 0;
}

.t-name-row {
	display: flex;
	align-items: center;
	gap: 12rpx;
}

.t-name {
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.4;
}

.chip-ok {
	flex-shrink: 0;
	height: 36rpx;
	padding: 0 12rpx;
	border-radius: 8rpx;
	background: #E8F8EF;
	color: #07C160;
	font-size: 20rpx;
	font-weight: 600;
	line-height: 36rpx;
}

.t-meta {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.a-ops {
	display: flex;
	justify-content: flex-end;
	gap: 16rpx;
	margin-top: 24rpx;
}

.mini {
	height: 60rpx;
	padding: 0 24rpx;
	border-radius: 16rpx;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 60rpx;
	text-align: center;
}

.mini-ghost {
	background: #FFFFFF;
	color: #2563EB;
	border: 1rpx solid #D7E3FF;
}

.mini-danger {
	background: #FFFFFF;
	color: #FA5151;
	border: 1rpx solid #FFD0D0;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 80rpx 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.empty-title {
	font-size: 30rpx;
	color: #5C6370;
}

.empty-sub {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	text-align: center;
	line-height: 1.6;
}

.empty-btn {
	margin-top: 32rpx;
	height: 72rpx;
	padding: 0 40rpx;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 26rpx;
	line-height: 72rpx;
	border: none;
}

.empty-btn::after {
	border: none;
}

.sk {
	background: #EBEDF0;
	border-radius: 8rpx;
}

.sk-lines {
	flex: 1;
}

.sk-title {
	width: 200rpx;
	height: 32rpx;
	margin-bottom: 16rpx;
}

.sk-line {
	width: 360rpx;
	height: 24rpx;
}
</style>
