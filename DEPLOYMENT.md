# 部署

## GitHub Pages

仓库 Pages 使用 **GitHub Actions**，工作流为 `.github/workflows/pages.yml`。`npm run build:pages` 只复制 `frontend/web` 和公共 `contracts`，生成导航页与 `CNAME`。

`contracts/product.json` 是端点唯一来源：

- `webUrl`：`https://corenyan.fun`
- `webOrigins`：精确列出允许请求 API 的网页来源；禁止通配符。
- `serverUrl`：`https://123.56.150.177:25999`

根域名 A 记录使用 GitHub Pages 的四个地址：185.199.108.153、185.199.109.153、185.199.110.153、185.199.111.153。`www` CNAME 指向 `corenyan.github.io`。DNS only。Pages 的 HTTPS 证书签发完成后启用 Enforce HTTPS。

Pages 使用 Service Worker 将原有同源 API、图片和下载地址转接到 IP 后端。会话凭据存于当前网站 IndexedDB，通过 Authorization 头发送，不写入 URL，不缓存私有响应，也不依赖第三方 Cookie。后端沿用账号、90 天活动续期、密码变更及注销撤销机制。原生客户端继续使用同源 HttpOnly Cookie。

## 云端

先部署 CoreNyan Brain/Gateway/Redis。将路径示例复制为私有的 `backend/config/config.json`，账号及 TLS 文件位于项目外 `/etc/corenyan-web`。现有部署使用 `compose.yml`，API 容器不暴露公网端口。

IP 必须有浏览器信任的 TLS 证书。Certbot 5.4+ 支持 Let’s Encrypt IP 短期证书，签发需允许 TCP 80 的 HTTP-01 验证：

```sh
certbot certonly --standalone --preferred-profile shortlived --ip-address 123.56.150.177 --cert-name matrix-ip
```

证书只有约六天有效期，必须自动续期。部署钩子运行 `python3 tools/deploy-ip-certificate.py`，仅将正式 `matrix-ip` 证书写入项目外 TLS 目录，保留文件挂载 inode。HTTPS 入口每 30 秒观察证书变化并热加载，不重启 QQ。生产环境用 systemd timer 每六小时检查续期；密钥、ACME 账户与续期状态不进入 Git。

Windows/Android 当前版本继续通过同一 IP HTTPS 入口加载共享 UI，使用系统证书信任。旧的公开证书文件仅为既有壳的兼容资源；禁止关闭 TLS 校验。

## 同步与发布纪律

1. 修改前对云端源码做本地备份并核对 SHA-256。账户、设置、聊天、上传等运行状态以云端为准。
2. 通过明确文件清单部署；测试、临时文件、构建产物与备份留在本地。
3. 云端 Matrix 变更完成后，用工作区 `scripts/sync-web-from-cloud.py` 同步回本地并验证哈希。
4. 审查本地变更，只暂存公开源码，再 commit/push 到 `CoreNyan/CoreNyan-Matrix` 的 `main`。不得以 `git add .` 代替发布清单。
5. 检查 Actions/Pages 部署结果；只有通过验证才交付。新安装包的 Release 单独处理，不由 Pages 工作流发布。

若 GitHub、证书、构建或同步失败，保留可回滚源码及验证记录，明确报告未完成部分；不得上传私有配置来绕过部署失败。
