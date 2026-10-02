param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'build-desktop.ps1') -SkipWebBuild
if($LASTEXITCODE -ne 0){throw 'Desktop build failed'}
$version=(Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw|ConvertFrom-Json).version
$staging=Join-Path $root ('artifacts/desktop-package-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging|Out-Null
# The staging copy is only an input to the archive; never leave it behind in artifacts.
try{
foreach($name in @('Pocket Code.exe','Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll','desktop-version.json','desktop-update.ps1','ui')){Copy-Item -LiteralPath (Join-Path $root ('artifacts/desktop/'+$name)) -Destination $staging -Recurse}
$hostRoot=Join-Path $staging 'host';New-Item -ItemType Directory -Path (Join-Path $hostRoot 'scripts') -Force|Out-Null
foreach($name in @('package.json','package-lock.json','tsconfig.json','server','src','dist')){Copy-Item -LiteralPath (Join-Path $root $name) -Destination $hostRoot -Recurse}
foreach($name in @('bootstrap.ps1','start.ps1','run-host.ps1','OwnedHost.cs','install-tunnel.ps1','host-update-worker.mjs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $hostRoot 'scripts')}
$archive=Join-Path $root ('artifacts/Pocket-Code-Desktop-'+$version+'-win-x64.zip')
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -Force
}finally{Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue}
Write-Host 'Windows update package created.'
