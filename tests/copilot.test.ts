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
