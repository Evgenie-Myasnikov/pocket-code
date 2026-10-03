# WorkSpace, Connection and local boards

| Section | QR on the PC | What it opens |
| --- | --- | --- |
| Connection | Settings → Connection | Your trusted personal PC, AI chats and local boards |
| WorkSpace | An expanded WorkSpace card | That workspace's shared boards |

These are independent connections. Chats stay personal. A workspace invitation does not expose personal chats or local boards.

## Create and join

On Windows, use **WorkSpace → Create workspace**, with a name, password and one repository. Expand its card to see participants and their names; the PC host manages roles and revokes access here. **Open board** shows its project boards.

Choose a connection method and invitation role, then **Generate joining QR**. The QR explicitly shows **Local**, **Tailscale** or **Internet**. Each workspace has its own invitation. Replacing it expires that QR but does not revoke existing members. On Android, use **WorkSpace → Scan QR code**. Phones cannot create/manage workspaces, roles, invitations or participants.

Connection has a separate QR and device list. Use it only for your own trusted devices. New invitations default to Developer. Only the PC owner is Host; membership alone does not grant PC administration or use of the host's AI account.

## Identity

Both first and last name are required when entering a workspace. An already saved complete profile is reused. Rename yourself with the pencil beside your own participant entry. A phone already paired through Connection at the same PC address uses that person's profile and does not ask again if both fields are present; otherwise it asks for the missing profile. An independent workspace phone enters its own name. These are display profiles, not verified organizational identities.

Cards show the initial avatar followed by the name. On notes, the round **+** adds people; the small **×** removes them. People view shows the same note for each assigned person and orders tasks by priority.

## Local boards and examples

Windows **Board → Local boards** shows boards outside workspace membership. Your trusted phone can open them under **WorkSpace → Local boards** after Connection pairing. Workspace members cannot read them.

The local **Pocket Code** board reads the latest six versions from the repository's CHANGELOG.md. Refresh reloads the file. Published entries are marked Done; changes without a recorded publication are Review. This generated view is read-only. Untouched older examples migrate automatically; user-edited boards are preserved.

New boards include six editable examples covering Idea, Questions, Ready, Working, Review and Done. Written labels accompany different colors and border treatments. New versions are **planned**: adding or renaming them does not create, rename, check out or push Git branches. Arrows show their sequence. Existing boards explicitly using Git retain their earlier branch behavior.

## Navigation and editing

Drag a note by its handle. Its destination column highlights and the note stays within that column after release. Columns determine versions. Keyboard left/right changes columns; up/down changes vertical position. On desktop, drag empty canvas or use the middle mouse button to pan. On phones, scroll with one finger. Pinch or Ctrl + wheel changes zoom; there are no zoom buttons. Revision conflicts require reloading and reapplying the change.

## Offline and settings

The phone opens without a PC. Previously loaded catalogs and boards are cached locally and can be read after an outage or restart, marked by an offline banner. Offline editing/queued synchronization are not supported. AI and live updates require the host. Caches are credential-scoped. Known revocation clears the connection cache; **Disconnect and forget** clears cached board data.

Settings have category screens. Windows AI accounts and limits have provider submenus; startup/tray, appearance, updates and About are separate. Android AI settings separate account, access and new-chat folder.

Choose a project inside a new desktop chat. Existing chats keep their project, and shared boards do not filter the personal conversation list. **Discuss with AI** prepares a host chat draft; sending is explicit. Automated assignment, approval gates, PRs and deployment remain future work. Ordinary workspace members cannot run the host's provider account. Jira remains a separate integration.

[Desktop guide](DESKTOP.md) · [User guide](USER_GUIDE.md)

## Joining requests and removal

New independent members scan a WorkSpace QR, enter their name, and wait for approval on the host PC. Open WorkSpace, expand the workspace card, and approve or decline each request. Only approved members can read its boards. Existing members keep their access after upgrading. A trusted phone paired to its own host uses the existing host identity.

Use **Remove member** to revoke workspace access. The next server request rejects the old key and clears the local workspace cache; an offline device may still hold previously downloaded data until it reconnects. Rejoining requires a new approval. Mobile users switch previously joined workspaces in the header; the number at the right opens the participant list. Personal chats are cached separately and do not belong to a shared workspace.

## Deleting boards and workspaces

On the PC, expand a workspace card and use **Delete workspace**, or open a board and use **Delete board** in its header. Confirm the named item before removal. Workspace removal deletes its boards and revokes memberships and invitations. Repository files and Git branches are not deleted. Removing the generated Pocket Code board hides it persistently. These actions are not available from the phone.

Desktop chat supports Ctrl+C and Ctrl+V. Ctrl+A selects the draft when editing, or the current conversation when focus is outside a field. Pasting outside a field in an open chat focuses its composer.

## Sharing board content in Git

On the PC, open a board and use **Save to repository**. It writes `project-boards/board-<id>.json`, containing only the board name, versions, ideas/feature text, status, priority, positions and dependency links. It omits people, assignments, roles, workspace credentials, chat references and local paths. Known participant names, email addresses and common credential patterns in card text block export; review free text before committing because automatic detection is incomplete. Commit and push explicitly with your Git tools. Another clone can use **Import board**, which creates a separate local board. Import does not overwrite live collaboration state.

The checked-in [Pocket Code board](../project-boards/README.md) is curated from CHANGELOG.md. Git stores intentional snapshots; the host remains responsible for live synchronization. Conflicting snapshots require normal Git conflict resolution.

Board assignments and clarification requests are private host data. The notification bell on Windows and mobile shows only the signed-in participant's inbox; opening a task marks that notification read. Approved participants can be assigned from the board. AI can use the bundled `scripts/board-cli.mjs` helper to list live boards/people, assign an existing participant or ask a specific question. This does not invite new members or bypass host approval. Notifications poll while the app is running; operating-system background delivery is not included in this board inbox.

Personal chats follow the **Connection PC**, not the selected WorkSpace. Switching shared boards keeps the current chat. Connecting to a different PC isolates sessions, drafts and cached history, even when session IDs match. The selected conversation is restored when returning to that PC during the same app session. A WorkSpace QR alone does not grant access to that PC's personal chats.
