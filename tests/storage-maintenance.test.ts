import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const windows={skip:process.platform!=='win32',timeout:120000};
function powershell(body:string){
  const script=`$ErrorActionPreference='Stop'; . './scripts/bootstrap.ps1'
 $root=Join-Path ([IO.Path]::GetTempPath()) ('pocket-storage-test-'+[guid]::NewGuid().ToString('N'));[IO.Directory]::CreateDirectory($root)|Out-Null
 try{
${body}
 }finally{if($root.StartsWith([IO.Path]::GetTempPath())){$null | & cmd.exe /d /c rd /s /q $root}}
 Write-Output 'validated'`;
  return execFileSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cwd:path.resolve('.'),windowsHide:true,encoding:'utf8',input:''});
}
test('data folder permissions are applied once and skipped while already private',windows,()=>{
  assert.match(powershell(`
  if(Test-PocketPrivateStorage $root){throw 'Fresh folder reported private'}
  if(-not (Protect-PocketStorage $root)){throw 'Permissions not applied'}
  if(-not (Test-PocketPrivateStorage $root)){throw 'Permissions not detected'}
  if(Protect-PocketStorage $root){throw 'Permissions reapplied'}
  & icacls.exe $root '/inheritance:e' | Out-Null
  if(Test-PocketPrivateStorage $root){throw 'Inherited access accepted'}
  if(-not (Protect-PocketStorage $root)){throw 'Inherited access kept'}`),/validated/);
});
test('stale builds are removed while referenced, open, recent and newest files stay',windows,()=>{
  assert.match(powershell(`
  $storage=Join-Path $root 'data';$install=Join-Path $root 'install';$old=(Get-Date).AddDays(-2)
  function Folder($path,[switch]$Fresh){[IO.Directory]::CreateDirectory((Join-Path $path 'app'))|Out-Null;[IO.File]::WriteAllText((Join-Path $path 'app/package.json'),'{}');if(-not $Fresh){(Get-Item -LiteralPath $path).CreationTime=$old};$path}
  $hostRoot=Join-Path $storage 'host/versions'
  $stale=Folder (Join-Path $hostRoot '0.1.0-old');$current=Folder (Join-Path $hostRoot '0.2.0-current');$pending=Folder (Join-Path $hostRoot '0.3.0-pending');$fresh=Folder (Join-Path $hostRoot '0.4.0-fresh') -Fresh;$open=Folder (Join-Path $hostRoot '0.1.1-open');$leftover=Folder (Join-Path $hostRoot '.removing-synthetic')
  [IO.File]::WriteAllText((Join-Path $storage 'host/current.json'),(@{directory=(Join-Path $current 'app');version='0.2.0'}|ConvertTo-Json))
  [IO.File]::WriteAllText((Join-Path $storage 'host/pending.json'),(@{stagedDir=(Join-Path $pending 'app')}|ConvertTo-Json))
  $desktopRoot=Join-Path $install 'versions';$running=Folder (Join-Path $desktopRoot 'current');$source=Folder (Join-Path $desktopRoot 'source');$obsolete=Folder (Join-Path $desktopRoot 'obsolete')
  [IO.File]::WriteAllText((Join-Path $install 'current.txt'),(Join-Path $running 'Pocket Code.exe'))
  [IO.File]::WriteAllText((Join-Path $storage 'desktop.json'),(@{Source=(Join-Path $source 'host')}|ConvertTo-Json))
  $updates=Join-Path $storage 'desktop-update';[IO.Directory]::CreateDirectory($updates)|Out-Null;$ticket='a'*32
  [IO.File]::WriteAllText((Join-Path $updates 'state.json'),(@{state='current';ticket=$ticket;at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}|ConvertTo-Json))
  foreach($name in @(($ticket+'.zip'),(('b'*32)+'.zip'),(('c'*32)+'.json'))){$file=Join-Path $updates $name;[IO.File]::WriteAllText($file,'synthetic');(Get-Item $file).LastWriteTime=$old}
  $apks=Join-Path $storage 'updates';[IO.Directory]::CreateDirectory($apks)|Out-Null
  foreach($age in 2,3,4){$file=Join-Path $apks ("$age.apk");[IO.File]::WriteAllText($file,'synthetic');(Get-Item $file).LastWriteTime=(Get-Date).AddHours(-$age)}
  $handle=[IO.File]::Open((Join-Path $open 'app/package.json'),'Open','Read','Read')
  try{Remove-PocketStaleVersions $storage $install 0}finally{$handle.Dispose()}
  foreach($gone in @($stale,$leftover,$obsolete,(Join-Path $updates (('b'*32)+'.zip')),(Join-Path $updates (('c'*32)+'.json')),(Join-Path $apks '3.apk'),(Join-Path $apks '4.apk'))){if(Test-Path -LiteralPath $gone){throw "Stale item kept: $(Split-Path -Leaf $gone)"}}
  foreach($kept in @($current,$pending,$fresh,$open,$running,$source,(Join-Path $updates ($ticket+'.zip')),(Join-Path $apks '2.apk'))){if(-not (Test-Path -LiteralPath $kept)){throw "Needed item removed: $(Split-Path -Leaf $kept)"}}
  if(@(Get-ChildItem -LiteralPath $hostRoot -Directory -Force|Where-Object{$_.Name.StartsWith('.removing-')}).Count){throw 'Rename leftovers remain'}
  [IO.File]::WriteAllText((Join-Path $updates 'state.json'),(@{state='ready';ticket=$ticket;at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}|ConvertTo-Json))
  $rollback=Folder (Join-Path $desktopRoot 'rollback')
  Remove-PocketStaleVersions $storage $install 0
  if(-not (Test-Path -LiteralPath $rollback)){throw 'Desktop build removed during an update'}`),/validated/);
});
