import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {readGuarded,writeDurable} from './durable-file.js';
import {HttpError} from './security.js';

export type ScheduledProvider='claude'|'codex'|'copilot';
/** Daily and weekdays fire at a local time of the PC ("HH:MM"); interval fires every N hours from when the schedule was set. */
export type Schedule={kind:'daily';time:string}|{kind:'weekdays';time:string}|{kind:'interval';hours:number};
export type ScheduledRun={id:string;at:number;sessionId?:string;error?:string;manual?:boolean};
export type ScheduledTask={
  id:string;name:string;prompt:string;provider:ScheduledProvider;account?:string;model:string;cwd:string;schedule:Schedule;
  paused:boolean;createdAt:number;updatedAt:number;
  /** Interval schedules count their hours from here: creation, or the last change of the schedule or of pause. */
  anchor:number;
  nextRunAt:number;lastRunAt?:number;
  /** A run started that the person has not opened yet. */
  unread:boolean;
  /** Newest first, at most RUN_HISTORY. */
  runs:ScheduledRun[];
};
export type ScheduledTaskInput=Pick<ScheduledTask,'name'|'prompt'|'provider'|'model'|'cwd'|'schedule'>&{account?:string};
export type ScheduledTaskPatch=Partial<ScheduledTaskInput>&{paused?:boolean};
type Store={version:1;tasks:ScheduledTask[]};
type Options={
  file:string;
  /** Starts one run as a new chat; returns the job it started. A throw records the error on the run. */
  start(task:ScheduledTask,runId:string):Promise<{sessionId?:string}|void>;
  /** The chat of a run, once its provider has named it; undefined while the run is starting. */
  session?(runId:string):string|undefined;
  /** Called once per run when its chat is known, so it joins the chat list as a Pocket Code chat. */
  adopt?(task:ScheduledTask,sessionId:string):Promise<void>;
  /** False while the host cannot start runs (stopping, updating, a provider sign-in): due runs wait for the next check. */
  ready?():boolean;
  now?():number;
  /** Longest wait between two checks; a clock change or a sleeping PC is noticed within this time. */
  checkMs?:number;
};
export const RUN_HISTORY=20;
const HOUR=3600000;
const timePattern=/^([01]\d|2[0-3]):([0-5]\d)$/;

/** The first scheduled time strictly after `after`, in the PC's local time. */
export function nextRunTime(schedule:Schedule,after:number,anchor=after):number{
  if(schedule.kind==='interval'){
    const step=Math.max(1,Math.min(24,Math.floor(schedule.hours)))*HOUR;
    return anchor+Math.max(1,Math.floor((after-anchor)/step)+1)*step;
  }
  const match=timePattern.exec(schedule.time);if(!match)throw new HttpError(400,'Choose a time as HH:MM');
  const hours=Number(match[1]),minutes=Number(match[2]);
  const at=new Date(after);at.setHours(hours,minutes,0,0);
  // Days are added on the calendar, so a daylight-saving change keeps the local time.
  for(let day=0;day<14&&(at.getTime()<=after||schedule.kind==='weekdays'&&(at.getDay()===0||at.getDay()===6));day++){at.setDate(at.getDate()+1);at.setHours(hours,minutes,0,0);}
  return at.getTime();
}

const validStore=(value:unknown)=>!!value&&typeof value==='object'&&Array.isArray((value as Store).tasks);
/**
 * Scheduled chats of this PC: each task starts a new chat with its prompt at every scheduled time until it is deleted.
 * The tasks live in one host file, so they survive a restart. A run missed while the PC was off (or the host was
 * stopped) starts once at the next check, not once for every missed time.
 */
export class ScheduledTasks{
  private tasks:ScheduledTask[]=[];
  private loading?:Promise<void>;
  private lock:Promise<unknown>=Promise.resolve();
  private timer?:ReturnType<typeof setTimeout>;
  private closed=false;
  private started=false;
  private checking?:Promise<void>;
  constructor(private options:Options){}
  private now(){return this.options.now?.()??Date.now();}
  init(){return this.loading??=(async()=>{
    const {value}=await readGuarded<Store>(this.options.file,validStore);
    this.tasks=(value?.tasks||[]).filter(task=>task&&typeof task.id==='string'&&typeof task.prompt==='string');
  })();}
  /** Changes run one at a time; a change and its save finish before the next one reads the tasks. */
  private serial<T>(work:()=>Promise<T>):Promise<T>{const next=this.lock.then(()=>this.init()).then(work);this.lock=next.catch(()=>{});return next;}
  private async save(){
    await mkdir(path.dirname(this.options.file),{recursive:true});
    await writeDurable(this.options.file,JSON.stringify({version:1,tasks:this.tasks} satisfies Store),{backup:true});
  }
  private find(id:string){const task=this.tasks.find(item=>item.id===id);if(!task)throw new HttpError(404,'This scheduled task was deleted.');return task;}
  async list(){
    await this.init();await this.resolveSessions();
    return structuredClone(this.tasks).sort((a,b)=>a.createdAt-b.createdAt);
  }
  create(input:ScheduledTaskInput){return this.serial(async()=>{
    if(this.tasks.length>=100)throw new HttpError(409,'A PC keeps at most 100 scheduled tasks. Delete one first.');
    const now=this.now();
    const task:ScheduledTask={id:randomUUID(),...input,...(input.account?{account:input.account}:{}),paused:false,createdAt:now,updatedAt:now,anchor:now,nextRunAt:nextRunTime(input.schedule,now,now),unread:false,runs:[]};
    if(!input.account)delete task.account;
    this.tasks.push(task);await this.save();this.arm();return structuredClone(task);
  });}
  update(id:string,patch:ScheduledTaskPatch){return this.serial(async()=>{
    const task=this.find(id),now=this.now();
    const timing=patch.schedule&&JSON.stringify(patch.schedule)!==JSON.stringify(task.schedule)||patch.paused===false&&task.paused;
    for(const key of ['name','prompt','provider','model','cwd','schedule','paused'] as const)if(patch[key]!==undefined)(task as Record<string,unknown>)[key]=patch[key];
    if('account' in patch){if(patch.account)task.account=patch.account;else delete task.account;}
    // A new schedule, or a resumed task, counts from now: runs missed while paused do not start on resume.
    if(timing){task.anchor=now;task.nextRunAt=nextRunTime(task.schedule,now,now);}
    task.updatedAt=now;await this.save();this.arm();return structuredClone(task);
  });}
  remove(id:string){return this.serial(async()=>{const before=this.tasks.length;this.tasks=this.tasks.filter(task=>task.id!==id);if(this.tasks.length!==before)await this.save();this.arm();return {ok:true};});}
  read(id:string){return this.serial(async()=>{const task=this.find(id);if(task.unread){task.unread=false;await this.save();}return structuredClone(task);});}
  /** Starts a run now; the schedule keeps its next time. */
  async runNow(id:string){
    const run=await this.serial(async()=>this.begin(this.find(id),true));
    await this.launch(id,run);
    const task=this.tasks.find(item=>item.id===id);if(!task)throw new HttpError(404,'This scheduled task was deleted.');
    return structuredClone(task);
  }
  /** Records a run before it starts, so a host that stops during the start never starts it twice. */
  private async begin(task:ScheduledTask,manual:boolean){
    const now=this.now(),run:ScheduledRun={id:randomUUID(),at:now,...(manual?{manual:true}:{})};
    task.runs=[run,...task.runs].slice(0,RUN_HISTORY);task.lastRunAt=now;task.unread=true;
    if(!manual)task.nextRunAt=nextRunTime(task.schedule,now,task.anchor);
    await this.save();
    return run;
  }
  private async launch(id:string,run:ScheduledRun){
    const task=this.tasks.find(item=>item.id===id);if(!task)return;
    let result:{sessionId?:string}|void=undefined,error:string|undefined;
    try{result=await this.options.start(structuredClone(task),run.id);}
    catch(failure){error=failure instanceof Error&&failure.message?failure.message.slice(0,300):'The run could not start.';}
    await this.serial(async()=>{
      const current=this.tasks.find(item=>item.id===id)?.runs.find(item=>item.id===run.id);if(!current)return;
      if(error)current.error=error;
      if(result&&result.sessionId)current.sessionId=result.sessionId;
      await this.save();
    });
    if(result&&result.sessionId)await this.options.adopt?.(task,result.sessionId).catch(()=>{});
  }
  /** Runs whose chat was not named when they started learn it from the running job. */
  private async resolveSessions(){
    if(!this.options.session)return;
    const found:{task:ScheduledTask;run:ScheduledRun;sessionId:string}[]=[];
    for(const task of this.tasks)for(const run of task.runs){
      if(run.sessionId||run.error)continue;
      const sessionId=this.options.session(run.id);if(sessionId)found.push({task,run,sessionId});
    }
    if(!found.length)return;
    await this.serial(async()=>{for(const item of found)item.run.sessionId=item.sessionId;await this.save();});
    for(const item of found)await this.options.adopt?.(item.task,item.sessionId).catch(()=>{});
  }
  /** Starts every task whose time has come, once each, and moves its next time past now. */
  check(){
    if(this.checking)return this.checking;
    const run=this.runDue().finally(()=>{if(this.checking===run)this.checking=undefined;this.arm();});
    this.checking=run;return run;
  }
  private async runDue(){
    if(this.closed||this.options.ready&&!this.options.ready())return;
    const now=this.now();
    const due=await this.serial(async()=>{
      const started:{id:string;run:ScheduledRun}[]=[];
      for(const task of this.tasks)if(!task.paused&&task.nextRunAt<=now)started.push({id:task.id,run:await this.begin(task,false)});
      return started;
    });
    for(const item of due)await this.launch(item.id,item.run);
    await this.resolveSessions();
  }
  /** Checks at the next scheduled time, and at least every `checkMs`. The first check comes after `delay`. */
  start(delay=5000){this.closed=false;this.started=true;void this.init().then(()=>this.arm(delay)).catch(()=>{});}
  private arm(delay?:number){
    if(this.closed||!this.started)return;
    clearTimeout(this.timer);
    const limit=this.options.checkMs??60000,soonest=Math.min(...this.tasks.filter(task=>!task.paused).map(task=>task.nextRunAt),Infinity);
    const wait=delay??Math.max(1000,Math.min(limit,soonest-this.now()));
    this.timer=setTimeout(()=>{void this.check().catch(error=>console.error(new Date().toISOString(),'Scheduled tasks check failed',error instanceof Error?error.message:''));},wait);
    this.timer.unref?.();
  }
  async close(){this.closed=true;clearTimeout(this.timer);await this.checking?.catch(()=>{});await this.lock;}
}
