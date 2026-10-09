<!-- 家长端：完善资料。云对象 user-profile.getUserProfile / updateParentProfile -->
<template>
	<view class="page">
		<scroll-view scroll-y class="scroll">
			<view class="hero-card" :class="{ muted: !canEdit }" @click="chooseAvatar">
				<image class="avatar" :src="formData.avatar || defaultAvatar" mode="aspectFill" />
				<view class="hero-main">
					<text class="hero-name">{{ heroName }}</text>
					<text class="hero-meta">{{ avatarUploading ? '上传中...' : '点击更换头像' }}</text>
				</view>
			</view>

			<view v-if="role !== 'parent'" class="warn-card">
				<text class="warn-title">当前账号不是家长角色，无法编辑家长资料。</text>
				<text class="warn-link" @click="goRolePage">前往教师资料</text>
			</view>

			<view class="form-card" :class="{ muted: !canEdit }">
				<view class="form-row last">
					<text class="form-label">手机号码 <text class="req">*</text></text>
					<view class="phone-side">
						<input
							class="form-input"
							v-model.trim="formData.phone"
							:disabled="!canEdit"
							type="number"
							maxlength="11"
							:placeholder="hasBoundPhone ? '' : '授权后自动填写'"
							placeholder-class="ph"
						/>
						<!-- #ifdef MP-WEIXIN -->
						<button
							v-if="canEdit && !hasBoundPhone"
							class="phone-btn"
							open-type="getPhoneNumber"
							:disabled="phoneBinding"
							@getphonenumber="onGetPhoneNumber"
						>授权填写</button>
						<!-- #endif -->
					</view>
				</view>
			</view>

			<view class="form-card" :class="{ muted: !canEdit }">
				<view class="form-row">
					<text class="form-label">学生姓名 <text class="req">*</text></text>
					<input
						class="form-input"
						v-model.trim="formData.student_name"
						:disabled="!canEdit"
						placeholder="请输入学生姓名"
						placeholder-class="ph"
					/>
				</view>
				<view class="form-row">
					<text class="form-label">孩子性别 <text class="req">*</text></text>
					<view class="chip-row">
						<text class="chip" :class="{ on: formData.student_gender === 'male' }" @click="selectStudentGender('male')">男</text>
						<text class="chip" :class="{ on: formData.student_gender === 'female' }" @click="selectStudentGender('female')">女</text>
					</view>
				</view>
				<picker mode="selector" :range="gradeOptions" :value="gradeIndex" @change="onGradeChange" :disabled="!canEdit">
					<view class="form-row">
						<text class="form-label">当前年级 <text class="req">*</text></text>
						<text class="form-em" :class="{ filled: !!formData.student_grade }">{{ formData.student_grade || '请选择' }}</text>
					</view>
				</picker>
				<view class="form-row">
					<text class="form-label">学生年龄</text>
					<input
						class="form-input"
						v-model.trim="formData.student_age"
						:disabled="!canEdit"
						type="number"
						placeholder="如：14"
						placeholder-class="ph"
					/>
				</view>
				<view class="form-row last">
					<text class="form-label">就读学校</text>
					<input
						class="form-input"
						v-model.trim="formData.school_name"
						:disabled="!canEdit"
						placeholder="请填写学校名称"
						placeholder-class="ph"
					/>
				</view>
				<view class="chip-block">
					<text class="chip-label">关注科目</text>
					<view class="chips-wrap">
						<text
							v-for="item in subjectOptions"
							:key="item"
							class="chip"
							:class="{ on: formData.student_subjects.includes(item) }"
							@click="toggleSubject(item)"
						>{{ item }}</text>
					</view>
				</view>
			</view>

			<view class="section-card" :class="{ muted: !canEdit }">
				<text class="section-title">学习目标</text>
				<view class="chips-wrap">
					<text
						v-for="item in goalOptions"
						:key="item"
						class="chip"
						:class="{ on: formData.learning_goal === item }"
						@click="selectGoal(item)"
					>{{ item }}</text>
				</view>
				<textarea
					class="intro-input"
					v-model.trim="formData.extra_notes"
					:disabled="!canEdit"
					placeholder="请描述孩子目前的学习情况、期望的上课频次、教师要求等"
					maxlength="300"
					:show-confirm-bar="false"
					:cursor-spacing="24"
					placeholder-class="ph"
				/>
				<text class="count">{{ formData.extra_notes.length }}/300</text>
			</view>

			<view class="section-card" :class="{ muted: !canEdit }">
				<view class="section-head" @click="handleChooseLocation">
					<text class="section-title">上课地址</text>
					<text class="section-action">选择</text>
				</view>
				<text class="intro">{{ addressDisplay || '点击选择大致上课地点' }}</text>
				<map
					v-if="formData.address.latitude && formData.address.longitude"
					class="recruit-map"
					:latitude="parseFloat(formData.address.latitude)"
					:longitude="parseFloat(formData.address.longitude)"
					:markers="mapMarkers"
					:scale="15"
					:show-location="true"
					@tap="handleOpenLocation"
				/>
			</view>

			<text class="form-tip">联系方式仅用于课程沟通，不会公开展示。完整信息有助于匹配合适教师。</text>
			<view class="scroll-spacer"></view>
		</scroll-view>

		<view class="action-bar">
			<button class="save-btn" :disabled="!canEdit || isSubmitting" @click="submitForm">
				{{ isSubmitting ? '保存中...' : '保存信息' }}
			</button>
		</view>
	</view>
</template>

<script>
import { mockUserInfo, useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { redirectByRole } from '@/utils/auth.js'
import { bindWeixinPhoneAndSync, refreshBoundPhone, pickUserPhone, isValidCnMobile } from '@/utils/wxPhone.js'
import { 
	chooseLocation, 
	openLocation, 
	requestLocationPermission 
} from '@/utils/location.js'
import { wxCheckLocalImageBeforeUpload } from './utils/wxContentSecurity.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	mixins: [pullRefreshMixin],
	name: 'ParentRegister',
	data() {
		return {
			useMock: false,
			role: 'parent',
			loading: false,
			avatarUploading: false,
			isSubmitting: false,
			phoneBinding: false,
			gradeIndex: -1,
			gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
			subjectOptions: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他'],
			goalOptions: ['查漏补缺', '冲刺提分', '习惯培养', '同步辅导', '竞赛备赛', '素质提升'],
			formData: {
				avatar: '',
				avatarFileId: '',
				nickname: '',
				phone: '',
				student_name: '',
				student_gender: '', // 孩子性别（必填）：'male' | 'female'
				student_grade: '',
				student_age: '',
				school_name: '',
				student_subjects: [],
				learning_goal: '',
				address: {
					latitude: '',
					longitude: '',
					name: ''
				},
				address_detail: '', // 保留用于兼容，实际使用address对象
				extra_notes: ''
			},
			defaultAvatar
		}
	},
	computed: {
		roleText() {
			return this.role === 'parent' ? '家长' : this.role === 'teacher' ? '教师' : '访客'
		},
		canEdit() {
			return this.role === 'parent' && !this.loading
		},
		hasBoundPhone() {
			return isValidCnMobile(this.formData.phone)
		},
		heroName() {
			return this.formData.nickname || this.formData.student_name || '家长用户'
		},
		heroSubtitle() {
			if (this.role !== 'parent') {
				return '当前账号非家长角色，无法编辑'
			}
			if (this.formData.student_name && this.formData.student_grade) {
				return `${this.formData.student_name} · ${this.formData.student_grade}`
			}
			return '完善资料以获取更精准的课程推荐'
		},
		/**
		 * 地址显示文本
		 */
		addressDisplay() {
			return this.formData.address.name || ''
		},
		/**
		 * 地图标记点
		 */
		mapMarkers() {
			if (!this.formData.address.latitude || !this.formData.address.longitude) {
				return []
			}
			return [{
				id: 1,
				latitude: parseFloat(this.formData.address.latitude),
				longitude: parseFloat(this.formData.address.longitude),
				width: 30,
				height: 30,
				title: this.formData.address.name || '上课地址',
				callout: {
					content: this.formData.address.name || '上课地址',
					color: '#333',
					fontSize: 14,
					borderRadius: 4,
					bgColor: '#fff',
					padding: 8,
					display: 'ALWAYS'
				}
			}]
		}
	},
	onLoad(options) {
		this.useMock = useMockData() === true
		if (options.role) {
			this.role = options.role
		}
		const stored = uni.getStorageSync('userInfo')
		if (stored?.role) {
			this.role = stored.role
		}
		this.initPage()
	},
	methods: {
		async refreshData() {
			console.log('[register] 下拉刷新：重新加载资料')
			await this.initPage(true)
		},
		async initPage(fromPullDown = false) {
			if (!fromPullDown) {
				this.loading = true
			}
			try {
				await this.fetchProfile()
			} catch (error) {
				console.error('初始化家长资料失败:', error)
			} finally {
				if (fromPullDown) {
					uni.stopPullDownRefresh()
				}
				this.loading = false
			}
		},
		async fetchProfile() {
			if (this.useMock) {
				await new Promise(resolve => setTimeout(resolve, 300))
				const data = mockUserInfo || {}
				this.fillFormFromProfile(data)
				return
			}
			const stored = uni.getStorageSync('userInfo') || {}
			if (stored.uid) {
				this.role = stored.role || this.role
			}
			try {
				const userProfile = uniCloud.importObject('user-profile', { customUI: true })
				const res = await userProfile.getUserProfile()
				if (res.code === 0 && res.data) {
					const profile = res.data
					this.fillFormFromProfile(profile)
					const nextStored = {
						...stored,
						nickname: profile.nickname || stored.nickname,
						avatar: profile.avatar || stored.avatar,
						role: profile.role || stored.role,
						parent_info: profile.parent_info || stored.parent_info || {},
						phone: profile.phone || stored.phone,
						gender: profile.gender != null ? profile.gender : stored.gender
					}
					uni.setStorageSync('userInfo', nextStored)
				} else {
					// 如果获取失败（如用户不存在），使用本地存储的信息填充表单
					console.warn('获取用户信息失败，使用本地存储信息:', res.message)
					if (stored.uid) {
						// 如果有本地存储的用户信息，使用它填充表单
						this.fillFormFromProfile({
							nickname: stored.nickname || '',
							avatar: stored.avatar || '',
							phone: stored.phone || '',
							role: stored.role || 'parent',
							parent_info: stored.parent_info || {}
						})
					}
				}
			} catch (error) {
				console.error('获取家长资料失败:', error)
				// 即使获取失败，也尝试使用本地存储的信息
				const stored = uni.getStorageSync('userInfo') || {}
				if (stored.uid) {
					this.fillFormFromProfile({
						nickname: stored.nickname || '',
						avatar: stored.avatar || '',
						phone: stored.phone || '',
						role: stored.role || 'parent',
						parent_info: stored.parent_info || {}
					})
				}
			}
		},
		async fillFormFromProfile(profile) {
			const pInfo = profile.parent_info || {}
			const avatarFileId = profile.avatar || profile.wx_avatarUrl || ''
			let avatarUrl = avatarFileId
			if (avatarFileId && !avatarFileId.startsWith('http')) {
				avatarUrl = await this.getTempFileURL(avatarFileId)
			}
			// 兼容旧数据：优先从 parent_info.address 读取经纬度，其次尝试从 location_* 字段读取
			const legacyAddress = pInfo.address || {}
			const hasLegacyAddress = legacyAddress && (legacyAddress.latitude || legacyAddress.name)
			const locationLat = pInfo.location_latitude
			const locationLon = pInfo.location_longitude
			const locationName = pInfo.location_name
			
			const hasLocation =
				(locationLat !== undefined && locationLat !== null && locationLat !== '') ||
				(locationLon !== undefined && locationLon !== null && locationLon !== '') ||
				locationName
			
			const finalAddressName = pInfo.address_detail || locationName || (hasLegacyAddress && legacyAddress.name) || ''
			
			const rawStudentGender = pInfo.student_gender
			let studentGenderStr = ''
			if (rawStudentGender === 1 || rawStudentGender === '1' || rawStudentGender === 'male') studentGenderStr = 'male'
			else if (rawStudentGender === 2 || rawStudentGender === '2' || rawStudentGender === 'female') studentGenderStr = 'female'

			this.formData = {
				avatar: avatarUrl || defaultAvatar,
				avatarFileId: avatarFileId || '',
				nickname: profile.nickname || profile.wx_nickname || '',
				phone: pickUserPhone(profile) || profile.phone || '',
				student_name: pInfo.student_name || '',
				student_gender: studentGenderStr,
				student_grade: pInfo.student_grade || '',
				student_age: pInfo.student_age || '',
				school_name: pInfo.school_name || '',
				student_subjects: Array.isArray(pInfo.student_subjects) ? pInfo.student_subjects : [],
				learning_goal: pInfo.learning_goal || '',
				address_detail: finalAddressName,
				address: hasLegacyAddress
					? {
						latitude: legacyAddress.latitude || '',
						longitude: legacyAddress.longitude || '',
						name: legacyAddress.name || finalAddressName
					}
					: hasLocation
						? {
							latitude: locationLat !== undefined && locationLat !== null ? String(locationLat) : '',
							longitude: locationLon !== undefined && locationLon !== null ? String(locationLon) : '',
							name: locationName || finalAddressName
						}
						: {
							latitude: '',
							longitude: '',
							name: finalAddressName
						},
				extra_notes: pInfo.extra_notes || ''
			}
			this.gradeIndex = this.gradeOptions.indexOf(this.formData.student_grade)
			if (!this.formData.phone) {
				try {
					const bound = await refreshBoundPhone()
					if (bound) this.formData.phone = bound
				} catch (e) {
					console.warn('[register] 读取已绑定手机号失败:', e)
				}
			}
		},
		chooseAvatar() {
			if (!this.canEdit || this.avatarUploading) return
			uni.chooseImage({
				count: 1,
				sizeType: ['compressed'],
				success: async (res) => {
					const localPath = res.tempFilePaths?.[0]
					if (!localPath) return
					await this.uploadAvatar(localPath)
				}
			})
		},
		async uploadAvatar(localPath) {
			try {
				this.avatarUploading = true
				let uploadPath = localPath
				try {
					uploadPath = await wxCheckLocalImageBeforeUpload(localPath, { scene: 'avatar' })
				} catch (secErr) {
					uni.showToast({ title: (secErr && secErr.message) || '图片未通过安全检测', icon: 'none' })
					return
				}
				const extIndex = uploadPath.lastIndexOf('.')
				const ext = extIndex > -1 ? uploadPath.substring(extIndex) : ''
				const cloudPath = `parent-avatar/${Date.now()}-${Math.floor(Math.random() * 1e5)}${ext}`
				const res = await uniCloud.uploadFile({
					filePath: uploadPath,
					cloudPath
				})
				if (res?.fileID) {
					const tempUrl = await this.getTempFileURL(res.fileID)
					this.formData.avatar = tempUrl
					this.formData.avatarFileId = res.fileID
					uni.showToast({ title: '头像已更新', icon: 'success' })
				} else {
					uni.showToast({ title: '上传失败', icon: 'none' })
				}
			} catch (error) {
				console.error('上传头像失败:', error)
				uni.showToast({ title: '上传失败，请稍后重试', icon: 'none' })
			} finally {
				this.avatarUploading = false
			}
		},
		async getTempFileURL(fileId) {
			if (!fileId) return ''
			if (fileId.startsWith('http')) return fileId
			try {
				const res = await uniCloud.getTempFileURL({ fileList: [fileId] })
				const file = res.fileList?.[0]
				return file?.tempFileURL || fileId
			} catch (error) {
				console.error('获取临时链接失败:', error)
				return fileId
			}
		},
		onGradeChange(event) {
			if (!this.canEdit) return
			const index = Number(event.detail.value)
			this.gradeIndex = index
			this.formData.student_grade = this.gradeOptions[index]
		},
		selectStudentGender(gender) {
			if (!this.canEdit) return
			if (gender !== 'male' && gender !== 'female') return
			this.formData.student_gender = gender
		},
		async onGetPhoneNumber(e) {
			if (!this.canEdit || this.phoneBinding) return
			this.phoneBinding = true
			try {
				uni.showLoading({ title: '获取中...' })
				const phone = await bindWeixinPhoneAndSync(e)
				if (phone) {
					this.formData.phone = phone
					uni.showToast({ title: '已自动填入手机号', icon: 'success' })
				} else {
					uni.showToast({ title: '已授权，请确认号码', icon: 'none' })
				}
			} catch (error) {
				console.error('[register] 获取本机号码失败:', error)
				uni.showToast({ title: (error && error.message) || '获取手机号失败', icon: 'none' })
			} finally {
				uni.hideLoading()
				this.phoneBinding = false
			}
		},
		toggleSubject(subject) {
			if (!this.canEdit) return
			const subjects = this.formData.student_subjects.slice(0)
			const idx = subjects.indexOf(subject)
			if (idx > -1) {
				subjects.splice(idx, 1)
			} else {
				subjects.push(subject)
			}
			this.formData.student_subjects = subjects
		},
		selectGoal(goal) {
			if (!this.canEdit) return
			this.formData.learning_goal = this.formData.learning_goal === goal ? '' : goal
		},
		/**
		 * 选择位置（打开地图选择）
		 */
		async handleChooseLocation() {
			if (!this.canEdit) return
			try {
				const hasPermission = await requestLocationPermission()
				if (!hasPermission) {
					uni.showToast({
						title: '需要位置权限',
						icon: 'none'
					})
					return
				}

				// 如果有已选位置，使用已选位置作为地图初始位置
				let initialLat = null
				let initialLon = null
				if (this.formData.address.latitude && this.formData.address.longitude) {
					initialLat = parseFloat(this.formData.address.latitude)
					initialLon = parseFloat(this.formData.address.longitude)
				}

				const location = await chooseLocation({
					latitude: initialLat,
					longitude: initialLon
				})

				// 更新表单数据
				this.formData.address = {
					latitude: location.latitude.toString(),
					longitude: location.longitude.toString(),
					name: location.name || location.address || ''
				}
				// 同时更新address_detail以保持兼容
				this.formData.address_detail = this.formData.address.name

				uni.showToast({
					title: '选择成功',
					icon: 'success'
				})
			} catch (error) {
				if (error.message && !error.message.includes('取消')) {
					console.error('选择位置失败:', error)
					uni.showToast({
						title: error.message || '选择失败',
						icon: 'none'
					})
				}
			}
		},
		/**
		 * 打开地图查看位置
		 */
		handleOpenLocation() {
			if (!this.canEdit) return
			const addr = this.formData.address
			if (!addr.latitude || !addr.longitude) {
				uni.showToast({
					title: '位置信息不完整',
					icon: 'none'
				})
				return
			}

			openLocation({
				latitude: parseFloat(addr.latitude),
				longitude: parseFloat(addr.longitude),
				name: addr.name || '上课地址',
				address: addr.name || '上课地址'
			})
		},
		validateForm() {
			if (!isValidCnMobile(this.formData.phone)) {
				uni.showToast({ title: '请填写或获取正确的手机号', icon: 'none' })
				return false
			}
			if (!this.formData.student_name) {
				uni.showToast({ title: '请填写学生姓名', icon: 'none' })
				return false
			}
			if (this.formData.student_gender !== 'male' && this.formData.student_gender !== 'female') {
				uni.showToast({ title: '请选择孩子性别', icon: 'none' })
				return false
			}
			if (!this.formData.student_grade) {
				uni.showToast({ title: '请选择学生年级', icon: 'none' })
				return false
			}
			return true
		},
		async submitForm() {
			if (!this.canEdit || this.isSubmitting) {
				console.log('[register] 保存被阻止:', { canEdit: this.canEdit, isSubmitting: this.isSubmitting })
				return
			}
			if (!this.validateForm()) {
				console.log('[register] 表单验证失败')
				return
			}
			try {
				this.isSubmitting = true
				console.log('[register] 开始保存，payload:', {
					phone: this.formData.phone,
					student_name: this.formData.student_name,
					student_grade: this.formData.student_grade
				})
				
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 500))
					uni.showToast({ title: '保存成功 (模拟)', icon: 'success' })
					this.isSubmitting = false
					return
				}
				
				const payload = {
					phone: this.formData.phone,
					avatar: this.formData.avatarFileId || this.formData.avatar,
					student_name: this.formData.student_name,
					student_gender: this.formData.student_gender,
					student_grade: this.formData.student_grade,
					student_subjects: this.formData.student_subjects,
					learning_goal: this.formData.learning_goal,
					address_detail: this.formData.address.name || this.formData.address_detail || '',
					address: this.formData.address.latitude && this.formData.address.longitude 
						? {
							latitude: parseFloat(this.formData.address.latitude),
							longitude: parseFloat(this.formData.address.longitude),
							name: this.formData.address.name || ''
						}
						: null,
					student_age: this.formData.student_age,
					school_name: this.formData.school_name,
					extra_notes: this.formData.extra_notes
				}
				
				console.log('[register] 调用云函数 updateParentProfile')
				const userProfile = uniCloud.importObject('user-profile', { customUI: true })
				const res = await userProfile.updateParentProfile(payload)
				console.log('[register] 云函数返回:', res)
				
				if (res.code === 0) {
					// 保存成功后，为当前家长生成邀请码（如果还没有）
					try {
						const inviteCenter = uniCloud.importObject('invite-center', { customUI: true })
						await inviteCenter.getMyInviteCode()
					} catch (e) {
						console.error('[register] 生成邀请码失败（忽略，不影响资料保存）:', e)
					}
					const stored = uni.getStorageSync('userInfo') || {}
					const parentInfo = {
						student_name: this.formData.student_name,
						student_gender: this.formData.student_gender,
						student_grade: this.formData.student_grade,
						student_subjects: this.formData.student_subjects,
						learning_goal: this.formData.learning_goal,
						address_detail: this.formData.address.name || this.formData.address_detail || '',
						address: this.formData.address.latitude && this.formData.address.longitude 
							? {
								latitude: parseFloat(this.formData.address.latitude),
								longitude: parseFloat(this.formData.address.longitude),
								name: this.formData.address.name || ''
							}
							: null,
						student_age: this.formData.student_age,
						school_name: this.formData.school_name,
						extra_notes: this.formData.extra_notes,
						update_time: Date.now()
					}
					const nextStored = {
						...stored,
						nickname: stored.nickname || this.formData.nickname,
						avatar: this.formData.avatarFileId || this.formData.avatar || stored.avatar,
						phone: this.formData.phone,
						parent_info: parentInfo,
						role: 'parent'
					}
				uni.setStorageSync('userInfo', nextStored)
				console.log('[register] 保存成功，已更新本地存储')
				uni.showToast({ title: '保存成功', icon: 'success' })
				setTimeout(() => {
					// 有上一页则返回；首次进入（被强制跳转到此页）时没有上一页，reLaunch 到家长工作台（找教师列表）
					const pages = getCurrentPages()
					if (pages && pages.length > 1) {
						uni.navigateBack({
							delta: 1,
							fail: () => {
								redirectByRole('parent')
							}
						})
					} else {
						redirectByRole('parent')
					}
				}, 1200)
				} else {
					console.error('[register] 保存失败:', res.message)
					uni.showToast({ title: res.message || '保存失败', icon: 'none', duration: 3000 })
				}
			} catch (error) {
				console.error('[register] 保存家长资料异常:', error)
				const errorMsg = error.message || error.errMsg || '保存失败，请稍后再试'
				uni.showToast({ title: errorMsg, icon: 'none', duration: 3000 })
			} finally {
				this.isSubmitting = false
				console.log('[register] 保存流程结束，isSubmitting:', this.isSubmitting)
			}
		},
		goRolePage() {
			uni.navigateTo({ url: '/pages-teacher/profile/edit' })
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

.hero-card,
.form-card,
.section-card,
.warn-card {
	margin: 24rpx 32rpx 0;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.hero-card {
	display: flex;
	align-items: center;
	gap: 24rpx;
	padding: 28rpx 32rpx;
}

.avatar {
	width: 128rpx;
	height: 128rpx;
	border-radius: 50%;
	background: #EEF3FF;
	flex-shrink: 0;
}

.hero-main {
	flex: 1;
	min-width: 0;
}

.hero-name {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
}

.hero-meta {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.warn-card {
	padding: 24rpx 32rpx;
}

.warn-title {
	display: block;
	font-size: 26rpx;
	color: #C47A12;
	line-height: 1.5;
}

.warn-link {
	display: inline-block;
	margin-top: 12rpx;
	font-size: 26rpx;
	color: #2563EB;
	font-weight: 500;
}

.form-card {
	padding: 8rpx 32rpx 16rpx;
}

.section-card {
	padding: 28rpx 32rpx;
}

.muted {
	opacity: 0.55;
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

.req {
	color: #FA5151;
}

.form-input {
	flex: 1;
	min-width: 0;
	text-align: right;
	font-size: 28rpx;
	color: #1F2329;
}

.phone-side {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 12rpx;
}

.phone-side .form-input {
	flex: 1;
}

.phone-btn {
	flex-shrink: 0;
	margin: 0;
	padding: 0 20rpx;
	height: 56rpx;
	line-height: 56rpx;
	font-size: 22rpx;
	font-weight: 600;
	color: #2563EB;
	background: #EEF3FF;
	border-radius: 16rpx;
	border: none;
}

.phone-btn::after {
	border: none;
}

.form-em {
	flex: 1;
	min-width: 0;
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

.chip-row {
	display: flex;
	gap: 12rpx;
}

.chip-block {
	padding: 8rpx 0 16rpx;
}

.chip-label {
	display: block;
	margin-bottom: 16rpx;
	font-size: 28rpx;
	color: #5C6370;
}

.chips-wrap {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
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

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.section-action {
	font-size: 26rpx;
	color: #2563EB;
}

.intro {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	color: #5C6370;
	line-height: 1.6;
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

.count {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8B919C;
	text-align: right;
}

.recruit-map {
	width: 100%;
	height: 240rpx;
	margin-top: 16rpx;
	border-radius: 16rpx;
	overflow: hidden;
	background: #F4F6F9;
}

.form-tip {
	display: block;
	padding: 20rpx 32rpx 8rpx;
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