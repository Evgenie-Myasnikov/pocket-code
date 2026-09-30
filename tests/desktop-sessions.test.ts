import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app.js';

test('Desktop import merges CLI history, refreshes titles/messages and grants no project access', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pocket-desktop-'));
  const root = path.join(dir, 'allowed'), outside = path.join(dir, 'desktop-project');
  const index = path.join(dir, 'index'), registry = path.join(index, 'account', 'organization');
  await Promise.all([mkdir(root), mkdir(outside), mkdir(registry, { recursive: true })]);
  const desktopId = randomUUID(), duplicateId = randomUUID(), hiddenId = randomUUID();
  const file = path.join(registry, 'local_test.json');
  const save = (title: string) => writeFile(file, JSON.stringify({ cliSessionId: desktopId, cwd: outside, title, lastActivityAt: Date.now(), remoteMcpServersConfig: { secret: 'do-not-return' } }));
  await save('Desktop title');
  await writeFile(path.join(registry, 'local_duplicate.json'), JSON.stringify({ cliSessionId: duplicateId, cwd: root, title: 'Same chat' }));
  await writeFile(path.join(registry, 'local_partial.json'), '{"cliSessionId":');
  let messages = Array.from({ length: 105 }, (_, i) => ({ type: 'user', uuid: `message-${i}`, message: { content: `Text ${i}` } }));
  const sdk: any = {
    listSessions: async () => [
      { sessionId: duplicateId, summary: 'CLI title', cwd: root, lastModified: 1 },
      { sessionId: hiddenId, summary: 'Unrelated', cwd: outside, lastModified: 1 },
    ],
    getSessionMessages: async (id: string) => id === desktopId ? messages : [],
  };
  const token = 't'.repeat(43);
  const { app, jobs, terminals } = await createApp({ roots: [root], token, hostName: 'Test', uploads: path.join(dir, 'uploads'), desktopSessionIndexes: [index] }, undefined, sdk);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request = (route: string, body?: unknown) => fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    const sessions = await (await request('/sessions')).json();
    assert.equal(sessions.length, 2);
    assert.equal(sessions.find((s: any) => s.sessionId === desktopId).readOnly, true);
    assert.equal(sessions.find((s: any) => s.sessionId === duplicateId).readOnly, false);
    assert.equal(sessions.filter((s: any) => s.sessionId === duplicateId).length, 1);
    assert.ok(!JSON.stringify(sessions).includes('do-not-return'));
    const tail = await (await request(`/sessions/${desktopId}/messages?window=100`)).json();
    assert.equal(tail.previous, 5); assert.equal(tail.messages.length, 100); assert.equal(tail.messages[0].id, 'message-5');
    const beginning = await (await request(`/sessions/${desktopId}/messages?window=100&from=start`)).json();
    assert.equal(beginning.messages[0].id, 'message-0'); assert.equal(beginning.next, 100); assert.equal(beginning.previous, null);
    await save('Renamed on Desktop');
    messages.push({ type: 'user', uuid: 'new-message', message: { content: 'New on PC' } });
    const updated = await (await request('/sessions')).json();
    assert.equal(updated.find((s: any) => s.sessionId === desktopId).customTitle, 'Renamed on Desktop');
    const all = await (await request(`/sessions/${desktopId}/messages?window=200`)).json();
    assert.equal(all.messages.at(-1).id, 'new-message'); assert.equal(all.previous, null);
    const frozen = await (await request(`/sessions/${desktopId}/messages?window=100&end=105`)).json();
    assert.equal(frozen.messages.at(-1).id, 'message-104');
    assert.equal((await request(`/sessions/${hiddenId}/messages`)).status, 404);
    assert.equal((await request('/jobs', { id: randomUUID(), cwd: outside, sessionId: desktopId, text: 'No', takeoverConfirmed: true })).status, 403);
    assert.equal((await request('/terminals', { id: randomUUID(), cwd: outside, sessionId: desktopId, takeoverConfirmed: true })).status, 403);
    assert.equal((await request('/files?path=' + encodeURIComponent(outside))).status, 403);
  } finally {
    jobs.close(); terminals.close(); await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
