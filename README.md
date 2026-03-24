# A23-WXMiniprogram

本小程序已改为直接对接 `DocAI` 文档中的后端接口，所有业务请求统一走 `DocAI /api/v1`。

当前已对齐的核心能力：
- 登录 / 注册：`POST /api/v1/users/auth`
- 当前用户：`GET /api/v1/users/info`
- 源文档上传、列表、删除：`/api/v1/source/*`
- 智能填表：`/api/v1/template/*`
- AI 对话：`POST /api/v1/ai/chat/stream`
- 对话会话与消息同步：`/api/v1/ai/conversations/*`

注意
- 小程序 AI 对话页面结构未改，只替换为 DocAI 后端接口。
- 小程序上传的源文档格式按 DocAI 后端能力收敛为：`.docx`、`.xlsx`、`.md`、`.txt`

## 启动方式

### 方法一：本地联调

进入 `DocAI` 后端目录：

```powershell
cd E:\A23服创赛\DocAI\docai-pro
```

按需先配置大模型 Key：

```powershell
$env:DOC_DASHSCOPE_API_KEY="你的 DashScope API Key"
```

如果本机是 JDK 17 / 21，直接启动：

```powershell
.\start-lite-windows.ps1
```

`start-lite-windows.ps1` 现已兼容当前这台已验证的 JDK 24 环境。脚本会自动补齐 Lombok 注解处理器参数并切换到兼容的 Maven 编译参数，所以“方法一”仍然直接执行同一条命令即可；下面那组长命令保留为手动排查参考。若本机没有把 `javac` 加入 `PATH`，请先将 `JAVA_HOME` 指向一个可用的 JDK。

若你需要单独手动排查 JDK 24 环境下的 Lombok 编译问题，可参考下面这组命令：

```powershell
$env:JDK_JAVAC_OPTIONS='-processorpath C:\Users\ALGH\.m2\repository\org\projectlombok\lombok\1.18.42\lombok-1.18.42.jar -processor lombok.launch.AnnotationProcessorHider$AnnotationProcessor'
mvn '-Dlombok.version=1.18.42' '-Dmaven.compiler.forceJavacCompilerUse=true' '-Dmaven.compiler.fork=true' -DskipTests clean package
docker compose -f .\deploy\docker-compose-mid-windows.yml up -d
.\start-services-only.ps1
```

启动完成后，默认联调地址为：
- `http://127.0.0.1:8080/api/v1`
- 若只启动了网关服务，小程序会自动回退到 `http://127.0.0.1:18080/api/v1`

本仓库已实测以下端口可正常监听：`3306`、`6379`、`8848`、`9001`、`9002`、`9003`、`18080`、`8080`

### 方法二：使用 `http://docai.sa1.tunnelfrp.com` 作为公网入口

此方法只改小程序侧配置，不改 `DocAI` 内容；并且默认不开启，不会影响方法一的本地运行。

已在小程序配置中预留公网入口：

- `remoteApiBaseUrl: 'http://docai.sa1.tunnelfrp.com/api/v1'`
- `useRemoteApiBaseUrl: false`

切换步骤：

1. 打开 `miniprogram/config.js`
2. 将 `useRemoteApiBaseUrl` 从 `false` 改为 `true`
3. 重新编译微信开发者工具项目
4. 如需切回本地联调，再改回 `false`

对应代码如下：

```js
const REMOTE_API_BASE_URL = 'http://docai.sa1.tunnelfrp.com/api/v1'
const useRemoteApiBaseUrl = true
```

说明：

- 该域名页面入口已可访问，并已作为小程序侧的“方法二”配置项写入。
- 当前默认仍走本地 `127.0.0.1`，所以不会影响现有本地运行。
- 小程序启动时会自动按当前配置覆盖旧的接口缓存地址，方法一与方法二切换时不需要手动清理 `storage`
- 已实测该公网入口可完成：`/users/auth`、`/users/info`、`/ai/conversations`、`/source/upload`、`/ai/chat/stream`
- 若该公网地址后续出现 `502 Bad Gateway`、`请求格式错误`、登录失败或上传失败，请直接切回方法一。
- 由于当前给定地址是 `http` 而不是 `https`，更适合开发者工具内联调；若要用于真机，仍建议准备可用的 `HTTPS` 合法域名。

### 3. 导入微信开发者工具

在微信开发者工具中导入项目：

- 项目目录：`E:\A23服创赛\A23-WXMiniprogram`
- 小程序根目录：`miniprogram`

### 4. 编译运行

编译后按下面顺序验证：

1. 在登录页注册一个 DocAI 新账号
2. 进入文档中心上传源文档
3. 等待文档解析完成后进入智能填表
4. 在 AI 对话页直接提问，或先从文档中心关联文档再提问

## 默认配置

小程序接口配置文件：

- `miniprogram/config.js`

默认内容：

```js
const LOCAL_API_BASE_URL = 'http://127.0.0.1:8080/api/v1'
const LOCAL_API_FALLBACK_URLS = ['http://127.0.0.1:18080/api/v1']
const REMOTE_API_BASE_URL = 'http://docai.sa1.tunnelfrp.com/api/v1'
const useRemoteApiBaseUrl = false
```

## 已完成的后端对齐

### 用户认证

- 登录和注册统一改为 `POST /api/v1/users/auth`
- 当前用户改为 `GET /api/v1/users/info`
- 退出登录改为 `POST /api/v1/users/logout`

### 源文档

- 文档列表改为 `GET /api/v1/source/documents`
- 文档上传改为 `POST /api/v1/source/upload`
- 单个删除改为 `DELETE /api/v1/source/{docId}`
- 批量删除改为 `POST /api/v1/source/batch-delete`

### 智能填表

- 模板上传改为 `POST /api/v1/template/upload`
- 模板解析改为 `POST /api/v1/template/{templateId}/parse`
- 模板填充改为 `POST /api/v1/template/{templateId}/fill`
- 小程序现在只会使用“已解析完成”的来源文档参与填表

### AI 对话

- 对齐到 `POST /api/v1/ai/chat/stream`
- 小程序侧增加了对 SSE 返回内容的解析，保持原有 AI 对话界面不变
- 历史会话、当前会话消息、关联文档信息改为走 `chat_conversations / chat_messages` 对应的后端接口
- 因此同账号在 Web 端创建的会话和消息，小程序重新进入后可以读取

## 真机调试说明

真机不能直接访问 `127.0.0.1`。如需真机联调，请把 `miniprogram/config.js` 中的地址改成：

- 局域网地址，例如：`http://192.168.x.x:8080/api/v1`
- 或公网 HTTPS 地址，例如：`https://your-domain/api/v1`

如果使用 `DocAI/docs/项目启动说明书.md` 里的 Ngrok 方案，也可以直接填写对应的 HTTPS 域名。

## 当前联调建议

- 先在文档中心上传资料，再到智能填表页面执行模板填充
- 文档状态为“解析中”时，暂时不要用于智能填表
- 若 AI 对话失败，先确认 DocAI 后端服务、网关和模型 Key 已正常启动
- 已实测共享库中的 `users`、`source_documents`、`chat_conversations`、`chat_messages` 会被小程序和 Web 共用
