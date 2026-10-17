import test from 'node:test';
import assert from 'node:assert/strict';
import {Jobs,deniedMessage} from '../server/jobs';
/** Waits for the asynchronous run instead of assuming one event-loop turn is enough under load. */
const until=async(check:()=>unknown)=>{for(let i=0;i<1500&&!check();i++)await new Promise(resolve=>setTimeout(resolve,2));assert.ok(check());};
/** A fake SDK run that asks one permission question and reports how it was answered. */
function asking(tool:string,input:Record<string,unknown>,suggestions:unknown[]=[]){
  const results:any[]=[];
  const run:any=({prompt,options}:any)=>(async function*(){
    for await(const _ of prompt){
      yield{type:'system',subtype:'init',session_id:'session'};
      results.push(await options.canUseTool(tool,input,{signal:new AbortController().signal,suggestions}));
      yield{type:'result',is_error:false,total_cost_usd:0};
    }
  })();
  return {run,results};
}
test('a denial carries the person\'s comment to the model in English',async()=>{
  const {run,results}=asking('Bash',{command:'npm publish'}),jobs=new Jobs(run);
  const job=jobs.start({id:'deny',cwd:'C:/synthetic',text:'Ship it',mode:'default',maxBudgetUsd:1});
  try{
    await until(()=>jobs.get(job.id).approvals[0]);const approval=jobs.get(job.id).approvals[0];
    assert.equal(approval.expiresAt,0,'without a timeout setting a request waits for the person');
    jobs.approve(job.id,approval.id,false,undefined,{message:'Run the tests first'});await until(()=>results[0]);
    assert.deepEqual(results[0],{behavior:'deny',message:'The user denied this action. The user said: Run the tests first'});
    assert.equal(deniedMessage(),'The user denied this action.');
  }finally{jobs.close();}
});
test('"Allow such actions" returns exactly the suggested rules and an approved plan sets how it runs',async()=>{
  const rule={type:'addRules',rules:[{toolName:'Bash',ruleContent:'npm test:*'}],behavior:'allow',destination:'localSettings'};
  const bash=asking('Bash',{command:'npm test'},[rule]),jobs=new Jobs(bash.run);
  const job=jobs.start({id:'remember',cwd:'C:/synthetic-a',text:'Test',mode:'default',maxBudgetUsd:1});
  const plan=asking('ExitPlanMode',{plan:'1. Edit form.ts'}),planJobs=new Jobs(plan.run);
  const planned=planJobs.start({id:'plan',cwd:'C:/synthetic-b',text:'Plan',mode:'plan',maxBudgetUsd:1});
  try{
    await until(()=>jobs.get(job.id).approvals[0]&&planJobs.get(planned.id).approvals[0]);const approval=jobs.get(job.id).approvals[0];assert.deepEqual(approval.suggestions,[rule]);
    jobs.approve(job.id,approval.id,true,undefined,{remember:true});await until(()=>bash.results[0]);
    assert.deepEqual(bash.results[0].updatedPermissions,[rule]);
    assert.equal(planJobs.get(planned.id).permissionMode,'plan');
    planJobs.approve(planned.id,planJobs.get(planned.id).approvals[0].id,true,undefined,{mode:'acceptEdits'});await until(()=>plan.results[0]);
    assert.deepEqual(plan.results[0].updatedPermissions,[{type:'setMode',mode:'acceptEdits',destination:'session'}]);
    assert.equal(planJobs.get(planned.id).permissionMode,'acceptEdits');
  }finally{jobs.close();planJobs.close();}
});
test('a timed-out request is denied and recorded for the transcript',async()=>{
  const {run,results}=asking('Write',{file_path:'notes.md',content:'x'}),jobs=new Jobs(run);
  const job=jobs.start({id:'timeout',cwd:'C:/synthetic',text:'Write',mode:'default',maxBudgetUsd:1,approvalTimeoutMs:300});
  try{
    await until(()=>jobs.get(job.id).approvals[0]||results[0]);const started=Date.now();
    if(!results[0]){const expires=jobs.get(job.id).approvals[0].expiresAt;assert.ok(expires>0&&expires<=started+300);}
    await until(()=>results[0]);
    assert.equal(results[0].behavior,'deny');assert.match(results[0].message,/timed out/);
    assert.equal(jobs.get(job.id).expiredApprovals?.[0]?.tool,'Write');
  }finally{jobs.close();}
});
