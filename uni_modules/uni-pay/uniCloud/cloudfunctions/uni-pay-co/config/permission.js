// 各接口权限配置，未配置接口表示允许任何用户访问（包括未登录用户）
// 说明：refund 由业务云对象 payment-refund / appointment-complete 校验「订单归属」后调用；
// 小程序家长端使用简易 token，无法通过 uni-id admin 鉴权，故此处不强制 admin。
module.exports = {
	// refund: 不配置 = 允许云对象间调用；真实退款权限在 payment-refund.apply 内校验 payer_id
}
