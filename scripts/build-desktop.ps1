param([switch]$InstallShortcut)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if(-not (Test-Path -LiteralPath $compiler)){throw '.NET Framework 4 compiler is required.'}
$output=Join-Path $root 'artifacts/desktop'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$exe=Join-Path $output 'Pocket Code.exe'
& $compiler /nologo /target:winexe /optimize+ /utf8output "/out:$exe" ("/win32manifest:"+(Join-Path $root 'desktop/PocketCode.manifest')) /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Net.Http.dll /r:System.Web.Extensions.dll (Join-Path $root 'desktop/PocketCode.cs') (Join-Path $root 'scripts/OwnedHost.cs')
if($LASTEXITCODE -ne 0){throw 'Desktop build failed'}
if($InstallShortcut){
    $installed=Join-Path $env:LOCALAPPDATA 'Pocket Code Desktop'
    New-Item -ItemType Directory -Force -Path $installed | Out-Null
    Copy-Item -LiteralPath $exe -Destination (Join-Path $installed 'Pocket Code.exe') -Force
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
