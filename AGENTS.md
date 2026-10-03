# Public repository data boundary

Before preparing commits, pushes, screenshots, documentation, release notes or
release assets, read [.agents/skills/protect-public-data/SKILL.md](.agents/skills/protect-public-data/SKILL.md).
This applies to all AI providers working in this repository.

Use synthetic examples. Never publish user conversations, task descriptions,
customer or employer information, credentials, pairing QR codes or local account
configuration. Publication authorization covers sanitized project code only.

Run `node scripts/privacy-guard.mjs --staged` before committing and
`node scripts/privacy-guard.mjs --tree HEAD` before publishing. Install local
commit/push checks with `git config --local core.hooksPath .githooks` in the actual
project repository. Do not run that command against an unrelated parent repository.
Checks must fail closed; do not bypass them or weaken detection to pass a release.
They are an additional control, not proof that arbitrary personal data is absent.

Maintain the root CHANGELOG.md with concise, sanitized entries and actual validation.

# Product board continuity

All providers follow **rules/skills -> board -> changelog**. Read applicable
AGENTS.md and relevant shared `.agents/skills/*/SKILL.md` first, then existing
cards, then recent and feature-specific history. Diagnose against current code
and reproducible checks. Record authorized work on the same card before editing;
after validation update its evidence and CHANGELOG. A provider change must not
duplicate cards, erase history or turn historical test results into current ones.

Read `project-boards/README.md` and the curated `board-*.json` when planning
or implementing product changes. Help people clarify ideas, acceptance criteria,
priorities and open questions. Maintain relevant cards for authorized work,
preserving stable IDs and unrelated content. Verify changelog claims against code
and actual checks before changing status; keep unfinished work visible.
Repository boards contain product information only, never people, assignments,
private chat content or credentials. Follow the board README for validation and
refresh/import behavior. A file edit alone does not update every live board.
Interactive providers receive the same guidance from `server/board-instructions.ts`.

# Release branch continuity

Every actual release must identify its existing Git branch and exact source commit
in the release manifest, changelog and board version mapping (`versionBranches`).
Resolve them from Git; never infer a branch merely from a planned version label.
Publish tags against that exact commit, after verifying the source branch exists
on the release repository and contains it. Detached HEAD is not a release branch.
Keep unreleased work explicit. Linking releases does not authorize a push or release.
