import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
import {HttpError} from '../server/security';
import type {JobView} from '../server/types';
import type {MarkdownChainDetail} from '../src/markdown-chain';
import {chainCompletionMarker} from '../src/markdown-chain';

test('chain API runs distinct chats with their settings and isolates saved context by project and account',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'chain-api-'));
  const project=path.join(root,'project'),other=path.join(root,'other'),uploads=path.join(root,'uploads');
  await Promise.all([mkdir(project),mkdir(other)]);
  const token='test-only-'.repeat(5),active=new Map<string,JobView>(),starts:Parameters<Jobs['start']>[0][]=[];
  const jobs=Object.assign(new Jobs(),{
    list:()=>[...active.values()],
    get:(id:string)=>{const found=active.get(id);if(!found)throw new HttpError(404,'Missing job');return found;},
    start:(input:Parameters<Jobs['start']>[0])=>{
      starts.push(input);
      const view:JobView={id:input.id,provider:'claude',cwd:input.cwd,sessionId:randomUUID(),status:'running',
        startedAt:Date.now(),messages:[],approvals:[],partial:'',revision:0,baseMessageCount:0};
      active.set(input.id,view);return view;
    },
    stop:(id:string)=>{const job=active.get(id);if(job)job.status='stopped';},
  });
  const {app,terminals,closeTaskServices}=await createApp({roots:[project,other],uploads,
    hostName:'Synthetic PC',token,desktopSessionIndexes:[]},jobs);
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{await closeTaskServices();terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/task-chains';
  const request=(suffix:string,body?:unknown)=>fetch(base+suffix,{method:body?'POST':'GET',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const id=randomUUID(),scope={cwd:project,provider:'claude'},query='?'+new URLSearchParams(scope),detail='/'+id+query;
  const plan={id,...scope,name:'guide.md',context:'Shared example.',mode:'plan',maxBudgetUsd:2,
    tasks:[{title:'Map',body:'Inspect the sample.',source:'map.md'},{title:'Check',body:'Expect the sample.\n'.repeat(4000),source:'check.md'}]};
  assert.equal((await fetch(base+query)).status,401);
  assert.equal((await request('',{...plan,reasoningEffort:'high'})).status,400);
  assert.equal((await request('',{...plan,cwd:root})).status,403);
  assert.equal((await request('',plan)).status,200);
  assert.equal((await request('',plan)).status,200);
  assert.equal((await request('/'+id+'?'+new URLSearchParams({...scope,cwd:other}))).status,404);
  assert.deepEqual(await (await request(query+'&account='+randomUUID())).json(),[]);
  async function waitForStarts(count:number){
    const deadline=Date.now()+10000;
    while(starts.length<count&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,30));
    assert.equal(starts.length,count);
  }
  await waitForStarts(1);
  assert.equal(starts[0].mode,'plan');assert.equal(starts[0].maxBudgetUsd,2);assert.equal(starts[0].sessionId,undefined);
  assert.match(starts[0].text,/Shared example/);assert.doesNotMatch(starts[0].text,/Expect the sample/);
  const first=active.get(starts[0].id)!;
  first.partial='Live example.';
  const live:MarkdownChainDetail=await (await request(detail)).json();
  assert.equal(live.steps[0].output,first.partial);assert.equal(live.steps[0].phase,'responding');
  assert.equal((await request('/'+id+'/delete',scope)).status,409);
  first.partial='';
  first.messages=[{id:randomUUID(),role:'assistant',blocks:[{type:'text',text:'Found the sample.\n'+chainCompletionMarker(id,0)}]}];first.status='done';
  await waitForStarts(2);
  assert.notEqual(starts[1].id,first.id);assert.equal(starts[1].sessionId,undefined);
  const file=starts[1].attachmentPaths![0];assert.ok(path.relative(uploads,file).startsWith(starts[1].id));
  const full=await readFile(file,'utf8');
  assert.ok(full.includes(plan.tasks[1].body.trim()));assert.ok(full.includes('Found the sample.'));
  const chain:MarkdownChainDetail=await (await request(detail)).json();
  assert.equal(chain.steps[0].sessionId,first.sessionId);assert.equal(chain.steps[0].status,'done');
  assert.equal(chain.steps[0].output,'Found the sample.');
  const [backlink]=await (await request(query+'&sessionId='+first.sessionId)).json();
  assert.equal(backlink.id,id);assert.equal(backlink.stepIndex,0);assert.equal(backlink.context,undefined);
  assert.deepEqual(await (await request(query+'&sessionId='+randomUUID())).json(),[]);
  assert.equal((await request('/'+id+'/stop',{...scope,cwd:other})).status,404);
  assert.equal((await request('/'+id+'/stop',scope)).status,200);
  const [summary]=await (await request(query)).json();
  assert.equal(summary.status,'stopped');assert.equal(summary.stepCount,2);assert.equal(summary.stepsDone,1);
  assert.equal(summary.context,undefined);assert.equal(summary.steps,undefined);
  assert.equal((await request('/'+id+'/delete',{...scope,cwd:other})).status,404);
  assert.deepEqual(await (await request('/'+id+'/delete',scope)).json(),{ok:true});
  assert.equal((await request(detail)).status,404);assert.deepEqual(await (await request(query)).json(),[]);
  assert.equal((await request('',plan)).status,409);
});
