import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ChatLibrary,type BoardLink} from '../server/chat-library';

test('chat library returns recorded board links before links derived from board notes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'chat-board-links-'));
 try{
  const library=new ChatLibrary(path.join(dir,'chats.json'));
  const recorded:BoardLink={id:'board-a',root:'C:/synthetic/project',title:'Synthetic board',kind:'discussion'};
  await library.edit(data=>{data.chats['codex:one']={board:recorded};data.chats['codex:gone']={deleted:true};});
  const derived=new Map<string,BoardLink>([['codex:one',{id:'board-b',root:'C:/synthetic/project',title:'Other',noteId:'n1',kind:'note'}],['codex:two',{id:'board-b',root:'C:/synthetic/project',title:'Synthetic note',noteId:'n2',kind:'note'}]]);
  const sessions=await library.decorate('codex',[{sessionId:'one'},{sessionId:'two'},{sessionId:'three'},{sessionId:'gone'}],derived);
  assert.deepEqual(sessions.map(s=>s.sessionId),['one','two','three']);
  assert.deepEqual((sessions[0] as {board?:BoardLink}).board,recorded);
  assert.equal((sessions[1] as {board?:BoardLink}).board?.noteId,'n2');
  assert.equal((sessions[2] as {board?:BoardLink}).board,undefined);
 }finally{await rm(dir,{recursive:true,force:true});}
});
