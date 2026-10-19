import {useEffect,useState} from 'react';
import {LoaderCircle,RefreshCw,WifiOff,CloudOff,AlertTriangle,ChevronDown} from 'lucide-react';
import {t,locale,useLanguage} from './i18n';
import {relativeTime} from './run-status';
import {hostDown,retryNow,useReachability,type Reachability} from './reachability';
import './connection-status.css';

/** "14:32" today, "yesterday 18:05" or "12 Oct" for older saved data. */
export function dataTime(at:number,now=Date.now()){
  const date=new Date(at),today=new Date(now),day=86400000,start=new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime();
  const time=date.toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'});
  if(at>=start)return time;if(at>=start-day)return t('вчера {0}',time);
  return date.toLocaleDateString(locale(),{day:'numeric',month:'short'});
}
export type ConnectionLine={tone:'offline'|'progress'|'warning';text:string;short:string;detail?:string;retry:boolean};
/** The single sentence about the PC connection; null while everything answers. */
export function connectionLine(reach:Reachability,{offline=false,hostError='',now=Date.now()}:{offline?:boolean;hostError?:string;now?:number}={}):ConnectionLine|null{
  const age=reach.cachedAt?t('данные от {0}',dataTime(reach.cachedAt,now)):reach.lastOkAt?t('был на связи {0}',relativeTime(reach.lastOkAt,now)):'';
  const join=(text:string)=>age?text+' · '+age:text;
  if(reach.status==='no-network')return {tone:'offline',text:join(t('Нет сети')),short:t('Нет сети'),retry:false};
  if(reach.status==='restarting')return {tone:'progress',text:t('Сервер ПК обновляется · вернётся сам'),short:t('Сервер ПК обновляется'),retry:false};
  if(reach.status==='connecting')return {tone:'progress',text:t('Подключение к ПК…'),short:t('Подключение к ПК…'),detail:reach.detail,retry:false};
  if(hostDown(reach)||offline){
    const tunnel=reach.cause==='tunnel';
    return {tone:'offline',text:join(tunnel?t('Туннель на связи, сервер ПК — нет'):t('ПК не отвечает')),short:t('Нет связи с ПК'),detail:reach.detail||(tunnel&&reach.httpStatus?t('Интернет-туннель ответил HTTP {0}: окно сервера на ПК закрыто или перезапускается.',reach.httpStatus):hostError||undefined),retry:true};
  }
  if(hostError)return {tone:'warning',text:hostError,short:t('ПК ответил с ошибкой'),retry:true};
  return null;
}
/** One compact line under the header instead of a stack of banners: cause, age of the data and one action. After a few seconds it folds into a chip. */
export function ConnectionStatus({offline=false,hostError='',onRetry,className=''}:{offline?:boolean;hostError?:string;onRetry?:()=>void;className?:string}){
  useLanguage();
  const reach=useReachability(),[now,setNow]=useState(()=>Date.now()),[compact,setCompact]=useState(false),[open,setOpen]=useState(false);
  const line=connectionLine(reach,{offline,hostError,now});
  const key=line?line.tone+line.short:'';
  useEffect(()=>{setCompact(false);setOpen(false);if(!key)return;const timer=setTimeout(()=>setCompact(true),6000);return()=>clearTimeout(timer);},[key]);
  useEffect(()=>{if(!line)return;const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[Boolean(line)]);
  if(!line)return null;
  const Icon=line.tone==='progress'||reach.checking&&line.tone==='offline'?LoaderCircle:line.tone==='warning'?AlertTriangle:reach.status==='no-network'?WifiOff:CloudOff;
  const retry=()=>{retryNow();onRetry?.();};
  const folded=compact&&!open;
  return <div className={'connection-status connection-status-'+line.tone+(folded?' connection-status-compact':'')+(className?' '+className:'')} role="status" aria-live="polite">
    <button type="button" className="connection-status-main" aria-expanded={line.detail&&!folded?open:undefined} onClick={()=>{if(folded)setCompact(false);else if(line.detail)setOpen(value=>!value);}} title={line.text}>
      <Icon size={16} aria-hidden="true" className={line.tone==='progress'||reach.checking?'connection-status-spin':undefined}/><span>{folded?line.short:line.text}</span>{line.detail&&!folded&&<ChevronDown size={14} aria-hidden="true" className="connection-status-chevron"/>}
    </button>
    {line.retry&&!folded&&<button type="button" className="text-button connection-status-retry" onClick={retry}><RefreshCw size={14} aria-hidden="true"/>{t('Повторить')}</button>}
    {open&&line.detail&&!folded&&<p className="connection-status-detail">{line.detail}</p>}
  </div>;
}
