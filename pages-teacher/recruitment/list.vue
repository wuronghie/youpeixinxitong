<template>
	<view class="square-page">
		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view class="page-body">
				<view class="filter-card">
					<text class="panel-title">招募广场</text>
					<text class="panel-desc">优先浏览已通过审核的家长需求，筛选后可直接发起试课邀请。</text>

					<view class="search-box">
						<input class="search-input" v-model.trim="filters.subject" placeholder="筛选科目，如数学 / 英语" @confirm="reload" />
					</view>
					<view class="search-box city-box">
						<input class="search-input" v-model.trim="filters.city" placeholder="线下城市，如成都" @confirm="reload" />
					</view>

					<view class="toolbar-row">
						<picker mode="selector" :range="gradeOptions" range-key="label" @change="onGradePick">
							<view class="filter-pill">{{ gradeLabel }}</view>
						</picker>
						<view class="mode-tabs">
							<text
								class="mode-tab"
								:class="{ active: filters.lesson_mode === '' }"
								@click="filters.lesson_mode = ''; reload()"
							>全部</text>
							<text
								class="mode-tab"
								:class="{ active: filters.lesson_mode === 'online' }"
								@click="filters.lesson_mode = 'online'; reload()"
							>线上</text>
							<text
								class="mode-tab"
								:class="{ active: filters.lesson_mode === 'offline' }"
								@click="filters.lesson_mode = 'offline'; reload()"
							>线下</text>
						</view>
					</view>
				</view>

				<view v-if="!list.length && !loading" class="empty-card">
					<text class="empty-title">当前没有匹配的招募</text>
					<text class="empty-desc">试试更换科目、年级或授课方式筛选条件。</text>
				</view>

				<view
					v-for="item in list"
					:key="item._id"
					class="square-card"
					@click="goDetail(item._id)"
				>
					<view class="square-head">
						<view class="user-info">
							<text class="display-name">{{ item.display_name }}</text>
							<text class="publish-time">{{ formatTime(item.create_time) }}</text>
						</view>
						<text class="response-badge">{{ item.response_count || 0 }} 位老师响应</text>
					</view>

					<view class="chip-row">
						<text class="chip subject-chip">{{ item.subject }}</text>
						<text class="chip">{{ item.student_grade }}</text>
						<text class="chip">{{ item.lesson_mode === 'online' ? '线上' : '线下' }}</text>
						<text v-if="item.lesson_mode === 'offline' && addressText(item)" class="chip address-chip">{{ addressText(item) }}</text>
					</view>

					<text class="summary-text line-clamp-2">{{ item.goal || item.remark || '家长暂未填写更多说明' }}</text>

					<view class="card-bottom">
						<text class="budget-text">{{ budgetText(item) }}</text>
						<text class="detail-link">查看详情</text>
					</view>
				</view>

				<view v-if="loading" class="loading-text">加载中...</view>
			</view>
		</scroll-view>
		<view class="tabbar-spacer"></view>
		<TeacherTabBar current="recruitment" />
	</view>
</template>

<script>
import TeacherTabBar from '@/components/TeacherTabBar.vue'

export default {
	components: {
		TeacherTabBar
	},
	data() {
		return {
			filters: { subject: '', city: '', lesson_mode: '', student_grade: '' },
			gradeOptions: [{ label: '不限', value: '' }, { label: '小学', value: '四年级' }, { label: '初中', value: '初二' }, { label: '高中', value: '高二' }],
			gradeIndex: 0,
			list: [],
			page: 1,
			pageSize: 20,
			total: 0,
			loading: false
		}
	},
	computed: {
		gradeLabel() {
			return this.gradeOptions[this.gradeIndex]?.label || '不限'
		}
	},
	onShow() {
		this.reload()
	},
	methods: {
		onGradePick(e) {
			this.gradeIndex = Number(e.detail.value)
			this.filters.student_grade = this.gradeOptions[this.gradeIndex].value
			this.reload()
		},
		formatTime(t) {
			if (!t) return ''
			const d = new Date(t)
			return `${d.getMonth() + 1}/${d.getDate()}`
		},
		budgetText(item) {
			if (item.budget_min != null || item.budget_max != null) {
				return `预算 ${item.budget_min || '?'} - ${item.budget_max || '?'} 元/小时`
			}
			return '预算可协商'
		},
		addressText(item) {
			if (!item || !item.region) return ''
			const region = item.region
			const admin = `${region.province || ''}${region.city || ''}${region.district || ''}`.trim()
			const rawName = String(region.name || '').trim()
			if (!rawName) return admin
			const sep = ' · '
			if (rawName.includes(sep)) {
				const idx = rawName.indexOf(sep)
				const addrPart = rawName.slice(idx + sep.length).trim()
				if (addrPart) {
					if (admin && addrPart.startsWith(admin)) return addrPart
					return `${admin}${addrPart}`.trim() || addrPart
				}
			}
			if (admin && rawName.startsWith(admin)) return rawName
			return admin ? `${admin}${rawName}`.trim() : rawName
		},
		reload() {
			this.page = 1
			this.list = []
			this.load(true)
		},
		async load(reset) {
			if (this.loading) return
			this.loading = true
			try {
				const rc = uniCloud.importObject('recruitment-center', { customUI: true })
				const res = await rc.listForTeacher({
					page: this.page,
					pageSize: this.pageSize,
					subject: this.filters.subject,
					city: this.filters.city,
					lesson_mode: this.filters.lesson_mode || undefined,
					student_grade: this.filters.student_grade || undefined
				})
				if (res.code !== 0) throw new Error(res.message)
				const { list = [], pagination = {} } = res.data || {}
				this.total = pagination.total || 0
				this.list = reset ? list : [...this.list, ...list]
			} catch (e) {
				uni.showToast({ title: e.message || '加载失败', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		loadMore() {
			if (this.list.length >= this.total || this.loading) return
			this.page += 1
			this.load(false)
		},
		goDetail(id) {
			uni.navigateTo({ url: `/pages-teacher/recruitment/detail?id=${id}` })
		}
	}
}
</script>

<style scoped>
.square-page {
	min-height: 100vh;
	background: #f5f7fb;
}
.list-scroll {
	height: 100vh;
}
.page-body {
	padding: 24rpx;
	padding-bottom: 160rpx;
}
.filter-card,
.square-card,
.empty-card {
	background: #fff;
	border-radius: 28rpx;
	box-shadow: 0 10rpx 30rpx rgba(31, 42, 68, 0.06);
}
.filter-card {
	padding: 28rpx;
	margin-bottom: 24rpx;
}
.panel-title {
	display: block;
	font-size: 38rpx;
	font-weight: 700;
	color: #1f2a44;
}
.panel-desc {
	display: block;
	margin-top: 12rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #7c879d;
}
.search-box {
	margin-top: 22rpx;
	padding: 0 24rpx;
	height: 84rpx;
	border-radius: 22rpx;
	background: #f3f6fb;
	display: flex;
	align-items: center;
}
.city-box {
	margin-top: 16rpx;
}
.search-input {
	width: 100%;
	height: 84rpx;
	line-height: 84rpx;
	font-size: 26rpx;
	color: #1f2a44;
}
.toolbar-row {
	margin-top: 20rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18rpx;
}
.filter-pill {
	padding: 16rpx 24rpx;
	border-radius: 999rpx;
	background: #eef3fb;
	font-size: 24rpx;
	line-height: 1.4;
	color: #4b5870;
}
.mode-tabs {
	flex: 1;
	display: flex;
	justify-content: flex-end;
	gap: 12rpx;
}
.mode-tab {
	padding: 16rpx 24rpx;
	border-radius: 999rpx;
	font-size: 24rpx;
	line-height: 1.4;
	color: #72809a;
	background: #f3f6fb;
}
.mode-tab.active {
	color: #fff;
	background: #2f6df6;
}
.empty-card {
	padding: 72rpx 40rpx;
	text-align: center;
	margin-bottom: 20rpx;
}
.empty-title {
	display: block;
	font-size: 34rpx;
	font-weight: 600;
	color: #1f2a44;
}
.empty-desc {
	display: block;
	margin-top: 12rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #8b95a8;
}
.square-card {
	padding: 28rpx;
	margin-bottom: 20rpx;
}
.square-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}
.user-info {
	flex: 1;
	min-width: 0;
}
.display-name {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1.4;
	color: #1f2a44;
}
.publish-time {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	line-height: 1.4;
	color: #97a2b5;
}
.response-badge {
	padding: 10rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(47, 109, 246, 0.08);
	color: #2f6df6;
	font-size: 22rpx;
	line-height: 1.4;
	white-space: nowrap;
}
.chip-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 20rpx;
}
.chip {
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	line-height: 1.4;
	color: #60708c;
	background: #f3f6fb;
}
.address-chip {
	max-width: 100%;
	white-space: normal;
	word-break: break-all;
}
.subject-chip {
	color: #2f6df6;
	background: rgba(47, 109, 246, 0.08);
}
.summary-text {
	display: block;
	margin-top: 20rpx;
	font-size: 26rpx;
	line-height: 1.75;
	color: #4a566d;
}
.card-bottom {
	margin-top: 22rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}
.budget-text {
	font-size: 22rpx;
	line-height: 1.5;
	color: #99a3b6;
}
.detail-link {
	font-size: 24rpx;
	font-weight: 600;
	line-height: 1.5;
	color: #2f6df6;
}
.line-clamp-2 {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
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
