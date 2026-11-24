import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';
import {ChatLibrary} from '../server/chat-library.js';

test('the chat list holds chats made in Pocket Code; provider chats join it only with Import chats',async()=>{
  const temporary=await mkdtemp(path.join(os.tmpdir(),'pocket-origins-'));
  const root=path.join(temporary,'project');await mkdir(root);
  const made=randomUUID(),other=randomUUID(),later=randomUUID(),token='o'.repeat(43);
  let rows=[{sessionId:made,summary:'Made here',cwd:root,lastModified:2},{sessionId:other,summary:'From the provider',cwd:root,lastModified:1}];
  const sdk:any={listSessions:async()=>rows,getSessionMessages:async()=>[]};
  const uploads=path.join(temporary,'uploads');
  // A chat Pocket Code ran before: its turn left a mark in the chat library.
  await new ChatLibrary(path.join(uploads,'.chat-library.json')).markOrigins('claude',[made],'pocket');
  const {app}=await createApp({desktopSessionIndexes:[],roots:[root],token,hostName:'Test PC',uploads,sessionListFreshMs:0},new Jobs((()=>{throw new Error('no runs');}) as never),sdk);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const call=async(route:string,body?:unknown)=>(await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})).json();
  const listed=async()=>(await call('/sessions?provider=claude') as {sessionId:string}[]).map(chat=>chat.sessionId).sort();
  try{
    assert.deepEqual(await listed(),[made]);
    const result=await call('/chat-library/import',{providers:['claude']});
    assert.deepEqual(result.claude,{imported:1,total:2});
    assert.deepEqual(await listed(),[made,other].sort());
    // A chat created in the provider after the import waits for the next import.
    rows=[...rows,{sessionId:later,summary:'Newer provider chat',cwd:root,lastModified:3}];
    assert.deepEqual(await listed(),[made,other].sort());
    // Importing again keeps a chat made in Pocket Code marked as made here.
    await call('/chat-library/import',{});
    const library=await new ChatLibrary(path.join(uploads,'.chat-library.json')).read();
    assert.equal(library.chats['claude:'+made].origin,'pocket');assert.equal(library.chats['claude:'+later].origin,'imported');
    assert.deepEqual(await listed(),[made,other,later].sort());
    // Sizes for the turn result list stay inside the chat's folder.
    await mkdir(path.join(root,'docs'));await writeFile(path.join(root,'docs','plan.md'),'x'.repeat(2048));await writeFile(path.join(temporary,'outside.txt'),'secret');
    const sizes=(await call('/file-sizes',{cwd:root,paths:['docs/plan.md','docs/missing.md','../outside.txt',path.join(temporary,'outside.txt')]})).sizes;
    assert.deepEqual(sizes,{'docs/plan.md':2048,'docs/missing.md':null,'../outside.txt':null,[path.join(temporary,'outside.txt')]:null});
  }finally{server.close();await rm(temporary,{recursive:true,force:true});}
});
