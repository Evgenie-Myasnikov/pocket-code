import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { activityItem, recentActivityJobs } from '../server/activity.js';
import { createApp } from '../server/app.js';
import type { JobView } from '../server/types.js';

function fixture(overrides: Partial<JobView> = {}): JobView {
  return { id: 'job-1', cwd: path.join(os.tmpdir(), 'fixture-project'), provider: 'claude', status: 'running', startedAt: 100,
    revision: 0, baseMessageCount: 0, messages: [{ id: 'user', role: 'user', blocks: [{ type: 'text', text: '  Build\n the app  ' }] },
      {id:'assistant',role:'assistant',blocks:[{type:'text',text:'PRIVATE_OUTPUT'}]}], partial: 'PRIVATE_STREAM', approvals: [], ...overrides };
}
const approval = (id: string, tool = 'AskUserQuestion') => ({ id, tool, input: { text: 'PRIVATE_QUESTION_INPUT' }, expiresAt: Date.now() + 10000 });

test('notification activity exposes only a safe action category and clears completed tools',()=>{
  const job=fixture({messages:[{id:'assistant',role:'assistant',blocks:[{type:'tool_use',id:'call-1',name:'Bash',input:{command:'PRIVATE_COMMAND'}}]}]});
  assert.equal(activityItem(job).action,'command');
  assert.doesNotMatch(JSON.stringify(activityItem(job)),/PRIVATE_COMMAND|Bash/);
  const version=activityItem(job).version;
  job.messages.push({id:'result',role:'user',blocks:[{type:'tool_result',tool_use_id:'call-1',content:'PRIVATE_OUTPUT'}]});
  assert.equal(activityItem(job).action,'responding');assert.equal(activityItem(job).version,version);
  assert.equal(activityItem({...job,status:'done'}).action,undefined);
  assert.equal(activityItem({...job,approvals:[approval('answer')]}).action,undefined);
});

test('activity represents questions, permissions and final outcomes without transcript data', () => {
  const job = fixture(), running = activityItem(job);
  assert.equal(running.title, 'Build the app'); assert.equal(running.status, 'running'); assert.equal(running.provider, 'claude');
  assert.equal(activityItem({...job,approvals:[approval('question')]}).status,'needs_input');
  assert.equal(activityItem({...job,provider:'codex',approvals:[approval('permission','Codex command')]}).status,'needs_input');
  for(const status of ['done','error','stopped'] as const) assert.equal(activityItem({...job,status,approvals:[approval('stale')]}).status,status);
  assert.doesNotMatch(JSON.stringify(running), /PRIVATE_|messages|partial|approvals|input|revision/);
  assert.equal(activityItem({...job,jira:{site:'fixture',key:'TEST-42',summary:'Repair task',url:'https://example.invalid'}}).title,'TEST-42 Repair task');
  assert.equal(activityItem({...job,messages:[]}).title,'fixture-project');
  assert.equal(activityItem({...job,messages:[{id:'u',role:'user',blocks:[{type:'text',text:'a'.repeat(500)}]}]}).title.length,160);
});

test('only completed activity exposes the last assistant result ID for history acknowledgement', () => {
  const messages:JobView['messages']=[{id:'user',role:'user',blocks:[{type:'text',text:'Question'}]},
    {id:'assistant-first',role:'assistant',blocks:[{type:'text',text:'Working'}]},
    {id:'assistant-last',role:'assistant',blocks:[{type:'text',text:'Done'}]},
    {id:'trailing-user-tool',role:'user',blocks:[{type:'tool_result',content:'Tool output'}]}];
  assert.equal(activityItem(fixture({status:'done',messages})).resultMessageId,'assistant-last');
  for(const status of ['running','error','stopped'] as const) assert.equal(activityItem(fixture({status,messages})).resultMessageId,undefined);
  assert.equal(activityItem(fixture({status:'running',messages,approvals:[approval('pending')]})).resultMessageId,undefined);
  assert.equal(activityItem(fixture({status:'done',messages:[messages[0]]})).resultMessageId,undefined,'a user message must never stand in for a completed result');
  assert.equal(activityItem(fixture({status:'done',messages})).version,activityItem(fixture({status:'done',messages:[]})).version,'metadata arrival does not create another attention state');
});

test('activity version changes only for a status or new pending request', () => {
  const job=fixture(), initial=activityItem(job).version;
  assert.equal(activityItem({...job,revision:700,partial:'more tokens',sessionId:'new-session-id'}).version,initial);
  const requests=[approval('a'),approval('b','Write')];
  const waiting=activityItem({...job,approvals:requests}).version;
  assert.notEqual(waiting,initial);assert.equal(activityItem({...job,approvals:[...requests].reverse()}).version,waiting);
  assert.notEqual(activityItem({...job,approvals:[approval('new-question')]}).version,waiting);
  assert.equal(activityItem({...job,approvals:[]}).version,initial);
  const done=activityItem({...job,status:'done'}).version;
  assert.notEqual(done,initial);assert.equal(activityItem({...job,status:'done',revision:999,approvals:requests}).version,done);
  assert.notEqual(activityItem({...job,status:'error'}).version,done);
  assert.notEqual(activityItem({...job,id:'job-2'}).version,initial);
});

test('activity keeps only the newest turn per provider chat and gives its new result a fresh version', () => {
  const old=fixture({id:'turn-old',sessionId:'chat',status:'done',startedAt:1});
  const running=fixture({id:'turn-new',sessionId:'chat',startedAt:2});
  const otherProvider=fixture({id:'codex-turn',sessionId:'chat',provider:'codex',status:'done',startedAt:3});
  const pending=fixture({id:'pending',startedAt:4});
  const anotherPending=fixture({id:'another-pending',startedAt:5});
  assert.deepEqual(recentActivityJobs([old,running,otherProvider,pending,anotherPending]).map(job=>job.id),['another-pending','pending','codex-turn','turn-new']);
  assert.equal(recentActivityJobs([running,old])[0].status,'running');
  const completed={...running,status:'done' as const};
  const latest=recentActivityJobs([old,completed])[0];
  assert.equal(latest.id,'turn-new');assert.notEqual(activityItem(latest).version,activityItem(old).version,'a new completed turn requires its own acknowledgement');
});

test('activity preserves older active chats before applying the cap but returns newest first', () => {
  const completed=Array.from({length:105},(_,index)=>fixture({id:`done-${index}`,sessionId:`chat-${index}`,status:'done',startedAt:index+10}));
  const running=fixture({id:'old-running',sessionId:'active-chat',startedAt:1});
  const waiting=fixture({id:'old-waiting',sessionId:'question-chat',startedAt:2,approvals:[approval('question')]}),before=[...completed,running,waiting];
  const result=recentActivityJobs(before);
  assert.equal(result.length,100);assert.equal(result[0].id,'done-104');assert.equal(result.at(-1)!.id,'old-running');assert.equal(result.at(-2)!.id,'old-waiting');
  assert.equal(result.filter(job=>job.status==='done').length,98);assert.equal(before[0].id,'done-0','selection must not reorder the caller snapshot');
});

test('activity HTTP feed is authenticated, bounded and combines only retained bridge jobs without provider RPC', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-activity-'));
  const rows=Array.from({length:106},(_,i)=>fixture({id:`job-${i}`,cwd:root,provider:i%2?'codex':'claude',startedAt:i,
    status:i===105?'running':'done',approvals:i===105?[approval('question')]:[],sessionId:`session-${i}`}));
  const engine=(provider:'claude'|'codex')=>({
    list:()=>rows.filter(row=>row.provider===provider).map(row=>({...row,messages:[],partial:''})),
    get:(id:string)=>rows.find(row=>row.id===id)!,view:(row:JobView)=>row,close:()=>{},
    status:()=>{throw new Error('Activity must not connect to provider');}, sessions:()=>{throw new Error('Activity must not load desktop history');}
  });
  const runtime=await createApp({roots:[root],uploads:path.join(root,'uploads'),token:'a'.repeat(43),hostName:'Fixture',desktopSessionIndexes:[],codex:engine('codex') as any},engine('claude') as any);
  const server=runtime.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{runtime.terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});});
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/activity`;
  assert.equal((await fetch(url)).status,401);
  const response=await fetch(url,{headers:{Authorization:`Bearer ${'a'.repeat(43)}`}});assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const items=await response.json();assert.equal(items.length,100);assert.equal(items[0].id,'job-105');assert.equal(items.at(-1).id,'job-6');
  assert.equal(items[0].status,'needs_input');assert.equal(items[0].title,'Build the app');assert.equal(items[0].provider,'codex');assert.equal(items[1].provider,'claude');
  assert.equal(items[0].sessionId,'session-105');assert.doesNotMatch(JSON.stringify(items),/PRIVATE_/);
});

test('activity works when Codex is not configured and does not initialize it', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-activity-empty-'));
  const runtime=await createApp({roots:[root],uploads:path.join(root,'uploads'),token:'b'.repeat(43),hostName:'Fixture',desktopSessionIndexes:[]});
  const server=runtime.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{runtime.jobs.close();runtime.terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});});
  const response=await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/activity`,{headers:{Authorization:`Bearer ${'b'.repeat(43)}`}});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),[]);
});
