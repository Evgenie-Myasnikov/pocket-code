import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

export type DesktopSession = { sessionId: string; cwd: string; summary: string; customTitle?: string; lastModified: number; source: 'desktop'; archived: boolean };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export async function desktopIndexes(): Promise<string[]> {
  if (process.platform === 'darwin') return [path.join(homedir(), 'Library/Application Support/Claude/claude-code-sessions')];
  const result: string[] = [];
  if (process.env.APPDATA) result.push(path.join(process.env.APPDATA, 'Claude/claude-code-sessions'));
  if (process.env.LOCALAPPDATA) {
    const packages = path.join(process.env.LOCALAPPDATA, 'Packages');
    for (const entry of await readdir(packages, { withFileTypes: true }).catch(() => []))
      if (entry.isDirectory() && /^Claude_[\w]+$/.test(entry.name)) result.push(path.join(packages, entry.name, 'LocalCache/Roaming/Claude/claude-code-sessions'));
  }
  return result;
}

// Read only the desktop registry, never its credentials, MCP configuration or browser databases.
export async function readDesktopSessions(indexes: string[]): Promise<DesktopSession[]> {
  const sessions = new Map<string, DesktopSession>();
  async function visit(directory: string, depth: number) {
    if ((await lstat(directory).catch(() => null))?.isSymbolicLink()) return;
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory() && depth < 2) { await visit(file, depth + 1); continue; }
      if (!entry.isFile() || !/^local_.*\.json$/.test(entry.name)) continue;
      try {
        const info = await lstat(file);
        if (info.isSymbolicLink() || info.size > 2_000_000) continue;
        const data = JSON.parse(await readFile(file, 'utf8'));
        if (typeof data.cliSessionId !== 'string' || !uuid.test(data.cliSessionId) || typeof data.cwd !== 'string' || !path.isAbsolute(data.cwd)) continue;
        const title = typeof data.title === 'string' ? data.title.slice(0, 1000) : undefined;
        const modified = Math.max(info.mtimeMs, typeof data.lastActivityAt === 'number' && Number.isFinite(data.lastActivityAt) ? data.lastActivityAt : 0);
        const record: DesktopSession = { sessionId: data.cliSessionId, cwd: data.cwd, summary: title || 'Чат Claude Desktop', customTitle: title, lastModified: modified, source: 'desktop', archived: data.isArchived === true };
        if (!sessions.has(record.sessionId) || sessions.get(record.sessionId)!.lastModified < modified) sessions.set(record.sessionId, record);
      } catch { /* A concurrent Desktop write may temporarily leave incomplete JSON; retry on the next poll. */ }
    }
  }
  for (const directory of indexes) await visit(directory, 0);
  return [...sessions.values()];
}
