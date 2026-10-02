param([Parameter(Mandatory=$true)][string]$Storage,[Parameter(Mandatory=$true)][string]$CurrentExe,[Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][int]$ParentId,[Parameter(Mandatory=$true)][string]$Version,[switch]$FunctionsOnly)
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
function Test-DesktopManifest($release,$manifest,$current){
    if($release.draft -or $release.prerelease -or $manifest.applicationId -ne 'app.pocketcode.mobile' -or $manifest.version -notmatch '^\d+\.\d+\.\d+$' -or $release.tag_name -cne ('v'+$manifest.version)){throw 'Invalid desktop update manifest'}
    if([version]$manifest.version -le [version]$current){return $false}
    $asset=$manifest.desktop
    if($asset.protocol -ne 1 -or $asset.asset -cne ('Pocket-Code-Desktop-'+$manifest.version+'-win-x64.zip') -or $asset.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $asset.size -lt 1 -or $asset.size -gt 200000000){throw 'Invalid desktop update asset'}
    $matches=@($release.assets | Where-Object {$_.name -ceq $asset.asset -and $_.state -eq 'uploaded' -and $_.size -eq $asset.size})
    if($matches.Count -ne 1){throw 'Desktop update asset is missing'}
    return $true
}
function Expand-VerifiedDesktop($archive,$destination,$asset){
    if((Get-Item -LiteralPath $archive).Length -ne $asset.size -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $asset.sha256){throw 'Desktop checksum mismatch'}
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=[IO.Compression.ZipFile]::OpenRead($archive)
    try{
        $seen=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase);$total=0L
        foreach($entry in $zip.Entries){
            $name=$entry.FullName.Replace('\','/')
            if($name.Contains('\') -or $name.Contains(':') -or $name.StartsWith('/') -or $name -match '(^|/)\.\.?(/|$)' -or $name -match '[\x00-\x1f]' -or -not $seen.Add($name) -or (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000){throw 'Unsafe desktop archive path'}
            foreach($part in $name.TrimEnd('/').Split('/')){if(-not $part -or $part -match '[. ]$' -or $part -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)'){throw 'Unsafe Windows archive name'}}
            $total+=$entry.Length;if($total -gt 600000000 -or $entry.Length -gt 100000000 -or $seen.Count -gt 15000){throw 'Desktop archive too large'}
            $target=[IO.Path]::GetFullPath((Join-Path $destination $name))
            if(-not $target.StartsWith([IO.Path]::GetFullPath($destination)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Archive escaped destination'}
        }
    }finally{$zip.Dispose()}
    [IO.Compression.ZipFile]::ExtractToDirectory($archive,$destination)
}
if($FunctionsOnly){return}
$installRoot=Join-Path $env:LOCALAPPDATA 'Pocket Code Desktop'
$updates=Join-Path $Storage 'desktop-update'
New-Item -ItemType Directory -Force -Path $updates|Out-Null
$stateFile=Join-Path $updates 'state.json';$ack=Join-Path $updates 'apply.txt';$ticket=[guid]::NewGuid().ToString('N')
function State($state,$message,$targetVersion=''){
    $value=@{state=$state;message=$message;version=$targetVersion;ticket=$ticket;parentId=$ParentId;at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}
    $temp=$stateFile+'.tmp';[IO.File]::WriteAllText($temp,($value|ConvertTo-Json -Compress));Move-Item -LiteralPath $temp -Destination $stateFile -Force
}
function Get-Public($url,$file){Invoke-WebRequest -UseBasicParsing -Uri $url -Headers @{'User-Agent'='Pocket-Code-Updater';Accept='application/vnd.github+json'} -TimeoutSec 120 -OutFile $file}
$mutex=[Threading.Mutex]::new($false,('Local\PocketCodeDesktopUpdate-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value))
$locked=$false;$handedOff=$false;$previousSource=$Source
try{
    try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
    if(-not $locked){exit 0}
    State 'checking' 'Checking GitHub'
    $release=Invoke-RestMethod -Uri 'https://api.github.com/repos/Evgenie-Myasnikov/pocket-code/releases/latest' -Headers @{'User-Agent'='Pocket-Code-Updater'} -TimeoutSec 30
    if($release.tag_name -notmatch '^v\d+\.\d+\.\d+$'){throw 'Invalid release tag'}
    if([version]$release.tag_name.Substring(1) -le [version]$Version){State 'current' 'Up to date';exit 0}
    $base='https://github.com/Evgenie-Myasnikov/pocket-code/releases/download/'+$release.tag_name+'/'
    $manifestPath=Join-Path $updates ($ticket+'.json');Get-Public ($base+'update.json') $manifestPath
    $manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
    if(-not (Test-DesktopManifest $release $manifest $Version)){State 'current' 'Up to date';exit 0}
    State 'downloading' 'Downloading Windows update' $manifest.version
    $archive=Join-Path $updates ($ticket+'.zip');Get-Public ($base+$manifest.desktop.asset) $archive
    $staged=Join-Path $installRoot ('versions/'+$manifest.version+'-'+$ticket)
    Expand-VerifiedDesktop $archive $staged $manifest.desktop
    $metadata=Get-Content -LiteralPath (Join-Path $staged 'desktop-version.json') -Raw|ConvertFrom-Json
    $hostRoot=Join-Path $staged 'host';$pkg=Get-Content -LiteralPath (Join-Path $hostRoot 'package.json') -Raw|ConvertFrom-Json
    if($metadata.version -cne $manifest.version -or $pkg.name -ne 'pocket-code' -or $pkg.version -cne $manifest.version -or -not (Test-Path -LiteralPath (Join-Path $staged 'Pocket Code.exe'))){throw 'Desktop package version mismatch'}
    State 'preparing' 'Preparing Windows update' $manifest.version
    . (Join-Path $hostRoot 'scripts/bootstrap.ps1')
    Ensure-PocketDependencies $hostRoot
    State 'ready' 'Ready; waiting for active tasks to finish' $manifest.version
    $deadline=[DateTime]::UtcNow.AddHours(24)
    while(-not (Test-Path -LiteralPath $ack) -or (Get-Content -LiteralPath $ack -Raw).Trim() -cne $ticket){
        if(-not (Get-Process -Id $ParentId -ErrorAction SilentlyContinue)){State 'paused' 'Application closed before update';exit 0}
        if([DateTime]::UtcNow -gt $deadline){throw 'Update timed out waiting for idle application'}
        Start-Sleep -Seconds 1
    }
    $handedOff=$true
    $old=Get-Process -Id $ParentId -ErrorAction SilentlyContinue
    if($old -and -not $old.WaitForExit(30000)){throw 'Previous application did not exit'}
    $deadline=[DateTime]::UtcNow.AddSeconds(30)
    while(Get-NetTCPConnection -LocalPort 4318 -State Listen -ErrorAction SilentlyContinue){if([DateTime]::UtcNow -gt $deadline){throw 'Previous host did not release its port'};Start-Sleep -Milliseconds 500}
    State 'restarting' 'Restarting Windows application' $manifest.version
    $newExe=Join-Path $staged 'Pocket Code.exe'
    [IO.File]::WriteAllText((Join-Path $installRoot 'current.txt'),$newExe)
    $next=Start-Process -FilePath $newExe -ArgumentList ('--updated --background --source "'+$hostRoot+'"') -WindowStyle Hidden -PassThru
    $healthy=$false;$deadline=[DateTime]::UtcNow.AddSeconds(300)
    do{
        Start-Sleep -Seconds 2
        try{$token=(Get-Content -LiteralPath (Join-Path $Storage 'connection-key.txt') -Raw).Trim();$runtime=Invoke-RestMethod -Uri 'http://127.0.0.1:4318/api/runtime' -Headers @{Authorization='Bearer '+$token} -TimeoutSec 3;$healthy=$runtime.applicationId -eq 'app.pocketcode.host' -and [version]$runtime.version -ge [version]$manifest.version}catch{}
        $next.Refresh();if($next.HasExited){break}
    }while(-not $healthy -and [DateTime]::UtcNow -lt $deadline)
    if(-not $healthy){if(-not $next.HasExited){$next.Kill();$next.WaitForExit()};throw 'Updated application did not become healthy'}
    # Once the new host is healthy, shortcut failures must not roll back a live app.
    $handedOff=$false
    try{
    $runKey='HKCU:/Software/Microsoft/Windows/CurrentVersion/Run'
    $registered=(Get-ItemProperty -LiteralPath $runKey -Name PocketCode -ErrorAction SilentlyContinue).PocketCode
    if($registered){Set-ItemProperty -LiteralPath $runKey -Name PocketCode -Value ('"'+$newExe+'" --background --source "'+$hostRoot+'"')}
    $shell=New-Object -ComObject WScript.Shell
    foreach($folder in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){$link=$shell.CreateShortcut((Join-Path $folder 'Pocket Code.lnk'));$link.TargetPath=$newExe;$link.Arguments='--source "'+$hostRoot+'"';$link.WorkingDirectory=$hostRoot;$link.Save()}
    }catch{
        # Current-version launcher remains valid even if a shortcut is locked.
    }
    State 'complete' 'Windows application updated' $manifest.version
}catch{
    if($handedOff){[IO.File]::WriteAllText((Join-Path $installRoot 'current.txt'),$CurrentExe);Start-Process -FilePath $CurrentExe -ArgumentList ('--updated --background --source "'+$previousSource+'"') -WindowStyle Hidden}
    State 'error' 'Update failed. The previous version is kept; check network and retry.'
}finally{if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
