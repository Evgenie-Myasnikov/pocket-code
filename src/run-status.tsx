import {Check,CircleStop,LoaderCircle,MessageCircle,TriangleAlert} from 'lucide-react';
import {t,locale} from './i18n';
import './run-status.css';

/** One vocabulary for chat run states: the same label, colour token and shape on the phone, the PC window and in the inbox. */
export type RunStatus='needs_input'|'error'|'running'|'done'|'stopped';
const states={needs_input:{Icon:MessageCircle,label:'Ждёт вас'},error:{Icon:TriangleAlert,label:'Ошибка'},running:{Icon:LoaderCircle,label:'Работает'},done:{Icon:Check,label:'Готово'},stopped:{Icon:CircleStop,label:'Остановлено'}} as const;
export const runStatusLabel=(status:RunStatus)=>t(states[status].label);
export const isRunStatus=(value:unknown):value is RunStatus=>typeof value==='string'&&value in states;
/** Attention first: one chat that needs the person outranks any number of running ones. */
export const runStatusOrder:RunStatus[]=['needs_input','error','running','done','stopped'];
export function RunStatusIcon({status,size=16}:{status:RunStatus;size?:number}){const {Icon}=states[status];return <Icon size={size} className={'run-status-icon run-status-'+status} aria-hidden="true"/>;}
/** Colour is always paired with a shape and a word, so the state survives monochrome, forced colours and screen readers. */
export function ChatRunStatus({status,size=14}:{status:RunStatus;size?:number}){return <span className={'run-status run-status-'+status} data-status={status}><RunStatusIcon status={status} size={size}/>{runStatusLabel(status)}</span>;}
/** A small dot for icons; the visually hidden text names the state for TalkBack and Narrator. */
export function RunStatusDot({status,className=''}:{status:RunStatus;className?:string}){return <span className={('run-status-dot run-status-'+status+' '+className).trim()}><span className="visually-hidden">{runStatusLabel(status)}</span></span>;}

export function relativeTime(at:number,now=Date.now()){
  const seconds=Math.round((at-now)/1000),format=new Intl.RelativeTimeFormat(locale(),{numeric:'auto',style:'short'});
  const abs=Math.abs(seconds);
  if(abs<45)return t('только что');
  if(abs<3600)return format.format(Math.round(seconds/60),'minute');
  if(abs<86400)return format.format(Math.round(seconds/3600),'hour');
  if(abs<7*86400)return format.format(Math.round(seconds/86400),'day');
  return new Date(at).toLocaleDateString(locale(),{day:'numeric',month:'short',...(new Date(at).getFullYear()!==new Date(now).getFullYear()?{year:'numeric'}:{})});
}
export const fullTime=(at:number)=>new Date(at).toLocaleString(locale(),{dateStyle:'medium',timeStyle:'short'});
export function dayGroup(at:number,now=Date.now()):'today'|'yesterday'|'earlier'{
  const start=new Date(now);start.setHours(0,0,0,0);
  if(at>=start.getTime())return 'today';
  return at>=start.getTime()-86400000?'yesterday':'earlier';
}
export const dayGroupLabel=(group:'today'|'yesterday'|'earlier')=>t(group==='today'?'Сегодня':group==='yesterday'?'Вчера':'Раньше');
