import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app.js';
import { Jobs } from '../server/jobs.js';
import { allowedPath, validToken } from '../server/security.js';
import { normalizeUrl } from '../src/api.js';
import packageJson from '../package.json';
import {waitFor} from './wait-for';

test('tokens and transport validation fail closed', () => {
  assert.equal(validToken('', ''), false);
  assert.equal(validToken('a', 'b'), false);
  assert.equal(validToken('test', 'test'), true);
  assert.equal(normalizeUrl('http://100.64.12.1:4318/'), 'http://100.64.12.1:4318');
  assert.equal(normalizeUrl('http://192.168.1.3:4318'), 'http://192.168.1.3:4318');
  assert.equal(normalizeUrl('https://bridge.example.com'), 'https://bridge.example.com');
  assert.throws(() => normalizeUrl('http://public.example.com'));
  assert.throws(() => normalizeUrl('http://100.128.1.1'));
  assert.throws(() => normalizeUrl('https://user:pass@example.com'));
  assert.throws(() => normalizeUrl('file:///etc/passwd'));
});

test('API authenticates, scopes sessions, prevents path escapes and routes attachment IDs', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'pocket-api-'));
  const root = path.join(temporary, 'project'), outside = path.join(temporary, 'outside');
  await mkdir(root); await mkdir(outside); await writeFile(path.join(root, 'hello.txt'), 'Hello');
  await writeFile(path.join(outside, 'private.txt'), 'outside');
  const id = randomUUID(), hidden = randomUUID(), token = 'x'.repeat(43);
  const sdk: any = {
    listSessions: async () => [{ sessionId: id, summary: 'Allowed', cwd: root, lastModified: Date.now() }, { sessionId: hidden, summary: 'Hidden', cwd: outside, lastModified: Date.now() }],
    getSessionMessages: async (_id: string, options: any) => Array.from({ length: 105 }, (_, i) => ({ uuid: String(i), type: 'user', message: { content: `Message ${i}` } })).slice(options?.offset || 0, options?.limit ? (options?.offset || 0) + options.limit : undefined),
  };
  let prompt = '';
  const run: any = ({ prompt: input }: any) => { return (async function* () { prompt = (await input[Symbol.asyncIterator]().next()).value.message.content; yield { type: 'system', subtype: 'init', session_id: id }; yield { type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0 }; })(); };
  const jobs = new Jobs(run);
  const { app } = await createApp({ desktopSessionIndexes: [], roots: [root], token, hostName: 'Test PC', uploads: path.join(temporary, 'uploads') }, jobs, sdk);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request = (route: string, body?: unknown, key = token) => fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    assert.equal((await request('/health', undefined, 'wrong')).status, 401);
    assert.equal((await request('/health')).status, 200);
    assert.equal((await (await request('/health')).json()).version, packageJson.version);
    assert.deepEqual((await (await request('/sessions')).json()).map((s: any) => s.sessionId), [id]);
    const page = await (await request(`/sessions/${id}/messages`)).json();
    assert.equal(page.messages.length, 100); assert.equal(page.next, 100);
    assert.equal((await request(`/sessions/${hidden}/messages`)).status, 404);
    assert.equal((await request('/file?path=' + encodeURIComponent(path.join(outside, 'private.txt')))).status, 403);
    assert.equal((await (await request('/file?path=' + encodeURIComponent(path.join(root, 'hello.txt')))).json()).text, 'Hello');
    await writeFile(path.join(root,'AGENTS.md'),'# Project rules');
    const docsQuery='?cwd='+encodeURIComponent(root);
    assert.equal((await request('/project-docs'+docsQuery,undefined,'wrong')).status,401);
    assert.equal((await request('/project-docs?cwd='+encodeURIComponent(outside))).status,403);
    assert.equal((await (await request('/project-docs'+docsQuery)).json()).documents[0].path,'AGENTS.md');
    assert.equal((await (await request('/project-doc'+docsQuery+'&path=AGENTS.md')).json()).content,'# Project rules');
    assert.equal((await request('/project-doc'+docsQuery+'&path=../outside/private.txt')).status,400);
    assert.equal((await request('/project-artifact'+docsQuery+'&path=hello.txt',undefined,'wrong')).status,401);
    assert.equal((await (await request('/project-artifact'+docsQuery+'&path=hello.txt')).json()).text,'Hello');
    assert.equal((await request('/project-artifact'+docsQuery+'&path=../outside/private.txt')).status,403);
    await symlink(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(allowedPath([root], path.join(root, 'escape/private.txt')), /разрешённых/);
    const upload = await (await request('/uploads', { cwd: root, name: '../../hello.txt', base64: Buffer.from('upload').toString('base64') })).json();
    assert.equal(upload.name, 'hello.txt'); assert.ok(upload.id);
    assert.equal((await (await request('/file?path=' + encodeURIComponent(path.join(root, 'hello.txt')))).json()).text, 'Hello');
    const post = { id: randomUUID(), cwd: root, text: 'Read attachment', attachments: [upload.id] };
    const result = await request('/jobs', post); assert.equal(result.status, 200); await waitFor(()=>jobs.get(post.id).status==='done'); assert.match(prompt, /uploads/);
    assert.equal((await request('/jobs', { ...post, id: randomUUID(), attachments: [randomUUID()] })).status, 400);
    assert.equal((await request('/jobs', { ...post, id: randomUUID(), sessionId: id })).status, 409);
    assert.equal((await request('/jobs', { ...post, id: randomUUID(), sessionId: id, takeoverConfirmed: true })).status, 200);
    const unauthorizedOrigin = await fetch(base + '/health', { headers: { Origin: 'https://attacker.example', Authorization: 'Bearer ' + token } });
    assert.equal(unauthorizedOrigin.headers.get('Access-Control-Allow-Origin'), null);
    for (let i = 0; i < 21; i++) await request('/health', undefined, 'wrong');
    assert.equal((await request('/health', undefined, 'wrong')).status, 429);
    assert.equal((await request('/health')).status, 200, 'valid credentials must work even when the tunnel peer is rate limited');
  } finally { jobs.close(); await new Promise<void>(r => server.close(() => r())); await rm(temporary, { recursive: true, force: true }); }
});

test('job approvals, cancellation, idempotency and project concurrency', async () => {
  let decision: any, calls = 0;
  const run: any = ({ options }: any) => (async function* () {
    calls++; yield { type: 'system', session_id: 'session-test' };
    decision = await options.canUseTool('Write', { file_path: 'hello.txt', content: 'hi' }, { signal: options.abortController.signal });
    yield { type: 'assistant', uuid: 'assistant-1', message: { content: [{ type: 'text', text: 'Finished' }] } };
    yield { type: 'result', is_error: false, total_cost_usd: 0.01 };
  })();
  const jobs = new Jobs(run), input = { id: randomUUID(), cwd: '/project', text: 'hello', mode: 'default' as const, maxBudgetUsd: 1 };
  try {
    jobs.start(input); jobs.start(input);
    await waitFor(()=>jobs.get(input.id).approvals.length>0); assert.equal(calls, 1);
    assert.throws(() => jobs.start({ ...input, id: randomUUID() }), /уже работает/);
    const approval = jobs.get(input.id).approvals[0]; assert.equal(approval.tool, 'Write');
    jobs.approve(input.id, approval.id, true);
    await waitFor(()=>jobs.get(input.id).status==='done'); assert.equal(decision.behavior, 'allow'); assert.equal(jobs.get(input.id).status, 'done');
    assert.throws(() => jobs.approve(input.id, approval.id, true), /уже закрыт/);
    const next = { ...input, id: randomUUID() }; jobs.start(next);
    await waitFor(()=>jobs.get(next.id).approvals.length>0); jobs.stop(next.id);
    await waitFor(()=>jobs.get(next.id).status==='stopped'&&decision.behavior==='deny'); assert.equal(decision.behavior, 'deny'); assert.equal(jobs.get(next.id).status, 'stopped'); assert.equal(jobs.get(next.id).approvals.length, 0);
  } finally { jobs.close(); }
});
