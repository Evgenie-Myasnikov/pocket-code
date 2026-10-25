# Pocket Code product board

The board UI uses one canvas. Existing task records are shown as cards with their
original IDs, text, status, versions, attachments and agent actions. Visual links
remain separate from task dependency metadata. Right-click empty space (or use the keyboard context-menu key)
to create a card, sticky, text or frame. Double-click an object to type in place;
Ctrl+Enter or leaving the editor saves, Escape cancels. Drag an edge/corner to
resize. Drag empty canvas with the left mouse button to select an area; Shift adds to the selection. Drag the middle mouse button anywhere to pan. Drag a selected object to move the group. Ctrl/Cmd+A selects all; Ctrl/Cmd+C and Ctrl/Cmd+V copy and paste within the open board; Delete/Backspace removes selected objects. Copy, paste and delete are also in the context menu. Copies keep product card metadata and internal links/dependencies, with new IDs. A frame can be moved by its label; its empty interior supports area selection. Touch panning and pinch zoom remain available. Approach a side midpoint to reveal its connection port, then hold briefly and drag to another midpoint port. A short click does not start a connection. Select a line and hold either endpoint to detach and reconnect it; a detached endpoint may stay free on the canvas. Escape restores its original attachment. Dropping a new connection elsewhere cancels it. Free endpoints require host 0.28.4+. Lines use sharp orthogonal elbows; keyboard connections also require the destination port. Undo, redo and fit are the persistent
canvas controls; pinch and Ctrl+wheel zoom the view. The chat entry is an icon.
Malformed legacy references block editing rather than silently discarding links.
Canvas card records require the updated host; older hosts reject the new kind.

Open **Board** and select this project. Its board is read directly from `board-7b004a10-920c-4ba7-a070-254318083e90.json`, without importing a private copy.

The board records delivered capabilities by version and explicit follow-up work. **Done** means the capability is recorded in a published changelog entry; **Review** identifies the current release's implementation awaiting final release validation. **Ready** and **Questions** remain unfinished. Follow-up is not a release commitment.

Maintain stable note IDs, move a card instead of duplicating it, and link only actual dependencies. Update evidence in descriptions when a status changes. Keep CHANGELOG.md as the detailed validation/publication record. Mark physical device checks complete only after they are actually performed.

Only product ideas, feature descriptions, statuses, priorities, version columns, positions and dependency IDs belong here. Never add names, assignments, participant accounts, private chats, credentials, device information or local machine paths. Export checks catch known names and common sensitive patterns, but authors must still review free text before committing.

Git carries product snapshots, not private collaboration events. Editing writes the project file with a revision check. Saving does not commit or push. A stale edit is rejected and must be refreshed before retrying.

Unreleased task runs link a saved note to a private host chat, isolated Git working copy,
checks and snapshot approval. Runtime records never belong in this JSON. Card status
remains product planning; execution stages do not silently rewrite it. See the
[task workflow](../docs/TASK-PIPELINE.md) and [Miro AI access](../docs/MIRO-AI.md).

Interactive Claude, Codex and Copilot chats receive built-in board guidance from `server/board-instructions.ts`: discover the portable board, clarify ideas, preserve IDs and update relevant cards with evidence. New and resumed runs receive the guidance; already-running turns adopt it on their next run after the host is updated. Unsaved live boards are not exposed through these file instructions.

Board assignments and clarification requests are private host data. The activity inbox shows chat runs and their latest available image. Legacy assignment notifications are retained privately on the host but are not displayed in this inbox. The board UI has no participant or assignment controls. For compatible legacy live boards, AI can use the bundled `scripts/board-cli.mjs` helper to list live boards/people, assign an existing participant or ask a specific question. This does not invite new members or bypass host approval. Notifications poll while the app is running; operating-system background delivery is not included in this board inbox.

Only projects with an existing board appear in the board list. Add project board explicitly creates an optional board in the chosen repository. Each project has one displayed board. If no file exists, Create project board writes `board-00000000-0000-4000-8000-000000000001.json`. An existing curated file is reused. If several legacy files exist, the canonical filename takes precedence; otherwise the first valid filename in alphabetical order is used. Other files are preserved. Private legacy records remain on the host; the activity inbox does not display these assignment records.

Built-in board maintenance is enabled by default for all three providers. Rules exposes a per-project switch, persisted as the product-only `.pocket-code-rules.json`. It applies to the next run and does not disable provider-native AGENTS.md/CLAUDE.md files. Authorized implementation includes maintaining an existing board and a categorized version changelog; a missing board is created only on explicit request; read-only questions do not create files. Version columns explicitly identify linked Git branches; planned version labels are not Git links.

Dependencies are retained as AI planning metadata in note IDs. The board does not draw dependency or version connector lines.

Notes may include `images: [{path, caption}]` (up to 12). Upload PNG, JPEG or WebP
files up to 10 MB in Note details; select a thumbnail to zoom. Images are stored
under `project-boards/assets/<sha256>.<extension>` alongside the JSON and must
travel with it. Removing a note attachment removes its reference, preserving
shared files. Existing notes without images remain valid. Review captions and
image contents before sharing a repository; pixel privacy cannot be inferred
from a filename. Old hosts need updating to read this extended format.

Board image cards show client-generated thumbnails up to 256 px. Initial reads still download originals through a shared two-task queue; repeated references share a bounded thumbnail cache, and off-screen URLs are released. The viewer loads full resolution separately.

`versionBranches` maps version labels to real Git branch names. Branches recorded
in the changelog are resolved against local and remote Git refs automatically and
retained on the next board save. Missing branches remain explicitly unlinked.
Every release must record its branch and exact commit; planned columns alone
never create branches or authorize publication.
