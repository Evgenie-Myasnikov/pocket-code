import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('a chat through an API connection answers with the model the connection serves now when it asks for none or for one it no longer serves',async()=>{
  const {createApp}=await import('../server/app');
  const {Jobs}=await import('../server/jobs');
  const root=await mkdtemp(path.join(tmpdir(),'pocket-local-model-')),project=path.join(root,'project');await mkdir(project);
  const used:string[]=[];
  const jobs=new Jobs((({prompt,options}:any)=>(async function*(){
    for await(const _input of prompt){used.push(options.model||'');yield{type:'system',subtype:'init',session_id:crypto.randomUUID()};yield{type:'result',is_error:false,total_cost_usd:0};break;}
  })()) as any);
  const providerId='88888888-8888-4888-8888-888888888888';
  let served:string[]=['qwen-coder'];
  const customProviders={list:async()=>[{id:providerId,name:'Strata · qwen-coder',hasKey:true}],models:async()=>served.map(id=>({id})),agentEnv:async()=>({...process.env}),
    get:async()=>({id:providerId,name:'Strata · qwen-coder',url:'http://127.0.0.1:18600/v1',key:'k'.repeat(64)})} as any;
  const token='fixture-token-'.repeat(4);
  const {app,closeTaskServices}=await createApp({roots:[project],token,hostName:'Fixture',uploads:path.join(root,'uploads'),desktopSessionIndexes:[],customProviders},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`;
  const send=(model:string)=>fetch(url+'/jobs',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),provider:'claude',account:providerId,model,cwd:project,text:'Summarise.'})});
  const settle=()=>new Promise(resolve=>setTimeout(resolve,150));
  try{
    // "Default": the connection's own model
    assert.equal((await send('')).status,200);await settle();
    // a model of a run before a swap in Strata: the model running now
    assert.equal((await send('qwen-flash')).status,200);await settle();
    // a model the connection serves is kept
    served=['qwen-coder','qwen-flash'];assert.equal((await send('qwen-flash')).status,200);await settle();
    assert.deepEqual(used,['qwen-coder','qwen-coder','qwen-flash']);
    // nothing served (the local model is stopped): a clear reason instead of a model error
    served=[];const refused=await send('');
    assert.equal(refused.status,409);assert.match((await refused.json()).error,/local model is not running/);
  }finally{server.close();await closeTaskServices?.();await rm(root,{recursive:true,force:true}).catch(()=>{});}
});
