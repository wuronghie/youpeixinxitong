<!-- 家长端：简化个人信息。完整资料走完善资料。云对象 user-profile.updateUserProfile -->
<template>
	<view class="page">
		<scroll-view scroll-y class="scroll">
			<text class="form-tip">简化资料页。完整资料请走「完善资料」。</text>

			<view class="form-card">
				<view class="form-row" @click="chooseAvatar">
					<text class="form-label">头像</text>
					<view class="avatar-side">
						<image class="avatar" :src="formData.avatar || defaultAvatarUrl" mode="aspectFill" />
						<text class="form-em">点击更换</text>
					</view>
				</view>
				<view class="form-row">
					<text class="form-label">昵称</text>
					<input
						class="form-input"
						v-model="formData.nickname"
						placeholder="请输入昵称"
						placeholder-class="ph"
					/>
				</view>
				<view class="form-row">
					<text class="form-label">手机号</text>
					<input
						class="form-input"
						v-model="formData.phone"
						placeholder="请输入手机号"
						type="number"
						placeholder-class="ph"
					/>
				</view>
				<view class="form-row" :class="{ last: userInfo.role !== 'parent' }">
					<text class="form-label">性别</text>
					<view class="chip-row">
						<text class="chip" :class="{ on: formData.gender === 'male' }" @click="formData.gender = 'male'">男</text>
						<text class="chip" :class="{ on: formData.gender === 'female' }" @click="formData.gender = 'female'">女</text>
					</view>
				</view>
				<template v-if="userInfo.role === 'parent'">
					<view class="form-row">
						<text class="form-label">学生姓名</text>
						<input
							class="form-input"
							v-model="formData.student_name"
							placeholder="请输入学生姓名"
							placeholder-class="ph"
						/>
					</view>
					<picker mode="selector" :range="gradeOptions" @change="onGradeChange">
						<view class="form-row last">
							<text class="form-label">年级</text>
							<text class="form-em" :class="{ filled: !!formData.student_grade }">{{ formData.student_grade || '请选择' }}</text>
						</view>
					</picker>
				</template>
			</view>

			<view class="scroll-spacer"></view>
		</scroll-view>

		<view class="action-bar">
			<button class="save-btn" @click="saveProfile">保存</button>
		</view>
	</view>
</template>

<script>
import { mockUserInfo, useMockData } from '@/utils/mockData.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'

export default {
	name: 'UserProfile',
	data() {
		return {
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
.page {
	min-height: 100vh;
	background: #F4F6F9;
}

.scroll {
	height: calc(100vh - 132rpx);
}

.form-tip {
	display: block;
	padding: 20rpx 32rpx 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.form-card {
	margin: 0 32rpx 24rpx;
	padding: 8rpx 32rpx 16rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.form-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	min-height: 96rpx;
	padding: 16rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.form-row.last {
	border-bottom: none;
}

.form-label {
	flex-shrink: 0;
	font-size: 28rpx;
	color: #5C6370;
}

.form-input {
	flex: 1;
	min-width: 0;
	text-align: right;
	font-size: 28rpx;
	color: #1F2329;
}

.form-em {
	font-size: 28rpx;
	color: #8B919C;
	text-align: right;
}

.form-em.filled {
	color: #1F2329;
}

.ph {
	color: #C5C8CE;
}

.avatar-side {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.avatar {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background: #EEF3FF;
}

.chip-row {
	display: flex;
	gap: 12rpx;
}

.chip {
	height: 56rpx;
	padding: 0 24rpx;
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
</style>
