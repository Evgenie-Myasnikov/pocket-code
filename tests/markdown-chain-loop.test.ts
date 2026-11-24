import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, {type TestContext} from 'node:test';
import {MarkdownChains, type ChainInput} from '../server/markdown-chains';
import {chainCompletionMarker, chainLoopMarker} from '../src/markdown-chain';
import type {JobView} from '../server/types';

async function fixture(t: TestContext, loop: ChainInput['loop'], worktrees?: unknown) {
  const file = await mkdtemp(path.join(os.tmpdir(), 'pocket-loop-'));
  const input: ChainInput = {id: randomUUID(), name: 'Polish', cwd: 'project', provider: 'codex', context: '', loop,
    tasks: [{title: 'Review', source: 'Markdown', body: 'List the remaining remarks.'}, {title: 'Fix', source: 'Markdown', body: 'Fix the remarks.'}]};
  const jobs = new Map<string, JobView>(), prompts: string[] = [];
  const chains = new MarkdownChains({worktrees: worktrees as never, file, intervalMs: 3600000, view: id => jobs.get(id), stop: () => {},
    start: (_input, id, prompt) => {
      const job: JobView = {id, cwd: input.cwd, status: 'running', messages: [], partial: '', approvals: [], startedAt: Date.now(), revision: 1, baseMessageCount: 0};
      jobs.set(id, job); prompts.push(prompt); return job;
    }});
  t.after(async () => { await chains.close(); await rm(file, {recursive: true, force: true}); });
  /** Finishes the running step with a reply and lets the host observe it. */
  async function finish(report: string, complete = true) {
    const detail = await chains.get(input.id, input), index = detail.steps.findIndex(step => step.status === 'running');
    const job = jobs.get(detail.steps[index].jobId!)!;
    job.status = 'done'; job.sessionId = randomUUID();
    job.messages = [{id: randomUUID(), role: 'assistant', blocks: [{type: 'text', text: report + (complete ? '\n' + chainCompletionMarker(input.id, index) : '')}]}];
    await chains.tick(); await chains.tick();
    return chains.get(input.id, input);
  }
  await chains.create(input); await chains.tick();
  return {input, chains, prompts, finish};
}

test('a looped chain starts the next lap from the first step and hands over the previous lap result', async t => {
  const {input, prompts, finish} = await fixture(t, {maxLaps: 3, until: 'no remarks remain'});
  assert.match(prompts[0], /lap 1 of at most 3/);
  assert.ok(!prompts[0].includes(chainLoopMarker(input.id)), 'only the last step decides about the next lap');
  let detail = await finish('Two remarks.');
  assert.match(prompts[1], /must stop when this holds: no remarks remain/);
  assert.ok(prompts[1].includes(chainLoopMarker(input.id)));
  detail = await finish('Fixed both remarks.');
  assert.equal(detail.status, 'running');
  assert.equal(detail.loop?.lap, 2);
  assert.deepEqual(detail.steps.map(step => step.status), ['running', 'pending']);
  assert.equal(prompts.length, 3);
  assert.match(prompts[2], /lap 2 of at most 3/);
  assert.match(prompts[2], /Result of the previous lap \(Fix\)\nFixed both remarks\./);
  assert.equal(detail.steps[0].previousChats?.length, 1, 'the chat of the first lap stays reachable');
});

test('the last step ends the loop with its decision line', async t => {
  const {input, prompts, finish} = await fixture(t, {maxLaps: 5, until: 'no remarks remain'});
  await finish('No remarks.');
  const detail = await finish('Nothing to fix.\n' + chainLoopMarker(input.id));
  assert.equal(detail.status, 'done');
  assert.equal(detail.loop?.ended, 'condition');
  assert.equal(detail.loop?.lap, 1);
  assert.equal(detail.steps[1].handoff, 'Nothing to fix.');
  assert.equal(prompts.length, 2);
});

test('a decision line from an earlier step does not end the loop', async t => {
  const {input, finish} = await fixture(t, {maxLaps: 2});
  await finish('Review done.\n' + chainLoopMarker(input.id));
  const detail = await finish('Fixed.');
  assert.equal(detail.loop?.lap, 2);
  assert.equal(detail.loop?.ended, undefined);
});

test('the lap limit always ends the loop', async t => {
  const {input, prompts, finish} = await fixture(t, {maxLaps: 2});
  await finish('Remarks.'); await finish('Fixed.');
  await finish('More remarks.');
  assert.ok(!prompts[3].includes(chainLoopMarker(input.id)), 'the last lap has no decision to make');
  const detail = await finish('Fixed again.');
  assert.equal(detail.status, 'done');
  assert.equal(detail.loop?.ended, 'limit');
  assert.equal(detail.loop?.lap, 2);
  assert.equal(prompts.length, 4);
});

test('a looped step that never confirms completion fails after three retries', async t => {
  const {chains, input, finish} = await fixture(t, {maxLaps: 3});
  let detail = await finish('Unclear.', false);
  for (let retry = 1; retry <= 3; retry++) {
    assert.equal(detail.status, 'running');
    assert.equal(detail.steps[0].retryCount, retry);
    t.mock.timers.enable({apis: ['Date'], now: Date.now() + 120000 * retry});
    await chains.tick();
    t.mock.timers.reset();
    detail = await finish('Still unclear.', false);
  }
  assert.equal(detail.status, 'failed');
  assert.match(detail.steps[0].error || '', /did not confirm completion/);
  assert.equal((await chains.list(input))[0].loop?.lap, 1);
});

test('a loop needs a lap limit from 2 to 20', async t => {
  const {chains, input} = await fixture(t, {maxLaps: 2});
  for (const maxLaps of [1, 21, 2.5])
    await assert.rejects(chains.create({...input, id: randomUUID(), loop: {maxLaps}}), /lap limit from 2 to 20/);
});

test('a lap that committed nothing ends the loop when the idle fuse is on', async t => {
  let head = 'a'.repeat(40);
  const bases: (string | undefined)[] = [];
  const worktrees = {hasRepository: async () => true, verify: async () => 'tree', projectDirectory: async () => 'tree', completedHead: async () => head,
    create: async (id: string, _cwd: string, from?: string) => { bases.push(from); return {branch: 'task/' + id, baseCommit: from ?? 'a'.repeat(40), cwd: 'tree'}; }};
  const {finish} = await fixture(t, {maxLaps: 5, stopIdle: true}, worktrees);
  await finish('Remarks.');
  head = 'b'.repeat(40);
  let detail = await finish('Fixed.');
  assert.equal(detail.loop?.lap, 2, 'a lap with a commit continues');
  assert.equal(bases[2], head, 'the next lap continues from the commit of the previous one');
  await finish('No remarks.');
  detail = await finish('Nothing changed.');
  assert.equal(detail.status, 'done');
  assert.equal(detail.loop?.ended, 'idle');
  assert.equal(detail.loop?.baseCommit, 'a'.repeat(40), 'the final review covers every lap');
});

test('chats of earlier laps stay task chats, outside the general chat list, until the chain is deleted', async t => {
  const {chains, input, finish} = await fixture(t, {maxLaps: 2});
  await finish('Remarks.');
  const lap = await finish('Fixed.');
  const earlier = lap.steps.flatMap(step => step.previousChats ?? []).map(chat => chat.sessionId);
  assert.equal(earlier.length, 2);
  const linked = chains.chatMembership([]);
  for (const sessionId of earlier) assert.ok(linked('codex', {sessionId}), 'the general list filters this chat out');
  await chains.stop(input.id, input);
  await chains.remove(input.id, input);
  assert.ok(!chains.chatMembership([])('codex', {sessionId: earlier[0]}));
});
