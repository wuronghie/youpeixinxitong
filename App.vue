<script>
import { checkPendingTrialConfirmReminder } from '@/utils/trialConfirmReminder.js'
import { bindPushClientId, setupChatPushListener } from '@/utils/chatPush.js'
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
		console.log('[App] Show → 重新绑定 cid')
		bindPushClientId().then((ok) => {
			console.log('[App] Show 绑定 cid 结果=', ok)
		})
		// 关注服务号后回到小程序时补绑 openid，否则新关注用户收不到模板通知
		syncOaBind().then(() => {
			// 未绑定时提示关注，并可一键跳转公众号
			promptFollowOfficialAccount({ delayMs: 1500 })
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
	/* 官方ui库 */
	@import "/common/uni.css";
	/* 第三方动画库 */
	@import "/common/animate.css";
	/* 自定义图标库 */
	@import "/common/icon.css";
	/* UI基础库 */
	@import "/common/zcm-main.css";
	/* #endif */
	/* 公共样式 */
	@import "/common/common.css";
</style>
