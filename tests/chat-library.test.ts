import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
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
  // A damaged library (an interrupted write leaves zero bytes) must not switch chats off: the previous copy answers and the damaged file is kept.
  await writeFile(file,'\0'.repeat(64));
  assert.deepEqual(await reopened.decorate('codex',[{sessionId:'one'}]),[{sessionId:'one',customTitle:'Renamed'}]);
  assert.deepEqual(await reopened.decorate('claude',[{sessionId:'one'}]),[]);
  await reopened.edit(d=>{d.projects.push('after-recovery');});
  assert.deepEqual((await new ChatLibrary(file).read()).projects,['after-recovery']);
  assert.ok((await readdir(dir)).some(name=>name.startsWith('library.json.corrupt-')),'the damaged copy is kept beside the library');
  // Without a backup the library starts empty instead of failing every chat request.
  const lone=path.join(dir,'lone.json');await writeFile(lone,'broken');
  assert.deepEqual(await new ChatLibrary(lone).read(),{chats:{},projects:[]});
  await new ChatLibrary(lone).edit(d=>{d.chats['codex:two']={title:'Kept'};});
  assert.equal((await new ChatLibrary(lone).read()).chats['codex:two'].title,'Kept');
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
