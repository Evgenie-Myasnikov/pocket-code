import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverCodex } from '../server/codex-rpc.js';
import { CodexRuntime, compareCodexVersions, privateCodexExecutables } from '../server/codex-runtime.js';

const exe = process.platform === 'win32' ? 'codex.exe' : 'codex';
async function touch(file: string) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, ''); }

test('compares Codex versions numerically', () => {
  assert.ok(compareCodexVersions('0.171.0', '0.153.4') > 0);
  assert.ok(compareCodexVersions('0.99.0', '0.153.4') < 0);
  assert.equal(compareCodexVersions('1.2.3', '1.2.3'), 0);
});

test('discovery prefers the newest installed Codex over the first one found', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-codex-'));
  try {
    const old = path.join(root, 'old', exe), fresh = path.join(root, 'fresh', exe);
    await touch(old); await touch(fresh);
    const env = { PATH: [path.dirname(old), path.dirname(fresh)].join(path.delimiter) };
    const versions: Record<string, string> = { [old]: '0.153.4', [fresh]: '0.171.0' };
    assert.equal(await discoverCodex(env, async file => versions[file]), fresh);
    // An unreadable version never wins over a known one, and never blocks discovery.
    assert.equal(await discoverCodex(env, async file => file === old ? '0.153.4' : undefined), old);
    assert.equal(await discoverCodex(env, async () => undefined), old);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('discovery finds the current npm layout vendor/<arch>/bin/codex.exe', { skip: process.platform !== 'win32' }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-codex-'));
  try {
    const file = path.join(root, 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
    await touch(file);
    assert.equal(await discoverCodex({ PATH: root }, async () => '0.171.0'), file);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('private runtime installs the latest release once and is preferred by discovery', { skip: process.platform !== 'win32' }, async () => {
  const local = await mkdtemp(path.join(os.tmpdir(), 'pocket-codex-'));
  try {
    const env = { LOCALAPPDATA: local, PATH: '' };
    const calls: string[][] = [];
    const runtime = new CodexRuntime({ env, latest: async () => '0.171.0', npmCli: 'npm-cli.js', node: 'node', run: async (_file, args) => {
      calls.push(args);
      const stage = args[args.indexOf('--prefix') + 1];
      await touch(privateCodexExecutables(stage)[0]);
      return '';
    } });
    assert.deepEqual(await runtime.update(0), { state: 'installed', version: '0.171.0' });
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes('@openai/codex@0.171.0'));
    const installed = privateCodexExecutables(path.join(local, 'Pocket Code', 'runtime', 'codex', '0.171.0'))[0];
    await access(installed);
    assert.deepEqual(await runtime.update(0), { state: 'current', version: '0.171.0' });
    assert.equal(calls.length, 1, 'an installed version is not downloaded again');
    assert.equal(await discoverCodex(env, async () => '0.171.0'), installed);
    assert.deepEqual(await new CodexRuntime({ env: { ...env, POCKET_CODEX_AUTO_UPDATE: '0' } }).update(0), { state: 'disabled' });
  } finally { await rm(local, { recursive: true, force: true }); }
});

test('a failed install reports failure and leaves no partial version', { skip: process.platform !== 'win32' }, async () => {
  const local = await mkdtemp(path.join(os.tmpdir(), 'pocket-codex-'));
  try {
    const runtime = new CodexRuntime({ env: { LOCALAPPDATA: local }, latest: async () => '0.171.0', npmCli: 'npm-cli.js', node: 'node', run: async () => { throw new Error('offline'); } });
    assert.deepEqual(await runtime.update(0), { state: 'failed' });
    await assert.rejects(access(path.join(local, 'Pocket Code', 'runtime', 'codex', '0.171.0')));
  } finally { await rm(local, { recursive: true, force: true }); }
});
