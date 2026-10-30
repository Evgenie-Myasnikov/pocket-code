import type {CodexUsageSnapshot,CodexUsageWindow} from '../server/codex-usage';

export function validUsageSnapshot(value:unknown):value is CodexUsageSnapshot{
 if(!value||typeof value!=='object')return false;
 const snapshot=value as CodexUsageSnapshot,number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
 return number(snapshot.checkedAt)&&snapshot.checkedAt>0&&[true,false,null].includes(snapshot.ordinaryUsageAllowed)&&Array.isArray(snapshot.buckets)&&snapshot.buckets.every(bucket=>bucket&&typeof bucket.id==='string'&&typeof bucket.name==='string'&&Array.isArray(bucket.windows)&&bucket.windows.every(window=>window&&['primary','secondary'].includes(window.id)&&[window.usedPercent,window.remainingPercent].every(v=>v===null||number(v)&&v>=0&&v<=100)&&[window.windowDurationMins,window.resetsAt].every(v=>v===null||number(v)&&v>0)));
}

const normalized=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
/** Only shared and explicitly matched model limits participate; unrelated model quotas do not. */
export function remainingUsage(snapshot:CodexUsageSnapshot|null,provider:'claude'|'codex'|'copilot',models:string[],now=Date.now()):number|null{
  if(!validUsageSnapshot(snapshot)||now-snapshot.checkedAt>120_000||snapshot.checkedAt>now+60_000)return null;
  if(snapshot.ordinaryUsageAllowed===false)return 0;
  const names=models.filter(Boolean).map(normalized);
  const applicable=snapshot.buckets.filter(bucket=>{
    const name=normalized(bucket.name);
    return name===provider||name==='allmodels'||names.includes(name)||
      provider==='claude'&&['sonnet','opus','haiku'].includes(name)&&names.some(model=>model.includes(name));
  });
  const windows=applicable.flatMap(bucket=>bucket.windows);
  if(windows.some(window=>window.resetsAt!==null&&window.resetsAt*1000<=now))return null;
  const values=windows.map(window=>window.remainingPercent).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100);
  return values.length?Math.max(0,Math.min(100,...values)):null;
}

export function validRemaining(window:CodexUsageWindow,checkedAt:number,now=Date.now()):number|null{
 if(!Number.isFinite(checkedAt)||now-checkedAt>120_000||checkedAt>now+60_000||window.resetsAt!==null&&window.resetsAt*1000<=now)return null;
 const value=window.remainingPercent;return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null;
}
