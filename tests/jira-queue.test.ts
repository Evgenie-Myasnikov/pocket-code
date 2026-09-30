import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JiraQueue } from '../server/jira-queue.js';
import type { JobView } from '../server/types.js';
const until = async (predicate: () => boolean) => { for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10)); assert.ok(predicate()); };
test('batch queue is sequential, deduplicates retries, pauses, and restores without replaying active work', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pocket-queue-')), file = path.join(dir, 'queue.json');
  const jobs = new Map<string, JobView>(), started: string[] = [];
  const start = async (item: any): Promise<JobView> => { started.push(item.key); const job: JobView = { id: item.id, cwd: item.cwd, status: 'running', messages: [], partial: '', approvals: [], startedAt: Date.now(), revision: 0, baseMessageCount: 0 }; jobs.set(job.id, job); return job; };
  const queue = new JiraQueue(file, start, id => jobs.get(id)!);
  let restored: JiraQueue | undefined;
  try {
    const batch = { batchId: 'batch-1', site: 'site', keys: ['A-1', 'A-2', 'A-1'], cwd: dir, mode: 'default' as const, maxBudgetUsd: 1 };
    await queue.add(batch); await until(() => started.length === 1);
    await queue.add(batch); assert.equal((await queue.view()).items.length, 2);
    await queue.control('pause'); jobs.values().next().value!.status = 'done'; await queue.tick();
    assert.equal(started.length, 1); assert.equal((await queue.view()).paused, true);
    await queue.control('resume'); await until(() => started.length === 2);
    await queue.control('pause'); queue.close();
    restored = new JiraQueue(file, start, id => jobs.get(id)!);
    const snapshot = await restored.view();
    assert.equal(snapshot.paused, true); assert.equal(snapshot.items.find(i => i.key === 'A-2')?.status, 'error');
    await restored.add(batch); await restored.tick(); assert.equal(started.length, 2, 'persisted batch retry must not run completed work again');
    await restored.add({ ...batch, batchId: 'batch-2', keys: ['A-3', 'A-4'] }); await until(() => started.length === 3);
    await restored.control('clear'); assert.ok(!(await restored.view()).items.some(i => i.key === 'A-4'));
  } finally { queue.close(); restored?.close(); await rm(dir, { recursive: true, force: true }); }
});
