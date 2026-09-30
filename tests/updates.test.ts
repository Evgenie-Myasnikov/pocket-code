import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,mkdir} from 'node:fs/promises';
import {createApp} from '../server/app';
import type {AddressInfo} from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {ReleaseUpdater,validateUpdate} from '../server/updates';
const bytes=Buffer.from('Synthetic APK test bytes');
const hash=createHash('sha256').update(bytes).digest('hex');
const manifest={applicationId:'app.pocketcode.mobile',version:'0.9.0',versionCode:9,apk:'Pocket-Code-0.9.0.apk',size:bytes.length,sha256:hash};
const release={id:23,tag_name:'v0.9.0',draft:false,prerelease:false,assets:[{id:1,name:'update.json',size:400,state:'uploaded'},{id:2,name:manifest.apk,size:bytes.length,state:'uploaded',digest:'sha256:'+hash}]};
test('authenticated APK download works from the hidden runtime cache',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-download-')),hidden=path.join(dir,'.pocket-code','updates');await mkdir(hidden,{recursive:true});const apk=path.join(hidden,'verified.apk');await writeFile(apk,bytes);
  const service={latest:async()=>({enabled:true,update:{releaseId:23}}),download:async()=>apk} as any;
  const {app,jobs,terminals,queue}=await createApp({roots:[dir],token:'test-only-'.repeat(5),hostName:'Test PC',uploads:path.join(dir,'uploads'),desktopSessionIndexes:[],updater:service});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/updates/download?release=23`;
  try{assert.equal((await fetch(url)).status,401);const response=await fetch(url,{headers:{Authorization:'Bearer '+'test-only-'.repeat(5)}});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);}
  finally{jobs.close();terminals.close();queue?.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});}
});
test('update manifest rejects mismatches, traversal, drafts and alternate apps',()=>{
  assert.equal(validateUpdate(manifest,release).versionCode,9);
  for(const change of [{apk:'../bad.apk'},{applicationId:'other.app'},{sha256:'0'.repeat(64)},{size:300000000},{versionCode:0}])assert.throws(()=>validateUpdate({...manifest,...change},release));
  assert.throws(()=>validateUpdate(manifest,{...release,draft:true}));
  assert.throws(()=>new ReleaseUpdater('owner/repo --evil','unused'));
});
test('host caches release checks, pins download to checked release and verifies APK hash',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-update-'));
  const service=new ReleaseUpdater('example/pocket-code',dir);let calls=0;
  (service as any).gh=async(args:string[])=>{calls++;if(args[0]==='release'){await writeFile(path.join(args[args.indexOf('--dir')+1],manifest.apk),bytes);return '';}return JSON.stringify(args[1].endsWith('/latest')?release:manifest);};
  try{
    const [a,b]=await Promise.all([service.latest(),service.latest()]);assert.deepEqual(a,b);assert.equal(calls,2);
    await assert.rejects(service.download(24),/release changed/);
    const [first,second]=await Promise.all([service.download(23),service.download(23)]);
    assert.equal(first,second);assert.deepEqual(await readFile(first),bytes);assert.equal(calls,3);
    await service.download(23);assert.equal(calls,3);
  }finally{await rm(dir,{recursive:true,force:true});}
});
