import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {Express} from 'express';
import {activityItem} from './activity.js';
import type {JobView} from './types.js';
import type {RunEvent} from './run-monitor.js';

export type RunNotification = {
  id:string; provider:'claude'|'codex'|'copilot'; sessionId?:string; jobId?:string;
  cwd:string; title:string; status:'done'|'error'|'stopped'|'needs_input'; at:number; version?:string;
};
const attention = new Set(['done','error','stopped','needs_input']);
const retention = 7 * 86400000;
/** Private, bounded delivery journal: display titles/targets, never full transcripts, tool output or credentials. */
export class RunNotificationJournal {
  private events:RunNotification[]=[];
  private observed = new Map<string,string>();
  private external = new Set<string>();
  private serial:Promise<unknown>=Promise.resolve();
  private loaded=false;
  private lastAt=0;
  private dirty=false;
  constructor(private file:string, private now=Date.now) {}
  private async load() {
    if(this.loaded)return;
    this.loaded=true;
    try {
      const value=JSON.parse(await readFile(this.file,'utf8'));
      if(value.version!==1)return;
      this.events=Array.isArray(value.events)?value.events.filter((item:RunNotification)=>item&&typeof item.id==='string'&&typeof item.at==='number'&&attention.has(item.status)&&['claude','codex','copilot'].includes(item.provider)).slice(-1000):[];
      this.observed=new Map(Array.isArray(value.observed)?value.observed.slice(-2000):[]);
      this.external=new Set(Array.isArray(value.external)?value.external.slice(-1000):[]);
      this.lastAt=Math.max(0,...this.events.map(item=>item.at));
    }catch{/* First use or a damaged journal establishes a fresh quiet client baseline. */}
  }
  private append(event:Omit<RunNotification,'id'|'at'>) {
    this.events.push({...event,id:randomUUID(),at:this.lastAt=Math.max(this.now(),this.lastAt+1)});
  }
  sync(jobs:JobView[], external:RunEvent[]=[]) {
    const work=this.serial.then(async()=>{
      await this.load(); let changed=false;
      for(const job of jobs) {
        const item=activityItem(job), key=`${item.provider}:${item.id}`;
        if(this.observed.get(key)===item.version)continue;
        this.observed.delete(key); this.observed.set(key,item.version);changed=true;
        if(attention.has(item.status))this.append({provider:item.provider,sessionId:item.sessionId,jobId:item.id,cwd:item.cwd,title:item.title,status:item.status as RunNotification['status'],version:item.version});
      }
      for(const event of external) {
        if(this.external.has(event.id))continue;
        this.external.add(event.id);changed=true;
        // A native provider transcript can describe the same bridge run. Keep its exact job target.
        if(this.events.some(item=>item.jobId&&item.provider===event.provider&&item.sessionId===event.sessionId&&item.status===event.status&&Math.abs(item.at-event.at)<120000))continue;
        // Keep external cursors and identities intact for older clients.
        this.events.push({...event});this.lastAt=Math.max(this.lastAt,event.at);
      }
      const retained=this.events.filter(item=>this.now()-item.at<retention).sort((a,b)=>a.at-b.at).slice(-1000);
      changed ||= retained.length!==this.events.length; this.events=retained;
      while(this.observed.size>2000)this.observed.delete(this.observed.keys().next().value!);
      while(this.external.size>1000)this.external.delete(this.external.values().next().value!);
      this.dirty ||= changed;
      if(this.dirty) {
        await mkdir(path.dirname(this.file),{recursive:true});
        const temp=this.file+'.tmp';
        await writeFile(temp,JSON.stringify({version:1,events:this.events,observed:[...this.observed],external:[...this.external]}),{mode:0o600});
        await rename(temp,this.file);
        this.dirty=false;
      }
      return this.snapshot(0);
    });
    this.serial=work.catch(()=>{});return work;
  }
  snapshot(since:number) {return {now:Math.max(this.now(),this.lastAt),events:this.events.filter(item=>item.at>since)};}
  settled() {return this.serial;}
}

export function mountRunNotifications(app:Express, options:{file:string;jobs:()=>JobView[];external?:()=>RunEvent[];intervalMs?:number}) {
  const journal=new RunNotificationJournal(options.file);
  const refresh=async()=>journal.sync(options.jobs(),options.external?.()||[]);
  const timer=setInterval(()=>void refresh().catch(()=>{}),options.intervalMs??2000);timer.unref();
  void refresh().catch(()=>{});
  app.get('/api/activity/events',async(req,res,next)=>{
    try{await refresh();const since=Number(req.query.since);res.json(journal.snapshot(Number.isFinite(since)?Math.max(0,since):Date.now()));}catch(error){next(error);}
  });
  return ()=>{clearInterval(timer);return journal.settled();};
}
