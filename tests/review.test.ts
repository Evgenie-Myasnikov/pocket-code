import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm,access,realpath} from 'node:fs/promises';
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
    assert.equal(list.repositoryRoot,await realpath(root));assert.equal(list.projectPath,await realpath(folder));assert.equal(list.scope,'project');
    const diff=await review([folder],folder,'working',undefined,'project/code.txt');assert.match(diff.patch,/-before/);assert.match(diff.patch,/\+after/);
    const added=await review([folder],folder,'working',undefined,'project/new.txt');assert.match(added.patch,/\+new/);
    await assert.rejects(review([folder],folder,'working',undefined,'outside.txt'),/not in the current/);
    await assert.rejects(review([folder],root,'working'),/вне разрешённых/);
    git('add','project/code.txt');assert.equal((await review([folder],folder,'staged')).files.length,1);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('review resolves the selected linked worktree and nearest nested repository',async t=>{
  const temporary=await mkdtemp(path.join(os.tmpdir(),'pocket-review-context-'));
  t.after(async()=>{assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(temporary,{recursive:true,force:true});});
  const main=path.join(temporary,'main'),worktree=path.join(temporary,'feature'),nested=path.join(main,'nested');
  const git=(cwd:string,...args:string[])=>execFileSync('git',['-c',`safe.directory=${cwd}`,'-C',cwd,...args],{windowsHide:true,stdio:'pipe'});
  await mkdir(main);git(main,'init','-b','main');git(main,'config','user.name','Test');git(main,'config','user.email','test@example.invalid');
  await writeFile(path.join(main,'code.txt'),'original\n');git(main,'add','.');git(main,'commit','-m','Fixture');
  git(main,'worktree','add','-b','feature',worktree);
  await writeFile(path.join(main,'code.txt'),'main-only change\n');await writeFile(path.join(worktree,'code.txt'),'worktree-only change\n');
  const linked=await review([temporary],worktree,'working',undefined,'code.txt');
  assert.equal(linked.repositoryRoot,await realpath(worktree));assert.equal(linked.projectPath,await realpath(worktree));assert.equal(linked.current,'feature');
  assert.match(linked.patch,/\+worktree-only change/);assert.doesNotMatch(linked.patch,/main-only change/);
  await mkdir(nested);git(nested,'init','-b','nested-main');git(nested,'config','user.name','Test');git(nested,'config','user.email','test@example.invalid');
  await writeFile(path.join(nested,'code.txt'),'nested original\n');git(nested,'add','.');git(nested,'commit','-m','Nested fixture');
  await writeFile(path.join(nested,'code.txt'),'nested-only change\n');
  const inside=await review([temporary],nested,'working',undefined,'code.txt');
  assert.equal(inside.repositoryRoot,await realpath(nested));assert.equal(inside.current,'nested-main');assert.match(inside.patch,/\+nested-only change/);assert.doesNotMatch(inside.patch,/main-only change/);
});

test('review treats project and selected file names as literal paths',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-review-literal-'));
  t.after(async()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});});
  const folder=path.join(root,'project[1]'),other=path.join(root,'project1');
  const git=(...args:string[])=>execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...args],{windowsHide:true,stdio:'pipe'});
  await mkdir(folder);await mkdir(other);git('init');git('config','user.name','Test');git('config','user.email','test@example.invalid');
  for(const directory of [folder,other])for(const filename of ['code[1].txt','code1.txt'])await writeFile(path.join(directory,filename),'original\n');
  git('add','.');git('commit','-m','Fixture');
  await writeFile(path.join(folder,'code[1].txt'),'selected change\n');await writeFile(path.join(folder,'code1.txt'),'other file change\n');await writeFile(path.join(other,'code[1].txt'),'other folder change\n');
  const scoped=await review([root],folder,'working',undefined,'project[1]/code[1].txt');
  assert.equal(scoped.scope,'project[1]');assert.deepEqual(scoped.files.map(file=>file.path).sort(),['project[1]/code1.txt','project[1]/code[1].txt'].sort());
  assert.match(scoped.patch,/\+selected change/);assert.doesNotMatch(scoped.patch,/other file change|other folder change/);
});

test('review never executes configured clean or process filters',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-filter-'));
  const git=(...args:string[])=>execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...args],{windowsHide:true,stdio:'pipe'});
  try{
    git('init');git('config','user.name','Test');git('config','user.email','test@example.invalid');
    await writeFile(path.join(root,'sample.txt'),'before\n');git('add','.');git('commit','-m','Fixture');
    await writeFile(path.join(root,'filter.cjs'),"require('fs').writeFileSync('side-effect.txt','executed');process.stdin.pipe(process.stdout)");
    await writeFile(path.join(root,'.gitattributes'),'sample.txt filter=probe\n');
    git('config','filter.probe.clean','node filter.cjs');git('config','filter.probe.process','node filter.cjs');git('config','filter.probe.required','true');
    await writeFile(path.join(root,'sample.txt'),'after\n');
    const diff=await review([root],root,'working',undefined,'sample.txt');assert.match(diff.patch,/\+after/);
    await assert.rejects(access(path.join(root,'side-effect.txt')));
    assert.equal(git('config','filter.probe.clean').toString().trim(),'node filter.cjs');
  }finally{await rm(root,{recursive:true,force:true});}
});
