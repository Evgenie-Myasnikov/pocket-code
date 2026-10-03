# Changelog

## 0.25.9 (Unreleased)

### Features
- boards: delete a repository board from its card context action with confirmation and revision/role checks; retain project files and image assets, and disconnect Miro without deleting its remote board.
- boards: attach up to twelve PNG/JPEG/WebP images per idea, retain portable content-addressed assets, and open thumbnails in the shared fullscreen zoom viewer.
- boards: resolve version links against existing Git refs and preserve the mapping in repository snapshots.
- providers: apply the same rules/skills -> board -> changelog workflow to Claude, Codex and Copilot, including resumed sessions and evidence-based bug investigation.

### Bug Fixes
- chat: return to latest messages when the agent was running on departure, including desktop section changes; retain saved positions for idle chats.
- results: remove Tools and Code categories and entries from chat results, including All and category counts; retain images, documents and links.
- boards: render image viewing outside the transformed canvas so zoomed boards cannot clip the fullscreen viewer.

### Documentation
- rules: require real release branches and exact source commits; preserve shared rule discovery when automatic board writes are disabled.
- boards: document image provenance, portable storage, limits and host compatibility; extend the local helper with read-only project-board lookup.

### Code Refactoring
- release: include the source branch/commit in generated manifests, reject detached or dirty release sources, verify the repository branch and any existing tag, and publish against the exact reviewed commit.

### Validation
- Results/deletion/return changes: TypeScript/Vite, five board server checks, one position-storage check, four focused shared desktop browser scenarios and Windows native smoke passed. Legacy mobile results setup could not start because its provider selector is obsolete; shared desktop results passed. No release published; physical Android not tested.
- TypeScript/Vite, 46 focused board/provider/API tests and four desktop/narrow-screen browser scenarios pass; image API authorization and identical fresh/resumed provider instructions are covered. Images were visually reviewed with synthetic fixtures.
- Windows desktop build and local shortcut installation pass. No release was published. Physical Android and live provider inference were not tested.


## [0.25.8](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.7...v0.25.8) (2026-10-03)

### Bug Fixes
- boards: present board and project names in a responsive card grid without icons or secondary type labels; preserve repository board titles on opening.
- boards: hide dependency and version connector lines; preserve dependency metadata for AI planning and existing chat prompts.

### Validation
- Release source: [c530566](https://github.com/Evgenie-Myasnikov/pocket-code/commit/c530566eb892aefeae4102c3eda5139440d738a3), branch [codex/boards-0.25.8](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/boards-0.25.8).
- Passed TypeScript/Vite, three focused desktop board scenarios and four board data tests. Android APK and Windows package built; source and APK/desktop/host privacy audits passed. Physical Android not tested.


## [0.25.7](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.6...v0.25.7) (2026-10-03)

### Features
- miro: connect a project board by URL in Settings and open its original Miro Live Embed interface on desktop and mobile.
- miro: persist canonical board links privately on the PC; provide reload, browser fallback and explicit disconnection without deleting the remote board.

### Bug Fixes
- chat: replace the bright input outline with a subtle focused background; retain keyboard focus indication.
- boards: display only projects with existing boards; create optional repository boards explicitly and remove trailing card arrows.
- rules: maintain existing boards without automatically creating boards in every repository.

### Code Refactoring
- navigation: remove shared WorkSpace navigation and joining screens; retain legacy host records without destructive migration.
- security: restrict embedded URLs to Miro, discard invitation parameters, keep native commands isolated from external frames and use browser fallback on legacy Android WebViews.

### Documentation
- docs: explain Miro sign-in, PC-local links, remote access rights and limitations. AI API access and offline Miro editing are not included.

### Validation
- Release source: [b7bd30d](https://github.com/Evgenie-Myasnikov/pocket-code/commit/b7bd30d57f839db4e283b021f639a55e332915ec), branch [codex/miro-0.25.7](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/miro-0.25.7).
- Passed 10 focused server tests, 9 interface scenarios, TypeScript/Vite, Android build and Windows desktop smoke checks. Source and final APK/desktop/host privacy audits passed. Physical Android and authenticated private Miro-board editing have not been tested.


## [0.25.6](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.5...v0.25.6) (2026-10-03)

### Features
- boards: open and edit one portable board per project; create a missing board directly in its repository. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- rules: built-in board maintenance is enabled by default for Codex, Claude and Copilot, with a persistent per-project switch. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- boards: show the linked Git branch or an explicit unlinked label on each version column. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- chat: keep a permanent New row at the top; create a conversation only after its first message. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))

### Bug Fixes
- boards: open the original board and highlight the note from an assignment or clarification notification. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- boards: serialize repository writes and reject stale revisions without overwriting newer edits. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- navigation: remove duplicate refresh controls from project documents. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- boards: route dependency arrows outside cards and retain only concrete dependencies. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))

### Documentation
- docs: translate the curated Pocket Code board into Russian and document repository-backed editing. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- rules: require concise categorized version entries in CHANGELOG.md, with real commit references only. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))

### Validation
- Fourteen focused server/board/rules tests, 33 provider tests and 32 desktop/mobile browser scenarios passed. Android and Windows builds, native Windows smoke and source/archive privacy audits passed. Physical Android testing unavailable.
- Private legacy board records remain available through their notifications; repository snapshots contain product data only.


- Release: Published v0.25.6 with APK versionCode 69 and matching Windows/host assets from [a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e) on [codex/project-0.25.6](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/project-0.25.6). GitHub CI passed.

## [0.25.5](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.4...v0.25.5) (2026-10-03)

### Features
- Release: Published v0.25.5 from [b71799a](https://github.com/Evgenie-Myasnikov/pocket-code/commit/b71799af91e3564529d72a605044b05f9e9ca976) on [codex/navigation-0.25.5](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/navigation-0.25.5) with APK versionCode 68 and matching desktop/host assets. GitHub CI passed; the updater downloaded and verified the APK.
- Fixed: Changing the AI provider preserves the Chats section; clipboard images use the attachment uploader and preview without replacing the draft.
- Fixed: A saved board remains readable when its repository folder is unavailable; editing and chat launch are disabled. Repeated open clicks no longer discard the pending response.
- Changed: Repository boards replace the local-board index and read project-boards files directly, including Pocket Code's curated roadmap. Existing private local records are preserved. Repository snapshots are read-only in this view; edit the source or use a workspace board.
- Changed: Remove the redundant Pocket Code brand row from the desktop sidebar; conversations and New chat remain available.
- Improved: Notification cards separate their type, title, preview, timestamp and read state with theme-aware icons and spacing.
- Added: Workspace invitations require a password on first entry; saved user credentials and profiles restore access without duplicate participants or another password prompt. Host approval and revocation remain effective.
- Packaging: Include the curated product board in PC bundles. Workspace authorization still applies before returning saved board data.
- Validation: 31 browser scenarios and seven server/snapshot tests passed, including native clipboard image paste, repository reads and unavailable-folder recovery. TypeScript/Vite, Android build and native Windows smoke passed; source and artifact privacy audits passed. Physical Android testing unavailable.


## 2026-10-03 - PC-scoped chats and neutral provider palettes (0.25.4)
- Fixed: Chat history, drafts, attachments, selected sessions and asynchronous state are isolated by PC connection credentials plus AI provider. Switching a shared WorkSpace preserves the personal PC chat. Returning to a connected PC restores its in-memory conversation state.
- Fixed: A board from another connection cannot open or link a chat on the wrong PC; workspace invitations are not accepted as personal chat connections.
- Added: Neutral, Codex-inspired, Claude-inspired and Copilot-inspired palettes in light/dark/system modes, using shared interface tokens and matching native Windows frame colors. Existing palettes and saved preferences remain supported.
- Validation: 24 interface scenarios (including PC switching, inbox and eight palette/mode contrast checks), five workspace recovery scenarios and two roadmap tests passed. TypeScript/Vite, Android/Windows builds, native Windows smoke and source/artifact privacy audits passed. Physical Android testing unavailable.
- Release: Published v0.25.4 from codex/interface-0.25.4 (343790d), APK versionCode 67, with Windows, host and manifest assets. GitHub CI passed; the production updater downloaded and verified the APK. No production host restart was performed; test listeners exited.


## 2026-10-03 - Single host, reusable profiles and desktop editing (0.25.3)
- Fixed: Legacy per-device host profiles consolidate to one PC owner and remap note assignments. Old member/invitation Host labels migrate to Developer without merging independent member identities; new invitations cannot assign Host.
- Added: Required first and last name, automatic reuse of a saved complete profile, and self-renaming from participants on Windows and Android. Trusted phones request missing host profile details instead of silently skipping them.
- Added: PC-only confirmed deletion of boards and workspaces. Workspace removal revokes credentials and deletes its board metadata; repository files remain intact. Generated-board deletion persists across restarts.
- Improved: Restored Windows windows focus the WebView. Chat Ctrl+A scopes selection to draft or conversation, Ctrl+C uses native selection, and Ctrl+V outside a field focuses the composer.
- Added: Explicit Git snapshot save/import with a strict public field schema, sensitive-text checks, path validation and no automatic commit/push. A curated 15-note Pocket Code product board lives in the repository and drives the generated view.
- Added: Shared application instructions teach Claude, Codex and Copilot to read repository boards, clarify ideas and maintain evidence-based cards without identities or private data. Guidance applies to new and resumed interactive sessions.
- Added: Private per-recipient board inbox on mobile and Windows for assignments and clarification requests. A local AI helper uses authenticated, revision-checked host endpoints and idempotent request IDs; unapproved participants and cross-member inbox access are rejected.
- Validation: 248/249 full-suite tests passed; the timing-sensitive Copilot stream test passed with all eight provider tests in isolation. 42 final provider/board/attention tests and all 29 browser scenarios passed. TypeScript/Vite, Android/Windows packaging and native Windows smoke passed. Source, APK, Windows and host privacy audits passed; physical Android testing unavailable.
- Release: Published v0.25.3 from codex/board-0.25.3 (4fe2149), APK versionCode 66, with Windows, host and manifest assets. GitHub CI passed; the production updater downloaded and verified the APK. Test listeners exited; the production host was not restarted.


## 2026-10-03 - Workspace approval, identities and chat recovery (0.25.2)
- Fixed: Repeated QR joins reuse a proven member identity; concurrent retries create one request. Authenticated legacy paired-device profiles merge into the host profile while preserving assignments.
- Added: New independent workspace members wait for PC host approval. Pending and declined requests cannot read boards, files, people or chats. Hosts approve, decline, change roles and remove members; removal invalidates credentials.
- Improved: Mobile WorkSpace selection and participant count share the header. Saved workspace selection survives restarts. Desktop workspace cards show a single roster with inline management and request counts.
- Fixed: Personal chat cache restores before host health/provider discovery; job errors no longer block session loading. Windows caches its conversation list. Personal chats remain separate from shared membership.
- Compatibility: Existing approved memberships remain active; trusted PC-paired devices retain the host identity. Offline copies cannot be remotely erased while a device is disconnected; authorization failures clear cached workspace data after reconnecting.
- Validation: 247 server tests plus the workspace-vault regression passed; 25 browser scenarios passed, including real QR approval/removal. TypeScript/Vite, Android and Windows packaging passed. Physical Android testing unavailable.


## 2026-10-03 - Direct document sections and reliable QR retries (0.25.1)
- Changed: Replaced Project navigation with Rules and Changelog on Windows and Android. Each section selects among Git projects containing its Markdown documents; single documents open directly.
- Fixed: QR scanning routes PC pairing and workspace invitations to the appropriate flow. Pairing results are cached only while in flight, so re-scanning can recover from a revoked device key.
- Changed: Pocket Code's generated board reads the latest six versions from local CHANGELOG.md and refreshes on demand. Only recorded publications show Done. Untouched legacy examples migrate; edited boards are preserved.
- Improved: Compact connection screen and workspace rows; invitation and member management controls expand on demand.
- Validation: Full server run passed 245/246; an unrelated timing-sensitive Copilot test passed in an isolated eight-test rerun. Roadmap migration API test passed. 21 desktop/navigation/QR/board browser scenarios and six document scenarios passed; offline scenarios passed separately. TypeScript/Vite, Android and Windows packaging passed; publication privacy checks are required.
- Follow-up: The reported phone QR error text was not provided; identified wrong-section and stale-credential failures are covered. Physical Android testing remains unavailable.


## 2026-10-03 - Independent workspace invitations and local roadmap boards (0.25.0)
- Changed: Connection is inside Settings on Windows and Android. WorkSpace has its own QR invitations, explicit Local/Tailscale/Internet transport, desktop-only administration and named participant foldouts.
- Changed: Trusted paired devices reuse the PC profile; independently invited members enter their name. Personal chats and local boards remain separate from shared workspace membership.
- Added: Local boards and a Pocket Code example, populated roadmap templates, six distinct state styles and connected planned versions without creating Git branches.
- Improved: Desktop canvas panning, destination-column highlighting and bounded note placement. Cached workspace catalogs and boards remain readable offline; offline changes are disabled.
- Changed: Settings use categories and AI account/access/project subcategories. Desktop project selection is inside new chats.
- Validation: 244 server tests passed; 22 browser scenarios and the roadmap example scenario passed. Android build and native desktop lifecycle/bridge smoke passed; TypeScript and Windows packaging passed. Source and release privacy checks are required before publication.
- Follow-up: Physical Android testing remains unavailable. Independent workspace members do not receive the host's personal provider execution access.


## 2026-10-02 - Named participants and QR-bound shared boards (0.24.1)
- Changed: Notes support multiple participants through initial avatars, an add button and an upper-right remove control. Stable ID-based colors and legacy single-assignee migration preserve assignments; People view uses the same notes.
- Changed: Workspace entry asks for a personal name, stored separately from role. Host profiles are per connection; QR members choose their name after pairing.
- Changed: Workspace name/count and Board/People views share the header. Removed duplicate titles, saved-on-PC text and workspace switchers; board creation is one button.
- Privacy: Personal chats remain independent of boards. Ordinary workspace members cannot read host sessions/jobs or note chat links; shared-note edits preserve private links on the host. Trusted Host retains full provider access.
- Pairing: QR bindings persist with the device; new workspaces rotate invitations. Older unbound device connections require a fresh QR scan. Manual workspace sign-in UI is removed; legacy API remains compatible.
- Validation: 19 browser scenarios passed across board, desktop and device pairing (18 together, board rechecked separately). Full server run: 242/243 passed; the single Jira workflow failure passed on an isolated four-test rerun. Board privacy/profile and device checks passed; TypeScript/Vite, Android and native desktop smoke/build/package passed.
- Follow-up: Physical Android testing and isolated AI execution for ordinary workspace members remain outstanding. Publication pending artifact audit.

## 2026-10-02 - Board interaction and shared chat header (0.24.0)
- Changed: Board and People views share priority, status and assignee metadata. Columns determine note branches; branch and dependency selectors are removed from note details. Existing dependency data is retained.
- Added: Pinch/wheel zoom, hold-to-create notes, branch creation/rename from column headings, and optimistic note dragging without a release jump.
- Changed: Workspace administration is desktop-only and selects one repository. Participants appear in the header; mobile users can view the roster and join workspaces.
- Improved: Compact shared chat header with contextual actions; removed redundant desktop Chats navigation and Jira role setting.
- Validation: 243 server tests passed; 36 chat/results/desktop browser scenarios and the board browser scenario passed, including cross-column persistence. TypeScript/Vite, Android Gradle and desktop packaging passed; native desktop lifecycle/bridge smoke passed.
- Follow-up: Physical Android testing remains outstanding. Release publication is pending artifact privacy validation.

## 2026-10-02 - Host workspaces, visual boards and shared desktop chat (0.23.0)
- Added: Host-owned workspaces group project folders, boards and chat lists. Participants sign in with host address, workspace name and password; the host assigns Viewer, Developer, Reviewer or QA roles and can revoke sessions. Passwords and participant tokens are hashed in private host storage.
- Added: The desktop pairing screen selects the invitation role beside the QR, initially Host for testing. Non-host invitations select one workspace. Changing the invitation rotates the QR; the server ignores client-supplied roles.
- Added: Work replaces the Jira task list with project boards, Git-branch roadmap lanes, draggable notes, parameters, dependencies, zoom and durable saves with revision conflict checks. Note discussions prepare a chat draft and link the resulting session. Jira task polling is parked; integration modules are retained.
- Changed: Desktop embeds the shared interactive chat, including sending, attachments, steering, approvals, results and Review; switching sections preserves the draft. The native bridge permits only specific chat/board writes.
- Files: server/boards.ts, app.ts, devices.ts; src/WorkBoards.tsx, project-workspaces.tsx, WorkspaceLogin.tsx, WorkspaceMembers.tsx, PairingRole.tsx, App.tsx, DesktopApp.tsx; desktop/DesktopWindow.cs; docs/WORKSPACES.md.
- Validation: TypeScript, web/Android builds and native desktop smoke passed; 15 desktop/board browser scenarios passed. Server suite passed 243/243 sequentially; its first concurrent run had a transient Jira workflow failure which passed in isolation. Targeted access/device/server tests passed after the final scope check.
- Follow-up: This is the visual workflow foundation, not autonomous delivery: AI-created board updates, human routing, approval gates and target delivery remain unimplemented. Member AI execution stays blocked until provider execution is isolated. Physical Android and multi-user deployment testing remain outstanding.


## 2026-10-02 - Notifications for every PC chat (0.22.7)
- Added: The phone notifies when any chat on the PC finishes or is stopped, including chats started in Codex, Claude Code or Copilot CLI on the PC and never opened on the phone. The PC reads the end of each turn from provider session files (Codex task events, Claude end of turn, Copilot turn end after a quiet period) every 10 seconds and serves the transitions at /api/activity/events; existing history never notifies.
- Added: While paired, an Android foreground service polls that feed every 20 seconds with a silent tracking notification, using the specialUse type on Android 14+ so it is not stopped after Android 15's six-hour dataSync limit. Each chat has one alert that later results replace; the chat watched from its own screen is skipped to avoid a duplicate. Settings → Connection can turn it off.
- Also in this release: the Windows Project page and GitHub Copilot usage limits described below.
- Files: server/run-monitor.ts, app.ts, index.ts; RunFeedService.java, ChatWatchService.java, ChatNotificationsPlugin.java, AndroidManifest.xml; src/chat-notifications.ts, App.tsx, SettingsPanel.tsx, translations.ts; user guides; tests/run-monitor.test.ts.
- Validation: Unit tests cover turn boundaries for all three providers, quiet history on the first scan, transitions with session id and folder title, Copilot's quiet period and feed cursors; an API test covers authentication and cursors. Scanning this PC's real session folders took 8-18 ms. Server suite 241/241, Android and TypeScript builds, desktop smoke and related browser scenarios passed (22/24; the Copilot provider and desktop chat/review scenarios already failed before).
- Follow-up: Android delivery was not tested on a physical phone. Credentials stay in memory, so tracking resumes when the app is opened again after Android closes it.

## 2026-10-02 - GitHub Copilot usage limits
- Added: **Settings → Usage** shows GitHub Copilot premium requests, chat and completion quotas with remaining share and billing-period reset, instead of only a link. The composer ring now shows the remaining premium/chat share for Copilot chats.
- Changed: The PC reads quota through the Copilot SDK account API with a 30-second cache. Unlimited chat and completion entitlements are hidden; an exhausted premium quota without allowed overage is reported as unavailable. Remaining share is calculated from used and included requests, with the reported percentage only as a fallback.
- Files: server/copilot-usage.ts, copilot.ts, app.ts; src/CodexUsage.tsx, SettingsPanel.tsx, translations.ts; tests/copilot-usage.test.ts.
- Validation: Unit tests cover limited, unlimited and exhausted quotas, reset dates, missing data and that editor completions never drive the composer ring. TypeScript passed. A live Copilot account was not available for checking real quota values.

## 2026-10-02 - Project page on Windows
- Added: The Windows application has a **Project** page like the phone: project overview, rules, changelog and a read-only file browser for the selected folder. Its folder follows the chat project filter or the open chat, and choosing another folder there also filters the chat list.
- Security: The desktop bridge additionally allows only the read routes /project-docs, /project-doc, /files and /file; the host still limits them to permitted project roots, and write routes remain rejected.
- Files: src/DesktopApp.tsx; desktop/DesktopWindow.cs; tests/desktop-ui.spec.ts, DesktopSmoke.cs.
- Validation: A desktop browser scenario opens the page, reads the rule document and lists files using only read calls besides window theme sync. The desktop smoke test checks the new routes are allowed and write-style routes stay denied. Desktop scenarios 11/12; the remaining chat/review scenario already failed before this change.

## 2026-10-02 - Resizable desktop sidebar and themed scrollbars (0.22.6)
- Added: The Windows sidebar can be resized by dragging its divider (220-560 px, keeping at least 480 px for the conversation). The width is remembered; double-click or Home resets it, and the arrow keys adjust it when the divider has focus.
- Fixed: Lists outside the conversation used grey classic Windows scrollbars with arrow buttons in the desktop window. All scroll areas now use thin scrollbars in the current palette.
- Fixed: The device list test still expected a "Disconnected" entry after 0.22.5 removed disconnected devices.
- Files: src/DesktopApp.tsx, desktop.css, appearance.css; tests/desktop-ui.spec.ts.
- Validation: A new desktop browser scenario drags the divider, checks persistence after reload, both limits, keyboard steps and double-click reset. Chromium reports thin palette-colored scrollbars on the chat list. Desktop, appearance and chat surface scenarios passed except the desktop chat/review scenario that already failed before this change.

## 2026-10-02 - One entry per device with recognisable names (0.22.5)
- Fixed: Every QR scan added a new device entry, so the same phone appeared repeatedly. Phones now send a stable installation identity (a per-app hash of the Android ID, or a random browser id); pairing again, including after reinstalling, updates the existing entry and key and keeps a name set on the PC.
- Fixed: Disconnected devices stayed in the list. Disconnect on the PC now removes the entry, leaving on the phone removes it too, and revoked entries from earlier versions are dropped when the PC host starts.
- Changed: Phones report their Android device name, or maker and model when none is set, instead of a generic "Android device"; the list shows the model beside the version.
- Files: server/devices.ts, app.ts; src/api.ts, App.tsx, DesktopDevices.tsx, native-update.ts; AppUpdatePlugin.java; desktop guide; device tests.
- Validation: Registry tests cover re-pairing one installation (same id, new key, kept custom name, no installation id on disk or in the list), a second installation staying separate, leaving and disconnecting removing entries, QR rotation only on PC disconnect, and dropped legacy revoked entries. API tests cover self-removal being device-only and malformed installation ids being rejected; the browser pairing test checks the stable installation id. Server suite 235/235, JUnit 10/10, TypeScript/Vite and Android builds, desktop smoke and the related browser scenarios (11/11) passed.
- Follow-up: Entries created by 0.22.0–0.22.4 have no installation identity and are not merged automatically; remove leftovers once with Disconnect. Android device names were not checked on a physical phone.

## 2026-10-02 - Phone updates itself without a PC (0.22.4)
- Added: When the PC is not connected, does not answer or has updates disabled, Android checks the latest GitHub release itself at startup, on return and at most hourly while open, downloads the APK and opens the installer. The unpaired connection screen does this too. A reachable PC remains the update source, and Settings → Updates offers a direct check without a PC.
- Security: The phone accepts the same manifest rules as the PC through a shared validator, downloads only this repository's release asset URL built natively from the validated version, follows HTTPS redirects only, and installs only after the size, SHA-256, package name, newer version code and signing certificate match. The PC path still sends its key on one direct connection without redirects.
- Files: src/release-update.ts, Updates.tsx, native-update.ts, App.tsx; server/updates.ts; AppUpdatePlugin.java, ReleaseSource.java; user guide and reference.
- Validation: Four new emulated-Android browser scenarios cover the unpaired screen downloading and opening the installer, a manifest mismatching its release asset never downloading, a reachable PC never contacting GitHub, and an unresponsive paired PC falling back to GitHub. The related update, connection and settings scenarios passed (12/12). A unit test pins the exact GitHub URLs and rejects tampered tags, missing manifests, checksum mismatches and prereleases; four JUnit tests cover the native release URL and HTTPS-only redirects. TypeScript/Vite and Android builds passed; server suite 233/234, the remaining Copilot streaming test is timing-sensitive in the full run and passed isolated reruns. The full browser suite also showed ten responsive, Jira, Codex-access, Copilot and desktop scenarios failing identically without this change; they follow the 0.22.x interface changes and are not addressed here.
- Follow-up: Physical Android installation from GitHub was not tested; Android still asks the user to confirm each installation and may require allowing installs from Pocket Code once.

## 2026-10-02 - Clean Windows build output (0.22.3)
- Fixed: scripts/build-desktop.ps1 copied the web build into artifacts/desktop/ui without removing earlier hashed assets, so every Setup installation and Windows package accumulated stale interface files (one package held 109 instead of 53 asset files). The folder is now emptied before copying.
- Fixed: scripts/package-desktop.ps1 left a full staging copy (6-21 MB) in artifacts after each package; it is now removed even when packaging fails.
- Files: scripts/build-desktop.ps1, package-desktop.ps1, test-desktop.ps1.
- Validation: test-desktop.ps1 now plants a stale asset before building and requires the interface folder to match the web build exactly. It failed before the fix (78 instead of 53 files) and passes after it, together with the desktop smoke test. A package built over a planted stale asset contains exactly the 53 current assets, and no staging folder remains.
- Fixed: A mis-encoded arrow in an older changelog entry.
- Follow-up: The published 0.21.3 and 0.22.2 packages were already cleaned manually before upload, so their contents do not change.

## 2026-10-02 - Faster host start, automatic cleanup of old builds and visible window after updates (0.22.2)
- Fixed: Every host start re-applied data folder permissions recursively. With many stored host versions this took about a minute or more, which delayed the QR connection and could exceed the update health check, causing a rollback and a second restart. Permissions are now re-applied only when the folder is not already private.
- Added: A background cleanup after host start removes old Windows application builds, superseded PC host versions, downloaded update archives and older cached APKs. Builds that are running, loaded, current, referenced by shortcuts or Windows startup, part of an unfinished update or created within the last hour are kept; a folder with open files is never partly deleted.
- Changed: The Windows updater waits up to five minutes for the new host. After an update the window reopens if it was open instead of staying in the tray.
- Fixed: The pairing parser test now expects QR version 2, accepted since 0.22.0, and rejects an unknown version.
- Files: scripts/bootstrap.ps1, start.ps1, desktop-update.ps1; desktop/DesktopWindow.cs; docs/DESKTOP.md; tests/storage-maintenance.test.ts, DesktopSmoke.cs, pairing.test.ts.
- Validation: New tests cover one-time permission repair and cleanup of synthetic host, desktop, update-archive and APK folders, including kept current, pending, recent, open and newest items and no desktop cleanup during an update. Checking an already private folder took 1 ms. Desktop smoke covers reopening after an update and staying in the tray otherwise. TypeScript/Vite build and all 233 server tests passed.
- Follow-up: The first host start after updating removes existing old builds in the background; large dependency folders can take several minutes to delete.

## 2026-10-02 - Shared app icon and theme-aware window controls (0.22.1)
- Changed: Added a pocket-and-code vector identity, Windows executable/tray icon at seven sizes, Android adaptive/legacy launcher assets and browser favicon. Assets are reproducible through scripts/build-icons.mjs.
- Changed: Native Windows caption, border and background follow the selected palette and light/dark/system theme. Standard window controls remain native; unsupported DWM attributes retain OS defaults.
- Fixed: Fixed green colors inside command summaries and output ignored theme settings. Activity text now uses theme colors, including live commands and error summaries.
- Changed: Appearance sliders share a flat track and compact thumb, with 44px interaction height and keyboard focus.
- Changed: Existing and running chats no longer show project/provider selectors in their header. Selection remains available in the chat library and before starting a new chat.
- Files: public/pocket-code.svg, launcher assets, desktop/DesktopWindow.cs, src/window-theme.ts, appearance.css, messages.css and build scripts.
- Validation: Browser theme/slider test, command contrast test and 19 chat/activity scenarios passed; native desktop rendering/tray/process smoke passed. TypeScript/Vite and Android build passed. Inspected icon, both theme screenshots and native window capture. Physical Android launcher rendering was not tested.

## 2026-10-02 - Individual device access and plain chat activity (0.22.0)
- Changed: Windows Connection lists paired devices with online/offline/disconnected state, version, last contact, renaming and confirmed individual disconnection. Device credentials are hashed on the PC; revocation persists, closes active responses and rotates the QR without interrupting other devices or AI work.
- Security: QR v2 exchanges a pairing secret for an individual credential. The administrative key is restricted to direct loopback requests and is no longer placed in QR codes; device management is PC-only. Online presence expires after 45 seconds without authenticated requests.
- Migration: Update PC and Android and scan the new QR once. Old shared-key connections are rejected; if Windows updated first, install the current APK manually over the existing app before scanning. History/preferences remain intact.
- Changed: Tool actions and subagent links have no background or border in light/dark themes, including live rows and user-role tool results; ordinary user messages retain their existing presentation.
- Files: server/devices.ts, app.ts, index.ts, pairing.ts; desktop bridge and DesktopDevices; mobile pairing/api lifecycle; shared message styles and desktop guide.
- Validation: Six device/runtime server tests, 19 desktop/pairing/subagent browser scenarios, plain activity light/dark check, TypeScript and native WebView/tray/process smoke passed. Android and Windows builds passed; physical multi-device testing was not available.


## 2026-10-02 - Desktop host polling survives locked settings (0.21.3)
- Fixed: Right after an automatic update, the Windows application could fail to replace desktop.json while another process briefly held it. The error stopped window startup before host polling began, so the application never detected its own running host, showed no pairing QR and remained on "Starting the host" after a manual connect. A misleading WebView2 installation message was shown instead.
- Changed: Settings writes retry briefly; a failed startup write no longer blocks polling or shows the WebView2 message.
- Fixed: The runtime API test now expects the desktopCheckRequestedAt field returned since 0.21.1.
- Files: desktop/DesktopWindow.cs; tests/DesktopSmoke.cs, runtime-api.test.ts.
- Validation: A new desktop smoke scenario holds desktop.json without delete sharing. Before the fix it stopped on the WebView2 message without polling; after the fix polling starts and the full desktop smoke test passes. TypeScript/Vite build passed. Full server suite: 228/229; the remaining Copilot streaming test is timing-sensitive in the full run and passed three isolated reruns with the update-worker tests.
- Follow-up: A window already stuck this way does not poll, so it cannot detect this update; exit it from the tray once and start Pocket Code again. The update to this version runs the corrected startup code.


## 2026-10-02 - Full-width new files and inline replacement blocks (0.21.2)
- Changed: New and wholly deleted text files use a single full-width code column in either diff mode, without an empty opposite pane or line-number gutter. Normal insertions in existing files retain split comparison.
- Fixed: Unified mode keeps each removed block followed by its added replacement, preserving surrounding context instead of alternating paired lines.
- Files: src/diff-rows.ts, DiffTable.tsx, review.css; diff parser and browser tests.
- Validation: Two parser tests and seven browser scenarios passed, including mixed new/modified files, mode switching, 10,000-line virtualization, fit-to-width and Unicode text. TypeScript passed.


## 2026-10-02 - PC-managed APK delivery, aligned diff modes and live desktop chats (0.21.1)
- Changed: PC checks public releases at startup and every six hours, verifies/caches the APK and supplies it to connected phones. Mobile settings request a PC check; Android still confirms installation. Public downloads no longer depend on GitHub CLI login. Phone requests also signal the Windows updater; APK transfers block host shutdown.
- Fixed: Diff gutter width rules affected spanning hunk rows and displaced code columns. Explicit shared column measurements now keep split panes aligned; visible Unified/Split buttons retain the selected layout.
- Fixed: Desktop selects the latest run for each chat, polls live output independently of slow history, follows partial text at the bottom and shows working/question/completed/error states. Newly assigned sessions appear before the history index refreshes; completed runs no longer freeze history at their original starting offset.
- Files: server/updates.ts, app.ts, index.ts; desktop/DesktopWindow.cs; src/Updates.tsx, DiffTable.tsx, Review.tsx, DesktopApp.tsx and styles; update/desktop/review tests and guides.
- Validation: 15 update/host server tests, 12 desktop/update browser scenarios, four large/Unicode diff scenarios and both file-list/layout cases passed. TypeScript/Vite, Windows native WebView/tray/process smoke passed. Android APK build passed.
- Follow-up: Android installation on a physical phone was not tested. Older PC hosts need upgrading to support APK delivery; external provider applications do not expose all live run states through Pocket Code.


## 2026-10-02 - Provider sign-out and Windows automatic updates (0.21.0)
- Changed: Added confirmed sign-out for Claude, Codex and Copilot in shared Windows/Android provider settings; active work blocks authentication changes. Preserves chats/preferences and reports remaining environment/account credentials.
- Fixed: Copilot model-list failures no longer overwrite confirmed authentication. Login failure messages distinguish incomplete login from server verification failures.
- Changed: Windows checks public GitHub releases after connection and every six hours, downloads a verified desktop/host package, prepares dependencies, waits for an idle host, restarts and restores the previous version on failed health checks. Settings include automatic/manual update controls.
- Files: server/provider-connections.ts, copilot.ts, app.ts; shared provider/update UI; desktop/DesktopWindow.cs; desktop packaging/update scripts and release manifest.
- Validation: TypeScript/Vite and Windows builds, 13 focused server/security tests, eight desktop browser scenarios and native WebView/tray/process smoke passed. Isolated Windows update fixtures passed installation and failed-health rollback, without using real accounts or stopping the production host.
- Follow-up: Real browser consent and account logout were not performed against personal accounts. Builds before 0.21.0 require one manual Windows installation to gain the updater; temporary internet tunnels may require a new QR after restart.

## 2026-10-02 - Automatic Windows runtime bootstrap and simpler launchers
- Changed: Shared bootstrap detects compatible Node.js through the current/registry PATH and standard install locations. If missing, it downloads a private Node.js 24 LTS ZIP from nodejs.org, verifies SHA-256 and archive paths, and reuses it without administrator access, winget or shell restart.
- Fixed: Clean setup now installs npm dependencies with development tools before the desktop build. Missing/partial dependencies are repaired; healthy retries do not reinstall. Per-user/runtime and per-project locks prevent overlapping installation.
- Changed: Kept only Setup Pocket Code.cmd and Start Pocket Code.cmd in the root. Removed duplicate desktop-install, internet-console and stop batch files; advanced PowerShell scripts remain. Removed the pre-login gate so users can reach provider settings after setup.
- Files: scripts/bootstrap.ps1, setup.ps1, start.ps1, build-desktop.ps1; root launchers; setup documentation; tests/bootstrap.test.ts.
- Validation: Downloaded and verified the official private runtime and ran it. An isolated clean install added 387 dependencies, ran TypeScript successfully, and reused them on a second setup. Bootstrap tests covered stale PATH, unsupported versions, invalid metadata/hash and dev-tool installation; six existing launcher tests passed.
- Follow-up: Existing running hosts are not stopped. Node downloads require access to nodejs.org; package installation requires the configured npm registry.


## 2026-10-02 - Manual provider sign-in and separate connection states
- Changed: Added shared provider cards to desktop settings and mobile AI settings, with detected version, installation, local transport and authentication states. Desktop Connection now distinguishes host activity and actual tunnel availability.
- Changed: Added explicit Windows CLI login methods for Claude subscription/Console/SSO, Codex browser/device/API-key/access-token, and Copilot browser/device/token. Secret entry stays in a local hidden-input prompt and reaches the CLI through stdin. Advanced cloud/enterprise methods link to official configuration guides.
- Changed: Launcher uses the local build when its version matches the managed host, while preserving newer auto-updated hosts.
- Reliability: Pending sign-in is deduplicated, blocks new work, refuses busy provider/queue changes, expires after ten minutes and is cleaned up on host shutdown. Successful login refreshes idle transports before checking access; raw auth output is not exposed.
- Files: server/provider-connections.ts, app.ts, codex.ts, copilot.ts; src/ProviderConnections.tsx and shared settings; desktop bridge; docs/PROVIDER-SIGN-IN.md.
- Validation: TypeScript/Vite and Windows builds passed; 32 server tests and 12 browser scenarios passed; native WebView/tray/cleanup smoke and eight launcher/process tests passed. Installed Claude authentication check succeeded without exposing account data. Official documentation and installed CLI help checked.
- Follow-up: Browser consent and real key/token submission require the user and were not performed. Advanced cloud/enterprise configurations are guides, not setup wizards. The Windows installation is updated; an existing host must be restarted after its work completes. Android source is updated; no APK release is included in this change.


## 2026-10-02 - Shared desktop workspace and read-only conversations
- Changed: Replaced the native form layout with the shared TypeScript/React interface in WebView2. Added provider/project selection, searchable conversations, refreshing history, Review, AI results, image zoom and subagent context. Reused Android renderers, panels, language, appearance controls and session types.
- Changed: Kept QR/Jira pairing, tray lifecycle and startup settings in the desktop shell. The native reader allows only approved GET routes; the TypeScript adapter rejects mutations. Desktop chat editing and agent approvals remain on the phone.
- Changed: Added versioned desktop installation so an active older host is not interrupted. Installer validates its pinned WebView2 SDK and can install Microsoft's signed runtime. Excluded build/tool directories from the development watcher.
- Files: src/DesktopApp.tsx, desktop-bridge.ts, desktop.css, session.ts, shared entry/API; desktop/DesktopWindow.cs; desktop build/start scripts, tests and desktop guide.
- Validation: TypeScript/Vite and native builds passed; 12 distinct browser scenarios passed, with six desktop scenarios repeated after final changes. Checked 900/1440/1920px layouts, shared Review/results/image zoom, read-only request rejection and mobile connection regression. Native smoke passed WebView loading, tray behavior, read-only route policy, nested process cleanup and saved reconnection.
- Follow-up: Active production work was left running; exit the old tray application after work completes and reopen the updated shortcut. Desktop appearance is saved per device, not synchronized with Android.

## 2026-10-02 - Native Windows tray application
- Changed: Added a native Windows window with embedded pairing QR, Jira setup, connection controls, optional per-user Windows startup and saved reconnect preferences. Close/minimize hides to the tray; explicit Exit terminates the owned process tree. Explicit Disconnect persists across launches.
- Changed: Setup installs Desktop/Start menu shortcuts; the standard start command opens the desktop application. The legacy internet console launcher remains available. Desktop mode suppresses the separate QR browser and console key output.
- Files: desktop/PocketCode.cs and manifest; desktop build/start/test scripts; OwnedHost.cs, start.ps1, setup.ps1; launchers and bilingual desktop/lifecycle documentation.
- Validation: Native build and Windows smoke checks passed: window/tray lifecycle, synthetic QR parsing, hidden and nested process cleanup, persisted disconnect and reconnect on next launch. Eight existing launcher/process ownership tests passed. Documentation links checked.
- Follow-up: Windows sign-in startup was not tested by logging out. Temporary tunnel URLs can change and require a new phone QR scan. Desktop executable updates require rerunning its installer; server updates remain separate. No Android code changed.

## 2026-10-01 - QR-only connection screen (0.20.6)
- Changed: Removed manual address/key fields and their divider from app entry. Camera scanning and QR image import connect immediately; a saved or scanned connection can be retried without displaying credentials.
- Changed: Updated connection-error recovery text and illustrated pairing guides. Migrated browser test setup to synthetic QR image decoding.
- Files: src/Connect.tsx, pairing.css, connection-errors.ts, translations.ts; QR browser helper and connection scenarios; user guides and connection screenshot.
- Validation: 22 distinct connection/workspace/settings/host-update browser scenarios and six pairing unit tests passed, with the connection scenarios repeated after final text changes. Narrow English/Russian layouts and synthetic screenshot checked. TypeScript/Vite and Android build passed.
- Follow-up: Native camera behavior was not tested on a physical Android device. Production host was not restarted.


## 2026-10-01 - Expand bilingual product documentation
- Changed: Added documentation indexes plus English/Russian guides for providers and accounts, everyday workflows, and troubleshooting. Covered project discovery, concurrent chats, attachments, subagents, diff scaling, Jira workflows, notifications, persistence and update boundaries.
- Changed: Replaced the obsolete feature matrix with current three-provider coverage; corrected shared Jira account selection, removed terminal navigation claims and linked the guides from both home pages.
- Files: README.md, FEATURES.md, docs indexes, user guides, reference and six topic guides. Existing synthetic screenshots reused; no user content added.
- Validation: Checked current implementation and targeted reader findings; all 152 local links/images/anchors across 14 documentation pages resolve. Documentation-only change; no application build or runtime tests required.


## 2026-10-01 - Discover local Git projects and choose folders on the phone (0.20.5)
- Changed: Project lists incrementally discover local Git repositories and worktrees without existing AI chats. Requests share bounded scan batches, cache results, and refresh completed scans after five minutes.
- Changed: Windows launch no longer prompts for a folder or Enter. Default access includes the launch project and ready fixed drives; explicit ProjectPath arguments retain restricted roots. Folder selection stays in the phone app.
- Files: server/git-projects.ts, app.ts; scripts/start.ps1; project discovery tests and user guides.
- Validation: Eight discovery and API performance tests passed, covering nested repositories, worktrees, concurrent reads, cache refresh and junction exclusion. TypeScript/Vite and Android build passed. Launcher PowerShell syntax and the noninteractive default-root block were verified without starting a host.
- Follow-up: Discovery skips system, dependency/build cache directories and directory links. Existing running hosts retain their roots until relaunched; no production process was restarted.


## 2026-10-01 - Fit review diffs to phone width (0.20.4)
- Changed: Review supports independent 4, 6 and 8 px code sizes and a persistent Fit diff to width option. Each file fits its complete unified or split columns without wrapping or shrinking controls.
- Changed: Virtual rows account for the rendered zoom, retaining access to the final line in large patches.
- Files: src/Review.tsx, ReviewFileDiff.tsx, DiffTable.tsx, review.css, translations.ts; review performance scenarios.
- Validation: 14 Review browser scenarios passed; two large-patch scenarios passed again after measurement caching. TypeScript/Vite and Android build passed. Synthetic split-view screenshot inspected.
- Follow-up: Physical Android zoom behavior remains untested. Very long lines become deliberately small in fit mode; disable it for normal reading.


## 2026-10-01 - Continue large Codex chats and index their images (0.20.3)
- Changed: Chat history and Results use byte-bounded message pages instead of loading the entire Codex transcript under a 16 MB limit. Results offsets retain every displayable message across page boundaries; latest windows keep the newest messages.
- Changed: Starting a normal or Jira turn counts displayable items without decoding image files or applying the whole-history display limit. Existing project and writer ownership checks remain.
- Changed: Codex edge scrolling follows returned offsets and merges pages, so a byte-limited page does not prevent reaching earlier or later messages. Android versionCode is 44.
- Files: server/codex.ts, codex-content.ts, app.ts; src/App.tsx; Codex, provider and chat recovery tests; application version metadata.
- Validation: 211 server/state tests and 17 history/Results browser scenarios passed. A synthetic history over 16 MB reproduced the old failure, returned all 20 images through the HTTP API, and resumed the same thread successfully. TypeScript/Vite and Android builds passed; unpacked APK/host credential and configured-denylist checks found no matches.
- Follow-up: Legacy Codex history still depends on its unpaginated RPC response; single messages over 16 MB and full subagent history retain display limits. Physical Android behavior has not been tested.

## 2026-10-01 - Task batches use an ordinary chat (0.20.2)
- Changed: Selected Jira tasks now open a single normal chat with full issue descriptions and a role-aware sequential execution prompt. Large descriptions use an attachment; preparation failures retain selection and do not start partial work.
- Changed: Removed the queue panel, queue polling and queue controls from Tasks. Individual workflow actions remain available; starting a batch chat does not automatically change Jira status or publish PRs.
- Files: src/Jira.tsx, task-chat.ts, translations.ts; Jira workflow scenarios and user guides.
- Validation: 37 Jira workflow, subagent and workspace UI scenarios passed, including full descriptions, large-batch attachments and preparation failures. TypeScript/Vite and Android build passed.
- Follow-up: Legacy queue endpoints remain for older clients. A batch attachment is subject to the normal 10 MB file limit.

## 2026-10-01 - Quieter subagent activity (0.20.2)
- Changed: Subagent links and the activity entry use compact, muted, rounded touch targets. The fallback disclosure no longer uses the boxed tool-card surface; statuses and access to details remain.
- Files: src/subagents.css, RichBlocks.tsx.
- Validation: Eight subagent interaction/layout scenarios passed, including mobile widths and enlarged interface scale. The chat screenshot was visually inspected after a focused interaction rerun.

## 2026-10-01 - Remove leftover Claude terminal navigation (0.20.2)
- Changed: Removed the Claude-only Live terminal button from the chat list and Terminal tab from mobile navigation. Claude now uses the same normal chat navigation as the other providers.
- Why: The legacy terminal shortcut remained visible after navigation simplification.
- Files: src/App.tsx and application version metadata.
- Validation: TypeScript, eight workspace regression scenarios and Android build passed.

## 2026-10-01 - Public repository privacy skill and publication guards
- Changed: Added a repository privacy skill referenced by AGENTS.md and CLAUDE.md. Public examples must be synthetic; source, screenshots, archives and release notes require review without copying private values to logs or external tools.
- Changed: Local commit/push hooks scan Git blobs and outgoing commit trees, including commit metadata. The scanner blocks common credentials, private file names and exact local denylist values, fails closed and refuses unrelated parent repositories. CI checks the public tree; the release script requires a clean checkout and a passing source scan. Hook scripts retain LF line endings across Windows/Linux checkouts.
- Files: .agents/skills/protect-public-data, AGENTS.md, CLAUDE.md, .githooks, .github/workflows/privacy.yml, scripts/privacy-guard.mjs, scripts/publish-release.ps1 and privacy tests.
- Validation: Skill validator and four privacy tests passed, including staged-versus-working content, historical commits and malformed denylist rejection.
- Limits: Hooks are locally installed and bypassable; CI is after upload. Pattern scanning does not identify arbitrary business data or read image pixels/unpack archives. Final visual and artifact audits remain required.

## 2026-10-01 - Complete chat results and durable reading positions (0.20.1)
- Changed: Results scans every available history page gradually, independently of the chat's 5,000-message viewport. All results and source attachments are initially visible; categories, progressive rendering, scan progress and retry remain available. File contents still load on demand.
- Changed: Chat positions are stored per host, provider and session, with message anchors and history-window restoration across navigation and reload. Jump controls depend on distance from the latest message instead of scroll direction. The history edge states whether older messages exist, are loading, or the beginning has been reached.
- Files: src/useChatOutputIndex.ts, chat-position.ts, chat-outputs.ts, ChatOutputs.tsx, App.tsx; chat recovery/output tests and user guides.
- Validation: 24 Playwright output, recovery and workspace scenarios passed, including complete paginated indexing, scroll anchors, navigation and reload; 10 output parser unit tests passed. TypeScript/Vite and Android APK build passed.
- Follow-up: Only files represented in provider history can be discovered. Deleted/inaccessible files cannot be previewed. Closing Results cancels further indexing; reopening rescans. Physical Android testing remains unavailable.

## 2026-10-01 - GitHub Copilot workspace and automatic sign-in detection (0.20.0)
- Changed: Added GitHub Copilot using the official SDK, with separate project/chat preferences, history, streaming replies, attachments, follow-ups, stop, permission questions and Jira execution queues. Shared Jira authorization remains separate from the selected task AI.
- Authentication: Existing PC credentials are discovered by the SDK, including GitHub CLI. An explicit settings action launches the bundled official CLI browser login on the PC; it times out after five minutes and is terminated with the host. Pocket Code does not copy GitHub tokens to Android.
- Files: server/copilot.ts, copilot-login.ts, app.ts, index.ts; provider-aware UI/types, CopilotConnection.tsx and workspace tests.
- Validation: TypeScript, seven Copilot unit/API tests and the mobile Copilot scenario passed; eight existing workspace scenarios and 27 provider/activity/workflow tests passed. A live SDK check detected GitHub CLI authentication, and a tool-free prompt completed with an assistant response.
- Follow-up: Copilot quota details, subagent transcripts and version-triggered maintenance are not yet integrated. First-time OAuth interaction was not exercised because this PC was already authenticated; Android device behavior remains unverified.

## 2026-10-01 - Collapsible review and chat attention alerts (0.19.8)
- Changed: Review displays one scrollable list of changed files, each with a collapsible diff. Options derive visibility checkboxes from actual file extensions. Nearby patches load with three concurrent requests; virtualized rows account for preceding files changing height.
- Changed: Subagent panels use rounded edges, compact borderless rows and lighter task disclosures.
- Changed: Android has a separate notification channel for the watched chat completing, failing, stopping or requesting an answer. Event fingerprints prevent repeat alerts; old completed history stays quiet. Tapping an alert opens its chat.
- Files: src/Review.tsx, ReviewFileDiff.tsx, DiffTable.tsx, review.css, subagents.css; Android ChatWatchService, ChatAlertState and ChatNotificationsPlugin; user guides and focused tests.
- Validation: TypeScript and all 23 Review/subagent browser scenarios passed, including long diffs, network recovery, stale responses and small screens. All five Android notification state unit tests passed.
- Follow-up: Android notification presentation, sound and background delivery still require a physical-device check. Alerts cover the last open watched chat and obey Android permissions/channel settings.

## 2026-10-01 - Codex history across projects (0.19.7)
- Fixed: Production hosts now list and read Codex chats from other project folders. Previously directory authorization silently removed these chats from the list.
- Boundaries: Out-of-scope or missing project folders mark chats read-only. Resume, commands, project files and local image reads retain the configured folder checks; child history still checks parent membership.
- Files: server/codex.ts, server/index.ts, tests/codex.test.ts.
- Validation: TypeScript passed; live metadata-only check returned 165 chats (162 read-only, three within the connected project). No conversation bodies were inspected by the live check. 30 Codex/subagent tests and TypeScript/Vite/Android build passed (versionCode 39).
- Follow-up: Archived chats remain excluded, as before. To continue a read-only chat, connect its project folder on the PC.


## 2026-10-01 - Jira transition time estimates (0.19.6)
- Changed: Transition forms support Jira timetracking fields with explicit-unit original estimates, such as 2h or 1d 30m. Required estimates block submission until valid; estimates travel with the transition and never create a worklog.
- Validation: Server rejects empty, zero, malformed or extra time-tracking properties before side effects. TypeScript and 12 time/workflow tests passed; the required-estimate browser scenario and Android build passed (versionCode 38).
- Files: src/jira-time.ts, JiraWorkflow.tsx, translations.ts; server/jira-workflow-actions.ts and focused tests.
- Follow-up: This supports fields exposed by Jira transition metadata. Hidden workflow validators or required worklogs are not inferred; they may still require completion in Jira.


## 2026-10-01 - Simpler mobile connection screen (0.19.5)
- Changed: Removed the first-time setup disclosure, storage explanation and descriptive footer below the connection form. QR scanning and image import remain the primary connection actions.
- Why: The extra introductory details cluttered the mobile entry screen.
- Files: src/Connect.tsx.
- Validation: TypeScript/Vite/Android build passed (versionCode 37). Source/APK/host privacy checks passed.


## 2026-10-01 - Shared PC Jira connection and compact stop control (0.19.4)
- Changed: The PC QR page links to a common Jira setup screen. Select the existing Claude connector or sign in to direct MCP through Codex; the saved Jira connection serves both task AI providers.
- Fixed: Codex reports configured-but-not-signed-in Jira explicitly instead of suggesting an unrelated runtime update. A live read-only discovery confirmed this condition; no Jira content or credentials were exported.
- Lifecycle: OAuth starts only on a button press, has a five-minute timeout and is terminated with the host. Setup uses a separate, ephemeral, local-only key. Connection changes are rejected while tasks or other mutations are active.
- UI: Stop now has the same 28-36 px visible face as Send, with a 48 px touch target retained.
- Files: server/jira-connection.ts, jira-login.ts, jira-codex.ts, jira-existing.ts, app.ts, index.ts, pairing.ts; src/Jira.tsx, composer-controls.css and focused tests.
- Validation: 18 focused server tests and three browser scenarios passed. TypeScript/Vite/Android build passed (versionCode 36); setup screenshot inspected. Full 200-test runs each encountered one transient Windows EPERM rename failure in different suites; both affected suites passed separately. Source/APK/host privacy audits passed.
- Follow-up: Real Atlassian authorization requires user interaction and any required site-admin approval. Existing Claude access can be used independently of the selected task AI.


## 2026-10-01 - Compact chat allowance indicator (0.19.3)
- Changed: Added a small right-aligned ring and remaining percentage inside the composer. Tapping opens the existing usage details; returning to chat preserves its draft and selected conversation.
- Semantics: Uses the lowest reported remaining percentage across shared and explicitly matched model windows for the selected provider. Missing, expired, stale or failed data shows a neutral dash; unrelated model quotas are excluded.
- Changed: Reduced the visible send button to 28-36 px with a smaller arrow, retaining its 48 px touch target.
- Performance: Refreshes once per minute while visible and on return, pauses in hidden documents and prevents overlapping requests. Late replies cannot cross provider/connection changes.
- Files: src/UsageIndicator.tsx, usage-summary.ts, usage-indicator.css, composer-controls.css, App.tsx and focused quota/layout tests.
- Validation: Two summary unit tests, 64 responsive layouts and seven final usage UI scenarios passed. The compact send face retains a 48 px touch target. TypeScript/Vite/Android build passed (versionCode 35); screenshot inspected. Physical Android testing unavailable.

## 2026-10-01 - Image gallery and touch zoom (0.19.2)
- Changed: Results shows image thumbnails, with a shared full-screen image viewer for Results and chat images. Pinch/pan, zoom buttons, Fit to screen, Back and focus restoration keep the surrounding conversation/gallery intact.
- Performance: Only nearby thumbnails load, with at most two authenticated reads/decodes at a time. Off-screen previews release object URLs. External images still require an explicit load; the existing local endpoint transfers the original file before downsampling.
- Fixed: The Codex access help button stays beside its heading, clear of the activity drawer handle. Diff columns account for Unicode glyph widths and preserve space for short patches.
- Files: src/ImageViewer.tsx, OutputImage.tsx, image-thumbnails.ts, ChatOutputs.tsx, RichBlocks.tsx, related styles/tests and user guides.
- Validation: Full browser suite passed 230/230, including touch pinch/pan, bounded thumbnail reads, URL cleanup, focus restoration and narrow English/Russian layouts. TypeScript/Vite/Android build passed (versionCode 34). Synthetic gallery/viewer screenshots were inspected.
- Follow-up: Pinch and pan are tested through browser touch input; physical Android validation remains unavailable.

## 2026-10-01 - Chat and diff performance audit (0.19.2)
- Changed: Memoized chat lists/messages/Markdown, reused unchanged poll snapshots, rendered collapsed tool bodies on demand, and skipped unchanged cache writes. UI polls pause when hidden and resume without overlap; host execution remains independent.
- Changed: Virtualized fixed-height diff rows with stable split columns, preserved scroll/reading controls, and cleaned up observers/listeners. Large patches retain their data but only visible rows plus overscan are mounted.
- Server: Coalesced in-flight read requests without retaining completed session/history results. Codex history size accounting is linear. Git availability uses safe existence checks and reuses metadata; independent Git reads run concurrently.
- Measurements: Synthetic production Chrome at 390x844/4x CPU, 500 rich messages: eight-character input 14.12s to 0.29s. Matched 20,000-line diff open 22.74s to 0.52s; mounted rows 20,001 to 49, JS heap 70.21MB to 13.78MB. Single stress runs, not physical Android timings.
- Files: Chat snapshot/poll/render helpers, src/DiffTable.tsx and diff-rows.ts, server read/review paths, scripts/benchmark-ui.mjs, regression tests and docs/PERFORMANCE.md with synthetic results.
- Validation: 192 server/state tests and all 230 browser scenarios passed. TypeScript/Vite/Android build passed. Large unified/split diffs, small patches, Unicode widths, reading mode and size changes are covered.
- Follow-up: Initial mounting/returning to 500 rich messages still costs around 1.7-2.2s; Codex history still scans all pages and changed job snapshots carry accumulated messages. Physical Android battery/thermal/network tests remain unperformed.

## 2026-10-01 - Readable live review and illustrated user guides (0.19.1)
- Changed: Review options open in an overlaid sheet instead of reducing the diff viewport. Code follows chat size with a 14 px minimum by default and offers a saved 10-24 px override.
- Added: Visible comparison mode/file count and immediate refresh. Open review refreshes every five seconds while visible and on resume, preserving selection and scroll. Missing selected files recover through a fresh list; background failures retain content with an error.
- Documentation: English/Russian guides cover QR pairing, Git comparison scope, APK/host updates, chats, project documents, task integrations and disconnecting, using synthetic screenshots.
- Files: src/Review.tsx, src/review.css, tests/review-focus.spec.ts, tests/documentation-screenshots.spec.ts, README.md and docs/.
- Validation: Twelve Review/settings/capture scenarios passed across focused runs, plus the additional removed-file/network recovery scenario and two final screenshot captures. Five Git review server tests passed. TypeScript/Vite/Android build passed (versionCode 33). Screenshots inspected at phone dimensions; 320px English/Russian 60%/130% layouts covered.
- Follow-up: Physical Android testing unavailable. Review reflects Git state within the project folder, not a chat-only edit log or comparison to the published release.


## 2026-10-01 - Workspace-aware Jira and direct Codex tools (0.19.0)
- Changed: Jira settings, reads, workflow actions, sequential queues and task notification/read state follow the selected Claude or Codex workspace. No automatic cross-provider fallback is performed; legacy requests without a provider keep Claude behavior.
- Added: Codex app-server MCP adapter discovers one Jira tool catalog and calls exact tools in an ephemeral thread without starting a model turn. It rejects missing/ambiguous connectors and unrelated tools; uncertain writes are never retried automatically. Native authorization remains in Codex.
- Optimized: Existing Claude connector coalesces issue and transition reads for five seconds; mutations invalidate the cache. Claude CLI inference remains necessary for that connection path. Explicit direct OAuth mode remains supported.
- Files: server/jira-codex.ts, Jira adapters/routes/workflow, provider-scoped frontend requests and notification feed; documentation and routing tests.
- Validation: 182 server/state tests passed, then seven focused tests after transport cleanup. 26 Jira/notification UI tests passed; two connection tests passed including new provider switching coverage. TypeScript/Vite/Android build passed (versionCode 32).
- Follow-up: Live Codex discovery found an unauthenticated Jira connector; authenticated account-backed tool execution was not verified. Synthetic tests verify exact direct calls, no model turns, provider isolation and single-attempt mutations. Physical Android testing remains unavailable.

## 2026-10-01 - Public onboarding documentation and setup launcher
- Changed: Replaced the dense landing README with a user-oriented overview, screenshot gallery, quick start, privacy notes and troubleshooting. Added a Russian guide and retained advanced material in docs/REFERENCE.md with corrected update/drawer descriptions.
- Added: Setup Pocket Code.cmd checks Node.js 22+, offers winget installation when needed, opens the APK release page and starts the existing Wi-Fi/internet launcher. Native AI sign-in and Android installation confirmation remain manual.
- Privacy: Documentation screenshots are generated from synthetic browser fixtures; no live projects, credentials, conversations or task-provider data were used.
- Files: README.md, docs/, scripts/setup.ps1, Setup Pocket Code.cmd, tests/documentation-screenshots.spec.ts.
- Validation: Screenshot scenario passed and all three images visually inspected; 17 local documentation links resolved. PowerShell syntax and three mocked setup paths passed (existing Node, upgrade, winget unavailable). No real software installation was performed.

## 2026-10-01 - Consistent chat list sizing and saved history (0.18.1)
- Changed: Chat rows use Project/Settings category typography, spacing, icons and minimum heights at every interface scale.
- Added: Local bounded cache of the latest session list and last 100 messages in up to 20 recently viewed chats per provider. Saved content appears before host refresh; request failures retain it. Live message snapshots are saved without restoring execution or approval state.
- Privacy: Cache namespaces use a SHA-256 pairing-key fingerprint, never the raw key; providers remain separate. Disconnect and forget clears cached conversations. Tunnel address changes retain the same paired cache.
- Files: src/chat-cache.ts, App.tsx, interface-sizing.css; cache and chat recovery tests.
- Validation: Two cache tests and six browser recovery tests passed, including delayed refresh after reload. TypeScript/Vite/Android build passed (versionCode 31).
- Follow-up: Initial connection still requires the host health check; this is cached history after connection, not a fully offline mode. Physical Android testing was unavailable.

## 2026-10-01 - Provider-neutral task notification inbox (0.18.0)
- Added: Tasks header bell with unread count, unread filtering, explicit read-all, and navigation to the correct Jira site/issue. Opening the inbox alone does not acknowledge notifications; failed or cancelled navigation remains unread.
- Backend: Provider adapter interface with Jira as the first implementation. Foreground clients request cached inbox state; the host polls assigned-task changes at most once per minute, coalesces reads, resumes paginated scans and stores the latest 300 notifications/read states locally. Initial sync establishes a quiet baseline.
- Events: Status changes, general updates and comment-count increases when supplied by Jira. This is a Pocket Code change feed, not Jira's internal notification inbox or Android push notifications. Existing MCP authorization is reused; no Jira writes are introduced.
- Reliability: Atomic serialized persistence, stable event IDs, provider/site isolation, disconnect generation guards and cursor recovery. Draft navigation waits for issue retrieval and rejects stale replies after inbox closure/connection changes.
- Files: server/task-notifications.ts, Jira adapters and app routes; src/TaskNotifications.tsx, Jira.tsx and App.tsx; notification tests.
- Validation: 175 server/state tests passed, followed by six focused inbox/API tests including authenticated routes. 26 Jira/notification/attachment UI tests and six final notification UI scenarios passed; inspected English/Russian 320px layouts at 60%/130%. TypeScript/Vite/Android build passed.
- Follow-up: Live account-backed Jira delivery and physical Android installation were not exercised. Other task systems can implement the provider interface but are not connected yet; mentions and full comment bodies are not available in this feed.

## 2026-10-01 - Attachment previews and left-aligned Back navigation (0.18.0)
- Changed: Images attached to a draft display local thumbnails; other files show a compact name/type/size card. Each has a separate 48px removal target; the strip scrolls horizontally and stays bounded on narrow screens.
- Reliability: Preview object URLs are released when cards unmount; failed/unsupported image previews fall back to file cards. Draft attachments survive tab/workspace navigation and rejected sends; only upload IDs are sent to the host.
- Fixed: Back controls in Project, task details, Settings, results and subagent panels align with the left content edge rather than centering in a stretched track.
- Files: src/AttachmentTray.tsx, attachment-tray.css, App.tsx and interface-sizing.css; attachment, project and draft-navigation tests.
- Validation: 25 attachment/project/recovery/navigation scenarios plus 12 attachment/workspace/follow-up scenarios passed. Checked decoded image previews, removal cleanup, invalid images, saved drafts and Back icon alignment; inspected 320px screenshots. Android build passed.

## 2026-10-01 - Direct manipulation of the activity drawer (0.17.2)
- Changed: Larger, higher-contrast right-edge handle (8x72px with a 56x88px touch target). The drawer follows left opening drags and right closing drags before release, then settles in 120ms; tap, Back and keyboard access remain available.
- Reliability: Pointer movement updates composited transforms without rerendering the chat; suppresses post-drag clicks, handles cancelled gestures and respects reduced motion. The scroll container explicitly permits vertical panning so browsers do not cancel horizontal touch drags.
- Files: src/ActivityHandle.tsx, src/ActivityDrawer.tsx, src/App.tsx, src/styles.css, src/activity-drawer.css; tests/activity-drawer.spec.ts.
- Validation: All 16 activity UI tests passed, including real browser touch events, partial dragging, reversal, cancellation, focus, all main sections and 60%/130% scales. Inspected partial-drag and handle screenshots. TypeScript/Vite/Android build passed.
- Follow-up: Physical Android device testing was not available.

## 2026-10-01 - Interface-wide scale consistency audit (0.17.2)
- Changed: Shared bounded typography for Tasks cards/filters/actions, file rows, Review controls, result/subagent/activity panels, Settings labels and terminal controls. Message, Markdown and diff reading sizes remain independent.
- Why: Several controls used unbounded rem/calc values or fixed px sizes, producing tiny text or failing to respond consistently to interface scale.
- Files: src/interface-sizing.css, src/main.tsx; tests/jira-workflow.spec.ts and tests/project-docs.spec.ts.
- Validation: The 84-case responsive/Project/Settings matrix passed with one fixture-loading timeout passing on isolated retry; 35 final Jira/Project scenarios passed, including computed cross-section font equality at 60%, 100% and 130%, reload persistence and file rows. Inspected narrow layouts.

## 2026-10-01 - Consistent Project control sizing (0.17.1)
- Changed: Project overview cards, document lists, folder selector and labels share Settings typography and category control sizing, including readable minimum sizes at reduced interface scale.
- Why: Project used rem and unconstrained scale formulas while Settings used bounded font sizes, producing inconsistent proportions.
- Files: src/category-sizing.css, src/project-docs.css, src/settings.css; tests/project-docs.spec.ts.
- Validation: 20 Project/Settings UI scenarios passed, including matching computed card sizes at 60%, 100% and 130%, persistence after reload and narrow layouts. Inspected 320px/130% screenshot; TypeScript, Vite and Android build passed.
- Follow-up: Physical Android visual verification was not available. Document Markdown retains the independently configured reading font size.

## 2026-10-01 - Running-chat clarifications and compact task heading (0.17.0)
- Changed: Tasks shows the selected Jira role in the main heading; removed the Assigned to me row and placed refresh beside search.
- Added: A send button remains available beside Stop during an active Pocket Code run, including uploaded attachments. Codex uses turn/steer with the exact active turn; Claude queues follow-ups in the same streaming-input process, delivering the next prompt after each result. Pending/unprocessed Claude input is visible.
- Reliability: Follow-up IDs deduplicate concurrent/retried requests. Ambiguous delivery failures are not automatically replayed; pre-delivery validation failures can be retried. Finished/not-ready runs preserve the draft, attachments stay scoped to the job project, and abort/stream completion closes Claude input.
- Files: server/followups.ts, prompt-stream.ts, jobs.ts, codex.ts and app.ts; src/App.tsx, Jira.tsx, styles/translations; follow-up tests and SDK mocks.
- Validation: 170 server/state tests and 18 Jira/follow-up UI scenarios passed. Tested turn identity, deduplication, queue drain, authentication, attachment scope, rejected drafts and 320px controls; inspected task layout at 130%. TypeScript/Vite/Android build passed.
- Follow-up: Real account-backed Codex/Claude clarification turns and physical Android installation were not exercised; engine tests use mocked transports. Imported Desktop runs are still subject to existing ownership restrictions.
- References: https://learn.chatgpt.com/docs/app-server and https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode

## 2026-10-01 - Minimal activity edge handle (0.16.4)
- Changed: Replaced the framed activity button, icon and count with a translucent 4x44px rounded edge handle and an invisible 48x64px touch target. Status remains on the Chats tab.
- Added: Tap, keyboard and deliberate left-swipe opening. Vertical/cancelled gestures do not open the drawer; vertical touch scrolling is allowed. Reading mode still hides the handle.
- Files: src/ActivityHandle.tsx, src/App.tsx, src/styles.css, tests/activity-drawer.spec.ts and release versions.
- Validation: All 14 activity UI scenarios passed, including swipe direction, keyboard/focus, tap and narrow-screen layouts. Inspected the 390px screenshot; TypeScript/Vite/Android build passed. Physical touch-device verification remains pending.

## 2026-10-01 - Android background chat notifications (0.16.3)
- Added: A native data-sync foreground service tracks the last open chat independently of WebView timers. Notification taps reopen that provider/session; explicit Back or disconnect clears tracking. Permission is requested through Android.
- Changed: The activity endpoint exposes only a bounded action category for notification text (commands, file edits, search, tool use or response), never command arguments or output. Status versions remain stable.
- Reliability: Native requests are authenticated, bounded and reject redirects; stale selections are discarded. Terminal states stop polling and retain a result notification. Credentials remain in memory; idle/long-running tracking and Android timeout paths stop cleanly.
- Files: src/chat-notifications.ts and App; server/activity.ts and types; Android ChatNotificationsPlugin, ChatWatchService, MainActivity, manifest and notification icon.
- Validation: 13 activity/state tests passed; Android/TypeScript/Vite build passed. No attached Android device or emulator was available, so physical notification delivery, permission and background lifecycle remain unverified.
- Follow-up: Tracks retained Pocket Code runs. Android can limit background data-sync services; timeout leaves a reopen instruction. Reference: https://developer.android.com/develop/background-work/services/fgs/timeout

## 2026-10-01 - Remember chat navigation and show tab status (0.16.3)
- Changed: The Chats tab restores the open conversation and draft across main sections; only explicit Back switches to the list, which is also remembered per workspace.
- Added: A dot on the Chats navigation button reports unanswered input (yellow), errors (red), running work (pulsing blue) or unread completion (green), in that priority order. Accessible descriptions supplement color; reduced-motion disables pulsing.
- Files: src/App.tsx, src/styles.css, activity/navigation UI tests and release versions.
- Validation: All 14 activity/navigation scenarios passed, including selected conversation and draft retention, explicit Back, all status colors and narrow layouts. Geometry tests now wait for the drawer animation; the simulated-clock test disables animation.

## 2026-10-01 - Right-edge activity drawer and quieter composer (0.16.2)
- Changed: Activity opens from a right-edge handle across main sections. Removed the global activity header and All chats action; the panel slides from the right and respects reduced-motion preferences. Reading mode hides the handle.
- Changed: Removed the redundant provider connection/work caption below the composer; active work remains visible in the conversation and activity feed.
- Files: src/App.tsx, src/ActivityDrawer.tsx, src/activity-drawer.css, src/styles.css, tests/activity-drawer.spec.ts and release versions.
- Validation: All 13 activity/navigation UI scenarios passed, including global access, right alignment, focus restoration, drafts and 320px layouts at 60/130%. Inspected the 130% screenshot. TypeScript/Vite/Android build passed.
- Follow-up: Physical-phone installation remains unverified.

## 2026-10-01 - Global activity header and explicit inference choices (0.16.1)
- Changed: Chat activity opens from one shared application header in Tasks, Chats, Project and Settings, including the chat list. Reading mode hides this header; Back and focus restoration remain available.
- Changed: Model selection displays the advertised Codex default name or Sonnet for Claude; effort displays the actual advertised default level without a Default label. Unknown legacy metadata shows a dash. Claude requests explicitly select Sonnet when no other model is chosen; legacy Codex requests preserve host configuration.
- Files: src/App.tsx, src/EffortPicker.tsx, src/styles.css, activity/effort UI tests and release versions.
- Validation: 26 activity/navigation/workspace/effort UI scenarios passed in the combined run; the remaining outdated model display was fixed and all six effort scenarios passed on rerun. TypeScript/Vite/Android build passed.
- Follow-up: Physical-phone installation remains unverified. Claude currently exposes model family names, not exact model revision or effort metadata.

## 2026-10-01 - Cross-workspace chat activity drawer (0.16.0)
- Added: A left Activity drawer with questions/approvals and errors, running chats, and unread completed/stopped results from both AI workspaces. Entry badges appear in the chat list and mobile chat header; All chats returns to history. Navigation preserves drafts, modal focus and Android Back behavior.
- Changed: The authenticated lightweight activity endpoint reads retained Pocket Code jobs without invoking a model. It keeps the newest run per provider/session, retains active chats first in a 100-item window and reports stable status versions plus final message IDs without transcripts.
- Changed: Terminal entries are acknowledged only after successful visible viewing at the conversation bottom, or loading the exact final history message. Unanswered/running entries remain; failed loads and reading older messages do not clear results. Viewed versions are stored locally per host without credentials.
- Reliability: Polling pauses when hidden, coalesces in-flight requests, rejects stale host responses and retains offline data. Busy target workspaces never queue a surprise navigation. Old hosts show an update instruction.
- Files: server/activity, types and app; src/ActivityDrawer, useActivity, activity-state, App, translations and styles; activity/workspace/navigation tests and release versions.
- Validation: 165 server/state tests passed. All 20 activity/workspace/navigation UI scenarios passed, including a focused rerun after fixing a renamed test selector. TypeScript/Vite/Android build passed; 320px screenshots at 60/130% inspected. Initial UI failures identified a missing Retry translation and an outdated Review focus expectation; both corrected.
- Follow-up: Feed covers retained runs started through Pocket Code in the current host runtime, not inferred native Desktop activity. Physical-phone installation remains unverified.


## 2026-10-01 - Compact workspace selection (0.15.1)
- Changed: The chat list places the Codex/Claude selector and New chat in one compact row. Removed the redundant Workspace label, border, arrow decoration and separate-row spacing; Settings retains its descriptive label and all selectors retain accessible names.
- Why: Workspace choice should not consume a large form section above the chat list. Touch targets remain 48px despite small text/interface scales.
- Fixed: Restored the Review entry's 48px target on wide touch layouts; the responsive fixture now closes the redesigned Review by its accessible Back action.
- Files: src/App.tsx, src/styles.css, src/review.css, tests/responsive-layout.spec.ts and release versions.
- Validation: Eight workspace interaction scenarios passed. Ten EN/RU layout scenarios at 320/360/440/884px and 60/65/130% passed after correcting the Review target found on 884px. TypeScript/Vite/Android build passed; screenshots checked.
- Follow-up: Physical-phone installation remains unverified.


## 2026-10-01 - Focused review, chat surfaces and Codex effort (0.15.0)
- Changed: Review binds to the selected chat folder, displays repository and branch, and keeps comparison controls behind one options button. An eye toggle hides chrome while retaining diff position; Back/Escape restores controls before closing. Stale file responses cannot replace the current selection.
- Fixed: Literal Git paths prevent bracket-containing filenames from selecting the wrong diff. Nested repositories, scoped subfolders and linked worktrees return explicit repository/project metadata.
- Changed: User messages use quiet content-sized bubbles with accessible copy actions. Subagent activity uses compact clickable rows without redundant assistant headers; context and attachments remain available.
- Added: Codex reasoning effort beside the model, populated from native model/list and saved per model. Requests pin the displayed model/default effort, reject unsupported values before inference, and preserve older hosts without metadata.
- Files: Review/App, Messages/RichBlocks/Subagents styles, EffortPicker, server review/codex-models/codex/app, translations, focused tests and release versions.
- Validation: 153 server tests passed; 18 combined UI scenarios passed plus the existing subagent/typography checks (15 including the three surface cases). All six effort scenarios passed again after preserving legacy host model behavior. TypeScript/Vite/Android build passed. Native Codex 0.159.2 model/list was checked without inference; synthetic requests verified effort forwarding.
- Follow-up: Physical-phone installation and a paid real AI turn using effort have not been tested.


## 2026-10-01 - Direct project document navigation (0.14.1)
- Changed: Removed the project location footer and repeated Files/Rules/Changelog tabs from nested project screens. Folder selection appears only on the overview. A sole rules/changelog document opens directly; multiple documents retain a category-specific list. Truncated indexes never assume only one document exists.
- Changed: Markdown views keep filename, content, refresh and Back controls without duplicated category/path metadata. Back returns to the list or overview and restores focus; stale responses remain isolated and polling stops after leaving a document.
- Why: Categories should lead to their content instead of repeating the parent navigation and requiring unnecessary taps.
- Files: src/ProjectDocs.tsx, src/project-docs.css, tests/project-docs.spec.ts, README.md and package/Android versions.
- Validation: TypeScript and all 14 project UI scenarios passed, covering EN/RU, 320/360px widths, 60/100/130% scale, direct/multiple/truncated documents, Back, safe Markdown, retries and polling. TypeScript/Vite/Android build passed; APK signature matches 0.14.0.
- Follow-up: Physical-phone installation has not been tested.

## 2026-10-01 - 0.14.0
- Changed: Main Tasks, Project and Settings headers contain only the section title, without a redundant Back arrow or AI selector. Project selection is inside the Project screen; provider selection lives in Chats and AI/usage settings.
- Tasks replaces Jobs, with native Jira status-category, project, status and type filters. Filter changes clear selection; batch selection follows the active query.
- Project opens an overview of Files, Rules and Changelog. Saved text/interface scaling is consistent on task and document cards.
- Simplified headers and compact expandable command/file activity; removed the Normal/Plan selector from chats.
- Added persisted Codex/Claude runtime change detection and one-time compatibility tasks in a shared Pocket Code source project. Configure automatic checks under Settings → Updates. First observation establishes a baseline; publication and host restart remain separate.
- Validation: 148 server tests, 64 responsive scenarios and focused interaction/typography tests passed; Android build and current Codex protocol initialization passed. Physical-phone installation and real automatic AI maintenance execution remain unverified.

## 2026-10-01 - 0.13.1
- Added the Mint palette with English/Russian names and saved selection.
- Moved Disconnect and forget to the end of the scrolling settings index; it is absent from settings subpages.
- Includes the PC runtime shutdown fixes below. Console ownership is provided by the updated Windows launchers in the source repository.
- Validation: Android/TypeScript/Vite build and APK signature compatibility passed, along with nine focused server tests, chat/update browser checks, and all three settings-navigation scenarios.
- Updating: Use Android 0.13.0 to test the in-app update to 0.13.1. Older builds require one manual installation of 0.13.0 or newer. Android still confirms installation.

## 2026-10-01 - Windows process lifecycle fix (included in 0.13.1)
- Changed: Closing the launcher console ends the entire owned server/tunnel/update process tree, including a replacement host. Ordinary exit does not start another instance. Repeated Start recognizes an authenticated running host, and failed CMD launchers no longer wait indefinitely for a key press.
- Changed: Added Stop Pocket Code.cmd and authenticated runtime controls. Graceful Stop refuses active work or an update handoff, waits for persistence and tunnel cleanup, and prevents new work during exit.
- Files: Windows launchers, scripts/OwnedHost.cs, scripts/run-host.ps1, scripts/stop.ps1, server runtime/update handling and lifecycle tests.
- Validation: All 140 Node tests and TypeScript passed. Windows process tests verified detached-child/replacement cleanup and preservation of unrelated processes; six isolated launcher tests passed.
- Follow-up: No new APK or release assets. Use the updated Windows launchers for process-tree ownership; direct development server commands do not provide it.

## 2026-10-01 - 0.13.0
- Added coordinated updates: after Android upgrades, it requests the matching PC release. The PC verifies and prepares a separate installation, waits for active work, restarts and verifies the new process. Startup failure attempts rollback.
- Added persistent host installation selection, retained tunnel/pairing during automatic handoff, and Settings-only progress/retry/reconnection states.
- Fixed Invalid update source caused by native JSON integer handling; APK hash, identity and signing checks remain enforced.
- Validation: 127 Node tests, 155 browser scenarios, native Java numeric regression and TypeScript/Vite/Android build passed. Isolated real host tests covered dependency installation, busy deferral, handoff and rollback.
- Limits: Older affected Android builds need one manual APK installation. Host auto-update requires bridge 0.13.0+, Windows and GitHub/npm access. Android confirmation and physical-device verification remain necessary.

## 2026-10-01 - 0.12.0
- Added saved Codex access modes: Full access by default, Ask for approval and native Auto review. Plan and Reviewer/QA tasks stay read-only; managed-policy refusals remain visible.
- Added account usage limits for Codex and Claude, including hourly/weekly windows when available, remaining allowance and reset times. Missing data is never shown as zero usage.
- Reorganized Settings into Appearance & language, AI & workspace, Usage limits, Jira, Updates, PC connection and About. Disconnect and forget stays at the bottom; Codex access explanations open from a question-mark button.
- Simplified the chat list, made Review/Results controls contextual, and scaled provider labels, tool blocks and code with chat text. Shared project discovery is included in this APK.
- Validation: 116 Node tests passed. The full browser run passed 148 scenarios; its remaining test passed after correcting test-only Unicode corruption. TypeScript/Vite, Android build/signature compatibility and no-model provider probes passed. A focused health-version regression also passed.
- Limits: Physical-device and participant testing remain necessary. Claude limits use an experimental SDK API and depend on account support. Android still asks the user to confirm APK installation.

## 2026-09-30 - Shared project discovery across workspaces
- Changed: Project selectors share configured roots and allowed folders discovered from Claude and Codex histories, including nested projects. Each workspace retains its selected folder after reload.
- Why: Nested folders previously disappeared from the project picker when switching providers. Conversation histories and drafts remain separate.
- Files: server/app.ts (`/api/projects`), src/App.tsx, tests/providers.test.ts, tests/workspaces.spec.ts, README.md.
- Validation: TypeScript/Vite build, 102 Node tests and 16 Playwright workspace/navigation/project-document scenarios passed, including delayed discovery and provider failures.
- Follow-up: Source fix only; no new APK release or deployment.

## 2026-09-30 - 0.11.0
- Added Project with read-only Markdown rules, changelog discovery, live document refresh and Files navigation.
- Added categorized chat Results, separate source attachments, inline image thumbnails and authenticated local previews. Recent results appear first; saved content and current PC files are distinguished.
- Added scoped subagent activity/child context, automatic history edge loading, reading mode and recovery for Codex active-writer rejections without losing drafts.
- Added Jira search/categories, role-aware workflow actions, per-role chat links, durable recovery and confirmed PR publication. Full descriptions load independently of transition metadata.
- Fixed overlapping mobile headers/settings, compact touch targets, stale responses, paired tool disclosures and nested Back navigation.
- Validation: 101 Node tests and 128 browser scenarios passed, including a 64-profile responsive matrix; TypeScript/Vite and Android build passed. Read-only live checks confirmed description and child-history retrieval.
- Limits: Physical-device and participant testing remain necessary. Jira mutations/real task PR publication were not used as live tests. Android confirms installation; project rules remain read-only and result indexing is bounded to loaded history.

## 2026-09-30 - 0.10.0
- Added Claude/Codex workspaces with separate chats, drafts, models, projects and Jira execution queues. Local Codex uses the existing PC login and supports history, attachments, streaming, approvals and cancellation.
- Added an actual project selector, per-chat drafts, reliable reconnect prefilling, clear activity states, accessible dialogs and Android Back handling. Mobile tap areas stay at least 48 CSS px even with compact typography.
- Fixed task-record exhaustion, stale cached APK installation, Git filter execution during Review, Codex attachment scope, reconnect races and completed-turn history syncing.
- Restored five damaged dependency/engine metadata ranges without changing pinned packages; a clean npm ci dry run passed.
- Documented feature coverage, usability evidence and remaining limits in FEATURES.md and USABILITY.md.
- Validation: 43 Node tests, 26 browser scenarios, Android build/signature verification and a small live Codex smoke test passed. Sanitized source and APK passed targeted privacy scans.
- Limits: Physical-device and participant testing remain necessary. Codex budget/live terminal and desktop-specific interactive tools are not supported. Android confirms APK installation.


## 2026-09-30 - 0.9.1
- Fixed authenticated APK downloads from the hidden PC runtime cache.
- Added an HTTP regression test that checks authorization and exact downloaded bytes.

## 2026-09-30 - 0.9.0
- Added host-mediated GitHub APK updates with checksum, package and signer verification and Android installation confirmation.
- Added image previews, nested tool results, PDF opening and structured-block fallbacks.
- Added read-only Git Review with working-tree, staged and branch comparisons, split/unified layouts and return to chat.
- Expanded saved appearance settings to 8 px chat text and 60% interface scale; persisted model, mode, budget and project preferences.
- Included local chats, terminal, uploads, QR pairing, English/Russian UI and existing-connector Jira Jobs.
- Validation: automated server/UI tests and Android build; physical-device installer and PDF viewer verification remains necessary.