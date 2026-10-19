import type {CodexUsageSnapshot,CodexUsageWindow} from '../server/codex-usage';
import {locale,t} from './i18n';
import {validRemaining} from './usage-summary';

export type UsageTone='ok'|'warning'|'danger';
/** Same 10 % edge as the composer ring; colour is always repeated by an icon and text. */
export const usageTone=(remaining:number):UsageTone=>remaining<=10?'danger':remaining<=25?'warning':'ok';
export function durationLabel(milliseconds:number){
  const minutes=Math.max(0,Math.floor(milliseconds/60000));
  if(minutes<1)return t('меньше минуты');
  const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;
  if(days)return hours?t('{0} д {1} ч',days,hours):t('{0} д',days);
  if(hours)return rest?t('{0} ч {1} мин',hours,rest):t('{0} ч',hours);
  return t('{0} мин',rest);
}
const time=(date:Date)=>date.toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'});
/** "today at 18:40", "tomorrow at 09:00", or a date without the year unless the year differs. */
export function momentLabel(milliseconds:number,now=Date.now()){
  const date=new Date(milliseconds),today=new Date(now),tomorrow=new Date(now);tomorrow.setDate(today.getDate()+1);
  const same=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  if(same(date,today))return t('сегодня в {0}',time(date));
  if(same(date,tomorrow))return t('завтра в {0}',time(date));
  return date.toLocaleString(locale(),{day:'numeric',month:'short',...(date.getFullYear()!==today.getFullYear()?{year:'numeric'}:{}),hour:'2-digit',minute:'2-digit'});
}
export const fullDate=(milliseconds:number)=>new Date(milliseconds).toLocaleString(locale(),{dateStyle:'medium',timeStyle:'short'});
export type UsagePace={elapsed:number;used:number;ahead:boolean;runsOutAt:number|null};
/** Elapsed share of the provider's own window versus the share it reports as used. An estimate from provider data only, never from tokens. */
export function usagePace(window:CodexUsageWindow,remaining:number,now=Date.now()):UsagePace|null{
  if(!window.windowDurationMins||window.resetsAt===null)return null;
  const duration=window.windowDurationMins*60000,end=window.resetsAt*1000,start=end-duration;
  if(now<start||now>=end)return null;
  const elapsed=(now-start)/duration,used=100-remaining,ahead=used>=10&&used/100>elapsed+0.1;
  const rate=used/Math.max(1,now-start),runsOutAt=ahead&&rate>0?now+remaining/rate:null;
  return {elapsed,used,ahead,runsOutAt:runsOutAt!==null&&runsOutAt<end?runsOutAt:null};
}
export type NarrowestWindow={bucket:string;window:CodexUsageWindow;remaining:number};
/** The window closest to its limit; that is the one that stops a task first. */
export function narrowestWindow(snapshot:CodexUsageSnapshot|null,now=Date.now()):NarrowestWindow|null{
  let best:NarrowestWindow|null=null;
  for(const bucket of Array.isArray(snapshot?.buckets)?snapshot!.buckets:[])for(const window of bucket.windows||[]){const remaining=validRemaining(window,snapshot!.checkedAt,now);if(remaining!==null&&(!best||remaining<best.remaining))best={bucket:bucket.name,window,remaining};}
  return best;
}
export const percentLabel=(value:number)=>new Intl.NumberFormat(locale(),{maximumFractionDigits:1}).format(value);
/** Used share of the tightest window, the way GitHub reports quota: 75 %, 90 % and 100 % used; 'pace' when usage runs ahead of the window time. */
export type LimitLevel='75'|'90'|'100'|'pace';
export function limitLevel(remaining:number):LimitLevel|null{return remaining<=0?'100':remaining<=10?'90':remaining<=25?'75':null;}
