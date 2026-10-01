import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, rm, symlink, unlink } from 'node:fs/promises';
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
  const jobs = new Jobs();
  const { app } = await createApp({ roots: [root], token, uploads: path.join(temp, 'uploads'), hostName: 'Fixture', desktopSessionIndexes: [] }, jobs, sdk);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { jobs.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temp, { recursive: true, force: true }); });
  const get = (route: string) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api${route}`, { headers: { Authorization: `Bearer ${token}` } });
  const responses = await Promise.all(['/sessions', '/projects', `/sessions/${id}/messages?window=100`, `/sessions/${id}/messages?window=50`].map(get));
  assert.ok(responses.every(response => response.ok)); assert.equal(listings, 1); assert.equal(histories, 1);
  await unlink(link); await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await get(`/sessions/${id}/messages?window=100`)).status, 404);
  assert.equal(histories, 1, 'shared metadata cannot authorize a redirected path');
});
