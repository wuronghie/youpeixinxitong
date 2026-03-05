<template>
	<view>
		<!-- 教师信息头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex a-center text-white">
				<image 
					class="rounded-circle border-light" 
					:src="teacherInfo.avatar || defaultAvatarUrl" 
					mode="aspectFill"
					style="width: 120rpx;height: 120rpx;border: 4rpx solid rgba(255,255,255,0.3);"
				/>
				<view class="ml-3 flex-1">
					<text class="font-lg font-weight d-block mb-1">{{ teacherInfo.name || '教师' }}</text>
					<text class="font-sm d-block" style="opacity: 0.85;">
						{{ teacherInfo.subjectText }}
						<text v-if="teacherInfo.experience"> · {{ teacherInfo.experience }}</text>
					</text>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 课程满意度 -->
				<card headTitle="课程满意度">
					<view class="d-flex a-center j-sb mb-3">
						<text class="font-sm text-light-muted">{{ ratingTips[formData.rating - 1] }}</text>
					</view>
					<view class="d-flex a-center">
						<view
							v-for="i in 5"
							:key="i"
							class="text-center py-3 rounded mr-2"
							:class="i <= formData.rating ? 'main-bg-color text-white' : 'bg-light-secondary'"
							style="width: 90rpx;"
							@click="setRating(i)"
						>
							<text class="font-lg">★</text>
						</view>
					</view>
				</card>

				<!-- 老师最值得点赞的地方 -->
				<card headTitle="老师最值得点赞的地方" class="mt-3">
					<view class="text-light-muted font-sm mb-2">可多选，最多 4 项</view>
					<view class="d-flex flex-wrap">
						<view
							v-for="tag in tagOptions"
							:key="tag"
							class="rounded px-3 py-2 mr-2 mb-2 font-sm"
							:class="formData.tags.includes(tag) ? 'main-bg-color text-white' : 'bg-light-secondary'"
							@click="toggleTag(tag)"
						>
							{{ tag }}
						</view>
					</view>
				</card>

				<!-- 详细评价 -->
				<card headTitle="详细评价" class="mt-3">
					<view class="text-light-muted font-sm mb-2">至少 10 个字，帮助其他家长更好地了解老师</view>
					<textarea 
						class="w-100 border rounded p-2 font-sm" 
						v-model="formData.content" 
						:maxlength="maxContentLength"
						:placeholder="textareaPlaceholder"
						style="min-height: 220rpx;"
						placeholder-class="text-light-muted"
					/>
					<view class="d-flex j-end mt-2">
						<text class="font-sm text-light-muted">{{ formData.content.length }}/{{ maxContentLength }}</text>
					</view>
				</card>

				<!-- 试课结果 -->
				<card v-if="isTrial" headTitle="试课结果" class="mt-3">
					<view class="text-light-muted font-sm mb-2">告诉我们这次试课是否达成预期</view>
					<view 
						class="d-flex a-center p-3 rounded mb-2 border"
						:class="formData.is_satisfied === true ? 'border-primary bg-light' : 'border-light-secondary'"
						@click="selectResult(true)"
					>
						<text class="font-lg mr-3">😊</text>
						<view class="flex-1">
							<text class="font-sm font-weight d-block mb-1">满意，想继续正式课程</text>
							<text class="font-sm text-light-muted">老师讲解清晰、学生接受度高，期待后续合作</text>
						</view>
					</view>
					<view 
						class="d-flex a-center p-3 rounded border"
						:class="formData.is_satisfied === false ? 'border-primary bg-light' : 'border-light-secondary'"
						@click="selectResult(false)"
					>
						<text class="font-lg mr-3">🤔</text>
						<view class="flex-1">
							<text class="font-sm font-weight d-block mb-1">暂不满意，需要调整</text>
							<text class="font-sm text-light-muted">可结合退款流程或向平台反馈改进建议</text>
						</view>
					</view>
				</card>

				<!-- 提示信息 -->
				<card headTitle="评价说明" class="mt-3">
					<text class="font-sm d-block mb-1">评价将展示给老师和其他家长</text>
					<text class="font-sm text-light-muted">我们会保护您的隐私，昵称与头像仅展示默认信息</text>
				</card>
			</view>
		</scroll-view>

		<!-- 底部操作栏 -->
		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<button 
				class="main-bg-color text-white rounded px-4 py-2 font-md font-weight w-100" 
				:disabled="isSubmitting" 
				@click="submitReview"
			>
				{{ isSubmitting ? '提交中...' : '提交评价' }}
			</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { mockTeachers, mockAppointments, useMockData } from '@/utils/mockData.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

export default {
	name: 'ReviewCreate',
	components: {
		card
	},
		data() {
			return {
				// 默认头像URL（从CDN）
				defaultAvatarUrl: getDefaultAvatarUrl(),
			appointmentId: '',
			teacherInfo: {
				name: '教师',
				avatar: '',
				subjectText: '科目待确认',
				experience: ''
			},
			isTrial: false,
			formData: {
				rating: 5,
				tags: [],
				content: '',
				is_satisfied: null
			},
			tagOptions: ['讲解清晰', '耐心负责', '课堂有趣', '反馈及时', '备课充分', '专业度高', '善于引导', '课堂纪律好'],
			ratingTips: ['很不满意', '不太满意', '一般般', '比较满意', '非常满意'],
			textareaPlaceholder: '可以从课堂氛围、讲解质量、作业反馈等方面分享您的真实体验～',
			maxContentLength: 500,
			useMock: false,
			isLoading: true,
			isSubmitting: false,
			isRefreshing: false,
			scrollTop: 0,
			canRefresh: true
		}
	},
	onLoad(options) {
		this.appointmentId = options.appointmentId || ''
		this.useMock = useMockData() === true
		if (!this.appointmentId && !this.useMock) {
			uni.showToast({ title: '缺少预约信息', icon: 'none' })
			setTimeout(() => uni.navigateBack(), 1500)
			return
		}
		this.loadData()
	},
	methods: {
		async loadData() {
			this.isLoading = true
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const mockApt = mockAppointments.find(item => item._id === this.appointmentId) || mockAppointments[0]
					const mockTeacher = mockTeachers.find(item => item._id === mockApt.teacher_id) || mockTeachers[0]
					this.isTrial = mockApt.course_type === 'trial'
					this.teacherInfo = {
						name: mockTeacher.name,
						avatar: mockTeacher.avatar,
						subjectText: (mockApt.subjects || mockTeacher.subjects || ['学科']).join(' / '),
						experience: mockTeacher.experience || '经验丰富'
					}
					return
				}

				const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
				const appointmentRes = await appointmentQuery.getAppointmentDetail({ appointment_id: this.appointmentId })
				if (appointmentRes.code !== 0 || !appointmentRes.data) {
					throw new Error(appointmentRes.message || '获取预约信息失败')
				}
				const appointment = appointmentRes.data
				this.isTrial = appointment.course_type === 'trial'
				const subjects = appointment.teacher_info?.subjects || appointment.subjects || appointment.subject
				const subjectText = Array.isArray(subjects)
					? subjects.join(' / ')
					: (subjects || '科目待确认')

				this.teacherInfo = {
					id: appointment.teacher_id,
					name: appointment.teacher_info?.display_name
						|| appointment.teacher_info?.name
						|| appointment.teacher_name
						|| '教师',
					avatar: appointment.teacher_info?.avatar || '',
					subjectText,
					experience: appointment.teacher_info?.teaching_experience
						? `${appointment.teacher_info.teaching_experience}年教龄`
						: ''
				}

				if (!this.teacherInfo.avatar && appointment.teacher_id) {
					const teacherListObj = uniCloud.importObject('teacher-list', { customUI: true })
					const teacherRes = await teacherListObj.getDetail({ teacherId: appointment.teacher_id })
					if (teacherRes.code === 0 && teacherRes.data) {
						this.teacherInfo.avatar = teacherRes.data.avatar || this.teacherInfo.avatar
						if (teacherRes.data.subjects && teacherRes.data.subjects.length > 0) {
							this.teacherInfo.subjectText = teacherRes.data.subjects.join(' / ')
						}
						if (teacherRes.data.teaching_experience) {
							this.teacherInfo.experience = `${teacherRes.data.teaching_experience}年教龄`
						}
					}
				}
			} catch (error) {
				console.error('加载评价页面失败:', error)
				uni.showToast({ title: error.message || '加载失败', icon: 'none' })
			} finally {
				this.isLoading = false
				this.isRefreshing = false
			}
		},
		handleScroll(e) {
			this.scrollTop = e.detail.scrollTop
			this.canRefresh = e.detail.scrollTop <= 10
		},
		handleScrollToUpper() {
			this.scrollTop = 0
			this.canRefresh = true
		},
		onRefresh() {
			if (!this.canRefresh || this.scrollTop > 10) {
				this.isRefreshing = false
				return
			}
			if (this.isRefreshing) return
			this.isRefreshing = true
			this.loadData()
		},
		setRating(value) {
			this.formData.rating = value
		},
		toggleTag(tag) {
			const tags = this.formData.tags.slice()
			const index = tags.indexOf(tag)
			if (index > -1) {
				tags.splice(index, 1)
			} else {
				if (tags.length >= 4) {
					tags.shift()
				}
				tags.push(tag)
			}
			this.formData.tags = tags
		},
		selectResult(isSatisfied) {
			this.formData.is_satisfied = isSatisfied
		},
		validateForm() {
			if (!this.formData.rating || this.formData.rating < 1) {
				uni.showToast({ title: '请为本次课程打分', icon: 'none' })
				return false
			}
			const content = this.formData.content.trim()
			if (!content || content.length < 10) {
				uni.showToast({ title: '评价内容不少于10个字', icon: 'none' })
				return false
			}
			if (this.isTrial && this.formData.is_satisfied === null) {
				uni.showToast({ title: '请选择试课结果', icon: 'none' })
				return false
			}
			return true
		},
		async submitReview() {
			if (this.isSubmitting) return
			if (!this.validateForm()) return

			if (this.useMock) {
				uni.showToast({ title: '评价提交成功', icon: 'success' })
				setTimeout(() => uni.navigateBack(), 1200)
				return
			}

			try {
				this.isSubmitting = true
				const reviewObj = uniCloud.importObject('teacher-review', { customUI: true })
				const payload = {
					appointment_id: this.appointmentId,
					rating: this.formData.rating,
					tags: this.formData.tags,
					content: this.formData.content.trim(),
					is_satisfied: this.isTrial ? this.formData.is_satisfied : null
				}
				const res = await reviewObj.submit(payload)
				if (res.code === 0) {
					uni.showToast({ title: '评价提交成功', icon: 'success' })
					setTimeout(() => {
						uni.navigateBack()
					}, 1000)
				} else {
					throw new Error(res.message || '提交评价失败')
				}
			} catch (error) {
				console.error('提交评价失败:', error)
				uni.showToast({ title: error.message || '提交失败', icon: 'none' })
			} finally {
				this.isSubmitting = false
			}
		}
	}
}
</script>

<style scoped>
.scroll {
	flex: 1;
	height: calc(100vh - 500rpx);
	padding-bottom: 160rpx;
}
</style>