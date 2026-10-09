# 微信服务号（wx-oa）配置说明

## 已启用场景

| 场景 | 模板 | 触发 |
|------|------|------|
| `check_in` | 签到成功通知 | 教师上课打卡 → 通知家长 |
| `new_chat` | 来访预约消息通知 | 聊天发消息 → 通知对方 |
| `appointment_success` | 预约成功通知 | 家长创建预约成功 → 通知家长与教师 |
| `class_remind` | 预约到场通知（44710） | 上课前 30 分钟 → 同时通知老师与家长（访客姓名=孩子名字，服务项目=课程类型/科目/时间；通知家长填教师手机号，通知教师填家长手机号） |
| `review_remind` | 来访预约消息通知（暂复用 new_chat 模板） | 下课满 21 小时未评价 → 通知家长：3 小时后将默认好评 |

## 配置项

1. `appid` / `appsecret`：服务号
2. `token` / `encodingAESKey`：消息推送（`wx-oa-push`）
3. `mpAppId`：通知跳转小程序
4. `username`：公众号**原始 ID**（`gh_` 开头），用于小程序「一键关注」打开公众号主页
5. `oaName`：展示用名称
6. `notifyType`：当前 `template`
7. `templates` / `templateDataKeys`：各场景模板 ID 与字段映射

### 一键关注

- 小程序页：`pages/common/follow-oa`
- 家长「我的」/ 教师「常用设置」已加入口
- 接口：`wx.openOfficialAccountProfile`（基础库 ≥ 3.7.10）
- 原始 ID 获取：公众平台 → 设置与开发 → 账号设置 → 账号详情 → **原始 ID**
- 小程序后台还需：设置 → 关注公众号 → 选择该服务号（供 `official-account` 组件）

改完上传：**uni-config-center**、**wx-oa-client**、**wx-oa-notify**、**appointment-class-remind**、**appointment-review-timeout**（含定时触发器）。
