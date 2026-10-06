# Repository boards and Miro

[Documentation](README.md) · [Russian guide](USER_GUIDE.ru.md#boards)

## Create and open

Board lists one board per repository. Projects without a board are omitted until **Add project board** creates one. Creation writes an example board to the chosen repository; customize its notes and planned version columns. It does not create real Git branches automatically.

Existing curated files retain their IDs. The canonical filename takes precedence; otherwise the first valid board filename is used. See [file selection and schema](../project-boards/README.md). A repository read failure is shown explicitly rather than silently creating a replacement board.

## Edit a note

Long-press empty canvas or right-click it on Windows, then choose **Create note**. Fill a title, description/acceptance criteria, status and priority. Images support PNG/JPEG/WebP, up to twelve per note and 10 MB each. Open a thumbnail for zoom.

Drag the handle to move a note. The target version column highlights; its placement determines the version label. Set grid spacing to 8, 12, 16, 24, 32 or 64 under Appearance. The visual grid and placement use the same step; existing positions are preserved until moved. Pinch or use Ctrl+wheel to zoom; pan on empty space. Keyboard arrows on the drag handle also move the note.

Use the plus after the final column to add a planned version. Hold its name to rename it. A version heading explicitly says which real Git branch is linked, or that none is linked. A planned version name alone is not a branch. Connections between notes are retained in dependency IDs for AI planning and are not drawn as arrows.

Right-click a note for deletion with confirmation. References to the deleted note are removed from remaining dependencies; unrelated notes and shared image files remain. Right-click a board card to remove the board or disconnect Miro. The repository, Git history and unrelated files are preserved.

## Saving and Git

Repository boards use `pocket-code-board` version 1 JSON in `project-boards/`. Images are content-addressed files under `project-boards/assets/`. Commit the board and referenced assets together after reviewing them. Saving in the app writes files with revision checks; it does not commit, push or resolve Git conflicts. Refresh rejects/reloads stale data before retrying an edit.

Only product information belongs in portable boards: ideas, criteria, statuses, priorities, positions, versions and dependency IDs. Do not put people, assignments, private messages, accounts, credentials or connection details in Git. Compatible legacy live host boards keep private participant and inbox information outside the portable file; the People view is useful only where that private data exists.

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
