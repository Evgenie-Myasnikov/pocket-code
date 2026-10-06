import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {TaskWorktrees} from '../server/task-worktrees';
import {TaskRuns,type TaskRun} from '../server/task-runs';

export const fixtureGit=(cwd:string,...args:string[])=>execFileSync('git',['-c',`safe.directory=${cwd}`,'-C',cwd,...args],{windowsHide:true,stdio:'pipe'}).toString().trim();
export async function taskFixture(t:TestContext){
  const temporary=await realpath(await mkdtemp(path.join(os.tmpdir(),'pocket-task-fixture-')));
  const source=path.join(temporary,'source'),storage=path.join(temporary,'private','worktrees'),file=path.join(temporary,'private','task-runs.json');
  await mkdir(source);fixtureGit(source,'init','-b','main');fixtureGit(source,'config','core.autocrlf','false');fixtureGit(source,'config','user.name','Fixture');fixtureGit(source,'config','user.email','fixture@example.invalid');
  await writeFile(path.join(source,'code.txt'),'committed source\n');fixtureGit(source,'add','.');fixtureGit(source,'commit','-m','Synthetic fixture');
  const worktrees=new TaskWorktrees(storage,[source]),runs=new TaskRuns(file,worktrees);
  const cleanup:(()=>Promise<void>)[]=[];
  t.after(async()=>{for(const close of cleanup.reverse())await close();await runs.close();assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
  const input={boardId:'fixture-board',noteId:'fixture-note',noteRevision:'fixture-revision',title:'Synthetic task',provider:'claude' as const,projectPath:source,ownerId:'fixture-owner'};
  return {temporary,source,storage,file,worktrees,runs,input,onCleanup:(close:()=>Promise<void>)=>cleanup.push(close)};
}
export async function finishJob(runs:TaskRuns,run:TaskRun,jobId='fixture-job'){
  run=await runs.attachJob(run.id,run.revision,{jobId});
  return runs.observeJob(run.id,{id:jobId,status:'done',sessionId:'fixture-session'});
}
