import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app';import {Jobs} from '../server/jobs';import {JiraConnection} from '../server/jira-connection';
import {request as httpRequest} from 'node:http';
test('PC setup key is scoped to local Jira setup; choosing Jira does not depend on task provider',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'pocket-pc-setup-')),jobs=new Jobs();const key='setup-only-'.repeat(4),token='phone-only-'.repeat(4);
 const service=(source:string)=>({status:async()=>({connected:true,sites:[],source}),useExisting:async()=>({connected:true,sites:[],source})}) as any;
 const connection=new JiraConnection(path.join(root,'choice.json'),{claude:service('claude'),codex:service('codex')});await connection.ready;
 const runtime=await createApp({roots:[root],token,hostName:'Fixture',uploads:path.join(root,'uploads'),desktopSessionIndexes:[],jira:connection.service,jiraForProvider:()=>connection.service,pcJira:{key,connection,login:{status:()=>({state:'idle'}),start:async()=>({state:'waiting'})} as any}},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=runtime.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 const headers={Authorization:'Bearer '+key,'Content-Type':'application/json'};
 try{
  assert.equal((await fetch(url+'/api/jira/pc-login')).status,401);
  assert.equal((await fetch(url+'/api/health',{headers})).status,401);
  const remoteHostStatus=await new Promise<number|undefined>((resolve,reject)=>{const req=httpRequest(url+'/api/jira/pc-login',{headers:{...headers,Host:'public.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(remoteHostStatus,403);
  assert.equal((await fetch(url+'/api/jira/pc-login',{headers})).status,200);
  assert.equal((await fetch(url+'/api/jira/pc-source',{method:'POST',headers,body:JSON.stringify({source:'codex'})})).status,200);
  const state=await(await fetch(url+'/api/jira/status?provider=claude',{headers:{Authorization:'Bearer '+token}})).json();assert.equal(state.source,'codex');
  assert.equal((await fetch(url+'/setup/jira')).headers.get('referrer-policy'),'no-referrer');
 }finally{await runtime.queue?.close();await runtime.codexQueue?.close();jobs.close();runtime.terminals.close();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});}
});
