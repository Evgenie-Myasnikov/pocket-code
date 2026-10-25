# Board MCP and canvas

The local stdio server uses the authenticated running Pocket Code host. Register
`node scripts/board-mcp.mjs demo=<absolute-project-root>` with an MCP client;
each argument explicitly grants access to one project alias. Use an absolute path
to the script when the client starts from another directory. The helper reads
the local host connection internally; never put connection keys in MCP arguments.

Tools: `list_boards`, `board_overview`, `search_board`, `read_board`,
`read_objects`, `read_note_context`, `focus_objects`, `create_note`, `update_note`,
`canvas_apply`, `canvas_patch`. Mutations require the current repository revision and go through
the same host validation and write lock as the UI. There are no deletion,
publication or notification tools. Canvas writes refuse hosts older than 0.28.0.

The portable `pocket-code-board` version 1 format now accepts an optional `canvas`
with `version: 1`, `items` and `links`. Existing task-only files are unchanged.
Older hosts must be updated before opening boards saved with canvas data. This
is a Pocket Code format; Miro RTB import/export is not implemented.

Canvas supports sticky notes, text, frames, resizing, Shift-click selection,
group movement, arrows, pan, zoom and undo/redo within the current view. Moving a
frame includes objects fully contained inside it. Task dependencies remain separate.
Undo is not a cross-session history. The board file is saved after each operation.

Board Chat retains a conversation per board. The current card/area selection is
attached separately to each message; clearing selection removes that attachment
from subsequent messages. On desktop, board and chat stay visible together;
narrow windows stack the panes. Snapshots must be reread before an edit.

## Scoped operations and visible AI activity (0.28.11)

The workflow borrows Miro MCP's search → scoped read → stable-ID patch pattern;
it uses Pocket Code JSON, not Miro SVG, and requires no Miro account or connection.
Start with `board_overview` for a section index or `search_board` for a known clue.
Use `read_objects` for complete selected objects and their attached connections,
or `read_note_context` for a card's full context and dependency summaries.
`canvas_patch` changes only supplied fields of existing objects, preserves omitted
fields, rejects missing IDs and cannot change an object's type. `canvas_apply`
remains the explicit full-object upsert for creation and connections. All writes
require the freshly read revision; conflicts require rereading and reconciliation.
New cards/stickies still require creation context. Dependencies are not visual links.

`focus_objects` signals inspection of existing IDs at a current revision without
changing the board. It returns whether the host accepted the activity; this does
not prove a viewer is open or following. Scoped reads signal actual inspection.
Writes signal editing, saved or failed, with affected IDs, operation type and
bounded product geometry. No accounts, conversations or artificial keystrokes
are sent. A failed save is marked failed, never shown as a successful edit.

An open canvas shows one AI cursor, an operation label and target highlights.
Its camera follows the latest target. Pointer gestures, wheel scrolling and canvas
keyboard actions pause following; the compact AI control resumes it. Inline
editing, menus and hidden views suspend camera motion. Reduced-motion uses an
immediate focus. Fast event batches highlight their affected objects and display
the newest actual operation; they are not replayed as fabricated typing.

The authenticated live endpoint holds a read for up to one second and wakes it
when MCP activity arrives. Each viewer has its own event cursor; history is
bounded to 64 events per board and expires after eight seconds. Ordinary file
changes refresh within roughly one second without AI attribution. Local drafts
block snapshot application, and stale saves remain protected by revisions.
Disconnected/older hosts fall back to snapshot reads. Old hosts may accept legacy
write markers but cannot display the new inspection signals. Restart the MCP
client session after upgrading to load the new tool catalog; active sessions are
not restarted by a release.

This is operation presence and saved-state synchronization. Shared unsaved edits,
per-character remote typing and undo of another participant's changes are not
implemented.

The shared skill is `.agents/skills/pocket-board/SKILL.md`. Its workflow uses
scoped reading and revision-safe edits. Related official references:
[Miro AI skills](https://github.com/miroapp/miro-ai) and
[Miro MCP](https://developers.miro.com/docs/miro-mcp).

Custom providers in this release use an OpenAI-compatible endpoint with `/models`
and `/chat/completions`. Catalog entries are fetched from the provider; profiles
and history stay in the local encrypted host store. This is text API chat, with
no project file tools or coding-agent execution. External account access is not
implied by a model appearing in the catalog.
