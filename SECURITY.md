# 安全策略（Security Policy）

## 支持范围

本仓库为 **GPT小龙娘 / GPT Dragon Girl** 独立产品线，当前版本为 **v0.3.0**，内部插件 ID 为 `api-balance-whale`。由 [Yang-huai406](https://github.com/Yang-huai406) 维护。验证范围见 [当前验证说明](docs/VERIFICATION-GPT-0.3.0.md)，不将前身的 Windows 或 macOS 测试当作本产品的实机验收。

上游为 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)。涉及 GPT小龙娘的漏洞请向本仓库私密报告；如也影响上游，请在报告中说明。macOS 平台实现及 [1llysviel 的 PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 署名保留。

## 报告漏洞

**请不要用公开 issue 报告安全漏洞。** 使用本仓库的 [GitHub 私密漏洞报告](https://github.com/Yang-huai406/GPT-Dragon-Girl/security/advisories/new)（Security → Report a vulnerability）。如果暂时无法访问该入口，可提交仅请求开启私密联系渠道的 issue，不包含漏洞细节。提交记录中的 noreply 地址不是支持邮箱。

请尽量包含：

- 受影响的版本（`.codex-plugin/plugin.json` 里的 `version`）与操作系统版本；
- 复现步骤或最小样例（PoC）；若涉及密钥/账本，请**脱敏**后再贴；
- 影响评估：能读到什么、能改到什么、是否需要本地代码执行权限；
- 是否已在别处公开（我们会据此调整披露节奏）。

**请勿在报告里附带真实 API 密钥、`auth.json`、`config.toml` 原文、`runtime.json` 或完整账本。** `runtime.json` 含有本地 IPC token。我们不需要这些也能定位问题。

## 我们的处理方式

- 收到报告后评估影响并尽可能及时回复；本项目没有保证响应时间的服务承诺；
- 给出修复计划或说明为何不修（含理由）；
- 修复发布后，在 CHANGELOG 与 Release 说明中致谢（除非你要求匿名）；
- 默认协调披露：修复版本发布后再公开细节；如需 CVE 或更长静默期，请在报告里说明。

## 本插件的安全边界（哪些算漏洞、哪些是设计）

**属于安全问题的例子**

- 读取或输出密钥、`auth.json`、`config.toml` 原文；
- 把余额/用量数据、聊天内容或本机路径发送到非用户配置的第三方；
- Windows 本地命名管道（`\\.\pipe\codex-whale-*`）或 macOS Unix socket 可被同机其他进程无凭据调用；
- 越权路径穿越、符号链接逃逸、素材目录外的读写；
- 导入素材时绕过格式/尺寸/帧数/配额校验，或损坏文件导致拒绝服务。

**属于已知设计（不算漏洞，欢迎提改进建议）**

- 不校验余额接口服务商的真实性：插件按你配置的地址与密钥查询，返回什么就显示什么；
- 汇率来自公开接口（`api.frankfurter.dev`），不做可信度背书；
- 原生窗口跟随依赖 Win32 窗口句柄或 macOS `CGWindowList` 与用户态权限，不设提权；
- 金额为**观测估算**，不是服务商正式账单。

## 加固建议（使用者）

- 只从本仓库或可信来源获取插件；升级前备份插件目录与 `~/.codex/whale-widget`（Windows 为 `%USERPROFILE%\.codex\whale-widget`）；
- 不要把密钥写进插件设置：本插件只保存**密钥环境变量名**，密钥请放在 Codex 配置或系统环境变量里；
- 若在多用户或共享机器上使用，注意本插件的本地 IPC 面向当前用户会话。

## English

This policy covers **GPT Dragon Girl v0.3.0**, an independent product maintained in [Yang-huai406/GPT-Dragon-Girl](https://github.com/Yang-huai406/GPT-Dragon-Girl). Its internal plugin ID is `api-balance-whale`. Upstream credits and platform implementations are preserved; upstream test results do not establish native-device acceptance for this build.

Please use [private vulnerability reporting](https://github.com/Yang-huai406/GPT-Dragon-Girl/security/advisories/new), not public issues, for security details. Include the affected version, operating system, minimal reproduction and impact. If private reporting is temporarily unavailable, an issue may request a private contact channel without disclosing the vulnerability. Git commit noreply addresses are not support mailboxes.

Never include real API keys, authentication/configuration files, `runtime.json` (which contains an IPC token), complete ledgers or chats. Reports are reviewed as capacity allows; no response-time guarantee is made. Disclosure is coordinated after a fix, with credit unless anonymity is requested.

Credential disclosure, unauthorized data transmission, unauthenticated IPC access, path traversal and unsafe media imports are security concerns. Provider response accuracy, estimated accounting and user-authorized native window following are documented design boundaries. Install from a trusted source, keep local backups private and store secrets outside plugin settings.
