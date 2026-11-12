# CoreNyan

CoreNyan-Matrix 是 CoreNyan 的管理与聊天客户端，Web、Windows、Android 共用界面和云端账号、设置、聊天记录。

- 网站：[corenyan.fun](https://corenyan.fun)，静态前端由 GitHub Pages 托管。
- API：通过 `contracts/product.json` 中的 `serverUrl` 使用 HTTPS IP 直连。
- Windows：WinForms + 系统 WebView2，不打包 Chromium。
- Android：系统 WebView、原生文件选择、下载与通知。

## 源码结构

| 目录 | 职责 |
| --- | --- |
| `frontend/web` | 三端共享 UI、Pages 通信适配 |
| `frontend/windows` / `frontend/android` | 原生壳及平台能力 |
| `frontend/server.mjs` | HTTPS API 入口、原生客户端兼容静态服务 |
| `backend` | 登录、账号设置、文件管理、服务操作与 CHAT 转接 |
| `contracts` | 公共协议、界面配置、统一端点 |
| `tools` | 构建、资源生成与证书部署工具 |

Matrix 是现有 CoreNyan 服务栈的客户端与管理层。完整后端还依赖独立部署的 Brain、Gateway、Redis 及其内部 RPC，不会在本仓库复制它们的私有状态。CHAT 由 Gateway 路由、Brain 执行，浏览器不直接调用模型供应商。

## 开发与构建

```sh
npm ci
npm run build:pages
npm run check
npm run prepare:apps
npm run build:windows
npm run build:android
```

Pages 输出位于 `.build/pages`。推送 `main` 后，GitHub Actions 仅将公共 UI 与 contracts 部署到 Pages，不会上传 backend。

Windows 构建需要 .NET Framework 4.8 编译器、WebView2 SDK（`WEBVIEW2_SDK`）、带中文语言包的 Inno Setup 6。Android 构建需要 JDK 21（`MATRIX_JAVA_HOME`）、Android SDK 35（`ANDROID_HOME`）。产物与签名材料仅保留在本地。

## 部署与数据

参见 [DEPLOYMENT.md](DEPLOYMENT.md)。公开仓库不包含真实部署配置、账号、密码、会话、上传文件、聊天记录、模型凭据和私钥。`backend/config/config.example.json` 只是路径示例。

账号与业务数据以云端为准，前端只持有登录会话。网页通知需要浏览器运行并取得权限；关闭浏览器后的后台推送尚未实现，服务端聊天任务仍会继续。
