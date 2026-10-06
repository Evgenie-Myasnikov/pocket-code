# Maintenance audit — 2026-10-06

[Documentation](README.md) · [Architecture](ARCHITECTURE.md)

Status: unreleased local work following 0.25.11. No new tag, commit, release or device installation is implied. This is a broad audit and targeted refactoring, not a claim that every source file has been rewritten or that every legacy UI test passes.

## Reproduced findings and changes

| Area | Finding / resulting behavior |
| --- | --- |
| Claude model selection | The client and API accepted only fixed aliases. A metadata-only, project-scoped SDK catalog now exposes reported versions; explicit IDs persist and reach execution unchanged. Older hosts/catalog failures retain aliases and manual entry. Windows bridge access is included. |
| Provider lifecycle | Claude query objects are closed explicitly after success/error. Catalog discovery is coalesced, time-bounded and always closes its process. |
| Streaming cost | The host no longer serializes all accumulated messages on every text delta; completed-message changes refresh the retained size calculation. |
| Prompt composer | Windows and Android share an extracted, auto-growing component and consolidated theme-aware styles. Round send/stop controls retain large touch targets, attachments retain previews and keyboard/paste behavior is preserved. |
| Response presentation | Only freshly appended prose characters fade in; Markdown stays formatted, glyph count is bounded, Unicode graphemes remain intact and reduced motion disables animation. Saved text and code do not animate. |
| QR/reconnect navigation | Changing cache scope could reset navigation and hide a connection failure. Pairing status and device navigation are now independent of PC-scoped transcript state. |
| History jump | A delayed animation-frame callback could override a subsequent user scroll. Position is restored before paint using the existing layout effect. |
| Touch controls | The activity handle could cover the quota refresh button; the heading now keeps that action clear of the right edge. Diff layout buttons now retain a 44px minimum touch target at small scales. |
| Results | A newly opened/pending chat could retain another conversation's output index. Results and late responses are now scoped to the active connection/provider/session. |
| Boards | People-view preferences used different read/write keys. Rejected optimistic drags could retain their DOM position, and a late save could reopen a board after leaving. Keys, rollback and navigation checks now agree; unreachable creation UI was removed. |
| Tests | Shared navigation helpers follow current New/Chats/Settings entry points. Async provider tests wait for observable completion rather than assuming a fixed sleep or synchronous SDK initialization. Privacy `.test.mjs` checks are included in `npm test`. |
| Documentation | English/Russian user guides, boards/Miro, architecture, capabilities, setup, QR, updates, review and troubleshooting were reconciled with current navigation. Local links are checked automatically. Historical screenshots/benchmarks are labeled. |

## Validation

| Check | Actual result |
| --- | --- |
| `npm test` | 281 passed, including provider/API, stream lifecycle, Unicode reveal, board/state, updater and privacy checks. |
| Focused Playwright regressions | 139 distinct scenarios passed across the final scoped runs after fixes. Coverage includes 64 viewport/language/scale combinations, composer shortcuts and reduced motion, live follow-ups, attachments, connection recovery, model selection, board rollback, output isolation, quotas and virtualized diffs. This is not an all-suite pass. |
| Full browser diagnostic sweep | 298 scenarios: 134 passed and 164 failed at that point. This exploratory run overlapped source changes and included retired Jira/WorkSpace/Project navigation. Failures were retained and used for diagnosis; affected current scenarios were rerun separately. The remaining historical suite still needs migration and a clean full run. |
| TypeScript / Vite | Passed; bundle warnings below remain. |
| Windows build and native smoke | Passed: shared WebView UI, tray lifecycle, scoped bridge operations, owned-child cleanup and saved reconnect. No production host restart. |
| Android | Capacitor sync and Gradle `assembleDebug` passed. No physical-device installation or testing. |
| Installed Claude catalog | Metadata discovery returned 15 entries, 12 with resolved IDs, without submitting a model prompt. Availability of every model was not inferred from this result. |
| Documentation | Local links and image references verified in 21 Markdown files. Working source/documentation text passed the local privacy pattern/denylist check; this does not certify existing images, archives or historical commits. |

Composer screenshots were inspected at narrow and desktop widths using synthetic data. Commands and raw diagnostic logs remain local rather than being copied into public documentation. Build artifacts keep the existing version and are local verification builds, not a new release.

## Task workflow follow-up

A subsequent authorized pass added private task runs, isolated Git worktrees, accepted
card snapshots, pinned task diffs, executable checks and human approval. Miro now has
an optional REST connection with per-board read/write opt-ins, separate from embedding.
Windows/Android run notifications use a persisted journal and exact chat/job targets.
See [task workflow](TASK-PIPELINE.md) and [Miro setup](MIRO-AI.md).

The full unit/server run passed **319/319** checks. Windows and Android debug builds
passed again. Actual host packaging was unpacked through the installer and all **293**
entries matched source; required helpers and task modules were present. This is local
verification, not an installed update or published release.

Removing unreachable Jira/terminal rendering reduced the shared App JavaScript chunk
from **894.82 kB to 548.78 kB** in comparable local Vite builds (gzip **255.02 →
166.96 kB**). This is measured bundle size, not measured phone startup latency. The
remaining large-chunk warning is still valid.

Retired UI contracts are preserved under `tests/legacy/*.archived`, with an explicit
[coverage mapping](../tests/legacy/README.md). Supported navigation/security/state
scenarios remain active. The earlier diagnostic failures above are historical;
the current full run passed 281 of 283 scenarios. Two outdated assertions (QR
navigation after revocation and Jira connection wording) were updated without
removing their security/provider checks. Both passed in the final five-scenario
rerun, which also regenerated documentation screenshots. All 283 active scenarios
have therefore passed across these runs; this is not a single uninterrupted green
run. Documentation references pass in 24 Markdown files.

## Remaining validation boundaries

- Historical Jira task/queue, WorkSpace administration and Project-tab tests are explicitly archived with a coverage map. Current connection, authorization, provider and repository-board scenarios remain active.
- A Windows node-pty cleanup child emitted `AttachConsole failed` in the real PTY test; its output and exited-state assertions passed and the fixture continued. The cleanup diagnostic needs further investigation; it is not hidden as a clean native lifecycle result.
- Synthetic browser checks exercise desktop Chromium/WebView layouts, not physical Android keyboard, background/battery behavior or a real phone installation.
- Claude catalog discovery was checked against an installed runtime without sending a model prompt. Paid inference, account entitlements for every listed model, live Copilot/Claude/Codex sign-in and authenticated Miro sessions were not exhaustively tested.
- Vite still reports a large main application chunk and a redundant dynamic/static import warning. Further navigation-module splitting is follow-up work; this audit does not claim a measured improvement to first-load time.
- No publication, production process restart or live-board assignment was performed. Repository board edits become visible when the file is refreshed; they do not notify private participants.
