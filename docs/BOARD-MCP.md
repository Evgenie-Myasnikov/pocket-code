# Board MCP and canvas

The local stdio server uses the authenticated running Pocket Code host. Register
`node scripts/board-mcp.mjs demo=<absolute-project-root>` with an MCP client;
each argument explicitly grants access to one project alias. Use an absolute path
to the script when the client starts from another directory. The helper reads
the local host connection internally; never put connection keys in MCP arguments.

Tools: `list_boards`, `read_board`, `search_board`, `create_note`, `update_note`,
`canvas_apply`. Mutations require the current repository revision and go through
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

Discuss board and Discuss selection prepare a chat with a bounded product
snapshot, attached as a text file on the first send. The user sends the draft. On desktop, board and chat stay visible together;
narrow windows stack the panes. The context is not a live subscription and must
be reread before an edit. AI cursor presence and realtime collaborative canvas
operations remain follow-up work.

The shared skill is `.agents/skills/pocket-board/SKILL.md`. Its workflow uses
scoped reading and revision-safe edits. Related official references:
[Miro AI skills](https://github.com/miroapp/miro-ai) and
[Miro MCP](https://developers.miro.com/docs/miro-mcp).

Custom providers in this release use an OpenAI-compatible endpoint with `/models`
and `/chat/completions`. Catalog entries are fetched from the provider; profiles
and history stay in the local encrypted host store. This is text API chat, with
no project file tools or coding-agent execution. External account access is not
implied by a model appearing in the catalog.
