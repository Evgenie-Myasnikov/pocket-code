import {useEffect,useState} from 'react';
import {AlertCircle,AlertTriangle,TrendingUp} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {startVisiblePoll} from './visible-poll';
import type {CodexUsageSnapshot} from '../server/codex-usage';
import {publishUsage,useLiveSettings} from './live-settings';
import {narrowestWindow,percentLabel,usagePace,usageTone} from './usage-format';
import {CodexUsage,resetLabel,windowLabel} from './CodexUsage';

type Provider='claude'|'codex'|'copilot';
const providers:Provider[]=['claude','codex','copilot'];
const names:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
/** Limits page: every provider's tightest window at a glance, then the selected provider's details. Only the providers not shown in detail are read here. */
export function UsageLimits({connection,provider}:{connection:Connection|null;provider:Provider}){
  useLanguage();
  const [selected,setSelected]=useState<Provider>(provider),[failed,setFailed]=useState<Record<string,boolean>>({}),live=useLiveSettings();
  useEffect(()=>setSelected(provider),[provider]);
  useEffect(()=>{
    if(!connection)return;let active=true;
    const others=providers.filter(id=>id!==selected);
    const stop=startVisiblePoll(async()=>{await Promise.all(others.map(async id=>{try{const value=await request<CodexUsageSnapshot>(connection,`/${id}/usage`);if(active){publishUsage(id,value);setFailed(old=>({...old,[id]:false}));}}catch{if(active){publishUsage(id,null);setFailed(old=>({...old,[id]:true}));}}}));},60_000);
    return()=>{active=false;stop();};
  },[connection?.url,connection?.token,selected]);
  const now=Date.now();
  return <>
    {connection&&<section className="usage-overview" aria-label={t('Сводка лимитов')}><h3>{t('Сводка лимитов')}</h3>{providers.map(id=>{
      const snapshot=live.usage(id),narrowest=narrowestWindow(snapshot,now),tone=narrowest?usageTone(narrowest.remaining):null,pace=narrowest?usagePace(narrowest.window,narrowest.remaining,now):null,Icon=tone==='danger'?AlertCircle:tone==='warning'?AlertTriangle:pace?.ahead?TrendingUp:null;
      const detail=narrowest?[windowLabel(narrowest.window,id),narrowest.window.resetsAt===null?t('Время сброса неизвестно'):resetLabel(narrowest.window.resetsAt,now),pace?.ahead?t('Опережаете темп'):''].filter(Boolean).join(' · '):failed[id]?t('Нет данных: проверьте вход в {0} на ПК',names[id]):snapshot?t('Провайдер не передал лимиты'):t('Загружаем лимиты…');
      return <button type="button" key={id} className={'usage-overview-row'+(tone?' usage-tone-'+tone:'')} aria-pressed={selected===id} onClick={()=>setSelected(id)}><span>{names[id]}</span><strong>{Icon&&<Icon size={15} aria-hidden="true"/>}{narrowest?t('Осталось {0}%',percentLabel(narrowest.remaining)):'—'}</strong><small>{detail}</small></button>;
    })}</section>}
    <CodexUsage connection={connection} provider={selected}/>
  </>;
}
