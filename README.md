miniprogram/config.js 的 apiBaseUrl 现在是本机地址：http://127.0.0.1:8080/api。
仅适合开发者工具本机联调。
真机调试请改成你后端可访问的局域网 IP 或公网地址。

真机预览/上线前必须）
用一个公网 https 域名（不能是 127.0.0.1），并在小程序后台加入“request 合法域名”。
生产环境必须走这个方式。

# WeChat Mini Program (DocAI Adaptation)

本目录已从微信官方 Demo 改造为 DocAI 业务小程序版本，并对齐 `docai-frontend` 的核心模块。

## 当前功能

- 登录 / 注册
- 工作台统计
- 文档管理（查询、上传、删除、预览、关联到 AI 对话）
- 智能填表（预览模式）
- AI 对话（支持关联文档）
- AI 写作（生成 + 润色）

## 页面结构

主要页面位于：`miniprogram/pages/docai/`

- `login` 登录注册
- `dashboard` 工作台
- `documents` 文档管理
- `autofill` 智能填表（预览）
- `chat` AI 对话
- `generate` AI 写作

## 关键配置

文件：`miniprogram/config.js`

- `apiBaseUrl`: 后端地址（默认 `http://127.0.0.1:8080/api`）
- `requestTimeout`: 接口超时时间

注意：

- 开发者工具本机调试可用 `127.0.0.1`
- 真机调试需改为可访问的局域网或公网地址
- 同时在小程序管理后台配置合法 request 域名

## 启动步骤

1. 启动后端服务（Spring Boot）并确保 `/api/*` 可访问
2. 打开微信开发者工具，导入 `WeChatMiniprogram/miniprogram`
3. 修改 `miniprogram/config.js` 中 `apiBaseUrl`
4. 编译运行，先在登录页完成账号登录

## 接口说明（已对接）

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/documents`
- `POST /api/documents/upload`
- `DELETE /api/documents/{id}`
- `GET /api/documents/stats`
- `POST /api/ai/chat`
- `POST /api/ai/generate`
- `POST /api/ai/polish`
- `POST /api/autofill/preview`

## 已知限制

- 小程序端当前“智能填表”使用预览接口（返回 JSON 统计信息）。
- 后端 `autofill/single` 返回二进制文件流，小程序 `wx.uploadFile` 直接接收该二进制流稳定性较差。
- 如需在小程序端直接下载填充后的文件，建议后端新增“先生成文件再返回下载 URL”的接口。

## 相关代码

- 全局路由与 Tab：`miniprogram/app.json`
- 请求封装：`miniprogram/utils/request.js`
- API 封装：`miniprogram/api/docai.js`
- 登录态守卫：`miniprogram/utils/auth.js`

