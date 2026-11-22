import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ChatLibrary} from '../server/chat-library.js';

test('chat library serializes edits, persists names/removal and isolates providers',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'chat-library-')),file=path.join(dir,'library.json');
 try {
  const library=new ChatLibrary(file);
  await Promise.all([library.edit(d=>{d.chats['codex:one']={title:'Renamed'};}),library.edit(d=>{d.chats['claude:one']={deleted:true};}),library.edit(d=>{d.projects.push('synthetic-project');})]);
  const reopened=new ChatLibrary(file);
  assert.deepEqual(await reopened.decorate('codex',[{sessionId:'one'}]),[{sessionId:'one',customTitle:'Renamed'}]);
  assert.deepEqual(await reopened.decorate('claude',[{sessionId:'one'}]),[]);
  assert.deepEqual((await reopened.read()).projects,['synthetic-project']);
  await writeFile(file,'broken');
  await assert.rejects(reopened.edit(d=>{d.chats={};}));
 }finally{assert.equal(path.dirname(dir),os.tmpdir());await rm(dir,{recursive:true,force:true});}
});

test('a pending tombstone prevents a resume before commit and releases its reservation after an I/O failure',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'chat-admission-'));
 try{
  const library=new ChatLibrary(path.join(dir,'library.json')),original=library.edit.bind(library);
  let began!:()=>void,abort!:()=>void;
  const writing=new Promise<void>(resolve=>{began=resolve;}),io=new Promise<void>(resolve=>{abort=resolve;});
  library.edit=async change=>{change(await library.read());began();await io;throw Error('Synthetic write failure');};
  const removal=library.deleteChats('codex',(_data,remove)=>{assert.ok(remove('same'));});
  await writing;
  try{
   await assert.rejects(library.resume('codex','same',async()=>assert.fail('deleted chat resumed')),/being removed/);
   assert.equal(await library.resume('claude','same',async()=>1),1);
  }finally{abort();}
  await assert.rejects(removal,/Synthetic write failure/);
  library.edit=original;
  assert.equal(await library.resume('codex','same',async()=>2),2);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a failed cache purge resumes after restart without repeating an acknowledged native erasure',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'chat-purge-')),file=path.join(dir,'library.json');
 try{
  const scope={cwd:dir},key='copilot:named-session';let removed=0;
  const first=new ChatLibrary(file);
  const status=await first.eraseOriginal('copilot','named-session',scope,()=>true,async()=>{removed++;},async()=>{throw Error('Synthetic cache write failure');});
  assert.equal(status,'failed');assert.equal((await first.read()).chats[key].originalRemoval?.status,'erased');
  const next=new ChatLibrary(file);
  assert.equal(await next.eraseOriginal('copilot','named-session',scope,()=>true,async()=>{removed++;},async()=>{}),'ids');
  assert.equal(removed,1);assert.equal((await next.read()).chats[key].originalRemoval?.status,'done');
 }finally{await rm(dir,{recursive:true,force:true});}
});
