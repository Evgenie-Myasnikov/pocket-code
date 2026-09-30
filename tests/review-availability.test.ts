import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
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
