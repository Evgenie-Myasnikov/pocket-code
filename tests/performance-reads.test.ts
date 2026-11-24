import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { coalesceReads } from '../server/read-coalescer.js';
import { CodexService } from '../server/codex.js';
import { createApp } from '../server/app.js';
import { Jobs } from '../server/jobs.js';

const delay = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));

test('shared reads coalesce pending work, expire metadata and retry errors', async () => {
  const read = coalesceReads<string, number>(30, 2); let calls = 0;
  const load = async () => { calls++; await delay(); return calls; };
  assert.deepEqual(await Promise.all([read('a', load), read('a', load)]), [1, 1]);
  assert.equal(await read('a', load), 1);
  await delay(40); assert.equal(await read('a', load), 2);
  await assert.rejects(read('b', async () => { throw new Error('temporary'); }), /temporary/);
  assert.equal(await read('b', async () => 3), 3);
});

test('Codex coalesces concurrent history and session reads without retaining stale transcripts', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-perf-codex-'));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  let pages = 0, lists = 0, changed = false;
  class Rpc extends EventEmitter {
    async request(method: string, params: any) {
      if (method === 'thread/read') return { thread: { id: 'chat', cwd: root, historyMode: 'paginated' } };
      if (method === 'thread/list') { lists++; await delay(); return { data: [{ id: 'chat', cwd: root }], nextCursor: null }; }
      if (method === 'thread/items/list') {
        pages++; await delay();
        return { data: [{ item: { id: params.cursor || 'first', type: 'agentMessage', text: changed ? 'New result' : 'Original result' } }], nextCursor: params.cursor ? null : 'second' };
      }
      return {};
    }
    notify() {} respond() {} reject() {} close() {}
  }
  const service = new CodexService([root], { rpcFactory: () => new Rpc() });
  t.after(() => service.close());
  const [first, same] = await Promise.all([service.messages('chat'), service.messages('chat')]);
  assert.deepEqual(first, same); assert.equal(pages, 2, 'one read of each page for concurrent consumers');
  changed = true;
  const latest = await service.messages('chat'); assert.equal(pages, 4);
  assert.equal(latest[0].blocks[0].text, 'New result', 'the next poll observes changed history');
  await Promise.all([service.sessions(), service.sessions()]); assert.equal(lists, 1);
});

test('paginated Codex history accounts for each raw item once and retains the size bound', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-perf-size-'));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  let serializations = 0, oversized = false;
  const items = Array.from({ length: 500 }, (_, index) => ({ id: String(index), type: 'agentMessage', text: 'Result',
    toJSON() { serializations++; return { id: this.id, type: this.type, text: this.text }; } }));
  class Rpc extends EventEmitter {
    async request(method: string, params: any) {
      if (method === 'thread/read') return { thread: { id: 'chat', cwd: root, historyMode: 'paginated' } };
      if (method === 'thread/items/list') {
        const offset = Number(params.cursor || 0);
        return { data: (oversized ? [{ id: 'large', type: 'agentMessage', text: 'x'.repeat(16_000_000) }] : items.slice(offset, offset + 100)).map(item => ({ item })), nextCursor: !oversized && offset + 100 < items.length ? String(offset + 100) : null };
      }
      return {};
    }
    notify() {} respond() {} reject() {} close() {}
  }
  const service = new CodexService([root], { rpcFactory: () => new Rpc() });
  t.after(() => service.close());
  assert.equal((await service.messages('chat')).length, 500);
  assert.equal(serializations, 500, 'appending a page never reserializes earlier pages');
  oversized = true; await assert.rejects(service.messages('chat'), error => (error as any).status === 413);
});

test('Codex history with generated images reads in small pages and skips inline copies of saved images', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-perf-images-'));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  const limits: number[] = [];
  // Eight synthetic 4 MB images: one page of 100 items used to exceed the protocol line limit.
  const items = Array.from({ length: 40 }, (_, index) => index % 5 ? { id: String(index), type: 'agentMessage', text: 'Result' }
    : { id: String(index), type: 'imageGeneration', status: 'completed', result: 'A'.repeat(4_000_000), savedPath: path.join(root, index + '.png') });
  class Rpc extends EventEmitter {
    async request(method: string, params: any) {
      if (method === 'thread/read') return { thread: { id: 'chat', cwd: root, historyMode: 'paginated' } };
      if (method === 'thread/items/list') {
        limits.push(params.limit); const offset = Number(params.cursor || 0);
        return { data: items.slice(offset, offset + params.limit).map(item => ({ item })), nextCursor: offset + params.limit < items.length ? String(offset + params.limit) : null };
      }
      return {};
    }
    notify() {} respond() {} reject() {} close() {}
  }
  const service = new CodexService([root], { rpcFactory: () => new Rpc() });
  t.after(() => service.close());
  assert.equal(await service.messageCount('chat'), 40);
  assert.ok(limits.every(limit => limit <= 20), 'history pages stay small');
  assert.deepEqual(await service.subagents('chat'), [], 'saved images do not count toward the 16 MB read bound');
});

test('concurrent API reads share SDK work and the next read revalidates project access', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'pocket-perf-api-'));
  const root = path.join(temp, 'root'), inner = path.join(root, 'inner'), outside = path.join(temp, 'outside'), link = path.join(root, 'linked');
  await mkdir(inner, { recursive: true }); await mkdir(outside);
  await symlink(inner, link, process.platform === 'win32' ? 'junction' : 'dir');
  const id = '00000000-0000-4000-8000-000000000001', token = 'synthetic-performance-token';
  let listings = 0, histories = 0;
  const sdk: any = {
    listSessions: async () => { listings++; await delay(); return [{ sessionId: id, summary: 'Fixture', cwd: link, lastModified: 1 }]; },
    getSessionMessages: async () => { histories++; await delay(); return [{ uuid: 'message', type: 'user', message: { content: 'Fixture' } }]; },
  };
  const gitOnly=path.join(root,'git-only');await mkdir(path.join(gitOnly,'.git'),{recursive:true});await writeFile(path.join(gitOnly,'.git','HEAD'),'ref: refs/heads/main');
  const jobs = new Jobs();
  const { app } = await createApp({ roots: [root], token, uploads: path.join(temp, 'uploads'), hostName: 'Fixture', listAllProviderChats:true,desktopSessionIndexes: [] }, jobs, sdk);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { jobs.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temp, { recursive: true, force: true }); });
  const get = (route: string) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api${route}`, { headers: { Authorization: `Bearer ${token}` } });
  const responses = await Promise.all(['/sessions', '/projects', `/sessions/${id}/messages?window=100`, `/sessions/${id}/messages?window=50`].map(get));
  assert.ok((await responses[1].json()).includes(gitOnly), 'Git projects without provider sessions appear in the API');
  assert.ok(responses.every(response => response.ok)); assert.equal(listings, 1); assert.equal(histories, 1);
  await unlink(link); await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await get(`/sessions/${id}/messages?window=100`)).status, 404);
  assert.equal(histories, 1, 'shared metadata cannot authorize a redirected path');
});

test('chats answer from the saved listing while a slow provider is read again in the background', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'pocket-perf-listing-')), root = path.join(temp, 'root');
  await mkdir(root, { recursive: true });
  const first = '00000000-0000-4000-8000-000000000001', second = '00000000-0000-4000-8000-000000000002', token = 'synthetic-listing-token-0000000000000000000';
  let listings = 0, wait = 5, created = false;
  const sdk: any = {
    listSessions: async () => { listings++; await delay(wait); return [first, ...(created ? [second] : [])].map(sessionId => ({ sessionId, summary: 'Fixture', cwd: root, lastModified: 1 })); },
    getSessionMessages: async () => [{ uuid: 'message', type: 'user', message: { content: 'Fixture' } }],
  };
  const jobs = new Jobs();
  const { app } = await createApp({ roots: [root], token, uploads: path.join(temp, 'uploads'), hostName: 'Fixture', listAllProviderChats:true,desktopSessionIndexes: [], sessionListFreshMs: 500, sessionListWaitMs: 150 }, jobs, sdk);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { jobs.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temp, { recursive: true, force: true }); });
  const get = (route: string) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api${route}`, { headers: { Authorization: `Bearer ${token}` } });
  const ids = async () => ((await (await get('/sessions?provider=claude')).json()) as { sessionId: string }[]).map(chat => chat.sessionId);
  assert.deepEqual(await ids(), [first]); assert.equal(listings, 1);
  // The list, a chat's history and its previews reuse the listing instead of reading every chat of the provider again.
  assert.ok((await Promise.all([get('/sessions?provider=claude'), get(`/sessions/${first}/messages?provider=claude&window=50`), get(`/sessions/${first}/messages?provider=claude&window=20`)])).every(response => response.ok));
  assert.equal(listings, 1);
  // Once the listing has aged, a provider that has become slow is read in the background: the list waits for it only briefly.
  await delay(600); wait = 600; created = true;
  const started = Date.now();
  assert.deepEqual(await ids(), [first]);
  assert.ok(Date.now() - started < 300, 'the chat list did not wait for the slow provider');
  assert.equal(listings, 2);
  // A chat created a moment ago is not in the saved listing: its history waits for the current one instead of failing.
  assert.equal((await get(`/sessions/${second}/messages?provider=claude&window=50`)).status, 200);
  assert.equal(listings, 2, 'the request joined the read that was already running');
  assert.deepEqual(await ids(), [first, second]);
  // A chat that does not exist is still reported from the provider's current chats.
  assert.equal((await get('/sessions/00000000-0000-4000-8000-000000000009/messages?provider=claude&window=50')).status, 404);
});

test('a provider that does not answer its sign-in check never holds back the other providers', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'pocket-perf-providers-')), root = path.join(temp, 'root');
  await mkdir(root, { recursive: true });
  const token = 'synthetic-provider-token-000000000000000000';
  let answer: Promise<object> = new Promise(() => {});
  const codex: any = { list: () => [], sessions: async () => [], status: () => answer };
  const jobs = new Jobs();
  const { app } = await createApp({ roots: [root], token, uploads: path.join(temp, 'uploads'), hostName: 'Fixture', listAllProviderChats:true,desktopSessionIndexes: [], codex, providerStatusWaitMs: 40 }, jobs, { listSessions: async () => [], getSessionMessages: async () => [] } as any);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { jobs.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temp, { recursive: true, force: true }); });
  const providers = async () => { const list = await (await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/providers`, { headers: { Authorization: `Bearer ${token}` } })).json() as any[]; return Object.fromEntries(list.map(item => [item.id, item])); };
  const waiting = await providers();
  assert.equal(waiting.claude.available, true, 'Claude is reported while Codex is still being checked');
  assert.deepEqual([waiting.codex.available, waiting.codex.access], [false, 'checking']);
  answer = Promise.resolve({ available: true, authenticated: true, models: [{ id: 'synthetic-model', name: 'Synthetic' }] });
  assert.deepEqual([(await providers()).codex.available, (await providers()).codex.authenticated], [true, true]);
  // The check hangs again: the state the PC confirmed last is reported instead of "unavailable".
  answer = new Promise(() => {});
  const late = await providers();
  assert.deepEqual([late.codex.available, late.codex.authenticated, late.codex.models.length], [true, true, 1]);
});

test('a chat list shows what a quick provider has now instead of an aged listing', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'pocket-perf-quick-')), root = path.join(temp, 'root');
  await mkdir(root, { recursive: true });
  const first = '00000000-0000-4000-8000-000000000001', second = '00000000-0000-4000-8000-000000000002', token = 'synthetic-quick-listing-token-0000000000000';
  let created = false;
  const sdk: any = {
    listSessions: async () => { await delay(5); return [first, ...(created ? [second] : [])].map(sessionId => ({ sessionId, summary: 'Fixture', cwd: root, lastModified: 1 })); },
    getSessionMessages: async () => [],
  };
  const jobs = new Jobs();
  const { app } = await createApp({ roots: [root], token, uploads: path.join(temp, 'uploads'), hostName: 'Fixture', listAllProviderChats:true,desktopSessionIndexes: [], sessionListFreshMs: 40 }, jobs, sdk);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { jobs.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temp, { recursive: true, force: true }); });
  const ids = async () => ((await (await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/sessions?provider=claude`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { sessionId: string }[]).map(chat => chat.sessionId);
  assert.deepEqual(await ids(), [first]);
  await delay(200); created = true;
  assert.deepEqual(await ids(), [first, second], 'the list waited for the quick provider instead of repeating the saved listing');
});
