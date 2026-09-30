import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type {AddressInfo} from 'node:net';
import {createApp,type Config} from '../server/app.js';
import {Jobs} from '../server/jobs.js';

async function fixture(extra:Partial<Config>={}){
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-runtime-api-')),token='synthetic-runtime-key-'.repeat(3);
  const result=await createApp({roots:[root],token,hostName:'Synthetic computer',uploads:path.join(root,'uploads'),desktopSessionIndexes:[],...extra},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
  const server=result.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return {...result,root,req:(url:string,body?:unknown,key=token)=>fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),
    close:async()=>{result.jobs.close();result.terminals.close();await result.queue?.close();await result.codexQueue?.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}};
}
test('runtime identity and stop require authentication and expose no local paths or key',async()=>{
  let stops=0;const f=await fixture({runtime:{internet:()=>true,stop:()=>{stops++;}}});
  try{
    assert.equal((await f.req('/runtime',undefined,'wrong')).status,401);
    assert.equal((await f.req('/runtime/stop',{},'wrong')).status,401);assert.equal(stops,0);
    const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
    assert.deepEqual(await(await f.req('/runtime')).json(),{applicationId:'app.pocketcode.host',processId:process.pid,version:pkg.version,busy:false,internet:true});
    assert.equal(f.isBusy(),false);
  }finally{await f.close();}
});
test('runtime stop refuses active Claude, Codex or terminal work and an update handoff',async()=>{
  let stops=0,codexBusy=false;const hostUpdater:any={draining:false},codex:any={list:()=>codexBusy?[{status:'running'}]:[]};
  const f=await fixture({codex,hostUpdater,runtime:{internet:()=>false,stop:()=>{stops++;}}});
  const jobsList=f.jobs.list.bind(f.jobs),terminalsList=f.terminals.list.bind(f.terminals);
  try{
    for(const kind of ['claude','codex','terminal']){
      f.jobs.list=()=>kind==='claude'?[{status:'running'} as any]:[];codexBusy=kind==='codex';f.terminals.list=()=>kind==='terminal'?[{status:'running'} as any]:[];
      assert.equal((await(await f.req('/runtime')).json()).busy,true,kind);
      assert.equal((await f.req('/runtime/stop',{})).status,409,kind);assert.equal(stops,0);
    }
    f.jobs.list=jobsList;f.terminals.list=terminalsList;codexBusy=false;hostUpdater.draining=true;
    assert.equal((await f.req('/runtime/stop',{})).status,409);assert.equal(stops,0);
    assert.equal((await f.req('/runtime')).status,200);
  }finally{f.jobs.list=jobsList;f.terminals.list=terminalsList;await f.close();}
});
test('runtime stop waits for mutation completion, then rejects new writes and calls shutdown once',async()=>{
  let stops=0,release!:()=>void,entered!:()=>void;
  const work=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
  const f=await fixture({runtime:{internet:()=>false,stop:async()=>{stops++;}}});
  f.app.post('/api/test-runtime-mutation',async(_req,res)=>{entered();await work;res.json({done:true});});
  try{
    const mutation=f.req('/test-runtime-mutation',{});await started;
    assert.equal((await(await f.req('/runtime')).json()).busy,true);
    assert.equal((await f.req('/runtime/stop',{})).status,409);assert.equal(stops,0);
    release();assert.equal((await mutation).status,200);assert.equal(f.isBusy(),false);
    const replies=await Promise.all([f.req('/runtime/stop',{}),f.req('/runtime/stop',{})]);
    for(const reply of replies){assert.equal(reply.status,200);assert.deepEqual(await reply.json(),{accepted:true});}
    assert.equal(stops,1);assert.equal(f.isBusy(),false);
    assert.equal((await f.req('/jobs',{prompt:'must not start'})).status,503);
    assert.equal((await f.req('/host-update/check',{appVersion:'99.0.0'})).status,503);
    assert.equal((await f.req('/host-update/handoff',{targetVersion:'99.0.0',expectedPid:process.pid})).status,503);
    assert.equal((await f.req('/runtime')).status,200);
  }finally{release();await f.close();}
});
test('an embedded app without a runtime callback cannot stop its parent process',async()=>{
  const f=await fixture();try{assert.equal((await f.req('/runtime/stop',{})).status,404);assert.equal((await f.req('/health')).status,200);assert.equal(f.isBusy(),false);}finally{await f.close();}
});
