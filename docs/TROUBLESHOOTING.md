# Troubleshooting

[Documentation](README.md) · [Русский](TROUBLESHOOTING.ru.md)

## First checks

Record the phone version from **Settings → About**, the host version, the selected provider and the action that failed. Check whether the PC is awake and whether Pocket Code is running in the system tray. Try a simple read, such as opening a project changelog, to distinguish connection failure from an AI or Jira error.

Do not reset everything first. **Disconnect and forget** removes pairing and cached conversations; it is not a repair for provider authorization or an occupied port.

## Connection and startup

| Symptom | What to check |
| --- | --- |
| PC unavailable on mobile data | Enable internet mode in the Windows connection settings or use a reachable private-network address. A home LAN address alone is insufficient from another network. |
| It worked before restarting the tunnel | Scan the newly opened QR. Temporary tunnel addresses can change. |
| Closing the browser did not stop the PC host | Expected: the desktop app owns the connection. Use tray → Exit to end the application and its owned host. |
| Port 4318 already in use | A current launcher reuses an existing recognized Pocket Code host. If another program owns the port, it will not kill that program. Identify the owner or choose another port. |
| Launcher still asks for a project/Enter | You are using an older launcher file. Update the source/launcher; replacing only the APK does not replace that original script. |
| No Git projects appear immediately | Discovery is incremental and skips system/cache/link directories. Check the allowed roots and the project selector in New chat or Changelog. |
| Folder is missing after host auto-update | An automatic restart preserves existing roots. Restart the updated normal launcher once to adopt its default disk selection, or launch with explicit ProjectPath. |

For restricted access, launch from PowerShell with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1 -ProjectPath D:\Projects`. Add `-Internet` for a temporary internet tunnel. An explicit root is an access boundary, not just a list filter.

## Chats and AI

| Symptom | What to do |
| --- | --- |
| OAuth expired | Sign in again with the relevant native AI tool on the PC, then retry. QR pairing is separate. |
| Codex rejected request / -32600 | Read the accompanying message. The code alone does not identify the cause. Check versions and whether Desktop owns the conversation; preserve the draft and retry after resolving the reported problem. |
| Old chat is readable but cannot accept a message | Release its Desktop writer, or check whether its folder is outside allowed roots. |
| Some chats are absent | Check the selected provider and local account, wait for refresh, and confirm the conversation is a supported local history. Cloud-only and remote Copilot sessions are not imported. |
| A second chat will not start | Same/overlapping project folders are blocked. Use another project or a separately created worktree. Each provider has a three-running-job limit. |
| Stop was pressed but the PC is disconnected | The phone cannot guarantee interruption without reaching the host. Reconnect and inspect the task before starting conflicting work. |
| A limit is shown as unavailable | The account/runtime may not expose it, or the read failed. This is not a claim that usage is zero. |
| Windows error 1058 during tool execution | Preserve the full provider error and check the Windows service/runtime it names. The number alone does not justify enabling arbitrary services or changing security settings. |

For Copilot, start sign-in from **Settings → AI accounts → AI account**, complete the browser flow on the PC and recheck. The login can time out after five minutes; finish active Copilot jobs before starting another login.

## Review, files and Results

If Review has fewer changes than expected, check **All changes / Staged / Branch**, selected base branch, the chat's project folder, collapsed files and hidden extensions. Branch comparison excludes uncommitted changes. Ignored files are absent, and binary/large files may lack a text diff. Refresh after restoring connection; cached content is not evidence of current disk state.

If code extends beyond the screen, enable **Fit diff to width**. If it becomes too small, disable fit and choose a fixed code size. This is separate from interface scale and chat text size.

If Results seems incomplete, wait for history indexing and check category/source filters. Reopening restarts scanning; a failure retains partial results for retry. A deleted local file cannot be recreated by its old path. External images require explicit loading. A current-file preview is not necessarily a historical snapshot.

Rules and Changelog are read-only viewers. A single matching document opens directly; multiple documents produce a list. A document shown here is not automatically injected as a new instruction to the AI.

## Jira and PR compatibility

The current main navigation uses repository boards and Miro. Jira connection settings and legacy server APIs remain, but the former Tasks queue, role picker and Jira workflow screen are not exposed. The following checks apply to integrations or older clients, not to a missing current navigation tab.

| Symptom | What to check |
| --- | --- |
| Jira works in Claude but direct MCP is blocked | Separate clients require separate authorization. An administrator may have to approve the direct client for the site. Use a legitimately authorized connection. |
| Changing AI did not change Jira account | Expected: the host has one selected shared Jira connection. |
| Description failed to load | Retry the issue detail and check connector access; do not treat a retrieval error as an empty description. |
| Status cannot change without an estimate | Complete the required transition fields. Unsupported validators/fields need Jira itself. |
| PR creation is blocked | Check GitHub CLI login, repository root, task branch, clean worktree and committed changes. The app does not commit unrelated files for you. |
| Bell has no old Jira alerts | It starts from a baseline and detects subsequent changes; it is not Jira's full inbox. |

After an interrupted write, inspect the issue/PR and the recorded link before retrying. The remote operation may have completed even if its response was lost. Recovery does not undo remote changes.

## Updates and Android notifications

An old APK that rejects **Invalid update source** needs one manual installation of the current APK over the existing app. Use the same package/signer; uninstalling first can remove local preferences. Android requires installation permission and confirmation, so completely silent APK updates are not supported.

Host updates wait for active work, verify the package and attempt a restart. A failed startup can trigger rollback. Check the update status instead of force-stopping a handoff. From 0.21.1 the PC owns update checks and APK delivery; it does not wait for the phone to update first. Use Check for updates on PC on the phone, or the Windows update settings. PC GitHub/npm access is required.

For chat alerts, check Android notification permission and the **Chat results and questions** channel, whether the last chat was explicitly left, PC connectivity and Android background restrictions. Task-service notifications are separate from chat alerts. Browser use does not provide the Android native background service.

## Report a useful issue

Include app/host versions, provider, steps, expected behavior, actual behavior and whether it also happens in a synthetic project. For layout issues include screen dimensions, app scale and text size. Redact screenshots; omit pairing QR/key, tokens, real messages, employer/customer task data and private paths. Use the [issue tracker](https://github.com/Evgenie-Myasnikov/pocket-code/issues).
