import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
import type {JobView} from '../server/types';
import {chainCompletionMarker} from '../src/markdown-chain';

test('chain erasure only confirms known attempts, preserves other chats and retries partial native failures after restart',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'chain-erase-')),uploads=path.join(root,'uploads');
  const store=path.join(uploads,'.tasks','markdown-chains');await mkdir(store,{recursive:true});
  const id=randomUUID(),a=randomUUID(),b=randomUUID(),other=randomUUID(),token='test-only-'.repeat(5);
  const scope={cwd:root,provider:'claude' as const},chats=new Set<string>([a,b,other]);
  const plan={version:1,created:0,settings:{},fingerprint:'fixture',chain:{...scope,id,name:'Plan',context:'Instructions',status:'stopped',steps:[
    {title:'First',body:'Instructions',source:'plan.md',status:'stopped',sessionId:b,retryCount:1,launchCwd:root},
  ]},attempts:[a,b].map(sessionId=>({...scope,step:0,jobId:randomUUID(),sessionId}))};
  await writeFile(path.join(store,id+'.json'),JSON.stringify(plan));
  const failed=new Set<string>([b]),erased:string[]=[];
  const info=(sessionId:string)=>chats.has(sessionId)?{sessionId,cwd:root,summary:'Sample',lastModified:1}:undefined;
  async function start(){
    const host=await createApp({roots:[root],uploads,hostName:'Synthetic',token,desktopSessionIndexes:[]},new Jobs(),{
      listSessions:async()=>[...chats].map(key=>info(key)!),getSessionMessages:async()=>[],
      getSessionInfo:async(key)=>info(key),deleteSession:async(key)=>{if(failed.has(key))throw Error('Synthetic provider unavailable');chats.delete(key);erased.push(key);},
    });
    const server=host.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
    return {base:'http://127.0.0.1:'+(server.address() as {port:number}).port+'/api',close:async()=>{await host.closeTaskServices();host.terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
  }
  let api=await start();
  t.after(async()=>{await api.close();await rm(root,{recursive:true,force:true});});
  const query=new URLSearchParams({...scope,deletePreview:'1',eraseOriginals:'1'});
  const get=async()=>(await fetch(api.base+'/task-chains/'+id+'?'+query,{headers:{Authorization:'Bearer '+token}})).json();
  const send=(body:unknown)=>fetch(api.base+'/task-chains/'+id+'/delete-chats',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const preview=await get();assert.equal(preview.eraseOriginals,true);assert.deepEqual(new Set(preview.chats.map((s:{sessionId:string})=>s.sessionId)),new Set([a,b]));
  assert.equal((await send({...scope,eraseOriginals:true,chats:[{provider:'claude',sessionId:other}]})).status,409);
  const partial=await(await send({...scope,eraseOriginals:true,chats:preview.chats})).json();
  assert.equal(partial.ok,false);assert.deepEqual(partial.chats.map((s:{sessionId:string})=>s.sessionId),[a]);
  assert.deepEqual(partial.failed.map((s:{sessionId:string})=>s.sessionId),[b]);assert.deepEqual(erased,[a]);assert.ok(chats.has(other));
  await api.close();api=await start();failed.clear();
  const retry=await get();assert.deepEqual(retry.chats,[{provider:'claude',sessionId:b}]);
  const confirmation={...scope,eraseOriginals:true,chats:retry.chats},done=await(await send(confirmation)).json();
  assert.equal(done.ok,true);assert.deepEqual(done.chats,retry.chats);assert.deepEqual(erased,[a,b]);
  assert.deepEqual((await(await send(confirmation)).json()),done);
  assert.equal((await send({...confirmation,account:randomUUID()})).status,404);
  assert.ok(chats.has(other));assert.equal((await get()).error!==undefined,true);
});

test('folder erasure waits until the chain records the provider result and handoff',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'chain-active-delete-')),sessionId=randomUUID(),id=randomUUID(),token='test-only-'.repeat(5);
  const scope={cwd:root,provider:'claude'},store=path.join(root,'uploads','.tasks','markdown-chains');
  await mkdir(store,{recursive:true});
  await writeFile(path.join(store,id+'.json'),JSON.stringify({version:1,created:0,settings:{},fingerprint:'synthetic',stacked:false,
    chain:{id,...scope,name:'Plan',context:'Synthetic',status:'running',steps:[{status:'pending',retryAt:1,source:'step.md',title:'Step',body:'Synthetic instruction'}]}}));
  let run:JobView|undefined,holdObservation=true,started!:()=>void;
  const ready=new Promise<void>(resolve=>{started=resolve;});
  const jobs=Object.assign(new Jobs(),{
    list:()=>run?[run]:[],
    get:()=>holdObservation&&run?{...run,status:'running' as const}:run!,
    start:(turn:Parameters<Jobs['start']>[0])=>{
      run={id:turn.id,cwd:root,sessionId,status:'running',provider:'claude',messages:[],approvals:[],partial:'',revision:0,baseMessageCount:0,startedAt:Date.now()};
      started();return {...run};
    },
  });
  const row={sessionId,cwd:root,lastModified:1,summary:'Synthetic step'};
  const host=await createApp({roots:[root],uploads:path.join(root,'uploads'),token,hostName:'Synthetic',desktopSessionIndexes:[]},jobs,{
    listSessions:async()=>[row],getSessionMessages:async()=>[],getSessionInfo:async()=>row,deleteSession:async()=>assert.fail('protected original was erased'),
  });
  const server=host.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{await host.closeTaskServices();host.terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/';
  const api=(route:string,body?:unknown)=>fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await api('task-chains?'+new URLSearchParams(scope))).status,200);
  await ready;run!.status='done';run!.messages=[{id:randomUUID(),role:'assistant',blocks:[{type:'text',text:'Saved handoff.\n'+chainCompletionMarker(id,0)}]}];
  const folder={folder:root,provider:'claude',eraseOriginals:true};
  assert.deepEqual((await(await api('chat-library/bulk-delete',{...folder,action:'preview'})).json()).running,[sessionId]);
  assert.deepEqual((await(await api('chat-library/bulk-delete',{...folder,action:'delete',ids:[sessionId]})).json()).running,[sessionId]);
  holdObservation=false;
  const deadline=Date.now()+7000;
  while((await(await api('task-chains/'+id+'?'+new URLSearchParams(scope))).json()).status!=='done'){
    assert.ok(Date.now()<deadline,'handoff never saved');await new Promise(resolve=>setTimeout(resolve,25));
  }
  assert.deepEqual((await(await api('chat-library/bulk-delete',{...folder,action:'preview'})).json()).ids,[sessionId]);
});
