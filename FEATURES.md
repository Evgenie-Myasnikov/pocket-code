# Feature coverage

## 0.10.0

| Feature | Claude | Codex |
| --- | --- | --- |
| Separate workspace, model, mode and project selection | Yes | Yes |
| Switch without losing the current draft or attachment selection | Yes, during this connection | Yes, during this connection |
| Read local PC conversations and refresh history | Code histories, including supported Desktop indexes | Local app-server histories within allowed project folders |
| Start a chat or continue an existing one | Yes | Yes; finish the desktop turn before handover |
| Stream responses, show tools, stop a turn | Yes | Yes |
| Individual approvals and clarification questions | Yes | Supported app-server command/file approvals and questions; unsupported requests are rejected |
| Attach files and images | Yes | Yes |
| Live terminal | Yes | Not yet; use structured chat |
| Jira selected issues / batch queue | Yes | Yes; Jira reading still uses the existing Claude connector |
| Working, staged and branch Review | Shared project Git view | Shared project Git view |
| Per-request dollar budget | Claude SDK estimate | Not supported |
| English/Russian, theme, palette, compact size | Shared saved preferences | Shared saved preferences |
| GitHub APK update checks and downloads | Shared, through the connected PC | Shared, through the connected PC |

Usability improvements include large mobile tap areas even with compact text, a project selector in the chat header, per-chat draft retention, connection recovery, clear activity states and Back/Escape with accessible modal focus. See [USABILITY.md](USABILITY.md) for the evidence, sources and physical-device/user-testing limits.

## Known limits

- Ordinary Android devices require confirmation to install an APK. The updater cannot silently replace the app. It updates the phone app; server source is updated separately.
- Native installation, camera scanning and external PDF viewer behavior need physical-device verification.
- Cloud-only chats, every desktop plugin/UI, voice and interactive provider artifacts are not reproduced. Unknown structured content is shown as an expandable block when possible.
- Review shows the selected project's Git changes, including edits outside the current conversation. It is not a per-turn snapshot.
- Workspace drafts are retained while switching in the current connection, not after force-closing the app. Preferences and connection settings persist.
- The bridge prevents its own agents/terminals from editing the same project concurrently. It cannot lock unrelated desktop app processes; wait for their current turn before continuing a chat on the phone.
- Temporary internet tunnels change address after restart. Scan the new QR. The PC must stay awake with the bridge running.
- Current development APKs use a local Android debug signer. Preserve the original private keystore for compatible updates.

## Issues addressed in this release

- Completed message records no longer exhaust the server's 100-record task limit.
- A newly discovered release invalidates an older downloaded APK; installation verifies the exact selected version and checksum again.
- Opening Review disables configured Git clean/process filters to avoid executing commands while inspecting changes.
- Workspace requests, histories, drafts and queues are routed independently; starting a second agent in the same project is rejected.
