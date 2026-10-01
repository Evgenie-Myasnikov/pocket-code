import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import type {AddressInfo} from 'node:net';import {createApp} from '../server/app';import {Jobs} from '../server/jobs';
test('Jira reads, workflow and disconnect stay with the explicitly selected provider',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pocket-jira-routing-')),jobs=new Jobs(),calls:string[]=[];
 const service=(provider:string)=>({status:async()=>({connected:true,sites:[],source:provider}),useExisting:async()=>({connected:true,sites:[],source:provider}),disconnect:async()=>{calls.push(provider+':disconnect')},issue:async()=>{calls.push(provider+':issue');return{key:'DEMO-1',summary:provider,status:'Open'}},issues:async()=>{calls.push(provider+':list');return{issues:[],next:null}},transitions:async()=>[],transition:async()=>{}} as any);
 const claude=service('claude'),codex=service('codex'),token='synthetic-token-'.repeat(3);
 const {app,terminals,queue,codexQueue}=await createApp({roots:[root],token,hostName:'Fixture',uploads:path.join(root,'uploads'),desktopSessionIndexes:[],jira:claude,jiraForProvider:p=>p==='codex'?codex:claude},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 try{
  const state=await(await fetch(url+'/jira/status?provider=codex',{headers})).json();assert.equal(state.source,'codex');
  await fetch(url+'/jira/issues?site=site&provider=codex',{headers});
  await fetch(url+'/jira/issue?site=site&key=DEMO-1&provider=codex',{headers});
  const flow=await fetch(url+'/jira/workflow?site=site&key=DEMO-1&provider=codex&role=developer',{headers});assert.equal(flow.status,200);
  await fetch(url+'/jira/disconnect',{method:'POST',headers,body:JSON.stringify({provider:'codex'})});
  assert.deepEqual(calls,['codex:list','codex:issue','codex:issue','codex:disconnect']);
  assert.equal((await fetch(url+'/jira/status?provider=unknown',{headers})).status,400);
 }finally{await queue?.close();await codexQueue?.close();jobs.close();terminals.close();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});}
});
