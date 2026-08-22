# 微信服务号推送接入步骤

## 1. 本地配置（已预填 Token）

文件：`uni-config-center/wx-oa/config.json`

- `token`：`LiyeOaNotify2026`（与公众平台填写一致）
- `appsecret`：你已填好的服务号 Secret
- `encodingAESKey`：先留空，后台选**明文模式**

上传公共模块：**uni-config-center**

## 2. 上传云函数并开启 URL 化

1. 上传云函数 `wx-oa-push`
2. 右键该云函数 → **云函数 URL 化** → 路径填 `/wx-oa-push`（若 package 已带 path 可直接看详情）
3. 复制完整 HTTPS 地址，例如：
   `https://xxxxxxxx.bspapp.com/wx-oa-push`
   或控制台显示的 URL

## 3. 微信服务号后台填写

位置：微信开发者平台 / 公众平台 → 服务号 → **消息与事件推送**

| 项 | 值 |
|----|-----|
| URL | 上一步复制的地址 |
| Token | `LiyeOaNotify2026` |
| EncodingAESKey | 明文模式可随机生成或不填（按后台要求） |
| 消息加解密方式 | **明文模式**（先联调） |
| 数据格式 | XML |

保存成功即表示 GET 校验通过。

## 4. 验证关注绑定

1. 用已登录过小程序的微信号关注服务号
2. 云数据库 `uni-id-users` 对应用户的 `wx_openid.h5` 应出现服务号 openid
3. 若用户从未用小程序登录（无 `wx_unionid`），会写入 `wx-oa-pending-bind`，需后续登录补绑

## 5. 注意

启用服务器配置后，公众平台「自动回复」可能失效，属微信机制。

## 6. 服务号 IP 白名单（必做）

云函数默认出网 IP **会变**，不能只加日志里那一个 IP。

本云函数已改为走 **固定出口 `httpProxyForEip`**。请在服务号后台
**设置与开发 → 基本配置 → IP白名单** 中一次性添加：

```text
47.92.132.2
47.92.152.34
47.92.87.58
47.92.207.183
8.142.185.204
```

（与项目里微信商家转账使用的阿里云 uniCloud 固定出口一致）

改代码后需重新上传 `wx-oa-push`，再取关/关注测试。
