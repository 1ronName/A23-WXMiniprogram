# WeChat Mini Program (DocAI Adaptation)

本目录已从微信官方 Demo 改造为 DocAI 业务小程序版本，并已对齐当前本地可运行的 Spring Boot 后端。

## 当前功能

- 登录 / 注册
- 工作台统计
- 文档管理：查询、上传、删除、预览、关联到 AI 对话
- 智能填表：预览模式
- AI 对话：支持关联文档
- AI 写作：生成 + 润色

## 页面结构

主要页面位于 `miniprogram/pages/docai/`

- `login`：登录注册
- `dashboard`：工作台
- `documents`：文档管理
- `autofill`：智能填表（预览）
- `chat`：AI 对话

## 当前联调配置

文件：[miniprogram/config.js](/e:/A23服创赛/A23-WXMiniprogram/miniprogram/config.js#L22)

- `apiBaseUrl`：`http://127.0.0.1:8082/api`
- `requestTimeout`：`120000`

说明：

- 这里的 `8082` 是当前本地后端默认端口。
- 这个地址只适用于微信开发者工具在本机联调。
- 真机不能直接访问 `127.0.0.1`，需要改成电脑局域网 IP 或公网 HTTPS 域名。

## 本地启动步骤

### 1. 启动后端

后端项目路径：

- `cd A23服创赛\Intelligent-Document-Processing-System-former\docai\docai`

启动命令：

```powershell
//根据自己的路径运行相应文件

' cd E:\A23服创赛\Intelligent-Document-Processing-System-former\docai\docai
mvn spring-boot:run '
```

当前本地模式说明：

- 后端默认端口为 `8082`
- 后端默认使用本地 H2 文件数据库，不再依赖 MySQL
- 本地数据库文件默认位于：
  `E:\A23服创赛\Intelligent-Document-Processing-System-former\docai\docai\data\docai`

启动后可快速验证：

```text
http://127.0.0.1:8082/api/auth/me
```

未登录时返回：

```json
{"code":500,"message":"未登录","data":null}
```

这表示后端 Web 服务已经正常启动。

### 2. 打开小程序工程

使用微信开发者工具导入：

- `E:\A23服创赛\A23-WXMiniprogram`

小程序根目录为：

- `miniprogram`

### 3. 编译运行

- 在微信开发者工具中点击“编译”
- 首次进入建议直接注册一个新账号
- 当前本地联调流程中，注册成功后会直接写入 token 并进入系统

### 4. 验证主链路

当前已验证通过的本地链路：

1. 注册账号
2. 获取 token
3. 请求 `/api/documents/stats`
4. 上传文档到 `/api/documents/upload`
5. 再次查询文档列表与统计

## 连接说明

### 开发者工具本机联调

默认配置就是本机联调：

```text
http://127.0.0.1:8082/api
```

适用场景：

- 后端和微信开发者工具都运行在同一台电脑
- 只做本地开发和调试

### 真机调试

真机调试时不能使用 `127.0.0.1`。

你需要把 [miniprogram/config.js](/e:/A23服创赛/A23-WXMiniprogram/miniprogram/config.js#L22) 中的 `apiBaseUrl` 改成：

- 局域网 IP，例如 `http://192.168.x.x:8082/api`
- 或公网 HTTPS 域名，例如 `https://your-domain/api`

同时注意：

- 手机和电脑需要在同一网络下，若使用局域网 IP
- Windows 防火墙需要允许 `8082` 端口访问
- 若使用公网或正式环境，小程序后台必须配置“request 合法域名”

### 端口变更

如果 `8082` 被占用，可以通过环境变量修改后端端口，例如：

```powershell
$env:DOCAI_SERVER_PORT="8090"
mvn spring-boot:run
```

修改后，小程序里的 `apiBaseUrl` 也要同步改成对应端口。

### 数据库说明

当前本地默认使用 H2 文件数据库，因此：

- 不需要单独安装 MySQL 也可以启动
- 注册的新账号只保存在本地 H2 中
- 删除 `data` 目录后，本地账号和文档记录会丢失

如果你们后续要切回 MySQL，可通过环境变量覆盖：

```powershell
$env:DOCAI_DB_URL="jdbc:mysql://127.0.0.1:3306/docai?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8&allowPublicKeyRetrieval=true"
$env:DOCAI_DB_USERNAME="root"
$env:DOCAI_DB_PASSWORD="你的密码"
mvn spring-boot:run
```

## 当前接口对接情况

小程序当前对接的是这组后端接口：

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/documents`
- `POST /api/documents/upload`
- `DELETE /api/documents/{id}`
- `DELETE /api/documents/batch`
- `GET /api/documents/stats`
- `POST /api/ai/chat`
- `POST /api/autofill/preview`

## 当前使用建议

- 本地首次进入建议直接注册新账号，不要再使用旧文档里提到的 `aaa / aaaaaa`
- 文档上传、列表、统计这几条链路已经过本地验证
- 智能填表当前走的是预览接口，返回 JSON 统计信息，不直接下载结果文件

## 已知限制

- 小程序端当前“智能填表”使用的是 `/api/autofill/preview`
- 后端 `autofill/single` 返回的是二进制文件流，小程序端当前没有直接下载成品文件的完整适配
- AI 对话、文档解析等能力仍依赖外部智谱接口；如果本机网络无法访问外部 AI 服务，相关能力可能失败
- 真机调试必须处理 IP、端口、防火墙、合法域名这几项连接问题

## 相关代码

- 路由与 Tab：[miniprogram/app.json](/e:/A23服创赛/A23-WXMiniprogram/miniprogram/app.json)
- 请求封装：[miniprogram/utils/request.js](/e:/A23服创赛/A23-WXMiniprogram/miniprogram/utils/request.js)
- API 适配层：[miniprogram/api/docai.js](/e:/A23服创赛/A23-WXMiniprogram/miniprogram/api/docai.js)
- 登录页：[miniprogram/pages/docai/login/index.js](/e:/A23服创赛/A23-WXMiniprogram/miniprogram/pages/docai/login/index.js)
