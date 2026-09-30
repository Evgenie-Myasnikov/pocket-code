import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './security.js';
import type { JobView } from './types.js';
import type { JiraRole } from './jira-workflow-actions.js';
import type { CodexAccess } from './codex-access.js';

export type QueueItem = { id: string; site: string; key: string; cwd: string; role?: JiraRole; mode: 'default' | 'plan'; codexAccess?: CodexAccess; maxBudgetUsd: number; status: 'queued' | 'running' | 'done' | 'error' | 'stopped'; jobId?: string; sessionId?: string; error?: string };
export class JiraQueue {
  private items: QueueItem[] = [];
  private paused = true;
  private timer?: ReturnType<typeof setInterval>;
  private ready: Promise<void>;
  private busy = false;
  private writes = Promise.resolve();
  private restoreError = false;
  private batches: string[] = [];
  constructor(private file: string, private startJob: (item: QueueItem) => Promise<JobView>, private getJob: (id: string) => JobView) {
    this.ready = this.restore().catch(() => { this.restoreError = true; });
    this.timer = setInterval(() => void this.tick().catch(() => { this.paused = true; }), 1000); this.timer.unref();
  }
  private async restore() {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8'));
      this.batches = Array.isArray(saved.batches) ? saved.batches : [];
      if (Array.isArray(saved.items)) this.items = saved.items.map((item: QueueItem) => item.status === 'running' ? { ...item, status: 'error', error: 'Сервер перезапущен. Проверьте результат в чатах перед повторным запуском.' } : item);
    } catch (error: any) { if (error.code !== 'ENOENT') throw new Error('Cannot restore Jira queue'); }
  }
  private save() {
    const data = JSON.stringify({ items: this.items, batches: this.batches });
    this.writes = this.writes.catch(() => {}).then(async () => { await mkdir(path.dirname(this.file), { recursive: true }); await writeFile(this.file + '.tmp', data, { mode: 0o600 }); await rename(this.file + '.tmp', this.file); });
    return this.writes;
  }
  private async check() { await this.ready; if (this.restoreError) throw new HttpError(500, 'Не удалось прочитать сохранённую очередь Jira. Проверьте файл очереди на ПК.'); }
  async view() { await this.check(); return { paused: this.paused, items: this.items }; }
  async add(input: { batchId: string; site: string; keys: string[]; cwd: string; role?: JiraRole; mode: 'default' | 'plan'; codexAccess?: CodexAccess; maxBudgetUsd: number }) {
    await this.check();
    if (this.batches.includes(input.batchId)) return this.view();
    const keys = [...new Set(input.keys)].filter(key => !this.items.some(i => i.site === input.site && i.key === key && ['queued', 'running'].includes(i.status)));
    if (this.items.filter(i => ['queued', 'running'].includes(i.status)).length + keys.length > 5000) throw new HttpError(400, 'В очереди может быть до 5000 задач. Дождитесь завершения части очереди.');
    this.items = this.items.filter(i => ['queued', 'running'].includes(i.status)).concat(this.items.filter(i => !['queued', 'running'].includes(i.status)).slice(-200));
    this.items.push(...keys.map(key => ({ id: randomUUID(), site: input.site, key, cwd: input.cwd, ...(input.role ? { role: input.role } : {}), mode: input.mode, codexAccess: input.codexAccess, maxBudgetUsd: input.maxBudgetUsd, status: 'queued' as const })));
    this.batches = [...this.batches, input.batchId].slice(-500);
    await this.save(); this.paused = false; void this.tick().catch(() => { this.paused = true; }); return this.view();
  }
  async control(action: 'pause' | 'resume' | 'clear') {
    await this.check();
    this.paused = action !== 'resume';
    if (action === 'clear') this.items = this.items.filter(i => i.status !== 'queued');
    await this.save(); if (!this.paused) void this.tick().catch(() => { this.paused = true; }); return this.view();
  }
  async tick() {
    await this.ready; if (this.busy || this.restoreError) return; this.busy = true;
    try {
      const active = this.items.find(i => i.status === 'running');
      if (active) {
        const job = this.getJob(active.jobId!); active.sessionId = job.sessionId;
        if (job.status === 'running') return;
        active.status = job.status; active.error = job.error;
        if (job.status !== 'done') this.paused = true;
        await this.save();
      }
      if (this.paused) return;
      const item = this.items.find(i => i.status === 'queued'); if (!item) return;
      // Persist intent before launching: a crash never silently replays an active task.
      item.status = 'running'; item.jobId = item.id; await this.save();
      try { const job = await this.startJob(item); item.jobId = job.id; item.sessionId = job.sessionId; }
      catch (error: any) { item.status = 'error'; item.error = error instanceof HttpError ? error.message : 'Не удалось запустить задачу'; this.paused = true; }
      await this.save();
    } finally { this.busy = false; }
  }
  close() { clearInterval(this.timer); this.paused = true; }
}
