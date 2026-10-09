<template>
	<view class="page">
		<view class="search-wrap">
			<view class="wx-search">
				<input
					class="wx-search-input"
					v-model.trim="filters.subject"
					placeholder="科目，如数学 / 英语"
					confirm-type="search"
					@confirm="reload"
				/>
			</view>
			<view class="wx-search">
				<input
					class="wx-search-input"
					v-model.trim="filters.city"
					placeholder="线下城市，如成都"
					confirm-type="search"
					@confirm="reload"
				/>
			</view>
		</view>

		<scroll-view scroll-x class="filters" :show-scrollbar="false">
			<view class="filters-inner">
				<picker mode="selector" :range="gradeOptions" range-key="label" @change="onGradePick">
					<view class="filter" :class="{ on: !!filters.student_grade }">年级{{ gradeLabel }} ▾</view>
				</picker>
				<text
					class="filter"
					:class="{ on: filters.lesson_mode === '' }"
					@click="filters.lesson_mode = ''; reload()"
				>全部</text>
				<text
					class="filter"
					:class="{ on: filters.lesson_mode === 'online' }"
					@click="filters.lesson_mode = 'online'; reload()"
				>线上</text>
				<text
					class="filter"
					:class="{ on: filters.lesson_mode === 'offline' }"
					@click="filters.lesson_mode = 'offline'; reload()"
				>线下</text>
			</view>
		</scroll-view>

		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view class="list-body">
				<view v-if="!list.length && !loading" class="empty">
					<text class="empty-title">当前没有匹配的招募</text>
					<text class="empty-sub">试试更换科目、年级或授课方式</text>
				</view>

				<view
					v-for="item in list"
					:key="item._id"
					class="a-card"
					@click="goDetail(item._id)"
				>
					<view class="a-head">
						<view class="a-head-main">
							<text class="a-name">{{ item.subject }} / {{ item.student_grade }}</text>
							<text class="a-time">{{ metaLine(item) }}</text>
						</view>
						<text class="status">{{ item.response_count || 0 }} 人已响应</text>
					</view>
					<text class="a-desc">{{ item.goal || item.remark || '家长暂未填写更多说明' }}</text>
					<view class="a-ops">
						<text class="budget">{{ budgetText(item) }}</text>
						<text class="mini">查看详情</text>
					</view>
				</view>

				<view v-if="loading" class="list-tip">加载中...</view>
			</view>
		</scroll-view>

		<view class="tabbar-spacer"></view>
		<TeacherTabBar current="recruitment" />
	</view>
</template>

<script>
import TeacherTabBar from '@/pages-teacher/components/TeacherTabBar.vue'

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
		async refreshData() {
			await this.load(true)
		},
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
		studentGenderText(gender) {
			if (gender === 'male' || gender === 1 || gender === '1') return '男孩'
			if (gender === 'female' || gender === 2 || gender === '2') return '女孩'
			return ''
		},
		metaLine(item) {
			const parts = []
			if (item.lesson_mode === 'offline') {
				parts.push(this.addressText(item) || '线下')
			} else {
				parts.push('线上')
			}
			const gender = this.studentGenderText(item.student_gender)
			if (gender) parts.push(gender)
			if (item.time_note) parts.push(item.time_note)
			return parts.join(' · ')
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
.page {
	background: #F4F6F9;
	min-height: 100vh;
}

.search-wrap {
	padding: 16rpx 32rpx 8rpx;
	background: #F4F6F9;
}

.wx-search {
	height: 72rpx;
	padding: 0 24rpx;
	background: #FFFFFF;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
}

.wx-search + .wx-search {
	margin-top: 12rpx;
}

.wx-search-input {
	width: 100%;
	height: 72rpx;
	font-size: 28rpx;
	color: #1F2329;
}

.filters {
	background: #F4F6F9;
	white-space: nowrap;
}

.filters-inner {
	display: flex;
	padding: 8rpx 32rpx 16rpx;
	gap: 12rpx;
}

.filter {
	flex-shrink: 0;
	height: 56rpx;
	padding: 0 20rpx;
	border-radius: 12rpx;
	background: #FFFFFF;
	color: #5C6370;
	font-size: 24rpx;
	line-height: 56rpx;
}

.filter.on {
	background: #EEF3FF;
	color: #2563EB;
	font-weight: 600;
}

.list-scroll {
	height: calc(100vh - 360rpx);
}

.list-body {
	padding: 8rpx 0 24rpx;
}

.a-card {
	margin: 0 32rpx 24rpx;
	padding: 28rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
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
	background: #EEF3FF;
	color: #2563EB;
}

.a-desc {
	display: -webkit-box;
	margin-top: 16rpx;
	font-size: 26rpx;
	line-height: 1.5;
	color: #5C6370;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	line-clamp: 2;
}

.a-ops {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	margin-top: 24rpx;
}

.budget {
	font-size: 24rpx;
	color: #8B919C;
}

.mini {
	height: 60rpx;
	padding: 0 24rpx;
	border-radius: 16rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 60rpx;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 80rpx 32rpx;
}

.empty-title {
	font-size: 30rpx;
	color: #5C6370;
}

.empty-sub {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.list-tip {
	text-align: center;
	padding: 24rpx 0;
	font-size: 24rpx;
	color: #8B919C;
}

.tabbar-spacer {
	height: 140rpx;
}
</style>
