# Current feature coverage

[Documentation](docs/README.md) | [Russian documentation](docs/INDEX.ru.md) | [Release history](CHANGELOG.md)

This page describes the current application rather than preserving old release matrices. Historical behavior is recorded in the changelog.

## AI workspaces

| Capability | Claude | Codex | GitHub Copilot |
| --- | --- | --- | --- |
| Local supported chat histories | Code/SDK and supported Desktop indexes | Native app-server histories | Local sessions; remote sessions excluded |
| New or continued structured chat | Yes | Yes, subject to native writer ownership | Yes |
| Streaming, stop and follow-up messages | Yes | Yes | Yes; follow-ups enqueue |
| Model selection | Claude model choices | Runtime-provided models | Runtime-provided models |
| Reasoning effort | No dedicated control | Runtime/model-supported choices | No dedicated control |
| Interactive approvals/questions | Supported SDK requests | Supported app-server requests | Supported SDK requests |
| Files and images as inputs | Yes | Yes | File attachments through SDK |
| Subagent context | Supported child transcripts | Verified child threads | Not exposed |
| Account limit windows | When SDK/account exposes them | When runtime/account exposes them | Not exposed |
| Per-request dollar budget | Claude setting | Not applied | Not applied |
| Access-mode setting | Provider behavior | Ask / automatic review / Full access | Interactive tool permissions |

The standard Windows launcher currently requires Claude or Codex detection. Copilot is available as an additional workspace; see [account setup](docs/PROVIDERS.md). Provider-specific desktop artifacts and cloud-only conversations are not a promise of compatibility.

## Shared app features

| Area | Available behavior |
| --- | --- |
| Connection | QR camera/image pairing, saved connection, local Wi-Fi or temporary HTTPS internet tunnel |
| Projects | Phone folder selection, incremental local Git/worktree discovery, explicit allowed-root restriction |
| Chat | Compact tool rows, attachments with removal controls, automatic history pagination, saved reading position, reading mode |
| Results | Progressive history indexing, content/source categories, image thumbnails and zoom, supported file previews |
| Review | Scrollable collapsible file diffs; working/index/branch comparison; extension filters; unified/split; 4-24 px and fit-to-width |
| Activity | Right-side draggable drawer, job states and unanswered requests, viewed completion tracking |
| Android alerts | Native tracking of the last open chat and outcome/question notifications, subject to OS permissions/background limits |
| Tasks | Shared Jira connection, assigned-issue search and native filters, full descriptions, role-aware actions and required fields |
| Task batches | One normal chat with full descriptions and a sequential prompt; no separate queue UI |
| PR workflow | Explicit branch/file preview, GitHub CLI publication and Jira transition; no automatic merge |
| Task bell | Periodically detected issue changes; baseline and read state; not Jira's full inbox |
| Project documents | Read-only Markdown rules/changelogs and file browsing |
| Appearance | English/Russian, themes/palettes, chat size, interface scale, spacing and compact mode |
| Updates | PC prepares verified APKs for phones; Android confirms installation; Windows desktop/host updates when idle with failed-start rollback |
| Compatibility | Effective AI runtime version tracking and a separate source-project compatibility task |

## Boundaries that matter

- The PC must remain awake and reachable. Cached chat content is not a complete offline archive.
- The host blocks overlapping project writers across its agents. Up to three jobs per provider can run in separate folders; automatic worktree creation is not implemented.
- Codex Desktop can retain a writer lock even while idle. Pocket Code does not remove locks or terminate Desktop to take a chat.
- Results indexes recognized materials in available messages. It does not list every file on the disk or guarantee native rendering of Office/interactive artifacts.
- Review includes all selected-project Git edits, including edits outside the conversation. It is not a per-turn snapshot or a PR approval.
- Rules are displayed, not edited or injected into native instructions by the viewer.
- Jira roles organize the UI; account permissions and live transitions still govern actions. Unsupported required fields need Jira itself.
- Batch chat creation does not change statuses or publish PRs. AI completion does not imply review approval or QA success.
- Android confirms APK installation. The original launcher/source is distinct from managed host packages; some launcher changes require updating that source and relaunching.
- Separate terminal/live-chat navigation was removed. Legacy APIs remain for older clients.
- Native camera, installation and background behavior require physical-device validation. See [usability](USABILITY.md) and [performance](docs/PERFORMANCE.md) for actual verification limits.

See [workflows](docs/WORKFLOWS.md) for steps and [troubleshooting](docs/TROUBLESHOOTING.md) for recovery.
