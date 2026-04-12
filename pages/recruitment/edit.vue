<template>
	<view class="edit-page">
		<scroll-view scroll-y class="scroll">
			<view class="page-body">
				<view class="hero-card">
					<text class="hero-title">{{ recruitmentId ? '编辑招募' : '发布招募' }}</text>
					<text class="hero-desc">用清晰、真实的需求帮助老师更快判断是否匹配，提交后会进入审核流程。</text>
				</view>

				<view class="section-card">
					<text class="section-title">基础信息</text>
					<view class="field-block">
						<text class="field-label">辅导科目</text>
						<input class="field-input" v-model.trim="form.subject" placeholder="例如：数学、英语、物理" />
					</view>

					<view class="field-block">
						<text class="field-label">学生年级</text>
						<picker mode="selector" :range="gradeOptions" :value="gradeIndex" @change="onGrade">
							<view class="select-row">
								<text class="select-value" :class="{ placeholder: !form.student_grade }">{{ form.student_grade || '请选择年级' }}</text>
								<text class="select-arrow">选择</text>
							</view>
						</picker>
					</view>

					<view class="field-block">
						<text class="field-label">授课方式</text>
						<view class="mode-grid">
							<view
								class="mode-card"
								:class="{ active: form.lesson_mode === 'online' }"
								@click="form.lesson_mode = 'online'"
							>
								<text class="mode-title">线上</text>
								<text class="mode-desc">适合灵活排课</text>
							</view>
							<view
								class="mode-card"
								:class="{ active: form.lesson_mode === 'offline' }"
								@click="form.lesson_mode = 'offline'"
							>
								<text class="mode-title">线下</text>
								<text class="mode-desc">支持地图选点</text>
							</view>
						</view>
					</view>

					<view v-if="form.lesson_mode === 'offline'" class="field-block field-last">
						<view class="location-head" @click="handleChooseLocation">
							<view>
								<text class="field-label">上课地点</text>
								<text class="field-tip">仅展示大致位置，便于老师筛选</text>
							</view>
							<text class="select-arrow">选择</text>
						</view>
						<view v-if="addressPreviewLines.length" class="address-preview">
							<text v-for="(line, idx) in addressPreviewLines" :key="idx" class="preview-line">{{ line }}</text>
						</view>
						<text v-else class="empty-location">请选择线下辅导的大致地址</text>
						<map
							v-if="hasMapPoint"
							class="recruit-map-preview"
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
				</view>

				<view class="section-card">
					<text class="section-title">需求说明</text>
					<view class="field-block">
						<text class="field-label">辅导目标</text>
						<textarea
							class="textarea-field"
							v-model.trim="form.goal"
							placeholder="例如：提升成绩、补基础、备考冲刺等"
						/>
					</view>
					<view class="field-block">
						<text class="field-label">补充说明</text>
						<textarea
							class="textarea-field short"
							v-model.trim="form.remark"
							placeholder="可补充孩子情况、希望老师风格等"
						/>
					</view>
					<view class="field-block field-last">
						<text class="field-label">时间偏好</text>
						<input class="field-input" v-model.trim="form.time_note" placeholder="例如：周末下午、工作日晚间" />
					</view>
				</view>

				<view class="section-card">
					<text class="section-title">预算与有效期</text>
					<view class="budget-row">
						<view class="budget-box">
							<text class="field-label small">最低预算</text>
							<input class="field-input" type="digit" v-model="form.budget_min" placeholder="元/小时" />
						</view>
						<view class="budget-divider">-</view>
						<view class="budget-box">
							<text class="field-label small">最高预算</text>
							<input class="field-input" type="digit" v-model="form.budget_max" placeholder="元/小时" />
						</view>
					</view>

					<view class="field-block field-last">
						<text class="field-label">招募有效期</text>
						<view class="valid-grid">
							<view class="valid-chip" :class="{ active: validDays === 7 }" @click="validDays = 7">7 天</view>
							<view class="valid-chip" :class="{ active: validDays === 14 }" @click="validDays = 14">14 天</view>
							<view class="valid-chip" :class="{ active: validDays === 30 }" @click="validDays = 30">30 天</view>
						</view>
					</view>
				</view>
			</view>
		</scroll-view>

		<view class="footer-bar">
			<button class="submit-btn" :disabled="submitting" @click="submit">{{ submitting ? '提交中...' : (recruitmentId ? '保存并重新审核' : '提交审核') }}</button>
		</view>
	</view>
</template>

<script>
import { chooseLocation, openLocation, requestLocationPermission, parseAddress } from '@/utils/location.js'

export default {
	data() {
		return {
			recruitmentId: '',
			gradeOptions: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
			gradeIndex: -1,
			validDays: 14,
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
		addressPreviewLines() {
			const s = (this.fullAddressDisplay || '').trim()
			return s ? [s] : []
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
		if (options.id) {
			this.recruitmentId = options.id
			this.loadOne()
		}
	},
	methods: {
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
					valid_days: this.validDays
				}
				if (this.form.budget_min !== '') payload.budget_min = Number(this.form.budget_min)
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
.edit-page {
	min-height: 100vh;
	background: #f5f7fb;
}
.scroll {
	height: calc(100vh - 132rpx);
}
.page-body {
	padding: 24rpx;
	padding-bottom: 32rpx;
}
.hero-card,
.section-card {
	background: #fff;
	border-radius: 28rpx;
	box-shadow: 0 10rpx 30rpx rgba(31, 42, 68, 0.06);
}
.hero-card {
	padding: 30rpx;
	margin-bottom: 20rpx;
	background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
}
.hero-title {
	display: block;
	font-size: 38rpx;
	font-weight: 700;
	color: #1f2a44;
}
.hero-desc {
	display: block;
	margin-top: 12rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #7c879d;
}
.section-card {
	padding: 28rpx;
	margin-bottom: 20rpx;
}
.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	color: #1f2a44;
	margin-bottom: 12rpx;
}
.field-block {
	padding: 20rpx 0;
	border-bottom: 1rpx solid #eef2f7;
}
.field-last {
	border-bottom: none;
	padding-bottom: 0;
}
.field-label {
	display: block;
	font-size: 24rpx;
	font-weight: 600;
	color: #60708c;
	margin-bottom: 14rpx;
}
.field-label.small {
	margin-bottom: 10rpx;
}
.field-tip {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	line-height: 1.6;
	color: #97a2b5;
}
.field-input,
.textarea-field,
.select-row {
	width: 100%;
	box-sizing: border-box;
	background: #f6f8fc;
	border-radius: 22rpx;
	font-size: 28rpx;
	color: #1f2a44;
}
.field-input {
	height: 88rpx;
	line-height: 88rpx;
	padding: 0 24rpx;
}
.textarea-field {
	min-height: 220rpx;
	padding: 24rpx;
	line-height: 1.7;
}
.textarea-field.short {
	min-height: 160rpx;
}
.select-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
	padding: 0 24rpx;
}
.select-value.placeholder {
	color: #a3acbc;
}
.select-arrow {
	font-size: 24rpx;
	line-height: 1.2;
	color: #8d98ad;
}
.mode-grid {
	display: flex;
	gap: 16rpx;
}
.mode-card {
	flex: 1;
	padding: 26rpx 22rpx;
	border-radius: 24rpx;
	background: #f6f8fc;
	border: 2rpx solid transparent;
}
.mode-card.active {
	background: rgba(47, 109, 246, 0.08);
	border-color: rgba(47, 109, 246, 0.18);
}
.mode-title {
	display: block;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.4;
	color: #1f2a44;
}
.mode-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	line-height: 1.5;
	color: #8894aa;
}
.location-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}
.address-preview {
	background: #f7f9fc;
	border-radius: 22rpx;
	padding: 22rpx 24rpx;
	margin-top: 18rpx;
}
.preview-line {
	display: block;
	color: #33415c;
	font-size: 26rpx;
	line-height: 1.75;
	word-break: break-all;
	white-space: pre-wrap;
}
.empty-location {
	display: block;
	margin-top: 18rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: #97a2b5;
}
.recruit-map-preview {
	width: 100%;
	height: 280rpx;
	border-radius: 22rpx;
	overflow: hidden;
	background: #e8e8e8;
	margin-top: 18rpx;
}
.map-link {
	display: inline-block;
	margin-top: 16rpx;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 1.5;
	color: #2f6df6;
}
.budget-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 20rpx 0;
	border-bottom: 1rpx solid #eef2f7;
}
.budget-box {
	flex: 1;
}
.budget-divider {
	color: #a0a9bb;
	font-size: 30rpx;
	padding-top: 32rpx;
}
.valid-grid {
	display: flex;
	gap: 16rpx;
}
.valid-chip {
	flex: 1;
	text-align: center;
	padding: 22rpx 0;
	border-radius: 22rpx;
	background: #f6f8fc;
	font-size: 26rpx;
	line-height: 1.4;
	color: #72809a;
}
.valid-chip.active {
	background: #2f6df6;
	color: #fff;
	font-weight: 600;
}
.footer-bar {
	background: #fff;
	padding: 18rpx 24rpx calc(env(safe-area-inset-bottom) + 18rpx);
	box-shadow: 0 -8rpx 24rpx rgba(31, 42, 68, 0.04);
}
.submit-btn {
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 999rpx;
	background: linear-gradient(135deg, #2f6df6 0%, #5f8dff 100%);
	color: #fff;
	font-size: 28rpx;
	font-weight: 600;
	border: none;
}
.submit-btn::after {
	border: none;
}
</style>
