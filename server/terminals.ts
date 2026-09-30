import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import * as pty from 'node-pty';
import type { Terminal as HeadlessTerminal } from '@xterm/headless';
import type { SerializeAddon as Serializer } from '@xterm/addon-serialize';
import { HttpError } from './security.js';
const require = createRequire(import.meta.url);
const { Terminal } = require('@xterm/headless') as { Terminal: typeof HeadlessTerminal };
const { SerializeAddon } = require('@xterm/addon-serialize') as { SerializeAddon: typeof Serializer };
type LiveTerminal = {
  id: string; cwd: string; sessionId?: string; status: 'running' | 'exited'; startedAt: number;
  exitCode?: number; cols: number; rows: number; sequence: number;
  process: pty.IPty; screen: HeadlessTerminal; serializer: Serializer;
  chunks: { sequence: number; data: string }[]; inputs: Set<string>;
};
export class Terminals {
  private terminals = new Map<string, LiveTerminal>();
  constructor(private spawn: typeof pty.spawn = pty.spawn) {}
  list() { return [...this.terminals.values()].map(t => ({ id: t.id, cwd: t.cwd, sessionId: t.sessionId, status: t.status, startedAt: t.startedAt, exitCode: t.exitCode, cols: t.cols, rows: t.rows })); }
  get(id: string) { const t = this.terminals.get(id); if (!t) throw new HttpError(404, 'Терминал не найден. Возможно, сервер был перезапущен.'); return t; }
  start(input: { id: string; cwd: string; sessionId?: string }) {
    if (this.terminals.has(input.id)) return this.list().find(t => t.id === input.id)!;
    if (this.list().some(t => t.status === 'running' && t.cwd === input.cwd)) throw new HttpError(409, 'В этой папке уже есть живой терминал. Откройте его из списка.');
    if (this.list().filter(t => t.status === 'running').length >= 3) throw new HttpError(429, 'Одновременно доступны три терминала');
    for (const [id, t] of this.terminals) if (t.status === 'exited') { t.screen.dispose(); this.terminals.delete(id); }
    const native = path.join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
    const executable = process.env.POCKET_CLAUDE_EXECUTABLE || (existsSync(native) ? native : 'claude');
    const args = input.sessionId ? ['--resume', input.sessionId] : [];
    const env = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => v !== undefined && k !== 'CLAUDECODE')) as Record<string, string>;
    const processHandle = this.spawn(executable, args, { name: 'xterm-256color', cols: 80, rows: 24, cwd: input.cwd, env: { ...env, TERM: 'xterm-256color' } });
    const screen = new Terminal({ cols: 80, rows: 24, scrollback: 2000, allowProposedApi: true });
    const serializer = new SerializeAddon(); screen.loadAddon(serializer);
    const t: LiveTerminal = { ...input, status: 'running', startedAt: Date.now(), cols: 80, rows: 24,
      sequence: 0, process: processHandle, screen, serializer, chunks: [], inputs: new Set() };
    this.terminals.set(t.id, t);
    // Only this headless terminal answers terminal queries. Viewers never echo responses.
    screen.onData(data => { if (t.status === 'running') processHandle.write(data); });
    processHandle.onData(data => screen.write(data, () => {
      t.chunks.push({ sequence: ++t.sequence, data });
      if (t.chunks.length > 200) t.chunks.shift();
    }));
    processHandle.onExit(({ exitCode }) => { t.status = 'exited'; t.exitCode = exitCode; });
    return this.list().find(j => j.id === t.id)!;
  }
  output(id: string, cursor: number) {
    const t = this.get(id);
    const reset = cursor < 0 || cursor > t.sequence || cursor < (t.chunks[0]?.sequence ?? t.sequence) - 1;
    return { id, cursor: t.sequence, reset, data: reset ? t.serializer.serialize() : t.chunks.filter(c => c.sequence > cursor).map(c => c.data).join(''), status: t.status, exitCode: t.exitCode, cols: t.cols, rows: t.rows };
  }
  input(id: string, requestId: string, data: string) {
    const t = this.get(id);
    if (t.inputs.has(requestId)) return;
    if (t.status !== 'running') throw new HttpError(409, 'Процесс Claude уже завершён');
    t.process.write(data); t.inputs.add(requestId);
    if (t.inputs.size > 2000) t.inputs.delete(t.inputs.values().next().value!);
  }
  stop(id: string) { const t = this.get(id); if (t.status === 'running') t.process.kill(); }
  close() { for (const t of this.terminals.values()) { if (t.status === 'running') t.process.kill(); t.screen.dispose(); } }
}
