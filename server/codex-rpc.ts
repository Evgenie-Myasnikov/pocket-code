import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import path from 'node:path';

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

/** Find a native binary; never execute a .cmd/.ps1 wrapper through a shell. */
export async function discoverCodex(env: NodeJS.ProcessEnv = process.env): Promise<string> {
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
        candidates.push(path.join(directory, 'node_modules', '@openai', 'codex', 'vendor', arch, 'codex', 'codex.exe'));
        const platform = arch.startsWith('x86') ? 'codex-win32-x64' : 'codex-win32-arm64';
        candidates.push(path.join(directory, 'node_modules', '@openai', 'codex', 'node_modules', '@openai', platform, 'vendor', arch, 'codex', 'codex.exe'));
      }
    }
  }
  if (process.platform === 'win32' && env.LOCALAPPDATA) {
    const root = path.join(env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    try { for (const entry of await readdir(root, { withFileTypes: true })) if (entry.isDirectory()) candidates.push(path.join(root, entry.name, 'codex.exe')); } catch { /* Optional desktop install. */ }
  }
  for (const candidate of candidates) { try { await access(candidate); return candidate; } catch { /* Try next install. */ } }
  throw new Error('Codex is not installed on this PC. Install Codex CLI or configure POCKET_CODEX_EXECUTABLE.');
}

export class StdioCodexRpc extends EventEmitter implements CodexRpc {
  private child: ChildProcessWithoutNullStreams;
  private buffer = '';
  private sequence = 0;
  private ended = false;
  private pending = new Map<number, { method: string; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  constructor(executable: string, private timeoutMs = 45000) {
    super();
    this.child = spawn(executable, ['app-server', '--listen', 'stdio://'], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
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
    this.buffer += chunk;
    if (this.buffer.length > 32_000_000) { this.disconnect(new Error('Codex returned too much data. Open a shorter conversation.')); this.child.kill(); return; }
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
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
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        // A timed-out mutation might still execute. Close the transport so it cannot run unobserved.
        this.disconnect(new Error(`Codex did not respond to ${method} in time.`)); this.child.kill();
      }, this.timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
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
