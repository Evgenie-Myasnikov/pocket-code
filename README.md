# Pocket Code

Android companion for Claude Code and Codex running on your own Windows PC. Connect over local Wi-Fi or an HTTPS tunnel by scanning a QR code.

## Features

- Read and continue local Claude Code and supported Claude Desktop Code histories.
- Switch between Claude and Codex workspaces in the sidebar or chat header. Each keeps its own chats, active task, draft, attachments, model, mode and project folder. Workspace/model/project choices persist across app restarts; message drafts stay in memory for the current connection.
- Codex uses the installed local app-server and existing PC login. Import local histories from allowed project folders, start/resume chats, attach images/files, view streamed responses and tools, answer questions, approve individual actions and stop turns. Model choices come from the installed Codex catalog.
- Live terminal, file uploads, project file browser, and explicit tool approvals.
- Markdown, code blocks, tables, images with enlargement, nested tool results, PDF attachments, and visible fallback for other structured blocks. External images load only when tapped. Interactive Claude/Codex artifacts and every provider-specific block are not implemented.
- Review panel for working-tree, staged, and branch Git changes within the selected project folder. Side-by-side and unified layouts. Changes include edits made outside the current chat.
- English/Russian interface, saved palettes and themes, 8–22 px chat text, 60–120% interface scale, spacing and compact mode. Model, request mode, budget and last allowed project folder are saved locally.
- Jira Jobs through an existing **claude.ai Atlassian MCP** connection available to native Claude Code. Read assigned issues and manually send selected issues to a sequential AI queue. Jira reads consume Claude usage; no tasks start merely by opening Jobs.
- GitHub release checks through the connected PC. Android can download and verify a new APK, then open the system installer. Android requires installation permission and user confirmation; silent installation is not available on ordinary devices.

## Run the PC bridge

Requires Windows and Node.js 22+. Install and sign in to Claude Code and/or Codex on the PC for the workspace you want to use. Install dependencies with `npm ci` and build with `npm run build`.

Run **Start Pocket Code.cmd** for LAN or **Start Pocket Code Internet.cmd** for mobile internet. Choose the project folder that the phone may access. Keep the server running. The internet launcher installs Cloudflare's tunnel client locally and opens a pairing QR in your browser. A restarted temporary tunnel has a new address: scan its new QR.

Install the APK from this repository's Releases on Android 7 or later. Scan the PC's QR in the app. Keep the pairing key private. Internet mode passes encrypted traffic through Cloudflare; LAN HTTP is intended for a trusted local network. Tailscale is another option for a private connection.

The bridge stores runtime files under `%USERPROFILE%/.pocket-code`, outside the source directory. Authentication and allowed-root checks apply to every API endpoint. Do not publish that runtime directory, QR pages, connection keys, Claude credentials, or session files.

## Workspaces

Select **Claude** or **Codex** from **Workspace**. The model, project and conversation shown belong to that selection. Switching does not cancel a running task. To prevent conflicting edits, the bridge permits only one active agent or terminal per project folder. Before continuing an existing desktop chat, finish its current response on the PC and confirm the handover on the phone.

Codex must provide the app-server protocol. The bridge discovers its native executable on Windows; `POCKET_CODEX_EXECUTABLE` can point to a custom installation. Credentials remain in Codex's own local storage. Codex Plan mode uses a read-only sandbox; ordinary turns use a restricted workspace sandbox, respecting stricter configured restrictions. Unsupported interactive requests fail closed. The Claude request budget does not apply to Codex.

The live terminal currently supports Claude. Codex operates through the structured chat interface. Cloud-only conversations and provider-specific interactive desktop artifacts are not imported. See [FEATURES.md](FEATURES.md) for coverage and remaining limits.

## Jira

Connect Atlassian MCP in your Claude account and verify that `claude mcp list` reports **claude.ai Atlassian MCP** as connected. Pocket Code uses that connection through native Claude Code; it does not copy its OAuth credentials. Settings → Jira shows the source and can disable or re-enable its use by Pocket Code. Disconnecting here does not revoke access in Claude.

Issue lists are cached for one minute, site discovery for ten minutes. The latest individual issue is read before starting work. Each read has a four-turn, 85-second bound and an exact read-only tool guard. Standalone Android OAuth is an alternative activated with `POCKET_JIRA_MODE=oauth` on the PC; it may require separate organization approval.

Selected Jira issues run in the chosen Claude or Codex workspace, with independent persistent queues. Jira access still uses the existing Claude connector even when Codex performs the task. Queue actions do not change Jira statuses, assignees or comments.

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
