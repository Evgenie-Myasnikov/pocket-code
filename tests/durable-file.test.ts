import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {readGuarded,writeDurable} from '../server/durable-file.js';
import {DeviceRegistry} from '../server/devices.js';
import {MarkdownChains} from '../server/markdown-chains.js';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';

const store=(value:unknown)=>!!value&&typeof value==='object'&&Array.isArray((value as {items?:unknown}).items);
// What an interrupted write leaves on Windows after a power loss: the right length, every byte zero.
const zeros=(length=512)=>'\0'.repeat(length);

test('a durable write replaces the file, keeps the previous content as a backup and leaves no temporary file',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-durable-')),file=path.join(dir,'store.json');
  try{
    await writeDurable(file,'{"items":[1]}',{backup:true});
    assert.deepEqual(await readdir(dir),['store.json'],'the first write has nothing to back up');
    await writeDurable(file,'{"items":[1,2]}',{backup:true});
    assert.equal(await readFile(file,'utf8'),'{"items":[1,2]}');
    assert.equal(await readFile(file+'.bak','utf8'),'{"items":[1]}');
    assert.deepEqual((await readdir(dir)).sort(),['store.json','store.json.bak']);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a guarded read treats a missing file as empty, continues a damaged one from its backup and keeps the damaged copy',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-guarded-')),file=path.join(dir,'store.json');
  try{
    assert.deepEqual(await readGuarded(file,store),{value:undefined});
    await writeDurable(file,'{"items":["first"]}',{backup:true});await writeDurable(file,'{"items":["first","second"]}',{backup:true});
    assert.deepEqual(await readGuarded(file,store),{value:{items:['first','second']}});
    await writeFile(file,zeros());
    assert.deepEqual(await readGuarded(file,store),{value:{items:['first']},recovered:'backup'});
    assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{items:['first']},'the store is readable again without another recovery');
    assert.deepEqual(await readGuarded(file,store),{value:{items:['first']}});
    assert.equal((await readdir(dir)).filter(name=>name.startsWith('store.json.corrupt-')).length,1);
    // Readable JSON of another shape is damage too, and without a usable backup the store starts empty.
    await writeFile(file,'{"items":"not a list"}');await writeFile(file+'.bak','broken');
    assert.deepEqual(await readGuarded(file,store),{value:undefined,recovered:'reset'});
    assert.deepEqual(await readGuarded(file,store),{value:undefined},'the damaged file no longer stands in the way');
    // A byte order mark written by another program is not damage.
    await writeFile(file,'﻿{"items":[]}');
    assert.deepEqual(await readGuarded(file,store),{value:{items:[]}});
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a zero-filled device registry does not stop the host from starting and never restores an older device list',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-devices-damaged-')),file=path.join(dir,'devices.json');
  try{
    const registry=await new DeviceRegistry(file).load();
    const paired=await registry.pair(registry.pairingToken,{name:'Test phone',platform:'android',version:'1'});
    await registry.revoke(paired.deviceId);
    await writeFile(file,zeros());
    const restarted=await new DeviceRegistry(file).load();
    assert.deepEqual(restarted.list(),[],'a damaged registry starts without devices');
    assert.equal(restarted.authenticate(paired.token),undefined,'a disconnected device cannot return through a backup');
    assert.ok((await readdir(dir)).some(name=>name.startsWith('devices.json.corrupt-')));
    assert.ok(!(await readdir(dir)).includes('devices.json.bak'));
    const again=await restarted.pair(restarted.pairingToken,{name:'Test phone',platform:'android',version:'1'});
    assert.equal((await new DeviceRegistry(file).load()).authenticate(again.token),again.deviceId);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('one damaged task record is set aside while the other tasks load, and a failed restore is tried again',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-chain-damaged-')),id=randomUUID(),damaged=randomUUID();
  const options={file:dir,intervalMs:3600000,view:()=>undefined,stop:()=>{},start:async()=>{throw Error('not started');}};
  const first=new MarkdownChains(options);
  try{
    await first.create({id,name:'Guide',cwd:'project',provider:'codex',context:'',tasks:[{title:'First',source:'first.md',body:'Outline the guide.'}]});
    await first.close();
    await writeFile(path.join(dir,damaged+'.json'),zeros());
    const restarted=new MarkdownChains(options);
    try{
      await restarted.init();
      assert.deepEqual((await restarted.list({cwd:'project',provider:'codex'})).map(chain=>chain.id),[id]);
      const names=await readdir(dir);
      assert.ok(names.some(name=>name.startsWith(damaged+'.json.corrupt-')));assert.ok(!names.includes(damaged+'.json'));
    }finally{await restarted.close();}
    // A storage folder that cannot be read fails one request, not every request until the host restarts.
    const blocked=path.join(dir,'blocked');await writeFile(blocked,'not a folder');
    const retried=new MarkdownChains({...options,file:blocked});
    try{
      await assert.rejects(retried.init());
      await rm(blocked);await mkdir(blocked);
      await retried.init();
      assert.deepEqual(await retried.list({cwd:'project',provider:'codex'}),[]);
    }finally{await retried.close();}
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('chat lists and runs keep answering when the chat library on disk is damaged',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'pocket-library-damaged-')),root=path.join(temp,'root'),uploads=path.join(temp,'uploads');
  await mkdir(root);await mkdir(uploads);await writeFile(path.join(uploads,'.chat-library.json'),zeros(1120));
  const id='00000000-0000-4000-8000-000000000001',token='synthetic-damaged-library-token-000000000000';
  const sdk:any={listSessions:async()=>[{sessionId:id,summary:'Fixture',cwd:root,lastModified:1}],getSessionMessages:async()=>[{uuid:'message',type:'user',message:{content:'Fixture'}}]};
  const jobs=new Jobs();
  const {app}=await createApp({roots:[root],token,uploads,hostName:'Fixture',listAllProviderChats:true,desktopSessionIndexes:[]},jobs,sdk);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{jobs.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(temp,{recursive:true,force:true});});
  const get=(route:string)=>fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api${route}`,{headers:{Authorization:`Bearer ${token}`}});
  const [list,runs,history]=await Promise.all([get('/sessions?provider=claude'),get('/jobs?provider=claude'),get(`/sessions/${id}/messages?provider=claude&window=50`)]);
  assert.deepEqual([list.status,runs.status,history.status],[200,200,200]);
  assert.deepEqual((await list.json()).map((chat:{sessionId:string})=>chat.sessionId),[id]);
  assert.ok((await readdir(uploads)).some(name=>name.startsWith('.chat-library.json.corrupt-')),'the damaged library is kept for inspection');
});
