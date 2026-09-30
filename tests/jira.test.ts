import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { AtlassianJira, jiraText, type JiraService } from '../server/jira.js';
import { WindowsJiraStore } from '../server/jira-vault.js';
import { createApp } from '../server/app.js';
import { Jobs } from '../server/jobs.js';

test('Jira OAuth rejects foreign redirects and unsolicited/replayed callbacks before token exchange', async () => {
  const jira = new AtlassianJira({ load: async () => ({}), save: async () => {} });
  await assert.rejects(jira.connect('https://attacker.example/callback'), /Android/);
  await assert.rejects(jira.connect('http://127.0.0.1:99999/jira-callback'), /Android/);
  await assert.rejects(jira.finish('code', 'x'.repeat(43)), /Вход истёк/);
  assert.equal((await jira.status()).connected, false);
  assert.equal(jiraText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Requirement' }, { type: 'hardBreak' }, { type: 'text', text: 'Second line' }] }] }), 'Requirement\nSecond line\n');
});
test('Windows Jira vault encrypts credentials and reloads Unicode data', { skip: process.platform !== 'win32' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pocket-vault-'));
  try {
    const file = path.join(dir, 'jira.dat'), store = new WindowsJiraStore(file);
    const data = { tokens: { access_token: 'synthetic-token-not-real' }, sites: [{ name: 'Задачи' }] };
    await store.save(data); assert.ok(!(await readFile(file, 'utf8')).includes('synthetic-token-not-real'));
    assert.deepEqual(await store.load(), data);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('Jira jobs use fresh server issue data, preserve approvals, deduplicate and enforce project roots', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pocket-jira-')); const root = path.join(dir, 'project'), outside = path.join(dir, 'outside'); await mkdir(root); await mkdir(outside);
  let prompt = '', launches = 0;
  const run: any = (input: any) => (async function* () { launches++; prompt = input.prompt; await input.options.canUseTool('Write', { file_path: 'test.txt' }, { signal: input.options.abortController.signal }); yield { type: 'result', is_error: false, total_cost_usd: 0 }; })();
  const issue = { key: 'TEST-1', summary: 'Fix renderer', description: 'Fresh requirement from Jira', status: 'Open', priority: 'High', url: 'https://example.atlassian.net/browse/TEST-1', updated: '' };
  const jira: JiraService = { status: async () => ({ connected: true, sites: [{ id: 'site', name: 'Test', url: 'https://example.atlassian.net' }] }), connect: async () => ({ authorizationUrl: 'https://mcp.atlassian.com/v1/authorize', state: 's'.repeat(43) }), finish: async () => {}, disconnect: async () => {}, issues: async (_s, cursor) => ({ issues: cursor ? [] : [issue], next: cursor ? null : 'page-2' }), issue: async () => issue };
  const jobs = new Jobs(run), token = 't'.repeat(43);
  const { app, terminals, queue } = await createApp({ roots: [root], token, uploads: path.join(dir, 'uploads'), hostName: 'Test', desktopSessionIndexes: [], jira }, jobs, { listSessions: async () => [], getSessionMessages: async () => [] });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const req = (route: string, body?: unknown, auth = token) => fetch(base + route, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  try {
    assert.equal((await req('/jira/status', undefined, 'wrong')).status, 401);
    const list = await (await req('/jira/issues?site=site')).json(); assert.equal(list.issues[0].key, 'TEST-1'); assert.equal(list.next, 'page-2');
    assert.equal((await (await req('/jira/issues?site=site&cursor=page-2')).json()).next, null);
    const body = { id: randomUUID(), site: 'site', key: 'TEST-1', cwd: root, description: 'Forged browser description' };
    const first = await (await req('/jira/start', body)).json();
    assert.equal(first.jira.key, 'TEST-1'); assert.match(prompt, /Fresh requirement/); assert.ok(!prompt.includes('Forged browser description'));
    const second = await (await req('/jira/start', { ...body, id: randomUUID() })).json();
    assert.equal(second.id, first.id); assert.equal(launches, 1); assert.equal(jobs.get(first.id).approvals.length, 1);
    assert.equal((await req('/jira/start', { ...body, id: randomUUID(), cwd: outside })).status, 403);
  } finally { queue?.close(); jobs.close(); terminals.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }); }
});
