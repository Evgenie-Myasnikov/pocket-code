# Providers and accounts

[Documentation](README.md) · [Русский](PROVIDERS.ru.md)

## Four different connections

| Connection | What it authorizes | Where it is managed |
| --- | --- | --- |
| Pocket Code QR pairing | Your phone's access to this PC host | QR page and phone connection settings |
| Claude, Codex or Copilot account | Model requests and provider tools | Native tools on the PC; Copilot also has a launch-login button in the app |
| Jira connection | Reading issues and permitted workflow actions | Shared PC Jira connection, exposed from the QR page and app settings |
| GitHub CLI account | PR publication and repository access used by host features | `gh` on the PC |

Pairing does not sign you into the other services. A GitHub CLI login alone is not proof of Copilot entitlement. A Claude Atlassian authorization does not automatically authorize a separate direct MCP client.

## Claude

The composer loads the installed Claude Code catalog. Aliases show their resolved version when reported. **Other version…** accepts an explicit provider-qualified ID; the account still decides model access. Selection survives reload. Discovery submits no model prompt and closes its metadata process. When discovery fails, aliases and manual IDs remain. Runtime version in account settings is separate from model version. See [Claude model configuration](https://code.claude.com/docs/en/model-config).

**Unreleased refinement:** resolved aliases no longer generate duplicate model entries. Claude effort appears only when the SDK advertises supported levels for that model; the host validates the selection before starting work. Unknown/manual models and fallback catalogs expose no inferred effort choices. Claude and Codex choices are stored separately. See [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort).

Sign in to Claude Code on the PC, then choose **Claude** in Pocket Code. The app uses the Agent SDK for structured chats and supported local Code histories. Ordinary cloud-only Claude conversations are not imported.

Send messages and attachments, expand tool actions, answer approvals/questions and stop a running turn from its chat. A follow-up can be sent while work runs. The request budget in settings belongs to the Claude path; it is not a universal account balance or a Codex/Copilot budget.

When a connector operates through the existing Claude CLI path, it can consume Claude usage. The app no longer exposes a separate Live chat/Terminal navigation entry; legacy host endpoints remain for older clients.

## Codex

Sign in to Codex on the PC and select **Codex**. Models and reasoning-effort choices come from the installed runtime. Effort is remembered per model and applies to the next message; availability can change with the runtime and model.

An existing Desktop conversation can be readable while another process owns its writer lock. Finish its desktop work and release the conversation before continuing it from the phone. Pocket Code does not remove lock files or close Desktop for you. A rejected message remains recoverable and is not silently resent.

**Settings → AI accounts** offers:

| Access | Behavior |
| --- | --- |
| Full access | Mobile default: commands and file operations without approval prompts or the project sandbox. Native policies still apply. |
| Ask for approval | Project sandbox with interactive approvals. |
| Approve for me | Native Codex automatic approval review, with the project sandbox. |

The question-mark control explains the setting. Changing access applies to subsequent work, not an already running turn. Jira reviewer/QA workflows retain their read-only behavior.

## GitHub Copilot

1. Select **Copilot** and open **Settings → AI & workspace**.
2. The host checks for an existing Copilot sign-in.
3. If required, choose **Connect GitHub Copilot**. Complete the native GitHub sign-in in the browser on the PC.
4. Return to Pocket Code and check the connection. Available models come from the runtime.

Credentials stay with the native PC tool. Command/file permissions and supported clarification questions appear in the chat. Copilot does not reuse the Codex Full access setting. A follow-up is queued through the Copilot session; do not assume it immediately interrupts the current action. Subscription-limit display and subagent context do not have the same coverage as Claude/Codex.

The setup installs the bundled Copilot SDK/runtime. Successful installation is separate from GitHub sign-in and Copilot entitlement.

## Jira is independent of the task AI

The old Jira Tasks page is retired from current navigation. The connection and compatible host APIs remain for existing clients.

The PC has **one selected Jira connection**. In the QR page choose **Jira · Connect / Settings**, or open Jira settings in the app. Use the existing Claude connection, or the direct Atlassian MCP path through Codex with its own authorization. Selecting Claude, Codex or Copilot to execute a task does not switch the Jira account.

The direct MCP path calls available Jira tools without a model turn. The existing Claude path can use model inference. There is no silent account fallback. Atlassian can require site-administrator approval even when another client already works. Finish active work before changing the shared connection.

## Limits and concurrency

The usage screen shows reported windows and reset times for Claude/Codex. The small ring near the composer summarizes the lowest applicable remaining allowance. Missing data is **unavailable**, not zero consumption; provider plans and runtime support determine which windows exist.

**Unreleased validation:** out-of-range percentages are rejected rather than clamped; failed refreshes and snapshots older than two minutes do not display an apparently current allowance. The ring is account quota, not conversation context capacity. Open it for separate reported windows and reset times. Real-account availability still depends on the installed runtime and login.

Each provider can run up to three Pocket Code jobs simultaneously in different non-overlapping project folders. The host prevents overlapping project writers, including across providers. Different Git branches in the same folder are not isolated. Separate existing worktrees can be selected as separate folders; automatic creation/merging of worktrees is not implemented. Each chat has its own stop action. Provider service limits can be lower than the app's concurrency cap.
