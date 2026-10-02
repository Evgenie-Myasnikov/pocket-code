# Everyday workflows

[Documentation](README.md) · [Русский](WORKFLOWS.ru.md) · [Providers](PROVIDERS.md)

## Choose a project and start work

1. Connect to the PC and open **Project → Project folder**.
2. Choose a discovered repository. Discovery is incremental, so a large disk's list can grow over time. Ordinary repositories and worktrees do not need an existing AI chat.
3. For a folder missing from the list, open **Files**, navigate to it and choose **New chat in this folder**. You can also choose a drive from the project selector and browse from there.
4. Select the AI workspace, model and, for Codex when supported, effort. Send a concrete instruction with the desired result and relevant attachments.
5. Expand a tool row to inspect commands, file edits or errors. Answer questions in the chat. Send a clarification while the turn runs if needed.
6. Inspect **Review** and **Results** before deciding that the work is complete.

Switching tabs does not stop the agent. A new chat in another project can run concurrently; see [concurrency limits](PROVIDERS.md#limits-and-concurrency). Changing the project creates a new chat context rather than moving an existing conversation to another folder.

Default Windows launch gives the paired app access to ready local fixed drives. An explicit `-ProjectPath` restricts this. Discovery skips system directories, dependencies, build caches and directory links; it is not a guarantee to enumerate every repository everywhere. It does not clone remote repositories. A completed scan is reconsidered after five minutes while the app requests project updates.

## Continue a Desktop conversation

Open **Chats**, choose the provider, search and select the conversation. Supported local histories are synchronized from the PC, including available projects outside the currently selected folder. History outside allowed roots can be read-only. Cloud-only chats and proprietary interactive desktop views are not reproduced.

The phone first shows recent/cached content and refreshes it. Scroll to the earlier-history edge to load more. The loading state and beginning-of-history marker distinguish waiting from reaching the end. Reading position is retained per chat. The eye hides surrounding controls; its restore control or Android Back returns the full interface.

For Codex, an open Desktop owner can block sending even when no visible answer is streaming. Release that chat on the PC, then retry explicitly. Keep unsent text until sending succeeds; drafts are not a durable cross-device backup.

## Inspect code changes

<img src="images/review.png" width="320" alt="Scrollable review of a changed file">

Review follows the selected chat's folder. It includes other edits in that folder, not only this AI turn. For a project inside a larger Git repository, its diff is scoped to the project path.

Use **All changes** for uncommitted work, **Staged changes** for the index, and **Branch changes** to compare committed branch work with a selected base. Scroll through files and collapse headings you have finished reviewing. Hide unwanted extensions in **Show file types**.

For long lines, open the sliders button and enable **Fit diff to width**. Each file's code is scaled to fit in unified or split mode, while controls retain their size. A separate **Code size** setting offers 4–24 px; fit mode can reduce the rendered result further. Very long lines become small: disable fit to read them at a fixed size with horizontal scrolling. Both settings persist independently of general interface scale.

Review refreshes while visible. If a refresh fails, retained code may be stale; reconnect and refresh before relying on it. Reviewing does not stage, commit, merge or approve a PR.

<a id="results"></a>
## Find images and other materials

<table><tr><td><img src="images/results-images.png" width="270" alt="Images discovered in chat results"></td><td><img src="images/image-viewer.png" width="270" alt="Image zoom viewer"></td></tr></table>

Attach with the paperclip, inspect the thumbnail/file tile and remove an unwanted item with its cross before sending. Uploads have a 10 MB per-file limit and a message accepts up to ten attachments. Uploaded files are held separately from the project's code.

**Results** indexes available history independently of the part currently visible in the chat. Earlier materials appear as scanning proceeds. Choose a content category such as Images, Documents, Code, Links or Tools, and narrow to assistant outputs or your sources. Closing the panel stops further indexing; retry is available after a failed scan.

Tap an image to open its viewer. Pinch or use the zoom buttons, drag to inspect details, then use **Fit to screen** to reset. External images require an explicit load. Local file previews depend on the file still being available on the PC; a current file may differ from what existed when the message was written. Not every arbitrary path in prose is a recognized output, and Results is not a disk-wide file inventory.

PDF/text previews are supported where available. Office files and provider-specific interactive artifacts do not have full native renderers. Unknown structured information may remain in expandable details.

## Follow a subagent

Open the subagent activity from the parent chat. Available child contexts show their messages and work status; Back returns to the parent. This is a read-only inspection view, not a new independent writer to the child thread. If the provider does not expose a transcript or verified parent link, only known task/result details are available. An unknown state is not proof that the agent finished.

<a id="tasks"></a>
## Work from a Jira task

1. Connect the shared Jira account on the PC and choose your interface role in **Settings → Jira**: Developer, Reviewer or QA engineer.
2. Open **Tasks**. Search your assigned issues and combine Jira status category, project, exact status and issue type filters.
3. Open an issue to load its full description and available transitions. A failed description load is different from an empty description.
4. Choose the relevant action and project. Available actions follow the live workflow; the selected role does not grant extra Jira permissions.
5. Complete required transition fields. If Jira requires an estimate or time-related value, supply the requested field; the app must not invent one or bypass the validator. Unsupported fields need the Jira website.
6. Continue in the linked chat. An AI answer does not automatically complete the issue.

For a batch, select issues or **all matching**, then use **Open task chat**. Full descriptions are gathered into one normal chat with a sequential execution prompt. Large batches become an attachment. Batch creation does not transition issues or create PRs automatically. If preparation fails, selection remains available for retry.

**Send for review** is separate from starting work. Review the proposed branch/files first. PR publication uses GitHub CLI on the PC and requires committed changes, a clean working tree, a task branch and the repository root. The operation creates or reuses a PR and then applies the selected Jira transition. It does not merge the PR. Reviewer/QA actions do not cast GitHub approval votes.

<a id="activity"></a>
## Activity, alerts and saved state

| Surface | What it means |
| --- | --- |
| Right-edge drawer | Pocket Code runs: running, waiting for input, errors and unread completed/stopped work. Tap or drag the edge handle. |
| Chats tab indicator | A compact status hint: running, complete, error or input needed. Open the chat for details. |
| Task bell | Periodically detected task changes; not the complete Jira notification inbox. |
| Android chat notifications | Tracking of the last explicitly open chat, subject to notification permission, PC reachability and Android background execution. |

Opening a completed activity and successfully reading the conversation at the bottom marks it viewed. Questions remain until answered. Activity is based on host-managed runs, not every running task in native Desktop applications. A host restart can clear its in-memory activity feed.

Settings and per-chat reading positions are saved on the phone. Recent history is cached and refreshed when connected, but this is not a complete offline archive. Provider switching retains separate current chat/draft state during the connection. Do not rely on unsent drafts surviving a force-close.

## Tune the display and leave safely

**Settings → Appearance & language** includes English/Russian, light/dark/system theme, palettes, 8–22 px chat text, 60–130% interface scale, line spacing and compact layout. Chat text, interface scale and Review code size are separate controls. Small text does not mean touch targets should become equally small.

**Disconnect and forget** is at the bottom of the main Settings list. It clears this phone's pairing and chat cache; it does not stop the PC, delete projects or sign out of the AI provider. Closing the QR browser tab also leaves the server running. To end the host, close its launcher or use **scripts/stop.ps1** when idle. See [updates](USER_GUIDE.md#updates) before replacing an installation.
