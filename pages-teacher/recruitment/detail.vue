<template>
	<view class="page">
		<scroll-view v-if="detail" scroll-y class="scroll">
			<view class="hero-card">
				<view class="hero-top">
					<view class="hero-main">
						<text class="hero-title">{{ detail.subject }} / {{ detail.student_grade }}</text>
						<text class="hero-sub">{{ detail.display_name }}</text>
					</view>
					<text class="status">{{ detail.already_responded ? '已响应' : '可邀请' }}</text>
				</view>
				<view class="tags">
					<text class="chip">{{ detail.lesson_mode === 'online' ? '线上' : '线下' }}</text>
					<text v-if="detail.lesson_mode === 'offline' && locationText(detail) !== '未填写'" class="chip gray">{{ locationText(detail) }}</text>
					<text v-if="studentGenderText(detail.student_gender)" class="chip gray">{{ studentGenderText(detail.student_gender) }}</text>
				</view>
				<text class="hero-goal">{{ detail.goal || detail.remark || '家长暂未填写更多说明' }}</text>
			</view>

			<view class="form-card">
				<view class="form-row">
					<text class="form-label">预算</text>
					<text class="form-value">{{ budgetText(detail) }}</text>
				</view>
				<view class="form-row">
					<text class="form-label">发布时间</text>
					<text class="form-em">{{ formatTime(detail.create_time) }}</text>
				</view>
				<view class="form-row">
					<text class="form-label">上课地址</text>
					<text class="form-em">{{ locationText(detail) }}</text>
				</view>
				<view class="form-row">
					<text class="form-label">时间偏好</text>
					<text class="form-em">{{ detail.time_note || '暂未指定，可进一步沟通' }}</text>
				</view>
				<view class="form-row">
					<text class="form-label">孩子性别</text>
					<text class="form-em">{{ studentGenderText(detail.student_gender) || '未填写' }}</text>
				</view>
				<view class="form-row">
					<text class="form-label">辅导目标</text>
					<text class="form-em">{{ detail.goal || '家长暂未填写' }}</text>
				</view>
				<view class="form-row last">
					<text class="form-label">补充说明</text>
					<text class="form-em">{{ detail.remark || '暂无补充说明' }}</text>
				</view>
			</view>

			<view class="section-card">
				<text class="section-title">邀请说明</text>
				<text class="step">1. 发送试课邀请后，家长会在消息和聊天中收到通知。</text>
				<text class="step">2. 若尚未向该家长支付信息费，进入聊天后先完成支付再发邀请。</text>
				<text class="step">3. 发送成功后，可继续在聊天中沟通试课安排。</text>
			</view>
		</scroll-view>

		<view v-else class="loading-wrap">加载中...</view>

		<view v-if="detail" class="actionbar">
			<text class="form-tip">{{ detail.need_deposit ? '未付信息费时点此进入聊天，在聊天页确认并支付；已付过则直接进入聊天。' : (detail.already_responded ? '如果之前已经发过试课邀请，聊天页不会重复发送。' : '首次进入会自动建立会话，试课邀请在聊天页发送。') }}</text>
			<button
				v-if="!detail.already_responded"
				class="btn"
				:disabled="busy"
				@click="onInvite"
			>{{ busy ? '处理中...' : (detail.need_deposit ? '支付信息费并进入聊天' : '进入聊天') }}</button>
			<button
				v-else
				class="btn"
				:disabled="busy"
				@click="onContinue"
			>{{ busy ? '处理中...' : (detail.need_deposit ? '支付信息费并进入聊天' : '进入聊天') }}</button>
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			id: '',
			detail: null,
			busy: false,
			pending: null
		}
	},
	onLoad(options) {
		this.id = options.id || ''
		this.load()
	},
	methods: {
		async refreshData() {
			await this.load()
		},
		async load() {
			if (!this.id) return
			const rc = uniCloud.importObject('recruitment-center', { customUI: true })
			const res = await rc.detailForTeacher({ recruitment_id: this.id })
			if (res.code !== 0) {
				uni.showToast({ title: res.message || '加载失败', icon: 'none' })
				return
			}
			this.detail = res.data
		},
		budgetText(row) {
			if (!row) return '预算可协商'
			if (row.budget_min != null || row.budget_max != null) {
				return `${row.budget_min || '待议'} - ${row.budget_max || '待议'} 元/小时`
			}
			return '预算可协商'
		},
		locationText(row) {
			if (!row || !row.region) return '未填写'
			const region = row.region
			const admin = `${region.province || ''}${region.city || ''}${region.district || ''}`.trim()
			const rawName = String(region.name || '').trim()
			let namePart = rawName
			let addrPart = ''
			const sep = ' · '
			if (rawName.includes(sep)) {
				const idx = rawName.indexOf(sep)
				namePart = rawName.slice(0, idx).trim()
				addrPart = rawName.slice(idx + sep.length).trim()
			}
			if (addrPart) {
				if (admin && addrPart.startsWith(admin)) return addrPart
				return `${admin}${addrPart}`.trim() || addrPart
			}
			if (rawName) {
				if (admin && rawName.startsWith(admin)) return rawName
				if (admin && namePart && !rawName.includes(namePart)) return `${admin}${namePart}`.trim()
				if (admin && namePart && rawName === namePart) return `${admin}${namePart}`.trim()
				if (rawName) return rawName
			}
			return admin || '未填写'
		},
		studentGenderText(gender) {
			if (gender === 'male' || gender === 1 || gender === '1') return '男孩'
			if (gender === 'female' || gender === 2 || gender === '2') return '女孩'
			return ''
		},
		formatTime(t) {
			if (!t) return '--'
			const d = new Date(t)
			if (Number.isNaN(d.getTime())) return '--'
			return `${d.getMonth() + 1}月${d.getDate()}日`
		},
		goChat(conversationId, appointmentId) {
			if (!conversationId) {
				uni.showToast({ title: '未找到会话', icon: 'none' })
				return
			}
			const query = [
				`conversationId=${encodeURIComponent(conversationId)}`,
				`appointmentId=${encodeURIComponent(appointmentId || '')}`,
				'inviteSource=recruitment'
			].join('&')
			uni.navigateTo({
				url: `/pages-teacher/chat/conversation?${query}`
			})
		},
		async onInvite() {
			if (this.busy || !this.id) return
			this.busy = true
			try {
				const rc = uniCloud.importObject('recruitment-center', { customUI: true })
				const res = await rc.inviteFromRecruitment({ recruitment_id: this.id })
				if (res.code !== 0) {
					uni.showToast({ title: res.message || '失败', icon: 'none' })
					return
				}
				this.goChat(res.data.conversation_id, res.data.appointment_id)
				await this.load()
			} catch (e) {
				uni.showToast({ title: e.message || '失败', icon: 'none' })
			} finally {
				this.busy = false
			}
		},
		async onContinue() {
			if (this.busy || !this.detail) return
			this.busy = true
			try {
				const mr = this.detail.my_response
				if (!mr || !mr.appointment_id || !mr.conversation_id) {
					uni.showToast({ title: '数据异常', icon: 'none' })
					return
				}
				this.goChat(mr.conversation_id, mr.appointment_id)
			} catch (e) {
				uni.showToast({ title: e.message || '失败', icon: 'none' })
			} finally {
				this.busy = false
			}
		}
	}
}
</script>

<style scoped>
.page {
	background: #F4F6F9;
	min-height: 100vh;
}

.scroll {
	height: calc(100vh - 220rpx);
	padding-bottom: 24rpx;
	box-sizing: border-box;
}

.hero-card,
.form-card,
.section-card {
	margin: 24rpx 32rpx 0;
	padding: 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(31, 35, 41, 0.04);
}

.hero-top {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
}

.hero-main {
	flex: 1;
	min-width: 0;
}

.hero-title {
	display: block;
	font-size: 36rpx;
	font-weight: 600;
	color: #1F2329;
	line-height: 1.35;
}

.hero-sub {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #8B919C;
}

.status {
	flex-shrink: 0;
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
	background: #EEF3FF;
	color: #2563EB;
	line-height: 1.4;
}

.tags {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 20rpx;
}

.chip {
	padding: 6rpx 16rpx;
	border-radius: 12rpx;
	font-size: 22rpx;
	background: #EEF3FF;
	color: #2563EB;
}

.chip.gray {
	background: #F4F6F9;
	color: #5C6370;
}

.hero-goal {
	display: block;
	margin-top: 20rpx;
	font-size: 26rpx;
	line-height: 1.6;
	color: #5C6370;
}

.form-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 24rpx;
	padding: 20rpx 0;
	border-bottom: 1rpx solid #EBEDF0;
}

.form-row.last {
	border-bottom: none;
	padding-bottom: 0;
}

.form-row:first-child {
	padding-top: 0;
}

.form-label {
	flex-shrink: 0;
	font-size: 26rpx;
	color: #8B919C;
}

.form-value,
.form-em {
	flex: 1;
	text-align: right;
	font-size: 26rpx;
	color: #1F2329;
	font-weight: 600;
	line-height: 1.5;
}

.form-em {
	font-weight: 400;
	color: #5C6370;
}

.section-title {
	display: block;
	margin-bottom: 16rpx;
	font-size: 32rpx;
	font-weight: 600;
	color: #1F2329;
}

.step {
	display: block;
	font-size: 26rpx;
	line-height: 1.7;
	color: #5C6370;
}

.step + .step {
	margin-top: 8rpx;
}

.loading-wrap {
	padding-top: 240rpx;
	text-align: center;
	font-size: 26rpx;
	color: #8B919C;
}

.actionbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 16rpx 32rpx;
	padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
	background: #FFFFFF;
	border-top: 1rpx solid #EBEDF0;
}

.form-tip {
	display: block;
	margin-bottom: 16rpx;
	font-size: 22rpx;
	line-height: 1.5;
	color: #8B919C;
}

.btn {
	width: 100%;
	height: 80rpx;
	border-radius: 20rpx;
	background: #2563EB;
	color: #FFFFFF;
	font-size: 28rpx;
	font-weight: 600;
	line-height: 80rpx;
	border: none;
}

.btn::after {
	border: none;
}

.btn[disabled] {
	background: #93B4FF;
}
</style>
