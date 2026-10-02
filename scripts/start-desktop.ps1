$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$exe=Join-Path $env:LOCALAPPDATA 'Pocket Code Desktop/Pocket Code.exe'
if(-not (Test-Path -LiteralPath $exe)){
    & (Join-Path $PSScriptRoot 'build-desktop.ps1') -InstallShortcut
}
Start-Process -FilePath $exe -ArgumentList ('--source "'+$root+'"') -WorkingDirectory $root
