import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ExistingClaudeJira, JiraToolResult } from '../server/jira-existing';

test('existing connector reads assigned issues, caches lists, refreshes individual issues and keeps disconnect local', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pocket-existing-'));
  const calls: string[] = [];
  const call = async (name: string, args: any) => {
    calls.push(name);
    if (name === 'getAccessibleAtlassianResources') return { data: { resources: [{ cloudId: 'site', url: 'https://example.atlassian.net', products: [{ id: 'jira' }] }] } };
    const issue = { key: 'TEST-1', fields: { summary: 'Original issue', description: 'Unmodified text' } };
    if (name === 'searchJiraIssuesUsingJql') { assert.equal(args.jql, 'assignee = currentUser() ORDER BY updated DESC'); return { data: { issues: [issue], nextPageToken: 'next' } }; }
    assert.equal(name, 'getJiraIssue'); assert.equal(args.view, 'full'); assert.equal(args.responseContentFormat, 'markdown'); return issue;
  };
  try {
    const file = path.join(dir, 'preference.json'), jira = new ExistingClaudeJira(file, call);
    assert.equal((await jira.status()).source, 'claude');
    assert.equal((await jira.issues('site')).next, 'next');
    await jira.issues('site'); assert.equal(calls.filter(x => x === 'searchJiraIssuesUsingJql').length, 1);
    await jira.issue('site', 'TEST-1'); await jira.issue('site', 'TEST-1');
    assert.equal(calls.filter(x => x === 'getJiraIssue').length, 2);
    await assert.rejects(jira.issues('foreign'), /available Jira site/);
    await jira.disconnect();
    assert.equal((await new ExistingClaudeJira(file, call).status()).connected, false);
    await assert.rejects(jira.issues('site'), /Enable/);
    assert.equal((await jira.useExisting()).connected, true);
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('only an exact tool response is accepted, not model prose or another request', () => {
  const reader = new JiraToolResult('getJiraIssue', {cloudId:'site',issueIdOrKey:'TEST-1'});
  assert.equal(reader.accept({type:'result',result:'{"key":"FAKE-1"}'}), undefined);
  reader.accept({type:'assistant',message:{content:[{type:'tool_use',name:'mcp__claude_ai_Atlassian_MCP__getJiraIssue',id:'a',input:{cloudId:'site',issueIdOrKey:'TEST-1'}}]}});
  assert.equal(reader.accept({type:'user',message:{content:[{type:'tool_result',tool_use_id:'other',content:'{}'}]}}),undefined);
  assert.deepEqual(reader.accept({type:'user',message:{content:[{type:'tool_result',tool_use_id:'a',content:[{type:'text',text:'{"key":"TEST-1"}'}]}]}}),{value:{key:'TEST-1'}});
});

test('read guard blocks Jira writes and altered arguments even if other permissions allow them', () => {
  const check = (name: string, input: unknown) => spawnSync(process.execPath, ['server/jira-read-guard.cjs'], { input: JSON.stringify({tool_name:name,tool_input:input}), env:{...process.env,POCKET_JIRA_READ_NAME:'getJiraIssue',POCKET_JIRA_READ_ARGS:'{"cloudId":"site"}'}}).status;
  assert.equal(check('mcp__claude_ai_Atlassian_MCP__getJiraIssue',{cloudId:'site'}),0);
  assert.equal(check('mcp__claude_ai_Atlassian_MCP__getJiraIssue',{cloudId:'other'}),2);
  assert.equal(check('mcp__claude_ai_Atlassian_MCP__executeWrite',{}),2);
  assert.equal(check('Bash',{command:'echo no'}),2);
});
