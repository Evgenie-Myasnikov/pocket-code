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
  assert.equal(claudeModels(advertised.slice(0,1))[1].id,'claude-sonnet-fixture');
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
