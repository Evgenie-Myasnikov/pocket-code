import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {linkBoardVersions} from '../server/board-version-links.js';
import {createProjectBoard,updateProjectBoard} from '../server/project-board.js';

test('versions link to existing recorded branches, persist on save and reject imaginary refs',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'board-version-'));
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init');git('-c','user.name=Synthetic','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');git('branch','release/1.2.3');
  await writeFile(path.join(root,'CHANGELOG.md'),'## 1.2.3 (2026-01-01)\n- Source branch [release/1.2.3](https://github.com/example/demo/tree/release/1.2.3).\n');
  assert.deepEqual(await linkBoardVersions(root,['1.2.3','2.0.0']),{'1.2.3':'release/1.2.3'});
  assert.deepEqual(await linkBoardVersions(root,['2.0.0'],{'2.0.0':'missing'}),{});
  git('update-ref','refs/remotes/origin/release/2.0.0',git('rev-parse','HEAD'));
  assert.deepEqual(await linkBoardVersions(root,['2.0.0']),{});
  git('tag','v2.0.0');
  assert.deepEqual(await linkBoardVersions(root,['2.0.0']),{'2.0.0':'release/2.0.0'});
  const board=await createProjectBoard(root,[],'en'),saved=await updateProjectBoard(root,board.repositoryRevision,board.notes,['1.2.3'],[]);
  assert.equal(saved.versionBranches['1.2.3'],'release/1.2.3');
  assert.throws(()=>execFileSync(process.execPath,[path.resolve('scripts/release-source.mjs'),'--require-clean'],{cwd:root,stdio:'pipe',windowsHide:true}));
  const source=JSON.parse(execFileSync(process.execPath,[path.resolve('scripts/release-source.mjs')],{cwd:root,encoding:'utf8',windowsHide:true}));assert.equal(source.branch,git('branch','--show-current'));assert.equal(source.commit,git('rev-parse','HEAD'));
  git('checkout','--detach');assert.throws(()=>execFileSync(process.execPath,[path.resolve('scripts/release-source.mjs')],{cwd:root,stdio:'pipe',windowsHide:true}));
 }finally{await rm(root,{recursive:true,force:true});}
});
