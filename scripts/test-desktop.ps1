param([string]$CapturePath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'build-desktop.ps1')
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$output=Join-Path $root 'artifacts/desktop/DesktopSmoke.exe'
& $compiler /nologo /target:exe /main:DesktopSmoke /utf8output "/out:$output" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Net.Http.dll /r:System.Web.Extensions.dll (Join-Path $root 'desktop/PocketCode.cs') (Join-Path $root 'scripts/OwnedHost.cs') (Join-Path $root 'tests/DesktopSmoke.cs')
if($LASTEXITCODE -ne 0){throw 'Desktop test compilation failed'}
if($CapturePath){& $output $CapturePath}else{& $output}
if($LASTEXITCODE -ne 0){throw 'Desktop smoke test failed'}
