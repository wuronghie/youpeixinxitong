<template>
  <view class="review-page">
    <!-- 教师信息头部 -->
    <view class="review-page__hero">
      <image
        class="review-page__avatar"
        :src="teacherInfo.avatar || defaultAvatarUrl"
        mode="aspectFill"
      />
      <view class="review-page__hero-meta">
        <text class="review-page__hero-name">{{ teacherInfo.name || '教师' }}</text>
        <text class="review-page__hero-sub">
          {{ teacherInfo.subjectText }}
          <text v-if="teacherInfo.experience"> · {{ teacherInfo.experience }}</text>
        </text>
      </view>
    </view>

    <scroll-view scroll-y class="review-page__scroll">
      <view class="review-page__body">
        <!-- 试课结果（一步合并：必须先选） -->
        <view v-if="isTrial" class="review-card">
          <view class="review-card__header">
            <text class="review-card__title">确认试课结果</text>
            <text class="review-card__subtitle">请选择本次试课是否成功，提交后将同步完成结算 + 写入评价</text>
          </view>
          <view
            class="result-option"
            :class="{ 'is-active': formData.is_satisfied === true }"
            @click="selectResult(true)"
          >
            <text class="result-option__emoji">😊</text>
            <view class="result-option__body">
              <text class="result-option__title">试课成功</text>
              <text class="result-option__desc">满意老师授课，确认本次试课成功，可继续预约正式课</text>
            </view>
          </view>
          <view
            class="result-option"
            :class="{ 'is-active': formData.is_satisfied === false }"
            @click="selectResult(false)"
          >
            <text class="result-option__emoji">🤔</text>
            <view class="result-option__body">
              <text class="result-option__title">试课不满意</text>
              <text class="result-option__desc">确认本次试课不成功；不影响 70/30 结算，如老师爽约等异常请走退款申请</text>
            </view>
          </view>
          <view v-if="formData.is_satisfied === false" class="result-reason">
            <textarea
              class="result-reason__input"
              v-model="formData.fail_reason"
              maxlength="200"
              placeholder="（可选）告诉我们不满意的原因，平台仅作为质量改进参考"
            />
          </view>
        </view>

        <!-- 课程满意度 -->
        <view class="review-card">
          <view class="review-card__header">
            <text class="review-card__title">课程满意度</text>
            <text class="review-card__subtitle">{{ ratingTips[formData.rating - 1] }}</text>
          </view>
          <view class="rating-row">
            <view
              v-for="i in 5"
              :key="i"
              class="rating-cell"
              :class="{ 'is-active': i <= formData.rating }"
              @click="setRating(i)"
            >
              <text class="rating-cell__star">★</text>
            </view>
          </view>
        </view>

        <!-- 标签 -->
        <view class="review-card">
          <view class="review-card__header">
            <text class="review-card__title">老师最值得点赞的地方</text>
            <text class="review-card__subtitle">可多选，最多 4 项</text>
          </view>
          <view class="tag-wrap">
            <view
              v-for="tag in tagOptions"
              :key="tag"
              class="tag-chip"
              :class="{ 'is-active': formData.tags.includes(tag) }"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </view>
          </view>
        </view>

        <!-- 详细评价 -->
        <view class="review-card">
          <view class="review-card__header">
            <text class="review-card__title">详细评价</text>
            <text class="review-card__subtitle">至少 10 个字，帮助其他家长更好了解老师</text>
          </view>
          <textarea
            class="review-textarea"
            v-model="formData.content"
            :maxlength="maxContentLength"
            :placeholder="textareaPlaceholder"
            placeholder-class="review-textarea__placeholder"
          />
          <view class="review-textarea__counter">
            {{ formData.content.length }}/{{ maxContentLength }}
          </view>
        </view>

        <view class="review-tips">
          <text class="review-tips__line">提交时会先调用「确认结果」接口完成结算（70/30 + 信息费处理），再写入评价；任一步骤失败都会回滚提示。</text>
          <text class="review-tips__line">评价将展示给老师和其他家长，我们会保护您的隐私。</text>
        </view>
      </view>
    </scroll-view>

    <view class="review-page__footer">
      <button
        class="review-page__submit"
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
const textareaPlaceholder = '可以从课堂氛围、讲解质量、作业反馈等方面分享您的真实体验～'
const maxContentLength = 500

const appointmentId = ref('')
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
  if (formData.content.trim().length < 10) return false
  if (isTrial.value && formData.is_satisfied === null) return false
  return true
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
  loadData()
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
  const content = formData.content.trim()
  if (content.length < 10) {
    uni.showToast({ title: '评价内容不少于 10 个字', icon: 'none' })
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
    const confirmPayload = isTrial.value
      ? { appointment_id: appointmentId.value, is_satisfied: !!formData.is_satisfied, fail_reason: formData.fail_reason || '' }
      : { appointment_id: appointmentId.value, is_satisfied: true }

    const confirmRes = await appointmentQuery.confirmCompletion(confirmPayload)
    // 重复确认（已 completed）也视为成功，继续提交评价
    const alreadyCompleted = confirmRes && confirmRes.message && /已完成|已结算/.test(confirmRes.message)
    if (!confirmRes || (confirmRes.code !== 0 && !alreadyCompleted)) {
      throw new Error((confirmRes && confirmRes.message) || '确认结果失败')
    }

    // Step 2：提交评价
    const reviewObj = uniCloud.importObject('teacher-review', { customUI: true })
    const reviewRes = await reviewObj.submit({
      appointment_id: appointmentId.value,
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

<style>
.review-page {
  min-height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.review-page__hero {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  padding: 32rpx 32rpx 40rpx;
  display: flex;
  align-items: center;
}

.review-page__avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
  background: #fff;
}

.review-page__hero-meta {
  margin-left: 24rpx;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.review-page__hero-name {
  font-size: 34rpx;
  font-weight: 600;
}

.review-page__hero-sub {
  font-size: 24rpx;
  margin-top: 6rpx;
  opacity: 0.85;
}

.review-page__scroll {
  flex: 1;
  height: 0;
}

.review-page__body {
  padding: 24rpx 24rpx 200rpx;
}

.review-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(15, 23, 42, 0.04);
}

.review-card__header {
  margin-bottom: 16rpx;
  display: flex;
  flex-direction: column;
}

.review-card__title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.review-card__subtitle {
  font-size: 24rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.result-option {
  display: flex;
  align-items: center;
  padding: 20rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
  background: #f9fafb;
  transition: border-color 0.15s;
}

.result-option.is-active {
  border-color: #2563eb;
  background: #eff6ff;
}

.result-option__emoji {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.result-option__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.result-option__title {
  font-size: 28rpx;
  font-weight: 500;
  color: #111827;
}

.result-option__desc {
  font-size: 22rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.result-reason {
  margin-top: 12rpx;
}

.result-reason__input {
  width: 100%;
  min-height: 120rpx;
  background: #f9fafb;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.rating-row {
  display: flex;
  gap: 16rpx;
}

.rating-cell {
  flex: 1;
  height: 96rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  transition: all 0.15s;
}

.rating-cell.is-active {
  background: #fde68a;
  color: #b45309;
}

.rating-cell__star {
  font-size: 40rpx;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.tag-chip {
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #374151;
  font-size: 24rpx;
}

.tag-chip.is-active {
  background: #2563eb;
  color: #fff;
}

.review-textarea {
  width: 100%;
  min-height: 220rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 26rpx;
  box-sizing: border-box;
  background: #f9fafb;
}

.review-textarea__placeholder {
  color: #9ca3af;
}

.review-textarea__counter {
  text-align: right;
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 8rpx;
}

.review-tips {
  background: #fff7ed;
  border: 2rpx dashed #fdba74;
  border-radius: 12rpx;
  padding: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.review-tips__line {
  font-size: 22rpx;
  color: #9a3412;
}

.review-page__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 24rpx;
  background: #fff;
  border-top: 2rpx solid #e5e7eb;
  z-index: 100;
}

.review-page__submit {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  background: #2563eb;
  color: #fff;
  font-size: 30rpx;
  font-weight: 500;
  border: none;
}

.review-page__submit[disabled] {
  background: #93c5fd;
  color: #fff;
}
</style>
