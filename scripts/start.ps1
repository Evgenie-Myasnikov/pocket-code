param([string[]]$ProjectPath, [int]$Port = 4318, [string]$BindAddress = '0.0.0.0', [switch]$Internet)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 or newer: https://nodejs.org/' }
$claudeCommand = Get-Command claude -ErrorAction SilentlyContinue
$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
$desktopCodexPath = Join-Path $env:LOCALAPPDATA 'OpenAI/Codex/bin'
if (-not $claudeCommand -and -not $codexCommand -and -not (Test-Path -LiteralPath $desktopCodexPath)) { throw 'Install Claude Code or Codex and sign in on this PC first.' }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw ('Port ' + $Port + ' is already in use. Close the previous Pocket Code server window, then start this launcher again.')
}
if ($Internet) {
    Write-Host 'Internet mode: traffic passes through Cloudflare over HTTPS. Access still requires your private key.'
    . (Join-Path $PSScriptRoot 'install-tunnel.ps1')
    $env:POCKET_INTERNET = '1'
    $BindAddress = '127.0.0.1'
} else { $env:POCKET_INTERNET = '0' }
if (-not $ProjectPath) {
    $chosen = Read-Host 'Project folder on this PC (Enter for current folder)'
    if (-not $chosen) { $chosen = $projectRoot }
    $ProjectPath = @($chosen.Trim('"'))
}
$resolvedRoots = @($ProjectPath | ForEach-Object { (Resolve-Path -LiteralPath $_).Path })
$env:POCKET_ROOTS = ConvertTo-Json -InputObject $resolvedRoots -Compress
$env:POCKET_HOST = $BindAddress
$env:POCKET_PORT = [string]$Port
$env:POCKET_OPEN_PAIRING = '1'
if ($claudeCommand) { $env:POCKET_CLAUDE_EXECUTABLE = $claudeCommand.Source }
if (-not (Test-Path -LiteralPath 'node_modules')) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' } }
if (-not (Test-Path -LiteralPath 'dist/index.html')) { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Application build failed' } }
$storagePath = Join-Path $env:USERPROFILE '.pocket-code'
New-Item -ItemType Directory -Force -Path $storagePath | Out-Null
$keyPath = Join-Path $storagePath 'connection-key.txt'
if (-not (Test-Path -LiteralPath $keyPath)) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes); $rng.Dispose()
    $key = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
    [System.IO.File]::WriteAllText($keyPath, $key)
}
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $storagePath '/inheritance:r' '/grant:r' ($identity + ':(OI)(CI)F') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict access to connection key' }
Write-Host ''
Write-Host 'Pocket Code - private connection key (paste into the Android app):' -ForegroundColor Green
Write-Host ([System.IO.File]::ReadAllText($keyPath)) -ForegroundColor Yellow
Write-Host ''
Write-Host ('Open on this PC: http://127.0.0.1:' + $Port)
if ($Internet) { Write-Host 'Scan the new HTTPS QR code for mobile internet. Keep this window open.' }
else { Write-Host 'For mobile internet, use Start Pocket Code Internet.cmd or configure Tailscale on both devices.' }
Write-Host 'The server must keep running. Press Ctrl+C to stop it.'
Write-Host 'A QR pairing page will open in your browser after the server starts.'
& npm.cmd run server
if ($LASTEXITCODE -ne 0) { throw 'Server exited with an error' }
