<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex flex-column text-white mb-3">
				<text class="font-lg font-weight mb-1">教师档案管理</text>
				<text class="font-sm" style="opacity: 0.85;">管理所有教师档案信息</text>
			</view>
			<view class="d-flex a-center">
				<view class="flex-1 search-input-box rounded px-3 py-2 mr-2">
					<input
						class="w-100 font-sm text-white"
						v-model="query"
						placeholder="请输入搜索内容"
						@confirm="search"
						placeholder-style="color: rgba(255,255,255,0.6);"
					/>
				</view>
				<button class="bg-white text-primary rounded px-3 py-2 font-sm mr-2" style="opacity: 0.9;" @click="search">搜索</button>
				<button class="bg-white text-primary rounded px-3 py-2 font-sm" style="opacity: 0.9;" @click="navigateTo('./add')">新增</button>
			</view>
		</view>

		<!-- 列表 -->
		<scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
			<view class="px-2 py-3">
				<view
					v-for="item in dataList"
					:key="item._id"
					class="card mb-3"
					@click="navigateTo('./edit?id=' + item._id)"
				>
					<view class="d-flex a-center mb-3">
						<image 
							v-if="item.avatar"
							class="rounded mr-3"
							:src="item.avatar"
							mode="aspectFill"
							style="width: 120rpx;height: 120rpx;"
						/>
						<view class="flex-1">
							<view class="d-flex a-center mb-1">
								<text class="font-md font-weight mr-2">{{ item.display_name || '-' }}</text>
								<text v-if="item.is_verified" class="bg-light-secondary text-primary rounded px-2 py-1 font-sm">已认证</text>
							</view>
							<text class="font-sm text-light-muted d-block mb-1">教师ID: {{ item.teacher_id || '-' }}</text>
							<view class="d-flex flex-wrap">
								<text
									v-for="subject in (item.subjects || []).slice(0, 3)"
									:key="subject"
									class="bg-light-secondary rounded px-2 py-1 font-sm mr-2 mb-2"
								>
									{{ subject }}
								</text>
							</view>
						</view>
						<view class="d-flex flex-column a-end">
							<text class="font-md font-weight main-text-color mb-1">¥{{ item.hourly_rate || 0 }}/时</text>
							<text class="font-sm text-light-muted">评分: {{ item.rating || 5.0 }}</text>
						</view>
					</view>
					<view class="d-flex a-center j-sb pt-3 border-top">
						<view class="d-flex a-center">
							<text class="font-sm text-light-muted mr-3">课程: {{ item.total_courses || 0 }}</text>
							<text class="font-sm text-light-muted">学生: {{ item.total_students || 0 }}</text>
						</view>
						<view class="d-flex a-center">
							<button 
								class="border border-primary text-primary rounded px-3 py-1 font-sm mr-2"
								@click.stop="navigateTo('./edit?id=' + item._id)"
							>
								修改
							</button>
							<button 
								class="border border-danger text-danger rounded px-3 py-1 font-sm"
								@click.stop="confirmDelete(item._id)"
							>
								删除
							</button>
						</view>
					</view>
				</view>

				<view v-if="!loading && !dataList.length" class="d-flex flex-column a-center j-center py-5">
					<text class="iconfont icon-wushuju" style="font-size: 120rpx;color: #ddd;"></text>
					<text class="text-light-muted font-md mt-3">暂无数据</text>
				</view>

				<view v-if="loading && dataList.length" class="text-center text-light-muted font py-3">加载中...</view>
				<view v-else-if="!hasMore && dataList.length" class="text-center text-light-muted font py-3">没有更多数据了</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { enumConverter, filterToWhere } from '../../js_sdk/validator/teacher-profiles.js'

const dbCollectionName = 'teacher-profiles'
const pageSize = 20
const pageCurrent = 1

export default {
	data() {
		return {
			collectionList: dbCollectionName,
			query: '',
			where: '',
			orderby: '',
			dataList: [],
			loading: false,
			page: pageCurrent,
			pageSize: pageSize,
			hasMore: true
		}
	},
	onLoad() {
		this.loadData()
	},
	methods: {
		getWhere() {
			const query = this.query.trim()
			if (!query) {
				return ''
			}
			const db = uniCloud.database()
			const dbCmd = db.command
			return dbCmd.or([
				{ display_name: new RegExp(query, 'i') },
				{ teacher_id: new RegExp(query, 'i') }
			])
		},
		search() {
			const newWhere = this.getWhere()
			this.where = newWhere
			this.page = 1
			this.hasMore = true
			this.dataList = []
			this.loadData()
		},
		loadMore() {
			if (this.loading || !this.hasMore) return
			this.page += 1
			this.loadData(false)
		},
		loadData(clear = true) {
			if (this.loading) return
			this.loading = true
			const db = uniCloud.database()
			let query = db.collection(this.collectionList)
			
			if (this.where) {
				query = query.where(this.where)
			}
			
			if (this.orderby) {
				query = query.orderBy(this.orderby)
			}
			
			query.skip((this.page - 1) * this.pageSize)
				.limit(this.pageSize)
				.get()
				.then((res) => {
					const data = res.result.data || []
					if (clear) {
						this.dataList = data
					} else {
						this.dataList = [...this.dataList, ...data]
					}
					this.hasMore = data.length === this.pageSize
				})
				.catch((err) => {
					console.error('加载数据失败:', err)
					uni.showToast({ title: '加载失败', icon: 'none' })
				})
				.finally(() => {
					this.loading = false
				})
		},
		navigateTo(url) {
			uni.navigateTo({
				url,
				events: {
					refreshData: () => {
						this.loadData(true)
					}
				}
			})
		},
		confirmDelete(id) {
			uni.showModal({
				title: '确认删除',
				content: '确定要删除这条记录吗？',
				success: (res) => {
					if (res.confirm) {
						this.deleteItem(id)
					}
				}
			})
		},
		deleteItem(id) {
			const db = uniCloud.database()
			db.collection(this.collectionList).doc(id).remove()
				.then(() => {
					uni.showToast({ title: '删除成功' })
					this.loadData(true)
				})
				.catch((err) => {
					uni.showModal({
						content: err.message || '删除失败',
						showCancel: false
					})
				})
		}
	}
}
</script>

<style scoped>
.list-scroll {
	flex: 1;
	height: calc(100vh - 300rpx);
}

/* 搜索输入框样式 */
.search-input-box {
	background-color: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10rpx);
}
</style>