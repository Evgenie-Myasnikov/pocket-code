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

test('chain details retain the launch model and account label across retries and restarts',async t=>{
  const {input,options}=await fixture(t);
  let label='Example connection';
  const account=randomUUID(),plan={...input,provider:'claude' as const,account,model:'catalog-editor'};
  const configured={...options,accountName:async(id:string)=>id===account?label:undefined};
  const store=new MarkdownChains(configured);
  try{
    const created=await store.create(plan);
    assert.equal(created.model,plan.model);assert.equal(created.accountName,label);
    label='Renamed connection';
    assert.equal((await store.create(plan)).accountName,'Example connection');
    const stopped=await store.stop(plan.id,plan);
    assert.equal(stopped.model,plan.model);assert.equal(stopped.accountName,'Example connection');
  }finally{await store.close();}
  const restored=new MarkdownChains(configured);
  try{
    const detail=await restored.get(plan.id,plan);
    assert.equal(detail.model,plan.model);assert.equal(detail.accountName,'Example connection');
    const legacy=await restored.create({...input,id:randomUUID()});
    assert.equal(legacy.model,undefined);assert.equal(legacy.accountName,undefined);
  }finally{await restored.close();}
});

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
  assert.ok(chains.observingJobs().has(first.id),'the host still needs the completed job to save its handoff');
  first.messages = [{id: 'reply', role: 'assistant', blocks: [{type: 'text', text: 'x'.repeat(6400) + '\nOutline saved.\n' + chainCompletionMarker(input.id, 0)}]}];
  await chains.tick(); await chains.tick();
  detail = await chains.get(input.id, input);
  assert.equal(detail.steps[0].status, 'done');
  assert.ok(!chains.observingJobs().has(first.id));
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

test('assigned steps route handoffs, retries and chat links through their own provider and account',async t=>{
  const {input,options,jobs}=await fixture(t);
  const launched:ChainInput[]=[];
  const store=new MarkdownChains({...options,accountName:async()=> 'Fixture API',start:(settings,id,prompt)=>{
    launched.push(settings);return options.start(settings,id,prompt);
  }});
  t.after(()=>store.close());
  const account=randomUUID(), model='fixture-model';
  const owner={cwd:input.cwd,provider:'codex' as const};
  const plan={...input,model:'fixture-default',reasoningEffort:'medium',codexAccess:'auto' as const,tasks:[
    {...input.tasks[0],executor:{provider:'claude' as const,account,model}},input.tasks[1]
  ]};
  const created=await store.create(plan);
  assert.equal(created.steps[0].executorAccountName,'Fixture API');
  assert.deepEqual((await store.create(plan)).steps,created.steps);
  await assert.rejects(store.create({...plan,tasks:input.tasks}),/already used/);
  await store.tick();
  const first=[...jobs.values()][0]; first.sessionId=randomUUID();first.status='done';
  first.messages=[{id:'reply',role:'assistant',blocks:[{type:'text',text:'Retry the check.'}]}];
  await store.tick();
  const pending=await store.get(plan.id,owner);
  t.mock.method(Date,'now',()=>pending.steps[0].retryAt!+1);
  await store.tick();
  const retry=[...jobs.values()][1];retry.sessionId=randomUUID();retry.status='done';
  retry.messages=[{id:'done',role:'assistant',blocks:[{type:'text',text:'Check passed.\n'+chainCompletionMarker(plan.id,0)}]}];
  await store.tick();await store.tick();
  assert.equal(launched.length,3);
  for(const settings of launched.slice(0,2)){
    assert.equal(settings.provider,'claude');assert.equal(settings.account,account);assert.equal(settings.model,model);
    assert.equal(settings.reasoningEffort,undefined);assert.equal(settings.codexAccess,undefined);
  }
  assert.equal(launched[2].provider,'codex');assert.equal(launched[2].model,plan.model);
  assert.equal(launched[2].account,undefined);assert.equal(launched[2].reasoningEffort,'medium');
  const link=await store.findStep({...owner,provider:'claude',account},{sessionId:retry.sessionId});
  const previous=await store.findStep({...owner,provider:'claude',account},{sessionId:first.sessionId});
  assert.equal(previous[0]?.stepIndex,0);
  const notification=await store.notificationTarget('claude',input.cwd,{sessionId:first.sessionId});
  assert.deepEqual(notification,{id:plan.id,owner:{...owner,account:undefined}});
  const history=(await store.get(plan.id,owner)).steps[0].previousChats;
  assert.deepEqual(history,[{provider:'claude',account,cwd:input.cwd,sessionId:first.sessionId,attempt:1}]);
  const linked=store.chatMembership([]);
  assert.ok(linked('claude',{sessionId:first.sessionId,account}));
  assert.ok(linked('claude',{sessionId:retry.sessionId,account}));
  assert.ok(!linked('claude',{sessionId:first.sessionId}));
  assert.ok(!linked('codex',{sessionId:first.sessionId,account}));
  const saved=JSON.parse(await readFile(path.join(options.file,plan.id+'.json'),'utf8'));
  assert.deepEqual(saved.attempts.slice(0,2).map((a:{provider:string;account:string;sessionId:string})=>[a.provider,a.account,a.sessionId]),[
    ['claude',account,first.sessionId],['claude',account,retry.sessionId],
  ]);
  assert.equal(link[0].id,plan.id);assert.deepEqual(link[0].owner,{...owner,account:undefined});
  assert.deepEqual(await store.findStep(owner,{sessionId:retry.sessionId}),[]);
  assert.deepEqual(await store.findStep({...owner,provider:'claude'},{sessionId:retry.sessionId}),[]);
  await assert.rejects(store.get(plan.id,{...owner,provider:'claude',account}),/not found/);
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
  assert.equal(chain.status, 'running');
  assert.equal(chain.steps[0].retryCount, 1);
  assert.equal(chain.steps[0].retryReport, 'Waiting for your decision.');
  assert.equal(chain.steps[1].status, 'pending');
  assert.equal(jobs.size, 1);
  t.mock.method(Date, 'now', () => chain.steps[0].retryAt! + 1);
  await Promise.all([chains.tick(), chains.tick()]);
  assert.equal(jobs.size, 2);
  const retry = [...jobs.values()][1];
  retry.status = 'done';
  await chains.tick();
  await chains.stop(input.id, input);
  await chains.tick();
  assert.equal((await chains.get(input.id, input)).status, 'stopped');
  assert.equal(jobs.size, 2);
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

test('step output follows the current assistant reply, excludes tool and reasoning blocks and survives restart', async t => {
  const {chains, input, options, jobs} = await fixture(t);
  await chains.create(input); await chains.tick();
  const job = [...jobs.values()][0];
  job.messages = [
    {id: 'prompt', role: 'user', blocks: [{type: 'text', text: 'Input only'}]},
    {id: 'tool', role: 'assistant', blocks: [{type: 'thinking', thinking: 'Reasoning only'},
      {type: 'tool_use', id: 'call', name: 'Command', input: {command: 'tool argument'}}]}
  ];
  const step = async () => (await chains.get(input.id, input)).steps[0];
  assert.equal((await step()).output, undefined);
  assert.equal((await step()).phase, 'command');
  job.partial = 'Working on the outline';
  assert.equal((await step()).output, job.partial);
  assert.equal((await step()).phase, 'responding');
  job.approvals = [{id: 'ask', tool: 'AskUserQuestion', input: {}, expiresAt: 0}];
  assert.equal((await step()).phase, 'question');
  job.approvals = []; job.status = 'done';
  const result = 'Result line.\n'.repeat(2000) + 'Verified.';
  job.messages.push({id: 'result', role: 'assistant', blocks: [{type: 'text', text: result + '\n' + chainCompletionMarker(input.id, 0)}]});
  await chains.tick();
  const final = await step();
  assert.equal(final.output, result.slice(-12000));
  assert.equal(final.outputTruncated, true);
  assert.equal(final.phase, undefined);
  await chains.close();
  const restored = new MarkdownChains(options);
  try {
    assert.equal((await restored.get(input.id, input)).steps[0].output, final.output);
  } finally { await restored.close(); }
});

test('removal erases terminal task content durably, retains chats and rejects stale launches', async t => {
  const {chains, input, options, jobs} = await fixture(t);
  await chains.create(input); await chains.tick();
  await assert.rejects(chains.remove(input.id, input), /Stop the running/);
  const job = [...jobs.values()][0]; job.partial = 'Last observed answer';
  const stopped = await chains.stop(input.id, input);
  assert.equal(stopped.steps[0].output, job.partial);
  await assert.rejects(chains.remove(input.id, {...input, account: randomUUID()}), /not found/);
  for (const id of [input.id, input.id.toUpperCase()]) assert.deepEqual(await chains.remove(id, input), {ok: true});
  assert.equal(jobs.get(job.id), job);
  const tombstone = JSON.parse(await readFile(path.join(options.file, input.id + '.json'), 'utf8'));
  assert.deepEqual(Object.keys(tombstone).sort(), ['deletedScope', 'version']);
  await chains.close();
  const restored = new MarkdownChains(options);
  try {
    assert.deepEqual(await restored.list(input), []);
    assert.deepEqual(await restored.remove(input.id, input), {ok: true});
    await assert.rejects(restored.get(input.id, input), /not found/);
    await assert.rejects(restored.create(input), /already used/);
    await assert.rejects(restored.remove(input.id, {...input, cwd: 'other'}), /not found/);
  } finally { await restored.close(); }
});

test('step delegation is explicit in its prompt and child activity is scoped to that step',async t=>{
  const {chains,input,jobs,prompts}=await fixture(t);
  await chains.create({...input,parallelSubtasks:true});
  await chains.tick();
  assert.match(prompts[0],/use your native subagent tools/);
  const job=[...jobs.values()][0];
  const child={id:'child',name:'Inspect glossary',provider:'codex' as const,status:'running' as const};
  job.messages=[{id:'tool',role:'assistant',blocks:[{type:'subagent',agent:child}]}];
  const read=()=>chains.get(input.id,input);
  assert.deepEqual((await read()).steps[0].subtasks,[{id:'child',name:'Inspect glossary',status:'running'}]);
  await chains.tick();
  const sibling={...child,id:'peer',name:'Check sources',status:'completed' as const};
  // A newer transcript window may omit a previously observed child.
  job.messages=[{id:'peer',role:'assistant',blocks:[{type:'subagent',agent:sibling}]}];
  await chains.tick();
  assert.deepEqual((await read()).steps[0].subtasks?.map(item=>item.id),['child','peer']);
  job.messages=[{id:'tool-done',role:'assistant',blocks:[{type:'subagent',agent:{...child,status:'completed'}}]}];
  job.messages.push({id:'final',role:'assistant',blocks:[{type:'text',text:chainCompletionMarker(input.id,0)}]});
  job.status='done'; await chains.tick();
  const result=await read();
  assert.deepEqual(result.steps[0].subtasks,[{id:'child',name:'Inspect glossary',status:'completed'},{id:'peer',name:'Check sources',status:'completed'}]);
  assert.equal(result.steps[1].subtasks,undefined);
  assert.match(buildChainStepPrompt({...result,parallelSubtasks:false},1),/without delegating/);
  assert.doesNotMatch(buildChainStepPrompt({...result,parallelSubtasks:undefined},1),/subagent/);
});
