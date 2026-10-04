# GPT Dragon Girl Balance Plugin v0.3.0

[简体中文](README.md) · [Release notes](RELEASE_NOTES.md) · [Provenance](PROVENANCE.md) · [Development summary](docs/DEVELOPMENT_SUMMARY.md) · [Verification scope](docs/VERIFICATION-GPT-0.3.0.md)

[Repository](https://github.com/Yang-huai406/GPT-Dragon-Girl) · [Download v0.3.0](https://github.com/Yang-huai406/GPT-Dragon-Girl/releases/tag/v0.3.0) · [Report an issue](https://github.com/Yang-huai406/GPT-Dragon-Girl/issues)

<img src="assets/gpt-icon.png" width="120" height="120" alt="GPT Dragon Girl: a white-haired chibi character with white horns and purple eyes">

**GPT Dragon Girl (GPT小龙娘) is a bilingual balance and usage plugin for Codex, presented as a desktop companion.** It displays API balances, locally observed usage and available subscription-quota snapshots, with customizable characters, bubbles, animations and sounds. The default character uses a white and lilac theme. English and Simplified Chinese are included and can be switched immediately. The predecessor's built-in whale meme dialogue has been removed.

This is an independent product line maintained by **[Yang-huai406](https://github.com/Yang-huai406)**, with **v0.3.0** as its current stable release. It retains the whale plugin's technical framework and includes fixes ported from **For-Codex Whale v0.4**. GPT Dragon Girl and the whale plugin have separate version sequences; v0.3.0 does not roll back those fixes.

## Features

| Feature | What it does |
| --- | --- |
| Balance and usage | API balance, currency and exchange-rate display, observed tokens, attributable turn-cost estimates and account ledgers |
| Subscription mode | Displays quota snapshots supplied by local events, with separate windows, resets and expiry |
| Language switching | Updates panels, bubbles, editors, tray and status text while preserving preferences and unsaved drafts |
| Character and theme | GPT artwork, icons, petpet GIF, fallback image and white/lilac UI, with support for custom media |
| Readable bubbles | Shared layout for playback and editor previews, measured text bounds and full details for long content |
| Follow or desktop mode | Follows Codex or runs as an independent transparent window, with dragging, resizing and remembered position |
| Custom interaction | Character, bubble, image, sound and feedback settings, plus local workshop import/export |
| Installation and rollback | Windows checks, backups and receipts created on the recipient's computer, with rollback that retains current ledgers and media |

The default content contains balance, usage and GPT petpet interaction. It has **no old whale meme dialogue, built-in donation GIF, or special service-busy popup/sound**. Low-balance text and amounts remain. Failed or cancelled tasks retain observed usage, and spend notifications respect the user's switch. Compatibility handling for old built-in templates does not reset user-written content.

### Understanding the numbers

- **New account spend** is the change between account-balance observations. It may include parallel tasks, another device or delayed billing. Notifications are deduplicated by account, currency and measurement context, then acknowledged after display. The first sample establishes a baseline.
- **Turn cost** is estimated only when there is reliable attribution and pricing. Otherwise, tokens and status remain available without assigning a whole account delta to a failed conversation. Unknown cost is not treated as zero.
- Small amounts are accumulated with decimal precision before display rounding. Historical ledgers can be selected by anonymous account and currency.
- **Observed tokens are not an official invoice or remaining subscription quota.** Recent local activity can span accounts and providers; it cannot reveal a fixed subscription token allowance.
- DeepSeek peak/off-peak information is shown only for a directly configured, applicable official endpoint while the rule is valid. It does not change billing or apply to other providers.

## Installation

Download [GPT-Dragon-Girl-v0.3.0.zip](https://github.com/Yang-huai406/GPT-Dragon-Girl/releases/download/v0.3.0/GPT-Dragon-Girl-v0.3.0.zip) from the [v0.3.0 release page](https://github.com/Yang-huai406/GPT-Dragon-Girl/releases/tag/v0.3.0), verify it against the supplied SHA-256 file, and **extract the entire archive** to a stable directory. Source, tests and developer materials are in [GPT-Dragon-Girl-v0.3.0-source.zip](https://github.com/Yang-huai406/GPT-Dragon-Girl/releases/download/v0.3.0/GPT-Dragon-Girl-v0.3.0-source.zip). Do not run scripts from inside the ZIP.

GitHub downloads use the ASCII filenames above. The names `GPT小龙娘-v0.3.0.zip` and `GPT小龙娘-v0.3.0-source.zip` in earlier documentation are the Chinese display names for the same install and source archives, respectively; their contents and SHA-256 hashes are unchanged.

Requirements: Codex desktop with plugin support, **Node.js 24+ including npm**, and network access for the initial dependency download. The desktop runtime is **Electron 44.3.0**. This archive does not bundle an installed runtime and is not an offline executable.

The internal plugin ID remains `api-balance-whale` for data compatibility. **Installing on a computer that already has the whale plugin updates that same plugin.** A different display name does not create a second, independent installation. The installer backs up the existing code and data. Extracting or reading the source alone does not install anything.

### Windows

Run `Install.cmd` or `安装插件.cmd` after extracting the package. Alternatively, use Windows PowerShell in the extracted directory:

```powershell
# Check dependencies, package and destination only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1 -CheckOnly

# Run only when you choose to install
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-package.ps1
```

The installer checks the local plugin marketplace, backs up the existing version, installs desktop dependencies, registers the plugin and verifies its runtime state. Keep the **private backup and receipt** identified in its output. If you previously paused the companion, that choice is respected; open it explicitly, or use the `-Resume` installer option when you want to resume it.

After installation, **open a new Codex chat** to load updated skills and tools. A Codex restart is usually unnecessary. If the name or icon remains cached, save your work, quit Codex normally through its application exit command, and reopen it from the Start menu.

### macOS

Keep the previous code directory and extract the new package to a different stable directory. Run `安装 Mac 自动跟随.command`, or run `node scripts/install-macos.mjs` from the extracted directory. Node.js 24+, npm, network access and the Swift compiler from Xcode Command Line Tools are required. See [macOS instructions](docs/MACOS.md).

The macOS implementation is retained, but **this GPT package has not passed physical-Mac acceptance testing**. The current script installs the desktop component and LaunchAgent; it does not automatically register the skill/MCP integration in Codex's plugin marketplace. Apple Silicon, Intel, Spaces, multiple displays and sleep/wake need target-device testing.

## Use and acceptance testing

Choose English or Chinese under **“语言 / Language”** in Settings. The language changes presentation only, not currency, exchange rates, actual amounts, pricing, settlement settings or time zone. Translations are bundled. Custom sentences, media names and provider-specific content are not sent to an online translation service or automatically rewritten.

Suggested checks:

1. **Appearance:** verify the GPT character, tray icon, petpet animation and white/lilac panels. Old built-in memes, the donation image and special busy notices should be absent.
2. **Languages:** switch languages in panels, API forms, bubbles and editors. Unsaved input, focus and selection should survive, and controls should remain in the same functional groups.
3. **Layout:** try a small character, long English/custom text and long amounts. Text should stay inside the bubble. Use **View details** for long content; amounts should not be replaced with an ellipsis. Language switching should not replay the GIF or reset the notice lifetime.
4. **Position and clicks:** drag, resize, close and reopen the companion. Temporarily shrinking the host window should not overwrite its remembered position. Rapid clicking, cancelled dragging and character switching should not produce blank frames or clipped characters.
5. **Accounting and quotas:** parallel tasks should not assign all account spend to one failed turn. New-account-spend notifications should not double count. Missing data, expired quota and unknown turn cost should remain distinct from zero.
6. **Editing and audio:** concurrent edit conflicts should retain the draft. Enter/Esc while composing with an IME should not submit or close an editor. Check sound groups, event volume, preview and cancellation.
7. **Native windows:** check transparent click-through, menu access, minimize/restore, desktop/follow mode, multiple displays and sleep/wake. Toggle visibility through the tray or with `Ctrl+Alt+W` on Windows / `Cmd+Option+W` on Mac.

Existing isolated verification covers **365 unit tests, 7 account-notification checks, 58 layout checks, 120 renderer-side rapid clicks and 18 transparent-region probes**. These use isolated data and browser environments. They **do not establish that this GPT package has passed native Windows cross-window click-through or macOS hardware testing**. Native behavior on your target device still needs the checks above. See the [verification notes](docs/VERIFICATION-GPT-0.3.0.md) for scope and the verification summary attached to the release for final archive checks.

The character uses a single transparent illustration and existing CSS transforms, not invented sprite states. PNG resizing performs premultiplied-alpha calculations and outputs standard RGBA. The GIF retains its supplied frame delays and loop settings and is fitted without stretching. Code does not reconstruct the illustration's cropped body or remove all inherent low-resolution GIF edge artifacts.

## Rollback

On Windows, run `Rollback.cmd` or `回滚本次安装.cmd` from the same extracted package. To check first:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1 -CheckOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\rollback-package.ps1
```

Rollback uses the **receipt and backup generated during installation on that computer**, restores the previous code and startup task, retains current settings, user media and ledgers, and first makes a checkpoint of the current state. It will not guess a backup location without a valid receipt. For a first-time installation, rollback removes that installation rather than restoring a nonexistent predecessor.

On macOS, run `回滚 Mac 更新.command` or `node scripts/rollback-macos.mjs`. It restores the previous LaunchAgent, operational configuration and probe according to the receipt. For a fresh installation, it disables the new service. Keep the old code directory; see [macOS details](docs/MACOS.md).

**Do not publish receipts, backups or runtime files.** The shared package includes no developer receipt and depends on no developer-specific paths.

## Data and privacy

The public package contains code, distributable assets, documentation and installation tools. It excludes private credentials, configuration, chats, ledgers, runtime logs, real-account screenshots, caches, installation receipts and local backups. The source archive contains no private Git history. Public credits and licenses are retained.

User data defaults to `~/.codex/whale-widget`. `CODEX_HOME` changes the parent directory; `WHALE_HOME` can select an independent data directory. API queries contact the service configured by the user; initial installation downloads runtime dependencies from package sources. Subscription observation reads local usage and quota events without adding a login flow.

Review diagnostics before sharing. In particular, `runtime.json` contains an IPC token and must not be published. Observed accounting is not a provider's per-request invoice. Report security issues privately using [SECURITY.md](SECURITY.md).

## Development history and stack

The original framework was retained through these stages:

1. Adapted the upstream DSH web widget to Codex desktop, adding local IPC, a transparent window, Windows following, balance and usage observation, while retaining the macOS contribution.
2. Fixed drawing regions, bubble clipping, menu-hover reachability and window layering, and developed tabbed panels, installation and rollback.
3. Fixed position memory so startup animation cannot interfere, committed drag/resize results are saved, and temporary window changes or unrelated settings cannot overwrite the remembered position.
4. Added GPT Dragon Girl artwork, icons, petpet GIF and white/lilac UI, and retired the donation image.
5. Added shared bilingual dictionaries, stable control identifiers and measured bubble layouts, removing legacy memes and special busy notices while preserving custom content.
6. Ported the predecessor's For-Codex v0.4 Level7 fixes for account attribution and deduplication, quota merging, settings/edit conflicts, IME input, notification queues, dragging, rapid clicks and audio lifetimes.

See [bilingual/layout notes](docs/BILINGUAL.md), [Level7 port mapping](docs/LEVEL7-PORT.md) and [changelog](CHANGELOG.md). Version numbers, release tags and test results in historical documents belong to their stated branch and build.

The implementation uses JavaScript, HTML and CSS with native DOM, Node.js 24+ and Electron 44.3.0. Windows helpers use PowerShell/C#; the macOS probe uses Swift. React and Vue are not required. Run `npm test` from the source with Node.js 24+ to execute unit tests; this does not install the plugin.

## Interaction decision, credits and license

[Issue #177](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/issues/177) proposes dismissing menus and bubbles when clicking outside the companion. Normal clicks in another application do not reliably mean a notice has been read, and global outside-click tracking complicates transparent click-through and cross-platform lifetimes. The existing control-level dismissal, character clicks and timeouts are retained; **the new global outside-click dismissal is not adopted**. This is a product decision, not a claim of technical impossibility or that the upstream issue is closed. See [decision details](docs/OUTSIDE-CLICK-DECISION.md).

The new [Yang-huai406/GPT-Dragon-Girl](https://github.com/Yang-huai406/GPT-Dragon-Girl) repository belongs to **[Yang-huai406](https://github.com/Yang-huai406)**, who maintains GPT Dragon Girl as a bilingual product line without the predecessor's built-in meme dialogue.

The upstream [DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) project was authored by and belongs to **[MeteorNOX](https://github.com/MeteorNOX)**, with **[Yang-huai406](https://github.com/Yang-huai406)** contributing the Codex adaptation. Creating this product line does not change ownership of the upstream repository. The implementation and credit for **[1llysviel](https://github.com/1llysviel)**'s [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128) are retained. Please report GPT Dragon Girl issues in [this repository's issue tracker](https://github.com/Yang-huai406/GPT-Dragon-Girl/issues).

Code retains the [MIT license](LICENSE). The GPT illustration and petpet GIF were supplied by the user; icons and fallback images derive from that illustration. Media rights are recorded separately from the code license. They are not claimed as the maintainer's original art or officially licensed OpenAI assets. GPT Dragon Girl is not an official OpenAI product. See [PROVENANCE.md](PROVENANCE.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
