import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CodexService } from '../server/codex.js';
import type { CodexRpc } from '../server/codex-rpc.js';

class RaceRpc extends EventEmitter implements CodexRpc {
  responses: { id: string | number; result: any }[] = [];
  requests: { method: string; params: any }[] = [];
  startResult?: Promise<any>;
  constructor(private cwd: string, private turnId = 'turn-one') { super(); }
  async request(method: string, params: any) {
    this.requests.push({ method, params });
    if (method === 'config/read') return { config: {} };
    if (method === 'account/read') return { account: { type: 'chatgpt' } };
    if (method === 'model/list') return { data: [] };
    if (['thread/start', 'thread/resume', 'thread/read'].includes(method)) return { thread: { id: 'thread-one', cwd: this.cwd, status: { type: 'idle' } } };
    if (method === 'turn/start') return this.startResult || { turn: { id: this.turnId, status: 'inProgress' } };
    return {};
  }
  notify() {}
  respond(id: string | number, result: unknown) { this.responses.push({ id, result }); }
  reject() {}
  close() { this.emit('disconnect', new Error('Synthetic disconnection')); }
  notification(method: string, params: object) { this.emit('notification', { method, params: { threadId: 'thread-one', turnId: this.turnId, ...params } }); }
  approval(id: number) { this.emit('request', { id, method: 'item/commandExecution/requestApproval', params: { threadId: 'thread-one', turnId: this.turnId, command: 'synthetic', availableDecisions: ['accept', 'decline'] } }); }
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail('Condition was not reached');
}
async function setup(t: any) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-codex-races-'));
  const first = new RaceRpc(root), second = new RaceRpc(root, 'turn-two'); let connections = 0;
  const service = new CodexService([root], { rpcFactory: () => connections++ ? second : first });
  t.after(async () => { service.close(); assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(root, { recursive: true, force: true }); });
  return { root, service, first, second, input: { id: 'first-job', cwd: root, text: 'Synthetic', mode: 'default' as const, maxBudgetUsd: 1 } };
}

test('Codex cancellation during delayed turn/start waits for the turn ID and stops after the interrupt acknowledgement', async t => {
  const { service, first, input } = await setup(t); let started!: (value: any) => void;
  first.startResult = new Promise(resolve => { started = resolve; });
  service.start(input); await until(() => first.requests.some(request => request.method === 'turn/start'));
  service.stop(input.id);
  started({ turn: { id: 'turn-one', status: 'inProgress' } });
  await until(() => service.get(input.id).status === 'stopped');
  assert.deepEqual(first.requests.find(request => request.method === 'turn/interrupt')?.params, { threadId: 'thread-one', turnId: 'turn-one' });
});

test('Codex completion waits for earlier asynchronous image decoding and preserves message order', async t => {
  const { root, service, first, input } = await setup(t);
  const file = path.join(root, 'result.png'); await writeFile(file, Buffer.from('synthetic image'));
  service.start(input); await until(() => Boolean(service.get(input.id).turnId));
  first.notification('item/completed', { item: { id: 'picture', type: 'imageView', path: file } });
  first.notification('item/completed', { item: { id: 'answer', type: 'agentMessage', text: 'Finished' } });
  first.notification('turn/completed', { turn: { id: 'turn-one', status: 'completed' } });
  await until(() => service.get(input.id).status === 'done');
  assert.deepEqual(service.get(input.id).messages.slice(1).map(message => message.id), ['picture', 'answer']);
  assert.equal(service.get(input.id).messages[1].blocks[0].type, 'image');
});

test('Codex disconnect clears pending approvals and reconnect never replays or accepts old transport events', async t => {
  const { service, first, second, input } = await setup(t);
  service.start(input); await until(() => Boolean(service.get(input.id).turnId)); first.approval(7);
  assert.equal(service.get(input.id).approvals.length, 1); first.close();
  assert.equal(service.get(input.id).status, 'error'); assert.equal(service.get(input.id).approvals.length, 0);
  await service.status(); assert.equal(second.requests.some(request => request.method === 'turn/start'), false, 'reconnect must not replay a mutation');
  service.start({ ...input, id: 'second-job', sessionId: 'thread-one' });
  await until(() => Boolean(service.get('second-job').turnId));
  first.notification('error', { turnId: undefined, willRetry: false, error: { message: 'Late error from old transport' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.get('second-job').status, 'running', 'disconnected transport must not affect the new turn');
  second.notification('turn/completed', { turn: { id: 'turn-two', status: 'completed' } });
  await until(() => service.get('second-job').status === 'done');
});
