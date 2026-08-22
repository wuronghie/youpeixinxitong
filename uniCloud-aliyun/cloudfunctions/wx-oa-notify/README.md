# 服务号模板消息

## 上传

1. 公共模块：`uni-config-center`、`wx-oa-client`（随依赖上传）
2. 云对象：`wx-oa-notify`、`payment-create`

## 配置模板

1. 服务号后台申请「支付成功」类模板，复制 `template_id`
2. 写入 `uni-config-center/wx-oa/config.json`：

```json
"templates": {
  "order_paid": "你的模板ID"
}
```

3. 按模板里**实际字段名**改 `templateDataKeys.order_paid`  
   （默认示例：`thing2/character_string1/amount3/time4`，以你后台为准）
4. 再上传 `uni-config-center`

## 自测

云对象 `wx-oa-notify` → 调用 `testSendToMe`（需小程序已登录，且已关注并绑定 `wx_openid.h5`）

成功后手机服务号会话会收到卡片。

## 业务接入

支付成功（`payment-create` → `handlePaySuccess`）已自动尝试发送 `order_paid`。  
未关注 / 未配模板会跳过并打日志，不影响支付。
