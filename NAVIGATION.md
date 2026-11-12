# 页面与浏览历史

页面路径使用稳定标识，不随显示术语改名。支持刷新、复制链接、Alt+←/→ 与浏览器前进/后退。

| 页面 | 路径示例 |
| --- | --- |
| 总览 | `/VITALS` |
| 层矩阵 | `/LAYERS` |
| 日志控制台 | `/SYNAPSE/corenyan-brain` |
| 记忆目录 | `/CORTEX/corenyan-brain/memory` |
| 脑核配置 | `/CORTEX/corenyan-brain/endocrine` |
| Web 文件 | `/CORTEX/corenyan-web/web_src` |
| Redis 文件 | `/CORTEX/corenyan-redis/redis_src` |

文件路径、图标模式、当前图片和羁绊详情使用 URL 查询参数保存。打开详情后返回会关闭详情；按钮关闭也会回到打开前的位置。浏览历史切换时，未保存的文件草稿保留在当前页面内存中，刷新页面不保留草稿。

Redis 默认读取相邻 `Redis` 目录，可通过后端 `config/config.json` 的 `paths.redisRoot` 指定其他本地目录。这里展示配置、程序与数据文件，并非 Redis 键值数据库浏览器。二进制文件可下载和管理，不通过文本编辑器保存。

羁绊 API 的 `topBonds` 保留字段名兼容现有客户端，返回完整摘要；界面每页显示 24 条，支持姓名、ID、QQ 和游戏名搜索。解析失败的档案有明确错误提示，不再静默排除。

验证：`npm test`、`npm run test:browser`、`npm run test:live`。实机检查只读取真实文件；变更与回收操作在独立测试数据上验证。
