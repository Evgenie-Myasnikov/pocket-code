# Changelog

## 2026-10-01 - Windows process lifecycle fix (unreleased)
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
