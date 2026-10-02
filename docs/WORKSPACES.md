# Workspaces and project boards

A workspace shares a board for one repository. Chats are personal: choosing or joining a board does not filter, reset or share the host's provider conversations. Workspace members cannot read the host's chat history or run its AI in this version. Host access is a trusted full-access role, not a restricted member account.

## Create and join

1. On the host PC, open **Board ? Workspace** and create an area for one repository. Creation and member administration are only available on the PC.
2. Use the single **Create board** button. The header shows the workspace name and participant count; inside a board, **Board / People** switches views in the header.
3. Open **Connection** on the PC and share its QR. The workspace is attached to the invitation; there is no workspace switcher in the app. Creating a new workspace rotates the QR. Existing paired devices keep their workspace.
4. Scan the QR on the phone and enter your name. The name is separate from your role, including Host. It is saved on the PC for that workspace and connection.
5. The header participant count opens the roster. The desktop host can manage member roles and revoke access there.

An older phone connection without a workspace binding needs a fresh QR scan. There are no manual workspace login fields on the connection screen. The legacy password endpoint remains for compatibility.

## Participants on notes

Use the round **+** at the bottom of a note to find and attach participants. Each avatar uses the first letter of the person's name and a stable, randomly distributed color derived from its ID. Remove a person with the small **?** at the avatar's upper-right corner. Multiple people can share a note; People view shows that same note under each assignee. Unassigned notes have their own column. Old single-person assignments remain readable.

## Roles and privacy

The PC chooses the invitation role beside the QR. Host remains the default for testing and grants full access to the host's provider account; only give it to trusted users. Developer, Reviewer and QA members can edit their board. Viewer members can read it. Membership alone does not grant the host's personal conversations. Links to the host's chats are omitted from member board responses.

Provider execution for ordinary members is not yet enabled: it needs separate provider accounts and process isolation. Automatic AI task routing and approval gates are not implemented yet. Display names identify sessions, not verified organizational identities. Member credentials are random tokens stored as hashes; private workspace data is stored outside the public repository.

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
