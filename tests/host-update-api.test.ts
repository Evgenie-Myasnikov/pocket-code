import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app.js';
import { Jobs } from '../server/jobs.js';

test('host update routes require authentication, validate input and drain only accepted handoffs',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'host-update-api-'));const token='host-test-'.repeat(5);let checks=0,handoffs=0,finished=0;
  const status={supported:true,currentVersion:'0.12.0',targetVersion:'0.13.0',state:'waiting'};
  const hostUpdater:any={draining:false,status:async()=>status,check:async(version:string)=>{assert.equal(version,'0.13.0');checks++;return status;},handoff:(version:string,pid:number)=>{assert.equal(version,'0.13.0');assert.equal(pid,process.pid);handoffs++;hostUpdater.draining=true;},finishHandoff:()=>finished++};
  const result=await createApp({roots:[root],token,hostName:'test',uploads:path.join(root,'uploads'),desktopSessionIndexes:[],hostUpdater},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
  const server=result.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const req=(url:string,body?:any,key=token)=>fetch(base+url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  try{
    assert.equal((await req('/host-update/status',undefined,'wrong')).status,401);
    assert.equal((await req('/host-update/check',{appVersion:'0.13.0'},'wrong')).status,401);assert.equal(checks,0);
    assert.equal((await req('/host-update/check',{appVersion:'../../evil'})).status,400);assert.equal(checks,0);
    assert.deepEqual(await (await req('/host-update/check',{appVersion:'0.13.0'})).json(),status);assert.equal(checks,1);assert.equal(result.isBusy(),false);
    assert.equal((await (await req('/health')).json()).processId,process.pid);
    assert.equal((await req('/host-update/handoff',{targetVersion:'0.13.0',expectedPid:process.pid})).status,200);assert.equal(handoffs,1);assert.equal(finished,1);
    assert.equal((await req('/jobs',{prompt:'blocked'})).status,503);assert.equal(result.isBusy(),false);
    assert.equal((await req('/health')).status,200);
  }finally{result.jobs.close();result.terminals.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});}
});
