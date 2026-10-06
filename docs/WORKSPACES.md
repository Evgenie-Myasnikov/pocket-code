# Legacy workspace compatibility

[Documentation](README.md) · [Current boards](BOARDS.md)

WorkSpace creation, invitations and membership administration are no longer exposed as a main Pocket Code section. Current boards belong to repositories; optional Miro boards connect through Settings. Personal chats belong to the connected PC/provider, not to a workspace.

Existing private host records and compatibility endpoints are preserved so old clients, assignments and notifications do not silently lose data. These records are not repository board files and must not be copied into Git. A legacy notification may still open its original board and note.

Do not use an old workspace QR as a substitute for current PC pairing. Use **Settings → Connection** and the current QR. For repository notes and Miro, follow the [board guide](BOARDS.md). There is no new workspace creation step in the normal setup.
