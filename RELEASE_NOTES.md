# GPT小龙娘 v0.3.0 — 发布说明

**正式版：[`v0.3.0`](https://github.com/Yang-huai406/GPT-Dragon-Girl/releases/tag/v0.3.0)**。当前独立仓库为 [Yang-huai406/GPT-Dragon-Girl](https://github.com/Yang-huai406/GPT-Dragon-Girl)。包版本为 `0.3.0`，内部插件 ID 为 `api-balance-whale`。

GPT小龙娘是支持中英双语、去除旧角色内置玩梗内容的余额插件产品线。本版将 GPT 角色、中英切换及气泡排版，与前身小鲸鱼 **For-Codex v0.4** 的 Level7 修复整合为可安装包。GPT 的 v0.3.0 与前身的 v0.4 使用独立版本线；前身版本号仅用于说明修复来源。

## 给使用者的变化

- 默认立绘、插件 / 托盘图标、摸头 GIF 和图片失败恢复图统一为 GPT小龙娘，界面采用白色与淡紫色。
- 提供简体中文和 English 即时切换；面板、动态编辑器、气泡、托盘和状态文案共用词典。语言只改变显示，不改变币种、账目、时区或计价。
- 清除旧角色内置梗、随机预设和回退路径，停用“要米”图片及繁忙失败专属提示 / 音效；低余额文字、金额提醒和已观测用量保留。用户自定义内容不批量重置。
- 气泡与预览使用统一测量和安全内容区；小角色仍保持可读文字，长内容通过详情展示，语言切换不重播动画或重置提示时间。
- 修复启动恢复、缩放保存顺序和临时窗口变化覆盖位置的问题，保留拖动、悬停、角色切换、透明穿透与动画生命周期。

## Level7 修复整合

- **费用归属和去重**：账户新增消耗独立于单轮估算；按账户、币种和计量上下文累计去重，显示后确认，首次观测建立基准。并行扣费不再错误归给某个失败对话。
- **精度和历史账本**：小额差值先精确累计后格式化；匿名历史账户和币种选择提供旧记录入口。未知单轮金额继续保留为未知。
- **订阅额度**：按额度窗口分别合并可靠来源，处理重置、过期和账户边界，不拿本机 token 统计冒充官方剩余额度。
- **设置与编辑**：按字段合并并串行保存；损坏 / 不可读配置不伪装成空配置。编辑时获取最新数据并校验版本，冲突保留草稿；保留屏幕名称，输入法组字期间不误触 Enter / Esc。
- **气泡与交互**：明确队列内容的归属，取消、失败、替换和隐藏恢复不残留占用；使用绝对截止时间；取消拖拽恢复已提交位置，连击期间保持稳定命中轮廓。
- **音频与规则**：顺序播放完整音效组，统一事件设置和音量，释放试听 / 裁剪资源及迟到回调；峰谷规则超出有效期不继续推算。

逐项范围见 [Level7 移植对照](docs/LEVEL7-PORT.md)。原生平台的历史修复来源与本包验收结果分开记录。

## 安装附件

| 附件 | 用途 |
| --- | --- |
| `GPT小龙娘-v0.3.0.zip` | 完整解压后安装的插件包 |
| `GPT小龙娘-v0.3.0-source.zip` | 源码、测试和开发文档 |
| SHA-256 校验文件 | 核对附件完整性 |
| 安装、验证与回滚说明 | 安装后验证步骤及回退办法 |

需要支持插件的 Codex 桌面应用、Node.js 24+（含 npm）及首次下载依赖的网络；Electron 为 44.3.0。Windows 完整解压后运行 `Install.cmd` / `安装插件.cmd`。安装器会更新同 ID 的既有小鲸鱼安装，并为此次操作生成接收者自己的备份及回执。**本次打包没有对制作者现有插件执行安装。**

安装后新建 Codex 聊天加载新工具；名称 / 图标缓存未更新时，保存工作并正常退出、重新打开 Codex。回滚使用同一包内的 `Rollback.cmd` / `回滚本次安装.cmd`，保留最新设置、素材和账本。详情见 [README](README.md) 或 [English README](README.en.md)。

macOS 代码和 [PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 贡献保留；需要 Swift 编译工具。当前脚本不自动完成 Codex 技能 / MCP 的市场注册，且本次未做 Mac 实机验收。参见 [macOS 说明](docs/MACOS.md)。

## 验证范围与待测项

已有隔离验证：**365 项单元测试、7 项账户通知检查、58 项布局检查、120 次渲染侧连击、18处透明区域探针**。最终附件的完整性和扫描结果以随附验证摘要为准。

这些结果不等同于本 GPT 包通过了 Windows 原生跨窗口穿透、Mac 硬件、系统睡眠 / 唤醒、蓝牙 / 特定声卡首音、多屏或长期运行验收。目标设备测试仍需覆盖外观、中英切换、气泡边界、位置记忆、连击、取消拖拽、费用归属、额度、编辑冲突和安装回滚。

账户差额是已观测区间变化，不是逐请求账单。自定义内容不自动翻译。桌面模式是独立透明浮窗，并非壁纸层；本地工坊并非在线素材市场。原 GIF 的像素与透明度限制仍存在。

## 保留的交互决定与来源

[Issue #177](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/177) 的新增全局空白点击关闭不采用：宿主普通点击可能误清未读提示，同时增加透明穿透和跨平台处理复杂度。保留控件内关闭、人物点击及超时规则；这不代表 Issue 已关闭。见 [决定说明](docs/OUTSIDE-CLICK-DECISION.md)。

当前 GPT小龙娘独立仓库由 **[Yang-huai406](https://github.com/Yang-huai406)** 所属并维护，同时保留其 Codex 适配贡献。上游 [DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 仍归属作者 [MeteorNOX](https://github.com/MeteorNOX)，其版权与许可继续保留。保留 [1llysviel](https://github.com/1llysviel) 的 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) 署名和平台实现。

代码保留 MIT；GPT 立绘与 GIF 为用户提供素材，未将代码许可扩展为媒体授权，也不声称为 OpenAI 官方产品。素材、依赖和历史来源见 [PROVENANCE.md](PROVENANCE.md) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

公开交付不含个人凭据、配置、账本、聊天、运行日志、真实账户截图、缓存、备份、安装回执或私人 Git 历史。回滚只依靠接收者自己安装时生成的记录。

## English summary

GPT Dragon Girl is a bilingual balance plugin with its own product and version line. Version 0.3.0 combines GPT artwork and a white/lilac theme with instant English/Chinese switching, bounded bubble layouts and the predecessor's For-Codex v0.4 Level7 accounting, quota, editing, input, notification and audio fixes. Legacy whale memes, the donation image and special service-busy popups/sounds are removed; custom content and observed usage remain.

Download the [v0.3.0 release](https://github.com/Yang-huai406/GPT-Dragon-Girl/releases/tag/v0.3.0) from the independent repository owned and maintained by Yang-huai406. Extract the full package, install with `Install.cmd`, and use `Rollback.cmd` with the receipt generated on the recipient's computer. Node.js 24+, npm and an initial network download for Electron 44.3.0 are required. The existing isolated checks do not establish native Windows or Mac hardware acceptance. MeteorNOX's upstream ownership and copyright, Yang-huai406's Codex adaptation work, and 1llysviel's macOS PR #128 contribution remain credited. See [README.en.md](README.en.md) for installation, verification, privacy and attribution.
