# Historical browser scenarios

These files preserve tests for UI deliberately removed before the current
maintenance pass. They use `.archived`, so they are reference documents, not
runnable TypeScript or silently skipped tests. Original relative imports refer
to their former location in `tests/`.

| Preserved file | Retired contract | Current coverage |
| --- | --- | --- |
| `jira-workflow.spec.ts.archived` | Primary Tasks/Jira workflow screens, queue creation and role picker | Jira API/workflow/queue unit tests remain active; Settings keeps Jira connection coverage. Primary navigation now opens repository boards. |
| `task-notifications.spec.ts.archived` | Jira task bell and opening the removed Jira detail screen | Task notification data/API tests remain active. Board notification routing is exercised by `workspace-recovery.spec.ts`; run notifications have dedicated tests. |
| `workspace-entry.spec.ts.archived` | Separate primary WorkSpace entry and workspace board catalog | `workspace-entry.spec.ts` covers offline startup, Settings → Connection, repository board cache and credential isolation. Workspace parser/security tests remain active. |
| `workspace-recovery.spec.ts.archived` | Workspace header picker and participant/profile administration | `workspace-recovery.spec.ts` retains personal-chat offline recovery and board notification navigation. Workspace authorization/profile server tests remain active. |
| `ui.spec.ts.archived` | Initial connection landing page, demo entry and dedicated Terminal tab | `ui.spec.ts` retains connection QR decoding, history/appearance, attachment/approval and PTY API behavior using current navigation. |
| `chat-pc-scope.spec.ts.archived` | Primary WorkSpace picker during a personal conversation | `chat-pc-scope.spec.ts` retains legacy workspace metadata compatibility, provider/board navigation, and draft/history isolation across PC credentials with identical session IDs. |
| `codex-access.spec.ts.archived` (one Jira workflow case) | Sending Codex access choices from removed primary Tasks/Jira batch screens | Active Codex access tests retain default/persistence/provider isolation and actual chat payload assertions; Jira API/queue tests remain active. The new board task pipeline has separate permission coverage. |
| `desktop-ui.spec.ts.archived` (retired WorkSpace cases) | Primary WorkSpace creation, deletion and participant administration; the old combined Connection/WorkSpace route | `desktop-ui.spec.ts` retains Settings → Connection, device presence/revocation, provider login/logout, chat keyboard/clipboard, status, navigation, repository boards and Miro. `task-pipeline.spec.ts` covers actual desktop/mobile board → isolated chat execution. Workspace authorization/profile server tests remain active. |
| `jira-ui.spec.ts.archived` | Primary Tasks multi-select and Jira batch queue | `jira-ui.spec.ts` now verifies both provider-backed Jira connections in Settings, displayed status, disconnect and narrow layout. Queue and pagination API tests remain active. |
| `work-boards.spec.ts.archived` | Workspace membership/avatars and local board chat/branch controls | Current `work-boards.spec.ts` preserves repository note creation/edit/delete, stable grid dragging, priority order, version rename/placement, pan, wheel/pinch zoom and touch hold. `board-example.spec.ts` checks real repository persistence; `task-pipeline.spec.ts` covers the current task-to-chat flow. Workspace API/security tests remain active. |
| `qr-routing.spec.ts.archived` | Workspace join/password/participant UI launched from the PC connection scanner | Current QR routing rejects an invitation as a PC pairing code and retains real API checks for password, pending approval, profile, resume and revocation; ordinary device-pairing retry coverage remains active. |

This is an explicit product-contract migration, not evidence that a failing
current feature works. New failures in active scenarios must be fixed or
reported; they must not be moved here to obtain a green run.
