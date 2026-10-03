param([Parameter(Mandatory=$true)][string]$Repository)
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Use owner/repository' }
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
& node scripts/privacy-guard.mjs --tree HEAD
if ($LASTEXITCODE -ne 0) { throw 'Privacy check failed; publication blocked' }
if (& git status --porcelain) { throw 'Publish only from a clean, reviewed repository checkout' }
 $sourceJson = & node scripts/release-source.mjs --require-clean
 if ($LASTEXITCODE -ne 0) { throw 'A release must have an existing source branch and commit' }
 $source = $sourceJson | ConvertFrom-Json
 $remoteCommit = & gh api ('repos/' + $Repository + '/git/ref/heads/' + $source.branch) --jq '.object.sha'
 if ($LASTEXITCODE -ne 0 -or $remoteCommit -ne $source.commit) { throw 'The release repository branch must point to the reviewed source commit. Push only after explicit authorization.' }
$version = (Get-Content -LiteralPath package.json -Raw -Encoding UTF8 | ConvertFrom-Json).version
$tagRefsJson = & gh api ('repos/' + $Repository + '/git/matching-refs/tags/v' + $version)
if ($LASTEXITCODE -ne 0) { throw 'Could not verify release tag' }
$tagRef = @($tagRefsJson | ConvertFrom-Json) | Where-Object { $_.ref -ceq ('refs/tags/v' + $version) }
if ($tagRef) {
    $tagObject = $tagRef.object
    if ($tagObject.type -eq 'tag') {
        $tagJson = & gh api ('repos/' + $Repository + '/git/tags/' + $tagObject.sha)
        if ($LASTEXITCODE -ne 0) { throw 'Could not verify annotated release tag' }
        $tagObject = ($tagJson | ConvertFrom-Json).object
    }
    if ($tagObject.type -ne 'commit' -or $tagObject.sha -ne $source.commit) { throw 'Existing release tag does not point to the reviewed source commit' }
}
& powershell -NoProfile -File scripts/build-android.ps1
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
& powershell -NoProfile -File scripts/package-desktop.ps1
if ($LASTEXITCODE -ne 0) { throw 'Windows package failed' }
& node scripts/release-manifest.mjs
if ($LASTEXITCODE -ne 0) { throw 'Release manifest failed' }
$manifest = Get-Content -LiteralPath artifacts/update.json -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.source.commit -ne $source.commit -or $manifest.source.branch -ne $source.branch) { throw 'Release source changed during the build' }
$apk = 'artifacts/Pocket-Code-' + $version + '.apk'
$notes = 'Android, Windows application and PC bridge update. Source branch: [' + $source.branch + '](https://github.com/' + $Repository + '/tree/' + $source.branch + '), commit [' + $source.commit + '](https://github.com/' + $Repository + '/commit/' + $source.commit + '). Install over the previous version to keep your settings.'
$notesFile = Join-Path $PWD 'artifacts/release-notes.txt'
[IO.File]::WriteAllText($notesFile, $notes, [Text.UTF8Encoding]::new($false))
& gh release create ('v' + $version) $apk ('artifacts/Pocket-Code-Host-' + $version + '.json.gz') ('artifacts/Pocket-Code-Desktop-' + $version + '-win-x64.zip') 'artifacts/update.json' --repo $Repository --target $source.commit --title ('Pocket Code ' + $version) --notes-file $notesFile
if ($LASTEXITCODE -ne 0) { throw 'Release publication failed; existing releases are never overwritten.' }
