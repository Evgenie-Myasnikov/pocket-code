# Pocket Code user guide

[Home](../README.md) · [Русский](USER_GUIDE.ru.md) · [Technical reference](REFERENCE.md)

Jump to [QR pairing](#qr), [code review](#diff), [updates](#updates), [chats](#chats), [project](#project), [tasks](#tasks), or [settings](#settings).

Screenshots use the real interface with fictional data. Never publish your pairing QR, connection key, or private chat screenshots.

<a id="qr"></a>
## Connect by QR

<img src="images/connect.png" width="320" alt="Connection screen with camera, QR image and manual entry options">

1. Extract the source package on your PC and run **Setup Pocket Code.cmd**. Install Claude Code or Codex and sign in on the PC first.
2. Choose **Internet / mobile data** for access from another network, or **Same trusted Wi-Fi** for your local network.
3. Select your project folder and wait for the host and QR page to open.
4. Install the APK from the [latest release](https://github.com/Evgenie-Myasnikov/pocket-code/releases/latest) on Android. Tap **Scan QR code**, allow camera access, and scan the PC screen.
5. The app fills in the connection details and connects automatically.

If the camera is unavailable, choose **QR from image**. Manual entry needs the computer address and Pocket Code connection key followed by **Connect computer**. These are not AI account credentials.

Keep the PC awake and the host running. Closing the QR browser tab does not stop the host; closing the host launcher window ends its processes. Restarting a temporary internet tunnel changes its address: scan the new QR. A local Wi-Fi address normally cannot be reached over mobile data.

## View images from a conversation

<table><tr><td><img src="images/results-images.png" width="280" alt="Results gallery with image thumbnails"></td><td><img src="images/image-viewer.png" width="280" alt="Full-screen image with zoom and Fit to screen controls"></td></tr></table>

Open **Results → Images** to browse thumbnails from the loaded messages. Switch between **Assistant results** and **Your sources** to see generated images or your attachments. Tap a thumbnail to open it, pinch or use **+ / −** to zoom, and drag to inspect details. **Fit to screen** resets the view. Close or press Back to return to the same gallery position.

External images have a **Load external image** button. Local images use the connected computer; a missing file can no longer be previewed. Load older messages to include earlier images.

<a id="diff"></a>
## Review code changes

<table><tr><td><img src="images/review.png" width="300" alt="Mobile code diff with added and removed lines"></td><td><img src="images/review-options.png" width="300" alt="Comparison and code size settings in an overlay"></td></tr></table>

Open a chat and tap **Review** when Git changes are available. Check the repository and branch in the header. The comparison is restricted to the chat's project folder, including when that folder is inside a larger repository.

Scroll through the changed files, as in a pull request. Tap a file heading to collapse or expand its diff. Green lines were added; red lines were removed. Each heading shows that file's plus/minus counts. In options, **Show file types** lets you hide detected extensions, such as `.png`.

The sliders button opens an options sheet over the diff. Close it with **X**, Back, or the backdrop. It does not shrink the code area.

| Comparison | Contents |
| --- | --- |
| All changes | Uncommitted working-tree changes relative to HEAD, including staged edits and supported untracked files. It is not the entire project history. |
| Staged changes | The Git index: changes prepared for a commit. |
| Branch changes | Committed changes since the merge base with the selected base branch. It does not include uncommitted edits. |

Choose **One column** for a phone or **Two columns** for side-by-side reading. **Code size** follows chat text with a 14 px minimum by default; you can save a separate size. Long lines scroll horizontally.

The open review refreshes every five seconds while visible and when returning to the app. The refresh button checks immediately. Background refresh retains collapsed files and the scroll position; files no longer changed disappear from the list. Diffs load near the visible area. A connection error means the retained content may be stale.

Tap the **eye** for reading mode, then the restore button or Android Back to show controls again. **Back to chat** returns to your conversation.

Review includes manual edits and edits by other tools in the project, not just this chat's actions. Ignored files are excluded by Git. New, untracked files appear as whole-file additions. Binary or large files may have no text preview. Viewing a diff does not create a commit, PR, or approve changes.

<a id="updates"></a>
## Update the phone and host

<img src="images/updates.png" width="360" alt="Update settings with automatic download and manual checking">

This screenshot shows the browser presentation. APK downloading and the Android installation prompt are available in the native app.

1. On connection, the app checks GitHub through your PC. It also checks periodically while open.
2. With automatic download enabled, a new APK is downloaded and verified.
3. **Android asks you to confirm installation.** If prompted, allow Pocket Code to install updates, return to the app, and choose **Install update**. Install over the existing app to preserve settings.
4. After the updated app reconnects, it checks for a compatible host package.
5. A supported host downloads it, waits for running jobs and terminals to finish, applies it, and restarts. Wait for reconnection.

Use **Settings → Updates → Check for updates** to check manually. If automatic download is off, choose **Download update**. A verified APK can be installed from the same section after cancelling an installation.

The PC needs GitHub/npm access. The host does not update beyond the phone's version. Older hosts may need a manual PC update. A normal host update keeps pairing; restarting the temporary tunnel separately requires a fresh QR.

| Problem | Next step |
| --- | --- |
| An old APK reports Invalid update source | Install the current release APK manually over it once. |
| Waiting for PC tasks | Let jobs and terminals finish; do not force-close the host to update. |
| Restarting | Wait for the host to reconnect. |
| Updates not configured | See [update configuration](REFERENCE.md#updates). |
| Download failed | Check PC connectivity and retry from Updates. |

AI runtime compatibility checks are separate: a detected Claude/Codex version change can create a compatibility task in the Pocket Code source project. That task does not automatically publish a release.

<a id="chats"></a>
## Chats, attachments and activity

The small ring on the right of the input shows the **remaining** allowance: the lowest reported shared or matching-model limit. Tap it for window/reset details. It refreshes every minute while visible and on return; a dash means current data is unavailable. The send button has a compact visual face with a larger touch target.

Choose Claude or Codex and a project, then open an existing chat or create one. The composer shows the selected model and supported effort setting. You can send a clarification during execution where the provider supports it.

Attach images and files with the attachment button. Images have thumbnails; use the cross to remove an attachment before sending. Expand compact tool activity rows to see details. Chat results can be filtered by content type, and subagents can be opened when the provider supplies their context.

Scroll upward to load older messages automatically. The reading-mode eye hides extra controls. Switching main tabs retains the selected chat. Recent history is cached and refreshed after connecting; this is not a full offline archive. Unsaved drafts should not be treated as durable storage.

Open the right-edge activity drawer for running chats, errors, and questions needing a response. Reading a finished activity dismisses it from the queue; pending questions still require an answer.

On Android, allow notifications to follow the last open chat while the app is minimized. **Chat results and questions** is a separate Android notification channel for completion, errors and requests for an answer. Tap an alert to return to its chat. Reopening old completed history does not send another alert. Tracking ends when you explicitly leave the chat; background delivery still requires a reachable PC and Android allowing the service to run.

<a id="project"></a>
## Project files, rules and changelog

The **Project** tab contains **Files**, **Rules**, and **Changelog**. Select the project folder first. A single document opens directly; multiple matching documents are listed. Markdown is rendered for reading. Viewing a rules document does not edit it or change the AI's instructions.

<a id="tasks"></a>
## Jira tasks and notifications

Connect Jira in settings for the selected AI workspace. Claude and Codex have separate connector state; authorization in one is not automatically transferred to the other. Codex uses available Jira MCP tools directly; the existing Claude connection path still requires Claude CLI inference. Missing authorization must be completed on the PC.

Open **Tasks** to search and filter your assigned issues. Open an issue for its description and available actions. Actions depend on the issue's workflow and your selected role. Starting work creates a chat in the chosen project; sending work for review is a separate action. Select tasks for batch processing when available.

The bell shows Pocket Code's task-change feed. It is not Jira's internal notification inbox or Android push. The host periodically checks assigned tasks while the connected interface requests updates. Claude and Codex notification/read states remain separate.

<a id="settings"></a>
## Appearance and disconnecting

Settings group appearance/language, provider access, integrations, updates, and connection details. Text size and interface scale serve different purposes; Review also has an independent code-size override.

**Disconnect and forget** is at the end of the main settings list. It clears this phone's saved pairing and cached conversations. It does not stop the PC host or delete your project. Use the PC stop launcher to stop the host; active work can prevent a graceful stop.

For troubleshooting, include app and host versions and reproduction steps in an [issue](https://github.com/Evgenie-Myasnikov/pocket-code/issues), with private data removed.
# Shared Jira connection on the PC

In the PC QR window, open **Jira · Connect / Settings**. Choose the existing Claude connection, or **Sign in to Atlassian** for direct MCP through Codex, then select that connection. Jira access is shared by Claude and Codex tasks; choosing a task AI does not change your Jira account.

The Claude connection uses Claude's allowance. Direct MCP does not start a model turn, but requires its own Atlassian authorization. A site administrator may need to approve it. Signing into Claude does not authorize Codex. Complete login in the PC browser and refresh Tasks on the phone. Finish active tasks before changing the connection.
