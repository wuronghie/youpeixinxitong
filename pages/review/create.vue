<template>
	<view class="page">
		<view class="hero-card">
			<image
				class="hero-avatar"
				:src="teacherInfo.avatar || defaultAvatarUrl"
				mode="aspectFill"
			/>
			<text class="hero-name">{{ teacherInfo.name || '教师' }}老师</text>
			<text class="hero-meta">{{ teacherMeta }}</text>
		</view>

		<view v-if="isTrial" class="section-card">
			<text class="section-title">确认试课结果</text>
			<text class="section-sub">请选择本次试课是否成功，提交后将同步完成结算并写入评价。</text>
			<view class="choice">
				<view
					class="choice-item"
					:class="{ on: formData.is_satisfied === true }"
					@click="selectResult(true)"
				>
					<text class="choice-title">试课成功</text>
					<text class="choice-sub">后续可预约正式课</text>
				</view>
				<view
					class="choice-item"
					:class="{ on: formData.is_satisfied === false }"
					@click="selectResult(false)"
				>
					<text class="choice-title">试课不满意</text>
					<text class="choice-sub">可说明原因</text>
				</view>
			</view>
			<textarea
				v-if="formData.is_satisfied === false"
				class="intro-input"
				v-model="formData.fail_reason"
				maxlength="200"
				placeholder="（可选）告诉我们不满意的原因，平台仅作为质量改进参考"
				:show-confirm-bar="false"
				:cursor-spacing="24"
				placeholder-class="ph"
			/>
		</view>

		<view class="section-card center">
			<text class="section-title">课程满意度</text>
			<text class="section-sub">{{ ratingTips[formData.rating - 1] }}</text>
			<view class="stars">
				<text
					v-for="i in 5"
					:key="i"
					class="star"
					:class="{ on: i <= formData.rating }"
					@click="setRating(i)"
				>★</text>
			</view>
		</view>

		<view class="chips-wrap">
			<text
				v-for="tag in tagOptions"
				:key="tag"
				class="chip"
				:class="{ on: formData.tags.includes(tag) }"
				@click="toggleTag(tag)"
			>{{ tag }}</text>
		</view>

		<view class="section-card">
			<text class="section-title">详细评价（选填，最多500字）</text>
			<textarea
				class="intro-input"
				v-model="formData.content"
				:maxlength="maxContentLength"
				:placeholder="textareaPlaceholder"
				:show-confirm-bar="false"
				:cursor-spacing="24"
				placeholder-class="ph"
			/>
			<text class="count">{{ formData.content.length }}/{{ maxContentLength }}</text>
		</view>

		<text class="form-tip">文字评价可不填，只打星也能提交。提交后即确认上课结果，不可再申请退款。教师下课打卡后 24 小时未评价将默认好评。</text>

		<view class="scroll-spacer"></view>

		<view class="action-bar">
			<button
				class="save-btn"
				:disabled="isSubmitting || !canSubmit"
				@click="submit"
			>
				{{ submitText }}
			</button>
		</view>
	</view>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { mockTeachers, mockAppointments, useMockData } from '@/utils/mockData.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

const defaultAvatarUrl = getDefaultAvatarUrl()
const tagOptions = ['讲解清晰', '耐心负责', '课堂有趣', '反馈及时', '备课充分', '专业度高', '善于引导', '课堂纪律好']
const ratingTips = ['很不满意', '不太满意', '一般般', '比较满意', '非常满意']
const textareaPlaceholder = '选填。也可以只打星提交，或从课堂氛围、讲解质量等方面分享体验'
const maxContentLength = 500

const appointmentId = ref('')
const confirmAppointmentId = ref('')
const routeCourseType = ref('')
const useMock = ref(false)
const isTrial = ref(false)
const isLoading = ref(true)
const isSubmitting = ref(false)

const teacherInfo = reactive({
  id: '',
  name: '教师',
  avatar: '',
  subjectText: '科目待确认',
  experience: ''
})

const formData = reactive({
  rating: 5,
  tags: [],
  content: '',
  is_satisfied: null,
  fail_reason: ''
})

const canSubmit = computed(() => {
  if (formData.rating < 1) return false
  if (isTrial.value && formData.is_satisfied === null) return false
  return true
})

const teacherMeta = computed(() => {
  const parts = [teacherInfo.subjectText]
  if (isTrial.value) parts.push('试课')
  else if (teacherInfo.experience) parts.push(teacherInfo.experience)
  return parts.filter(Boolean).join(' · ')
})

const submitText = computed(() => {
  if (isSubmitting.value) return '提交中...'
  if (!isTrial.value) return '提交评价'
  return formData.is_satisfied === false ? '提交不满意结果与评价' : '确认完成并提交评价'
})

onLoad((options) => {
  appointmentId.value = (options && options.appointmentId) || ''
  routeCourseType.value = (options && options.courseType) || ''
  if (routeCourseType.value === 'trial') {
    isTrial.value = true
  }
  useMock.value = useMockData() === true
  if (!appointmentId.value && !useMock.value) {
    uni.showToast({ title: '缺少预约信息', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
    return
  }
  // 延后拉数，先让页面完成路由挂载，降低 navigateTo timeout 概率
  setTimeout(() => {
    loadData()
  }, 0)
})

onMounted(() => {})

async function loadData() {
  isLoading.value = true
  try {
    if (useMock.value) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const mockApt = mockAppointments.find((item) => item._id === appointmentId.value) || mockAppointments[0]
      const mockTeacher = mockTeachers.find((item) => item._id === mockApt.teacher_id) || mockTeachers[0]
      isTrial.value = routeCourseType.value === 'trial' || mockApt.course_type === 'trial'
      teacherInfo.name = mockTeacher.name
      teacherInfo.avatar = mockTeacher.avatar
      teacherInfo.subjectText = (mockApt.subjects || mockTeacher.subjects || ['学科']).join(' / ')
      teacherInfo.experience = mockTeacher.experience || '经验丰富'
      return
    }

    const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
    const appointmentRes = await appointmentQuery.getAppointmentDetail({ appointment_id: appointmentId.value })
    if (appointmentRes.code !== 0 || !appointmentRes.data) {
      throw new Error(appointmentRes.message || '获取预约信息失败')
    }
    const appointment = appointmentRes.data
    appointmentId.value = appointment._id || appointmentId.value
    confirmAppointmentId.value = appointment._id || appointmentId.value
    isTrial.value = routeCourseType.value === 'trial' || appointment.course_type === 'trial'
    const subjects = (appointment.teacher_info && appointment.teacher_info.subjects) || appointment.subjects || appointment.subject
    const subjectText = Array.isArray(subjects) ? subjects.join(' / ') : (subjects || '科目待确认')

    teacherInfo.id = appointment.teacher_id
    teacherInfo.name = (appointment.teacher_info && (appointment.teacher_info.display_name || appointment.teacher_info.name)) || appointment.teacher_name || '教师'
    teacherInfo.avatar = (appointment.teacher_info && appointment.teacher_info.avatar) || ''
    teacherInfo.subjectText = subjectText
    teacherInfo.experience = appointment.teacher_info && appointment.teacher_info.teaching_experience
      ? `${appointment.teacher_info.teaching_experience}年教龄`
      : ''

    if (!teacherInfo.avatar && appointment.teacher_id) {
      try {
        const teacherListObj = uniCloud.importObject('teacher-list', { customUI: true })
        const teacherRes = await teacherListObj.getDetail({ teacherId: appointment.teacher_id })
        if (teacherRes.code === 0 && teacherRes.data) {
          teacherInfo.avatar = teacherRes.data.avatar || teacherInfo.avatar
          if (teacherRes.data.subjects && teacherRes.data.subjects.length > 0) {
            teacherInfo.subjectText = teacherRes.data.subjects.join(' / ')
          }
          if (teacherRes.data.teaching_experience) {
            teacherInfo.experience = `${teacherRes.data.teaching_experience}年教龄`
          }
        }
      } catch (e) {
        // 仅做兜底，加载失败不阻断
      }
    }
  } catch (e) {
    console.error('加载评价页面失败:', e)
    uni.showToast({ title: e.message || '加载失败', icon: 'none' })
  } finally {
    isLoading.value = false
  }
}

function setRating(v) {
  formData.rating = v
}

function toggleTag(tag) {
  const idx = formData.tags.indexOf(tag)
  if (idx > -1) {
    formData.tags.splice(idx, 1)
    return
  }
  if (formData.tags.length >= 4) formData.tags.shift()
  formData.tags.push(tag)
}

function selectResult(v) {
  formData.is_satisfied = v
}

function validate() {
  if (formData.rating < 1) {
    uni.showToast({ title: '请为本次课程打分', icon: 'none' })
    return false
  }
  if (isTrial.value && formData.is_satisfied === null) {
    uni.showToast({ title: '请选择试课结果', icon: 'none' })
    return false
  }
  return true
}

async function submit() {
  if (isSubmitting.value) return
  if (!validate()) return

  if (useMock.value) {
    uni.showToast({ title: '评价提交成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
    return
  }

  isSubmitting.value = true
  try {
    // Step 1：确认结果（结算）
    //   - 试课：根据 is_satisfied 决定调用成功/失败结算
    //   - 正式课：直接 confirmCompletion 结算（is_satisfied 默认 true）
    const appointmentQuery = uniCloud.importObject('appointment-query', { customUI: true })
    const actionId = confirmAppointmentId.value || appointmentId.value
    const confirmPayload = isTrial.value
      ? { appointment_id: actionId, is_satisfied: !!formData.is_satisfied, fail_reason: formData.fail_reason || '' }
      : { appointment_id: actionId, is_satisfied: true }

    const confirmRes = await appointmentQuery.confirmCompletion(confirmPayload)
    // 重复确认（已 completed）也视为成功，继续提交评价
    const alreadyCompleted = confirmRes && confirmRes.message && /已完成|已结算/.test(confirmRes.message)
    if (!confirmRes || (confirmRes.code !== 0 && !alreadyCompleted)) {
      throw new Error((confirmRes && confirmRes.message) || '确认结果失败')
    }

    // Step 2：提交评价
    const reviewObj = uniCloud.importObject('teacher-review', { customUI: true })
    const reviewRes = await reviewObj.submit({
      appointment_id: actionId,
      rating: formData.rating,
      tags: formData.tags,
      content: formData.content.trim(),
      is_satisfied: isTrial.value ? formData.is_satisfied : null
    })
    if (!reviewRes || reviewRes.code !== 0) {
      throw new Error((reviewRes && reviewRes.message) || '提交评价失败')
    }

    uni.showToast({ title: '已提交并完成确认', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e) {
    console.error('[review.submit] 失败:', e)
    uni.showToast({ title: e.message || '提交失败', icon: 'none' })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F4F6F9;
	padding: 24rpx 0 calc(148rpx + env(safe-area-inset-bottom));
}

.hero-card,
.section-card {
	margin: 0 32rpx 24rpx;
	padding: 28rpx 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.hero-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.hero-avatar {
	width: 112rpx;
	height: 112rpx;
	border-radius: 50%;
	background: #EEF3FF;
	margin-bottom: 16rpx;
}

.hero-name {
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
}

.hero-meta {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.section-sub {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.section-card.center {
	text-align: center;
}

.choice {
	display: flex;
	gap: 16rpx;
	margin-top: 20rpx;
}

.choice-item {
	flex: 1;
	min-height: 128rpx;
	padding: 20rpx 16rpx;
	border: 2rpx solid #EBEDF0;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-sizing: border-box;
}

.choice-item.on {
	border-color: #2563EB;
	background: #EEF3FF;
}

.choice-title {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: #1F2329;
}

.choice-sub {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8B919C;
}

.intro-input {
	width: 100%;
	min-height: 160rpx;
	margin-top: 16rpx;
	padding: 20rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	font-size: 26rpx;
	color: #1F2329;
	line-height: 1.6;
	box-sizing: border-box;
}

.ph {
	color: #C5C8CE;
}

.count {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8B919C;
	text-align: right;
}

.stars {
	display: flex;
	justify-content: center;
	gap: 16rpx;
	margin-top: 20rpx;
}

.star {
	min-width: 88rpx;
	min-height: 88rpx;
	font-size: 56rpx;
	color: #EBEDF0;
	line-height: 88rpx;
	text-align: center;
}

.star.on {
	color: #F59E0B;
}

.chips-wrap {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	padding: 0 32rpx 24rpx;
}

.chip {
	height: 56rpx;
	padding: 0 20rpx;
	border-radius: 12rpx;
	background: #F1F2F4;
	color: #5C6370;
	font-size: 24rpx;
	line-height: 56rpx;
}

.chip.on {
	background: #EEF3FF;
	color: #2563EB;
	font-weight: 600;
}

.form-tip {
	display: block;
	padding: 0 32rpx 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.scroll-spacer {
	height: 24rpx;
}

.action-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 20;
	padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
	background: #FFFFFF;
	border-top: 1rpx solid #EBEDF0;
}

.save-btn {
	width: 100%;
	height: 88rpx;
	margin: 0;
	padding: 0;
	border: none;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 32rpx;
	font-weight: 600;
	line-height: 88rpx;
}

.save-btn::after {
	border: none;
}

.save-btn[disabled] {
	opacity: 0.55;
}
</style>
