# 来源、开发沿革与许可

当前产品为 **GPT小龙娘 / GPT Dragon Girl**，是支持中英双语、去除旧角色内置玩梗内容的余额插件产品线。正式版本为 **v0.3.0**，内部插件标识保留 `api-balance-whale`。

本项目由 MeteorNOX 的 **dsh-whale-widget 0.3.0-beta** 演变而来，经小鲸鱼 For-Codex 桌面适配后，发展为拥有独立角色、中英本地化、无旧梗默认内容和后续修复的 GPT小龙娘余额插件。保留来源和贡献，不将原框架、平台支持或移植修复改称本次原创。

## 作者与协作关系

- 当前 GPT小龙娘仓库：[Yang-huai406/GPT-Dragon-Girl](https://github.com/Yang-huai406/GPT-Dragon-Girl)，由 **[@Yang-huai406](https://github.com/Yang-huai406)** 所属并维护，使用独立的 GPT 产品版本线。
- 上游作者及上游仓库所属账号：[@MeteorNOX](https://github.com/MeteorNOX)；上游仓库为 [DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)。上游版权、许可及仓库归属继续保留。
- Codex 适配贡献：**[@Yang-huai406](https://github.com/Yang-huai406)**。这项历史协作与当前独立仓库的维护关系分别记录，不表示上游仓库所有权转移。
- macOS 贡献：[@1llysviel](https://github.com/1llysviel) 的 [PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)。窗口探针、LaunchAgent、透明浮窗、Unix socket、首次点击与快捷键兼容等平台实现及署名继续保留；Windows 分支独立。
- 早期 0.2.4 / macOS 成果保留于 [原始提交](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/tree/8de181abf5593247f32d57995567dd9f4063e049) 和 [For-Codex 归档目录](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/tree/For-Codex/archive/for-codex-0.2.4)。

GPT小龙娘是此改编版的名称，不表示与 OpenAI 的官方合作、认证或授权关系。

## 开发过程与改编范围

| 阶段 | 来源与本阶段工作 |
| --- | --- |
| DSH 原框架 | 角色管理、气泡、动图、音效、基础 UI 和互动机制 |
| 小鲸鱼 Codex 适配 | Electron 透明窗口、Windows 原生跟随、GUI 启动、本地 IPC、余额与用量观察、币种 / 汇率、账本、诊断、安装与回滚；整合 macOS PR #128 |
| 显示与位置修复 | 绘制区域和气泡裁切、菜单悬停可达性、层级纠正、启动动画与位置恢复、缩放保存顺序、临时尺寸和无关设置不覆盖位置 |
| GPT 外观 | 用户提供的白发白角角色、图标派生、摸头 GIF、恢复图和白紫 UI；停用内置要米图，不重构原交互框架 |
| 双语与内容 | 简体中文 / English 共用词典和稳定控件标识；统一气泡测量、长文详情；删除旧梗及繁忙失败专属提示 / 音效，保留自定义内容 |
| Level7 移植 | 从前身 For-Codex v0.4 选择性移植账目归属与去重、精度、历史账户、订阅窗口、配置和编辑冲突、IME、队列、拖拽、连击与音频生命周期修复 |

Level7 参考源为小鲸鱼 For-Codex v0.4 提交 [`c86b055e8f24473ca76324d6e67145d65c596c41`](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/commit/c86b055e8f24473ca76324d6e67145d65c596c41)。逐项采用、边界及保留差异见 [docs/LEVEL7-PORT.md](docs/LEVEL7-PORT.md)。GPT 特有的双语、无旧梗、GPT 图像和可读气泡布局没有被小鲸鱼旧实现覆盖。

历史标签 `codex-v0.3.0-fixed`、`codex-v0.3.0-fixed.2` 属于前身 For-Codex 的发布记录；前身 v0.4 也不是本 GPT 包的版本。GPT 开发构建标记及阶段演进见 [CHANGELOG.md](CHANGELOG.md)。当前整合包按 GPT 产品线发布为 `0.3.0`，对应本仓库标签 `v0.3.0`，不代表其修复退回旧基线。

[Issue #177](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/177) 的新增全局空白点击关闭方案未采用：宿主点击不能可靠代表读完提示，且增加透明穿透和跨平台生命周期复杂度。保留原关闭和超时行为；这不是对上游 Issue 关闭状态的声明。参见 [交互决定](docs/OUTSIDE-CLICK-DECISION.md)。

## 素材与依赖的许可边界

| 范围 | 来源与许可说明 |
| --- | --- |
| 上游代码及本项目代码 | 保留 [LICENSE](LICENSE) 中的 MIT 许可和版权声明 |
| 上游图片、动图及音频 | 保留原分发条款和来源；不因代码为 MIT 而扩大媒体权利，不声明为本次原创 |
| `assets/gpt-chibi.png` | 用户提供的 GPT 风格透明立绘经等比缩放派生，不是上游原素材 |
| `assets/gpt-icon.png` 与内嵌恢复图 | 来自同一用户提供立绘的尺寸变体 |
| `assets/gpt-petpet.gif` | 用户提供的 GPT 风格摸头 GIF，保留原帧延时和循环方式 |
| `vendor/smol-toml` | BSD-3-Clause，保留原包许可证和作者署名 |
| Electron 44.3.0 / Chromium | 首次安装时单独下载，保留各自许可证及第三方声明 |

本次提供素材的用户不因此被声明为原画作者；本包也不宣称已取得 OpenAI 官方素材授权。GPT 媒体单独记录来源，代码的 MIT 许可不会自动为这些图像和动图授予额外使用权。其他依赖说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

上游原媒体中仍保留的文件用于来源、历史或未改动的自定义能力；当前默认角色和运行回退使用 GPT 资源。旧内置要米图、旧梗及繁忙特殊提示不作为 GPT 默认互动启用。用户导入资源由用户管理，不能将其来源归为上游或本项目原创。

## 验证与发布状态

正式版本、安装包、源码和校验材料见本仓库的 [v0.3.0 Release](https://github.com/Yang-huai406/GPT-Dragon-Girl/releases/tag/v0.3.0)。构建与测试在工作区完成，没有为本次发布更换制作者现有插件。

已有隔离验证包括 365 项单元测试、7 项账户通知检查、58 项布局检查、120 次渲染侧连击和18处透明区域探针。它们不代替 Windows 原生跨窗口或 Mac 实机验收。macOS 原代码及贡献保留，不等同于本 GPT 构建已通过 Mac 测试；前身历史硬件结果也不转记为当前构建通过。

本项目不修改或注入 Codex 的安装文件。安装操作由接收者主动运行脚本完成；内部 ID 保留意味着更新同 ID 的已有插件，而不是另建一个可同时并存的副本。

## 隐私、历史与反馈

公开交付排除制作者的密钥、账户信息、个人配置、账本、聊天、运行日志、真实账户截图、缓存、备份及安装回执。源码包不附带私人 Git 历史；公开作者署名、许可证、上游链接与相关历史标签仍然保留。开发史是产品层面的整理，不附原始聊天。

安装与回滚记录由接收者在自己的电脑生成。回退依赖该次安装的回执和备份，不依赖制作者路径。请勿在公开讨论中提交密钥、完整运行日志或含 IPC 令牌的 `runtime.json`。

当前产品的问题和素材来源反馈请提交到 [本仓库 Issues](https://github.com/Yang-huai406/GPT-Dragon-Girl/issues)，说明具体版本、文件和依据；上游原始内容的权利归属仍按其来源记录。安全问题按 [SECURITY.md](SECURITY.md) 私下报告。
