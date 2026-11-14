import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClaudeModelCatalog,claudeModels} from '../server/claude-models';
import {validModelId} from '../server/provider-model';
import {Jobs} from '../server/jobs';
import {randomUUID} from 'node:crypto';
import {waitFor} from './wait-for';

const advertised=[{value:'sonnet',displayName:'Sonnet fixture',description:'Alias',resolvedModel:'claude-sonnet-fixture'},{value:'claude-sonnet-fixture',displayName:'Pinned fixture',description:'Pinned'}];
test('Claude catalog retains aliases, exposes resolved versions and deduplicates IDs',()=>{
  assert.deepEqual(claudeModels(advertised).map(m=>m.id),['sonnet','claude-sonnet-fixture']);
  assert.equal(claudeModels(advertised)[0].resolvedModel,'claude-sonnet-fixture');
  assert.equal(claudeModels(advertised.slice(0,1)).length,1); // Resolved aliases do not invent extra choices.
  assert.equal(claudeModels([{value:'bad\nmodel',displayName:'Invalid',description:''}]).length,0);
  for(const id of ['claude-sonnet-fixture[1m]','arn:aws:bedrock:region:account:inference-profile/fixture','deployment-01'])assert.ok(validModelId(id));
  for(const id of ['$(command)','--option','bad\nvalue','x'.repeat(201)])assert.equal(validModelId(id),false);
});
test('model discovery coalesces reads, scopes projects and closes metadata-only processes',async()=>{
  let starts=0,closes=0;const controllers:AbortController[]=[];
  const catalog=new ClaudeModelCatalog((({prompt,options}:any)=>{starts++;controllers.push(options.abortController);assert.equal(typeof prompt,'object');return{supportedModels:async()=>advertised,close:()=>closes++};}) as any);
  const [first,second]=await Promise.all([catalog.read('/synthetic/a'),catalog.read('/synthetic/a')]);
  assert.equal(first,second);assert.equal(first.source,'sdk');assert.equal(starts,1);assert.equal(closes,1);
  await catalog.read('/synthetic/b');assert.equal(starts,2);assert.ok(controllers.every(c=>c.signal.aborted));
});
test('unresponsive or failing model discovery returns bounded, sanitized fallback and releases the process',async()=>{
  let closes=0;
  const timeout=new ClaudeModelCatalog((()=>({supportedModels:()=>new Promise(()=>{}),close:()=>closes++})) as any,15);
  assert.equal((await timeout.read('/synthetic')).source,'fallback');assert.equal(closes,1);
  const failure=new ClaudeModelCatalog((()=>({supportedModels:async()=>{throw Error('do not expose account diagnostics');},close:()=>closes++})) as any);
  const result=await failure.read('/synthetic');assert.equal(result.source,'fallback');assert.ok(!result.error?.includes('account diagnostics'));assert.equal(closes,2);
});
test('a pinned Claude model reaches the SDK and query closes after completion and error',async()=>{
  for(const fail of [false,true]){
    let closed=0,model='';
    const run:any=({options}:any)=>{model=options.model;return Object.assign((async function*(){if(fail)throw Error('Synthetic failure');})(),{close:()=>closed++});};
    const jobs=new Jobs(run),id=randomUUID();
    try{jobs.start({id,cwd:'/synthetic',text:'Hello',model:'claude-sonnet-fixture[1m]',mode:'default',maxBudgetUsd:1});await waitFor(()=>jobs.get(id).status!=='running');assert.equal(model,'claude-sonnet-fixture[1m]');assert.equal(jobs.get(id).status,fail?'error':'done');assert.equal(closed,1);}finally{jobs.close();}
  }
});

test('Claude effort is exposed only when the SDK confirms support and exact levels',()=>{
 const model={value:'sonnet',displayName:'Sonnet',description:'Fixture',resolvedModel:'claude-fixture',supportedEffortLevels:['low','high','unknown'] as any};
 assert.deepEqual(claudeModels([model])[0].reasoningEfforts,[]);
 assert.deepEqual(claudeModels([{...model,supportsEffort:true}])[0].reasoningEfforts,['low','high']);
 assert.equal(claudeModels([{...model,supportsEffort:true}]).length,1);
});
test('the account default row is the Claude default and runs without a pinned model',async()=>{
  const listed=claudeModels([{value:'default',displayName:'Default',description:'Account default',resolvedModel:'claude-opus-fixture'},...advertised]);
  assert.deepEqual(listed.filter(m=>m.isDefault).map(m=>m.id),['default']);
  assert.deepEqual(claudeModels(advertised).filter(m=>m.isDefault).map(m=>m.id),['sonnet']); // Older CLIs list no default row.
  let model:unknown='unset';
  const jobs=new Jobs((({options}:any)=>{model=options.model;return Object.assign((async function*(){})(),{close(){}});}) as any),id=randomUUID();
  try{jobs.start({id,cwd:'/synthetic',text:'Hello',model:'default',mode:'default',maxBudgetUsd:1});await waitFor(()=>jobs.get(id).status!=='running');assert.equal(model,undefined);}finally{jobs.close();}
});
test('an API error reported as a successful result shows its own reason',async()=>{
  const run:any=()=>Object.assign((async function*(){yield {type:'result',subtype:'success',is_error:true,result:'Synthetic overloaded API',total_cost_usd:0,session_id:'s'};})(),{close(){}});
  const jobs=new Jobs(run),id=randomUUID();
  try{jobs.start({id,cwd:'/synthetic',text:'Hello',mode:'default',maxBudgetUsd:1});await waitFor(()=>jobs.get(id).status!=='running');assert.equal(jobs.get(id).status,'error');assert.equal(jobs.get(id).error,'Synthetic overloaded API');}finally{jobs.close();}
});
test('a turn larger than the display limit keeps running and keeps its latest messages',async()=>{
  const big='x'.repeat(600_000);
  const run:any=()=>Object.assign((async function*(){
    for(let i=0;i<10;i++)yield {type:'assistant',uuid:'a'+i,session_id:'s',parent_tool_use_id:null,message:{content:[{type:'text',text:big}]}};
    yield {type:'result',subtype:'success',is_error:false,result:'',total_cost_usd:0,session_id:'s'};
  })(),{close(){}});
  const jobs=new Jobs(run),id=randomUUID();
  try{jobs.start({id,cwd:'/synthetic',text:'Hello',mode:'default',maxBudgetUsd:1});await waitFor(()=>jobs.get(id).status!=='running');
    const job=jobs.get(id);assert.equal(job.status,'done');assert.ok(JSON.stringify(job.messages).length<=4_000_000);assert.equal(job.messages.at(-1)?.id,'a9');}finally{jobs.close();}
});
function controllable(events:any[]){
  // A synthetic SDK stream: yields events, then waits until interrupt() or the end of input.
  let release:()=>void=()=>{};const ended=new Promise<void>(resolve=>{release=resolve;});let interrupted=0;
  const stream:any=Object.assign((async function*(){for(const event of events)yield event;await ended;yield {type:'result',subtype:'error_during_execution',is_error:true,errors:[],total_cost_usd:0,session_id:'s'};})(),{close(){},interrupt:async()=>{interrupted++;release();}});
  return {stream,interrupts:()=>interrupted};
}
test('Stop interrupts the Claude turn instead of killing the process and drops queued follow-ups',async()=>{
  const fake=controllable([{type:'assistant',uuid:'a1',session_id:'s',parent_tool_use_id:null,message:{content:[{type:'text',text:'Working'}]}}]);
  let signal:AbortSignal|undefined;
  const jobs=new Jobs((({options}:any)=>{signal=options.abortController.signal;return fake.stream;}) as any),id=randomUUID();
  try{
    jobs.start({id,cwd:'/synthetic',text:'Hello',mode:'default',maxBudgetUsd:1});
    await waitFor(()=>jobs.get(id).messages.some(m=>m.id==='a1'));
    jobs.stop(id);await waitFor(()=>jobs.get(id).status!=='running');
    assert.equal(fake.interrupts(),1);assert.equal(jobs.get(id).status,'stopped');assert.equal(jobs.get(id).error,undefined);assert.equal(signal?.aborted,false);
  }finally{jobs.close();}
});
test('Stop kills the process when the interrupted turn does not end in time',async()=>{
  const stream:any=Object.assign((async function*(){await new Promise(()=>{});})(),{close(){},interrupt:async()=>{}});
  let signal:AbortSignal|undefined;
  const jobs=new Jobs((({options}:any)=>{signal=options.abortController.signal;return stream;}) as any),id=randomUUID();
  try{jobs.start({id,cwd:'/synthetic',text:'Hello',mode:'default',maxBudgetUsd:1});await waitFor(()=>Boolean(signal));jobs.stop(id,20);await waitFor(()=>signal!.aborted);}finally{jobs.close();}
});
test('retries, slash-command output and compaction appear as system rows; a retry row leaves with the answer',async()=>{
  const seen:string[][]=[];
  const run:any=()=>Object.assign((async function*(){
    yield {type:'system',subtype:'api_retry',attempt:1,max_retries:10,retry_delay_ms:2000,error_status:529,error:'overloaded',uuid:'r1',session_id:'s'};
    yield {type:'system',subtype:'local_command_output',content:'Synthetic context usage',uuid:'l1',session_id:'s'};
    yield {type:'system',subtype:'compact_boundary',compact_metadata:{trigger:'auto',pre_tokens:1000,post_tokens:100},uuid:'c1',session_id:'s'};
    seen.push(jobs.get(id).messages.map(m=>m.id));
    yield {type:'assistant',uuid:'a1',session_id:'s',parent_tool_use_id:null,message:{content:[{type:'text',text:'Done'}]}};
    yield {type:'result',subtype:'success',is_error:false,result:'',total_cost_usd:0,session_id:'s'};
  })(),{close(){}});
  const jobs=new Jobs(run),id=randomUUID();
  try{
    jobs.start({id,cwd:'/synthetic',text:'Hello',mode:'default',maxBudgetUsd:1});await waitFor(()=>jobs.get(id).status!=='running');
    const ids=jobs.get(id).messages.map(m=>m.id);
    assert.deepEqual(seen[0].slice(1),['l1','c1']); // compaction ended the retry wait
    assert.deepEqual(ids.slice(1),['l1','c1','a1']);
    const output=jobs.get(id).messages.find(m=>m.id==='l1')!;assert.equal(output.role,'system');assert.equal(output.blocks[0].text,'Synthetic context usage');
  }finally{jobs.close();}
});
test('token deltas leave the transcript revision unchanged',async()=>{
  const fake=controllable([
    {type:'assistant',uuid:'a1',session_id:'s',parent_tool_use_id:null,message:{content:[{type:'text',text:'Start'}]}},
    {type:'stream_event',session_id:'s',parent_tool_use_id:null,event:{type:'content_block_delta',delta:{type:'text_delta',text:'Hel'}}},
    {type:'stream_event',session_id:'s',parent_tool_use_id:null,event:{type:'content_block_delta',delta:{type:'text_delta',text:'lo'}}}]);
  const jobs=new Jobs((()=>fake.stream) as any),id=randomUUID();
  try{
    jobs.start({id,cwd:'/synthetic',text:'Hello',mode:'default',maxBudgetUsd:1});await waitFor(()=>jobs.get(id).partial==='Hello');
    const job=jobs.view(jobs.get(id));assert.equal(job.messagesRevision,1);assert.ok(job.revision>2);
  }finally{jobs.close();}
});
test('a CLI that exits with an error after the interrupt still ends as stopped',async()=>{
  let release:()=>void=()=>{};const ended=new Promise<void>(resolve=>{release=resolve;});
  const stream:any=Object.assign((async function*(){yield {type:'assistant',uuid:'a1',session_id:'s',parent_tool_use_id:null,message:{content:[{type:'text',text:'Working'}]}};await ended;throw Error('Claude Code process exited with code 1');})(),{close(){},interrupt:async()=>{release();}});
  const jobs=new Jobs((()=>stream) as any),id=randomUUID();
  try{jobs.start({id,cwd:'/synthetic',text:'Hello',mode:'default',maxBudgetUsd:1});await waitFor(()=>jobs.get(id).messages.some(m=>m.id==='a1'));jobs.stop(id);await waitFor(()=>jobs.get(id).status!=='running');assert.equal(jobs.get(id).status,'stopped');assert.equal(jobs.get(id).error,undefined);}finally{jobs.close();}
});
