import {useEffect,useState} from 'react';
import {AlertCircle,AlertTriangle,CheckCircle2,TrendingUp,X} from 'lucide-react';
import {t,useLanguage} from './i18n';
import {useLiveSettings} from './live-settings';
import {limitLevel,narrowestWindow,percentLabel,usagePace,type LimitLevel,type NarrowestWindow} from './usage-format';
import {resetLabel,windowLabel} from './CodexUsage';
import './limit-alert.css';

type Provider='claude'|'codex'|'copilot';
const names:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
const preferenceKey='pocket-code-limit-alerts',changeEvent='pocket-limit-alerts',dismissedKey='pocket-code-limit-alerts-dismissed',exhaustedKey='pocket-code-limit-exhausted';
export function limitAlertsEnabled(){try{return localStorage.getItem(preferenceKey)!=='false';}catch{return true;}}
export function setLimitAlerts(enabled:boolean){try{localStorage.setItem(preferenceKey,String(enabled));}catch{/* The choice still applies until reload. */}window.dispatchEvent(new Event(changeEvent));}
export function useLimitAlertsPreference(){
  const [enabled,setEnabled]=useState(limitAlertsEnabled);
  useEffect(()=>{const sync=()=>setEnabled(limitAlertsEnabled());window.addEventListener(changeEvent,sync);return()=>window.removeEventListener(changeEvent,sync);},[]);
  return enabled;
}
const rank:Record<LimitLevel,number>={pace:0,'75':1,'90':2,'100':3};
function readMap(key:string):Record<string,string>{try{return JSON.parse(sessionStorage.getItem(key)||'{}');}catch{return {};}}
function writeMap(key:string,value:Record<string,string>){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{/* Dismissals last for this view only. */}}
const windowKey=(provider:Provider,narrowest:NarrowestWindow)=>`${provider}:${narrowest.bucket}:${narrowest.window.id}:${narrowest.window.resetsAt??''}`;
/** One quiet line above the composer, fed only by usage reads that already run (the composer ring); nothing here polls. */
export function LimitAlert({provider,onOpen}:{provider:Provider;onOpen():void}){
  useLanguage();
  const live=useLiveSettings(),enabled=useLimitAlertsPreference(),[,setRevision]=useState(0);
  const now=Date.now(),narrowest=narrowestWindow(live.usage(provider),now);
  const level:LimitLevel|null=narrowest?limitLevel(narrowest.remaining)||(usagePace(narrowest.window,narrowest.remaining,now)?.ahead?'pace':null):null;
  const exhausted=readMap(exhaustedKey);
  useEffect(()=>{if(level==='100'&&!exhausted[provider])writeMap(exhaustedKey,{...readMap(exhaustedKey),[provider]:'1'});},[level,provider]);
  if(!enabled)return null;
  const restored=!!exhausted[provider]&&narrowest!==null&&level!=='100';
  const dismiss=(next:()=>void)=>{next();setRevision(value=>value+1);};
  if(restored)return <div className="limit-alert limit-alert-ok" role="status"><CheckCircle2 size={16} aria-hidden="true"/><span>{t('Лимит {0} восстановлен',names[provider])}</span><button type="button" className="icon-button" aria-label={t('Скрыть')} title={t('Скрыть')} onClick={()=>dismiss(()=>{const map=readMap(exhaustedKey);delete map[provider];writeMap(exhaustedKey,map);})}><X size={16}/></button></div>;
  if(!narrowest||!level)return null;
  const key=windowKey(provider,narrowest),seen=readMap(dismissedKey)[key] as LimitLevel|undefined;
  if(seen&&rank[seen]>=rank[level])return null;
  const reset=narrowest.window.resetsAt===null?t('время сброса неизвестно'):resetLabel(narrowest.window.resetsAt,now).toLocaleLowerCase();
  const text=level==='100'?t('{0}: лимит «{1}» исчерпан · {2}',names[provider],windowLabel(narrowest.window,provider),reset):level==='pace'?t('{0}: опережаете темп · осталось {1}% · {2}',names[provider],percentLabel(narrowest.remaining),reset):t('{0}: осталось {1}% лимита «{2}» · {3}',names[provider],percentLabel(narrowest.remaining),windowLabel(narrowest.window,provider),reset);
  const Icon=level==='pace'?TrendingUp:level==='75'?AlertTriangle:AlertCircle;
  return <div className={'limit-alert limit-alert-'+(level==='pace'||level==='75'?'warning':'danger')} role="status"><Icon size={16} aria-hidden="true"/><span>{text}</span><button type="button" className="text-button" onClick={onOpen}>{t('Подробнее')}</button><button type="button" className="icon-button" aria-label={t('Скрыть')} title={t('Скрыть')} onClick={()=>dismiss(()=>writeMap(dismissedKey,{...readMap(dismissedKey),[key]:level}))}><X size={16}/></button></div>;
}
export function LimitAlertsToggle({desktop=false}:{desktop?:boolean}){
  useLanguage();const enabled=useLimitAlertsPreference();
  return <div className="settings-run-alerts"><label className={desktop?'desktop-toggle':'checkbox-label'}><input type="checkbox" role={desktop?'switch':undefined} checked={enabled} onChange={event=>setLimitAlerts(event.target.checked)}/><span>{t('Предупреждать о лимитах в чате')}</span></label><p className="muted">{t('Строка над полем ввода, когда израсходовано 75, 90 и 100 % самого узкого окна или расход опережает время окна, и когда лимит восстановлен. Данные — из лимитов провайдера.')}</p></div>;
}
