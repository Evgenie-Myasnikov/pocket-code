import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {TaskRuns,type TaskCheck} from '../server/task-runs';
import {TaskCheckRunner,validateChecks,suggestedTaskChecks} from '../server/task-checks';
import {taskFixture,finishJob} from './task-run-fixture';
import {waitFor} from './wait-for';

const pass:TaskCheck={label:'Synthetic test',executable:process.execPath,args:['-e','console.log("synthetic pass")'],timeoutMs:5000};
test('private task creation is idempotent and persisted without modifying the board',async t=>{
  const {runs,input,file,worktrees}=await taskFixture(t),id=randomUUID();
  const [run,retry]=await Promise.all([runs.create({...input,id}),runs.create({...input,id})]);assert.equal(run.id,retry.id);assert.equal(run.revision,retry.revision);assert.equal(run.stage,'working');
  await assert.rejects(runs.create({...input,id,ownerId:'another-owner'}),/another task/);
  const loaded=new TaskRuns(file,worktrees);assert.deepEqual(await loaded.get(id),run);assert.equal((await loaded.list({ownerId:input.ownerId})).length,1);assert.equal((await loaded.list({ownerId:'other'})).length,0);
  assert.equal((await loaded.reconcile())[0].revision,run.revision,'unstarted draft is not interrupted');
  const storage=JSON.parse(await readFile(file,'utf8'));assert.equal(storage.version,1);assert.equal(storage.runs[0].noteId,input.noteId);
});

test('finished AI work requires real passing commands and revision-bound human approval',async t=>{
  const {runs,input}=await taskFixture(t);let run=await runs.create(input);
  run=await runs.configureChecks(run.id,run.revision,[pass]);assert.equal(run.verificationPlan?.length,1);
  run=await runs.attachJob(run.id,run.revision,{jobId:'first-job'});await assert.rejects(runs.attachJob(run.id,run.revision,{jobId:'second-job'}),/Resume/);
  run=await runs.observeJob(run.id,{id:'first-job',status:'running',approvals:[{}],sessionId:'first-session'});assert.equal(run.stage,'questions');
  run=await runs.observeJob(run.id,{id:'first-job',status:'done',sessionId:'first-session'});assert.equal(run.stage,'checks');
  assert.equal((await runs.observeJob(run.id,{id:'first-job',status:'done'})).revision,run.revision);
  await assert.rejects(runs.approve(run.id,run.revision),/Passing executable/);
  run=await runs.verify(run.id,run.revision,run.verificationPlan!);assert.equal(run.stage,'review');assert.equal(run.verification?.evidence[0].exitCode,0);assert.match(run.verification!.evidence[0].output,/synthetic pass/);
  await assert.rejects(runs.approve(run.id,run.revision-1),/changed/);
  run=await runs.approve(run.id,run.revision);assert.equal(run.stage,'approved');assert.equal(run.approval?.fingerprint,run.verification?.snapshot.fingerprint);
  assert.equal((await runs.observeJob(run.id,{id:'first-job',status:'done'})).stage,'approved');
  const result=await runs.result(run.id);assert.equal(result.snapshot.fingerprint,run.approval?.fingerprint);
  run=await runs.resume(run.id,run.revision);assert.equal(run.stage,'working');assert.equal(run.approval,undefined);assert.equal(run.verification,undefined);assert.equal(run.sessionId,'first-session');
  run=await runs.attachJob(run.id,run.revision,{jobId:'second-job'});assert.equal(run.jobs.length,2);
});

test('failed executable checks can be corrected and rerun without a new task',async t=>{
  const {runs,input}=await taskFixture(t);let run=await finishJob(runs,await runs.create(input));
  run=await runs.verify(run.id,run.revision,[{...pass,args:['-e','process.exit(7)']}]);assert.equal(run.stage,'failed');assert.equal(run.verification?.evidence[0].exitCode,7);
  await assert.rejects(runs.approve(run.id,run.revision),/Passing executable/);
  run=await runs.configureChecks(run.id,run.revision,[pass]);run=await runs.verify(run.id,run.revision,run.verificationPlan!);assert.equal(run.stage,'review');
});

test('changed result invalidates review evidence before approval',async t=>{
  const {runs,input}=await taskFixture(t);let run=await finishJob(runs,await runs.create(input));
  run=await runs.verify(run.id,run.revision,[pass]);await writeFile(path.join(run.worktree!.cwd,'code.txt'),'changed after testing');
  await assert.rejects(runs.approve(run.id,run.revision),/changed after verification/);run=await runs.get(run.id);assert.equal(run.stage,'checks');assert.equal(run.approval,undefined);
});

test('checks cannot approve a result that they changed while running',async t=>{
  const {runs,input}=await taskFixture(t);let run=await finishJob(runs,await runs.create(input));
  run=await runs.verify(run.id,run.revision,[{...pass,args:['-e','require("node:fs").writeFileSync("code.txt","changed during check")']}]);assert.equal(run.stage,'failed');assert.match(run.error!,/changed during verification/);assert.equal(run.verification?.evidence[0].passed,true);
});

test('host restart preserves attempts and interrupts jobs without relaunching',async t=>{
  const {runs,input,file,worktrees}=await taskFixture(t);let run=await runs.create(input);run=await runs.attachJob(run.id,run.revision,{jobId:'interrupted-job',sessionId:'kept-session'});
  const restarted=new TaskRuns(file,worktrees);await restarted.reconcile();run=await restarted.get(run.id);assert.equal(run.stage,'questions');assert.equal(run.interrupted,true);assert.equal(run.sessionId,'kept-session');assert.equal(run.jobs[0].status,'stopped');
  run=await restarted.resume(run.id,run.revision);run=await restarted.attachJob(run.id,run.revision,{jobId:'resumed-job'});assert.equal(run.jobs.length,2);
  const recovered=new TaskRuns(file,worktrees);await recovered.reconcile(id=>({id,status:'done',sessionId:'kept-session'}));assert.equal((await recovered.get(run.id)).stage,'checks');
});

test('startup interruption of verification retains evidence but requires a rerun',async t=>{
  const {runs,input,file,worktrees}=await taskFixture(t);let run=await finishJob(runs,await runs.create(input));run=await runs.verify(run.id,run.revision,[pass]);
  const data=JSON.parse(await readFile(file,'utf8'));data.runs[0].stage='checks';data.runs[0].verification.status='running';await writeFile(file,JSON.stringify(data));
  const restarted=new TaskRuns(file,worktrees);run=(await restarted.reconcile())[0];assert.equal(run.stage,'questions');assert.equal(run.verification?.status,'interrupted');assert.equal(run.verification?.evidence.length,1);
  await assert.rejects(restarted.approve(run.id,run.revision),/Passing executable/);run=await restarted.verify(run.id,run.revision,[pass]);assert.equal(run.stage,'review');
});

test('separate verification runs progress concurrently and reject stale edits',async t=>{
  const {runs,input}=await taskFixture(t);const first=await finishJob(runs,await runs.create(input),'first-job'),second=await finishJob(runs,await runs.create({...input,noteId:'second-note'}),'second-job');
  const slow={...pass,args:['-e','setTimeout(()=>console.log("complete"),300)']};
  const running=runs.verify(first.id,first.revision,[slow]);await waitFor(()=>runs.hasWork());
  const current=await runs.get(first.id);await assert.rejects(runs.configureChecks(first.id,current.revision,[pass]),/still running/);
  const other=await runs.verify(second.id,second.revision,[pass]);assert.equal(other.stage,'review');assert.equal((await running).stage,'review');assert.equal(runs.hasWork(),false);
});

test('bounded verification output, timeouts and shutdown do not leave running commands',async t=>{
  const {source}=await taskFixture(t),runner=new TaskCheckRunner();t.after(()=>runner.close());
  const output=await runner.run({...pass,args:['-e','console.log("x".repeat(30000))']},source);assert.equal(output.passed,true);assert.equal(output.truncated,true);assert.ok(output.output.length<=16_384);
  const timeout=await runner.run({...pass,args:['-e','setInterval(()=>{},1000)'],timeoutMs:100},source);assert.equal(timeout.passed,false);assert.equal(timeout.timedOut,true);assert.equal(runner.busy,false);
  const active=runner.run({...pass,args:['-e','setInterval(()=>{},1000)']},source);await waitFor(()=>runner.busy);await runner.close();const cancelled=await active;assert.equal(cancelled.passed,false);assert.equal(cancelled.interrupted,true);assert.equal(cancelled.timedOut,false);assert.equal(runner.busy,false);
});

test('host shutdown waits until interrupted verification is persisted and no work remains',async t=>{
  const {runs,input,file,worktrees}=await taskFixture(t);let run=await finishJob(runs,await runs.create(input));
  const started=await runs.startVerification(run.id,run.revision,[{...pass,args:['-e','setInterval(()=>{},1000)']}]);
  assert.equal(runs.hasWork(),true);await runs.close();assert.equal(runs.hasWork(),false);
  run=await started.completion;assert.equal(run.verification?.status,'interrupted');assert.equal(run.verification?.evidence[0].interrupted,true);
  const saved=await new TaskRuns(file,worktrees).get(run.id);assert.deepEqual(saved,run);
});

test('a verification process that exits early cannot leave its owned child holding the run open',{timeout:15_000},async t=>{
  const {source,temporary}=await taskFixture(t),runner=new TaskCheckRunner(),pidFile=path.join(temporary,'owned-child.pid');
  t.after(async()=>{await runner.close();try{const pid=Number(await readFile(pidFile,'utf8'));process.kill(pid,'SIGKILL');}catch{/* The test-owned child normally already exited through cleanup. */}});
  const script=`const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit'],windowsHide:true});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(child.pid));child.unref();`;
  const result=await runner.run({...pass,args:['-e',script],timeoutMs:10_000},source);
  assert.equal(result.passed,true,result.output);assert.equal(result.timedOut,false);assert.equal(runner.busy,false);
  const child=Number(await readFile(pidFile,'utf8'));assert.throws(()=>process.kill(child,0));
});

test('a job cannot be linked to two independent tasks',async t=>{
  const {runs,input}=await taskFixture(t),first=await runs.create(input),second=await runs.create({...input,noteId:'second-note'});
  await runs.attachJob(first.id,first.revision,{jobId:'shared-job'});await assert.rejects(runs.attachJob(second.id,second.revision,{jobId:'shared-job'}),/another task/);
});

test('invalid persisted verification is rejected without overwriting private history',async t=>{
  const {runs,input,file,worktrees}=await taskFixture(t);let run=await finishJob(runs,await runs.create(input));run=await runs.verify(run.id,run.revision,[pass]);
  const data=JSON.parse(await readFile(file,'utf8'));data.runs[0].verification.evidence[0].exitCode=3;const corrupt=JSON.stringify(data);await writeFile(file,corrupt);
  const restarted=new TaskRuns(file,worktrees);await assert.rejects(restarted.list(),/Invalid private task-run evidence/);assert.equal(await readFile(file,'utf8'),corrupt);
});

test('verification rejects empty/malformed plans and detects package checks without executing them',async t=>{
  const {source}=await taskFixture(t);assert.throws(()=>validateChecks([]),/Choose/);assert.throws(()=>validateChecks([{...pass,executable:'npm.cmd'}]),/shell scripts/);assert.throws(()=>validateChecks([{...pass,timeoutMs:0}]),/timeout/);
  await writeFile(path.join(source,'package.json'),JSON.stringify({scripts:{test:'exit 97',build:'exit 98'}}));const checks=await suggestedTaskChecks(source);assert.ok(checks.some(check=>check.label==='Git whitespace check'));for(const check of checks.filter(check=>check.label.startsWith('npm'))){assert.equal(check.executable,process.execPath);assert.match(check.args[0],/npm-cli\.js$/);}
});
