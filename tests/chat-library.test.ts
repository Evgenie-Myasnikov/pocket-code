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
