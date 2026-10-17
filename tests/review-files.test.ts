import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { review } from '../server/review.js';

async function repository(t: test.TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-review-files-'));
  t.after(async () => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(root, { recursive: true, force: true }); });
  const git = (...args: string[]) => execFileSync('git', ['-c', `safe.directory=${root}`, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-C', root, ...args], { windowsHide: true, stdio: 'pipe' });
  git('init', '-b', 'main');
  await writeFile(path.join(root, 'kept.ts'), 'export const value = 1;\n');
  await writeFile(path.join(root, 'removed.ts'), 'old\n');
  await writeFile(path.join(root, 'spaced.ts'), 'if (ready) {\n  run();\n}\n');
  git('add', '.'); git('commit', '-m', 'Fixture');
  return { root, git };
}

test('the file list reports status, real line counts for new files and generated files', async t => {
  const { root, git } = await repository(t);
  await writeFile(path.join(root, 'kept.ts'), 'export const value = 2;\n');
  await rm(path.join(root, 'removed.ts'));
  await writeFile(path.join(root, 'component.tsx'), Array.from({ length: 15 }, (_, i) => `line ${i}`).join('\n') + '\n');
  await writeFile(path.join(root, 'image.png'), Buffer.from([137, 80, 78, 71, 0, 1, 2]));
  await writeFile(path.join(root, 'package-lock.json'), '{}\n');
  await writeFile(path.join(root, '.gitattributes'), 'build/** linguist-generated\n');
  await writeFile(path.join(root, 'staged.ts'), 'staged\n'); git('add', 'staged.ts');
  const { files, fingerprint } = await review([root], root, 'working');
  const byPath = new Map(files.map(file => [file.path, file]));
  assert.equal(byPath.get('kept.ts')?.status, 'modified');
  assert.equal(byPath.get('removed.ts')?.status, 'deleted');
  assert.equal(byPath.get('staged.ts')?.status, 'added');
  assert.deepEqual([byPath.get('component.tsx')?.status, byPath.get('component.tsx')?.added], ['untracked', 15], 'a new file is not shown as +0');
  assert.equal(byPath.get('image.png')?.binary, true);
  assert.equal(byPath.get('package-lock.json')?.generated, true);
  assert.equal(byPath.get('kept.ts')?.generated, undefined);
  assert.match(fingerprint, /^[a-f0-9]{16}$/);
  assert.ok(files.every(file => typeof file.fingerprint === 'string' && file.fingerprint.length === 16));
});

test('the fingerprint changes only when a file changes, even with the same line counts', async t => {
  const { root } = await repository(t);
  await writeFile(path.join(root, 'kept.ts'), 'export const value = 2;\n');
  const first = await review([root], root, 'working');
  const again = await review([root], root, 'working');
  assert.equal(again.fingerprint, first.fingerprint, 'an idle poll keeps the same fingerprint');
  await new Promise(resolve => setTimeout(resolve, 20));
  await writeFile(path.join(root, 'kept.ts'), 'export const value = 3;\n');
  const edited = await review([root], root, 'working');
  assert.equal(edited.files[0].added, first.files[0].added);
  assert.notEqual(edited.fingerprint, first.fingerprint, 'a second edit with the same +/- still refreshes the patch');
  assert.notEqual(edited.files[0].fingerprint, first.files[0].fingerprint);
});

test('a single file request skips the branch list and honours whitespace and context options', async t => {
  const { root } = await repository(t);
  await writeFile(path.join(root, 'spaced.ts'), 'if (ready) {\n    run();\n}\n');
  await writeFile(path.join(root, 'kept.ts'), 'export const value = 2;\n');
  const single = await review([root], root, 'working', undefined, 'spaced.ts');
  assert.deepEqual(single.branches, []);
  assert.match(single.patch, /^-  run\(\);$/m);
  const ignored = await review([root], root, 'working', undefined, 'spaced.ts', { whitespace: true });
  assert.doesNotMatch(ignored.patch, /^-  run/m, 'indentation-only changes disappear when whitespace is ignored');
  const list = await review([root], root, 'working', undefined, undefined, { whitespace: true });
  assert.deepEqual(list.files.find(file => file.path === 'spaced.ts') && [list.files.find(file => file.path === 'spaced.ts')!.added, list.files.find(file => file.path === 'spaced.ts')!.removed], [0, 0]);
  const narrow = await review([root], root, 'working', undefined, 'spaced.ts', { context: 0 });
  assert.doesNotMatch(narrow.patch, /^ if \(ready\)/m);
  await assert.rejects(review([root], root, 'branch', '--output=x', 'kept.ts'), /existing base branch/);
  assert.equal(await readFile(path.join(root, 'kept.ts'), 'utf8'), 'export const value = 2;\n');
});
