import {useEffect,useRef,useState} from 'react';
import {AlertCircle,AlertTriangle,RefreshCw,TrendingUp} from 'lucide-react';
import {request,type Connection} from './api';
import {locale,t,useLanguage} from './i18n';
import type {CodexUsageSnapshot} from '../server/codex-usage';
import {validUsageSnapshot} from './usage-summary';
import {narrowestWindow,percentLabel,usagePace,usageTone} from './usage-format';
import {publishUsage} from './live-settings';
import {resetLabel,windowLabel} from './CodexUsage';
import {startVisiblePoll} from './visible-poll';
import {SettingRow} from './SettingsRows';

type Provider='claude'|'codex'|'copilot';
const providers:Provider[]=['claude','codex','copilot'];
const names:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
type Read={snapshot:CodexUsageSnapshot|null;failed:boolean;busy:boolean};
const empty:Read={snapshot:null,failed:false,busy:false};

/** Usage limits in the PC window: one row per provider with the tightest window, its reset and when it was read. Values come only from the provider usage API. */
export function UsageRows({connection}:{connection:Connection|null}){
  useLanguage();
  const [reads,setReads]=useState<Record<Provider,Read>>({claude:empty,codex:empty,copilot:empty});
  const pending=useRef<Record<string,boolean>>({}),live=useRef(true);
  async function load(id:Provider){
    if(!connection||pending.current[id])return;pending.current[id]=true;
    setReads(old=>({...old,[id]:{...old[id],busy:true}}));
    try{const value=await request<CodexUsageSnapshot>(connection,`/${id}/usage`);if(!validUsageSnapshot(value))throw Error('Usage data is unavailable.');if(live.current){publishUsage(id,value);setReads(old=>({...old,[id]:{snapshot:value,failed:false,busy:false}}));}}
    // A failed read keeps the last dated snapshot; narrowestWindow turns a stale one into no value.
    catch{if(live.current)setReads(old=>({...old,[id]:{...old[id],failed:true,busy:false}}));}
    finally{pending.current[id]=false;}
  }
  useEffect(()=>{live.current=true;if(!connection)return;const stop=startVisiblePoll(async()=>{await Promise.all(providers.map(load));},60_000);return()=>{live.current=false;stop();};},[connection?.url,connection?.token]);
  const now=Date.now();
  return <>{providers.map(id=>{
    const {snapshot,failed,busy}=reads[id],narrowest=narrowestWindow(snapshot,now),tone=narrowest?usageTone(narrowest.remaining):null,pace=narrowest?usagePace(narrowest.window,narrowest.remaining,now):null;
    const Icon=tone==='danger'?AlertCircle:tone==='warning'?AlertTriangle:pace?.ahead?TrendingUp:null;
    const checked=snapshot?t('Проверено: {0}',new Date(snapshot.checkedAt).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'})):'';
    const note=narrowest?[windowLabel(narrowest.window,id),narrowest.window.resetsAt===null?t('Время сброса неизвестно'):resetLabel(narrowest.window.resetsAt,now),pace?.ahead?t('Опережаете темп'):'',checked].filter(Boolean).join(' · ')
      :failed?t('Нет данных: проверьте вход в {0} на ПК',names[id]):snapshot?[t('Провайдер не передал лимиты'),checked].join(' · '):t('Загружаем лимиты…');
    const blocked=snapshot?.ordinaryUsageAllowed===false?t('{0} сообщает, что включённое в подписку использование сейчас недоступно.',names[id]):'';
    return <SettingRow key={id} className={'usage-row'+(tone?' usage-tone-'+tone:'')} title={names[id]} note={blocked||note}>
      <span className="settings-value usage-row-value">{Icon&&<Icon size={16} aria-hidden="true"/>}{narrowest?t('Осталось {0}%',percentLabel(narrowest.remaining)):'—'}</span>
      <button type="button" className="icon-button" aria-label={t('Обновить лимиты')+' · '+names[id]} title={t('Обновить лимиты')} disabled={!connection||busy} onClick={()=>void load(id)}><RefreshCw size={16}/></button>
    </SettingRow>;
  })}</>;
}
