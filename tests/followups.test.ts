import test from 'node:test';
import assert from 'node:assert/strict';
import {Jobs} from '../server/jobs';
import {Followups} from '../server/followups';
import {HttpError} from '../server/security';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('follow-up retries share a result and never retry ambiguous transport failures',async()=>{
  const store=new Followups(),input={id:'one',text:'Focus on tests'};let calls=0;
  await Promise.all([store.run(input,async()=>{calls++;}),store.run(input,async()=>{calls++;})]);assert.equal(calls,1);
  assert.throws(()=>store.run({...input,text:'Different'},async()=>{}),/different input/);
  for(let n=0;n<2;n++)await assert.rejects(store.run({id:'unknown',text:'Test'},async()=>{calls++;throw Error('timeout');}),/timeout/);
  assert.equal(calls,2);
  await assert.rejects(store.run({id:'not-ready',text:'Test'},async()=>{throw new HttpError(409,'Not ready');}));
  await store.run({id:'not-ready',text:'Test'},async()=>{calls++;});assert.equal(calls,3);
});
test('Claude queues follow-ups in one process, drains them and closes input after the final result',async()=>{
  const prompts:string[]=[],releases:(()=>void)[]=[];let runs=0;
  const run:any=({prompt}:any)=>(async function*(){
    runs++;
    for await(const input of prompt){
      prompts.push(input.message.content);
      yield{type:'system',subtype:'init',session_id:'session'};
      await new Promise<void>(resolve=>releases.push(resolve));
      yield{type:'result',is_error:false,total_cost_usd:0};
    }
  })();
  const jobs=new Jobs(run),initial=jobs.start({id:'job',cwd:'C:/synthetic',text:'Initial',mode:'default',maxBudgetUsd:1});
  try{
    await tick();
    await jobs.followup(initial.id,{id:'next',text:'Clarification'});
    await jobs.followup(initial.id,{id:'next',text:'Clarification'});
    assert.deepEqual(prompts,['Initial']);assert.deepEqual(jobs.get('job').pendingInputIds,['next']);
    releases.shift()!();await tick();assert.deepEqual(prompts,['Initial','Clarification']);assert.equal(runs,1);
    releases.shift()!();await tick();assert.equal(jobs.get('job').status,'done');assert.deepEqual(jobs.get('job').pendingInputIds,[]);
    assert.equal(jobs.get('job').messages.filter(message=>message.id==='next').length,1);
    await assert.rejects(jobs.followup('job',{id:'late',text:'Late'}),/ended/);
    assert.equal(JSON.stringify(jobs.view(jobs.get('job'))).includes('followups'),false);
  }finally{releases.forEach(resolve=>resolve());jobs.close();}
});
