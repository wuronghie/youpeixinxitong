<template>
	<view style="background: #F5F5F5;">
		<scroll-view scroll-y class="scroll">
			<view class="px-2 py-3">
				<!-- 头部信息卡片 -->
				<card class="mb-3">
					<view class="d-flex a-center mb-3">
						<view class="d-flex flex-column a-center mr-3" @click="chooseAvatar">
							<image
								class="rounded-circle mb-2"
								:src="formData.avatar || defaultAvatar"
								mode="aspectFill"
								style="width: 140rpx;height: 140rpx;border: 4rpx solid rgba(102, 126, 234, 0.2);"
							/>
							<text class="main-text-color font-sm">{{ avatarUploading ? '上传中...' : '更换头像' }}</text>
						</view>
						<view class="flex-1">
							<text class="font-md font-weight d-block mb-1">{{ formData.real_name || '家长用户' }}</text>
							<text class="font-sm text-light-muted d-block mb-1">{{ heroSubtitle }}</text>
							<view v-if="role !== 'parent'" class="bg-warning rounded px-2 py-1 font-sm text-warning">
								当前角色：{{ roleText }}
							</view>
						</view>
					</view>
					<view class="d-flex a-center j-sb pt-3 border-top">
						<view class="text-center flex-1">
							<text class="font-md font-weight d-block">{{ formData.phone || '未填写' }}</text>
							<text class="font-sm text-light-muted">联系方式</text>
						</view>
						<view class="text-center flex-1 border-left">
							<text class="font-md font-weight d-block">{{ formData.student_name || '未填写' }}</text>
							<text class="font-sm text-light-muted">学生姓名</text>
						</view>
						<view class="text-center flex-1 border-left">
							<text class="font-md font-weight d-block">{{ formData.student_grade || '未选择' }}</text>
							<text class="font-sm text-light-muted">当前年级</text>
						</view>
					</view>
				</card>

				<view v-if="role !== 'parent'" class="card bg-warning mb-3 p-3">
					<text class="font-sm text-warning d-block mb-2">当前账号不是家长角色，无法编辑家长资料。</text>
					<text class="main-text-color font-sm" @click="goRolePage">前往教师资料</text>
				</view>

				<!-- 家长信息 -->
				<card headTitle="家长信息" class="mb-3" :class="{ 'opacity-50': !canEdit }">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">真实姓名<text class="text-danger">*</text></text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model.trim="formData.real_name"
							:disabled="!canEdit"
							placeholder="请输入真实姓名"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">手机号码<text class="text-danger">*</text></text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model.trim="formData.phone"
							:disabled="!canEdit"
							type="number"
							placeholder="请输入常用手机号"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2">
						<text class="font-sm">微信号</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model.trim="formData.contact_wechat"
							:disabled="!canEdit"
							placeholder="方便老师联系的微信号"
							placeholder-class="text-light-muted"
						/>
					</view>
				</card>

				<!-- 学生信息 -->
				<card headTitle="学生信息" class="mb-3" :class="{ 'opacity-50': !canEdit }">
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">学生姓名<text class="text-danger">*</text></text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model.trim="formData.student_name"
							:disabled="!canEdit"
							placeholder="请输入学生姓名"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">当前年级<text class="text-danger">*</text></text>
						<picker
							mode="selector"
							:range="gradeOptions"
							:value="gradeIndex"
							@change="onGradeChange"
							:disabled="!canEdit"
						>
							<view class="d-flex a-center">
								<text class="font-sm" :class="formData.student_grade ? '' : 'text-light-muted'">
									{{ formData.student_grade || '请选择年级' }}
								</text>
								<text class="iconfont icon-you text-light-muted ml-2"></text>
							</view>
						</picker>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">学生年龄</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model.trim="formData.student_age"
							:disabled="!canEdit"
							type="number"
							placeholder="如：12"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="d-flex a-center j-sb py-2 border-bottom">
						<text class="font-sm">就读学校</text>
						<input
							class="text-right font-sm flex-1 ml-3"
							v-model.trim="formData.school_name"
							:disabled="!canEdit"
							placeholder="请填写学校或培训机构名称"
							placeholder-class="text-light-muted"
						/>
					</view>
					<view class="py-2">
						<text class="font-sm d-block mb-2">关注科目</text>
						<view class="d-flex flex-wrap">
							<view
								v-for="item in subjectOptions"
								:key="item"
								class="rounded px-3 py-2 font-sm mr-2 mb-2"
								:class="formData.student_subjects.includes(item) ? 'main-bg-color text-white' : 'bg-light-secondary'"
								@click="toggleSubject(item)"
							>
								{{ item }}
							</view>
						</view>
					</view>
				</card>

				<!-- 学习目标 -->
				<card headTitle="学习目标" class="mb-3" :class="{ 'opacity-50': !canEdit }">
					<view class="py-2 border-bottom">
						<text class="font-sm d-block mb-2">目标方向</text>
						<view class="d-flex flex-wrap">
							<view
								v-for="item in goalOptions"
								:key="item"
								class="rounded px-3 py-2 font-sm mr-2 mb-2"
								:class="formData.learning_goal === item ? 'main-bg-color text-white' : 'bg-light-secondary'"
								@click="selectGoal(item)"
							>
								{{ item }}
							</view>
						</view>
					</view>
					<view class="py-2">
						<text class="font-sm d-block mb-2">补充说明</text>
						<textarea
							class="w-100 bg-light-secondary rounded px-3 py-2 font-sm mb-1"
							v-model.trim="formData.extra_notes"
							:disabled="!canEdit"
							placeholder="请描述孩子目前的学习情况、期望的上课频次、教师要求等"
							maxlength="300"
							auto-height
							placeholder-class="text-light-muted"
							style="min-height: 120rpx;"
						/>
						<text class="font-sm text-light-muted text-right d-block">{{ formData.extra_notes.length }}/300</text>
					</view>
				</card>

				<!-- 上课地址 -->
				<card headTitle="上课地址" class="mb-3" :class="{ 'opacity-50': !canEdit }">
					<view class="py-2">
						<view class="d-flex a-center j-sb mb-2">
							<text class="font-sm">地址与联系方式</text>
							<view class="d-flex a-center" @click="handleChooseLocation">
								<text class="font-sm main-text-color mr-2">{{ addressDisplay || '点击选择地址' }}</text>
								<text class="iconfont icon-arrow-right font-sm text-light-muted"></text>
							</view>
						</view>
						<!-- 地图预览 -->
						<view v-if="formData.address.latitude && formData.address.longitude" class="map-preview-container">
							<map
								:latitude="parseFloat(formData.address.latitude)"
								:longitude="parseFloat(formData.address.longitude)"
								:markers="mapMarkers"
								:scale="15"
								:show-location="true"
								style="width: 100%; height: 300rpx; border-radius: 12rpx;"
								@tap="handleOpenLocation"
							></map>
						</view>
					</view>
				</card>

				<!-- 提示卡片 -->
				<card class="bg-light-secondary mb-3">
					<text class="font-sm font-weight d-block mb-2">完善资料小贴士</text>
					<text class="font-sm text-light-muted d-block mb-1">· 联系方式仅用于课程沟通，不会公开展示。</text>
					<text class="font-sm text-light-muted d-block mb-1">· 如更换学生或联系方式，可随时重新编辑。</text>
					<text class="font-sm text-light-muted d-block">· 完整信息有助于平台快速匹配合适教师。</text>
				</card>
			</view>
		</scroll-view>

		<!-- 保存按钮 -->
		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100;">
			<button 
				class="main-bg-color text-white rounded px-4 py-2 font-md font-weight w-100" 
				:disabled="!canEdit || isSubmitting"
				@click="submitForm"
			>
				{{ isSubmitting ? '保存中...' : '保存信息' }}
			</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { mockUserInfo, useMockData } from '@/utils/mockData.js'
import pullRefreshMixin from '@/utils/pullRefreshMixin.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { 
	chooseLocation, 
	openLocation, 
	requestLocationPermission 
} from '@/utils/location.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	mixins: [pullRefreshMixin],
	components: {
		card
	},
	name: 'ParentRegister',
	data() {
		return {
			useMock: false,
			role: 'parent',
			loading: false,
			avatarUploading: false,
			isSubmitting: false,
			gradeIndex: -1,
			gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
			subjectOptions: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他'],
			goalOptions: ['查漏补缺', '冲刺提分', '习惯培养', '同步辅导', '竞赛备赛', '素质提升'],
			formData: {
				avatar: '',
				avatarFileId: '',
				real_name: '',
				phone: '',
				contact_wechat: '',
				student_name: '',
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
						phone: profile.phone || stored.phone
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
			
			this.formData = {
				avatar: avatarUrl || defaultAvatar,
				avatarFileId: avatarFileId || '',
				real_name: profile.nickname || pInfo.real_name || '',
				phone: profile.phone || '',
				contact_wechat: pInfo.contact_wechat || '',
				student_name: pInfo.student_name || '',
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
				const extIndex = localPath.lastIndexOf('.')
				const ext = extIndex > -1 ? localPath.substring(extIndex) : ''
				const cloudPath = `parent-avatar/${Date.now()}-${Math.floor(Math.random() * 1e5)}${ext}`
				const res = await uniCloud.uploadFile({
					filePath: localPath,
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
			if (!this.formData.real_name) {
				uni.showToast({ title: '请填写真实姓名', icon: 'none' })
				return false
			}
			const phoneReg = /^1[3-9]\d{9}$/
			if (!this.formData.phone || !phoneReg.test(this.formData.phone)) {
				uni.showToast({ title: '请填写正确的手机号', icon: 'none' })
				return false
			}
			if (!this.formData.student_name) {
				uni.showToast({ title: '请填写学生姓名', icon: 'none' })
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
					real_name: this.formData.real_name,
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
					real_name: this.formData.real_name,
					phone: this.formData.phone,
					avatar: this.formData.avatarFileId || this.formData.avatar,
					student_name: this.formData.student_name,
					student_grade: this.formData.student_grade,
					student_subjects: this.formData.student_subjects,
					learning_goal: this.formData.learning_goal,
					contact_wechat: this.formData.contact_wechat,
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
						real_name: this.formData.real_name,
						student_name: this.formData.student_name,
						student_grade: this.formData.student_grade,
						student_subjects: this.formData.student_subjects,
						learning_goal: this.formData.learning_goal,
						contact_wechat: this.formData.contact_wechat,
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
						nickname: this.formData.real_name,
						avatar: this.formData.avatarFileId || this.formData.avatar || stored.avatar,
						phone: this.formData.phone,
						parent_info: parentInfo,
						role: 'parent'
					}
					uni.setStorageSync('userInfo', nextStored)
					console.log('[register] 保存成功，已更新本地存储')
					uni.showToast({ title: '保存成功', icon: 'success' })
					setTimeout(() => {
						uni.navigateBack({ delta: 1 })
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
.scroll {
	flex: 1;
	height: calc(100vh - 200rpx);
	padding-bottom: 160rpx;
}
</style>