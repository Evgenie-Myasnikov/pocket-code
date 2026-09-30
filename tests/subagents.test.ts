import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { claudeSubagents, claudeSubagentMessages, updateClaudeAgents, updateClaudeAgentResults, type SubagentReader } from '../server/subagents.js';
import { normalize, type ChatMessage } from '../server/types.js';
import { codexMessage } from '../server/codex-content.js';
import { CodexService } from '../server/codex.js';
import type { CodexRpc } from '../server/codex-rpc.js';
import { Jobs } from '../server/jobs.js';

const call = { type: 'assistant', uuid: 'agent-call', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', id: 'tool-1', name: 'Agent', input: { description: 'Inspect tests', prompt: 'Inspect tests only' } }] } };
const childMessage = (type: 'user' | 'assistant', content: string) => ({ type, uuid: `child-${type}`, session_id: 'parent', parent_tool_use_id: 'tool-1', parent_agent_id: null, message: { content } });
function readerFixture() {
  const calls: { method: string; parent: string; id?: string; dir?: string }[] = [];
  const reader: SubagentReader = {
    listSubagents: async (parent, options) => { calls.push({ method: 'list', parent, dir: options?.dir }); return ['child-1']; },
    getSessionMessages: async (parent, options) => { calls.push({ method: 'parent', parent, dir: options?.dir }); return [call as any]; },
    getSubagentMessages: async (parent, id, options) => {
      calls.push({ method: 'child', parent, id, dir: options?.dir });
      return [childMessage('user', 'Inspect tests only'), childMessage('assistant', 'Tests inspected')].slice(0, options?.limit);
    },
  };
  return { reader, calls };
}

test('Claude child history uses only SDK-listed children in the authorized parent project', async () => {
  const { reader, calls } = readerFixture();
  const agents = await claudeSubagents('parent', '/authorized', reader);
  assert.equal(agents[0].status, 'unknown'); assert.equal(agents[0].prompt, 'Inspect tests only');
  const messages = await claudeSubagentMessages('parent', 'child-1', '/authorized', reader);
  assert.deepEqual(messages.map(m => m.blocks[0].text), ['Inspect tests only', 'Tests inspected']);
  assert.ok(calls.every(c => c.parent === 'parent' && c.dir === '/authorized'));
  await assert.rejects(claudeSubagentMessages('parent', '../other', '/authorized', reader), (e: any) => e.status === 400);
  await assert.rejects(claudeSubagentMessages('parent', 'unrelated', '/authorized', reader), (e: any) => e.status === 404);
  assert.equal(calls.some(c => c.id === 'unrelated'), false);
});

test('historical Claude tool IDs resolve only an exact unique parent-child prompt match', async () => {
  const { reader } = readerFixture();
  assert.equal((await claudeSubagentMessages('parent', 'tool-1', '/authorized', reader)).length, 2);
  reader.listSubagents = async () => ['child-1', 'child-2'];
  await assert.rejects(claudeSubagentMessages('parent', 'tool-1', '/authorized', reader), (e: any) => e.status === 404);
});

test('Claude cards use lifecycle evidence and structured output, not inferred completion', () => {
  const messages: ChatMessage[] = [normalize(call)!];
  const agent = messages[0].blocks[0].agent!;
  assert.equal(agent.name, 'Inspect tests'); assert.equal(agent.status, 'unknown');
  updateClaudeAgents(messages, { type: 'system', subtype: 'task_started', task_id: 'child-1', tool_use_id: 'tool-1', task_type: 'local_agent', description: 'Tests agent' });
  assert.equal(agent.status, 'running'); assert.equal(agent.id, 'child-1');
  updateClaudeAgents(messages, { type: 'system', subtype: 'task_notification', task_id: 'child-1', status: 'completed', summary: 'Done' });
  assert.equal(agent.status, 'completed'); assert.equal(agent.result, 'Done');
  updateClaudeAgentResults(messages, { message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1' }] }, tool_use_result: { agentId: 'child-1', status: 'completed', content: [{ type: 'text', text: 'Final report' }] } });
  assert.equal(agent.result, 'Final report');
  updateClaudeAgents(messages, { type: 'system', subtype: 'task_started', task_id: 'bash', task_type: 'local_bash' });
  assert.equal(messages.length, 1);
  assert.equal(normalize(childMessage('assistant', 'Child content')), null);
});

test('Claude nested stream cannot change parent identity, partial text or error state', async () => {
  const run = (async function* () {
    yield { type: 'system', subtype: 'init', session_id: 'parent' };
    yield { ...call, session_id: 'parent' };
    yield { type: 'system', subtype: 'task_started', session_id: 'parent', task_id: 'child-1', tool_use_id: 'tool-1', task_type: 'local_agent' };
    yield { ...childMessage('assistant', 'NESTED_PRIVATE_CONTEXT'), session_id: 'child-session' };
    yield { type: 'stream_event', parent_tool_use_id: 'tool-1', session_id: 'child-session', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'NESTED_DELTA' } } };
    yield { type: 'result', parent_tool_use_id: 'tool-1', session_id: 'child-session', is_error: true, errors: ['child failed'] };
    yield { type: 'assistant', uuid: 'parent-answer', session_id: 'parent', parent_tool_use_id: null, message: { content: [{ type: 'text', text: 'Parent answer' }] } };
    yield { type: 'system', subtype: 'task_notification', session_id: 'parent', task_id: 'child-1', status: 'completed', summary: 'Child completed' };
    yield { type: 'result', session_id: 'parent', is_error: false, total_cost_usd: 0 };
  }) as any;
  const jobs = new Jobs(run);
  try {
    jobs.start({ id: 'synthetic', cwd: '/synthetic', text: 'Test', mode: 'default', maxBudgetUsd: 1 });
    for (let i = 0; i < 100 && jobs.get('synthetic').status === 'running'; i++) await new Promise(resolve => setTimeout(resolve, 2));
    const job = jobs.view(jobs.get('synthetic'));
    assert.equal(job.status, 'done'); assert.equal(job.sessionId, 'parent'); assert.equal(job.partial, '');
    assert.equal(JSON.stringify(job).includes('NESTED_'), false);
    assert.equal(job.messages.flatMap(m => m.blocks).find(b => b.agent)?.agent?.status, 'completed');
  } finally { jobs.close(); }
});

test('Codex collaboration yields one card per receiver and never treats tool completion as agent completion', async () => {
  const item = { id: 'spawn', type: 'collabAgentToolCall', tool: 'spawnAgent', senderThreadId: 'parent', receiverThreadIds: ['child-1', 'child-2'], status: 'completed', prompt: 'Inspect', agentsStates: { 'child-1': { status: 'running' }, 'child-2': { status: 'completed', message: 'Finished' } } };
  const historical = (await codexMessage(item, []))!;
  assert.equal(historical.blocks.length, 2); assert.equal(historical.blocks[0].agent?.status, 'unknown');
  assert.equal(historical.blocks[1].agent?.result, 'Finished');
  assert.equal((await codexMessage(item, [], true))!.blocks[0].agent?.status, 'running');
});

class ChildRpc extends EventEmitter implements CodexRpc {
  requests: { method: string; params: any }[] = [];
  threads = new Map<string, any>();
  async request(method: string, params: any) {
    this.requests.push({ method, params });
    if (method === 'thread/read') return { thread: this.threads.get(params.threadId) };
    return {};
  }
  notify() {} respond() {} reject() {} close() {}
}
async function codexFixture(t: any) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'pocket-subagents-')), root = path.join(temp, 'project'), outside = path.join(temp, 'outside');
  await mkdir(root); await mkdir(outside);
  const rpc = new ChildRpc(), service = new CodexService([root], { rpcFactory: () => rpc });
  const spawn = { id: 'spawn', type: 'collabAgentToolCall', tool: 'spawnAgent', senderThreadId: 'parent', receiverThreadIds: ['child'], status: 'completed', prompt: 'Inspect', agentsStates: { child: { status: 'completed', message: 'Finished' } } };
  rpc.threads.set('parent', { id: 'parent', cwd: root, turns: [{ items: [spawn] }] });
  rpc.threads.set('child', { id: 'child', cwd: root, source: { subAgent: { thread_spawn: { parent_thread_id: 'parent', agent_nickname: 'Inspector' } } }, status: { type: 'idle' }, turns: [{ items: [{ id: 'answer', type: 'agentMessage', text: 'Child context' }] }] });
  t.after(async () => { service.close(); assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(temp, { recursive: true, force: true }); });
  return { service, rpc, root, outside, spawn };
}

test('Codex child context checks parent membership and project scope without resuming or starting turns', async t => {
  const { service, rpc, outside } = await codexFixture(t);
  const agents = await service.subagents('parent'); assert.equal(agents[0].name, 'Inspector'); assert.equal(agents[0].status, 'completed');
  assert.equal((await service.subagentMessages('parent', 'child'))[0].blocks[0].text, 'Child context');
  await assert.rejects(service.subagentMessages('parent', 'unrelated'), (e: any) => e.status === 404);
  assert.equal(rpc.requests.some(r => r.method === 'thread/read' && r.params.threadId === 'unrelated'), false);
  rpc.threads.get('child').cwd = outside;
  await assert.rejects(service.subagentMessages('parent', 'child'), (e: any) => e.status === 403);
  assert.deepEqual(await service.subagents('parent'), []);
  assert.ok(rpc.requests.every(r => ['initialize', 'thread/read'].includes(r.method)));
});

test('Codex peers and conflicting child source cannot be accessed through receiver IDs', async t => {
  const { service, rpc, spawn } = await codexFixture(t);
  spawn.tool = 'sendMessage'; rpc.threads.get('child').source.subAgent.thread_spawn.parent_thread_id = 'another-parent';
  await assert.rejects(service.subagentMessages('parent', 'child'), (e: any) => e.status === 404);
  spawn.tool = 'spawnAgent';
  await assert.rejects(service.subagentMessages('parent', 'child'), (e: any) => e.status === 404);
  delete rpc.threads.get('child').source;
  assert.equal((await service.subagentMessages('parent', 'child')).length, 1);
  spawn.tool = 'wait';
  await assert.rejects(service.subagentMessages('parent', 'child'), (e: any) => e.status === 404);
});
