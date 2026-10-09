# Pocket Code product board

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

Board assignments and clarification requests are private host data. The notification bell on Windows and mobile shows only the signed-in participant's inbox; opening a task marks that notification read. The board UI has no participant or assignment controls. For compatible legacy live boards, AI can use the bundled `scripts/board-cli.mjs` helper to list live boards/people, assign an existing participant or ask a specific question. This does not invite new members or bypass host approval. Notifications poll while the app is running; operating-system background delivery is not included in this board inbox.

Only projects with an existing board appear in the board list. Add project board explicitly creates an optional board in the chosen repository. Each project has one displayed board. If no file exists, Create project board writes `board-00000000-0000-4000-8000-000000000001.json`. An existing curated file is reused. If several legacy files exist, the canonical filename takes precedence; otherwise the first valid filename in alphabetical order is used. Other files are preserved. Private legacy records remain on the host; notifications can still open their original notes.

Built-in board maintenance is enabled by default for all three providers. Rules exposes a per-project switch, persisted as the product-only `.pocket-code-rules.json`. It applies to the next run and does not disable provider-native AGENTS.md/CLAUDE.md files. Authorized implementation includes maintaining an existing board and a categorized version changelog; a missing board is created only on explicit request; read-only questions do not create files. Version columns explicitly identify linked Git branches; planned version labels are not Git links.

Dependencies are retained as AI planning metadata in note IDs. The board does not draw dependency or version connector lines.

Notes may include `images: [{path, caption}]` (up to 12). Upload PNG, JPEG or WebP
files up to 10 MB in Note details; select a thumbnail to zoom. Images are stored
under `project-boards/assets/<sha256>.<extension>` alongside the JSON and must
travel with it. Removing a note attachment removes its reference, preserving
shared files. Existing notes without images remain valid. Review captions and
image contents before sharing a repository; pixel privacy cannot be inferred
from a filename. Old hosts need updating to read this extended format.

`versionBranches` maps version labels to real Git branch names. Branches recorded
in the changelog are resolved against local and remote Git refs automatically and
retained on the next board save. Missing branches remain explicitly unlinked.
Every release must record its branch and exact commit; planned columns alone
never create branches or authorize publication.
