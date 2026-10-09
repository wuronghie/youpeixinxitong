<!-- 家长端：发布/编辑招募。云对象 recruitment-center.create / update / myList -->
<template>
	<view class="page">
		<scroll-view scroll-y class="scroll">
			<text class="form-tip">用清晰、真实的需求帮助老师判断是否匹配，提交后进入审核。最低预算不低于 120 元/小时，老师响应后按该下限缴纳信息费（下限 × 2 小时）。</text>

			<view class="form-card">
				<view class="form-row">
					<text class="form-label">辅导科目</text>
					<input
						class="form-input"
						v-model.trim="form.subject"
						placeholder="例如：数学"
						placeholder-class="ph"
					/>
				</view>
				<picker mode="selector" :range="gradeOptions" :value="gradeIndex" @change="onGrade">
					<view class="form-row">
						<text class="form-label">学生年级</text>
						<text class="form-em" :class="{ filled: !!form.student_grade }">{{ form.student_grade || '请选择' }}</text>
					</view>
				</picker>
				<view class="form-row last">
					<text class="form-label">学生性别</text>
					<text class="form-em" :class="{ filled: studentGenderText !== '与个人资料一致' }">{{ studentGenderText }}</text>
				</view>
			</view>

			<view class="choice">
				<view
					class="choice-item"
					:class="{ on: form.lesson_mode === 'online' }"
					@click="form.lesson_mode = 'online'"
				>
					<text class="choice-title">线上</text>
					<text class="choice-sub">灵活排课</text>
				</view>
				<view
					class="choice-item"
					:class="{ on: form.lesson_mode === 'offline' }"
					@click="form.lesson_mode = 'offline'"
				>
					<text class="choice-title">线下</text>
					<text class="choice-sub">支持地图选点</text>
				</view>
			</view>

			<view v-if="form.lesson_mode === 'offline'" class="section-card">
				<view class="section-head" @click="handleChooseLocation">
					<text class="section-title">上课地点</text>
					<text class="section-action">选择</text>
				</view>
				<text class="intro">{{ fullAddressDisplay || '仅展示大致位置，请选择线下辅导地址' }}</text>
				<map
					v-if="hasMapPoint"
					class="recruit-map"
					:latitude="mapCenterLat"
					:longitude="mapCenterLng"
					:markers="mapMarkers"
					:scale="16"
					:show-location="false"
					:enable-scroll="false"
					:enable-zoom="false"
				/>
				<text v-if="hasMapPoint" class="map-link" @click.stop="handleOpenLocation">在地图中打开</text>
			</view>

			<view class="section-card">
				<text class="section-title">辅导目标</text>
				<textarea
					class="intro-input"
					v-model.trim="form.goal"
					placeholder="例如：函数专题补弱，期末前追上班级进度。"
					:show-confirm-bar="false"
					:cursor-spacing="24"
					placeholder-class="ph"
				/>
				<text class="section-title extra">补充说明</text>
				<textarea
					class="intro-input short"
					v-model.trim="form.remark"
					placeholder="可补充孩子情况、希望老师风格等"
					:show-confirm-bar="false"
					:cursor-spacing="24"
					placeholder-class="ph"
				/>
			</view>

			<view class="form-card">
				<view class="form-row">
					<text class="form-label">时间偏好</text>
					<input
						class="form-input"
						v-model.trim="form.time_note"
						placeholder="周末下午优先"
						placeholder-class="ph"
					/>
				</view>
				<view class="form-row">
					<text class="form-label">最低预算</text>
					<input
						class="form-input"
						type="digit"
						v-model="form.budget_min"
						placeholder="不低于 120 元/小时"
						placeholder-class="ph"
					/>
				</view>
				<view class="form-row">
					<text class="form-label">最高预算</text>
					<input
						class="form-input"
						type="digit"
						v-model="form.budget_max"
						placeholder="选填，元/小时"
						placeholder-class="ph"
					/>
				</view>
				<view class="form-row last">
					<text class="form-label">有效期</text>
					<text class="form-val">{{ validDays }} 天</text>
				</view>
			</view>

			<view class="chips-wrap">
				<text class="chip" :class="{ on: validDays === 7 }" @click="validDays = 7">7 天</text>
				<text class="chip" :class="{ on: validDays === 14 }" @click="validDays = 14">14 天</text>
				<text class="chip" :class="{ on: validDays === 30 }" @click="validDays = 30">30 天</text>
			</view>

			<view class="scroll-spacer"></view>
		</scroll-view>

		<view class="action-bar">
			<button class="save-btn" :disabled="submitting" @click="submit">{{ submitting ? '提交中...' : (recruitmentId ? '保存并重新审核' : '提交审核') }}</button>
		</view>
	</view>
</template>

<script>
import { chooseLocation, openLocation, requestLocationPermission, parseAddress } from '@/utils/location.js'
import { getStoredUserInfo } from '@/utils/auth.js'

export default {
	data() {
		return {
			recruitmentId: '',
			gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
			gradeIndex: -1,
			validDays: 14,
			studentGender: '',
			/** 地图选点：与预约创建页一致 */
			pickPoi: {
				latitude: '',
				longitude: '',
				name: '',
				address: '',
				province: '',
				city: '',
				district: ''
			},
			form: {
				subject: '',
				student_grade: '',
				lesson_mode: 'online',
				goal: '',
				remark: '',
				time_note: '',
				budget_min: '',
				budget_max: ''
			},
			submitting: false
		}
	},
	computed: {
		studentGenderText() {
			const g = this.studentGender
			if (g === 'male' || g === 1 || g === '1') return '男'
			if (g === 'female' || g === 2 || g === '2') return '女'
			return '与个人资料一致'
		},
		hasMapPoint() {
			const p = this.pickPoi
			return !!(p.latitude && p.longitude)
		},
		/** 连贯中文地址，如：四川省成都市双流区凤凰家园（不展示经纬度） */
		fullAddressDisplay() {
			const p = this.pickPoi
			const prov = (p.province || '').trim()
			const city = (p.city || '').trim()
			const dist = (p.district || '').trim()
			const name = (p.name || '').trim()
			let addr = (p.address || '').trim()
			const admin = `${prov}${city}${dist}`

			if (addr) {
				if (admin) {
					if (addr.startsWith(admin)) {
						if (name && !addr.includes(name)) return addr + name
						return addr
					}
					const merged = admin + addr
					if (name && !merged.includes(name)) return merged + name
					return merged
				}
				let base = addr
				if (name && !base.includes(name)) base += name
				return base
			}

			if (admin && name) return admin + name
			if (admin) return admin
			if (name) return name
			return ''
		},
		mapCenterLat() {
			const v = parseFloat(this.pickPoi.latitude)
			return Number.isNaN(v) ? 0 : v
		},
		mapCenterLng() {
			const v = parseFloat(this.pickPoi.longitude)
			return Number.isNaN(v) ? 0 : v
		},
		mapMarkers() {
			if (!this.hasMapPoint) return []
			const lat = this.mapCenterLat
			const lng = this.mapCenterLng
			if (!lat && !lng) return []
			const title = (this.pickPoi.name || this.pickPoi.address || '上课地点').trim()
			return [
				{
					id: 1,
					latitude: lat,
					longitude: lng,
					title,
					width: 28,
					height: 40
				}
			]
		}
	},
	onLoad(options) {
		this.syncStudentGenderFromProfile()
		if (options.id) {
			this.recruitmentId = options.id
			uni.setNavigationBarTitle({ title: '编辑招募' })
			this.loadOne()
		}
	},
	methods: {
		syncStudentGenderFromProfile() {
			const info = getStoredUserInfo()
			const g = (info.parent_info && info.parent_info.student_gender) || ''
			if (g) this.studentGender = g
		},
		onGrade(e) {
			const i = Number(e.detail.value)
			this.gradeIndex = i
			this.form.student_grade = this.gradeOptions[i]
		},
		onValid(e) {
			this.validDays = Number(e.detail.value)
		},
		buildRegionAndLocation() {
			const p = this.pickPoi
			let province = p.province || ''
			let city = p.city || ''
			let district = p.district || ''
			const full = (p.address || '').trim()
			if (full && (!city || !province)) {
				const parsed = parseAddress(full)
				province = province || parsed.province
				city = city || parsed.city
				district = district || parsed.district
			}
			const label = (this.fullAddressDisplay || '').trim() || p.address || p.name || '地图选点'
			return {
				region: {
					province,
					city,
					district,
					name: label
				},
				location: {
					latitude: parseFloat(p.latitude),
					longitude: parseFloat(p.longitude)
				}
			}
		},
		async handleChooseLocation() {
			try {
				const ok = await requestLocationPermission()
				if (!ok) {
					uni.showToast({ title: '需要位置权限', icon: 'none' })
					return
				}
				let lat = null
				let lon = null
				if (this.pickPoi.latitude && this.pickPoi.longitude) {
					lat = parseFloat(this.pickPoi.latitude)
					lon = parseFloat(this.pickPoi.longitude)
				}
				const loc = await chooseLocation({
					latitude: lat,
					longitude: lon
				})
				const name = (loc.name != null ? String(loc.name) : '').trim()
				const address = (loc.address != null ? String(loc.address) : '').trim()
				this.pickPoi = {
					latitude: String(loc.latitude),
					longitude: String(loc.longitude),
					name,
					address,
					province: (loc.province != null ? String(loc.province) : '').trim(),
					city: (loc.city != null ? String(loc.city) : '').trim(),
					district: (loc.district != null ? String(loc.district) : '').trim()
				}
				// 微信常不返回省市区，从详细地址里尽量拆出展示用行政区
				if (address && (!this.pickPoi.city || !this.pickPoi.province)) {
					const parsed = parseAddress(address)
					if (!this.pickPoi.province) this.pickPoi.province = parsed.province || ''
					if (!this.pickPoi.city) this.pickPoi.city = parsed.city || ''
					if (!this.pickPoi.district) this.pickPoi.district = parsed.district || ''
				}
				uni.showToast({ title: '已选择地点', icon: 'success' })
			} catch (err) {
				if (err && err.message && !String(err.message).includes('取消')) {
					uni.showToast({ title: err.message || '选择失败', icon: 'none' })
				}
			}
		},
		handleOpenLocation() {
			if (!this.hasMapPoint) return
			openLocation({
				latitude: parseFloat(this.pickPoi.latitude),
				longitude: parseFloat(this.pickPoi.longitude),
				name: this.pickPoi.name || '辅导地点',
				address: this.pickPoi.address || this.pickPoi.name || ''
			})
		},
		async loadOne() {
			// 家长仅能通过列表进入编辑；简化：从云拉一条 myList 匹配（或扩展 getMyDetail）
			const rc = uniCloud.importObject('recruitment-center', { customUI: true })
			const res = await rc.myList({ tab: 'open', page: 1, pageSize: 50 })
			if (res.code !== 0) return
			const row = (res.data.list || []).find((x) => x._id === this.recruitmentId)
			if (!row) {
				uni.showToast({ title: '招募不存在', icon: 'none' })
				return
			}
			this.form.subject = row.subject
			this.form.student_grade = row.student_grade
			this.gradeIndex = this.gradeOptions.indexOf(row.student_grade)
			this.form.lesson_mode = row.lesson_mode || 'online'
			this.form.goal = row.goal || ''
			this.form.remark = row.remark || ''
			this.form.time_note = row.time_note || ''
			this.form.budget_min = row.budget_min != null ? String(row.budget_min) : ''
			this.form.budget_max = row.budget_max != null ? String(row.budget_max) : ''
			if (row.student_gender) this.studentGender = row.student_gender
			const loc = row.location || {}
			const r = row.region || {}
			let dispName = (r.name || '').trim()
			let dispAddr = ''
			const sep = ' · '
			if (dispName.includes(sep)) {
				const i = dispName.indexOf(sep)
				dispAddr = dispName.slice(i + sep.length).trim()
				dispName = dispName.slice(0, i).trim()
			} else if (dispName) {
				const admin = `${r.province || ''}${r.city || ''}${r.district || ''}`.trim()
				if (!admin || dispName.startsWith(admin)) {
					dispAddr = dispName
					dispName = ''
				}
			}
			this.pickPoi = {
				latitude: loc.latitude != null ? String(loc.latitude) : '',
				longitude: loc.longitude != null ? String(loc.longitude) : '',
				name: dispName,
				address: dispAddr,
				province: r.province || '',
				city: r.city || '',
				district: r.district || ''
			}
			if (dispAddr && (!this.pickPoi.city || !this.pickPoi.province)) {
				const parsed = parseAddress(dispAddr)
				if (!this.pickPoi.province) this.pickPoi.province = parsed.province || ''
				if (!this.pickPoi.city) this.pickPoi.city = parsed.city || ''
				if (!this.pickPoi.district) this.pickPoi.district = parsed.district || ''
			}
		},
		async submit() {
			if (this.submitting) return
			if (!this.form.subject || !this.form.student_grade) {
				uni.showToast({ title: '请填写科目和年级', icon: 'none' })
				return
			}
			if (this.form.lesson_mode === 'offline' && !this.hasMapPoint) {
				uni.showToast({ title: '请在地图上选择上课地点', icon: 'none' })
				return
			}
			const budgetMin = Number(this.form.budget_min)
			if (!Number.isFinite(budgetMin) || budgetMin < 120) {
				uni.showToast({ title: '最低预算不能低于 120 元/小时', icon: 'none' })
				return
			}
			if (this.form.budget_max !== '') {
				const budgetMax = Number(this.form.budget_max)
				if (!Number.isFinite(budgetMax) || budgetMax < budgetMin) {
					uni.showToast({ title: '最高预算不能低于最低预算', icon: 'none' })
					return
				}
			}
			this.submitting = true
			try {
				const rc = uniCloud.importObject('recruitment-center', { customUI: true })
				let region = {}
				let location = {}
				if (this.form.lesson_mode === 'offline') {
					const built = this.buildRegionAndLocation()
					region = built.region
					location = built.location
				}
				const payload = {
					subject: this.form.subject,
					student_grade: this.form.student_grade,
					lesson_mode: this.form.lesson_mode,
					region,
					location,
					goal: this.form.goal,
					remark: this.form.remark,
					time_note: this.form.time_note,
					valid_days: this.validDays,
					budget_min: budgetMin
				}
				if (this.form.budget_max !== '') payload.budget_max = Number(this.form.budget_max)

				let res
				if (this.recruitmentId) {
					res = await rc.update({ recruitment_id: this.recruitmentId, ...payload })
				} else {
					res = await rc.create(payload)
				}
				if (res.code !== 0) throw new Error(res.message)
				// 新建成功后立即记下 id，避免延迟跳转期间再次提交又走 create
				if (!this.recruitmentId && res.data && res.data.recruitment_id) {
					this.recruitmentId = res.data.recruitment_id
				}
				uni.showToast({ title: res.message || '保存成功' })
				// 成功前保持 submitting=true；用 redirect 关闭编辑页，避免返回栈里仍是「可再提交」的实例
				setTimeout(() => {
					uni.redirectTo({
						url: '/pages/recruitment/list',
						fail: () => {
							this.submitting = false
							uni.navigateBack()
						}
					})
				}, 600)
			} catch (e) {
				uni.showToast({ title: e.message || '失败', icon: 'none' })
				this.submitting = false
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
	gap: 16rpx;
}

.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1F2329;
}

.section-title.extra {
	margin-top: 24rpx;
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

.form-em {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	color: #8B919C;
	text-align: right;
}

.form-em.filled,
.form-val {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	color: #1F2329;
	text-align: right;
	font-weight: 500;
}

.form-input {
	flex: 1;
	min-width: 0;
	text-align: right;
	font-size: 28rpx;
	color: #1F2329;
}

.ph {
	color: #C5C8CE;
}

.choice {
	display: flex;
	gap: 16rpx;
	margin: 0 32rpx 24rpx;
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
	min-height: 180rpx;
	margin-top: 16rpx;
	padding: 20rpx;
	border-radius: 16rpx;
	background: #F4F6F9;
	font-size: 26rpx;
	color: #1F2329;
	line-height: 1.6;
	box-sizing: border-box;
}

.intro-input.short {
	min-height: 140rpx;
}

.recruit-map {
	width: 100%;
	height: 240rpx;
	margin-top: 16rpx;
	border-radius: 16rpx;
	overflow: hidden;
	background: #F4F6F9;
}

.map-link {
	display: inline-block;
	margin-top: 16rpx;
	font-size: 24rpx;
	font-weight: 600;
	color: #2563EB;
}

.chips-wrap {
	display: flex;
	gap: 16rpx;
	padding: 0 32rpx 8rpx;
}

.chip {
	height: 56rpx;
	padding: 0 28rpx;
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

.save-btn[disabled] {
	opacity: 0.55;
}
</style>
