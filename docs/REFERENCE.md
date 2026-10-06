# Pocket Code technical reference

[Overview](../README.md) | [User guide](USER_GUIDE.md) | [Руководство на русском](USER_GUIDE.ru.md)

Android companion for Claude Code and Codex running on your own Windows PC. Connect over local Wi-Fi or an HTTPS tunnel by scanning a QR code.

## Features

- Read and continue local Claude Code and supported Claude Desktop Code histories.
- Switch between Claude and Codex workspaces in the sidebar or chat header. Each keeps its own chats, active task, draft, attachments, model and project folder. Workspace/model/project choices persist across app restarts; message drafts stay in memory for the current connection.
- Codex uses the installed local app-server and existing PC login. Import local histories from allowed project folders, start/resume chats, attach images/files, view streamed responses and tools, answer questions, approve individual actions and stop turns. Model choices come from the installed Codex catalog.
- Live terminal, file uploads, project file browser, and explicit tool approvals.
- Markdown, code blocks, tables, images with enlargement, nested tool results, PDF attachments, and visible fallback for other structured blocks. External images load only when tapped. Interactive Claude/Codex artifacts and every provider-specific block are not implemented.
- Review follows the open chat folder and shows its repository/branch. Compact file selection, optional comparison controls and an eye button for distraction-free diff reading. Working-tree, staged and branch comparisons include edits made outside the chat.
- English/Russian interface, saved palettes and themes, 8–22 px chat text, 60–130% interface scale, spacing and compact mode. Model, budget and last allowed project folder are saved locally.
- Automatic older-history loading at the top edge, stable reading position, and an eye toggle for content-only reading with a visible return control.
- Agent activity cards open a separate read-only context panel, with task, available result and child conversation. Back returns to the parent draft and scroll position. Status is shown only when the provider supplies evidence; saved starts alone do not prove that an agent is still running.
- Jira Tasks through the selected workspace: direct MCP tools in Codex, or an existing **claude.ai Atlassian MCP** connection available to native Claude Code. Read assigned issues and send selected issues to a single AI task chat. Jira reads consume Claude usage; no tasks start merely by opening Tasks.
- GitHub release checks through the connected PC. Android can download and verify a new APK, then open the system installer. Android requires installation permission and user confirmation; silent installation is not available on ordinary devices.
- After the Android app updates, it requests the matching PC release automatically. The PC verifies and installs it separately, waits for jobs, Jira operations and terminals to finish, then restarts. If the new host cannot start, it attempts to restore the previous version. Status and retry are in Settings → Updates. Requires bridge 0.13.0 or newer and access to GitHub/npm from the PC.

## Run the PC bridge

Requires Windows 10 or newer. **Setup Pocket Code.cmd** detects or downloads Node.js and installs dependencies, including development/build tools, before building. No winget or elevated Node installer is needed. For manual development use Node.js 22.12+/24+, `npm ci --include=dev`, then `npm run build`. Provider sign-in is available in the desktop settings.

Run **Start Pocket Code.cmd** for the native desktop application, with LAN/internet selection in its window. **scripts/start.ps1 -Internet** remains the legacy console launcher. Choose projects on the phone; ready local fixed drives are available by default. The console script supports restricting access with explicit -ProjectPath. Internet mode installs Cloudflare's tunnel client locally. A restarted temporary tunnel may have a new address: scan its new QR. See [desktop setup](DESKTOP.md).

The native desktop application owns its hidden launcher and server process tree. Close/minimize hides to the tray; explicit tray Exit disposes the job. The legacy console launcher terminates its process tree when its window closes or Ctrl+C is pressed. Both include the tunnel and replacement hosts created by an update. Starting again detects an existing host rather than creating duplicates. Closing a QR browser tab or disconnecting the phone leaves the server running. Use desktop Disconnect to preserve disconnected state; an external stop command can be followed by desktop automatic reconnection.

On Windows, the launcher uses a [job object](https://learn.microsoft.com/windows/win32/procthread/job-objects) with termination on handle closure. The initial process joins the job atomically, and update workers and detached children stay inside it. Use the Windows launchers for this process-tree ownership; direct `npm run server` is intended for development.

Automatic host handoffs preserve the running tunnel and pairing address. Closing or restarting the tunnel itself still changes a temporary address. PC updates live under the runtime directory's `host/versions`; project files and credentials are not overwritten. The launcher remembers the last verified host installation.

If an older Android build reports **Invalid update source**, install version 0.13.0 or newer from Releases once. Older builds cannot repair their native installer through an in-app download; subsequent updates use the corrected installer.

Install the APK from this repository's Releases on Android 7 or later. Scan the PC's QR in the app. Keep the pairing key private. Internet mode passes encrypted traffic through Cloudflare; LAN HTTP is intended for a trusted local network. Tailscale is another option for a private connection.

The bridge stores runtime files under `%USERPROFILE%/.pocket-code`, outside the source directory. Authentication and allowed-root checks apply to every API endpoint. Do not publish that runtime directory, QR pages, connection keys, Claude credentials, or session files.

## Providers and project scope

Select **Claude**, **Codex** or **Copilot** from the provider selector in the chat list. The model, project and conversation shown belong to that selection. The project picker shares allowed roots, discovered local Git projects and available provider project folders; chat histories stay separate. Switching does not cancel a running task. To prevent conflicting edits, the bridge permits only one active agent or terminal per project folder. Before continuing an existing desktop chat, finish its current response on the PC and confirm the handover on the phone.

Codex Desktop can retain exclusive write access even after its response finishes. If Pocket Code says the chat is open on the PC, history is still readable; finish the desktop work, close Codex Desktop and retry on the phone. Pocket Code does not remove locks, stop Desktop or resend rejected messages automatically. This replaces the opaque `-32600` error for an active writer.

Codex must provide the app-server protocol. The bridge discovers its native executable on Windows; `POCKET_CODEX_EXECUTABLE` can point to a custom installation. Credentials remain in Codex's own local storage. Settings → AI & workspace selects the Codex access mode: **Full access** (the mobile default: unrestricted files/network, no approval prompts), **Ask for approval** (project sandbox with user approvals), or **Approve for me** (project sandbox with native Codex automatic review). The question-mark button explains each mode. The choice is saved on the phone and applies to the next message, including continued chats and new Jira tasks. Native managed policies still apply; rejected settings are not silently replaced. Jira Reviewer/QA jobs stay read-only without escalation. Unsupported interactive requests fail closed. The Claude request budget does not apply to Codex.

Settings → Usage limits displays account windows, remaining percentages and reset times for the selected Claude or Codex workspace. Codex uses its native account rate-limit RPC. Claude uses the installed Agent SDK's experimental structured usage control request, without a model turn or transcript scan; updates are cached for one minute. API-key/provider accounts and older CLI versions may not expose subscription limits. Missing values are shown as unavailable, never zero usage. Credentials stay in the native clients.

The chat header shows Review only when the selected project has a working-tree or branch diff. Results and reading mode appear when their content exists. Settings has separate pages for appearance/language, AI/workspace, usage, Jira, updates, connection and app details.

The app uses structured chats for Claude, Codex and Copilot. Separate live-terminal navigation was removed; legacy host endpoints remain for older clients. Cloud-only conversations and provider-specific interactive desktop artifacts are not imported. See [FEATURES.md](../FEATURES.md) for coverage and remaining limits.

## Project rules and results

**Rules** and **Changelog** are separate navigation sections. Choose a repository inside the section, then open its Markdown document. The retired Project overview is not the current entry point. Rules are discovered from `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md`, `CLAUDE.local.md`, `RULES.md` and Markdown files under `.claude/rules`, `.codex/rules`, `.agents/rules` or `rules`. Changelogs use `CHANGELOG.md`, `CHANGES.md` or `HISTORY.md` in the project root or `docs` (case-insensitive names). The viewer does not create rules or change which instructions the native agent loads.

Markdown retains headings, lists, tables, links and code blocks. Open documents refresh every 15 seconds while visible; Refresh also rediscovers files. Discovery stays within the selected allowed folder, skips symlinks and dependency trees, and is bounded to 150 documents. Markdown previews are limited to 1 MB. An unavailable refresh retains the last loaded copy with a visible error.

In a chat, **Results** opens a separate panel for Images, Documents and Links. Assistant results and your source attachments have separate views; the full conversation remains intact. Images have visible-area thumbnails and a full-screen viewer with pinch/pan, zoom buttons and Fit to screen. Local thumbnails use authenticated project-scoped reads with at most two requests/decodes at a time; the existing artifact endpoint transfers the original image before client-side downsampling. Local PDF/text previews load when selected. External resources require explicit opening. The panel gradually indexes every available history page independently of the chat viewport. It starts with all results and sources, shows scan progress and retains partial results on failure with a retry action. Closing the panel cancels further reads. A current PC file can differ from its saved chat snapshot. Office documents and provider-specific interactive artifacts do not have native previews here.

## Jira

The PC selects one shared Jira connection independently of the task AI. Configure it from the QR page or app Jira settings. Sources are the existing Claude connector and direct MCP through Codex; they require separate authorization. The Claude path can consume model usage; direct tools do not need a model turn. Changing AI workspaces does not switch the Jira account, and there is no silent fallback. Standalone OAuth remains an optional host configuration. See [provider connections](PROVIDERS.md#jira-is-independent-of-the-task-ai).

Tasks starts with assigned issues, search and Jira's native status categories (To do, In progress, Done). Expand Jira filters to combine project, exact status and issue type. Suggestions come from loaded tasks; any valid Jira value can be entered. Filters are applied on the server, always within the current user's assigned issues. Changing filters clears selection; Select all matching follows every page of the current query. Search supports Jira text search or an exact issue key.

This follows [Jira basic search](https://support.atlassian.com/jira-software-cloud/docs/find-specific-issues/) and [status category filtering](https://support.atlassian.com/jira/kb/how-to-search-using-statuscategory-statuscategorychangeddate-function-with-jql/).

Task detail requests the full issue view separately from transition metadata. The connector's default compact view can omit a description even when it exists in Jira. Markdown and safe rich-text descriptions are supported; embedded resources become explicit links instead of loading automatically. Loading, failed retrieval and an actually empty description are distinct states.

Choose **Developer**, **Reviewer** or **QA engineer** in Settings → Jira. Actions are derived from the live Jira transitions and required fields, not hardcoded transition IDs. The role organizes the interface; it does not grant Jira permissions. Unrecognized statuses and unsupported required fields direct you to Jira.

- Developers start work and move the issue to In Progress; the linked chat stays available. **Send for review** previews the branch and files, then creates/reuses a PR and applies the selected review transition after confirmation.
- Reviewers open a review chat, approve review into the QA waiting stage, or request changes. QA engineers start checking, pass to the next available verification stage, or return the issue to development. Their agent sessions use Plan/read-only mode. These buttons change Jira; they do not submit GitHub review votes or merge PRs.
- A completed AI response never approves review, passes QA, or creates a PR automatically. Chat links are retained per role and workspace.

Selected issues open one normal chat in the chosen AI workspace. The client fetches full descriptions with at most two concurrent reads, then provides a sequential task/bug execution prompt appropriate to the selected role. Large batches use a JSON attachment (subject to the normal upload size limit). Preparation failures preserve selection and do not launch an incomplete chat. Batch chat creation does not change Jira statuses or create PRs; individual workflow actions remain available in task details. The legacy queue API remains for older clients, but the new UI no longer creates or displays queues.

PR publication requires GitHub CLI sign-in, the exact repository root, a clean working tree and committed task changes on a separate branch. It previews and pushes only the approved commit to that branch, without force, hooks, extra tags or submodules. It never stages unrelated files. Interrupted operations retain known PR/chat links and require explicit recovery; recovery does not undo remote changes. Workflow files are private runtime data under the bridge's data directory.

## Updates

Install the first APK manually. From 0.21.1 the PC checks public releases at startup and every six hours, downloads and verifies the APK, then makes it available to connected phones. While the PC answers, the phone reads its update status and receives the prepared APK. From 0.22.4, when the PC is not connected, does not answer or has updates disabled, the phone checks the latest GitHub release itself at startup, on return and at most hourly, downloads the APK and opens the installer; it accepts only an APK matching the release checksum and the installed app's signing certificate. **Settings → Updates → Check for updates on PC** explicitly requests a new PC check; without a PC, **Check for updates** asks GitHub directly. GitHub CLI and GitHub login are not required for updates.

The official public release repository is configured by default. For a custom distribution, set `POCKET_UPDATE_REPO=owner/repository`, or create `%USERPROFILE%/.pocket-code/updates.json` containing `{"repository":"owner/repository"}`. Restart the bridge after configuring it. The phone never receives a GitHub token.

A stable release contains `Pocket-Code-VERSION.apk` and `update.json`. The PC and phone verify SHA-256 and size. Android additionally checks package identity, a greater version code, and the same signer as the installed app. Keep the original signing keystore private and backed up: APKs signed with a different key cannot update existing installations. Current development packages use the local Android debug signer and are not Play Store releases.

Windows manages its own desktop/host update, waits for active work and APK transfers, and restores the previous version if startup fails. It does not wait for the phone to upgrade first. A check requested from the phone also triggers the running Windows updater. Android requires installation confirmation; for a cancelled install, use **Install update** in phone settings. Older hosts need updating before supporting this flow.

## Development and release

```sh
npm ci
npm test
npm run build
npm run test:ui
```

UI tests require Chrome; set `POCKET_TEST_BROWSER` if it is installed in a different location. Tests use synthetic projects and do not run real model tasks. Native APK installation, camera use, and PDF viewer behavior still require testing on an Android device.

Build using JDK 21 and Android SDK 36:

```powershell
powershell -NoProfile -File scripts/build-android.ps1
```

The build generates the APK and checksum manifest in `artifacts`. Increment Android's `versionCode` and keep its `versionName` aligned with `package.json`. Publish a new immutable version with:

```powershell
powershell -NoProfile -File scripts/publish-release.ps1 -Repository owner/repository
```

The publishing script never overwrites an existing release. Publish reviewed source separately; never push local runtime/build directories or signing keys.

## AI runtime compatibility checks

Settings → Updates → AI compatibility shows the effective Codex executable and Claude Agent SDK runtime versions. The host checks every five minutes, establishes a baseline on first run and saves subsequent changes privately. Automatic checks are enabled by default and can be disabled here. The last workspace selected on the phone chooses the reviewing AI.

When a runtime version changes, the host waits for its Pocket Code jobs and terminals to be idle, then creates one compatibility task in a shared Pocket Code **source** folder (identified by package name and Android build script). Installed host bundles are excluded. If no source folder is shared, changes remain pending. Reservations survive host restarts; failed or interrupted launches are not automatically repeated. Check Chats before manually retrying an interrupted task.

The task researches official changes, checks protocol/file/image/tool compatibility, makes necessary source changes and runs tests. It does not automatically publish or restart the server. The trigger is separate from the signed APK/host release updater. Claude desktop/CLI updates do not affect a pinned Agent SDK runtime unless that effective runtime or an explicit CLAUDE_EXECUTABLE changes.

Chat command/file activity uses compact expandable rows without provider headers or bubbles. Call/result pairs retain all output and errors. The Normal/Plan selector has been removed from chats; normal chats use the standard mode, while Jira review/QA retains its read-only workflow.

Codex chats offer a reasoning-effort selector beside the model. Choices come from the installed runtime, are saved per model and apply to the next message. The default option uses the advertised model default; older hosts without effort metadata retain their existing behavior. User messages use compact bubbles, while subagents appear as clickable activity rows.

The right **Chat activity** drawer combines Claude, Codex and Copilot runs started through Pocket Code. It groups questions/approvals and errors, running chats, and unread completed/stopped chats. The latest run per chat is shown, with active chats retained first in the 100-item host window. Opening an item switches workspace and preserves drafts. Terminal results disappear after successful viewing at the bottom of their conversation; pending questions stay until answered. Viewed states are saved locally per host, and stale results remain visible if refresh fails. The feed polls every three seconds while the app is visible. It does not infer running state from native Desktop histories, and retained activity is limited to the current host runtime.

## Claude model catalog (unreleased)

Authenticated `GET /api/claude/models?cwd=...` validates the requested allowed directory before metadata discovery. It returns `models` and `source` (`sdk` or `fallback`). Entries include `id`, `name` and optional `resolvedModel`; resolved IDs also become selectable pinned versions. Requests are cached per directory, coalesced and time-bounded. Discovery sends no user prompt and closes its SDK query. The Windows read bridge explicitly permits this route.

`POST /api/jobs` accepts a validated full model ID as well as the existing aliases. The host passes it unchanged to the Claude SDK; model entitlement is checked by the provider. Old hosts without the catalog route keep alias/manual selection in the new client. No release number or model version is synthesized when metadata is absent.
