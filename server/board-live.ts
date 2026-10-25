import {randomUUID} from 'node:crypto';
export type BoardActivityTarget={id:string;x:number;y:number;width:number;height:number};
export type BoardEditActivity={id:string;ids:string[];phase:'reading'|'editing'|'saved'|'failed';expiresAt:number;action?:'inspect'|'create'|'move'|'connect'|'update';targets?:BoardActivityTarget[]};
/** Ephemeral product geometry and tool phases, never accounts or conversation contents. */
export class BoardLiveActivity{
 private entries=new Map<string,BoardEditActivity[]>();
 private listeners=new Map<string,Set<()=>void>>();
 private emptyCursor=randomUUID();
 set(key:string,ids:string[],phase:BoardEditActivity['phase'],details:Pick<BoardEditActivity,'action'|'targets'>={}){
  const value={...details,id:randomUUID(),ids:[...new Set(ids)],phase,expiresAt:Date.now()+8000};
  const history=[...(this.entries.get(key)||[]).filter(v=>v.expiresAt>Date.now()),value].slice(-64);
  this.entries.delete(key);this.entries.set(key,history);while(this.entries.size>128)this.entries.delete(this.entries.keys().next().value!);
  for(const notify of this.listeners.get(key)||[])notify();return value;
 }
 get(key:string){const value=this.entries.get(key)?.at(-1);return value&&value.expiresAt>Date.now()?value:null;}
 since(key:string,after?:string){
  const history=this.entries.get(key)||[],index=history.findIndex(v=>v.id===after),latest=history.at(-1);
  const events=after===this.emptyCursor?history:after&&index>=0?history.slice(index+1):latest?[latest]:[];
  return {activityCursor:latest?.id||this.emptyCursor,activities:events.filter(v=>v.expiresAt>Date.now())};
 }
 async wait(key:string,after:string,milliseconds:number,signal:AbortSignal){
  if(signal.aborted||this.since(key,after).activityCursor!==after)return;
  if((this.listeners.get(key)?.size||0)>=32||[...this.listeners.values()].reduce((n,v)=>n+v.size,0)>=256)return;
  await new Promise<void>(resolve=>{
   const complete=()=>{clearTimeout(timer);signal.removeEventListener('abort',complete);const group=this.listeners.get(key);group?.delete(complete);if(!group?.size)this.listeners.delete(key);resolve();};
   const timer=setTimeout(complete,milliseconds);let group=this.listeners.get(key);if(!group){group=new Set();this.listeners.set(key,group);}group.add(complete);signal.addEventListener('abort',complete,{once:true});
   if(signal.aborted||this.since(key,after).activityCursor!==after)complete();
  });
 }
}
