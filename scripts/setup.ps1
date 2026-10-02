$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
Write-Host 'Pocket Code setup' -ForegroundColor Green
Write-Host 'Your AI runs on this PC. Pocket Code keeps the connection running in the system tray.'

function Test-SupportedNode {
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $command) { return $false }
    $version = & $command.Source --version
    return ($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22)
}
if (-not (Test-SupportedNode)) {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        Write-Host 'Install Node.js 22 or newer from https://nodejs.org/ then run setup again.'
        throw 'Windows Package Manager (winget) is unavailable.'
    }
    $answer = Read-Host 'Node.js 22+ is required. Install/upgrade Node.js LTS using winget? [Y/n]'
    if ($answer -match '^(n|no)$') { throw 'Node.js installation skipped. Install it manually, then run setup again.' }
    & winget.exe install --id OpenJS.NodeJS.LTS --exact --source winget --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { throw 'Node.js installation did not complete. Resolve the installer message and run setup again.' }
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
    if (-not (Test-SupportedNode)) { throw 'Node.js is not available yet. Close this window and run setup again.' }
}

$claude = Get-Command claude -ErrorAction SilentlyContinue
$codex = Get-Command codex -ErrorAction SilentlyContinue
$desktopCodex = Join-Path $env:LOCALAPPDATA 'OpenAI/Codex/bin'
if (-not $claude -and -not $codex -and -not (Test-Path -LiteralPath $desktopCodex)) {
    Write-Host 'Install Claude Code or Codex and sign in on this PC, then run setup again.'
    Write-Host 'Pocket Code does not collect your AI account password.'
    throw 'No supported AI installation was found.'
}

Write-Host 'Install the latest Android APK on your phone; the release page is opening.'
Start-Process 'https://github.com/Evgenie-Myasnikov/pocket-code/releases/latest'
& (Join-Path $PSScriptRoot 'build-desktop.ps1') -InstallShortcut
& (Join-Path $PSScriptRoot 'start-desktop.ps1')
