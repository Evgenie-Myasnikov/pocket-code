import os from 'node:os';
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { normalizeCodexUsage, type CodexUsageSnapshot, type CodexUsageWindow } from './codex-usage.js';
import { HttpError } from './security.js';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function usageWindow(value: unknown, minutes: number, id: CodexUsageWindow['id']): CodexUsageWindow {
  const raw = record(value), parsed = typeof raw?.resets_at === 'string' ? Date.parse(raw.resets_at) / 1000 : NaN;
  const normalized = normalizeCodexUsage({ rateLimits: { primary: {
    usedPercent: raw?.utilization, windowDurationMins: minutes, resetsAt: Number.isFinite(parsed) ? Math.floor(parsed) : null,
  } } }).buckets[0].windows[0];
  return { ...normalized, id };
}

/** Only plan windows are returned; transcript behavior, session costs and account details stay on the PC. */
export function normalizeClaudeUsage(value: unknown, checkedAt = Date.now()): CodexUsageSnapshot {
  const raw = record(value), limits = record(raw?.rate_limits);
  const result: CodexUsageSnapshot = { checkedAt, ordinaryUsageAllowed: null, buckets: [] };
  if (raw?.rate_limits_available !== true || !limits) return result;
  if (record(limits.five_hour) || record(limits.seven_day)) result.buckets.push({
    id: 'claude', name: 'Claude', windows: [usageWindow(limits.five_hour, 300, 'primary'), usageWindow(limits.seven_day, 10080, 'secondary')],
  });
  for (const [key, name] of [['seven_day_oauth_apps', 'OAuth-приложения'], ['seven_day_opus', 'Opus'], ['seven_day_sonnet', 'Sonnet']]) {
    if (record(limits[key])) result.buckets.push({ id: key, name, windows: [usageWindow(limits[key], 10080, 'primary')] });
  }
  if (Array.isArray(limits.model_scoped)) limits.model_scoped.slice(0, 30).forEach((value, index) => {
    const row = record(value);
    if (!row) return;
    const rawName = row.display_name;
    const name = typeof rawName === 'string' && /^[\p{L}\p{N} ._()+-]{1,80}$/u.test(rawName) ? rawName : `Claude ${index + 1}`;
    result.buckets.push({ id: `model-${index + 1}`, name, windows: [usageWindow(row, 10080, 'primary')] });
  });
  return result;
}

export class ClaudeUsageReader {
  private cached: CodexUsageSnapshot | null = null;
  private pending: Promise<CodexUsageSnapshot> | null = null;
  constructor(private run: typeof query = query, private timeoutMs = 20_000, private cacheMs = 60_000) {}
  read(): Promise<CodexUsageSnapshot> {
    if (this.cached && Date.now() - this.cached.checkedAt < this.cacheMs) return Promise.resolve(this.cached);
    if (this.pending) return this.pending;
    this.pending = this.load().then(result => { this.cached = result; return result; }).finally(() => { this.pending = null; });
    return this.pending;
  }
  private async load(): Promise<CodexUsageSnapshot> {
    const controller = new AbortController();
    // Keep stdin open for control requests without sending even one user/model turn.
    const prompt: AsyncIterable<SDKUserMessage> = { async *[Symbol.asyncIterator]() {
      if (!controller.signal.aborted) await new Promise<void>(resolve => controller.signal.addEventListener('abort', () => resolve(), { once: true }));
    } };
    let stream: ReturnType<typeof query> | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    try {
      stream = this.run({ prompt, options: {
        cwd: os.tmpdir(), abortController: controller, persistSession: false,
        tools: [], strictMcpConfig: true, mcpServers: {}, settingSources: [], permissionMode: 'plan',
        ...(process.env.CLAUDE_EXECUTABLE ? { pathToClaudeCodeExecutable: process.env.CLAUDE_EXECUTABLE } : {}),
      } });
      const read = stream.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET;
      if (typeof read !== 'function') throw new Error('Usage API unavailable');
      const result = await Promise.race([
        read.call(stream, { skipBehaviors: true }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Usage read timed out')), this.timeoutMs); }),
      ]);
      return normalizeClaudeUsage(result);
    } catch {
      throw new HttpError(503, 'Не удалось получить лимиты Claude. Проверьте вход и версию Claude Code на ПК.');
    } finally {
      clearTimeout(timer); controller.abort();
      try { stream?.close(); } catch { /* Cleanup must not expose a raw provider error. */ }
    }
  }
}

const reader = new ClaudeUsageReader();
export const readClaudeUsage = () => reader.read();
