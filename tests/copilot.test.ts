import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CopilotService,copilotMessage} from '../server/copilot';
import {randomUUID} from 'node:crypto';
import {boardInstructions} from '../server/board-instructions';
import {waitFor} from './wait-for';
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
function fixture(){let config:any,handler:(event:any)=>void=()=>{},finish:()=>void=()=>{};let disconnected=0;
 const session={sessionId:randomUUID(),on(fn:any){handler=fn;return()=>{handler=()=>{};};},sendAndWait:()=>new Promise<void>(resolve=>{finish=resolve;}),send:async()=>'',abort:async()=>finish(),disconnect:async()=>{disconnected++;},getEvents:async()=>[{id:'answer',type:'assistant.message',data:{content:'Saved answer'}}]};
 const client={start:async()=>{},stop:async()=>[],getAuthStatus:async()=>({isAuthenticated:true}),listModels:async()=>[{id:'auto',name:'Auto'}],listSessions:async()=>[],createSession:async(c:any)=>{config=c;return session;},resumeSession:async(_id:string,c:any)=>{config=c;return session;}};
 const service=new CopilotService([process.cwd()],client as any);return{service,session,config:()=>config,emit:(e:any)=>handler(e),finish:()=>finish(),disconnected:()=>disconnected};}
const input=()=>({id:randomUUID(),cwd:process.cwd(),text:'Fixture',mode:'default' as const,maxBudgetUsd:5});

test('Copilot exposes only allowlisted streaming file arguments and clears previews on execution and failure',async()=>{
 const f=fixture(),i=input();
 try{
  f.service.start(i);await waitFor(()=>!!f.config());
  const fragment=(toolCallId:string,toolName:string|undefined,inputDelta:string,agentId?:string)=>f.emit({type:'assistant.tool_call_delta',agentId,data:{toolCallId,toolName,inputDelta}});
  fragment('nested','create','{"path":"hidden","file_text":"hidden"}','child');
  fragment('shell','bash','{"path":"hidden","file_text":"hidden"}');
  fragment('new','create','{"file_text":"first\\n');
  assert.deepEqual(f.service.get(i.id).writePreviews,[{id:'new',tool:'Write',path:'',content:'first\n',totalBytes:6,totalLines:1}]);
  fragment('new',undefined,'line","path":"sam');
  assert.equal(f.service.get(i.id).writePreviews![0].path,'');
  fragment('new',undefined,'ple.ts"}');
  const job=f.service.get(i.id);
  assert.deepEqual(job.writePreviews,[{id:'new',path:'sample.ts',tool:'Write',content:'first\nline',totalBytes:10,totalLines:2}]);
  assert.equal(job.messages.length,1);assert.equal(f.service.list()[0].writePreviews,undefined);
  f.emit({type:'tool.execution_start',id:'execution',data:{toolCallId:'new',toolName:'create',arguments:{path:'sample.ts',file_text:'first\nline'}}});
  assert.equal(job.writePreviews,undefined);assert.equal(job.messages.length,2);
  fragment('edit','edit','{"path":"sample.ts","old_str":"hidden","new_str":"replacement');
  assert.equal(f.service.get(i.id).writePreviews?.[0].content,'replacement');
  f.emit({type:'session.error',data:{message:'Synthetic provider failure'}});
  assert.equal(job.status,'error');assert.equal(job.writePreviews,undefined);
 }finally{f.finish();await f.service.close();}
});

test('Copilot permits independent histories in one project and rejects duplicate writers',async()=>{
 const f=fixture();
 try{
  f.service.start({...input(),sessionId:'first'});f.service.start({...input(),sessionId:'second'});
  assert.equal(f.service.list().filter(run=>run.status==='running').length,2);
  assert.throws(()=>f.service.start({...input(),sessionId:'first'}),/already running/);
 }finally{await f.service.close();}
});

test('Copilot updates interleaved timeline reasoning, command output, file input and reply independently',async()=>{
 const f=fixture(),i=input();
 try{
  f.service.start(i);await waitFor(()=>!!f.config());
  const job=f.service.get(i.id);
  const reasoning=(reasoningId:string,deltaContent:string,agentId?:string)=>f.emit({type:'assistant.reasoning_delta',agentId,data:{reasoningId,deltaContent}});
  const shell=(toolCallId:string)=>f.emit({id:toolCallId,type:'tool.execution_start',data:{toolCallId,toolName:'powershell',arguments:{command:'echo test'}}});
  const output=(toolCallId:string,partialOutput:string,agentId?:string)=>f.emit({type:'tool.execution_partial_result',agentId,data:{toolCallId,partialOutput}});
  const commandInput=(id:string)=>job.messages.find(message=>message.id===id)?.blocks[0].input as {output?:string};
  reasoning('a','Checking ');reasoning('b','Formatting');reasoning('a','files');reasoning('a','child','nested');
  shell('one');shell('two');
  output('one','first ');output('two','x'.repeat(20_000));output('one','line');output('one','child','nested');
  f.emit({type:'assistant.tool_call_delta',data:{toolName:'create',toolCallId:'file',inputDelta:'{"path":"example.ts","file_text":"start'}});
  f.emit({type:'assistant.message_delta',data:{deltaContent:'Reply'}});
  assert.deepEqual(job.reasoningPreviews?.map(row=>row.blocks[0].thinking),['Checking files','Formatting']);
  assert.equal(f.service.list()[0].reasoningPreviews,undefined);
  assert.equal(commandInput('one').output,'first line');assert.equal(commandInput('two').output?.length,16_384);
  assert.equal(job.writePreviews?.[0].content,'start');assert.equal(job.partial,'Reply');
  const final={id:'final-b',type:'assistant.reasoning',data:{reasoningId:'b',content:'Formatted'}};
  f.emit(final);reasoning('b','late');output('one',' still running');
  assert.deepEqual(job.reasoningPreviews?.map(row=>row.blocks[0].thinking),['Checking files']);
  assert.deepEqual(job.messages.at(-1),copilotMessage(final as any));
  f.emit({id:'done',type:'tool.execution_complete',data:{toolCallId:'one',success:true,result:{content:'Complete'}}});
  output('one','late');
  assert.equal(commandInput('one').output,undefined);assert.equal(commandInput('two').output?.length,16_384);
  assert.equal(job.messages.at(-1)?.blocks[0].content,'Complete');
  f.emit({type:'session.error',data:{message:'Synthetic provider failure'}});
  assert.equal(job.reasoningPreviews,undefined);assert.equal(commandInput('two').output,undefined);
 }finally{f.finish();await f.service.close();}
});

test('Copilot forwards actual usage through live jobs and final persistence without treating streamed text as tokens',async()=>{
 const f=fixture(),i=input();
 let persisted:unknown;
 f.service.recordGeneration=view=>{persisted=view.generation;};
 try{
  f.service.start(i);await waitFor(()=>!!f.config());
  f.emit({type:'assistant.message_delta',data:{deltaContent:'synthetic'}});
  assert.equal(f.service.get(i.id).generation,undefined);
  f.emit({type:'assistant.usage',id:'actual',data:{inputTokens:50,outputTokens:31,interTokenLatencyMs:25}});
  f.emit({type:'session.usage_info',data:{currentTokens:250,tokenLimit:1000}});
  const expected={outputTokens:31,outputTokensPerSecond:40,totalTokens:81,contextTokens:250,contextWindow:1000};
  assert.deepEqual(f.service.get(i.id).generation,expected);
  f.finish();await waitFor(()=>f.service.get(i.id).status==='done');
  assert.deepEqual(persisted,expected);
 }finally{f.finish();await f.service.close();}
});

test('Copilot attaches managed board MCP to new and resumed sessions',async()=>{
 for(const resume of [false,true]){const f=fixture(),i={...input(),...(resume?{sessionId:f.session.sessionId}:{})},server={command:'node',args:['board-proxy.mjs'],env:{POCKET_PORT:'4318'}};
  f.service.setBoardMcpConfiguration(cwd=>{assert.equal(cwd,i.cwd);return {'pocket-code-boards':server};});
  try{f.service.start(i);await waitFor(()=>!!f.config());assert.deepEqual(f.config().mcpServers,{'pocket-code-boards':server});f.service.stop(i.id);await tick();}finally{await f.service.close();}
 }
 const f=fixture(),i=input();try{f.service.start(i);await waitFor(()=>!!f.config());assert.equal(f.config().mcpServers,undefined);f.service.stop(i.id);await tick();}finally{await f.service.close();}
});

test('Copilot fresh and resumed sessions use the shared rules, skills, board and changelog contract',async()=>{
 for(const resume of [false,true]){const f=fixture(),i={...input(),...(resume?{sessionId:f.session.sessionId}:{})};try{f.service.start(i);await waitFor(()=>!!f.config());assert.equal(f.config().systemMessage.content,boardInstructions);f.service.stop(i.id);await tick();}finally{await f.service.close();}}
});
test('model access errors do not erase confirmed Copilot authentication',async()=>{
 const service=new CopilotService([],{start:async()=>{},stop:async()=>[],getAuthStatus:async()=>({isAuthenticated:true}),listModels:async()=>{throw Error('Unavailable');}} as any);
 const status=await service.status();assert.equal(status.available,true);assert.equal(status.authenticated,true);assert.equal(status.access,'models-unavailable');await service.close();
});
test('Copilot sign-out calls the account operation without touching other GitHub credentials',async()=>{
 let called=0;const service=new CopilotService([],{start:async()=>{},stop:async()=>[],rpc:{account:{logout:async(args:unknown)=>{assert.deepEqual(args,{});called++;}}}} as any);
 await service.logout();assert.equal(called,1);await service.close();
});
test('Copilot detects existing sign-in and does not start login again',async()=>{const f=fixture();assert.equal((await f.service.status()).authenticated,true);assert.equal((await f.service.login()).state,'connected');await f.service.close();});
test('Copilot streams text, preserves history and completes without affecting other providers',async()=>{const f=fixture(),i=input();f.service.start(i);await waitFor(()=>!!f.config());f.emit({id:'delta',type:'assistant.message_delta',data:{deltaContent:'Hello'}});assert.equal(f.service.get(i.id).partial,'Hello');f.emit({id:'answer',type:'assistant.message',data:{content:'Hello'}});f.finish();await tick();assert.equal(f.service.get(i.id).status,'done');assert.equal(f.service.get(i.id).messages[1].blocks[0].text,'Hello');assert.equal(f.disconnected(),1);assert.equal((await f.service.messages(f.session.sessionId))[0].blocks[0].text,'Saved answer');await f.service.close();});
test('Copilot questions reach chat approvals and answers resolve the SDK handler',async()=>{const f=fixture(),i=input();f.service.start(i);await waitFor(()=>!!f.config());assert.match(f.config().systemMessage.content,/Pocket Code project boards/);assert.equal(f.config().systemMessage.mode,'append');const answer=f.config().onUserInputRequest({question:'Which path?',choices:['A','B'],allowFreeform:false});const approval=f.service.get(i.id).approvals[0];assert.equal(approval.tool,'AskUserQuestion');f.service.approve(i.id,approval.id,true,{'Which path?':'B'});assert.equal((approval.input.questions as any[])[0].allowFreeform,false);assert.deepEqual(await answer,{answer:'B',wasFreeform:false});f.service.stop(i.id);await tick();assert.equal(f.service.get(i.id).status,'stopped');await f.service.close();});
test('Copilot tool permissions are explicit and stopping resolves pending decisions',async()=>{const f=fixture(),i=input();f.service.start(i);await waitFor(()=>!!f.config());const permission=f.config().onPermissionRequest({kind:'write',path:'example.txt'});assert.equal(f.service.get(i.id).approvals.length,1);f.service.stop(i.id);assert.equal((await permission).kind,'denied-interactively-by-user');await tick();assert.equal(f.service.get(i.id).status,'stopped');await f.service.close();});
test('Copilot follow-ups are idempotent and late errors cannot revive stopped jobs',async()=>{const f=fixture(),i=input();f.service.start(i);await waitFor(()=>!!f.config());const next={id:randomUUID(),text:'Clarification'};await f.service.followup(i.id,next);await f.service.followup(i.id,next);assert.equal(f.service.get(i.id).messages.length,2);f.service.stop(i.id);f.emit({type:'session.error',data:{message:'Late error'}});assert.equal(f.service.get(i.id).status,'stopped');await f.service.close();});
test('Copilot tool events preserve command names and results',()=>{assert.equal(copilotMessage({id:'x',type:'tool.execution_start',data:{toolCallId:'t',toolName:'shell',arguments:{command:'test'}}} as any)?.blocks[0].name,'shell');assert.equal(copilotMessage({id:'y',type:'tool.execution_complete',data:{toolCallId:'t',success:false,error:{message:'Failed'}}} as any)?.blocks[0].is_error,true);});
