# Board MCP and canvas

The local stdio server uses the authenticated running Pocket Code host. Register
`node scripts/board-mcp.mjs demo=<absolute-project-root>` with an MCP client;
each argument explicitly grants access to one project alias. Use an absolute path
to the script when the client starts from another directory. The helper reads
the local host connection internally; never put connection keys in MCP arguments.

Tools: `list_boards`, `board_overview`, `search_board`, `read_board`,
`read_objects`, `read_note_context`, `focus_objects`, `create_note`, `update_note`,
`canvas_create`, `canvas_connect`, `board_create_diagram`, `canvas_apply`, `canvas_patch`,
`read_view_state`, `control_view`, `board_mcp_status`. Mutations require the current repository revision and go through
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

## Creation, diagrams and structured errors (0.28.33)

Further alignment with Miro MCP's scoped workflow, still in Pocket Code JSON and
without a Miro account:

- `search_board` filters by `query`, `kinds` (`note`, `sticky`, `text`, `frame`,
  `card`), `frameId` (objects whose centre lies inside the frame), task `status`
  and an `area`, with `limit`/`cursor` paging (`next` is `null` on the last page).
  A call needs a query or at least one filter. `read_board` accepts optional
  `limit`/`cursor` and then returns only the connections of the objects on the page.
- `canvas_create` creates objects without caller-chosen IDs: each item has a `ref`,
  the server issues UUIDs and returns `created.objects` (`ref` -> ID). Its `links`
  connect new refs or existing canvas object IDs. Prefer it over `canvas_apply`,
  which remains for explicit upserts and for compatibility.
- `canvas_connect` adds connections between existing canvas objects and returns
  their new IDs. Connections may carry `label` (1-200 characters) and `style`
  (`arrow` default, `line`, `dashed`); these fields need host 0.28.33 or newer.
- `board_create_diagram` draws a Mermaid flowchart (`flowchart`/`graph` with
  `TD|TB|BT|LR|RL`) as a frame of stickies with labelled connections and a layered
  layout. Supported: node shapes, chained edges, `-->`, `==>`, `---`, `-.->`,
  `-.-`, `-->|label|` and `-- label -->`. Subgraphs, classes and styles are
  ignored; other syntax fails with its line number. Limits: 60 nodes, 120
  connections, frames up to 6000x6000. Without `x`/`y` the diagram is placed to
  the right of existing objects. Creation context is required. It returns the
  frame ID and a Mermaid node -> object ID map.
- Failures return `{"error":{code,message,retryable,hint?,currentRevision?}}` with
  codes `revision_conflict` (retryable; includes the current revision),
  `not_found`, `invalid_input`, `invalid_diagram`, `host_too_old`,
  `unknown_project`, `no_board`, `view_unavailable`, `forbidden`,
  `host_unavailable` (retryable) and `invalid_request`.

Pocket Code still has no delete, publish or notification tools, keeps access to
explicitly configured local projects, and never stores people, assignments or chat
associations in repository boards.

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
write markers but cannot display the new inspection signals.

## Automatic refresh on board entry (0.28.12)

Opening or revisiting a local project board requests a fresh MCP worker. Ordinary
snapshot refreshes and gallery navigation do not restart it. Repeated delivery
of the same opening is idempotent. The stable stdio connection waits for an active
tool call to finish, loads the worker from the running host package, validates its
catalog and announces `notifications/tools/list_changed`. A failed replacement
keeps the previous worker and retries discovery; writes are never replayed.
Polling takes roughly one second, plus any already running operation.

New and resumed Claude, Codex and Copilot runs receive the managed server for
opened projects without changing saved provider settings. Existing conversations
and active turns are not stopped. Clients launched before the proxy was introduced
acquire it on their next new/resumed run; reopening a board cannot replace an
already running legacy provider transport. External clients must register the
proxy entry point above and support catalog-change notifications for new tools.
Disconnected hosts retain the current worker. An unsuccessful board-entry request
is shown in the board; workspace guests cannot restart the owner's MCP workers.

## Open-view control (0.28.13)

`read_view_state` discovers the current ephemeral view IDs, rendered camera
transform, selection, visible object IDs and following/busy/visible flags.
`control_view` executes `focus`, `select`, `camera`, `fit` or `follow` for one
explicit view at its current board revision. It acts immediately without a new
confirmation dialog. The interface automatically reports the resulting state;
only that report can produce `applied`. This is state verification, not screenshot
or pixel inspection. Hidden, editing, disconnected and stale views cannot report
success. Commands expire after five seconds and do not replay on board reentry.
Reuse a request ID only to retrieve the result of the exact same command; an
unconfirmed outcome requires rereading the view before deciding the next action.
Selection affects the existing per-message board attachment. View commands never
write the board file, execute arbitrary UI selectors or control desktop windows.

The small MCP status indicator reports the worker's live server catalog. Waiting
means no managed agent connection has reported yet; new/resumed board chats
acquire it. Server readiness does not establish that every provider refreshed its
cached catalog. A native Codex probe reproduced that list-change notifications
and a queued configuration reload did not refresh its loaded catalog. Board entry
therefore requests a fresh Codex client after all its active turns finish; the
next run resumes the same saved thread with a fresh MCP catalog. No active turn
is interrupted, and unrelated project entries do not request this refresh.
See the [Codex app-server protocol](https://learn.chatgpt.com/docs/app-server).
External clients remain responsible for their own transport/catalog lifecycle.

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

## Health, repair, charts and compact results (0.28.41)

- A write returns the new revision and only the objects that changed (`changed`,
  `removed`, `totals`), with long text cut and its full length stated. Read
  complete objects with `read_objects` or `read_note_context`.
- `read_board` answers a large board with a summary (descriptions cut to 400
  characters, their lengths stated) unless `detail: "full"` is passed; paging with
  `limit`/`cursor` still returns complete objects.
- `board_health` lists every record outside the format (card ID, field, limit,
  actual value, the automatic fix), warnings for records above 90% of a limit and
  the format limits. `board_overview` and `list_boards` include the error and
  warning counts.
- A board with format errors is readable but refuses writes with the code
  `board_needs_repair` and the list of problems. `repair_board` fixes them without
  losing text (removed text goes to `project-boards/history`) and returns the new
  revision; `board_unrepairable` means a person has to decide.
- A refused write carries the explanation of the host: `invalid_input` names the
  card, the field, the limit and the value; `board_too_large` reports the file
  size. Nothing is saved in either case.
- `update_note` and `create_note` accept a description of up to 200,000
  characters; the host moves the older paragraphs beyond 20,000 to
  `project-boards/history/card-<id>.md`. `checklist` holds acceptance criteria
  (`[{text, done}]`, up to 50). The host records status changes; `statusHistory`
  is returned and cannot be set.
- `board_create_chart` draws a bar chart from `categories` and `series` (one value
  per category, `null` for a missing one), with optional `unit`, `stacked`,
  `lowerIsBetter`, a `reference` line and `near` to place it beside an object and
  connect it. `board_update_chart` changes the stored data; `setSeries` adds or
  replaces one series by name. `canvas_create`, `canvas_apply` and `canvas_patch`
  accept the `chart` kind as well. Charts need a host that reports the `charts`
  board feature in its health reply.
