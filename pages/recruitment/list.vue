<template>
	<view class="recruit-page">
		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view class="page-body">
				<view class="hero-card">
					<view class="hero-top">
						<view>
							<text class="hero-title">我的招募</text>
							<text class="hero-desc">发布需求后，审核通过即可展示给老师并接收试课邀请。</text>
						</view>
						<view class="hero-badge">{{ tab === 'open' ? '进行中' : '历史记录' }}</view>
					</view>
					<view class="hero-actions">
						<view class="segmented">
							<view class="segmented-track">
								<text
									class="segment-item"
									:class="{ active: tab === 'open' }"
									@click="onTabOpen"
								>进行中</text>
								<text
									class="segment-item"
									:class="{ active: tab === 'ended' }"
									@click="onTabEnded"
								>已结束</text>
							</view>
						</view>
						<button class="publish-btn" @click="goEdit()">发布新招募</button>
					</view>
				</view>

				<view v-if="!list.length && !loading" class="empty-card">
					<text class="empty-title">{{ tab === 'open' ? '还没有进行中的招募' : '还没有历史招募' }}</text>
					<text class="empty-desc">{{ tab === 'open' ? '先发布一条需求，让合适的老师尽快看到你。' : '结束或过期的招募会展示在这里。' }}</text>
					<button v-if="tab === 'open'" class="empty-btn" @click="goEdit()">立即发布</button>
				</view>

				<view
					v-for="item in list"
					:key="item._id"
					class="recruit-card"
					:class="{ 'card-muted': item.effective_status === 'expired' || tab === 'ended' }"
				>
					<view class="card-head">
						<view class="card-title-wrap">
							<text class="card-title">{{ item.subject }} / {{ item.student_grade }}</text>
							<view class="meta-row">
								<text v-if="studentGenderText(item.student_gender)" class="meta-chip gender-chip">{{ studentGenderText(item.student_gender) }}</text>
								<text class="meta-chip">{{ item.lesson_mode === 'online' ? '线上辅导' : '线下辅导' }}</text>
								<text v-if="auditHint(item)" class="meta-chip audit-chip">{{ auditHint(item).replace('· ', '') }}</text>
							</view>
						</view>
						<text class="status-text">{{ statusText(item) }}</text>
					</view>

					<text class="card-summary line-clamp-2">{{ item.goal || item.remark || '暂未填写补充说明' }}</text>

					<view class="card-footer">
						<text class="subtle-text">{{ item.time_note || '时间可沟通' }}</text>
						<view v-if="tab === 'open' && item.status === 'open'" class="action-row">
							<text class="action-link" @click="goEdit(item._id)">编辑</text>
							<text class="action-link danger" @click="closeItem(item)">关闭</text>
						</view>
					</view>
				</view>

				<view v-if="loading" class="loading-text">加载中...</view>
			</view>
		</scroll-view>

		<view class="fab-wrap">
			<button class="fab" @click="goEdit()">+</button>
		</view>
		<view class="tabbar-spacer"></view>
		<ParentTabBar current="recruitment" />
	</view>
</template>

<script>
import ParentTabBar from '@/components/ParentTabBar.vue'

export default {
	components: {
		ParentTabBar
	},
	data() {
		return {
			tab: 'open',
			list: [],
			page: 1,
			pageSize: 20,
			total: 0,
			loading: false,
			_loadSeq: 0
		}
	},
	onShow() {
		this.load(true)
	},
	methods: {
		onTabOpen() {
			this.tab = 'open'
			this.load(true)
		},
		onTabEnded() {
			this.tab = 'ended'
			this.load(true)
		},
		statusText(item) {
			if (item.effective_status === 'expired' || item.status === 'expired') return '已过期'
			if (item.status === 'closed') return '已关闭'
			const left = item.expire_at ? Math.ceil((item.expire_at - Date.now()) / 86400000) : 0
			return left > 0 ? `剩余约${left}天` : '即将过期'
		},
		auditHint(item) {
			if (item.status !== 'open') return ''
			const a = item.audit_status
			if (a === 'pending') return '审核中'
			if (a === 'rejected') return '未通过审核'
			return ''
		},
		studentGenderText(gender) {
			if (gender === 'male' || gender === 1 || gender === '1') return '男孩'
			if (gender === 'female' || gender === 2 || gender === '2') return '女孩'
			return ''
		},
		async load(reset) {
			const seq = ++this._loadSeq
			if (reset) {
				this.page = 1
				this.list = []
			}
			this.loading = true
			try {
				const rc = uniCloud.importObject('recruitment-center', { customUI: true })
				const res = await rc.myList({ tab: this.tab === 'open' ? 'open' : 'ended', page: this.page, pageSize: this.pageSize })
				if (seq !== this._loadSeq) return
				if (res.code !== 0) throw new Error(res.message)
				const { list = [], pagination = {} } = res.data || {}
				this.total = pagination.total || 0
				if (reset) {
					this.list = list
				} else {
					const seen = new Set(this.list.map((r) => r._id))
					const merged = [...this.list]
					for (const row of list) {
						if (row._id && !seen.has(row._id)) {
							seen.add(row._id)
							merged.push(row)
						}
					}
					this.list = merged
				}
			} catch (e) {
				if (seq === this._loadSeq) {
					uni.showToast({ title: e.message || '加载失败', icon: 'none' })
				}
			} finally {
				if (seq === this._loadSeq) this.loading = false
			}
		},
		loadMore() {
			if (this.list.length >= this.total || this.loading) return
			this.page += 1
			this.load(false)
		},
		goEdit(id) {
			const q = id ? `?id=${id}` : ''
			uni.navigateTo({ url: `/pages/recruitment/edit${q}` })
		},
		closeItem(item) {
			uni.showModal({
				title: '关闭招募',
				content: '确定结束该条招募吗？',
				success: async (r) => {
					if (!r.confirm) return
					const rc = uniCloud.importObject('recruitment-center', { customUI: true })
					const res = await rc.close({ recruitment_id: item._id, close_reason: 'filled' })
					if (res.code === 0) {
						uni.showToast({ title: '已关闭' })
						this.load(true)
					} else {
						uni.showToast({ title: res.message || '失败', icon: 'none' })
					}
				}
			})
		}
	}
}
</script>

<style scoped>
.recruit-page {
	min-height: 100vh;
	background: #f5f7fb;
}
.list-scroll {
	height: 100vh;
}
.page-body {
	padding: 24rpx;
	padding-bottom: 200rpx;
}
.hero-card {
	background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
	border-radius: 28rpx;
	padding: 28rpx;
	box-shadow: 0 12rpx 32rpx rgba(30, 78, 163, 0.08);
	margin-bottom: 24rpx;
}
.hero-top {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}
.hero-title {
	display: block;
	font-size: 38rpx;
	font-weight: 700;
	color: #1f2a44;
}
.hero-desc {
	display: block;
	margin-top: 12rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #7c879d;
}
.hero-badge {
	padding: 10rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(47, 109, 246, 0.12);
	color: #2f6df6;
	font-size: 22rpx;
	line-height: 1.4;
	font-weight: 600;
}
.hero-actions {
	margin-top: 24rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}
.segmented {
	flex: 1;
}
.segmented-track {
	display: flex;
	padding: 8rpx;
	background: #eef3fb;
	border-radius: 999rpx;
}
.segment-item {
	flex: 1;
	text-align: center;
	padding: 16rpx 0;
	border-radius: 999rpx;
	font-size: 26rpx;
	line-height: 1.4;
	color: #72809a;
}
.segment-item.active {
	background: #ffffff;
	color: #1f2a44;
	font-weight: 600;
	box-shadow: 0 6rpx 18rpx rgba(34, 72, 140, 0.08);
}
.publish-btn {
	margin: 0;
	padding: 0 28rpx;
	height: 76rpx;
	line-height: 76rpx;
	border-radius: 999rpx;
	background: #2f6df6;
	color: #ffffff;
	font-size: 26rpx;
	font-weight: 600;
	border: none;
}
.publish-btn::after,
.empty-btn::after,
.fab::after {
	border: none;
}
.empty-card,
.recruit-card {
	background: #ffffff;
	border-radius: 28rpx;
	padding: 28rpx;
	box-shadow: 0 10rpx 30rpx rgba(31, 42, 68, 0.06);
	margin-bottom: 20rpx;
}
.empty-card {
	text-align: center;
	padding: 72rpx 40rpx;
}
.empty-title {
	display: block;
	font-size: 34rpx;
	font-weight: 600;
	color: #1f2a44;
}
.empty-desc {
	display: block;
	margin-top: 14rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #8894aa;
}
.empty-btn {
	margin-top: 28rpx;
	height: 84rpx;
	line-height: 84rpx;
	border-radius: 999rpx;
	background: #2f6df6;
	color: #fff;
	font-size: 28rpx;
}
.card-muted {
	opacity: 0.68;
}
.card-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}
.card-title-wrap {
	flex: 1;
	min-width: 0;
}
.card-title {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: #1f2a44;
	line-height: 1.45;
}
.meta-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 16rpx;
}
.meta-chip {
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	line-height: 1.4;
	color: #60708c;
	background: #f3f6fb;
}
.gender-chip {
	color: #8a4fff;
	background: rgba(138, 79, 255, 0.08);
}
.audit-chip {
	color: #2f6df6;
	background: rgba(47, 109, 246, 0.08);
}
.status-text {
	font-size: 24rpx;
	line-height: 1.5;
	color: #7c879d;
	white-space: nowrap;
}
.card-summary {
	display: block;
	margin-top: 20rpx;
	font-size: 26rpx;
	line-height: 1.75;
	color: #4a566d;
}
.card-footer {
	margin-top: 22rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}
.subtle-text {
	flex: 1;
	min-width: 0;
	font-size: 22rpx;
	line-height: 1.5;
	color: #99a3b6;
}
.action-row {
	display: flex;
	align-items: center;
	gap: 24rpx;
}
.action-link {
	font-size: 24rpx;
	font-weight: 600;
	line-height: 1.5;
	color: #2f6df6;
}
.action-link.danger {
	color: #f05b55;
}
.line-clamp-2 {
	display: -webkit-box;
	line-clamp: 2;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
.fab-wrap {
	position: fixed;
	right: 40rpx;
	bottom: calc(env(safe-area-inset-bottom) + 190rpx);
	z-index: 1001;
}
.fab {
	width: 100rpx;
	height: 100rpx;
	line-height: 100rpx;
	padding: 0;
	border-radius: 50%;
	font-size: 48rpx;
	background: linear-gradient(135deg, #2f6df6 0%, #5f8dff 100%);
	color: #fff;
	box-shadow: 0 14rpx 32rpx rgba(47, 109, 246, 0.28);
	border: none;
	position: relative;
	z-index: 1001;
}
.loading-text {
	padding: 24rpx 0 8rpx;
	text-align: center;
	font-size: 24rpx;
	color: #8a95a8;
}
.tabbar-spacer {
	height: 120rpx;
	padding-bottom: constant(safe-area-inset-bottom);
	padding-bottom: env(safe-area-inset-bottom);
}
</style>
