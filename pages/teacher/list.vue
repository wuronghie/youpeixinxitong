<!--
 * 页面名称：找教师列表页（家长端）
 * 路由路径：pages/teacher/list
 * 页面功能：
 *   1. 搜索教师（按姓名、科目）
 *   2. 筛选教师（按科目、年级）
 *   3. 排序教师（综合、评分、价格、学生数）
 *   4. 显示教师列表（头像、姓名、科目、评分、价格等）
 *   5. 收藏/取消收藏教师
 *   6. 支持下拉刷新和上拉加载更多
 * 
 * 数据结构说明：
 *   - teacherList: 教师列表数据
 *   - searchKeyword: 搜索关键词
 *   - selectedSubject: 选中的科目筛选
 *   - selectedGrade: 选中的年级筛选
 *   - selectedSort: 选中的排序方式
 *   - page: 当前页码
 *   - hasMore: 是否还有更多数据
 * 
 * 修改说明：
 *   - 修改筛选选项：修改 subjectFilters、gradeFilters、sortOptions 数组
 *   - 修改搜索逻辑：修改 handleSearch() 方法
 *   - 修改列表样式：修改教师卡片的 template 和 style
 *   - 添加筛选条件：在筛选区域添加新的筛选项
 *   - 修改排序逻辑：修改 changeSort() 方法中的排序规则
-->
<template>
	<view class="teacher-list-page">
		<view class="teacher-list-top">
		<!-- 搜索头部：位置栏、搜索框和搜索按钮 -->
		<view class="main-bg-color py-3 px-3 search-header">
			<view class="d-flex a-center bg-white rounded" style="padding: 20rpx;">
				<!-- 位置栏 -->
				<LocationBar />
				<!-- 搜索框 -->
				<view class="flex-1 d-flex a-center ml-2">
					<view class="iconfont icon-sousuo mr-2" style="color: #999;"></view>
					<input
						class="flex-1 font"
						v-model.trim="searchKeyword"
						placeholder="输入教师姓名、科目"
						confirm-type="search"
						@confirm="handleSearch"
						placeholder-class="text-light-muted"
					/>
				</view>
				<view class="main-text-color font-md" @click="handleSearch">搜索</view>
			</view>
		</view>

		<!-- 顶部筛选栏：两行展示，避免左右滑动 -->
		<view class="filter-tabs">
			<view
				class="filter-tab"
				:class="{ active: isAllActive }"
				@click="resetAllFilters"
			>
				<text>全部</text>
			</view>
			<view
				class="filter-tab"
				:class="{ active: activeDropdown === 'subject' || !!selectedSubject }"
				@click="toggleDropdown('subject')"
			>
				<text>{{ subjectTabText }}</text>
			</view>
			<view
				class="filter-tab"
				:class="{ active: activeDropdown === 'grade' || !!selectedGrade }"
				@click="toggleDropdown('grade')"
			>
				<text>{{ gradeTabText }}</text>
			</view>
			<view
				class="filter-tab"
				:class="{ active: activeDropdown === 'school' || !!selectedSchool }"
				@click="toggleDropdown('school')"
			>
				<text>{{ schoolTabText }}</text>
			</view>
			<view
				class="filter-tab"
				:class="{ active: activeDropdown === 'experience' || !!selectedExperience }"
				@click="toggleDropdown('experience')"
			>
				<text>{{ experienceTabText }}</text>
			</view>
			<view
				class="filter-tab"
				:class="{ active: activeDropdown === 'price' || !!selectedPrice }"
				@click="toggleDropdown('price')"
			>
				<text>{{ priceTabText }}</text>
			</view>
			<view
				class="filter-tab"
				:class="{ active: activeDropdown === 'sort' || selectedSort !== 'rating' }"
				@click="toggleDropdown('sort')"
			>
				<text>{{ sortTabText }}</text>
			</view>
		</view>
		</view>

		<!-- 下拉筛选面板 -->
		<view v-if="activeDropdown" class="dropdown-mask" @click="closeDropdown">
			<view class="dropdown-panel" @click.stop>
				<scroll-view scroll-y style="max-height: 60vh;">
					<!-- 科目筛选下拉 -->
					<view v-if="activeDropdown === 'subject'" class="dropdown-list">
							<view
							v-for="item in subjectFilters"
							:key="item.value"
							class="dropdown-item"
							:class="{ active: selectedSubject === item.value }"
							@click="handleSelectSubject(item.value)"
							>
							{{ item.label }}
						</view>
					</view>

					<!-- 年级筛选下拉 -->
					<view v-else-if="activeDropdown === 'grade'" class="dropdown-list">
							<view
							v-for="item in gradeFilters"
							:key="item.value"
							class="dropdown-item"
							:class="{ active: selectedGrade === item.value }"
							@click="handleSelectGrade(item.value)"
							>
							{{ item.label }}
							</view>
						</view>
					<!-- 院校筛选下拉 -->
					<view v-else-if="activeDropdown === 'school'" class="dropdown-list">
							<view
							v-for="item in schoolFilters"
							:key="item.value"
							class="dropdown-item"
							:class="{ active: selectedSchool === item.value }"
							@click="handleSelectSchool(item.value)"
							>
							{{ item.label }}
						</view>
					</view>

					<!-- 教师资历筛选下拉 -->
					<view v-else-if="activeDropdown === 'experience'" class="dropdown-list">
							<view
							v-for="item in experienceFilters"
							:key="item.value"
							class="dropdown-item"
							:class="{ active: selectedExperience === item.value }"
							@click="handleSelectExperience(item.value)"
							>
							{{ item.label }}
						</view>
					</view>

					<!-- 价格区间筛选下拉 -->
					<view v-else-if="activeDropdown === 'price'" class="dropdown-list">
							<view
							v-for="item in priceFilters"
							:key="item.value"
							class="dropdown-item"
							:class="{ active: selectedPrice === item.value }"
							@click="handleSelectPrice(item.value)"
							>
							{{ item.label }}
						</view>
					</view>

					<!-- 排序下拉 -->
					<view v-else-if="activeDropdown === 'sort'" class="dropdown-list">
							<view
							v-for="item in sortOptions"
							:key="item.value"
							class="dropdown-item"
							:class="{ active: selectedSort === item.value }"
							@click="handleSelectSort(item.value)"
							>
							{{ item.label }}
							</view>
						</view>
				</scroll-view>
					</view>
				</view>

		<!-- 教师列表（单列） -->
		<scroll-view
			scroll-y
			@scrolltolower="loadMore"
			class="list-scroll-single"
		>
			<view class="px-2 py-3">
				<view v-if="isLoading && !teacherList.length" class="d-flex flex-column">
					<view v-for="n in 4" :key="n" class="card teacher-card mb-3">
						<view class="d-flex a-center p-3">
							<view class="bg-light-secondary rounded" style="width: 130rpx;height: 130rpx;"></view>
							<view class="ml-3 flex-1">
								<view class="bg-light-secondary rounded mb-2" style="width: 200rpx;height: 30rpx;"></view>
								<view class="bg-light-secondary rounded mb-2" style="width: 150rpx;height: 24rpx;"></view>
								<view class="bg-light-secondary rounded" style="width: 180rpx;height: 24rpx;"></view>
							</view>
						</view>
					</view>
				</view>

				<view v-else>
					<view
						v-for="teacher in teacherList"
						:key="teacher._id"
						class="card teacher-card mb-3"
						hover-class="teacher-card-hover"
						hover-stay-time="60"
						@click="goToDetail(teacher)"
					>
						<view class="p-3 position-relative">
							<!-- 收藏按钮 -->
							<view
							class="favorite-btn"
								@click.stop="toggleFavorite(teacher)"
							>
							<image 
								class="favorite-icon"
								:src="teacher.is_favorited ? favoriteFilledUrl : favoriteEmptyUrl"
								mode="aspectFit"
							/>
							</view>
							
							<!-- 头部：头像和基本信息 -->
							<view class="d-flex a-center mb-3">
								<image 
									class="rounded-circle" 
									:src="teacher.avatar || defaultAvatarUrl" 
									mode="aspectFill"
									style="width: 120rpx;height: 120rpx;border: 2rpx solid #f0f0f0;"
								/>
								<view class="ml-3 flex-1">
									<view class="d-flex a-center mb-1">
										<text class="font-lg font-weight">{{ teacher.display_name || teacher.name || '教师' }}</text>
										<text v-if="teacherGenderText(teacher.gender)" class="ml-2 teacher-gender-chip" :class="teacherGenderClass(teacher.gender)">{{ teacherGenderText(teacher.gender) }}</text>
										<text v-if="teacher.is_verified" class="ml-2 stat-tag rounded px-2 py-1 font-xs text-white">认证</text>
									</view>
									<text class="font-sm text-light-muted d-block mb-1">
										{{ getSchoolAndExperience(teacher) }}
									</text>
									<view class="d-flex a-center flex-wrap">
										<text class="text-warning font-sm mr-1">⭐</text>
										<text v-if="hasReviewStats(teacher)" class="font-sm text-danger font-weight mr-2">{{ getPositiveRate(teacher) }}%好评</text>
										<text v-else class="font-sm text-light-muted mr-2">暂无评价</text>
										<text v-if="teacher.trial_count > 0" class="font-sm text-light-muted mr-2">试课{{ teacher.trial_count }}次</text>
										<text v-if="(teacher.trial_success_count || 0) > 0" class="font-sm text-success mr-2">试课成功{{ teacher.trial_success_count }}次</text>
										<text v-if="teacher.trial_success_rate > 0" class="font-sm text-success">成功率{{ formatPercent(teacher.trial_success_rate) }}</text>
									</view>
									<view v-if="getTeacherAddress(teacher)" class="d-flex a-center flex-wrap mt-1">
										<text class="font-xs text-light-muted">📍 {{ getTeacherAddress(teacher) }}</text>
										<text v-if="getTeacherDistance(teacher) != null" class="font-xs text-light-muted ml-2">约 {{ getTeacherDistance(teacher) }} km</text>
									</view>
								</view>
							</view>
							
							<!-- 擅长和可辅导 -->
							<view class="mb-2">
								<text v-if="(teacher.subjects || []).length" class="font-sm text-light-muted">
									擅长: {{ (teacher.subjects || []).slice(0, 2).join('、') }}
									<text v-if="(teacher.subjects || []).length > 2">等{{ teacher.subjects.length }}科</text>
								</text>
								<text v-if="(teacher.grades || []).length" class="font-sm text-light-muted ml-2">
									可辅导: {{ formatGrades(teacher.grades) }}
								</text>
							</view>
							
							<!-- 科目标签 -->
							<view v-if="(teacher.subjects || []).length" class="d-flex a-center flex-wrap mb-2">
								<text 
									v-for="(subject, index) in (teacher.subjects || []).slice(0, 4)" 
									:key="subject" 
									class="rounded px-2 py-1 font-xs mr-2 mb-1"
									:style="getTagStyle(index)"
								>
									{{ subject }}
								</text>
							</view>
							
							<!-- 价格和服务方式 -->
							<view class="d-flex a-center j-sb pt-2 border-top">
								<view class="flex-1">
									<text class="text-danger font-md font-weight">¥{{ teacher.hourly_rate || 100 }}/小时</text>
									<text v-if="getTeachingMethod(teacher)" class="font-xs text-light-muted ml-2">{{ getTeachingMethod(teacher) }}</text>
								</view>
								<text v-if="getSpecialty(teacher)" class="font-xs text-light-muted">{{ getSpecialty(teacher) }}</text>
							</view>
						</view>
					</view>

					<view v-if="!teacherList.length && !isLoading" class="d-flex flex-column a-center j-center py-5">
						<text class="iconfont icon-sousuo" style="font-size: 120rpx;color: #ddd;"></text>
						<text class="text-light-muted font-md mt-3">暂未找到合适的教师</text>
						<text class="text-light-muted font-sm mt-2">尝试切换筛选条件或稍后再试</text>
					</view>

					<view v-if="isLoading && teacherList.length" class="text-center text-light-muted font py-3">加载中...</view>
					<view v-else-if="!hasMore && teacherList.length" class="text-center text-light-muted font py-3">没有更多了</view>
				</view>
			</view>
			</scroll-view>

		<view class="tabbar-spacer"></view>
		<ParentTabBar current="teacher" />
	</view>
</template>

<script>
import { useMockData, mockTeachers } from '@/utils/mockData.js'
import ParentTabBar from '@/components/ParentTabBar.vue'
import LocationBar from '@/components/LocationBar.vue'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { checkPendingTrialConfirmReminder } from '@/utils/trialConfirmReminder.js'
import { getDefaultAvatarUrl, getIconUrl } from '@/utils/imageConfig.js'

export default {
	name: 'TeacherList',
	mixins: [pullRefreshMixin],
	components: {
		ParentTabBar,
		LocationBar
	},
	data() {
		return {
			// 默认头像URL（从CDN）
			defaultAvatarUrl: getDefaultAvatarUrl(),
			// 收藏图标URL（从CDN）
			favoriteFilledUrl: getIconUrl('favorite-filled.png'),
			favoriteEmptyUrl: getIconUrl('favorite-empty.png'),
			// 搜索关键词
			searchKeyword: '',
			// 教师列表数据
			teacherList: [],
			// 是否正在加载（首次加载）
			isLoading: false,
			// 是否正在刷新（下拉刷新）
			isRefreshing: false,
			// 是否正在加载更多（上拉加载）
			loadingMore: false,
			// 当前页码
			currentPage: 1,
			// 每页数据量
			pageSize: 10,
			// 是否还有更多数据
			hasMore: true,
			// 选中的科目筛选（空字符串表示全部）
			selectedSubject: '',
			// 选中的年级筛选（空字符串表示全部）
			selectedGrade: '',
			// 选中的排序方式：'rating'(智能推荐)、'newest'(人气优先)、'price_asc'(价格从低到高)、'price'(价格从高到低)
			selectedSort: 'rating',
			// 已收藏的教师ID列表（用于显示收藏状态）
			favoriteIds: [],
			// 收藏操作是否进行中（防止重复点击）
			favoriteLoading: false,
			// 是否使用模拟数据（开发测试用）
			useMock: false,
			// 用户位置（用于计算与教师距离）
			userLocation: null,
			// 滚动位置（用于下拉刷新判断）
			scrollTop: 0,
			// 是否可以刷新（滚动位置在顶部时才能刷新）
			canRefresh: true,
			// 筛选分类展开/收起状态
			filterSectionsExpanded: {
				subject: true,      // 科目分类是否展开
				grade: true,        // 年级分类是否展开
				school: false,      // 院校分类是否展开
				experience: false,  // 资历分类是否展开
				price: false,       // 价格分类是否展开
				location: false,    // 位置分类是否展开
				tags: false,       // 标签分类是否展开
				sort: true         // 排序分类是否展开
			},
			// 选中的筛选值
			selectedSchool: '',      // 选中的院校
			selectedExperience: '',  // 选中的资历
			selectedPrice: '',       // 选中的价格区间
			selectedLocation: '',    // 选中的位置
			selectedTags: [],        // 选中的标签（多选）
			// 科目筛选选项
			// 修改提示：科目列表与数据库 teacher-profiles.schema.json 中的 subjects 枚举保持一致
			subjectFilters: [
				{ label: '全部科目', value: '' },
				{ label: '语文', value: '语文' },
				{ label: '数学', value: '数学' },
				{ label: '英语', value: '英语' },
				{ label: '物理', value: '物理' },
				{ label: '化学', value: '化学' },
				{ label: '生物', value: '生物' },
				{ label: '历史', value: '历史' },
				{ label: '地理', value: '地理' },
				{ label: '政治', value: '政治' },
				{ label: '其他', value: '其他' }
			],
			// 年级筛选选项
			// 修改提示：可以在这里添加更多年级选项，或调整年级分类方式
			gradeFilters: [
				{ label: '全部年级', value: '' },
				{ label: '一年级', value: '一年级' },
				{ label: '二年级', value: '二年级' },
				{ label: '三年级', value: '三年级' },
				{ label: '四年级', value: '四年级' },
				{ label: '五年级', value: '五年级' },
				{ label: '六年级', value: '六年级' },
				{ label: '初一', value: '初一' },
				{ label: '初二', value: '初二' },
				{ label: '初三', value: '初三' },
				{ label: '高一', value: '高一' },
				{ label: '高二', value: '高二' },
				{ label: '高三', value: '高三' }
			],
			// 排序选项
			// 修改提示：可以在这里添加更多排序方式，如距离、好评率等
			sortOptions: [
				{ label: '智能推荐', value: 'rating' },
				{ label: '人气优先', value: 'newest' },
				{ label: '价格从低到高', value: 'price_asc' },
				{ label: '价格从高到低', value: 'price' }
			],
			// 是否在读筛选选项
			schoolFilters: [
				{ label: '全部', value: '' },
				{ label: '四川大学', value: '四川大学' },
				{ label: '电子科技大学', value: '电子科技大学' },
				{ label: '西南交通大学', value: '西南交通大学' },
				{ label: '四川农业大学', value: '四川农业大学' },
				{ label: '西南财经大学', value: '西南财经大学' },
				{ label: '其他985/211', value: '其他985/211' },
				{ label: '专职老师（已毕业）', value: '专职老师（已毕业）' }
			],
			// 教师资历筛选选项
			experienceFilters: [
				{ label: '全部资历', value: '' },
				{ label: '大一（高考刚结束）', value: '大一（高考刚结束）' },
				{ label: '大二至大四（1年以内）', value: '大二至大四（1年以内）' },
				{ label: '大二至大四（1-2年）', value: '大二至大四（1-2年）' },
				{ label: '大二至大四（2年以上）', value: '大二至大四（2年以上）' },
				{ label: '研究生在读', value: '研究生在读' },
				{ label: '博士在读', value: '博士在读' },
				{ label: '专职老师（1-3年）', value: '专职老师（1-3年）' },
				{ label: '专职老师（3-5年）', value: '专职老师（3-5年）' },
				{ label: '专职老师（5年以上）', value: '专职老师（5年以上）' }
			],
			// 价格筛选选项
			priceFilters: [
				{ label: '全部价格', value: '' },
				{ label: '50-100元/小时', value: '50-100' },
				{ label: '100-150元/小时', value: '100-150' },
				{ label: '150-200元/小时', value: '150-200' },
				{ label: '200-250元/小时', value: '200-250' },
				{ label: '250元以上/小时', value: '250+' }
			],
			// 老师位置筛选选项
			locationFilters: [
				{ label: '全部位置', value: '' },
				{ label: '武侯区', value: '武侯区' },
				{ label: '青羊区', value: '青羊区' },
				{ label: '金牛区', value: '金牛区' },
				{ label: '锦江区', value: '锦江区' },
				{ label: '成华区', value: '成华区' },
				{ label: '高新区', value: '高新区' },
				{ label: '双流区', value: '双流区' },
				{ label: '郫都区', value: '郫都区' }
			],
			// 附加标签筛选选项（多选）
			tagFilters: [
				{ label: '有试课视频', value: '有试课视频' },
				{ label: '家长好评50+', value: '家长好评50+' },
				{ label: '可上门辅导', value: '可上门辅导' },
				{ label: '擅长提分（中高考）', value: '擅长提分（中高考）' },
				{ label: '耐心教基础薄弱生', value: '耐心教基础薄弱生' }
			],
			// 当前展开的顶部筛选下拉：subject / grade / sort / ''
			activeDropdown: ''
		}
	},
	computed: {
		// 科目标签文案
		subjectLabel() {
			const item = this.subjectFilters.find(s => s.value === this.selectedSubject)
			return item && item.value ? item.label : ''
		},
		// 年级标签文案
		gradeLabel() {
			const item = this.gradeFilters.find(g => g.value === this.selectedGrade)
			return item && item.value ? item.label : ''
		},
		// 院校标签文案
		schoolLabel() {
			const item = this.schoolFilters.find(s => s.value === this.selectedSchool)
			return item && item.value ? item.label : ''
		},
		// 教师资历标签文案
		experienceLabel() {
			const item = this.experienceFilters.find(e => e.value === this.selectedExperience)
			return item && item.value ? item.label : ''
		},
		// 价格标签文案
		priceLabel() {
			const item = this.priceFilters.find(p => p.value === this.selectedPrice)
			return item && item.value ? item.label : ''
		},
		// 排序标签文案
		sortLabel() {
			const item = this.sortOptions.find(o => o.value === this.selectedSort)
			return item ? item.label : '智能推荐'
		},
		subjectDisplayLabel() {
			return this.subjectLabel || ''
		},
		subjectTabText() {
			return this.subjectDisplayLabel || '科目'
		},
		gradeDisplayLabel() {
			return this.gradeLabel || ''
		}, 
		gradeTabText() {
			return this.gradeDisplayLabel || '年级'
		},
		schoolDisplayLabel() {
			if (!this.schoolLabel) return ''
			if (this.schoolLabel.length <= 4) return this.schoolLabel
			if (this.schoolLabel === '四川大学') return '川大'
			if (this.schoolLabel === '电子科技大学') return '电子科大'
			if (this.schoolLabel === '西南交通大学') return '西南交大'
			if (this.schoolLabel === '四川农业大学') return '川农'
			if (this.schoolLabel === '西南财经大学') return '西南财大'
			if (this.schoolLabel === '其他985/211') return '985/211'
			if (this.schoolLabel === '专职老师' || this.schoolLabel === '专职老师（已毕业）') return '专职'
			return '已选'
		},
		schoolTabText() {
			return this.schoolDisplayLabel || '是否在读'
		},
		experienceDisplayLabel() {
			if (!this.experienceLabel) return ''
			if (this.experienceLabel.includes('大一')) return '大一'
			if (this.experienceLabel.includes('1年以内')) return '1年内'
			if (this.experienceLabel.includes('1-2年')) return '1-2年'
			if (this.experienceLabel.includes('2年以上')) return '2年以上'
			if (this.experienceLabel.includes('1-3年')) return '1-3年'
			if (this.experienceLabel.includes('3-5年')) return '3-5年'
			if (this.experienceLabel.includes('5年以上')) return '5年以上'
			return '已选'
		},
		experienceTabText() {
			return this.experienceDisplayLabel || '资历'
		},
		priceDisplayLabel() {
			if (!this.priceLabel) return ''
			return this.priceLabel
				.replace('元/小时', '')
				.replace('全部价格', '')
				.replace('以上', '+')
		},
		priceTabText() {
			return this.priceDisplayLabel || '价格'
		},
		sortDisplayLabel() {
			const map = {
				rating: '',
				newest: '人气',
				price_asc: '低价',
				price: '高价'
			}
			return map[this.selectedSort] || ''
		},
		sortTabText() {
			return this.sortDisplayLabel || '排序'
		},
		// “全部”是否处于激活态（所有筛选都是默认值）
		isAllActive() {
			return !this.selectedSubject &&
				!this.selectedGrade &&
				!this.selectedSchool &&
				!this.selectedExperience &&
				!this.selectedPrice &&
				!this.selectedLocation &&
				this.selectedTags.length === 0 &&
				this.selectedSort === 'rating'
		}
	},
	/**
	 * 页面加载时触发
	 * 功能：初始化模拟数据开关，加载教师列表
	 */
	onLoad() {
		this.useMock = useMockData() === true
		// 调试：打印年级筛选选项，确认数据是否正确
		console.log('[teacher-list] 年级筛选选项:', this.gradeFilters)
		console.log('[teacher-list] 年级筛选选项数量:', this.gradeFilters.length)
		// 延迟加载数据，避免阻塞页面渲染
		this.fetchUserLocation()
		this.$nextTick(() => {
			setTimeout(() => {
		this.loadTeachers(true)
			}, 50)
		})
	},
	onShow() {
		checkPendingTrialConfirmReminder()
	},
	onShareAppMessage() {
		return {
			title: '优培信息通 · 找优质家教老师',
			path: '/pages/teacher/list'
		}
	},
	onShareTimeline() {
		return {
			title: '优培信息通 · 找优质家教老师'
		}
	},
	methods: {
		// 顶部筛选栏：切换下拉
		toggleDropdown(type) {
			this.activeDropdown = this.activeDropdown === type ? '' : type
		},
		// 关闭下拉
		closeDropdown() {
			this.activeDropdown = ''
		},
		// 选择科目
		handleSelectSubject(value) {
			this.changeSubject(value)
			this.closeDropdown()
		},
		// 选择年级
		handleSelectGrade(value) {
			this.changeGrade(value)
			this.closeDropdown()
		},
		// 选择院校
		handleSelectSchool(value) {
			this.changeSchool(value)
			this.closeDropdown()
		},
		// 选择教师资历
		handleSelectExperience(value) {
			this.changeExperience(value)
			this.closeDropdown()
		},
		// 选择价格区间
		handleSelectPrice(value) {
			this.changePrice(value)
			this.closeDropdown()
		},
		// 选择排序
		handleSelectSort(value) {
			this.changeSort(value)
			this.closeDropdown()
		},
		// 重置所有筛选（对应“全部”）
		resetAllFilters() {
			this.selectedSubject = ''
			this.selectedGrade = ''
			this.selectedSchool = ''
			this.selectedExperience = ''
			this.selectedPrice = ''
			this.selectedLocation = ''
			this.selectedTags = []
			this.selectedSort = 'rating'
			this.activeDropdown = ''
			this.loadTeachers(true)
		},
		/**
		 * 下拉刷新数据
		 * 功能：重新加载第一页数据
		 */
		async refreshData() {
			console.log('[teacher-list] 下拉刷新：重新加载教师列表')
			await this.loadTeachers(true)
		},
		/**
		 * 加载教师列表
		 * @param {Boolean} reset - 是否重置（重置页码和列表）
		 * 功能：
		 *   1. 根据搜索关键词、筛选条件、排序方式获取教师列表
		 *   2. 支持分页加载
		 *   3. 处理模拟数据和真实数据
		 * 
		 * 修改提示：
		 *   - 修改分页大小：修改 pageSize 的值
		 *   - 修改查询参数：修改传递给云函数的参数
		 *   - 添加其他筛选条件：在查询参数中添加新字段
		 */
		async loadTeachers(reset = false) {
			if (this.isLoading) return
			if (!this.hasMore && !reset) return

			this.isLoading = true
			if (reset) {
				this.currentPage = 1
				this.teacherList = []
				this.hasMore = true
			}

			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const newList = mockTeachers.slice(0, this.pageSize).map(item => ({
						...item,
						teacher_id: item.teacher_id || item._id
					}))
					this.teacherList = reset ? newList : [...this.teacherList, ...newList]
					this.hasMore = false
					this.currentPage += 1
					await this.syncFavorites()
					return
				}

				// 解析价格区间
				let minPrice, maxPrice
				if (this.selectedPrice) {
					if (this.selectedPrice === '50-100') {
						minPrice = 50
						maxPrice = 100
					} else if (this.selectedPrice === '100-150') {
						minPrice = 100
						maxPrice = 150
					} else if (this.selectedPrice === '150-200') {
						minPrice = 150
						maxPrice = 200
					} else if (this.selectedPrice === '200-250') {
						minPrice = 200
						maxPrice = 250
					} else if (this.selectedPrice === '250+') {
						minPrice = 250
						maxPrice = undefined
					}
				}

				const teacherListObj = uniCloud.importObject('teacher-list', { customUI: true })
				const result = await teacherListObj.getList({
					page: this.currentPage,
					pageSize: this.pageSize,
					keyword: this.searchKeyword || undefined,
					subject: this.selectedSubject || undefined,
					grade: this.selectedGrade || undefined,
					school: this.selectedSchool || undefined,
					experience: this.selectedExperience || undefined,
					minPrice: minPrice,
					maxPrice: maxPrice,
					location: this.selectedLocation || undefined,
					tags: this.selectedTags.length > 0 ? this.selectedTags : undefined,
					sortBy: this.selectedSort
				})

				if (result.code === 0) {
					const newList = (result.data.list || []).map(item => ({
						...item,
						teacher_id: item.teacher_id || item._id
					}))
					if (reset) {
						this.teacherList = newList
					} else {
						this.teacherList = [...this.teacherList, ...newList]
					}
					const pagination = result.data.pagination || {}
					this.hasMore = pagination.hasMore !== undefined ? pagination.hasMore : newList.length >= this.pageSize
					this.currentPage = pagination.page ? pagination.page + 1 : this.currentPage + 1
					await this.syncFavorites()
				} else {
					throw new Error(result.message || '加载教师失败')
				}
			} catch (error) {
				console.error('加载教师失败:', error)
				uni.showToast({ title: error.message || '加载失败', icon: 'none' })
			} finally {
				this.isLoading = false
				this.isRefreshing = false
				this.loadingMore = false
			}
		},
		/**
		 * 处理滚动事件
		 * @param {Object} e - 滚动事件对象
		 * 功能：记录滚动位置，判断是否可以下拉刷新
		 */
		handleScroll(e) {
			this.scrollTop = e.detail.scrollTop
			this.canRefresh = e.detail.scrollTop <= 10
		},
		/**
		 * 滚动到顶部时触发
		 * 功能：重置滚动状态，允许下拉刷新
		 */
		handleScrollToUpper() {
			this.scrollTop = 0
			this.canRefresh = true
		},
		/**
		 * 处理搜索
		 * 功能：使用当前搜索关键词重新加载教师列表
		 */
		handleSearch() {
			this.loadTeachers(true)
		},
		/**
		 * 下拉刷新处理
		 * 功能：检查是否可以刷新，如果可以则重新加载数据
		 */
		onRefresh() {
			if (!this.canRefresh || this.scrollTop > 10) {
				this.isRefreshing = false
				return
			}
			this.isRefreshing = true
			this.loadTeachers(true)
		},
		/**
		 * 上拉加载更多
		 * 功能：加载下一页数据
		 */
		loadMore() {
			if (this.hasMore && !this.loadingMore && !this.isRefreshing) {
				this.loadingMore = true
				this.loadTeachers()
			}
		},
		/**
		 * 切换科目筛选
		 * @param {String} value - 科目值（空字符串表示全部）
		 * 功能：更新选中的科目，重新加载列表
		 */
		changeSubject(value) {
			if (this.selectedSubject === value) return
			this.selectedSubject = value
			this.loadTeachers(true)
		},
		/**
		 * 切换年级筛选
		 * @param {String} value - 年级值（空字符串表示全部）
		 * 功能：更新选中的年级，重新加载列表
		 */
		changeGrade(value) {
			if (this.selectedGrade === value) return
			this.selectedGrade = value
			this.loadTeachers(true)
		},
		/**
		 * 切换排序方式
		 * @param {String} value - 排序值：'rating'、'newest'、'price_asc'、'price'
		 * 功能：更新排序方式，重新加载列表
		 */
		changeSort(value) {
			if (this.selectedSort === value) return
			this.selectedSort = value
			this.loadTeachers(true)
		},
		/**
		 * 切换院校筛选
		 * @param {String} value - 院校值（空字符串表示全部）
		 * 功能：更新选中的院校，重新加载列表
		 */
		changeSchool(value) {
			if (this.selectedSchool === value) return
			this.selectedSchool = value
			this.loadTeachers(true)
		},
		/**
		 * 切换资历筛选
		 * @param {String} value - 资历值（空字符串表示全部）
		 * 功能：更新选中的资历，重新加载列表
		 */
		changeExperience(value) {
			if (this.selectedExperience === value) return
			this.selectedExperience = value
			this.loadTeachers(true)
		},
		/**
		 * 切换价格筛选
		 * @param {String} value - 价格区间值（空字符串表示全部）
		 * 功能：更新选中的价格区间，重新加载列表
		 */
		changePrice(value) {
			if (this.selectedPrice === value) return
			this.selectedPrice = value
			this.loadTeachers(true)
		},
		/**
		 * 切换位置筛选
		 * @param {String} value - 位置值（空字符串表示全部）
		 * 功能：更新选中的位置，重新加载列表
		 */
		changeLocation(value) {
			if (this.selectedLocation === value) return
			this.selectedLocation = value
			this.loadTeachers(true)
		},
		/**
		 * 切换标签筛选（多选）
		 * @param {String} value - 标签值
		 * 功能：切换标签的选中状态，重新加载列表
		 */
		toggleTag(value) {
			const index = this.selectedTags.indexOf(value)
			if (index > -1) {
				this.selectedTags.splice(index, 1)
			} else {
				this.selectedTags.push(value)
			}
			this.loadTeachers(true)
		},
		/**
		 * 同步收藏状态
		 * 功能：
		 *   1. 从云函数获取当前用户的收藏列表
		 *   2. 更新 favoriteIds
		 *   3. 为教师列表中的每个教师设置 is_favorited 状态
		 * 修改提示：可以在这里添加收藏状态的缓存逻辑
		 */
		async syncFavorites() {
			try {
				if (this.useMock) {
					this.favoriteIds = mockTeachers.slice(0, 1).map(item => item.teacher_id || item._id)
					this.applyFavoriteStatus()
					return
				}
				const stored = uni.getStorageSync('userInfo') || {}
				if (!stored.uid) {
					this.favoriteIds = []
					this.applyFavoriteStatus()
					return
				}
				const favoriteObj = uniCloud.importObject('teacher-favorite', { customUI: true })
				const res = await favoriteObj.getParentFavorites()
				if (res.code === 0 && res.data) {
					this.favoriteIds = (res.data.list || []).map(item => item.teacher_id)
				} else {
					this.favoriteIds = []
				}
			} catch (error) {
				console.error('获取收藏状态失败:', error)
			} finally {
				this.applyFavoriteStatus()
			}
		},
		/**
		 * 应用收藏状态到教师列表
		 * 功能：根据 favoriteIds 为每个教师设置 is_favorited 属性
		 */
		applyFavoriteStatus() {
			const idSet = new Set(this.favoriteIds || [])
			this.teacherList.forEach(item => {
				const id = item.teacher_id || item._id
				item.is_favorited = idSet.has(id)
			})
		},
		/**
		 * 切换收藏状态
		 * @param {Object} teacher - 教师对象
		 * 功能：
		 *   1. 如果已收藏，则取消收藏
		 *   2. 如果未收藏，则添加收藏
		 *   3. 更新本地状态和云数据库
		 * 
		 * 修改提示：
		 *   - 可以添加收藏前的验证逻辑（如登录检查）
		 *   - 可以添加收藏成功的回调处理
		 */
		async toggleFavorite(teacher) {
			const teacherId = teacher.teacher_id || teacher._id
			if (!teacherId) {
				uni.showToast({ title: '教师信息不完整', icon: 'none' })
				return
			}
			try {
				if (this.useMock) {
					teacher.is_favorited = !teacher.is_favorited
					if (teacher.is_favorited) {
						if (!this.favoriteIds.includes(teacherId)) {
							this.favoriteIds.push(teacherId)
						}
						uni.showToast({ title: '收藏成功', icon: 'success' })
					} else {
						this.favoriteIds = this.favoriteIds.filter(id => id !== teacherId)
						uni.showToast({ title: '已取消收藏', icon: 'success' })
					}
					return
				}

				const stored = uni.getStorageSync('userInfo') || {}
				if (!stored.uid) {
					uni.showToast({ title: '请先登录', icon: 'none' })
					return
				}

				const favoriteObj = uniCloud.importObject('teacher-favorite', { customUI: true })
				if (teacher.is_favorited) {
					const res = await favoriteObj.removeFavorite({ teacher_id: teacherId })
					if (res.code === 0) {
						teacher.is_favorited = false
						this.favoriteIds = this.favoriteIds.filter(id => id !== teacherId)
						uni.showToast({ title: '已取消收藏', icon: 'success' })
					} else {
						uni.showToast({ title: res.message || '取消失败', icon: 'none' })
					}
				} else {
					const res = await favoriteObj.addFavorite({ teacher_id: teacherId })
					if (res.code === 0) {
						teacher.is_favorited = true
						if (!this.favoriteIds.includes(teacherId)) {
							this.favoriteIds.push(teacherId)
						}
						uni.showToast({ title: '收藏成功', icon: 'success' })
					} else {
						uni.showToast({ title: res.message || '收藏失败', icon: 'none' })
					}
				}
			} catch (error) {
				console.error('操作收藏失败:', error)
				uni.showToast({ title: '操作失败，请稍后再试', icon: 'none' })
			}
		},
		goToDetail(teacher) {
			const profileId = teacher._id || teacher.id
			const teacherUid = teacher.teacher_id || ''
			if (!profileId) {
				uni.showToast({ title: '教师信息不完整', icon: 'none' })
				return
			}
			// 防抖：上一次跳转尚未完成时直接忽略，避免微信小程序 navigateTo 排队 5s 超时
			if (this._navigatingDetail) return
			this._navigatingDetail = true
			const params = [`id=${profileId}`]
			if (teacherUid) params.push(`teacherUid=${teacherUid}`)
			uni.navigateTo({
				url: `/pages/teacher/detail?${params.join('&')}`,
				success: () => {
					this._navigatingDetail = false
				},
				fail: (err) => {
					this._navigatingDetail = false
					console.warn('[teacher/list] navigateTo detail failed:', err && err.errMsg)
					if (err && /timeout/i.test(err.errMsg || '')) {
						// timeout 多为页面栈过深或网络抖动，提示用户重试一次
						uni.showToast({ title: '加载超时，请重试', icon: 'none' })
					} else {
						uni.showToast({ title: '打开失败，请重试', icon: 'none' })
					}
				}
			})
		},
		formatPercent(rate) {
			if (!rate && rate !== 0) return '0%'
			return `${(Number(rate) * 100).toFixed(0)}%`
		},
		formatRating(rating) {
			if (!rating && rating !== 0) return '5.0'
			return Number(rating).toFixed(1)
		},
		/**
		 * 获取院校和教龄信息
		 * @param {Object} teacher - 教师对象
		 * @returns {String} 格式化的院校和教龄信息
		 */
		getSchoolAndExperience(teacher) {
			const school = teacher.school === '专职老师' ? '专职老师（已毕业）' : (teacher.school || '')
			const years = teacher.experience_years || teacher.teaching_experience?.years || 0
			const parts = []
			if (school) {
				parts.push(school)
			}
			if (years > 0) {
				parts.push(`教龄${years}年`)
			}
			return parts.length > 0 ? parts.join('・') : '专业教师'
		},
		teacherGenderText(gender) {
			if (gender === 'male' || gender === 1 || gender === '1') return '男'
			if (gender === 'female' || gender === 2 || gender === '2') return '女'
			return ''
		},
		teacherGenderClass(gender) {
			if (gender === 'male' || gender === 1 || gender === '1') return 'male'
			if (gender === 'female' || gender === 2 || gender === '2') return 'female'
			return ''
		},
		hasReviewStats(teacher) {
			return (teacher.review_count || 0) > 0
		},
		/**
		 * 获取好评率（4 星及以上占比，由后端根据真实评价计算）
		 * @param {Object} teacher - 教师对象
		 * @returns {Number} 好评率（百分比）
		 */
		getPositiveRate(teacher) {
			if (!this.hasReviewStats(teacher)) return 0
			return Math.round(teacher.positive_rate || 0)
		},
		/** 获取用户位置（用于距离计算） */
		async fetchUserLocation() {
			try {
				const res = await uni.getLocation({ type: 'gcj02' })
				if (res.latitude != null && res.longitude != null) {
					this.userLocation = { lat: res.latitude, lon: res.longitude }
				}
			} catch (e) {
				// 用户拒绝或失败时不提示，距离不显示即可
			}
		},
		/**
		 * 教师教学地址（取第一个教学区域）
		 * @param {Object} teacher - 教师对象（含 teaching_areas）
		 * @returns {String}
		 */
		getTeacherAddress(teacher) {
			const areas = teacher.teaching_areas || []
			if (!areas.length) return ''
			const area = areas[0]
			if (area.name && String(area.name).trim()) return String(area.name).trim()
			const parts = [area.province, area.city, area.district, area.address].filter(Boolean)
			return parts.join(' ') || ''
		},
		/**
		 * 与教师的距离（km），无位置或教师无坐标时返回 null
		 * @param {Object} teacher - 教师对象（含 teaching_areas，项可有 latitude/longitude）
		 * @returns {String|null} 如 "3.2"，或 null
		 */
		getTeacherDistance(teacher) {
			if (!this.userLocation || this.userLocation.lat == null || this.userLocation.lon == null) return null
			const areas = teacher.teaching_areas || []
			const withCoord = areas.find(a => a.latitude != null && a.longitude != null)
			if (!withCoord) return null
			const km = this.haversineKm(
				this.userLocation.lat,
				this.userLocation.lon,
				parseFloat(withCoord.latitude),
				parseFloat(withCoord.longitude)
			)
			return km == null ? null : km.toFixed(1)
		},
		/** 两点经纬度距离（km），Haversine */
		haversineKm(lat1, lon1, lat2, lon2) {
			if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
			const R = 6371
			const dLat = (lat2 - lat1) * Math.PI / 180
			const dLon = (lon2 - lon1) * Math.PI / 180
			const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
			const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
			return R * c
		},
		/**
		 * 格式化年级显示
		 * @param {Array} grades - 年级数组
		 * @returns {String} 格式化的年级字符串
		 */
		formatGrades(grades) {
			if (!Array.isArray(grades) || grades.length === 0) return ''
			
			// 分类年级
			const primary = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级']
			const junior = ['初一', '初二', '初三']
			const senior = ['高一', '高二', '高三']
			
			const primaryGrades = grades.filter(g => primary.includes(g))
			const juniorGrades = grades.filter(g => junior.includes(g))
			const seniorGrades = grades.filter(g => senior.includes(g))
			
			const parts = []
			if (primaryGrades.length > 0) {
				if (primaryGrades.length === 6) {
					parts.push('小学')
				} else {
					parts.push(`小学(${primaryGrades.length}个年级)`)
				}
			}
			if (juniorGrades.length > 0) {
				if (juniorGrades.length === 3) {
					parts.push('初中')
				} else {
					parts.push(`初中(${juniorGrades.length}个年级)`)
				}
			}
			if (seniorGrades.length > 0) {
				if (seniorGrades.length === 3) {
					parts.push('高中')
				} else {
					parts.push(`高中(${seniorGrades.length}个年级)`)
				}
			}
			
			return parts.length > 0 ? parts.join('、') : grades.slice(0, 3).join('、')
		},
		/**
		 * 获取标签样式
		 * @param {Number} index - 标签索引
		 * @returns {String} 样式字符串
		 */
		getTagStyle(index) {
			const styles = [
				'background: #E6F3FF; color: #4A90E2;', // 浅蓝色
				'background: #D6EBFF; color: #357ABD;', // 中蓝色
				'background: #C6E3FF; color: #2A5F8F;', // 深蓝色
				'background: #E8F4FF; color: #5BA3F0;'  // 淡蓝色
			]
			return styles[index % styles.length]
		},
		/**
		 * 获取教学方式
		 * @param {Object} teacher - 教师对象
		 * @returns {String} 教学方式
		 */
		getTeachingMethod(teacher) {
			const methods = teacher.teaching_methods || []
			if (methods.includes('online') && methods.includes('offline')) {
				return '线上/线下'
			} else if (methods.includes('online')) {
				return '线上辅导'
			} else if (methods.includes('offline')) {
				return '线下辅导'
			}
			return ''
		},
		/**
		 * 获取专业特长
		 * @param {Object} teacher - 教师对象
		 * @returns {String} 专业特长
		 */
		getSpecialty(teacher) {
			const tags = teacher.tags || []
			if (tags.length === 0) return ''
			
			// 根据标签生成特长描述
			const specialtyMap = {
				'擅长提分（中高考）': '提分专家',
				'耐心教基础薄弱生': '基础教学',
				'有试课视频': '视频教学',
				'可上门辅导': '上门服务'
			}
			
			const specialties = tags
				.filter(tag => specialtyMap[tag])
				.map(tag => specialtyMap[tag])
				.slice(0, 2)
			
			return specialties.length > 0 ? specialties.join(' | ') : ''
		},
		/**
		 * 切换筛选分类的展开/收起状态
		 * @param {String} section - 分类名称：'subject'（科目）、'grade'（年级）、'sort'（排序）
		 * 功能：控制指定筛选分类的展开和收起，收起时隐藏该分类下的所有选项
		 */
		toggleFilterSection(section) {
			this.filterSectionsExpanded[section] = !this.filterSectionsExpanded[section]
		}
	}
}
</script>

<style scoped>
.teacher-list-page {
	height: 100vh;
	display: flex;
	flex-direction: column;
	background: #f5f5f5;
	overflow: hidden;
}

.teacher-list-top {
	flex-shrink: 0;
	background: #f5f5f5;
	z-index: 20;
}

.search-header {
	flex-shrink: 0;
}

/* 顶部筛选栏（全部 / 科目 / 年级 / 排序） */
.filter-tabs {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10rpx 12rpx;
	margin: 0 24rpx 10rpx;
	background-color: #FFFFFF;
	border-radius: 20rpx;
	box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.04);
	overflow: hidden;
}

.filter-tab {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 1;
	min-width: 0;
	min-height: 56rpx;
	font-size: 23rpx;
	color: #666666;
	padding: 0 6rpx;
	position: relative;
	border-radius: 12rpx;
	background: transparent;
	box-sizing: border-box;
	overflow: hidden;
}

.filter-tab + .filter-tab {
	border-left: 1rpx solid #F5F5F5;
}

.filter-tab text {
	display: block;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.filter-tab.active {
	color: #F8A100;
	font-weight: 600;
}

/* 下拉筛选面板 */
.dropdown-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	background-color: rgba(0, 0, 0, 0.15);
	z-index: 1000;
}

.dropdown-panel {
	background-color: #FFFFFF;
	border-radius: 0 0 20rpx 20rpx;
	padding: 10rpx 0;
	box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.08);
}

.dropdown-list {
	padding: 10rpx 20rpx 20rpx;
}

.dropdown-section-title {
	font-size: 22rpx;
	color: #999999;
	padding: 16rpx 4rpx 8rpx;
}

.dropdown-item {
	padding: 18rpx 10rpx;
	font-size: 26rpx;
	color: #333333;
	border-bottom: 1rpx solid #F5F5F5;
}

.dropdown-item:last-child {
	border-bottom: none;
}

.dropdown-item.active {
	color: #F8A100;
	font-weight: 600;
}

/* 单列教师列表滚动区域 */
.list-scroll-single {
	flex: 1;
	min-height: 0;
	background: #F5F5F5;
	padding-bottom: 140rpx;
}

.tabbar-spacer {
	height: 0;
}

/* 收藏按钮 */
.favorite-btn {
	position: absolute;
	top: 20rpx;
	right: 20rpx;
	z-index: 10;
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.favorite-btn .favorite-icon {
	width: 44rpx;
	height: 44rpx;
	transition: transform 0.2s ease;
}

.favorite-btn:active .favorite-icon {
	transform: scale(0.9);
}

/* 教师卡片动效与阴影 */
.teacher-card {
	border-radius: 24rpx;
	overflow: hidden;
	transform: translateY(0);
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.04);
	transition: transform 0.18s ease-out, box-shadow 0.18s ease-out;
}

.teacher-card-hover {
	transform: translateY(-4rpx);
	box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.14);
}

.teacher-gender-chip {
	padding: 4rpx 14rpx;
	border-radius: 999rpx;
	font-size: 20rpx;
	line-height: 1.4;
	font-weight: 600;
}

.teacher-gender-chip.male {
	color: #1677ff;
	background: #e6f4ff;
}

.teacher-gender-chip.female {
	color: #eb2f96;
	background: #fff0f6;
}
</style>