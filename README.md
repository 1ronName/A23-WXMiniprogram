# A23-WXMiniprogram

本小程序只对接 `DocAI` 现有后端，不改 `DocAI` 目录内容。当前已对齐的核心能力包括：

- 用户登录 / 注册：`POST /api/v1/users/auth`
- 当前用户信息：`GET /api/v1/users/info`
- 来源文档上传 / 列表 / 删除：`/api/v1/source/*`
- 智能填表：`/api/v1/template/*`
- AI 对话：`POST /api/v1/ai/chat/stream`
- 会话与消息同步：`/api/v1/ai/conversations/*`

AI 对话页原有界面结构保持不变。智能填表页在现有原生流程上补充了结果下载和可选网页模式入口。

## 启动方式

### 方法一：本地联调

进入 `DocAI` 后端目录：

```powershell
cd E:\A23服创赛\DocAI\docai-pro
```

按需配置 DashScope Key：

```powershell
$env:DOC_DASHSCOPE_API_KEY="你的 DashScope API Key"
```

如果本机是可用的 JDK 17 / 21 / 24 环境，直接启动：

```powershell
.\start-lite-windows.ps1
```

当前小程序本地联调接口约定如下：

- 开发者工具：`http://127.0.0.1:8080/api/v1`
- 开发者工具回退：`http://127.0.0.1:18080/api/v1`
- 真机局域网地址：以 [config.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/config.js) 中 `REAL_DEVICE_API_BASE_URL` 为准

如果你要切回本地联调，请把 [config.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/config.js) 中的：

```js
const useRemoteApiBaseUrl = true
```

改成：

```js
const useRemoteApiBaseUrl = false
```

### 方法二：使用 `https://docai.sa1.tunnelfrp.com`

当前仓库已经预置公网接口与网页入口：

```js
const REMOTE_API_BASE_URL = 'https://docai.sa1.tunnelfrp.com/api/v1'
const REMOTE_WEB_BASE_URL = 'https://docai.sa1.tunnelfrp.com'
```

小程序如果需要走公网站点：

1. 保持 [config.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/config.js) 中 `useRemoteApiBaseUrl = true`
2. 重新编译微信开发者工具项目
3. 确认微信小程序后台已经配置了对应合法域名

## 微信小程序后台域名配置

短期继续使用隧道域名时，请把同一个主机名 `docai.sa1.tunnelfrp.com` 同时配置到：

- `web-view` 业务域名：`https://docai.sa1.tunnelfrp.com`
- `request` 合法域名：`https://docai.sa1.tunnelfrp.com`
- `uploadFile` 合法域名：`https://docai.sa1.tunnelfrp.com`
- `downloadFile` 合法域名：`https://docai.sa1.tunnelfrp.com`
- `socket` 合法域名：仅当后续网站启用 `WSS` 时再配置 `wss://docai.sa1.tunnelfrp.com`

注意事项：

- 不能使用 IP 或 `localhost`
- 不能只配父域名，必须配具体子域名
- 配置项里不能写路径
- 如果网页内再嵌套别的域名资源、`iframe`、上传域名或 `WSS` 域名，也要进入白名单
- URL 参数尽量使用编码后的 ASCII 字符串，避免 iOS `web-view` 出现兼容问题

## 智能填表现状

### 原生模式

当前默认推荐的智能填表路径已经简化为单页原生流程，主页面是 [autofill/index.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/pages/docai/autofill/index.js)。

当前页直接完成这些动作：

1. 选择或上传数据源文档
2. 选择模板文件
3. 输入填表需求
4. 执行智能填表
5. 在同页查看结果、下载和转发

单页流程里固定按下面顺序调用 `DocAI` 现有接口，不新增任何后端 API：

1. 校验当前草稿中的来源文档状态
2. `POST /api/v1/template/upload`
3. `POST /api/v1/template/{templateId}/parse`
4. `POST /api/v1/template/{templateId}/fill`
5. `GET /api/v1/template/{templateId}/download`

数据源只允许：

- `docx`
- `xlsx`
- `txt`
- `md`

模板只允许：

- `docx`
- `xlsx`

单页结果区和文档页中的“成表”区域都支持：

- 下载并直接打开
- 仅下载到本地
- 转发结果文件

### 网页模式

网页模式现在是“辅助入口”，不是主流程：

- 入口页：[autofill/index.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/pages/docai/autofill/index.js)
- `web-view` 容器页：[autofill-web/index.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/pages/docai/autofill-web/index.js)

网页模式会通过 `web-view` 打开：

```text
https://docai.sa1.tunnelfrp.com/autofill?from=miniapp&scene=form&entry=wx-autofill
```

这条链路只改了小程序侧，没有改 `DocAI`。因此它能做到的是：

- 从小程序中直接打开同域名网站版智能填表
- 使用同一个 `docai.sa1.tunnelfrp.com` 作为网页入口
- 把后台域名配置要求收敛到同一个主机名

它当前还做不到的是：

- 小程序登录态自动换成网页登录态
- 通过 `mp_ticket` 自动进入 H5 表单
- H5 调原生上传页后再实时回传 `file_id`

原因不是小程序代码缺失，而是 `DocAI` 现有代码中没有这套支持：

- `DocAI` Web 端当前仍使用浏览器 `localStorage token` 登录守卫
- 未发现 `mp_ticket`
- 未发现 `exchange-ticket`
- 未发现 `jscode2Session / openid / session_key`
- 未发现 `sendWebviewEvent / onWebviewEvent`

对应参考位置：

- [router/index.js](/E:/A23服创赛/DocAI/docai-frontend/src/router/index.js)
- [Login.vue](/E:/A23服创赛/DocAI/docai-frontend/src/views/Login.vue)

所以，网页模式目前是“可打开网站版智能填表”的补充路径，不是“已经完成无感单点登录”的最终态。首次进入时如果网页端还没有自己的登录态，可能会先跳到网站登录页。

## 如果后续允许改 DocAI，建议再补的接口

如果未来放开“禁止修改 DocAI”的限制，再继续做下面这套能力会更完整：

1. `POST /miniapp/h5-ticket`
2. `POST /h5/exchange-ticket`
3. `GET /form/init`
4. `POST /form/upload`
5. `POST /form/submit`

同时再补：

- 小程序 `wx.login -> jscode2Session -> OpenID` 登录桥
- H5 `wx.miniProgram.getEnv`
- 原生上传页 + `wx.uploadFile`
- `sendWebviewEvent / onWebviewEvent` 实时回传附件结果

## 小程序导入与验证

微信开发者工具导入：

- 项目目录：`E:\A23服创赛\A23-WXMiniprogram`
- 小程序根目录：`miniprogram`

建议按下面顺序验证：

1. 登录或注册账号
2. 进入智能填表页
3. 在同一页上传或勾选来源文档
4. 在同一页选择模板并输入填表需求
5. 等所有已选来源文档变为“可填表”后，直接点击“开始智能填表”
6. 在同一页执行“下载并打开 / 仅下载到本地 / 转发结果”
7. 如需网页模式，再点击“打开网页智能填表”

## 当前关键文件

- 配置文件：[config.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/config.js)
- 智能填表入口页：[autofill/index.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/pages/docai/autofill/index.js)
- 网页填表容器页：[autofill-web/index.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/pages/docai/autofill-web/index.js)
- 原生流程草稿与结果 session：[autofill-draft.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/utils/autofill-draft.js)
- 智能填表下载接口封装：[docai.js](/E:/A23服创赛/A23-WXMiniprogram/miniprogram/api/docai.js)
