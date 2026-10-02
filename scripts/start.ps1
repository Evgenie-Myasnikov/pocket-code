param([string[]]$ProjectPath, [int]$Port = 4318, [string]$BindAddress = '0.0.0.0', [switch]$Internet, [switch]$Desktop)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$storagePath = if ($env:POCKET_DATA_DIR) { [IO.Path]::GetFullPath($env:POCKET_DATA_DIR) } else { Join-Path $env:USERPROFILE '.pocket-code' }
$claudeCommand = Get-Command claude -ErrorAction SilentlyContinue
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    $running=$null
    try {
        $token=if($env:POCKET_TOKEN){$env:POCKET_TOKEN}else{(Get-Content -LiteralPath (Join-Path $storagePath 'connection-key.txt') -Raw).Trim()}
        $running=Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -Headers @{Authorization='Bearer '+$token} -TimeoutSec 3
    }catch{}
    if($running.protocol -eq 1 -and $running.processId -and $running.version){
        Write-Host 'Pocket Code is already running. No second server was started.'
        $pairing=Join-Path $storagePath 'pairing.html'
        if(-not $Desktop -and (Test-Path -LiteralPath $pairing)){Start-Process -FilePath 'explorer.exe' -ArgumentList ('"'+$pairing+'"') -WindowStyle Hidden}
        return
    }
    throw ('Port ' + $Port + ' belongs to another process. No process was stopped.')
}
. (Join-Path $PSScriptRoot 'bootstrap.ps1')
Ensure-PocketDependencies $projectRoot
if ($Internet) {
    Write-Host 'Internet mode: traffic passes through Cloudflare over HTTPS. Access still requires your private key.'
    . (Join-Path $PSScriptRoot 'install-tunnel.ps1')
    $env:POCKET_INTERNET = '1'
    $BindAddress = '127.0.0.1'
} else { $env:POCKET_INTERNET = '0' }
if (-not $ProjectPath) {
    # Keep the existing default project, and let the paired phone choose local folders.
    $ProjectPath = @($projectRoot)
    foreach ($drive in [IO.DriveInfo]::GetDrives()) {
        if ($drive.IsReady -and $drive.DriveType -eq [IO.DriveType]::Fixed) {
            $ProjectPath += $drive.RootDirectory.FullName
        }
    }
    Write-Host 'Choose your project in the phone app. Local Git projects are discovered automatically.'
}
$resolvedRoots = @($ProjectPath | ForEach-Object { (Resolve-Path -LiteralPath $_).Path })
$env:POCKET_ROOTS = ConvertTo-Json -InputObject $resolvedRoots -Compress
$env:POCKET_HOST = $BindAddress
$env:POCKET_PORT = [string]$Port
$env:POCKET_OPEN_PAIRING = if($Desktop){'0'}else{'1'}
if ($claudeCommand) { $env:POCKET_CLAUDE_EXECUTABLE = $claudeCommand.Source }
if (-not (Test-Path -LiteralPath 'dist/index.html')) { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Application build failed' } }
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
if(-not $Desktop){Write-Host ([System.IO.File]::ReadAllText($keyPath)) -ForegroundColor Yellow}
Write-Host ''
Write-Host ('Open on this PC: http://127.0.0.1:' + $Port)
if ($Internet) { Write-Host 'Scan the new HTTPS QR code for mobile internet. Keep this window open.' }
else { Write-Host 'For mobile internet, enable internet mode in the desktop connection settings or configure Tailscale on both devices.' }
Write-Host 'Close this window or press Ctrl+C to fully quit Pocket Code and its tunnel.'
Write-Host 'A QR pairing page will open in your browser after the server starts.'
$managedPointer = Join-Path $storagePath 'host/current.json'
if (Test-Path -LiteralPath $managedPointer) {
    try {
        $managed = Get-Content -LiteralPath $managedPointer -Raw | ConvertFrom-Json
        $managedRoot = [IO.Path]::GetFullPath((Join-Path $storagePath 'host/versions')) + [IO.Path]::DirectorySeparatorChar
        $managedDirectory = (Resolve-Path -LiteralPath $managed.directory -ErrorAction Stop).Path
        $managedPackage = Get-Content -LiteralPath (Join-Path $managedDirectory 'package.json') -Raw | ConvertFrom-Json
        $sourcePackage = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
        if ($managedDirectory.StartsWith($managedRoot, [StringComparison]::OrdinalIgnoreCase) -and $managedPackage.name -eq 'pocket-code' -and $managedPackage.version -eq $managed.version -and ([version]$managedPackage.version -gt [version]$sourcePackage.version) -and (Test-Path -LiteralPath (Join-Path $managedDirectory 'server/index.ts'))) {
            Set-Location -LiteralPath $managedDirectory
        }
    } catch { Write-Host 'The saved PC update is unavailable. Starting the original version.' }
}
& (Join-Path $PSScriptRoot 'run-host.ps1') -RuntimeDirectory (Get-Location).Path -StoragePath $storagePath -Port $Port
