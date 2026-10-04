# GPT小龙娘余额插件 v0.3.0

[English](README.en.md) · [版本说明](RELEASE_NOTES.md) · [来源与许可](PROVENANCE.md) · [完整开发摘要](docs/DEVELOPMENT_SUMMARY.md) · [验证范围](docs/VERIFICATION-GPT-0.3.0.md)

[项目仓库](https://github.com/Yang-huai406/GPT-Dragon-Girl) · [下载 v0.3.0](https://github.com/Yang-huai406/GPT-Dragon-Girl/releases/tag/v0.3.0) · [问题反馈](https://github.com/Yang-huai406/GPT-Dragon-Girl/issues)

<img src="assets/gpt-icon.png" width="120" height="120" alt="GPT小龙娘：白发、白角、紫眼的Q版角色">

**GPT小龙娘是面向 Codex 的中英双语余额与用量插件，以桌面伴随挂件呈现。** 它查看当前 API 余额、本机已观测用量和可用的订阅额度快照，同时提供角色、气泡、动图及音效管理。默认采用白发白角的 GPT 角色与白紫界面，支持简体中文和 English 即时切换，已移除前身小鲸鱼的内置玩梗对话。

这是由 **[Yang-huai406](https://github.com/Yang-huai406)** 维护的独立产品线，当前正式版本为 **v0.3.0**。它沿用小鲸鱼的技术框架，并包含从前身 **For-Codex v0.4** 移植的修复；GPT小龙娘与小鲸鱼分别维护版本号，v0.3.0 不代表回退这些修复。

## 功能

| 功能 | 行为 |
| --- | --- |
| 余额与用量 | API 余额、币种及汇率显示；本机已观测 token、单轮费用估算和账户账本 |
| 订阅模式 | 展示本机事件提供的额度快照，分别处理不同额度窗口、重置与过期 |
| 中英切换 | 面板、气泡、编辑器、托盘和状态文案即时切换，记住选择并保留未保存草稿 |
| 角色与外观 | GPT 主体、图标、摸头 GIF、加载失败恢复图和白紫皮肤；保留自定义素材 |
| 可读气泡 | 正式显示与编辑器预览共享排版，按实际文字宽高适配，长文可查看详情 |
| 跟随与桌面 | 跟随 Codex 或作为独立透明浮窗；拖动、缩放、位置记忆和显示快捷键 |
| 自定义互动 | 角色、气泡、图片、音效、手感以及本地创意工坊的导入导出 |
| 安装与回滚 | Windows 安装检查、接收者本机备份与回执，以及保留账本和媒体的回滚 |

默认内容保留余额、用量和 GPT 摸头互动，**没有旧小鲸鱼梗、内置“要米”图片或繁忙失败专属提示 / 音效**。低余额文字和金额提醒保留；失败与取消仍记录已观测消耗，消耗提示遵循用户开关。旧内置模板兼容处理，用户自行编写的内容不会被批量重置。

### 金额与配额如何理解

- **账户新增消耗**是账户余额观测区间的变化，可能包含并行任务、其他设备或延迟入账。通知按账户、币种和计量上下文去重，显示后确认，首次样本只建立基准。
- **单轮费用**只有在有可靠归属和计价依据时才显示估算；否则保留 token 和状态，不把账户总差额归给某个失败对话，也不把未知金额当成零。
- 极小金额先以十进制精度累计，再按显示精度呈现；可按匿名历史账户及币种查看账本。
- **已观测 token 不是官方账单或订阅剩余额度**。本机近 7 天数据可能跨账户及提供商；订阅没有可由这些数据反推出的固定 token 总配额。
- DeepSeek 峰谷信息只在直接连接适用官方端点、且规则仍在有效期内时显示；它不修改实际计费，也不适用于其他提供商。

## 安装

从 [v0.3.0 发布页](https://github.com/Yang-huai406/GPT-Dragon-Girl/releases/tag/v0.3.0) 下载 `GPT小龙娘-v0.3.0.zip`，校验随附 SHA-256 后，**完整解压**到固定目录。源码、测试和开发材料在同页的 `GPT小龙娘-v0.3.0-source.zip`。不要从 ZIP 内直接运行脚本。

需要支持插件功能的 Codex 桌面应用、**Node.js 24+（含 npm）**和首次下载依赖的网络。桌面组件使用 **Electron 44.3.0**；此包不包含预装运行时，不是离线 EXE。

内部插件 ID 继续使用 `api-balance-whale` 以兼容既有数据。**在已有小鲸鱼的电脑上执行安装，会更新同一个插件；两者不能仅凭显示名称不同而并存。** 安装器会为该次安装备份旧代码与数据。仅解压或查看源码不会安装插件。

### Windows

完整解压后运行 `安装插件.cmd` 或 `Install.cmd`。也可在解压目录使用 Windows PowerShell：

```powershell
# 仅检查依赖、包和安装目标
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1 -CheckOnly

# 明确选择安装后执行
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1
```

安装器验证本地插件市场、备份旧版本、安装桌面依赖、注册插件并验证运行状态。请保留安装输出中的**私有备份和回执**。若此前主动暂停过挂件，安装尊重该状态；需要恢复时主动打开，或在命令行安装时明确传入 `-Resume`。

安装完成后**新建 Codex 聊天**加载新版技能与工具。通常不必重启 Codex；如名称或图标仍显示缓存，先保存工作，通过应用退出入口正常退出 Codex，再从开始菜单打开。

### macOS

保留旧代码目录，将新包完整解压到另一个固定目录，运行 `安装 Mac 自动跟随.command`。需要 Node.js 24+、npm、网络和 Xcode Command Line Tools 提供的 Swift 编译器。详见 [macOS 安装、验证与回滚](docs/MACOS.md)。

macOS 平台代码保留，但**本次未进行 Mac 实机验收**。当前 Mac 脚本安装桌面组件及 LaunchAgent，不自动完成 Codex 插件市场的技能 / MCP 注册。Apple Silicon、Intel、Spaces、多屏和睡眠唤醒需在目标设备验证。

## 使用与验收

设置中的 **“语言 / Language”** 可切换中文或 English。语言只影响显示：不改变币种、汇率、真实金额、计价规则、结算设置或时区。内置翻译随包提供，不联网翻译用户内容；自定义句子、媒体名称和外部服务专有内容保持原样。

建议测试以下场景：

1. **外观**：主体、托盘与默认摸头动图为 GPT小龙娘，面板为白紫主题；无内置旧梗、要米图片和繁忙专属提示。
2. **双语**：在面板、API 表单、气泡与编辑器切换语言；未保存输入、焦点和选择内容应保留，功能分组不变。
3. **排版**：选择较小角色尺寸，显示长英文、长自定义内容和较长金额。文字应留在气泡内；长文通过“查看详情 / View details”读取，金额不被省略号替代。切换语言不应重播 GIF 或重置提示时间。
4. **位置与点击**：拖动、缩放后正常关闭并重开挂件；缩小再恢复宿主窗口不应忘记原位置。连续点击、取消拖拽和角色切换不应出现空白帧或半身丢失。
5. **费用与额度**：并行任务不应把账户扣费全归给某次失败；账户新增通知不重复累加。无数据、过期额度和未知单轮金额应与零值区分。
6. **编辑与音效**：两个编辑界面发生保存冲突时保留草稿；输入法选词的 Enter / Esc 不应误保存或关闭。检查音效分组、独立事件音量、试听及取消行为。
7. **原生窗口**：检查透明区域穿透、菜单按钮可达性、最小化 / 恢复、桌面 / 跟随切换、多屏及睡眠恢复。如需切换显示，Windows 使用 `Ctrl+Alt+W`，Mac 使用 `Cmd+Option+W`；也可使用托盘入口。

已有隔离验证覆盖 **365 项单元测试、7 项账户通知检查、58 项布局检查、120 次渲染侧连击和 18 处透明区域探针**。这些检查使用模拟数据和独立浏览器环境，**不等同于本 GPT 包已通过 Windows 原生跨窗口穿透或 macOS 硬件验收**。目标设备上的原生窗口行为仍需按上述场景验证；验证范围见 [验证说明](docs/VERIFICATION-GPT-0.3.0.md)，最终包校验结果见发布页随附的验证摘要。

主体采用单张透明立绘与现有 CSS 变换，不要求伪造多状态图集。PNG 缩放使用预乘 Alpha 计算，输出标准 RGBA；GIF 保留原帧延时、循环参数并等比显示。原图已裁掉的身体和低分辨率 GIF 固有的边缘锯齿不会由代码自动补全。

## 回滚

Windows 在同一解压包中运行 `回滚本次安装.cmd` 或 `Rollback.cmd`，也可先检查再执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1 -CheckOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1
```

脚本依据**这台电脑安装时生成的回执和备份**恢复旧代码及启动任务，保留最新设置、用户素材和账本，并先为当前状态建立检查点。没有有效回执时不会猜测备份位置。若是首次安装，回滚撤销本次安装而不是恢复一个不存在的旧版本。

macOS 运行 `回滚 Mac 更新.command` 或 `node scripts/rollback-macos.mjs`，按回执恢复旧 LaunchAgent、配置和探针；首次安装回退为停用新服务。请保留旧目录，详见 [macOS 说明](docs/MACOS.md)。

**不要公开安装回执、备份或运行时文件。** 分享包不携带制作者的回执，也不依赖制作者电脑上的路径。

## 数据与隐私

公开包只包含程序、可分发资源、说明和安装工具，不带个人凭据、配置、聊天、账本、运行日志、真实账户截图、缓存、安装回执或本机备份；源码包不附带私人 Git 历史。作者署名与许可证继续保留。

使用时，数据默认保存在 `~/.codex/whale-widget`；`CODEX_HOME` 改变其上级目录，`WHALE_HOME` 可指定独立数据目录。API 查询连接用户配置的服务；首次安装从包管理源下载运行时。订阅观察读取本机用量和额度事件，不额外登录，不将聊天发送给翻译服务。

分享诊断材料前请检查内容，尤其不要公开 `runtime.json`，它包含 IPC 令牌。账目来自已观测信息，并不是提供商逐请求账单。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 开发过程与技术栈

本项目沿用原框架，按以下阶段演进：

1. 从上游 DSH Web 挂件适配到 Codex 桌面，加入本地 IPC、透明窗口、Windows 跟随、余额和用量观察；保留 macOS 贡献。
2. 修复透明绘制区域、气泡裁切、菜单悬停可达性及窗口层级，完善分页面板、安装与回滚。
3. 修复位置记忆：恢复不被启动动画干扰；拖动、缩放完成再保存；临时窗口尺寸及无关设置不覆盖位置。
4. 替换为 GPT小龙娘立绘、图标、摸头 GIF 和白紫 UI，停用要米图片。
5. 加入中英共享词典、稳定控件标识和统一气泡排版，清除旧梗与繁忙特殊提示，保留自定义内容。
6. 从小鲸鱼 For-Codex v0.4 的 Level7 工作移植账户去重、费用归属、额度合并、设置与编辑冲突、输入法、队列、拖拽、连击及音频生命周期修复。

详细实现见 [双语与排版](docs/BILINGUAL.md)、[Level7 对照](docs/LEVEL7-PORT.md) 和 [变更记录](CHANGELOG.md)。历史文档中的版本、发布标签与验证结果只对应其所属分支和当时构建。

主要语言为 JavaScript / HTML / CSS；运行时为 Node.js 24+ 和 Electron 44.3.0，界面使用原生 DOM。Windows 辅助为 PowerShell / C#，macOS 探针为 Swift；不需要 React 或 Vue。源码可在 Node.js 24+ 环境运行 `npm test`，它不安装插件。

## 交互决定、来源与许可

[Issue #177](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/177) 建议点击组件外空白关闭菜单和气泡。挂件覆盖其他应用，普通宿主点击不可靠地代表已读；全局外部点击监听还增加透明穿透和跨平台生命周期的复杂度。因此保留现有控件内关闭、人物点击和提示超时规则，**未采用新增的全局空白点击关闭**。这是交互取舍，不表示不可实现，也不表示该 Issue 已关闭。见 [决定说明](docs/OUTSIDE-CLICK-DECISION.md)。

本项目的新仓库 [Yang-huai406/GPT-Dragon-Girl](https://github.com/Yang-huai406/GPT-Dragon-Girl) 属于 **[Yang-huai406](https://github.com/Yang-huai406)**，由其维护 GPT小龙娘这条中英双语、无旧内置玩梗对话的产品线。

上游项目 [DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 的作者及仓库所属账号为 **[MeteorNOX](https://github.com/MeteorNOX)**，**[Yang-huai406](https://github.com/Yang-huai406)** 为其 Codex 适配协作者。新产品线的建立不改变上游仓库的归属。保留 **[1llysviel](https://github.com/1llysviel)** 的 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 署名及平台实现。GPT小龙娘的问题请提交到 [本仓库 Issues](https://github.com/Yang-huai406/GPT-Dragon-Girl/issues)。

代码沿用 [MIT 许可](LICENSE)。GPT 立绘及摸头 GIF 由用户提供，图标和恢复图由该立绘派生；这些媒体的权利与代码许可分开记录，不声明为维护者原创或 OpenAI 官方授权素材。GPT小龙娘不是 OpenAI 官方产品。更多见 [PROVENANCE.md](PROVENANCE.md) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
