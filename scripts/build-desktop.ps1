param([switch]$InstallShortcut,[switch]$SkipWebBuild)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'bootstrap.ps1')
if(-not $SkipWebBuild){Ensure-PocketDependencies $root}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if(-not (Test-Path -LiteralPath $compiler)){throw '.NET Framework 4 compiler is required.'}
$output=Join-Path $root 'artifacts/desktop'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$exe=Join-Path $output 'Pocket Code.exe'
$sdkRoot=Join-Path $root '.tools/webview2'
New-Item -ItemType Directory -Force -Path $sdkRoot | Out-Null
$archive=Join-Path $sdkRoot 'sdk.zip'
if(-not (Test-Path -LiteralPath $archive)){Invoke-WebRequest -UseBasicParsing 'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4258.31/microsoft.web.webview2.1.0.4258.31.nupkg' -OutFile $archive}
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne '56F7F4B8BF9AEE4B8EFEFBBDD4F67D5F74EBD1B100ED0806DA71BF76AF481AA9'){throw 'WebView2 SDK checksum mismatch'}
$sdk=Join-Path $sdkRoot 'sdk'
Expand-Archive -LiteralPath $archive -DestinationPath $sdk -Force
foreach($library in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll')){Copy-Item -LiteralPath (Join-Path $sdk ('lib/net462/'+$library)) -Destination (Join-Path $output $library) -Force}
Copy-Item -LiteralPath (Join-Path $sdk 'runtimes/win-x64/native/WebView2Loader.dll') -Destination $output -Force
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /utf8output "/out:$exe" ("/win32manifest:"+(Join-Path $root 'desktop/PocketCode.manifest')) /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Net.Http.dll /r:System.Web.Extensions.dll ("/r:"+(Join-Path $output 'Microsoft.Web.WebView2.Core.dll')) ("/r:"+(Join-Path $output 'Microsoft.Web.WebView2.WinForms.dll')) (Join-Path $root 'desktop/DesktopWindow.cs') (Join-Path $root 'scripts/OwnedHost.cs')
if($LASTEXITCODE -ne 0){throw 'Desktop build failed'}
if(-not $SkipWebBuild){Push-Location $root;try{& npm.cmd run build;if($LASTEXITCODE -ne 0){throw 'Shared interface build failed'}}finally{Pop-Location}}
$ui=Join-Path $output 'ui'
New-Item -ItemType Directory -Force -Path $ui | Out-Null
Copy-Item -Path (Join-Path $root 'dist/*') -Destination $ui -Recurse -Force
$version=(Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw|ConvertFrom-Json).version
[IO.File]::WriteAllText((Join-Path $output 'desktop-version.json'),(@{version=$version}|ConvertTo-Json -Compress))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'desktop-update.ps1') -Destination $output -Force
if($InstallShortcut){
    $installRoot=Join-Path $env:LOCALAPPDATA 'Pocket Code Desktop'
    $buildId=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.Substring(0,12)+'-'+(Get-FileHash -LiteralPath (Join-Path $ui 'index.html') -Algorithm SHA256).Hash.Substring(0,12)
    $installed=Join-Path $installRoot ('versions/'+$buildId)
    New-Item -ItemType Directory -Force -Path $installed | Out-Null
    Copy-Item -LiteralPath $exe -Destination (Join-Path $installed 'Pocket Code.exe') -Force
    foreach($library in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll')){Copy-Item -LiteralPath (Join-Path $output $library) -Destination $installed -Force}
    Copy-Item -LiteralPath $ui -Destination $installed -Recurse -Force
    foreach($name in @('desktop-version.json','desktop-update.ps1')){Copy-Item -LiteralPath (Join-Path $output $name) -Destination $installed -Force}
    [IO.File]::WriteAllText((Join-Path $installRoot 'current.txt'),(Join-Path $installed 'Pocket Code.exe'))
    $runKey='HKCU:/Software/Microsoft/Windows/CurrentVersion/Run'
    $registered=(Get-ItemProperty -LiteralPath $runKey -Name PocketCode -ErrorAction SilentlyContinue).PocketCode
    if($registered -and $registered.StartsWith('"'+$installRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
        Set-ItemProperty -LiteralPath $runKey -Name PocketCode -Value ('"'+(Join-Path $installed 'Pocket Code.exe')+'" --background --source "'+$root+'"')
    }
    Add-Type -Path (Join-Path $output 'Microsoft.Web.WebView2.Core.dll')
    try{$runtime=[Microsoft.Web.WebView2.Core.CoreWebView2Environment]::GetAvailableBrowserVersionString()}catch{$runtime=$null}
    if(-not $runtime){
        $bootstrap=Join-Path $sdkRoot 'MicrosoftEdgeWebview2Setup.exe'
        Invoke-WebRequest -UseBasicParsing 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $bootstrap
        $signature=Get-AuthenticodeSignature -LiteralPath $bootstrap
        if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation'){throw 'WebView2 installer signature is not valid'}
        $process=Start-Process -FilePath $bootstrap -ArgumentList '/silent /install' -WindowStyle Hidden -Wait -PassThru
        if($process.ExitCode -ne 0){throw 'WebView2 installation failed. Install Microsoft Edge WebView2 Runtime, then retry.'}
    }
    $shell=New-Object -ComObject WScript.Shell
    foreach($folder in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){
        $shortcut=$shell.CreateShortcut((Join-Path $folder 'Pocket Code.lnk'))
        $shortcut.TargetPath=Join-Path $installed 'Pocket Code.exe'
        $shortcut.Arguments='--source "'+$root+'"'
        $shortcut.WorkingDirectory=$root
        $shortcut.Save()
    }
    Write-Host 'Desktop application and shortcuts installed. Enable Windows startup in its settings.'
}
Write-Host 'Desktop build ready.'
