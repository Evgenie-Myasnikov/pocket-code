# Pocket Code

**AI coding on your Windows PC, with the same chats on Android.**

Pocket Code connects **Claude Code**, **Codex** and **GitHub Copilot** to a shared TypeScript interface. Send instructions, attach files, follow work, answer questions and review changes from either device. Projects and tools run on the PC; model requests use your provider account.

[Download Windows / Android](https://github.com/Evgenie-Myasnikov/pocket-code/releases/latest) · [Full guide](docs/USER_GUIDE.md) · [Русский](docs/USER_GUIDE.ru.md) · [Documentation](docs/README.md)

## Start in three steps

1. On Windows, extract the repository and run **Setup Pocket Code.cmd**. It detects Node.js or installs a checksum-verified private runtime, installs dependencies, builds the desktop app and creates shortcuts. For later launches use **Start Pocket Code.cmd**.
2. In desktop **Settings**, check the AI account and open **Connection**. Select the offered LAN, Tailscale or internet address. Keep the PC awake.
3. Install the Android APK from Releases. Open **Settings → PC connection**, scan the PC QR, then open **Chats → New**. Select a project and provider and send the first message.

QR codes are private connection credentials. Provider sign-in is separate. The PC application stays in the tray when its window closes; **tray → Exit** ends it. Windows autostart and reconnect are optional settings.

## What it includes

| Area | Features |
| --- | --- |
| Chats | Claude, Codex and Copilot; text/files/images; provider model choices; Codex effort; follow-ups during work; history, search and saved reading position |
| Review | Scrollable file diffs, unified/split views with inline highlights, file-type filters, folding, code size and fit-to-width |
| Results | Images, documents and links from available chat history; image zoom and local file previews |
| Activity | Running, completed, failed and waiting-for-answer chats; child agent context where the provider exposes it |
| Board | Optional repository boards with version columns, notes, images, status and priority; Miro Live Embed |
| Rules / Changelog | Markdown documents selected by repository; a switch for built-in board maintenance |
| Settings | Accounts and logout, usage, themes, scaling, grid spacing, notifications, connection and updates |

Windows supports writing chats as well as reading them. Android and Windows use the same conversation, review and result components. Chats belong to the connected PC and provider; boards belong to repositories. There is no separate WorkSpace administration section in current navigation.

<img src="docs/images/chat.png" width="290" alt="Illustrative chat using synthetic project content"> <img src="docs/images/review.png" width="290" alt="Illustrative review of synthetic changes">

These synthetic screenshots illustrate earlier interface revisions; labels can differ from the current guide. They contain no real conversations or pairing codes.

## Models and permissions

Claude aliases follow the provider's current model; an explicit model ID pins a version. **Unreleased source change:** the picker now loads the installed Claude Code model catalog, shows resolved versions when advertised, and accepts a full model ID. A released 0.25.11 installation still has the earlier alias-only selector. See [model selection](docs/PROVIDERS.md#claude).

Codex advertises models and reasoning effort through its runtime. Copilot advertises its own models. Accounts, quotas and capabilities are provider-specific. Full access is the Codex mobile default; choose another policy in settings if needed. This setting does not change Claude or Copilot permissions.

## Boards and Miro

Create a board only when a repository needs one. Notes are stored in `project-boards/board-*.json`; saving does not commit or push Git. Dependencies are AI planning metadata and are not drawn as arrows. Set an 8/12/16/24/32/64 grid in Appearance; right-click a card for deletion with confirmation.

For Miro, open **Settings → Miro**, select a project and paste its board URL. Miro supplies its interface and permissions. If embedded login is unavailable, use **Open in browser**. Optional, separately authorized [AI API access](docs/MIRO-AI.md) is unreleased; it reads linked boards and updates existing items without importing them into Git. [Board guide](docs/BOARDS.md)

**Unreleased:** [task runs](docs/TASK-PIPELINE.md) connect a saved card to an isolated Git
working copy, chat, pinned diff, automatic verification commands and human approval.

## Updates and privacy

The PC checks releases and supplies the matching APK to Android. The phone can trigger the PC check; Android still asks for installation confirmation. Windows updates preserve local configuration and wait for a safe restart. [Update workflow](docs/USER_GUIDE.md#updates)

Recent conversations and board snapshots can be cached locally. Offline mode does not run AI or synchronize edits without the host. Never share pairing codes, credentials, private chats, local account configuration or runtime storage. **Disconnect and forget** removes the saved phone connection and its caches; provider logout is a separate action.

This is an independent companion, not an official OpenAI, Anthropic, GitHub or Miro app. It does not include subscriptions, reproduce cloud-only chat histories or guarantee every provider feature.

## Documentation and development

[User guide](docs/USER_GUIDE.md) · [Руководство](docs/USER_GUIDE.ru.md) · [Providers](docs/PROVIDERS.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Architecture and testing](docs/ARCHITECTURE.md) · [Technical reference](docs/REFERENCE.md) · [Changelog](CHANGELOG.md)

`npm ci` installs the locked dependencies. Run `npm test`, `npm run build`, `npm run test:ui` and `npm run check:docs`. Browser tests use synthetic data; native builds and physical-device behavior require separate checks. Read [AGENTS.md](AGENTS.md) before preparing public changes.

The [Pocket Code product board](project-boards/README.md) records plans and evidence. Release versions link their exact source commit and branch. Unreleased entries describe source changes, not an already available update.
