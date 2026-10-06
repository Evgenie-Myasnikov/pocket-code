import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
import {TaskRuntime} from '../server/task-runtime';
import {projectBoard} from '../server/project-board';
import {createWorkspaceAccess} from '../server/boards';
import {taskFixture,fixtureGit,finishJob} from './task-run-fixture';
import type {TaskRun} from '../server/task-runs';
import {waitFor} from './wait-for';

async function apiFixture(t:TestContext){
  const base=await taskFixture(t),boardId=randomUUID(),noteId=randomUUID(),boardFile=path.join(base.source,'project-boards',`board-${boardId}.json`);
  const board={format:'pocket-code-board',version:1,name:'Synthetic board',versions:['Next'],notes:[{id:noteId,title:'Synthetic change',description:'Make a reversible fixture change.',branch:'Next',status:'ready',priority:'normal',x:0,y:0,dependencies:[]}]};
  await mkdir(path.dirname(boardFile));await writeFile(boardFile,JSON.stringify(board));fixtureGit(base.source,'add','.');fixtureGit(base.source,'commit','-m','Synthetic board');
  const token='synthetic-task-token-'.repeat(3),sessions:any[]=[],starts:any[]=[];
  const jobs=new Jobs((({options}:any)=>{starts.push(options);return(async function*(){})();}) as any);
  const app=await createApp({roots:[base.source],token,hostName:'Synthetic PC',uploads:path.join(base.temporary,'uploads'),desktopSessionIndexes:[]},jobs,{listSessions:async()=>sessions,getSessionMessages:async()=>[]} as any);
  const server=app.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as any).port}/api`,headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  base.onCleanup(async()=>{await app.closeTaskServices();jobs.close();app.terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const request=(route:string,body?:unknown)=>fetch(url+route,{headers,...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)})});
  const create=async(extra:Record<string,unknown>={})=>{const current=(await projectBoard(base.source))!;return request('/task-runs',{id:randomUUID(),boardId,noteId,root:base.source,noteRevision:current.repositoryRevision,provider:'claude',...extra});};
  return {...base,app,jobs,sessions,starts,url,headers,request,create,board,boardFile,boardId,noteId};
}
async function eventually<T>(read:()=>Promise<T>,matches:(value:T)=>boolean){const until=Date.now()+8000;while(true){const value=await read();if(matches(value))return value;if(Date.now()>until)throw new Error('Expected task state was not reached.');await new Promise(resolve=>setTimeout(resolve,25));}}

test('task routes require host authentication, current board revisions and matching provider/worktree bindings',async t=>{
  const f=await apiFixture(t);
  assert.equal((await fetch(f.url+'/task-runs')).status,401);
  assert.equal((await f.create({root:f.temporary})).status,403);
  assert.equal((await f.create({noteRevision:'stale'})).status,409);
  assert.equal((await f.create({checks:[{label:'Invalid shell',executable:'npm.cmd',args:['test']}]})).status,400);
  const id=randomUUID(),created=await f.create({id});assert.equal(created.status,200);const run:TaskRun=await created.json();assert.ok(run.worktree);
  assert.equal(run.noteSnapshot?.description,f.board.notes[0].description);assert.equal(run.noteSnapshot?.title,f.board.notes[0].title);
  const body={id:randomUUID(),cwd:f.source,text:'Synthetic prompt',provider:'claude',taskRunId:run.id,taskRunRevision:run.revision};
  assert.equal((await f.request('/jobs',body)).status,409,'source cwd cannot execute an isolated run');
  const wrong:TaskRun=await(await f.create({provider:'codex'})).json();assert.equal((await f.request('/jobs',{...body,id:randomUUID(),cwd:wrong.worktree!.cwd,taskRunId:wrong.id,taskRunRevision:wrong.revision})).status,409);
  const jobId=randomUUID();assert.equal((await f.request('/jobs',{...body,id:jobId,cwd:run.worktree!.cwd})).status,200);await waitFor(()=>f.jobs.get(jobId).status!=='running');assert.equal(f.starts.at(-1).cwd,run.worktree!.cwd);
  assert.equal((await f.request('/jobs',{...body,id:jobId,cwd:f.source})).status,409,'job retry cannot point at another project');
  assert.equal((await f.request('/jobs',{...body,id:jobId,cwd:run.worktree!.cwd,taskRunId:wrong.id})).status,409,'job retry cannot bind another task');
  assert.equal((await f.request('/jobs',{...body,id:jobId,cwd:run.worktree!.cwd})).status,200,'same task retry returns its existing job');
  await f.app.taskRuntime!.synchronize();const state:TaskRun=await(await f.request(`/task-runs/${run.id}`)).json();assert.equal(state.jobId,jobId);assert.equal(state.stage,'checks');
  f.board.notes[0].title='Changed synthetic title';await writeFile(f.boardFile,JSON.stringify(f.board));
  const retry=await f.request('/task-runs',{id,boardId:f.boardId,noteId:f.noteId,root:f.source,noteRevision:run.noteRevision,provider:'claude'});assert.equal(retry.status,200);const retried:TaskRun=await retry.json();assert.equal(retried.title,'Synthetic change');assert.deepEqual(retried.noteSnapshot,run.noteSnapshot);
});

test('task review includes committed, staged and untracked files from its pinned baseline',async t=>{
  const f=await apiFixture(t),run:TaskRun=await(await f.create()).json(),cwd=run.worktree!.cwd;
  await writeFile(path.join(cwd,'code.txt'),'committed task change\n');fixtureGit(cwd,'add','code.txt');fixtureGit(cwd,'commit','-m','Synthetic task result');
  await writeFile(path.join(cwd,'staged.txt'),'staged task result\n');fixtureGit(cwd,'add','staged.txt');await writeFile(path.join(cwd,'untracked.txt'),'new task result\n');
  await writeFile(path.join(f.source,'source-only.txt'),'source branch addition\n');fixtureGit(f.source,'add','source-only.txt');fixtureGit(f.source,'commit','-m','Independent source change');
  const response=await f.request(`/task-runs/${run.id}/review`);assert.equal(response.status,200);const review=await response.json();
  assert.equal(review.base,run.worktree!.baseCommit);assert.deepEqual(review.files.map((file:any)=>file.path).sort(),['code.txt','staged.txt','untracked.txt']);
  const diff=await(await f.request(`/task-runs/${run.id}/review?file=untracked.txt`)).json();assert.match(diff.patch,/\+new task result/);
  assert.equal((await f.request(`/task-runs/${run.id}/review?file=source-only.txt`)).status,404);
  const sessionId=randomUUID();f.sessions.push({sessionId,summary:'Task chat',cwd,lastModified:Date.now()});
  const sessions=await(await f.request('/sessions?provider=claude')).json();assert.equal(sessions.find((session:any)=>session.sessionId===sessionId)?.readOnly,false);
  assert.equal((await f.request(`/sessions/${sessionId}/messages?provider=claude`)).status,200);
});

test('manual checks return a running response promptly, report evidence and require explicit approval',async t=>{
  const f=await apiFixture(t);let run:TaskRun=await(await f.create()).json();run=await finishJob(f.app.taskRuntime!.runs,run,randomUUID());
  const gate=path.join(f.temporary,'release-check');
  const checks=[{label:'Synthetic gated check',executable:process.execPath,args:['-e',`const fs=require('node:fs');const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(gate)})){clearInterval(timer);console.log('verified');}},10);`],timeoutMs:5000}];
  const started=await f.request(`/task-runs/${run.id}/check`,{revision:run.revision,checks});assert.equal(started.status,202);run=await started.json();assert.equal(run.verification?.status,'running');assert.equal(f.app.taskRuntime!.hasWork(),true);
  assert.equal((await f.request(`/task-runs/${run.id}/approve`,{revision:run.revision})).status,409);
  await writeFile(gate,'continue');
  const result=await eventually(()=>f.request(`/task-runs/${run.id}/result`).then(value=>value.json()),value=>value.run.stage==='review');assert.equal(result.verificationCurrent,true);assert.equal(result.approvalCurrent,false);assert.equal(result.run.verification.evidence[0].exitCode,0);
  const approval=await f.request(`/task-runs/${run.id}/approve`,{revision:result.run.revision});assert.equal(approval.status,200);assert.equal((await approval.json()).stage,'approved');
  await writeFile(path.join(run.worktree!.cwd,'code.txt'),'post-review edit\n');const stale=await(await f.request(`/task-runs/${run.id}/result`)).json();assert.equal(stale.verificationCurrent,false);assert.equal(stale.approvalCurrent,false);
});

test('automatic failed checks run once and removed projects are excluded from private run lists',async t=>{
  const f=await apiFixture(t),counter=path.join(f.temporary,'attempts');
  const checks=[{label:'Synthetic failing check',executable:process.execPath,args:['-e',`require('node:fs').appendFileSync(${JSON.stringify(counter)},'x');process.exit(4);`]}];
  let run:TaskRun=await(await f.create({checks})).json();run=await finishJob(f.app.taskRuntime!.runs,run,randomUUID());
  await f.app.taskRuntime!.synchronize();await eventually(()=>f.app.taskRuntime!.runs.get(run.id),value=>value.stage==='failed');
  for(let index=0;index<3;index++)await f.app.taskRuntime!.synchronize();assert.equal(await readFile(counter,'utf8'),'x');
  await f.app.closeTaskServices();
  const alternate=path.join(f.temporary,'alternate');await mkdir(alternate);
  const access=await createWorkspaceAccess(path.join(f.temporary,'alternate-private','workspaces.json'));
  let managed:string[]=[];
  const isolated=new TaskRuntime({directory:path.join(f.temporary,'uploads','.tasks'),roots:[alternate],access,jobs:()=>[],managedRoots:value=>{managed=value;}});await isolated.initialize();f.onCleanup(()=>isolated.close());
  assert.deepEqual(managed,[]);await assert.rejects(isolated.get(run.id),/разрешённых/);
  const express=(await import('express')).default,other=express();other.use(express.json());isolated.mount(other);other.use((error:any,_req:any,res:any,_next:any)=>res.status(error.status||500).json({error:error.message}));
  const server=other.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));f.onCleanup(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const response=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/task-runs`);assert.deepEqual((await response.json()).runs,[]);
});

test('failed verification preparation is visible and is not retried by the scheduler',async t=>{
  const f=await apiFixture(t),checks=[{label:'Synthetic check',executable:process.execPath,args:['-e','process.exit(0)']}];
  let run:TaskRun=await(await f.create({checks})).json();run=await finishJob(f.app.taskRuntime!.runs,run,randomUUID());
  await rename(run.worktree!.cwd,run.worktree!.cwd+'-preserved');await f.app.taskRuntime!.synchronize();
  const failed=await eventually(()=>f.app.taskRuntime!.runs.get(run.id),value=>value.stage==='failed');assert.match(failed.error!,/prepare verification/);
  for(let index=0;index<3;index++)await f.app.taskRuntime!.synchronize();assert.equal((await f.app.taskRuntime!.runs.get(run.id)).revision,failed.revision);
});
