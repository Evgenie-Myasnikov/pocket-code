import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';

test('provider routes isolate history and dispatch jobs, approvals and stop to the correct engine',async()=>{
  const temporary=await mkdtemp(path.join(os.tmpdir(),'pocket-providers-')),root=path.join(temporary,'project');await mkdir(root);
  const pending=async function*({options}:any){await options.canUseTool('Write',{file:'sample.txt'},{signal:options.abortController.signal});};
  const claude=new Jobs(pending as any),engine=new Jobs(pending as any),sid=randomUUID(),token='a'.repeat(43);
  const all=Array.from({length:140},(_,i)=>({id:String(i),role:'user',blocks:[{type:'text',text:`codex message ${i}`}]}));
  const codex:any={
    status:async()=>({available:true,authenticated:true,models:[{id:'fixture-model',name:'Fixture'}]}),
    sessions:async()=>[{sessionId:sid,summary:'Codex fixture',cwd:root,lastModified:Date.now(),provider:'codex',source:'codex'}],
    messages:async()=>all,
    start:(input:any)=>{engine.start(input);engine.get(input.id).provider='codex';return engine.view(engine.get(input.id));},
    list:()=>engine.list(), get:(id:string)=>engine.get(id),view:(job:any)=>engine.view(job),
    stop:(id:string)=>engine.stop(id),approve:(...args:any[])=>(engine.approve as any)(...args),close:()=>engine.close(),
  };
  const jira:any={status:async()=>({connected:true,sites:[{id:'fixture-site',name:'Fixture'}]}),issue:async(_site:string,key:string)=>({key,summary:'Synthetic task',description:'Synthetic requirement',url:'https://example.invalid/'+key})};
  const runtime=await createApp({roots:[root],uploads:path.join(temporary,'uploads'),token,hostName:'Fixture',desktopSessionIndexes:[],codex,jira},claude,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
  const server=runtime.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request=(endpoint:string,body?:unknown)=>fetch(url+endpoint,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  try{
    assert.equal((await fetch(url+'/providers')).status,401);
    assert.equal((await(await request('/providers')).json())[1].models[0].id,'fixture-model');
    assert.deepEqual(await(await request('/sessions')).json(),[]);
    assert.equal((await(await request('/sessions?provider=codex')).json())[0].sessionId,sid);
    assert.equal((await request('/sessions?provider=unknown')).status,400);
    assert.equal((await request(`/sessions/${sid}/messages`)).status,404);
    const page=await(await request(`/sessions/${sid}/messages?provider=codex&window=20&from=start`)).json();
    assert.equal(page.messages.length,20);assert.equal(page.next,20);assert.equal(page.messages[0].id,'0');
    const id=randomUUID(),body={id,provider:'codex',cwd:root,text:'fixture',model:'fixture-model'};
    const launched=await request('/jobs',body);assert.equal(launched.status,200);assert.equal((await launched.json()).provider,'codex');
    assert.equal((await(await request('/jobs?provider=codex')).json()).length,1);assert.deepEqual(await(await request('/jobs')).json(),[]);
    assert.equal((await request('/jobs',{...body,provider:'claude',model:''})).status,409);
    assert.equal((await request('/jobs',{...body,id:randomUUID(),provider:'claude',model:''})).status,409);
    const job=await(await request(`/jobs/${id}`)).json();assert.equal(job.approvals.length,1);
    assert.equal((await request(`/jobs/${id}/approvals/${job.approvals[0].id}`,{allow:false})).status,200);
    await new Promise(resolve=>setTimeout(resolve,10));assert.equal(engine.get(id).status,'done');
    const next=randomUUID();assert.equal((await request('/jobs',{...body,id:next})).status,200);
    assert.equal((await request(`/jobs/${next}/stop`,{})).status,200);
    await new Promise(resolve=>setTimeout(resolve,10));assert.equal(engine.get(next).status,'stopped');
    assert.equal((await request('/jobs',{...body,id:randomUUID(),sessionId:sid,takeoverConfirmed:false})).status,409);
    const queued=await request('/jira/queue',{batchId:randomUUID(),provider:'claude',site:'fixture-site',keys:['TEST-1','TEST-2'],cwd:root});assert.equal(queued.status,200);
    for(let i=0;i<100&&!claude.list().length;i++)await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(claude.list().length,1);
    await request('/jira/queue/control',{action:'pause',provider:'claude'});
    assert.equal((await(await request('/jira/queue?provider=codex')).json()).items.length,0);
    await request('/jira/queue/control',{action:'resume',provider:'codex'});
    assert.equal((await(await request('/jira/queue')).json()).paused,true);
    const first=claude.list()[0];claude.stop(first.id);await new Promise(resolve=>setTimeout(resolve,10));
    const codexJira=await request('/jira/start',{id:randomUUID(),provider:'codex',site:'fixture-site',key:'TEST-3',cwd:root});
    assert.equal(codexJira.status,200);const result=await codexJira.json();assert.equal(result.provider,'codex');assert.equal(result.jira.key,'TEST-3');
  }finally{runtime.queue?.close();runtime.codexQueue?.close();engine.close();claude.close();runtime.terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(temporary,{recursive:true,force:true});}
});


test('shared projects include both providers while excluding out-of-scope and missing folders', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'pocket-projects-'));
  const root = path.join(temporary, 'allowed'), claudeRoot = path.join(root, 'claude'), codexRoot = path.join(root, 'codex'), outside = path.join(temporary, 'outside');
  await Promise.all([mkdir(claudeRoot, {recursive:true}), mkdir(codexRoot, {recursive:true}), mkdir(outside)]);
  const token = 'p'.repeat(43);
  let claudeFails = false, codexFails = false;
  const codex:any = {sessions: async () => {
    if (codexFails) throw new Error('Synthetic unavailable provider');
    return [{cwd:codexRoot}, {cwd:claudeRoot}, {cwd:outside}, {cwd:path.join(root, 'missing')}];
  }};
  const runtime = await createApp({roots:[root], uploads:path.join(temporary, 'uploads'), token, hostName:'Fixture', desktopSessionIndexes:[], codex}, new Jobs(), {
    listSessions: async () => {
      if (claudeFails) throw new Error('Synthetic unavailable provider');
      return [{sessionId:randomUUID(), cwd:claudeRoot, lastModified:1}, {sessionId:randomUUID(), cwd:outside, lastModified:1}];
    }, getSessionMessages:async()=>[],
  } as any);
  const server = runtime.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/projects`;
  const list = async () => {
    const response = await fetch(url, {headers:{Authorization:`Bearer ${token}`}});
    assert.equal(response.status,200);return response.json();
  };
  try {
    assert.equal((await fetch(url)).status,401);
    assert.deepEqual(await list(), [root, claudeRoot, codexRoot]);
    codexFails = true;
    assert.deepEqual(await list(), [root, claudeRoot]);
    claudeFails = true;codexFails = false;
    assert.deepEqual(await list(), [root, codexRoot, claudeRoot]);
    codexFails = true;
    assert.deepEqual(await list(), [root]);
  } finally {
    runtime.jobs.close();runtime.terminals.close();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir())+path.sep));
    await rm(temporary,{recursive:true,force:true});
  }
});
