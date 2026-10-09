<template>
	<view class="page">
		<scroll-view scroll-y class="scroll" :scroll-into-view="scrollIntoView" scroll-with-animation>
			<text class="form-tip">审核期间不可被搜索；审核通过后展示给家长。</text>

			<view class="form-card" :class="{ 'error-highlight': errors.name || errors.avatar || errors.gender || errors.contact_mobile || errors.hourly_rate || errors.experience_years }">
				<view class="form-row" :class="{ 'error-item': errors.avatar }" id="field-avatar" @click="chooseAvatar">
					<text class="form-label">头像 <text class="req">*</text></text>
					<view class="form-right">
						<image class="avatar" :src="formData.avatar || defaultAvatar" mode="aspectFill"></image>
						<text class="form-em">{{ avatarUploading ? '上传中...' : (formData.avatar ? '点击更换证件照' : '点击上传证件照') }}</text>
					</view>
				</view>
				<text v-if="errors.avatar" class="error-text">{{ errors.avatar }}</text>

				<view class="form-row" :class="{ 'error-item': errors.name }" id="field-name">
					<text class="form-label">姓名 <text class="req">*</text></text>
					<input class="form-input" :class="{ 'error-input': errors.name }" v-model.trim="formData.name" placeholder="请输入真实姓名" placeholder-class="ph" @input="clearError('name')" />
				</view>
				<text v-if="errors.name" class="error-text">{{ errors.name }}</text>

				<view class="form-row" :class="{ 'error-item': errors.gender }" id="field-gender">
					<text class="form-label">性别 <text class="req">*</text></text>
					<view class="seg">
						<text class="seg-item" :class="{ on: formData.gender === 'male' }" @click="selectGender('male')">男</text>
						<text class="seg-item" :class="{ on: formData.gender === 'female' }" @click="selectGender('female')">女</text>
					</view>
				</view>
				<text v-if="errors.gender" class="error-text">{{ errors.gender }}</text>

				<view class="form-row" :class="{ 'error-item': errors.contact_mobile }" id="field-contact-mobile">
					<text class="form-label">联系手机 <text class="req">*</text></text>
					<input class="form-input" :class="{ 'error-input': errors.contact_mobile }" v-model="formData.contact_mobile" type="number" maxlength="11" placeholder="方便联系的手机号" placeholder-class="ph" @input="clearError('contact_mobile')" />
				</view>
				<text v-if="errors.contact_mobile" class="error-text">{{ errors.contact_mobile }}</text>

				<view class="form-row" :class="{ 'error-item': errors.hourly_rate }" id="field-hourly_rate">
					<text class="form-label">课时费 <text class="req">*</text></text>
					<view class="form-right">
						<text class="form-em">¥</text>
						<input class="form-input rate" :class="{ 'error-input': errors.hourly_rate }" type="number" v-model.number="formData.hourly_rate" placeholder="元/小时" placeholder-class="ph" @input="clearError('hourly_rate')" />
					</view>
				</view>
				<text v-if="errors.hourly_rate" class="error-text">{{ errors.hourly_rate }}</text>

				<view class="form-row last" :class="{ 'error-item': errors.experience_years }" id="field-experience-years">
					<text class="form-label">教龄 <text class="req">*</text></text>
					<input class="form-input" :class="{ 'error-input': errors.experience_years }" type="number" v-model.number="formData.experience_years" placeholder="请输入教龄（年）" placeholder-class="ph" @input="clearError('experience_years')" />
				</view>
				<text v-if="errors.experience_years" class="error-text">{{ errors.experience_years }}</text>
			</view>

			<view class="section-card" :class="{ 'error-highlight': errors.subjects }" id="field-subjects">
				<text class="section-title">教学科目 <text class="req">*</text></text>
				<view class="tags">
					<text
						v-for="subject in subjectOptions"
						:key="subject.value"
						class="chip"
						:class="{ on: formData.subjects.includes(subject.value) }"
						@click="toggleSubject(subject.value)"
					>{{ subject.label }}</text>
				</view>
				<text v-if="errors.subjects" class="error-text">{{ errors.subjects }}</text>
			</view>

			<view v-if="!isFullTimeTeacher" class="section-card" :class="{ 'error-highlight': errors.grades }" id="field-grades">
				<text class="section-title">适合年级 <text class="req">*</text></text>
				<view class="tags">
					<text
						v-for="grade in gradeOptions"
						:key="grade"
						class="chip"
						:class="{ on: formData.grades.includes(grade) }"
						@click="toggleGrade(grade)"
					>{{ grade }}</text>
				</view>
				<text v-if="errors.grades" class="error-text">{{ errors.grades }}</text>
			</view>

			<view class="section-card" :class="{ 'error-highlight': errors.introduction }" id="field-introduction">
				<text class="section-title">自我介绍 <text class="req">*</text>（600字）</text>
				<textarea
					class="intro-input"
					:class="{ 'error-input': errors.introduction }"
					v-model.trim="formData.introduction"
					maxlength="600"
					placeholder="从教学经验、教学特色、擅长领域等角度介绍自己，建议不少于60字"
					:show-confirm-bar="false"
					:cursor-spacing="24"
					placeholder-class="ph"
					@input="clearError('introduction')"
				/>
				<text v-if="errors.introduction" class="error-text">{{ errors.introduction }}</text>
			</view>

			<view class="form-card">
				<view class="form-row" id="field-school">
					<text class="form-label">是否在读</text>
					<picker :range="schoolOptions" range-key="label" @change="onSchoolChange">
						<text class="form-em">{{ getSchoolLabel(formData.school) || '请选择' }}</text>
					</picker>
				</view>
				<view class="form-row" id="field-experience">
					<text class="form-label">教师资历</text>
					<picker :range="filteredExperienceOptions" range-key="label" @change="onExperienceChange">
						<text class="form-em">{{ getExperienceLabel(formData.experience) || '请选择' }}</text>
					</picker>
				</view>
				<view class="form-row">
					<text class="form-label">最高学历</text>
					<picker :range="degreeOptions" @change="onDegreeChange">
						<text class="form-em">{{ formData.education.degree || '请选择' }}</text>
					</picker>
				</view>
				<view class="form-row">
					<text class="form-label">专业</text>
					<input class="form-input" v-model.trim="formData.education.major" placeholder="请输入专业" placeholder-class="ph" />
				</view>
				<view class="form-row last">
					<text class="form-label">毕业年份</text>
					<input class="form-input" type="number" v-model.number="formData.education.graduation_year" placeholder="如：2018" placeholder-class="ph" />
				</view>
			</view>

			<view class="section-card">
				<text class="section-title">附加标签</text>
				<view class="tags">
					<text
						v-for="tag in tagOptions"
						:key="tag.value"
						class="chip"
						:class="{ on: formData.tags.includes(tag.value) }"
						@click="toggleTag(tag.value)"
					>{{ tag.label }}</text>
				</view>
			</view>

			<view class="section-card">
				<view class="section-head">
					<text class="section-title">教学地区</text>
					<text class="section-more" @click="addTeachingArea">+ 添加</text>
				</view>
				<view v-if="formData.teaching_areas.length">
					<view v-for="(area, index) in formData.teaching_areas" :key="index" class="area-block">
						<view class="form-row last" @click="handleChooseLocation(index)">
							<text class="form-label">地址</text>
							<text class="form-em">{{ getAreaDisplay(area) || '点击选择地址' }}</text>
						</view>
						<view v-if="area.latitude && area.longitude" class="map-preview">
							<map
								:latitude="parseFloat(area.latitude)"
								:longitude="parseFloat(area.longitude)"
								:markers="getAreaMarkers(area, index)"
								:scale="15"
								:show-location="true"
								style="width: 100%; height: 240rpx;"
								@tap="handleOpenAreaLocation(index)"
							></map>
						</view>
						<text v-if="formData.teaching_areas.length > 1" class="danger-link" @click="removeTeachingArea(index)">删除</text>
					</view>
				</view>
				<text v-else class="empty-line">暂未添加教学地区</text>
			</view>

			<view class="section-card" :class="{ 'error-highlight': errors.qualifications }" id="field-qualifications">
				<view class="section-head">
					<text class="section-title">资质证书 <text class="req">*</text>（至少 1 张）</text>
					<text class="section-more" @click="addQualification">+ 添加</text>
				</view>
				<text class="hint">请先前往官方查询页面核验，再截图上传。至少上传 1 张截图。</text>
				<view class="tags">
					<text
						v-for="link in verificationLinks"
						:key="link.url"
						class="chip"
						@click="openVerificationLink(link)"
					>{{ link.title }}</text>
				</view>
				<view v-if="formData.qualifications.length">
					<view v-for="(q, index) in formData.qualifications" :key="index" class="cert-block">
						<input class="form-input left" v-model.trim="q.name" placeholder="证书名称，例如：教师资格证" placeholder-class="ph" />
						<input class="form-input left" v-model.trim="q.number" placeholder="证书编号（可选）" placeholder-class="ph" />
						<view class="upload-box" @click="uploadQualificationImage(index)">
							<image v-if="q.image" class="cert-img" :src="q.image" mode="aspectFit"></image>
							<text v-else class="form-em">上传截图</text>
							<text v-if="q.image" class="remove-img" @click.stop="removeQualificationImage(index)">删除图片</text>
						</view>
						<text class="danger-link" @click="removeQualification(index)">删除证书</text>
					</view>
				</view>
				<text v-else class="empty-line">请至少添加 1 条资质材料并上传截图</text>
				<text v-if="errors.qualifications" class="error-text">{{ errors.qualifications }}</text>
			</view>

			<view class="form-card">
				<text class="section-title inner">联系管理员</text>
				<text class="hint">资料或审核遇到问题，可复制微信号沟通，备注「教师入驻 + 姓名」。</text>
				<view class="form-row last" @click="copyAdminWechat">
					<text class="form-label">微信</text>
					<text class="code-pill">{{ adminWechat }} 复制</text>
				</view>
			</view>

			<view class="scroll-spacer"></view>
		</scroll-view>

		<view class="action-bar">
			<button class="save-btn" :loading="saving" @click="saveProfile">保存资料</button>
		</view>
	</view>
</template>

<script>
import { mockTeachers, useMockData } from '@/utils/mockData.js'
import { getDefaultAvatarUrl } from '@/utils/imageConfig.js'
import { 
	chooseLocation, 
	openLocation, 
	requestLocationPermission 
} from '@/utils/location.js'
import { wxCheckLocalImageBeforeUpload } from '../utils/wxContentSecurity.js'

const defaultAvatar = getDefaultAvatarUrl()

export default {
	name: 'TeacherProfileEdit',
	data() {
		return {
			formData: {
				avatar: '',
				avatarFileId: '',
				name: '',
				gender: '', // 性别（必填）：male / female
				contact_mobile: '', // 联系手机号（必填），供家长/后台联系
				introduction: '',
				subjects: [],
				grades: [],
				hourly_rate: 0,
				experience_years: 0,
				school: '',           // 是否在读（存院校/专职已毕业等枚举值）
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
			degreeOptions: ['高中', '大专', '本科', '本科在读', '硕士', '硕士研究生在读', '博士', '博士研究生在读'],
			// 是否在读选项（在读院校 / 专职已毕业）
			schoolOptions: [
				{ label: '四川大学', value: '四川大学' },
				{ label: '电子科技大学', value: '电子科技大学' },
				{ label: '西南交通大学', value: '西南交通大学' },
				{ label: '四川农业大学', value: '四川农业大学' },
				{ label: '西南财经大学', value: '西南财经大学' },
				{ label: '其他985/211', value: '其他985/211' },
				{ label: '专职老师（已毕业）', value: '专职老师（已毕业）' }
			],
			// 在校学生资历选项
			studentExperienceOptions: [
				{ label: '大一（高考刚结束）', value: '大一（高考刚结束）' },
				{ label: '大二至大四（1年以内）', value: '大二至大四（1年以内）' },
				{ label: '大二至大四（1-2年）', value: '大二至大四（1-2年）' },
				{ label: '大二至大四（2年以上）', value: '大二至大四（2年以上）' },
				{ label: '研究生在读', value: '研究生在读' },
				{ label: '博士在读', value: '博士在读' }
			],
			// 专职教师资历选项
			fullTimeExperienceOptions: [
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
			verificationLinks: [
				{ title: '学籍查询', url: 'https://my.chsi.com.cn/archive/index.action' },
				{ title: '学历查询', url: 'https://www.chsi.com.cn/xlcx/index.jsp' },
				{ title: '教师资格证查询', url: 'https://sso1.jszg.edu.cn/sso/websitelogin.html' }
			],
			useMock: false,
			saving: false,
			defaultAvatar,
			avatarUploading: false,
			qualificationUploading: false,
			adminWechat: 'chen18148503231'
		}
	},
	computed: {
		isFullTimeTeacher() {
			return this.isFullTimeTeacherSchool(this.formData.school)
		},
		filteredExperienceOptions() {
			return this.isFullTimeTeacher ? this.fullTimeExperienceOptions : this.studentExperienceOptions
		}
	},
	onLoad() {
		this.useMock = useMockData() === true
		this.loadProfile()
	},
	methods: {
		isFullTimeTeacherSchool(school) {
			return school === '专职老师' || school === '专职老师（已毕业）'
		},
		normalizeSchoolValue(school) {
			// 旧值「专职老师」统一展示/保存为「专职老师（已毕业）」
			return school === '专职老师' ? '专职老师（已毕业）' : (school || '')
		},
		async loadProfile() {
			try {
				if (this.useMock) {
					await new Promise(resolve => setTimeout(resolve, 200))
					const teacher = mockTeachers[0]
					// 兼容旧数据：如果 school 字段为空但 education.school 有值，则使用 education.school
					const schoolValue = this.normalizeSchoolValue(teacher.school || teacher.education?.school || '')
					
					const defaultAvatarData = this.resolveAvatarData(teacher.avatar || '', {})
				this.formData = {
					avatar: defaultAvatarData.avatar,
					avatarFileId: defaultAvatarData.avatarFileId,
					name: teacher.display_name || teacher.name || '',
					gender: teacher.gender || '',
					contact_mobile: teacher.contact_mobile || '',
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
					const isFullTime = this.isFullTimeTeacherSchool(p.school || p.education?.school || '')
					if (!isFullTime && (!p.grades || !Array.isArray(p.grades) || p.grades.length === 0)) {
						missingFields.push('grades')
						missingFieldsText.push('适合年级')
					}
					if (!p.hourly_rate || Number(p.hourly_rate) <= 0) {
						missingFields.push('hourly_rate')
						missingFieldsText.push('课时费')
					}
					if (!p.teaching_experience?.years || Number(p.teaching_experience.years) <= 0) {
						missingFields.push('experience_years')
						missingFieldsText.push('教龄')
					}
					if (!p.introduction || !String(p.introduction).trim()) {
						missingFields.push('introduction')
						missingFieldsText.push('自我介绍')
					}
					const qualificationHasImage = Array.isArray(p.qualifications) && p.qualifications.some(item => item && item.image)
					if (!qualificationHasImage) {
						missingFields.push('qualifications')
						missingFieldsText.push('资质证书截图')
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
					const resolvedAvatar = this.resolveAvatarData(p.avatar || '', userInfo)
					let avatarUrl = resolvedAvatar.avatar
					const avatarFileId = resolvedAvatar.avatarFileId
					if (avatarFileId && !avatarFileId.startsWith('http')) {
						avatarUrl = await this.getTempFileURL(avatarFileId)
					}
					
					// 兼容旧数据：如果 school 字段为空但 education.school 有值，则使用 education.school
					const schoolValue = this.normalizeSchoolValue(p.school || p.education?.school || '')
					const isFullTimeProfile = this.isFullTimeTeacherSchool(schoolValue)
					
				this.formData = {
					avatar: avatarUrl,
					avatarFileId,
					name: p.display_name || p.name || '',
					gender: p.gender || '',
					contact_mobile: p.contact_mobile || '',
					introduction: p.introduction || '',
						subjects: p.subjects || [],
						grades: isFullTimeProfile ? [] : (p.grades || []),
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
		resolveAvatarData(profileAvatar, userInfo = {}) {
			const wxAvatar = userInfo.avatar || userInfo.wx_avatarUrl || ''
			if (profileAvatar) {
				return {
					avatar: profileAvatar,
					avatarFileId: profileAvatar
				}
			}
			if (wxAvatar) {
				return {
					avatar: wxAvatar,
					avatarFileId: ''
				}
			}
			return {
				avatar: '',
				avatarFileId: ''
			}
		},
		chooseAvatar() {
			uni.chooseImage({
				count: 1,
				sizeType: ['compressed'],
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
				try {
					await wxCheckLocalImageBeforeUpload(localPath)
				} catch (secErr) {
					uni.showToast({ title: (secErr && secErr.message) || '图片未通过安全检测', icon: 'none' })
					return
				}
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
		selectGender(gender) {
			if (gender !== 'male' && gender !== 'female') return
			this.formData.gender = gender
			this.clearError('gender')
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
			const prevSchool = this.formData.school
			const newSchool = this.schoolOptions[idx]?.value || ''
			const prevFullTime = this.isFullTimeTeacherSchool(prevSchool)
			const nowFullTime = this.isFullTimeTeacherSchool(newSchool)
			this.formData.school = newSchool
			if (nowFullTime) {
				this.formData.grades = []
				this.clearError('grades')
				if (this.formData.experience && !String(this.formData.experience).startsWith('专职老师')) {
					this.formData.experience = ''
				}
			} else if (prevFullTime && this.formData.experience && String(this.formData.experience).startsWith('专职老师')) {
				this.formData.experience = ''
			}
			this.clearError('school')
		},
		onExperienceChange(event) {
			const idx = Number(event.detail.value)
			this.formData.experience = this.filteredExperienceOptions[idx]?.value || ''
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
			const normalized = this.normalizeSchoolValue(value)
			const option = this.schoolOptions.find(opt => opt.value === normalized)
			return option ? option.label : (normalized || '')
		},
		getExperienceLabel(value) {
			const allOptions = [...this.studentExperienceOptions, ...this.fullTimeExperienceOptions]
			const option = allOptions.find(opt => opt.value === value)
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
			this.clearError('qualifications')
		},
		removeQualification(index) {
			this.formData.qualifications.splice(index, 1)
			this.clearError('qualifications')
		},
		openVerificationLink(link) {
			if (!link || !link.url) return
			uni.showModal({
				title: link.title || '官方查询',
				content: '该官方页面在小程序发布版中可能无法直接打开。点击“复制链接”后，请粘贴到手机浏览器中打开，查询完成后再返回上传截图。',
				confirmText: '复制链接',
				cancelText: '取消',
				success: (res) => {
					if (!res.confirm) return
					uni.setClipboardData({
						data: link.url,
						success: () => {
							uni.showToast({
								title: '链接已复制',
								icon: 'success'
							})
						}
					})
				}
			})
		},
		copyAdminWechat() {
			uni.setClipboardData({
				data: this.adminWechat,
				success: () => {
					uni.showToast({
						title: '微信号已复制',
						icon: 'success'
					})
				}
			})
		},
		uploadQualificationImage(index) {
			uni.chooseImage({
				count: 1,
				sizeType: ['compressed'],
				success: async (res) => {
					const localPath = res.tempFilePaths?.[0]
					if (!localPath) return
					if (this.useMock) {
						try {
							await wxCheckLocalImageBeforeUpload(localPath)
						} catch (secErr) {
							uni.showToast({ title: (secErr && secErr.message) || '图片未通过安全检测', icon: 'none' })
							return
						}
						this.formData.qualifications[index].image = localPath
						this.formData.qualifications[index].image_fileId = localPath
						this.clearError('qualifications')
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
				try {
					await wxCheckLocalImageBeforeUpload(localPath)
				} catch (secErr) {
					uni.showToast({ title: (secErr && secErr.message) || '图片未通过安全检测', icon: 'none' })
					return
				}
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
					this.clearError('qualifications')
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
			this.clearError('qualifications')
		},
		hasQualificationImage() {
			return Array.isArray(this.formData.qualifications) && this.formData.qualifications.some(q => q && (q.image || q.image_fileId))
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

			// 验证头像（必填，要求本人证件照或自拍照）
			if (!this.formData.avatar || !String(this.formData.avatar).trim()) {
				this.errors.avatar = '请上传本人证件照或自拍照'
				missingFields.push('本人头像')
				if (!firstErrorField) firstErrorField = 'field-avatar'
				isValid = false
			}

			// 验证姓名
			if (!this.formData.name || !this.formData.name.trim()) {
				this.errors.name = '请填写姓名'
				missingFields.push('姓名')
				if (!firstErrorField) firstErrorField = 'field-name'
				isValid = false
			}

			// 验证性别
			if (this.formData.gender !== 'male' && this.formData.gender !== 'female') {
				this.errors.gender = '请选择性别'
				missingFields.push('性别')
				if (!firstErrorField) firstErrorField = 'field-gender'
				isValid = false
			}

			// 验证联系手机号（家长/后台通过手机号联系，必填）
			const mobileReg = /^1[3-9]\d{9}$/
			const mobileVal = this.formData.contact_mobile ? String(this.formData.contact_mobile).trim() : ''
			if (!mobileVal) {
				this.errors.contact_mobile = '请填写联系手机号'
				missingFields.push('联系手机号')
				if (!firstErrorField) firstErrorField = 'field-contact-mobile'
				isValid = false
			} else if (!mobileReg.test(mobileVal)) {
				this.errors.contact_mobile = '手机号格式不正确'
				missingFields.push('手机号格式不正确')
				if (!firstErrorField) firstErrorField = 'field-contact-mobile'
				isValid = false
			}

			// 验证教学科目
			if (!this.formData.subjects || this.formData.subjects.length === 0) {
				this.errors.subjects = '请选择至少一个教学科目'
				missingFields.push('教学科目')
				if (!firstErrorField) firstErrorField = 'field-subjects'
				isValid = false
			}

			// 在校学生需填写适合年级；专职教师无需填写
			if (!this.isFullTimeTeacher && (!this.formData.grades || this.formData.grades.length === 0)) {
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
			} else if (Number(this.formData.hourly_rate) < 120) {
				this.errors.hourly_rate = '课时费不能低于120元/小时'
				missingFields.push('课时费')
				if (!firstErrorField) firstErrorField = 'field-hourly_rate'
				isValid = false
			}

			if (!this.formData.experience_years || Number(this.formData.experience_years) <= 0) {
				this.errors.experience_years = '请填写教龄'
				missingFields.push('教龄')
				if (!firstErrorField) firstErrorField = 'field-experience-years'
				isValid = false
			}

			if (!this.formData.introduction || !this.formData.introduction.trim()) {
				this.errors.introduction = '请填写自我介绍'
				missingFields.push('自我介绍')
				if (!firstErrorField) firstErrorField = 'field-introduction'
				isValid = false
			}

			if (!this.hasQualificationImage()) {
				this.errors.qualifications = '请至少上传 1 张资质证书截图'
				missingFields.push('资质证书截图')
				if (!firstErrorField) firstErrorField = 'field-qualifications'
				isValid = false
			}

			// 注意：是否在读和教师资历不是必填字段，已移除必填验证

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
					gender: this.formData.gender,
					contact_mobile: String(this.formData.contact_mobile || '').trim(),
					subjects: this.formData.subjects,
					grades: this.isFullTimeTeacher ? [] : this.formData.grades,
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
					} else if (res.data && res.data.status === 'price_updated') {
						uni.showToast({ title: '课时费已更新', icon: 'success' })
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
						// 通知首页刷新数据（如果首页有监听）
						uni.$emit('teacher-profile-updated')
						// 有上一页则返回；首次被强制跳转到此页时没有上一页，reLaunch 到教师工作台
						const pages = getCurrentPages()
						if (pages && pages.length > 1) {
							uni.navigateBack({
								delta: 1,
								fail: () => {
									uni.reLaunch({ url: '/pages-teacher/index/index' })
								}
							})
						} else {
							uni.reLaunch({ url: '/pages-teacher/index/index' })
						}
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
.page {
	min-height: 100vh;
	background: #F4F6F9;
}

.scroll {
	height: calc(100vh - 140rpx);
}

.form-tip {
	display: block;
	padding: 20rpx 32rpx 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.form-card,
.section-card {
	margin: 0 32rpx 24rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.form-card {
	padding: 8rpx 32rpx 16rpx;
}

.section-card {
	padding: 28rpx 32rpx;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8rpx;
}

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.section-title.inner {
	padding-top: 16rpx;
}

.section-more {
	font-size: 24rpx;
	color: #2563EB;
}

.req {
	color: #FA5151;
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

.form-right {
	display: flex;
	align-items: center;
	gap: 12rpx;
	min-width: 0;
}

.form-em {
	font-size: 26rpx;
	color: #8B919C;
	text-align: right;
}

.form-input {
	flex: 1;
	min-width: 0;
	text-align: right;
	font-size: 28rpx;
	color: #1F2329;
}

.form-input.left {
	text-align: left;
	width: 100%;
	flex: none;
	margin-bottom: 12rpx;
	padding: 16rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}

.form-input.rate {
	width: 160rpx;
	flex: none;
}

.ph {
	color: #C5C8CE;
}

.avatar {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background: #93B4FF;
}

.seg {
	display: flex;
	gap: 12rpx;
}

.seg-item {
	min-width: 88rpx;
	height: 56rpx;
	padding: 0 24rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	color: #5C6370;
	font-size: 26rpx;
	line-height: 56rpx;
	text-align: center;
}

.seg-item.on {
	background: #EEF3FF;
	color: #2563EB;
	font-weight: 600;
}

.tags {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 16rpx;
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

.intro-input {
	width: 100%;
	min-height: 220rpx;
	margin-top: 16rpx;
	padding: 20rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	font-size: 26rpx;
	color: #1F2329;
	line-height: 1.6;
	box-sizing: border-box;
}

.hint {
	display: block;
	margin: 12rpx 0 8rpx;
	font-size: 24rpx;
	color: #8B919C;
	line-height: 1.5;
}

.empty-line {
	display: block;
	margin-top: 12rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.area-block,
.cert-block {
	margin-top: 16rpx;
	padding-top: 8rpx;
	border-top: 1rpx solid #F3F4F6;
}

.map-preview {
	margin-top: 12rpx;
	border-radius: 16rpx;
	overflow: hidden;
	background: #F4F6F9;
}

.upload-box {
	margin: 12rpx 0;
	min-height: 200rpx;
	border: 2rpx dashed #EBEDF0;
	border-radius: 16rpx;
	background: #F8FAFC;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	position: relative;
	padding: 16rpx;
}

.cert-img {
	width: 100%;
	max-height: 360rpx;
}

.remove-img {
	margin-top: 12rpx;
	font-size: 22rpx;
	color: #FA5151;
}

.danger-link {
	display: inline-block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #FA5151;
}

.code-pill {
	height: 56rpx;
	padding: 0 20rpx;
	border-radius: 16rpx;
	background: #EEF3FF;
	color: #2563EB;
	font-size: 22rpx;
	font-weight: 600;
	line-height: 56rpx;
}

.error-highlight {
	box-shadow: 0 0 0 2rpx #FFD0D0;
}

.error-item {
	background: #FFF8F8;
}

.error-text {
	display: block;
	padding-bottom: 12rpx;
	font-size: 22rpx;
	color: #FA5151;
}

.error-input {
	color: #FA5151;
}

.scroll-spacer {
	height: 40rpx;
}

.action-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
	background: #FFFFFF;
	border-top: 1rpx solid #EBEDF0;
	z-index: 20;
}

.save-btn {
	height: 88rpx;
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
