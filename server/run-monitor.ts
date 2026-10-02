import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export type RunProvider = 'claude' | 'codex' | 'copilot';
export type RunState = 'running' | 'done' | 'stopped' | 'unknown';
export type RunEvent = { id: string; provider: RunProvider; sessionId: string; cwd: string; title: string; status: 'done' | 'stopped'; at: number };
type Tracked = { state: RunState; size: number; mtime: number };

const json = (line: string) => { try { return JSON.parse(line); } catch { return null; } };
/** The last turn boundary in a session file decides whether its agent is still working. */
export function sessionState(provider: RunProvider, lines: string[]): RunState {
  let state: RunState = 'unknown';
  for (const line of lines) {
    const entry = json(line); if (!entry || typeof entry !== 'object') continue;
    if (provider === 'codex') {
      const type = entry.type === 'event_msg' ? entry.payload?.type : undefined;
      if (type === 'task_started') state = 'running'; else if (type === 'task_complete') state = 'done'; else if (type === 'turn_aborted') state = 'stopped';
    } else if (provider === 'claude') {
      if (entry.isSidechain || entry.isMeta) continue;
      if (entry.type === 'assistant') state = entry.message?.stop_reason === 'end_turn' ? 'done' : 'running';
      else if (entry.type === 'user') { const text = JSON.stringify(entry.message?.content ?? ''); state = text.includes('[Request interrupted by user') ? 'stopped' : 'running'; }
    } else {
      if (entry.type === 'user.message' || entry.type === 'assistant.turn_start') state = 'running';
      else if (entry.type === 'assistant.turn_end' || entry.type === 'session.shutdown') state = 'done';
      else if (entry.type === 'abort' || entry.type === 'session.abort') state = 'stopped';
    }
  }
  return state;
}
async function readSlice(file: string, start: number, length: number) {
  const handle = await open(file, 'r');
  try { const buffer = Buffer.alloc(length); const { bytesRead } = await handle.read(buffer, 0, length, start); return buffer.subarray(0, bytesRead).toString('utf8'); }
  finally { await handle.close(); }
}
const unescape = (value: string) => { try { return JSON.parse(`"${value}"`) as string; } catch { return value; } };
async function identity(provider: RunProvider, file: string, tail: string[]): Promise<{ sessionId: string; cwd: string; title: string }> {
  if (provider === 'claude') {
    let cwd = '', title = '';
    for (const line of tail) { const entry = json(line); if (entry?.cwd) cwd = entry.cwd; if (entry?.type === 'custom-title' && typeof entry.customTitle === 'string') title = entry.customTitle; if (entry?.type === 'summary' && typeof entry.summary === 'string' && !title) title = entry.summary; }
    return { sessionId: path.basename(file, '.jsonl'), cwd, title };
  }
  const head = await readSlice(file, 0, 65536);
  if (provider === 'codex') {
    const id = /"session_id":"([^"]+)"/.exec(head)?.[1] || /"id":"([^"]+)"/.exec(head)?.[1] || path.basename(file, '.jsonl').slice(-36);
    return { sessionId: id, cwd: unescape(/"cwd":"((?:[^"\\]|\\.)*)"/.exec(head)?.[1] || ''), title: '' };
  }
  const start = json(head.split('\n')[0]);
  return { sessionId: start?.data?.sessionId || path.basename(path.dirname(file)), cwd: start?.data?.context?.cwd || '', title: '' };
}

/** Watches PC-side session files, so chats started outside Pocket Code also report completion. */
export class RunMonitor {
  private tracked = new Map<string, Tracked>(); private feed: RunEvent[] = []; private scanning = false; private sequence = 0; private ready = 0;
  constructor(private sources: { provider: RunProvider; files: () => Promise<string[]> }[], private now = Date.now) {}
  static forHome(home = homedir()) {
    const codex = process.env.CODEX_HOME || path.join(home, '.codex'), claude = process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), copilot = process.env.COPILOT_HOME || path.join(home, '.copilot');
    const list = async (dir: string, pick: (name: string) => string | null) => { try { return (await readdir(dir, { withFileTypes: true })).map(entry => pick(entry.name) && (entry.isDirectory() || entry.isFile()) ? path.join(dir, pick(entry.name)!) : null).filter((v): v is string => !!v); } catch { return []; } };
    return new RunMonitor([
      { provider: 'codex', files: async () => { const days: string[] = []; for (const offset of [0, 1]) { const day = new Date(Date.now() - offset * 86400000); days.push(path.join(codex, 'sessions', String(day.getFullYear()), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0'))); } return (await Promise.all(days.map(dir => list(dir, name => /^rollout-.*\.jsonl$/.test(name) ? name : null)))).flat(); } },
      { provider: 'claude', files: async () => (await Promise.all((await list(path.join(claude, 'projects'), name => name)).map(dir => list(dir, name => name.endsWith('.jsonl') ? name : null)))).flat() },
      { provider: 'copilot', files: async () => (await list(path.join(copilot, 'session-state'), name => name)).map(dir => path.join(dir, 'events.jsonl')) },
    ]);
  }
  /** Events after a cursor; the first scan only records state so earlier history never notifies. */
  events(since: number) { return this.feed.filter(event => event.at > since); }
  async scan() {
    if (this.scanning) return; this.scanning = true;
    try {
      const now = this.now(), seen = new Set<string>();
      for (const source of this.sources) for (const file of await source.files()) {
        let info; try { info = await stat(file); } catch { continue; }
        if (!info.isFile() || now - info.mtimeMs > 6 * 3600000) continue;
        seen.add(file); const previous = this.tracked.get(file);
        if (previous && previous.size === info.size && previous.mtime === info.mtimeMs && !(previous.state === 'running' && source.provider === 'copilot')) continue;
        const length = Math.min(info.size, 262144), lines = (await readSlice(file, info.size - length, length)).split('\n').slice(length < info.size ? 1 : 0);
        let state = sessionState(source.provider, lines);
        // Copilot ends each agent step with turn_end; only a quiet file means the whole answer finished.
        if (source.provider === 'copilot' && state === 'done' && now - info.mtimeMs < 15000) state = 'running';
        this.tracked.set(file, { state, size: info.size, mtime: info.mtimeMs });
        const created = !previous && this.ready > 0 && info.birthtimeMs > this.ready;
        if ((previous?.state === 'running' || created) && (state === 'done' || state === 'stopped')) {
          const who = await identity(source.provider, file, lines);
          this.feed.push({ id: `${now}-${++this.sequence}`, provider: source.provider, ...who, title: who.title || path.basename(who.cwd || '') || 'Pocket Code', status: state, at: now });
        }
      }
      for (const file of this.tracked.keys()) if (!seen.has(file)) this.tracked.delete(file);
      this.feed = this.feed.filter(event => now - event.at < 3600000).slice(-200);
      if (!this.ready) this.ready = now;
    } finally { this.scanning = false; }
  }
}
