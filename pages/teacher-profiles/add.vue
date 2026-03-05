<template>
	<view style="background: #F5F5F5;">
		<!-- 头部 -->
		<view class="main-bg-color py-4 px-3">
			<view class="d-flex flex-column text-white">
				<text class="font-lg font-weight mb-1">新增教师档案</text>
				<text class="font-sm" style="opacity: 0.85;">填写教师基本信息</text>
			</view>
		</view>

		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<card headTitle="基本信息" class="mb-3">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">教师用户ID<text class="text-danger">*</text></text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model="formData.teacher_id"
							placeholder="请输入教师用户ID"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">显示名称<text class="text-danger">*</text></text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model="formData.display_name"
							placeholder="请输入教师显示名称"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2">
						<text class="font-sm">头像URL</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model="formData.avatar"
							placeholder="请输入头像URL"
							placeholder-class="text-light-muted"
						/>
					</view>
				</card>

				<card headTitle="教学信息" class="mb-3">
					<view class="py-2 border-bottom">
						<text class="font-sm d-block mb-2">教学科目</text>
						<view class="d-flex flex-wrap">
							<view
								v-for="item in subjectOptions"
								:key="item"
								class="rounded px-3 py-2 font-sm mr-2 mb-2"
								:class="formData.subjects.includes(item) ? 'main-bg-color text-white' : 'bg-light-secondary'"
								@click="toggleSubject(item)"
							>
								{{ item }}
							</view>
						</view>
					</view>
					<view class="py-2 border-bottom">
						<text class="font-sm d-block mb-2">适合年级</text>
						<view class="d-flex flex-wrap">
							<view
								v-for="item in gradeOptions"
								:key="item"
								class="rounded px-3 py-2 font-sm mr-2 mb-2"
								:class="formData.grades.includes(item) ? 'main-bg-color text-white' : 'bg-light-secondary'"
								@click="toggleGrade(item)"
							>
								{{ item }}
							</view>
						</view>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">课时费</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model="formData.hourly_rate"
							type="number"
							placeholder="请输入课时费"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2">
						<text class="font-sm">教学区域</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model="formData.teaching_areas"
							placeholder="请输入教学区域"
							placeholder-class="text-light-muted"
						/>
					</view>
				</card>

				<card headTitle="其他信息" class="mb-3">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">评分</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model="formData.rating"
							type="number"
							placeholder="请输入评分"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">评价数量</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model="formData.review_count"
							type="number"
							placeholder="请输入评价数量"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">总课程数</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model="formData.total_courses"
							type="number"
							placeholder="请输入总课程数"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">总学生数</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model="formData.total_students"
							type="number"
							placeholder="请输入总学生数"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="py-2 border-bottom">
						<text class="font-sm d-block mb-2">个人介绍</text>
						<textarea
							class="w-100 bg-light-secondary rounded px-3 py-2 font-sm"
							v-model="formData.introduction"
							placeholder="请输入教师个人介绍"
							placeholder-class="text-light-muted"
							style="min-height: 120rpx;"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">是否已认证</text>
						<switch :checked="formData.is_verified" @change="formData.is_verified = $event.detail.value" />
					</view>
					<view class="d-flex a-center j-sb py-2">
						<text class="font-sm">是否接受预约</text>
						<switch :checked="formData.available" @change="formData.available = $event.detail.value" />
					</view>
				</card>
			</view>
		</scroll-view>

		<!-- 提交按钮 -->
		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<button 
				class="main-bg-color text-white rounded px-4 py-2 font-md font-weight w-100" 
				@click="submit"
			>
				提交
			</button>
      </view>
  </view>
</template>

<script>
import card from '@/components/common/card.vue'
import { validator } from '../../js_sdk/validator/teacher-profiles.js'

const dbCollectionName = 'teacher-profiles'

  export default {
	components: {
		card
	},
    data() {
      let formData = {
        "teacher_id": "",
        "display_name": "",
        "avatar": "",
        "subjects": [],
        "grades": [],
        "hourly_rate": null,
        "rating": 5,
        "review_count": 0,
        "introduction": "",
        "teaching_areas": [],
        "is_verified": false,
        "available": true,
        "total_courses": 0,
        "total_students": 0
      }
      return {
        formData,
			subjectOptions: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他'],
			gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三']
		}
	},
	methods: {
		toggleSubject(item) {
			const index = this.formData.subjects.indexOf(item)
			if (index > -1) {
				this.formData.subjects.splice(index, 1)
			} else {
				this.formData.subjects.push(item)
			}
		},
		toggleGrade(item) {
			const index = this.formData.grades.indexOf(item)
			if (index > -1) {
				this.formData.grades.splice(index, 1)
			} else {
				this.formData.grades.push(item)
			}
		},
		validateForm() {
			if (!this.formData.teacher_id) {
				uni.showToast({ title: '请输入教师用户ID', icon: 'none' })
				return false
			}
			if (!this.formData.display_name) {
				uni.showToast({ title: '请输入显示名称', icon: 'none' })
				return false
			}
			return true
		},
      submit() {
			if (!this.validateForm()) return
			const db = uniCloud.database()
			db.collection(dbCollectionName).add(this.formData).then((res) => {
				uni.showToast({ title: '新增成功' })
          this.getOpenerEventChannel().emit('refreshData')
          setTimeout(() => uni.navigateBack(), 500)
        }).catch((err) => {
          uni.showModal({
            content: err.message || '请求服务失败',
            showCancel: false
          })
			})
      }
    }
  }
</script>

<style scoped>
.scroll {
	flex: 1;
	height: calc(100vh - 300rpx);
	padding-bottom: 160rpx;
}
</style>