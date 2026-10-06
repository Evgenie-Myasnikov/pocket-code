import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {Jobs} from '../server/jobs';import {createApp} from '../server/app';import {waitFor} from './wait-for';
test('Claude access survives API validation into SDK options, preserves planning and retains the question callback in full access',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pocket-access-'));const captured:any[]=[];
 const jobs=new Jobs((({options}:any)=>{captured.push(options);return (async function*(){yield {type:'result',subtype:'success',is_error:false,total_cost_usd:0};})();}) as any);
 const token='x'.repeat(43),sdk:any={listSessions:async()=>[],getSessionMessages:async()=>[]};
 const {app}=await createApp({desktopSessionIndexes:[],roots:[root],token,hostName:'Synthetic',uploads:path.join(root,'uploads')},jobs,sdk);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const endpoint=`http://127.0.0.1:${(server.address() as any).port}/api/jobs`;
 const send=(body:any)=>fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({provider:'claude',id:randomUUID(),cwd:root,text:'Synthetic task',...body})});
 try{
  for(const claudeAccess of ['default','acceptEdits','bypassPermissions']){
   const response=await send({claudeAccess});assert.equal(response.status,200);const job=await response.json();await waitFor(()=>jobs.get(job.id).status!=='running');
   assert.equal(captured.at(-1).permissionMode,claudeAccess);assert.equal(captured.at(-1).allowDangerouslySkipPermissions,claudeAccess==='bypassPermissions');assert.equal(typeof captured.at(-1).canUseTool,'function');
  }
  const response=await send({claudeAccess:'bypassPermissions',mode:'plan'});assert.equal(response.status,200);const job=await response.json();await waitFor(()=>jobs.get(job.id).status!=='running');assert.equal(captured.at(-1).permissionMode,'plan');assert.equal(captured.at(-1).allowDangerouslySkipPermissions,false);
  assert.equal((await send({claudeAccess:'invalid'})).status,400);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});}
});
