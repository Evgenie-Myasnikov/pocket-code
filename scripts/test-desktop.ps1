param([string]$CapturePath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$ui=Join-Path $root 'artifacts/desktop/ui'
# Assets from an earlier build must not survive into the next package or installation.
New-Item -ItemType Directory -Force -Path (Join-Path $ui 'assets') | Out-Null;Set-Content -LiteralPath (Join-Path $ui 'assets/stale-synthetic.js') -Value '// synthetic'
& (Join-Path $PSScriptRoot 'build-desktop.ps1') -SkipWebBuild
if(Compare-Object @(Get-ChildItem -LiteralPath (Join-Path $root 'dist') -Recurse -File -Name) @(Get-ChildItem -LiteralPath $ui -Recurse -File -Name)){throw 'Desktop interface does not match the current build'}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$output=Join-Path $root 'artifacts/desktop/DesktopSmoke.exe'
& $compiler /nologo /target:exe /platform:x64 /main:DesktopSmoke /utf8output ("/win32icon:"+(Join-Path $root 'desktop/PocketCode.ico')) "/out:$output" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Net.Http.dll /r:System.Web.Extensions.dll ("/r:"+(Join-Path $root 'artifacts/desktop/Microsoft.Web.WebView2.Core.dll')) ("/r:"+(Join-Path $root 'artifacts/desktop/Microsoft.Web.WebView2.WinForms.dll')) (Join-Path $root 'desktop/DesktopWindow.cs') (Join-Path $root 'scripts/OwnedHost.cs') (Join-Path $root 'tests/DesktopSmoke.cs')
if($LASTEXITCODE -ne 0){throw 'Desktop test compilation failed'}
if($CapturePath){& $output $CapturePath}else{& $output}
if($LASTEXITCODE -ne 0){throw 'Desktop smoke test failed'}
