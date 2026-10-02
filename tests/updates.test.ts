import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,mkdir} from 'node:fs/promises';
import {createApp} from '../server/app';
import type {AddressInfo} from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {ReleaseUpdater,validateUpdate} from '../server/updates';
import {latestPublishedUpdate} from '../src/release-update';
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
test('APK transfer reserves the runtime until the response completes',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-transfer-')),apk=path.join(dir,'verified.apk');await writeFile(apk,bytes);
 let finish!:()=>void,started!:()=>void;const entered=new Promise<void>(resolve=>{started=resolve;});const waiting=new Promise<void>(resolve=>{finish=resolve;});
 const service={download:async()=>{started();await waiting;return apk;}} as any;
 const {app,jobs,terminals,queue}=await createApp({roots:[dir],token:'test-only-'.repeat(5),hostName:'Fixture',uploads:path.join(dir,'uploads'),desktopSessionIndexes:[],updater:service,runtime:{internet:()=>false,stop:()=>{}}});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`,headers={Authorization:'Bearer '+'test-only-'.repeat(5)};
 try{const download=fetch(url+'/updates/download?release=23',{headers});await entered;assert.equal((await fetch(url+'/runtime/stop',{method:'POST',headers})).status,409);finish();assert.deepEqual(Buffer.from(await(await download).arrayBuffer()),bytes);assert.equal((await fetch(url+'/runtime/stop',{method:'POST',headers})).status,200);}finally{finish();jobs.close();terminals.close();queue?.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});}
});
test('host caches release checks, pins download to checked release and verifies APK hash',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-update-'));
  const service=new ReleaseUpdater('example/pocket-code',dir);let calls=0;
  (service as any).publicGet=async(url:string)=>{calls++;return url.endsWith('.apk')?bytes:Buffer.from(JSON.stringify(url.endsWith('/latest')?release:manifest));};
  try{
    const [a,b]=await Promise.all([service.latest(),service.latest()]);assert.deepEqual(a,b);assert.equal(calls,2);
    await assert.rejects(service.download(24),/release changed/);
    const [first,second]=await Promise.all([service.download(23),service.download(23)]);
    assert.equal(first,second);assert.deepEqual(await readFile(first),bytes);assert.equal(calls,3);
    await service.download(23);assert.equal(calls,3);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('PC preparation coalesces work and mobile status reads never contact GitHub',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-pc-update-'));const service=new ReleaseUpdater('example/pocket-code',dir);let calls=0;
 (service as any).publicGet=async(url:string)=>{calls++;return url.endsWith('.apk')?bytes:Buffer.from(JSON.stringify(url.endsWith('/latest')?release:manifest));};
 try{assert.equal(service.status().state,'idle');assert.equal(calls,0);await Promise.all([service.prepare(),service.prepare()]);assert.equal(calls,3);assert.equal(service.status().state,'ready');assert.equal(service.status().update?.sha256,hash);for(let i=0;i<10;i++)service.status();assert.equal(calls,3);assert.deepEqual(await readFile(await service.download(23)),bytes);assert.equal(calls,3);service.close();await service.prepare(true);assert.equal(calls,3);}finally{service.close();await rm(dir,{recursive:true,force:true});}
});
test('phones without a PC read only the latest published release manifest',async()=>{
  const latest='https://api.github.com/repos/Evgenie-Myasnikov/pocket-code/releases/latest',file='https://github.com/Evgenie-Myasnikov/pocket-code/releases/download/v0.9.0/update.json';
  const urls:string[]=[];const get=(answers:Record<string,unknown>)=>async(url:string)=>{urls.push(url);if(!(url in answers))throw Error('Unexpected request');return answers[url];};
  assert.equal((await latestPublishedUpdate(get({[latest]:release,[file]:manifest}))).versionCode,9);
  assert.deepEqual(urls,[latest,file]);
  await assert.rejects(latestPublishedUpdate(get({[latest]:{...release,tag_name:'v0.9.0/../other'}})));
  await assert.rejects(latestPublishedUpdate(get({[latest]:{...release,assets:release.assets.filter(asset=>asset.name!=='update.json')}})));
  await assert.rejects(latestPublishedUpdate(get({[latest]:release,[file]:{...manifest,sha256:'0'.repeat(64)}})));
  await assert.rejects(latestPublishedUpdate(get({[latest]:{...release,prerelease:true},[file]:manifest})));
});
