import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CodexService } from '../server/codex.js';
import { codexMessage } from '../server/codex-content.js';
import { CODEX_THREAD_BUSY, CodexRequestError, type CodexRpc } from '../server/codex-rpc.js';

class FakeRpc extends EventEmitter implements CodexRpc {
  requests: { method: string; params: any }[] = [];
  responses: { id: string | number; result: any }[] = [];
  rejections: (string | number)[] = [];
  config: any = { sandbox_mode: 'danger-full-access', approval_policy: 'on-request' };
  thread: any;
  handler?: (method: string, params: any) => any;
  closed = false;
  constructor(cwd: string) { super(); this.thread = { id: 'session-1', cwd, name: 'Test chat', updatedAt: 100, historyMode: 'legacy', turns: [], status: { type: 'idle' } }; }
  async request(method: string, params: any) {
    this.requests.push({ method, params });
    const result = this.handler?.(method, params); if (result !== undefined) return result;
    if (method === 'account/read') return { account: { type: 'chatgpt' }, requiresOpenaiAuth: true };
    if (method === 'model/list') return { data: [{ model: 'test-model', displayName: 'Test model' }, { model: 'hidden', hidden: true }] };
    if (method === 'config/read') return { config: this.config };
    if (method === 'thread/list') return { data: [this.thread], nextCursor: null };
    if (['thread/read', 'thread/start', 'thread/resume'].includes(method)) return { thread: this.thread };
    if (method === 'turn/start') return { turn: { id: 'turn-1', status: 'inProgress' } };
    return {};
  }
  notify() {}
  respond(id: string | number, result: unknown) { this.responses.push({ id, result }); }
  reject(id: string | number) { this.rejections.push(id); }
  close() { this.closed = true; this.emit('disconnect', new Error('Disconnected')); }
  notification(method: string, params: object) { this.emit('notification', { method, params: { threadId: 'session-1', turnId: 'turn-1', ...params } }); }
  serverRequest(id: number, method: string, params: object = {}) { this.emit('request', { id, method, params: { threadId: 'session-1', turnId: 'turn-1', ...params } }); }
}
async function setup(t: any, approvalTimeoutMs = 1000) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'pocket-codex-'));
  const root = path.join(temp, 'project'), outside = path.join(temp, 'outside');
  await mkdir(root); await mkdir(outside);
  const rpc = new FakeRpc(root), service = new CodexService([root], { rpcFactory: () => rpc, approvalTimeoutMs });
  t.after(async () => { service.close(); assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(temp, { recursive: true, force: true }); });
  const input = { id: 'job-1', cwd: root, text: 'Test request', mode: 'default' as const, maxBudgetUsd: 1 };
  return { root, outside, rpc, service, input };
}
async function until(predicate: () => boolean) {
  for (let n = 0; n < 200; n++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail('Condition was not reached');
}

test('Codex status uses existing sign-in and only exposes model names', async t => {
  const { rpc, service } = await setup(t);
  assert.deepEqual(await service.status(), { available: true, authenticated: true, models: [{ id: 'test-model', name: 'Test model' }] });
  assert.equal(rpc.requests[0].method, 'initialize');
  assert.deepEqual(rpc.requests.find(r => r.method === 'account/read')?.params, { refreshToken: false });
});

test('Codex lists only allowed projects and checks scope before loading history', async t => {
  const { rpc, service, root, outside } = await setup(t);
  const valid = { ...rpc.thread };
  rpc.handler = method => method === 'thread/list' ? { data: [valid, { ...valid, id: 'outside', cwd: outside }], nextCursor: null } : undefined;
  const sessions = await service.sessions(); assert.equal(sessions.length, 1); assert.equal(sessions[0].cwd, root); assert.equal(sessions[0].provider, 'codex');
  rpc.thread.cwd = outside;
  await assert.rejects(service.messages('session-1'), (error: any) => error.status === 403);
  assert.equal(rpc.requests.filter(r => r.method === 'thread/read' && r.params.includeTurns).length, 0);
});

test('Codex paginated history preserves rich content and excludes private reasoning', async t => {
  const { rpc, service } = await setup(t); rpc.thread.historyMode = 'paginated';
  rpc.handler = (method, params) => method === 'thread/items/list' ? params.cursor ? { data: [{ item: { id: 'a', type: 'agentMessage', text: 'Done' } }], nextCursor: null } : {
    data: [{ item: { id: 'u', type: 'userMessage', content: [{ type: 'text', text: 'Question' }] } },
      { item: { id: 'r', type: 'reasoning', summary: ['Public summary'], content: ['PRIVATE_REASONING'] } },
      { item: { id: 'tool', type: 'mcpToolCall', server: 'test', tool: 'lookup', arguments: {}, result: { content: [{ type: 'text', text: 'Found' }, { type: 'image', mimeType: 'image/png', data: 'aGVsbG8=' }] } } }], nextCursor: 'page-2' } : undefined;
  const messages = await service.messages('session-1');
  assert.equal(messages.length, 4); assert.ok(!JSON.stringify(messages).includes('PRIVATE_REASONING'));
  assert.equal(messages[2].blocks[1].type, 'tool_result'); assert.equal((messages[2].blocks[1].content as any[])[1].type, 'image');
  assert.equal(messages[3].blocks[0].text, 'Done');
});

test('Codex permits history reads while another client owns the writer, and retries only explicitly after release', async t => {
  const { rpc, service, input } = await setup(t);
  rpc.thread.historyMode = 'paginated';
  let locked = true;
  rpc.handler = method => {
    if (method === 'thread/items/list') return { data: [{ item: { id: 'saved', type: 'agentMessage', text: 'Saved history' } }], nextCursor: null };
    if (method === 'thread/resume' && locked) throw new CodexRequestError(method, { code: -32600, message: 'thread session-1 already has an active writer' });
  };
  assert.equal((await service.messages('session-1'))[0].blocks[0].text, 'Saved history');
  service.start({ ...input, sessionId: 'session-1' });
  await until(() => service.get(input.id).status === 'error');
  const rejected = service.view(service.get(input.id));
  assert.equal(rejected.errorCode, 'codex_thread_busy'); assert.equal(rejected.error, CODEX_THREAD_BUSY);
  assert.equal(rejected.messages[0].blocks[0].text, input.text);
  assert.equal(rpc.requests.some(request => request.method === 'turn/start'), false);
  assert.equal((await service.messages('session-1')).length, 1);
  locked = false;
  assert.equal(service.get(input.id).status, 'error');
  service.start({ ...input, id: 'explicit-retry', sessionId: 'session-1' });
  await until(() => Boolean(service.get('explicit-retry').turnId));
  assert.equal(rpc.requests.filter(request => request.method === 'turn/start').length, 1);
});

test('Codex request errors expose the operation but never raw config or unrecognized error bodies', () => {
  const secret = 'private-config-secret';
  for (const error of [
    new CodexRequestError('thread/read', { code: -32600, message: secret }),
    new CodexRequestError('thread/resume', { code: -32600, message: `thread ${secret} already has an active writer\n${secret}` }),
    new CodexRequestError('thread/resume', { code: -1, message: 'thread synthetic already has an active writer' }),
  ]) {
    assert.equal(error.errorCode, undefined); assert.ok(!error.message.includes(secret));
    assert.ok(!JSON.stringify(error).includes(secret)); assert.ok(error.message.includes(error.method));
  }
});

test('Codex uses constrained sandbox, image attachments and normalized streaming', async t => {
  const { rpc, service, input, root } = await setup(t);
  const image = path.join(root, 'image.png'); await writeFile(image, 'image');
  service.start({ ...input, attachmentPaths: [image] });
  await until(() => Boolean(service.get(input.id).turnId));
  const start = rpc.requests.find(r => r.method === 'thread/start')!.params;
  assert.equal(start.sandbox, 'workspace-write'); assert.equal(start.approvalPolicy, 'on-request'); assert.equal(start.approvalsReviewer, 'user');
  const turn = rpc.requests.find(r => r.method === 'turn/start')!.params;
  assert.equal(turn.sandboxPolicy.networkAccess, false); assert.deepEqual(turn.sandboxPolicy.writableRoots, [root]);
  assert.equal(turn.input[1].type, 'localImage');
  rpc.notification('item/agentMessage/delta', { delta: 'Hello' });
  await until(() => service.get(input.id).partial === 'Hello');
  rpc.notification('item/completed', { item: { id: 'assistant-1', type: 'agentMessage', text: 'Hello world' } });
  rpc.notification('turn/completed', { turn: { id: 'turn-1', status: 'completed' } });
  await until(() => service.get(input.id).status === 'done');
  const view = service.view(service.get(input.id));
  assert.equal(view.partial, ''); assert.equal(view.messages[1].blocks[0].text, 'Hello world'); assert.equal(view.provider, 'codex');
  assert.equal('eventQueue' in view, false); assert.equal('pending' in view, false);
});

test('Codex preserves stricter configured read-only sandbox and approval policy', async t => {
  const { rpc, service, input } = await setup(t); rpc.config = { sandbox_mode: 'read-only', approval_policy: 'untrusted' };
  service.start(input); await until(() => Boolean(service.get(input.id).turnId));
  const turn = rpc.requests.find(r => r.method === 'turn/start')!.params;
  assert.equal(turn.sandboxPolicy.type, 'readOnly'); assert.equal(turn.approvalPolicy, 'untrusted');
});

test('Codex refuses resume outside allowed roots and mismatched project', async t => {
  const { rpc, service, input, root, outside } = await setup(t);
  rpc.thread.cwd = outside; service.start({ ...input, sessionId: 'session-1' });
  await until(() => service.get(input.id).status === 'error');
  assert.equal(rpc.requests.some(r => r.method === 'thread/resume'), false);
  const nested = path.join(root, 'nested'); await mkdir(nested); rpc.thread.cwd = nested;
  service.start({ ...input, id: 'job-2', sessionId: 'session-1' });
  await until(() => service.get('job-2').status === 'error');
  assert.equal(rpc.requests.some(r => r.method === 'turn/start'), false);
});

test('Codex routes single-use approvals and question answers and denies unsupported grants', async t => {
  const { rpc, service, input } = await setup(t); service.start(input); await until(() => Boolean(service.get(input.id).turnId));
  rpc.serverRequest(10, 'item/commandExecution/requestApproval', { command: 'test command', availableDecisions: ['accept', 'decline'] });
  const approval = service.get(input.id).approvals[0]; service.approve(input.id, approval.id, true);
  assert.deepEqual(rpc.responses[0], { id: 10, result: { decision: 'accept' } });
  assert.throws(() => service.approve(input.id, approval.id, true), (error: any) => error.status === 409);
  rpc.serverRequest(11, 'item/tool/requestUserInput', { questions: [{ id: 'choice', question: 'Which?', options: [{ label: 'First', description: 'One' }] }] });
  const question = service.get(input.id).approvals[0]; assert.equal(question.tool, 'AskUserQuestion');
  service.approve(input.id, question.id, true, { 'Which?': 'First' });
  assert.deepEqual(rpc.responses[1], { id: 11, result: { answers: { choice: { answers: ['First'] } } } });
  rpc.serverRequest(12, 'item/permissions/requestApproval', { permissions: { network: { enabled: true } } });
  assert.deepEqual(rpc.rejections, [12]); assert.equal(service.get(input.id).approvals.length, 0);
});

test('Codex approval timeout fails closed and stop cancels pending approval', async t => {
  const { rpc, service, input } = await setup(t, 25); service.start(input); await until(() => Boolean(service.get(input.id).turnId));
  rpc.serverRequest(20, 'item/fileChange/requestApproval', { reason: 'Edit' });
  await until(() => rpc.responses.some(r => r.id === 20));
  assert.deepEqual(rpc.responses.find(r => r.id === 20)?.result, { decision: 'decline' });
  rpc.serverRequest(21, 'item/commandExecution/requestApproval', { command: 'Run' }); service.stop(input.id);
  await until(() => service.get(input.id).status === 'stopped');
  assert.deepEqual(rpc.responses.find(r => r.id === 21)?.result, { decision: 'decline' });
  assert.equal(rpc.requests.find(r => r.method === 'turn/interrupt')?.params.turnId, 'turn-1');
});

test('Codex stop during turn/start waits for its ID before interrupting and releasing the project', async t => {
  const { rpc, service, input } = await setup(t);
  let resolveTurn!: (value: any) => void;
  rpc.handler = method => method === 'turn/start' ? new Promise(resolve => { resolveTurn = resolve; }) : undefined;
  service.start(input); await until(() => Boolean(resolveTurn)); service.stop(input.id);
  assert.equal(service.get(input.id).status, 'running');
  assert.throws(() => service.start({ ...input, id: 'job-2' }), (error: any) => error.status === 409);
  resolveTurn({ turn: { id: 'late-turn', status: 'inProgress' } });
  await until(() => service.get(input.id).status === 'stopped');
  assert.equal(rpc.requests.find(r => r.method === 'turn/interrupt')?.params.turnId, 'late-turn');
});

test('Codex local image history cannot read a file outside configured project roots', async t => {
  const { root, outside } = await setup(t);
  const file = path.join(outside, 'private.png'); await writeFile(file, 'PRIVATE_BYTES');
  const message = await codexMessage({ id: 'image-1', type: 'imageView', path: file }, [root]);
  assert.equal(message?.blocks[0].type, 'text'); assert.ok(!JSON.stringify(message).includes('UFJJVkFURV9CWVRFUw=='));
});

test('Codex accepts explicitly configured upload storage without exposing it as a project', async t => {
  const { root, outside, rpc, input } = await setup(t);
  const service = new CodexService([root], { rpcFactory: () => rpc, attachmentRoots: [outside] });
  t.after(() => service.close());
  const image = path.join(outside, 'uploaded.png'), document = path.join(outside, 'notes.txt');
  await writeFile(image, 'image'); await writeFile(document, 'Notes');
  service.start({ ...input, attachmentPaths: [image, document] }); await until(() => Boolean(service.get(input.id).turnId));
  const params = rpc.requests.find(r => r.method === 'turn/start')!.params;
  assert.equal(params.input[1].path, image); assert.ok(params.input[2].text.includes(document));
  assert.deepEqual(params.sandboxPolicy.writableRoots, [root]);
  rpc.thread.cwd = outside;
  assert.deepEqual(await service.sessions(), []);
  await assert.rejects(service.messages('session-1'), (error: any) => error.status === 403);
});

test('Codex displays inline conversation and generated raster images without permitting SVG', async () => {
  const data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const user = await codexMessage({ id: 'user-image', type: 'userMessage', content: [{ type: 'image', url: `data:image/png;base64,${data}` }] }, []);
  const generated = await codexMessage({ id: 'generated-image', type: 'imageGeneration', result: data, status: 'completed' }, []);
  const unsafe = await codexMessage({ id: 'svg', type: 'userMessage', content: [{ type: 'image', url: 'data:image/svg+xml;base64,PHN2Zz4=' }] }, []);
  assert.equal(user?.blocks[0].source?.media_type, 'image/png'); assert.equal(generated?.blocks[0].type, 'image');
  assert.equal(unsafe?.blocks[0].type, 'text');
});
