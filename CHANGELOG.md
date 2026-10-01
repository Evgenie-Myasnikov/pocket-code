# Changelog

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
