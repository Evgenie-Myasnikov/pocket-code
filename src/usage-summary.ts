import type {CodexUsageSnapshot} from '../server/codex-usage';

const normalized=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
/** Only shared and explicitly matched model limits participate; unrelated model quotas do not. */
export function remainingUsage(snapshot:CodexUsageSnapshot|null,provider:'claude'|'codex',models:string[],now=Date.now()):number|null{
  if(!snapshot||!Number.isFinite(snapshot.checkedAt)||now-snapshot.checkedAt>120_000)return null;
  if(snapshot.ordinaryUsageAllowed===false)return 0;
  const names=models.filter(Boolean).map(normalized);
  const applicable=snapshot.buckets.filter(bucket=>{
    const name=normalized(bucket.name);
    return name===provider||name==='allmodels'||names.includes(name)||
      provider==='claude'&&['sonnet','opus','haiku'].includes(name)&&names.some(model=>model.includes(name));
  });
  const windows=applicable.flatMap(bucket=>bucket.windows);
  if(windows.some(window=>window.resetsAt!==null&&window.resetsAt*1000<=now))return null;
  const values=windows.map(window=>window.remainingPercent).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));
  return values.length?Math.max(0,Math.min(100,...values)):null;
}
