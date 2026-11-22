import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, readdir, stat } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { compareCodexVersions, privateCodexCandidates } from './codex-runtime.js';

export type RpcEnvelope = { id?: string | number; method?: string; params?: any; result?: any; error?: { code?: number; message?: string } };
export const CODEX_THREAD_BUSY = 'This chat is open in Codex on the PC. Its history is available here, but Codex must release the chat before you can send a message. Finish the task and close Codex on the PC, then try again.';
export class CodexRequestError extends Error {
  readonly errorCode?: 'codex_thread_busy';
  readonly code?: number;
  constructor(readonly method: string, error: NonNullable<RpcEnvelope['error']>) {
    const busy = method === 'thread/resume' && error.code === -32600 && /^thread [a-zA-Z0-9_-]{1,128} already has an active writer\.?$/.test(error.message?.trim() || '');
    // Only a recognized protocol condition may become a public explanation. Raw
    // error messages can contain local paths, account data or private config.
    super(busy ? CODEX_THREAD_BUSY : `Codex rejected ${method} (${error.code ?? 'unknown'}).`);
    this.name = 'CodexRequestError'; this.code = error.code;
    if (busy) this.errorCode = 'codex_thread_busy';
  }
}
export interface CodexRpc {
  request(method: string, params: unknown): Promise<any>;
  notify(method: string, params?: unknown): void;
  respond(id: string | number, result: unknown): void;
  reject(id: string | number, message: string): void;
  on(event: 'notification' | 'request' | 'disconnect', listener: (...args: any[]) => void): this;
  close(): void;
}

export type CodexVersionReader = (executable: string) => Promise<string | undefined>;
/** Reads `codex --version` without a shell; an unreadable version is undefined, not an error. */
export const readCodexVersion: CodexVersionReader = executable => new Promise(resolve => execFile(executable, ['--version'], { windowsHide: true, timeout: 10000, maxBuffer: 4096 },
  (error, stdout) => resolve(error ? undefined : String(stdout).match(/\b(\d+\.\d+\.\d+)\b/)?.[1])));
let discovered: { key: string; until: number; value: Promise<string> } | undefined;

/** Find a native binary; never execute a .cmd/.ps1 wrapper through a shell.
 * Several installs can coexist (desktop app, npm CLI). The provider serves its model
 * catalog per client version, so the newest installed Codex is preferred. */
export async function discoverCodex(env: NodeJS.ProcessEnv = process.env, readVersion: CodexVersionReader = readCodexVersion): Promise<string> {
  const candidates: string[] = [];
  if (env.POCKET_CODEX_EXECUTABLE) {
    const explicit = path.resolve(env.POCKET_CODEX_EXECUTABLE);
    if (process.platform === 'win32' && path.extname(explicit).toLowerCase() !== '.exe')
      throw new Error('POCKET_CODEX_EXECUTABLE must point to the native codex.exe executable.');
    await access(explicit); return explicit;
  }
  for (const directory of (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(directory, process.platform === 'win32' ? 'codex.exe' : 'codex'));
    if (process.platform === 'win32') {
      for (const arch of ['x86_64-pc-windows-msvc', 'aarch64-pc-windows-msvc']) {
        const platform = arch.startsWith('x86') ? 'codex-win32-x64' : 'codex-win32-arm64';
        for (const vendor of [
          path.join(directory, 'node_modules', '@openai', 'codex', 'vendor', arch),
          path.join(directory, 'node_modules', '@openai', 'codex', 'node_modules', '@openai', platform, 'vendor', arch),
          path.join(directory, 'node_modules', '@openai', platform, 'vendor', arch),
        ]) {
          // Newer npm packages ship vendor/<arch>/bin/codex.exe; older ones vendor/<arch>/codex/codex.exe.
          candidates.push(path.join(vendor, 'bin', 'codex.exe'), path.join(vendor, 'codex', 'codex.exe'));
        }
      }
    }
  }
  candidates.push(...await privateCodexCandidates(env));
  if (process.platform === 'win32' && env.LOCALAPPDATA) {
    const root = path.join(env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    try {
      const installed=await Promise.all((await readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(async entry=>{const file=path.join(root,entry.name,'codex.exe');return {file,time:await stat(file).then(value=>value.mtimeMs).catch(()=>0)};}));
      candidates.push(...installed.filter(entry=>entry.time>0).sort((a,b)=>b.time-a.time).map(entry=>entry.file));
    } catch { /* Optional desktop install. */ }
  }
  const existing: string[] = [], seen = new Set<string>();
  for (const candidate of candidates) {
    const key = path.resolve(candidate).toLowerCase();
    if (seen.has(key)) continue; seen.add(key);
    try { await access(candidate); existing.push(candidate); } catch { /* Try next install. */ }
  }
  if (!existing.length) throw new Error('Codex is not installed on this PC. Install Codex CLI or configure POCKET_CODEX_EXECUTABLE.');
  if (existing.length === 1) return existing[0];
  const key = existing.join('\n');
  if (readVersion === readCodexVersion && discovered?.key === key && discovered.until > Date.now()) return discovered.value;
  const value = (async () => {
    const versions = await Promise.all(existing.map(file => readVersion(file).catch(() => undefined)));
    // Ties and unreadable versions keep discovery order (PATH first, then the newest desktop build).
    let best = 0;
    versions.forEach((version, index) => { if (version && (!versions[best] || compareCodexVersions(version, versions[best]!) > 0)) best = index; });
    return existing[best];
  })();
  if (readVersion === readCodexVersion) discovered = { key, until: Date.now() + 60_000, value };
  return value;
}

export class StdioCodexRpc extends EventEmitter implements CodexRpc {
  private child: ChildProcessWithoutNullStreams;
  private buffer = '';
  private sequence = 0;
  private ended = false;
  private pending = new Map<number, { method: string; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  constructor(executable: string, private timeoutMs = 45000, options: {cwd?: string; configArgs?: string[]} = {}) {
    super();
    this.child = spawn(executable, ['app-server', '--listen', 'stdio://', ...(options.configArgs || [])], {cwd:options.cwd, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.read(chunk));
    // Drain diagnostics without exposing local configuration, account data, or tokens.
    this.child.stderr.on('data', () => {});
    this.child.on('error', () => this.disconnect(new Error('Could not start Codex on this PC.')));
    this.child.on('exit', () => this.disconnect(new Error('The Codex connection closed. Reconnect and try again.')));
    this.child.stdin.on('error', () => this.disconnect(new Error('The Codex connection closed.')));
  }
  private send(message: RpcEnvelope) {
    if (this.ended || !this.child.stdin.writable) throw new Error('The Codex connection is closed.');
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }
  private read(chunk: string) {
    if (this.ended) return;
    // Search only the new chunk: rescanning a long partial line on every chunk made large replies quadratic.
    const from = this.buffer.length;
    this.buffer += chunk;
    if (this.buffer.length > 128_000_000) { this.disconnect(new Error('Codex returned too much data. Open a shorter conversation.')); this.child.kill(); return; }
    let newline = this.buffer.indexOf('\n', from);
    for (; newline >= 0; newline = this.buffer.indexOf('\n')) {
      const line = this.buffer.slice(0, newline); this.buffer = this.buffer.slice(newline + 1);
      if (!line.trim()) continue;
      let message: RpcEnvelope;
      try { message = JSON.parse(line); } catch { this.disconnect(new Error('Codex returned an invalid protocol message.')); this.child.kill(); return; }
      if (!message || typeof message !== 'object') continue;
      if (message.method) { this.emit(message.id === undefined ? 'notification' : 'request', message); continue; }
      if (typeof message.id !== 'number') continue;
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      clearTimeout(pending.timer); this.pending.delete(message.id);
      if (message.error) pending.reject(new CodexRequestError(pending.method, message.error));
      else pending.resolve(message.result);
    }
  }
  request(method: string, params: unknown): Promise<any> {
    return this.startRequest(method, params).response;
  }
  startRequest(method: string, params: unknown): {id:number; response:Promise<any>} {
    const id = ++this.sequence;
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // A timed-out mutation might still execute. Close the transport so it cannot run unobserved.
        this.disconnect(new Error(`Codex did not respond to ${method} in time.`)); this.child.kill();
      }, this.timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
    return {id, response};
  }
  notify(method: string, params?: unknown) { this.send({ method, ...(params === undefined ? {} : { params }) }); }
  respond(id: string | number, result: unknown) { if (!this.ended) this.send({ id, result }); }
  reject(id: string | number, message: string) { if (!this.ended) this.send({ id, error: { code: -32601, message } }); }
  private disconnect(error: Error) {
    if (this.ended) return;
    this.ended = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear(); this.emit('disconnect', error);
  }
  close() { this.disconnect(new Error('The Codex connection was closed.')); this.child.kill(); }
}
