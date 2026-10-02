param([Parameter(Mandatory=$true)][string]$Repository)
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Use owner/repository' }
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
& node scripts/privacy-guard.mjs --tree HEAD
if ($LASTEXITCODE -ne 0) { throw 'Privacy check failed; publication blocked' }
if (& git status --porcelain) { throw 'Publish only from a clean, reviewed repository checkout' }
& powershell -NoProfile -File scripts/build-android.ps1
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
& powershell -NoProfile -File scripts/package-desktop.ps1
if ($LASTEXITCODE -ne 0) { throw 'Windows package failed' }
& node scripts/release-manifest.mjs
if ($LASTEXITCODE -ne 0) { throw 'Release manifest failed' }
$version = (Get-Content -Raw package.json | ConvertFrom-Json).version
$apk = 'artifacts/Pocket-Code-' + $version + '.apk'
& gh release create ('v' + $version) $apk ('artifacts/Pocket-Code-Host-' + $version + '.json.gz') ('artifacts/Pocket-Code-Desktop-' + $version + '-win-x64.zip') 'artifacts/update.json' --repo $Repository --title ('Pocket Code ' + $version) --notes 'Android, Windows application and PC bridge update. Install over the previous version to keep your settings.'
if ($LASTEXITCODE -ne 0) { throw 'Release publication failed; existing releases are never overwritten.' }
