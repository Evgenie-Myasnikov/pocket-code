# Pocket Code product board

Open `board-7b004a10-920c-4ba7-a070-254318083e90.json` with Pocket Code's **Import board** action, or open the generated **Pocket Code** board in this repository. The generated view reads this curated file before falling back to CHANGELOG.md.

The board records delivered capabilities by version and explicit follow-up work. **Done** means the capability is recorded in a published changelog entry; **Review** identifies the current release's implementation awaiting final release validation. **Ready** and **Questions** remain unfinished. Follow-up is not a release commitment.

Maintain stable note IDs, move a card instead of duplicating it, and link only actual dependencies. Update evidence in descriptions when a status changes. Keep CHANGELOG.md as the detailed validation/publication record. Mark physical device checks complete only after they are actually performed.

Only product ideas, feature descriptions, statuses, priorities, version columns, positions and dependency IDs belong here. Never add names, assignments, participant accounts, private chats, credentials, device information or local machine paths. Export checks catch known names and common sensitive patterns, but authors must still review free text before committing.

Git carries deliberate snapshots, not live collaboration events. Save/export does not commit or push. Import creates a separate local board and does not overwrite another board. Conflicts must be reviewed through the normal Git workflow.

Interactive Claude, Codex and Copilot chats receive built-in board guidance from `server/board-instructions.ts`: discover the portable board, clarify ideas, preserve IDs and update relevant cards with evidence. New and resumed runs receive the guidance; already-running turns adopt it on their next run after the host is updated. Unsaved live boards are not exposed through these file instructions.

Board assignments and clarification requests are private host data. The notification bell on Windows and mobile shows only the signed-in participant's inbox; opening a task marks that notification read. Approved participants can be assigned from the board. AI can use the bundled `scripts/board-cli.mjs` helper to list live boards/people, assign an existing participant or ask a specific question. This does not invite new members or bypass host approval. Notifications poll while the app is running; operating-system background delivery is not included in this board inbox.
