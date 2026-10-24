import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
test('desktop update rejects invalid releases, hashes and path traversal before extraction',{skip:process.platform!=='win32'},()=>{
 const script=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'; . './scripts/desktop-update.ps1' -Storage fixture -CurrentExe fixture -Source fixture -ParentId 1 -Version 1.0.0 -FunctionsOnly
 $asset=@{protocol=1;asset='Pocket-Code-Desktop-2.0.0-win-x64.zip';sha256=('a'*64);size=10}
 $manifest=@{applicationId='app.pocketcode.mobile';version='2.0.0';desktop=$asset}
 $release=@{tag_name='v2.0.0';draft=$false;prerelease=$false;assets=@(@{name=$asset.asset;state='uploaded';size=10})}
 if(-not (Test-DesktopManifest $release $manifest '1.0.0')){throw 'Expected update'}
 if(Test-DesktopManifest $release $manifest '2.0.0'){throw 'Reinstall same version'}
 $release.draft=$true;$rejected=$false;try{Test-DesktopManifest $release $manifest '1.0.0'}catch{$rejected=$true};if(-not $rejected){throw 'Draft accepted'};$release.draft=$false
 $asset.asset='../unsafe.zip';$rejected=$false;try{Test-DesktopManifest $release $manifest '1.0.0'}catch{$rejected=$true};if(-not $rejected){throw 'Name accepted'}
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $root=Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N'));[IO.Directory]::CreateDirectory($root)|Out-Null
 foreach($name in @('../escape.txt','CON.txt','a./file.txt','safe.txt')){
  $file=Join-Path $root ([guid]::NewGuid().ToString('N')+'.zip');$zip=[IO.Compression.ZipFile]::Open($file,'Create');$entry=$zip.CreateEntry($name);$writer=New-Object IO.StreamWriter($entry.Open());$writer.Write('synthetic');$writer.Dispose();$zip.Dispose()
  $meta=@{size=(Get-Item $file).Length;sha256=(Get-FileHash $file -Algorithm SHA256).Hash};if($name -eq 'safe.txt'){$meta.sha256='0'*64}
  $rejected=$false;try{Expand-VerifiedDesktop $file (Join-Path $root 'extract') $meta}catch{$rejected=$true};if(-not $rejected){throw 'Unsafe archive accepted'}
 }
 Write-Output 'validated'
 `;
 const result=execFileSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cwd:path.resolve('.'),windowsHide:true,encoding:'utf8'});assert.match(result,/validated/);
});

test('desktop downloads retry temporary failures but preserve permanent failures',{skip:process.platform!=='win32'},()=>{
 const script=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'; . './scripts/desktop-update.ps1' -Storage fixture -CurrentExe fixture -Source fixture -ParentId 1 -Version 1.0.0 -FunctionsOnly
 function Start-Sleep {}
 $script:attempts=0
 $value=Invoke-PocketUpdateRead {$script:attempts++;if($script:attempts -lt 3){throw [Net.WebException]::new('Synthetic temporary outage')};'verified'}
 if($attempts -ne 3 -or $value -ne 'verified'){throw 'Temporary retry failed'}
 $script:attempts=0;$rejected=$false
 try{Invoke-PocketUpdateRead {$script:attempts++;$e=[Exception]::new('Synthetic permanent failure');$e|Add-Member NoteProperty Response ([pscustomobject]@{StatusCode=404});throw $e}}catch{$rejected=$true}
 if(-not $rejected -or $attempts -ne 1){throw 'Permanent failure was retried'}
 $script:attempts=0;$rejected=$false
 try{Invoke-PocketUpdateRead {$script:attempts++;throw 'Synthetic persistent outage'}}catch{$rejected=$true}
 if(-not $rejected -or $attempts -ne 3){throw 'Retry budget was not bounded'}
 Write-Output 'retry-validated'`;
 assert.match(execFileSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cwd:path.resolve('.'),windowsHide:true,encoding:'utf8'}),/retry-validated/);
});

for(const fail of [false,true])test(`desktop handoff ${fail?'rolls back on failed health':'finishes on healthy startup'}`,{skip:process.platform!=='win32'},()=>{
 const args=['-NoProfile','-File','tests/desktop-update-fixture.ps1',...(fail?['-FailHealth']:[])];
 assert.match(execFileSync('powershell.exe',args,{cwd:path.resolve('.'),windowsHide:true,encoding:'utf8',timeout:30000}),/PASS fixture/);
});
