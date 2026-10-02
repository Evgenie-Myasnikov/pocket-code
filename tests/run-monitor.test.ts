import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendFile,mkdtemp,rm,utimes,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {RunMonitor,sessionState} from '../server/run-monitor';

const line=(value:unknown)=>JSON.stringify(value)+'\n';
test('turn boundaries decide running, finished and stopped sessions for every provider',()=>{
  const codex=(...types:string[])=>types.map(type=>line({type:'event_msg',payload:{type}}).trim());
  assert.equal(sessionState('codex',codex('task_started','token_count')),'running');
  assert.equal(sessionState('codex',codex('task_started','task_complete')),'done');
  assert.equal(sessionState('codex',codex('task_started','turn_aborted')),'stopped');
  const claude=(...entries:unknown[])=>entries.map(entry=>line(entry).trim());
  assert.equal(sessionState('claude',claude({type:'user',message:{content:'Synthetic prompt'}},{type:'assistant',message:{stop_reason:'tool_use'}})),'running');
  assert.equal(sessionState('claude',claude({type:'assistant',message:{stop_reason:'end_turn'}},{type:'custom-title',customTitle:'Synthetic'})),'done');
  assert.equal(sessionState('claude',claude({type:'assistant',message:{stop_reason:'end_turn'}},{type:'assistant',isSidechain:true,message:{stop_reason:'tool_use'}})),'done');
  assert.equal(sessionState('claude',claude({type:'user',message:{content:[{type:'text',text:'[Request interrupted by user]'}]}})),'stopped');
  assert.equal(sessionState('copilot',claude({type:'user.message'},{type:'assistant.turn_start'})),'running');
  assert.equal(sessionState('copilot',claude({type:'assistant.turn_start'},{type:'assistant.turn_end'})),'done');
  assert.equal(sessionState('claude',['not json']),'unknown');
});

test('only transitions after the first scan notify, with session identity and folder name',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-runs-'));
  try{
    const codex=path.join(root,'rollout-synthetic.jsonl'),claude=path.join(root,'11111111-2222-4333-8444-555555555555.jsonl'),copilot=path.join(root,'events.jsonl');
    await writeFile(codex,line({type:'session_meta',payload:{session_id:'codex-synthetic-id',cwd:'C:\\Demo\\Atlas'}})+line({type:'event_msg',payload:{type:'task_complete'}}));
    await writeFile(claude,line({type:'user',cwd:'C:\\Demo\\Garden',message:{content:'Synthetic'}})+line({type:'custom-title',customTitle:'Synthetic Garden chat'}));
    await writeFile(copilot,line({type:'session.start',data:{sessionId:'copilot-synthetic-id',context:{cwd:'C:\\Demo\\Copilot'}}})+line({type:'assistant.turn_start'}));
    const monitor=new RunMonitor([{provider:'codex',files:async()=>[codex]},{provider:'claude',files:async()=>[claude]},{provider:'copilot',files:async()=>[copilot]}]);
    await monitor.scan();assert.deepEqual(monitor.events(0),[],'existing history stays quiet');
    await appendFile(codex,line({type:'event_msg',payload:{type:'task_started'}}));await monitor.scan();
    await appendFile(codex,line({type:'event_msg',payload:{type:'task_complete'}}));await appendFile(claude,line({type:'assistant',message:{stop_reason:'end_turn'}}));
    await appendFile(copilot,line({type:'assistant.turn_end'}));await monitor.scan();
    assert.deepEqual(monitor.events(0).map(event=>[event.provider,event.sessionId,event.title,event.status]),[['codex','codex-synthetic-id','Atlas','done'],['claude','11111111-2222-4333-8444-555555555555','Synthetic Garden chat','done']]);
    // Copilot reports done only after its file has been quiet; an agent step boundary is not the end.
    const old=new Date(Date.now()-60000);await utimes(copilot,old,old);await monitor.scan();
    const last=monitor.events(0).at(-1)!;assert.deepEqual([last.provider,last.sessionId,last.title],['copilot','copilot-synthetic-id','Copilot']);
    const cursor=last.at;assert.deepEqual(monitor.events(cursor),[]);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('the activity feed requires a key and returns only events after the cursor',async()=>{
  const {createApp}=await import('../server/app');const {Jobs}=await import('../server/jobs');
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-runs-api-')),token='synthetic-feed-key-'.repeat(3);
  const events=[{id:'1',provider:'codex',sessionId:'synthetic-a',cwd:'C:\Demo',title:'Demo',status:'done',at:1000},{id:'2',provider:'claude',sessionId:'synthetic-b',cwd:'C:\Demo',title:'Demo',status:'stopped',at:2000}];
  const runs={events:(since:number)=>events.filter(event=>event.at>since)} as any;
  const result=await createApp({runs,roots:[root],token,hostName:'Synthetic host',uploads:path.join(root,'uploads'),desktopSessionIndexes:[]},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
  const server=result.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${(server.address() as any).port}/api/activity/events`;
  try{
    assert.equal((await fetch(base+'?since=0')).status,401);
    const all=await(await fetch(base+'?since=0',{headers:{Authorization:'Bearer '+token}})).json();assert.deepEqual(all.events.map((e:any)=>e.id),['1','2']);assert.equal(typeof all.now,'number');
    assert.deepEqual((await(await fetch(base+'?since=1500',{headers:{Authorization:'Bearer '+token}})).json()).events.map((e:any)=>e.id),['2']);
  }finally{result.jobs.close();result.terminals.close();await result.queue?.close();await result.codexQueue?.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
