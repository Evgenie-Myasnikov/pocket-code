import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { ExistingClaudeJira } from '../server/jira-existing.js';
import { AtlassianJira, jiraIssue, jiraIssuesJql, jiraMatchesStage, jiraTransitions, jiraTransitionUncertain } from '../server/jira.js';

const resources = { resources: [{ cloudId: 'site', url: 'https://example.atlassian.net', products: [{ id: 'jira' }] }] };
const transitionData = { data: { transitions: [{ id: '21', name: 'Begin review', to: { id: '10002', name: 'Review' }, fields: {
  customfield_100: { name: 'Reviewer', required: true, schema: { type: 'user', custom: 'userpicker' }, allowedValues: [{ accountId: 'synthetic-user', displayName: 'Reviewer' }], hasDefaultValue: false },
  resolution: { name: 'Resolution', required: false, schema: { type: 'resolution', system: 'resolution' } },
} }] } };
async function temporary(t: any) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pocket-jira-workflow-'));
  t.after(async () => { assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true }); });
  return directory;
}

test('Jira filters preserve current-user scope and quote untrusted search/type values', () => {
  assert.equal(jiraIssuesJql(), 'assignee = currentUser() ORDER BY updated DESC');
  assert.equal(jiraIssuesJql({ search: 'test-42' }), 'assignee = currentUser() AND key = "TEST-42" ORDER BY updated DESC');
  const query = jiraIssuesJql({ search: 'x" OR assignee != currentUser() OR text ~ "x', type: 'Bug" OR project = "foreign', stage: 'development' });
  assert.equal(query, 'assignee = currentUser() AND text ~ "x\\" OR assignee != currentUser() OR text ~ \\"x" AND issuetype = "Bug\\" OR project = \\"foreign" ORDER BY updated DESC');
  assert.throws(() => jiraIssuesJql({ stage: 'development) OR project=foreign' }));
  assert.throws(() => jiraIssuesJql({ stage: 'constructor' }));
  assert.throws(() => jiraIssuesJql({ search: 'x\nOR project=foreign' }));
});

test('Jira normalizes workflow IDs, assignment and required transition fields', () => {
  const issue = jiraIssue({ key: 'TEST-1', fields: { status: { id: '1', name: 'Open' }, issuetype: { name: 'Bug' }, project: { key: 'TEST' }, assignee: { accountId: 'user-1' } } }, { id: 'site', name: 'Example', url: 'https://example.atlassian.net' });
  assert.equal(issue.statusId, '1'); assert.equal(issue.issueType, 'Bug'); assert.equal(issue.projectKey, 'TEST'); assert.equal(issue.assigneeId, 'user-1');
  assert.equal(jiraMatchesStage({ ...issue, status: 'Ждёт проверки' }, 'waiting_qa'), true);
  assert.equal(jiraMatchesStage({ ...issue, status: 'Беклог' }, 'backlog'), true);
  assert.equal(jiraMatchesStage({ ...issue, status: 'PR Ревью' }, 'pr_review'), true);
  assert.equal(jiraMatchesStage({ ...issue, status: 'Закрыто без решения' }, 'done'), false);
  const [transition] = jiraTransitions(transitionData);
  assert.equal(transition.id, '21'); assert.equal(transition.to.id, '10002');
  assert.equal(transition.fields.customfield_100.required, true);
  assert.equal(transition.fields.customfield_100.schema.type, 'user');
  assert.equal(transition.fields.customfield_100.hasDefaultValue, false);
  assert.equal(transition.fields.customfield_100.allowedValues?.[0].accountId, 'synthetic-user');
  assert.throws(() => jiraTransitions({ transitions: [{ id: '21', name: 'Review' }] }));
});

test('compact Rovo transition metadata preserves missing destination IDs instead of inventing them', () => {
  const [transition] = jiraTransitions({ data: { transitions: [{ id: '21', name: 'Begin review', to: { name: 'Review', statusCategory: { key: 'indeterminate' } }, hasScreen: false, isAvailable: true, fields: {} }] } });
  assert.equal(transition.id, '21'); assert.equal(transition.to.name, 'Review');
  assert.equal(transition.to.id, undefined); assert.equal(Object.hasOwn(transition.to, 'id'), false);
  assert.throws(() => jiraTransitions({ transitions: [{ id: '21', name: 'Review', to: { name: 'Review', id: 'not-a-status-id' } }] }));
  const transitions = jiraTransitions({ transitions: [
    { id: '1', name: 'Unavailable', to: { name: 'Review' }, isAvailable: false },
    { id: '2', name: 'Available', to: { name: 'Review' }, isAvailable: true },
    { id: '3', name: 'Legacy', to: { name: 'Review' } },
  ] });
  assert.deepEqual(transitions.map(item => item.id), ['2', '3']);
});

test('stage filtering tolerates site-specific statuses and retains pagination through empty pages', async t => {
  const directory = await temporary(t); let reads = 0;
  const jira = new ExistingClaudeJira(path.join(directory, 'preferences.json'), async (name, args) => {
    if (name === 'getAccessibleAtlassianResources') return resources;
    reads++; assert.ok(!String(args.jql).includes('status IN'));
    return { issues: [{ key: 'TEST-1', fields: { status: { name: 'Ждет проверки' } } }], nextPageToken: 'page-2' };
  });
  const empty = await jira.issues('site', undefined, { stage: 'development' });
  assert.deepEqual(empty.issues, []); assert.equal(empty.next, 'page-2');
  assert.equal((await jira.issues('site', undefined, { stage: 'waiting_qa' })).issues.length, 1);
  assert.equal(reads, 1); // Raw pages can be safely shared; stage filtering is applied afterwards.
});

test('existing connector separates filter caches and forwards transition metadata and exact user fields', async t => {
  const directory = await temporary(t), calls: { name: string; args: any }[] = [], writes: any[] = [];
  const jira = new ExistingClaudeJira(path.join(directory, 'preferences.json'), async (name, args) => {
    calls.push({ name, args });
    if (name === 'getAccessibleAtlassianResources') return resources;
    if (name === 'executeRead') return transitionData;
    return { issues: [], nextPageToken: 'page-2' };
  }, async (name, args) => { writes.push({ name, args }); return { status: { id: '10002', name: 'Review' } }; });
  await jira.issues('site', undefined, { type: 'Bug' });
  await jira.issues('site', undefined, { type: 'Bug' });
  await jira.issues('site', 'page-2', { type: 'Bug' });
  await jira.issues('site', undefined, { type: 'Task' });
  assert.equal(calls.filter(c => c.name === 'searchJiraIssuesUsingJql').length, 3);
  assert.equal((await jira.transitions('site', 'TEST-1'))[0].fields.customfield_100.required, true);
  assert.deepEqual(calls.find(c => c.name === 'executeRead')?.args, { cloudId: 'site', name: 'listJiraIssueTransitions', inputs: { issueIdOrKey: 'TEST-1', expand: 'transitions.fields' } });
  await jira.transition('site', 'TEST-1', '21', { customfield_100: { accountId: 'synthetic-user' } });
  assert.deepEqual(writes, [{ name: 'transitionJiraIssue', args: { cloudId: 'site', issueIdOrKey: 'TEST-1', transitionId: '21', fields: { customfield_100: { accountId: 'synthetic-user' } } } }]);
  await jira.issues('site', undefined, { type: 'Bug' });
  assert.equal(calls.filter(c => c.name === 'searchJiraIssuesUsingJql').length, 4);
  await assert.rejects(jira.transition('foreign', 'TEST-1', '21'), /available Jira site/);
  await assert.rejects(jira.transition('site', 'TEST-1', 'bad'), /Invalid Jira transition/);
  assert.equal(writes.length, 1);
});

test('ambiguous write failure is not retried and invalidates stale pending issue-list caches', async t => {
  const directory = await temporary(t); let release!: (value: any) => void, reads = 0, writes = 0;
  const jira = new ExistingClaudeJira(path.join(directory, 'preferences.json'), async name => {
    if (name === 'getAccessibleAtlassianResources') return resources;
    reads++;
    if (reads === 1) return new Promise(resolve => { release = resolve; });
    return { issues: [] };
  }, async () => { writes++; throw new Error('synthetic private failure'); });
  await jira.status(); const old = jira.issues('site');
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  await assert.rejects(jira.transition('site', 'TEST-1', '21'), { message: jiraTransitionUncertain });
  release({ issues: [] }); await old;
  await jira.issues('site'); assert.equal(reads, 2); assert.equal(writes, 1);
});

test('OAuth adapter uses discovered transition operation and never retries partial-success writes', async () => {
  const calls: any[] = [];
  const jira = new AtlassianJira({ load: async () => ({ tokens: { access_token: 'synthetic' }, sites: [{ id: 'site', name: 'Example', url: 'https://example.atlassian.net' }] }), save: async () => {} });
  await jira.status();
  (jira as any).connected = Promise.resolve({ callTool: async (call: any) => { calls.push(call); return { structuredContent: call.name === 'executeRead' ? transitionData : { success: false, status: { name: 'Review' }, error: 'synthetic private details' } }; } });
  assert.equal((await jira.transitions('site', 'TEST-1'))[0].id, '21');
  await assert.rejects(jira.transition('site', 'TEST-1', '21'), { message: jiraTransitionUncertain });
  assert.equal(calls.filter(c => c.name === 'transitionJiraIssue').length, 1);
});

function guard(script: string, name: string, args: unknown, env: Record<string, string>): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { windowsHide: true, env: { ...process.env, ...env }, stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', reject); child.on('close', resolve);
    child.stdin.end(JSON.stringify({ tool_name: name, tool_input: args }));
  });
}
test('transition guard permits exactly one matching write across concurrent hooks and denies altered fields', async t => {
  const directory = await temporary(t), args = { cloudId: 'site', issueIdOrKey: 'TEST-1', transitionId: '21', fields: { customfield_100: { accountId: 'synthetic-user' } } };
  const env = { POCKET_JIRA_READ_NAME: 'transitionJiraIssue', POCKET_JIRA_READ_ARGS: JSON.stringify(args), POCKET_JIRA_WRITE_CLAIM: path.join(directory, 'claimed') };
  const script = 'server/jira-operation-guard.cjs', tool = 'mcp__claude_ai_Atlassian_MCP__transitionJiraIssue';
  assert.equal(await guard(script, 'ToolSearch', { query: 'transition' }, env), 0);
  assert.equal(await guard(script, tool, { ...args, fields: { customfield_100: { accountId: 'different-user' } } }, env), 2);
  const results = await Promise.all([guard(script, tool, args, env), guard(script, tool, args, env), guard(script, tool, args, env)]);
  assert.deepEqual(results.sort(), [0, 2, 2]);
  assert.equal(await guard(script, 'Bash', {}, env), 2);
  assert.equal(await guard(script, 'mcp__claude_ai_Atlassian_MCP__editJiraIssue', args, env), 2);
});

test('read guard allows only the discovered transitions read and cannot switch execute operations', async () => {
  const args = { cloudId: 'site', name: 'listJiraIssueTransitions', inputs: { issueIdOrKey: 'TEST-1', expand: 'transitions.fields' } };
  const env = { POCKET_JIRA_READ_NAME: 'executeRead', POCKET_JIRA_READ_ARGS: JSON.stringify(args) };
  const tool = 'mcp__claude_ai_Atlassian_MCP__executeRead', script = 'server/jira-read-guard.cjs';
  assert.equal(await guard(script, tool, args, env), 0);
  assert.equal(await guard(script, tool, { ...args, name: 'otherOperation' }, env), 2);
  assert.equal(await guard(script, tool, args, { ...env, POCKET_JIRA_READ_ARGS: JSON.stringify({ ...args, name: 'otherOperation' }) }), 2);
});
