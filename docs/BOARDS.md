# Repository boards and Miro

[Documentation](README.md) · [Russian guide](USER_GUIDE.ru.md#boards)

## Create and open

Board lists one board per repository. Projects without a board are omitted until **Add project board** creates one. Creation writes an example board to the chosen repository; customize its notes and planned version columns. It does not create real Git branches automatically.

Existing curated files retain their IDs. The canonical filename takes precedence; otherwise the first valid board filename is used. See [file selection and schema](../project-boards/README.md). A repository read failure is shown explicitly rather than silently creating a replacement board.

## Edit a note

Use **+ Note** in the board header, the **+** beside a column heading (the note starts at the bottom of that column), or long-press empty canvas (right-click on Windows) and choose **Create note**. An empty board shows **Create note** in the middle. The note opens as a sheet with a fixed header and **Cancel / Save** footer; **Note** holds the fields and **Agent** holds task runs. Back, Escape or the close button ask before discarding unsaved changes. Fill a title, description/acceptance criteria, status and priority. Images support PNG/JPEG/WebP, up to twelve per note and 10 MB each. Open a thumbnail for zoom.

Drag the handle to move a note, or move it without dragging: pick a **Version** in the note, or choose **Move to version…** from the card menu; the note goes to the bottom of that column. The target version column highlights while dragging; its placement determines the version label. Set grid spacing to 8, 12, 16, 24, 32 or 64 under Appearance. The visual grid and placement use the same step; existing positions are preserved until moved. Pinch or use Ctrl+wheel to zoom (there is no floating zoom bar over the canvas); pan on empty space. The board re-reads its file when the app returns to the foreground; **Refresh board** stays available on phones. Keyboard arrows on the drag handle also move the note.

Use the plus after the final column to add a planned version. Hold its name to rename it. A version heading explicitly says which real Git branch is linked, or that none is linked. A planned version name alone is not a branch. Connections between notes are retained in dependency IDs for AI planning and are not drawn as arrows.

Long-press or right-click a note for its menu: **Open**, **Move to version…**, **Prepare task** and, last, **Delete…** with confirmation. References to the deleted note are removed from remaining dependencies; unrelated notes and shared image files remain. Long-press or right-click a board card for **Open** and **Delete…** (removes the board or disconnects Miro); the Delete key still opens the confirmation directly. The repository, Git history and unrelated files are preserved.

## Saving and Git

Repository boards use `pocket-code-board` version 1 JSON in `project-boards/`. Images are content-addressed files under `project-boards/assets/`. Commit the board and referenced assets together after reviewing them. Saving in the app writes files with revision checks; it does not commit, push or resolve Git conflicts. Refresh rejects/reloads stale data before retrying an edit.

Only product information belongs in portable boards: ideas, criteria, statuses, priorities, positions, versions and dependency IDs. Do not put people, assignments, private messages, accounts, credentials or connection details in Git. Boards open directly on their canvas, without a People view, participant list or assignment controls. Legacy private membership data remains outside the portable file.

## AI workflow

Claude, Codex and Copilot receive a shared contract: discover rules/skills, inspect existing board cards, read relevant changelog history, verify against code, maintain the same card for authorized work, and record actual validation. A model can still fail to follow instructions; the contract is not a technical guarantee.

The Rules switch disables automatic board maintenance for that repository. It does not disable read-only continuity or native rules. A missing board stays missing until creation is requested. Dependencies do not authorize implementation or assignment. See [shared board rules](../project-boards/README.md).

**Unreleased:** a saved note's Implementation section prepares an isolated task chat.
The same run links the source card, Git working copy, diff, checks and human approval.
See the [task pipeline](TASK-PIPELINE.md). Private execution state stays on the PC;
it is not written into portable board JSON.

## Miro

In **Settings → Miro**, select the project and paste its normal board URL. The Board card opens Miro Live Embed with Miro's interface. Sign in to Miro and use its own access controls; Pocket Code cannot grant access. Invite/query parameters are stripped from saved links. Links are private host configuration, not portable Git content.

Use **Open in browser** if embedded authentication, cookies or WebView capabilities block access. Disconnect removes the local link, never the board in Miro. An existing repository board is preserved and reappears after disconnecting. Embedding alone does not import notes, synchronize dependencies or give AI tools access to the board. Miro needs an internet connection.

**Unreleased:** [Miro AI access](MIRO-AI.md) adds a separate PC OAuth/token setup with
per-project read and write switches. AI can read the linked board and update existing
sticky notes, text and cards. The iframe's login and API authorization remain separate.

The retired WorkSpace UI is described in [compatibility notes](WORKSPACES.md); it is not required for repository boards.

## Board health, repair and rollback (unreleased)

A board file is read record by record. A record outside the format no longer keeps
the board from opening: every readable card and object is shown, the damaged ones
are outlined and marked, and a panel above the canvas names each problem with the
card, the field, the limit and the actual value. A board with such errors is
read-only until it is repaired, so nothing is overwritten by accident. Warnings
(a description above 90% of its limit, a file close to its size limit) do not block
editing.

**Repair** brings every record back inside the format without losing text: an
over-long description, title or caption is shortened and the removed text is
appended word for word to `project-boards/history/card-<id>.md` (or
`history/board-repair.md` for records without a card); a value outside the allowed
set, such as priority `medium`, becomes the nearest allowed value; references to
missing cards are removed and recorded. Problems that cannot be fixed without a
decision, such as an object type from a newer Pocket Code, are listed and left
alone. Repair and rollback belong to the PC host.

The host keeps private copies of each repository board outside the repository: the
last good content whenever it changes, and the previous content before every
repair or restore. If a direct file edit leaves invalid JSON, the board shows the
last good cards read-only next to the reason, and **Restore…** puts a saved
snapshot back; the replaced file is kept as one more copy, so a restore can be
undone. Up to 20 good and 5 damaged copies are kept per board.

Every write through the app, the board MCP or the host API is validated. A refused
write names the card, the field, the limit and the value, and the file stays
untouched. A card description may exceed 20,000 characters on input: the host
keeps the task statement, the creation context and the newest paragraphs in the
card, moves the older paragraphs to the card history file and leaves a pointer.

The title and description of a card are stored once, in its task record; its
canvas object keeps geometry and a readable title. Older files that repeat the
description on the canvas still open and are rewritten in the compact form on the
next save.

## Charts, checklist, status history and search (unreleased)

Right-click empty canvas and choose **Chart** to add a bar chart, or let an agent
create one with `board_create_chart`. The board stores the numbers; the host draws
them. Series are grouped side by side or stacked, a reference line marks a target
such as 16.7 ms, and a chart with two series shows the change of the second
against the first under each category, coloured by whether lower or higher is
better. Double-click a chart to edit its data as a table; a table copied from a
spreadsheet can be pasted in. A chart holds up to 8 series and 40 categories.
Hover a bar for its exact value.

**Card properties** has an acceptance checklist (up to 50 criteria). The card shows
how many are met. The host records every status change with its time; the card
shows how long it has been in its current status and the properties sheet lists
the history. A client cannot rewrite that history.

**Find on board** (the magnifier in the canvas toolbar, or Ctrl+F) searches the
text of cards, stickies, frames and charts, optionally limited to one card status.
Matches are outlined; Enter and Shift+Enter move the camera to the next and
previous match.

Charts, checklists and status history are new fields of the version 1 format.
A host older than this release refuses a file that contains them; update the PC
host before opening such a board elsewhere.

## Board chat panel (unreleased)

On the PC the chat beside a board is a compact panel: a one-line header, message
bubbles across the panel width and a tight composer. Its header has two visible
buttons: **New board chat** starts a fresh conversation for the board, and
**Close board chat** hides the panel; the Chat button in the board header brings
the same conversation back. The context menu of the title keeps the remaining
actions.

The PC remembers which chat is the current discussion of a board. The desktop
window and every phone therefore resume the same conversation, and a discussion
opened from the chat list becomes the chat of the board instead of leaving two
histories. Starting a new board chat on one device replaces it for the others the
next time they open the board chat. The association stays private host data and is
never written to the repository board.

## Speed (unreleased)

Opening, panning, zooming and editing a large board are faster; measurements and
the way to repeat them are in [performance](PERFORMANCE.md#board-canvas-and-host-unreleased).
Image previews are kept on the device after they are made once, so reopening a
board does not download every original again.
