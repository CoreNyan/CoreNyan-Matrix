# 聊天欢迎语

`chat-welcome.json` 的 `titles`、`subtitles` 分别随机，不按下标配对。原有字符串仍有效；带条件的条目使用：

```json
{"text":"{greeting}，{user}，早饭吃了吗？","when":{"time":["morning"],"weekdays":[1,2,3,4,5]},"weight":4}
```

同一字段内任选其一，不同字段必须同时满足。`weight` 是相对抽取权重，默认 1，最高 100。连续两次尽量不重复。

支持的条件：

- `time`：引用 `timePresets` 的名称；`from`/`to` 为 24 小时制，包含开始、不包含结束，支持跨午夜。
- `weather`：引用 `weatherPresets` 的名称；可按 `kinds`、`minTemperature`、`maxTemperature`、`minWindSpeed` 组合判断。
- `dates`：`MM-DD` 每年重复，`YYYY-MM-DD` 指定日期。
- `weekdays`：1–7 为周一至周日；`months`：1–12。

天气种类为 `clear`、`cloudy`、`rain`、`snow`、`fog`、`thunder`，温度单位 °C，风速单位 m/s。

变量：`{user}`、`{greeting}`、`{period}`、`{time}`、`{date}`、`{year}`、`{month}`、`{day}`、`{weekday}`、`{weather}`、`{temperature}`、`{humidity}`、`{windSpeed}`。默认使用设备时区，可用顶层 `timezone` 指定 IANA 时区，如 `Asia/Shanghai`。缺少变量或条件无效的条目不会被抽中。

CHAT 的位置按钮可启用或关闭位置共享。设备授权后，约略坐标按当前账号会话保存在服务器内存，15 分钟过期，天气来自 MET Norway 的近期预报；未授权、请求失败、过期时使用普通或时间问候。不会使用固定城市或服务器位置伪装用户天气。

`get_user_environment()` 只读本轮 CHAT 发起用户的环境，不接受目标用户参数。QQ 等未提供该能力的渠道返回不可用。IP 代表连接出口，可能是 VPN/代理；设备位置是授权上报而非经过身份验证的 GPS 事实。关闭共享影响后续请求，已发送给小可的工具结果和聊天记录不会被追溯删除。
