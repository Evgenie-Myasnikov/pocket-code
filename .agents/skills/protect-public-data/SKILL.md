---
name: protect-public-data
description: Keep Pocket Code public commits, documentation, screenshots and releases free of personal data, work data and credentials. Use before preparing or publishing these artifacts.
---

# Protect public data

## Boundary

Publish only reusable project code and synthetic examples. Do not include real
conversations, Jira content, private project names/paths, employer/customer names,
site identifiers, cloud IDs, email addresses, device names, account configuration,
OAuth tokens, cookies, API keys, signing keys, connection keys or pairing QR codes.
Public project attribution already intentionally present is not secret. Never copy
real data into a test fixture, changelog, commit message, release note or error log.

Do not transmit suspected private files to external readers, scanners or AI tools.
Inspect locally; report the category and remediation without echoing the value.

## Before publishing

1. Confirm the Git root is this project. A workspace nested inside another Git
   repository must be exported to an isolated, sanitized checkout; never commit
   the parent workspace. Preserve unrelated user files.
2. Review exactly the staged files and outgoing commits, including deleted text,
   commit messages, authors and earlier commits. A clean final tree does not erase
   secrets in earlier history. Never use broad staging on an unreviewed workspace.
3. Use `node scripts/privacy-guard.mjs --staged` and `--tree HEAD`. Install
   `.githooks` using the command in AGENTS.md. For deployment-specific identifiers,
   put a JSON array of exact strings in the ignored `.privacy-denylist.local.json`
   or point `POCKET_PRIVACY_DENYLIST` at an external local file. For persistent
   local configuration use `git config --local pocket.privacyDenylist <absolute-path>`.
   Never commit the list. Missing explicitly configured lists block publication.
   Do not populate it by copying values into chat or shell command text.
4. Inspect screenshots visually. Generate them from synthetic fixtures; never use
   user uploads or live work screens. Remove metadata and check QR codes, browser
   chrome, task titles, paths, notifications and background windows. Automated
   byte matching does not read pixels and cannot certify a screenshot as safe.
5. Inspect built APK/archives after unpacking, including nested/base64 content,
   source maps, bundled configuration and metadata, using the same local denylist.
   Audit the exact final assets, not just source. The Git guard does not unpack
   binary files. Do not publish until this separate artifact review passes.
6. On any match or uncertain provenance, stop publication, remove/replace the data,
   rebuild and rerun checks. Do not add an exclusion for a real value, suppress an
   error, use `--no-verify` or skip failed CI. Keep useful local work intact.

## Incident response and limits

If data was already pushed, stop further publication and tell the user without
repeating it. Exposed credentials need revocation/rotation; deleting the current
file is insufficient. Coordinate history cleanup and removal of release assets;
do not rewrite remote history unilaterally.

Git hooks are local and bypassable; GitHub CI runs after data reaches GitHub.
Neither a skill nor pattern matching can guarantee that arbitrary personal or
business data will never leak. Keep local review and synthetic fixtures mandatory.
