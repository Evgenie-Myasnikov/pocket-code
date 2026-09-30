import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error Standalone dependency-free deployment worker intentionally has no generated declarations.
import { runHostUpdate, validateWorkerConfig } from '../scripts/host-update-worker.mjs';

const testToken = 'host-update-test-key-'.repeat(3);
async function fixture(t: any) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'pocket-host-worker-'));
  const dataDir = path.join(temp, 'data'), previousDir = path.join(temp, 'previous'), stagedDir = path.join(dataDir, 'host', 'versions', '1.1.0-hash', 'app');
  for (const [directory, version] of [[previousDir, '1.0.0'], [stagedDir, '1.1.0']]) {
    await mkdir(path.join(directory, 'server'), { recursive: true });
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'pocket-code', version }));
    await writeFile(path.join(directory, 'server', 'index.ts'), '// Synthetic test entry; never executed.');
  }
  await writeFile(path.join(dataDir, 'connection-key.txt'), testToken);
  const config = { version: '1.1.0', stagedDir, previousDir, nodeExecutable: process.execPath, dataDir, statusFile: path.join(dataDir, 'host', 'status.json'), roots: [previousDir], host: '127.0.0.1', port: 4318, oldPid: 43210, publicUrl: 'https://synthetic.example.test', tunnelPid: 43211 };
  t.after(async () => { assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(temp, { recursive: true, force: true }); });
  const pointerFile = path.join(dataDir, 'host', 'current.json');
  await writeFile(pointerFile, JSON.stringify({ directory: previousDir, version: '1.0.0' }));
  return { config, temp, status: async () => JSON.parse(await readFile(config.statusFile, 'utf8')), pointer: async () => JSON.parse(await readFile(pointerFile, 'utf8')) };
}
function transport(config: any, options: { busy?: boolean; stale?: boolean; stuckOld?: boolean; failNew?: boolean; failRollback?: boolean; throwNew?: boolean; loseHandoff?: boolean } = {}) {
  let clock = 0, active: { pid: number; version: string } | null = { pid: options.stale ? config.oldPid + 9 : config.oldPid, version: '1.0.0' };
  const starts: any[] = [], killed: number[] = [], requests: any[] = [];
  const hooks = {
    env: { POCKET_INTERNET: '1', POCKET_EXISTING_TUNNEL_PID: 'stale-pid', POCKET_EXISTING_TUNNEL_URL: 'https://stale.example.test', POCKET_JIRA_MODE: 'existing', CUSTOM_SETTING: 'retained' },
    now: () => clock, sleep: async (ms: number) => { clock += ms; }, listening: async () => active !== null,
    timing: { shutdownMs: 15, startupMs: 15, pollMs: 1, requestMs: 100, handoffMs: 100 },
    fetch: async (url: string, init: any) => {
      requests.push({ url, init }); assert.equal(init.headers.Authorization, `Bearer ${testToken}`);
      assert.equal(init.redirect, 'error'); assert.ok(url.startsWith('http://127.0.0.1:4318/api/'));
      if (url.endsWith('/handoff')) {
        assert.deepEqual(JSON.parse(init.body), { targetVersion: '1.1.0', expectedPid: config.oldPid });
        if (options.busy) return { status: 409, ok: false, json: async () => ({ error: 'private host details' }) };
        if (!options.stuckOld) active = null;
        if (options.loseHandoff) throw new Error('Private network details');
        return { status: 200, ok: true, json: async () => ({ accepted: true }) };
      }
      return { status: active ? 200 : 503, ok: !!active, json: async () => ({ version: active?.version, processId: active?.pid }) };
    },
    spawn: (executable: string, args: string[], spawnOptions: any) => {
      starts.push({ executable, args, options: spawnOptions });
      if (options.throwNew && starts.length === 1) throw new Error('Private spawn details');
      const child = new EventEmitter() as EventEmitter & { pid: number; unref(): void; kill(signal: string): boolean };
      child.pid = 44000 + starts.length;
      const newVersion = spawnOptions.cwd === config.stagedDir;
      active = { pid: child.pid, version: newVersion ? '1.1.0' : '1.0.0' };
      // A listener with the right version but a different PID must never count as our healthy child.
      if (newVersion ? options.failNew : options.failRollback) active.pid += 50;
      child.unref = () => {};
      child.kill = signal => { assert.equal(signal, 'SIGKILL'); killed.push(child.pid); active = null; child.emit('exit', null, signal); return true; };
      return child;
    },
  };
  return { hooks, starts, killed, requests };
}

test('host worker hands off gracefully and verifies the exact new process', async t => {
  const { config, status, pointer } = await fixture(t), io = transport(config);
  await runHostUpdate(config, io.hooks);
  assert.equal(io.starts.length, 1); assert.deepEqual(io.killed, []);
  const launch = io.starts[0];
  assert.equal(launch.executable, process.execPath); assert.deepEqual(launch.args, ['--import', 'tsx', 'server/index.ts']);
  assert.equal(launch.options.cwd, config.stagedDir); assert.equal(launch.options.shell, false); assert.equal(launch.options.windowsHide, true); assert.equal(launch.options.detached, true);
  assert.equal(launch.options.env.POCKET_EXISTING_TUNNEL_URL, config.publicUrl); assert.equal(launch.options.env.POCKET_EXISTING_TUNNEL_PID, String(config.tunnelPid));
  assert.equal(launch.options.env.POCKET_DATA_DIR, config.dataDir); assert.deepEqual(JSON.parse(launch.options.env.POCKET_ROOTS), config.roots);
  assert.equal(launch.options.env.CUSTOM_SETTING, 'retained'); assert.equal(launch.options.env.POCKET_OPEN_PAIRING, '0');
  const result = await status(); assert.equal(result.state, 'updated'); assert.equal(result.currentVersion, '1.1.0'); assert.equal(result.targetVersion, '1.1.0');
  assert.ok(!JSON.stringify(result).includes(testToken));
  assert.deepEqual(await pointer(), { directory: config.stagedDir, version: config.version });
  assert.ok(!(await readdir(path.dirname(config.statusFile))).some(name => name.endsWith('.tmp')));
});

test('busy handoff waits without launching or stopping any process', async t => {
  const { config, status, pointer } = await fixture(t), io = transport(config, { busy: true });
  await runHostUpdate(config, io.hooks);
  assert.equal((await status()).state, 'waiting'); assert.equal(io.starts.length, 0); assert.deepEqual(io.killed, []);
  assert.deepEqual(await pointer(), { directory: config.previousDir, version: '1.0.0' });
});

test('stale PID or an old host that stays alive is never forcibly stopped', async t => {
  const { config, status } = await fixture(t);
  for (const options of [{ stale: true }, { stuckOld: true }]) {
    const io = transport(config, options); await runHostUpdate(config, io.hooks);
    assert.equal((await status()).state, 'failed'); assert.equal(io.starts.length, 0); assert.deepEqual(io.killed, []);
    if (options.stale) assert.ok(!io.requests.some(request => request.url.endsWith('/handoff')));
  }
});

test('wrong child identity triggers rollback, stopping only the owned child and preserving tunnel', async t => {
  const { config, status, pointer } = await fixture(t), io = transport(config, { failNew: true });
  await runHostUpdate(config, io.hooks);
  assert.deepEqual(io.killed, [44001]); assert.deepEqual(io.starts.map(start => start.options.cwd), [config.stagedDir, config.previousDir]);
  assert.equal(io.starts[1].options.env.POCKET_EXISTING_TUNNEL_PID, String(config.tunnelPid));
  const result = await status(); assert.equal(result.state, 'failed'); assert.equal(result.rollback, 'restored'); assert.equal(result.currentVersion, '1.0.0');
  assert.deepEqual(await pointer(), { directory: config.previousDir, version: '1.0.0' });
});

test('rollback failure cleans up only launched children and reports no running version', async t => {
  const { config, status, pointer } = await fixture(t), io = transport(config, { failNew: true, failRollback: true });
  await runHostUpdate(config, io.hooks);
  assert.deepEqual(io.killed, [44001, 44002]);
  const result = await status(); assert.equal(result.rollback, 'failed'); assert.equal(result.currentVersion, null);
  assert.ok(!JSON.stringify(result).includes('Private'));
  assert.deepEqual(await pointer(), { directory: config.previousDir, version: '1.0.0' });
});

test('spawn failure and lost accepted handoff recover the previous host', async t => {
  const { config, status } = await fixture(t);
  for (const options of [{ throwNew: true }, { loseHandoff: true }]) {
    const io = transport(config, options); await runHostUpdate(config, io.hooks);
    assert.equal((await status()).rollback, 'restored');
    assert.equal(io.starts.at(-1).options.cwd, config.previousDir);
    assert.deepEqual(io.killed, []);
  }
});

test('worker rejects path escapes, remote auth destinations, mismatched packages and unsafe PIDs', async t => {
  const { config, temp } = await fixture(t);
  for (const patch of [
    { stagedDir: config.previousDir }, { statusFile: path.join(temp, 'outside.json') }, { stagedDir: '.' },
    { host: 'example.com' }, { host: '203.0.113.2' }, { port: 0 }, { oldPid: process.pid }, { tunnelPid: config.oldPid },
    { publicUrl: 'https://name:secret@example.test' }, { version: '1.1.0; whoami' }, { version: '2.0.0' }, { roots: [] },
  ]) await assert.rejects(validateWorkerConfig({ ...config, ...patch }));
});

test('real isolated worker handoff and rollback retain the connection and managed runtime pointer', { timeout: 45_000 }, async t => {
  const cleanups: (() => Promise<void>)[] = [], children: ReturnType<typeof spawn>[] = [], junctions: string[] = [];
  t.after(async () => {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await new Promise(resolve => setTimeout(resolve, 300));
    for (const junction of junctions) await unlink(junction);
    for (const cleanup of cleanups) await cleanup();
  });
  const syntheticServer = `
    import { createServer } from 'node:http';
    import { readFileSync } from 'node:fs';
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.headers.authorization !== 'Bearer ' + process.env.POCKET_TOKEN) { res.writeHead(401); res.end('{}'); return; }
      if (req.url === '/api/health') { res.end(JSON.stringify({ version, processId: process.pid, tunnelUrl: process.env.POCKET_EXISTING_TUNNEL_URL, tunnelPid: process.env.POCKET_EXISTING_TUNNEL_PID })); return; }
      if (req.url === '/api/host-update/handoff' && req.method === 'POST') {
        let body = ''; req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          if (JSON.parse(body).expectedPid !== process.pid) { res.writeHead(409); res.end('{}'); return; }
          res.end(JSON.stringify({ accepted: true })); setTimeout(() => server.close(() => process.exit(0)), 10);
        }); return;
      }
      res.writeHead(404); res.end('{}');
    });
    server.listen(Number(process.env.POCKET_PORT), '127.0.0.1');
  `;
  async function freePort() {
    const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port; await new Promise<void>(resolve => server.close(() => resolve())); return port;
  }
  async function readHealth(port: number) {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { Authorization: `Bearer ${testToken}` }, signal: AbortSignal.timeout(1000) });
    assert.equal(response.status, 200); return response.json();
  }
  for (const brokenNewHost of [false, true]) {
    const { config, status, pointer } = await fixture({ after: (cleanup: () => Promise<void>) => cleanups.push(cleanup) });
    config.port = await freePort();
    for (const directory of [config.previousDir, config.stagedDir]) {
      const junction = path.join(directory, 'node_modules');
      await symlink(path.resolve('node_modules'), junction, process.platform === 'win32' ? 'junction' : 'dir'); junctions.push(junction);
      await writeFile(path.join(directory, 'server', 'index.ts'), brokenNewHost && directory === config.stagedDir ? 'process.exit(24);' : syntheticServer);
    }
    const env = { ...process.env, POCKET_TOKEN: testToken, POCKET_PORT: String(config.port), POCKET_INTERNET: '0', POCKET_OPEN_PAIRING: '0' };
    const old = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: config.previousDir, env, windowsHide: true, stdio: 'ignore' });
    children.push(old); assert.ok(old.pid); config.oldPid = old.pid;
    const deadline = Date.now() + 8000;
    let initial: any;
    while (Date.now() < deadline) {
      try { initial = await readHealth(config.port); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.equal(initial?.processId, old.pid, 'Synthetic original host became ready');
    await runHostUpdate(config, {
      env, timing: { startupMs: 8000, shutdownMs: 8000, pollMs: 50, requestMs: 1000 },
      spawn: (...args: Parameters<typeof spawn>) => { const child = spawn(...args); children.push(child); return child; },
    });
    const current = await readHealth(config.port), saved = await status();
    assert.notEqual(current.processId, old.pid);
    assert.equal(current.version, brokenNewHost ? '1.0.0' : '1.1.0');
    assert.equal(current.tunnelUrl, config.publicUrl); assert.equal(current.tunnelPid, String(config.tunnelPid));
    assert.equal(saved.state, brokenNewHost ? 'failed' : 'updated');
    if (brokenNewHost) assert.equal(saved.rollback, 'restored');
    assert.deepEqual(await pointer(), { directory: brokenNewHost ? config.previousDir : config.stagedDir, version: current.version });
  }
});
