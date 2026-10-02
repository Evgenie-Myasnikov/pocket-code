# Pocket Code documentation

[Project home](../README.md) · [Русский](INDEX.ru.md)

Pocket Code is an Android companion for AI coding tools running on your Windows PC. The phone is where you read, send instructions, answer questions and review changes; the PC holds the projects and runs the tools. It is not a remote desktop or an exact reproduction of every provider's desktop interface.

## Start here

| What you want to do | Guide |
| --- | --- |
| Install, pair by QR and connect away from home | [User guide: connection](USER_GUIDE.md#qr) |
| Use the Windows tray app and automatic startup | [Desktop application](DESKTOP.md) |
| Choose Claude, Codex or GitHub Copilot | [Providers and accounts](PROVIDERS.md) |
| Choose a project and complete a coding task | [Everyday workflows](WORKFLOWS.md) |
| Read code changes, adjust size or fit a diff to the screen | [Review](USER_GUIDE.md#diff) |
| Find images, documents and generated files | [Results](WORKFLOWS.md#results) |
| Connect Jira and work through an issue | [Tasks workflow](WORKFLOWS.md#tasks) |
| Understand alerts, activity and saved state | [Activity and continuity](WORKFLOWS.md#activity) |
| Update Android and the PC host | [Updates](USER_GUIDE.md#updates) |
| Fix connection, history, authentication or update problems | [Troubleshooting](TROUBLESHOOTING.md) |
| Configure, build or contribute | [Technical reference](REFERENCE.md) |

## A tour of the app

<table><tr><td><img src="images/chat.png" width="260" alt="Chat with an AI coding assistant"></td><td><img src="images/project.png" width="260" alt="Project documents and files"></td><td><img src="images/settings.png" width="260" alt="Settings categories"></td></tr></table>

These are illustrative screenshots of the real interface with synthetic content. Labels and appearance can differ between releases and saved themes.

The four main sections are **Tasks**, **Chats**, **Project** and **Settings**. Review, Results and subagent context open from their relevant chat. The right-edge activity drawer lets you return to a running conversation from other sections.

## What is required

- Windows PC, Node.js 22+ and an installed, authenticated supported AI runtime. The current standard launcher checks for Claude or Codex; Copilot is an additional workspace.
- Android 7+ with the release APK installed. Android confirms APK installation and updates.
- The PC stays awake and the host stays running. Internet mode uses a temporary HTTPS tunnel; a separate tunnel restart can change its address.
- Provider accounts and their usage limits apply. Installing Pocket Code does not include an AI subscription or grant Jira/GitHub permissions.

## Coverage and boundaries

[Current feature coverage](../FEATURES.md) distinguishes available functions from limitations. [Usability notes](../USABILITY.md) and [performance notes](PERFORMANCE.md) describe validation and its limits. [Changelog](../CHANGELOG.md) records release changes; it is historical context, not a substitute for the current guides.

Pairing credentials, real conversations and work data do not belong in public issues or screenshots. See the [publication data boundary](../.agents/skills/protect-public-data/SKILL.md) before contributing documentation or release assets.
