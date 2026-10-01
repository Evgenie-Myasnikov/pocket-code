import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app.js';
import { Jobs } from '../server/jobs.js';
import type { JiraIssue, JiraIssueQuery, JiraService, JiraTransition } from '../server/jira.js';

async function until(predicate: () => boolean) {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.ok(predicate(), 'The synthetic workflow did not finish');
}
async function fixture(t: any) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'pocket-jira-api-'));
  const root = path.join(temporary, 'project'), outside = path.join(temporary, 'outside');
  await mkdir(root); await mkdir(outside);
  const issues = new Map<string, JiraIssue>();
  const states = [['TEST-1', 'Open'], ['TEST-2', 'Review'], ['TEST-3', 'Waiting for Check'], ['TEST-4', 'Review'], ['TEST-5', 'Review']];
  for (const [key, status] of states) issues.set(key, { key, summary: 'Synthetic requirement', description: 'Synthetic acceptance criteria', status, statusId: status, issueType: 'Task', projectKey: 'TEST', assigneeId: 'synthetic-user', priority: 'Normal', updated: '', url: `https://example.atlassian.net/browse/${key}` });
  const transitions = new Map<string, JiraTransition[]>([
    ['Open', [{ id: '2', name: 'Begin', to: { id: 'In Progress', name: 'In Progress' }, fields: {} }]],
    ['Review', [{ id: '3', name: 'Review now', to: { id: 'PR Review', name: 'PR Review' }, fields: {} }]],
    ['Waiting for Check', [{ id: '5', name: 'Verify', to: { id: 'On Check', name: 'On Check' }, fields: {} }]],
  ]);
  const filters: { site: string; cursor?: string; query?: JiraIssueQuery }[] = [];
  const writes: { key: string; transitionId: string }[] = [], events: string[] = [];
  const runs: { provider: string; permissionMode: string; key: string }[] = [];
  const run = (provider: string): any => ({ prompt, options }: any) => (async function* () {
    const key = /"key":"(TEST-\d+)"/.exec(typeof prompt==='string'?prompt:(await prompt[Symbol.asyncIterator]().next()).value.message.content)?.[1] || '';
    runs.push({ provider, permissionMode: options.permissionMode, key }); events.push(`run:${key}`);
    yield { type: 'system', subtype: 'init', session_id: randomUUID() };
    yield { type: 'result', is_error: false, total_cost_usd: 0 };
  })();
  const jobs = new Jobs(run('claude')), codexJobs = new Jobs(run('codex'));
  const codex: any = {
    status: async () => ({ available: true, authenticated: true, models: [] }), sessions: async () => [], messages: async () => [],
    list: () => codexJobs.list(), get: (id: string) => codexJobs.get(id), view: (job: any) => codexJobs.view(job),
    start: (input: any) => { codexJobs.start(input); const job = codexJobs.get(input.id); job.provider = 'codex'; return codexJobs.view(job); },
    close: () => codexJobs.close(), stop: (id: string) => codexJobs.stop(id),
  };
  const jira: JiraService = {
    status: async () => ({ connected: true, sites: [{ id: 'site', name: 'Example', url: 'https://example.atlassian.net' }] }),
    connect: async () => ({ authorizationUrl: '', state: '' }), finish: async () => {}, disconnect: async () => {},
    issues: async (site, cursor, query) => { filters.push({ site, cursor, query }); return { issues: [...issues.values()], next: 'next-page' }; },
    issue: async (_site, key) => { assert.ok(issues.has(key)); return { ...issues.get(key)! }; },
    transitions: async (_site, key) => transitions.get(issues.get(key)!.status) || [],
    transition: async (_site, key, transitionId) => {
      const issue = issues.get(key)!, target = transitions.get(issue.status)?.find(item => item.id === transitionId);
      assert.ok(target, 'Only a currently available synthetic transition can run');
      writes.push({ key, transitionId }); events.push(`transition:${key}`);
      issues.set(key, { ...issue, status: target.to.name, statusId: target.to.id });
    },
  };
  const token = 's'.repeat(43);
  const runtime = await createApp({ roots: [root], uploads: path.join(temporary, 'uploads'), token, hostName: 'Synthetic test', desktopSessionIndexes: [], jira, codex }, jobs, { listSessions: async () => [], getSessionMessages: async () => [] } as any);
  const server = runtime.app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request = (route: string, body?: unknown, auth = token) => fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const input = (extra: Record<string, unknown> = {}) => ({ id: randomUUID(), site: 'site', key: 'TEST-1', provider: 'claude', role: 'developer', action: 'start_development', cwd: root, mode: 'default', maxBudgetUsd: 2, transitionId: '2', ...extra });
  t.after(async () => {
    await runtime.queue?.control('pause'); await runtime.codexQueue?.control('pause');
    runtime.queue?.close(); runtime.codexQueue?.close(); jobs.close(); codexJobs.close(); runtime.terminals.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await rm(temporary, { recursive: true, force: true });
  });
  return { root, outside, temporary, request, input, filters, writes, events, runs, jobs, codexJobs, runtime };
}

test('workflow API authenticates every entry point and forwards filters with pagination', async t => {
  const f = await fixture(t);
  const route = '/jira/issues?' + new URLSearchParams({ site: 'site', cursor: 'page-2', search: 'render issue', type: 'Bug', stage: 'development' });
  assert.equal((await f.request(route, undefined, 'invalid')).status, 401);
  assert.equal(f.filters.length, 0);
  const list = await f.request(route); assert.equal(list.status, 200);
  assert.equal((await list.json()).next, 'next-page');
  assert.deepEqual(f.filters, [{ site: 'site', cursor: 'page-2', query: { search: 'render issue', type: 'Bug', stage: 'development' } }]);
  assert.equal((await f.request('/jira/workflow?site=site&key=TEST-1&role=developer', undefined, 'invalid')).status, 401);
  assert.equal((await f.request('/jira/workflow/pr?' + new URLSearchParams({ cwd: f.root, key: 'TEST-1' }), undefined, 'invalid')).status, 401);
  assert.equal((await f.request('/jira/workflow/action', f.input(), 'invalid')).status, 401);
  assert.equal((await f.request('/jira/workflow/recover', { site: 'site', key: 'TEST-1', id: randomUUID(), confirmed: true }, 'invalid')).status, 401);
  assert.equal((await f.request('/jira/workflow/recover', { site: 'site', key: 'TEST-1', id: randomUUID(), confirmed: false })).status, 400);
  assert.equal(f.writes.length, 0); assert.equal(f.runs.length, 0);
});

test('developer workflow route transitions once before starting a linked chat and rejects outside projects', async t => {
  const f = await fixture(t), body = f.input();
  assert.equal((await f.request('/jira/workflow/action', { ...body, cwd: f.outside })).status, 403);
  assert.equal(f.writes.length, 0);
  const response = await f.request('/jira/workflow/action', body); assert.equal(response.status, 200);
  const result = await response.json(); await until(() => f.jobs.get(body.id).status === 'done');
  assert.equal(result.job.jira.key, 'TEST-1');
  assert.deepEqual(f.events, ['transition:TEST-1', 'run:TEST-1']);
  assert.equal((await f.request('/jira/workflow/action', body)).status, 200);
  assert.equal(f.writes.length, 1); assert.equal(f.runs.length, 1);
  const view = await (await f.request('/jira/workflow?site=site&key=TEST-1&provider=claude&role=developer')).json();
  assert.equal(view.stage, 'development'); assert.equal(view.link.jobId, body.id); assert.equal(view.link.sessionId, f.jobs.get(body.id).sessionId);
});

test('reviewer and QA workflow routes force plan permissions for both agent engines', async t => {
  const f = await fixture(t);
  const reviewer = f.input({ key: 'TEST-2', role: 'reviewer', action: 'start_review', mode: 'default', transitionId: '3' });
  assert.equal((await f.request('/jira/workflow/action', reviewer)).status, 200);
  await until(() => f.jobs.get(reviewer.id).status === 'done');
  const qa = f.input({ key: 'TEST-3', role: 'qa', provider: 'codex', action: 'start_qa', mode: 'default', transitionId: '5' });
  const qaResponse = await f.request('/jira/workflow/action', qa);
  assert.equal(qaResponse.status, 200, await qaResponse.text());
  await until(() => f.codexJobs.get(qa.id).status === 'done');
  assert.deepEqual(f.runs, [{ provider: 'claude', permissionMode: 'plan', key: 'TEST-2' }, { provider: 'codex', permissionMode: 'plan', key: 'TEST-3' }]);
  assert.deepEqual(f.writes, [{ key: 'TEST-2', transitionId: '3' }, { key: 'TEST-3', transitionId: '5' }]);
});

test('batch workflow captures its selected role, persists it and starts each task with role permissions', async t => {
  const f = await fixture(t);
  const body = { batchId: randomUUID(), provider: 'claude', role: 'reviewer', site: 'site', keys: ['TEST-4', 'TEST-5'], cwd: f.root, mode: 'default', maxBudgetUsd: 2 };
  assert.equal((await f.request('/jira/queue', body)).status, 200);
  await until(() => f.runs.length === 2);
  await f.runtime.queue!.tick();
  const queue = await (await f.request('/jira/queue?provider=claude')).json();
  assert.deepEqual(queue.items.map((item: any) => item.role), ['reviewer', 'reviewer']);
  assert.deepEqual(f.runs.map(run => run.permissionMode), ['plan', 'plan']);
  assert.deepEqual(f.writes.map(write => write.key), ['TEST-4', 'TEST-5']);
  await f.runtime.queue!.control('pause');
  const saved = JSON.parse(await readFile(path.join(f.temporary, 'jira-queue.json'), 'utf8'));
  assert.deepEqual(saved.items.map((item: any) => item.role), ['reviewer', 'reviewer']);
  assert.equal((await f.request('/jira/queue', body)).status, 200);
  assert.equal(f.runs.length, 2); assert.equal(f.writes.length, 2);
});
