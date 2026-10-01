import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {GitProjects} from '../server/git-projects';

async function fixture(t:any){
  const temp=await mkdtemp(path.join(os.tmpdir(),'pocket-git-discovery-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  const root=path.join(temp,'projects');await mkdir(root);
  return {temp,root:await realpath(root)};
}
async function repo(folder:string){await mkdir(path.join(folder,'.git'),{recursive:true});await writeFile(path.join(folder,'.git','HEAD'),'ref: refs/heads/main\n');}

test('discovers repositories and worktrees without a chat, including nested repositories',async t=>{
  const {root}=await fixture(t),first=path.join(root,'first'),nested=path.join(first,'nested'),worktree=path.join(root,'worktree');
  await repo(first);await repo(nested);await mkdir(worktree);await writeFile(path.join(worktree,'.git'),'gitdir: ../first/.git/worktrees/worktree\n');
  await mkdir(path.join(root,'not-a-repo','.git'),{recursive:true});
  await repo(path.join(root,'node_modules','ignored'));
  const discovery=new GitProjects([root]);
  assert.deepEqual(await discovery.list(),[first,nested,worktree].sort((a,b)=>a.localeCompare(b)));
});

test('bounded batches make progress and concurrent callers share the same scan',async t=>{
  const {root}=await fixture(t);for(let i=0;i<5;i++)await repo(path.join(root,`project-${i}`));
  const discovery=new GitProjects([root],{batch:2,budgetMs:1000,ttlMs:300000});
  const first=discovery.list(),same=discovery.list();assert.equal(first,same);
  assert.equal((await first).length,1);
  assert.equal((await discovery.list()).length,3);
  assert.equal((await discovery.list()).length,5);
  assert.equal((await discovery.list()).length,5);
});

test('does not traverse junctions or return cached projects redirected outside roots',async t=>{
  const {root,temp}=await fixture(t),inside=path.join(root,'inside'),outside=path.join(temp,'outside');
  await repo(inside);await repo(outside);
  await symlink(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');
  const discovery=new GitProjects([root]);assert.deepEqual(await discovery.list(),[inside]);
  await rm(inside,{recursive:true});await symlink(outside,inside,process.platform==='win32'?'junction':'dir');
  assert.deepEqual(await discovery.list(),[]);
});

test('refresh discovers additions and removes deleted git markers',async t=>{
  const {root}=await fixture(t),first=path.join(root,'first'),second=path.join(root,'second');await repo(first);
  const discovery=new GitProjects([root],{batch:512,budgetMs:1000,ttlMs:0});
  assert.deepEqual(await discovery.list(),[first]);await rm(path.join(first,'.git'),{recursive:true});await repo(second);
  assert.deepEqual(await discovery.list(),[second]);
});
