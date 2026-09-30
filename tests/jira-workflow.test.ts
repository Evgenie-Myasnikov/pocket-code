import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JiraWorkflow, type WorkflowInput } from '../server/jira-workflow.js';
import { workflowActions, workflowStage } from '../server/jira-workflow-actions.js';
import type { JiraIssue, JiraService, JiraTransition } from '../server/jira.js';
import type { JobView } from '../server/types.js';

const transition = (id: string, name: string, fields: JiraTransition['fields'] = {}): JiraTransition => ({ id, name, to: { id, name }, fields });
const baseIssue: JiraIssue = { key: 'TEST-1', summary: 'Example task', description: 'Acceptance criteria', priority: 'Normal', status: 'Open', statusId: '1', updated: '', url: 'https://example.atlassian.net/browse/TEST-1' };
async function fixture() {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'pocket-workflow-'));
  let issue = { ...baseIssue }, moves: JiraTransition[] = [transition('2', 'In Progress')], starts = 0, writes = 0, prs = 0, failStart = false, lostWrite = false, failWrite = false;
  const jobs = new Map<string, JobView>(), resumed: Array<string | undefined> = [];
  const jira: JiraService = { status: async () => ({ connected: true, sites: [] }), connect: async () => ({ authorizationUrl: '', state: '' }), finish: async () => {}, disconnect: async () => {}, issues: async () => ({ issues: [issue], next: null }), issue: async () => ({ ...issue }), transitions: async () => moves,
    transition: async (_s, _k, id) => { writes++; if (failWrite) throw new Error('Rejected'); const next = moves.find(t => t.id === id)!; issue = { ...issue, status: next.to.name, statusId: next.to.id }; if (lostWrite) throw new Error('Lost response'); } };
  const deps = { jira, validate: async (input: WorkflowInput) => input.cwd,
    job: (id: string) => jobs.get(id), start: async (input: WorkflowInput, _issue: JiraIssue, sessionId?: string) => {
      if (failStart) throw new Error('Could not start'); starts++; resumed.push(sessionId);
      const job: JobView = { id: input.id, cwd: input.cwd, provider: input.provider, sessionId: sessionId || randomUUID(), status: 'done', messages: [], partial: '', approvals: [], startedAt: Date.now(), revision: 0, baseMessageCount: 0 };
      jobs.set(job.id, job); return job;
    }, pullRequests: { preview: async () => ({ ready: true, base: 'main', head: 'task', headSha: 'a'.repeat(40), files: ['feature.ts'], commits: 1, existing: prs ? { url: 'https://github.com/example/project/pull/1', number: 1 } : undefined }), create: async () => { prs++; return { url: 'https://github.com/example/project/pull/1', number: 1 }; } } };
  const file = path.join(folder, 'workflow.json'), workflow = new JiraWorkflow(file, deps);
  const input = (extra: Partial<WorkflowInput> = {}): WorkflowInput => ({ id: randomUUID(), site: 'site', key: 'TEST-1', provider: 'claude', role: 'developer', action: 'start_development', cwd: folder, mode: 'default', maxBudgetUsd: 5, transitionId: '2', ...extra });
  return { workflow, input, jobs, resumed, reopen: () => new JiraWorkflow(file, deps), state: (status: string, statusId = status) => { issue = { ...issue, status, statusId }; }, moves: (value: JiraTransition[]) => { moves = value; }, failStart: (value: boolean) => { failStart = value; }, lostWrite: () => { lostWrite = true; }, failWrite: (value: boolean) => { failWrite = value; }, counts: () => ({ starts, writes, prs }), cleanup: () => rm(folder, { recursive: true, force: true }) };
}

test('role actions follow live transitions and screenshot stage names', () => {
  assert.equal(workflowStage('Ждет проверки'), 'waiting_qa'); assert.equal(workflowStage('Ожидает влитие'), 'waiting_merge');
  assert.equal(workflowStage('Выполнено'), 'done'); assert.equal(workflowStage('custom'), 'other');
  assert.deepEqual(workflowActions(baseIssue, 'reviewer', [transition('2', 'In Progress')]), []);
  assert.deepEqual(workflowActions(baseIssue, 'developer', []).map(x => x.id), []);
  assert.deepEqual(workflowActions({ ...baseIssue, status: 'На проверке' }, 'qa', [transition('8', 'Ожидает влитие'), transition('2', 'В работе')]).map(x => x.id), ['start_qa', 'pass_qa', 'fail_qa']);
});
test('start transitions before one chat, survives reload, and never auto creates PR', async () => {
  const f = await fixture(); try {
    const input = f.input(), result = await f.workflow.act(input);
    assert.equal(result.view.stage, 'development'); assert.ok(result.job?.sessionId);
    await f.reopen().act(input);
    assert.deepEqual(f.counts(), { starts: 1, writes: 1, prs: 0 });
    const view = await f.reopen().view('site', 'TEST-1', 'claude', 'developer'); assert.equal(view.link?.sessionId, result.job?.sessionId);
  } finally { await f.cleanup(); }
});
test('missing required field and stale role action have no side effects', async () => {
  const f = await fixture(); try {
    f.moves([transition('2', 'In Progress', { estimate: { name: 'Estimate', required: true, schema: { type: 'number' } } })]);
    await assert.rejects(f.workflow.act(f.input()), /Required Jira field/);
    await assert.rejects(f.workflow.act(f.input({ role: 'qa' })), /no longer available/);
    assert.deepEqual(f.counts(), { starts: 0, writes: 0, prs: 0 });
    await f.workflow.act(f.input({ fields: { estimate: 3 } })); assert.equal(f.counts().writes, 1);
  } finally { await f.cleanup(); }
});
test('lost transition response reconciles status without repeating the write', async () => {
  const f = await fixture(); try { f.lostWrite(); await f.workflow.act(f.input()); assert.deepEqual(f.counts(), { starts: 1, writes: 1, prs: 0 }); }
  finally { await f.cleanup(); }
});
test('launcher retry does not replay transition and refuses a task moved elsewhere', async () => {
  const f = await fixture(); try {
    const input = f.input(); f.failStart(true); await assert.rejects(f.workflow.act(input), /Could not start/);
    f.failStart(false); f.state('Done', '9'); await assert.rejects(f.workflow.act(input), /status|changed/i);
    assert.deepEqual(f.counts(), { starts: 0, writes: 1, prs: 0 });
    f.state('In Progress', '2'); await f.workflow.act(input); assert.deepEqual(f.counts(), { starts: 1, writes: 1, prs: 0 });
  } finally { await f.cleanup(); }
});
test('PR is retained when Jira rejects review transition; explicit retry does not create another PR', async () => {
  const f = await fixture(); try {
    await f.workflow.act(f.input()); f.moves([transition('3', 'PR Review')]); f.failWrite(true);
    const input = f.input({ action: 'submit_review', transitionId: '3', pullRequest: { title: 'TEST-1 Example task', body: 'Verified changes', base: 'main', head: 'task', headSha: 'a'.repeat(40) } });
    await assert.rejects(f.workflow.act(input), /did not confirm/);
    assert.ok((await f.workflow.view('site', 'TEST-1', 'claude', 'developer')).link?.pr);
    f.failWrite(false); await f.reopen().act(input); assert.equal(f.counts().prs, 1); assert.equal(f.counts().starts, 1);
  } finally { await f.cleanup(); }
});
test('batch checks current status and required fields rather than guessing a transition', async () => {
  const f = await fixture(); try {
    f.state('Done', '9'); const { action: _, ...input } = f.input();
    await assert.rejects(f.workflow.batch(input), /no start action/);
    f.state('Open', '1'); f.moves([transition('2', 'In Progress'), transition('22', 'In Development')]);
    await assert.rejects(f.workflow.batch(input), /Choose the Jira transition/);
    assert.deepEqual(f.counts(), { starts: 0, writes: 0, prs: 0 });
  } finally { await f.cleanup(); }
});
test('continuation never resumes a conversation in a different project', async () => {
  const f = await fixture(); try {
    const first = await f.workflow.act(f.input());
    await f.workflow.act(f.input({ action: 'continue_development', transitionId: undefined, cwd: 'different-project' }));
    assert.equal(f.resumed[1], undefined);
    assert.notEqual((await f.workflow.view('site', 'TEST-1', 'claude', 'developer')).link?.sessionId, first.job?.sessionId);
  } finally { await f.cleanup(); }
});
test('interrupted action blocks other workspace and explicit recovery tombstones old requests', async () => {
  const f = await fixture(); try {
    const input = f.input(); f.failStart(true); await assert.rejects(f.workflow.act(input));
    await assert.rejects(f.workflow.act(f.input({ provider: 'codex', action: 'continue_development', transitionId: undefined })), /another workspace/);
    const pending = (await f.workflow.view('site', 'TEST-1', 'codex', 'developer')).pending;
    assert.equal(pending?.id, input.id); assert.equal(pending?.provider, 'claude');
    await f.workflow.recover('site', 'TEST-1', 'claude', input.id);
    f.failStart(false); await assert.rejects(f.workflow.act(input), /cleared/);
    await f.workflow.act(f.input({ provider: 'codex', action: 'continue_development', transitionId: undefined }));
    assert.deepEqual(f.counts(), { starts: 1, writes: 1, prs: 0 });
  } finally { await f.cleanup(); }
});
test('role changes retain the developer chat and resume it only in its original project', async () => {
  const f = await fixture(); try {
    const developer = await f.workflow.act(f.input()); f.state('PR Review', '3');
    await f.workflow.act(f.input({ action: 'start_review', role: 'reviewer', transitionId: undefined }));
    f.state('In Progress', '2');
    assert.equal((await f.workflow.view('site', 'TEST-1', 'claude', 'developer')).link?.sessionId, developer.job?.sessionId);
    await f.workflow.act(f.input({ action: 'continue_development', transitionId: undefined }));
    assert.equal(f.resumed[2], developer.job?.sessionId);
  } finally { await f.cleanup(); }
});
test('an action ID cannot be reused for another issue, provider or unrelated chat', async () => {
  const f = await fixture(); try {
    const input = f.input(); await f.workflow.act(input);
    await assert.rejects(f.workflow.act({ ...input, action: 'continue_development', provider: 'codex' }), /identifier/);
    await assert.rejects(f.workflow.act({ ...input, key: 'TEST-2' }), /identifier/);
    const foreignId = randomUUID(); f.jobs.set(foreignId, { ...f.jobs.get(input.id)!, id: foreignId });
    await assert.rejects(f.workflow.act(f.input({ id: foreignId, action: 'continue_development', transitionId: undefined })), /identifier/);
    assert.deepEqual(f.counts(), { starts: 1, writes: 1, prs: 0 });
  } finally { await f.cleanup(); }
});
