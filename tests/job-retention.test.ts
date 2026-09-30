import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Jobs } from '../server/jobs.js';

test('more than 100 completed chat turns retain running jobs and accept the next message', async () => {
  const run: any = ({ prompt, options }: any) => (async function* () {
    if (prompt === 'keep running') await new Promise(resolve => options.abortController.signal.addEventListener('abort', resolve, { once: true }));
  })();
  const jobs = new Jobs(run);
  const input = { cwd: '/synthetic/project', text: 'complete', mode: 'default' as const, maxBudgetUsd: 1 };
  const active = jobs.start({ ...input, id: randomUUID(), cwd: '/synthetic/active', text: 'keep running' });
  try {
    let latest = '';
    for (let i = 0; i < 125; i++) {
      latest = randomUUID(); jobs.start({ ...input, id: latest });
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(jobs.get(latest).status, 'done');
    assert.equal(jobs.get(active.id).status, 'running');
    assert.ok(jobs.list().length <= 100);
    assert.equal(jobs.start({ ...input, id: latest }).id, latest, 'recent requests remain idempotent');
  } finally { jobs.close(); }
});
