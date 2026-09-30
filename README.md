# Pocket Code

Android companion for Claude Code and Codex running on your own Windows PC. Connect over local Wi-Fi or an HTTPS tunnel by scanning a QR code.

## Features

- Read and continue local Claude Code and supported Claude Desktop Code histories.
- Switch between Claude and Codex workspaces in the sidebar or chat header. Each keeps its own chats, active task, draft, attachments, model, mode and project folder. Workspace/model/project choices persist across app restarts; message drafts stay in memory for the current connection.
- Codex uses the installed local app-server and existing PC login. Import local histories from allowed project folders, start/resume chats, attach images/files, view streamed responses and tools, answer questions, approve individual actions and stop turns. Model choices come from the installed Codex catalog.
- Live terminal, file uploads, project file browser, and explicit tool approvals.
- Markdown, code blocks, tables, images with enlargement, nested tool results, PDF attachments, and visible fallback for other structured blocks. External images load only when tapped. Interactive Claude/Codex artifacts and every provider-specific block are not implemented.
- Review panel for working-tree, staged, and branch Git changes within the selected project folder. Side-by-side and unified layouts. Changes include edits made outside the current chat.
- English/Russian interface, saved palettes and themes, 8–22 px chat text, 60–130% interface scale, spacing and compact mode. Model, request mode, budget and last allowed project folder are saved locally.
- Automatic older-history loading at the top edge, stable reading position, and an eye toggle for content-only reading with a visible return control.
- Agent activity cards open a separate read-only context panel, with task, available result and child conversation. Back returns to the parent draft and scroll position. Status is shown only when the provider supplies evidence; saved starts alone do not prove that an agent is still running.
- Jira Jobs through an existing **claude.ai Atlassian MCP** connection available to native Claude Code. Read assigned issues and manually send selected issues to a sequential AI queue. Jira reads consume Claude usage; no tasks start merely by opening Jobs.
- GitHub release checks through the connected PC. Android can download and verify a new APK, then open the system installer. Android requires installation permission and user confirmation; silent installation is not available on ordinary devices.

## Run the PC bridge

Requires Windows and Node.js 22+. Install and sign in to Claude Code and/or Codex on the PC for the workspace you want to use. Install dependencies with `npm ci` and build with `npm run build`.

Run **Start Pocket Code.cmd** for LAN or **Start Pocket Code Internet.cmd** for mobile internet. Choose the project folder that the phone may access. Keep the server running. The internet launcher installs Cloudflare's tunnel client locally and opens a pairing QR in your browser. A restarted temporary tunnel has a new address: scan its new QR.

Install the APK from this repository's Releases on Android 7 or later. Scan the PC's QR in the app. Keep the pairing key private. Internet mode passes encrypted traffic through Cloudflare; LAN HTTP is intended for a trusted local network. Tailscale is another option for a private connection.

The bridge stores runtime files under `%USERPROFILE%/.pocket-code`, outside the source directory. Authentication and allowed-root checks apply to every API endpoint. Do not publish that runtime directory, QR pages, connection keys, Claude credentials, or session files.

## Workspaces

Select **Claude** or **Codex** from **Workspace**. The model, project and conversation shown belong to that selection. The project picker shares allowed folders discovered from both providers, including nested project folders; chat histories stay separate. Switching does not cancel a running task. To prevent conflicting edits, the bridge permits only one active agent or terminal per project folder. Before continuing an existing desktop chat, finish its current response on the PC and confirm the handover on the phone.

Codex Desktop can retain exclusive write access even after its response finishes. If Pocket Code says the chat is open on the PC, history is still readable; finish the desktop work, close Codex Desktop and retry on the phone. Pocket Code does not remove locks, stop Desktop or resend rejected messages automatically. This replaces the opaque `-32600` error for an active writer.

Codex must provide the app-server protocol. The bridge discovers its native executable on Windows; `POCKET_CODEX_EXECUTABLE` can point to a custom installation. Credentials remain in Codex's own local storage. Settings → AI & workspace selects the Codex access mode: **Full access** (the mobile default: unrestricted files/network, no approval prompts), **Ask for approval** (project sandbox with user approvals), or **Approve for me** (project sandbox with native Codex automatic review). The question-mark button explains each mode. The choice is saved on the phone and applies to the next message, including continued chats and newly queued Jira tasks. Native managed policies still apply; rejected settings are not silently replaced. Plan mode and Jira Reviewer/QA jobs stay read-only without escalation. Unsupported interactive requests fail closed. The Claude request budget does not apply to Codex.

Settings → Usage limits displays account windows, remaining percentages and reset times for the selected Claude or Codex workspace. Codex uses its native account rate-limit RPC. Claude uses the installed Agent SDK's experimental structured usage control request, without a model turn or transcript scan; updates are cached for one minute. API-key/provider accounts and older CLI versions may not expose subscription limits. Missing values are shown as unavailable, never zero usage. Credentials stay in the native clients.

The chat header shows Review only when the selected project has a working-tree or branch diff. Results and reading mode appear when their content exists. Settings has separate pages for appearance/language, AI/workspace, usage, Jira, updates, connection and app details.

The live terminal currently supports Claude. Codex operates through the structured chat interface. Cloud-only conversations and provider-specific interactive desktop artifacts are not imported. See [FEATURES.md](FEATURES.md) for coverage and remaining limits.

## Project rules and results

**Project** replaces the previous Files navigation item. Its Rules, Changelog and Files tabs stay tied to the selected project folder. Rules are discovered from `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md`, `CLAUDE.local.md`, `RULES.md` and Markdown files under `.claude/rules`, `.codex/rules`, `.agents/rules` or `rules`. Changelogs use `CHANGELOG.md`, `CHANGES.md` or `HISTORY.md` in the project root or `docs` (case-insensitive names). The viewer does not create rules or change which instructions the native agent loads.

Markdown retains headings, lists, tables, links and code blocks. Open documents refresh every 15 seconds while visible; Refresh also rediscovers files. Discovery stays within the selected allowed folder, skips symlinks and dependency trees, and is bounded to 150 documents. Markdown previews are limited to 1 MB. An unavailable refresh retains the last loaded copy with a visible error.

In a chat, **Results** opens a separate panel for Images, Documents, Code, Links and Tools. Assistant results and your source attachments have separate views; the full conversation remains intact. Local image/PDF/text previews use authenticated project-scoped reads only when selected. External resources require explicit opening. The panel indexes the loaded history; load more messages there to include older content. A current PC file can differ from its saved chat snapshot, and the viewer labels that distinction. Office documents and provider-specific interactive artifacts do not have native previews here.

## Jira

Connect Atlassian MCP in your Claude account and verify that `claude mcp list` reports **claude.ai Atlassian MCP** as connected. Pocket Code uses that connection through native Claude Code; it does not copy its OAuth credentials. Settings → Jira shows the source and can disable or re-enable its use by Pocket Code. Disconnecting here does not revoke access in Claude.

Issue lists are cached for one minute, site discovery for ten minutes. The latest individual issue is read before starting work. Each read has a four-turn, 85-second bound and an exact read-only tool guard. Standalone Android OAuth is an alternative activated with `POCKET_JIRA_MODE=oauth` on the PC; it may require separate organization approval.

Jobs starts with assigned issues, search and categories by workflow stage or issue type. Selecting an issue opens its details and current actions; folder and execution options appear only before starting work. Selections survive filter changes, and **Select all matching** follows every result page. Search uses Jira's text search (including summary and description), or an exact issue key. Stage filtering preserves pagination and recognizes the supported English/Russian status names.

Task detail requests the full issue view separately from transition metadata. The connector's default compact view can omit a description even when it exists in Jira. Markdown and safe rich-text descriptions are supported; embedded resources become explicit links instead of loading automatically. Loading, failed retrieval and an actually empty description are distinct states.

Choose **Developer**, **Reviewer** or **QA engineer** in Settings → Jira. Actions are derived from the live Jira transitions and required fields, not hardcoded transition IDs. The role organizes the interface; it does not grant Jira permissions. Unrecognized statuses and unsupported required fields direct you to Jira.

- Developers start work and move the issue to In Progress; the linked chat stays available. **Send for review** previews the branch and files, then creates/reuses a PR and applies the selected review transition after confirmation.
- Reviewers open a review chat, approve review into the QA waiting stage, or request changes. QA engineers start checking, pass to the next available verification stage, or return the issue to development. Their agent sessions use Plan/read-only mode. These buttons change Jira; they do not submit GitHub review votes or merge PRs.
- A completed AI response never approves review, passes QA, or creates a PR automatically. Chat links are retained per role and workspace.

Selected issues run sequentially in the chosen Claude or Codex workspace. New queues retain the selected role and check the issue's current start action when it reaches the front. A task needing required fields or an unavailable action pauses the queue with an explanation. Old saved queues keep their original behavior and do not gain Jira write permissions during an update. Jira access still uses the existing Claude connector even when Codex performs the task.

PR publication requires GitHub CLI sign-in, the exact repository root, a clean working tree and committed task changes on a separate branch. It previews and pushes only the approved commit to that branch, without force, hooks, extra tags or submodules. It never stages unrelated files. Interrupted operations retain known PR/chat links and require explicit recovery; recovery does not undo remote changes. Workflow files are private runtime data under the bridge's data directory.

## Updates

Install the first updater-capable APK manually. Subsequent checks run when connected and every six hours while the app is active, with a manual check in Settings. Auto-download can be disabled. The PC needs GitHub CLI (`gh`) and access to the release repository.

Set `POCKET_UPDATE_REPO=owner/repository`, or create `%USERPROFILE%/.pocket-code/updates.json` containing `{"repository":"owner/repository"}`. Restart the bridge after configuring it. GitHub authentication stays on the PC; the phone never receives a GitHub token.

A stable release contains `Pocket-Code-VERSION.apk` and `update.json`. The PC and phone verify SHA-256 and size. Android additionally checks package identity, a greater version code, and the same signer as the installed app. Keep the original signing keystore private and backed up: APKs signed with a different key cannot update existing installations. Current development packages use the local Android debug signer and are not Play Store releases.

The updater installs the Android app only. Update the PC source separately when a release requires new server features. For permission prompts or a cancelled install, use Settings → App updates → Install update.

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
