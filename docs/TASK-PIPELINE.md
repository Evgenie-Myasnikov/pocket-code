# From a card to a reviewed result

[Documentation](README.md) · [Русский](TASK-PIPELINE.ru.md)

**Unreleased.** Requires an updated PC host and shared interface. This workflow uses
an existing repository board and the AI account on the connected PC.

## Start from the board

1. Open a saved note with a clear description and acceptance criteria.
2. In **Implementation**, choose Claude, Codex or GitHub Copilot, then **Prepare task chat**.
3. Pocket Code creates a dedicated Git branch and working copy from the repository's
   current committed `HEAD`. It opens a chat with the task text. Review and send that
   prompt to start the agent; preparing the chat alone does not send an AI request.
4. Open the task line beneath the chat header to see its branch, checks and result.
   The note also lists its previous runs, so another attempt does not replace history.

Uncommitted source files remain in the original project and are **not copied** into
the new working copy. Commit the changes you intend to use first. Package dependencies
are not installed automatically; the agent may need to install them before testing.
An unborn repository, inaccessible folder or unsafe worktree location produces an
error instead of running the task in the original directory.

Separate tasks can work concurrently in separate working copies, within each provider's
capacity. Git isolation separates file changes; it does not provide separate AI accounts
or an operating-system sandbox. An agent's existing access/approval settings still apply.

## Checks and approval

The task records **Work → Checks → Review → Approved**, with **Needs an answer** and
**Failed** states. Structured approval/questions and interrupted jobs remain visible.
Natural-language questions that a provider does not identify as a question cannot be
reliably classified automatically.

In **Task result → Verification commands**, use project scripts or supply an executable
and a JSON array of arguments. For example, program `node` and arguments
`["--test", "tests/example.test.mjs"]`. Commands execute directly, without shell
interpolation, in the task's working copy. Windows `.cmd`/`.bat` commands are rejected;
detected npm scripts run through Node's npm CLI. Saved commands run automatically after
the linked AI attempt finishes. An empty saved plan disables automatic checks.

Check output is bounded; a truncated output is labeled. Commands have time limits and
owned child processes are terminated on cancellation/shutdown. A failed command, timeout,
interrupted check or changed file snapshot prevents approval. After correcting an issue,
run the checks again. After an approved result, **Resume task** invalidates that approval.

**Review task changes** includes committed and uncommitted changes since the pinned
starting commit, including new files. It offers the same unified/split view, collapsing,
extension filters and code sizing as normal review. The normal chat Results view retains
the task's output files; its chat retains questions and discussion.

Inspect the diff, conversation and acceptance criteria before pressing **Approve checked
result**. Passing commands establishes only those commands' results, not correctness of
the whole task. Approval records the checked snapshot; later file changes make it stale.
Approval does not merge, push, publish a release or mark every criterion satisfied.

## Restart, persistence and privacy

Task/chat links, attempts, evidence and approval records stay in private PC-host storage.
They are not added to portable board JSON. Existing board notes keep their product-only
status; task execution stages are separate and do not overwrite the roadmap automatically.
**Source card** opens the original note; a deleted or inaccessible source is reported.

The host retains worktrees and branches. It does not delete them after completion or
silently restart interrupted work. After a host restart, inspect an interrupted task's
chat and resume explicitly. Repeated requests use the same run identifier to avoid
creating another working copy. Concurrent edits are rejected through revision checks.
If you remove a project from the host's allowed roots, its task files are no longer
exposed through the task API.

## Notifications

Enable chat alerts in Settings. Windows and Android consume the host's persisted activity
journal; it keeps up to 1,000 events for seven days. Native cursors and event identifiers
support reconnect catch-up and deduplication. A notification opens the exact provider and
job/chat even if another section is visible. Disabling alerts stops new delivery.

Pocket Code jobs report completion, errors and structured questions. For runs started
outside Pocket Code, only completion/stopped events supported by the transcript monitor
are available. Notifications require a reachable host and OS permission; Android battery
restrictions and force-stop can delay/prevent delivery. This is not cloud push. Board
assignment notifications and Miro notifications remain separate systems.

## Contributor map

`server/task-runtime.ts` connects the task API to provider jobs and managed roots;
`task-runs.ts` owns persistence/state/revisions; `task-worktrees.ts` owns Git isolation and
snapshots; `task-checks.ts` runs bounded verification commands. `BoardTaskRuns`,
`TaskRunPanel` and `useTaskRun` share the Windows/Android UI. The native bridge must
allowlist every supported route. Tests use temporary Git repositories and synthetic
providers; physical-device behavior still needs a real device.
