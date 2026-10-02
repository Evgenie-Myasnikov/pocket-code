$ErrorActionPreference = 'Stop'
$root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
Write-Host 'Pocket Code setup' -ForegroundColor Green
Write-Host 'Preparing the Windows application. Missing dependencies will be installed automatically.'
& (Join-Path $PSScriptRoot 'build-desktop.ps1') -InstallShortcut
Write-Host 'Setup complete. Sign in to your AI provider in Settings, then pair your phone by QR.'
Write-Host 'Android download: https://github.com/Evgenie-Myasnikov/pocket-code/releases/latest'
& (Join-Path $PSScriptRoot 'start-desktop.ps1')
