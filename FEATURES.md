# Feature coverage

## 0.13.0

- Android automatically requests the matching host update after upgrading and connecting; progress and retry stay in Settings → Updates.
- Verified, separate PC installation with dependency preparation while the current host remains running, idle-only handoff, preserved tunnel, startup verification and rollback.
- The regular launcher reuses the last verified installation. A phone never triggers a newer host than its own app version.
- Fixed native APK metadata parsing for ordinary JSON integers, preserving checksum, package identity and signing-certificate checks.
- Automatic host installation requires Windows, GitHub/npm access and a bridge already running 0.13.0 or newer. Android still confirms APK installation.

## 0.12.0

- Codex Full access by default; persistent Ask for approval and Approve for me choices for new/continued chats and Jira queues. Plan and Reviewer/QA remain read-only.
- Native account usage windows for Claude and Codex, with remaining percentages, reset times and explicit unavailable states.
- Contextual Review, Results and reading controls; Review detects working and committed branch changes in the selected project.
- Focused home screen and categorized settings for appearance/language, AI/workspace, usage, Jira, updates, connection and app information.
- Persistent red disconnect action below settings content, collapsible access explanations, and proportional chat/tool typography with independent touch targets.
- Shared project discovery across Claude and Codex workspaces and role-aware Jira queue persistence.

## 0.11.0

| Feature | Claude | Codex |
| --- | --- | --- |
| Separate workspace, model, mode and project selection | Yes | Yes |
| Switch without losing the current draft or attachment selection | Yes, during this connection | Yes, during this connection |
| Read local PC conversations and refresh history | Code histories, including supported Desktop indexes | Local app-server histories within allowed project folders |
| Start a chat or continue an existing one | Yes | Yes, after the desktop owner releases the chat; an open desktop client can keep its writer lock even when idle |
| Stream responses, show tools, stop a turn | Yes | Yes |
| Individual approvals and clarification questions | Yes | Supported app-server command/file approvals and questions; unsupported requests are rejected |
| Attach files and images | Yes | Yes |
| Live terminal | Yes | Not yet; use structured chat |
| Jira selected issues / batch queue | Yes | Yes; direct Jira MCP tools through the selected Codex connector |
| Jira search, task categories and role-aware workflow | Existing Claude connector, live transitions and required fields | Own Codex connector; no model turn for Jira tools |
| PR preview, creation and task/chat links | Shared GitHub CLI on the PC | Shared GitHub CLI on the PC |
| Automatic earlier history and content-only reading | Yes | Yes |
| Agent activity and child context | SDK-listed child transcripts within the parent project | Verified child threads within allowed projects |
| Project rules and local changelog in Markdown | Shared project files, read-only | Shared project files, read-only |
| Categorized chat results and source attachments | Loaded conversation and scoped file previews | Loaded conversation and scoped file previews |
| Working, staged and branch Review | Shared project Git view | Shared project Git view |
| Per-request dollar budget | Claude SDK estimate | Not supported |
| English/Russian, theme, palette, compact size | Shared saved preferences | Shared saved preferences |
| GitHub APK update checks and downloads | Shared, through the connected PC | Shared, through the connected PC |

Usability improvements include large mobile tap areas even with compact text, a project selector in the chat header, per-chat draft retention, connection recovery, clear activity states and Back/Escape with accessible modal focus. See [USABILITY.md](USABILITY.md) for the evidence, sources and physical-device/user-testing limits.

## Known limits

- Ordinary Android devices require confirmation to install an APK. The updater cannot silently replace the app. It updates the phone app; server source is updated separately.
- Native installation, camera scanning and external PDF viewer behavior need physical-device verification.
- Agent context is read-only. Missing child transcripts fall back to available task/result details, and missing status evidence is labeled unavailable. Peers, unrelated threads and out-of-scope child projects cannot be opened through an agent card.
- Cloud-only chats, every desktop plugin/UI, voice and interactive provider artifacts are not reproduced. Unknown structured content is shown as an expandable block when possible.
- Results index loaded messages, not every file on the PC. Current-file previews are labeled and limited to project-scoped raster images, PDF and UTF-8 text. Office/interactive artifact previews remain unavailable.
- Project rules are displayed, not created or automatically injected into the native agent. Parent-folder or user-level instructions outside the selected folder are not enumerated.
- Review shows the selected project's Git changes, including edits outside the current conversation. It is not a per-turn snapshot.
- Jira workflow roles organize available actions; actual permissions remain those of the connected account. Supported English/Russian stage aliases are recognized; unfamiliar statuses and complex required fields need Jira. Stage-filtered pages may require additional reads.
- Jira review/QA actions change Jira status after user confirmation. They do not cast GitHub review votes, merge a PR, or automatically mark work complete after an AI answer. PR creation requires a clean committed task branch at the exact repository root.
- Workspace drafts are retained while switching in the current connection, not after force-closing the app. Preferences and connection settings persist.
- The bridge prevents its own agents/terminals from editing the same project concurrently. Codex also enforces a single writer per conversation across processes. History remains readable while Desktop owns a chat, but to continue that exact chat, finish its work and close Codex Desktop before retrying on the phone. The bridge never removes writer locks or closes Desktop automatically. Rejected messages are not automatically resent.
- Temporary internet tunnels change address after restart. Scan the new QR. The PC must stay awake with the bridge running.
- Current development APKs use a local Android debug signer. Preserve the original private keystore for compatible updates.

## Issues addressed in this release

- Active-writer Codex failures preserve the rejected draft and attachments, explain recovery and keep history readable. Retries are explicit.
- Older messages load automatically at the history edge with stable scroll position and deduplication; stale requests cannot overwrite another chat.
- Header controls no longer overlap titles; settings updates follow normal document flow. Narrow Review defaults to unified changes, and reading mode removes the surrounding controls.
- Adjacent tool calls/results share an expandable card; unknown activity retains its original details without internal type names in the summary.
- Jira actions persist their progress, reconcile uncertain remote results, prevent parallel mutations across workspaces and retain role-specific chats. PR retries recover an existing PR instead of creating duplicates.
