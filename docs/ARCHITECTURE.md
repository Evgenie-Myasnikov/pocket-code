# Architecture and contributor guide

[Documentation](README.md) · [Technical reference](REFERENCE.md) · [Validation report](MAINTENANCE-2026-10-06.md)

## Runtime boundaries

Pocket Code has one React/TypeScript interface in `src/`, an Express/TypeScript PC host in `server/`, a Windows WebView2 shell in `desktop/` and a Capacitor Android shell in `android/`. Windows embeds the shared chat, review and result components instead of maintaining a second conversation implementation.

Android connects to the authenticated host API over LAN, Tailscale or an HTTPS tunnel. Windows uses a constrained native bridge: UI read/write requests are checked against explicit endpoint allowlists and then sent to the local host. Adding a new host endpoint is not sufficient for Windows; update and test the native bridge allowlist where appropriate.

The host owns provider adapters and local files. Claude uses the Agent SDK, Codex the local app-server protocol, and Copilot its SDK. Their history, permissions, metadata and limits differ. Keep capability checks in adapters and render only advertised functionality.

## Code map

| Area | Main sources |
| --- | --- |
| Application / desktop navigation | src/App.tsx, src/DesktopApp.tsx |
| Models and preferences | src/ModelPicker.tsx, src/preferences.ts, src/EffortPicker.tsx, server/provider-model.ts, server/claude-models.ts |
| HTTP routing, auth and root checks | server/app.ts, server/security.ts, server/devices.ts |
| Provider execution | server/jobs.ts, server/codex.ts, server/copilot.ts |
| Conversation and result presentation | src/Messages.tsx, src/ChatOutputs.tsx, src/useChatOutputIndex.ts |
| Shared prompt input / streaming text | src/ChatComposer.tsx, src/streaming-reveal.ts, src/useStreamingReveal.ts |
| Refresh and continuity | src/visible-poll.ts, src/chat-cache.ts, src/chat-position.ts, src/use-chat-return.ts |
| Review | src/Review.tsx, server/review.ts |
| Repository and legacy live boards | src/RepositoryBoards.tsx, src/WorkBoards.tsx, server/boards.ts, server/project-board.ts |
| Private task execution and approval | src/BoardTaskRuns.tsx, src/TaskRunPanel.tsx, src/task-run-ui.ts, server/task-runtime.ts, server/task-runs.ts, server/task-worktrees.ts, server/task-checks.ts |
| Miro REST access | server/miro-integration.ts, server/miro-routes.ts, server/miro-vault.ts, src/MiroAISettings.tsx, scripts/miro-cli.mjs |
| Durable run notifications | server/run-notifications.ts, src/chat-notifications.ts, desktop/DesktopWindow.cs, Android RunFeedService |
| Rules and documents | server/project-rules.ts, server/board-instructions.ts, server/project-docs.ts |
| Packaging / updates | scripts/build-host.mjs, server/updates.ts, server/host-update.ts, desktop/DesktopWindow.cs |

## State and concurrency

Scope asynchronous data by connection, provider and session/project. A response from a previous scope must not replace a new screen. Board operations use navigation generations and revision checks. Optimistic drags must roll back when the host rejects the save. Result indexing maintains its own history scan and exposes only the active scope.

Device navigation and pairing errors are separate from transcript scope: acquiring the initial connection key must not hide the current page or a failed connection. History jumps restore position in a layout effect, before a subsequent user scroll. Streaming decoration affects only the newly appended text tail, caps animated glyphs at 192, preserves grapheme clusters and collapses expired spans. It never delays received text, animates saved snapshots or decorates code blocks; reduced motion bypasses it. Composer styling is centralized in `composer-controls.css`.

Provider metadata reads are bounded and cached. Claude catalog discovery starts metadata-only initialization, sends no user prompt, coalesces concurrent reads per directory and closes its SDK process on success, error or timeout. Aliases are fallback capabilities, not a claim that authentication/model access succeeded.

Only one writer may operate in overlapping directories; different non-overlapping projects have per-provider job limits. Resuming history also respects provider writer ownership. Follow-up IDs and retained jobs prevent accidental duplicates; a network retry must not launch a second operation.

Task runs create managed Git worktrees from a pinned commit. Only verified, registered
worktree paths expand provider/file roots; removing the source project removes access.
Private run state binds the source card, provider, job, checks and snapshot approval.
State transitions use revisions; verification starts asynchronously and is polled.
Startup reconciliation records interruptions without relaunching jobs. Task diffs compare
the pinned base with the current working copy, including committed and untracked changes.
See [task lifecycle and limits](TASK-PIPELINE.md).

Visible polling pauses when the document is hidden and avoids overlapping refreshes. Caches improve reopening but do not replace authoritative provider or Git state. Review/result/history tests must include delayed responses, changing scope and errors.

## Development and verification

Use the lockfile: `npm ci`. Then run:

- `npm test`: host, provider, state, security, update and privacy regression tests, primarily with synthetic adapters.
- `npm run build`: strict TypeScript and Vite production bundle.
- `npm run test:ui`: Playwright against a Vite server and synthetic host. Set `POCKET_TEST_BROWSER` to the installed Chromium executable if the default Windows Chrome path is unsuitable.
- `npm run check:docs`: local Markdown/image references.
- `powershell -NoProfile -File scripts/build-desktop.ps1 -SkipWebBuild`: Windows shell using an already built shared UI.
- `npm run android:build`: Android and host packaging; requires JDK 21 and the configured Android SDK. This creates packaging metadata, not a published release.

The browser suite starts its own fixture and must release it. Do not terminate a real user host to free a test port. Do not replace a failing assertion or fixture baseline merely to obtain a green run. Retired UI scenarios require explicit migration, while their server compatibility coverage can remain relevant.

Test SDK behavior with injected adapters. Live account entitlement, real Miro authentication, Android background restrictions and provider quota reporting require separate verification. Build success alone does not establish those capabilities.

## Changes and releases

Read AGENTS.md and relevant shared skills, then the existing portable board and changelog. Record authorized work on the relevant card before implementation. Preserve stable IDs and unrelated edits. Append scoped, unreleased changelog entries with actual checks and limitations.

Before preparing public artifacts, follow the [privacy skill](../.agents/skills/protect-public-data/SKILL.md). Use synthetic fixtures/screenshots. The privacy guard is an extra check, not proof that arbitrary personal content is absent. Never publish local caches, provider credentials, connection QRs or raw user reports.

A release requires separate authorization, a reviewed source commit, an existing branch containing it, privacy checks and matching manifest/board/changelog references. Tags must target that exact commit. Do not label a local build as published.
