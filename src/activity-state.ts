import type {ActivityItem} from '../server/types';

export type ActivitySeen={id:string;provider:ActivityItem['provider'];version:string;viewedAt:number};
export const activityHistoryLimit=500;
export const isTerminalActivity=(item:Pick<ActivityItem,'status'>)=>item.status==='done'||item.status==='error'||item.status==='stopped';
const itemKey=(item:Pick<ActivityItem,'id'|'provider'>)=>JSON.stringify([item.provider,item.id]);
const versionKey=(item:Pick<ActivityItem,'id'|'provider'|'version'>)=>JSON.stringify([item.provider,item.id,item.version]);
export function pruneSeen(input:unknown):ActivitySeen[]{
  if(!Array.isArray(input))return[];
  const entries=input.filter((entry):entry is ActivitySeen=>Boolean(entry&&typeof entry==='object'&&typeof entry.id==='string'&&entry.id.length<=200&&(entry.provider==='copilot'||entry.provider==='codex'||entry.provider==='claude')&&typeof entry.version==='string'&&entry.version.length<=300&&typeof entry.viewedAt==='number'&&Number.isFinite(entry.viewedAt)));
  const unique=new Map<string,ActivitySeen>();
  for(const entry of entries.sort((a,b)=>b.viewedAt-a.viewedAt))if(!unique.has(versionKey(entry)))unique.set(versionKey(entry),{id:entry.id,provider:entry.provider,version:entry.version,viewedAt:entry.viewedAt});
  return[...unique.values()].slice(0,activityHistoryLimit);
}
export function visibleActivity(items:ActivityItem[],seen:ActivitySeen[]):ActivityItem[]{
  const viewed=new Set(pruneSeen(seen).map(versionKey)),unique=new Set<string>();let history=0;
  return [...items].sort((a,b)=>b.startedAt-a.startedAt).filter(item=>{
    const key=itemKey(item);if(unique.has(key))return false;unique.add(key);
    if(!isTerminalActivity(item))return true;
    if(viewed.has(versionKey(item)))return false;
    return history++<activityHistoryLimit;
  });
}
export function rememberViewed(seen:ActivitySeen[],item:ActivityItem,now=Date.now()):ActivitySeen[]{
  if(!isTerminalActivity(item))return pruneSeen(seen);
  return pruneSeen([{id:item.id,provider:item.provider,version:item.version,viewedAt:now},...seen]);
}
export function validActivity(value:unknown):value is ActivityItem[]{
  return Array.isArray(value)&&value.every(item=>item&&typeof item==='object'&&typeof item.id==='string'&&(item.provider==='copilot'||item.provider==='codex'||item.provider==='claude')&&typeof item.cwd==='string'&&(item.sessionId===undefined||typeof item.sessionId==='string')&&typeof item.title==='string'&&['running','needs_input','done','error','stopped'].includes(item.status)&&typeof item.startedAt==='number'&&Number.isFinite(item.startedAt)&&typeof item.version==='string');
}
