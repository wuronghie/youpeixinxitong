<!-- 家长端：我的招募列表。云对象 recruitment-center.myList / close -->
<template>
	<view class="page">
		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view class="page-body">
				<view class="hero-card">
					<view class="hero-head">
						<view>
							<text class="hero-title">我的招募</text>
							<text class="hero-desc">发布需求后，审核通过即可展示给老师。</text>
						</view>
					</view>
					<view class="seg">
						<text
							class="seg-item"
							:class="{ on: tab === 'open' }"
							@click="onTabOpen"
						>进行中</text>
						<text
							class="seg-item"
							:class="{ on: tab === 'ended' }"
							@click="onTabEnded"
						>已结束</text>
					</view>
				</view>

				<view v-if="!list.length && !loading" class="empty">
					<text class="empty-title">{{ tab === 'open' ? '还没有进行中的招募' : '还没有历史招募' }}</text>
					<text class="empty-sub">{{ tab === 'open' ? '先发布一条需求，让合适的老师尽快看到你。' : '结束或过期的招募会展示在这里。' }}</text>
					<button v-if="tab === 'open'" class="empty-btn" @click="goEdit()">立即发布</button>
				</view>

				<view
					v-for="item in list"
					:key="item._id"
					class="a-card"
					:class="{ muted: item.effective_status === 'expired' || tab === 'ended' }"
				>
					<view class="a-head">
						<view class="a-head-main">
							<text class="a-name">{{ item.subject }} / {{ item.student_grade }}</text>
							<text class="a-time">{{ metaLine(item) }}</text>
						</view>
						<text class="status" :class="statusClass(item)">{{ statusText(item) }}</text>
					</view>
					<text class="a-desc">{{ item.goal || item.remark || '暂未填写补充说明' }}</text>
					<view v-if="tab === 'open' && item.status === 'open'" class="a-ops">
						<text class="mini mini-ghost" @click="goEdit(item._id)">编辑</text>
						<text class="mini mini-danger" @click="closeItem(item)">关闭</text>
					</view>
				</view>

				<view v-if="loading" class="list-tip">加载中...</view>
			</view>
		</scroll-view>

		<button class="fab" @click="goEdit()">+</button>
		<view class="tabbar-spacer"></view>
		<ParentTabBar current="recruitment" />
	</view>
</template>

<script>
import ParentTabBar from '@/components/ParentTabBar.vue'
import { createAppPushMixin } from '@/utils/appPushMixin.js'
import { APP_PUSH_TYPES } from '@/utils/chatPush.js'

export default {
	mixins: [createAppPushMixin(APP_PUSH_TYPES.SYSTEM_MESSAGE)],
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
		async refreshData() {
			await this.load(true)
		},
		onAppPushPayload() {
			this.load(true)
		},
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
		statusClass(item) {
			if (item.effective_status === 'expired' || item.status === 'expired' || item.status === 'closed') return 's-muted'
			if (item.audit_status === 'rejected') return 's-pay'
			if (item.audit_status === 'pending') return 's-wait'
			return 's-ing'
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
		metaLine(item) {
			const parts = []
			parts.push(item.lesson_mode === 'online' ? '线上辅导' : '线下辅导')
			const region = item.region || {}
			const place = region.district || region.city || region.name || ''
			if (place && item.lesson_mode !== 'online') parts.push(place)
			const gender = this.studentGenderText(item.student_gender)
			if (gender) parts.push(gender)
			const min = Number(item.budget_min)
			if (Number.isFinite(min) && min > 0) parts.push(`${min}元/小时起`)
			const audit = this.auditHint(item)
			if (audit) parts.push(audit)
			if (item.time_note) parts.push(item.time_note)
			return parts.join(' · ')
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
.page {
	min-height: 100vh;
	background: #F4F6F9;
}

.list-scroll {
	height: 100vh;
}

.page-body {
	padding: 24rpx 32rpx 200rpx;
}

.hero-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	padding: 28rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
	margin-bottom: 24rpx;
}

.hero-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
}

.hero-title {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.4;
}

.hero-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: #8B919C;
}

.seg {
	margin-top: 20rpx;
	display: flex;
	padding: 6rpx;
	background: #F4F6F9;
	border-radius: 16rpx;
}

.seg-item {
	flex: 1;
	height: 64rpx;
	line-height: 64rpx;
	text-align: center;
	border-radius: 12rpx;
	font-size: 26rpx;
	color: #5C6370;
}

.seg-item.on {
	background: #FFFFFF;
	color: #2563EB;
	font-weight: 600;
}

.a-card {
	background: #FFFFFF;
	border-radius: 24rpx;
	padding: 28rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
	margin-bottom: 24rpx;
}

.a-card.muted {
	opacity: 0.72;
}

.a-head {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16rpx;
}

.a-head-main {
	flex: 1;
	min-width: 0;
}

.a-name {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.4;
}

.a-time {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #5C6370;
	line-height: 1.4;
}

.status {
	flex-shrink: 0;
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
	line-height: 1.4;
}

.s-pay {
	background: #FFF1F0;
	color: #FA5151;
}

.s-wait {
	background: #FFF6E8;
	color: #C47A12;
}

.s-ing {
	background: #EEF3FF;
	color: #2563EB;
}

.s-muted {
	background: #F4F6F9;
	color: #8B919C;
}

.a-desc {
	display: block;
	margin-top: 16rpx;
	font-size: 26rpx;
	line-height: 1.6;
	color: #5C6370;
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

.empty-btn::after,
.fab::after {
	border: none;
}

.fab {
	position: fixed;
	right: 36rpx;
	bottom: calc(env(safe-area-inset-bottom) + 176rpx);
	width: 104rpx;
	height: 104rpx;
	line-height: 104rpx;
	padding: 0;
	border-radius: 50%;
	font-size: 56rpx;
	background: #2563EB;
	color: #FFFFFF;
	box-shadow: 0 16rpx 40rpx rgba(37, 99, 235, 0.28);
	border: none;
	z-index: 1001;
}

.list-tip {
	padding: 24rpx 0 8rpx;
	text-align: center;
	font-size: 24rpx;
	color: #8B919C;
}

.tabbar-spacer {
	height: 120rpx;
	padding-bottom: constant(safe-area-inset-bottom);
	padding-bottom: env(safe-area-inset-bottom);
}
</style>
