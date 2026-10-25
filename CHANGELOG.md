# Changelog

## 0.28.8 (unreleased)

### Features
- Board Chat resumes the conversation saved for that board after navigation or an app restart. More actions → New board chat explicitly replaces its generation; stale jobs cannot repin an older session. Private device storage is isolated by connection/account, project and board and never copied into Git boards. Pending jobs can resume; missing sessions remain pinned and block sending until an explicit replacement. Associations are installation-local, without cross-device synchronization.
- Shared provider guidance and the board skill require creation context, source references and open questions for new AI-created cards. Read full context and accessible sources before work; request clarification when needed without inventing history or exposing private conversations. The board MCP offers read_note_context for one complete card and bounded dependency summaries; no notifications are sent by this read.

### Breaking Changes
- Board MCP create_note requires context (summary, sources, optional questions); canvas_apply requires it when creating cards or sticky notes. Existing cards remain readable without invented retrospective provenance. Reload the updated MCP tool catalog.

### Validation
- Web build, five persistence/MCP/provider-guidance tests and eight browser scenarios passed. Coverage includes mobile/desktop navigation and reload, explicit replacement, unavailable sessions, late-job protection, storage errors, host/project/account isolation and compact header regression. Documentation links passed. Packaging and publication pending; physical devices not tested.

## [0.28.7](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.6...v0.28.7) (2026-10-25)

Published [v0.28.7](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.7) from [3cbbb0d493f82bae2bf205c3f387859734e8aa75](https://github.com/Evgenie-Myasnikov/pocket-code/commit/3cbbb0d493f82bae2bf205c3f387859734e8aa75) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Bug Fixes
- Board cards render 256 px thumbnails instead of full-resolution originals. A shared queue bounds original reads/decodes to two, deduplicates repeated references and caches up to 128 thumbnail blobs. One visibility observer serves all board images; leaving the viewport cancels pending work and releases each image URL. Full resolution is displayed only in the viewer. Initial thumbnail generation still downloads the source image; this is a rendering/memory improvement, not server-side thumbnail transfer.
- Opening a running chat follows its current answer even when an older history position was saved. Idle chats retain their message/text anchor. Live status is recognized from the current job or activity feed.

### Validation
- Web build, six position/preview API tests and three browser scenarios passed. A synthetic 2048×1536 image set verifies thumbnail dimensions, bounded reads, shared cache and full-size viewer loading; live opening and idle bookmark restoration passed. Web/Android/Windows/host builds passed; all 86 shared web files match. All 1,422 decoded package entries passed the privacy audit. APK signer compatibility, GitHub CI, exact source tag and hashes of all four downloaded assets passed. Packages published; no physical-device validation.

## [0.28.6](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.5...v0.28.6) (2026-10-25)

Published [v0.28.6](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.6) from [088a9b08f757fc59a93380c9858bb85252da1661](https://github.com/Evgenie-Myasnikov/pocket-code/commit/088a9b08f757fc59a93380c9858bb85252da1661) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Left-button dragging on empty canvas selects an area; Shift adds objects and reverse dragging works at any canvas zoom. Middle-button dragging pans from blank space or over objects without moving them. Touch pan/pinch remain supported; frame labels move frames while their empty interiors allow area selection.
- Selected groups move together. Ctrl/Cmd+A selects all, Ctrl/Cmd+C/V copy/paste within the open board, and Delete/Backspace removes the selection. Context menus preserve groups and provide copy, paste at the requested position and delete. Copies receive new IDs and retain internal visual links, ports, free ends, product card properties, image references and remapped dependencies; private assignments and chat associations are excluded. Capacity limits reject a paste atomically.

### Validation
- Web build, 17 model/geometry/persistence tests and 13 distinct browser scenarios passed, including group movement/copy/deletion, metadata, zoom, middle-button pan, Shift/Escape, Undo/Redo, connectors, pinch and the 400-card drag regression. Documentation links and synthetic selection screenshot checked. Android, Windows and host packages published; all 86 shared web files match. All 1,420 decoded package entries passed the privacy audit. APK signer compatibility, GitHub CI, exact source tag and hashes of all four downloaded assets passed. Physical devices not tested.

## [0.28.5](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.4...v0.28.5) (2026-10-25)

Published [v0.28.5](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.5) from [5de9ebe9c7e26cc81be574ce77021fb247eb369f](https://github.com/Evgenie-Myasnikov/pocket-code/commit/5de9ebe9c7e26cc81be574ce77021fb247eb369f) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Conversation controls use one row: Back, a flexible context chip and overflow. Review, outputs, subagents and the Git branch live in the overflow menu; menu height stays within the viewport. Transcript edge opacity follows a sampled quadratic curve, including the existing strength and reading-mode overrides.

### Bug Fixes
- Remove the duplicate command/timer status above the composer; tool details remain in the transcript and lost-contact warnings remain visible.
- Windows release and asset reads retry temporary network/HTTP 408, 429 and 5xx failures up to three times. Other HTTP failures stop immediately. Failed updates retain the target version, phase and sanitized failure/status codes without persisting exception text. The earlier reported failure cannot be attributed retrospectively because its details were not recorded; a later preparation of 0.28.4 reached the waiting-for-idle state.

### Validation
- Four Windows updater tests passed, covering unsafe archives, bounded retry, healthy handoff and failed-health rollback. Twelve browser checks passed for composer/inbox behavior, one-row headers at 320/390/1440 pixels and 60/130% scales, transcript geometry and reading-mode position. Web/Android/Windows/host builds passed; all 86 shared web files match. All 1,418 decoded package entries passed the privacy audit. APK signer compatibility, GitHub CI, exact source tag and hashes of all four downloaded assets passed. Packages published; no physical-device validation.

## [0.28.4](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.3...v0.28.4) (2026-10-25)

Published [v0.28.4](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.4) from [c04f358e1a1b5bc177d5fc4e16e8a62efa2b54f6](https://github.com/Evgenie-Myasnikov/pocket-code/commit/c04f358e1a1b5bc177d5fc4e16e8a62efa2b54f6) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Persist loaded chat pages and assembled history in a bounded 20 MB local cache, up to 5,000 messages per view. Revision sync transfers changed messages and preserves removals/order; unknown revisions and older hosts fall back to full pages. Access errors never fall back to cached responses. Reading positions retain a message ID, character and nearby text across reopening and wrapping changes.
- Activity inbox rows load the latest available chat image separately through authenticated preview endpoints. Inbox and Reading actions live in the chat overflow menu; the inbox removes its title, manual refresh, filters and legacy assignment section, retaining automatic updates, error retry and finished-result undo.

### Bug Fixes
- Canvas nodes and links memoize unchanged content and geometry; pointer previews update once per animation frame. A synthetic 400-card/399-link drag reduced metadata renders from 13,600 to 400 and total React render time from 701 ms to 98 ms in the measured run; this is not a physical-device FPS guarantee.
- Connection dragging requires a 180 ms hold and 5 screen pixels of movement. Selected line endpoints can detach, remain free, reconnect with the same ID, or cancel with Escape; Undo restores endpoints. Free endpoints require host 0.28.4+.
- Reading mode retains the measured header height while hidden, preventing scroll displacement on exit.

### Validation
- Web build, 22 targeted geometry/schema/MCP/history/authentication/privacy checks and 22 distinct browser scenarios passed, including 250-message offline reopening, text anchors, delta sync, image refresh, connector detachment and 60/100/130% header layouts. Documentation links and the portable board schema passed; synthetic screenshots inspected. Android, Windows and host packages published. All 86 shared web files match; 1,418 decoded package entries passed the privacy audit. APK signer compatibility, GitHub CI, exact source tag and hashes of all four downloaded assets passed. No physical-device validation.

## [0.28.3](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.2...v0.28.3) (2026-10-25)

Published [v0.28.3](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.3) from [15395d9ef269b7fb0b6fa971aecb90fb14f36beb](https://github.com/Evgenie-Myasnikov/pocket-code/commit/15395d9ef269b7fb0b6fa971aecb90fb14f36beb) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Bug Fixes
- Canvas connections start and finish at side midpoint ports. Mouse proximity reveals the point; drops on card bodies, corners or empty space do not attach. Keyboard connections also require a destination port; selected touch objects expose their ports.
- Saved links and drag previews share orthogonal routing with sharp elbows and outward side leads. Routes update with object geometry; legacy links infer midpoint ports without rewriting their data. Escape and pointer cancellation discard pending connections.

### Validation
- Web build, 17 targeted geometry/persistence/privacy/MCP tests and eight browser checks passed. Coverage includes all side pairs, narrow gaps, invalid drops, keyboard activation, Escape, persisted anchors, editing, undo/redo and 390/1440-pixel layouts. Synthetic screenshots inspected. Android, Windows and host packages published. All 86 web files match across packages; 1,408 decoded artifact entries passed the privacy audit. APK signer compatibility, GitHub CI and hashes of all four downloaded assets passed. No physical-device validation.

## [0.28.2](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.1...v0.28.2) (2026-10-24)

Published [v0.28.2](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.2) from [b7fb58c46c11d7fd4f0798b456c364ef96c70ffd](https://github.com/Evgenie-Myasnikov/pocket-code/commit/b7fb58c46c11d7fd4f0798b456c364ef96c70ffd) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Bug Fixes
- Canvas creation menus open on right-click or the keyboard context-menu key; left-click selects or clears selection. Links retain source/destination sides, preview from the chosen port and highlight the destination. Resize hit areas remain 20/28 screen pixels at every canvas zoom.
- Removed duplicate Rules/Changelog tabs inside the document library; file browsing remains a compact action. Existing unanchored links still load; anchored links require the updated host schema.

### Documentation
- Repository board cards are grouped in version frames with 11 reviewed historical synthetic UI screenshots. Local scratch canvas objects are excluded from the public snapshot.

### Validation
- Web build, 14 targeted canvas/persistence/privacy/MCP tests, six browser checks and the desktop document navigation check passed. The reported loading failure was not reproduced in those checks and remains open pending the failing screen/error. Android, Windows and host packages published. The audit of 1,406 decoded package entries, APK signer compatibility, GitHub privacy CI and downloaded asset hashes passed. Physical-device validation was not performed.

## [0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.0...v0.28.1) (2026-10-24)

Published [v0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.1) from [b8e800f51c283eea196e721fec080801d79fa5cd](https://github.com/Evgenie-Myasnikov/pocket-code/commit/b8e800f51c283eea196e721fec080801d79fa5cd) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Boards use a single canvas; legacy tasks retain IDs, metadata, attachments and agent actions. Blank-canvas click/context menus create objects. Inline text editing replaces the object modal; edges/corners resize and four side ports create links. Persistent tools are undo, redo and fit; chat is an icon. Pinch and Ctrl+wheel zoom remain available.
- Existing visual links and orphan canvas cards survive migration. Invalid legacy references block writes instead of silently dropping data. Workspace boards now persist canvas geometry too; MCP card edits update their canonical task records.

### Bug Fixes
- UI scale now reaches fixed-size compact typography and controls, including provider menus and dialogs; canvas geometry retains its independent zoom. Native Windows page zoom is disabled and modified wheel input no longer changes page scale; Shift scrolling remains unchanged.
- Chat headers use the shared provider menu, rendered above the floating header so it is not clipped. Task undo restores metadata as well as geometry. Public snapshot checks include card descriptions, and chat context bounds their length.

### Validation
- TypeScript/web build and 13 targeted persistence, migration, revision, workspace, privacy and MCP checks passed. Seven browser checks passed for inline editing, corner resizing, port connections, undo, legacy card reopening, provider menu, pinch and 60/100/130% scale. Four design-token checks and documentation checks passed. Windows shell compiled successfully. Android, host and Windows packages published; 1,406 decoded artifact entries passed privacy checks. APK signer matches 0.28.0. All four downloaded release assets match the reviewed local files and manifest hashes; GitHub privacy CI passed. Not checked on physical devices. Legacy Tasks-view browser cases still need conversion to the new UI.

## [0.28.0](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.27.1...v0.28.0) (2026-10-24)

Published [v0.28.0](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.0) from [188bf9081df9caa2716d8451779563976624c116](https://github.com/Evgenie-Myasnikov/pocket-code/commit/188bf9081df9caa2716d8451779563976624c116) on [feature/whiteboard-0.28.0](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/whiteboard-0.28.0). This publication record corrects the earlier unreleased label; it does not include subsequent 0.28.1 work.

### Features
- Boards: optional free canvas with sticky notes, text, frames, resize, group movement, arrows and view-local undo/redo. Existing task cards and dependency metadata remain intact. Desktop board discussions keep the board beside the chat; a bounded context snapshot is attached on the first send.
- Board MCP: scoped project aliases, reading, search and revision-checked card/canvas updates through the local host. The shared board skill documents the workflow. No cursor animation, realtime collaboration, deletion or publication tools are included.
- Providers: compact keyboard-accessible picker; encrypted local profiles for OpenAI-compatible text API chat, with model catalogs fetched from the provider. Custom API chat does not run project file tools.
- Appearance: ten paired light/dark palettes based on Radix Colors, consistent role mapping and verified text/button contrast. The composer keyboard hint is removed; board mode controls and desktop spacing are more compact.

### Bug Fixes
- Packaging: omit repository product boards from installed host bundles so an installation does not reappear as a duplicate project board. Board MCP is included in both host and Windows packages.

### Documentation
- Added board MCP usage, scope and limitations, shared board skill, palette sources and upstream license. Extracted `.stitch/DESIGN.md` from actual React/CSS using the Google skill. Updated the product roadmap with implementation and the remaining AI cursor stage.

### Breaking Changes
- Old hosts must be updated before opening files containing the optional canvas field. Existing task-only board files remain compatible.

### Validation
- TypeScript and web build passed. Targeted MCP stdio, board persistence/revision, provider catalog/error privacy, packaging and palette contrast checks passed. Live read-only MCP access was verified. Full unit run: 381/382 passed; the task-run concurrency timing case failed under load and passed when rerun alone. Browser regression: 41/41 passed; five focused grid/board checks and the context-attachment send check passed after compact-header changes. Documentation links passed. At source review time release artifact validation was pending. Publication followed as recorded above; physical-device validation remains unperformed.

## [0.27.1](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.27.0...v0.27.1) (2026-10-19)

Branch: codex/chat-grid-0.27.1 (from the published 0.27.0 source). Not released.

### Features
- chats: a List / Grid switch under the chat search shows chats as tiles with the chat's latest image, the start of the latest AI reply (plain text, clamped), the title, project and relative time or run state. The grid groups **By date** (Today, Yesterday, This week, Earlier) or **By project** (one section per project folder); both choices are remembered per device. Phone: two columns at 390 px, one at 320 px; the Windows window shows an auto-fill grid in the main area when no chat is open. Tiles show skeleton lines while previews load, text only without an image, and "No AI reply yet" when there is no reply. Tapping or pressing Enter on a tile opens the chat like a list row.
- host: `GET /api/sessions/previews?provider=&ids=` returns, for up to 48 listed chats, the latest assistant text (markdown stripped, about 400 characters) and only the name of the latest local or inline image; `GET /api/sessions/:id/preview-image` serves that image through the same session, permitted-folder and upload checks as message attachments. Remote image URLs are never chosen. Previews are computed only for tiles near the viewport, cached per provider, chat and last-modified time (500 entries), with at most three transcript reads at once; the chat list request is unchanged.
- boards: the floating zoom plaque (− / % / + / Fit board) is removed on phone and desktop; pinch and Ctrl+wheel zoom remain.
- chat header: the top edge is transparent again with the existing transcript edge fade; back, the title chip, inbox, Review, Results, Read and the menu are separate round floating buttons with their own blurred token surface and 48 px targets. Without backdrop blur, with reduced transparency or in forced colours they use a solid surface.

### Validation
- TypeScript check passed. Unit tests 374/374 on the first full run, including the new session-previews tests (text stripping, image choice, cache and concurrency, endpoint access checks with synthetic transcripts). A later run had 4 failures in task-runs/task-runs-api verification tests (spawned check commands timing out); those files are untouched here and fail the same way at 0.27.0 (fe7fee6) in a clean worktree.
- Browser: new chat-grid spec (6: phone 390 dark and light and 320 by date and project, preference persistence, keyboard open, header pills over a scrolled transcript, reduced-transparency/forced-colours fallback, desktop 1440 dark and light with cached previews) and edge-chat, compact-chat, work-boards, board-preview, desktop-ui, responsive-layout and mobile-menu pass: 124 of 127. The 3 chat-surfaces failures (header height 119 px against a 110 px limit) also fail with the 0.27.0 header styles and predate this work; work-boards, compact-chat, responsive-layout and chat-surfaces assertions were updated for the removed zoom bar and the title chip.
- Synthetic screenshots were inspected locally and are not published. Not checked on a physical Android phone or in the Windows application window.

- Release validation: TypeScript check passed; unit tests 371/374 in the full run, with the three task-run timing checks passing 19/19 when run alone. Android (versionCode 86) and Windows builds passed. Source privacy checks passed for 653 entries; decoded artifact audits passed for 386 host files, 517 APK entries and 483 Windows entries. APK signer matches 0.27.0. Downloaded GitHub assets match the manifest hashes and the exact source tag; GitHub privacy CI passed. Physical Android and Windows shell checks were not performed.
- Published [v0.27.1](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.27.1) from [5758303b8b7b760f12ce4a30ccd67cdb6177ecfe](https://github.com/Evgenie-Myasnikov/pocket-code/commit/5758303b8b7b760f12ce4a30ccd67cdb6177ecfe) on [codex/chat-grid-0.27.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/chat-grid-0.27.1); APK, Windows package, host bundle and update manifest are available.

## [0.27.0](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.9...v0.27.0) (2026-10-19)

### Features
- connection: show a connected-PC card on the phone with address, PC version, last contact, a latency check and copyable diagnostics; keep scanning a new QR as a secondary action.
- connection: explain pairing failures by cause (expired or used QR, rejected or unconfirmed device, device limit, localhost or LAN-only address, Android HTTP block, version mismatch, another service) with one next step each.
- connection: after the PC revokes this phone, show which PC disconnected it and how to reconnect; do not send the revoked key again.
- connection: "Disconnect and forget" now asks for confirmation, names the PC and lists what is removed; it is hidden when nothing is connected.
- security: a pairing QR stops working after one use and rotates; the PC can rotate it manually. Pairing through the internet tunnel waits for approval on the PC, and the desktop tray announces new or waiting devices.
- desktop: optional keep-awake while agents run or a phone is online on mains power; open the logs folder from the app.
- shell: the phone starts on Chats and uses a bottom bar (Chats, Board, Inbox, More) instead of the hidden section drawer; the bar is hidden inside a conversation, Back from Chats leaves the app and More holds Rules, Changelog, Settings and the PC connection with its state.
- shell: one conversation header with Back (showing the state of other chats), the title as a heading, a subtitle that picks provider and project in a new chat, and only applicable labelled actions; the separate project row and the "Workspace" divider are gone.
- inbox: a single app-level inbox and poll serve every bell; the badge counts only chats waiting for an answer, errors and unread board notices, while running work shows a ring and unseen results a dot.
- inbox: filters by action with counts (All, Needs you, Running, Done, Board) that always open on All, two-line rows with provider, project and relative time, status pills only for Needs you and Error, "Clear finished" with Undo and "Mark all read" for board notices.
- inbox: an error stays under Needs you until the task is restarted, the person writes in that chat or chooses Hide; a board question opens a reply sheet that adds the answer to the card, returns it to Ready and only then marks the notice read.
- chats: chats that need you from every provider are listed first, the rest are grouped by Today, Yesterday and Earlier with relative times and a status (Needs you, Running, Done, Error, Stopped); provider chips replace the select used as a title and "New chat" is a labelled action.
- status: one run-status vocabulary and theme tokens with at least 4.5:1 contrast in light and dark themes, always paired with an icon shape, shared by the phone list, the PC window, the inbox and the tab dots.
- accessibility: inbox rows are named by title, status, provider and project; filters and provider chips are labelled groups with pressed state; status dots carry hidden text; every section has an h1.
- desktop: Ctrl+N starts a chat in the current project, Ctrl+Tab/Ctrl+Shift+Tab switch chats, Ctrl+Alt+U opens the inbox and Ctrl+/ lists the shortcuts; the inbox is marked current while open and the chat list stops highlighting a chat when another section is shown.
- transcript: activity rows name what was done ("Read form.ts", "Search “validate” in src", the command itself in monospace, "Edited form.ts +2 −1", "Playwright · Screenshot") from one registry for Claude, Codex and Copilot tools, with explicit running, error, denied and no-matches states; a failed call shows its last error lines without opening the row, and opened rows show a diff, the command with its output or labelled fields instead of raw JSON.
- transcript: related calls group by meaning ("Explored 5 files · 2 searches", "Ran 3 commands"); a plan update does not split a group. A Brief/Detailed switch (menu "⋯" in the chat header, Ctrl+O on the PC; Brief by default on the phone, Detailed on the PC, stored per device) folds each turn's routine work into one line while errors, questions and running calls stay visible.
- transcript: tool output shows the last 12 lines with "… N more lines", ANSI codes removed, Copy command and Copy output, and a red stripe for errors; agent and web results keep Markdown.
- transcript: TodoWrite/update_plan render as a checklist, and a "Plan 2/5 · current step" bar above the composer opens it while a plan is unfinished.
- transcript: a turn that edited files ends with a "Changed N files · +a −b" chip that opens Review; the running row shows an m:ss timer and a finished turn shows its end time and duration when it was watched live.
- transcript: one round "latest" button with a count of new replies replaces the two wide pills and fades while scrolling; "Go to beginning" moved to the header menu, and tapping the chat title does the same. In reading mode the exit button sits bottom-right, clear of copy buttons.
- markdown: code blocks show their language and a Copy action; table cells keep whole words and the table scrolls instead.
- transcript: background-task notices appear as a centred event line with expandable details instead of the person's message bubble.
- subagents: calls and results pair and group inside the agent panel, the result is pinned first with a chevron, the task is a two-line quote with Show more, cards show a chevron and the status uses one vocabulary (Working, Done, Error, Stopped) with shared status colours.
- results: one scrolling filter row with an Agent/Mine segment, the count in the title, generic items named after their file, paths relative to the project and plain status text ("Found in the full history · N").
- approvals: a permission request reads as an action: "Run this command?" with the command and its purpose, "Create file X?" with path, line count and foldable content, "Edit file X?" with a diff, and labelled fields for other tools; raw JSON moves under Details.
- approvals: "Deny…" can send a comment that the agent receives with the refusal; "Allow these in this project/chat" applies exactly the rules the provider suggested (Claude) or a session-wide approval (Codex); an approved Claude plan is shown as Markdown with "Run, accept edits", "Run, ask before edits" and "Revise the plan".
- approvals: a request now waits until it is answered or the run stops. Settings → Messages and approvals can set a 10-minute or 1-hour limit instead; then the card counts down and the transcript notes when a request timed out and was denied.
- composer: messages waiting to be sent appear in one "Waiting to send" block above the composer with Edit, Delete and Send now; a Claude follow-up joins the transcript only when the agent takes it, and after Stop undelivered follow-ups stay listed as "Not delivered".
- composer: while a turn runs, Send says what it does (Queue for Claude and Copilot, Steer for Codex); with an empty draft its slot holds a single filled Stop, which shows "Stopping…" and ignores repeated taps.
- composer: an access chip (Ask, Edits, Full, Plan for Claude; Ask, Auto, Full for Codex) sets the mode for this chat over the Settings default; Full is marked with the warning colour and needs a second tap the first time; Claude applies Ask, Edits and Plan inside the running turn.
- composer: every file gets its own card with upload progress, a named error and Retry; files pasted or dropped during an upload wait in line; a paste over 10,000 characters becomes a text attachment with "Insert as text"; a tray with more than two files shows how many.
- composer: on short screens (keyboard open) the files fold into an "N files" chip, the welcome block hides and the toolbar stays visible; the welcome folds as soon as something is written.
- desktop: Enter sends and Shift+Enter adds a line by default in the Windows window (a setting on both platforms), a hint shows the send key, Esc stops a running agent, Up in an empty field brings back the last message, Ctrl+Shift+M/I/E open the access, model and effort pickers, and files dragged from Explorer drop onto the composer.
- composer: the run status line sits above the composer with its timer, "last activity N s ago" after a silence and the Esc hint on the PC; it hides while a card asks for a decision.
- review: Split is two equal halves that wrap long lines; a new default Auto layout uses Split from a 900 px panel and Unified below; Split is unavailable (with a hint) when a side would be under about 40 columns, so a saved Split on a phone shows one column.
- review: changed words inside a replaced line are highlighted in both layouts; hunk headers read "Lines 14–27 · function" and are hidden for new or deleted files; "20 more context lines" and "Whole file" expand unchanged code.
- review: phones wrap long lines by default (Wrap lines setting), line-number gutters fit the real digit count with the +/− sign in its own column and one number column on narrow panels; Fit to width never shrinks below 60% and the unreadable 4–8 px code sizes are gone.
- review: each file has its own horizontal scroller with a sticky name and line numbers; reading mode keeps a strip with the current file.
- review: file statuses (New, Deleted, Not in Git, Binary, Generated) and real line counts for new files; binary files show "—"; lock, minified and linguist-generated files start collapsed and are not loaded until opened; an Ignore whitespace option is remembered.
- review: a file list (bottom sheet on the phone, a 240 px column on wide Windows panels) with Viewed checkboxes, Collapse/Expand all and "Viewed 3/7"; Viewed folds the file, is kept per PC, repository and comparison, and is cleared with a "Changed since viewed" chip when the agent edits the file again; Next marks the current file viewed and moves to the next unviewed one.
- review: tap a line number (Shift+click for a range, long-press on code) and "Ask the agent" adds `path:Lnn` with the quoted lines to the chat draft while Review stays open; Copy is offered too. The user still sends the message.
- review: one 48 px toolbar holds the file count, Auto / 1 / 2 layout and Refresh; the options sheet no longer repeats them, uses row toggles, a remembered file-type chip grid and the repository name instead of a raw path; the header shows repository, subfolder, branch and comparison.
- review: the Review button shows the change size (+42 −7, a dot on narrow phones); the "Changed N files" chip under a turn opens Review filtered to that turn's files with "Show all"; on Windows Ctrl+Shift+D opens Review, N/P move between files, V marks viewed and Ctrl+B switches columns.
- boards: create notes with **+ Note** in the board header, a **+** beside each column heading or the empty-board **Create note** button; long-press on the canvas stays as a shortcut.
- boards: move a note between versions without dragging, through the note **Version** field or **Move to version…**; the note lands at the bottom of that column.
- boards: long-press or right-click on a note or board card opens an action menu (Open, Move to version…, Prepare task, then Delete… after a separator) instead of going straight to deletion.
- boards: the note dialog is a bottom sheet on phones with a fixed header, close button and Cancel/Save footer, and **Note / Agent** tabs; text areas, the **Attach images** button with drop support and round remove controls match the other fields.
- boards: each card shows the stage of its latest AI task (Prepared, Working, Needs you, Checks, Ready for review, Approved, Error) and opens the task result; gallery cards show the most urgent stage per project from one request.
- boards: floating zoom controls (−, percentage that resets to 100%, +, Fit board); a dragged card lifts above its neighbours; the board name leads the header with the project and Git state below.
- tasks: the task result shows a stage pill and a Working → Checks → Ready for review → Approved stepper, "Updated N s ago", next-step buttons (Fix failed checks with the output tail, Address my notes, Prepare merge) that open the task chat with a draft, and one-tap card status suggestions with an evidence line.
- tasks: the run list names the provider, relative time and passed checks; the provider defaults to the one last used for the project or chosen in the app; a check is entered as one command line (quotes group words, no shell) or a JSON array.
- tasks: a prepared task chat shows a task card (title, branch, criteria, "send to start") instead of the generic welcome and starter suggestions that could replace the task prompt, and the chat title is the task title.
- Miro: the gallery card has a surface, a Miro mark and badge; a slow load keeps a status line with Retry and Open in browser; touch devices open a quick read-only view with **Edit in Miro**.
- documents: Rules, Changelog and Files are tabs of one library with a shared project picker; Files returns with a themed preview (rendered/raw Markdown, wrap, find in file, images in the shared viewer). Same-named projects are told apart by the nearest differing folder.
- documents: rule files show which provider reads them (Claude, Codex, Copilot: reads, not read because CLAUDE.md or AGENTS.override.md exists, for files matching a scope, or only when linked); Copilot instruction files and .claude/CLAUDE.md are found; a "What the agent sees" view lists each provider's chain with missing standard files, the Codex 32 KiB budget and long CLAUDE.md warnings, and "Check rules" opens a new chat with an audit prompt that asks for a report without changes (the chat itself has normal permissions).
- documents: relative links open the linked project document (Back returns to the source and its position) or the file preview; #anchors scroll; repository images load on request. Long documents get an outline (sheet on phones, side column on wide screens) and Back to top; changelog versions fold (Unreleased and the latest open) with expand/collapse all and version chips.
- documents: the reader keeps about 72 characters per line, with an "Aa" menu for wide text and size; code blocks follow the text size and have Copy and Wrap with an edge fade; tables scroll instead of breaking paths.
- documents: the built-in board rule is one card with a switch that saves optimistically (Saving…/Saved, rollback on failure) and is not shown in the reader, errors or the empty state. Projects with only the built-in rule are listed last; without authored rules the empty state names the supported files and offers "Create AGENTS.md with AI" in a normal chat.
- settings: phone and Windows settings are built from one section registry (groups PC · Agents · This device · Integrations · About, unique icons, where each setting is stored). Rows show the current value (PC and connection state, installed or available version, provider and access mode, tightest limit, theme/palette/text size, notification choices); an available update puts a dot on Settings. On wide Windows windows the sections stay listed on the left with the page on the right; re-selecting Settings or Ctrl+, returns to the start, and Esc or Alt+← goes back.
- settings: Windows now has the Codex access mode, the Claude spend limit and Notifications; the values are device defaults that open chats pick up at once. AI account pages have one Back button named after the parent, a provider segmented control and no empty Copilot access page (Copilot asks per tool in the chat).
- settings: each access mode is a card with a one-line consequence; Full access is marked with a warning colour and icon on both platforms. Sign-in shows a spinner, the chosen method and Cancel sign-in (new host endpoint that closes the sign-in window), refreshes every 2 s while waiting, and calls the methods Switch account when already signed in; sign-out confirmation is a danger action.
- limits: remaining allowance turns amber at 25% and red at 10% with an icon; resets read "Resets in 1 h 48 min · today at 18:40" with the full date on hover; a marker shows the elapsed part of the window and "ahead of pace" appears when usage runs ahead of time. A limits overview lists every provider's tightest window; the composer ring and Copilot follow the same colours. An optional line above the composer warns at 75/90/100% used or ahead of pace, can be hidden until the next level and says when the limit is restored (provider data only, no extra polling).
- appearance: a pinned conversation preview (user message, agent reply with code, tool activity), Dark/Light/System and Compact/Standard/Large segmented controls, exact sliders under More with a changed-value dot and per-setting reset, and a text Reset button with Undo that also resets reveal speed, edge fade and board grid.
- settings: one Notice style (info/success/warning/error with icon and action) for statuses; Miro shows the linked board with Change link and a confirmed Disconnect, Sign in again when signed in, and chevron disclosures; Windows connection toggles are switches.
- connection: one reachability model and supervisor for the PC. Every request reports into it; while the PC is away one /health probe runs with backoff (1, 2, 4 … 30 s, ±20 % jitter) and the other polls pause; the network coming back, returning to the app or Retry probe at once, and one "recovered" event re-reads /health, clears connection errors and refreshes chats, boards and the open chat immediately. The device heartbeat follows app visibility; the Android chat watcher backs off (up to 60 s) after failed polls.
- connection: one compact, opaque status line under the header (and on the phone chat list) replaces the stack of offline/history/network banners: "The PC is not answering · data from 14:32", "The tunnel answers, the PC host does not", "No network", "Connecting to the PC…", with Retry and the detailed reason under the chevron; it folds into a chip after a few seconds. Network failures are no longer repeated in the red composer alert, and history refresh failures are shown once in the transcript status line.
- connection: Send follows the connection: without the PC it is disabled with "No connection to the PC · the draft is kept", and the takeover question is never asked first. In a chat this phone already continues, a message written offline waits in "Waiting to send" ("Sends when the PC is back online", Edit / Don't send, in memory, at most a day) and leaves by itself when the PC answers; new chats are never queued.
- connection: a running turn without contact (two missed polls or an unreachable PC) shows "Status unknown · last update N s ago" without the writing animation, and Stop becomes Retry connection.
- connection: lists know about the connection: chats and boards show skeletons until the first answer, "The chat list loads when the PC is back online" / "Boards are not available offline yet" with Retry instead of "no chats/boards yet", Add project board explains it needs the PC, and the gallery reloads when the PC returns.
- windows: host states arrive as codes and are localized by the window (no English sentences or .NET exception text); a host that does not answer is reported once as "The PC host is not answering. Reconnecting…", the footer turns amber with Reconnecting…, the host status shows a spinner and the next attempt time, and Restart PC host sits next to Open logs folder. Tray texts follow the interface language.
- windows: a crashed interface process reloads the window once automatically, a hung one asks "Reload the window?" (the host and tasks keep running), and a lost browser process recreates the WebView; events go to desktop-window.log.
- updates: Windows shows the version as a chip, a download bar with MB and percent, and the tasks that hold the restart by name; the duplicate "App updates" heading is gone. The phone update card has one title with the source as a caption, the version and size, an APK download bar, an explanation for Allow installation, and its own opaque surface over the chat.
- android: alerts use separate channels for questions and approvals, errors and completed runs, so finished runs can be muted; when Android stops background tracking after its daily limit a quiet notification says how to resume.
- performance: Review, Results, Subagents and the document library load in their own chunks (main chat chunk 363 kB); the offline cache keeps a small index so eviction never parses cached values and unchanged answers are not rewritten.
- design system: one token file (src/tokens.css) with semantic status families (success, warning, danger, info, review, running) that each have text, tint and border steps for dark and light themes; run statuses, board statuses and priorities, task stages, notices and Review diffs are aliases of these families, and the running colour follows the palette accent.
- design system: component CSS no longer contains raw hex colours (about 350 literals moved into tokens or replaced by roles; a unit test blocks new ones), field borders use an --input role with at least 3:1 contrast, shadows, scrims, weights and global layers come from tokens, and spacing, radius, motion and icon scales are defined for gradual migration (chat and composer first).
- themes: hue palettes are generated in OKLCH with fixed lightness and chroma per role (even accent contrast across hues, HSL fallback for older WebViews); Neutral is now a warm grey and Ocean a teal blue so they no longer read as Codex and Copilot; a browser test checks text, muted, accent, field-border and status contrast for all 20 theme × palette combinations.
- typography: weights match the loaded faces (400/500/600, Manrope 700), interface text never drops below 11 px on the phone and 12 px on Windows at 100 %, uppercase labels share one tracking value, changing numbers use tabular figures, and code, diffs and the terminal fall back to the bundled JetBrains Mono (with Cyrillic) on phones instead of an arbitrary system monospace, while Windows keeps Consolas so Review column widths do not change.
- appearance: the preview shows inline code, a code block, a quote, a tool row and the composer; palette swatches show the background and accent of the current theme; compact spacing is a switch and the board grid step shows px; controls keep a readable width on Windows; new Contrast (Match system / Standard / High) and colour-blind (blue/orange) options, with High applied automatically when the system asks for more contrast.
- icons and motion: one stroke width for all icons (LucideProvider), icon sizes on a 14/16/20/24/32 scale, provider marks drawn as monochrome SVG instead of shared Unicode glyphs, a press/hover state layer instead of a brightness filter that was invisible on light palettes and absent on touch, and motion tokens (Material 3 curves, 100/200/300 ms) for transitions.
- android: the launcher uses the adaptive pocket-shield icon with a monochrome layer for themed icons, the splash shows the same mark on a day/night background, template splash images are removed, and status/navigation bar icons and the window background follow the app theme (saved for the next cold start).

### Bug Fixes
- i18n: restore the Russian follow-up recovery message and the external-image button label that were saved as question marks in 0.26.9.
- pairing: treat a 401 as device revocation only from the health and heartbeat checks, so a Jira or Miro sign-in error no longer unpairs the phone and wipes its cache.
- chat: a Claude follow-up rejected with 409 is resent after the turn ends only if the draft is unchanged; an edited draft stays unsent.
- claude: send a request budget within $0.10–$100, falling back to $5 when the field is empty or zero.
- task runs: tie the result-polling lock to its own request so a remount or mutation cannot leave polling stuck.
- desktop: rename the failed chat status class so the global error banner style no longer turns it into a pink block.
- chat: show tool output as preformatted monospace text instead of Markdown, keeping line breaks and "> command" lines intact.
- chat: place the conversation header on an opaque band so titles and controls no longer print over messages, including with edge fade off.
- chat: stop showing "update the PC server to enable Codex" while offline or in Claude/Copilot chats when provider status is simply not loaded yet.
- chat: the conversation header band is opaque by default (translucent with blur only on desktop with edge fade on), gains a hairline once the transcript scrolls under it, and the edge fade now holds its floor across the measured header height.
- inbox: background polls no longer flash "Loading processes…", re-render the app or announce through a status region; Refresh spins while loading and Retry is a regular button with the time of the last update.
- inbox: tapping a board notice shows progress immediately and ignores repeated taps.
- engine updates: browsing another provider's chats no longer changes which engine the PC checks for compatibility; only changing the setting in Settings → Updates sends it.
- cleanup: removed the unused mobile workspace header.
- shell: while the inbox is open on the phone, only Inbox is marked as the current place in the bottom bar; the PC connection entry under More is marked current when shown.
- inbox: if an answer to a board question was saved but marking the notice read failed, the sheet no longer reports a send error that would invite a retry and add the answer twice.
- desktop: Ctrl+/ no longer opens the shortcut list on top of another dialog, and chat rows no longer announce their run state twice.
- i18n: the empty local-history hint in a chat is translated to English again for every provider.
- transcript: reasoning stays open while it is the newest block of a running turn and folds into the activity line when the turn moves on (previously the activity group always rendered it folded).
- transcript: the chat "⋯" menu moves between items with the arrow keys, Home and End, and closes when Tab leaves it.
- composer: a follow-up refused while Claude finished its turn is kept as it was written and sent after the turn ends; text typed meanwhile stays in the field (previously the retry sent whatever was in the draft). The waiting message can be edited back into the draft or not sent, and returns to the draft on Stop or when leaving the chat.
- composer: the message field is no longer disabled while sending, so the Android keyboard stays open and focus returns to the field; a disabled Send stays visible as an accent outline.
- questions: an agent question no longer opens over a composer that is focused or has text; it waits as a banner ("Claude asked 2 questions") and focus returns to its Answer button after closing. Options no longer inherit a 22px label gap, and option text and notes are at least 13 and 12px.
- pickers: model and effort selects sit at their content width and look inactive during a run with a hint; the effort default reads "Default" instead of "—" and its label is translated; a custom Claude model ID field is focused at once, applies on Enter and has a primary Apply; the catalog notice is a button.
- i18n: a unit test fails on "???" inside t() keys or translations and on U+FFFD in sources; .editorconfig keeps files UTF-8.
- agents: a denial now reaches the model in neutral English ("The user denied this action.") with the person's comment, instead of a fixed Russian phrase.
- composer: a failed or pasted-text file card keeps its name inside the card, and Retry / "Insert as text" respond across the card instead of a 32px line; the waiting-to-send actions, the files toggle and the catalog notice are at least 44px.
- i18n: errors from withdrawing a queued message or changing the access mode after the run ended are shown in Russian.
- tests: approval-decision and no-timeout question checks wait for the run instead of relying on millisecond timing.
- review: polling compares a cheap comparison fingerprint and per-file fingerprints, so an unchanged repository no longer re-downloads every visible patch every 5 s, and idle polling slows to 15–30 s until something changes or the person interacts; single-file requests no longer list branches or rescan the whole project.
- review: the summary counts filtered files ("5 of 14 files", "—" after a failed load) with plural forms; empty, all-filtered and error states offer Compare with the main branch, Show all types and Retry; Git errors from the PC are translated; loading uses skeleton bars and one status region instead of one per file.
- review: diff colours are theme tokens with readable light-theme values, counters use tabular figures, and Split marks changes with a sign, a 3 px edge, hatched empty cells and screen-reader text; the diff uses an explicit monospace stack so a Russian page no longer pushes text past the row background.
- review: all Review controls are 48 px; the reading-mode exit is a bordered 48 px button at the bottom right.
- review: the Viewed checkboxes in file headings and in the file list are 48 px targets; N/P/V and Ctrl+B no longer act on a Review left open in a hidden Windows chat or under another dialog; the turn filter reads "Only files from this turn" (every turn has its chip) and says when that turn's files no longer differ; a long-press on code survives small finger movement and a re-render during the hold.
- boards: Back and Escape close board dialogs first, then return from the board to the gallery instead of leaving to Chats; a changed note asks before discarding; focus returns to the card; the open board survives switching tabs; the delete-board and Miro disconnect dialogs are modal.
- boards: status and priority colours are theme tokens with at least 4.5:1 contrast in the light theme, statuses are tinted pills with a dot, and the dotted/dashed/thick top edge is visible again; thumbnails use the same tokens and an empty board draws dashed columns.
- boards: **Refresh board** is no longer hidden on phones, and the board and its task stages are re-read when the app returns to the foreground (no new polling interval).
- tasks: a failed check no longer claims the working copy changed (the host reports `snapshotCurrent` for any outcome); the failure is shown once with the command name and exit code, failed output opens by default and check statuses and host task messages are translated.
- tasks: check setup moves below results and approval, collapsed once commands exist; disclosure rows have chevrons.
- ui: destructive buttons use the danger colour everywhere, not only on the devices page; board dialogs stack above the phone tab bar.
- tests: the StrictMode task-result harness, full-app task, work-board and maintenance-board scenarios open the Board tab from the current navigation.
- tasks: next-step drafts (Fix failed checks, Address my notes, Prepare merge) are added after the unsent chat text instead of replacing it, and on Windows they also reach a task chat that is already open from the board.
- boards: the note sheet's **Cancel** asks before discarding a changed note, like Back, Escape and the close button; the zoom buttons are 44 px targets.
- boards: the gallery task stage matches projects whose path the host reports with backslashes or a trailing separator, and a stale stage from a previous load or PC is cleared.
- Jira: Settings → Jira and the PC pairing page link are hidden until issues have a place in the app; FEATURES and USABILITY no longer promise Jobs or a PR workflow. The kept connection page no longer repeats its title, translates Connect, offers Retry when the status read fails, explains where to sign in outside Android and shows Reset sign-in only after a sign-in started.
- documents: an open document is re-read only when it changed (the host answers "unchanged" for the shown version) instead of being re-sent every 15 seconds; refresh is labelled for the document or the list and spins while loading; loading uses skeletons.
- documents: Claude is shown as not reading AGENTS.md when .claude/CLAUDE.md or CLAUDE.local.md exists, not only a root CLAUDE.md. On Windows, the sidebar Rules and Changelog buttons switch the library back from the Files tab, and a later New chat no longer inherits an unsent "Check rules" or "Create AGENTS.md" prompt; on phones these actions no longer replace the open chat's draft while a message is being sent.
- documents: a host error with a JSON reason (HTTP 5xx) keeps that reason instead of the generic tunnel message; document errors use the danger colour instead of an undefined token, and the file browser and preview use theme tokens instead of dark-only colours.
- settings: the Claude spend limit is typed as a draft and saved on Enter or leaving the field, clamped to $0.10–$100 with the reason shown at the field, with $1/$5/$20 presets; chats clamp it again before sending, and a host 400 names the setting with an Open budget settings link instead of a generic request error.
- updates: on Windows a failed or paused update offers Retry, an offline host explains why checking is unavailable with Open connection; AI compatibility uses product names, one checkbox style and polls only while visible; the GitHub source is titled From GitHub. The unused phone host-update component was removed and USABILITY now describes PC update progress as a Windows-app view.
- i18n: settings screens use t() only (no language ternaries), "Back" and the access, reveal speed, edge fade and grid labels are translated, category rows are named by their title and described by their value, and a unit test fails when a Russian t() key has no English value.
- settings: Windows switches show their on state and keep their size (the theme's text-field style had flattened them into empty pills); on the phone Back/Esc from an AI account page returns to the AI accounts list with focus on the row it came from; a cancelled sign-in window that closes after a new sign-in started no longer resets that new sign-in; no double divider above the Claude spend limit.
- offline: a tunnel answering 502–504 or Cloudflare 520–530 (or a non-JSON page) for a cacheable read now shows the saved boards and health like a dropped connection instead of an empty "no boards" screen; a JSON error from the host stays a host error.
- offline: the chat no longer advises "update the PC host to enable Codex" while the PC is unreachable; that notice appears only after /providers answered and names the selected provider. A chat that is not cached says it loads when the PC is reachable (with Retry), and the false "history refreshes every 3 seconds" and "Beginning of chat" lines are gone offline.
- i18n: the offline, history paging, restore-connection and workspace messages use t() with English values (no inline language ternaries or English-only errors), and a unit test guards the connection and update screens.
- connection review fixes: saved data shows when the PC last confirmed it (an unchanged answer no longer leaves "data from" at the time of the last change); the phone connection line and its Retry are 48 px touch targets; the Windows chat shows a host error from a chat read again (it had no line after the banners were merged); Esc while the run status is unknown retries the connection instead of sending Stop; the tray menu (Open, Connect / disconnect, Exit) follows the interface language; Restart PC host waits for a running host check so the host is not started twice.
- design system: the global alert class is now .error-banner and statuses are passed as data-status, so an error chat row on Windows no longer turns its dot and label into a brown alert box; the same applies to subagent, device, connection and rule-chip states.
- light themes: agent quotes use the text colour with an accent rule, conversation date rules, the provider mark and former dark-only literals follow the palette, --border and --error are defined, and an empty board note shows its "Add details…" hint as a muted italic placeholder (on Windows only on hover or focus).
- design system review fixes: a device waiting for confirmation keeps its accent status colour on Windows (its rule still used the old class); the Windows chat-list caption, connection line, empty-chat hint and shortcut keys no longer render below 12 px, and phone captions, labels and the legacy bottom bar no longer fall to 10 px, so the 11/12 px text floor holds; a unit test blocks class-based rules for statuses that moved to data-status.

### Documentation
- board: add changelog evidence to five recent done cards and a review card for this work.

### Validation
- TypeScript check passed; no remaining question-mark placeholders in src. Browser scenarios passed: device pairing (including a Miro 401 that keeps the pairing), follow-up composer and task pipeline (12), edge/compact chat layout (7). Transcript specs tool-activity/activity-groups/rich-updates/chat-surfaces show the same 5 failures with and without these changes (height and navigation assertions). Device checks not run.
- Connection area: TypeScript check and unit tests passed (332/333; the board-evidence test failure predates this work). 48 of 52 browser scenarios passed across connect-usability, device-pairing, qr-routing, workspace-recovery, settings-navigation, language and desktop-ui; qr-routing, settings-navigation and workspace-recovery fail identically on the previous commit, and the desktop note-deletion scenario passed on rerun. The C# shell was not compiled; no physical Android or Windows checks.
- Shell and inbox area: TypeScript check passed; unit tests 333/334 (the board-evidence failure predates this work; new badge-count test added). Browser: mobile-menu, notification-placement, section-header, notification-center (incl. new badge, reply-sheet and Undo scenarios), edge-chat, compact-chat, desktop-ui, language, connect-usability, settings-navigation, followup-composer, workspace-recovery, responsive-layout (now 72/72) and 25 other updated specs pass. Still failing and also failing on the previous commit: chat-recovery reading mode, chat-surfaces (3), navigation-usability, chat-pc-scope, attachment-tray (2), codex-access selection, copilot-provider, workspaces histories, ui QR image, usage-limits failed refresh. workspaces preference reload failed 1 of 10 repeated runs (intermittent).
- Shell and inbox review fixes: TypeScript check passed; unit tests 333/334 (same pre-existing board-evidence failure). Browser: mobile-menu (with the new inbox current-place check), notification-center, notification-placement, desktop-ui, section-header, responsive-layout and language pass (126/126). A local phone (390px, Russian, dark and light) and desktop (1440px) probe found no horizontal overflow, no sub-44px targets and no untranslated interface text.
- Transcript area: TypeScript check passed; unit tests 337/338 (the board-evidence failure predates this work; new registry, grouping, brief-summary and turn-change tests). Browser: new transcript-review (2), tool-activity, activity-groups, chat-outputs, subagents, chat-typography (now passing), ui, chat-recovery, live-presentation, rich-updates, activity-plain, responsive-layout, transcript-follow, edge/compact chat, desktop-ui, output-index-scope, questions-dialog, mobile-menu and language passed, except failures that also occur on the previous commit: chat-recovery reading-mode offset, chat-surfaces header height (3), chat-performance grouped command rows and the browser QR scan button in ui.spec.
- Transcript review fixes: TypeScript check passed; unit tests 337/338 (same pre-existing board-evidence failure). Browser: transcript-review (3, including new live-reasoning and menu-keyboard checks; the live-reasoning check fails on the previous commit) and 85 of 91 in tool-activity, activity-groups, chat-outputs, subagents, chat-typography, chat-recovery, live-presentation, rich-updates, activity-plain, transcript-follow, chat-surfaces, desktop-ui, chat-performance, ui, edge-chat and compact-chat; the 6 failures (chat-performance grouped rows, chat-recovery reading-mode offset, chat-surfaces header height ×3, ui QR scan) fail at the same assertions on the commit before the transcript work. A local phone (390px) and wide (1440px) probe in Russian and English found no horizontal overflow and no new sub-44px targets.
- Composer area: TypeScript check passed; unit tests 341/342 (the board-evidence failure predates this work; new approval-decision and text-encoding tests, follow-up API test updated for the queue). The desktop shell compiles with the WebView2 SDK. Browser: followup-composer (5, rewritten for the waiting block, queue actions, Stop, access chip and approval comment), new composer-attachments (3), questions-dialog (7, including banner focus and no-timeout requests), claude-models, codex-effort, composer-refinement (11; the letter-fade timing check passed on rerun), claude-access, usage-indicator, compact-chat, edge-chat, responsive-layout (72), desktop-ui, language, settings-navigation, mobile-menu, live-presentation, transcript-review, tool-activity and rich-updates pass; failures that also occur on the previous commit: attachment-tray (2), codex-access selection, chat-surfaces header height (3), ui QR image and workspace-entry (2). The final composer reruns used the mocked API only, because another local process held the fixture port. No physical Android or Windows checks; the push before an approval expires is not implemented.
- Composer review fixes: TypeScript check passed; unit tests 341/342 (same pre-existing board-evidence failure). Browser: composer-attachments (3, with a new card-target check that fails on the previous CSS), followup-composer (5), questions-dialog (7, twice), claude-models, composer-refinement (11), compact-chat, edge-chat, language, responsive-layout, desktop-ui, settings-navigation, claude-access, usage-indicator and mobile-menu (110) pass; attachment-tray (2) and codex-access selection fail identically on the commit before the composer work. The composer-refinement letter-fade check is timing-sensitive and failed in some loaded runs on this branch; it passed 6/6 when repeated alone and in the full file. A desktop probe confirmed Esc in the chat search does not stop a running agent while Esc in the composer does. Undelivered follow-ups left after Stop are still dropped when a new message starts the next run.
- Review area: TypeScript check passed. Unit tests 343/348 in the full run: the board-evidence failure and four task-run verification timing tests also fail on the previous commit under full-suite load (that commit: 336/342), and the task-run files pass 19/19 when run alone; new word-diff, hunk-label, file-status, fingerprint, whitespace/context and change-size tests pass. Browser: new review-workflow (9), review-file-list (3), review-focus (10), review-performance (4), review-settings, transcript-review, responsive-layout (64), desktop-ui and codex-access passed; chat-surfaces (3), codex-access workspace-switch and navigation-usability failures also occur on the previous commit. Documentation screenshots were not regenerated.
- Review fixes: TypeScript check passed. Unit tests 341/348: the board-evidence failure and six task-run verification timing tests; these task-run tests also fail when run alone on the commit before the Review work (1–4 per run), so the earlier "19/19 alone" result did not reproduce. Browser: review-workflow (11, two new: hidden-Review keys and 48 px Viewed targets, and a turn whose files no longer differ; the hidden-key check fails without the fix), review-file-list, review-focus, review-performance, review-settings and transcript-review (32), responsive-layout and desktop-ui (101) pass. A Russian 390 px and 1440 px probe in light and dark themes found no page overflow and no other sub-44 px Review controls. No device checks.
- Boards and task runs area: TypeScript check passed. Unit tests 340/349: the board-evidence failure and eight task-run verification timing tests also fail on the previous commit in the same full run (that commit: 337/348); new column-slot, failed-run snapshot and result snapshot tests pass. Browser: task-pipeline (12, including new StrictMode polling, failed-check and command-line tests and the two full-app task scenarios that failed before), work-boards (6, four new: draft protection with Back/Escape and tab switching, column + / Version / Move to version, zoom/fit/phone refresh/foreground refresh, card task stage), maintenance-board (3, failing before because of stale navigation), board-example (now passing with the restored status edge; one repeat hit a Windows EBUSY cleanup of its temporary folder), board-gallery, board-preview, miro-mobile, miro-ai-settings, desktop-ui (37), language, responsive-layout and notification-center (119 together) pass. Synthetic phone screenshots in dark and light themes were inspected for the board, note sheet, Agent tab, gallery and task result.
- Boards and task runs review fixes: TypeScript check passed. Browser: work-boards, task-pipeline, maintenance-board and desktop-ui pass (61); the new desktop and phone next-step draft tests, the gallery backslash-path test and the Cancel step of the draft-protection test fail on the previous commit and pass now. Unit tests 339/349: the board-evidence check, the manual-checks API test and eight task-run verification tests fail, and the same task-run and API tests fail on the previous commit when run alone.
- Documents and Jira area: TypeScript check passed. Unit tests 339/350: the board-evidence failure and ten task-run verification timing tests fail the same way on the previous commit in a full run (338/349); new Copilot/.claude discovery, reader-label, frontmatter-scope, unchanged-version and hidden-Jira pairing-page checks. Browser: project-docs (11, new empty state, built-in rule card, relative links/anchors, Files tab preview and error-token checks), document-library, desktop-ui (37), jira-ui (with a new hidden-by-default check), jira-existing, jira-pc-setup and settings-navigation pass, except the known settings-navigation:19 failure. Synthetic phone screenshots in dark and light themes were inspected; documentation-screenshots' QR connection capture fails on the connection screen, outside this area.
- Documents and Jira review fixes: TypeScript check passed. Unit tests 338/350: project-docs passes with new .claude/CLAUDE.md and CLAUDE.local.md reader checks; the failures are the board-evidence check, ten task-run verification timing tests and one Windows host-dispose timing test, none touching documents. Browser: project-docs, document-library and desktop-ui pass (49); the extended desktop Rules/Changelog test fails on the previous commit at the Files-to-Changelog switch and, without the New chat reset, at the inherited audit prompt.
- Settings area: TypeScript check passed; unit tests 359/360 (the board-evidence failure predates this work; new registry, budget parsing/clamping, usage tone/pace/narrowest-window, limit-level, out-of-range budget API, sign-in cancel and translation-key tests). Full browser run: 275/363 passed; 64 responsive-layout failures were an outdated nine-section count that also fails on the previous commit (updated to eight, 64/64 pass). Of the remaining failures, attachment-tray, chat-pc-scope, chat-performance, chat-recovery, chat-surfaces, desktop-ui (hidden-return), documentation-screenshots, navigation-usability, usability, workspace-entry, copilot-provider, run-notifications (desktop provider), ui (QR image) and workspaces fail identically on the previous commit; compact-chat and notification-center were updated for kept dated usage and the More disclosure and pass. Settings specs (appearance-controls, claude/codex access, desktop-ui, direct/engine/host updates, language, Miro, review-settings, settings-navigation, ui appearance, usage-limits with a new composer limit-warning scenario) pass.
- Settings review fixes: TypeScript check passed; unit tests 359/360 (only the pre-existing board-evidence check fails). Browser: settings-navigation (Back/Esc now steps through the AI accounts list), desktop-ui (new switch size and checked-colour check), codex-access, usage-limits, appearance-controls and review-settings pass (54); a computed-style probe showed the switch at 30 px with the panel colour while checked before the fix. Synthetic 390 px phone and 1440/900 px Windows settings screens were inspected in dark and light themes. Not covered by an automated test: the sign-in cancel race (needs the Windows sign-in window).
- Platform area: TypeScript check passed; unit tests 365/366 (only the pre-existing board-evidence check fails; new reachability, backoff, gated-poll, tunnel-502/530 cached-read, offline-cache index and connection-screen localization tests). The Windows shell compiles with csc and the WebView2 SDK; the Android Java changes were syntax-checked with javac only (no Android SDK here, not built or run on a device). Full browser run: 340/363; of the 23 failures, 21 fail the same way on the previous commit (attachment-tray, chat-pc-scope, chat-performance, copilot-provider, documentation-screenshots, navigation-usability, run-notifications, ui QR image, usability touch targets, workspace-entry, workspaces, chat-recovery reading mode, chat-surfaces, rich-updates), and the two regressions found (desktop idle-return scroll, board gallery Escape) were fixed by not re-rendering on every successful request and pass. Re-run after the fix: chat-recovery, direct-update, host-updates, desktop-ui, work-boards, followup-composer, connect-usability, device-pairing, edge-chat, compact-chat, document-library, subagents, chat-outputs, review-workflow and task-pipeline 117/118 (only the pre-existing reading-mode check), and the new connection-status spec (tunnel 502 → one line, Send disabled with the draft kept, Retry recovers) passes.
- Platform review fixes: TypeScript check passed; unit tests 365/366 (only the pre-existing board-evidence check fails; the offline-cache test now fails without the cache-age fix). The Windows shell compiles with csc and the WebView2 SDK (tray menu and restart guard not run on a desktop). Browser: connection-status, chat-recovery, desktop-ui, followup-composer and work-boards 57/58 (only the pre-existing reading-mode check); a synthetic 390 px probe confirmed the offline follow-up waits in "Waiting to send" and leaves when the PC answers, with 48 px status buttons, and the 1440 px layout was inspected.
- Design system area: TypeScript check passed; unit tests 368/370 in the full run (the pre-existing board-evidence check and one task-run timing test that passes 14/14 when its file runs alone); new design-tokens unit test (no hex literals in component CSS, weights and layers from tokens, no bare status classes or global .error, complete semantic families). Browser: new design-tokens spec (contrast for 20 theme × palette combinations plus high-contrast and colour-blind layers; equal PC status rows in both themes) passes; full run 344/366, and all 22 failures also fail on the previous commit when the same specs run there (attachment-tray, chat-pc-scope, chat-surfaces, usability, workspace-entry, workspaces, copilot-provider and others). Tests that parsed computed colours as rgb() now resolve them through a canvas (OKLCH palettes); the board-grid test expects "8 px" option labels. Android resources and Java changes were not built or run on a device.
- Design system review fixes: TypeScript check passed; unit tests 367/370 in the full run (the pre-existing board-evidence check plus two timing tests in run-notifications and task-runs that pass 8/8 and 14/14 when their files run alone). Browser: design-tokens (new text-size floor check at 1440 px and 390 px, which failed on the previous commit with an 11.9 px connection line), appearance-controls, desktop-ui, chat-typography, subagents, device-pairing, compact-chat and edge-chat 61/61; a probe confirmed High contrast and colour-blind mode change field borders, muted text and status colours for every named palette in both themes.

- Release validation: TypeScript/Vite, unit tests (all passed), Android (versionCode 85) and Windows builds passed. Source privacy checks passed for 648 entries; decoded artifact audits passed for 383 host files, 517 APK entries and 480 Windows entries. APK signer matches 0.26.9. Downloaded GitHub assets match the manifest hashes and the exact source tag; GitHub privacy CI passed. Physical Android and Windows shell checks were not performed.
- Published [v0.27.0](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.27.0) from [df3bc03f66bb3c5fb19e14ec38e373bafdb7e91a](https://github.com/Evgenie-Myasnikov/pocket-code/commit/df3bc03f66bb3c5fb19e14ec38e373bafdb7e91a) on [codex/review-0.27.0](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/review-0.27.0); APK, Windows package, host bundle and update manifest are available.

## [0.26.9](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.8...v0.26.9) (2026-10-14)

### Bug Fixes
- claude: render background-task notifications as compact status cards with task count and readable summary instead of raw transport markup.
- chat: recover Claude follow-up drafts that race turn completion by refreshing the exact job and continuing after it ends; cancel recovery on explicit stop or chat switch. Release stale model and effort locks after completion.

### Validation
- Six synthetic notification parser assertions passed; GitHub Public data checks passed.
- TypeScript/Vite build and two focused browser scenarios passed, including clarification during active Claude/Codex turns and automatic recovery after Claude closes input. Updated an obsolete test navigation selector. Android and Windows builds passed. Privacy audits passed for 611 source entries and decoded artifacts (320 host files, 501 APK entries, 387 Windows entries); APK signer matches 0.26.8. Live model turns and physical Android checks were not performed.

## 0.26.8 (Unreleased)

### Features
- appearance: add a per-device chat edge-fade intensity control from 0 (off) to 100%, shared by mobile and desktop. Preserve transcript geometry, reading mode and forced-colors accessibility.
- notifications: combine chat processes, statuses and board notices behind the bell, with All / Processes / Notifications filters. Remove the separate activity handle/drawer; share desktop activity with the embedded chat so viewing a result updates the bell immediately. Keep questions actionable, failed opens unread and stale refreshes visible with Retry.

### Documentation
- guide: document the unified inbox, viewing/acknowledgement behavior and edge-fade setting in English and Russian.

### Bug Fixes
- images: render the shared full-screen viewer at the document root so chat edge masks and stacking contexts cannot reveal the underlying interface. Keep its background opaque and suspend focus/Back handlers in underlying inert dialogs while preserving zoom and focus restoration.

### Validation
- Image viewer, 2026-10-12: reproduced inherited transcript masking before the fix. TypeScript/Vite and 19 distinct browser scenarios across focused runs passed, covering mobile/desktop viewport coverage with fade on/off, attachments, nested Results, board images, zoom/pinch/pan and focus restoration. Updated Results selectors for the root-level viewer and inspected a synthetic phone capture. Physical-device verification remains pending.
- Validated 2026-10-12: TypeScript/Vite build, 61 distinct browser scenarios across focused runs, five activity-state tests and documentation link checks passed. Covered cross-provider navigation, acknowledgement only after viewing, errors/retry, inbox filters, desktop feed sharing, fade persistence/geometry, narrow layouts, reading/forced-colors modes and header alignment. Updated obsolete drawer/navigation selectors in tests; inspected synthetic inbox captures. Physical device verification and release remain pending.

## [0.26.7](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.6...v0.26.7) (2026-10-12)

### Features
- chat: extend the transcript behind floating header and input controls, with gradual alpha fades at both edges. Measure control heights to keep the first and last messages readable as drafts, alerts and viewport sizes change; preserve reading/high-contrast modes and shared desktop navigation.
- android: enable edge-to-edge rendering with Capacitor safe-area handling, retaining system-bar and keyboard space for interactive controls.

### Bug Fixes
- chat: observe transcript padding changes and distinguish layout-driven scroll clamping from intentional history reading, so growing/shrinking drafts and keyboard-sized viewports retain follow mode.

### Validation
- Validated 2026-10-12: 49 distinct browser scenarios passed across focused runs, including 320/390/1280px overlay geometry, growing drafts, 400px keyboard-sized viewports, simulated safe areas, manual scrolling, reading/high-contrast modes, attachments, navigation, aligned headers and desktop integration. TypeScript/Vite and Android builds passed; synthetic phone/desktop captures inspected. Initial checks exposed padding-observation and resize-following defects, which were fixed. Physical Android keyboard/system-bar behavior remains unverified; not released.

- Release validation: all 49 browser scenarios passed in one run from the release checkout. TypeScript/Vite, Android (versionCode 82) and Windows builds passed. Source privacy checks, 318 host files, 501 APK entries and 385 Windows archive entries passed audits; host sources match the reviewed inputs. APK signer matches 0.26.6. Downloaded GitHub assets match the manifest hashes and exact source tag; GitHub privacy CI passed. Physical Android keyboard/system-bar behavior remains unverified.
- Published [v0.26.7](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.26.7) from [0e459fa1a1b7eafc4825bcbed48cc1078180971f](https://github.com/Evgenie-Myasnikov/pocket-code/commit/0e459fa1a1b7eafc4825bcbed48cc1078180971f) on [codex/edge-chat-0.26.7](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/edge-chat-0.26.7); APK, Windows package, host bundle and update manifest are available.

## [0.26.6](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.5...v0.26.6) (2026-10-12)

### Features
- chat: show user attachments as compact image thumbnails with zoom and file cards with on-demand previews; separate generated file lists from displayed prose while preserving provider prompts. Load nearby thumbnails with bounded concurrency and preserve access checks for project/upload files on mobile and Windows.
- chat: use a transparent menu control and soft alpha edges on the transcript; keep controls and dialogs fully opaque, preserve reading/high-contrast modes.
- claude: expose only SDK-advertised effort levels and validate them before starting a run; persist choices separately from Codex. Remove synthesized model-version entries and shorten the model label while retaining the exact ID in its hint.

### Bug Fixes
- usage: reject out-of-range percentages instead of clamping them into apparent full/empty quotas. Hide expired or failed readings in details and include the selected Claude catalog metadata when matching quota buckets. The compact ring remains the minimum reported applicable account allowance, not context usage.

### Documentation
- providers: document capability and quota rules in AGENTS.md and the English/Russian provider guides.

### Validation
- Validated 2026-10-12: 10 distinct browser scenarios passed across focused runs (compact attachments at 320/1280px, image zoom/document opening/focus, menu and transcript following, Claude model/effort controls, expired/failed quota display). 31 targeted unit/API checks and a separate four-check follow-up/API run passed. TypeScript/Vite and Windows shell compilation passed. Synthetic chat captures inspected. Live Claude metadata/usage reads succeeded without a model prompt; no physical Android checks or live model turn was performed. Unreleased.
- Initial browser failures were fixture issues (obsolete navigation helper and invalid synthetic PNG); corrected the fixtures without relaxing assertions. Build reports existing bundle-size and static/dynamic import warnings. Test listeners exited; production host was not restarted.

- Release validation: 34 unit/API checks and 10 browser scenarios passed. TypeScript/Vite, Android (versionCode 81) and Windows builds passed. Source privacy checks, 316 host files, 501 APK entries and 383 Windows archive entries passed audits; host sources match the reviewed inputs. APK signer matches 0.26.5. Downloaded GitHub assets match manifest hashes and the exact source tag; GitHub privacy CI passed. Physical Android and live model-generation checks remain unperformed.
- Published [v0.26.6](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.26.6) from [63a9e549ee5b756f12c8b6e78459c5fb355ca149](https://github.com/Evgenie-Myasnikov/pocket-code/commit/63a9e549ee5b756f12c8b6e78459c5fb355ca149) on [codex/compact-chat-0.26.6](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/compact-chat-0.26.6); APK, Windows package, host bundle and update manifest are available.

## [0.26.5](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.4...v0.26.5) (2026-10-12)

### Bug Fixes
- chat: show received run messages and partial-response snapshots immediately when reopening a conversation; animate only subsequently received content. Follow rendered transcript height during letter pacing and late image layout, while preserving intentional upward scrolling and saved positions.

### Features
- chat: fade new graphemes from transparent to opaque over 420 ms with a 60 ms inter-word pause. Preserve Unicode, Markdown, reveal-speed controls, instant mode and reduced-motion behavior; provider data is unchanged.
- navigation: replace mobile bottom tabs with a header menu and left section drawer. Preserve draft/chat return, status indicators, aligned headers, focus containment and Back/Escape dismissal; desktop navigation remains available.

### Validation
- Validated 2026-10-12: 27 targeted browser scenarios passed across focused runs, including running snapshot reentry, first partial response, alpha progression, word pause, manual scroll, late layout growth, history paging/cache, draft recovery, menu/back/focus and aligned 60/100/130% headers. Three Unicode/reveal/position unit checks and TypeScript/Vite passed. Synthetic 320/390px menu captures inspected. Earlier navigation-test failures were traced to removed bottom-tab selectors and updated in shared helpers. These checks preceded release; physical Android and live-provider checks were not performed.
- Release validation: 3 unit checks passed; 26 of 27 browser scenarios passed initially. The timing-sensitive word-pause scenario failed once during a concurrent build, then passed unchanged in one isolated run and three repeated runs; the cause remains unconfirmed. TypeScript/Vite, Android (versionCode 80) and Windows builds passed. Source privacy checks, 312 host files, 501 APK entries and 379 Windows archive entries passed audits. APK signer matches 0.26.4. Downloaded GitHub assets match manifest hashes and the exact source tag; GitHub privacy CI passed. Physical Android and live-provider checks remain unperformed.
- Published [v0.26.5](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.26.5) from [3b73567763018d5e6a8e01dbd1648127e61b8c4d](https://github.com/Evgenie-Myasnikov/pocket-code/commit/3b73567763018d5e6a8e01dbd1648127e61b8c4d) on [codex/mobile-navigation-0.26.5](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/mobile-navigation-0.26.5); APK, Windows package, host bundle and update manifest are available.

## [0.26.4](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.3...v0.26.4) (2026-10-09)

### Features
- chat: collapse consecutive matching command, file-edit, tool and reasoning rows into counted disclosures; preserve every call/result, keep errors separate and retain message anchors. Move the aggregate subagent entry beside Review and Results in the shared header; hide it for chats without agents and use compact icon actions on narrow screens.
- chat: remove trailing chevrons from activity disclosures and inline subagent entries; retain row activation, keyboard controls and visible focus.
- boards: remove the People view/category, participant controls and note assignee UI; always open the canvas, including when an obsolete People preference exists. Keep note status, priority and saved data intact.

### Validation
- Thirteen focused browser scenarios passed, including disclosure contents, error visibility, child context navigation, header absence in a new chat and 320/360/844/1280px layouts; five grouping/activity unit checks and TypeScript/Vite passed. Final header changes passed all eleven header/subagent scenarios again. Synthetic captures inspected. These checks preceded release; physical-device validation was not performed.
- Chevron removal passed ten activity/subagent browser scenarios, including keyboard disclosure. Board simplification passed five browser scenarios for obsolete preferences, editing, drag/zoom, save conflicts and reopening; TypeScript/Vite passed. Updated the board guide before release.
- Release validation: all 18 focused browser scenarios and 5 unit checks passed on the release checkout; TypeScript/Vite, Android (versionCode 79) and Windows builds passed. Source privacy guard and 309 host files, 501 APK entries and 376 Windows archive entries passed artifact audits. APK signer matches 0.26.3; downloaded GitHub packages match the manifest hashes and exact source tag. GitHub privacy CI passed. Physical-device checks remain unperformed.
- Published [v0.26.4](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.26.4) from [dbe63bd511cdb16c1e95dad0fa9a3ff3bc79563a](https://github.com/Evgenie-Myasnikov/pocket-code/commit/dbe63bd511cdb16c1e95dad0fa9a3ff3bc79563a) on [codex/chat-activity-0.26.4](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/chat-activity-0.26.4); APK, Windows package, host bundle and update manifest are available.

## [0.26.3](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.2...v0.26.3) (2026-10-06)

### Bug Fixes
- navigation: align mobile chat-provider, board, settings, rules and changelog headers with a shared height, title size and inset; remove the navigation divider below the open chat composer.
- notifications: add the inbox to the chat list and align its trigger with section/conversation headers; opening a notice from the list reveals its board.
- chat: pace current-run message blocks as well as partial text, retain the mounted reveal queue on completion and cap burst acceleration; replace the dotted generic running footer with the latest action and a reduced-motion-aware text sweep.

### Features
- boards: add board/project search, remove gallery card outlines and caption dividers, and soften canvas chrome while preserving state colors, previews and context actions.

### Validation
- Five browser checks passed, including tab geometry at 60/100/130% scale and notification controls at 320/390px. TypeScript/Vite build passed. Physical-device validation and release remain outstanding.
- Follow-up validation: 21 browser scenarios passed across gallery search, card actions, board drag/zoom, header/bell alignment, composer and streaming completion; two Unicode/reveal unit checks and TypeScript/Vite passed. Synthetic mobile/desktop captures inspected. Physical-device and live-provider stream checks remain outstanding; unreleased.

- Release validation: 21 browser scenarios and two reveal tests passed in the release checkout; Android/Windows built, APK signing continuity, source-matched host (306 files), artifact privacy, downloaded checksums and GitHub CI verified. Earlier unreleased notes above record pre-release checks.
- Release source: [01fd4e0](https://github.com/Evgenie-Myasnikov/pocket-code/commit/01fd4e0f592ac864f7cd76a2b6ba1cf3ab51bef4), branch [codex/gallery-chat-0.26.3](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/gallery-chat-0.26.3). Physical-device and live-provider stream validation remain outstanding.

## [0.26.2](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.1...v0.26.2) (2026-10-06)

### Bug Fixes
- notifications: integrate the bell into mobile section/chat headers and Windows navigation instead of a separate strip; use a 48px target and 24px icon, preserve unread badges and render the inbox outside header layout.

### Features
- boards: replace dim overlays with a full-board, aspect-preserving miniature on a subtle grid, including all loaded notes, column labels and status colors; separate the readable board/project caption and widen responsive cards. Miro preview availability is unchanged.

### Validation
- Five focused browser checks passed on 320/390px and desktop; modal focus, navigation, card open/delete and chat width verified. Synthetic captures inspected; TypeScript/Vite build passed. Not released; physical-device check remains outstanding.

- Release validation: five browser checks passed again in the release checkout; Android/Windows builds, APK signing continuity, source-matched host, archive privacy, downloaded checksums and GitHub CI passed. Earlier unreleased note above records pre-release validation.
- Release source: [3095d8e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/3095d8e83474784cdd55de8ab9537a2b2e98b7ea), branch [codex/board-preview-0.26.2](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/board-preview-0.26.2). Physical-device validation remains outstanding.

## [0.26.1](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.0...v0.26.1) (2026-10-06)

### Features
- claude: add persisted permission choices in mobile and Windows settings: ask for approval, accept file edits, or full access. Pass the selected native mode to new/resumed runs, retain active-run policy and enforce plan-mode precedence. API/SDK mapping and browser persistence checks passed; a live account was not exercised.
- chat: present structured provider questions in a dedicated accessible dialog with option descriptions, supported multiple selection, custom answers, draft retention, retry and expiry handling; preserve Codex question IDs and Copilot freeform restrictions. Existing enabled native alerts notify waiting questions for all three providers without repeated polling duplicates.
- appearance: persist slow, normal, fast or instant letter reveal speed and apply changes during live responses; reduced motion remains immediate.
- boards: display lightweight content miniatures behind repository board names using already loaded geometry and status colors; preserve open/delete actions. Miro keeps its existing card because the connection supplies no preview.
- chat: keep model selection and effort side by side in one row in the shared phone/desktop composer, including narrow screens; truncate long labels without wrapping the controls vertically.
- chat: progressively reveal live response letters, including the first network fragment, with soft glyph fading; retain full provider text and immediately display saved history or reduced-motion output. Frequent deltas share a presentation queue instead of restarting it.

### Code Refactoring
- release checks: read Git blobs in one validated binary batch per tree, retaining all file, credential, denylist and historical-commit checks; malformed batches fail closed.

### Bug Fixes
- chat: replace the provider/computer footer with a concise working or waiting-for-response status.

### Validation
- Questions, reveal settings and board previews: 20 targeted browser checks and 44 provider/streaming/notification tests passed; TypeScript/Vite build passed. Synthetic phone previews inspected. Windows notification queue passed 11 assertions; Android notification identity passed 7 assertions. Physical-device delivery remains unverified; not released.
- Six existing composer browser checks passed, including 320px at 60%/130%, phone/desktop widths, shortcuts and reduced motion; synthetic phone and desktop layouts inspected. Not released.
- Letter streaming: nine browser checks and two glyph/Unicode unit checks passed; TypeScript/Vite build passed. Includes first-fragment progression, frequent deltas and reduced-motion bypass. Not released.

- Published validation: 21 browser, 45 provider/server/streaming and 5 privacy checks passed. Android and Windows built; APK signing continuity, source-matched host, archive privacy and downloaded release checksums verified. Earlier unreleased notes above record intermediate checks.
- Release source: [bbdb282](https://github.com/Evgenie-Myasnikov/pocket-code/commit/bbdb282791d26302e0d62a9da77d137d90137804), branch [codex/chat-polish-0.26.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/chat-polish-0.26.1). Physical Android delivery and live Claude account checks remain unverified.

## [0.26.0](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.11...v0.26.0) (2026-10-06)

### Features
- tasks: link saved board cards to private, persistent task runs with an isolated Git worktree, provider chat, pinned-base diff, automatic executable checks and explicit human snapshot approval; preserve source files and interrupted work without automatic merge or relaunch.
- miro: add separate host OAuth/token setup and per-linked-board read/write opt-ins; providers can page through items and update existing notes, text and cards through the bundled helper, with stale-edit checks and encrypted Windows credential storage.
- notifications: persist bounded run events and native delivery cursors, catch up after reconnection and open the exact provider/job from Windows or Android alerts; expose one shared notification preference.
- claude: select aliases or exact model versions from a project-scoped runtime catalog, retain custom IDs, and pass the selected ID unchanged to new and resumed requests; fall back to aliases/manual entry when discovery is unavailable.
- chat: introduce a shared auto-growing prompt composer with compact circular actions, theme-aware focus and attachment previews; softly reveal newly appended prose characters while preserving Markdown, Unicode and reduced-motion preferences.

### Bug Fixes
- task navigation: ignore preparation responses after a note closes and prevent late status reads from replacing newly saved verification settings; stale file snapshots cannot retain current approval.
- desktop alerts: consume notification links in the outer shell, including when no chat is mounted, and retain mobile notification targets while an upload/navigation action is busy.
- packaging: include the Miro helper in host/desktop packages and accept only the portable board's public file formats during verified host installation.
- navigation: preserve the current section and visible QR/reconnect errors when the PC cache scope changes; restore history jumps before paint so a delayed callback cannot override subsequent scrolling.
- results/boards: clear outputs when changing chat scope, ignore late responses, persist the board view consistently, roll back rejected drags and prevent completed saves from reopening a departed board.
- controls: keep quota refresh clear of the activity handle and maintain usable touch targets for diff layout selection.
- claude: always close query resources after completion/failure, including time-bounded model discovery.

### Code Refactoring
- workflow: separate task orchestration, persistence, Git worktrees, check execution, result UI, Miro access and notification delivery into focused modules shared by Windows and Android.
- navigation: remove unreachable Jira inbox/terminal rendering and its eager terminal dependency from the shared app; preserve compatibility APIs and explicitly archive retired UI tests with current replacement coverage.
- chat: extract the composer/model picker and consolidate their styles; limit animated glyphs to a short fresh tail and avoid serializing completed history on each streamed delta.
- tests: share current chat/QR navigation helpers, await observable asynchronous outcomes and include privacy checks in the default test command. Retain failures from obsolete UI scenarios for migration.

### Documentation
- workflow: document isolated tasks and review gates in English/Russian, Miro developer-app setup and supported writes, private state boundaries, restart recovery and notification delivery limits.
- guides: refresh English/Russian setup, provider models/sign-in, chat, QR, updates, diff review, boards/Miro and troubleshooting; add architecture, local link checking and a scoped [maintenance report](docs/MAINTENANCE-2026-10-06.md).

### Validation
- 2026-10-06: 281 unit/server checks and 139 distinct focused browser scenarios passed across scoped runs; TypeScript/Vite, Windows/native smoke and Android debug build passed. Verified local documentation references and working source/documentation text with the privacy guard rules.
- Follow-up: 319/319 unit/server checks passed. The full current browser run passed 281/283; two obsolete navigation/copy assertions were updated, and both passed in a five-scenario rerun (including documentation captures). Thus all 283 current scenarios passed across these runs, not in one uninterrupted green run. Retired interface contracts are explicitly archived with replacement coverage.
- TypeScript/Vite, Windows build, native notification smoke checks and Android debug build passed; the actual host bundle was source-matched and verified through its installer. Documentation links and synthetic screenshots were checked. Physical Android and authenticated Miro/all live provider combinations remain unverified. A Windows node-pty cleanup helper emitted an AttachConsole error although the PTY lifecycle assertion passed; this remains a follow-up. No new release, installation or publication.

- Release validation: 281 current UI scenarios passed in one clean release-checkout run; two documentation screenshot scenarios were verified separately. The clean unit/server rerun passed 318/319, followed by 3/3 device checks after a transient Windows EPERM. Windows/Android builds, APK signing continuity, source-matched host installation, archive privacy checks and GitHub CI passed. Published Android, Windows, host and checksum manifest.
- Release source: [41e30eb](https://github.com/Evgenie-Myasnikov/pocket-code/commit/41e30ebcb57fd3bee0aec5e0679d1d45ca201321), branch [codex/task-pipeline-0.26.0](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/task-pipeline-0.26.0). Physical-device/Miro-account and node-pty diagnostic limitations above remain.

## [0.25.11](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.10...v0.25.11) (2026-10-03)

### Features
- boards: choose a grid step of 8, 12, 16, 24, 32 or 64 in Appearance settings on Windows and mobile; persist it locally and apply it to the visual grid, creation, dragging and keyboard placement.
- boards: widen version columns at step 64 so cards fit on the grid without crossing column boundaries; retain existing card positions until explicitly moved.

### Validation
- Seven focused data/placement checks and three browser scenarios passed, covering all grid steps, persisted settings, creation and mouse/keyboard movement at step 64. TypeScript/Vite, Android and Windows builds passed.
- Final source/APK/desktop/host privacy audits passed; host contents matched source and checksums. GitHub CI passed. Published Windows and Android assets; the updater downloaded and checksum-verified the APK. Physical devices were not tested.
- Release source: [d77fba0](https://github.com/Evgenie-Myasnikov/pocket-code/commit/d77fba04593d9b80bf12fd4278786505cd784898), branch [codex/grid-0.25.11](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/grid-0.25.11).

## [0.25.10](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.9...v0.25.10) (2026-10-03)

### Features
- boards: right-click a note card to delete it with confirmation; preserve other cards and image files, remove dangling dependency references, and reuse existing edit permissions and revision checks.

- boards: snap created and moved notes to an eight-pixel canvas grid that scales with zoom; preserve branch bounds and remove the duplicated creation menu.

### Validation
- Passed TypeScript/Vite, two placement checks and two focused desktop browser scenarios: confirmed/cancelled deletion, dependency cleanup, creation and dragging at changed zoom, no release-position jump and persistence after reopening. Android and Windows packages were built and published. Physical device testing was not performed.
- Release source: [d4a6369](https://github.com/Evgenie-Myasnikov/pocket-code/commit/d4a6369fee9bc7ead6fa0c73660f2f6c25ca7d1d), branch [codex/cards-0.25.10](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/cards-0.25.10). Six focused server/placement checks, two browser scenarios in the clean source and GitHub CI passed.
- Final source/APK/desktop/host privacy audits passed; host contents matched source and checksums. The published updater downloaded and checksum-verified the APK.

## [0.25.9](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.8...v0.25.9) (2026-10-03)

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
- Release source: [24d1059](https://github.com/Evgenie-Myasnikov/pocket-code/commit/24d105996df6d6d0fcc730d0df55b5c3ee3cbb13), branch [codex/chat-0.25.9](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/chat-0.25.9); published Windows and Android assets with matching update manifest.
- Passed 51 focused server tests, 6 browser scenarios, TypeScript/Vite, Android and Windows builds, and Windows native smoke. Synthetic board images were visually reviewed.
- Final source, APK, desktop archive and host bundle privacy checks passed; host content matched source and checksums. GitHub CI passed; the published updater downloaded and checksum-verified the APK.
- Legacy mobile results test setup still uses an obsolete provider selector; shared desktop results passed. Physical Android, private Miro authentication and live provider inference were not tested.


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
- Validation: 247 server tests plus the workspace-vault regression passed; 25 browser scenarios passed, including real QR approval/removal. TypeScript/Vite, Android and Windows packaging and native desktop lifecycle smoke passed. Physical Android testing unavailable.
- Release: Published v0.25.2 from codex/workspace-0.25.2 (2a7c38c), APK versionCode 65, with Windows, host and manifest assets. Source/artifact privacy audits and GitHub CI passed. The production updater downloaded the release and verified the APK checksum. Test listeners exited; the production host was not restarted.


## 2026-10-03 - Direct document sections and reliable QR retries (0.25.1)
- Changed: Replaced Project navigation with Rules and Changelog on Windows and Android. Each section selects among Git projects containing its Markdown documents; single documents open directly.
- Fixed: QR scanning routes PC pairing and workspace invitations to the appropriate flow. Pairing results are cached only while in flight, so re-scanning can recover from a revoked device key.
- Changed: Pocket Code's generated board reads the latest six versions from local CHANGELOG.md and refreshes on demand. Only recorded publications show Done. Untouched legacy examples migrate; edited boards are preserved.
- Improved: Compact connection screen and workspace rows; invitation and member management controls expand on demand.
- Validation: Full server run passed 245/246; an unrelated timing-sensitive Copilot test passed in an isolated eight-test rerun. Roadmap migration API test passed. 21 desktop/navigation/QR/board browser scenarios and six document scenarios passed; offline scenarios passed separately. TypeScript/Vite, Android and Windows packaging passed; native desktop smoke passed after a transient log cleanup lock on the first run.
- Release: Published v0.25.1 from codex/documents-0.25.1 (4324ff4), APK versionCode 64, with Windows/host/manifest assets. Source and artifact privacy audits and GitHub CI passed. After release metadata propagation, the production updater downloaded 0.25.1 and verified the APK checksum. Test listeners exited.
- Follow-up: The reported phone QR error text was not provided; identified wrong-section and stale-credential failures are covered. Physical Android testing remains unavailable.


## 2026-10-03 - Independent workspace invitations and local roadmap boards (0.25.0)
- Changed: Connection is inside Settings on Windows and Android. WorkSpace has its own QR invitations, explicit Local/Tailscale/Internet transport, desktop-only administration and named participant foldouts.
- Changed: Trusted paired devices reuse the PC profile; independently invited members enter their name. Personal chats and local boards remain separate from shared workspace membership.
- Added: Local boards and a Pocket Code example, populated roadmap templates, six distinct state styles and connected planned versions without creating Git branches.
- Improved: Desktop canvas panning, destination-column highlighting and bounded note placement. Cached workspace catalogs and boards remain readable offline; offline changes are disabled.
- Changed: Settings use categories and AI account/access/project subcategories. Desktop project selection is inside new chats.
- Validation: 244 server tests and 23 browser scenarios passed, with the three offline/Connection scenarios rechecked after the final navigation change. TypeScript/Vite, Android build, Windows packaging and native desktop lifecycle/bridge smoke passed.
- Release: Published v0.25.0 from codex/workspace-0.25.0 (5ded52f), APK versionCode 63, with matching Windows/host/manifest assets. Source and artifact privacy audits and GitHub CI passed; the production updater downloaded the release and verified the APK checksum. Test listeners exited; no production host was started.
- Follow-up: Physical Android testing remains unavailable. Independent workspace members do not receive the host's personal provider execution access.


## 2026-10-02 - Named participants and QR-bound shared boards (0.24.1)
- Changed: Notes support multiple participants through initial avatars, an add button and an upper-right remove control. Stable ID-based colors and legacy single-assignee migration preserve assignments; People view uses the same notes.
- Changed: Workspace entry asks for a personal name, stored separately from role. Host profiles are per connection; QR members choose their name after pairing.
- Changed: Workspace name/count and Board/People views share the header. Removed duplicate titles, saved-on-PC text and workspace switchers; board creation is one button.
- Privacy: Personal chats remain independent of boards. Ordinary workspace members cannot read host sessions/jobs or note chat links; shared-note edits preserve private links on the host. Trusted Host retains full provider access.
- Pairing: QR bindings persist with the device; new workspaces rotate invitations. Older unbound device connections require a fresh QR scan. Manual workspace sign-in UI is removed; legacy API remains compatible.
- Validation: 19 browser scenarios passed across board, desktop and device pairing (18 together, board rechecked separately). Full server run: 242/243 passed; the single Jira workflow failure passed on an isolated four-test rerun. Board privacy/profile and device checks passed; TypeScript/Vite, Android and native desktop smoke/build/package passed.
- Follow-up: Physical Android testing and isolated AI execution for ordinary workspace members remain outstanding. Published v0.24.1 from codex/board-0.24.1 (23e9c06), Android versionCode 62, with desktop/host/manifest assets. Source/APK/desktop/host privacy audits and release checksum checks passed; GitHub privacy CI passed. The production updater downloaded 0.24.1 and verified the APK checksum.

## 2026-10-02 - Board interaction and shared chat header (0.24.0)
- Changed: Board and People views share priority, status and assignee metadata. Columns determine note branches; branch and dependency selectors are removed from note details. Existing dependency data is retained.
- Added: Pinch/wheel zoom, hold-to-create notes, branch creation/rename from column headings, and optimistic note dragging without a release jump.
- Changed: Workspace administration is desktop-only and selects one repository. Participants appear in the header; mobile users can view the roster and join workspaces.
- Improved: Compact shared chat header with contextual actions; removed redundant desktop Chats navigation and Jira role setting.
- Validation: 243 server tests passed; 36 chat/results/desktop browser scenarios and the board browser scenario passed, including cross-column persistence. TypeScript/Vite, Android Gradle and desktop packaging passed; native desktop lifecycle/bridge smoke passed.
- Release: Published v0.24.0 from branch codex/board-0.24.0, commit da7abbb, with APK versionCode 61 and matching desktop/host/manifest assets. Source, APK, desktop and host privacy checks passed; asset sizes/hashes match the manifest and GitHub privacy CI passed. The real updater downloaded v0.24.0 and verified the APK checksum.
- Follow-up: Physical Android testing remains outstanding.

## 2026-10-02 - Board section label
- Changed: Renamed the Work section to Board in English and its corresponding Russian label in mobile/desktop navigation and section headers. Task status labels remain unchanged.
- Files: src/App.tsx, DesktopApp.tsx, WorkBoards.tsx; related UI test selectors.
- Validation: TypeScript passed; targeted label replacements checked for remaining section labels.
- Follow-up: Local change, not published.


## 2026-10-02 - PC-only workspace administration and header roster
- Changed: Phone users only join/select workspaces. Creation/settings controls and member administration are hidden; role changes and revocation now require the local host-admin connection even for a paired Host phone.
- Added: Header participants icon/count opens a read-only roster on phones. The desktop host manages roles/access from the same dialog. Dialog supports Escape, outside dismissal and focus return.
- Files: src/WorkspaceParticipants.tsx, WorkspaceMembers.tsx, WorkBoards.tsx, work-boards.css; server/boards.ts; workspace guides and tests.
- Validation: Two server tests passed including mobile Host role/revoke rejection. Browser board scenario passed hidden management controls and header roster assertions. TypeScript/Vite, Android Gradle and desktop builds completed; local APK and host bundle regenerated. The PowerShell redirect returned a nonzero status from native stderr, but the log confirms BUILD SUCCESSFUL and completed APK/bundle/manifest stages.
- Follow-up: Local artifacts only, not a new GitHub release. Existing running host was not restarted.


## 2026-10-02 - People view and shared task metadata
- Added: Board/People view switch remembered per board. People columns use workspace participants plus retained legacy assignees and Unassigned; tasks sort by critical/high/normal/low priority and title.
- Changed: Notes store priority and assignee ID alongside the existing owner label. Both views show title, priority, status and assignee and open the same editor; switching views creates no task copies or coordinate changes. Legacy notes display normal priority until edited.
- Access: Authorized workspace participants can read the scoped roster (IDs, display names and roles only); credential hashes stay private. Viewer board writes remain denied. The roster is workspace membership, not a corporate-directory integration.
- Files: src/BoardPeople.tsx, WorkBoards.tsx, work-boards.css; server/boards.ts; workspace guides and board tests.
- Validation: Two server tests passed, including metadata persistence and invalid priority rejection. Browser scenario passed priority sorting, shared status edits, reassignment to Unassigned, branch dialogs, gestures and delayed-save note dragging. Synthetic mobile screenshot inspected. TypeScript/Vite build and native desktop smoke passed.
- Follow-up: Local build only; not published as a new release. Physical phone testing remains outstanding.


## 2026-10-02 - Branch columns and stable note release
- Changed: Replaced Add branch selector with a plus after the last column and an editable confirmation. Holding or right-clicking a branch heading opens rename; keyboard Enter/Space works too.
- Git: Host-only create/rename operates on local branches in the exact repository root, validates names and board revisions, and never checks out or pushes. Rename updates references across that repository's boards. Board writes serialize with Git operations.
- Fixed: Note release keeps its new position optimistically while the host saves, restoring the prior state only on save failure rather than jumping back on every drop.
- Files: server/boards.ts; src/BoardBranchHeading.tsx, WorkBoards.tsx, work-boards.css; desktop/DesktopWindow.cs; workspace guide and board tests.
- Validation: Two server tests passed with real temporary Git create/rename and name-conflict checks; board browser scenario passed with plus/hold dialogs and delayed-save drop positioning. TypeScript/Vite and native desktop builds passed.
- Follow-up: Changes remain local, not published in a new release. Physical phone testing remains outstanding.


## 2026-10-02 - Create board notes by holding the canvas
- Changed: Removed the toolbar Note button. Holding empty board space for 550ms opens Create note; right-click opens the same menu on desktop. The draft starts at the canvas location adjusted for scroll/zoom and inherits its version lane.
- Interaction: Movement, additional pointers, scrolling and navigation cancel the hold. Existing note controls are excluded; viewers cannot create notes. Outside press and Escape dismiss the menu.
- Files: src/BoardContextMenu.tsx, WorkBoards.tsx, work-boards.css; tests/work-boards.spec.ts.
- Validation: TypeScript and the board browser scenario passed, including real touch hold, cancellation while panning, right-click creation, removed toolbar button and existing zoom behavior.
- Follow-up: Local patch, not published; physical Android testing remains outstanding.


## 2026-10-02 - Board gestures and one repository per workspace
- Changed: Removed zoom buttons. Board zoom uses two-finger pinch or Ctrl/Meta + wheel (15-300%), anchored at the gesture; single-finger canvas movement and note-handle dragging remain available.
- Fixed: The scaled canvas clips to its scaled layout box, avoiding an unscaled overflow area when zoomed out.
- Changed: Workspace setup chooses one repository with radio options, and the server rejects zero or multiple roots on create/edit. Existing multi-folder records remain readable to avoid silently losing boards; existing board-root removal protection remains.
- Files: src/use-board-zoom.ts, WorkBoards.tsx, work-boards.css; server/boards.ts; workspace guide and board/desktop tests.
- Validation: Two server tests and three browser scenarios passed, including wheel zoom, browser touch pinch and exclusive repository selection at 900/1440px. Physical phone testing remains outstanding.
- Follow-up: Local patch; not published as a new release.


## 2026-10-02 - PC-only workspace setup and simpler desktop navigation
- Changed: Removed the redundant Chats navigation category on Windows; conversations open from the existing list, with a draft entry preserving access after switching sections.
- Security: Workspace creation and settings changes require the host PC admin connection. Paired phones, including Host invitations, cannot create or modify workspaces; the mobile interface hides these controls.
- Fixed: Project checkboxes in workspace settings no longer inherit full-width text-input sizing and margins; long folder labels stay inside the dialog.
- Files: src/DesktopApp.tsx, WorkBoards.tsx, project-workspaces.tsx, work-boards.css; server/app.ts, boards.ts; workspace guides and regression tests.
- Validation: TypeScript/Vite build, two board/server tests and four browser scenarios passed, including desktop draft return, mobile controls and checkbox geometry at 900/1440px. Inspected the synthetic 900px screenshot.
- Follow-up: These changes are local; no new GitHub release has been published for this patch.


## 2026-10-02 - Host workspaces, visual boards and shared desktop chat (0.23.0)
- Added: Host-owned workspaces group project folders, boards and chat lists. Participants sign in with host address, workspace name and password; the host assigns Viewer, Developer, Reviewer or QA roles and can revoke sessions. Passwords and participant tokens are hashed in private host storage.
- Added: The desktop pairing screen selects the invitation role beside the QR, initially Host for testing. Non-host invitations select one workspace. Changing the invitation rotates the QR; the server ignores client-supplied roles.
- Added: Work replaces the Jira task list with project boards, Git-branch roadmap lanes, draggable notes, parameters, dependencies, zoom and durable saves with revision conflict checks. Note discussions prepare a chat draft and link the resulting session. Jira task polling is parked; integration modules are retained.
- Changed: Desktop embeds the shared interactive chat, including sending, attachments, steering, approvals, results and Review; switching sections preserves the draft. The native bridge permits only specific chat/board writes.
- Files: server/boards.ts, app.ts, devices.ts; src/WorkBoards.tsx, project-workspaces.tsx, WorkspaceLogin.tsx, WorkspaceMembers.tsx, PairingRole.tsx, App.tsx, DesktopApp.tsx; desktop/DesktopWindow.cs; docs/WORKSPACES.md.
- Validation: TypeScript, web/Android builds and native desktop smoke passed; 15 desktop/board browser scenarios passed. Server suite passed 243/243 sequentially; its first concurrent run had a transient Jira workflow failure which passed in isolation. Targeted access/device/server tests passed after the final scope check.
- Deployment: Published GitHub v0.23.0 from sanitized commit 1be70d2 with matching APK, Windows ZIP, host bundle and manifest. GitHub privacy CI and separate source/archive checks passed; the production updater downloaded the public APK and verified its checksum. Test-owned listeners were closed; the existing production host was not restarted.
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
