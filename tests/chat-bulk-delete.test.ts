import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {mountChatBulkDelete} from '../server/chat-bulk-delete';
import {ChatLibrary} from '../server/chat-library';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
import {Terminals} from '../server/terminals';

test('bulk deletion snapshots every matching chat, isolates accounts and providers, and rechecks active jobs',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'pocket-bulk-'));
  const library=new ChatLibrary(path.join(root,'library.json')),account=randomUUID();
  const ids:string[]=Array.from({length:173},()=>randomUUID()),other=randomUUID(),foreign=randomUUID(),jobOnly=randomUUID();
  ids[0]='provider-defined-session';
  const chats=[...ids.map(sessionId=>({sessionId,cwd:'project'})),{sessionId:other,cwd:'other'},{sessionId:foreign,cwd:'project',account}];
  const busy=new Set([ids[2]]),app=express();app.set('env','test');app.use(express.json());let personal=true;
  await library.tagAccount(foreign,account,'Synthetic API');
  mountChatBulkDelete(app,library,{
    personal:()=>personal,
    sessions:provider=>library.decorate(provider,provider==='claude'?chats:[{sessionId:ids[0],cwd:'project'}]),
    jobs:provider=>provider==='claude'?[...[...busy].map(sessionId=>({sessionId,cwd:'project',status:'running'})),{sessionId:jobOnly,cwd:'project',status:'done'}]:[],
    accounts:async()=>[{id:account,name:'Synthetic API'}],
  });
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});});
  const api=(body:unknown)=>fetch('http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/chat-library/bulk-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const preview=await(await api({action:'preview',provider:'claude',folder:'project'})).json();
  assert.equal(preview.ids.length,ids.length);assert.ok(preview.ids.includes(jobOnly));assert.deepEqual(preview.running,[ids[2]]);
  assert.ok(!preview.ids.includes(other)&&!preview.ids.includes(foreign));
  busy.add(ids[3]);const newcomer=randomUUID();chats.push({sessionId:newcomer,cwd:'project'});
  const removed=await(await api({action:'delete',provider:'claude',folder:'project',ids:[...preview.ids,other,foreign]})).json();
  assert.deepEqual(removed.running,[ids[3]]);assert.deepEqual(new Set(removed.unavailable),new Set([other,foreign]));
  assert.equal(removed.ids.length,ids.length-1);assert.ok(removed.ids.includes(jobOnly));
  const after=await library.read();
  for(const id of [newcomer,other,foreign,ids[2],ids[3]])assert.ok(!after.chats['claude:'+id]?.deleted);
  assert.ok(!after.chats['codex:'+ids[0]]?.deleted);
  assert.deepEqual((await(await api({action:'preview',provider:'claude',account,folder:'project'})).json()).ids,[foreign]);
  const rest=await(await api({action:'preview',provider:'claude',folder:'project'})).json();assert.deepEqual(rest.ids,[newcomer]);
  personal=false;assert.equal((await api({action:'preview',provider:'claude',folder:'project'})).status,403);
});

test('a Claude session resumed in a terminal is protected during both single and bulk deletion',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'pocket-terminal-chat-')),sessionId=randomUUID(),token='synthetic-token-'.repeat(3);
  let running=false;
  const terminals=Object.assign(new Terminals(),{list:()=>running?[{sessionId,id:randomUUID(),cwd:root,status:'running' as const,startedAt:1,exitCode:undefined,cols:80,rows:25}]:[]});
  let signalHistory!:()=>void,continueHistory!:()=>void;
  const readingHistory=new Promise<void>(resolve=>{signalHistory=resolve;}),gate=new Promise<void>(resolve=>{continueHistory=resolve;});
  const jobs=Object.assign(new Jobs(),{start:(input:Parameters<Jobs['start']>[0])=>({id:input.id,sessionId,status:'done'})});
  const {app,closeTaskServices}=await createApp({roots:[root],uploads:path.join(root,'uploads'),token,hostName:'Synthetic PC',desktopSessionIndexes:[]},jobs,{
    listSessions:async()=>[{sessionId,cwd:root,lastModified:1,summary:'Sample'}],getSessionMessages:async()=>{signalHistory();await gate;return [];},
  },terminals);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{await closeTaskServices();terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});});
  const post=(route:string,body:unknown)=>fetch('http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const endpoint='chat-library/bulk-delete',scope={provider:'claude',folder:root};
  assert.deepEqual((await(await post(endpoint,{action:'preview',...scope})).json()).ids,[sessionId]);
  running=true;
  for(const body of [{action:'preview',...scope},{action:'delete',...scope,ids:[sessionId]}])
    assert.deepEqual(await(await post(endpoint,body)).json(),{ids:[],running:[sessionId],unavailable:[]});
  assert.equal((await post('sessions/'+sessionId+'/manage',{provider:'claude',action:'delete'})).status,409);
  running=false;
  const resume=post('jobs',{provider:'claude',id:randomUUID(),cwd:root,sessionId,text:'Synthetic resume'});
  await readingHistory;
  try{
    assert.deepEqual(await(await post(endpoint,{action:'delete',...scope,ids:[sessionId]})).json(),{ids:[],running:[sessionId],unavailable:[]});
  }finally{continueHistory();}
  assert.equal((await resume).status,200);
  assert.deepEqual((await(await post(endpoint,{action:'delete',...scope,ids:[sessionId]})).json()).ids,[sessionId]);
  assert.equal((await post('jobs',{provider:'claude',id:randomUUID(),cwd:root,sessionId,text:'Removed chat'})).status,404);
});
