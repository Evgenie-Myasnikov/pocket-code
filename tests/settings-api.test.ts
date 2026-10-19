import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
import {ProviderConnections} from '../server/provider-connections';

test('an out-of-range spend limit is named as a settings problem, not a malformed request',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-budget-'));
  const jobs=new Jobs((()=>(async function*(){})()) as any);
  const token='fixture-token-'.repeat(4);
  const {app}=await createApp({roots:[root],token,hostName:'Fixture',uploads:path.join(root,'uploads'),desktopSessionIndexes:[]},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try{
    for(const maxBudgetUsd of [0,150]){
      const response=await fetch(url+'/jobs',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),provider:'claude',cwd:root,text:'Synthetic',mode:'default',maxBudgetUsd})});
      assert.equal(response.status,400);const body=await response.json();
      assert.equal(body.code,'budget_out_of_range');assert.match(body.error,/0\.10–\$100/);
    }
  }finally{server.close();await rm(root,{recursive:true,force:true});}
});
test('cancelling a sign-in without an open window keeps the current state',async()=>{
  const service=new ProviderConnections({},()=>false,async()=>{});
  assert.deepEqual(await service.cancel('codex'),{state:'idle'});
  await assert.rejects(service.cancel('other' as any),/Unknown provider/);
});
