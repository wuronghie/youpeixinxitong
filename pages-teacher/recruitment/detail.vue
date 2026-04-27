<template>
	<view class="detail-page">
		<scroll-view v-if="detail" scroll-y class="scroll">
			<view class="page-body">
				<view class="hero-card">
					<view class="hero-header">
						<view>
							<text class="display-name">{{ detail.display_name }}</text>
							<text class="publish-meta">{{ detail.subject }} / {{ detail.student_grade }}<text v-if="studentGenderText(detail.student_gender)"> / {{ studentGenderText(detail.student_gender) }}</text> / {{ detail.lesson_mode === 'online' ? '线上' : '线下' }}</text>
						</view>
						<text class="status-badge">{{ detail.already_responded ? '已响应' : '可邀请' }}</text>
					</view>
					<view class="chip-row">
						<text class="chip">{{ detail.lesson_mode === 'online' ? '线上辅导' : '线下辅导' }}</text>
						<text v-if="detail.lesson_mode === 'offline' && locationText(detail) !== '未填写'" class="chip address-chip">{{ locationText(detail) }}</text>
						<text class="chip">{{ budgetText(detail) }}</text>
					</view>
				</view>

				<view class="section-card">
					<text class="section-title">需求概览</text>
					<view class="info-item">
						<text class="label">上课地址</text>
						<text class="value">{{ locationText(detail) }}</text>
					</view>
					<view class="info-item">
						<text class="label">时间偏好</text>
						<text class="value">{{ detail.time_note || '暂未指定，可进一步沟通' }}</text>
					</view>
					<view class="info-item">
						<text class="label">孩子性别</text>
						<text class="value">{{ studentGenderText(detail.student_gender) || '未填写' }}</text>
					</view>
					<view class="info-item multiline">
						<text class="label">辅导目标</text>
						<text class="value">{{ detail.goal || '家长暂未填写' }}</text>
					</view>
					<view class="info-item multiline">
						<text class="label">补充说明</text>
						<text class="value">{{ detail.remark || '暂无补充说明' }}</text>
					</view>
				</view>

				<view class="section-card">
					<text class="section-title">邀请说明</text>
					<view class="tips-box">
						<text class="tip-line">1. 发送试课邀请后，家长会在消息和聊天中收到通知。</text>
						<text class="tip-line">2. 若你尚未为该家长支付信息费，系统会先引导支付再发送邀请。</text>
						<text class="tip-line">3. 发送成功后，可直接进入聊天继续沟通试课安排。</text>
					</view>
				</view>
			</view>
		</scroll-view>

		<view v-else class="loading-wrap">加载中...</view>

		<view class="footer">
			<view v-if="detail" class="footer-card">
				<view class="footer-texts">
						<text class="footer-title">{{ detail.already_responded ? '继续跟进此需求' : '先建立联系，再进入聊天发送试课邀请' }}</text>
						<text class="footer-desc">{{ detail.need_deposit ? '若你还未向该家长支付信息费，需要先完成支付后才能进入聊天。' : (detail.already_responded ? '如果之前已经发过试课邀请，聊天页不会重复发送。' : '首次进入会自动建立会话与预约记录，试课邀请在聊天页发送。') }}</text>
				</view>
				<button
					v-if="!detail.already_responded"
					class="action-btn"
					:disabled="busy"
					@click="onInvite"
				>{{ busy ? '处理中...' : (detail.need_deposit ? '支付信息费并进入聊天' : '进入聊天') }}</button>
				<button
					v-else
					class="action-btn"
					:disabled="busy"
					@click="onContinue"
				>{{ busy ? '处理中...' : (detail.need_deposit ? '支付信息费并进入聊天' : '进入聊天') }}</button>
			</view>
		</view>
	</view>
</template>

<script>
import { createAndPay } from '@/utils/payment.js'

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
		async ensureDepositBeforeChat(appointmentId) {
			if (!appointmentId) {
				uni.showToast({ title: '未找到预约信息', icon: 'none' })
				return false
			}
			const payResult = await createAndPay({
				appointment_id: appointmentId,
				payment_type: 'deposit',
				amount: 100
			})
			if (payResult.code !== 0) {
				uni.showToast({ title: payResult.message || '支付未完成', icon: 'none' })
				return false
			}
			return true
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
				if (res.data.need_deposit) {
					const ok = await this.ensureDepositBeforeChat(res.data.appointment_id)
					if (!ok) return
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
				if (this.detail.need_deposit) {
					const ok = await this.ensureDepositBeforeChat(mr.appointment_id)
					if (!ok) return
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
.detail-page {
	min-height: 100vh;
	background: #f5f7fb;
}
.scroll {
	height: calc(100vh - 220rpx);
}
.page-body {
	padding: 24rpx;
	padding-bottom: 36rpx;
}
.hero-card,
.section-card,
.footer-card {
	background: #fff;
	border-radius: 28rpx;
	box-shadow: 0 10rpx 30rpx rgba(31, 42, 68, 0.06);
}
.hero-card {
	padding: 30rpx;
	background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
}
.hero-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}
.display-name {
	display: block;
	font-size: 36rpx;
	font-weight: 700;
	line-height: 1.4;
	color: #1f2a44;
}
.publish-meta {
	display: block;
	margin-top: 12rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #7c879d;
}
.status-badge {
	padding: 10rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(47, 109, 246, 0.1);
	color: #2f6df6;
	font-size: 22rpx;
	line-height: 1.4;
	font-weight: 600;
	white-space: nowrap;
}
.chip-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 24rpx;
}
.chip {
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	line-height: 1.4;
	color: #60708c;
	background: #f3f6fb;
}
.address-chip {
	max-width: 100%;
	white-space: normal;
	word-break: break-all;
}
.section-card {
	margin-top: 20rpx;
	padding: 28rpx;
}
.section-title {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	color: #1f2a44;
	margin-bottom: 18rpx;
}
.info-item {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
	padding: 18rpx 0;
	border-bottom: 1rpx solid #eef2f7;
}
.info-item:last-child {
	border-bottom: none;
}
.info-item.multiline .value {
	line-height: 1.75;
}
.label {
	width: 132rpx;
	font-size: 24rpx;
	line-height: 1.5;
	color: #96a0b3;
}
.value {
	flex: 1;
	font-size: 26rpx;
	line-height: 1.6;
	color: #33415c;
	text-align: right;
}
.tips-box {
	background: #f7f9fc;
	border-radius: 22rpx;
	padding: 22rpx 24rpx;
}
.tip-line {
	display: block;
	font-size: 24rpx;
	line-height: 1.8;
	color: #60708c;
}
.loading-wrap {
	padding-top: 240rpx;
	text-align: center;
	font-size: 26rpx;
	color: #8a95a8;
}
.footer {
	padding: 16rpx 24rpx calc(env(safe-area-inset-bottom) + 16rpx);
}
.footer-card {
	padding: 24rpx;
}
.footer-texts {
	margin-bottom: 18rpx;
}
.footer-title {
	display: block;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.4;
	color: #1f2a44;
}
.footer-desc {
	display: block;
	margin-top: 10rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #7c879d;
}
.action-btn {
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 999rpx;
	background: linear-gradient(135deg, #2f6df6 0%, #5f8dff 100%);
	color: #fff;
	font-size: 28rpx;
	font-weight: 600;
	border: none;
}
.action-btn::after {
	border: none;
}
</style>
