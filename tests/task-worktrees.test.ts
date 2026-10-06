import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,symlink,access} from 'node:fs/promises';
import path from 'node:path';
import {TaskWorktrees} from '../server/task-worktrees';
import {taskFixture,fixtureGit} from './task-run-fixture';

test('isolated tasks start at verified HEAD and preserve dirty source files',async t=>{
  const {source,worktrees}=await taskFixture(t),base=fixtureGit(source,'rev-parse','HEAD');
  await writeFile(path.join(source,'code.txt'),'uncommitted user work\n');await writeFile(path.join(source,'draft.txt'),'untracked user work\n');
  const task=await worktrees.create(randomUUID(),source);
  assert.equal(task.baseCommit,base);assert.equal(task.branch,`pocket-code/task-${task.runId}`);
  assert.equal(await readFile(path.join(task.cwd,'code.txt'),'utf8'),'committed source\n');await assert.rejects(access(path.join(task.cwd,'draft.txt')));
  await writeFile(path.join(task.cwd,'code.txt'),'isolated change\n');
  assert.equal(await readFile(path.join(source,'code.txt'),'utf8'),'uncommitted user work\n');
  assert.equal(fixtureGit(source,'branch','--show-current'),'main');assert.equal(fixtureGit(source,'rev-parse','HEAD'),base);
});

test('concurrent task creation is isolated and same in-flight run coalesces',async t=>{
  const {source,worktrees}=await taskFixture(t),id=randomUUID();
  const [first,retry,second]=await Promise.all([worktrees.create(id,source),worktrees.create(id,source),worktrees.create(randomUUID(),source)]);
  assert.deepEqual(first,retry);assert.notEqual(first.cwd,second.cwd);assert.notEqual(first.branch,second.branch);
  await writeFile(path.join(first.cwd,'new.txt'),'first');await assert.rejects(access(path.join(second.cwd,'new.txt')));
});

test('existing branches/directories are preserved and never forced into a task',async t=>{
  const {source,worktrees}=await taskFixture(t),branchId=randomUUID();
  fixtureGit(source,'branch',`pocket-code/task-${branchId}`);
  await assert.rejects(worktrees.create(branchId,source),/branch already exists/);
  assert.ok(fixtureGit(source,'show-ref','--verify',`refs/heads/pocket-code/task-${branchId}`));
  const task=await worktrees.create(randomUUID(),source);await writeFile(path.join(task.cwd,'keep.txt'),'keep');
  await assert.rejects(worktrees.create(task.runId,source),/directory already exists/);
  assert.equal(await readFile(path.join(task.cwd,'keep.txt'),'utf8'),'keep');
});

test('worktree validation rejects non-Git, unshared parent, changed branch and redirected paths',async t=>{
  const {source,storage,temporary,worktrees}=await taskFixture(t),empty=path.join(temporary,'empty');await mkdir(empty);
  await assert.rejects(new TaskWorktrees(storage,[empty]).create(randomUUID(),empty),/committed HEAD/);
  const subfolder=path.join(source,'nested');await mkdir(subfolder);
  await assert.rejects(new TaskWorktrees(storage,[subfolder]).create(randomUUID(),subfolder),/разрешённых/);
  await assert.rejects(worktrees.create('../escape',source),/identifier/);
  const task=await worktrees.create(randomUUID(),source);
  await assert.rejects(worktrees.verify({...task,cwd:source}),/owned task/);
  fixtureGit(task.cwd,'checkout','--detach');await assert.rejects(worktrees.verify(task),/another branch/);
  fixtureGit(task.cwd,'checkout',task.branch);
  const saved=task.cwd+'-preserved';await rename(task.cwd,saved);await symlink(source,task.cwd,'junction');
  await assert.rejects(worktrees.verify(task),/redirected/);
});

test('snapshot fingerprints committed, staged, working and untracked content',async t=>{
  const {source,worktrees}=await taskFixture(t),task=await worktrees.create(randomUUID(),source);
  const original=await worktrees.snapshot(task);assert.equal(original.baseCommit,original.headCommit);
  await writeFile(path.join(task.cwd,'code.txt'),'changed\n');const changed=await worktrees.fingerprint(task);assert.notEqual(changed,original.fingerprint);
  fixtureGit(task.cwd,'add','code.txt');assert.notEqual(await worktrees.fingerprint(task),changed);
  fixtureGit(task.cwd,'commit','-m','Synthetic task change');const committed=await worktrees.snapshot(task);assert.notEqual(committed.headCommit,original.headCommit);
  await writeFile(path.join(task.cwd,'new.txt'),'new');const untracked=await worktrees.fingerprint(task);assert.notEqual(untracked,committed.fingerprint);
  await writeFile(path.join(task.cwd,'new.txt'),'newer');assert.notEqual(await worktrees.fingerprint(task),untracked);
});

test('creating and fingerprinting a worktree does not execute Git hooks or filters',async t=>{
  const {source,worktrees,temporary}=await taskFixture(t),marker=path.join(temporary,'unexpected-filter');
  await writeFile(path.join(source,'.gitattributes'),'code.txt filter=fixture\n');fixtureGit(source,'add','.gitattributes');fixtureGit(source,'commit','-m','Synthetic attributes');
  const script=path.join(temporary,'filter.cjs');await writeFile(script,`require('node:fs').writeFileSync(${JSON.stringify(marker)},'executed');process.stdin.pipe(process.stdout);`);
  const command=`node "${script.replaceAll('\\','/')}"`;
  for(const kind of ['clean','smudge','process'])fixtureGit(source,'config',`filter.fixture.${kind}`,command);
  fixtureGit(source,'config','filter.fixture.required','true');
  const hooks=path.join(temporary,'hooks');await mkdir(hooks);await writeFile(path.join(hooks,'post-checkout'),`#!/bin/sh\nprintf executed > '${marker.replaceAll('\\','/')}'\n`,{mode:0o755});fixtureGit(source,'config','core.hooksPath',hooks);
  const task=await worktrees.create(randomUUID(),source);await writeFile(path.join(task.cwd,'code.txt'),'changed\n');await worktrees.snapshot(task);
  await assert.rejects(access(marker));assert.equal(fixtureGit(source,'config','filter.fixture.clean'),command);
});
