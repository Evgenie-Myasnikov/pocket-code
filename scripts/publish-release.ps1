param([Parameter(Mandatory=$true)][string]$Repository)
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Use owner/repository' }
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
& powershell -NoProfile -File scripts/build-android.ps1
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
$version = (Get-Content -Raw package.json | ConvertFrom-Json).version
$apk = 'artifacts/Pocket-Code-' + $version + '.apk'
& gh release create ('v' + $version) $apk ('artifacts/Pocket-Code-Host-' + $version + '.json.gz') 'artifacts/update.json' --repo $Repository --title ('Pocket Code ' + $version) --notes 'Android companion and PC bridge update. Install over the previous version to keep your settings.'
if ($LASTEXITCODE -ne 0) { throw 'Release publication failed; existing releases are never overwritten.' }
