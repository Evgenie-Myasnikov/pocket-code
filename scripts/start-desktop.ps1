$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$installRoot=Join-Path $env:LOCALAPPDATA 'Pocket Code Desktop'
function Get-InstalledDesktop {
    $pointer=Join-Path $installRoot 'current.txt'
    if(-not (Test-Path -LiteralPath $pointer)){return $null}
    $candidate=[IO.Path]::GetFullPath([IO.File]::ReadAllText($pointer).Trim())
    if($candidate.StartsWith([IO.Path]::GetFullPath($installRoot)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($candidate) -eq 'Pocket Code.exe' -and (Test-Path -LiteralPath $candidate)){return $candidate}
    return $null
}
$exe=Get-InstalledDesktop
if(-not $exe){
    & (Join-Path $PSScriptRoot 'build-desktop.ps1') -InstallShortcut
    $exe=Get-InstalledDesktop
}
if(-not $exe){throw 'Desktop installation is incomplete.'}
Start-Process -FilePath $exe -ArgumentList ('--source "'+$root+'"') -WorkingDirectory $root
