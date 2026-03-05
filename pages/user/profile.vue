<template>
	<view style="background: #F5F5F5;">
		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 头像 -->
				<card headTitle="头像">
					<view class="d-flex flex-column a-center py-3" @click="chooseAvatar">
						<image 
							class="rounded-circle mb-2" 
							:src="formData.avatar || defaultAvatarUrl"
							mode="aspectFill"
							style="width: 160rpx;height: 160rpx;"
						/>
						<text class="main-text-color font-sm">点击更换</text>
					</view>
				</card>

				<!-- 基本信息 -->
				<card headTitle="基本信息" class="mt-3">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">昵称</text>
						<input 
							class="text-right font-sm flex-1 ml-3" 
							v-model="formData.nickname"
							placeholder="请输入昵称"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">手机号</text>
						<input 
							class="text-right font-sm flex-1 ml-3" 
							v-model="formData.phone"
							placeholder="请输入手机号"
							type="number"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2">
						<text class="font-sm">性别</text>
						<view class="d-flex a-center">
							<view 
								class="px-3 py-1 rounded mr-2 font-sm"
								:class="formData.gender === 'male' ? 'main-bg-color text-white' : 'bg-light-secondary'"
								@click="formData.gender = 'male'"
							>
								男
							</view>
							<view 
								class="px-3 py-1 rounded font-sm"
								:class="formData.gender === 'female' ? 'main-bg-color text-white' : 'bg-light-secondary'"
								@click="formData.gender = 'female'"
							>
								女
							</view>
						</view>
					</view>
				</card>

				<!-- 学生信息（家长） -->
				<card v-if="userInfo.role === 'parent'" headTitle="学生信息" class="mt-3">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">学生姓名</text>
						<input 
							class="text-right font-sm flex-1 ml-3" 
							v-model="formData.student_name"
							placeholder="请输入学生姓名"
							placeholder-class="text-light-muted"
						/>
					</view>
					<picker mode="selector" :range="gradeOptions" @change="onGradeChange">
						<view class="d-flex a-center j-sb py-2">
							<text class="font-sm">年级</text>
							<view class="d-flex a-center">
								<text class="font-sm" :class="formData.student_grade ? '' : 'text-light-muted'">
									{{ formData.student_grade || '请选择' }}
								</text>
								<text class="iconfont icon-you text-light-muted ml-2"></text>
							</view>
						</view>
					</picker>
				</card>
			</view>
		</scroll-view>

		<!-- 保存按钮 -->
		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<button 
				class="main-bg-color text-white rounded px-4 py-2 font-md font-weight w-100" 
				@click="saveProfile"
			>
				保存
			</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { mockUserInfo, useMockData } from '@/utils/mockData.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

export default {
	name: 'UserProfile',
	components: {
		card
	},
		data() {
			return {
				// 默认头像URL（从CDN）
				defaultAvatarUrl: getDefaultAvatarUrl(),
			userInfo: {},
			formData: {
				avatar: '',
				nickname: '',
				phone: '',
				gender: '',
				student_name: '',
				student_grade: ''
			},
			gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
			useMock: true
		}
	},
	onLoad() {
		this.useMock = useMockData() !== false
		this.loadUserInfo()
	},
	methods: {
		async loadUserInfo() {
			try {
				const stored = uni.getStorageSync('userInfo')
				this.userInfo = stored || mockUserInfo
				
				this.formData = {
					avatar: this.userInfo.avatar || '',
					nickname: this.userInfo.nickname || '',
					phone: this.userInfo.phone || '',
					gender: this.userInfo.gender || '',
					student_name: this.userInfo.student_name || this.userInfo.parent_info?.student_name || '',
					student_grade: this.userInfo.student_grade || this.userInfo.parent_info?.student_grade || ''
				}
			} catch (error) {
				console.error('加载失败:', error)
			}
		},
		chooseAvatar() {
			uni.chooseImage({
				count: 1,
				success: (res) => {
					this.formData.avatar = res.tempFilePaths[0]
				}
			})
		},
		onGradeChange(e) {
			this.formData.student_grade = this.gradeOptions[e.detail.value]
		},
		async saveProfile() {
			try {
				if (!this.useMock) {
					const userProfile = uniCloud.importObject('user-profile', { customUI: true })
					const res = await userProfile.updateUserProfile({
						avatar: this.formData.avatar,
						nickname: this.formData.nickname,
						phone: this.formData.phone,
						gender: this.formData.gender,
						parent_info: {
							student_name: this.formData.student_name,
							student_grade: this.formData.student_grade
						}
					})
					if (res.code !== 0) {
						throw new Error(res.message || '保存失败')
					}
				}
				
				uni.showToast({
					title: '保存成功',
					icon: 'success'
				})
				
				setTimeout(() => {
					uni.navigateBack()
				}, 1500)
			} catch (error) {
				console.error('保存失败:', error)
				uni.showToast({
					title: error.message || '保存失败',
					icon: 'none'
				})
			}
		}
	}
}
</script>

<style scoped>
.scroll {
	flex: 1;
	height: calc(100vh - 200rpx);
	padding-bottom: 160rpx;
}
</style>