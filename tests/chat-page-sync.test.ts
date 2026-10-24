import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChatPageSync} from '../server/chat-page-sync.js';
import {mergeHistoryDelta} from '../src/chat-history-cache.js';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';
const message=(id:string,text=id)=>({id,role:'assistant' as const,blocks:[{type:'text' as const,text}]});
test('history revisions transmit edits and additions and preserve removals and order',()=>{
 const sync=new ChatPageSync(),original={messages:[message('a'),message('b')],previous:null,total:2};
 const first=sync.respond('authorized-page',original);
 const unchanged=sync.respond('authorized-page',original,first.revision);
 assert.equal(unchanged.unchanged,true);assert.deepEqual(unchanged.messages,[]);
 assert.deepEqual(mergeHistoryDelta(first,unchanged)?.messages,original.messages);
 const next={messages:[message('c'),message('b','edited')],previous:null,total:2};
 const delta=sync.respond('authorized-page',next,first.revision);
 assert.equal(delta.delta,true);assert.equal(delta.messages.length,2);
 assert.deepEqual(mergeHistoryDelta(first,delta)?.messages,next.messages);
 const removed=sync.respond('authorized-page',{messages:[message('b','edited')]},delta.revision);
 assert.equal(removed.messages.length,0);assert.deepEqual(mergeHistoryDelta(next,removed)?.messages,[message('b','edited')]);
 assert.equal(sync.respond('another-page',next,first.revision).delta,undefined);
 assert.equal(new ChatPageSync().respond('authorized-page',next,first.revision).delta,undefined);
 assert.equal(mergeHistoryDelta(undefined,delta),undefined);
});

test('history HTTP revisions remain behind authentication and project access checks',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'history-sync-')),id=randomUUID(),token='s'.repeat(43);
 const sdk:any={listSessions:async()=>[{sessionId:id,summary:'Synthetic history',cwd:root,lastModified:1}],getSessionMessages:async()=>[{type:'assistant',uuid:'reply',message:{content:[{type:'text',text:'Saved answer'}]}}]};
 const jobs=new Jobs((()=>{throw Error('no runs');}) as any),{app,closeTaskServices}=await createApp({desktopSessionIndexes:[],roots:[root],token,hostName:'Synthetic host',uploads:path.join(root,'uploads')},jobs,sdk);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/sessions/${id}/messages?provider=claude&window=100`,headers={authorization:`Bearer ${token}`};
 try{
  const first=await (await fetch(url,{headers})).json() as any;assert.equal(first.messages.length,1);assert.match(first.revision,/^[a-f0-9]{64}$/);
  const next=await (await fetch(url+'&known='+first.revision,{headers})).json() as any;assert.equal(next.unchanged,true);assert.deepEqual(next.messages,[]);
  assert.equal((await fetch(url+'&known='+first.revision)).status,401);
  assert.equal((await fetch(url+'&known=invalid',{headers})).status,400);
 }finally{jobs.close();await new Promise<void>(r=>server.close(()=>r()));await closeTaskServices?.();await rm(root,{recursive:true,force:true});}
});
