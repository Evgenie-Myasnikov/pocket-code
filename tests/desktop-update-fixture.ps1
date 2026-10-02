param([switch]$FailHealth)
$ErrorActionPreference='Stop'
$originalAppData=$env:LOCALAPPDATA
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('pocket-update-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture|Out-Null
$env:LOCALAPPDATA=$fixture
$storage=Join-Path $fixture 'data';New-Item -ItemType Directory -Path $storage|Out-Null
[IO.File]::WriteAllText((Join-Path $storage 'connection-key.txt'),'synthetic-test-key')
$package=Join-Path $fixture 'package';New-Item -ItemType Directory -Path (Join-Path $package 'host/scripts') -Force|Out-Null
[IO.File]::WriteAllText((Join-Path $package 'host/package.json'),' {"name":"pocket-code","version":"2.0.0"}')
[IO.File]::WriteAllText((Join-Path $package 'desktop-version.json'),'{"version":"2.0.0"}')
# Simulates native idle handoff only inside this fixture. No real server/process is touched.
[IO.File]::WriteAllText((Join-Path $package 'host/scripts/bootstrap.ps1'),'function Ensure-PocketDependencies($directory){[IO.File]::WriteAllText((Join-Path $updates "apply.txt"),$ticket)}')
$exe=Join-Path $package 'Pocket Code.exe'
Add-Type -TypeDefinition 'public class FixtureDesktop {public static void Main(){System.Threading.Thread.Sleep(5000);}}' -OutputAssembly $exe -OutputType WindowsApplication
$previous=Join-Path $fixture 'Previous.exe';Copy-Item -LiteralPath $exe -Destination $previous
$zip=Join-Path $fixture 'release.zip';Compress-Archive -Path (Join-Path $package '*') -DestinationPath $zip
$asset=@{protocol=1;asset='Pocket-Code-Desktop-2.0.0-win-x64.zip';size=(Get-Item $zip).Length;sha256=(Get-FileHash $zip -Algorithm SHA256).Hash}
$global:pocketFixtureManifest=@{applicationId='app.pocketcode.mobile';version='2.0.0';desktop=$asset}|ConvertTo-Json -Depth 5
$global:pocketFixtureRelease=@{tag_name='v2.0.0';draft=$false;prerelease=$false;assets=@(@{name=$asset.asset;state='uploaded';size=$asset.size})}
function Invoke-WebRequest($Uri,$OutFile){if($Uri.EndsWith('/update.json')){[IO.File]::WriteAllText($OutFile,$global:pocketFixtureManifest)}else{Copy-Item -LiteralPath $zip -Destination $OutFile}}
function Invoke-RestMethod($Uri){if($Uri.Contains('api.github.com')){return $global:pocketFixtureRelease};if($FailHealth){throw 'Synthetic health failure'};return @{applicationId='app.pocketcode.host';version='2.0.0'}}
function Get-NetTCPConnection {return $null}
function Get-ItemProperty {return $null}
# Do not write real Desktop/Start-menu shortcuts from a fixture.
function New-Object {
 param([string]$TypeName,[object[]]$ArgumentList,[string]$ComObject)
 if($ComObject){
  $shell=[pscustomobject]@{};$shell|Add-Member ScriptMethod CreateShortcut {param($p) $link=[pscustomobject]@{TargetPath='';Arguments='';WorkingDirectory=''};$link|Add-Member ScriptMethod Save {};return $link};return $shell
 }
 Microsoft.PowerShell.Utility\New-Object -TypeName $TypeName -ArgumentList $ArgumentList
}
try{
 & (Join-Path $PSScriptRoot '../scripts/desktop-update.ps1') -Storage $storage -CurrentExe $previous -Source $fixture -ParentId 2147483646 -Version '1.0.0'
 $state=Get-Content -LiteralPath (Join-Path $storage 'desktop-update/state.json') -Raw|ConvertFrom-Json
 if(-not (Test-Path -LiteralPath (Join-Path $fixture 'Pocket Code Desktop/current.txt'))){throw $Error[0]}
 $pointer=Get-Content -LiteralPath (Join-Path $fixture 'Pocket Code Desktop/current.txt') -Raw
 if($FailHealth){if($state.state -ne 'error' -or $pointer -cne $previous){throw 'Rollback failed'}}
 elseif($state.state -ne 'complete' -or $pointer -notlike '*versions*'){throw 'Install failed'}
 Write-Output ('PASS fixture '+$state.state)
}finally{$env:LOCALAPPDATA=$originalAppData}
