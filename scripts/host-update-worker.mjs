import { spawn as nodeSpawn } from 'node:child_process';
import { open, readFile, realpath, rename, stat } from 'node:fs/promises';
import { isIP, createConnection } from 'node:net';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const versionPattern = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/;
const inside = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };
const validPid = value => Number.isSafeInteger(value) && value > 0;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const invalid = () => new Error('Invalid host update configuration.');

async function boundedJson(filename, maxBytes = 64_000) {
  const handle = await open(filename, 'r');
  try {
    if ((await handle.stat()).size > maxBytes) throw invalid();
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > maxBytes) throw invalid();
    return JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
  } finally { await handle.close(); }
}
async function directory(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw invalid();
  const resolved = await realpath(value);
  if (!(await stat(resolved)).isDirectory()) throw invalid();
  return resolved;
}
async function executable(value, node = false) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw invalid();
  const resolved = await realpath(value);
  if (!(await stat(resolved)).isFile() || (node && !/^node(?:\.exe)?$/i.test(path.basename(resolved)))) throw invalid();
  return resolved;
}
async function packageVersion(directory) {
  const file = await realpath(path.join(directory, 'package.json'));
  const entry = await realpath(path.join(directory, 'server', 'index.ts'));
  if (!inside(directory, file) || !inside(directory, entry) || !(await stat(entry)).isFile()) throw invalid();
  const pkg = await boundedJson(file);
  if (pkg.name !== 'pocket-code' || typeof pkg.version !== 'string' || !versionPattern.test(pkg.version)) throw invalid();
  return pkg.version;
}

export async function validateWorkerConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.version !== 'string' || input.version.length > 80 || !versionPattern.test(input.version)) throw invalid();
  const dataDir = await directory(input.dataDir), stagedDir = await directory(input.stagedDir), previousDir = await directory(input.previousDir);
  if (!inside(dataDir, stagedDir) || stagedDir === dataDir || stagedDir === previousDir) throw invalid();
  if (typeof input.statusFile !== 'string' || !path.isAbsolute(input.statusFile)) throw invalid();
  const statusParent = await directory(path.dirname(input.statusFile));
  if (!inside(dataDir, statusParent) || !/^[a-zA-Z0-9_.-]+\.json$/i.test(path.basename(input.statusFile))) throw invalid();
  const statusFile = path.join(statusParent, path.basename(input.statusFile));
  try { if (!inside(dataDir, await realpath(statusFile))) throw invalid(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const pointerParent = await directory(path.join(dataDir, 'host'));
  if (!inside(dataDir, pointerParent)) throw invalid();
  const pointerFile = path.join(pointerParent, 'current.json');
  try { if (!inside(dataDir, await realpath(pointerFile))) throw invalid(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535 || !validPid(input.oldPid) || input.oldPid === process.pid) throw invalid();
  const localAddresses = Object.values(networkInterfaces()).flatMap(addresses => (addresses || []).map(address => address.address));
  const host = input.host;
  if (typeof host !== 'string' || !['localhost', '0.0.0.0', '::', '::1'].includes(host) && !(isIP(host) === 4 && host.startsWith('127.')) && !localAddresses.includes(host)) throw invalid();
  if (!Array.isArray(input.roots) || !input.roots.length || input.roots.length > 100) throw invalid();
  const roots = await Promise.all(input.roots.map(directory));
  if (input.tunnelPid !== undefined && (!validPid(input.tunnelPid) || input.tunnelPid === input.oldPid)) throw invalid();
  let publicUrl;
  if (input.publicUrl !== undefined) {
    const url = new URL(input.publicUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw invalid();
    publicUrl = url.origin;
  }
  if (input.tunnelPid !== undefined && !publicUrl) throw invalid();
  const previousVersion = await packageVersion(previousDir);
  if (await packageVersion(stagedDir) !== input.version || previousVersion === input.version) throw invalid();
  return { version: input.version, previousVersion, dataDir, stagedDir, previousDir, statusFile, pointerFile, roots, host, port: input.port, oldPid: input.oldPid,
    nodeExecutable: await executable(input.nodeExecutable, true), publicUrl, tunnelPid: input.tunnelPid,
    tunnelExecutable: input.tunnelExecutable === undefined ? undefined : await executable(input.tunnelExecutable) };
}

async function connectionToken(config, env) {
  let token = env.POCKET_TOKEN;
  if (!token) {
    const filename = await realpath(path.join(config.dataDir, 'connection-key.txt'));
    if (!inside(config.dataDir, filename) || (await stat(filename)).size > 4096) throw invalid();
    token = (await readFile(filename, 'utf8')).trim();
  }
  if (typeof token !== 'string' || !/^[^\x00-\x20\x7f]{32,4096}$/.test(token)) throw invalid();
  return token;
}
async function saveJsonAtomic(destination, value) {
  const filename = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(filename, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); }
  finally { await handle.close(); }
  await rename(filename, destination);
}
const saveStatus = (config, status) => saveJsonAtomic(config.statusFile, { ...status, targetVersion: config.version, updatedAt: Date.now() });
function probeHost(config) { return config.host === '0.0.0.0' || config.host === 'localhost' ? '127.0.0.1' : config.host === '::' ? '::1' : config.host; }
function listening(config) {
  return new Promise(resolve => {
    const socket = createConnection({ host: probeHost(config), port: config.port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(750, () => finish(true));
    socket.once('connect', () => finish(true)); socket.once('error', error => finish(error.code !== 'ECONNREFUSED'));
  });
}

/** Test hooks replace transport/process calls only; CLI configuration cannot inject functions. */
export async function runHostUpdate(input, hooks = {}) {
  const config = await validateWorkerConfig(input), env = hooks.env || process.env;
  const token = await connectionToken(config, env), fetcher = hooks.fetch || fetch, spawn = hooks.spawn || nodeSpawn;
  const isListening = hooks.listening || (() => listening(config));
  const sleep = hooks.sleep || delay, now = hooks.now || Date.now;
  const timing = { handoffMs: 10_000, shutdownMs: 20_000, startupMs: 45_000, requestMs: 2000, pollMs: 250, ...hooks.timing };
  const address = probeHost(config), baseUrl = `http://${isIP(address) === 6 ? `[${address}]` : address}:${config.port}/api`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const status = (state, message, currentVersion = config.previousVersion, extra = {}) => saveStatus(config, { state, currentVersion, ...(message ? { message } : {}), ...extra });
  const health = async () => {
    try {
      const response = await fetcher(`${baseUrl}/health`, { headers, redirect: 'error', signal: AbortSignal.timeout(timing.requestMs) });
      if (!response.ok) return null;
      const value = await response.json();
      return value && typeof value === 'object' ? value : null;
    } catch { return null; }
  };
  const waitPortClosed = async () => {
    const deadline = now() + timing.shutdownMs;
    do { if (!await isListening()) return true; await sleep(timing.pollMs); } while (now() < deadline);
    return false;
  };
  const childEnv = { ...env, POCKET_HOST: config.host, POCKET_PORT: String(config.port), POCKET_ROOTS: JSON.stringify(config.roots), POCKET_DATA_DIR: config.dataDir, POCKET_OPEN_PAIRING: '0' };
  delete childEnv.POCKET_EXISTING_TUNNEL_URL; delete childEnv.POCKET_EXISTING_TUNNEL_PID;
  if (config.publicUrl) childEnv.POCKET_EXISTING_TUNNEL_URL = config.publicUrl;
  if (config.tunnelPid) childEnv.POCKET_EXISTING_TUNNEL_PID = String(config.tunnelPid);
  if (config.tunnelExecutable) childEnv.POCKET_TUNNEL_EXE = config.tunnelExecutable;
  const launch = async directory => {
    const logFile = path.join(path.dirname(config.statusFile), `host-${config.version}-${randomUUID()}.log`);
    const log = await open(logFile, 'wx', 0o600);
    try {
      const child = spawn(config.nodeExecutable, ['--import', 'tsx', 'server/index.ts'], { cwd: directory, env: childEnv, shell: false, windowsHide: true, detached: true, stdio: ['ignore', log.fd, log.fd] });
      const owned = { child, exited: false };
      child.once('error', () => { owned.exited = true; }); child.once('exit', () => { owned.exited = true; }); child.unref();
      return owned;
    } finally { await log.close(); }
  };
  const ready = async (owned, version) => {
    const deadline = now() + timing.startupMs;
    do {
      if (owned.exited || !validPid(owned.child.pid)) return false;
      const current = await health();
      if (!owned.exited && current?.version === version && current?.processId === owned.child.pid) return true;
      await sleep(timing.pollMs);
    } while (now() < deadline);
    return false;
  };
  const stopOwned = async owned => {
    if (!owned || owned.exited) return true;
    // This ChildProcess handle is the only process we may stop. Never use oldPid/tunnelPid for termination.
    // SIGKILL prevents a failed child from closing the shared tunnel through its normal shutdown handler.
    try { if (!owned.child.kill('SIGKILL')) return owned.exited; } catch { return owned.exited; }
    const deadline = now() + Math.min(timing.shutdownMs, 5000);
    while (!owned.exited && now() < deadline) await sleep(timing.pollMs);
    return owned.exited;
  };
  const rollback = async () => {
    let previous;
    try {
      if (!await waitPortClosed()) throw new Error('Listener still active');
      previous = await launch(config.previousDir);
      if (await ready(previous, config.previousVersion)) {
        await saveJsonAtomic(config.pointerFile, { directory: config.previousDir, version: config.previousVersion });
        await status('failed', 'The new host did not start. The previous version was restored.', config.previousVersion, { rollback: 'restored' });
        return;
      }
    } catch { /* Report one plain message, without child output or paths. */ }
    await stopOwned(previous);
    await status('failed', 'The host update failed and the previous version could not be restarted. Start Pocket Code on your PC.', null, { rollback: 'failed' });
  };

  const current = await health();
  if (current?.processId !== config.oldPid || current?.version !== config.previousVersion) {
    await status('failed', 'The running host changed. No process was stopped.'); return;
  }
  await status('restarting', 'Restarting the PC host.');
  let response;
  try {
    response = await fetcher(`${baseUrl}/host-update/handoff`, { method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(timing.handoffMs), body: JSON.stringify({ targetVersion: config.version, expectedPid: config.oldPid }) });
  } catch {
    if (!await isListening()) await rollback();
    else await status('failed', 'Could not hand off the host update. No process was forcibly stopped.');
    return;
  }
  if (response.status === 409 || response.status === 423) { await status('waiting', 'The host is busy or changed. The update will retry when it is ready.'); return; }
  let accepted = false;
  try { accepted = response.ok && (await response.json()).accepted === true; } catch { /* Invalid handoff response. */ }
  if (!accepted) {
    if (!await isListening()) await rollback();
    else await status('failed', 'The host did not accept the update handoff. No process was forcibly stopped.');
    return;
  }
  if (!await waitPortClosed()) { await status('failed', 'The old host has not stopped. No process was forcibly stopped.'); return; }
  let child;
  try {
    child = await launch(config.stagedDir);
    if (await ready(child, config.version)) {
      await saveJsonAtomic(config.pointerFile, { directory: config.stagedDir, version: config.version });
      await status('updated', '', config.version); return;
    }
  } catch { /* Start failure is handled by rollback. */ }
  if (!await stopOwned(child)) {
    await status('failed', 'The new host could not be verified or stopped. Restart Pocket Code on your PC.', null, { rollback: 'not-started' }); return;
  }
  await rollback();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || !path.isAbsolute(process.argv[2])) throw invalid();
    await runHostUpdate(await boundedJson(process.argv[2]));
  } catch {
    console.error('Pocket Code host update could not run. Check the update status on your PC.');
    process.exitCode = 1;
  }
}
