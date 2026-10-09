<script>
import { checkPendingTrialConfirmReminder } from '@/utils/trialConfirmReminder.js'
import { bindPushClientId, setupChatPushListener, refreshChatBadge } from '@/utils/chatPush.js'
import { syncOaBind } from '@/utils/oaBind.js'
import { promptFollowOfficialAccount } from '@/utils/oaFollow.js'

export default {
	onLaunch: function () {
		console.log('[App] Launch → 初始化 push 监听与 cid 绑定')
		setupChatPushListener()
		bindPushClientId().then((ok) => {
			console.log('[App] 启动绑定 cid 结果=', ok)
		})
		syncOaBind({ force: true })
	},
	onShow: function () {
		console.log('[App] Show → 重新绑定 cid，拉取一次未读')
		bindPushClientId().then((ok) => {
			console.log('[App] Show 绑定 cid 结果=', ok)
		})
		if (uni.getStorageSync('uni_id_token')) {
			refreshChatBadge('app-show')
		}
		// 关注服务号后回到小程序时补绑 openid，否则新关注用户收不到模板通知
		syncOaBind().then(() => {
			// 未绑定时提示关注；会等到离开启动页再弹，避免被 reLaunch 冲掉
			promptFollowOfficialAccount({ delayMs: 400 })
		})
		setTimeout(() => {
			checkPendingTrialConfirmReminder()
		}, 600)
	},
	onHide: function () {
		console.log('App Hide')
	}
}
</script>

<style>
	/*每个页面公共css */
	/* #ifndef APP-PLUS-NVUE */
	/* 自定义图标库 */
	@import "/common/icon.css";
	/* UI基础库 */
	@import "/common/zcm-main.css";
	/* #endif */
	/* 公共样式 */
	@import "/common/common.css";
</style>
