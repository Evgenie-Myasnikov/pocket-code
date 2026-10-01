import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
test('Copilot API isolates history, routes jobs and exposes the shared Jira task provider',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'copilot-api-')),sid=randomUUID(),runs=new Map<string,any>();
 const engine:any={status:async()=>({available:true,authenticated:true,models:[]}),sessions:async()=>[{sessionId:sid,cwd:root,provider:'copilot',summary:'Fixture',lastModified:1}],messages:async()=>[{id:'x',role:'assistant',blocks:[{type:'text',text:'Copilot history'}]}],list:()=>[...runs.values()],get:(id:string)=>runs.get(id),view:(j:any)=>j,start:(input:any)=>{const job={...input,provider:'copilot',status:'running',messages:[],approvals:[],partial:'',revision:1,startedAt:Date.now()};runs.set(input.id,job);return job;},stop:(id:string)=>{runs.get(id).status='stopped';},loginStatus:()=>({state:'idle',error:''}),login:async()=>({state:'connected',error:''})};
 const token='t'.repeat(43),runtime=await createApp({roots:[root],uploads:path.join(root,'uploads'),token,hostName:'Fixture',desktopSessionIndexes:[],copilot:engine},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=runtime.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${(server.address() as any).port}/api`,request=(endpoint:string,body?:unknown)=>fetch(base+endpoint,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  const providers=await(await request('/providers')).json();assert.equal(providers.find((p:any)=>p.id==='copilot').authenticated,true);
  assert.equal((await(await request('/sessions?provider=copilot')).json())[0].sessionId,sid);assert.deepEqual(await(await request('/sessions')).json(),[]);
  assert.equal((await(await request(`/sessions/${sid}/messages?provider=copilot&window=20`)).json()).messages[0].blocks[0].text,'Copilot history');
  const id=randomUUID();assert.equal((await request('/jobs',{id,provider:'copilot',cwd:root,text:'Test',model:'auto'})).status,200);assert.equal((await(await request('/jobs?provider=copilot')).json()).length,1);
  assert.equal((await(await request('/activity')).json())[0].provider,'copilot');assert.equal((await request(`/jobs/${id}/stop`,{})).status,200);assert.equal(runs.get(id).status,'stopped');
  assert.equal((await(await request('/copilot/login',{})).json()).state,'connected');
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
