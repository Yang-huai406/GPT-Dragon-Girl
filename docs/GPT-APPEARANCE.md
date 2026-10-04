> 历史开发专题：以下候选号和当时验证属于对应阶段；当前 GPT小龙娘 v0.3.0 的范围以 [README](../README.md) 和 [当前验证说明](VERIFICATION-GPT-0.3.0.md) 为准。

# GPT小龙娘外观（本地版本）

内部版本：`0.3.0+codex.20261004.gpt-dragon`。基于位置记忆修复版，不改窗口跟随、点击、气泡双缓冲、触发时机及控件布局。

使用用户提供的透明立绘及现成摸头 GIF。立绘缩放时采用预乘 Alpha 的 Lanczos 重采样，输出标准 RGBA PNG；GIF 按原字节复制，10 帧、每帧 20 ms、无限循环。原图已经裁切的身体下沿保留，不生成额外状态或图集。GIF 的二值透明边缘不等同于 PNG 半透明抗锯齿。

主体路由映射 `assets/gpt-chibi.png`，托盘及插件图标使用 `assets/gpt-icon.png`；`/dsh-whale/rua.gif` 与 `bimg_petpet` 保留旧接口并映射 `assets/gpt-petpet.gif`。图片失败兜底为内嵌 GPT 小图。历史 DeepSeek 资源留存供溯源与回滚，但不作为默认运行备用。

停用要米内置图：默认低余额提醒为文字和金额；历史提醒与气泡配置在读取时以兼容视图移除该图片，必要时补文字，原配置文件不因读取而写回。用户主动保存时才保存当前兼容后的配置。旧 petpet 图库副本仅在匹配原内置图片字节哈希时替换；用户自定义素材保留。

共享皮肤定义在 `desktop/ui/ui.css` 的 `--gpt-*` 变量，静态界面、动态面板、SVG 气泡及 Canvas 默认颜色使用该主题。用户自定义颜色、语义告警颜色及独立彩色预设不强制改写。

技术栈：原生 JavaScript/HTML/CSS，Electron 44.3.0；本机 Node.js 24.21.0。保留 macOS PR #128 实现和来源；当前仅在 Windows 验证。

验证：`node --test --test-concurrency=2 tests/*.test.mjs`；安装桌面运行时后可执行 `node tests/gpt-appearance.mjs <报告目录>` 以及 `node tests/position-memory.mjs <报告目录>`，使用隔离用户数据。

安装遵循 `scripts/install-package.ps1`，回滚绑定其私有安装回执。图片存在运行时字节缓存，因此更新后需重启挂件进程；插件技能可新建 Codex 聊天加载，通常无需重启 Codex。该开发阶段未单独上传 GitHub；当前正式版见 README。
