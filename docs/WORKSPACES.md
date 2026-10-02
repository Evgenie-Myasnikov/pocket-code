# Workspaces and project boards

Create and edit workspace settings only in the Windows application on the host PC. A phone paired as Host can use the workspace, but cannot create it or change its name, password or project folders. The server enforces this restriction, including role changes and access revocation. On a phone, only joining/selecting a workspace is available. The header shows a participants icon and count; tapping it opens a read-only roster. The host PC can manage roles and access from this header dialog.

The host PC stores workspaces, boards, invitations and member roles. A workspace groups selected local project folders; its boards and conversation list use those folders. Claude, Codex and Copilot remain separate AI providers inside the workspace.

<img src="images/workspace-board-mobile.png" width="340" alt="Synthetic project notes linked by a dependency on a mobile board">

## Create and join

1. Open **Work → Workspace** on the PC or a device paired as Host.
2. Enter a unique workspace name, a password of at least 10 characters, and select project folders.
3. Add a **Project board** for one of those folders.
4. Participants can use **Join a workspace** on the connection screen: host address, workspace name, display name and password. The host must be online and reachable. New password sessions start as Viewer.
5. The host assigns roles or revokes individual sessions under **Work → Members and roles**. A display name identifies the session; it is not a verified organizational identity. A fresh password login creates a new session that needs its own role assignment.

The connection screen keeps QR scanning as its primary action. Manual workspace credentials appear only after choosing workspace sign-in.

## Role on the pairing QR

In the Windows **Connection** page, choose **Role for this QR** next to the code. **Host is the initial default for testing.** Host grants management and AI execution permissions on this PC. For Viewer, Developer, Reviewer or QA, also select a workspace. Non-host choices become available after creating a workspace.

Changing the role or workspace rotates the pairing secret and replaces the QR. A previous QR can no longer establish a new connection. Existing connections keep their assigned access; changing the invitation does not silently change another user's role. The server determines the role, never a role supplied by the joining client.

| Role | Read its boards and project chats | Edit notes and dependencies | Run AI on host / manage areas and roles |
|---|---|---|---|
| Host | All permitted projects | Yes | Yes |
| Developer / Reviewer / QA | Assigned workspace | Yes | No in this initial version |
| Viewer | Assigned workspace | No | No |

Member execution is intentionally not enabled until isolated provider execution is available. An application folder filter alone cannot isolate an unrestricted AI process from the rest of a PC. The developer/reviewer/QA labels are recorded now; automatic routing and approval gates are not implemented yet.

Passwords are stored as salted scrypt hashes. Member credentials are random tokens stored only as hashes on the host. Authentication, project-file reads, chat lists and board writes are checked on the server. Revocation takes effect on subsequent requests. Workspace data stays in the private host data directory, not in the project repository. Changing a password affects future password logins; revoke existing sessions separately when needed.

Each workspace selects exactly one repository. Its boards use that repository and its chats are filtered to that folder. The host selects one repository when creating or editing the workspace; the server rejects multiple roots. Existing multi-folder workspace data is retained for compatibility rather than silently deleting boards; a folder containing a board cannot be removed.

## Visual roadmap

**The plus after the last column** opens a branch-name confirmation. The host creates a local Git branch from HEAD without checkout or push. Hold a branch heading (or right-click it on desktop) to rename the local branch; linked note/version names update across boards in that repository. Invalid or existing names, stale board revisions and repositories without a commit report an error. Remote-tracking branches cannot be renamed by this action.

Create a note with a title, description/acceptance criteria, status, priority and assignee. Its column determines its version branch: move the note to another column to change it. Dependency editing is deferred; existing stored links are preserved. Drag its handle or use the arrow keys on that handle. Pinch with two fingers or use Ctrl + mouse wheel / a trackpad pinch to zoom from 15% to 300%. Scroll or drag the canvas with one finger to move around; drag a note by its handle. There are no zoom buttons. Simultaneous edits use revisions: an outdated save reports a conflict instead of overwriting another device's changes. Reload the board and reapply that edit.

**Discuss with AI** opens the shared chat with the note and its dependencies prepared as a draft. Sending is explicit. Once the host starts the conversation, its session is linked back to the note. Subsequent opens return to that chat. The initial prompt asks for clarification and acceptance criteria before implementation. The board does not yet parse AI answers into new cards or move statuses automatically. It does not claim that a task is guaranteed correct, create pull requests, merge, or deploy.

The former Jira task list is parked while **Work** presents project boards. Existing Jira integration code and settings remain separate; opening Work does not request a Jira task list or poll its notification feed.

## People view

Switch **Board / People** to view the same tasks by assignee. Columns use workspace participants, with a separate Unassigned column; existing named assignees are retained. Each column sorts critical, high, normal, then low priority, with titles breaking ties. A task shows its title, priority, status and assignee in both views. Open it in either view to edit the shared data. Assignee IDs keep participants with matching display names separate. The chosen view is remembered per board on this device. The roster is the workspace membership list, not a synced corporate directory.

## Desktop chat

Windows now embeds the same chat component used on the phone: drafts, messages, attachments, follow-ups while a run is active, stop, approval questions, model controls, Review, results and subagents. Switching desktop sections preserves the open chat and its draft. The native bridge accepts only the explicitly allowed chat and board routes; provider sign-in and host lifecycle retain their separate native actions.

No physical Android device or multi-user deployment is implied by automated browser checks. This is the initial workspace/board foundation for a later autonomous workflow.

[Desktop guide](DESKTOP.md) · [User guide](USER_GUIDE.md)
