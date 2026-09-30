import {useEffect,useRef,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {RefreshCw} from 'lucide-react';
import {request,type Connection} from './api';
import {t} from './i18n';
import pkg from '../package.json';
import './host-updates.css';

type State='idle'|'checking'|'downloading'|'installing'|'waiting'|'restarting'|'updated'|'failed';
export type HostUpdateStatus={supported:boolean;currentVersion:string;targetVersion?:string;state:State;message?:string};
type Snapshot={key:string;status:HostUpdateStatus|null;error:boolean;reconnecting:boolean};
type Check={promise:Promise<HostUpdateStatus>;settled:boolean;retry:number};
const activeStates=new Set<State>(['checking','downloading','installing','waiting','restarting']);
const validStates=new Set<State>(['idle',...activeStates,'updated','failed']);
function checked(value:HostUpdateStatus){
  if(!value||typeof value.supported!=='boolean'||typeof value.currentVersion!=='string'||!validStates.has(value.state))throw new Error('Invalid host update status');
  return value;
}
/** Remains mounted in Updates while the settings card itself comes and goes. */
export function useHostUpdate(connection:Connection|null){
  const native=Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
  const key=connection?[connection.url,connection.token,pkg.version].join('|'):'';
  const checks=useRef(new Map<string,Check>()),generation=useRef(0),retryCount=useRef(0);
  const [retryRequest,setRetryRequest]=useState({key:'',id:0}),[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const retryId=retryRequest.key===key?retryRequest.id:0;
  useEffect(()=>{
    const epoch=++generation.current;
    if(!connection||!native){setSnapshot(null);return;}
    let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined,disconnectedAt:number|undefined,failures=0;
    let current:HostUpdateStatus|null=null,plannedRestart=false;
    const active=()=>!cancelled&&epoch===generation.current;
    const signal=(next:boolean)=>{
      if(!active()||plannedRestart===next)return;plannedRestart=next;
      window.dispatchEvent(new CustomEvent('pocket-code-host-update-restarting',{detail:{active:next}}));
    };
    const apply=(value:HostUpdateStatus)=>{
      if(!active())return;current=checked(value);disconnectedAt=undefined;failures=0;
      signal(current.supported&&(current.state==='installing'||current.state==='restarting'));
      setSnapshot({key,status:current,error:false,reconnecting:false});
      if(current.supported&&activeStates.has(current.state))timer=setTimeout(poll,current.state==='waiting'?10000:2500);
    };
    const failure=(error:unknown)=>{
      if(!active())return;
      if((error as {status?:number})?.status===404){apply({supported:false,currentVersion:current?.currentVersion||'',state:'idle'});return;}
      disconnectedAt??=Date.now();failures++;
      const expired=Date.now()-disconnectedAt>=120000;
      if(expired)signal(false);
      setSnapshot({key,status:current,error:expired,reconnecting:!expired});
      if(!expired)timer=setTimeout(poll,Math.min(15000,failures*2500));
    };
    async function poll(){
      if(!active())return;
      try{apply(await request<HostUpdateStatus>(connection!,'/host-update/status'));}catch(error){failure(error);}
    }
    setSnapshot({key,status:null,error:false,reconnecting:false});
    // A shared in-flight promise prevents development StrictMode or effect re-entry
    // from submitting the same connection/version check twice.
    let check=checks.current.get(key);
    if(!check||retryId>check.retry){
      check={promise:request<HostUpdateStatus>(connection,'/host-update/check',{appVersion:pkg.version}),settled:false,retry:retryId};
      checks.current.set(key,check);
      const entry=check;
      // Reuse the pending submission after StrictMode re-entry; do not race it
      // with an early status request that might still report idle.
      void entry.promise.then(()=>{entry.settled=true;},()=>{entry.settled=true;});
    }
    if(check.settled)void poll();
    else void check.promise.then(apply).catch(failure);
    return()=>{
      clearTimeout(timer);
      if(epoch===generation.current&&plannedRestart){window.dispatchEvent(new CustomEvent('pocket-code-host-update-restarting',{detail:{active:false}}));}
      cancelled=true;
    };
  },[connection,key,native,retryId]);
  const visible=snapshot?.key===key?snapshot:null;
  return {native,connected:Boolean(connection),status:visible?.status||null,error:visible?.error||false,reconnecting:visible?.reconnecting||false,retry:()=>setRetryRequest({key,id:++retryCount.current})};
}

const stateText:Record<State,string>={idle:'Сервер ПК проверен. Подходящего обновления нет.',checking:'Проверяем обновление сервера ПК…',downloading:'ПК скачивает обновление…',installing:'ПК устанавливает обновление…',waiting:'Обновление начнётся после завершения текущих задач на ПК.',restarting:'Сервер ПК перезапускается. Соединение восстановится автоматически.',updated:'Сервер ПК обновлён.',failed:'Не удалось обновить сервер ПК.'};
export function HostUpdates({update}:{update:ReturnType<typeof useHostUpdate>}){
  const {native,connected,status,error,reconnecting,retry}=update;
  const unavailable=status?.supported===false,failed=error||status?.state==='failed';
  return <section className="host-update-card" aria-label={t('Обновление сервера ПК')}>
    <h3>{t('Обновление сервера ПК')}</h3>
    {!connected?<p className="muted">{t('Подключитесь к ПК, чтобы обновить сервер.')}</p>:!native?<p className="muted">{t('Android-приложение проверяет обновление сервера при подключении к ПК.')}</p>:<>
      {status?.currentVersion&&<p className="muted">{t('Версия сервера: {0}',status.currentVersion)}{status.targetVersion&&status.targetVersion!==status.currentVersion?` → ${status.targetVersion}`:''}</p>}
      <p role="status">{unavailable?t('Этот сервер пока не поддерживает автоматическое обновление. Обновите его на ПК.'):error?t('ПК пока не отвечает. Проверьте соединение и повторите проверку.'):reconnecting?t('Ожидаем соединения с сервером ПК…'):t(stateText[status?.state||'checking'])}</p>
      {status?.message&&<p className="muted">{t(status.message)}</p>}
      {failed&&!unavailable&&<button className="secondary" onClick={retry}><RefreshCw size={16}/>{t('Повторить обновление сервера')}</button>}
      {!unavailable&&<p className="muted">{t('Версия сервера не будет новее версии приложения. Текущие задачи завершаются перед перезапуском.')}</p>}
    </>}
  </section>;
}
