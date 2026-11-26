import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GeminiService,geminiAuth,geminiMessages,parseConversation,parseSettings,withContext,discoverGemini} from '../server/gemini';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';

const cli={command:process.execPath,args:[fileURLToPath(new URL('./fixtures/gemini-cli.mjs',import.meta.url))]};
async function waitFor(check:()=>boolean,timeout=15000){const end=Date.now()+timeout;while(!check()){if(Date.now()>end)throw new Error('Timed out');await new Promise(resolve=>setTimeout(resolve,25));}}
async function signedIn(home:string){await mkdir(path.join(home,'.gemini'),{recursive:true});await writeFile(path.join(home,'.gemini','settings.json'),'{\n // Google account\n "security": {"auth": {"selectedType": "oauth-personal"}},\n}');await writeFile(path.join(home,'.gemini','oauth_creds.json'),'{}');}

test('Gemini history is read like the CLI: replaced records, rewinds and hidden Pocket Code context',()=>{
  const lines=[
    {sessionId:'s-1',projectHash:'h',startTime:'2026-01-01T00:00:00Z',kind:'main'},
    {id:'u1',type:'user',content:[{text:withContext('Explain the project\n\nFiles attached by the user (read these local files as needed):\n"C:\\\\uploads\\\\a.png"','Board guidance')}]},
    {id:'g1',type:'gemini',content:'',toolCalls:[{id:'t1',name:'read_file',args:{file_path:'README.md'},status:'executing'}]},
    {id:'g1',type:'gemini',content:'It is an example.',thoughts:[{subject:'Plan',description:'Read the readme'}],toolCalls:[{id:'t1',name:'read_file',args:{file_path:'README.md'},status:'success',resultDisplay:'# Example'}]},
    {id:'u2',type:'user',content:'Dropped turn'},{$rewindTo:'u2'},
    {id:'i1',type:'info',content:'Ignored notice'},
  ].map(line=>JSON.stringify(line)).join('\n');
  const conversation=parseConversation(lines)!;
  assert.equal(conversation.sessionId,'s-1');
  const messages=conversation.records.flatMap(geminiMessages);
  assert.deepEqual(messages.map(m=>m.blocks[0].type),['text','thinking','tool_use','tool_result','text']);
  assert.equal(messages[0].blocks[0].text,'Explain the project');
  assert.equal(messages[3].blocks[0].content,'# Example');
  assert.equal(messages.at(-1)!.blocks[0].text,'It is an example.');
  assert.equal(parseConversation(JSON.stringify({sessionId:'legacy',messages:[{id:'a',type:'user',content:'Old format'}]}))!.records.length,1);
  assert.deepEqual(parseSettings('{"a": "x // not a comment", /* c */ "b": [1,],}'),{a:'x // not a comment',b:[1]});
});

test('Gemini sign-in is read from the CLI settings without reading credentials',async()=>{
  const home=await mkdtemp(path.join(os.tmpdir(),'gemini-auth-'));
  try{
    assert.equal(await geminiAuth(home,{}),'sign-in-required');
    await signedIn(home);assert.equal(await geminiAuth(home,{}),'google');
    await writeFile(path.join(home,'.gemini','settings.json'),JSON.stringify({security:{auth:{selectedType:'gemini-api-key'}}}));
    assert.equal(await geminiAuth(home,{}),'api-key');
    const missing=new GeminiService([home],{command:null,home});
    const status=await missing.status();assert.equal(status.available,false);assert.equal(status.access,'not-installed');assert.match(status.error,/npm install -g @google\/gemini-cli/);
    const apiKey=await new GeminiService([home],{command:cli,home}).status();assert.equal(apiKey.authenticated,false);assert.equal(apiKey.access,'api-key-not-supported');
    await assert.rejects(discoverGemini({PATH:path.join(home,'nowhere')}),/not installed/);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('Gemini chats stream from the CLI, list from its history and resume the same session',async()=>{
  const home=await mkdtemp(path.join(os.tmpdir(),'gemini-run-')),project=path.join(home,'project');
  await mkdir(project);await signedIn(home);
  const service=new GeminiService([project],{command:cli,home,env:{...process.env,GEMINI_API_KEY:'synthetic-key'}});
  try{
    const status=await service.status();
    assert.equal(status.access,'ready');assert.deepEqual(status.models.map(m=>m.id),['gemini-3-pro-preview','gemini-2.5-flash']);
    const first=service.start({id:randomUUID(),cwd:project,text:'Hello',model:'gemini-2.5-flash'});
    const sessionId=first.sessionId!;
    await waitFor(()=>service.get(first.id).status!=='running');
    const done=service.get(first.id);
    assert.equal(done.status,'done',done.error||'');
    assert.equal(done.messages.at(-1)!.blocks[0].text,'Hello from Gemini');
    assert.ok(done.messages.some(m=>m.blocks[0].type==='tool_result'&&m.blocks[0].content==='Synthetic file text'));
    assert.equal(done.generation?.outputTokens,20);assert.equal(done.generation?.outputTokensPerSecond,10);
    const listed=await service.sessions();
    assert.equal(listed.length,1);assert.equal(listed[0].sessionId,sessionId);assert.equal(listed[0].readOnly,false);assert.equal(listed[0].summary,'Hello');
    const history=await service.messages(sessionId);
    assert.equal(history[0].blocks[0].text,'Hello');assert.equal(history.at(-1)!.blocks[0].text,'Hello from Gemini');
    const second=service.start({id:randomUUID(),cwd:project,sessionId,text:'And a second one',access:'yolo'});
    await waitFor(()=>service.get(second.id).status!=='running');
    assert.equal(service.get(second.id).status,'done');
    assert.equal((await service.messages(sessionId)).at(-1)!.blocks[0].text,'Second answer');
    const calls=(await readFile(path.join(home,'gemini-args.log'),'utf8')).trim().split('\n').map(line=>JSON.parse(line)).filter(call=>!call.args.includes('--list-models'));
    const [a,b]=calls.slice(-2);
    assert.deepEqual(a.args.slice(a.args.indexOf('--session-id'),a.args.indexOf('--session-id')+2),['--session-id',sessionId]);
    assert.ok(a.args.includes('--model')&&a.args.includes('gemini-2.5-flash'));
    assert.equal(a.args[a.args.indexOf('--approval-mode')+1],'auto_edit');
    assert.deepEqual(b.args.slice(b.args.indexOf('--resume'),b.args.indexOf('--resume')+2),['--resume',sessionId]);
    assert.equal(b.args[b.args.indexOf('--approval-mode')+1],'yolo');
    // The host's API key never reaches the CLI: the Google account pays, not a paid key.
    assert.ok(calls.every(call=>!call.apiKey));
    assert.equal(path.resolve(a.cwd),path.resolve(project));
    // A follow-up during a turn runs as the next turn of the same chat.
    const slow=service.start({id:randomUUID(),cwd:project,sessionId,text:'SLOW question'});
    await service.followup(slow.id,{id:randomUUID(),text:'second follow-up'});
    assert.equal(service.get(slow.id).queued?.length,1);
    await waitFor(()=>service.get(slow.id).status!=='running');
    assert.equal(service.get(slow.id).status,'done');
    assert.equal(service.get(slow.id).messages.filter(m=>m.role==='user').length,2);
    const failed=service.start({id:randomUUID(),cwd:project,text:'FAIL now'});
    await waitFor(()=>service.get(failed.id).status!=='running');
    assert.equal(service.get(failed.id).status,'error');assert.equal(service.get(failed.id).error,'Synthetic failure');
    await assert.rejects(Promise.resolve().then(()=>service.start({id:randomUUID(),cwd:path.join(home,'..'),text:'x'})).then(job=>waitFor(()=>service.get(job.id).status!=='running').then(()=>{if(service.get(job.id).status==='error')throw new Error('outside');})),/outside/);
    await service.eraseOriginal(sessionId,project);
    assert.equal((await service.sessions()).some(s=>s.sessionId===sessionId),false);
  }finally{await service.close();await rm(home,{recursive:true,force:true});}
});

test('Gemini API lists chats, starts jobs with its access mode and keeps Jira providers separate',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'gemini-api-')),sid=randomUUID(),runs=new Map<string,any>();let started:any;
  const engine:any={status:async()=>({available:true,authenticated:true,access:'ready',models:[{id:'gemini-2.5-pro',name:'Gemini 2.5 Pro'}],error:''}),
    sessions:async()=>[{sessionId:sid,cwd:root,provider:'gemini',summary:'Gemini example',lastModified:1,readOnly:false}],
    messages:async()=>[{id:'x',role:'assistant',blocks:[{type:'text',text:'Gemini history'}]}],
    list:()=>[...runs.values()],get:(id:string)=>runs.get(id),view:(j:any)=>j,
    start:(input:any)=>{started=input;const job={id:input.id,provider:'gemini',cwd:input.cwd,sessionId:input.sessionId||randomUUID(),status:'running',messages:[],partial:'',approvals:[],startedAt:Date.now(),revision:1,baseMessageCount:0};runs.set(input.id,job);return job;},
    stop:(id:string)=>{runs.get(id).status='stopped';},forgetSession(){},close:async()=>{}};
  const token='t'.repeat(43),runtime=await createApp({roots:[root],uploads:path.join(root,'uploads'),token,hostName:'Fixture',listAllProviderChats:true,desktopSessionIndexes:[],gemini:engine},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
  const server=runtime.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}/api`,request=(endpoint:string,body?:unknown)=>fetch(base+endpoint,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  try{
    const providers=await(await request('/providers')).json();
    assert.equal(providers.find((p:any)=>p.id==='gemini').models[0].id,'gemini-2.5-pro');
    assert.equal((await(await request('/sessions?provider=gemini')).json())[0].sessionId,sid);
    assert.equal((await(await request(`/sessions/${sid}/messages?provider=gemini&window=20`)).json()).messages[0].blocks[0].text,'Gemini history');
    const id=randomUUID();
    const response=await request('/jobs',{id,provider:'gemini',cwd:root,sessionId:sid,text:'Continue',model:'gemini-2.5-pro',geminiAccess:'yolo'});
    assert.equal(response.status,200,await response.clone().text());
    assert.equal(started.access,'yolo');assert.equal(started.sessionId,sid);assert.equal(started.model,'gemini-2.5-pro');assert.equal(started.baseMessageCount,1);
    assert.equal((await(await request('/jobs?provider=gemini')).json()).length,1);
    assert.equal((await request(`/jobs/${id}/stop`,{})).status,200);assert.equal(runs.get(id).status,'stopped');
    assert.equal((await request('/jobs',{id:randomUUID(),provider:'claude',cwd:root,text:'x',geminiAccess:'yolo'})).status,400);
    // Jira, task chains and scheduled tasks keep their three agent providers.
    assert.equal((await request('/jira/queue?provider=gemini')).status,400);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
