import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {type AddressInfo} from 'node:net';
import express from 'express';
import {HttpError} from '../server/security';
import {CustomProviders} from '../server/custom-providers';
import {mountTaskText,type GenerateText} from '../server/task-text';
import {planPrompt,readPlan,taskPlanInput,type PlanExecutor} from '../server/task-plan';

const files=[{name:'guide.md',text:'Prepare the example guide.'},{name:'checks.txt',text:'Review Markdown links.'}];
const input={provider:'copilot',cwd:'synthetic-project',language:'en',files};
const executors:PlanExecutor[]=[{provider:'codex',label:'Codex'},{provider:'claude',account:randomUUID(),model:'sample',label:'Example API · sample'}];
const proposed={name:'Guide',context:'Keep examples runnable.',tasks:[
  {title:'Draft the guide',body:'Write the example and run it.',source:0,executor:0},
  {title:'Verify',body:'Check the guide links.',source:1,executor:1}
]};

test('the planner uses source and host catalog indices and revises the current edited draft',()=>{
  const draft=readPlan(JSON.stringify(proposed),files,executors);
  assert.equal(draft.tasks[1].source,'checks.txt');
  assert.deepEqual(draft.tasks[1].executor,{provider:'claude',account:executors[1].account,model:'sample'});
  draft.tasks[0].body='Keep the reviewed acceptance criteria.';
  const plan=taskPlanInput.parse({...input,draft,brief:'Add a grammar review.'});
  const {prompt,system}=planPrompt(plan,executors);
  const parsed=JSON.parse(prompt);
  assert.deepEqual(parsed.files,files);assert.match(system,/revise/i);
  assert.equal(parsed.currentDraft.tasks[0].body,draft.tasks[0].body);
  assert.equal(parsed.currentDraft.tasks[1].executor,1);
  assert.ok(!prompt.includes(executors[1].account!));assert.ok(!prompt.includes(input.cwd));
  assert.throws(()=>taskPlanInput.parse({...input,executors:[{provider:'other'}]}));
  assert.throws(()=>taskPlanInput.parse({...input,files:[files[0],files[0]]}));
  assert.throws(()=>taskPlanInput.parse({...input,files:[{name:'huge.md',text:'я'.repeat(50001)}]}));
  for(const answer of ['not JSON',JSON.stringify({...proposed,tasks:[]}),JSON.stringify({...proposed,tasks:[{...proposed.tasks[1],executor:2}]}),
    JSON.stringify({...proposed,tasks:[{...proposed.tasks[1],source:-1}]}),JSON.stringify({...proposed,tasks:[{...proposed.tasks[0],run:true}]})])
    assert.throws(()=>readPlan(answer,files,executors),HttpError);
  assert.throws(()=>planPrompt(plan,[]),/Connect a task executor/);
});

test('planning isolates generation, validates scope and returns only a reviewable draft',async t=>{
  const app=express();app.use(express.json({limit:'1mb'}));
  const selected:string[]=[];
  let answer=JSON.stringify(proposed);
  const generate:GenerateText=async(_system,prompt,cwd)=>{
    assert.notEqual(cwd,input.cwd);
    assert.deepEqual(JSON.parse(prompt).files,files);
    selected.push('local');return answer;
  };
  const account=executors[1].account!;
  const close=mountTaskText(app,{busy:new Set(),providers:async()=>({providers:['copilot','codex']}),
    allowProject:async cwd=>{if(cwd!==input.cwd)throw new HttpError(403,'Not allowed');},
    executors:async()=>executors,generate:{copilot:generate,codex:generate},accounts:async()=>[{id:account,name:'Example API'}],
    custom:async(id,model)=>{assert.equal(id,account);assert.equal(model,'sample');selected.push('custom');return answer;}
  });
  app.use((error:HttpError,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{res.status(error.status||400).json({error:error.message});});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{close();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/task-text/plan';
  const post=(data:unknown)=>fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
  const catalog=await (await fetch(base+'/providers')).json();
  assert.deepEqual(catalog.executors,executors);assert.deepEqual(catalog.accounts,[{id:account,name:'Example API'}]);
  assert.equal((await post({...input,cwd:'outside'})).status,403);
  assert.equal((await post({...input,provider:'codex',files:[{name:'guide.md',text:'a'.repeat(4100)}]})).status,422);
  assert.deepEqual(selected,[]);
  assert.deepEqual(await (await post(input)).json(),readPlan(answer,files,executors));
  assert.equal((await post({...input,provider:'custom',account,model:'sample'})).status,200);
  answer='bad draft';assert.equal((await post(input)).status,422);
  assert.deepEqual(selected,['local','custom','local']);
});

test('API-key executors require an agent endpoint and advertised agent-safe models',async()=>{
  const make=(name:string)=>({id:randomUUID(),name,key:'test-key',url:'https://'+name+'.example.invalid/v1',messages:[],agentAuth:'bearer'});
  const profiles=[make('agent'),make('chat'),make('down'),{...make('unset'),key:''}];
  const calls:string[]=[];
  const providers=new CustomProviders({load:async()=>({profiles}),save:async()=>assert.fail('Existing auth was already correct')},async(url)=>{
    calls.push(String(url));const {hostname,pathname}=new URL(String(url));
    if(pathname.endsWith('/messages'))return new Response('{}',{status:hostname.startsWith('chat')?404:hostname.startsWith('down')?503:400});
    return Response.json({data:[{id:'example-model'},{id:'not a valid model'}]});
  });
  assert.deepEqual(await providers.taskExecutors(),[{provider:'claude',label:'agent · example-model',account:profiles[0].id,model:'example-model'}]);
  assert.ok(calls.every(url=>!url.includes('unset')));
});
