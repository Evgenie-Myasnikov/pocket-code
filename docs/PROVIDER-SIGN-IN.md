# Provider sign-in and status

Pocket Code detects the credentials already available on the PC. If detection fails, open **Settings → Providers & sign-in** in Windows. On Android the same controls are under **Settings → AI & workspace** for the selected provider; both client and host must be updated.

## Signing out

Each provider card has **Sign out** on Windows and Android. Confirm the account change in that card. Claude and Codex use their official CLI logout commands; Copilot uses its account logout API. Active tasks must finish first. Sign-out affects the shared provider login on this PC; conversation files and Pocket Code preferences remain.

Environment credentials, another Copilot account or GitHub CLI fallback can still provide access after local logout. Pocket Code reports this instead of claiming that access disappeared, and does not sign out the separate GitHub CLI. A model-list/network/subscription failure is shown separately from a confirmed Copilot account login.

## Reading connection status

- **Installation**: the provider CLI is present.
- **Server**: Codex/Copilot answered through the local transport. Claude starts on demand with a task, without a permanent app server.
- **Sign-in**: authentication reported by the provider. This does not guarantee remaining quota or permission for every model.

The Connection page also shows the PC host and actual internet-tunnel state separately. Enabling the internet setting does not by itself mean the tunnel is connected.

## Manual methods

| Provider | Buttons | Advanced configuration guide |
| --- | --- | --- |
| Claude | Subscription in browser, Anthropic Console, SSO | API keys, credential helpers, Bedrock, Vertex AI, Foundry and managed gateways |
| Codex | Browser, device code, API key, access token | Custom providers and managed authentication |
| GitHub Copilot | Browser, device code, GitHub token | Enterprise host, environment credentials and BYOK |

Choose a method and finish sign-in in the official CLI window **on the PC**, including when starting from Android. Keys and tokens use hidden local input and go to the CLI through stdin, never command-line arguments or chat messages. Pocket Code then rechecks authentication and reconnects the idle provider transport. A failed verification stays visible and can be retried.

Credentials remain managed by the CLI. Pocket Code does not copy credential caches between applications. Codex device login may need permission in ChatGPT security/workspace settings. Copilot accepts compatible tokens such as fine-grained PATs with Copilot Requests permission; classic PATs are not supported.

Manual login currently requires a Windows host. Finish active provider tasks before changing the account. Duplicate clicks reuse a pending login. Unfinished windows expire after ten minutes; host shutdown terminates owned login processes. Closing the app to the tray keeps the host running. Older CLIs may require updating before a method works. Advanced cloud/enterprise configurations are documented options, not in-app wizards.

Official references, checked 2026-10-02:

- [Claude CLI commands](https://code.claude.com/docs/en/cli-reference) and [authentication](https://code.claude.com/docs/en/authentication)
- [Codex authentication](https://developers.openai.com/codex/auth/)
- [Copilot authentication](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli) and [CLI commands](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)

## По-русски

На ПК откройте **Настройки → Провайдеры и вход**. На Android — **Настройки → AI и рабочее пространство**. Нужны обновлённые клиент и сервер.

Установка, доступность сервера и авторизация проверяются отдельно. Для ручного входа выберите доступный способ и завершите его в окне на ПК. Ключи и токены вводятся скрыто в этом окне, а не в чате. Статус обновляется автоматически. Для облачных и корпоративных конфигураций используйте официальные инструкции выше.
