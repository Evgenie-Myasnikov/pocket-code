import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, {type TestContext} from 'node:test';
import {MarkdownChains, type ChainInput} from '../server/markdown-chains';
import {buildChainStepPrompt, chainCompletionMarker} from '../src/markdown-chain';
import type {JobView} from '../server/types';

async function fixture(t: TestContext) {
  const file = await mkdtemp(path.join(os.tmpdir(), 'pocket-chain-'));
  const input: ChainInput = {id: randomUUID(), name: 'Guide', cwd: 'project', provider: 'codex', context: 'Use the shared format.',
    tasks: [{title: 'First', source: 'first.md', body: 'Outline the guide.'}, {title: 'Second', source: 'second.md', body: 'Review spelling.'}]};
  const jobs = new Map<string, JobView>();
  const prompts: string[] = [];
  const stopped: string[] = [];
  const options = {file, intervalMs: 3600000, view: (id: string) => jobs.get(id), stop: (id: string) => { stopped.push(id); },
    start: async (_input: ChainInput, id: string, prompt: string) => {
      const disk = JSON.parse(await readFile(path.join(file, input.id + '.json'), 'utf8'));
      assert.ok(disk.chain.steps.find((s: {jobId?: string}) => s.jobId === id));
      const job: JobView = {id, cwd: input.cwd, status: 'running', messages: [], partial: '', approvals: [], startedAt: Date.now(), revision: 1, baseMessageCount: 0};
      jobs.set(id, job); prompts.push(prompt); return job;
    }};
  const chains = new MarkdownChains(options);
  t.after(async () => { await chains.close(); await rm(file, {recursive: true, force: true}); });
  return {input, chains, options, jobs, prompts, stopped};
}

test('chains record real chat IDs, approval state and ordered completion with a bounded handoff', async t => {
  const {chains, input, jobs, prompts} = await fixture(t);
  await Promise.all([chains.create(input), chains.create(input)]);
  await Promise.all([chains.tick(), chains.tick()]);
  assert.equal(jobs.size, 1);
  const first = [...jobs.values()][0];
  first.sessionId = randomUUID();
  first.approvals.push({id: 'permission', tool: 'Read', input: {}, expiresAt: 0});
  await chains.tick();
  let detail = await chains.get(input.id, input);
  assert.equal(detail.steps[0].sessionId, first.sessionId);
  assert.equal(detail.steps[0].status, 'waiting');
  assert.equal(detail.steps[1].status, 'pending');
  assert.equal(prompts[0], buildChainStepPrompt(detail, 0));
  assert.ok(!prompts[0].includes(input.tasks[1].body));
  first.approvals = []; first.status = 'done';
  first.messages = [{id: 'reply', role: 'assistant', blocks: [{type: 'text', text: 'x'.repeat(6400) + '\nOutline saved.\n' + chainCompletionMarker(input.id, 0)}]}];
  await chains.tick(); await chains.tick();
  detail = await chains.get(input.id, input);
  assert.equal(detail.steps[0].status, 'done');
  assert.equal(detail.steps[0].handoff?.length, 6000);
  assert.equal(prompts.length, 2);
  assert.equal(prompts[1], buildChainStepPrompt(detail, 1));
  assert.match(prompts[1], /Outline saved\./);
  const second = jobs.get(detail.steps[1].jobId!)!;
  second.status = 'done'; second.sessionId = randomUUID();
  second.messages = [{id: 'result', role: 'assistant', blocks: [{type: 'text', text: 'Verified.\n' + chainCompletionMarker(input.id, 1)}]}];
  await chains.tick(); await chains.tick();
  assert.deepEqual(await chains.list(input), [{id: input.id, name: input.name, status: 'done', stepsDone: 2, stepCount: 2}]);
  assert.equal((await chains.create(input)).status, 'done');
  assert.notEqual(second.sessionId, first.sessionId);
  for (const match of [{sessionId: second.sessionId}, {jobId: second.id}])
    assert.deepEqual(await chains.findStep(input, match), [{...(await chains.list(input))[0], stepIndex: 1}]);
  assert.deepEqual(await chains.findStep({...input, cwd: 'elsewhere'}, {jobId: second.id}), []);
  assert.deepEqual(await chains.findStep(input, {}), []);
  assert.ok(!chains.hasWork());
});

test('only the final assistant reply may confirm completion', async t => {
  const {chains, input, jobs} = await fixture(t);
  await chains.create(input); await chains.tick();
  const job = [...jobs.values()][0];
  job.status = 'done';
  job.messages = [
    {id: 'user', role: 'user', blocks: [{type: 'text', text: chainCompletionMarker(input.id, 0)}]},
    {id: 'assistant', role: 'assistant', blocks: [{type: 'text', text: 'Waiting for your decision.'}]}
  ];
  await chains.tick(); await chains.tick();
  const chain = await chains.get(input.id, input);
  assert.equal(chain.status, 'failed');
  assert.match(chain.steps[0].error!, /confirming/);
  assert.equal(chain.steps[1].status, 'pending');
  assert.equal(jobs.size, 1);
});

test('stop is scoped, idempotent and excludes subsequent launches', async t => {
  const {chains, input, jobs, stopped} = await fixture(t);
  await chains.create(input); await chains.tick();
  for (const scope of [{...input, cwd: 'another'}, {...input, account: randomUUID()}, {...input, provider: 'copilot' as const}]) {
    assert.deepEqual(await chains.list(scope), []);
    await assert.rejects(chains.get(input.id, scope), /not found/);
    await assert.rejects(chains.stop(input.id, scope), /not found/);
  }
  await assert.rejects(chains.create({...input, context: 'Changed'}), /already used/);
  const job = [...jobs.values()][0]; job.sessionId = randomUUID();
  await Promise.all([chains.stop(input.id, input), chains.stop(input.id, input)]);
  await chains.tick();
  assert.equal(stopped.length, 1); assert.equal(jobs.size, 1);
  const chain = await chains.get(input.id, input);
  assert.equal(chain.status, 'stopped'); assert.equal(chain.steps[0].status, 'stopped');
  assert.equal(chain.steps[0].sessionId, job.sessionId);
});

test('restart retains private context and job link without replaying an interrupted step', async t => {
  const {chains, input, options, jobs} = await fixture(t);
  await chains.create(input); await chains.tick();
  const job = [...jobs.values()][0]; job.sessionId = randomUUID(); await chains.tick();
  await chains.close();
  const restored = new MarkdownChains(options);
  try {
    await restored.tick();
    const chain = await restored.get(input.id, input);
    assert.equal(chain.context, input.context); assert.equal(chain.status, 'failed');
  assert.equal(chain.steps[0].jobId, undefined); assert.equal(chain.steps[0].sessionId, job.sessionId);
    assert.match(chain.steps[0].error!, /restarted/);
    assert.equal((await restored.create(input)).status, 'failed'); assert.equal(jobs.size, 1);
  } finally { await restored.close(); }
});

test('a launch refusal records failure without a dead chat link', async t => {
  const {options, input} = await fixture(t);
  const refused = new MarkdownChains({...options, start: async () => { throw new Error('Synthetic refusal'); }});
  try {
    await refused.create(input); await refused.tick(); await refused.tick();
    const chain = await refused.get(input.id, input);
    assert.equal(chain.status, 'failed');
    assert.equal(chain.steps[0].jobId, undefined);
    assert.equal(chain.steps[1].status, 'pending');
  } finally { await refused.close(); }
});
