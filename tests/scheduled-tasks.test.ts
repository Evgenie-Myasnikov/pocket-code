import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ScheduledTasks,nextRunTime,type ScheduledTask,type ScheduledTaskInput} from '../server/scheduled-tasks';

const HOUR=3600000;
/** A local date of the given weekday (0 = Sunday) at hh:mm, so the checks hold in any time zone. */
function localDay(weekday:number,hours:number,minutes=0){
  const at=new Date(2026,10,2,hours,minutes,0,0);
  while(at.getDay()!==weekday)at.setDate(at.getDate()+1);
  return at;
}
const input:ScheduledTaskInput={name:'Weekday morning brief',prompt:'Summarise the synthetic changes since yesterday.',provider:'claude',model:'',cwd:'C:\\Demo\\Atlas',schedule:{kind:'daily',time:'09:00'}};
async function store(t:test.TestContext,clock:{now:number},starts:{task:ScheduledTask;run:string}[]=[]){
  const dir=await mkdtemp(path.join(tmpdir(),'pocket-schedules-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=path.join(dir,'scheduled-tasks.json');
  const make=()=>new ScheduledTasks({file,now:()=>clock.now,start:async(task,run)=>{starts.push({task,run});return {sessionId:'session-'+starts.length};}});
  return {make,starts};
}

test('next run time: a daily time later today, or tomorrow once it has passed',()=>{
  const morning=localDay(2,8,30);
  assert.equal(nextRunTime({kind:'daily',time:'09:00'},morning.getTime()),localDay(2,9).getTime());
  const late=localDay(2,9,0).getTime();
  assert.equal(nextRunTime({kind:'daily',time:'09:00'},late),localDay(3,9).getTime(),'exactly at the time counts as passed');
  const saturday=localDay(6,23,50),sunday=new Date(saturday);sunday.setDate(sunday.getDate()+1);sunday.setHours(23,45,0,0);
  assert.equal(nextRunTime({kind:'daily',time:'23:45'},saturday.getTime()),sunday.getTime());
});

test('next run time: weekdays skip Saturday and Sunday',()=>{
  const friday=localDay(5,10).getTime(),monday=new Date(localDay(5,9));monday.setDate(monday.getDate()+3);
  assert.equal(new Date(nextRunTime({kind:'weekdays',time:'09:00'},friday)).getDay(),1);
  assert.equal(nextRunTime({kind:'weekdays',time:'09:00'},friday),monday.getTime());
  const saturday=localDay(6,7).getTime(),next=new Date(nextRunTime({kind:'weekdays',time:'09:00'},saturday));
  assert.equal(next.getDay(),1);assert.equal(next.getHours(),9);
  assert.equal(nextRunTime({kind:'weekdays',time:'09:00'},localDay(3,8).getTime()),localDay(3,9).getTime(),'a weekday before the time runs that day');
});

test('next run time: every N hours counts from the anchor',()=>{
  const anchor=localDay(1,9,15).getTime();
  assert.equal(nextRunTime({kind:'interval',hours:3},anchor,anchor),anchor+3*HOUR);
  assert.equal(nextRunTime({kind:'interval',hours:3},anchor+3*HOUR,anchor),anchor+6*HOUR,'a run at its time moves to the following slot');
  assert.equal(nextRunTime({kind:'interval',hours:3},anchor+7*HOUR,anchor),anchor+9*HOUR);
});

test('a due task starts once per time and moves to its next time',async t=>{
  const clock={now:localDay(1,8).getTime()},{make,starts}=await store(t,clock),tasks=make();
  const task=await tasks.create(input);
  assert.equal(task.nextRunAt,localDay(1,9).getTime());
  await tasks.check();assert.equal(starts.length,0,'not due yet');
  clock.now=localDay(1,9,0).getTime()+1000;
  await tasks.check();await tasks.check();
  assert.equal(starts.length,1);assert.equal(starts[0].task.prompt,input.prompt);
  const [listed]=await tasks.list();
  assert.equal(listed.nextRunAt,localDay(2,9).getTime());assert.equal(listed.unread,true);
  assert.equal(listed.runs[0].sessionId,'session-1');assert.equal(listed.runs[0].id,starts[0].run);
  assert.equal((await tasks.read(task.id)).unread,false);
});

test('a run missed while the PC was off starts once at the next start, not once per missed time',async t=>{
  const clock={now:localDay(1,8).getTime()},{make,starts}=await store(t,clock);
  const before=make();await before.create({...input,schedule:{kind:'interval',hours:1}});await before.close();
  // The PC was off for most of a day: about twenty hourly times were missed.
  clock.now+=20*HOUR+30*60000;
  const after=make();await after.check();
  assert.equal(starts.length,1);
  const [task]=await after.list();
  assert.ok(task.nextRunAt>clock.now&&task.nextRunAt<=clock.now+HOUR,'the next time is the coming slot');
  await after.check();assert.equal(starts.length,1);
});

test('delete stops future runs; pause skips them and resume does not catch up',async t=>{
  const clock={now:localDay(1,8).getTime()},{make,starts}=await store(t,clock),tasks=make();
  const kept=await tasks.create({...input,name:'Kept'}),removed=await tasks.create({...input,name:'Removed'});
  await tasks.remove(removed.id);
  await tasks.update(kept.id,{paused:true});
  clock.now=localDay(3,10).getTime();await tasks.check();
  assert.equal(starts.length,0,'a paused task and a deleted one do not start');
  const resumed=await tasks.update(kept.id,{paused:false});
  assert.equal(resumed.nextRunAt,localDay(4,9).getTime());
  await tasks.check();assert.equal(starts.length,0);
  clock.now=localDay(4,9,1).getTime();await tasks.check();
  assert.deepEqual(starts.map(item=>item.task.name),['Kept']);
  // The deletion survives a restart.
  const reopened=make();assert.deepEqual((await reopened.list()).map(task=>task.name),['Kept']);
  await reopened.remove(kept.id);clock.now+=7*24*HOUR;await reopened.check();
  assert.equal(starts.length,1);assert.deepEqual(await make().list(),[]);
});

test('run now starts at once and keeps the schedule; a failed start is recorded on the run',async t=>{
  const clock={now:localDay(1,8).getTime()},{make,starts}=await store(t,clock),tasks=make();
  const task=await tasks.create(input);
  const ran=await tasks.runNow(task.id);
  assert.equal(starts.length,1);assert.equal(ran.nextRunAt,task.nextRunAt);assert.equal(ran.runs[0].manual,true);assert.equal(ran.unread,true);
  const dir=await mkdtemp(path.join(tmpdir(),'pocket-schedules-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const failing=new ScheduledTasks({file:path.join(dir,'tasks.json'),now:()=>clock.now,start:async()=>{throw new Error('The provider is signed out.');}});
  const other=await failing.create(input);
  const result=await failing.runNow(other.id);
  assert.equal(result.runs[0].error,'The provider is signed out.');
  await assert.rejects(tasks.runNow('00000000-0000-4000-8000-000000000000'),/deleted/);
});

test('only the latest run keeps a chat: an older run is removed when the next run has its chat, and a deleted task removes them all',async t=>{
  const clock={now:localDay(1,8).getTime()},dir=await mkdtemp(path.join(tmpdir(),'pocket-schedules-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const retired:string[]=[];let count=0,failRetire=false;
  const tasks=new ScheduledTasks({file:path.join(dir,'tasks.json'),now:()=>clock.now,start:async()=>({sessionId:'session-'+(++count)}),
    retire:async(_task,id)=>{if(failRetire)throw new Error('busy');retired.push(id);}});
  const task=await tasks.create(input);
  await tasks.runNow(task.id);
  assert.deepEqual([...tasks.sessionIds()],['session-1']);assert.deepEqual(retired,[]);
  // the second run: the first run's chat is removed and forgotten, only the latest stays
  await tasks.runNow(task.id);
  assert.deepEqual(retired,['session-1']);assert.deepEqual([...tasks.sessionIds()],['session-2']);
  // a chat that cannot be removed now stays hidden and is tried again with the next run
  failRetire=true;await tasks.runNow(task.id);
  assert.deepEqual([...tasks.sessionIds()].sort(),['session-2','session-3']);
  failRetire=false;await tasks.runNow(task.id);
  assert.deepEqual([...retired].sort(),['session-1','session-2','session-3']);assert.deepEqual([...tasks.sessionIds()],['session-4']);
  // deleting the task removes the chat of its latest run too
  await tasks.remove(task.id);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual([...retired].sort(),['session-1','session-2','session-3','session-4']);assert.deepEqual([...tasks.sessionIds()],[]);
});

test('editing the schedule moves the next time; editing the prompt does not',async t=>{
  const clock={now:localDay(1,8).getTime()},{make}=await store(t,clock),tasks=make();
  const task=await tasks.create(input);
  clock.now+=10*60000;
  const prompt=await tasks.update(task.id,{prompt:'A different synthetic prompt.'});
  assert.equal(prompt.nextRunAt,task.nextRunAt);
  const weekly=await tasks.update(task.id,{schedule:{kind:'interval',hours:2}});
  assert.equal(weekly.nextRunAt,clock.now+2*HOUR);
});

test('scheduled task API: create, list, run now as a new chat, edit, delete; requests outside the projects are refused',async()=>{
  const {mkdir}=await import('node:fs/promises');
  const {createApp}=await import('../server/app');
  const {Jobs}=await import('../server/jobs');
  const os=await import('node:os');
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-schedule-api-')),project=path.join(root,'project');await mkdir(project);await mkdir(path.join(root,'elsewhere'));
  const prompts:string[]=[];
  const jobs=new Jobs((({prompt,options}:any)=>(async function*(){
    for await(const input of prompt){prompts.push(input.message.content);yield{type:'system',subtype:'init',session_id:'66666666-6666-4666-8666-666666666666'};yield{type:'result',is_error:false,total_cost_usd:0};break;}
    void options;
  })()) as any);
  const token='fixture-token-'.repeat(4);
  const {app,closeTaskServices}=await createApp({roots:[project],token,hostName:'Fixture',uploads:path.join(root,'uploads'),desktopSessionIndexes:[]},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`;
  const call=(endpoint:string,body?:unknown)=>fetch(url+endpoint,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  try{
    const body={name:'Synthetic brief',prompt:'List the synthetic files.',provider:'claude',model:'haiku',cwd:project,schedule:{kind:'daily',time:'07:15'}};
    assert.equal((await call('/scheduled-tasks',{...body,cwd:path.join(root,'elsewhere')})).status,403);
    assert.equal((await call('/scheduled-tasks',{...body,schedule:{kind:'daily',time:'25:00'}})).status,400);
    assert.equal((await call('/scheduled-tasks',{...body,schedule:{kind:'interval',hours:0}})).status,400);
    const created=await(await call('/scheduled-tasks',body)).json();
    assert.equal(created.name,'Synthetic brief');assert.equal(new Date(created.nextRunAt).getMinutes(),15);
    assert.deepEqual((await(await call('/scheduled-tasks')).json()).map((task:any)=>task.id),[created.id]);
    const ran=await(await call(`/scheduled-tasks/${created.id}/run`,{})).json();
    assert.equal(ran.runs.length,1);assert.equal(ran.unread,true);assert.equal(ran.nextRunAt,created.nextRunAt);
    const job=jobs.get(ran.runs[0].id);assert.equal(job.cwd,await (await import('node:fs/promises')).realpath(project));
    await new Promise(resolve=>setTimeout(resolve,50));
    assert.deepEqual(prompts,['List the synthetic files.']);
    // the run's job is the task's chat, not a chat of the list
    const listed=(await(await call('/jobs?provider=claude')).json()).find((item:any)=>item.id===ran.runs[0].id);assert.equal(listed?.taskChat,true);
    const edited=await(await call(`/scheduled-tasks/${created.id}`,{paused:true,schedule:{kind:'interval',hours:6}})).json();
    assert.equal(edited.paused,true);assert.deepEqual(edited.schedule,{kind:'interval',hours:6});assert.equal(edited.model,'haiku','a partial change keeps the other fields');
    assert.equal((await(await call(`/scheduled-tasks/${created.id}/read`,{})).json()).unread,false);
    assert.equal((await call(`/scheduled-tasks/${created.id}/delete`,{})).status,200);
    assert.deepEqual(await(await call('/scheduled-tasks')).json(),[]);
    assert.equal((await call(`/scheduled-tasks/${created.id}/run`,{})).status,404);
  }finally{await closeTaskServices();jobs.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
