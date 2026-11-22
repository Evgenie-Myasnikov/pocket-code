import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import type {CopilotClient} from '@github/copilot-sdk';
import {createApp} from '../server/app';
import {CopilotService} from '../server/copilot';
import {taskTextInput,taskTextPrompt} from '../server/task-text';

test('field templates preserve supplied source text as data and constrain individual fields',()=>{
  for(const [field,format] of Object.entries({instructions:'actionable task instructions',context:'reusable shared context',title:'single line',checklist:'acceptance criterion',description:'observable acceptance criteria'})){
    const input=taskTextInput.parse({cwd:'folder',provider:'claude',field,text:'',context:'Draft a small test.',language:'ru',maxLength:160});
    const {prompt,system}=taskTextPrompt(input);
    assert.deepEqual(JSON.parse(prompt),{currentField:'',brief:input.context});
    assert.ok(system.includes(format));assert.match(system,/template v1/);assert.match(system,/Russian/);assert.match(system,/160 characters/);
  }
});

test('Improve authenticates, checks project and provider, isolates generation and rejects invalid output',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'pocket-text-api-')),project=path.join(root,'project');
  await mkdir(project);
  const token='synthetic-improve-key'.repeat(3);
  let reply='Review sample',wait:Promise<void>|undefined,entered:(()=>void)|undefined,isolated='';
  const copilot=new CopilotService([project]);
  copilot.generateTaskText=async(_system,prompt,directory,abort)=>{
    assert.notEqual(directory,project);isolated=directory;assert.equal(JSON.parse(prompt).brief,'Example goal.');
    entered?.();if(wait)await Promise.race([wait,new Promise(resolve=>abort.signal.addEventListener('abort',resolve,{once:true}))]);
    return reply;
  };
  const {app,closeTaskServices,terminals,isBusy}=await createApp({roots:[project],token,hostName:'Test',uploads:path.join(root,'uploads'),copilot,desktopSessionIndexes:[]});
  app.locals.providerConnections.status=async()=>({providers:[
    {id:'claude',installed:true,authenticated:false,server:'on-demand'},
    {id:'copilot',installed:true,authenticated:true,server:'ready'},
    {id:'codex',installed:true,authenticated:true,server:'ready'}]});
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{await closeTaskServices();terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/task-text/';
  const headers={Authorization:'Bearer '+token,'content-type':'application/json'};
  const input={cwd:project,provider:'copilot',field:'title',text:'',context:'Example goal.',maxLength:40};
  const request=(extra:Record<string,unknown>={},signal?:AbortSignal)=>fetch(base+'improve',{method:'POST',headers,body:JSON.stringify({...input,...extra}),signal});
  assert.equal((await fetch(base+'providers')).status,401);
  assert.deepEqual(await (await fetch(base+'providers',{headers})).json(),{providers:['copilot']});
  const api='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/';
  const post=(route:string,data:object)=>fetch(api+route,{method:'POST',headers,body:JSON.stringify(data)});
  const workspace=await (await post('workspaces',{name:'Example',password:'fixture password',roots:[project]})).json();
  const guest=await (await post('workspace-login',{name:'Example',password:'fixture password',displayName:'Test viewer'})).json();
  assert.ok(guest.token);await post('workspaces/'+workspace.id+'/member',{memberId:guest.memberId,role:'viewer',approval:'approved'});
  const guestHeaders={...headers,Authorization:'Bearer '+guest.token};
  assert.equal((await fetch(base+'providers',{headers:guestHeaders})).status,403);
  assert.equal((await fetch(base+'improve',{method:'POST',headers:guestHeaders,body:JSON.stringify(input)})).status,403);
  assert.equal((await request({cwd:root})).status,403);
  assert.equal((await request({context:' '})).status,400);
  assert.equal((await request({provider:'codex'})).status,400);
  assert.equal((await request({provider:'claude'})).status,503);
  assert.deepEqual(await (await request()).json(),{text:'Review sample'});
  await assert.rejects(stat(isolated),{code:'ENOENT'});
  reply='Title\nSecond line';assert.equal((await request()).status,422);
  reply='Too long';assert.equal((await request({maxLength:4})).status,422);
  let release!:()=>void;
  wait=new Promise<void>(resolve=>{release=resolve;});
  const ready=new Promise<void>(resolve=>{entered=resolve;});
  const first=request();
  try{await ready;assert.equal(isBusy(),true);assert.equal((await request()).status,429);}
  finally{release();}
  assert.equal((await first).status,200);
  wait=new Promise(()=>{});
  const controller=new AbortController(),cancelReady=new Promise<void>(resolve=>{entered=resolve;});
  const disconnected=request({},controller.signal);
  await cancelReady;controller.abort();await assert.rejects(disconnected);
  const until=Date.now()+2000;
  while(isBusy()&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(isBusy(),false);
});

test('Copilot text runs allow no tools, skip project discovery and dispose the private session',async()=>{
  let options:any,deleted='',disconnected=false;
  const service=new CopilotService([],{
    start:async()=>{},
    createSession:async(value:unknown)=>{options=value;return {
      sendAndWait:async({prompt}:{prompt:string})=>({data:{content:prompt}}),
      disconnect:async()=>{disconnected=true;}
    };},
    deleteSession:async(id:string)=>{deleted=id;}
  } as unknown as CopilotClient);
  assert.equal(await service.generateTaskText('Editorial template','Example brief','isolated',new AbortController()),'Example brief');
  assert.deepEqual(options.availableTools,[]);assert.deepEqual(options.mcpServers,{});
  assert.equal(options.enableConfigDiscovery,false);assert.equal(options.enableFileHooks,false);
  assert.equal(options.enableSessionStore,false);assert.equal(options.skipCustomInstructions,true);
  assert.equal(options.workingDirectory,'isolated');assert.equal(options.configDirectory,'isolated');
  assert.match(options.onPermissionRequest().kind,/denied/);assert.equal(disconnected,true);assert.equal(deleted,options.sessionId);
});
