import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { reviewAvailability } from '../server/review.js';

test('Review is available only for actual scoped working or branch changes', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-review-availability-'));
  t.after(async () => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(root, { recursive: true, force: true }); });
  assert.deepEqual(await reviewAvailability([root], root), { available: false, mode: 'working' });
  const git = (...args: string[]) => execFileSync('git', ['-c', `safe.directory=${root}`, '-C', root, ...args], { windowsHide: true, stdio: 'pipe' });
  git('init', '-b', 'main'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  const folder = path.join(root, 'project'); await mkdir(folder);
  await writeFile(path.join(folder, 'code.txt'), 'original\n'); await writeFile(path.join(root, 'outside.txt'), 'original\n');
  git('add', '.'); git('commit', '-m', 'Initial');
  assert.equal((await reviewAvailability([root], folder)).available, false);
  await writeFile(path.join(root, 'outside.txt'), 'outside change\n');
  assert.equal((await reviewAvailability([root], folder)).available, false, 'unrelated changes must not show Review');
  await writeFile(path.join(folder, 'new.txt'), 'new\n');
  assert.deepEqual(await reviewAvailability([root], folder), { available: true, mode: 'working' });
  git('checkout', '-b', 'feature'); git('add', '.');
  assert.equal((await reviewAvailability([root], folder)).available, true, 'staged files are reviewable');
  git('commit', '-m', 'Change');
  assert.deepEqual(await reviewAvailability([root], folder), { available: true, mode: 'branch' });
  await assert.rejects(reviewAvailability([folder], root), /вне разрешённых/);
});

test('availability handles unborn repositories and never invokes content filters', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-review-available-safe-'));
  t.after(async () => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(root, { recursive: true, force: true }); });
  const git = (...args: string[]) => execFileSync('git', ['-c', `safe.directory=${root}`, '-C', root, ...args], { windowsHide: true, stdio: 'pipe' });
  git('init', '-b', 'main');
  assert.equal((await reviewAvailability([root], root)).available, false);
  await writeFile(path.join(root, 'code.txt'), 'original\n');
  assert.equal((await reviewAvailability([root], root)).available, true, 'untracked file in an unborn repository');
  git('add', '.');
  assert.equal((await reviewAvailability([root], root)).available, true, 'staged file before first commit');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Fixture');
  await writeFile(path.join(root, 'filter.cjs'), "require('fs').writeFileSync('side-effect.txt','executed');process.stdin.pipe(process.stdout)");
  await writeFile(path.join(root, '.gitattributes'), 'code.txt filter=probe\n');
  git('config', 'filter.probe.clean', 'node filter.cjs'); git('config', 'filter.probe.process', 'node filter.cjs'); git('config', 'filter.probe.required', 'true');
  await writeFile(path.join(root, 'code.txt'), 'modified\n');
  assert.deepEqual(await reviewAvailability([root], root), { available: true, mode: 'working' });
  await assert.rejects(access(path.join(root, 'side-effect.txt')));
});

test('availability uses existence checks and inspects Git context once for a clean feature branch', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-review-available-work-'));
  const repo = path.join(root, 'repo'), trace = path.join(root, 'trace.jsonl'); await mkdir(repo);
  t.after(async () => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(root, { recursive: true, force: true }); });
  const git = (...args: string[]) => execFileSync('git', ['-c', `safe.directory=${repo}`, '-C', repo, ...args], { windowsHide: true, stdio: 'pipe' });
  git('init', '-b', 'main'); await writeFile(path.join(repo, 'code.txt'), 'original\n'); git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Fixture'); git('checkout', '-b', 'feature');
  const previous = process.env.GIT_TRACE2_EVENT; process.env.GIT_TRACE2_EVENT = trace.replaceAll('\\', '/');
  try { assert.equal((await reviewAvailability([repo], repo)).available, false); }
  finally { if (previous === undefined) delete process.env.GIT_TRACE2_EVENT; else process.env.GIT_TRACE2_EVENT = previous; }
  const commands = (await readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line)).filter(event => event.event === 'start').map(event => event.argv as string[]);
  assert.equal(commands.filter(args => args.includes('config')).length, 1);
  assert.equal(commands.filter(args => args.includes('diff')).length, 2);
  assert.ok(commands.filter(args => args.includes('diff')).every(args => args.includes('--quiet') && !args.includes('--numstat')));
  assert.ok(commands.length <= 7, `expected no duplicate metadata scan, got ${commands.length} processes`);
});
