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
