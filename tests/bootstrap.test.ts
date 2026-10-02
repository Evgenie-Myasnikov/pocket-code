import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),bootstrap=fileURLToPath(new URL('../scripts/bootstrap.ps1',import.meta.url));
const quote=(value:string)=>"'"+value.replace(/'/g,"''")+"'";
async function check(body:string){const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-bootstrap-'));try{const file=path.join(dir,'check.ps1');await writeFile(file,`$ErrorActionPreference='Stop'\n. ${quote(bootstrap)}\n$fixture=${quote(dir)}\n${body}`);return await run('powershell.exe',['-NoProfile','-NonInteractive','-File',file],{windowsHide:true,timeout:45000});}finally{await rm(dir,{recursive:true,force:true});}}
const windows={skip:process.platform!=='win32'};
test('bootstrap rejects outdated runtimes and untrusted download metadata',windows,async()=>{
 await check(`foreach($v in @('v18.20.0','v22.1.0','v23.11.1','nonsense')){if(Test-PocketNodeVersion $v){throw 'Accepted unsupported version'}}
 foreach($v in @('v22.12.0','v24.19.0','v26.0.0')){if(-not(Test-PocketNodeVersion $v)){throw 'Rejected supported version'}}
 $metadata=Get-PocketNodeArchive (('a'*64)+'  node-v24.19.0-win-x64.zip');if($metadata.Name -ne 'node-v24.19.0-win-x64.zip'){throw 'Metadata mismatch'}
 $rejected=$false;try{Get-PocketNodeArchive (('a'*64)+'  ../../other.zip')}catch{$rejected=$true};if(-not $rejected){throw 'Unsafe download allowed'}
 $archive=Join-Path $fixture 'bad.zip';Set-Content -LiteralPath $archive -Value 'corrupted'
 $rejected=$false;try{Install-PocketNodeArchive $archive ('a'*64) 'node-v24.19.0-win-x64.zip' $fixture}catch{$rejected=$_.Exception.Message -match 'checksum'};if(-not $rejected){throw 'Hash mismatch did not fail closed'}`);
});
test('bootstrap finds installed Node even when the inherited PATH is stale',windows,async()=>{
 const result=await check(`$env:Path=Join-Path $env:WINDIR 'System32';$node=Find-PocketNode (Join-Path $env:LOCALAPPDATA 'Pocket Code/runtime/node');if(-not $node){throw 'Installed runtime was not rediscovered'};if(-not(Test-PocketNode $node)){throw 'Found an invalid runtime'};Write-Output 'rediscovered'`);assert.match(result.stdout,/rediscovered/);
});
test('clean setup installs dev dependencies before build and healthy retries reuse them',windows,async()=>{
 const result=await check(`$bin=Join-Path $fixture 'bin';New-Item -ItemType Directory -Path $bin|Out-Null
 $npm=Join-Path $bin 'npm.cmd';@'
@echo off
if "%1"=="ls" exit /b 0
if not "%1"=="ci" exit /b 7
echo %*>>args.txt
mkdir node_modules\\.bin
mkdir node_modules\\tsx
echo synthetic>node_modules\\.bin\\tsc.cmd
echo synthetic>node_modules\\.bin\\vite.cmd
echo {}>node_modules\\tsx\\package.json
echo installed>>installs.txt
exit /b 0
'@ | Set-Content -LiteralPath $npm -Encoding ASCII
 function Ensure-PocketNode { return Join-Path $bin 'node.exe' }
 Ensure-PocketDependencies $fixture;Ensure-PocketDependencies $fixture
 if(@(Get-Content -LiteralPath (Join-Path $fixture 'installs.txt')).Count -ne 1){throw 'Dependencies reinstalled on retry'}
 if((Get-Content -LiteralPath (Join-Path $fixture 'args.txt') -Raw) -notmatch '--include=dev'){throw 'Build dependencies were omitted'}
 Write-Output 'installed once'`);assert.match(result.stdout,/installed once/);
});
