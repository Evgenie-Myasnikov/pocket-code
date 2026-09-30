import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {review} from '../server/review';
test('review scopes Git diff to the chosen folder, includes untracked files and rejects unrelated paths',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-review-')),folder=path.join(root,'project');
  const git=(...args:string[])=>execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...args],{windowsHide:true,stdio:'pipe'});
  try{
    await mkdir(folder);git('init');git('config','user.name','Test');git('config','user.email','test@example.invalid');
    await writeFile(path.join(folder,'code.txt'),'before\n');await writeFile(path.join(root,'outside.txt'),'private\n');git('add','.');git('commit','-m','Fixture');
    await writeFile(path.join(folder,'code.txt'),'after\n');await writeFile(path.join(folder,'new.txt'),'new\n');await writeFile(path.join(root,'outside.txt'),'changed private\n');
    const list=await review([folder],folder,'working');assert.equal(list.files.length,2);assert(list.files.every(f=>f.path.startsWith('project/')));
    const diff=await review([folder],folder,'working',undefined,'project/code.txt');assert.match(diff.patch,/-before/);assert.match(diff.patch,/\+after/);
    const added=await review([folder],folder,'working',undefined,'project/new.txt');assert.match(added.patch,/\+new/);
    await assert.rejects(review([folder],folder,'working',undefined,'outside.txt'),/not in the current/);
    await assert.rejects(review([folder],root,'working'),/вне разрешённых/);
    git('add','project/code.txt');assert.equal((await review([folder],folder,'staged')).files.length,1);
  }finally{await rm(root,{recursive:true,force:true});}
});
