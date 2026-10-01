# Changelog

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
