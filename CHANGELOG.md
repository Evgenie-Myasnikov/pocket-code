# Changelog

## [0.29.0](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.67...v0.29.0) (2026-11-24)

Published [0.29.0](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.29.0) from [fe1bf61](https://github.com/Evgenie-Myasnikov/pocket-code/commit/fe1bf61114f9faac5b2b09ba608ec2bb0401a810) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows package, update manifest) match the local build by SHA-256; the APK is signed with the release certificate, and the unpacked APK and Windows package contain no private names, addresses or local paths.

### Validation

- Server and unit tests from PowerShell: 632 tests, 628 passed, 1 skipped, 3 failed, the same three as on earlier releases (the compatibility trigger, the checked-in board identity check and the host packager check).
- Browser scenarios on Edge: 49 passed in one run across the scheduled tasks, motion and smooth text (answer, reasoning), the token line, chat folders and plan chats, the side panel and file changes, the live file write, activity groups, settings and the board passed in separate runs of this release; the full browser suite was not run.
- Not checked: the installed Windows application, a real scheduled run with a provider and the removal of its earlier run chats, a real provider answer with the smoothing, a phone.

### Features

- Reasoning and written code write themselves (2026-11-24). A reasoning and the code of a file being written are written word by word over the same smoothing window as the answer, and their newest characters (the last 360 of a reasoning, the last 160 of code) are drawn one by one: each comes down a little from above into its place while it fades in, with a small delay inside a batch. Older text is plain; reduced motion shows it at once.
  - Validation: a browser scenario (a reasoning that arrives whole grows in steps, ends complete, and its characters are boxes with the "comes down and fades in" animation) passed; the live file write scenario, which failed on the last releases because the received code appeared in one piece, passes now, after its old wording of the token line was updated.
- Plan chats keep only the latest run (2026-11-24). A plan chat opens from its row in the rail as a chat that holds only its latest run, named by the task and the time of that run (for example "Weekday morning brief · 09:00"), and nothing can be written to it. Runs are no longer chats of the Chats list. When the next run has its chat, the chat of the run before it is removed from the provider and forgotten, so older runs are not there; a chat that cannot be removed yet stays hidden and is tried again with the next run. Deleting a task removes the chat of its latest run too.
  - Validation: a server test (the older run is removed once the next run has a chat, a failed removal is retried with the next run, a deleted task removes them all) and the scheduled tasks browser scenario (the run opens named by task and time, the message field is disabled) passed. Removing a real provider chat after a real scheduled run was not checked.

## [0.28.67](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.66...v0.28.67) (2026-11-24)

Published [0.28.67](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.67) from [ac24ede](https://github.com/Evgenie-Myasnikov/pocket-code/commit/ac24edec0320172a3eb300df1a1c25d563dd76d6) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows package, update manifest) match the local build by SHA-256; the APK is signed with the release certificate, and the unpacked APK and Windows package contain no private names, addresses or local paths.

### Validation

- Unit tests: 4 for smooth text and 3 for the token speed passed. A full run of npm test was not repeated for this release (last on 0.28.65; its results are recorded there).
- Browser scenarios on Edge: about 40 passed across smooth text and its setting, the token line, plan chats, folders and their moving, scheduled tasks, the side panel, file changes, the turn result, code highlighting, questions, the read file card, transcript rhythm, action lines, settings scroll, the board and the Tasks provider menu.
- Still failing, also on 0.28.66 without these changes: the live file write check in `tests/chat-code-change.spec.ts` (intermediate frames of received code), plus the failures recorded earlier.
- Not checked: the installed Windows application, a real provider answer with the smoothing, a phone, the full browser suite.

### Features

- Smooth text (2026-11-24). Text that arrives in chunks, or a whole block at once, is no longer written into the chat in one piece. What is waiting is spread over a window set in Appearance → Smooth text (Off, 0.3 s, 0.5 s by default, 1 s): it appears word by word, evenly, and every received word is in the chat at most that long after the last chunk arrived; a new block starts from nothing. A word fades in with a short rise and a trace of blur. Words are never shown half-written, reduced motion shows text at once, and a chat opened mid-answer shows what is written without replaying it.
  - Validation: 4 unit tests (word stops, even reveal over the window, a chunk moving the end of the window, Off) and a browser scenario (a block that arrives whole grows in steps and is complete when the window ends; Off shows the next one at once) passed; the Appearance scenario checks the setting.
- Token line always on (2026-11-24). The line under the message field is always shown, with a zero or a dash until a value is known. The speed is the average of the last 100 updates of the chat's generated tokens, measured by the window itself (a pause of several seconds is not measured across and a new turn starts from its own count); until two updates are seen it shows the provider's speed for the last reply. The "current reply" and "last reply" captions are gone.
  - Validation: 3 unit tests (average, gaps and new turns, only the last 100) and the token line browser scenarios (updated for the line that is always there) passed.
- Plan chats and moving folders (2026-11-24). The rail block of scheduled chats is called "Plan chats" ("Плановые чаты" in Russian). It no longer says that there are none: an empty block is a small lighter area, a step above the rail, and its tasks sit on that area. A folder is held with the mouse and dropped where it should stand among the other folders and the chats outside folders; its place is kept. A right click on the list no longer makes a folder; the new folder icon beside Chats does.
  - Validation: the folder scenario holds a folder, drops it between chats, reloads and returns it to the top, and checks that a right click makes no folder; the scheduled tasks scenario checks the name and the lighter area (13 scenarios together passed); a screenshot of the rail was checked.

## [0.28.66](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.65...v0.28.66) (2026-11-24)

Published [0.28.66](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.66) from [25bd4e2](https://github.com/Evgenie-Myasnikov/pocket-code/commit/25bd4e2e84c633e3f54def03c788b5213ad78f65) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows package, update manifest) match the local build by SHA-256; the APK is signed with the release certificate, and the unpacked APK and Windows package contain no private names, addresses or local paths.

### Validation

- Browser scenarios on Edge: 20 passed together (scheduled tasks, chat folders, the flat chat list, the side panel, the follow-up composer and board point chats), after being updated for the new headings and menu; the earlier 36-scenario run of 0.28.65 covered the rest, and a screenshot of the rail was checked.
- Server and unit tests: not rerun for this interface-only change (last full results on 0.28.65).
- Not checked: the installed Windows application, a phone, the full browser suite.

### Features

- Rail as in Strata (2026-11-24). The PC rail is two blocks, each with a quiet heading and its icons on the right of that heading: Scheduled (collapsible, with its own "+" for a new scheduled task and a line while there are none) above Chats (with the new folder icon). The second icon beside New folder is gone, and the chat row menu no longer moves a chat into a folder or makes a folder with it; chats still go into a folder and back by dragging.
  - Validation: the scheduled tasks, chat folders, flat chat list and side panel browser scenarios (20 together) passed after being updated for the new headings and menu.

## [0.28.65](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.64...v0.28.65) (2026-11-24)

Published [0.28.65](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.65) from [906c678](https://github.com/Evgenie-Myasnikov/pocket-code/commit/906c678d41d79c1ae85be8bdf19cfb8471aef54e) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows package, update manifest) match the local build by SHA-256; the APK is signed with the release certificate, and the unpacked APK and Windows package contain no private names, addresses or local paths.

### Validation

- Server and unit tests from PowerShell: a full run gave 624 tests, 615 passed, 1 skipped, 8 failed: the three known ones and five from this release (turn totals compared with the new per-file lines, two colour literals in the file changes styles, four new Russian strings without English); those were fixed and their files pass. A second full run stopped printing after the Codex limits tests, as on 0.28.63, and was ended.
- Browser scenarios on Edge: 36 passed together across scheduled chats, chat folders and the flat chat list, the side panel and file changes, the turn result, the read file card, answered questions, motion, the new chat placeholder, settings scroll, the board, the Tasks provider menu, transcript rhythm, the token line and fonts.
- Not checked: the installed Windows application (the windowed desktop smoke test), a real scheduled run with a provider, a phone, the full browser suite.

### Features

- Motion as in Strata (2026-11-24). Every transcript message rises in when it appears (6 px, 240 ms), a tool card from 8 px over 320 ms, and a blinking accent caret follows the text that is still being written, as Strata does. Before, only blocks that arrived during a streamed turn moved, so a chat whose provider sends whole blocks showed no motion at all.
  - Validation: 2 new browser scenarios (the caret follows only the text being written and every message rises in; a finished chat has no caret) passed with the transcript, token line, side panel and turn result scenarios.
- Carbon in black and white (2026-11-24). The default Carbon theme has no green: a near-black chat on a slightly lighter frame, grey lines and text, and a light grey accent, as in assistant-ui; the light mode is white with a near-black accent. The swatch matches.
  - Validation: the palette contrast and design token tests passed.
- Scheduled chats (2026-11-24). As with Claude's scheduled tasks, a task on the PC holds a prompt, a provider and model (the same menu as the chat header), a working folder and a schedule: every day at a time, weekdays at a time, or every N hours. The PC host starts a new chat with the prompt at each time until the task is deleted, and each run is an ordinary chat in the chat list. Tasks are listed above the chats with a clock and a dot while a run is unread; opening a task opens its latest run. Its "…" menu pauses or resumes, edits, runs now and deletes it. Schedules are stored on the host and survive a restart; a run missed while the PC was off starts once at the next start, not once per missed time, and a resumed task does not catch up. Runs use the default access mode, so an agent that needs permission waits for it in its chat. The Windows window allows the new `/scheduled-tasks` reads and writes (0.28.65+ host).
  - Validation: 9 new server tests passed (next run time for daily, weekdays and every N hours; a missed run starts once after a restart; delete and pause stop runs; run now keeps the schedule; the API creates, runs a new chat, edits and deletes through the host). 3 new browser scenarios on Edge passed (create from the chat list with the header model menu, the clock and unread dot opening the latest run, the "…" menu pausing, running now, editing and deleting). The shell rules were checked by compiling DesktopWindow.cs with the DesktopSmoke.cs checks; the full windowed smoke test, the installed Windows application and a real scheduled provider run were not checked.

### Bug Fixes

- What changed in a file (2026-11-24). The turn result listed changed files with sizes only, and a file opened from it showed the whole file, so it was not clear what changed or where. Each file now has its own added and removed counts, and opens in the side panel on its changes: added and removed lines in colour with unchanged lines around them, every edit of that file in the turn, and a File switch to the whole file.
  - Validation: the side panel and turn result browser scenarios check the counts, the changes view and the switch.
- Read file card (2026-11-24). An opened "Read" line showed the reader's fields (path, offset, limit), the file text with the reader's line numbers in a large font, a nested frame and a sideways scrollbar. It now shows the full path as one muted line and the file's first 12 lines as an ordinary code block of the chat, with the rest on request; the reader's notes to the model are left out.
  - Validation: a new browser scenario passed.
- Folders in the chat list (2026-11-24). A folder looked like one more chat: the chat-row rule hid its chevron, folder icon and count. They are shown again, the folder stands a little apart, and its chats hang from a thin guide line. A right click on an empty spot of the list makes a folder there: below every chat it goes after the last one, in a gap between chats it goes between them; the place is kept.
  - Validation: the folder scenario checks the icons, count and guide line; a new scenario checks the place of a new folder and that it survives a reload.
- Answered questions (2026-11-24). A question the agent asked showed its raw fields (a JSON list of options) and the provider's reply text. It now shows the question, its choices with the chosen one marked, and the answer.
  - Validation: a new browser scenario (Claude's answer format) passed.
- Chat outline (2026-11-24). The frame around the chat and the side panel was the colour of the panel lines and almost invisible on the window background; it is a clear step lighter now.
  - Validation: the side panel scenario checks that the outline differs from the window background.

## [0.28.64](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.63...v0.28.64) (2026-11-24)

Published [0.28.64](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.64) from [69e10e7](https://github.com/Evgenie-Myasnikov/pocket-code/commit/69e10e71f2809d112f059dc1f5b75244598711af) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows package, update manifest) match the local build by SHA-256; the APK is signed with the release certificate, and the unpacked APK and Windows package contain no private names, addresses or local paths.

### Validation

- Browser scenarios on Edge: 8 passed (the new settings scroll scenario, side panel, settings rows, transcript rhythm).
- Not run for this CSS-only fix: the server and unit tests (last run on 0.28.63), the full browser suite, the installed Windows application, a phone.

### Bug Fixes

- Settings scroll (2026-11-24). In 0.28.63 the chat frame clipped the window area, so Settings and other long pages did not scroll; the framed area scrolls vertically again.
  - Validation: a new browser scenario (a long Appearance page scrolls with the wheel to Reset appearance) fails on 0.28.63 and passes now, with the side panel, settings rows and transcript rhythm scenarios.

## [0.28.63](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.62...v0.28.63) (2026-11-24)

Published [0.28.63](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.63) from [5616a1b](https://github.com/Evgenie-Myasnikov/pocket-code/commit/5616a1bc736d03d9c570f7eb0364a73d59a184b2) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows package, update manifest) match the local build by SHA-256; the APK is signed with the release certificate, and the unpacked APK and Windows package contain no private names, addresses or local paths.

### Validation

- Server and unit tests from PowerShell: 615 tests, 611 passed, 1 skipped, 3 failed, the same three as on earlier releases. A first run stopped printing after the Codex limits tests and was ended after 20 minutes; the second run finished.
- Browser scenarios on Edge: 31 passed across the new chat placeholder, side panel and its drag speed, transcript rhythm, font, motion, token line, board and board selection, flat chat list, follow-up composer, board point chats and the Tasks provider menu.
- Still failing, also on 0.28.62 without these changes: "codex saved chats reopen from cache without another health gate or stale navigation", "Codex keeps expanded beginning pages while reading and refreshes on Latest" and "a provider whose sign-in is still being checked takes the message and starts the turn once it is confirmed" time out.
- Not checked: the installed Windows application, a phone, the full browser suite.

### Features

- Motion after Strata (2026-11-24). A streamed answer fades in word by word as it arrives (Streamdown's own fadeIn, 240 ms, ease-out, never ahead of the text); saved text appears at once. New transcript blocks rise in over 240 ms by 6 px with Strata's ease-out curve, and the turn result card, the model menu, the folder chip and the side panel (sliding in from the right) enter the same way. Reduced motion turns all of it off.
  - Validation: 2 browser scenarios on Edge (word animation and its timing during a running turn; none with reduced motion) passed with the transcript, side panel, turn result, code highlighting and chat list scenarios.
- Token line while a turn runs (2026-11-24). Until the provider reports the current turn, the line keeps the chat's total tokens and the last reply's speed from the saved record of the last turn, labelled "last reply"; the provider's numbers for the current turn replace them as they arrive. A speed is never estimated from text length. For API connections the saved record no longer brings back Claude Code's guessed context window.
  - Validation: the token line browser spec was updated to the 0.28.61 wording (it still expected the old one) and a new scenario for a running turn passed.
- Chat frame (2026-11-24). The chat and the docked side panel are framed cards with a 1 px outline and rounded corners on the window background, as in Strata. Dragging the side panel's edge measures the width from the panel's own right side, so it no longer creeps by the frame's margin on each click.
  - Validation: the side panel browser scenario now checks the frame instead of the old background difference and passed with the drag speed scenario.

### Bug Fixes

- New chat without the history placeholder (2026-11-24). Sending the first message of a new chat no longer flashes the history skeleton or moves the message bubble: the chat view stays mounted while the new chat gets its saved id, and the placeholder shows only for a saved chat with nothing yet to show.
  - Validation: a new browser scenario watches the whole open for the placeholder and passed.
- Carbon swatch (2026-11-24). The Carbon theme swatch in Appearance shows the theme's own Strata colours.
- Board selection (2026-11-24). Selecting the whole board (Ctrl+A or a selection frame) outlines every object but shows resize handles only when one object is selected, so a large board no longer turns into a grid of handles.
  - Validation: a new board browser scenario passed with the board and selection scenarios.

## [0.28.62](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.61...v0.28.62) (2026-11-24)

Published [0.28.62](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.62) from [72f4f26](https://github.com/Evgenie-Myasnikov/pocket-code/commit/72f4f26a00d43f1f8c4ec7ef823a4e352b49acd4) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows application, update manifest) match the local SHA-256 hashes. The privacy guard passed on the commit, and the unpacked assets were searched for the local home path, account name, employer name, author e-mail, keys and tokens without findings (the public repository owner appears only in release links). The APK is signed with the same key as 0.28.61 (certificate SHA-256 beginning d0e5792c). Built from a separate clean checkout of the same commit. Physical Android installation, the installed Windows application and the full browser suite were not run.

### Validation

- Server and unit tests from PowerShell: 615 tests, 611 passed, 1 skipped, 3 failed, the same three as on earlier releases.
- Browser scenarios on Edge: 32 passed across the chat list and folders, settings rows (including the updated providers page scenario), the local model, font, transcript rhythm, side panel drag speed, side panel, turn result, code highlighting, action lines, the step editor and the Tasks provider menu.
- Tasks also chooses the provider and model with the chat header menu, and an empty chat list no longer says "No chats yet" (1 new scenario).
- Removed with their entry points (Create chain, Import Markdown and Plan with AI left the Tasks page in 0.28.60): the browser specs of the chain planner, the Markdown task batch and the Markdown task editor, and the Markdown import scenario of the step navigation spec. The step editor scenario now starts from Create Task.
- Still failing, also on 0.28.59: the step navigation scenario "a step opens in its assigned provider and links back to the original chain" does not find the link back to the chain after opening the step chat.
- Not checked: the installed Windows application, a phone, the full browser suite.

### Bug Fixes

- Context share of a local model (2026-11-24). A chat through an API connection showed Claude Code's guess of a 1,000,000-token context window for a model name it does not know, so the share of the context under the message field was wrong. The window now comes from what Pocket Code knows: the context the local Strata model was started with; for other API connections, and after a host restart, no window and no share are shown.
  - Validation: 1 test of the real Jobs view (a known 32K window replaces the guess; an unknown one removes it) passed.
- Real local model check (2026-11-24). On this PC, through the running Pocket Code 0.28.61 server (the requests the PC window sends; the window itself passes them from this version on): Strata 0.1.65 found both downloaded models; Coder IQ1_M started at a 32K context in about 30 s on port 18600 without the Strata window; Pocket Code saved the connection "Strata · coder-iq1_m" with its model; a chat turn through it answered "pong" in 9 s (about 4 tokens/s); the model stopped and freed the GPU. The run exposed the context window guess fixed above. Starting from the button in the installed window was not checked.

### Features

- Chat names (2026-11-24). After the first turn of a chat started in Pocket Code, the chat's own provider (with its model, or the API connection and its first model) names it in 2 to 6 words from the first message, through the same isolated, tool-less runtime as the task editor. A name the person gave is kept; a busy, failing or too long answer leaves the provider's own summary. This costs one short request to that provider per new chat.
  - Validation: 2 unit tests (the title is cleaned of quotes, a final period and extra lines; an API connection uses its own model; a busy, failing, unavailable or over-long answer gives no title) passed. A real provider naming a chat was not run.
- Font (2026-11-24). Appearance has a Font row for the interface and the chat: VS Code's fonts (the default), Golos Text, Manrope, the system font, or any installed font by its family name (only letters, digits, spaces, dots and hyphens are kept).
  - Validation: 1 browser scenario on Edge (the default is Segoe UI, Manrope applies at once, an installed font name survives a reload and loses CSS punctuation) passed.
- Chat list rows are 34 px high in the PC window, also on PCs with a touch screen, where a touch rule made them 48 px.

### Performance

- Side panel resize (2026-11-24). Dragging the side panel edge sets the width once per frame, and transcript blocks and lines of the open file outside the view are not laid out until they scroll in. On a synthetic chat of 120 command and answer pairs with a 300-section changelog open, the worst frame while dragging went from 83 ms (8 frames over 50 ms) to 35–49 ms (none over 50 ms) in headless Edge; a new browser scenario keeps the worst frame under 90 ms. The installed window was not measured.

### Bug Fixes

- Windows window (2026-11-24). The installed PC window refused the requests added in 0.28.60 and 0.28.61 with "This desktop request is not allowed": the local model panel and the header's local models, Import chats and the file sizes of a turn result. The Windows shell passes only listed endpoints to the PC server; `/local-models` (read) and `/local-models/start`, `/local-models/stop`, `/chat-library/import`, `/file-sizes` (write) are now listed. The browser tests replace that bridge and allow every endpoint, so they could not catch it.
  - Validation: a small program compiled with the shell's C# 5 compiler against `desktop/DesktopWindow.cs` confirmed the five endpoints are allowed, local model actions are writes only, an extra path segment and an unrelated write stay blocked, and an existing read is still allowed. The same checks were added to `tests/DesktopSmoke.cs`; on this PC that smoke test stops earlier at its window minimise check, before any endpoint check. The installed application was not checked.

### Changes

- Settings → Providers (2026-11-24). Usage limits and Custom providers are plain rows like the rest of Settings: one card, rows separated by thin lines, no inner rounded boxes, no glassy background and no accent bar on the selected row.
  - Usage limits: one row per provider with its tightest window, the reset time and when it was checked, the remaining share on the right and a refresh button. The separate "Claude usage limits" block under the rows is gone. Values come only from each provider's usage API; a failed or missing read shows "No data", never a percentage.
  - Custom providers: each provider and "Add custom provider" is a row with a chevron that opens its page.
  - Validation: `tests/settings-rows.spec.ts`, 5 browser scenarios on Edge, passed, including a new one that finds no inner frame, background image or inset shadow in both cards and reads a synthetic usage value with its check time. The 4 local-model scenarios passed, and the chat-list-flat scenario "all providers are on one settings page", failing since 0.28.60 on the old `.provider-section` count, now checks the cards and passes. TypeScript and the design token, translation and palette contrast checks passed. Not checked in the installed Windows application.

- Appearance (2026-11-24). The colour-blind colours switch is removed at the product owner's request; a saved choice no longer applies.

## [0.28.61](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.60...v0.28.61) (2026-11-24)

Published [0.28.61](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.61) from [91603ca](https://github.com/Evgenie-Myasnikov/pocket-code/commit/91603cabef2f2b4682ee0ad6e04396bef9e5deda) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows application, update manifest) match the local SHA-256 hashes. The privacy guard passed on the commit, and the unpacked assets were searched for the local home path, account name, employer name, author e-mail, keys and tokens without findings (the public repository owner appears only in release links). The APK is signed with the same key as 0.28.60 (certificate SHA-256 beginning d0e5792c). Built from a separate clean checkout of the same commit. Physical Android installation, the installed Windows application and the full browser suite were not run.

### Features

- Space between blocks (2026-11-24). Appearance has a Space between blocks setting: Tight (0 px), Normal (4 px, the default) and Roomy (10 px) between action lines, answer paragraphs and results. Before, every answer reserved a hidden 40 px row of buttons and the transcript added its own margins, so blocks were about 70 px apart.
- PC window look after Strata (2026-11-24).
  - Colours: the Carbon theme takes Strata's values (dark: background #0e1113, panels #161a1d and #1d2226, borders #2a3036, text #eef1f3, grey #8e979f, accent #34d399; light from Strata's light tokens). The icon strip, the chat list, the chat header and the side panel are panels a step lighter than the chat, which is the one dark field between them, and the person's own message is a bubble in the accent colour.
  - Fonts: the fonts of VS Code, which are system fonts (Segoe UI and Consolas on Windows; San Francisco and Menlo on macOS; Ubuntu and Droid Sans Mono on Linux), for the interface, the chat and code. Strata's own font (GT Walsheim Pro) is commercial and is not included. A chat font saved as Golos moves to the new default.
  - Transcript: commands, edits, groups of actions and subagents are one quiet grey line in the text's own size, starting at the text's edge with the chevron after the words (an older rule shifted parts of a line by 4 px and gave every action row a 48 px minimum height). The copy and retry buttons take room only under the last answer and appear on hover elsewhere. The standard line spacing is 1.6 instead of 1.85; a saved Standard follows it.
  - Header: the chat's name on the left without a plate, a borderless model chip and a thin line under the header. The chat list selection is a flat tone without the accent edge, and New chat is a plain icon without a green frame.
  - Validation: a new browser scenario measures that action lines and answer text start at the same pixel, share one size and are 4 px apart by default (10 px with Roomy); the side panel scenario checks the foreground colours; activity, turn result, code highlighting and chat list scenarios passed on Edge. TypeScript passed. Server and unit tests from PowerShell: 612 tests, 608 passed, 1 skipped, 3 failed, the same three as on earlier releases; the grey of light Carbon is #636363 instead of Strata's #6f6f6f so that it keeps a 4.5:1 contrast on its panels. Screens were compared with Strata screenshots by eye only.

### Bug Fixes

- File sizes in the turn result (2026-11-24). 0.28.60 asked the PC for file sizes with a directory-only path check, so every size came back empty and no size was shown. Sizes now come from files inside the chat's folder; files outside it stay without a size. Found on the running 0.28.60 host, where existing files returned none; the server test that covers it had not been run before the release and passes now.

### Features

- Code highlighting (2026-11-24). Fenced code in answers and files in the side panel are coloured with [Shiki](https://shiki.style) 4.6.0 (MIT): the TextMate grammars and the Dark+ / Light+ themes of VS Code, about 200 languages including HLSL, GLSL, WGSL and ShaderLab. A language's grammar loads only when it is first shown (HLSL 7 KB, GLSL 4 KB), with Shiki's JavaScript regex engine instead of WebAssembly; tokens are drawn as React elements, so file text never becomes HTML. Text over 300,000 characters or 8,000 lines stays plain.
  - Validation: 1 browser scenario on Edge (a GLSL block in an answer and an HLSL file in the side panel are coloured with several colours; the text is unchanged) passed; TypeScript and the production build passed. Grammars other than HLSL, GLSL and the ones in the scenario were not looked at.
- Turn result proportions after Strata (2026-11-24). The result card spans the chat column; rows use the text font and one height; the folder row reads "Delivered to **folder**" with a short Open button; file rows show type, name, folder and size.
  - Validation: the turn result and side panel scenarios on Edge passed after the folder label change.
- Side panel width (2026-11-24). The left edge of the chat's side panel drags like a splitter, as in Strata; arrow keys move it by 16 px (64 with Shift) and a double click returns it to half of the chat area. The chat keeps at least 360 px and the panel at least 320 px; the width is remembered in this PC window.
  - Validation: the side panel browser scenario on Edge now also drags the edge, checks the remembered width and the reset; it passed. TypeScript passed.
- Local model in the chat header (2026-11-24). The provider and model menu of a new chat lists the local Strata models of the PC with their state. A downloaded model starts with one click, without the Strata window and with the context and drafting last chosen in Settings (128K and auto by default); when it is ready the chat switches to its connection. A running model is chosen or stopped from the same menu. The model's connection is no longer repeated under API connections.
  - The last menu item opens Settings → Providers, where API connections are added and the local model is configured. The old Custom providers dialog with its separate API chat is no longer opened from the chat header (phones still use it from their provider picker).
  - Chats keep their provider: a started chat changes only its model, because each provider keeps its own conversation and cannot resume another provider's. Moving a chat between providers was discussed and not taken up.
  - Validation: 1 new browser scenario on Edge (start from the menu with the saved choice, the chat switching to the model's connection, stop, and Settings → Providers from the menu) passed with the 3 earlier local model scenarios and the updated header menu scenario; TypeScript passed. A real Strata start from the menu was not run.
- Settings after Strata, details and follow-up (2026-11-24). The cards-of-rows settings that went out in 0.28.60 cover every section of the PC window. A group is a small heading and one rounded card; a row is a bold name with at most one short muted line on the left and its control on the right, at one width and on one edge. Rare explanations open from a "?" button next to the row name.
  - Connection and startup: Phone access (the switch, the PC host and internet tunnel status, Connect through the internet, Keep the PC awake), a pairing card (the QR, the address choice, the timer and the Android app QR as one row), Connected devices with its explanation behind "?", and Windows application (Start with Windows, Restart the local server after a failure). The "Step 1/2" labels and the paragraphs under the switches are gone.
  - Providers: one card per provider with Installation, Server, Account (sign-in state, Switch account, Sign out with its confirmation; sign-in methods as buttons when signed out), Agent access as a select with the consequence of the chosen mode, and Claude's spend limit as a select with Other for a typed amount. Usage limits are one card for all providers instead of a copy under each provider. Custom providers and the local model (Strata) are cards of rows. All values still come from the provider status, the provider usage reads and the saved device defaults.
  - Updates: Pocket Code version with Check for updates and the automatic update switch; Claude Code on this PC as a row. Chat: Enter sends, the approval wait, Keyboard shortcuts, and Read aloud (engine, voice, voices on the PC). Board: grid step and Jira in one card, Miro (project, link, connect or change) and AI access to Miro (sign-in, read and write switches, access check, app setup and app token opened from their rows). Appearance & language: Language and Appearance cards. Notifications: two switches.
  - The phone settings keep their layout; only the PC window uses the rows.
  - Fixes after 0.28.60: a PC without Strata shows the install hint as a line in a card again, without an empty Local model section; the Version row falls back to the app's own version when the Windows shell does not report one. Import chats sits in its own Chat list card in Settings → Chat.
  - Validation: `tests/settings-rows.spec.ts`, 4 browser scenarios on Edge (every section is cards of rows with right-aligned controls, no step labels and no visible hint over 120 characters; connection switches call the PC shell and the devices explanation opens from "?"; provider access and spend limit selects save device defaults, sign-out keeps its confirmation, Device code starts Codex sign-in; the Chat list card offers Import chats and imports nothing on its own) passed. The 3 local-model scenarios passed. TypeScript passed. Desktop settings scenarios in `desktop-ui.spec.ts` that look for the former "AI accounts" navigation failed on 0.28.59 as well. `npm test` from PowerShell: 612 tests, 606 passed, 1 skipped, 5 failed: the 3 known ones and 2 caused by other uncommitted work (font weights in `activity-quiet.css` and `strata-shell.css`, light Carbon contrast). Screenshots were taken from the synthetic desktop fixture only. Not checked: the installed Windows application and a real provider sign-in.

## [0.28.60](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.59...v0.28.60) (2026-11-24)

Published [0.28.60](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.60) from [8597581](https://github.com/Evgenie-Myasnikov/pocket-code/commit/85975815d236feb8daff90910cba9f0351a041ea) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows application, update manifest) match the local SHA-256 hashes. The privacy guard passed on the commit, and the unpacked assets were searched for the local home path, account name, employer name, author e-mail, keys and tokens without findings (the public repository owner appears only in release links). The APK is signed with the same key as 0.28.59 (certificate SHA-256 beginning d0e5792c), so it installs over it. The release was built from a separate clean checkout of the same commit while another session kept editing the main one. Physical Android installation, the installed Windows application and the full browser suite were not run.

### Bug Fixes

- Deleting a chat (2026-11-24). In the PC chat list, "…" → Delete removes the chat at once, without a dialog: the row leaves the list and the PC server erases the provider transcript and the Pocket Code cache. A refusal (a running turn, a chat of a running task chain, a provider error) puts the chat back and shows the reason above the chat.
  - Cause of the slow deletion: every delete read all of the provider's chats again (a full Codex archive scan). A single delete now decides from the saved listing and reads the provider again only when the chat is not in it.
  - Cause of "Chat unavailable in this account": Codex lists chats whose folder is outside the shared projects as read-only, and erasing refused every read-only chat. By the product owner's decision the PC window now erases those transcripts too; the provider deletes only its own transcript and no project file is touched. Phones and workspace guests keep the earlier refusal.

### Features

- Chat list (2026-11-24). Folders are back as folders the person makes: create and name one, move chats into it from the row menu or by dragging, collapse it, rename and delete it (its chats return to the list). Folders, like pins, belong to this PC window.
  - The list holds the chats started in Pocket Code. Chats Pocket Code finished a turn in before this version are marked once from its saved run records. Chats that exist only in Claude, Codex or Copilot join the list with Import chats in Settings (`POST /api/chat-library/import`); a chat made in Pocket Code keeps that mark when it is imported again.
- Chat header and side panel after Strata (2026-11-24). The header shows the chat's name and a provider and model chip whose menu groups the providers, the API connections with the local model, the models of the chosen provider from its own catalog, and Manage API models; a chat that has started keeps its provider. The composer keeps access mode and effort; a new chat shows its folder as a chip above the message field; the token line under it shows speed of the last reply, total tokens and the share of the context, only from provider data.
  - Removed from the header: the dots menu with Review, Results, Subagents, the branch, Reading mode, Go to beginning and Brief/Detailed, and the Rules and Changelog buttons of the rail. Rules and Changelog of the chat's folder are header buttons shown only when the folder has them. The Home button of the rail is removed.
  - Files a turn made or changed are listed at the end of the turn with their type (a thumbnail for pictures), name, folder and size; a file opens as a tab of a side panel beside the chat with refresh, full screen and collapse, while the chat stays usable. Strata's interface has no license file, so none of its code was copied; the behaviour was rebuilt.
- Rules (2026-11-24). The Rules page is the list of rule files: the board maintenance switch, reader chips, the legend and the "What the agent sees" block are removed. The built-in board maintenance stays on by default.
- Tasks (2026-11-24). The Tasks page has one Create Task button that opens the step-by-step editor; Create chain, Import Markdown and Plan with AI are removed from it. The task folder picker is "Working folder" and accepts any folder the AI works in.
- Transcript (2026-11-24). The welcome block of a new chat is removed. Results that only confirm success ("File created successfully at …") and the rows of the agent host's own bookkeeping tools are not shown.
- Settings after Strata (2026-11-24). Settings sections are headings with rounded cards of rows: a name and one short line on the left, the control on the right, without long hints. Prepared in a parallel session; see its own notes for details.

### Validation

- Published at the product owner's request without waiting for the full test runs. TypeScript passed on the release tree.
- Browser scenarios on Edge, passed: chat delete without a dialog, a refused delete coming back with its reason, folders (create, name, move by menu and by drag, collapse, survive reload, rename, delete); the side panel with file tabs from the turn result; the turn result card; chats on the board.
- Server and unit tests: the first full `npm test` from PowerShell had 13 failures of 611: the 3 known on the previous release and 10 tests whose fixtures expected every provider chat in the list. Those fixtures now list every provider chat explicitly; the 10 tests, 2 new tests (chat origins with Import chats and file sizes; quiet tool rows) passed when run on their own. The second full run had not finished when the release was cut.
- Not run: the full browser suite, the header model menu scenario, the settings scenarios of the parallel session, a phone, the installed Windows application, and a real provider turn.

## [0.28.59](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.58...v0.28.59) (2026-11-24)

Published [0.28.59](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.59) from [beb7443](https://github.com/Evgenie-Myasnikov/pocket-code/commit/beb74438176aef5332a51222a7fd537c72bc31b1) on [feature/strata-like-ui](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/strata-like-ui). The tag points to that commit and all four public downloads (APK, PC host bundle, Windows application, update manifest) match the local SHA-256 hashes. The privacy guard passed on the commit, and the unpacked assets were scanned for the local home path, account name, author identity, employer name, keys and tokens without findings. The APK is signed with the same key as 0.28.58 (certificate SHA-256 beginning d0e5792c), so it installs over 0.28.58. Earlier releases came from release/0.28.1; this one comes from feature/strata-like-ui, which contains release/0.28.1 and the three commits of this version. Physical Android installation, the installed Windows application and the full browser suite were not run.

### Features

- Chats on the board (2026-11-24). A board conversation starts from a point of the canvas (Chat here in the canvas menu, Chat about this on an object) and opens as a window pinned to that point, with the application's own chat inside. It takes up to four nearest cards as context and sends them with each message as the board selection; a card can be detached or shown on the board. The window collapses to a pin and can be removed from the board, while the conversation stays in the chat list. Point chats are stored on this installation only, not in the board file.
  - The side chat of the board is removed at the person's request: the Chat action in the board header, opening it from the gallery, and attaching or dragging gallery images into it.
  - Validation: 1 unit test for choosing the nearest cards and 1 browser scenario on Edge (start at a point, attached card, pan with the board, collapse, reload, detach, remove) passed. Sending a message from a point chat to a real provider was not checked. Browser scenarios written for the removed side chat (board chat layout, panel, conversation and image selection specs) were not updated and are expected to fail where they open that chat.

- Board canvas on React Flow (2026-11-24). The project board is drawn with React Flow 12 (`@xyflow/react`, MIT) instead of the hand-written canvas; the board file, the card sheet, the gallery, live updates, AI activity with camera following and MCP view control are unchanged.
  - Cards, notes, text, frames and charts use the neutral panel style of the Carbon theme: thin borders, no shadows, the chosen colour as a thin edge. Card images stay. Nothing scrolls inside a card: content that does not fit is clipped and the wheel over a card pans the board.
  - New card in the toolbar and Card in the canvas menu ask for one prompt; the selected provider drafts the description and the title through the existing `/api/task-text/improve`, and Without AI makes the card from the typed text.
  - Boards with more than 120 objects render only the objects on screen. On a synthetic board of 500 cards and 974 connections 20 cards were in the page at 1440x900, and thirty wheel steps rendered card metadata 19 times.
  - Not ported yet: a connection that ends at a free point can be shown and deleted but not created or re-attached; arrow-key moves, keyboard-only port connection and the touch long-press for a new note.
  - Validation: 5 new browser scenarios for the canvas passed on Edge. Of the earlier board scenarios that go through the Boards section, 33 pass on the new canvas after six specs were pointed at the new viewport element and two scenarios were rewritten (no scrolling inside a card; a real wheel instead of a synthetic event); 5 fail the same way as on the earlier canvas (three phone and launch scenarios in the image selection spec, two legacy-record scenarios). The specs of the earlier canvas component were not run against the new one. A phone and the installed application were not checked.

- Task chains (2026-11-24). Tasks → Create chain → Build step by step opens a short editor: each step is an instruction and a model; the chain is named after its first step. A chain can repeat in a loop: after the last step it starts again from the first one with the result of the previous lap.
  - A loop always ends: the last step confirms the stop condition, the lap limit is reached (2–20, default 3), a lap in a Git project committed nothing, a step fails, a step does not confirm its result after 3 retries, or Stop chain is pressed. The chain list and the chain view show the current lap and why the loop stopped; the final review diff covers every lap.
  - Chats of earlier laps stay task chats: they are not in the general chat list and open from their step under Previous attempts until the chain is deleted.
  - Validation: 8 new server tests for the loop and 1 new browser scenario on Edge passed together with 14 neighbouring task scenarios; TypeScript passed. Server tests from PowerShell: 607 tests, 603 passed, 1 skipped, 3 failed, the same three as before this change. A loop with a real provider and the installed application were not checked.

- Simpler PC window (2026-11-24). The sidebar is one list of chats.
  - The app name, the provider picker, the project filter and the folder groups are gone from the sidebar. Chats of Claude, Codex and Copilot are in one list, newest first, with the time on the right. The first 30 are drawn; "Show more chats" adds the next 30.
  - A row's "…" menu is Rename, Pin, Archive, Delete. Pinned chats lead the list and archived ones move to an "Archived" section at its end. Pins and the archive are kept in this PC window only: the PC server and phones do not know about them. Muting stays on the row's bell.
  - The provider is chosen inside a new chat, next to the message field. A chat of another provider opens straight from the list.
  - Themes: Carbon (new default: neutral near-black panels, grey borders, a light accent), Emerald, Graphite, Slate and Ink. The ten colour palettes are removed; a saved removed palette becomes Carbon. Menus and cards are opaque with a thin border.
  - Removed from the chat: the animated background with its 17 styles and settings, glass panels with blur, the fade at the chat edges, and the paced "reveal" of streamed text with its speed setting. Text appears as it arrives.
  - The transcript follows a streamed answer through the assistant-ui viewport instead of the app's own animated follower. Scrolling back stops the following; "Jump to latest messages" resumes it.
  - Settings: the section list is plain rows; Appearance is theme, mode, size and colour-blind colours; all providers are on one page.
- Local model (2026-11-24). Settings → Providers on the PC can start and stop a local [Strata](https://github.com/Niko1221/Strata) model without the Strata window, which on the test PC used about 1 GB of RAM (its embedded browser, Node and PowerShell helpers) while the model server itself is the same. Choose an installed model, the context (32K–256K) and the drafting mode; the panel shows the state and the server address.
  - The PC server calls Strata's own command line (`strata launch --no-tui`, `--status`, `--stop`, `models list`, JSON output) through its bundled `python.exe`, without `cmd.exe` or a shell. A start is refused while the Strata app already runs a model on the GPU, while another Strata model runs, or when the model would first download files.
  - The server listens on 127.0.0.1 only and requires an API key generated once by the PC server, stored encrypted like other provider keys and handed to Strata through an environment variable, never on the command line. The running server is saved as one custom provider, `Strata · <model>`, updated in place on later starts, so it serves chats and, through Strata's Anthropic-compatible API, Claude Code tasks.
  - The key is hexadecimal: in two real starts a base64url key (with `-` and `_`) made the Strata engine stop while loading (cuBLAS status 14); the same starts with a hexadecimal key loaded normally. The cause inside Strata was not investigated.
  - Only the host manages the model; workspace guests get 403. Phone controls and starting a model together with Pocket Code are not included.

### Validation

- 0.28.59 release checks (2026-11-24), on the commit that joins the simpler PC window, the local model, the board canvas, chats on the board and task chains: TypeScript, the production web build and the documentation link check passed. Server and unit tests from PowerShell: 609 tests, 604 passed, 1 skipped, 4 failed; one was a new board chat style naming a broad selector after `:has()`, fixed and rerun alone, and the other three are the ones that fail before these changes.
  - Browser scenarios on Edge for the canvas, chats on the board, task chains and task creation passed. Specs written for the removed side chat of the board were updated: the board opens without it, the AI result and MCP entry scenarios start a chat on the board instead, and the side chat divider, its keyboard menu and the image selection spec (composer selection chip, gallery images into the chat) were removed with the feature. A card no longer turns into a scroll container on hover.
  - Still failing on Edge, as on the earlier canvas: six repository board scenarios in `work-boards.spec.ts` and the legacy task record scenario in `canvas-board.spec.ts` at both widths. The full browser suite, a phone and the installed application were not run.
- Simpler PC window: server and unit tests from PowerShell, 596 passed, 1 skipped and 3 failed of 600 (the same three as before this change). TypeScript and the documentation link check passed.
  - New browser scenarios on Edge, all passed: 6 for the chat list, the provider in a new chat, Appearance, the providers page and the row menu with pin and archive; 2 for following a streamed answer and reading back.
  - Existing scenarios: 6 for opening history and paging passed after one was changed to open the Codex chat from the list; 6 for chat row actions passed after their menu expectations were updated. In the main PC window file 21 scenarios fail, none new: they fail on the previous commit too, where 22 fail (the 22nd tested the removed edge fade). One message-actions scenario also fails on the previous commit.
  - Removed with their features: the browser tests of backgrounds, glass, edge fade, the old palettes and the old follower, and the unit test of the text reveal. The phone layout, the installed application and long real chats were not tested.
- Local model, server tests from PowerShell before the window changes: 602 tests, 598 passed, 1 skipped, 3 failed: the same three that fail before this change (compatibility trigger stub, host packager fixture, three older board cards without a CHANGELOG reference). TypeScript and the documentation link check passed; the privacy guard passed on the changed files.
- Unit and API tests: 7 new tests with a synthetic Strata command line (JSON parsing, start with the key only in the environment, one provider updated in place, refusals for a busy GPU, a download and a second model, launch failure, missing Strata, runtime discovery that rejects a folder outside the control directory, host-only routes).
- Browser tests on Edge: 3 new desktop scenarios (start, starting, running with its address, stop and the remembered choice after reload; the Strata window holding the GPU; no Strata) and 3 settings navigation scenarios passed. The panel was checked on screenshots.
- Real Strata 0.1.65 (engine 0.1.66) on a 16 GB NVIDIA GPU: the server module started IQ3_S (ready in about 51 s) and Coder IQ1_M (about 24 s) at a 128K context; `/v1/models` answered 200 with the key and 401 without it, a chat completion answered, the Anthropic Messages probe returned 400 (supported), and the stop left no engine running. The installed Pocket Code application and a phone were not tested.

- Codex runtime 0.172.0 compatibility review (2026-11-24). Compared the official [0.171.0 to 0.172.0 release notes](https://github.com/openai/codex/releases/tag/rust-v0.172.0) and [versioned app-server schema diff](https://github.com/openai/codex/compare/rust-v0.171.0...rust-v0.172.0) with the PC bridge and shared Android UI. No relevant bridge protocol contract changes or required compatibility edits were found; existing runtime capability checks remain in place.
  - Validation: 61 targeted Codex, image, file-change, history, subagent, approval and activity unit/API checks passed; TypeScript/Vite production build passed. The exact installed runtime schema and live 0.172.0 run could not be checked because Codex is not available on this checkout's PATH. Browser UI checks could not launch because the configured Chrome executable is absent; physical Android and 0.172.0 MCP tool startup remain unverified.

## [0.28.58](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.57...v0.28.58) (2026-11-23)

Published [0.28.58](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.58) from [99eb8b7](https://github.com/Evgenie-Myasnikov/pocket-code/commit/99eb8b7a49ca5a98e9134a54d72a9390b09af32e) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). The tag points to that commit and all four public downloads match the local SHA-256 hashes. 163 UI files matched across the APK and the Windows package; no private data was found in the unpacked packages. Android version code 145.

**The APK is signed with a new key** (certificate SHA-256 beginning d0e5792c). The key of 0.28.49–0.28.57 (beginning d755576e) is no longer on the build PC, so Android cannot install 0.28.58 over an earlier version: uninstall the app, install this APK and pair the phone again. Physical Android installation and the Windows shell smoke test were not run.

### Bug Fixes

- Chat availability (2026-11-23). A damaged file in the PC's private storage no longer switches chats off or keeps the PC server from starting. Reproduced on a running 0.28.57 server: after an interrupted write the chat library was zero-filled, and every request for the chat list, for running turns and for continuing a saved chat answered HTTP 500 until the file was set aside by hand.
  - The chat library, the device list and task records are flushed to disk before they replace the previous file. A damaged chat library continues from its backup, or empty, and the damaged copy is kept beside it. A damaged device list starts empty on purpose, so a disconnected device cannot return from an older copy. One damaged task record is set aside while the others load, and a failed restore is tried again instead of failing until restart.
- Chat speed (2026-11-23). Opening a chat, reading its history and sending a message no longer wait for the provider to list all of its chats again. Measured on the same server: the Codex chat list and the project list took about 6 seconds per request, and every Codex history read and resumed turn waited for one. A chat's history and a new turn now use the last listing. The chat list still waits about a second for a provider that answers quickly, and shows the last listing of a slow one while it is read in the background and asked again less often. A chat created a moment ago, a changed project folder and chat deletion still read the provider's current chats.
  - The provider list asks Codex and Copilot at once and reports the last known state of one that has not answered within 4 seconds, so it cannot hold back the others.
- Composer (2026-11-23). A message can be sent as soon as a chat is opened. While history is loading or the provider is still being confirmed, the message waits above the composer as "Will be sent as soon as the chat opens" and leaves by itself; it can be edited or cancelled, and returns to the field if the chat cannot take it. In the Windows window a chat opened after the PC has answered once no longer waits for another health and provider check. Queued messages that fail to send return to the draft instead of being lost.
- Review (2026-11-23). Large comparisons open in pages of 1000 files and keep the real total, and the files of one turn are selected on the PC before they are counted, including in a nested checkout. A failed first read shows one Retry action instead of empty file controls. The comparison is an opaque reading surface with a clearer Unified and Split switch.
- Windows window (2026-11-23). One late answer from a busy PC server no longer shows "disconnected" and pauses every chat: the window reports the server away after the third missed check in a row, or at once when a server started elsewhere refuses the connection. Up to 16 reads run at the same time instead of 8.
- Typing and streaming (2026-11-23). Typing in the composer and receiving an answer no longer recalculate the style of every icon in the window. One rule that faded the Send icon named the `svg` tag after `:has()`, which made each change inside the window re-check all icons (one set per message). In a synthetic 300-message chat, 20 key presses spent 1773 ms on style recalculation over 1346 elements at a time; now 101 ms over 16. On the production bundle a key press takes about 10 ms. A test rejects broad tags after `:has()`.
- Chat background (2026-11-23). The animated background stops drawing while the window is not focused, and the default background draws about 30 frames a second instead of one per display refresh. Its effect on GPU load was not measured.

### Validation

- Server tests from PowerShell: 595 tests, 591 passed, 1 skipped, 3 failed. The same three fail on an untouched checkout of e3226c1 (compatibility trigger stub, host packager fixture, four older board cards without a CHANGELOG reference). New tests cover damaged files, the saved chat listing, a provider that does not answer and the CSS rule.
- Review: the server tests for paging and scoped paths passed, and 31 browser scenarios passed after the tests were updated to open Review from the chat's More actions menu, where it has been since the header changed. One new style was corrected so the layout buttons keep a 40 px target on a 320 px phone.
- Browser tests on Edge: 4 new scenarios for sending while a chat opens passed. Of 107 existing chat and desktop scenarios 75 passed and 32 failed; of 40 background, composer and usage scenarios 34 passed and 6 failed. The same scenarios fail on e3226c1, none of them newly.
- Current source against this PC's own provider data: the Codex chat list answered in 3–4 ms after its first 6.1 s read, a Codex chat's history in 16–119 ms, and the project list in 0.13–0.23 s instead of 6.3–6.5 s.
- TypeScript and the production build passed. The Windows shell compiles; its smoke test, the installed application, a phone and live provider turns were not run.

## [0.28.57](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.56...v0.28.57) (2026-11-23)

Published from [785d5a9](https://github.com/Evgenie-Myasnikov/pocket-code/commit/785d5a93c36d7c84dd1116e7fbe478f4902a1c7a) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Verified the tag, all four public download hashes, 163 identical UI assets across packages and Android signature continuity. The focused suite passed 131 unit tests and 17 browser tests. The desktop and phone streaming scenario also passed twice per layout. Physical Android and authenticated provider runs remain unverified.

### Bug Fixes

- Chat streaming (2026-11-23). Keep the public reasoning summary in one expandable block per user turn, including when commands or file writes arrive between updates. Independent commands and file edits update in place from provider events. Completed commands fold into the turn history. Reproduced the duplicate on 0.28.56 and verified simultaneous updates to two files in the browser.

## [0.28.56](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.55...v0.28.56) (2026-11-22)

Published from [fe5c63c](https://github.com/Evgenie-Myasnikov/pocket-code/commit/fe5c63c4cd92208d111c9ec5b7043e0f8919f95d) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Verified the tag, all four public download hashes, the packaged UI and Android signature continuity. Physical device installation remains untested.

### Bug Fixes
- Chat delivery (2026-11-22). Show the submitted message immediately and clear the composer while the host acknowledges it. Retain subsequent typing and recover rejected submissions. Verified the production build and five browser scenarios, including delayed Claude and Codex acknowledgements.

### Features
- Tasks (2026-11-22). Start a task from a typed description or a text file. The title defaults to its first line and AI can suggest a title or refine the description before launch. Open step chats and prior attempts beside the task, or full-width on phones, with drafts and task context retained on return. Linked chats are excluded from the ordinary chat library and folder deletion. Verified the production build, host filtering, notification routing, task creation and desktop and phone-sized browser flows with synthetic data.

## [0.28.55](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.54...v0.28.55) (2026-11-22)

Published [0.28.55](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.55) from [d4ef337](https://github.com/Evgenie-Myasnikov/pocket-code/commit/d4ef33787a1447f1a78c4e2a0de1ed54e5dc6f70) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). SHA-256 verified for all four public downloads. All 163 web assets matched across packages. Android version code 142 uses the same signing certificate as 0.28.54. Physical Android installation remains untested.

### Features
- Chat activity (2026-11-22). The default brief view folds successful shell commands from each user turn into one expandable history. Output stays available and running commands, failures and approval requests remain visible. Desktop and phone browser checks covered turn boundaries, the detailed view and retained command output.
- Turn results (2026-11-22). On Windows the output and working folder buttons open Explorer after the local host verifies the directory. Phones browse the connected PC inside Pocket Code. Native path tests and desktop and phone browser tests covered scoped navigation, failure recovery and file previews.
- Appearance (2026-11-22). Graphite, Slate and Ink are available in desktop and phone settings. Each preset sets the surfaces, accents and control shapes across the app. Graphite is the default for new installs. Existing choices and reading preferences survive the upgrade. Live file previews show line numbers when the received line count is known.
  - Validation covered 20 Edge scenarios, including 320 px and 390 px phone layouts, saved preferences, live edits and navigation. All 26 palette/mode combinations passed the contrast check. The production web build and Windows shell compilation passed. Physical Android verification remains open.

### Bug Fixes
- Code readers (2026-11-22). Fenced code now uses a single surface with copy and wrapping behind a compact disclosure. File previews keep search, wrapping and close beside the file name even when opened directly from chat. Search opens on demand or with Ctrl+F. Verified both readers with keyboard and touch-sized layouts. Desktop and Android preview archives matched the production web assets.
  - Four legacy glass-effect scenarios still fail on the prior release branch commit and the preview. They expect different blur values on the composer and menus.

## [0.28.54](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.53...v0.28.54) (2026-11-22)

Published [0.28.54](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.54) from [b466d9331c0e1fb062a81becb14c61e65d50dd1d](https://github.com/Evgenie-Myasnikov/pocket-code/commit/b466d9331c0e1fb062a81becb14c61e65d50dd1d) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). All four public downloads matched the audited SHA-256 hashes, all 163 UI files matched across packages, and the APK signer matched 0.28.53. Android version code 141. Physical-device verification remains open.

### Features
- File changes and token usage (2026-11-22). Chats display native partial writes, measured generation statistics and the last saved response metrics. A per-response result card opens the verified working and output folders and lists changed files and available diff counts. Validation covered actual adapter event handlers with synthetic events, five Edge scenarios for streaming and file results, and the production TypeScript/Vite build.
- Chat history (2026-11-22). Reopening a chat restores its cached transcript immediately while the host refreshes it. Permanent erasure also clears connected clients’ retained copies on synchronization and closes an erased chat that is open on another device. Edge scenarios covered slow connections, switching chats, account isolation and reconnecting after erasure.
- Task cleanup (2026-11-22). A stopped or finished chain can be erased with the local originals and caches of its known step and retry chats. Confirmed deletions are journaled so partial failures can be retried. Synthetic host and browser tests verified the two deletion options and protected the final handoff from a simultaneous folder deletion.
- Task chains (2026-11-22). Import a plan once, split it manually or with an AI planner, review and revise its steps, pick each executor, then launch. Step context renders Markdown, shows project, worktree and attachment paths, and lists native subtasks reported by the provider. Verified with host and Edge scenarios, a nested Git fixture and a live Codex planning request on synthetic files.
- Windows chats (2026-11-22). Shift-click selects a range and Ctrl-click toggles individual chats. The folder menu previews the full group for removal, including filtered rows. Confirmation skips active chats. Erasure removes the local provider original and Pocket Code caches. A separately labeled list-only action preserves the original. Verified on synthetic conversations through the host and Edge.
- Git-backed Markdown chains run new steps on separate local branches based on the previous verified commit. Retries reuse the worktree. Final review shows the cumulative diff and the exact command for a single manual merge. Non-Git projects keep their existing workflow. TypeScript and Vite passed. A two-step Git fixture verified the cumulative diff and merge. Physical-device and live provider checks remain open.

### Bug Fixes
- AI drafting providers (2026-11-22). A failed provider or API profile lookup no longer hides working options. The selector explains unavailable providers, refreshes their status and preserves a valid API connection and model. An HTTP fixture reproduced the previous server error and Edge covered recovery. Native Codex text sampling accepts up to 4,000 UTF-8 bytes.
- Portable boards (2026-11-22). Raised the shared version and branch-link limit to 128 after the existing 66-version project board failed validation at 64. All 52 repository cards passed validation. Four snapshot and host-boundary tests covered round trips and overflow.

## [0.28.53](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.52...v0.28.53) (2026-11-22)

Published [0.28.53](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.53) from [bb22e43b2f3bb75d1972c19e3967cd9e8bbc4e6f](https://github.com/Evgenie-Myasnikov/pocket-code/commit/bb22e43b2f3bb75d1972c19e3967cd9e8bbc4e6f) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). All four public downloads matched the audited SHA-256 hashes, all 163 UI files matched across packages, and the APK signer matched 0.28.52. Android version code 140. Physical-device verification remains open.

### Bug Fixes
- Markdown task chains (2026-11-22). A finished chat without its completion marker now schedules another attempt at the same step with the previous report. Delays increase to one minute. User stops and provider failures remain terminal. Eight scheduler tests and TypeScript passed.

## [0.28.52](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.51...v0.28.52) (2026-11-22)

Published [0.28.52](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.52) from [18b514d915586690a601590f961363c755ff0193](https://github.com/Evgenie-Myasnikov/pocket-code/commit/18b514d915586690a601590f961363c755ff0193) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). All four public downloads matched the audited SHA-256 hashes, all 163 UI files matched across packages, and the APK signer matched 0.28.51. Android version code 139. Physical-device verification remains open.

### Features
- Task chains (2026-11-22). Open Tasks on Windows or Android to create or import a Markdown plan. Follow each linked chat, its provider and requested model, current output, exact step context and result. Stopped and completed chains can be deleted while their chats stay available.
- Task authoring (2026-11-22). Use Improve on a chat draft or individual task field with a supported local Claude, Codex or Copilot account or a configured API-key connection and model. Custom accounts generate an isolated text suggestion through the PC. Apply or edit the suggestion before running a task. A real local Codex 0.171.0 request and simulated OpenAI-compatible API requests were verified.
- Workspace navigation (2026-11-22). Windows keeps New chat in the icon rail and groups chats by folder. A searchable folder chooser works across Tasks, chats, documents, boards and workspace settings. Short transitions respect reduced motion, and streamed task updates retain their place. Tested with 247 synthetic project folders.
- Chat presentation and notifications (2026-11-22). Mute a conversation on this device from its bell or action menu. Replies and approval cards stay available. The transcript drops routine continuation and beginning markers. Reasoning, command failures and file edits use compact disclosures. Live file content shows the latest lines, observed byte and line counts, and the final provider result. [Chat examples](docs/USER_GUIDE.md#attachments-and-history)

### Bug Fixes
- Queued messages on Windows (2026-11-22). The desktop bridge now permits withdrawing a specific queued follow-up, which also enables Edit and Send now. The compiled bridge reproduced the rejection before the fix. Both bridge tests and all five follow-up scenarios then passed.

TypeScript, Vite, Windows and Android debug builds passed. The targeted host suite passed 42 checks. Edge scenarios covered task creation, drafts, live output, mute, project selection, keyboard access and reduced motion. The Android preview matched all 163 web assets and the previous signer. Physical-device checks remain open.

A broader pre-merge host run covered 142 test files (482 passes, 44 failures and one skip). Of 24 suites with failures, 21 also failed on the parent revision and the other three passed when rerun. Four existing small-screen subagent header tests still expect four buttons instead of the current menu.

## [0.28.51](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.50...v0.28.51) (2026-11-22)

Published [v0.28.51](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.51) from [21ed30b](https://github.com/Evgenie-Myasnikov/pocket-code/commit/21ed30b95bc28772111429e28617ae50d8783883) on branch [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android version code 138. The 0.28.50 updater accepted the Android, Windows and host packages. The Android application ID and signer match 0.28.50. The source passed [GitHub CI](https://github.com/Evgenie-Myasnikov/pocket-code/actions/runs/45009319617). All four files downloaded from the public release matched the audited local SHA-256 hashes and sizes. Live provider execution and installation on a physical device remain open.

### Features
- Task text authoring (2026-11-22). Improve an existing task field or fill an empty one with a signed-in Claude or GitHub Copilot provider. Each field uses a stable template and related task context. Review and edit the suggestion before applying it. Covers chat drafts, branch edits, board card titles and descriptions, acceptance criteria, and manually entered or imported Markdown plans. [User guide](docs/USER_GUIDE.md#attachments-and-history)
  Validation included provider and permission tests, Windows bridge checks, Edge editing flows, narrow-screen hit targets, the TypeScript/Vite build, Windows build and Android debug build. No live model or physical phone was used. The broader integration run had 411 passes, 61 failures and one skip before a CSS token fix. The token suite passed after correction. The Windows minimize smoke check and several existing fixture failures also reproduced on the parent commit. Some Git and test workers failed to launch. Review opened through its current menu on both revisions.
- Linked Markdown task chats (2026-11-22). Start a tracked chain to run each task in a separate project chat with the shared context and the previous result. The tracker shows approvals, failures and progress, opens the chat for each step, and is accessible from its linked chats. The PC saves the chain privately and halts interrupted steps on restart. [User guide](docs/USER_GUIDE.md#attachments-and-history)
  Validation covered 18 parser, scheduler and host API tests, four Edge scenarios and local web and Windows builds. Screenshots use synthetic tasks. Execution with a live provider and physical-device checks remain open.
- Markdown task batches (2026-11-22). Choose a context file in the chat attachment menu to preview tasks from a runner, linked index, selected task files or level-two headings. Missing files block partial imports. Send submits the ordered batch in the project chat, preserving the draft and carrying large batches as a single attachment. [User guide](docs/USER_GUIDE.md#attachments-and-history)
  Validation covered nine parser tests, four Edge scenarios with a simulated host and the TypeScript/Vite build. Live provider and physical-device runs remain unverified.

### Fixes
- Standalone Windows chats (2026-11-22). Desktop starts its local host even for previously disconnected profiles. Fresh installations use loopback. Chats can retry the local service directly, and changes to optional phone access take effect on the next host launch without interrupting an active conversation.
  Validation included the production build, the standalone Windows WebView launch check, three browser chat scenarios with a simulated provider, and eleven bridge, runtime and device tests. Live provider accounts were not exercised.
- Long replies and keyboard focus (2026-11-22). Jump to latest places keyboard focus on the last message, including after a history refresh. Code examples wrap individually and preserve indentation when copied. Clipboard errors explain how to copy manually. Retrying an attachment or inserting it as text returns keyboard focus to the draft. [Usability review](USABILITY.md)
  All 22 targeted Edge scenarios passed across runs. Four ran separately after two browser-test workers exited during startup. Nine unit checks and the TypeScript/Vite build passed. Physical Android and packaged-app checks remain open.
- Reading and composing (2026-11-22). Table cells wrap on narrow screens, and wide tables retain keyboard focus and scroll position during streaming. IME confirmation preserves the draft. The attachment picker and compact file list restore focus, and failed uploads show the reason on touch screens. [Review and references](USABILITY.md)
  Validation covered 12 targeted Edge scenarios and nine unit checks. One attachment test passed on retry and in four consecutive reruns. The TypeScript/Vite build passed. Physical IME and Android verification remain open. Target integration rechecked both passes together. All 22 Edge scenarios passed, one after a browser crash. Nine unit checks and the production build passed.

## 0.28.50 (unreleased)

### Fixes
- PC window connection (2026-11-22). After 0.28.49 the PC window could show "No connection to the PC" and block the composer while its host and Codex kept answering. The window talks to its own host over loopback, but it treated Windows network state (a Wi-Fi or VPN reconnect) as "no network" and froze there without probing again, and it treated one slow request (a Codex chat list that takes several seconds) as the host being away. Now a loopback host never depends on Windows network state, a remote host is probed again after a network drop, only a stopped or refusing host marks the PC away, and the window keeps a saved copy of the PC details and boards while its host restarts and clears the warning once the host answers.
  Validation: new desktop case in `tests/reachability.test.ts` (6 passed), `tsc --noEmit` clean. Manually on the build PC: the host answered in 10–70 ms, a Codex chat with GPT-6.2-Astra and the ultra effort completed through the host API, and Codex 0.153.4 and 0.171.0 both take about 5 s for the first chat list page, so that delay is not new. The full suite was not run; the packaged window was not observed with the fix yet.

## [0.28.49](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.48...v0.28.49) (2026-11-22)

Published [v0.28.49](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.49) from [051bc9773552fe48fae03a5c7bf46974f7efb8d7](https://github.com/Evgenie-Myasnikov/pocket-code/commit/051bc9773552fe48fae03a5c7bf46974f7efb8d7) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 136. Android, Windows and host packages built with the steps of scripts/publish-release.ps1 (run step by step with retries because process launches failed intermittently on the build PC); the release manifest names this branch and commit. The first APK was signed with a newly generated debug key and could not update 0.28.48; it was rebuilt from the same commit with the original debug key (certificate SHA-256 d755576e…) and replaced together with update.json. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit. Privacy guard passed for the tree. On the build PC the host listed GPT-6.2 and GPT-6.1 Codex models; the desktop window updated itself to 0.28.49 and works after a restart. Installing the replaced APK on a phone was not observed.

### Fixes
- Codex models: newer models were missing because the provider lists them only to newer Codex clients, while the host used the first `codex.exe` it found (often an outdated desktop build). The host now keeps its own Codex CLI in `%LOCALAPPDATA%\Pocket Code\runtime\codex`, installs the latest official `@openai/codex` release from npm at start and every 6 hours (keeps two versions; `POCKET_CODEX_AUTO_UPDATE=0` disables it), picks the newest installed Codex by `--version`, and finds the current npm layout `vendor/<arch>/bin/codex.exe`. After an update the idle Codex connection reconnects to the new build. Validation: new `tests/codex-runtime.test.ts` (5 passed), `tsc --noEmit` clean, Codex tests unchanged (the pre-existing compatibility-trigger failure reproduces without this change). Manually: Codex 0.153.4 listed GPT-6-Astra and GPT-5.6 only; 0.171.0 on the same account listed GPT-6.2-Sol, GPT-6.2-Astra, GPT-6.1-Terra, GPT-6.1-Sol and GPT-6 models.

## [0.28.48](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.47...v0.28.48) (2026-11-15)

Published [v0.28.48](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.48) from [d2fa1ceb047acfd6a312a41a7cd1a5db5238d20d](https://github.com/Evgenie-Myasnikov/pocket-code/commit/d2fa1ceb047acfd6a312a41a7cd1a5db5238d20d) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 135. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit. Privacy guard passed for the tree. The Codex follow-up message on the fixed host, the desktop window and devices were not run on the published packages.

### Fixes
- Codex chats with generated images: the next message failed with a server error. History is read in pages of 20 items (10 turns) instead of 100, so eight inline images (4-5 MB each) no longer exceed the Codex protocol line limit and close the Codex connection. Images saved on disk are not counted twice when agents of a chat are loaded.
- Codex replies are split into lines without rescanning the unfinished line on every chunk; the line limit is 128 MB.
- An unexpected host error no longer blames Claude Code: the message says the details are in the host log, and the host writes the request and error there.

## [0.28.47](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.46...v0.28.47) (2026-11-15)

Published [v0.28.47](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.47) from [3d773d91390d689cafa712876a12e8717ba46eb5](https://github.com/Evgenie-Myasnikov/pocket-code/commit/3d773d91390d689cafa712876a12e8717ba46eb5) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 134. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit. Privacy guard passed for the tree. The regrouped settings on a phone, the desktop window and devices were not run on the published packages.

### Changes
- Settings are grouped by task, the same on the phone and in the Windows window: **Connection** (Connection, Updates), **Agents and board** (Providers, Chat, Board), **Interface** (Appearance and language, Notifications).
- Providers: sign-in, agent access, the spend limit and the remaining usage of a provider are on one page; the separate Usage limits section is gone.
- Chat: sending with Enter, permission wait time, the folder for new chats (phone), text reveal speed, read aloud and keyboard shortcuts (Windows) are together. They were split between AI accounts, Windows application and Appearance.
- Board: the canvas grid, Miro and Jira are together.
- Windows: startup and tray options are on the Connection page; the version and description are on Updates. Windows application and About are no longer separate sections.
- Appearance keeps only the look; its reset no longer changes the text speed or the board grid.
- Links to the former sections open the section that took them in.

### Bug Fixes
- Settings no longer go blank when the list of custom providers comes back in an unexpected form.

### Validation
- TypeScript passes; settings registry, translation and token tests pass. Browser: settings-navigation, usage-limits and miro-mobile specs pass with the new sections; the other failures in the settings-related specs are the same as on the 0.28.46 source. Desktop settings checked on screenshots.

## [0.28.46](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.45...v0.28.46) (2026-11-14)

Published [v0.28.46](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.46) from [47b1419780d2d87423a3cb1607dc402c5b779172](https://github.com/Evgenie-Myasnikov/pocket-code/commit/47b1419780d2d87423a3cb1607dc402c5b779172) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 133. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit. Privacy guard passed for the tree. The update button, a Claude turn and devices were not run on the published packages.

### Bug Fixes
- Board chat: each provider (Claude, Codex, Copilot and every custom provider) keeps its own chat of a board. Opening the board chat or switching the provider beside the board opens the selected provider's chat; before, the board always switched back to the provider that started its first chat. The existing Codex board chat stays where it was.
- Claude: the bundled Claude Code is 2.1.325 (was 2.1.285, which newer models refuse). Turns, the model list and usage run with the newest Claude Code on the PC, bundled or installed.

### Features
- **Update Claude Code** runs the updater of the Claude Code installed on the PC. The button is on the Updates page of both apps and under a chat error that says the Claude Code is too old for the model.

### Validation
- TypeScript passes; the desktop window compiles. Unit tests: the board chat tests cover one chat per provider on the device and on the host. On this PC the host found bundled 2.1.325 and installed 2.1.319 and chose the bundled one. The update button and a Claude turn were not run live.

## [0.28.45](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.44...v0.28.45) (2026-11-14)

Published [v0.28.45](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.45) from [44a53f3eab325432bf7a69ad42f2f51dd902eed7](https://github.com/Evgenie-Myasnikov/pocket-code/commit/44a53f3eab325432bf7a69ad42f2f51dd902eed7) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 132. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit. Privacy guard passed for the tree. The published packages were not installed on a phone or the desktop window.

### Bug Fixes
- Chat composer: the exact Claude model ID form, the catalog note, the **+** menu with the project folder picker and voice input notices open above the composer without being clipped by its scrolling panel.
- Claude: the default model is the `default` row of the installed Claude catalog (the account or settings default) instead of a fixed Sonnet; the effort check uses that model. Older CLIs without the row keep Sonnet.
- Claude: an API failure (login, limits, overload, prompt too long) shows its own reason instead of a generic error.
- Claude: a turn whose live view grows past 4 MB keeps running; the view drops its oldest messages and the full session stays on the PC. Before, the run was killed.
- Claude model catalog is read without MCP servers, tools or a saved session.
- Claude: **Stop** interrupts the turn the way Esc does in Claude Code: the CLI ends its tools and the shells they started and saves the turn. The process is killed only if it does not finish within 5 seconds. Before, Stop killed the CLI, which on Windows could leave its shells running.
- Claude: API retries, slash-command output (`/context`, `/cost`) and context compaction appear in the chat as system rows; the retry row disappears when the answer arrives.
- Claude: while an answer streams, a phone poll downloads only the new text; the transcript is resent only when it changes. Before, every poll (900 ms) downloaded the whole turn.
- Chats: after a stopped or failed turn the chat keeps syncing messages written from the PC or another device.
- Chats: **Edit** and **Send now** on a queued message no longer drop its files when they are not on this device (after a reload or when queued elsewhere); the message stays queued and the app says why.
- Chats: a new chat shows its own title after the first turn instead of a temporary placeholder.
- Chats: a finished turn with no answer (a slash command) hands over to the chat history instead of leaving the chat without updates.
- Chats: each chat keeps its own Claude model, like its access mode; the last choice is the default of a new chat. Effort stays per model.
- Settings: the spend limit is labelled per run, which is how it works: it covers the message and the follow-ups Claude takes before the run ends.

### Validation
- TypeScript passes. Unit: 487 of 494 pass, 1 skipped; the 6 failures (activity feed, activity rows, Windows host replies, compatibility trigger, host packager, board evidence) fail the same way on the 0.28.44 source. The settings translation check was updated for the new spend-limit label. New unit checks pass: the `default` catalog row, the API error text, a turn over the display limit, Stop by interrupt, the kill fallback, an error exit after interrupt, system rows for retries, slash-command output and compaction, and an unchanged transcript revision during token deltas.
- Browser: Claude model, follow-up composer, chat library, board chat and settings specs pass; new checks that the model ID field and the folder picker are on screen and on top pass (the model ID check fails on the 0.28.44 source). codex-effort at 320px fails the same way on the 0.28.44 source.
- Live on Windows: a metadata-only catalog read returned the `default` row; a Sonnet turn running `ping` was stopped in about 2 s with status stopped, no error, the `ping` process gone and the session kept. No phone check.

## [0.28.44](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.43...v0.28.44) (2026-11-13)

Published [v0.28.44](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.44) from [ffc170462f0ede68b9da7f88603dc43e68407520](https://github.com/Evgenie-Myasnikov/pocket-code/commit/ffc170462f0ede68b9da7f88603dc43e68407520) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 131. The tag resolves to the source commit; GitHub SHA-256 digests of the APK, Windows and host packages match the local artifacts. The tray behaviour was not run live on the published packages.

### Changes
- Windows window: minimizing keeps the window on the taskbar; only the close button hides it to the tray.
- Tray menu: the Connect / disconnect item is removed (it stopped a host that was still starting). A stopped host is started with **Start PC host** on the computer settings page.

### Validation
- TypeScript passes; the desktop window compiles. Not run live.

## [0.28.43](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.42...v0.28.43) (2026-11-12)

Published [v0.28.43](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.43) from [fe406ac14a9e39ce9ce5ae3a2dfb41b274505dad](https://github.com/Evgenie-Myasnikov/pocket-code/commit/fe406ac14a9e39ce9ce5ae3a2dfb41b274505dad) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 130. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit. Privacy guard passed for the tree. The update handoff, desktop window and devices were not run on the published packages.

### Bug Fixes
- Windows update: the updated window always starts the PC host, even when the connection switch was turned off while the previous window handed over; before, such an update waited five minutes and rolled back with the host stopped.
- Windows window: when the host was stopped with the connection switch, the app says so and where to start it, instead of "Reconnecting…" that never reconnects.

### Validation
- TypeScript passes; the desktop window compiles with scripts/build-desktop.ps1. The update handoff was not run live.

## [0.28.42](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.41...v0.28.42) (2026-11-12)

Published [v0.28.42](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.42) from [4b4f06886d2f40ff910d9e6a63992f9c6247d06a](https://github.com/Evgenie-Myasnikov/pocket-code/commit/4b4f06886d2f40ff910d9e6a63992f9c6247d06a) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 129. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; the Windows package interface contains the tile size control. Privacy guard passed for the tree. No desktop window, physical-device or live provider check was run on the published packages.

### Changes
- Windows sidebar: Rules, Changelog and Settings are icons in the sidebar next to Chats and Board; the More menu is gone.
- Board list: boards are shown as glass tiles (frosted fill, light edge) with a square preview and the title below. A size slider next to Refresh makes tiles larger or smaller (140-420 px); the size is remembered on the device. Phones keep two columns, with a plain panel when reduced transparency or forced colours are on.

### Validation
- TypeScript passes; design token test passes. Browser: navigation-motion, run-notifications and board-resilience specs pass; desktop-sidebar fails at the Windows application settings step exactly as on the 0.28.41 source. Tiles checked on screenshots in dark and light themes.

## [0.28.41](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.40...v0.28.41) (2026-11-12)

Published [v0.28.41](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.41) from [dad89236f7750d02eaf63372254589c286ce53fd](https://github.com/Evgenie-Myasnikov/pocket-code/commit/dad89236f7750d02eaf63372254589c286ce53fd) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 128. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; the host package (608 files) contains the board contract, backup and chart sources and the MCP worker with the chart and repair tools; the Windows package contains the same host sources, an interface with the repair, backup and board-chat routes, and a window whose bridge allows them. Privacy guard passed for the tree. Unit, API and browser results are listed under Validation below. No desktop window, physical-device or live provider check was run; live behaviour remains unverified.

### Features
- boards: a board file is read record by record. A record outside the format no longer stops the board from opening: readable cards and objects are shown, damaged ones are marked, and a panel names the card, field, limit and value of each problem. Such a board is read-only until **Repair** brings the records back inside the format; removed text is appended word for word to `project-boards/history`. The host keeps private copies of each repository board and **Restore…** rolls back to a saved snapshot, also when the file is no longer valid JSON.
- boards: every write through the app, the board MCP or the host API is validated and a refused write names the card, field, limit and value; the file is replaced atomically or not at all. A description over 20,000 characters is accepted and its older paragraphs move to `project-boards/history/card-<id>.md`. The text of a card is stored once: its canvas object keeps geometry and title.
- boards: bar charts as canvas objects. The board stores categories and series, the host draws grouped or stacked bars with an optional reference line and the change between two series; the data is edited as a table. Up to 8 series and 40 categories.
- boards: acceptance checklist on a card, status history recorded by the host with the time of each change, Find on board (Ctrl+F) by text and status, and a warning for a description above 90% of its limit.
- board MCP: `board_health`, `repair_board`, `board_create_chart`, `board_update_chart`; `checklist` in `create_note`/`update_note`; a write answers with the new revision and only the changed objects; `read_board` summarises a large board unless `detail` is `"full"`; refusals carry the explanation of the host with codes `board_needs_repair`, `board_unrepairable`, `invalid_input` and `board_too_large`.
- board chat (PC): the chat beside a board is a compact panel with visible **New board chat** and **Close board chat** buttons.

### Bug Fixes
- board chat: the PC host now remembers which chat is the current discussion of a board, so the desktop window and phones resume one conversation instead of each device keeping its own; a discussion opened from the chat list becomes the chat of the board, so the board and the list no longer show two diverging histories. A chat that has just started is linked to its board even before its provider lists it, and a failed link is retried.
- boards: a dependency on a missing card or a dependency cycle is reported per card instead of failing the whole read.
- boards: replacing a board file is retried when Windows briefly locks it (a reader, the indexer or a virus scanner), instead of failing the save; the read cache uses the exact file identity and is dropped after every host write.
- this repository's board file had 65 branch links against a limit of 64 and did not open in its own host; it was repaired with the new tool (two links of versions that are not on the board moved to `project-boards/history/board-repair.md`).

### Performance
- boards: host read 78 → 15 ms and save 220 → 40 ms (p50), response 1.16 MB → 0.66 MB; pan with the whole board in view, frame p95 41.7 → 7.1 ms; zoom 34.6 → 7.0 ms; keyboard move of an object, edit to saved, 314 → 93 ms; reopening a board downloads no image originals. Measured on a copy of a real 1.2 MB board (74 cards, 257 canvas objects, 105 connections); method, table and causes are in docs/PERFORMANCE.md. `scripts/benchmark-board.mjs` repeats the run.
- board MCP: the answer to a one-field `update_note` on that board shrank from 836,800 to 1,203 characters.

### Breaking Changes
- Charts, checklists and status history are new optional fields of the version 1 board format. Hosts older than this change refuse a file that contains them; a board without them stays readable by 0.28.40. The Windows desktop window needs this build to reach the repair, restore, backup and board-chat routes.

### Documentation
- docs/BOARDS.md, docs/BOARD-MCP.md, docs/PERFORMANCE.md, docs/USER_GUIDE.ru.md, project-boards/README.md and the pocket-board skill describe the above; the built-in provider guidance names the format limits and the repair and chart tools.

### Validation
- 2026-11-12, working tree: TypeScript and Vite build passed. Full `npm test`: 486 tests, 478 passed, 1 skipped, 7 failed — the 5 that also fail on the untouched 0.28.40 commit (activity HTTP feed, activity rows, compatibility trigger, host packager, checked-in board content) and 2 that failed only while benchmarks ran in parallel and passed when rerun alone (Jira workflow routes, task review approval). The checked-in board test no longer fails on the format; it still fails because four older cards do not mention the changelog.
- New tests: tolerant reading, repair, rollback, validated writes, history overflow, status history and warnings (9); the same through a real host and the real MCP worker over stdio, with chart creation and summaries (3); chart validation, geometry, pasted tables and the desktop route policy (6); the board chat association on the host and across two devices (4).
- Browser (Chrome, synthetic data): 53 of 55 scenarios passed across 21 board and canvas spec files, including a damaged board opened, repaired, edited and rolled back; a chart drawn, edited and created; search; checklist; and the board chat panel closed, reopened and replaced. The 2 failures (board-example, one board-images-selection scenario) expect interface that the 0.28.40 commit does not have either; work-boards, maintenance-board and canvas-board specs fail for the same reason and were not counted.
- Screenshots of the diagnostics panel, the chart in dark and light themes, the checklist and the compact chat panel were inspected.
- The Windows desktop window compiles with the new allowed routes (scripts/build-desktop.ps1) and the built interface contains the new board features. Not checked: the desktop window running (WebView2 and its bridge), Android, and live provider sessions.

## [0.28.40](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.39...v0.28.40) (2026-11-06)

Published [v0.28.40](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.40) from [e56e95854b4e13699a4dce5d05b42d3148755814](https://github.com/Evgenie-Myasnikov/pocket-code/commit/e56e95854b4e13699a4dce5d05b42d3148755814) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 127. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; the host package contains the allowance colour and ring sources. Privacy guard passed for the tree. No live provider request, browser scenario, desktop window or physical-device check was run; live behaviour remains unverified.

### Fixes
- The remaining percentage on Send takes the exact colour of the icon it replaces, so it stays readable on a light Send button (it was white on white). The allowance ring around Send is 30% thicker.

## [0.28.39](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.38...v0.28.39) (2026-11-06)

Published [v0.28.39](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.39) from [7e698e084e4eb60072239188e42dd4136b525166](https://github.com/Evgenie-Myasnikov/pocket-code/commit/7e698e084e4eb60072239188e42dd4136b525166) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 126. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; the host package contains the provider-name chat resolution and the non-clickable allowance ring sources. Privacy guard passed for the tree. No live provider request, browser scenario, desktop window or physical-device check was run; live behaviour remains unverified.

### Fixes
- The allowance ring around Send is no longer clickable: a press near the edge of Send opened Usage limits by accident. The ring only shows the remaining allowance; Usage limits stay in Settings. Instead, the Send or Stop icon now and then fades into the remaining percentage for a few seconds (shortly after the chat opens and about every 45 seconds while the window is visible) and fades back to the icon. The playwright usage specs pass; the chat glass spec keeps 4 failures about menu and composer blur values that this change does not touch.
- Chats follow their custom provider by name: a custom provider removed and added again gets a new ID, and its chats were left with the old one and disappeared from every list. The host now records the provider name with each chat and moves chats to the provider with the same name (case and surrounding spaces ignored). Chats recorded before names were kept move to the only custom provider when there is exactly one; a chat whose provider cannot be found is listed with the PC's Claude sign-in instead of disappearing, and returns once a provider with its name is added. Moves are stored, and renaming a provider updates the recorded name.
- Validation: TypeScript and Vite build passed. A new test covers the move by name, the legacy move to a single provider, no guessing with several providers, and listing chats of a removed provider with Claude. The full suite keeps the 5 known failures; one extra failure under load (task review baseline) passed when rerun alone. No desktop window or physical-device check was run.

## [0.28.38](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.37...v0.28.38) (2026-11-06)

Published [v0.28.38](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.38) from [09ffcb9cd14afea69d09b99350cf45dae724ee8d](https://github.com/Evgenie-Myasnikov/pocket-code/commit/09ffcb9cd14afea69d09b99350cf45dae724ee8d) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 125. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; the host package contains the custom provider picker reload sources. Privacy guard passed for the tree. No live provider request, browser scenario, desktop window or physical-device check was run; live behaviour remains unverified.

### Fixes
- Custom providers missing from the provider picker: the picker loaded custom providers once, and when the host was not ready yet (desktop start) the list stayed empty, while chats were still filtered by the stored custom provider, so the picker showed Claude with "No matching chats". The list and the provider's model catalog now retry until the host answers, the list refreshes each time the picker opens, the picker says "Custom provider…" until the stored provider is loaded instead of showing Claude, and a provider removed on the PC falls back to the PC's own Claude sign-in.
- Validation: TypeScript and Vite build passed. The full suite keeps the same 5 known failures. No desktop window, browser scenario or physical-device check was run.

## [0.28.37](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.36...v0.28.37) (2026-11-06)

Published [v0.28.37](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.37) from [682d156406721f66e6e05738be10c4745af09467](https://github.com/Evgenie-Myasnikov/pocket-code/commit/682d156406721f66e6e05738be10c4745af09467) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 124. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; the host package contains the provider-keeping chat fixes (session account recording, chat library retries, account lookup on open). Privacy guard passed for the tree. No live provider request, browser scenario, desktop window or physical-device check was run; live behaviour remains unverified.

### Fixes
- Custom provider chats no longer disappear or switch provider. Opening a chat from a running task, a notification, a board or right after its first turn passed the chat without its provider, so the app silently switched back to the PC's Claude sign-in and the provider's chats vanished from the list. A chat now takes its provider from the chat itself, its task or the chat list, and the current provider is kept when none of them knows it; new chats carry their provider from the start. The host records a chat's provider as soon as the task receives its session ID instead of waiting for a later list request, writes it only when it changes, and retries the chat library read and replace when Windows briefly locks the file, so the chat list no longer fails at random. Running tasks of another provider are no longer shown in the current provider's list.
- Validation: TypeScript and Vite build passed. A new test covers the task announcing its session with the account and the chat library keeping it. The full suite keeps the same 5 known failures. No live provider request, desktop window or physical-device check was run.

## [0.28.36](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.35...v0.28.36) (2026-11-06)

Published [v0.28.36](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.36) from [f88290000e018f76ee4c16f010c52f86ea0f74f4](https://github.com/Evgenie-Myasnikov/pocket-code/commit/f88290000e018f76ee4c16f010c52f86ea0f74f4) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 123. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; the host package contains the exact model ID picker source. Privacy guard passed for the tree. No live provider request, browser scenario, desktop window or physical-device check was run; live behaviour remains unverified.

### Features
- Custom provider models: the model picker for a custom provider offers "Other model…" to enter an exact model ID, as Claude does. A manually entered ID stays selected even when the provider's /models catalog does not list it, and the picker stays usable when the catalog cannot be loaded. The agent uses that ID for every model slot; the provider must serve it through its Anthropic Messages API.
- Validation: TypeScript and Vite build passed. The full suite showed the 5 known failures in one run and 8 in an earlier run under load; the three extra failures did not recur. No live provider request, browser scenario, desktop window or physical-device check was run.

## [0.28.35](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.34...v0.28.35) (2026-11-06)

Published [v0.28.35](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.35) from [44cdb02ca6581b34c9eed614a692124fe5542bbb](https://github.com/Evgenie-Myasnikov/pocket-code/commit/44cdb02ca6581b34c9eed614a692124fe5542bbb) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 122. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; the host package contains the custom provider agent sources. Privacy guard passed for the tree. No live provider request, browser scenario, desktop window or physical-device check was run; live behaviour remains unverified.

### Features
- Custom providers as agents: a custom provider now works like Claude, with sign-in only by API URL and key. Its account page checks /models and probes the Anthropic Messages API with an empty request (no tokens) to report whether the agent works and which auth header the key needs. Custom providers appear in the provider picker next to Claude, Codex and Copilot; choosing one runs the same Claude Code agent (project files, tools, approvals, follow-ups, history, board MCP) with the provider's URL (an OpenAI-style /v1 suffix is removed), its key, and the model chosen from its /models catalog for every model slot. The host's own Claude sign-in variables are removed from that task's environment, and nonessential traffic is disabled. The key reaches only the agent process environment; it is not returned by the API, logged or stored in task views. Chats remember their provider: each provider lists only its own chats, and reopening a chat switches back to the provider it was started with. Effort levels are hidden for custom providers. The API-only chat remains for providers without an Anthropic API.
- Validation: TypeScript and Vite build passed. New tests cover agent URL handling, the Anthropic probe with bearer and x-api-key keys, unsupported providers and missing keys, the task environment (inherited Claude credentials removed, every model slot set) and passing it to the Claude agent with the task's account. The full suite keeps the same 5 failures as the 0.28.32 source. No live provider request with a real key, browser scenario, desktop window or physical-device check was run.

## [0.28.34](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.33...v0.28.34) (2026-11-06)

Published [v0.28.34](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.34) from [9f71f155152dfd2357289357cb292d8236cf5b15](https://github.com/Evgenie-Myasnikov/pocket-code/commit/9f71f155152dfd2357289357cb292d8236cf5b15) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 121. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; the host package contains the custom provider account sources. Privacy guard passed for the tree. No browser scenario, desktop window or physical-device check was run; live behaviour remains unverified.

### Features
- Custom providers as AI accounts: OpenAI-compatible providers appear in Settings -> AI accounts after Claude, Codex and GitHub Copilot, with their own account page like the built-in providers. The page checks the provider through /models and reports Connected (model count), key required, key rejected, unreachable or incompatible. Sign in by saving an API key (stored encrypted on the PC, never shown again), replace or remove the key, edit the name and API URL without losing chat history, and remove the provider with confirmation. Add provider is available from the same list; the phone shows the same list on its account page. Existing desktop bridge routes are reused, so no native shell change is needed. The API chat remains in the provider picker.
- Validation: TypeScript and Vite build passed. New unit test covers key status (no key, rejected, ready with model count, unreachable), in-place updates that keep the key and history, key removal and invalid updates; existing custom provider and translation tests pass. The full suite keeps the same 5 failures as the 0.28.32 source. No browser scenario, desktop window or physical-device check was run.

## [0.28.33](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.32...v0.28.33) (2026-11-05)

Published [v0.28.33](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.33) from [0a88e6fd75cf8fe3920a865d452a4f5861690ba7](https://github.com/Evgenie-Myasnikov/pocket-code/commit/0a88e6fd75cf8fe3920a865d452a4f5861690ba7) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 120. Android, Windows and host packages built by scripts/publish-release.ps1; the release manifest names this branch and commit. GitHub SHA-256 digests and sizes of all four public assets match the local artifacts; the tag resolves to the source commit; host and Windows packages contain the new board diagram helper. Privacy guard passed for the tree. No browser scenario, desktop window or physical-device check was run; live behaviour remains unverified.

### Bug Fixes
- Desktop chat: an embedded chat whose first host connection fails (for example while the PC host restarts or updates) no longer stays on "Loading..." indefinitely. It shows the connection error with Retry and retries every 3 seconds.
- Chat position: a chat hidden by a desktop page switch loses its scroll offset; before it is shown again it now lands on the latest message when it was following it, otherwise on the reading position, instead of replaying a scroll from the top.

### Features
- Board chats: a chat started from a board records that board (id, project root, title, note) in the host-private chat library through the existing session manage route, so no native shell change is needed. Desktop rail, phone list and chat tiles mark board chats; the chat header shows the board and opens it (on its note when linked to one), also from the actions menu. Repository boards still never store chat associations. Chats created earlier are linked after they are opened once from their board.
- Board chat management: board links now record their kind (board discussion, card chat, board task). Card chats already recorded on host boards appear as board chats in every list without being reopened. A board discussion opened from the desktop chat list returns to its board with the chat beside it; if the board is unavailable it opens as a plain chat. The rail tooltip names the kind and board.
- Board MCP (closer to Miro MCP's scoped workflow, still local Pocket Code JSON): `search_board` filters by kinds, frame, task status and area with limit/cursor paging; `read_board` can page. New `canvas_create` (refs in, server-issued IDs out, connections by ref), `canvas_connect` and `board_create_diagram` (Mermaid flowchart subset with layered layout inside a frame). Connections accept an optional label and style (arrow, line, dashed), rendered on the canvas; the MCP refuses them on hosts before 0.28.33. Tool failures return structured `{code, message, retryable, hint, currentRevision}` errors. No delete, publish or notification tools were added. docs/BOARD-MCP.md and the pocket-board skill updated.
- Validation: TypeScript and Vite build passed. New tests: board MCP tools over stdio (filters, paging, create/connect, labels, version refusal, structured conflict, diagram), Mermaid parser/layout and connection schema, chat library board links; existing board MCP tests pass. The full suite has 5 failures, the same count as the clean 0.28.32 source. A Jira workflow route test failed once under full-suite load and passed in three isolated runs. No browser scenario, desktop window or physical-device check was run; behavior in the live desktop window is unverified.

## [0.28.32](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.31...v0.28.32) (2026-11-04)

Published [v0.28.32](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.32) from [eedf988754ef452fc89f5251e5c9bf3771c10c64](https://github.com/Evgenie-Myasnikov/pocket-code/commit/eedf988754ef452fc89f5251e5c9bf3771c10c64) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 119. Source CI, three production glass scenarios and package builds passed. All 164 web files and 425 host/Windows source files match the reviewed source; 1954 decoded artifact entries passed privacy audit; APK signer unchanged. Four uploaded asset hashes/sizes and exact source tag verified. Supersedes pending-publication statements for this version; physical-device and broader historical acceptance remain unverified.

### Bug Fixes
- Desktop rail: remove the opaque nested icon-strip background and divider, keeping one continuous glass surface in expanded/collapsed layouts. Use translucent hover/selected feedback, retain keyboard focus, and correct opaque/no-blur accessibility fallbacks. Validation: nine navigation/background-region browser scenarios and two dark/light visual probes passed; five synthetic text-only captures inspected. Physical-device and release validation remain pending.
- Chat history: show the cached latest end before a slow refresh, retain preceding cached replies when opening an active turn, and prevent bounded background responses from dropping expanded pages while reading. Returning to Latest refreshes authoritative history; existing two-page opening defaults and expanded-cache metadata are preserved.
- Persistence: verified existing IndexedDB opening and beginning-page records survive a full browser restart and remain readable offline. Storage remains bounded and best effort; this does not guarantee every pagination request is persisted immediately.

### Features
- Background catalog: add ten original pinned React Bits effects (Prism, LightRays, GradientWaves, SideRays, RippleGrid, PixelSnow, Topography, Dither, Orb, Beams) and remove Aurora, LiquidChrome and FloatingLines, leaving 17 choices. Removed saved IDs fall back to DarkVeil. Preserve original shaders, lazy loading and shared appearance controls; adapt pause, pointer isolation, dynamic motion preferences and Strict Mode cleanup without new runtime dependencies. Ten actual shader previews and source/license records updated. Validation: nine browser tests covered all 17 renders/resizes/pauses, new-effect recoloring and accessibility transitions, settings persistence/migration and narrow layouts; five token/encoding checks, TypeScript/Vite build and 28-document link checks passed. Production chunks contain all ten additions and exclude the three removed effects. Synthetic previews/settings captures inspected; physical devices and publication remain unverified.
- Motion integration: pin Motion 14.9.1 and use its small React entry point for menu/scrim and tooltip entrances plus native-button icon press feedback. Cancel effects and restore inline styles on teardown or accessibility changes; retain immediate focus/actions and a visible fallback without Web Animations. Preserve transcript/composer identity. Dependency lockfile, license notices and docs/CHAT-MOTION.md updated. Validation: 11 browser scenarios, five token/encoding checks, TypeScript/Vite build and 28-document link checks passed; aggregate compressed JavaScript increased by 3,788 bytes over the preceding build. Physical-device validation and publication remain pending.
- Interaction refinement: expose separate chat-row actions on touch and desktop hover/focus, name the affected chat and operation in confirmations, add unclipped icon-rail labels, and unify selected/press/menu-sheet feedback. Preserve keyboard navigation, drafts, history identity and reduced-motion/forced-colors behavior. Keep deletion unavailable while mobile chats await agent approval; restore selected-menu accents overridden by shared materials. Public Pinterest interaction captures and React animation projects were reviewed; no animation dependency added. Sources and rationale: docs/CHAT-MOTION.md. Validation: 19 distinct browser scenarios, five token/encoding checks, TypeScript/Vite build and documentation links passed; synthetic phone and dark/light desktop captures inspected. Physical-device validation and publication remain pending.
- Settings: use quiet theme surfaces, group background controls around a live preview, clarify the selected effect and add restrained navigation/press transitions. Preserve existing preferences, keyboard focus, reduced-motion and forced-colors behavior.
- Validation: three history regressions reproduced before the fix; 25 distinct browser scenarios, 26 targeted unit/API checks, TypeScript/Vite build and 28-document link checks passed. Synthetic dark/light phone and desktop settings captures inspected. Physical devices and release packaging remain unverified; not published.

## [0.28.31](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.30...v0.28.31) (2026-10-31)

Published [v0.28.31](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.31) from [f0b24bf8baed6b9500d6e88f1568d7bfa3404a31](https://github.com/Evgenie-Myasnikov/pocket-code/commit/f0b24bf8baed6b9500d6e88f1568d7bfa3404a31) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 118. Both exact-source CI runs, 11 navigation/cache/board browser scenarios, three production glass scenarios and TypeScript/Vite build passed. All 142 shared web files and 400 source files match packages; 1816 decoded entries privacy-audited, APK signer unchanged. GitHub SHA-256 digests/sizes for all four public assets, exact source tag and branch ancestry verified. Physical-device and historical excluded navigation coverage remain unverified.

### Documentation
- Archive the complete UI card chronology after final release evidence exceeded its description limit; preserve source/release history and revalidate the shortened board snapshot.

### Bug Fixes
- Explicit chat opening now starts at the latest end with a two-page tail window and restores that end after cached history refresh, rather than restoring an old reading offset. Manual scrolling within an open chat remains available. Reproduced the stale position with a failing browser check; six cache/navigation/board lifecycle checks and TypeScript/Vite build passed. Published in 0.28.31.
- Simplify board header and canvas toolbar: remove individual glass shells, outer borders and shadows; align icons and spacing with quiet hover/selected states and 44px mobile targets. Six board layout/mobile lifecycle scenarios and TypeScript/Vite build passed; synthetic phone capture inspected. Published in 0.28.31.
- Mobile navigation: return to the ordinary Chats list after leaving a board conversation instead of automatically reopening its sheet. Retain the pinned board session and draft for explicit reopening. Reproduced with a failing sidebar-visibility assertion before the fix.
- Remove exterior composer shadows on phone widths from both form and backing layer, preserving glass blur.
- Validation: mobile board lifecycle and dark/light glass scenarios passed (three browser tests), TypeScript/Vite build passed; synthetic phone capture inspected. The older navigation-usability scenario was interrupted while awaiting obsolete takeover-dialog behavior and is not counted as passing. Physical-device confirmation pending; published in 0.28.31.

## [0.28.30](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.29...v0.28.30) (2026-10-31)

Published [v0.28.30](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.30) from [42f1b388835b533b4d774ebdbcbd79fe5f0ad789](https://github.com/Evgenie-Myasnikov/pocket-code/commit/42f1b388835b533b4d774ebdbcbd79fe5f0ad789) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 117. Both exact-source CI runs passed; three production blur, seven development surface and four cache/navigation browser scenarios passed, with TypeScript/Vite build. All 142 shared web files and 400 source files match packages; 1816 decoded entries privacy-audited, APK signer unchanged. GitHub SHA-256 digests/sizes for four public assets, exact source tag and branch ancestry verified. Physical-device appearance remains unverified; first uncached history remains provider-bound.

### Bug Fixes
- Cache two opening history pages (up to 200 messages) using existing bounded persistent storage and refresh them in the background. Four scoped cache/navigation browser checks passed for Claude/Codex and reading anchors.
- Restore composer and shared-surface blur in production builds: place standard `backdrop-filter` after its WebKit alias so CSS optimization retains the property Chromium applies. The previous development-only checks passed while emitted release CSS disabled blur.
- Validation: reproduced identical blurred/sharp pixels in the built app before the fix; three production browser scenarios now pass with over 99% edge attenuation, plus seven development surface/region checks and TypeScript/Vite build. Synthetic capture inspected. Added `npm run test:glass:release` to verify emitted CSS on a strict preview server. Physical WebView/phone confirmation remains pending; published in 0.28.30.

## [0.28.29](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.27...v0.28.29) (2026-10-30)

Published [v0.28.29](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.29) from [14b60c99dc71b1df7fab2301d0e6d885ac8ea8b3](https://github.com/Evgenie-Myasnikov/pocket-code/commit/14b60c99dc71b1df7fab2301d0e6d885ac8ea8b3) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android versionCode 116. Both exact-source CI runs, 42 scoped browser scenarios, 12 unit/privacy checks and TypeScript/Vite build passed. All 142 shared web files and 400 source files match APK/Windows/host; 1816 decoded artifact entries audited, APK signing identity unchanged. GitHub server-side SHA-256 digests/sizes for all four public assets, exact source tag and branch ancestry verified; latest-release API returns v0.28.29. First-ever uncached history remains provider/network-bound. Physical devices, older-browser fallback and historical excluded regressions remain unverified.

### Bug Fixes
- Desktop saved-chat navigation: reuse the mounted shared chat runtime, show existing cached history before network refresh and avoid repeating the health handshake on every switch. Preserve separate drafts, provider/new-chat/board-generation isolation, and stale-response guards; treat expired live-job links as saved history except pending-only sessions. New/uncached history still needs its initial provider response.
- Include same-ID streaming/compaction handoff, visibly translucent shared glass and removal of desktop search/provider trigger frame from the superseded unpublished draft.

## 0.28.28 (unpublished draft)

Superseded before publication by 0.28.29 to include saved-chat opening performance. Preserve the original v0.28.28 tag/source.

Source: [0a7650362a19991c0e7a7c4ccad2e884e3a2cc90](https://github.com/Evgenie-Myasnikov/pocket-code/commit/0a7650362a19991c0e7a7c4ccad2e884e3a2cc90) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android versionCode 115. All 142 shared web files and 400 source files match APK/Windows/host; 1816 decoded artifact entries audited, APK signing identity unchanged. 25 scoped browser scenarios, 10 unit/privacy checks and TypeScript/Vite build passed. Exact-source CI/publication verification pending; physical-device and historical coverage limitations remain explicit.

### Bug Fixes
- Streaming: reconcile completed assistant text against its previous content, including an existing empty item with the same ID. Consume the partial once across context compaction and suppress its stale-prefix snapshot while preserving Markdown identity and distinct messages with identical wording. Validation: reproduced the old duplicate with a failing browser assertion; eight scoped browser checks, five streaming/grouping unit checks and TypeScript/Vite build passed. Not published.
- Sidebar: remove desktop chat search and its collapsed shortcut/state; retain project filtering and direct chat navigation. Remove the provider picker trigger border while preserving its dropdown and focus. Validation: both scoped navigation/sidebar browser scenarios and TypeScript/Vite build passed; not published.
- Glass material: replace dense matte fills with shared translucent dark/light surfaces, a subtle theme-colored contour and restrained sheen across composer, menus, panels and message cards. Composer opacity changes from 76% to 42% in dark mode and 62% in light mode; preserve background-area opt-outs and opaque accessibility states. The browser blur was active, but the dense fill concealed its visual effect.
- Validation: a new backdrop-color transmission assertion failed on the published material (62 levels versus a minimum of 90); the revised dark/light material transmits 147/96 levels while reducing sharp backdrop edge energy by over 99%. Seven scoped browser checks passed, including real transcript pixels, access-menu diffusion, native pickers, independent background areas and forced-color fallback. TypeScript/Vite build passed; synthetic captures inspected. Physical WebView/phone verification remains untested; not published.

## [0.28.27](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.26...v0.28.27) (2026-10-30)

Published [v0.28.27](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.27) from [4b73034133c03aec845c516a0e62b2de1875a178](https://github.com/Evgenie-Myasnikov/pocket-code/commit/4b73034133c03aec845c516a0e62b2de1875a178) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android versionCode 114. Both exact-source CI runs, 24 scoped browser scenarios, five privacy-guard checks and TypeScript/Vite build passed. All 142 shared web files and 400 source files match APK/Windows/host; 1816 decoded artifact entries audited, APK signer unchanged. GitHub server-side SHA-256 digests and sizes for all four public assets, exact source tag and branch ancestry verified. Latest-release API returns v0.28.27. Known 320px minimum-size and physical/older-browser coverage limits remain below.

### Features
- Appearance: independently hide the animated backdrop behind the conversation, transparent controls/composer and chat sidebar with opaque theme surfaces. Preserve existing preferences and the global background toggle, keep the settings preview live and remove the shared shader when every relevant area is disabled. Validation: eight scoped browser scenarios passed for persistence/reset, older and malformed settings, independent region styling, all-off renderer removal, preview/color/pause and composer/menu diffusion. Physical devices remain untested; published as 0.28.27.

### Documentation
- Archive the UI card chronology to a linked history after source-validation text exceeded the description limit; preserve all earlier records and validate the shortened current board snapshot before publication. Packages exclude portable boards.

### Bug Fixes
- Desktop chat: hide the duplicate top title while the chat sidebar is expanded; keep overflow actions, restore the title when collapsed and preserve phone/board-chat navigation. Validation: seven scoped sidebar/board-chat browser scenarios and TypeScript/Vite build passed. Published as 0.28.27.
- Composer: move frosted glass into a separate backing layer so text behind the input is diffused without making the form a backdrop root. Portal the access menu to the document layer with retained outside-click, focus, resize/scroll positioning and keyboard selection/dismissal. Theme model/effort dropdowns through native base-select/picker support, with color-scheme and opaque accessibility fallbacks.
- Validation: 12 scoped browser checks passed for actual composer/menu backdrop pixels, themed picker opening/Escape, provider model/effort requests and quota geometry at 320/390/1440px. TypeScript/Vite build passed; synthetic captures inspected. Two existing Russian 320px size checks still fail their minimum 40px control assertion while page width and control bounds pass; retained unchanged and not counted as passing. Physical devices and older native-select fallback rendering remain unverified. Published as 0.28.27.

## [0.28.26](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.24...v0.28.26) (2026-10-30)

Published [v0.28.26](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.26) from [4ebb06acbcda63604e946f4968aa58dc234941f3](https://github.com/Evgenie-Myasnikov/pocket-code/commit/4ebb06acbcda63604e946f4968aa58dc234941f3) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android versionCode 113. Both exact-source GitHub CI runs passed; GitHub server-side SHA-256 digests/sizes for all four assets match the audited local packages. Direct binary downloads are delayed on the verification connection and are not counted as completed. Shared 141 web files and 400 source files match packages; 1812 decoded entries audited, APK signer unchanged. Eleven scoped browser scenarios and TypeScript/Vite build passed. Physical devices remain untested.

### Bug Fixes
- Backgrounds: remove the extra atmosphere radial gradient behind transparent live shaders, which added a gray/tinted haze absent from catalog captures. Preserve effect tint, intensity, masks and pause behavior. Regression reproduced before the fix; all 11 scoped background/sidebar/board-chat browser checks passed, including all ten effects under Strict Mode, resize and pause. TypeScript/Vite build and 28-document link checks passed; synthetic Galaxy preview inspected.
- Sidebar: include the separate 9px resize gutter from the unpublished 0.28.25 draft.

## 0.28.25 (unpublished draft)

Superseded by 0.28.26 before publication. Tag v0.28.25 retains its original sidebar-only source.

Release preparation: Android versionCode 112 on existing release/0.28.1; exact source and package/CI/publication verification pending.

### Bug Fixes
- Sidebar: reserve a separate 9px resize gutter so the divider and its pointer target no longer overlap the library scrollbar. Verified the original overlap with a failing geometry check; all seven scoped sidebar/board-chat browser scenarios and TypeScript/Vite build passed after the fix. Default/minimum widths, pointer routing, wheel scrolling, resize, keyboard and reset remain covered. Prepared for 0.28.25; publication pending.
- Local build validation: Android APK, Windows archive and host bundle assembled separately from published assets; 141 shared web files and 400 host/source files match, 1812 decoded artifact entries passed privacy checks. Packages retain version 0.28.24 and are explicitly unpublished working-tree builds; no update manifest or publication created.

## [0.28.24](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.23...v0.28.24) (2026-10-30)

Published [v0.28.24](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.24) from [09015512f22041ee7d9fed3adb3ebf941baaa8b3](https://github.com/Evgenie-Myasnikov/pocket-code/commit/09015512f22041ee7d9fed3adb3ebf941baaa8b3) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android versionCode 111. All four downloaded asset hashes and exact tag verified; 141 shared web files and 400 source files match packages, 1812 decoded artifact entries audited, APK signer unchanged. Exact-source GitHub CI, 37 scoped browser scenarios and 67 service/unit checks passed. Physical-device and historical broader test limitations remain as documented.

### Features
- Chat presentation: keep ordinary assistant text and images visible above one lazy Thinking disclosure for internal work. Retain the same Markdown identity through partial/final delivery; bound burst pacing and final drain, preserve graphemes, authoritative corrections, reduced motion and loaded-history snapshots.
- Typography: centralize prose/list/heading/code rhythm and icon roles; add persistent Golos Text/Manrope/System chat-font selection using bundled Cyrillic faces. Preserve text-size, line-spacing, alignment and Review font measurements.
- Backgrounds: replace eight removed effects with seven original pinned React Bits effects, retaining DarkVeil/Aurora/Iridescence for a ten-effect catalog. Use actual shader captures, lazy loading, bounded resolution, disabled pointer effects and working pause/cleanup; old removed IDs fall back to DarkVeil.

### Bug Fixes
- Composer: draw allowance around Send/primary Stop with separate center/rim/keyboard actions and hover percentage. Keep one phone footer row and full input width; soften header/composer blur to 14 px. Invalid usage payloads remain unavailable instead of crashing details.
- Sessions: resume saved chats without a manual PC-finished prompt. Allow independent interactive histories in one project; retain duplicate-writer/provider locks, server capacity and task-pipeline project isolation. Existing running turns still accept follow-ups.
- Reading and navigation: give the sidebar one full-height scroll area; retain the visible anchor while paginated Markdown finishes layout and cancel adjustment on manual input. Remove expired reveal wrappers when Markdown settles.
- Background settings: honor actual theme/custom color, remove static posters under active shaders, exempt the preview from embedded-background suppression, and keep a live sticky preview even when the chat background is disabled.

Validation: 37 scoped browser scenarios and 67 service/unit checks passed for the release candidate. The ten shaders passed Strict Mode render/resize/pause checks; synthetic captures inspected. Board schema/dependencies (42 cards), documentation links and 853 working-tree content checks passed. Existing rich-typography regression tests remain preserved; the new font-selection scenario is separate. Physical-device checks and historical broader settings/access-menu regressions remain unverified. Published as 0.28.24; downloaded files, source CI and exact tag verified.

## [0.28.23](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.22...v0.28.23) (2026-10-30)

Release source: [7837b2582e766e9f11fca2ffe51e55de76ebbaf9](https://github.com/Evgenie-Myasnikov/pocket-code/commit/7837b2582e766e9f11fca2ffe51e55de76ebbaf9) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android versionCode 110. Android/Windows/host packages verified: 124 shared web files and 402 source inputs match, 1748 decoded artifact entries audited; APK signer unchanged. Source CI passed. Sixteen scoped browser checks, one additional real browser audio playback probe, ten server/unit checks and 13 native policy checks passed. Physical Android audio remains untested. Published [v0.28.23](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.23); all four downloaded hashes and exact tag verified.

### Features
- Release verification: 16 scoped browser scenarios and 10 server/unit checks passed, including native speech; 13 Windows policy checks passed. Archive the existing UI card chronology to a linked history document to keep its current description within schema limits.
- Read aloud: add persistent System/Supertonic 3 engine and ten-speaker selection with Preview/Stop in appearance settings. Install the fixed model on the host with SHA-256 verification; generate audio in native workers and use the selected speaker in chat. Keep model weights separate from releases, retain model license, and allow only scoped authenticated API/native-bridge routes.
- Local speech evaluation: generated Russian Supertonic 3 samples for speakers 0/5 through sherpa-onnx 2.0.1; roughly 28 seconds of audio took 4.55/5.10 seconds on CPU. Model assets approximately 145 MB. Record model license, actual output rate and integration limits in `docs/LOCAL-SPEECH.md`; the selected backend is now connected through the optional local host integration below.
- UI: extend the matte composer material across headers/actions, menus/dialogs, settings cards/forms, supporting panels, navigation and board chrome. Shared radii, subdued depth and borderless surfaces replace luminous rims; retain field boundaries, focus and semantic states. Validation: 12 scoped browser scenarios passed in light/dark and narrow layouts; captures inspected.
- Appearance: add persisted Center/Left/Right positioning for transcript and composer. Validation: browser check verified actual positions and reload persistence.
- Transcript: combine intermediate text, reasoning and tool calls into one collapsed Thinking group per turn. Keep images and the final answer visible; preserve details on expansion. Validation: focused browser scenario and grouping unit check passed; TypeScript/Vite build passed.

### Bug Fixes
- Chat: disable transcript/header text selection; keep explicit copy/quote actions and editable text fields selectable. Validation: copy and draft selection browser check passed.
- Speech validation: four scoped browser checks, four server/native checks (including real WAV generation), model installation/extraction probe, 13 native policy checks and Windows build passed. Android device audio and subjective listening remain unverified.
- Read aloud: explicitly select ru-RU and an installed Russian voice for Russian text; handle delayed voice lists and cancellation. Validation: mocked browser synthesis test and TypeScript/Vite build passed. Actual device audio and missing Russian voice packs remain unverified; cloud TTS was researched but not connected.
- Frosted surfaces: add translucent backdrop blur to floating controls, board chrome, settings cards and supporting panels; keep foreground content sharp and provide opaque accessibility fallbacks. Validation: backdrop pixel comparison/header-control styles and three settings navigation scenarios passed.
- Header: match overflow button glass to title fill, edge, rounding and blur; remove luminous composer rim and lift the external quota ring by 16px. Validation: dark/light material equality checks and three quota layouts passed.
- Glass: increase backdrop diffusion and frosting beneath the composer; add a matching rounded title frame with opaque accessibility fallbacks. Validation: deterministic blurred-versus-unfiltered pixel capture and dark/light chat-menu scenarios passed.
- Composer: replace the white rim with a subdued theme-aware bevel. Place the visible quota ring 6px from the frame instead of measuring the gap to its button. Validation: three quota hover/details/draft scenarios passed at 320/390/1440px; dark/light material scenarios passed. Published in 0.28.23.

## [0.28.22](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.21...v0.28.22) (2026-10-30)

Source: [8fccb87b4ef4d5a9f48f52200f14f7eddfba7ef8](https://github.com/Evgenie-Myasnikov/pocket-code/commit/8fccb87b4ef4d5a9f48f52200f14f7eddfba7ef8) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android code 109; Android/Windows/host packages verified, 124 web files and 395 source files match, 1734 decoded entries audited; signer unchanged. Source CI passed. Published [v0.28.22](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.22); all four downloaded hashes and exact tag verified.

### Features
- Board: replace dots with a coordinate-aligned line grid that follows pan/zoom and adapts spacing at distant zoom.
- Backgrounds (correction): replace the initially added custom CSS approximations with ten original React Bits shader components alongside DarkVeil: Silk, Aurora, Iridescence, Gradient Blinds, Plasma Wave, Ghost Fibers, Flux Lines, Lightfall, Molten Metal and Prismatic Burst. Pin upstream source/license, lazy-load the selected effect and use actual rendered thumbnails; preserve saved settings and pause controls.
- Chat: soften the composer into rounded glass with a broad blurred bevel. Move account limits outside its upper-right rounded corner as a ring only; hover/focus shows the percentage and click opens quota details. Narrow layouts keep controls separate and retain the draft.

### Code Refactoring
- Unify menu, dialog, settings, board chrome, detail-panel and composer edges, radii and surface depth through shared material roles; retain compact navigation, palette colors, opaque accessibility fallbacks and avoid blur on repeated canvas cards. Document coverage in `.stitch/DESIGN.md`.
- Move remaining glass shadows, mask color and font weights into shared design tokens.

### Bug Fixes
- Improve running-status contrast on light palettes; retain stronger form boundaries and remove decorative grid in forced colors.
- Initial grid/material validation: 15 distinct scoped browser scenarios passed across background persistence/motion, grid, menus, divider/card scrolling, settings and palette contrast; four token unit checks, TypeScript/Vite build, board schema and documentation checks passed. Synthetic light/dark captures inspected.
- Correction validation: all 11 upstream effects rendered/resized in React Strict Mode without WebGL errors and stopped drawing when paused; background persistence, light/dark glass/menu checks, five board/chat-layout checks and quota hover/details/draft retention at 320/390/1440px passed. Four token unit checks and TypeScript/Vite build passed. Synthetic thumbnails and glass captures inspected.
- Quota regression suite: polling/provider-switch checks passed; the older layout test still expects a 48px Send target but the existing compact mobile style uses 44px. This assertion was retained and is not counted as passing.
- Follow-up: broader `chat-surfaces` test timed out waiting for the absent `.chat-context` header element; that suite was interrupted and is not counted as passing. Physical devices and a complete screen-by-screen interaction audit remain unverified. Published as 0.28.22.

## [0.28.21](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.20...v0.28.21) (2026-10-29)

Published [v0.28.21](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.21) from [5d1959e7f3c45e30f2d8461ba4bcd99332774fef](https://github.com/Evgenie-Myasnikov/pocket-code/commit/5d1959e7f3c45e30f2d8461ba4bcd99332774fef) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). Android versionCode 108. All four downloaded hashes, exact tag and both source CI runs verified; 93 shared web files and 360 source files match packages; 1,540 decoded artifact entries passed privacy checks. APK signing identity unchanged.

### Bug Fixes
- Release validation: seven scoped browser checks and one title unit check passed. Three broader assistant-chat checks failed on action-toolbar pointer interception and ambiguous background selectors; not counted as passing. Physical devices remain untested.
- Chat titles omit generated attachment footers; board conversations use the board name. Explicit project filtering is separate from the board/chat project, so opening a board no longer hides other recent chats.
- Tool rows: hide inline red error excerpts in collapsed command summaries; keep the failure status and full output inside the disclosure. Validation: focused browser check passed for collapsed/expanded diagnostics; TypeScript/Vite build passed. 
- Board/chat divider: replace the 4px idle and 6px accent stripe with one subtle 1px boundary aligned to the existing chat border, including stacked layouts. Keep the 12px resize target and keyboard/drag feedback; hover uses a neutral color.
- Validation: TypeScript/Vite build and five board/chat layout browser scenarios passed for drag, cancel, persistence, keyboard/reset, retained drafts, stacked bounds and local card scrolling. Synthetic layout captures inspected. 

## [0.28.20](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.19...v0.28.20) (2026-10-28)

Release source: [6dd748ca612a841c719d977db476d3703ef61fc0](https://github.com/Evgenie-Myasnikov/pocket-code/commit/6dd748ca612a841c719d977db476d3703ef61fc0) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). APK versionCode 107; Android, Windows and host packages built from this commit.

Validation: web/Android/Windows/host builds and source GitHub CI passed. Eight browser scenarios passed, including all seven scoped hover/chip/Review checks. Two broader transcript checks failed with the same command-title/menu-focus failures reproduced against the previous release source; not counted as passing. All 93 shared UI files and 455 host inputs match packages; 1538 decoded artifact entries passed privacy checks. Physical devices untested.

Published v0.28.20 (2026-10-28): https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.20. All four downloaded asset hashes match audited packages; tag points to exact source 6dd748ca612a841c719d977db476d3703ef61fc0 on release/0.28.1. Historical broader transcript failures and physical-device limitations remain as recorded.

### Bug Fixes
- Transcript: remove the per-turn changed-files summary chip; keep Review in chat actions. Validation: web build and two focused browser checks passed (edited answer without chip, ordinary Review). The broader transcript scenario stopped on its unrelated command-title expectation (npm run lint versus Ran command); not marked passing.
- Message actions: reveal the action toolbar on message hover or keyboard focus on fine-pointer desktops, reserving its space to avoid layout jumps. Touch controls stay visible. Validation: TypeScript/Vite build and two light/dark browser scenarios passed, covering idle, hover, focus and stable message geometry.

## [0.28.19](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.18...v0.28.19) (2026-10-28)

Release source: [5b0aa4658e30e6868419e662bef8b69a0ebf2e03](https://github.com/Evgenie-Myasnikov/pocket-code/commit/5b0aa4658e30e6868419e662bef8b69a0ebf2e03) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). APK versionCode 106; Android, Windows and host packages built from this commit.

Release validation: final 13 browser scenarios and source GitHub CI passed; 93 UI files and 455 host inputs match across packages; 1538 decoded artifact entries passed privacy checks. Physical devices not tested.

Published [v0.28.19](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.19) (2026-10-28). All four downloaded asset hashes match audited packages; tag points to source 5b0aa4658e30e6868419e662bef8b69a0ebf2e03 on release/0.28.1. Source CI and 13 browser checks passed. Physical devices not tested.

Pre-release local build 0.28.19 (2026-10-28), Android versionCode 106: web, Android debug APK, Windows x64 and host packages built successfully. All 93 shared UI files and 455 host files match current inputs across packages; 1538 decoded artifact entries passed the privacy audit. SHA-256 inventory: artifacts/build-0.28.19.json. Built from an uncommitted working tree; no release manifest, tag or publication created. Physical devices not tested.

### Features
- Appearance: add per-device background enablement, independent color, intensity and motion speed with live preview; phones default to a plain background, desktop defaults to enabled. Zero speed freezes motion; reduced-motion preference remains respected.
- Visual hierarchy: share text sizing for settings and chat lists, soften chat status presentation to running-title pulses, place desktop atmosphere behind the sidebar and strengthen glass composer edges.

### Bug Fixes
- Board chat Review: render the chat's diff panel above the board and phone sheet, and size it using the current desktop sidebar width. This fixes overlapping board controls and stale fixed offsets while preserving the draft on close. Review stays scoped to the visible chat; task-result dialogs keep their existing nesting.
- Board Review validation: TypeScript/Vite build and 10 focused browser scenarios passed, covering 1440/960px desktop layouts, 390px phone layout, resized panels, options/Back/focus, retained drafts and nested task review. Updated an obsolete keyboard-test selector to focus the current title control. Synthetic captures inspected; physical-device validation remains pending.
- User messages: place action controls below the content and allow wrapping so controls cannot squeeze a message into a narrow column on phones.

Validation: TypeScript/Vite build, four glass browser scenarios, background persistence scenario, four notification routing scenarios and eight notification unit checks passed. Updated obsolete notification test navigation/selectors to match the current UI. Physical device rendering and notification delivery remain unverified.

## [0.28.18](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.17...v0.28.18) (2026-10-28)

Release source: [5132e0852e95c2ab458f7f1016621401a0444536](https://github.com/Evgenie-Myasnikov/pocket-code/commit/5132e0852e95c2ab458f7f1016621401a0444536) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). APK versionCode 105; Android, Windows and host assets built from this commit.

Published [v0.28.18](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.18). All four downloaded assets match audited files; tag resolves to source 5132e0852e95c2ab458f7f1016621401a0444536 on release/0.28.1. APK signer matches 0.28.17. Final 12 browser scenarios and GitHub Public data checks passed; Android/Windows/host builds and 1534-entry decoded artifact audit passed. Physical-device rendering remains unverified.

### Bug Fixes
- Chat: repair the atmosphere selector that collapsed the background canvas to zero height; keep the visible background active with static reduced-motion and forced-colors fallbacks.
- Streaming: preserve revealed text across stale shorter snapshots and partial-to-final handoff; keep message identity stable when review actions appear. Final authoritative corrections remain supported.
- Composer: reserve a separate column for usage indicators so long drafts cannot overlap limits; remove the redundant desktop More update dot.

### Features
- Chat surface consistency: extend glass to user-message contents, attachments, plans, approval/question cards, queued drafts, menus and result/subagent panels; nested controls use tint without extra blur. Preserve transparent activity rows, media and semantic action colors. Validation: build and four focused browser checks passed; light/dark screenshots and forced-colors fallbacks inspected.
- Chat surfaces: add subtle glass composer, code blocks and desktop library, with progressive edge blur respecting reading mode, edge-fade opt-out and forced colors.

Validation: TypeScript/Vite build and 10 focused browser checks passed, including mobile/desktop geometry, streaming regressions and accessibility fallbacks. Synthetic screenshots at 390px and 1440px reviewed. Physical-device rendering remains unverified. Release preparation authorized.

## [0.28.17](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.16...v0.28.17) (2026-10-28)

Release source: [e3add0bc2f248f7b2be98fa8db0f41490572ecb9](https://github.com/Evgenie-Myasnikov/pocket-code/commit/e3add0bc2f248f7b2be98fa8db0f41490572ecb9) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). APK versionCode 104; Android, Windows and host assets built from this commit.

Published [v0.28.17](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.17). Downloaded APK, Windows, host and manifest match audited assets; tag resolves to [e3add0bc2f248f7b2be98fa8db0f41490572ecb9](https://github.com/Evgenie-Myasnikov/pocket-code/commit/e3add0bc2f248f7b2be98fa8db0f41490572ecb9) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1). APK signer matches 0.28.16; GitHub Public data checks passed.

### Features
- Chat library: persist Pocket Code chat names/removal and explicitly added project folders on the host; add context actions and keep all projects visible until filtered. Running titles pulse at a stable height without a duplicate running label.
- Chat surface: use assistant-ui Composer primitives with compact controls, attach projects through the plus menu, and remove desktop Back and provider/header selectors. Streamdown handles unfinished Markdown while preserving safe links, deferred images and letter reveal.
- Message actions: add voice dictation into the draft and native conversation branches for editing requests or regenerating replies. Keep source history intact, restore available attachments, reject unavailable boundaries/files, and preserve current model/access choices. Windows uses system dictation, Android the installed recognizer, and supported browsers their speech service.

### Bug Fixes
- Codex: include unknown top-level sources, continue beyond twenty listing pages and report stalled or bounded scans instead of returning a silently incomplete list.

### Documentation
- Explain dictation availability, separate conversation branches, current local attachment contents and unchanged repository files in both user guides.

### Validation
- TypeScript/Vite, Windows build, Android Java compilation and documentation links passed. 48 focused unit/API checks passed, including all three branch adapters and rejected Codex boundaries. Across focused browser runs, 24 scenarios passed for context actions, composer, dictation cancellation, edit/regenerate, Markdown, attachments, scrolling and draft preservation.
- Updated the follow-up fixture to supply the existing board-list endpoint and assert its search control after navigation instead of the removed duplicate heading. Compact-composer motion assertions were updated for the intentionally removed halo/wave design.
- Artifact privacy audit passed for 1,535 decoded/archive entries. Physical microphone/Android checks and live provider branch calls remain unverified; unsupported installed provider versions fail explicitly. Existing dependency audit reports nine advisories; bundle-size warnings remain.

## [0.28.16](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.15...v0.28.16) (2026-10-28)

Published [v0.28.16](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.16) from [8143f359e372797dc055de04f9f95024a177e057](https://github.com/Evgenie-Myasnikov/pocket-code/commit/8143f359e372797dc055de04f9f95024a177e057) on branch [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Added an assistant-ui external-store adapter with message copy, quote into draft, user-message reuse, Markdown export and optional browser speech synthesis. Existing provider transport, composer, board attachments, tools and history behavior remain authoritative.
- Added a lazy theme-colored React Bits Dark Veil background, paused for existing conversations and disabled for hidden/reduced-motion views. Fixed upstream immutable-texture resizing and Strict Mode context cleanup; retained bundled licenses.
- Reworked desktop navigation into a narrow icon rail and compact project/recent-chat list with project filtering. Search, collapse/width preferences, running status and drafts remain available.

### Validation
- 27 distinct scoped browser scenarios passed across chat actions, light/dark views, WebGL resize, reduced motion, hidden views, sidebar filters/collapse, streaming/manual scroll, board images/selection, phone conversation persistence, composer effects and compact header sizes. TypeScript/Vite build passed; physical devices and audible speech output were not tested.
- Dependency audit reports nine advisories in pre-existing package versions (three moderate, six high); the added assistant-ui packages are not listed. Broader dependency remediation is outside this UI change. Build retains its large-chunk warning.
- Historical-message editing, regeneration, branching, feedback submission and voice input still require provider/backend support. Android, Windows and host packages published; all four downloaded asset hashes, exact tag and both GitHub CI runs verified. 89 web files and 350 source files match; 1,504 decoded artifact entries passed privacy review; APK signer matches 0.28.15.

## [0.28.15](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.14...v0.28.15) (2026-10-26)

Published [v0.28.15](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.15) from [c75c544347bcd13d0cbb53f57ff7791301da1a81](https://github.com/Evgenie-Myasnikov/pocket-code/commit/c75c544347bcd13d0cbb53f57ff7791301da1a81) on branch [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Compact chat headers and shared chat/card/provider/access menu states distinguish selection, hover and keyboard focus. Gallery loading and errors reserve the same image geometry. Card Properties/Agent actions appear on selection or in the context menu.
- Open the current board-selection attachment to inspect object names and previews, then jump to its source while retaining the selection and draft. Sent messages keep their original context snapshot.
- Phone board chat opens in an adjustable sheet with remembered height, keyboard resizing and reset. Returning to the board preserves the mounted canvas and unsent draft.
- A compact result of the latest confirmed AI write shows affected objects and offers Show/dismiss. Reads, stale events and ordinary file refreshes do not produce AI results; this does not add cross-user undo.

### Bug Fixes
- Retained boards refresh MCP on re-entry from another section; overlaid chat and gallery preserve the current entry. Hidden views release their navigation and polling; Back closes the active chat menu before folding the sheet.
- A shared bounded limit of 64 version labels/branch mappings preserves growing release history; storage, APIs and UI reject overflow. Hosts before 0.28.15 require at most 40 entries per field.

### Documentation
- Updated the [compact design contract](.stitch/DESIGN.md) and [board behavior](project-boards/README.md), including primary design references, restrained motion, reduced-motion and forced-color behavior.

### Validation
- 41 distinct browser scenarios and 20 targeted unit/integration checks passed across the scoped runs. Checks include image drag, selection source jumps, saved chats, draft/canvas retention, keyboard navigation, narrow/wide layouts, menu themes, reduced motion, live feedback and version-limit roundtrips/rejections. The synthetic 400-card drag retained 400 metadata renders. Real MCP view control, hidden-request suspension, menu/sheet Back order, TypeScript/Vite, board schema/dependencies and links in 27 documents passed. Android/Windows/host packages passed: 86 shared web files and 342 source files match, 1,476 decoded artifact entries passed privacy review, and APK signer matches 0.28.14. GitHub CI, exact tag and all four downloaded asset hashes verified. Physical devices not tested.

## [0.28.14](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.13...v0.28.14) (2026-10-26)

Published [v0.28.14](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.14) from [dda92d893d5d4ae25f408b43c5e497c22541d01a](https://github.com/Evgenie-Myasnikov/pocket-code/commit/dda92d893d5d4ae25f408b43c5e497c22541d01a) on branch [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Drag the board/chat divider to resize either side; horizontal and stacked proportions persist separately. Keyboard resizing, cancellation and reset preserve the mounted canvas and unsent draft. The shared sidebar divider now keeps its full hit area inside the panel.
- The active Stop halo keeps its original breathing rhythm with stronger contrast, also applied around the composer frame. Input press or keyboard focus triggers one smooth outward wave without moving controls. Reduced motion, forced colors and stopping/unknown run states suppress decoration. Reference research and independent implementation are recorded in [Chat motion](docs/CHAT-MOTION.md).

### Bug Fixes
- Wheel scrolling over overflowing card text, metadata or editors stays inside that area, including its boundaries; empty canvas still pans and Ctrl+wheel zooms.
- Removed the separate dots button from embedded board chat. Existing actions remain on the title context menu and Shift+F10, including while the chat is busy. Regular chat menus remain available.
- Reused semantic canvas layer tokens without changing existing selection/cursor stacking values.

### Validation
- 27 distinct browser scenarios passed across targeted runs: divider drag/keyboard/cancel/reset/persistence, retained draft/canvas, local card scrolling, saved board chat, image drag and selection, live updates, sidebar, narrow/wide headers and accessible motion in light/dark themes. The 400-card drag retained 400 metadata renders. Four design-token checks, TypeScript/Vite, portable-board schema/dependencies and links in 27 documents passed; synthetic captures inspected. Android/Windows/host packages passed: 86 shared web files and 335 source files match, 1,462 decoded artifact entries passed privacy review, and APK signer matches 0.28.13. GitHub CI, exact tag and all four downloaded asset hashes verified. Physical devices not tested.

## [0.28.13](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.12...v0.28.13) (2026-10-25)

Published [v0.28.13](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.13) from [9ccb279e068b2aca074ad0dd40e21db57298d46d](https://github.com/Evgenie-Myasnikov/pocket-code/commit/9ccb279e068b2aca074ad0dd40e21db57298d46d) on branch [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Board MCP can read open view state and immediately control AI following, camera, focus, selection and fit. No user confirmation dialog: success requires the UI to report the resulting state. Commands target one current view/revision, expire without replay, and reject hidden, busy or disconnected canvases. Focus/selection show the real AI cursor; selected cards remain attached to board chat. These controls do not edit the board file.
- A compact MCP indicator reports the actual managed worker catalog and connection state. Shared board guidance documents the commands and distinguishes server readiness from a provider's cached tool list.

### Bug Fixes
- Reopening a board refreshes the native Codex client after all active turns finish, then resumes the same saved conversation on the next run. Correction to the 0.28.12 evidence: calling an existing tool after worker rotation did not prove discovery of newly added tools; an isolated native-client probe reproduced that cache limitation and verified reconnect with retained history. Active work is not interrupted.
- Removed repeated provider names/icons and empty reply header rows; accessible authorship and compact copy actions remain. Reserved space for rotating disclosure arrows to prevent narrow-chat overflow at large text sizes.

### Validation
- 37 targeted unit/integration checks and 17 distinct browser scenarios passed, including real stdio MCP/host/rendered-view control, result acknowledgement, stale/busy/hidden rejection, project isolation, exact saved history, compiled Windows route policy, two-viewer writes, mobile chat at 320/360/390/412 px, 8-22 px text and reduced motion. The 400-card drag retained 400 metadata renders. The installed Codex reconnect probe used a local synthetic model server only. TypeScript/Vite, portable-board schema/dependencies and links in 27 documents passed; synthetic captures inspected. Existing Review/attachment expectations were updated for their previously shipped menu/viewer behavior; disclosure overflow was reproduced against the prior source and fixed. Android/Windows/host packages passed: 86 shared web files and 334 source files match, 1,460 decoded artifact entries passed privacy review, and APK signer matches 0.28.12. GitHub CI, exact tag and all four downloaded asset hashes verified. Physical devices and live Claude/Copilot model turns were not tested.

## [0.28.12](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.11...v0.28.12) (2026-10-25)

Published [v0.28.12](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.12) from [58c9bbf50d4061a7a98021dc768969d87af71c7e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/58c9bbf50d4061a7a98021dc768969d87af71c7e) on branch [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Bug Fixes
- Opening or revisiting a project board refreshes its managed MCP worker and tool catalog from the current host package. Active calls finish before replacement; chat transport remains connected and uncertain writes are never replayed. Duplicate entry requests are idempotent; snapshot refresh and gallery navigation do not restart MCP. Failed replacement preserves the previous worker.
- New/resumed Claude, Codex and Copilot runs receive the managed board connection without rewriting saved provider settings. Windows permits the lifecycle endpoint; project scope and owner access remain enforced. Legacy sessions acquire the proxy on their next new/resumed run.

### Validation
- 49 unit/integration checks and four browser scenarios passed, including real MCP/host catalog notifications, operation draining, failed replacement, duplicate entries, project isolation, provider configuration and compiled Windows route policy. An isolated installed Codex client discovered and called MCP before/after board entry without a model turn or chat restart. TypeScript/Vite, portable-board schema/dependencies and links in 27 documents passed. Android/Windows/host packages passed: 86 shared web files and 330 source files match, 1,452 decoded artifact entries passed privacy review, and APK signer matches 0.28.11. GitHub CI, exact tag and all four downloaded asset hashes verified. Physical devices and live Claude/Copilot model turns were not tested.

## [0.28.11](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.10...v0.28.11) (2026-10-25)

Published [v0.28.11](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.11) from [942324eda501807ea3561c3bb921af02ed8a234d](https://github.com/Evgenie-Myasnikov/pocket-code/commit/942324eda501807ea3561c3bb921af02ed8a234d) on branch [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Open canvases show one cursor and affected-object highlights for actual MCP inspection, creation, movement, connections and save outcomes. The camera follows the latest target; pointer, wheel and keyboard interaction pause it, and a compact AI control resumes. Hidden/local-editing states suspend camera motion and reduced-motion focuses immediately.
- Board MCP adds a section overview, scoped object reads, explicit focus and sparse existing-object patches. Stable IDs, omitted fields, current revisions and creation context retain their existing protections. The workflow follows Miro's scoped search/read/patch pattern without connecting to Miro or replacing the portable JSON format.

### Bug Fixes
- Bounded, expiring activity history and waiting live reads deliver fast MCP phases to independent viewers. Windows and workspace read policies permit the live endpoint. Saved snapshots still wait for local drafts; generic file changes are never attributed to AI. Old hosts retain snapshot/legacy-marker compatibility.

### Validation
- Twenty browser scenarios and seven unit/integration checks passed, including real stdio MCP → authenticated host → two viewers, sparse-patch preservation, conflicts and failed saves, executed C# route policy, draft protection, manual camera pause/resume, reduced motion, gallery drag, selection and connector gestures. The Windows route failure was reproduced on 0.28.10. The 400-card drag retained 400 metadata renders. TypeScript/Vite, links in 27 documents and portable-board schema/dependencies passed; synthetic UI capture inspected. Android/Windows/host packages passed: 86 shared web files and 327 host source files match; 1,446 decoded archive entries passed privacy review; APK signer matches 0.28.10. GitHub CI, exact source tag and all four downloaded asset hashes verified. Published. Physical devices were not tested; shared unsaved editing/remote undo remain unimplemented.

## [0.28.10](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.9...v0.28.10) (2026-10-25)

Published [v0.28.10](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.10) from [511474afa033c5cfdc18f9df164525190bcf1db8](https://github.com/Evgenie-Myasnikov/pocket-code/commit/511474afa033c5cfdc18f9df164525190bcf1db8) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Bug Fixes
- Windows host replies preserve HTTP status separately from transport failures. An expired launch record falls back to the existing saved board conversation; HTTP rejections no longer mark a responsive host offline. Initialize the embedded project before launch lookup so unavailable sessions retain the correct board selection context. Keep unavailable conversation associations until explicit replacement.
- Board chat shows the board name without its technical revision. Regression coverage uses a real mouse drag from the gallery image into the restored chat and verifies selected-card context in the outgoing message.

### Validation
- Thirteen browser scenarios and seven unit/contract checks passed, including seven HTTP/transport outcomes executed through the actual C# Send implementation. TypeScript/Vite and links in 27 documents passed. The selection regression was reproduced against 0.28.9 and passed with the correction. Web/Android/Windows/host packages passed; 86 shared web files and 325 host source files match, all 1,442 decoded archive entries passed privacy review, APK signer matches 0.28.9. GitHub CI, exact tag and all four downloaded asset hashes verified. Published; physical devices not tested.

## [0.28.9](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.8...v0.28.9) (2026-10-25)

Published [v0.28.9](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.9) from [ee17e713a73f317700accccbdf968bb2642d0e58](https://github.com/Evgenie-Myasnikov/pocket-code/commit/ee17e713a73f317700accccbdf968bb2642d0e58) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- An image icon before Board Chat opens a gallery containing only the current board's unique image assets. Preview originals, drag them into the chat as unsent attachments, or use the keyboard/touch add action. Back restores the mounted canvas view. Thumbnails reuse the bounded loader/cache; image transfers retain connection/project access checks and the existing attachment limit.
- Current single-card or area selection appears as a separate composer context attachment. Each new message includes a bounded Board selection.txt snapshot; changed/cleared selection affects later messages, while delayed sends keep their captured snapshot. Account scope and private assignments are excluded from file contents. Shared board skill/provider guidance explains how to read selection context and request full current details through MCP.

- The compact desktop sidebar collapses to an icon rail and remembers its device preference. New chat and search sit above history; Rules, Changelog and Settings move into More. Collapse preserves the current chat/provider/draft. Keyboard shortcuts move to Settings → Windows application, with Ctrl+/ retained; PC connection controls remain in Settings.
- Active chat turns gain a subtle, fixed-size Stop halo inspired by AionUi's interaction pattern. It pauses for stopping/unknown connection states and is disabled by reduced-motion/forced-colors preferences; loaded history is not replayed and existing grapheme-safe text pacing is retained.

- Completed the applicable AionUi chat-motion mapping: empty-history shimmer skeleton, retargetable smooth follow/latest with manual interruption, live-message entrance, disclosure rotation/fade, active tool feedback and hover/focus/copy confirmation. Cached history retains its layout; reduced-motion and forced-colors suppress decoration. The implementation and pinned source comparison are documented in [Chat motion](docs/CHAT-MOTION.md).

### Breaking Changes
- Retired the in-app Inbox from desktop/mobile navigation, chat overflow and keyboard shortcuts, including board-notice polling. Chats always use the searchable list; the tile view and its switch are removed, and old grid preferences are ignored. Existing host records and compatibility APIs remain. Native chat notifications are separate.

### Validation
- TypeScript/Vite, eleven targeted unit/API/MCP checks and thirty-two browser scenarios passed in the release checkout. Motion checks cover clipboard contents, live versus loaded text, disclosure directions, intermediate scroll positions, manual interruption and reduced-motion at phone/desktop widths. Existing gallery/selection/sidebar/composer/header/persistence/live-board checks passed; the 400-card drag retained 400 metadata renders. Synthetic captures inspected. An obsolete Inbox expectation was updated for its intentional removal; a visual CSS name collision in disclosure arrows was corrected and its exact directions rechecked. Web/Android/Windows/host packages passed; 86 shared web files and 325 host/Windows source files match the reviewed inputs. All 1,442 decoded archive entries passed privacy review; APK signer matches 0.28.8. GitHub CI, exact source tag and hashes of all four downloaded assets verified. Published; physical devices and live model turns not tested.

## [0.28.8](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.7...v0.28.8) (2026-10-25)

Published [v0.28.8](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.8) from [85992202b853dd0f5b9a651dc8b6c6f3a4f9d36a](https://github.com/Evgenie-Myasnikov/pocket-code/commit/85992202b853dd0f5b9a651dc8b6c6f3a4f9d36a) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Board Chat resumes the conversation saved for that board after navigation or an app restart. More actions → New board chat explicitly replaces its generation; stale jobs cannot repin an older session. Private device storage is isolated by connection/account, project and board and never copied into Git boards. Pending jobs can resume; missing sessions remain pinned and block sending until an explicit replacement. Associations are installation-local, without cross-device synchronization.
- Shared provider guidance and the board skill require creation context, source references and open questions for new AI-created cards. Read full context and accessible sources before work; request clarification when needed without inventing history or exposing private conversations. The board MCP offers read_note_context for one complete card and bounded dependency summaries; no notifications are sent by this read.

- Visible boards refresh automatically using lightweight file stamps about once per second (older hosts/legacy boards: three-second full reads). Updates wait during local editing; revision conflicts still protect saves. MCP writes publish temporary object activity, shown as an AI marker near affected cards; generic file changes are highlighted without AI attribution. Hidden views pause polling. This is automatic snapshot refresh, not shared unsaved editing or simulated pointer motion.

### Breaking Changes
- Board MCP create_note requires context (summary, sources, optional questions); canvas_apply requires it when creating cards or sticky notes. Existing cards remain readable without invented retrospective provenance. Reload the updated MCP tool catalog.

### Validation
- Web build, seven persistence/live-API/MCP/provider-guidance tests and ten browser scenarios passed. Coverage includes mobile/desktop navigation and reload, explicit replacement, unavailable sessions, late-job protection, storage errors, host/project/account isolation and compact header regression. External updates, genuine MCP activity and deferred draft handling passed; the 400-card drag retained 400 metadata renders. Documentation links passed. Web/Android/Windows/host packages passed; 86 shared web files match and 1,430 decoded archive entries passed the privacy audit. APK signer compatibility, GitHub CI, exact tag and all four downloaded asset hashes verified. Packages published; physical devices not tested.

## [0.28.7](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.6...v0.28.7) (2026-10-25)

Published [v0.28.7](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.7) from [3cbbb0d493f82bae2bf205c3f387859734e8aa75](https://github.com/Evgenie-Myasnikov/pocket-code/commit/3cbbb0d493f82bae2bf205c3f387859734e8aa75) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Bug Fixes
- Board cards render 256 px thumbnails instead of full-resolution originals. A shared queue bounds original reads/decodes to two, deduplicates repeated references and caches up to 128 thumbnail blobs. One visibility observer serves all board images; leaving the viewport cancels pending work and releases each image URL. Full resolution is displayed only in the viewer. Initial thumbnail generation still downloads the source image; this is a rendering/memory improvement, not server-side thumbnail transfer.
- Opening a running chat follows its current answer even when an older history position was saved. Idle chats retain their message/text anchor. Live status is recognized from the current job or activity feed.

### Validation
- Web build, six position/preview API tests and three browser scenarios passed. A synthetic 2048×1536 image set verifies thumbnail dimensions, bounded reads, shared cache and full-size viewer loading; live opening and idle bookmark restoration passed. Web/Android/Windows/host builds passed; all 86 shared web files match. All 1,422 decoded package entries passed the privacy audit. APK signer compatibility, GitHub CI, exact source tag and hashes of all four downloaded assets passed. Packages published; no physical-device validation.

## [0.28.6](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.5...v0.28.6) (2026-10-25)

Published [v0.28.6](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.6) from [088a9b08f757fc59a93380c9858bb85252da1661](https://github.com/Evgenie-Myasnikov/pocket-code/commit/088a9b08f757fc59a93380c9858bb85252da1661) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Left-button dragging on empty canvas selects an area; Shift adds objects and reverse dragging works at any canvas zoom. Middle-button dragging pans from blank space or over objects without moving them. Touch pan/pinch remain supported; frame labels move frames while their empty interiors allow area selection.
- Selected groups move together. Ctrl/Cmd+A selects all, Ctrl/Cmd+C/V copy/paste within the open board, and Delete/Backspace removes the selection. Context menus preserve groups and provide copy, paste at the requested position and delete. Copies receive new IDs and retain internal visual links, ports, free ends, product card properties, image references and remapped dependencies; private assignments and chat associations are excluded. Capacity limits reject a paste atomically.

### Validation
- Web build, 17 model/geometry/persistence tests and 13 distinct browser scenarios passed, including group movement/copy/deletion, metadata, zoom, middle-button pan, Shift/Escape, Undo/Redo, connectors, pinch and the 400-card drag regression. Documentation links and synthetic selection screenshot checked. Android, Windows and host packages published; all 86 shared web files match. All 1,420 decoded package entries passed the privacy audit. APK signer compatibility, GitHub CI, exact source tag and hashes of all four downloaded assets passed. Physical devices not tested.

## [0.28.5](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.4...v0.28.5) (2026-10-25)

Published [v0.28.5](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.5) from [5de9ebe9c7e26cc81be574ce77021fb247eb369f](https://github.com/Evgenie-Myasnikov/pocket-code/commit/5de9ebe9c7e26cc81be574ce77021fb247eb369f) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Conversation controls use one row: Back, a flexible context chip and overflow. Review, outputs, subagents and the Git branch live in the overflow menu; menu height stays within the viewport. Transcript edge opacity follows a sampled quadratic curve, including the existing strength and reading-mode overrides.

### Bug Fixes
- Remove the duplicate command/timer status above the composer; tool details remain in the transcript and lost-contact warnings remain visible.
- Windows release and asset reads retry temporary network/HTTP 408, 429 and 5xx failures up to three times. Other HTTP failures stop immediately. Failed updates retain the target version, phase and sanitized failure/status codes without persisting exception text. The earlier reported failure cannot be attributed retrospectively because its details were not recorded; a later preparation of 0.28.4 reached the waiting-for-idle state.

### Validation
- Four Windows updater tests passed, covering unsafe archives, bounded retry, healthy handoff and failed-health rollback. Twelve browser checks passed for composer/inbox behavior, one-row headers at 320/390/1440 pixels and 60/130% scales, transcript geometry and reading-mode position. Web/Android/Windows/host builds passed; all 86 shared web files match. All 1,418 decoded package entries passed the privacy audit. APK signer compatibility, GitHub CI, exact source tag and hashes of all four downloaded assets passed. Packages published; no physical-device validation.

## [0.28.4](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.3...v0.28.4) (2026-10-25)

Published [v0.28.4](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.4) from [c04f358e1a1b5bc177d5fc4e16e8a62efa2b54f6](https://github.com/Evgenie-Myasnikov/pocket-code/commit/c04f358e1a1b5bc177d5fc4e16e8a62efa2b54f6) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Persist loaded chat pages and assembled history in a bounded 20 MB local cache, up to 5,000 messages per view. Revision sync transfers changed messages and preserves removals/order; unknown revisions and older hosts fall back to full pages. Access errors never fall back to cached responses. Reading positions retain a message ID, character and nearby text across reopening and wrapping changes.
- Activity inbox rows load the latest available chat image separately through authenticated preview endpoints. Inbox and Reading actions live in the chat overflow menu; the inbox removes its title, manual refresh, filters and legacy assignment section, retaining automatic updates, error retry and finished-result undo.

### Bug Fixes
- Canvas nodes and links memoize unchanged content and geometry; pointer previews update once per animation frame. A synthetic 400-card/399-link drag reduced metadata renders from 13,600 to 400 and total React render time from 701 ms to 98 ms in the measured run; this is not a physical-device FPS guarantee.
- Connection dragging requires a 180 ms hold and 5 screen pixels of movement. Selected line endpoints can detach, remain free, reconnect with the same ID, or cancel with Escape; Undo restores endpoints. Free endpoints require host 0.28.4+.
- Reading mode retains the measured header height while hidden, preventing scroll displacement on exit.

### Validation
- Web build, 22 targeted geometry/schema/MCP/history/authentication/privacy checks and 22 distinct browser scenarios passed, including 250-message offline reopening, text anchors, delta sync, image refresh, connector detachment and 60/100/130% header layouts. Documentation links and the portable board schema passed; synthetic screenshots inspected. Android, Windows and host packages published. All 86 shared web files match; 1,418 decoded package entries passed the privacy audit. APK signer compatibility, GitHub CI, exact source tag and hashes of all four downloaded assets passed. No physical-device validation.

## [0.28.3](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.2...v0.28.3) (2026-10-25)

Published [v0.28.3](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.3) from [15395d9ef269b7fb0b6fa971aecb90fb14f36beb](https://github.com/Evgenie-Myasnikov/pocket-code/commit/15395d9ef269b7fb0b6fa971aecb90fb14f36beb) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Bug Fixes
- Canvas connections start and finish at side midpoint ports. Mouse proximity reveals the point; drops on card bodies, corners or empty space do not attach. Keyboard connections also require a destination port; selected touch objects expose their ports.
- Saved links and drag previews share orthogonal routing with sharp elbows and outward side leads. Routes update with object geometry; legacy links infer midpoint ports without rewriting their data. Escape and pointer cancellation discard pending connections.

### Validation
- Web build, 17 targeted geometry/persistence/privacy/MCP tests and eight browser checks passed. Coverage includes all side pairs, narrow gaps, invalid drops, keyboard activation, Escape, persisted anchors, editing, undo/redo and 390/1440-pixel layouts. Synthetic screenshots inspected. Android, Windows and host packages published. All 86 web files match across packages; 1,408 decoded artifact entries passed the privacy audit. APK signer compatibility, GitHub CI and hashes of all four downloaded assets passed. No physical-device validation.

## [0.28.2](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.1...v0.28.2) (2026-10-24)

Published [v0.28.2](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.2) from [b7fb58c46c11d7fd4f0798b456c364ef96c70ffd](https://github.com/Evgenie-Myasnikov/pocket-code/commit/b7fb58c46c11d7fd4f0798b456c364ef96c70ffd) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Bug Fixes
- Canvas creation menus open on right-click or the keyboard context-menu key; left-click selects or clears selection. Links retain source/destination sides, preview from the chosen port and highlight the destination. Resize hit areas remain 20/28 screen pixels at every canvas zoom.
- Removed duplicate Rules/Changelog tabs inside the document library; file browsing remains a compact action. Existing unanchored links still load; anchored links require the updated host schema.

### Documentation
- Repository board cards are grouped in version frames with 11 reviewed historical synthetic UI screenshots. Local scratch canvas objects are excluded from the public snapshot.

### Validation
- Web build, 14 targeted canvas/persistence/privacy/MCP tests, six browser checks and the desktop document navigation check passed. The reported loading failure was not reproduced in those checks and remains open pending the failing screen/error. Android, Windows and host packages published. The audit of 1,406 decoded package entries, APK signer compatibility, GitHub privacy CI and downloaded asset hashes passed. Physical-device validation was not performed.

## [0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.28.0...v0.28.1) (2026-10-24)

Published [v0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.1) from [b8e800f51c283eea196e721fec080801d79fa5cd](https://github.com/Evgenie-Myasnikov/pocket-code/commit/b8e800f51c283eea196e721fec080801d79fa5cd) on [release/0.28.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/release/0.28.1).

### Features
- Boards use a single canvas; legacy tasks retain IDs, metadata, attachments and agent actions. Blank-canvas click/context menus create objects. Inline text editing replaces the object modal; edges/corners resize and four side ports create links. Persistent tools are undo, redo and fit; chat is an icon. Pinch and Ctrl+wheel zoom remain available.
- Existing visual links and orphan canvas cards survive migration. Invalid legacy references block writes instead of silently dropping data. Workspace boards now persist canvas geometry too; MCP card edits update their canonical task records.

### Bug Fixes
- UI scale now reaches fixed-size compact typography and controls, including provider menus and dialogs; canvas geometry retains its independent zoom. Native Windows page zoom is disabled and modified wheel input no longer changes page scale; Shift scrolling remains unchanged.
- Chat headers use the shared provider menu, rendered above the floating header so it is not clipped. Task undo restores metadata as well as geometry. Public snapshot checks include card descriptions, and chat context bounds their length.

### Validation
- TypeScript/web build and 13 targeted persistence, migration, revision, workspace, privacy and MCP checks passed. Seven browser checks passed for inline editing, corner resizing, port connections, undo, legacy card reopening, provider menu, pinch and 60/100/130% scale. Four design-token checks and documentation checks passed. Windows shell compiled successfully. Android, host and Windows packages published; 1,406 decoded artifact entries passed privacy checks. APK signer matches 0.28.0. All four downloaded release assets match the reviewed local files and manifest hashes; GitHub privacy CI passed. Not checked on physical devices. Legacy Tasks-view browser cases still need conversion to the new UI.

## [0.28.0](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.27.1...v0.28.0) (2026-10-24)

Published [v0.28.0](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.28.0) from [188bf9081df9caa2716d8451779563976624c116](https://github.com/Evgenie-Myasnikov/pocket-code/commit/188bf9081df9caa2716d8451779563976624c116) on [feature/whiteboard-0.28.0](https://github.com/Evgenie-Myasnikov/pocket-code/tree/feature/whiteboard-0.28.0). This publication record corrects the earlier unreleased label; it does not include subsequent 0.28.1 work.

### Features
- Boards: optional free canvas with sticky notes, text, frames, resize, group movement, arrows and view-local undo/redo. Existing task cards and dependency metadata remain intact. Desktop board discussions keep the board beside the chat; a bounded context snapshot is attached on the first send.
- Board MCP: scoped project aliases, reading, search and revision-checked card/canvas updates through the local host. The shared board skill documents the workflow. No cursor animation, realtime collaboration, deletion or publication tools are included.
- Providers: compact keyboard-accessible picker; encrypted local profiles for OpenAI-compatible text API chat, with model catalogs fetched from the provider. Custom API chat does not run project file tools.
- Appearance: ten paired light/dark palettes based on Radix Colors, consistent role mapping and verified text/button contrast. The composer keyboard hint is removed; board mode controls and desktop spacing are more compact.

### Bug Fixes
- Packaging: omit repository product boards from installed host bundles so an installation does not reappear as a duplicate project board. Board MCP is included in both host and Windows packages.

### Documentation
- Added board MCP usage, scope and limitations, shared board skill, palette sources and upstream license. Extracted `.stitch/DESIGN.md` from actual React/CSS using the Google skill. Updated the product roadmap with implementation and the remaining AI cursor stage.

### Breaking Changes
- Old hosts must be updated before opening files containing the optional canvas field. Existing task-only board files remain compatible.

### Validation
- TypeScript and web build passed. Targeted MCP stdio, board persistence/revision, provider catalog/error privacy, packaging and palette contrast checks passed. Live read-only MCP access was verified. Full unit run: 381/382 passed; the task-run concurrency timing case failed under load and passed when rerun alone. Browser regression: 41/41 passed; five focused grid/board checks and the context-attachment send check passed after compact-header changes. Documentation links passed. At source review time release artifact validation was pending. Publication followed as recorded above; physical-device validation remains unperformed.

## [0.27.1](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.27.0...v0.27.1) (2026-10-19)

Branch: codex/chat-grid-0.27.1 (from the published 0.27.0 source). Not released.

### Features
- chats: a List / Grid switch under the chat search shows chats as tiles with the chat's latest image, the start of the latest AI reply (plain text, clamped), the title, project and relative time or run state. The grid groups **By date** (Today, Yesterday, This week, Earlier) or **By project** (one section per project folder); both choices are remembered per device. Phone: two columns at 390 px, one at 320 px; the Windows window shows an auto-fill grid in the main area when no chat is open. Tiles show skeleton lines while previews load, text only without an image, and "No AI reply yet" when there is no reply. Tapping or pressing Enter on a tile opens the chat like a list row.
- host: `GET /api/sessions/previews?provider=&ids=` returns, for up to 48 listed chats, the latest assistant text (markdown stripped, about 400 characters) and only the name of the latest local or inline image; `GET /api/sessions/:id/preview-image` serves that image through the same session, permitted-folder and upload checks as message attachments. Remote image URLs are never chosen. Previews are computed only for tiles near the viewport, cached per provider, chat and last-modified time (500 entries), with at most three transcript reads at once; the chat list request is unchanged.
- boards: the floating zoom plaque (− / % / + / Fit board) is removed on phone and desktop; pinch and Ctrl+wheel zoom remain.
- chat header: the top edge is transparent again with the existing transcript edge fade; back, the title chip, inbox, Review, Results, Read and the menu are separate round floating buttons with their own blurred token surface and 48 px targets. Without backdrop blur, with reduced transparency or in forced colours they use a solid surface.

### Validation
- TypeScript check passed. Unit tests 374/374 on the first full run, including the new session-previews tests (text stripping, image choice, cache and concurrency, endpoint access checks with synthetic transcripts). A later run had 4 failures in task-runs/task-runs-api verification tests (spawned check commands timing out); those files are untouched here and fail the same way at 0.27.0 (fe7fee6) in a clean worktree.
- Browser: new chat-grid spec (6: phone 390 dark and light and 320 by date and project, preference persistence, keyboard open, header pills over a scrolled transcript, reduced-transparency/forced-colours fallback, desktop 1440 dark and light with cached previews) and edge-chat, compact-chat, work-boards, board-preview, desktop-ui, responsive-layout and mobile-menu pass: 124 of 127. The 3 chat-surfaces failures (header height 119 px against a 110 px limit) also fail with the 0.27.0 header styles and predate this work; work-boards, compact-chat, responsive-layout and chat-surfaces assertions were updated for the removed zoom bar and the title chip.
- Synthetic screenshots were inspected locally and are not published. Not checked on a physical Android phone or in the Windows application window.

- Release validation: TypeScript check passed; unit tests 371/374 in the full run, with the three task-run timing checks passing 19/19 when run alone. Android (versionCode 86) and Windows builds passed. Source privacy checks passed for 653 entries; decoded artifact audits passed for 386 host files, 517 APK entries and 483 Windows entries. APK signer matches 0.27.0. Downloaded GitHub assets match the manifest hashes and the exact source tag; GitHub privacy CI passed. Physical Android and Windows shell checks were not performed.
- Published [v0.27.1](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.27.1) from [5758303b8b7b760f12ce4a30ccd67cdb6177ecfe](https://github.com/Evgenie-Myasnikov/pocket-code/commit/5758303b8b7b760f12ce4a30ccd67cdb6177ecfe) on [codex/chat-grid-0.27.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/chat-grid-0.27.1); APK, Windows package, host bundle and update manifest are available.

## [0.27.0](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.9...v0.27.0) (2026-10-19)

### Features
- connection: show a connected-PC card on the phone with address, PC version, last contact, a latency check and copyable diagnostics; keep scanning a new QR as a secondary action.
- connection: explain pairing failures by cause (expired or used QR, rejected or unconfirmed device, device limit, localhost or LAN-only address, Android HTTP block, version mismatch, another service) with one next step each.
- connection: after the PC revokes this phone, show which PC disconnected it and how to reconnect; do not send the revoked key again.
- connection: "Disconnect and forget" now asks for confirmation, names the PC and lists what is removed; it is hidden when nothing is connected.
- security: a pairing QR stops working after one use and rotates; the PC can rotate it manually. Pairing through the internet tunnel waits for approval on the PC, and the desktop tray announces new or waiting devices.
- desktop: optional keep-awake while agents run or a phone is online on mains power; open the logs folder from the app.
- shell: the phone starts on Chats and uses a bottom bar (Chats, Board, Inbox, More) instead of the hidden section drawer; the bar is hidden inside a conversation, Back from Chats leaves the app and More holds Rules, Changelog, Settings and the PC connection with its state.
- shell: one conversation header with Back (showing the state of other chats), the title as a heading, a subtitle that picks provider and project in a new chat, and only applicable labelled actions; the separate project row and the "Workspace" divider are gone.
- inbox: a single app-level inbox and poll serve every bell; the badge counts only chats waiting for an answer, errors and unread board notices, while running work shows a ring and unseen results a dot.
- inbox: filters by action with counts (All, Needs you, Running, Done, Board) that always open on All, two-line rows with provider, project and relative time, status pills only for Needs you and Error, "Clear finished" with Undo and "Mark all read" for board notices.
- inbox: an error stays under Needs you until the task is restarted, the person writes in that chat or chooses Hide; a board question opens a reply sheet that adds the answer to the card, returns it to Ready and only then marks the notice read.
- chats: chats that need you from every provider are listed first, the rest are grouped by Today, Yesterday and Earlier with relative times and a status (Needs you, Running, Done, Error, Stopped); provider chips replace the select used as a title and "New chat" is a labelled action.
- status: one run-status vocabulary and theme tokens with at least 4.5:1 contrast in light and dark themes, always paired with an icon shape, shared by the phone list, the PC window, the inbox and the tab dots.
- accessibility: inbox rows are named by title, status, provider and project; filters and provider chips are labelled groups with pressed state; status dots carry hidden text; every section has an h1.
- desktop: Ctrl+N starts a chat in the current project, Ctrl+Tab/Ctrl+Shift+Tab switch chats, Ctrl+Alt+U opens the inbox and Ctrl+/ lists the shortcuts; the inbox is marked current while open and the chat list stops highlighting a chat when another section is shown.
- transcript: activity rows name what was done ("Read form.ts", "Search “validate” in src", the command itself in monospace, "Edited form.ts +2 −1", "Playwright · Screenshot") from one registry for Claude, Codex and Copilot tools, with explicit running, error, denied and no-matches states; a failed call shows its last error lines without opening the row, and opened rows show a diff, the command with its output or labelled fields instead of raw JSON.
- transcript: related calls group by meaning ("Explored 5 files · 2 searches", "Ran 3 commands"); a plan update does not split a group. A Brief/Detailed switch (menu "⋯" in the chat header, Ctrl+O on the PC; Brief by default on the phone, Detailed on the PC, stored per device) folds each turn's routine work into one line while errors, questions and running calls stay visible.
- transcript: tool output shows the last 12 lines with "… N more lines", ANSI codes removed, Copy command and Copy output, and a red stripe for errors; agent and web results keep Markdown.
- transcript: TodoWrite/update_plan render as a checklist, and a "Plan 2/5 · current step" bar above the composer opens it while a plan is unfinished.
- transcript: a turn that edited files ends with a "Changed N files · +a −b" chip that opens Review; the running row shows an m:ss timer and a finished turn shows its end time and duration when it was watched live.
- transcript: one round "latest" button with a count of new replies replaces the two wide pills and fades while scrolling; "Go to beginning" moved to the header menu, and tapping the chat title does the same. In reading mode the exit button sits bottom-right, clear of copy buttons.
- markdown: code blocks show their language and a Copy action; table cells keep whole words and the table scrolls instead.
- transcript: background-task notices appear as a centred event line with expandable details instead of the person's message bubble.
- subagents: calls and results pair and group inside the agent panel, the result is pinned first with a chevron, the task is a two-line quote with Show more, cards show a chevron and the status uses one vocabulary (Working, Done, Error, Stopped) with shared status colours.
- results: one scrolling filter row with an Agent/Mine segment, the count in the title, generic items named after their file, paths relative to the project and plain status text ("Found in the full history · N").
- approvals: a permission request reads as an action: "Run this command?" with the command and its purpose, "Create file X?" with path, line count and foldable content, "Edit file X?" with a diff, and labelled fields for other tools; raw JSON moves under Details.
- approvals: "Deny…" can send a comment that the agent receives with the refusal; "Allow these in this project/chat" applies exactly the rules the provider suggested (Claude) or a session-wide approval (Codex); an approved Claude plan is shown as Markdown with "Run, accept edits", "Run, ask before edits" and "Revise the plan".
- approvals: a request now waits until it is answered or the run stops. Settings → Messages and approvals can set a 10-minute or 1-hour limit instead; then the card counts down and the transcript notes when a request timed out and was denied.
- composer: messages waiting to be sent appear in one "Waiting to send" block above the composer with Edit, Delete and Send now; a Claude follow-up joins the transcript only when the agent takes it, and after Stop undelivered follow-ups stay listed as "Not delivered".
- composer: while a turn runs, Send says what it does (Queue for Claude and Copilot, Steer for Codex); with an empty draft its slot holds a single filled Stop, which shows "Stopping…" and ignores repeated taps.
- composer: an access chip (Ask, Edits, Full, Plan for Claude; Ask, Auto, Full for Codex) sets the mode for this chat over the Settings default; Full is marked with the warning colour and needs a second tap the first time; Claude applies Ask, Edits and Plan inside the running turn.
- composer: every file gets its own card with upload progress, a named error and Retry; files pasted or dropped during an upload wait in line; a paste over 10,000 characters becomes a text attachment with "Insert as text"; a tray with more than two files shows how many.
- composer: on short screens (keyboard open) the files fold into an "N files" chip, the welcome block hides and the toolbar stays visible; the welcome folds as soon as something is written.
- desktop: Enter sends and Shift+Enter adds a line by default in the Windows window (a setting on both platforms), a hint shows the send key, Esc stops a running agent, Up in an empty field brings back the last message, Ctrl+Shift+M/I/E open the access, model and effort pickers, and files dragged from Explorer drop onto the composer.
- composer: the run status line sits above the composer with its timer, "last activity N s ago" after a silence and the Esc hint on the PC; it hides while a card asks for a decision.
- review: Split is two equal halves that wrap long lines; a new default Auto layout uses Split from a 900 px panel and Unified below; Split is unavailable (with a hint) when a side would be under about 40 columns, so a saved Split on a phone shows one column.
- review: changed words inside a replaced line are highlighted in both layouts; hunk headers read "Lines 14–27 · function" and are hidden for new or deleted files; "20 more context lines" and "Whole file" expand unchanged code.
- review: phones wrap long lines by default (Wrap lines setting), line-number gutters fit the real digit count with the +/− sign in its own column and one number column on narrow panels; Fit to width never shrinks below 60% and the unreadable 4–8 px code sizes are gone.
- review: each file has its own horizontal scroller with a sticky name and line numbers; reading mode keeps a strip with the current file.
- review: file statuses (New, Deleted, Not in Git, Binary, Generated) and real line counts for new files; binary files show "—"; lock, minified and linguist-generated files start collapsed and are not loaded until opened; an Ignore whitespace option is remembered.
- review: a file list (bottom sheet on the phone, a 240 px column on wide Windows panels) with Viewed checkboxes, Collapse/Expand all and "Viewed 3/7"; Viewed folds the file, is kept per PC, repository and comparison, and is cleared with a "Changed since viewed" chip when the agent edits the file again; Next marks the current file viewed and moves to the next unviewed one.
- review: tap a line number (Shift+click for a range, long-press on code) and "Ask the agent" adds `path:Lnn` with the quoted lines to the chat draft while Review stays open; Copy is offered too. The user still sends the message.
- review: one 48 px toolbar holds the file count, Auto / 1 / 2 layout and Refresh; the options sheet no longer repeats them, uses row toggles, a remembered file-type chip grid and the repository name instead of a raw path; the header shows repository, subfolder, branch and comparison.
- review: the Review button shows the change size (+42 −7, a dot on narrow phones); the "Changed N files" chip under a turn opens Review filtered to that turn's files with "Show all"; on Windows Ctrl+Shift+D opens Review, N/P move between files, V marks viewed and Ctrl+B switches columns.
- boards: create notes with **+ Note** in the board header, a **+** beside each column heading or the empty-board **Create note** button; long-press on the canvas stays as a shortcut.
- boards: move a note between versions without dragging, through the note **Version** field or **Move to version…**; the note lands at the bottom of that column.
- boards: long-press or right-click on a note or board card opens an action menu (Open, Move to version…, Prepare task, then Delete… after a separator) instead of going straight to deletion.
- boards: the note dialog is a bottom sheet on phones with a fixed header, close button and Cancel/Save footer, and **Note / Agent** tabs; text areas, the **Attach images** button with drop support and round remove controls match the other fields.
- boards: each card shows the stage of its latest AI task (Prepared, Working, Needs you, Checks, Ready for review, Approved, Error) and opens the task result; gallery cards show the most urgent stage per project from one request.
- boards: floating zoom controls (−, percentage that resets to 100%, +, Fit board); a dragged card lifts above its neighbours; the board name leads the header with the project and Git state below.
- tasks: the task result shows a stage pill and a Working → Checks → Ready for review → Approved stepper, "Updated N s ago", next-step buttons (Fix failed checks with the output tail, Address my notes, Prepare merge) that open the task chat with a draft, and one-tap card status suggestions with an evidence line.
- tasks: the run list names the provider, relative time and passed checks; the provider defaults to the one last used for the project or chosen in the app; a check is entered as one command line (quotes group words, no shell) or a JSON array.
- tasks: a prepared task chat shows a task card (title, branch, criteria, "send to start") instead of the generic welcome and starter suggestions that could replace the task prompt, and the chat title is the task title.
- Miro: the gallery card has a surface, a Miro mark and badge; a slow load keeps a status line with Retry and Open in browser; touch devices open a quick read-only view with **Edit in Miro**.
- documents: Rules, Changelog and Files are tabs of one library with a shared project picker; Files returns with a themed preview (rendered/raw Markdown, wrap, find in file, images in the shared viewer). Same-named projects are told apart by the nearest differing folder.
- documents: rule files show which provider reads them (Claude, Codex, Copilot: reads, not read because CLAUDE.md or AGENTS.override.md exists, for files matching a scope, or only when linked); Copilot instruction files and .claude/CLAUDE.md are found; a "What the agent sees" view lists each provider's chain with missing standard files, the Codex 32 KiB budget and long CLAUDE.md warnings, and "Check rules" opens a new chat with an audit prompt that asks for a report without changes (the chat itself has normal permissions).
- documents: relative links open the linked project document (Back returns to the source and its position) or the file preview; #anchors scroll; repository images load on request. Long documents get an outline (sheet on phones, side column on wide screens) and Back to top; changelog versions fold (Unreleased and the latest open) with expand/collapse all and version chips.
- documents: the reader keeps about 72 characters per line, with an "Aa" menu for wide text and size; code blocks follow the text size and have Copy and Wrap with an edge fade; tables scroll instead of breaking paths.
- documents: the built-in board rule is one card with a switch that saves optimistically (Saving…/Saved, rollback on failure) and is not shown in the reader, errors or the empty state. Projects with only the built-in rule are listed last; without authored rules the empty state names the supported files and offers "Create AGENTS.md with AI" in a normal chat.
- settings: phone and Windows settings are built from one section registry (groups PC · Agents · This device · Integrations · About, unique icons, where each setting is stored). Rows show the current value (PC and connection state, installed or available version, provider and access mode, tightest limit, theme/palette/text size, notification choices); an available update puts a dot on Settings. On wide Windows windows the sections stay listed on the left with the page on the right; re-selecting Settings or Ctrl+, returns to the start, and Esc or Alt+← goes back.
- settings: Windows now has the Codex access mode, the Claude spend limit and Notifications; the values are device defaults that open chats pick up at once. AI account pages have one Back button named after the parent, a provider segmented control and no empty Copilot access page (Copilot asks per tool in the chat).
- settings: each access mode is a card with a one-line consequence; Full access is marked with a warning colour and icon on both platforms. Sign-in shows a spinner, the chosen method and Cancel sign-in (new host endpoint that closes the sign-in window), refreshes every 2 s while waiting, and calls the methods Switch account when already signed in; sign-out confirmation is a danger action.
- limits: remaining allowance turns amber at 25% and red at 10% with an icon; resets read "Resets in 1 h 48 min · today at 18:40" with the full date on hover; a marker shows the elapsed part of the window and "ahead of pace" appears when usage runs ahead of time. A limits overview lists every provider's tightest window; the composer ring and Copilot follow the same colours. An optional line above the composer warns at 75/90/100% used or ahead of pace, can be hidden until the next level and says when the limit is restored (provider data only, no extra polling).
- appearance: a pinned conversation preview (user message, agent reply with code, tool activity), Dark/Light/System and Compact/Standard/Large segmented controls, exact sliders under More with a changed-value dot and per-setting reset, and a text Reset button with Undo that also resets reveal speed, edge fade and board grid.
- settings: one Notice style (info/success/warning/error with icon and action) for statuses; Miro shows the linked board with Change link and a confirmed Disconnect, Sign in again when signed in, and chevron disclosures; Windows connection toggles are switches.
- connection: one reachability model and supervisor for the PC. Every request reports into it; while the PC is away one /health probe runs with backoff (1, 2, 4 … 30 s, ±20 % jitter) and the other polls pause; the network coming back, returning to the app or Retry probe at once, and one "recovered" event re-reads /health, clears connection errors and refreshes chats, boards and the open chat immediately. The device heartbeat follows app visibility; the Android chat watcher backs off (up to 60 s) after failed polls.
- connection: one compact, opaque status line under the header (and on the phone chat list) replaces the stack of offline/history/network banners: "The PC is not answering · data from 14:32", "The tunnel answers, the PC host does not", "No network", "Connecting to the PC…", with Retry and the detailed reason under the chevron; it folds into a chip after a few seconds. Network failures are no longer repeated in the red composer alert, and history refresh failures are shown once in the transcript status line.
- connection: Send follows the connection: without the PC it is disabled with "No connection to the PC · the draft is kept", and the takeover question is never asked first. In a chat this phone already continues, a message written offline waits in "Waiting to send" ("Sends when the PC is back online", Edit / Don't send, in memory, at most a day) and leaves by itself when the PC answers; new chats are never queued.
- connection: a running turn without contact (two missed polls or an unreachable PC) shows "Status unknown · last update N s ago" without the writing animation, and Stop becomes Retry connection.
- connection: lists know about the connection: chats and boards show skeletons until the first answer, "The chat list loads when the PC is back online" / "Boards are not available offline yet" with Retry instead of "no chats/boards yet", Add project board explains it needs the PC, and the gallery reloads when the PC returns.
- windows: host states arrive as codes and are localized by the window (no English sentences or .NET exception text); a host that does not answer is reported once as "The PC host is not answering. Reconnecting…", the footer turns amber with Reconnecting…, the host status shows a spinner and the next attempt time, and Restart PC host sits next to Open logs folder. Tray texts follow the interface language.
- windows: a crashed interface process reloads the window once automatically, a hung one asks "Reload the window?" (the host and tasks keep running), and a lost browser process recreates the WebView; events go to desktop-window.log.
- updates: Windows shows the version as a chip, a download bar with MB and percent, and the tasks that hold the restart by name; the duplicate "App updates" heading is gone. The phone update card has one title with the source as a caption, the version and size, an APK download bar, an explanation for Allow installation, and its own opaque surface over the chat.
- android: alerts use separate channels for questions and approvals, errors and completed runs, so finished runs can be muted; when Android stops background tracking after its daily limit a quiet notification says how to resume.
- performance: Review, Results, Subagents and the document library load in their own chunks (main chat chunk 363 kB); the offline cache keeps a small index so eviction never parses cached values and unchanged answers are not rewritten.
- design system: one token file (src/tokens.css) with semantic status families (success, warning, danger, info, review, running) that each have text, tint and border steps for dark and light themes; run statuses, board statuses and priorities, task stages, notices and Review diffs are aliases of these families, and the running colour follows the palette accent.
- design system: component CSS no longer contains raw hex colours (about 350 literals moved into tokens or replaced by roles; a unit test blocks new ones), field borders use an --input role with at least 3:1 contrast, shadows, scrims, weights and global layers come from tokens, and spacing, radius, motion and icon scales are defined for gradual migration (chat and composer first).
- themes: hue palettes are generated in OKLCH with fixed lightness and chroma per role (even accent contrast across hues, HSL fallback for older WebViews); Neutral is now a warm grey and Ocean a teal blue so they no longer read as Codex and Copilot; a browser test checks text, muted, accent, field-border and status contrast for all 20 theme × palette combinations.
- typography: weights match the loaded faces (400/500/600, Manrope 700), interface text never drops below 11 px on the phone and 12 px on Windows at 100 %, uppercase labels share one tracking value, changing numbers use tabular figures, and code, diffs and the terminal fall back to the bundled JetBrains Mono (with Cyrillic) on phones instead of an arbitrary system monospace, while Windows keeps Consolas so Review column widths do not change.
- appearance: the preview shows inline code, a code block, a quote, a tool row and the composer; palette swatches show the background and accent of the current theme; compact spacing is a switch and the board grid step shows px; controls keep a readable width on Windows; new Contrast (Match system / Standard / High) and colour-blind (blue/orange) options, with High applied automatically when the system asks for more contrast.
- icons and motion: one stroke width for all icons (LucideProvider), icon sizes on a 14/16/20/24/32 scale, provider marks drawn as monochrome SVG instead of shared Unicode glyphs, a press/hover state layer instead of a brightness filter that was invisible on light palettes and absent on touch, and motion tokens (Material 3 curves, 100/200/300 ms) for transitions.
- android: the launcher uses the adaptive pocket-shield icon with a monochrome layer for themed icons, the splash shows the same mark on a day/night background, template splash images are removed, and status/navigation bar icons and the window background follow the app theme (saved for the next cold start).

### Bug Fixes
- i18n: restore the Russian follow-up recovery message and the external-image button label that were saved as question marks in 0.26.9.
- pairing: treat a 401 as device revocation only from the health and heartbeat checks, so a Jira or Miro sign-in error no longer unpairs the phone and wipes its cache.
- chat: a Claude follow-up rejected with 409 is resent after the turn ends only if the draft is unchanged; an edited draft stays unsent.
- claude: send a request budget within $0.10–$100, falling back to $5 when the field is empty or zero.
- task runs: tie the result-polling lock to its own request so a remount or mutation cannot leave polling stuck.
- desktop: rename the failed chat status class so the global error banner style no longer turns it into a pink block.
- chat: show tool output as preformatted monospace text instead of Markdown, keeping line breaks and "> command" lines intact.
- chat: place the conversation header on an opaque band so titles and controls no longer print over messages, including with edge fade off.
- chat: stop showing "update the PC server to enable Codex" while offline or in Claude/Copilot chats when provider status is simply not loaded yet.
- chat: the conversation header band is opaque by default (translucent with blur only on desktop with edge fade on), gains a hairline once the transcript scrolls under it, and the edge fade now holds its floor across the measured header height.
- inbox: background polls no longer flash "Loading processes…", re-render the app or announce through a status region; Refresh spins while loading and Retry is a regular button with the time of the last update.
- inbox: tapping a board notice shows progress immediately and ignores repeated taps.
- engine updates: browsing another provider's chats no longer changes which engine the PC checks for compatibility; only changing the setting in Settings → Updates sends it.
- cleanup: removed the unused mobile workspace header.
- shell: while the inbox is open on the phone, only Inbox is marked as the current place in the bottom bar; the PC connection entry under More is marked current when shown.
- inbox: if an answer to a board question was saved but marking the notice read failed, the sheet no longer reports a send error that would invite a retry and add the answer twice.
- desktop: Ctrl+/ no longer opens the shortcut list on top of another dialog, and chat rows no longer announce their run state twice.
- i18n: the empty local-history hint in a chat is translated to English again for every provider.
- transcript: reasoning stays open while it is the newest block of a running turn and folds into the activity line when the turn moves on (previously the activity group always rendered it folded).
- transcript: the chat "⋯" menu moves between items with the arrow keys, Home and End, and closes when Tab leaves it.
- composer: a follow-up refused while Claude finished its turn is kept as it was written and sent after the turn ends; text typed meanwhile stays in the field (previously the retry sent whatever was in the draft). The waiting message can be edited back into the draft or not sent, and returns to the draft on Stop or when leaving the chat.
- composer: the message field is no longer disabled while sending, so the Android keyboard stays open and focus returns to the field; a disabled Send stays visible as an accent outline.
- questions: an agent question no longer opens over a composer that is focused or has text; it waits as a banner ("Claude asked 2 questions") and focus returns to its Answer button after closing. Options no longer inherit a 22px label gap, and option text and notes are at least 13 and 12px.
- pickers: model and effort selects sit at their content width and look inactive during a run with a hint; the effort default reads "Default" instead of "—" and its label is translated; a custom Claude model ID field is focused at once, applies on Enter and has a primary Apply; the catalog notice is a button.
- i18n: a unit test fails on "???" inside t() keys or translations and on U+FFFD in sources; .editorconfig keeps files UTF-8.
- agents: a denial now reaches the model in neutral English ("The user denied this action.") with the person's comment, instead of a fixed Russian phrase.
- composer: a failed or pasted-text file card keeps its name inside the card, and Retry / "Insert as text" respond across the card instead of a 32px line; the waiting-to-send actions, the files toggle and the catalog notice are at least 44px.
- i18n: errors from withdrawing a queued message or changing the access mode after the run ended are shown in Russian.
- tests: approval-decision and no-timeout question checks wait for the run instead of relying on millisecond timing.
- review: polling compares a cheap comparison fingerprint and per-file fingerprints, so an unchanged repository no longer re-downloads every visible patch every 5 s, and idle polling slows to 15–30 s until something changes or the person interacts; single-file requests no longer list branches or rescan the whole project.
- review: the summary counts filtered files ("5 of 14 files", "—" after a failed load) with plural forms; empty, all-filtered and error states offer Compare with the main branch, Show all types and Retry; Git errors from the PC are translated; loading uses skeleton bars and one status region instead of one per file.
- review: diff colours are theme tokens with readable light-theme values, counters use tabular figures, and Split marks changes with a sign, a 3 px edge, hatched empty cells and screen-reader text; the diff uses an explicit monospace stack so a Russian page no longer pushes text past the row background.
- review: all Review controls are 48 px; the reading-mode exit is a bordered 48 px button at the bottom right.
- review: the Viewed checkboxes in file headings and in the file list are 48 px targets; N/P/V and Ctrl+B no longer act on a Review left open in a hidden Windows chat or under another dialog; the turn filter reads "Only files from this turn" (every turn has its chip) and says when that turn's files no longer differ; a long-press on code survives small finger movement and a re-render during the hold.
- boards: Back and Escape close board dialogs first, then return from the board to the gallery instead of leaving to Chats; a changed note asks before discarding; focus returns to the card; the open board survives switching tabs; the delete-board and Miro disconnect dialogs are modal.
- boards: status and priority colours are theme tokens with at least 4.5:1 contrast in the light theme, statuses are tinted pills with a dot, and the dotted/dashed/thick top edge is visible again; thumbnails use the same tokens and an empty board draws dashed columns.
- boards: **Refresh board** is no longer hidden on phones, and the board and its task stages are re-read when the app returns to the foreground (no new polling interval).
- tasks: a failed check no longer claims the working copy changed (the host reports `snapshotCurrent` for any outcome); the failure is shown once with the command name and exit code, failed output opens by default and check statuses and host task messages are translated.
- tasks: check setup moves below results and approval, collapsed once commands exist; disclosure rows have chevrons.
- ui: destructive buttons use the danger colour everywhere, not only on the devices page; board dialogs stack above the phone tab bar.
- tests: the StrictMode task-result harness, full-app task, work-board and maintenance-board scenarios open the Board tab from the current navigation.
- tasks: next-step drafts (Fix failed checks, Address my notes, Prepare merge) are added after the unsent chat text instead of replacing it, and on Windows they also reach a task chat that is already open from the board.
- boards: the note sheet's **Cancel** asks before discarding a changed note, like Back, Escape and the close button; the zoom buttons are 44 px targets.
- boards: the gallery task stage matches projects whose path the host reports with backslashes or a trailing separator, and a stale stage from a previous load or PC is cleared.
- Jira: Settings → Jira and the PC pairing page link are hidden until issues have a place in the app; FEATURES and USABILITY no longer promise Jobs or a PR workflow. The kept connection page no longer repeats its title, translates Connect, offers Retry when the status read fails, explains where to sign in outside Android and shows Reset sign-in only after a sign-in started.
- documents: an open document is re-read only when it changed (the host answers "unchanged" for the shown version) instead of being re-sent every 15 seconds; refresh is labelled for the document or the list and spins while loading; loading uses skeletons.
- documents: Claude is shown as not reading AGENTS.md when .claude/CLAUDE.md or CLAUDE.local.md exists, not only a root CLAUDE.md. On Windows, the sidebar Rules and Changelog buttons switch the library back from the Files tab, and a later New chat no longer inherits an unsent "Check rules" or "Create AGENTS.md" prompt; on phones these actions no longer replace the open chat's draft while a message is being sent.
- documents: a host error with a JSON reason (HTTP 5xx) keeps that reason instead of the generic tunnel message; document errors use the danger colour instead of an undefined token, and the file browser and preview use theme tokens instead of dark-only colours.
- settings: the Claude spend limit is typed as a draft and saved on Enter or leaving the field, clamped to $0.10–$100 with the reason shown at the field, with $1/$5/$20 presets; chats clamp it again before sending, and a host 400 names the setting with an Open budget settings link instead of a generic request error.
- updates: on Windows a failed or paused update offers Retry, an offline host explains why checking is unavailable with Open connection; AI compatibility uses product names, one checkbox style and polls only while visible; the GitHub source is titled From GitHub. The unused phone host-update component was removed and USABILITY now describes PC update progress as a Windows-app view.
- i18n: settings screens use t() only (no language ternaries), "Back" and the access, reveal speed, edge fade and grid labels are translated, category rows are named by their title and described by their value, and a unit test fails when a Russian t() key has no English value.
- settings: Windows switches show their on state and keep their size (the theme's text-field style had flattened them into empty pills); on the phone Back/Esc from an AI account page returns to the AI accounts list with focus on the row it came from; a cancelled sign-in window that closes after a new sign-in started no longer resets that new sign-in; no double divider above the Claude spend limit.
- offline: a tunnel answering 502–504 or Cloudflare 520–530 (or a non-JSON page) for a cacheable read now shows the saved boards and health like a dropped connection instead of an empty "no boards" screen; a JSON error from the host stays a host error.
- offline: the chat no longer advises "update the PC host to enable Codex" while the PC is unreachable; that notice appears only after /providers answered and names the selected provider. A chat that is not cached says it loads when the PC is reachable (with Retry), and the false "history refreshes every 3 seconds" and "Beginning of chat" lines are gone offline.
- i18n: the offline, history paging, restore-connection and workspace messages use t() with English values (no inline language ternaries or English-only errors), and a unit test guards the connection and update screens.
- connection review fixes: saved data shows when the PC last confirmed it (an unchanged answer no longer leaves "data from" at the time of the last change); the phone connection line and its Retry are 48 px touch targets; the Windows chat shows a host error from a chat read again (it had no line after the banners were merged); Esc while the run status is unknown retries the connection instead of sending Stop; the tray menu (Open, Connect / disconnect, Exit) follows the interface language; Restart PC host waits for a running host check so the host is not started twice.
- design system: the global alert class is now .error-banner and statuses are passed as data-status, so an error chat row on Windows no longer turns its dot and label into a brown alert box; the same applies to subagent, device, connection and rule-chip states.
- light themes: agent quotes use the text colour with an accent rule, conversation date rules, the provider mark and former dark-only literals follow the palette, --border and --error are defined, and an empty board note shows its "Add details…" hint as a muted italic placeholder (on Windows only on hover or focus).
- design system review fixes: a device waiting for confirmation keeps its accent status colour on Windows (its rule still used the old class); the Windows chat-list caption, connection line, empty-chat hint and shortcut keys no longer render below 12 px, and phone captions, labels and the legacy bottom bar no longer fall to 10 px, so the 11/12 px text floor holds; a unit test blocks class-based rules for statuses that moved to data-status.

### Documentation
- board: add changelog evidence to five recent done cards and a review card for this work.

### Validation
- TypeScript check passed; no remaining question-mark placeholders in src. Browser scenarios passed: device pairing (including a Miro 401 that keeps the pairing), follow-up composer and task pipeline (12), edge/compact chat layout (7). Transcript specs tool-activity/activity-groups/rich-updates/chat-surfaces show the same 5 failures with and without these changes (height and navigation assertions). Device checks not run.
- Connection area: TypeScript check and unit tests passed (332/333; the board-evidence test failure predates this work). 48 of 52 browser scenarios passed across connect-usability, device-pairing, qr-routing, workspace-recovery, settings-navigation, language and desktop-ui; qr-routing, settings-navigation and workspace-recovery fail identically on the previous commit, and the desktop note-deletion scenario passed on rerun. The C# shell was not compiled; no physical Android or Windows checks.
- Shell and inbox area: TypeScript check passed; unit tests 333/334 (the board-evidence failure predates this work; new badge-count test added). Browser: mobile-menu, notification-placement, section-header, notification-center (incl. new badge, reply-sheet and Undo scenarios), edge-chat, compact-chat, desktop-ui, language, connect-usability, settings-navigation, followup-composer, workspace-recovery, responsive-layout (now 72/72) and 25 other updated specs pass. Still failing and also failing on the previous commit: chat-recovery reading mode, chat-surfaces (3), navigation-usability, chat-pc-scope, attachment-tray (2), codex-access selection, copilot-provider, workspaces histories, ui QR image, usage-limits failed refresh. workspaces preference reload failed 1 of 10 repeated runs (intermittent).
- Shell and inbox review fixes: TypeScript check passed; unit tests 333/334 (same pre-existing board-evidence failure). Browser: mobile-menu (with the new inbox current-place check), notification-center, notification-placement, desktop-ui, section-header, responsive-layout and language pass (126/126). A local phone (390px, Russian, dark and light) and desktop (1440px) probe found no horizontal overflow, no sub-44px targets and no untranslated interface text.
- Transcript area: TypeScript check passed; unit tests 337/338 (the board-evidence failure predates this work; new registry, grouping, brief-summary and turn-change tests). Browser: new transcript-review (2), tool-activity, activity-groups, chat-outputs, subagents, chat-typography (now passing), ui, chat-recovery, live-presentation, rich-updates, activity-plain, responsive-layout, transcript-follow, edge/compact chat, desktop-ui, output-index-scope, questions-dialog, mobile-menu and language passed, except failures that also occur on the previous commit: chat-recovery reading-mode offset, chat-surfaces header height (3), chat-performance grouped command rows and the browser QR scan button in ui.spec.
- Transcript review fixes: TypeScript check passed; unit tests 337/338 (same pre-existing board-evidence failure). Browser: transcript-review (3, including new live-reasoning and menu-keyboard checks; the live-reasoning check fails on the previous commit) and 85 of 91 in tool-activity, activity-groups, chat-outputs, subagents, chat-typography, chat-recovery, live-presentation, rich-updates, activity-plain, transcript-follow, chat-surfaces, desktop-ui, chat-performance, ui, edge-chat and compact-chat; the 6 failures (chat-performance grouped rows, chat-recovery reading-mode offset, chat-surfaces header height ×3, ui QR scan) fail at the same assertions on the commit before the transcript work. A local phone (390px) and wide (1440px) probe in Russian and English found no horizontal overflow and no new sub-44px targets.
- Composer area: TypeScript check passed; unit tests 341/342 (the board-evidence failure predates this work; new approval-decision and text-encoding tests, follow-up API test updated for the queue). The desktop shell compiles with the WebView2 SDK. Browser: followup-composer (5, rewritten for the waiting block, queue actions, Stop, access chip and approval comment), new composer-attachments (3), questions-dialog (7, including banner focus and no-timeout requests), claude-models, codex-effort, composer-refinement (11; the letter-fade timing check passed on rerun), claude-access, usage-indicator, compact-chat, edge-chat, responsive-layout (72), desktop-ui, language, settings-navigation, mobile-menu, live-presentation, transcript-review, tool-activity and rich-updates pass; failures that also occur on the previous commit: attachment-tray (2), codex-access selection, chat-surfaces header height (3), ui QR image and workspace-entry (2). The final composer reruns used the mocked API only, because another local process held the fixture port. No physical Android or Windows checks; the push before an approval expires is not implemented.
- Composer review fixes: TypeScript check passed; unit tests 341/342 (same pre-existing board-evidence failure). Browser: composer-attachments (3, with a new card-target check that fails on the previous CSS), followup-composer (5), questions-dialog (7, twice), claude-models, composer-refinement (11), compact-chat, edge-chat, language, responsive-layout, desktop-ui, settings-navigation, claude-access, usage-indicator and mobile-menu (110) pass; attachment-tray (2) and codex-access selection fail identically on the commit before the composer work. The composer-refinement letter-fade check is timing-sensitive and failed in some loaded runs on this branch; it passed 6/6 when repeated alone and in the full file. A desktop probe confirmed Esc in the chat search does not stop a running agent while Esc in the composer does. Undelivered follow-ups left after Stop are still dropped when a new message starts the next run.
- Review area: TypeScript check passed. Unit tests 343/348 in the full run: the board-evidence failure and four task-run verification timing tests also fail on the previous commit under full-suite load (that commit: 336/342), and the task-run files pass 19/19 when run alone; new word-diff, hunk-label, file-status, fingerprint, whitespace/context and change-size tests pass. Browser: new review-workflow (9), review-file-list (3), review-focus (10), review-performance (4), review-settings, transcript-review, responsive-layout (64), desktop-ui and codex-access passed; chat-surfaces (3), codex-access workspace-switch and navigation-usability failures also occur on the previous commit. Documentation screenshots were not regenerated.
- Review fixes: TypeScript check passed. Unit tests 341/348: the board-evidence failure and six task-run verification timing tests; these task-run tests also fail when run alone on the commit before the Review work (1–4 per run), so the earlier "19/19 alone" result did not reproduce. Browser: review-workflow (11, two new: hidden-Review keys and 48 px Viewed targets, and a turn whose files no longer differ; the hidden-key check fails without the fix), review-file-list, review-focus, review-performance, review-settings and transcript-review (32), responsive-layout and desktop-ui (101) pass. A Russian 390 px and 1440 px probe in light and dark themes found no page overflow and no other sub-44 px Review controls. No device checks.
- Boards and task runs area: TypeScript check passed. Unit tests 340/349: the board-evidence failure and eight task-run verification timing tests also fail on the previous commit in the same full run (that commit: 337/348); new column-slot, failed-run snapshot and result snapshot tests pass. Browser: task-pipeline (12, including new StrictMode polling, failed-check and command-line tests and the two full-app task scenarios that failed before), work-boards (6, four new: draft protection with Back/Escape and tab switching, column + / Version / Move to version, zoom/fit/phone refresh/foreground refresh, card task stage), maintenance-board (3, failing before because of stale navigation), board-example (now passing with the restored status edge; one repeat hit a Windows EBUSY cleanup of its temporary folder), board-gallery, board-preview, miro-mobile, miro-ai-settings, desktop-ui (37), language, responsive-layout and notification-center (119 together) pass. Synthetic phone screenshots in dark and light themes were inspected for the board, note sheet, Agent tab, gallery and task result.
- Boards and task runs review fixes: TypeScript check passed. Browser: work-boards, task-pipeline, maintenance-board and desktop-ui pass (61); the new desktop and phone next-step draft tests, the gallery backslash-path test and the Cancel step of the draft-protection test fail on the previous commit and pass now. Unit tests 339/349: the board-evidence check, the manual-checks API test and eight task-run verification tests fail, and the same task-run and API tests fail on the previous commit when run alone.
- Documents and Jira area: TypeScript check passed. Unit tests 339/350: the board-evidence failure and ten task-run verification timing tests fail the same way on the previous commit in a full run (338/349); new Copilot/.claude discovery, reader-label, frontmatter-scope, unchanged-version and hidden-Jira pairing-page checks. Browser: project-docs (11, new empty state, built-in rule card, relative links/anchors, Files tab preview and error-token checks), document-library, desktop-ui (37), jira-ui (with a new hidden-by-default check), jira-existing, jira-pc-setup and settings-navigation pass, except the known settings-navigation:19 failure. Synthetic phone screenshots in dark and light themes were inspected; documentation-screenshots' QR connection capture fails on the connection screen, outside this area.
- Documents and Jira review fixes: TypeScript check passed. Unit tests 338/350: project-docs passes with new .claude/CLAUDE.md and CLAUDE.local.md reader checks; the failures are the board-evidence check, ten task-run verification timing tests and one Windows host-dispose timing test, none touching documents. Browser: project-docs, document-library and desktop-ui pass (49); the extended desktop Rules/Changelog test fails on the previous commit at the Files-to-Changelog switch and, without the New chat reset, at the inherited audit prompt.
- Settings area: TypeScript check passed; unit tests 359/360 (the board-evidence failure predates this work; new registry, budget parsing/clamping, usage tone/pace/narrowest-window, limit-level, out-of-range budget API, sign-in cancel and translation-key tests). Full browser run: 275/363 passed; 64 responsive-layout failures were an outdated nine-section count that also fails on the previous commit (updated to eight, 64/64 pass). Of the remaining failures, attachment-tray, chat-pc-scope, chat-performance, chat-recovery, chat-surfaces, desktop-ui (hidden-return), documentation-screenshots, navigation-usability, usability, workspace-entry, copilot-provider, run-notifications (desktop provider), ui (QR image) and workspaces fail identically on the previous commit; compact-chat and notification-center were updated for kept dated usage and the More disclosure and pass. Settings specs (appearance-controls, claude/codex access, desktop-ui, direct/engine/host updates, language, Miro, review-settings, settings-navigation, ui appearance, usage-limits with a new composer limit-warning scenario) pass.
- Settings review fixes: TypeScript check passed; unit tests 359/360 (only the pre-existing board-evidence check fails). Browser: settings-navigation (Back/Esc now steps through the AI accounts list), desktop-ui (new switch size and checked-colour check), codex-access, usage-limits, appearance-controls and review-settings pass (54); a computed-style probe showed the switch at 30 px with the panel colour while checked before the fix. Synthetic 390 px phone and 1440/900 px Windows settings screens were inspected in dark and light themes. Not covered by an automated test: the sign-in cancel race (needs the Windows sign-in window).
- Platform area: TypeScript check passed; unit tests 365/366 (only the pre-existing board-evidence check fails; new reachability, backoff, gated-poll, tunnel-502/530 cached-read, offline-cache index and connection-screen localization tests). The Windows shell compiles with csc and the WebView2 SDK; the Android Java changes were syntax-checked with javac only (no Android SDK here, not built or run on a device). Full browser run: 340/363; of the 23 failures, 21 fail the same way on the previous commit (attachment-tray, chat-pc-scope, chat-performance, copilot-provider, documentation-screenshots, navigation-usability, run-notifications, ui QR image, usability touch targets, workspace-entry, workspaces, chat-recovery reading mode, chat-surfaces, rich-updates), and the two regressions found (desktop idle-return scroll, board gallery Escape) were fixed by not re-rendering on every successful request and pass. Re-run after the fix: chat-recovery, direct-update, host-updates, desktop-ui, work-boards, followup-composer, connect-usability, device-pairing, edge-chat, compact-chat, document-library, subagents, chat-outputs, review-workflow and task-pipeline 117/118 (only the pre-existing reading-mode check), and the new connection-status spec (tunnel 502 → one line, Send disabled with the draft kept, Retry recovers) passes.
- Platform review fixes: TypeScript check passed; unit tests 365/366 (only the pre-existing board-evidence check fails; the offline-cache test now fails without the cache-age fix). The Windows shell compiles with csc and the WebView2 SDK (tray menu and restart guard not run on a desktop). Browser: connection-status, chat-recovery, desktop-ui, followup-composer and work-boards 57/58 (only the pre-existing reading-mode check); a synthetic 390 px probe confirmed the offline follow-up waits in "Waiting to send" and leaves when the PC answers, with 48 px status buttons, and the 1440 px layout was inspected.
- Design system area: TypeScript check passed; unit tests 368/370 in the full run (the pre-existing board-evidence check and one task-run timing test that passes 14/14 when its file runs alone); new design-tokens unit test (no hex literals in component CSS, weights and layers from tokens, no bare status classes or global .error, complete semantic families). Browser: new design-tokens spec (contrast for 20 theme × palette combinations plus high-contrast and colour-blind layers; equal PC status rows in both themes) passes; full run 344/366, and all 22 failures also fail on the previous commit when the same specs run there (attachment-tray, chat-pc-scope, chat-surfaces, usability, workspace-entry, workspaces, copilot-provider and others). Tests that parsed computed colours as rgb() now resolve them through a canvas (OKLCH palettes); the board-grid test expects "8 px" option labels. Android resources and Java changes were not built or run on a device.
- Design system review fixes: TypeScript check passed; unit tests 367/370 in the full run (the pre-existing board-evidence check plus two timing tests in run-notifications and task-runs that pass 8/8 and 14/14 when their files run alone). Browser: design-tokens (new text-size floor check at 1440 px and 390 px, which failed on the previous commit with an 11.9 px connection line), appearance-controls, desktop-ui, chat-typography, subagents, device-pairing, compact-chat and edge-chat 61/61; a probe confirmed High contrast and colour-blind mode change field borders, muted text and status colours for every named palette in both themes.

- Release validation: TypeScript/Vite, unit tests (all passed), Android (versionCode 85) and Windows builds passed. Source privacy checks passed for 648 entries; decoded artifact audits passed for 383 host files, 517 APK entries and 480 Windows entries. APK signer matches 0.26.9. Downloaded GitHub assets match the manifest hashes and the exact source tag; GitHub privacy CI passed. Physical Android and Windows shell checks were not performed.
- Published [v0.27.0](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.27.0) from [df3bc03f66bb3c5fb19e14ec38e373bafdb7e91a](https://github.com/Evgenie-Myasnikov/pocket-code/commit/df3bc03f66bb3c5fb19e14ec38e373bafdb7e91a) on [codex/review-0.27.0](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/review-0.27.0); APK, Windows package, host bundle and update manifest are available.

## [0.26.9](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.8...v0.26.9) (2026-10-14)

### Bug Fixes
- claude: render background-task notifications as compact status cards with task count and readable summary instead of raw transport markup.
- chat: recover Claude follow-up drafts that race turn completion by refreshing the exact job and continuing after it ends; cancel recovery on explicit stop or chat switch. Release stale model and effort locks after completion.

### Validation
- Six synthetic notification parser assertions passed; GitHub Public data checks passed.
- TypeScript/Vite build and two focused browser scenarios passed, including clarification during active Claude/Codex turns and automatic recovery after Claude closes input. Updated an obsolete test navigation selector. Android and Windows builds passed. Privacy audits passed for 611 source entries and decoded artifacts (320 host files, 501 APK entries, 387 Windows entries); APK signer matches 0.26.8. Live model turns and physical Android checks were not performed.

## 0.26.8 (Unreleased)

### Features
- appearance: add a per-device chat edge-fade intensity control from 0 (off) to 100%, shared by mobile and desktop. Preserve transcript geometry, reading mode and forced-colors accessibility.
- notifications: combine chat processes, statuses and board notices behind the bell, with All / Processes / Notifications filters. Remove the separate activity handle/drawer; share desktop activity with the embedded chat so viewing a result updates the bell immediately. Keep questions actionable, failed opens unread and stale refreshes visible with Retry.

### Documentation
- guide: document the unified inbox, viewing/acknowledgement behavior and edge-fade setting in English and Russian.

### Bug Fixes
- images: render the shared full-screen viewer at the document root so chat edge masks and stacking contexts cannot reveal the underlying interface. Keep its background opaque and suspend focus/Back handlers in underlying inert dialogs while preserving zoom and focus restoration.

### Validation
- Image viewer, 2026-10-12: reproduced inherited transcript masking before the fix. TypeScript/Vite and 19 distinct browser scenarios across focused runs passed, covering mobile/desktop viewport coverage with fade on/off, attachments, nested Results, board images, zoom/pinch/pan and focus restoration. Updated Results selectors for the root-level viewer and inspected a synthetic phone capture. Physical-device verification remains pending.
- Validated 2026-10-12: TypeScript/Vite build, 61 distinct browser scenarios across focused runs, five activity-state tests and documentation link checks passed. Covered cross-provider navigation, acknowledgement only after viewing, errors/retry, inbox filters, desktop feed sharing, fade persistence/geometry, narrow layouts, reading/forced-colors modes and header alignment. Updated obsolete drawer/navigation selectors in tests; inspected synthetic inbox captures. Physical device verification and release remain pending.

## [0.26.7](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.6...v0.26.7) (2026-10-12)

### Features
- chat: extend the transcript behind floating header and input controls, with gradual alpha fades at both edges. Measure control heights to keep the first and last messages readable as drafts, alerts and viewport sizes change; preserve reading/high-contrast modes and shared desktop navigation.
- android: enable edge-to-edge rendering with Capacitor safe-area handling, retaining system-bar and keyboard space for interactive controls.

### Bug Fixes
- chat: observe transcript padding changes and distinguish layout-driven scroll clamping from intentional history reading, so growing/shrinking drafts and keyboard-sized viewports retain follow mode.

### Validation
- Validated 2026-10-12: 49 distinct browser scenarios passed across focused runs, including 320/390/1280px overlay geometry, growing drafts, 400px keyboard-sized viewports, simulated safe areas, manual scrolling, reading/high-contrast modes, attachments, navigation, aligned headers and desktop integration. TypeScript/Vite and Android builds passed; synthetic phone/desktop captures inspected. Initial checks exposed padding-observation and resize-following defects, which were fixed. Physical Android keyboard/system-bar behavior remains unverified; not released.

- Release validation: all 49 browser scenarios passed in one run from the release checkout. TypeScript/Vite, Android (versionCode 82) and Windows builds passed. Source privacy checks, 318 host files, 501 APK entries and 385 Windows archive entries passed audits; host sources match the reviewed inputs. APK signer matches 0.26.6. Downloaded GitHub assets match the manifest hashes and exact source tag; GitHub privacy CI passed. Physical Android keyboard/system-bar behavior remains unverified.
- Published [v0.26.7](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.26.7) from [0e459fa1a1b7eafc4825bcbed48cc1078180971f](https://github.com/Evgenie-Myasnikov/pocket-code/commit/0e459fa1a1b7eafc4825bcbed48cc1078180971f) on [codex/edge-chat-0.26.7](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/edge-chat-0.26.7); APK, Windows package, host bundle and update manifest are available.

## [0.26.6](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.5...v0.26.6) (2026-10-12)

### Features
- chat: show user attachments as compact image thumbnails with zoom and file cards with on-demand previews; separate generated file lists from displayed prose while preserving provider prompts. Load nearby thumbnails with bounded concurrency and preserve access checks for project/upload files on mobile and Windows.
- chat: use a transparent menu control and soft alpha edges on the transcript; keep controls and dialogs fully opaque, preserve reading/high-contrast modes.
- claude: expose only SDK-advertised effort levels and validate them before starting a run; persist choices separately from Codex. Remove synthesized model-version entries and shorten the model label while retaining the exact ID in its hint.

### Bug Fixes
- usage: reject out-of-range percentages instead of clamping them into apparent full/empty quotas. Hide expired or failed readings in details and include the selected Claude catalog metadata when matching quota buckets. The compact ring remains the minimum reported applicable account allowance, not context usage.

### Documentation
- providers: document capability and quota rules in AGENTS.md and the English/Russian provider guides.

### Validation
- Validated 2026-10-12: 10 distinct browser scenarios passed across focused runs (compact attachments at 320/1280px, image zoom/document opening/focus, menu and transcript following, Claude model/effort controls, expired/failed quota display). 31 targeted unit/API checks and a separate four-check follow-up/API run passed. TypeScript/Vite and Windows shell compilation passed. Synthetic chat captures inspected. Live Claude metadata/usage reads succeeded without a model prompt; no physical Android checks or live model turn was performed. Unreleased.
- Initial browser failures were fixture issues (obsolete navigation helper and invalid synthetic PNG); corrected the fixtures without relaxing assertions. Build reports existing bundle-size and static/dynamic import warnings. Test listeners exited; production host was not restarted.

- Release validation: 34 unit/API checks and 10 browser scenarios passed. TypeScript/Vite, Android (versionCode 81) and Windows builds passed. Source privacy checks, 316 host files, 501 APK entries and 383 Windows archive entries passed audits; host sources match the reviewed inputs. APK signer matches 0.26.5. Downloaded GitHub assets match manifest hashes and the exact source tag; GitHub privacy CI passed. Physical Android and live model-generation checks remain unperformed.
- Published [v0.26.6](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.26.6) from [63a9e549ee5b756f12c8b6e78459c5fb355ca149](https://github.com/Evgenie-Myasnikov/pocket-code/commit/63a9e549ee5b756f12c8b6e78459c5fb355ca149) on [codex/compact-chat-0.26.6](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/compact-chat-0.26.6); APK, Windows package, host bundle and update manifest are available.

## [0.26.5](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.4...v0.26.5) (2026-10-12)

### Bug Fixes
- chat: show received run messages and partial-response snapshots immediately when reopening a conversation; animate only subsequently received content. Follow rendered transcript height during letter pacing and late image layout, while preserving intentional upward scrolling and saved positions.

### Features
- chat: fade new graphemes from transparent to opaque over 420 ms with a 60 ms inter-word pause. Preserve Unicode, Markdown, reveal-speed controls, instant mode and reduced-motion behavior; provider data is unchanged.
- navigation: replace mobile bottom tabs with a header menu and left section drawer. Preserve draft/chat return, status indicators, aligned headers, focus containment and Back/Escape dismissal; desktop navigation remains available.

### Validation
- Validated 2026-10-12: 27 targeted browser scenarios passed across focused runs, including running snapshot reentry, first partial response, alpha progression, word pause, manual scroll, late layout growth, history paging/cache, draft recovery, menu/back/focus and aligned 60/100/130% headers. Three Unicode/reveal/position unit checks and TypeScript/Vite passed. Synthetic 320/390px menu captures inspected. Earlier navigation-test failures were traced to removed bottom-tab selectors and updated in shared helpers. These checks preceded release; physical Android and live-provider checks were not performed.
- Release validation: 3 unit checks passed; 26 of 27 browser scenarios passed initially. The timing-sensitive word-pause scenario failed once during a concurrent build, then passed unchanged in one isolated run and three repeated runs; the cause remains unconfirmed. TypeScript/Vite, Android (versionCode 80) and Windows builds passed. Source privacy checks, 312 host files, 501 APK entries and 379 Windows archive entries passed audits. APK signer matches 0.26.4. Downloaded GitHub assets match manifest hashes and the exact source tag; GitHub privacy CI passed. Physical Android and live-provider checks remain unperformed.
- Published [v0.26.5](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.26.5) from [3b73567763018d5e6a8e01dbd1648127e61b8c4d](https://github.com/Evgenie-Myasnikov/pocket-code/commit/3b73567763018d5e6a8e01dbd1648127e61b8c4d) on [codex/mobile-navigation-0.26.5](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/mobile-navigation-0.26.5); APK, Windows package, host bundle and update manifest are available.

## [0.26.4](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.3...v0.26.4) (2026-10-09)

### Features
- chat: collapse consecutive matching command, file-edit, tool and reasoning rows into counted disclosures; preserve every call/result, keep errors separate and retain message anchors. Move the aggregate subagent entry beside Review and Results in the shared header; hide it for chats without agents and use compact icon actions on narrow screens.
- chat: remove trailing chevrons from activity disclosures and inline subagent entries; retain row activation, keyboard controls and visible focus.
- boards: remove the People view/category, participant controls and note assignee UI; always open the canvas, including when an obsolete People preference exists. Keep note status, priority and saved data intact.

### Validation
- Thirteen focused browser scenarios passed, including disclosure contents, error visibility, child context navigation, header absence in a new chat and 320/360/844/1280px layouts; five grouping/activity unit checks and TypeScript/Vite passed. Final header changes passed all eleven header/subagent scenarios again. Synthetic captures inspected. These checks preceded release; physical-device validation was not performed.
- Chevron removal passed ten activity/subagent browser scenarios, including keyboard disclosure. Board simplification passed five browser scenarios for obsolete preferences, editing, drag/zoom, save conflicts and reopening; TypeScript/Vite passed. Updated the board guide before release.
- Release validation: all 18 focused browser scenarios and 5 unit checks passed on the release checkout; TypeScript/Vite, Android (versionCode 79) and Windows builds passed. Source privacy guard and 309 host files, 501 APK entries and 376 Windows archive entries passed artifact audits. APK signer matches 0.26.3; downloaded GitHub packages match the manifest hashes and exact source tag. GitHub privacy CI passed. Physical-device checks remain unperformed.
- Published [v0.26.4](https://github.com/Evgenie-Myasnikov/pocket-code/releases/tag/v0.26.4) from [dbe63bd511cdb16c1e95dad0fa9a3ff3bc79563a](https://github.com/Evgenie-Myasnikov/pocket-code/commit/dbe63bd511cdb16c1e95dad0fa9a3ff3bc79563a) on [codex/chat-activity-0.26.4](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/chat-activity-0.26.4); APK, Windows package, host bundle and update manifest are available.

## [0.26.3](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.2...v0.26.3) (2026-10-06)

### Bug Fixes
- navigation: align mobile chat-provider, board, settings, rules and changelog headers with a shared height, title size and inset; remove the navigation divider below the open chat composer.
- notifications: add the inbox to the chat list and align its trigger with section/conversation headers; opening a notice from the list reveals its board.
- chat: pace current-run message blocks as well as partial text, retain the mounted reveal queue on completion and cap burst acceleration; replace the dotted generic running footer with the latest action and a reduced-motion-aware text sweep.

### Features
- boards: add board/project search, remove gallery card outlines and caption dividers, and soften canvas chrome while preserving state colors, previews and context actions.

### Validation
- Five browser checks passed, including tab geometry at 60/100/130% scale and notification controls at 320/390px. TypeScript/Vite build passed. Physical-device validation and release remain outstanding.
- Follow-up validation: 21 browser scenarios passed across gallery search, card actions, board drag/zoom, header/bell alignment, composer and streaming completion; two Unicode/reveal unit checks and TypeScript/Vite passed. Synthetic mobile/desktop captures inspected. Physical-device and live-provider stream checks remain outstanding; unreleased.

- Release validation: 21 browser scenarios and two reveal tests passed in the release checkout; Android/Windows built, APK signing continuity, source-matched host (306 files), artifact privacy, downloaded checksums and GitHub CI verified. Earlier unreleased notes above record pre-release checks.
- Release source: [01fd4e0](https://github.com/Evgenie-Myasnikov/pocket-code/commit/01fd4e0f592ac864f7cd76a2b6ba1cf3ab51bef4), branch [codex/gallery-chat-0.26.3](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/gallery-chat-0.26.3). Physical-device and live-provider stream validation remain outstanding.

## [0.26.2](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.1...v0.26.2) (2026-10-06)

### Bug Fixes
- notifications: integrate the bell into mobile section/chat headers and Windows navigation instead of a separate strip; use a 48px target and 24px icon, preserve unread badges and render the inbox outside header layout.

### Features
- boards: replace dim overlays with a full-board, aspect-preserving miniature on a subtle grid, including all loaded notes, column labels and status colors; separate the readable board/project caption and widen responsive cards. Miro preview availability is unchanged.

### Validation
- Five focused browser checks passed on 320/390px and desktop; modal focus, navigation, card open/delete and chat width verified. Synthetic captures inspected; TypeScript/Vite build passed. Not released; physical-device check remains outstanding.

- Release validation: five browser checks passed again in the release checkout; Android/Windows builds, APK signing continuity, source-matched host, archive privacy, downloaded checksums and GitHub CI passed. Earlier unreleased note above records pre-release validation.
- Release source: [3095d8e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/3095d8e83474784cdd55de8ab9537a2b2e98b7ea), branch [codex/board-preview-0.26.2](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/board-preview-0.26.2). Physical-device validation remains outstanding.

## [0.26.1](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.26.0...v0.26.1) (2026-10-06)

### Features
- claude: add persisted permission choices in mobile and Windows settings: ask for approval, accept file edits, or full access. Pass the selected native mode to new/resumed runs, retain active-run policy and enforce plan-mode precedence. API/SDK mapping and browser persistence checks passed; a live account was not exercised.
- chat: present structured provider questions in a dedicated accessible dialog with option descriptions, supported multiple selection, custom answers, draft retention, retry and expiry handling; preserve Codex question IDs and Copilot freeform restrictions. Existing enabled native alerts notify waiting questions for all three providers without repeated polling duplicates.
- appearance: persist slow, normal, fast or instant letter reveal speed and apply changes during live responses; reduced motion remains immediate.
- boards: display lightweight content miniatures behind repository board names using already loaded geometry and status colors; preserve open/delete actions. Miro keeps its existing card because the connection supplies no preview.
- chat: keep model selection and effort side by side in one row in the shared phone/desktop composer, including narrow screens; truncate long labels without wrapping the controls vertically.
- chat: progressively reveal live response letters, including the first network fragment, with soft glyph fading; retain full provider text and immediately display saved history or reduced-motion output. Frequent deltas share a presentation queue instead of restarting it.

### Code Refactoring
- release checks: read Git blobs in one validated binary batch per tree, retaining all file, credential, denylist and historical-commit checks; malformed batches fail closed.

### Bug Fixes
- chat: replace the provider/computer footer with a concise working or waiting-for-response status.

### Validation
- Questions, reveal settings and board previews: 20 targeted browser checks and 44 provider/streaming/notification tests passed; TypeScript/Vite build passed. Synthetic phone previews inspected. Windows notification queue passed 11 assertions; Android notification identity passed 7 assertions. Physical-device delivery remains unverified; not released.
- Six existing composer browser checks passed, including 320px at 60%/130%, phone/desktop widths, shortcuts and reduced motion; synthetic phone and desktop layouts inspected. Not released.
- Letter streaming: nine browser checks and two glyph/Unicode unit checks passed; TypeScript/Vite build passed. Includes first-fragment progression, frequent deltas and reduced-motion bypass. Not released.

- Published validation: 21 browser, 45 provider/server/streaming and 5 privacy checks passed. Android and Windows built; APK signing continuity, source-matched host, archive privacy and downloaded release checksums verified. Earlier unreleased notes above record intermediate checks.
- Release source: [bbdb282](https://github.com/Evgenie-Myasnikov/pocket-code/commit/bbdb282791d26302e0d62a9da77d137d90137804), branch [codex/chat-polish-0.26.1](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/chat-polish-0.26.1). Physical Android delivery and live Claude account checks remain unverified.

## [0.26.0](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.11...v0.26.0) (2026-10-06)

### Features
- tasks: link saved board cards to private, persistent task runs with an isolated Git worktree, provider chat, pinned-base diff, automatic executable checks and explicit human snapshot approval; preserve source files and interrupted work without automatic merge or relaunch.
- miro: add separate host OAuth/token setup and per-linked-board read/write opt-ins; providers can page through items and update existing notes, text and cards through the bundled helper, with stale-edit checks and encrypted Windows credential storage.
- notifications: persist bounded run events and native delivery cursors, catch up after reconnection and open the exact provider/job from Windows or Android alerts; expose one shared notification preference.
- claude: select aliases or exact model versions from a project-scoped runtime catalog, retain custom IDs, and pass the selected ID unchanged to new and resumed requests; fall back to aliases/manual entry when discovery is unavailable.
- chat: introduce a shared auto-growing prompt composer with compact circular actions, theme-aware focus and attachment previews; softly reveal newly appended prose characters while preserving Markdown, Unicode and reduced-motion preferences.

### Bug Fixes
- task navigation: ignore preparation responses after a note closes and prevent late status reads from replacing newly saved verification settings; stale file snapshots cannot retain current approval.
- desktop alerts: consume notification links in the outer shell, including when no chat is mounted, and retain mobile notification targets while an upload/navigation action is busy.
- packaging: include the Miro helper in host/desktop packages and accept only the portable board's public file formats during verified host installation.
- navigation: preserve the current section and visible QR/reconnect errors when the PC cache scope changes; restore history jumps before paint so a delayed callback cannot override subsequent scrolling.
- results/boards: clear outputs when changing chat scope, ignore late responses, persist the board view consistently, roll back rejected drags and prevent completed saves from reopening a departed board.
- controls: keep quota refresh clear of the activity handle and maintain usable touch targets for diff layout selection.
- claude: always close query resources after completion/failure, including time-bounded model discovery.

### Code Refactoring
- workflow: separate task orchestration, persistence, Git worktrees, check execution, result UI, Miro access and notification delivery into focused modules shared by Windows and Android.
- navigation: remove unreachable Jira inbox/terminal rendering and its eager terminal dependency from the shared app; preserve compatibility APIs and explicitly archive retired UI tests with current replacement coverage.
- chat: extract the composer/model picker and consolidate their styles; limit animated glyphs to a short fresh tail and avoid serializing completed history on each streamed delta.
- tests: share current chat/QR navigation helpers, await observable asynchronous outcomes and include privacy checks in the default test command. Retain failures from obsolete UI scenarios for migration.

### Documentation
- workflow: document isolated tasks and review gates in English/Russian, Miro developer-app setup and supported writes, private state boundaries, restart recovery and notification delivery limits.
- guides: refresh English/Russian setup, provider models/sign-in, chat, QR, updates, diff review, boards/Miro and troubleshooting; add architecture, local link checking and a scoped [maintenance report](docs/MAINTENANCE-2026-10-06.md).

### Validation
- 2026-10-06: 281 unit/server checks and 139 distinct focused browser scenarios passed across scoped runs; TypeScript/Vite, Windows/native smoke and Android debug build passed. Verified local documentation references and working source/documentation text with the privacy guard rules.
- Follow-up: 319/319 unit/server checks passed. The full current browser run passed 281/283; two obsolete navigation/copy assertions were updated, and both passed in a five-scenario rerun (including documentation captures). Thus all 283 current scenarios passed across these runs, not in one uninterrupted green run. Retired interface contracts are explicitly archived with replacement coverage.
- TypeScript/Vite, Windows build, native notification smoke checks and Android debug build passed; the actual host bundle was source-matched and verified through its installer. Documentation links and synthetic screenshots were checked. Physical Android and authenticated Miro/all live provider combinations remain unverified. A Windows node-pty cleanup helper emitted an AttachConsole error although the PTY lifecycle assertion passed; this remains a follow-up. No new release, installation or publication.

- Release validation: 281 current UI scenarios passed in one clean release-checkout run; two documentation screenshot scenarios were verified separately. The clean unit/server rerun passed 318/319, followed by 3/3 device checks after a transient Windows EPERM. Windows/Android builds, APK signing continuity, source-matched host installation, archive privacy checks and GitHub CI passed. Published Android, Windows, host and checksum manifest.
- Release source: [41e30eb](https://github.com/Evgenie-Myasnikov/pocket-code/commit/41e30ebcb57fd3bee0aec5e0679d1d45ca201321), branch [codex/task-pipeline-0.26.0](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/task-pipeline-0.26.0). Physical-device/Miro-account and node-pty diagnostic limitations above remain.

## [0.25.11](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.10...v0.25.11) (2026-10-03)

### Features
- boards: choose a grid step of 8, 12, 16, 24, 32 or 64 in Appearance settings on Windows and mobile; persist it locally and apply it to the visual grid, creation, dragging and keyboard placement.
- boards: widen version columns at step 64 so cards fit on the grid without crossing column boundaries; retain existing card positions until explicitly moved.

### Validation
- Seven focused data/placement checks and three browser scenarios passed, covering all grid steps, persisted settings, creation and mouse/keyboard movement at step 64. TypeScript/Vite, Android and Windows builds passed.
- Final source/APK/desktop/host privacy audits passed; host contents matched source and checksums. GitHub CI passed. Published Windows and Android assets; the updater downloaded and checksum-verified the APK. Physical devices were not tested.
- Release source: [d77fba0](https://github.com/Evgenie-Myasnikov/pocket-code/commit/d77fba04593d9b80bf12fd4278786505cd784898), branch [codex/grid-0.25.11](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/grid-0.25.11).

## [0.25.10](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.9...v0.25.10) (2026-10-03)

### Features
- boards: right-click a note card to delete it with confirmation; preserve other cards and image files, remove dangling dependency references, and reuse existing edit permissions and revision checks.

- boards: snap created and moved notes to an eight-pixel canvas grid that scales with zoom; preserve branch bounds and remove the duplicated creation menu.

### Validation
- Passed TypeScript/Vite, two placement checks and two focused desktop browser scenarios: confirmed/cancelled deletion, dependency cleanup, creation and dragging at changed zoom, no release-position jump and persistence after reopening. Android and Windows packages were built and published. Physical device testing was not performed.
- Release source: [d4a6369](https://github.com/Evgenie-Myasnikov/pocket-code/commit/d4a6369fee9bc7ead6fa0c73660f2f6c25ca7d1d), branch [codex/cards-0.25.10](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/cards-0.25.10). Six focused server/placement checks, two browser scenarios in the clean source and GitHub CI passed.
- Final source/APK/desktop/host privacy audits passed; host contents matched source and checksums. The published updater downloaded and checksum-verified the APK.

## [0.25.9](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.8...v0.25.9) (2026-10-03)

### Features
- boards: delete a repository board from its card context action with confirmation and revision/role checks; retain project files and image assets, and disconnect Miro without deleting its remote board.
- boards: attach up to twelve PNG/JPEG/WebP images per idea, retain portable content-addressed assets, and open thumbnails in the shared fullscreen zoom viewer.
- boards: resolve version links against existing Git refs and preserve the mapping in repository snapshots.
- providers: apply the same rules/skills -> board -> changelog workflow to Claude, Codex and Copilot, including resumed sessions and evidence-based bug investigation.

### Bug Fixes
- chat: return to latest messages when the agent was running on departure, including desktop section changes; retain saved positions for idle chats.
- results: remove Tools and Code categories and entries from chat results, including All and category counts; retain images, documents and links.
- boards: render image viewing outside the transformed canvas so zoomed boards cannot clip the fullscreen viewer.

### Documentation
- rules: require real release branches and exact source commits; preserve shared rule discovery when automatic board writes are disabled.
- boards: document image provenance, portable storage, limits and host compatibility; extend the local helper with read-only project-board lookup.

### Code Refactoring
- release: include the source branch/commit in generated manifests, reject detached or dirty release sources, verify the repository branch and any existing tag, and publish against the exact reviewed commit.

### Validation
- Release source: [24d1059](https://github.com/Evgenie-Myasnikov/pocket-code/commit/24d105996df6d6d0fcc730d0df55b5c3ee3cbb13), branch [codex/chat-0.25.9](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/chat-0.25.9); published Windows and Android assets with matching update manifest.
- Passed 51 focused server tests, 6 browser scenarios, TypeScript/Vite, Android and Windows builds, and Windows native smoke. Synthetic board images were visually reviewed.
- Final source, APK, desktop archive and host bundle privacy checks passed; host content matched source and checksums. GitHub CI passed; the published updater downloaded and checksum-verified the APK.
- Legacy mobile results test setup still uses an obsolete provider selector; shared desktop results passed. Physical Android, private Miro authentication and live provider inference were not tested.


## [0.25.8](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.7...v0.25.8) (2026-10-03)

### Bug Fixes
- boards: present board and project names in a responsive card grid without icons or secondary type labels; preserve repository board titles on opening.
- boards: hide dependency and version connector lines; preserve dependency metadata for AI planning and existing chat prompts.

### Validation
- Release source: [c530566](https://github.com/Evgenie-Myasnikov/pocket-code/commit/c530566eb892aefeae4102c3eda5139440d738a3), branch [codex/boards-0.25.8](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/boards-0.25.8).
- Passed TypeScript/Vite, three focused desktop board scenarios and four board data tests. Android APK and Windows package built; source and APK/desktop/host privacy audits passed. Physical Android not tested.

## [0.25.7](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.6...v0.25.7) (2026-10-03)

### Features
- miro: connect a project board by URL in Settings and open its original Miro Live Embed interface on desktop and mobile.
- miro: persist canonical board links privately on the PC; provide reload, browser fallback and explicit disconnection without deleting the remote board.

### Bug Fixes
- chat: replace the bright input outline with a subtle focused background; retain keyboard focus indication.
- boards: display only projects with existing boards; create optional repository boards explicitly and remove trailing card arrows.
- rules: maintain existing boards without automatically creating boards in every repository.

### Code Refactoring
- navigation: remove shared WorkSpace navigation and joining screens; retain legacy host records without destructive migration.
- security: restrict embedded URLs to Miro, discard invitation parameters, keep native commands isolated from external frames and use browser fallback on legacy Android WebViews.

### Documentation
- docs: explain Miro sign-in, PC-local links, remote access rights and limitations. AI API access and offline Miro editing are not included.

### Validation
- Release source: [b7bd30d](https://github.com/Evgenie-Myasnikov/pocket-code/commit/b7bd30d57f839db4e283b021f639a55e332915ec), branch [codex/miro-0.25.7](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/miro-0.25.7).
- Passed 10 focused server tests, 9 interface scenarios, TypeScript/Vite, Android build and Windows desktop smoke checks. Source and final APK/desktop/host privacy audits passed. Physical Android and authenticated private Miro-board editing have not been tested.

## [0.25.6](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.5...v0.25.6) (2026-10-03)

### Features
- boards: open and edit one portable board per project; create a missing board directly in its repository. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- rules: built-in board maintenance is enabled by default for Codex, Claude and Copilot, with a persistent per-project switch. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- boards: show the linked Git branch or an explicit unlinked label on each version column. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- chat: keep a permanent New row at the top; create a conversation only after its first message. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))

### Bug Fixes
- boards: open the original board and highlight the note from an assignment or clarification notification. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- boards: serialize repository writes and reject stale revisions without overwriting newer edits. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- navigation: remove duplicate refresh controls from project documents. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- boards: route dependency arrows outside cards and retain only concrete dependencies. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))

### Documentation
- docs: translate the curated Pocket Code board into Russian and document repository-backed editing. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))
- rules: require concise categorized version entries in CHANGELOG.md, with real commit references only. ([a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e))

### Validation
- Fourteen focused server/board/rules tests, 33 provider tests and 32 desktop/mobile browser scenarios passed. Android and Windows builds, native Windows smoke and source/archive privacy audits passed. Physical Android testing unavailable.
- Private legacy board records remain available through their notifications; repository snapshots contain product data only.

- Release: Published v0.25.6 with APK versionCode 69 and matching Windows/host assets from [a47085e](https://github.com/Evgenie-Myasnikov/pocket-code/commit/a47085ea70497f1431d0fde2a2b07366f706b30e) on [codex/project-0.25.6](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/project-0.25.6). GitHub CI passed.

## [0.25.5](https://github.com/Evgenie-Myasnikov/pocket-code/compare/v0.25.4...v0.25.5) (2026-10-03)

### Features
- Release: Published v0.25.5 from [b71799a](https://github.com/Evgenie-Myasnikov/pocket-code/commit/b71799af91e3564529d72a605044b05f9e9ca976) on [codex/navigation-0.25.5](https://github.com/Evgenie-Myasnikov/pocket-code/tree/codex/navigation-0.25.5) with APK versionCode 68 and matching desktop/host assets. GitHub CI passed; the updater downloaded and verified the APK.
- Fixed: Changing the AI provider preserves the Chats section; clipboard images use the attachment uploader and preview without replacing the draft.
- Fixed: A saved board remains readable when its repository folder is unavailable; editing and chat launch are disabled. Repeated open clicks no longer discard the pending response.
- Changed: Repository boards replace the local-board index and read project-boards files directly, including Pocket Code's curated roadmap. Existing private local records are preserved. Repository snapshots are read-only in this view; edit the source or use a workspace board.
- Changed: Remove the redundant Pocket Code brand row from the desktop sidebar; conversations and New chat remain available.
- Improved: Notification cards separate their type, title, preview, timestamp and read state with theme-aware icons and spacing.
- Added: Workspace invitations require a password on first entry; saved user credentials and profiles restore access without duplicate participants or another password prompt. Host approval and revocation remain effective.
- Packaging: Include the curated product board in PC bundles. Workspace authorization still applies before returning saved board data.
- Validation: 31 browser scenarios and seven server/snapshot tests passed, including native clipboard image paste, repository reads and unavailable-folder recovery. TypeScript/Vite, Android build and native Windows smoke passed; source and artifact privacy audits passed. Physical Android testing unavailable.

## 2026-10-03 - PC-scoped chats and neutral provider palettes (0.25.4)
- Fixed: Chat history, drafts, attachments, selected sessions and asynchronous state are isolated by PC connection credentials plus AI provider. Switching a shared WorkSpace preserves the personal PC chat. Returning to a connected PC restores its in-memory conversation state.
- Fixed: A board from another connection cannot open or link a chat on the wrong PC; workspace invitations are not accepted as personal chat connections.
- Added: Neutral, Codex-inspired, Claude-inspired and Copilot-inspired palettes in light/dark/system modes, using shared interface tokens and matching native Windows frame colors. Existing palettes and saved preferences remain supported.
- Validation: 24 interface scenarios (including PC switching, inbox and eight palette/mode contrast checks), five workspace recovery scenarios and two roadmap tests passed. TypeScript/Vite, Android/Windows builds, native Windows smoke and source/artifact privacy audits passed. Physical Android testing unavailable.
- Release: Published v0.25.4 from codex/interface-0.25.4 (343790d), APK versionCode 67, with Windows, host and manifest assets. GitHub CI passed; the production updater downloaded and verified the APK. No production host restart was performed; test listeners exited.


## 2026-10-03 - Single host, reusable profiles and desktop editing (0.25.3)
- Fixed: Legacy per-device host profiles consolidate to one PC owner and remap note assignments. Old member/invitation Host labels migrate to Developer without merging independent member identities; new invitations cannot assign Host.
- Added: Required first and last name, automatic reuse of a saved complete profile, and self-renaming from participants on Windows and Android. Trusted phones request missing host profile details instead of silently skipping them.
- Added: PC-only confirmed deletion of boards and workspaces. Workspace removal revokes credentials and deletes its board metadata; repository files remain intact. Generated-board deletion persists across restarts.
- Improved: Restored Windows windows focus the WebView. Chat Ctrl+A scopes selection to draft or conversation, Ctrl+C uses native selection, and Ctrl+V outside a field focuses the composer.
- Added: Explicit Git snapshot save/import with a strict public field schema, sensitive-text checks, path validation and no automatic commit/push. A curated 15-note Pocket Code product board lives in the repository and drives the generated view.
- Added: Shared application instructions teach Claude, Codex and Copilot to read repository boards, clarify ideas and maintain evidence-based cards without identities or private data. Guidance applies to new and resumed interactive sessions.
- Added: Private per-recipient board inbox on mobile and Windows for assignments and clarification requests. A local AI helper uses authenticated, revision-checked host endpoints and idempotent request IDs; unapproved participants and cross-member inbox access are rejected.
- Validation: 248/249 full-suite tests passed; the timing-sensitive Copilot stream test passed with all eight provider tests in isolation. 42 final provider/board/attention tests and all 29 browser scenarios passed. TypeScript/Vite, Android/Windows packaging and native Windows smoke passed. Source, APK, Windows and host privacy audits passed; physical Android testing unavailable.
- Release: Published v0.25.3 from codex/board-0.25.3 (4fe2149), APK versionCode 66, with Windows, host and manifest assets. GitHub CI passed; the production updater downloaded and verified the APK. Test listeners exited; the production host was not restarted.


## 2026-10-03 - Workspace approval, identities and chat recovery (0.25.2)
- Fixed: Repeated QR joins reuse a proven member identity; concurrent retries create one request. Authenticated legacy paired-device profiles merge into the host profile while preserving assignments.
- Added: New independent workspace members wait for PC host approval. Pending and declined requests cannot read boards, files, people or chats. Hosts approve, decline, change roles and remove members; removal invalidates credentials.
- Improved: Mobile WorkSpace selection and participant count share the header. Saved workspace selection survives restarts. Desktop workspace cards show a single roster with inline management and request counts.
- Fixed: Personal chat cache restores before host health/provider discovery; job errors no longer block session loading. Windows caches its conversation list. Personal chats remain separate from shared membership.
- Compatibility: Existing approved memberships remain active; trusted PC-paired devices retain the host identity. Offline copies cannot be remotely erased while a device is disconnected; authorization failures clear cached workspace data after reconnecting.
- Validation: 247 server tests plus the workspace-vault regression passed; 25 browser scenarios passed, including real QR approval/removal. TypeScript/Vite, Android and Windows packaging and native desktop lifecycle smoke passed. Physical Android testing unavailable.
- Release: Published v0.25.2 from codex/workspace-0.25.2 (2a7c38c), APK versionCode 65, with Windows, host and manifest assets. Source/artifact privacy audits and GitHub CI passed. The production updater downloaded the release and verified the APK checksum. Test listeners exited; the production host was not restarted.


## 2026-10-03 - Direct document sections and reliable QR retries (0.25.1)
- Changed: Replaced Project navigation with Rules and Changelog on Windows and Android. Each section selects among Git projects containing its Markdown documents; single documents open directly.
- Fixed: QR scanning routes PC pairing and workspace invitations to the appropriate flow. Pairing results are cached only while in flight, so re-scanning can recover from a revoked device key.
- Changed: Pocket Code's generated board reads the latest six versions from local CHANGELOG.md and refreshes on demand. Only recorded publications show Done. Untouched legacy examples migrate; edited boards are preserved.
- Improved: Compact connection screen and workspace rows; invitation and member management controls expand on demand.
- Validation: Full server run passed 245/246; an unrelated timing-sensitive Copilot test passed in an isolated eight-test rerun. Roadmap migration API test passed. 21 desktop/navigation/QR/board browser scenarios and six document scenarios passed; offline scenarios passed separately. TypeScript/Vite, Android and Windows packaging passed; native desktop smoke passed after a transient log cleanup lock on the first run.
- Release: Published v0.25.1 from codex/documents-0.25.1 (4324ff4), APK versionCode 64, with Windows/host/manifest assets. Source and artifact privacy audits and GitHub CI passed. After release metadata propagation, the production updater downloaded 0.25.1 and verified the APK checksum. Test listeners exited.
- Follow-up: The reported phone QR error text was not provided; identified wrong-section and stale-credential failures are covered. Physical Android testing remains unavailable.


## 2026-10-03 - Independent workspace invitations and local roadmap boards (0.25.0)
- Changed: Connection is inside Settings on Windows and Android. WorkSpace has its own QR invitations, explicit Local/Tailscale/Internet transport, desktop-only administration and named participant foldouts.
- Changed: Trusted paired devices reuse the PC profile; independently invited members enter their name. Personal chats and local boards remain separate from shared workspace membership.
- Added: Local boards and a Pocket Code example, populated roadmap templates, six distinct state styles and connected planned versions without creating Git branches.
- Improved: Desktop canvas panning, destination-column highlighting and bounded note placement. Cached workspace catalogs and boards remain readable offline; offline changes are disabled.
- Changed: Settings use categories and AI account/access/project subcategories. Desktop project selection is inside new chats.
- Validation: 244 server tests and 23 browser scenarios passed, with the three offline/Connection scenarios rechecked after the final navigation change. TypeScript/Vite, Android build, Windows packaging and native desktop lifecycle/bridge smoke passed.
- Release: Published v0.25.0 from codex/workspace-0.25.0 (5ded52f), APK versionCode 63, with matching Windows/host/manifest assets. Source and artifact privacy audits and GitHub CI passed; the production updater downloaded the release and verified the APK checksum. Test listeners exited; no production host was started.
- Follow-up: Physical Android testing remains unavailable. Independent workspace members do not receive the host's personal provider execution access.


## 2026-10-02 - Named participants and QR-bound shared boards (0.24.1)
- Changed: Notes support multiple participants through initial avatars, an add button and an upper-right remove control. Stable ID-based colors and legacy single-assignee migration preserve assignments; People view uses the same notes.
- Changed: Workspace entry asks for a personal name, stored separately from role. Host profiles are per connection; QR members choose their name after pairing.
- Changed: Workspace name/count and Board/People views share the header. Removed duplicate titles, saved-on-PC text and workspace switchers; board creation is one button.
- Privacy: Personal chats remain independent of boards. Ordinary workspace members cannot read host sessions/jobs or note chat links; shared-note edits preserve private links on the host. Trusted Host retains full provider access.
- Pairing: QR bindings persist with the device; new workspaces rotate invitations. Older unbound device connections require a fresh QR scan. Manual workspace sign-in UI is removed; legacy API remains compatible.
- Validation: 19 browser scenarios passed across board, desktop and device pairing (18 together, board rechecked separately). Full server run: 242/243 passed; the single Jira workflow failure passed on an isolated four-test rerun. Board privacy/profile and device checks passed; TypeScript/Vite, Android and native desktop smoke/build/package passed.
- Follow-up: Physical Android testing and isolated AI execution for ordinary workspace members remain outstanding. Published v0.24.1 from codex/board-0.24.1 (23e9c06), Android versionCode 62, with desktop/host/manifest assets. Source/APK/desktop/host privacy audits and release checksum checks passed; GitHub privacy CI passed. The production updater downloaded 0.24.1 and verified the APK checksum.

## 2026-10-02 - Board interaction and shared chat header (0.24.0)
- Changed: Board and People views share priority, status and assignee metadata. Columns determine note branches; branch and dependency selectors are removed from note details. Existing dependency data is retained.
- Added: Pinch/wheel zoom, hold-to-create notes, branch creation/rename from column headings, and optimistic note dragging without a release jump.
- Changed: Workspace administration is desktop-only and selects one repository. Participants appear in the header; mobile users can view the roster and join workspaces.
- Improved: Compact shared chat header with contextual actions; removed redundant desktop Chats navigation and Jira role setting.
- Validation: 243 server tests passed; 36 chat/results/desktop browser scenarios and the board browser scenario passed, including cross-column persistence. TypeScript/Vite, Android Gradle and desktop packaging passed; native desktop lifecycle/bridge smoke passed.
- Release: Published v0.24.0 from branch codex/board-0.24.0, commit da7abbb, with APK versionCode 61 and matching desktop/host/manifest assets. Source, APK, desktop and host privacy checks passed; asset sizes/hashes match the manifest and GitHub privacy CI passed. The real updater downloaded v0.24.0 and verified the APK checksum.
- Follow-up: Physical Android testing remains outstanding.

## 2026-10-02 - Board section label
- Changed: Renamed the Work section to Board in English and its corresponding Russian label in mobile/desktop navigation and section headers. Task status labels remain unchanged.
- Files: src/App.tsx, DesktopApp.tsx, WorkBoards.tsx; related UI test selectors.
- Validation: TypeScript passed; targeted label replacements checked for remaining section labels.
- Follow-up: Local change, not published.


## 2026-10-02 - PC-only workspace administration and header roster
- Changed: Phone users only join/select workspaces. Creation/settings controls and member administration are hidden; role changes and revocation now require the local host-admin connection even for a paired Host phone.
- Added: Header participants icon/count opens a read-only roster on phones. The desktop host manages roles/access from the same dialog. Dialog supports Escape, outside dismissal and focus return.
- Files: src/WorkspaceParticipants.tsx, WorkspaceMembers.tsx, WorkBoards.tsx, work-boards.css; server/boards.ts; workspace guides and tests.
- Validation: Two server tests passed including mobile Host role/revoke rejection. Browser board scenario passed hidden management controls and header roster assertions. TypeScript/Vite, Android Gradle and desktop builds completed; local APK and host bundle regenerated. The PowerShell redirect returned a nonzero status from native stderr, but the log confirms BUILD SUCCESSFUL and completed APK/bundle/manifest stages.
- Follow-up: Local artifacts only, not a new GitHub release. Existing running host was not restarted.


## 2026-10-02 - People view and shared task metadata
- Added: Board/People view switch remembered per board. People columns use workspace participants plus retained legacy assignees and Unassigned; tasks sort by critical/high/normal/low priority and title.
- Changed: Notes store priority and assignee ID alongside the existing owner label. Both views show title, priority, status and assignee and open the same editor; switching views creates no task copies or coordinate changes. Legacy notes display normal priority until edited.
- Access: Authorized workspace participants can read the scoped roster (IDs, display names and roles only); credential hashes stay private. Viewer board writes remain denied. The roster is workspace membership, not a corporate-directory integration.
- Files: src/BoardPeople.tsx, WorkBoards.tsx, work-boards.css; server/boards.ts; workspace guides and board tests.
- Validation: Two server tests passed, including metadata persistence and invalid priority rejection. Browser scenario passed priority sorting, shared status edits, reassignment to Unassigned, branch dialogs, gestures and delayed-save note dragging. Synthetic mobile screenshot inspected. TypeScript/Vite build and native desktop smoke passed.
- Follow-up: Local build only; not published as a new release. Physical phone testing remains outstanding.


## 2026-10-02 - Branch columns and stable note release
- Changed: Replaced Add branch selector with a plus after the last column and an editable confirmation. Holding or right-clicking a branch heading opens rename; keyboard Enter/Space works too.
- Git: Host-only create/rename operates on local branches in the exact repository root, validates names and board revisions, and never checks out or pushes. Rename updates references across that repository's boards. Board writes serialize with Git operations.
- Fixed: Note release keeps its new position optimistically while the host saves, restoring the prior state only on save failure rather than jumping back on every drop.
- Files: server/boards.ts; src/BoardBranchHeading.tsx, WorkBoards.tsx, work-boards.css; desktop/DesktopWindow.cs; workspace guide and board tests.
- Validation: Two server tests passed with real temporary Git create/rename and name-conflict checks; board browser scenario passed with plus/hold dialogs and delayed-save drop positioning. TypeScript/Vite and native desktop builds passed.
- Follow-up: Changes remain local, not published in a new release. Physical phone testing remains outstanding.


## 2026-10-02 - Create board notes by holding the canvas
- Changed: Removed the toolbar Note button. Holding empty board space for 550ms opens Create note; right-click opens the same menu on desktop. The draft starts at the canvas location adjusted for scroll/zoom and inherits its version lane.
- Interaction: Movement, additional pointers, scrolling and navigation cancel the hold. Existing note controls are excluded; viewers cannot create notes. Outside press and Escape dismiss the menu.
- Files: src/BoardContextMenu.tsx, WorkBoards.tsx, work-boards.css; tests/work-boards.spec.ts.
- Validation: TypeScript and the board browser scenario passed, including real touch hold, cancellation while panning, right-click creation, removed toolbar button and existing zoom behavior.
- Follow-up: Local patch, not published; physical Android testing remains outstanding.


## 2026-10-02 - Board gestures and one repository per workspace
- Changed: Removed zoom buttons. Board zoom uses two-finger pinch or Ctrl/Meta + wheel (15-300%), anchored at the gesture; single-finger canvas movement and note-handle dragging remain available.
- Fixed: The scaled canvas clips to its scaled layout box, avoiding an unscaled overflow area when zoomed out.
- Changed: Workspace setup chooses one repository with radio options, and the server rejects zero or multiple roots on create/edit. Existing multi-folder records remain readable to avoid silently losing boards; existing board-root removal protection remains.
- Files: src/use-board-zoom.ts, WorkBoards.tsx, work-boards.css; server/boards.ts; workspace guide and board/desktop tests.
- Validation: Two server tests and three browser scenarios passed, including wheel zoom, browser touch pinch and exclusive repository selection at 900/1440px. Physical phone testing remains outstanding.
- Follow-up: Local patch; not published as a new release.


## 2026-10-02 - PC-only workspace setup and simpler desktop navigation
- Changed: Removed the redundant Chats navigation category on Windows; conversations open from the existing list, with a draft entry preserving access after switching sections.
- Security: Workspace creation and settings changes require the host PC admin connection. Paired phones, including Host invitations, cannot create or modify workspaces; the mobile interface hides these controls.
- Fixed: Project checkboxes in workspace settings no longer inherit full-width text-input sizing and margins; long folder labels stay inside the dialog.
- Files: src/DesktopApp.tsx, WorkBoards.tsx, project-workspaces.tsx, work-boards.css; server/app.ts, boards.ts; workspace guides and regression tests.
- Validation: TypeScript/Vite build, two board/server tests and four browser scenarios passed, including desktop draft return, mobile controls and checkbox geometry at 900/1440px. Inspected the synthetic 900px screenshot.
- Follow-up: These changes are local; no new GitHub release has been published for this patch.


## 2026-10-02 - Host workspaces, visual boards and shared desktop chat (0.23.0)
- Added: Host-owned workspaces group project folders, boards and chat lists. Participants sign in with host address, workspace name and password; the host assigns Viewer, Developer, Reviewer or QA roles and can revoke sessions. Passwords and participant tokens are hashed in private host storage.
- Added: The desktop pairing screen selects the invitation role beside the QR, initially Host for testing. Non-host invitations select one workspace. Changing the invitation rotates the QR; the server ignores client-supplied roles.
- Added: Work replaces the Jira task list with project boards, Git-branch roadmap lanes, draggable notes, parameters, dependencies, zoom and durable saves with revision conflict checks. Note discussions prepare a chat draft and link the resulting session. Jira task polling is parked; integration modules are retained.
- Changed: Desktop embeds the shared interactive chat, including sending, attachments, steering, approvals, results and Review; switching sections preserves the draft. The native bridge permits only specific chat/board writes.
- Files: server/boards.ts, app.ts, devices.ts; src/WorkBoards.tsx, project-workspaces.tsx, WorkspaceLogin.tsx, WorkspaceMembers.tsx, PairingRole.tsx, App.tsx, DesktopApp.tsx; desktop/DesktopWindow.cs; docs/WORKSPACES.md.
- Validation: TypeScript, web/Android builds and native desktop smoke passed; 15 desktop/board browser scenarios passed. Server suite passed 243/243 sequentially; its first concurrent run had a transient Jira workflow failure which passed in isolation. Targeted access/device/server tests passed after the final scope check.
- Deployment: Published GitHub v0.23.0 from sanitized commit 1be70d2 with matching APK, Windows ZIP, host bundle and manifest. GitHub privacy CI and separate source/archive checks passed; the production updater downloaded the public APK and verified its checksum. Test-owned listeners were closed; the existing production host was not restarted.
- Follow-up: This is the visual workflow foundation, not autonomous delivery: AI-created board updates, human routing, approval gates and target delivery remain unimplemented. Member AI execution stays blocked until provider execution is isolated. Physical Android and multi-user deployment testing remain outstanding.

## 2026-10-02 - Notifications for every PC chat (0.22.7)
- Added: The phone notifies when any chat on the PC finishes or is stopped, including chats started in Codex, Claude Code or Copilot CLI on the PC and never opened on the phone. The PC reads the end of each turn from provider session files (Codex task events, Claude end of turn, Copilot turn end after a quiet period) every 10 seconds and serves the transitions at /api/activity/events; existing history never notifies.
- Added: While paired, an Android foreground service polls that feed every 20 seconds with a silent tracking notification, using the specialUse type on Android 14+ so it is not stopped after Android 15's six-hour dataSync limit. Each chat has one alert that later results replace; the chat watched from its own screen is skipped to avoid a duplicate. Settings → Connection can turn it off.
- Also in this release: the Windows Project page and GitHub Copilot usage limits described below.
- Files: server/run-monitor.ts, app.ts, index.ts; RunFeedService.java, ChatWatchService.java, ChatNotificationsPlugin.java, AndroidManifest.xml; src/chat-notifications.ts, App.tsx, SettingsPanel.tsx, translations.ts; user guides; tests/run-monitor.test.ts.
- Validation: Unit tests cover turn boundaries for all three providers, quiet history on the first scan, transitions with session id and folder title, Copilot's quiet period and feed cursors; an API test covers authentication and cursors. Scanning this PC's real session folders took 8-18 ms. Server suite 241/241, Android and TypeScript builds, desktop smoke and related browser scenarios passed (22/24; the Copilot provider and desktop chat/review scenarios already failed before).
- Follow-up: Android delivery was not tested on a physical phone. Credentials stay in memory, so tracking resumes when the app is opened again after Android closes it.

## 2026-10-02 - GitHub Copilot usage limits
- Added: **Settings → Usage** shows GitHub Copilot premium requests, chat and completion quotas with remaining share and billing-period reset, instead of only a link. The composer ring now shows the remaining premium/chat share for Copilot chats.
- Changed: The PC reads quota through the Copilot SDK account API with a 30-second cache. Unlimited chat and completion entitlements are hidden; an exhausted premium quota without allowed overage is reported as unavailable. Remaining share is calculated from used and included requests, with the reported percentage only as a fallback.
- Files: server/copilot-usage.ts, copilot.ts, app.ts; src/CodexUsage.tsx, SettingsPanel.tsx, translations.ts; tests/copilot-usage.test.ts.
- Validation: Unit tests cover limited, unlimited and exhausted quotas, reset dates, missing data and that editor completions never drive the composer ring. TypeScript passed. A live Copilot account was not available for checking real quota values.

## 2026-10-02 - Project page on Windows
- Added: The Windows application has a **Project** page like the phone: project overview, rules, changelog and a read-only file browser for the selected folder. Its folder follows the chat project filter or the open chat, and choosing another folder there also filters the chat list.
- Security: The desktop bridge additionally allows only the read routes /project-docs, /project-doc, /files and /file; the host still limits them to permitted project roots, and write routes remain rejected.
- Files: src/DesktopApp.tsx; desktop/DesktopWindow.cs; tests/desktop-ui.spec.ts, DesktopSmoke.cs.
- Validation: A desktop browser scenario opens the page, reads the rule document and lists files using only read calls besides window theme sync. The desktop smoke test checks the new routes are allowed and write-style routes stay denied. Desktop scenarios 11/12; the remaining chat/review scenario already failed before this change.

## 2026-10-02 - Resizable desktop sidebar and themed scrollbars (0.22.6)
- Added: The Windows sidebar can be resized by dragging its divider (220-560 px, keeping at least 480 px for the conversation). The width is remembered; double-click or Home resets it, and the arrow keys adjust it when the divider has focus.
- Fixed: Lists outside the conversation used grey classic Windows scrollbars with arrow buttons in the desktop window. All scroll areas now use thin scrollbars in the current palette.
- Fixed: The device list test still expected a "Disconnected" entry after 0.22.5 removed disconnected devices.
- Files: src/DesktopApp.tsx, desktop.css, appearance.css; tests/desktop-ui.spec.ts.
- Validation: A new desktop browser scenario drags the divider, checks persistence after reload, both limits, keyboard steps and double-click reset. Chromium reports thin palette-colored scrollbars on the chat list. Desktop, appearance and chat surface scenarios passed except the desktop chat/review scenario that already failed before this change.

## 2026-10-02 - One entry per device with recognisable names (0.22.5)
- Fixed: Every QR scan added a new device entry, so the same phone appeared repeatedly. Phones now send a stable installation identity (a per-app hash of the Android ID, or a random browser id); pairing again, including after reinstalling, updates the existing entry and key and keeps a name set on the PC.
- Fixed: Disconnected devices stayed in the list. Disconnect on the PC now removes the entry, leaving on the phone removes it too, and revoked entries from earlier versions are dropped when the PC host starts.
- Changed: Phones report their Android device name, or maker and model when none is set, instead of a generic "Android device"; the list shows the model beside the version.
- Files: server/devices.ts, app.ts; src/api.ts, App.tsx, DesktopDevices.tsx, native-update.ts; AppUpdatePlugin.java; desktop guide; device tests.
- Validation: Registry tests cover re-pairing one installation (same id, new key, kept custom name, no installation id on disk or in the list), a second installation staying separate, leaving and disconnecting removing entries, QR rotation only on PC disconnect, and dropped legacy revoked entries. API tests cover self-removal being device-only and malformed installation ids being rejected; the browser pairing test checks the stable installation id. Server suite 235/235, JUnit 10/10, TypeScript/Vite and Android builds, desktop smoke and the related browser scenarios (11/11) passed.
- Follow-up: Entries created by 0.22.0–0.22.4 have no installation identity and are not merged automatically; remove leftovers once with Disconnect. Android device names were not checked on a physical phone.

## 2026-10-02 - Phone updates itself without a PC (0.22.4)
- Added: When the PC is not connected, does not answer or has updates disabled, Android checks the latest GitHub release itself at startup, on return and at most hourly while open, downloads the APK and opens the installer. The unpaired connection screen does this too. A reachable PC remains the update source, and Settings → Updates offers a direct check without a PC.
- Security: The phone accepts the same manifest rules as the PC through a shared validator, downloads only this repository's release asset URL built natively from the validated version, follows HTTPS redirects only, and installs only after the size, SHA-256, package name, newer version code and signing certificate match. The PC path still sends its key on one direct connection without redirects.
- Files: src/release-update.ts, Updates.tsx, native-update.ts, App.tsx; server/updates.ts; AppUpdatePlugin.java, ReleaseSource.java; user guide and reference.
- Validation: Four new emulated-Android browser scenarios cover the unpaired screen downloading and opening the installer, a manifest mismatching its release asset never downloading, a reachable PC never contacting GitHub, and an unresponsive paired PC falling back to GitHub. The related update, connection and settings scenarios passed (12/12). A unit test pins the exact GitHub URLs and rejects tampered tags, missing manifests, checksum mismatches and prereleases; four JUnit tests cover the native release URL and HTTPS-only redirects. TypeScript/Vite and Android builds passed; server suite 233/234, the remaining Copilot streaming test is timing-sensitive in the full run and passed isolated reruns. The full browser suite also showed ten responsive, Jira, Codex-access, Copilot and desktop scenarios failing identically without this change; they follow the 0.22.x interface changes and are not addressed here.
- Follow-up: Physical Android installation from GitHub was not tested; Android still asks the user to confirm each installation and may require allowing installs from Pocket Code once.

## 2026-10-02 - Clean Windows build output (0.22.3)
- Fixed: scripts/build-desktop.ps1 copied the web build into artifacts/desktop/ui without removing earlier hashed assets, so every Setup installation and Windows package accumulated stale interface files (one package held 109 instead of 53 asset files). The folder is now emptied before copying.
- Fixed: scripts/package-desktop.ps1 left a full staging copy (6-21 MB) in artifacts after each package; it is now removed even when packaging fails.
- Files: scripts/build-desktop.ps1, package-desktop.ps1, test-desktop.ps1.
- Validation: test-desktop.ps1 now plants a stale asset before building and requires the interface folder to match the web build exactly. It failed before the fix (78 instead of 53 files) and passes after it, together with the desktop smoke test. A package built over a planted stale asset contains exactly the 53 current assets, and no staging folder remains.
- Fixed: A mis-encoded arrow in an older changelog entry.
- Follow-up: The published 0.21.3 and 0.22.2 packages were already cleaned manually before upload, so their contents do not change.

## 2026-10-02 - Faster host start, automatic cleanup of old builds and visible window after updates (0.22.2)
- Fixed: Every host start re-applied data folder permissions recursively. With many stored host versions this took about a minute or more, which delayed the QR connection and could exceed the update health check, causing a rollback and a second restart. Permissions are now re-applied only when the folder is not already private.
- Added: A background cleanup after host start removes old Windows application builds, superseded PC host versions, downloaded update archives and older cached APKs. Builds that are running, loaded, current, referenced by shortcuts or Windows startup, part of an unfinished update or created within the last hour are kept; a folder with open files is never partly deleted.
- Changed: The Windows updater waits up to five minutes for the new host. After an update the window reopens if it was open instead of staying in the tray.
- Fixed: The pairing parser test now expects QR version 2, accepted since 0.22.0, and rejects an unknown version.
- Files: scripts/bootstrap.ps1, start.ps1, desktop-update.ps1; desktop/DesktopWindow.cs; docs/DESKTOP.md; tests/storage-maintenance.test.ts, DesktopSmoke.cs, pairing.test.ts.
- Validation: New tests cover one-time permission repair and cleanup of synthetic host, desktop, update-archive and APK folders, including kept current, pending, recent, open and newest items and no desktop cleanup during an update. Checking an already private folder took 1 ms. Desktop smoke covers reopening after an update and staying in the tray otherwise. TypeScript/Vite build and all 233 server tests passed.
- Follow-up: The first host start after updating removes existing old builds in the background; large dependency folders can take several minutes to delete.

## 2026-10-02 - Shared app icon and theme-aware window controls (0.22.1)
- Changed: Added a pocket-and-code vector identity, Windows executable/tray icon at seven sizes, Android adaptive/legacy launcher assets and browser favicon. Assets are reproducible through scripts/build-icons.mjs.
- Changed: Native Windows caption, border and background follow the selected palette and light/dark/system theme. Standard window controls remain native; unsupported DWM attributes retain OS defaults.
- Fixed: Fixed green colors inside command summaries and output ignored theme settings. Activity text now uses theme colors, including live commands and error summaries.
- Changed: Appearance sliders share a flat track and compact thumb, with 44px interaction height and keyboard focus.
- Changed: Existing and running chats no longer show project/provider selectors in their header. Selection remains available in the chat library and before starting a new chat.
- Files: public/pocket-code.svg, launcher assets, desktop/DesktopWindow.cs, src/window-theme.ts, appearance.css, messages.css and build scripts.
- Validation: Browser theme/slider test, command contrast test and 19 chat/activity scenarios passed; native desktop rendering/tray/process smoke passed. TypeScript/Vite and Android build passed. Inspected icon, both theme screenshots and native window capture. Physical Android launcher rendering was not tested.

## 2026-10-02 - Individual device access and plain chat activity (0.22.0)
- Changed: Windows Connection lists paired devices with online/offline/disconnected state, version, last contact, renaming and confirmed individual disconnection. Device credentials are hashed on the PC; revocation persists, closes active responses and rotates the QR without interrupting other devices or AI work.
- Security: QR v2 exchanges a pairing secret for an individual credential. The administrative key is restricted to direct loopback requests and is no longer placed in QR codes; device management is PC-only. Online presence expires after 45 seconds without authenticated requests.
- Migration: Update PC and Android and scan the new QR once. Old shared-key connections are rejected; if Windows updated first, install the current APK manually over the existing app before scanning. History/preferences remain intact.
- Changed: Tool actions and subagent links have no background or border in light/dark themes, including live rows and user-role tool results; ordinary user messages retain their existing presentation.
- Files: server/devices.ts, app.ts, index.ts, pairing.ts; desktop bridge and DesktopDevices; mobile pairing/api lifecycle; shared message styles and desktop guide.
- Validation: Six device/runtime server tests, 19 desktop/pairing/subagent browser scenarios, plain activity light/dark check, TypeScript and native WebView/tray/process smoke passed. Android and Windows builds passed; physical multi-device testing was not available.


## 2026-10-02 - Desktop host polling survives locked settings (0.21.3)
- Fixed: Right after an automatic update, the Windows application could fail to replace desktop.json while another process briefly held it. The error stopped window startup before host polling began, so the application never detected its own running host, showed no pairing QR and remained on "Starting the host" after a manual connect. A misleading WebView2 installation message was shown instead.
- Changed: Settings writes retry briefly; a failed startup write no longer blocks polling or shows the WebView2 message.
- Fixed: The runtime API test now expects the desktopCheckRequestedAt field returned since 0.21.1.
- Files: desktop/DesktopWindow.cs; tests/DesktopSmoke.cs, runtime-api.test.ts.
- Validation: A new desktop smoke scenario holds desktop.json without delete sharing. Before the fix it stopped on the WebView2 message without polling; after the fix polling starts and the full desktop smoke test passes. TypeScript/Vite build passed. Full server suite: 228/229; the remaining Copilot streaming test is timing-sensitive in the full run and passed three isolated reruns with the update-worker tests.
- Follow-up: A window already stuck this way does not poll, so it cannot detect this update; exit it from the tray once and start Pocket Code again. The update to this version runs the corrected startup code.


## 2026-10-02 - Full-width new files and inline replacement blocks (0.21.2)
- Changed: New and wholly deleted text files use a single full-width code column in either diff mode, without an empty opposite pane or line-number gutter. Normal insertions in existing files retain split comparison.
- Fixed: Unified mode keeps each removed block followed by its added replacement, preserving surrounding context instead of alternating paired lines.
- Files: src/diff-rows.ts, DiffTable.tsx, review.css; diff parser and browser tests.
- Validation: Two parser tests and seven browser scenarios passed, including mixed new/modified files, mode switching, 10,000-line virtualization, fit-to-width and Unicode text. TypeScript passed.


## 2026-10-02 - PC-managed APK delivery, aligned diff modes and live desktop chats (0.21.1)
- Changed: PC checks public releases at startup and every six hours, verifies/caches the APK and supplies it to connected phones. Mobile settings request a PC check; Android still confirms installation. Public downloads no longer depend on GitHub CLI login. Phone requests also signal the Windows updater; APK transfers block host shutdown.
- Fixed: Diff gutter width rules affected spanning hunk rows and displaced code columns. Explicit shared column measurements now keep split panes aligned; visible Unified/Split buttons retain the selected layout.
- Fixed: Desktop selects the latest run for each chat, polls live output independently of slow history, follows partial text at the bottom and shows working/question/completed/error states. Newly assigned sessions appear before the history index refreshes; completed runs no longer freeze history at their original starting offset.
- Files: server/updates.ts, app.ts, index.ts; desktop/DesktopWindow.cs; src/Updates.tsx, DiffTable.tsx, Review.tsx, DesktopApp.tsx and styles; update/desktop/review tests and guides.
- Validation: 15 update/host server tests, 12 desktop/update browser scenarios, four large/Unicode diff scenarios and both file-list/layout cases passed. TypeScript/Vite, Windows native WebView/tray/process smoke passed. Android APK build passed.
- Follow-up: Android installation on a physical phone was not tested. Older PC hosts need upgrading to support APK delivery; external provider applications do not expose all live run states through Pocket Code.


## 2026-10-02 - Provider sign-out and Windows automatic updates (0.21.0)
- Changed: Added confirmed sign-out for Claude, Codex and Copilot in shared Windows/Android provider settings; active work blocks authentication changes. Preserves chats/preferences and reports remaining environment/account credentials.
- Fixed: Copilot model-list failures no longer overwrite confirmed authentication. Login failure messages distinguish incomplete login from server verification failures.
- Changed: Windows checks public GitHub releases after connection and every six hours, downloads a verified desktop/host package, prepares dependencies, waits for an idle host, restarts and restores the previous version on failed health checks. Settings include automatic/manual update controls.
- Files: server/provider-connections.ts, copilot.ts, app.ts; shared provider/update UI; desktop/DesktopWindow.cs; desktop packaging/update scripts and release manifest.
- Validation: TypeScript/Vite and Windows builds, 13 focused server/security tests, eight desktop browser scenarios and native WebView/tray/process smoke passed. Isolated Windows update fixtures passed installation and failed-health rollback, without using real accounts or stopping the production host.
- Follow-up: Real browser consent and account logout were not performed against personal accounts. Builds before 0.21.0 require one manual Windows installation to gain the updater; temporary internet tunnels may require a new QR after restart.

## 2026-10-02 - Automatic Windows runtime bootstrap and simpler launchers
- Changed: Shared bootstrap detects compatible Node.js through the current/registry PATH and standard install locations. If missing, it downloads a private Node.js 24 LTS ZIP from nodejs.org, verifies SHA-256 and archive paths, and reuses it without administrator access, winget or shell restart.
- Fixed: Clean setup now installs npm dependencies with development tools before the desktop build. Missing/partial dependencies are repaired; healthy retries do not reinstall. Per-user/runtime and per-project locks prevent overlapping installation.
- Changed: Kept only Setup Pocket Code.cmd and Start Pocket Code.cmd in the root. Removed duplicate desktop-install, internet-console and stop batch files; advanced PowerShell scripts remain. Removed the pre-login gate so users can reach provider settings after setup.
- Files: scripts/bootstrap.ps1, setup.ps1, start.ps1, build-desktop.ps1; root launchers; setup documentation; tests/bootstrap.test.ts.
- Validation: Downloaded and verified the official private runtime and ran it. An isolated clean install added 387 dependencies, ran TypeScript successfully, and reused them on a second setup. Bootstrap tests covered stale PATH, unsupported versions, invalid metadata/hash and dev-tool installation; six existing launcher tests passed.
- Follow-up: Existing running hosts are not stopped. Node downloads require access to nodejs.org; package installation requires the configured npm registry.


## 2026-10-02 - Manual provider sign-in and separate connection states
- Changed: Added shared provider cards to desktop settings and mobile AI settings, with detected version, installation, local transport and authentication states. Desktop Connection now distinguishes host activity and actual tunnel availability.
- Changed: Added explicit Windows CLI login methods for Claude subscription/Console/SSO, Codex browser/device/API-key/access-token, and Copilot browser/device/token. Secret entry stays in a local hidden-input prompt and reaches the CLI through stdin. Advanced cloud/enterprise methods link to official configuration guides.
- Changed: Launcher uses the local build when its version matches the managed host, while preserving newer auto-updated hosts.
- Reliability: Pending sign-in is deduplicated, blocks new work, refuses busy provider/queue changes, expires after ten minutes and is cleaned up on host shutdown. Successful login refreshes idle transports before checking access; raw auth output is not exposed.
- Files: server/provider-connections.ts, app.ts, codex.ts, copilot.ts; src/ProviderConnections.tsx and shared settings; desktop bridge; docs/PROVIDER-SIGN-IN.md.
- Validation: TypeScript/Vite and Windows builds passed; 32 server tests and 12 browser scenarios passed; native WebView/tray/cleanup smoke and eight launcher/process tests passed. Installed Claude authentication check succeeded without exposing account data. Official documentation and installed CLI help checked.
- Follow-up: Browser consent and real key/token submission require the user and were not performed. Advanced cloud/enterprise configurations are guides, not setup wizards. The Windows installation is updated; an existing host must be restarted after its work completes. Android source is updated; no APK release is included in this change.


## 2026-10-02 - Shared desktop workspace and read-only conversations
- Changed: Replaced the native form layout with the shared TypeScript/React interface in WebView2. Added provider/project selection, searchable conversations, refreshing history, Review, AI results, image zoom and subagent context. Reused Android renderers, panels, language, appearance controls and session types.
- Changed: Kept QR/Jira pairing, tray lifecycle and startup settings in the desktop shell. The native reader allows only approved GET routes; the TypeScript adapter rejects mutations. Desktop chat editing and agent approvals remain on the phone.
- Changed: Added versioned desktop installation so an active older host is not interrupted. Installer validates its pinned WebView2 SDK and can install Microsoft's signed runtime. Excluded build/tool directories from the development watcher.
- Files: src/DesktopApp.tsx, desktop-bridge.ts, desktop.css, session.ts, shared entry/API; desktop/DesktopWindow.cs; desktop build/start scripts, tests and desktop guide.
- Validation: TypeScript/Vite and native builds passed; 12 distinct browser scenarios passed, with six desktop scenarios repeated after final changes. Checked 900/1440/1920px layouts, shared Review/results/image zoom, read-only request rejection and mobile connection regression. Native smoke passed WebView loading, tray behavior, read-only route policy, nested process cleanup and saved reconnection.
- Follow-up: Active production work was left running; exit the old tray application after work completes and reopen the updated shortcut. Desktop appearance is saved per device, not synchronized with Android.

## 2026-10-02 - Native Windows tray application
- Changed: Added a native Windows window with embedded pairing QR, Jira setup, connection controls, optional per-user Windows startup and saved reconnect preferences. Close/minimize hides to the tray; explicit Exit terminates the owned process tree. Explicit Disconnect persists across launches.
- Changed: Setup installs Desktop/Start menu shortcuts; the standard start command opens the desktop application. The legacy internet console launcher remains available. Desktop mode suppresses the separate QR browser and console key output.
- Files: desktop/PocketCode.cs and manifest; desktop build/start/test scripts; OwnedHost.cs, start.ps1, setup.ps1; launchers and bilingual desktop/lifecycle documentation.
- Validation: Native build and Windows smoke checks passed: window/tray lifecycle, synthetic QR parsing, hidden and nested process cleanup, persisted disconnect and reconnect on next launch. Eight existing launcher/process ownership tests passed. Documentation links checked.
- Follow-up: Windows sign-in startup was not tested by logging out. Temporary tunnel URLs can change and require a new phone QR scan. Desktop executable updates require rerunning its installer; server updates remain separate. No Android code changed.

## 2026-10-01 - QR-only connection screen (0.20.6)
- Changed: Removed manual address/key fields and their divider from app entry. Camera scanning and QR image import connect immediately; a saved or scanned connection can be retried without displaying credentials.
- Changed: Updated connection-error recovery text and illustrated pairing guides. Migrated browser test setup to synthetic QR image decoding.
- Files: src/Connect.tsx, pairing.css, connection-errors.ts, translations.ts; QR browser helper and connection scenarios; user guides and connection screenshot.
- Validation: 22 distinct connection/workspace/settings/host-update browser scenarios and six pairing unit tests passed, with the connection scenarios repeated after final text changes. Narrow English/Russian layouts and synthetic screenshot checked. TypeScript/Vite and Android build passed.
- Follow-up: Native camera behavior was not tested on a physical Android device. Production host was not restarted.


## 2026-10-01 - Expand bilingual product documentation
- Changed: Added documentation indexes plus English/Russian guides for providers and accounts, everyday workflows, and troubleshooting. Covered project discovery, concurrent chats, attachments, subagents, diff scaling, Jira workflows, notifications, persistence and update boundaries.
- Changed: Replaced the obsolete feature matrix with current three-provider coverage; corrected shared Jira account selection, removed terminal navigation claims and linked the guides from both home pages.
- Files: README.md, FEATURES.md, docs indexes, user guides, reference and six topic guides. Existing synthetic screenshots reused; no user content added.
- Validation: Checked current implementation and targeted reader findings; all 152 local links/images/anchors across 14 documentation pages resolve. Documentation-only change; no application build or runtime tests required.


## 2026-10-01 - Discover local Git projects and choose folders on the phone (0.20.5)
- Changed: Project lists incrementally discover local Git repositories and worktrees without existing AI chats. Requests share bounded scan batches, cache results, and refresh completed scans after five minutes.
- Changed: Windows launch no longer prompts for a folder or Enter. Default access includes the launch project and ready fixed drives; explicit ProjectPath arguments retain restricted roots. Folder selection stays in the phone app.
- Files: server/git-projects.ts, app.ts; scripts/start.ps1; project discovery tests and user guides.
- Validation: Eight discovery and API performance tests passed, covering nested repositories, worktrees, concurrent reads, cache refresh and junction exclusion. TypeScript/Vite and Android build passed. Launcher PowerShell syntax and the noninteractive default-root block were verified without starting a host.
- Follow-up: Discovery skips system, dependency/build cache directories and directory links. Existing running hosts retain their roots until relaunched; no production process was restarted.


## 2026-10-01 - Fit review diffs to phone width (0.20.4)
- Changed: Review supports independent 4, 6 and 8 px code sizes and a persistent Fit diff to width option. Each file fits its complete unified or split columns without wrapping or shrinking controls.
- Changed: Virtual rows account for the rendered zoom, retaining access to the final line in large patches.
- Files: src/Review.tsx, ReviewFileDiff.tsx, DiffTable.tsx, review.css, translations.ts; review performance scenarios.
- Validation: 14 Review browser scenarios passed; two large-patch scenarios passed again after measurement caching. TypeScript/Vite and Android build passed. Synthetic split-view screenshot inspected.
- Follow-up: Physical Android zoom behavior remains untested. Very long lines become deliberately small in fit mode; disable it for normal reading.


## 2026-10-01 - Continue large Codex chats and index their images (0.20.3)
- Changed: Chat history and Results use byte-bounded message pages instead of loading the entire Codex transcript under a 16 MB limit. Results offsets retain every displayable message across page boundaries; latest windows keep the newest messages.
- Changed: Starting a normal or Jira turn counts displayable items without decoding image files or applying the whole-history display limit. Existing project and writer ownership checks remain.
- Changed: Codex edge scrolling follows returned offsets and merges pages, so a byte-limited page does not prevent reaching earlier or later messages. Android versionCode is 44.
- Files: server/codex.ts, codex-content.ts, app.ts; src/App.tsx; Codex, provider and chat recovery tests; application version metadata.
- Validation: 211 server/state tests and 17 history/Results browser scenarios passed. A synthetic history over 16 MB reproduced the old failure, returned all 20 images through the HTTP API, and resumed the same thread successfully. TypeScript/Vite and Android builds passed; unpacked APK/host credential and configured-denylist checks found no matches.
- Follow-up: Legacy Codex history still depends on its unpaginated RPC response; single messages over 16 MB and full subagent history retain display limits. Physical Android behavior has not been tested.

## 2026-10-01 - Task batches use an ordinary chat (0.20.2)
- Changed: Selected Jira tasks now open a single normal chat with full issue descriptions and a role-aware sequential execution prompt. Large descriptions use an attachment; preparation failures retain selection and do not start partial work.
- Changed: Removed the queue panel, queue polling and queue controls from Tasks. Individual workflow actions remain available; starting a batch chat does not automatically change Jira status or publish PRs.
- Files: src/Jira.tsx, task-chat.ts, translations.ts; Jira workflow scenarios and user guides.
- Validation: 37 Jira workflow, subagent and workspace UI scenarios passed, including full descriptions, large-batch attachments and preparation failures. TypeScript/Vite and Android build passed.
- Follow-up: Legacy queue endpoints remain for older clients. A batch attachment is subject to the normal 10 MB file limit.

## 2026-10-01 - Quieter subagent activity (0.20.2)
- Changed: Subagent links and the activity entry use compact, muted, rounded touch targets. The fallback disclosure no longer uses the boxed tool-card surface; statuses and access to details remain.
- Files: src/subagents.css, RichBlocks.tsx.
- Validation: Eight subagent interaction/layout scenarios passed, including mobile widths and enlarged interface scale. The chat screenshot was visually inspected after a focused interaction rerun.

## 2026-10-01 - Remove leftover Claude terminal navigation (0.20.2)
- Changed: Removed the Claude-only Live terminal button from the chat list and Terminal tab from mobile navigation. Claude now uses the same normal chat navigation as the other providers.
- Why: The legacy terminal shortcut remained visible after navigation simplification.
- Files: src/App.tsx and application version metadata.
- Validation: TypeScript, eight workspace regression scenarios and Android build passed.

## 2026-10-01 - Public repository privacy skill and publication guards
- Changed: Added a repository privacy skill referenced by AGENTS.md and CLAUDE.md. Public examples must be synthetic; source, screenshots, archives and release notes require review without copying private values to logs or external tools.
- Changed: Local commit/push hooks scan Git blobs and outgoing commit trees, including commit metadata. The scanner blocks common credentials, private file names and exact local denylist values, fails closed and refuses unrelated parent repositories. CI checks the public tree; the release script requires a clean checkout and a passing source scan. Hook scripts retain LF line endings across Windows/Linux checkouts.
- Files: .agents/skills/protect-public-data, AGENTS.md, CLAUDE.md, .githooks, .github/workflows/privacy.yml, scripts/privacy-guard.mjs, scripts/publish-release.ps1 and privacy tests.
- Validation: Skill validator and four privacy tests passed, including staged-versus-working content, historical commits and malformed denylist rejection.
- Limits: Hooks are locally installed and bypassable; CI is after upload. Pattern scanning does not identify arbitrary business data or read image pixels/unpack archives. Final visual and artifact audits remain required.

## 2026-10-01 - Complete chat results and durable reading positions (0.20.1)
- Changed: Results scans every available history page gradually, independently of the chat's 5,000-message viewport. All results and source attachments are initially visible; categories, progressive rendering, scan progress and retry remain available. File contents still load on demand.
- Changed: Chat positions are stored per host, provider and session, with message anchors and history-window restoration across navigation and reload. Jump controls depend on distance from the latest message instead of scroll direction. The history edge states whether older messages exist, are loading, or the beginning has been reached.
- Files: src/useChatOutputIndex.ts, chat-position.ts, chat-outputs.ts, ChatOutputs.tsx, App.tsx; chat recovery/output tests and user guides.
- Validation: 24 Playwright output, recovery and workspace scenarios passed, including complete paginated indexing, scroll anchors, navigation and reload; 10 output parser unit tests passed. TypeScript/Vite and Android APK build passed.
- Follow-up: Only files represented in provider history can be discovered. Deleted/inaccessible files cannot be previewed. Closing Results cancels further indexing; reopening rescans. Physical Android testing remains unavailable.

## 2026-10-01 - GitHub Copilot workspace and automatic sign-in detection (0.20.0)
- Changed: Added GitHub Copilot using the official SDK, with separate project/chat preferences, history, streaming replies, attachments, follow-ups, stop, permission questions and Jira execution queues. Shared Jira authorization remains separate from the selected task AI.
- Authentication: Existing PC credentials are discovered by the SDK, including GitHub CLI. An explicit settings action launches the bundled official CLI browser login on the PC; it times out after five minutes and is terminated with the host. Pocket Code does not copy GitHub tokens to Android.
- Files: server/copilot.ts, copilot-login.ts, app.ts, index.ts; provider-aware UI/types, CopilotConnection.tsx and workspace tests.
- Validation: TypeScript, seven Copilot unit/API tests and the mobile Copilot scenario passed; eight existing workspace scenarios and 27 provider/activity/workflow tests passed. A live SDK check detected GitHub CLI authentication, and a tool-free prompt completed with an assistant response.
- Follow-up: Copilot quota details, subagent transcripts and version-triggered maintenance are not yet integrated. First-time OAuth interaction was not exercised because this PC was already authenticated; Android device behavior remains unverified.

## 2026-10-01 - Collapsible review and chat attention alerts (0.19.8)
- Changed: Review displays one scrollable list of changed files, each with a collapsible diff. Options derive visibility checkboxes from actual file extensions. Nearby patches load with three concurrent requests; virtualized rows account for preceding files changing height.
- Changed: Subagent panels use rounded edges, compact borderless rows and lighter task disclosures.
- Changed: Android has a separate notification channel for the watched chat completing, failing, stopping or requesting an answer. Event fingerprints prevent repeat alerts; old completed history stays quiet. Tapping an alert opens its chat.
- Files: src/Review.tsx, ReviewFileDiff.tsx, DiffTable.tsx, review.css, subagents.css; Android ChatWatchService, ChatAlertState and ChatNotificationsPlugin; user guides and focused tests.
- Validation: TypeScript and all 23 Review/subagent browser scenarios passed, including long diffs, network recovery, stale responses and small screens. All five Android notification state unit tests passed.
- Follow-up: Android notification presentation, sound and background delivery still require a physical-device check. Alerts cover the last open watched chat and obey Android permissions/channel settings.

## 2026-10-01 - Codex history across projects (0.19.7)
- Fixed: Production hosts now list and read Codex chats from other project folders. Previously directory authorization silently removed these chats from the list.
- Boundaries: Out-of-scope or missing project folders mark chats read-only. Resume, commands, project files and local image reads retain the configured folder checks; child history still checks parent membership.
- Files: server/codex.ts, server/index.ts, tests/codex.test.ts.
- Validation: TypeScript passed; live metadata-only check returned 165 chats (162 read-only, three within the connected project). No conversation bodies were inspected by the live check. 30 Codex/subagent tests and TypeScript/Vite/Android build passed (versionCode 39).
- Follow-up: Archived chats remain excluded, as before. To continue a read-only chat, connect its project folder on the PC.


## 2026-10-01 - Jira transition time estimates (0.19.6)
- Changed: Transition forms support Jira timetracking fields with explicit-unit original estimates, such as 2h or 1d 30m. Required estimates block submission until valid; estimates travel with the transition and never create a worklog.
- Validation: Server rejects empty, zero, malformed or extra time-tracking properties before side effects. TypeScript and 12 time/workflow tests passed; the required-estimate browser scenario and Android build passed (versionCode 38).
- Files: src/jira-time.ts, JiraWorkflow.tsx, translations.ts; server/jira-workflow-actions.ts and focused tests.
- Follow-up: This supports fields exposed by Jira transition metadata. Hidden workflow validators or required worklogs are not inferred; they may still require completion in Jira.


## 2026-10-01 - Simpler mobile connection screen (0.19.5)
- Changed: Removed the first-time setup disclosure, storage explanation and descriptive footer below the connection form. QR scanning and image import remain the primary connection actions.
- Why: The extra introductory details cluttered the mobile entry screen.
- Files: src/Connect.tsx.
- Validation: TypeScript/Vite/Android build passed (versionCode 37). Source/APK/host privacy checks passed.


## 2026-10-01 - Shared PC Jira connection and compact stop control (0.19.4)
- Changed: The PC QR page links to a common Jira setup screen. Select the existing Claude connector or sign in to direct MCP through Codex; the saved Jira connection serves both task AI providers.
- Fixed: Codex reports configured-but-not-signed-in Jira explicitly instead of suggesting an unrelated runtime update. A live read-only discovery confirmed this condition; no Jira content or credentials were exported.
- Lifecycle: OAuth starts only on a button press, has a five-minute timeout and is terminated with the host. Setup uses a separate, ephemeral, local-only key. Connection changes are rejected while tasks or other mutations are active.
- UI: Stop now has the same 28-36 px visible face as Send, with a 48 px touch target retained.
- Files: server/jira-connection.ts, jira-login.ts, jira-codex.ts, jira-existing.ts, app.ts, index.ts, pairing.ts; src/Jira.tsx, composer-controls.css and focused tests.
- Validation: 18 focused server tests and three browser scenarios passed. TypeScript/Vite/Android build passed (versionCode 36); setup screenshot inspected. Full 200-test runs each encountered one transient Windows EPERM rename failure in different suites; both affected suites passed separately. Source/APK/host privacy audits passed.
- Follow-up: Real Atlassian authorization requires user interaction and any required site-admin approval. Existing Claude access can be used independently of the selected task AI.


## 2026-10-01 - Compact chat allowance indicator (0.19.3)
- Changed: Added a small right-aligned ring and remaining percentage inside the composer. Tapping opens the existing usage details; returning to chat preserves its draft and selected conversation.
- Semantics: Uses the lowest reported remaining percentage across shared and explicitly matched model windows for the selected provider. Missing, expired, stale or failed data shows a neutral dash; unrelated model quotas are excluded.
- Changed: Reduced the visible send button to 28-36 px with a smaller arrow, retaining its 48 px touch target.
- Performance: Refreshes once per minute while visible and on return, pauses in hidden documents and prevents overlapping requests. Late replies cannot cross provider/connection changes.
- Files: src/UsageIndicator.tsx, usage-summary.ts, usage-indicator.css, composer-controls.css, App.tsx and focused quota/layout tests.
- Validation: Two summary unit tests, 64 responsive layouts and seven final usage UI scenarios passed. The compact send face retains a 48 px touch target. TypeScript/Vite/Android build passed (versionCode 35); screenshot inspected. Physical Android testing unavailable.

## 2026-10-01 - Image gallery and touch zoom (0.19.2)
- Changed: Results shows image thumbnails, with a shared full-screen image viewer for Results and chat images. Pinch/pan, zoom buttons, Fit to screen, Back and focus restoration keep the surrounding conversation/gallery intact.
- Performance: Only nearby thumbnails load, with at most two authenticated reads/decodes at a time. Off-screen previews release object URLs. External images still require an explicit load; the existing local endpoint transfers the original file before downsampling.
- Fixed: The Codex access help button stays beside its heading, clear of the activity drawer handle. Diff columns account for Unicode glyph widths and preserve space for short patches.
- Files: src/ImageViewer.tsx, OutputImage.tsx, image-thumbnails.ts, ChatOutputs.tsx, RichBlocks.tsx, related styles/tests and user guides.
- Validation: Full browser suite passed 230/230, including touch pinch/pan, bounded thumbnail reads, URL cleanup, focus restoration and narrow English/Russian layouts. TypeScript/Vite/Android build passed (versionCode 34). Synthetic gallery/viewer screenshots were inspected.
- Follow-up: Pinch and pan are tested through browser touch input; physical Android validation remains unavailable.

## 2026-10-01 - Chat and diff performance audit (0.19.2)
- Changed: Memoized chat lists/messages/Markdown, reused unchanged poll snapshots, rendered collapsed tool bodies on demand, and skipped unchanged cache writes. UI polls pause when hidden and resume without overlap; host execution remains independent.
- Changed: Virtualized fixed-height diff rows with stable split columns, preserved scroll/reading controls, and cleaned up observers/listeners. Large patches retain their data but only visible rows plus overscan are mounted.
- Server: Coalesced in-flight read requests without retaining completed session/history results. Codex history size accounting is linear. Git availability uses safe existence checks and reuses metadata; independent Git reads run concurrently.
- Measurements: Synthetic production Chrome at 390x844/4x CPU, 500 rich messages: eight-character input 14.12s to 0.29s. Matched 20,000-line diff open 22.74s to 0.52s; mounted rows 20,001 to 49, JS heap 70.21MB to 13.78MB. Single stress runs, not physical Android timings.
- Files: Chat snapshot/poll/render helpers, src/DiffTable.tsx and diff-rows.ts, server read/review paths, scripts/benchmark-ui.mjs, regression tests and docs/PERFORMANCE.md with synthetic results.
- Validation: 192 server/state tests and all 230 browser scenarios passed. TypeScript/Vite/Android build passed. Large unified/split diffs, small patches, Unicode widths, reading mode and size changes are covered.
- Follow-up: Initial mounting/returning to 500 rich messages still costs around 1.7-2.2s; Codex history still scans all pages and changed job snapshots carry accumulated messages. Physical Android battery/thermal/network tests remain unperformed.

## 2026-10-01 - Readable live review and illustrated user guides (0.19.1)
- Changed: Review options open in an overlaid sheet instead of reducing the diff viewport. Code follows chat size with a 14 px minimum by default and offers a saved 10-24 px override.
- Added: Visible comparison mode/file count and immediate refresh. Open review refreshes every five seconds while visible and on resume, preserving selection and scroll. Missing selected files recover through a fresh list; background failures retain content with an error.
- Documentation: English/Russian guides cover QR pairing, Git comparison scope, APK/host updates, chats, project documents, task integrations and disconnecting, using synthetic screenshots.
- Files: src/Review.tsx, src/review.css, tests/review-focus.spec.ts, tests/documentation-screenshots.spec.ts, README.md and docs/.
- Validation: Twelve Review/settings/capture scenarios passed across focused runs, plus the additional removed-file/network recovery scenario and two final screenshot captures. Five Git review server tests passed. TypeScript/Vite/Android build passed (versionCode 33). Screenshots inspected at phone dimensions; 320px English/Russian 60%/130% layouts covered.
- Follow-up: Physical Android testing unavailable. Review reflects Git state within the project folder, not a chat-only edit log or comparison to the published release.


## 2026-10-01 - Workspace-aware Jira and direct Codex tools (0.19.0)
- Changed: Jira settings, reads, workflow actions, sequential queues and task notification/read state follow the selected Claude or Codex workspace. No automatic cross-provider fallback is performed; legacy requests without a provider keep Claude behavior.
- Added: Codex app-server MCP adapter discovers one Jira tool catalog and calls exact tools in an ephemeral thread without starting a model turn. It rejects missing/ambiguous connectors and unrelated tools; uncertain writes are never retried automatically. Native authorization remains in Codex.
- Optimized: Existing Claude connector coalesces issue and transition reads for five seconds; mutations invalidate the cache. Claude CLI inference remains necessary for that connection path. Explicit direct OAuth mode remains supported.
- Files: server/jira-codex.ts, Jira adapters/routes/workflow, provider-scoped frontend requests and notification feed; documentation and routing tests.
- Validation: 182 server/state tests passed, then seven focused tests after transport cleanup. 26 Jira/notification UI tests passed; two connection tests passed including new provider switching coverage. TypeScript/Vite/Android build passed (versionCode 32).
- Follow-up: Live Codex discovery found an unauthenticated Jira connector; authenticated account-backed tool execution was not verified. Synthetic tests verify exact direct calls, no model turns, provider isolation and single-attempt mutations. Physical Android testing remains unavailable.

## 2026-10-01 - Public onboarding documentation and setup launcher
- Changed: Replaced the dense landing README with a user-oriented overview, screenshot gallery, quick start, privacy notes and troubleshooting. Added a Russian guide and retained advanced material in docs/REFERENCE.md with corrected update/drawer descriptions.
- Added: Setup Pocket Code.cmd checks Node.js 22+, offers winget installation when needed, opens the APK release page and starts the existing Wi-Fi/internet launcher. Native AI sign-in and Android installation confirmation remain manual.
- Privacy: Documentation screenshots are generated from synthetic browser fixtures; no live projects, credentials, conversations or task-provider data were used.
- Files: README.md, docs/, scripts/setup.ps1, Setup Pocket Code.cmd, tests/documentation-screenshots.spec.ts.
- Validation: Screenshot scenario passed and all three images visually inspected; 17 local documentation links resolved. PowerShell syntax and three mocked setup paths passed (existing Node, upgrade, winget unavailable). No real software installation was performed.

## 2026-10-01 - Consistent chat list sizing and saved history (0.18.1)
- Changed: Chat rows use Project/Settings category typography, spacing, icons and minimum heights at every interface scale.
- Added: Local bounded cache of the latest session list and last 100 messages in up to 20 recently viewed chats per provider. Saved content appears before host refresh; request failures retain it. Live message snapshots are saved without restoring execution or approval state.
- Privacy: Cache namespaces use a SHA-256 pairing-key fingerprint, never the raw key; providers remain separate. Disconnect and forget clears cached conversations. Tunnel address changes retain the same paired cache.
- Files: src/chat-cache.ts, App.tsx, interface-sizing.css; cache and chat recovery tests.
- Validation: Two cache tests and six browser recovery tests passed, including delayed refresh after reload. TypeScript/Vite/Android build passed (versionCode 31).
- Follow-up: Initial connection still requires the host health check; this is cached history after connection, not a fully offline mode. Physical Android testing was unavailable.

## 2026-10-01 - Provider-neutral task notification inbox (0.18.0)
- Added: Tasks header bell with unread count, unread filtering, explicit read-all, and navigation to the correct Jira site/issue. Opening the inbox alone does not acknowledge notifications; failed or cancelled navigation remains unread.
- Backend: Provider adapter interface with Jira as the first implementation. Foreground clients request cached inbox state; the host polls assigned-task changes at most once per minute, coalesces reads, resumes paginated scans and stores the latest 300 notifications/read states locally. Initial sync establishes a quiet baseline.
- Events: Status changes, general updates and comment-count increases when supplied by Jira. This is a Pocket Code change feed, not Jira's internal notification inbox or Android push notifications. Existing MCP authorization is reused; no Jira writes are introduced.
- Reliability: Atomic serialized persistence, stable event IDs, provider/site isolation, disconnect generation guards and cursor recovery. Draft navigation waits for issue retrieval and rejects stale replies after inbox closure/connection changes.
- Files: server/task-notifications.ts, Jira adapters and app routes; src/TaskNotifications.tsx, Jira.tsx and App.tsx; notification tests.
- Validation: 175 server/state tests passed, followed by six focused inbox/API tests including authenticated routes. 26 Jira/notification/attachment UI tests and six final notification UI scenarios passed; inspected English/Russian 320px layouts at 60%/130%. TypeScript/Vite/Android build passed.
- Follow-up: Live account-backed Jira delivery and physical Android installation were not exercised. Other task systems can implement the provider interface but are not connected yet; mentions and full comment bodies are not available in this feed.

## 2026-10-01 - Attachment previews and left-aligned Back navigation (0.18.0)
- Changed: Images attached to a draft display local thumbnails; other files show a compact name/type/size card. Each has a separate 48px removal target; the strip scrolls horizontally and stays bounded on narrow screens.
- Reliability: Preview object URLs are released when cards unmount; failed/unsupported image previews fall back to file cards. Draft attachments survive tab/workspace navigation and rejected sends; only upload IDs are sent to the host.
- Fixed: Back controls in Project, task details, Settings, results and subagent panels align with the left content edge rather than centering in a stretched track.
- Files: src/AttachmentTray.tsx, attachment-tray.css, App.tsx and interface-sizing.css; attachment, project and draft-navigation tests.
- Validation: 25 attachment/project/recovery/navigation scenarios plus 12 attachment/workspace/follow-up scenarios passed. Checked decoded image previews, removal cleanup, invalid images, saved drafts and Back icon alignment; inspected 320px screenshots. Android build passed.

## 2026-10-01 - Direct manipulation of the activity drawer (0.17.2)
- Changed: Larger, higher-contrast right-edge handle (8x72px with a 56x88px touch target). The drawer follows left opening drags and right closing drags before release, then settles in 120ms; tap, Back and keyboard access remain available.
- Reliability: Pointer movement updates composited transforms without rerendering the chat; suppresses post-drag clicks, handles cancelled gestures and respects reduced motion. The scroll container explicitly permits vertical panning so browsers do not cancel horizontal touch drags.
- Files: src/ActivityHandle.tsx, src/ActivityDrawer.tsx, src/App.tsx, src/styles.css, src/activity-drawer.css; tests/activity-drawer.spec.ts.
- Validation: All 16 activity UI tests passed, including real browser touch events, partial dragging, reversal, cancellation, focus, all main sections and 60%/130% scales. Inspected partial-drag and handle screenshots. TypeScript/Vite/Android build passed.
- Follow-up: Physical Android device testing was not available.

## 2026-10-01 - Interface-wide scale consistency audit (0.17.2)
- Changed: Shared bounded typography for Tasks cards/filters/actions, file rows, Review controls, result/subagent/activity panels, Settings labels and terminal controls. Message, Markdown and diff reading sizes remain independent.
- Why: Several controls used unbounded rem/calc values or fixed px sizes, producing tiny text or failing to respond consistently to interface scale.
- Files: src/interface-sizing.css, src/main.tsx; tests/jira-workflow.spec.ts and tests/project-docs.spec.ts.
- Validation: The 84-case responsive/Project/Settings matrix passed with one fixture-loading timeout passing on isolated retry; 35 final Jira/Project scenarios passed, including computed cross-section font equality at 60%, 100% and 130%, reload persistence and file rows. Inspected narrow layouts.

## 2026-10-01 - Consistent Project control sizing (0.17.1)
- Changed: Project overview cards, document lists, folder selector and labels share Settings typography and category control sizing, including readable minimum sizes at reduced interface scale.
- Why: Project used rem and unconstrained scale formulas while Settings used bounded font sizes, producing inconsistent proportions.
- Files: src/category-sizing.css, src/project-docs.css, src/settings.css; tests/project-docs.spec.ts.
- Validation: 20 Project/Settings UI scenarios passed, including matching computed card sizes at 60%, 100% and 130%, persistence after reload and narrow layouts. Inspected 320px/130% screenshot; TypeScript, Vite and Android build passed.
- Follow-up: Physical Android visual verification was not available. Document Markdown retains the independently configured reading font size.

## 2026-10-01 - Running-chat clarifications and compact task heading (0.17.0)
- Changed: Tasks shows the selected Jira role in the main heading; removed the Assigned to me row and placed refresh beside search.
- Added: A send button remains available beside Stop during an active Pocket Code run, including uploaded attachments. Codex uses turn/steer with the exact active turn; Claude queues follow-ups in the same streaming-input process, delivering the next prompt after each result. Pending/unprocessed Claude input is visible.
- Reliability: Follow-up IDs deduplicate concurrent/retried requests. Ambiguous delivery failures are not automatically replayed; pre-delivery validation failures can be retried. Finished/not-ready runs preserve the draft, attachments stay scoped to the job project, and abort/stream completion closes Claude input.
- Files: server/followups.ts, prompt-stream.ts, jobs.ts, codex.ts and app.ts; src/App.tsx, Jira.tsx, styles/translations; follow-up tests and SDK mocks.
- Validation: 170 server/state tests and 18 Jira/follow-up UI scenarios passed. Tested turn identity, deduplication, queue drain, authentication, attachment scope, rejected drafts and 320px controls; inspected task layout at 130%. TypeScript/Vite/Android build passed.
- Follow-up: Real account-backed Codex/Claude clarification turns and physical Android installation were not exercised; engine tests use mocked transports. Imported Desktop runs are still subject to existing ownership restrictions.
- References: https://learn.chatgpt.com/docs/app-server and https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode

## 2026-10-01 - Minimal activity edge handle (0.16.4)
- Changed: Replaced the framed activity button, icon and count with a translucent 4x44px rounded edge handle and an invisible 48x64px touch target. Status remains on the Chats tab.
- Added: Tap, keyboard and deliberate left-swipe opening. Vertical/cancelled gestures do not open the drawer; vertical touch scrolling is allowed. Reading mode still hides the handle.
- Files: src/ActivityHandle.tsx, src/App.tsx, src/styles.css, tests/activity-drawer.spec.ts and release versions.
- Validation: All 14 activity UI scenarios passed, including swipe direction, keyboard/focus, tap and narrow-screen layouts. Inspected the 390px screenshot; TypeScript/Vite/Android build passed. Physical touch-device verification remains pending.

## 2026-10-01 - Android background chat notifications (0.16.3)
- Added: A native data-sync foreground service tracks the last open chat independently of WebView timers. Notification taps reopen that provider/session; explicit Back or disconnect clears tracking. Permission is requested through Android.
- Changed: The activity endpoint exposes only a bounded action category for notification text (commands, file edits, search, tool use or response), never command arguments or output. Status versions remain stable.
- Reliability: Native requests are authenticated, bounded and reject redirects; stale selections are discarded. Terminal states stop polling and retain a result notification. Credentials remain in memory; idle/long-running tracking and Android timeout paths stop cleanly.
- Files: src/chat-notifications.ts and App; server/activity.ts and types; Android ChatNotificationsPlugin, ChatWatchService, MainActivity, manifest and notification icon.
- Validation: 13 activity/state tests passed; Android/TypeScript/Vite build passed. No attached Android device or emulator was available, so physical notification delivery, permission and background lifecycle remain unverified.
- Follow-up: Tracks retained Pocket Code runs. Android can limit background data-sync services; timeout leaves a reopen instruction. Reference: https://developer.android.com/develop/background-work/services/fgs/timeout

## 2026-10-01 - Remember chat navigation and show tab status (0.16.3)
- Changed: The Chats tab restores the open conversation and draft across main sections; only explicit Back switches to the list, which is also remembered per workspace.
- Added: A dot on the Chats navigation button reports unanswered input (yellow), errors (red), running work (pulsing blue) or unread completion (green), in that priority order. Accessible descriptions supplement color; reduced-motion disables pulsing.
- Files: src/App.tsx, src/styles.css, activity/navigation UI tests and release versions.
- Validation: All 14 activity/navigation scenarios passed, including selected conversation and draft retention, explicit Back, all status colors and narrow layouts. Geometry tests now wait for the drawer animation; the simulated-clock test disables animation.

## 2026-10-01 - Right-edge activity drawer and quieter composer (0.16.2)
- Changed: Activity opens from a right-edge handle across main sections. Removed the global activity header and All chats action; the panel slides from the right and respects reduced-motion preferences. Reading mode hides the handle.
- Changed: Removed the redundant provider connection/work caption below the composer; active work remains visible in the conversation and activity feed.
- Files: src/App.tsx, src/ActivityDrawer.tsx, src/activity-drawer.css, src/styles.css, tests/activity-drawer.spec.ts and release versions.
- Validation: All 13 activity/navigation UI scenarios passed, including global access, right alignment, focus restoration, drafts and 320px layouts at 60/130%. Inspected the 130% screenshot. TypeScript/Vite/Android build passed.
- Follow-up: Physical-phone installation remains unverified.

## 2026-10-01 - Global activity header and explicit inference choices (0.16.1)
- Changed: Chat activity opens from one shared application header in Tasks, Chats, Project and Settings, including the chat list. Reading mode hides this header; Back and focus restoration remain available.
- Changed: Model selection displays the advertised Codex default name or Sonnet for Claude; effort displays the actual advertised default level without a Default label. Unknown legacy metadata shows a dash. Claude requests explicitly select Sonnet when no other model is chosen; legacy Codex requests preserve host configuration.
- Files: src/App.tsx, src/EffortPicker.tsx, src/styles.css, activity/effort UI tests and release versions.
- Validation: 26 activity/navigation/workspace/effort UI scenarios passed in the combined run; the remaining outdated model display was fixed and all six effort scenarios passed on rerun. TypeScript/Vite/Android build passed.
- Follow-up: Physical-phone installation remains unverified. Claude currently exposes model family names, not exact model revision or effort metadata.

## 2026-10-01 - Cross-workspace chat activity drawer (0.16.0)
- Added: A left Activity drawer with questions/approvals and errors, running chats, and unread completed/stopped results from both AI workspaces. Entry badges appear in the chat list and mobile chat header; All chats returns to history. Navigation preserves drafts, modal focus and Android Back behavior.
- Changed: The authenticated lightweight activity endpoint reads retained Pocket Code jobs without invoking a model. It keeps the newest run per provider/session, retains active chats first in a 100-item window and reports stable status versions plus final message IDs without transcripts.
- Changed: Terminal entries are acknowledged only after successful visible viewing at the conversation bottom, or loading the exact final history message. Unanswered/running entries remain; failed loads and reading older messages do not clear results. Viewed versions are stored locally per host without credentials.
- Reliability: Polling pauses when hidden, coalesces in-flight requests, rejects stale host responses and retains offline data. Busy target workspaces never queue a surprise navigation. Old hosts show an update instruction.
- Files: server/activity, types and app; src/ActivityDrawer, useActivity, activity-state, App, translations and styles; activity/workspace/navigation tests and release versions.
- Validation: 165 server/state tests passed. All 20 activity/workspace/navigation UI scenarios passed, including a focused rerun after fixing a renamed test selector. TypeScript/Vite/Android build passed; 320px screenshots at 60/130% inspected. Initial UI failures identified a missing Retry translation and an outdated Review focus expectation; both corrected.
- Follow-up: Feed covers retained runs started through Pocket Code in the current host runtime, not inferred native Desktop activity. Physical-phone installation remains unverified.


## 2026-10-01 - Compact workspace selection (0.15.1)
- Changed: The chat list places the Codex/Claude selector and New chat in one compact row. Removed the redundant Workspace label, border, arrow decoration and separate-row spacing; Settings retains its descriptive label and all selectors retain accessible names.
- Why: Workspace choice should not consume a large form section above the chat list. Touch targets remain 48px despite small text/interface scales.
- Fixed: Restored the Review entry's 48px target on wide touch layouts; the responsive fixture now closes the redesigned Review by its accessible Back action.
- Files: src/App.tsx, src/styles.css, src/review.css, tests/responsive-layout.spec.ts and release versions.
- Validation: Eight workspace interaction scenarios passed. Ten EN/RU layout scenarios at 320/360/440/884px and 60/65/130% passed after correcting the Review target found on 884px. TypeScript/Vite/Android build passed; screenshots checked.
- Follow-up: Physical-phone installation remains unverified.


## 2026-10-01 - Focused review, chat surfaces and Codex effort (0.15.0)
- Changed: Review binds to the selected chat folder, displays repository and branch, and keeps comparison controls behind one options button. An eye toggle hides chrome while retaining diff position; Back/Escape restores controls before closing. Stale file responses cannot replace the current selection.
- Fixed: Literal Git paths prevent bracket-containing filenames from selecting the wrong diff. Nested repositories, scoped subfolders and linked worktrees return explicit repository/project metadata.
- Changed: User messages use quiet content-sized bubbles with accessible copy actions. Subagent activity uses compact clickable rows without redundant assistant headers; context and attachments remain available.
- Added: Codex reasoning effort beside the model, populated from native model/list and saved per model. Requests pin the displayed model/default effort, reject unsupported values before inference, and preserve older hosts without metadata.
- Files: Review/App, Messages/RichBlocks/Subagents styles, EffortPicker, server review/codex-models/codex/app, translations, focused tests and release versions.
- Validation: 153 server tests passed; 18 combined UI scenarios passed plus the existing subagent/typography checks (15 including the three surface cases). All six effort scenarios passed again after preserving legacy host model behavior. TypeScript/Vite/Android build passed. Native Codex 0.159.2 model/list was checked without inference; synthetic requests verified effort forwarding.
- Follow-up: Physical-phone installation and a paid real AI turn using effort have not been tested.


## 2026-10-01 - Direct project document navigation (0.14.1)
- Changed: Removed the project location footer and repeated Files/Rules/Changelog tabs from nested project screens. Folder selection appears only on the overview. A sole rules/changelog document opens directly; multiple documents retain a category-specific list. Truncated indexes never assume only one document exists.
- Changed: Markdown views keep filename, content, refresh and Back controls without duplicated category/path metadata. Back returns to the list or overview and restores focus; stale responses remain isolated and polling stops after leaving a document.
- Why: Categories should lead to their content instead of repeating the parent navigation and requiring unnecessary taps.
- Files: src/ProjectDocs.tsx, src/project-docs.css, tests/project-docs.spec.ts, README.md and package/Android versions.
- Validation: TypeScript and all 14 project UI scenarios passed, covering EN/RU, 320/360px widths, 60/100/130% scale, direct/multiple/truncated documents, Back, safe Markdown, retries and polling. TypeScript/Vite/Android build passed; APK signature matches 0.14.0.
- Follow-up: Physical-phone installation has not been tested.

## 2026-10-01 - 0.14.0
- Changed: Main Tasks, Project and Settings headers contain only the section title, without a redundant Back arrow or AI selector. Project selection is inside the Project screen; provider selection lives in Chats and AI/usage settings.
- Tasks replaces Jobs, with native Jira status-category, project, status and type filters. Filter changes clear selection; batch selection follows the active query.
- Project opens an overview of Files, Rules and Changelog. Saved text/interface scaling is consistent on task and document cards.
- Simplified headers and compact expandable command/file activity; removed the Normal/Plan selector from chats.
- Added persisted Codex/Claude runtime change detection and one-time compatibility tasks in a shared Pocket Code source project. Configure automatic checks under Settings → Updates. First observation establishes a baseline; publication and host restart remain separate.
- Validation: 148 server tests, 64 responsive scenarios and focused interaction/typography tests passed; Android build and current Codex protocol initialization passed. Physical-phone installation and real automatic AI maintenance execution remain unverified.

## 2026-10-01 - 0.13.1
- Added the Mint palette with English/Russian names and saved selection.
- Moved Disconnect and forget to the end of the scrolling settings index; it is absent from settings subpages.
- Includes the PC runtime shutdown fixes below. Console ownership is provided by the updated Windows launchers in the source repository.
- Validation: Android/TypeScript/Vite build and APK signature compatibility passed, along with nine focused server tests, chat/update browser checks, and all three settings-navigation scenarios.
- Updating: Use Android 0.13.0 to test the in-app update to 0.13.1. Older builds require one manual installation of 0.13.0 or newer. Android still confirms installation.

## 2026-10-01 - Windows process lifecycle fix (included in 0.13.1)
- Changed: Closing the launcher console ends the entire owned server/tunnel/update process tree, including a replacement host. Ordinary exit does not start another instance. Repeated Start recognizes an authenticated running host, and failed CMD launchers no longer wait indefinitely for a key press.
- Changed: Added Stop Pocket Code.cmd and authenticated runtime controls. Graceful Stop refuses active work or an update handoff, waits for persistence and tunnel cleanup, and prevents new work during exit.
- Files: Windows launchers, scripts/OwnedHost.cs, scripts/run-host.ps1, scripts/stop.ps1, server runtime/update handling and lifecycle tests.
- Validation: All 140 Node tests and TypeScript passed. Windows process tests verified detached-child/replacement cleanup and preservation of unrelated processes; six isolated launcher tests passed.
- Follow-up: No new APK or release assets. Use the updated Windows launchers for process-tree ownership; direct development server commands do not provide it.

## 2026-10-01 - 0.13.0
- Added coordinated updates: after Android upgrades, it requests the matching PC release. The PC verifies and prepares a separate installation, waits for active work, restarts and verifies the new process. Startup failure attempts rollback.
- Added persistent host installation selection, retained tunnel/pairing during automatic handoff, and Settings-only progress/retry/reconnection states.
- Fixed Invalid update source caused by native JSON integer handling; APK hash, identity and signing checks remain enforced.
- Validation: 127 Node tests, 155 browser scenarios, native Java numeric regression and TypeScript/Vite/Android build passed. Isolated real host tests covered dependency installation, busy deferral, handoff and rollback.
- Limits: Older affected Android builds need one manual APK installation. Host auto-update requires bridge 0.13.0+, Windows and GitHub/npm access. Android confirmation and physical-device verification remain necessary.

## 2026-10-01 - 0.12.0
- Added saved Codex access modes: Full access by default, Ask for approval and native Auto review. Plan and Reviewer/QA tasks stay read-only; managed-policy refusals remain visible.
- Added account usage limits for Codex and Claude, including hourly/weekly windows when available, remaining allowance and reset times. Missing data is never shown as zero usage.
- Reorganized Settings into Appearance & language, AI & workspace, Usage limits, Jira, Updates, PC connection and About. Disconnect and forget stays at the bottom; Codex access explanations open from a question-mark button.
- Simplified the chat list, made Review/Results controls contextual, and scaled provider labels, tool blocks and code with chat text. Shared project discovery is included in this APK.
- Validation: 116 Node tests passed. The full browser run passed 148 scenarios; its remaining test passed after correcting test-only Unicode corruption. TypeScript/Vite, Android build/signature compatibility and no-model provider probes passed. A focused health-version regression also passed.
- Limits: Physical-device and participant testing remain necessary. Claude limits use an experimental SDK API and depend on account support. Android still asks the user to confirm APK installation.

## 2026-09-30 - Shared project discovery across workspaces
- Changed: Project selectors share configured roots and allowed folders discovered from Claude and Codex histories, including nested projects. Each workspace retains its selected folder after reload.
- Why: Nested folders previously disappeared from the project picker when switching providers. Conversation histories and drafts remain separate.
- Files: server/app.ts (`/api/projects`), src/App.tsx, tests/providers.test.ts, tests/workspaces.spec.ts, README.md.
- Validation: TypeScript/Vite build, 102 Node tests and 16 Playwright workspace/navigation/project-document scenarios passed, including delayed discovery and provider failures.
- Follow-up: Source fix only; no new APK release or deployment.

## 2026-09-30 - 0.11.0
- Added Project with read-only Markdown rules, changelog discovery, live document refresh and Files navigation.
- Added categorized chat Results, separate source attachments, inline image thumbnails and authenticated local previews. Recent results appear first; saved content and current PC files are distinguished.
- Added scoped subagent activity/child context, automatic history edge loading, reading mode and recovery for Codex active-writer rejections without losing drafts.
- Added Jira search/categories, role-aware workflow actions, per-role chat links, durable recovery and confirmed PR publication. Full descriptions load independently of transition metadata.
- Fixed overlapping mobile headers/settings, compact touch targets, stale responses, paired tool disclosures and nested Back navigation.
- Validation: 101 Node tests and 128 browser scenarios passed, including a 64-profile responsive matrix; TypeScript/Vite and Android build passed. Read-only live checks confirmed description and child-history retrieval.
- Limits: Physical-device and participant testing remain necessary. Jira mutations/real task PR publication were not used as live tests. Android confirms installation; project rules remain read-only and result indexing is bounded to loaded history.

## 2026-09-30 - 0.10.0
- Added Claude/Codex workspaces with separate chats, drafts, models, projects and Jira execution queues. Local Codex uses the existing PC login and supports history, attachments, streaming, approvals and cancellation.
- Added an actual project selector, per-chat drafts, reliable reconnect prefilling, clear activity states, accessible dialogs and Android Back handling. Mobile tap areas stay at least 48 CSS px even with compact typography.
- Fixed task-record exhaustion, stale cached APK installation, Git filter execution during Review, Codex attachment scope, reconnect races and completed-turn history syncing.
- Restored five damaged dependency/engine metadata ranges without changing pinned packages; a clean npm ci dry run passed.
- Documented feature coverage, usability evidence and remaining limits in FEATURES.md and USABILITY.md.
- Validation: 43 Node tests, 26 browser scenarios, Android build/signature verification and a small live Codex smoke test passed. Sanitized source and APK passed targeted privacy scans.
- Limits: Physical-device and participant testing remain necessary. Codex budget/live terminal and desktop-specific interactive tools are not supported. Android confirms APK installation.


## 2026-09-30 - 0.9.1
- Fixed authenticated APK downloads from the hidden PC runtime cache.
- Added an HTTP regression test that checks authorization and exact downloaded bytes.

## 2026-09-30 - 0.9.0
- Added host-mediated GitHub APK updates with checksum, package and signer verification and Android installation confirmation.
- Added image previews, nested tool results, PDF opening and structured-block fallbacks.
- Added read-only Git Review with working-tree, staged and branch comparisons, split/unified layouts and return to chat.
- Expanded saved appearance settings to 8 px chat text and 60% interface scale; persisted model, mode, budget and project preferences.
- Included local chats, terminal, uploads, QR pairing, English/Russian UI and existing-connector Jira Jobs.
- Validation: automated server/UI tests and Android build; physical-device installer and PDF viewer verification remains necessary.
