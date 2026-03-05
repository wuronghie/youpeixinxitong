<template>
	<view style="background: #F5F5F5;">
		<scroll-view scroll-y class="scroll" :scroll-into-view="scrollIntoView" scroll-with-animation>
			<view class="px-2 py-3">
				<!-- 提示卡片 -->
				<view class="card bg-warning mb-3 p-3">
					<view class="d-flex a-center mb-2">
						<view class="icon-warning mr-2" style="width: 40rpx; height: 40rpx;"></view>
						<text class="font-md font-weight text-warning">重要提示</text>
					</view>
					<text class="font-sm text-warning d-block">请认真填写您的资料信息，审核期间无法被家长搜索到。审核通过后，您的资料将展示给家长，请确保信息真实有效。</text>
				</view>

				<!-- 头像和基本信息 -->
				<card class="mb-3" :class="{ 'error-highlight': errors.name }">
					<view class="d-flex a-center mb-3 p-3">
						<view class="d-flex flex-column a-center mr-3" @click="chooseAvatar">
							<image class="rounded-circle mb-2" :src="formData.avatar || defaultAvatar" mode="aspectFill" style="width: 140rpx;height: 140rpx;border: 4rpx solid rgba(102, 126, 234, 0.2);"></image>
							<text class="main-text-color font-sm">{{ avatarUploading ? '上传中...' : '点击更换头像' }}</text>
						</view>
						<view class="flex-1">
							<view class="d-flex a-center j-sb py-3 border-bottom form-item" :class="{ 'error-item': errors.name }" id="field-name">
								<view class="d-flex a-center">
									<text class="font-md required-label">姓名</text>
									<text class="required-star">*</text>
								</view>
								<input class="text-right font-sm flex-1 ml-3 form-input" :class="{ 'error-input': errors.name }" v-model.trim="formData.name" placeholder="请输入真实姓名" placeholder-class="text-light-muted" @input="clearError('name')" />
							</view>
							<view class="d-flex a-center j-sb py-3 form-item">
								<text class="font-md">职称</text>
								<input class="text-right font-sm flex-1 ml-3 form-input" v-model.trim="formData.title" placeholder="如：高级教师、金牌讲师" placeholder-class="text-light-muted" />
							</view>
						</view>
					</view>
				</card>

				<!-- 教学信息 -->
				<card headTitle="教学信息" class="mb-3" :class="{ 'error-highlight': errors.subjects || errors.grades || errors.hourly_rate }">
					<view class="p-3">
						<view class="mb-4" :class="{ 'error-item': errors.subjects }" id="field-subjects">
							<view class="d-flex a-center mb-3">
								<text class="font-md required-label">教学科目</text>
								<text class="required-star">*</text>
							</view>
							<view class="d-flex flex-wrap">
								<view
									v-for="subject in subjectOptions"
									:key="subject.value"
									class="tag-item rounded px-3 py-2 mr-2 mb-2 font-sm"
									:class="formData.subjects.includes(subject.value) ? 'tag-selected' : 'tag-default'"
									@click="toggleSubject(subject.value)"
								>
									{{ subject.label }}
								</view>
							</view>
							<text v-if="errors.subjects" class="error-text">{{ errors.subjects }}</text>
						</view>
						<view class="mb-4" :class="{ 'error-item': errors.grades }" id="field-grades">
							<view class="d-flex a-center mb-3">
								<text class="font-md required-label">适合年级</text>
								<text class="required-star">*</text>
							</view>
							<view class="d-flex flex-wrap">
								<view
									v-for="grade in gradeOptions"
									:key="grade"
									class="tag-item rounded px-3 py-2 mr-2 mb-2 font-sm"
									:class="formData.grades.includes(grade) ? 'tag-selected' : 'tag-default'"
									@click="toggleGrade(grade)"
								>
									{{ grade }}
								</view>
							</view>
							<text v-if="errors.grades" class="error-text">{{ errors.grades }}</text>
						</view>
						<view class="d-flex a-center j-sb py-3 border-top form-item" :class="{ 'error-item': errors.hourly_rate }" id="field-hourly_rate">
							<view class="d-flex a-center">
								<text class="font-md required-label">课时费</text>
								<text class="required-star">*</text>
								<text class="font-sm text-light-muted ml-1">(元/小时)</text>
							</view>
							<view class="d-flex a-center">
								<text class="font-sm text-light-muted mr-1">¥</text>
								<input class="text-right font-sm form-input" :class="{ 'error-input': errors.hourly_rate }" style="width: 200rpx;" type="number" v-model.number="formData.hourly_rate" placeholder="请输入金额" placeholder-class="text-light-muted" @input="clearError('hourly_rate')" />
								<text class="font-sm text-light-muted ml-1">/时</text>
							</view>
						</view>
						<text v-if="errors.hourly_rate" class="error-text ml-3">{{ errors.hourly_rate }}</text>
						<view class="d-flex a-center j-sb py-3 border-top form-item">
							<text class="font-md">教龄 (年)</text>
							<input class="text-right font-sm flex-1 ml-3 form-input" type="number" v-model.number="formData.experience_years" placeholder="请输入教龄" placeholder-class="text-light-muted" />
						</view>
					</view>
				</card>

				<!-- 自我介绍 -->
				<card headTitle="自我介绍" class="mb-3">
					<view class="p-3">
						<textarea
							class="form-textarea bg-light-secondary rounded px-3 py-2 font-sm"
							v-model.trim="formData.introduction"
							maxlength="600"
							placeholder="从教学经验、教学特色、擅长领域等角度介绍自己，建议不少于60字"
							placeholder-class="text-light-muted"
							style="min-height: 220rpx;"
						/>
					</view>
				</card>

				<!-- 教育背景 -->
				<card headTitle="教育背景" class="mb-3">
					<view class="p-3">
						<view class="d-flex a-center j-sb py-3 border-bottom form-item" id="field-school">
							<text class="font-md">所在院校</text>
							<picker :range="schoolOptions" range-key="label" @change="onSchoolChange">
								<view class="font-sm picker-view" :class="formData.school ? '' : 'text-light-muted'">{{ getSchoolLabel(formData.school) || '请选择所在院校（可选）' }}</view>
							</picker>
						</view>
						<view class="d-flex a-center j-sb py-3 border-bottom form-item" id="field-experience">
							<text class="font-md">教师资历</text>
							<picker :range="experienceOptions" range-key="label" @change="onExperienceChange">
								<view class="font-sm picker-view" :class="formData.experience ? '' : 'text-light-muted'">{{ getExperienceLabel(formData.experience) || '请选择教师资历（可选）' }}</view>
							</picker>
						</view>
						<view class="d-flex a-center j-sb py-3 border-bottom form-item">
							<text class="font-md">最高学历</text>
							<picker :range="degreeOptions" @change="onDegreeChange">
								<view class="font-sm picker-view" :class="formData.education.degree ? '' : 'text-light-muted'">{{ formData.education.degree || '请选择' }}</view>
							</picker>
						</view>
						<view class="d-flex a-center j-sb py-3 border-bottom form-item">
							<text class="font-md">专业</text>
							<input class="text-right font-sm flex-1 ml-3 form-input" v-model.trim="formData.education.major" placeholder="请输入专业" placeholder-class="text-light-muted" />
						</view>
						<view class="d-flex a-center j-sb py-3 form-item">
							<text class="font-md">毕业年份</text>
							<input class="text-right font-sm flex-1 ml-3 form-input" type="number" v-model.number="formData.education.graduation_year" placeholder="如：2018" placeholder-class="text-light-muted" />
						</view>
					</view>
				</card>

				<!-- 附加标签 -->
				<card headTitle="附加标签" class="mb-3">
					<view class="p-3">
						<text class="font-sm text-light-muted d-block mb-3">选择您的教学特色标签（可多选）</text>
						<view class="d-flex flex-wrap">
							<view
								v-for="tag in tagOptions"
								:key="tag.value"
								class="tag-item rounded px-3 py-2 mr-2 mb-2 font-sm"
								:class="formData.tags.includes(tag.value) ? 'tag-selected' : 'tag-default'"
								@click="toggleTag(tag.value)"
							>
								{{ tag.label }}
							</view>
						</view>
					</view>
				</card>

				<!-- 教学地区 -->
				<card headTitle="教学地区" class="mb-3">
					<view slot="right" class="main-text-color font-sm" @click="addTeachingArea">+ 添加地区</view>
					<view class="p-3">
						<view v-if="formData.teaching_areas.length" class="d-flex flex-column">
							<view v-for="(area, index) in formData.teaching_areas" :key="index" class="bg-light-secondary rounded px-3 py-3 mb-3">
								<view class="d-flex a-center j-sb mb-2">
									<text class="font-sm text-light-muted">教学地址</text>
									<view class="d-flex a-center" @click="handleChooseLocation(index)">
										<text class="font-sm main-text-color mr-2">{{ getAreaDisplay(area) || '点击选择地址' }}</text>
										<text class="iconfont icon-arrow-right font-sm text-light-muted"></text>
									</view>
								</view>
								<!-- 地图预览 -->
								<view v-if="area.latitude && area.longitude" class="map-preview-container">
									<map
										:latitude="parseFloat(area.latitude)"
										:longitude="parseFloat(area.longitude)"
										:markers="getAreaMarkers(area, index)"
										:scale="15"
										:show-location="true"
										style="width: 100%; height: 300rpx; border-radius: 12rpx;"
										@tap="handleOpenAreaLocation(index)"
									></map>
								</view>
								<text class="text-danger font-sm" v-if="formData.teaching_areas.length > 1" @click="removeTeachingArea(index)">删除</text>
							</view>
						</view>
						<view v-else class="text-center text-light-muted font-sm py-3">暂未添加教学地区</view>
					</view>
				</card>

				<!-- 资质证书 -->
				<card headTitle="资质证书" class="mb-3">
					<view slot="right" class="main-text-color font-sm" @click="addQualification">+ 添加证书</view>
					<view class="p-3">
						<view v-if="formData.qualifications.length" class="d-flex flex-column">
							<view v-for="(q, index) in formData.qualifications" :key="index" class="bg-light-secondary rounded px-3 py-3 mb-3">
								<input class="font-sm mb-2 form-input" v-model.trim="q.name" placeholder="证书名称，例如：教师资格证" placeholder-class="text-light-muted" />
								<input class="font-sm mb-2 form-input" v-model.trim="q.number" placeholder="证书编号（可选）" placeholder-class="text-light-muted" />
								<view class="mb-2">
									<text class="font-sm text-light-muted d-block mb-2">证书图片</text>
									<view class="bg-white rounded border border-light-muted" style="min-height: 200rpx; position: relative;" @click="uploadQualificationImage(index)">
										<image v-if="q.image" class="rounded" :src="q.image" mode="aspectFit" style="width: 100%; min-height: 200rpx; max-height: 400rpx;"></image>
										<view v-else class="d-flex flex-column a-center j-center" style="min-height: 200rpx;">
											<view class="icon-camera" style="width: 48rpx; height: 48rpx; color: #ddd;"></view>
											<text class="font-sm text-light-muted mt-2">上传图片</text>
										</view>
										<view v-if="q.image" class="position-absolute top-0 right-0 bg-black rounded px-2 py-1" style="opacity: 0.6; z-index: 10;" @click.stop="removeQualificationImage(index)">
											<text class="text-white font-xs">删除</text>
										</view>
									</view>
								</view>
								<text class="text-danger font-sm" @click="removeQualification(index)">删除证书</text>
							</view>
						</view>
						<view v-else class="text-center text-light-muted font-sm py-3">尚未添加证书信息</view>
					</view>
				</card>
			</view>
		</scroll-view>

		<view class="position-fixed bottom-0 left-0 right-0 bg-white border-top d-flex a-center px-3 py-3" style="z-index: 100; box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.05);">
			<button class="w-100 main-bg-color text-white rounded px-3 py-2 font-md" :loading="saving" @click="saveProfile">保存资料</button>
		</view>
	</view>
</template>

<script>
import card from '@/components/common/card.vue'
import { mockTeachers, useMockData } from '@/utils/mockData.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { 
	chooseLocation, 
	openLocation, 
	requestLocationPermission 
} from '@/utils/location.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	name: 'TeacherProfileEdit',
	components: {
		card
	},
	data() {
		return {
			formData: {
				avatar: '',
				avatarFileId: '',
				name: '',
				title: '',
				introduction: '',
				subjects: [],
				grades: [],
				hourly_rate: 0,
				experience_years: 0,
				school: '',           // 所在院校
				experience: '',       // 教师资历
				tags: [],            // 附加标签
				education: { degree: '', school: '', major: '', graduation_year: null },
				teaching_areas: [{ latitude: '', longitude: '', name: '' }],
				qualifications: []
			},
			errors: {}, // 错误信息
			scrollIntoView: '', // 滚动定位
			subjectOptions: [
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
			gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
			degreeOptions: ['高中', '大专', '本科', '硕士', '博士'],
			// 所在院校选项
			schoolOptions: [
				{ label: '四川大学', value: '四川大学' },
				{ label: '电子科技大学', value: '电子科技大学' },
				{ label: '西南交通大学', value: '西南交通大学' },
				{ label: '四川农业大学', value: '四川农业大学' },
				{ label: '西南财经大学', value: '西南财经大学' },
				{ label: '其他985/211', value: '其他985/211' },
				{ label: '专职老师', value: '专职老师' }
			],
			// 教师资历选项
			experienceOptions: [
				{ label: '大一（高考刚结束）', value: '大一（高考刚结束）' },
				{ label: '大二至大四（1年以内）', value: '大二至大四（1年以内）' },
				{ label: '大二至大四（1-2年）', value: '大二至大四（1-2年）' },
				{ label: '大二至大四（2年以上）', value: '大二至大四（2年以上）' },
				{ label: '专职老师（1-3年）', value: '专职老师（1-3年）' },
				{ label: '专职老师（3-5年）', value: '专职老师（3-5年）' },
				{ label: '专职老师（5年以上）', value: '专职老师（5年以上）' }
			],
			// 附加标签选项
			tagOptions: [
				{ label: '有试课视频', value: '有试课视频' },
				{ label: '家长好评50+', value: '家长好评50+' },
				{ label: '可上门辅导', value: '可上门辅导' },
				{ label: '擅长提分（中高考）', value: '擅长提分（中高考）' },
				{ label: '耐心教基础薄弱生', value: '耐心教基础薄弱生' }
			],
			useMock: false,
			saving: false,
			defaultAvatar,
			avatarUploading: false,
			qualificationUploading: false
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.loadProfile()
	},
	methods: {
		async loadProfile() {
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const teacher = mockTeachers[0]
					// 兼容旧数据：如果 school 字段为空但 education.school 有值，则使用 education.school
					const schoolValue = teacher.school || teacher.education?.school || ''
					
					this.formData = {
						avatar: teacher.avatar || '',
						avatarFileId: teacher.avatar || '',
						name: teacher.display_name || teacher.name || '',
						title: teacher.title || '',
						introduction: teacher.introduction || '',
						subjects: teacher.subjects || [],
						grades: teacher.grades || [],
						hourly_rate: teacher.hourly_rate || 0,
						experience_years: teacher.experience_years || 0,
						school: schoolValue,
						experience: teacher.experience || '',
						tags: Array.isArray(teacher.tags) ? teacher.tags : [],
						education: {
							degree: teacher.education?.degree || '',
							school: '', // 不再使用 education.school，统一使用 school 字段
							major: teacher.education?.major || '',
							graduation_year: teacher.education?.graduation_year || null
						},
						teaching_areas: teacher.teaching_areas && teacher.teaching_areas.length
							? this.normalizeTeachingAreas(teacher.teaching_areas)
							: [{ latitude: '', longitude: '', name: '' }],
						qualifications: teacher.qualifications || []
					}
					return
				}

				const userInfo = uni.getStorageSync('userInfo') || {}
				if (!userInfo.uid || userInfo.role !== 'teacher') {
					uni.showToast({ title: '请先以教师身份登录', icon: 'none' })
					return
				}

				console.log('[编辑页面] 开始加载教师资料...')

				const teacherProfile = uniCloud.importObject('teacher-profile', { customUI: true })
				const res = await teacherProfile.getProfile()
				
				console.log('[编辑页面] 获取资料结果:', {
					code: res.code,
					hasData: !!res.data
				})
				
				if (res.code === 0 && res.data) {
					const p = res.data
					
					// 检查并打印缺失的必填字段
					const missingFields = []
					const missingFieldsText = []
					
					if (!p.display_name || p.display_name.trim() === '') {
						missingFields.push('display_name')
						missingFieldsText.push('姓名')
					}
					if (!p.subjects || !Array.isArray(p.subjects) || p.subjects.length === 0) {
						missingFields.push('subjects')
						missingFieldsText.push('教学科目')
					}
					if (!p.grades || !Array.isArray(p.grades) || p.grades.length === 0) {
						missingFields.push('grades')
						missingFieldsText.push('适合年级')
					}
					if (!p.hourly_rate || Number(p.hourly_rate) <= 0) {
						missingFields.push('hourly_rate')
						missingFieldsText.push('课时费')
					}
					
					if (missingFields.length > 0) {
						console.warn('========================================')
						console.warn('[编辑页面] ⚠️ 检测到缺失的必填字段')
						console.warn('缺失的字段:', missingFieldsText.join('、'))
						console.warn('当前值:')
						console.warn('  - 姓名:', p.display_name || '未设置')
						console.warn('  - 教学科目:', Array.isArray(p.subjects) ? `[${p.subjects.join(', ')}]` : '未设置')
						console.warn('  - 适合年级:', Array.isArray(p.grades) ? `[${p.grades.join(', ')}]` : '未设置')
						console.warn('  - 课时费:', p.hourly_rate || '0')
						console.warn('请填写以上必填字段后保存')
						console.warn('========================================')
					} else {
						console.log('[编辑页面] ✓ 所有必填字段已填写')
					}
					const avatarFileId = p.avatar || ''
					let avatarUrl = avatarFileId
					if (avatarFileId && !avatarFileId.startsWith('http')) {
						avatarUrl = await this.getTempFileURL(avatarFileId)
					}
					
					// 兼容旧数据：如果 school 字段为空但 education.school 有值，则使用 education.school
					const schoolValue = p.school || p.education?.school || ''
					
					this.formData = {
						avatar: avatarUrl,
						avatarFileId,
						name: p.display_name || p.name || '',
						title: p.title || '',
						introduction: p.introduction || '',
						subjects: p.subjects || [],
						grades: p.grades || [],
						hourly_rate: p.hourly_rate || 0,
						experience_years: p.teaching_experience?.years || 0,
						school: schoolValue,
						experience: p.experience || '',
						tags: Array.isArray(p.tags) ? p.tags : [],
						education: {
							degree: p.education?.degree || '',
							school: '', // 不再使用 education.school，统一使用 school 字段
							major: p.education?.major || '',
							graduation_year: p.education?.graduation_year || null
						},
						teaching_areas: Array.isArray(p.teaching_areas) && p.teaching_areas.length
							? this.normalizeTeachingAreas(p.teaching_areas)
							: [{ latitude: '', longitude: '', name: '' }],
						qualifications: await this.processQualifications(p.qualifications || [])
					}
				}
			} catch (error) {
				console.error('加载教师资料失败:', error)
			}
		},
		chooseAvatar() {
			uni.chooseImage({
				count: 1,
				success: async (res) => {
					const localPath = res.tempFilePaths?.[0]
					if (!localPath) return
					if (this.useMock) {
						this.formData.avatar = localPath
						this.formData.avatarFileId = localPath
						return
					}
					await this.uploadAvatar(localPath)
				}
			})
		},
		async uploadAvatar(localPath) {
			if (this.avatarUploading) {
				uni.showToast({ title: '正在上传，请稍候', icon: 'none' })
				return
			}
			try {
				this.avatarUploading = true
				const extIndex = localPath.lastIndexOf('.')
				const ext = extIndex > -1 ? localPath.substring(extIndex) : ''
				const cloudPath = `teacher-avatar/${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`
				const uploadRes = await uniCloud.uploadFile({
					filePath: localPath,
					cloudPath
				})
				if (uploadRes && uploadRes.fileID) {
					const tempUrl = await this.getTempFileURL(uploadRes.fileID)
					this.formData.avatar = tempUrl
					this.formData.avatarFileId = uploadRes.fileID
					uni.showToast({ title: '头像已更新', icon: 'success' })
				} else {
					uni.showToast({ title: '上传失败', icon: 'none' })
				}
			} catch (error) {
				console.error('上传头像失败:', error)
				uni.showToast({ title: '上传失败', icon: 'none' })
			} finally {
				this.avatarUploading = false
			}
		},
		async getTempFileURL(fileId) {
			if (!fileId) {
				return ''
			}
			try {
				const res = await uniCloud.getTempFileURL({
					fileList: [fileId]
				})
				const file = res.fileList && res.fileList[0]
				if (file && file.tempFileURL) {
					return file.tempFileURL
				}
			} catch (error) {
				console.error('获取头像临时链接失败:', error)
			}
			return fileId
		},
		toggleSubject(subject) {
			const idx = this.formData.subjects.indexOf(subject)
			if (idx > -1) {
				this.formData.subjects.splice(idx, 1)
			} else {
				this.formData.subjects.push(subject)
			}
			this.clearError('subjects')
		},
		toggleGrade(grade) {
			const idx = this.formData.grades.indexOf(grade)
			if (idx > -1) {
				this.formData.grades.splice(idx, 1)
			} else {
				this.formData.grades.push(grade)
			}
			this.clearError('grades')
		},
		onDegreeChange(event) {
			const idx = Number(event.detail.value)
			this.formData.education.degree = this.degreeOptions[idx]
		},
		onSchoolChange(event) {
			const idx = Number(event.detail.value)
			this.formData.school = this.schoolOptions[idx]?.value || ''
			this.clearError('school')
		},
		onExperienceChange(event) {
			const idx = Number(event.detail.value)
			this.formData.experience = this.experienceOptions[idx]?.value || ''
			this.clearError('experience')
		},
		toggleTag(tagValue) {
			const index = this.formData.tags.indexOf(tagValue)
			if (index > -1) {
				this.formData.tags.splice(index, 1)
			} else {
				this.formData.tags.push(tagValue)
			}
		},
		getSchoolLabel(value) {
			const option = this.schoolOptions.find(opt => opt.value === value)
			return option ? option.label : ''
		},
		getExperienceLabel(value) {
			const option = this.experienceOptions.find(opt => opt.value === value)
			return option ? option.label : ''
		},
		addTeachingArea() {
			this.formData.teaching_areas.push({ latitude: '', longitude: '', name: '' })
		},
		removeTeachingArea(index) {
			this.formData.teaching_areas.splice(index, 1)
			if (!this.formData.teaching_areas.length) {
				this.formData.teaching_areas.push({ latitude: '', longitude: '', name: '' })
			}
		},
		/**
		 * 获取地区显示文本
		 */
		getAreaDisplay(area) {
			return area.name || ''
		},
		/**
		 * 获取地区地图标记点
		 */
		getAreaMarkers(area, index) {
			if (!area.latitude || !area.longitude) {
				return []
			}
			return [{
				id: index + 1,
				latitude: parseFloat(area.latitude),
				longitude: parseFloat(area.longitude),
				width: 30,
				height: 30,
				title: area.name || '教学地址',
				callout: {
					content: area.name || '教学地址',
					color: '#333',
					fontSize: 14,
					borderRadius: 4,
					bgColor: '#fff',
					padding: 8,
					display: 'ALWAYS'
				}
			}]
		},
		/**
		 * 选择教学地址
		 */
		async handleChooseLocation(index) {
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
				const area = this.formData.teaching_areas[index]
				if (area && area.latitude && area.longitude) {
					initialLat = parseFloat(area.latitude)
					initialLon = parseFloat(area.longitude)
				}

				const location = await chooseLocation({
					latitude: initialLat,
					longitude: initialLon
				})

				// 更新表单数据
				this.formData.teaching_areas[index] = {
					latitude: location.latitude.toString(),
					longitude: location.longitude.toString(),
					name: location.name || location.address || ''
				}

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
		 * 打开地图查看教学地址
		 */
		handleOpenAreaLocation(index) {
			const area = this.formData.teaching_areas[index]
			if (!area || !area.latitude || !area.longitude) {
				uni.showToast({
					title: '位置信息不完整',
					icon: 'none'
				})
				return
			}

			openLocation({
				latitude: parseFloat(area.latitude),
				longitude: parseFloat(area.longitude),
				name: area.name || '教学地址',
				address: area.name || '教学地址'
			})
		},
		/**
		 * 规范化教学地区数据格式（兼容旧数据）
		 */
		normalizeTeachingAreas(areas) {
			if (!Array.isArray(areas)) {
				return [{ latitude: '', longitude: '', name: '' }]
			}
			
			return areas.map(area => {
				// 如果已经是新格式（有latitude和longitude），直接返回
				if (area.latitude && area.longitude) {
					return {
						latitude: area.latitude.toString(),
						longitude: area.longitude.toString(),
						name: area.name || ''
					}
				}
				
				// 如果是旧格式（有province/city/district/address），转换为新格式
				// 注意：旧格式无法完全转换为经纬度，所以只保留地址文本
				if (area.province || area.city || area.district || area.address) {
					const parts = []
					if (area.province) parts.push(area.province)
					if (area.city) parts.push(area.city)
					if (area.district) parts.push(area.district)
					if (area.address) parts.push(area.address)
					return {
						latitude: '',
						longitude: '',
						name: parts.join(' ')
					}
				}
				
				// 其他情况，返回空数据
				return { latitude: '', longitude: '', name: '' }
			})
		},
		async processQualifications(qualifications) {
			if (!Array.isArray(qualifications) || qualifications.length === 0) {
				return []
			}
			const processed = []
			for (const q of qualifications) {
				const processedQ = { ...q }
				if (q.image) {
					if (!q.image.startsWith('http')) {
						try {
							const tempUrl = await this.getTempFileURL(q.image)
							processedQ.image = tempUrl
							processedQ.image_fileId = q.image
						} catch (e) {
							console.error('获取证书图片URL失败:', e)
							processedQ.image = q.image
							processedQ.image_fileId = q.image
						}
					} else {
						processedQ.image_fileId = q.image
					}
				}
				processed.push(processedQ)
			}
			return processed
		},
		addQualification() {
			this.formData.qualifications.push({ name: '', number: '', image: '', image_fileId: '' })
		},
		removeQualification(index) {
			this.formData.qualifications.splice(index, 1)
		},
		uploadQualificationImage(index) {
			uni.chooseImage({
				count: 1,
				success: async (res) => {
					const localPath = res.tempFilePaths?.[0]
					if (!localPath) return
					if (this.useMock) {
						this.formData.qualifications[index].image = localPath
						this.formData.qualifications[index].image_fileId = localPath
						return
					}
					await this.uploadQualificationImageFile(localPath, index)
				}
			})
		},
		async uploadQualificationImageFile(localPath, index) {
			if (this.qualificationUploading) {
				uni.showToast({ title: '正在上传，请稍候', icon: 'none' })
				return
			}
			try {
				this.qualificationUploading = true
				const extIndex = localPath.lastIndexOf('.')
				const ext = extIndex > -1 ? localPath.substring(extIndex) : ''
				const cloudPath = `teacher-cert/${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`
				const uploadRes = await uniCloud.uploadFile({
					filePath: localPath,
					cloudPath
				})
				if (uploadRes && uploadRes.fileID) {
					const tempUrl = await this.getTempFileURL(uploadRes.fileID)
					this.formData.qualifications[index].image = tempUrl
					this.formData.qualifications[index].image_fileId = uploadRes.fileID
					uni.showToast({ title: '上传成功', icon: 'success' })
				} else {
					uni.showToast({ title: '上传失败', icon: 'none' })
				}
			} catch (error) {
				console.error('上传证书图片失败:', error)
				uni.showToast({ title: '上传失败', icon: 'none' })
			} finally {
				this.qualificationUploading = false
			}
		},
		removeQualificationImage(index) {
			this.formData.qualifications[index].image = ''
			this.formData.qualifications[index].image_fileId = ''
		},
		clearError(field) {
			if (this.errors[field]) {
				this.$delete(this.errors, field)
			}
		},
		scrollToError(fieldId) {
			this.scrollIntoView = ''
			this.$nextTick(() => {
				this.scrollIntoView = fieldId
			})
		},
		validateForm() {
			this.errors = {}
			let isValid = true
			let firstErrorField = ''
			const missingFields = []

			// 验证姓名
			if (!this.formData.name || !this.formData.name.trim()) {
				this.errors.name = '请填写姓名'
				missingFields.push('姓名')
				if (!firstErrorField) firstErrorField = 'field-name'
				isValid = false
			}

			// 验证教学科目
			if (!this.formData.subjects || this.formData.subjects.length === 0) {
				this.errors.subjects = '请选择至少一个教学科目'
				missingFields.push('教学科目')
				if (!firstErrorField) firstErrorField = 'field-subjects'
				isValid = false
			}

			// 验证适合年级
			if (!this.formData.grades || this.formData.grades.length === 0) {
				this.errors.grades = '请选择至少一个适合年级'
				missingFields.push('适合年级')
				if (!firstErrorField) firstErrorField = 'field-grades'
				isValid = false
			}

			// 验证课时费
			if (!this.formData.hourly_rate || this.formData.hourly_rate <= 0) {
				this.errors.hourly_rate = '请填写正确的课时费'
				missingFields.push('课时费')
				if (!firstErrorField) firstErrorField = 'field-hourly_rate'
				isValid = false
			}

			// 注意：所在院校和教师资历不是必填字段，已移除必填验证

			// 如果有错误，打印日志并滚动到第一个错误位置
			if (!isValid) {
				console.warn('========================================')
				console.warn('[表单验证] ❌ 验证失败，以下字段未填写:')
				missingFields.forEach((field, index) => {
					console.warn(`  ${index + 1}. ${field}`)
				})
				console.warn('当前表单值:')
				console.warn('  - 姓名:', this.formData.name || '未填写')
				console.warn('  - 教学科目:', this.formData.subjects.length > 0 ? `[${this.formData.subjects.join(', ')}]` : '未选择')
				console.warn('  - 适合年级:', this.formData.grades.length > 0 ? `[${this.formData.grades.join(', ')}]` : '未选择')
				console.warn('  - 课时费:', this.formData.hourly_rate || '0')
				console.warn('========================================')
				
				if (firstErrorField) {
				this.scrollToError(firstErrorField)
				}
				// 显示错误提示
				const errorMessages = Object.values(this.errors)
				if (errorMessages.length > 0) {
					uni.showToast({ 
						title: errorMessages[0], 
						icon: 'none',
						duration: 2000
					})
				}
			} else {
				console.log('[表单验证] ✓ 所有必填字段验证通过')
			}

			return isValid
		},
		async saveProfile() {
			if (this.saving) return
			if (!this.validateForm()) return

			try {
				if (this.useMock) {
					uni.showToast({ title: '保存成功 (模拟)', icon: 'success' })
					return
				}

				const userInfo = uni.getStorageSync('userInfo') || {}
				if (!userInfo.uid) {
					uni.showToast({ title: '请先登录', icon: 'none' })
					return
				}

				this.saving = true
				const teacherProfile = uniCloud.importObject('teacher-profile', { customUI: true })
				const res = await teacherProfile.submitProfile({
					avatar: this.formData.avatarFileId || this.formData.avatar,
					display_name: this.formData.name,
					subjects: this.formData.subjects,
					grades: this.formData.grades,
					hourly_rate: Number(this.formData.hourly_rate) || 0,
					introduction: this.formData.introduction,
					school: this.formData.school,
					experience: this.formData.experience,
					tags: this.formData.tags,
					teaching_experience: {
						years: Number(this.formData.experience_years) || 0,
						description: ''
					},
					education: this.formData.education,
					qualifications: this.formData.qualifications.map(q => ({
						name: q.name || '',
						number: q.number || '',
						image: q.image_fileId || q.image || ''
					})),
					teaching_areas: this.formData.teaching_areas
				})

				if (res.code === 0) {
					const updatedUserInfo = {
						...userInfo,
						avatar: this.formData.avatarFileId || userInfo.avatar || ''
					}
					uni.setStorageSync('userInfo', updatedUserInfo)
					
					if (res.data && res.data.status === 'no_change') {
						uni.showToast({ title: '资料未修改', icon: 'success' })
					} else {
						// 资料已提交，系统消息已发送
						uni.showToast({ 
							title: '资料保存成功', 
							icon: 'success',
							duration: 2000
						})
					}
					// 延迟返回，让用户看到成功提示
					setTimeout(() => {
						uni.navigateBack()
						// 通知首页刷新数据（如果首页有监听）
						uni.$emit('teacher-profile-updated')
					}, 1500)
				} else {
					uni.showToast({ title: res.message || '保存失败', icon: 'none' })
				}
			} catch (error) {
				console.error('保存教师资料失败:', error)
				uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
			} finally {
				this.saving = false
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

/* 必填项标注 */
.required-label {
	font-weight: 500;
	color: #333;
}
.required-star {
	color: #ff4757;
	font-size: 32rpx;
	font-weight: bold;
	margin-left: 4rpx;
}

/* 表单项样式 */
.form-item {
	min-height: 88rpx;
	transition: all 0.3s;
}
.form-input {
	border: none;
	outline: none;
	background: transparent;
}
.form-input.error-input {
	color: #ff4757;
}
.form-textarea {
	border: none;
	outline: none;
	resize: none;
	width: 100%;
}

/* 选择器样式 */
.picker-view {
	color: #333;
	min-width: 200rpx;
	text-align: right;
}

/* 标签样式 */
.tag-item {
	transition: all 0.3s;
	cursor: pointer;
}
.tag-default {
	background-color: #f5f5f5;
	color: #666;
	border: 2rpx solid #e0e0e0;
}
.tag-selected {
	background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
	color: #fff;
	border: 2rpx solid #4A90E2;
	box-shadow: 0 4rpx 12rpx rgba(74, 144, 226, 0.3);
}

/* 错误状态样式 */
.error-highlight {
	border: 2rpx solid #ffebee;
	background-color: #fff5f5;
}
.error-item {
	background-color: #fff5f5;
	border-radius: 8rpx;
	padding: 8rpx;
}
.error-text {
	color: #ff4757;
	font-size: 24rpx;
	margin-top: 8rpx;
	display: block;
}

/* CSS图标样式 */
.icon-warning {
	width: 40rpx;
	height: 40rpx;
	position: relative;
	display: inline-block;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-warning::before {
	content: '';
	position: absolute;
	top: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 0;
	height: 0;
	border-left: 20rpx solid transparent;
	border-right: 20rpx solid transparent;
	border-bottom: 14rpx solid currentColor;
}
.icon-warning::after {
	content: '!';
	position: absolute;
	bottom: 6rpx;
	left: 50%;
	transform: translateX(-50%);
	color: #fff;
	font-weight: bold;
	font-size: 24rpx;
	line-height: 1;
}

/* 地图预览容器 */
.map-preview-container {
	width: 100%;
	height: 300rpx;
	border-radius: 12rpx;
	overflow: hidden;
	background-color: #F5F5F5;
	margin-top: 16rpx;
}

.icon-camera {
	width: 48rpx;
	height: 48rpx;
	position: relative;
	display: inline-block;
	border: 2rpx solid currentColor;
	border-radius: 6rpx;
	background: transparent;
	box-sizing: border-box;
	overflow: visible;
}
.icon-camera::before {
	content: '';
	position: absolute;
	top: 6rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 12rpx;
	height: 8rpx;
	border: 2rpx solid currentColor;
	border-radius: 4rpx;
	background: transparent;
}
.icon-camera::after {
	content: '';
	position: absolute;
	bottom: 4rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 4rpx;
	height: 4rpx;
	background: currentColor;
	border-radius: 50%;
}
</style>