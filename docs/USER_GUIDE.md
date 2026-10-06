# Pocket Code user guide

[Documentation](README.md) · [Русский](USER_GUIDE.ru.md)

Pocket Code is a Windows host and Android companion for local AI coding tools. Windows and Android can both send chat messages. The host must be running for fresh history, AI requests, files, repository edits and update downloads.

<a id="qr"></a>
## Install and connect

1. Run **Setup Pocket Code.cmd** on Windows. Setup reuses a supported Node.js installation or downloads a private LTS runtime and verifies its checksum. It installs development dependencies, builds the shared UI and desktop shell, and creates shortcuts. You do not need the Android SDK to install a released APK.
2. Open desktop **Settings → AI providers**. Choose Claude, Codex or Copilot and inspect installation, server and sign-in states. If automatic detection fails, choose a supported manual sign-in method. Complete login in the provider's PC window or browser, then refresh. See [sign-in methods](PROVIDER-SIGN-IN.md).
3. Open desktop **Settings → Connection**. Select one of the available addresses: local Wi-Fi/LAN, a configured Tailscale address, or HTTPS internet tunnel. These are different routes to the same host, not different AI accounts.
4. Install the released APK on Android. Open **Settings → PC connection → Scan QR code**, point the camera at the selected PC QR and allow pairing. No manual address/key entry is required for the normal flow.
5. Open **Chats**, choose a provider, then **New**. Choose the project for the new conversation. Existing chats keep their original folder.

Treat the QR as a password. The host gives each paired device its own credential. Windows Connection lists devices, status and disconnect controls. Revoking a phone requires pairing again. A changed temporary tunnel address may also require a fresh scan.

Closing/minimizing Windows hides it in the tray. **Tray → Exit** ends the application and its owned host. Enable Windows startup or reconnect in **Settings → Windows application**. Explicit disconnect remains disconnected. Sleep, shutdown and network loss can interrupt remote access; cached content is not proof that the PC is online.

<a id="chats"></a>
## Chats and model selection

**New** is the first item in the conversation list. A real conversation is created when the first message is sent. On Windows, choose a provider in the side rail; on mobile choose it in the chat list or new-chat context. Project/provider selectors are not a way to move an existing history to another repository.

Use search to find a conversation. Supported local Claude Code, Codex and Copilot histories appear from allowed PC folders. Cloud-only conversations and some provider-specific desktop artifacts are unavailable. A busy Codex Desktop writer can block sending; release the chat on the PC and retry explicitly. A rejected send keeps a recoverable draft rather than silently resubmitting it.

The model selector is below the message field. **Unreleased Claude improvement:** it reads the installed Claude catalog, includes exact versions when reported and offers **Other version…** for a full model ID. Aliases such as Sonnet can change their target after a provider update; a full ID pins it. The selected model persists. If the catalog cannot load, aliases and manual IDs remain available. The account/provider decides whether a selected ID is actually allowed.

Codex reasoning effort appears when advertised for the model and is saved per model. Model and effort changes apply to the next turn. Provider runtime version and model version are different: the installed runtime is shown in account settings. [Provider capabilities](PROVIDERS.md)

Send with the arrow or **Ctrl+Enter / Cmd+Enter**. A running chat accepts clarifications where supported; they may be queued rather than immediately interrupting a command. Stop affects that chat. Switching sections or minimizing the phone does not stop the PC job.

**Unreleased composer update:** the shared input grows with a multiline prompt up to a bounded height. Attachments, model/effort controls and compact send/stop buttons stay within the same surface. Fresh response characters softly fade into view; already loaded history and code blocks remain still. No artificial typing queue delays the response. The operating system's reduced-motion setting disables the effect.

Only one writer may work in an overlapping project folder. Up to three Pocket Code jobs per provider can run in separate non-overlapping folders. Use separate existing worktrees for isolated work; Pocket Code does not create or merge them automatically.

## Attachments and history

Use the paperclip, or paste an image/file on Windows. Image attachments show thumbnails; other files show tiles. Remove an attachment with its cross before sending. A message accepts up to ten attachments, each at most 10 MB. Uploads are stored on the host; a missing file may need to be attached again.

The app shows recent history first and loads older pages as you scroll. Loading and history-boundary messages distinguish waiting from the end. Use the jump controls to reach the beginning or newer messages. Position is saved per chat. If the agent was working when you left, returning follows the new messages; idle chats retain the reading position.

Recent chat data is cached per PC/provider. Reconnecting refreshes it. The cache is limited and is not a complete offline archive or draft backup. A file preview shows the current file on the host, which may differ from the original result.

## Tool activity, subagents and results

Commands and edits appear as compact activity rows. Expand a row for details, output or errors. Available subagents open a child context; return to the parent with Back. Providers differ in whether they expose a full transcript, task/result summary or no child context. Unknown status is not proof of completion.

**Results** scans available history independently of the visible messages. Choose Images, Documents or Links, then assistant results or your sources. Code and Tools are not result categories; inspect those in messages or Review. Scanning can continue gradually, reports errors and offers retry. It is not an inventory of every file on disk.

Select an image to zoom, pan or fit it to the screen. External images require explicit loading. Markdown and supported documents render in the viewer; arbitrary office/interactive provider artifacts do not have full native renderers. The eye in the chat hides surrounding controls for reading; use the restore control or Back to leave reading mode.

<a id="diff"></a>
## Review changes

Open **Review** from a chat when repository changes are available. Its heading identifies the repository and branch. Review is scoped to the chat project, including edits made outside that AI turn. Inside a larger Git repository, the project path limits the comparison.

| Control | Meaning |
| --- | --- |
| All changes | Uncommitted changes, including eligible new files |
| Staged changes | Changes already in the Git index |
| Branch changes | Committed differences against the selected base |
| Unified | Added/removed lines in one sequence |
| Split | Old and new sides; a newly added file can have an empty old side |
| Inline highlights (automatic) | Emphasize changed spans within lines when available |
| File types | Hide selected extensions such as .png |
| Code size / fit width | Adjust code independently of UI scale or fit long lines to the viewport |

Scroll the file list and collapse individual file diffs. Long lines can still require horizontal scrolling when fit is disabled. Very long lines become small when fit is enabled. Refresh re-reads Git; a network error can leave a retained, stale comparison. Review does not stage, commit, approve, merge or publish.

## Boards, rules and changelogs

**Board** lists repositories that already have a board or a connected Miro board. **Add project board** explicitly creates a board for a repository; projects without one stay out of the list. Long-press empty canvas, or right-click on PC, to create a note. Move notes between version columns; the target column is highlighted. Right-click a note or board card to delete with confirmation. [Full board guide](BOARDS.md)

**Rules** and **Changelog** are separate sections. Select a Git project and open its Markdown document. The document view is separate from the index. Rules includes the built-in board-maintenance switch; disabling it does not disable project-native rules or authorize unrelated actions. A board is optional.

## Activity, notifications and usage

**Unreleased:** saved repository notes can start [isolated task runs](TASK-PIPELINE.md),
with their own chat, pinned diff, verification commands and human approval. Miro AI
read/write access has a [separate setup](MIRO-AI.md).

Open the handle on the right edge to inspect active, waiting, failed and completed chats. Reading a completed result acknowledges it; a question stays actionable until answered. The Chats tab has a status indicator. Provider reporting and connection state determine how fresh these indicators are.

Enable chat notifications in settings and grant Android's notification permission. The native background watcher can report completion, errors and questions while a host connection is available. Battery restrictions or a stopped app can delay delivery. This is not a hosted push service. The board bell is a separate private inbox for assignments/questions from compatible host boards, not Miro's notification inbox.

The unreleased host journal retains up to 1,000 run events for seven days. Windows and
Android remember their cursor, catch up after reconnect and open the exact job/chat from
an alert. For runs started outside Pocket Code, only completion/stopped events supported
by the transcript monitor are available; error/question events cover Pocket Code jobs.

**Usage** shows the windows and reset times reported by the provider. The small ring near the composer summarizes the limiting applicable allowance. Missing or stale data is unavailable, not an invented 100% balance. Copilot capability coverage differs from Claude/Codex.

<a id="updates"></a>
## Updates

1. Open **Settings → Updates** on either device and check for updates through the PC.
2. The host reads release metadata and downloads verified packages. A compatible PC update restarts when active work permits it.
3. Android downloads the matching APK from the connected PC. Confirm installation in the Android installer; silent APK installation is not supported.
4. Reopen/reconnect after installation. Keep the PC available until transfer completes.

The phone does not independently install a PC update or transfer credentials to GitHub. Installation preserves application data; **Disconnect and forget** is separate. An old client that cannot understand the current update source can be upgraded once by installing the released APK over the existing app. See [troubleshooting](TROUBLESHOOTING.md).

## Settings and account separation

Appearance controls theme, text/UI size and board grid spacing. Diff size is independent. Account settings show provider login/server state and logout. Signing out of an AI provider does not revoke a paired phone; disconnecting a phone does not sign out of the provider.

**Disconnect and forget** is at the bottom of the main mobile settings index. It clears that saved connection and related caches. Use the PC device list to revoke another device. Never paste tokens into chats or screenshots.

Jira settings and compatibility endpoints remain, but the old Tasks/Jira workflow page and WorkSpace administration are no longer primary navigation. Miro connects in its own settings category and retains its own authentication and access rules.
