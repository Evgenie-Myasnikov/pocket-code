import {useEffect,useRef,useState} from 'react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {startVisiblePoll} from './visible-poll';
import {remainingUsage} from './usage-summary';
import {usageTone} from './usage-format';
import {publishUsage} from './live-settings';
import type {CodexUsageSnapshot} from '../server/codex-usage';
import './usage-indicator.css';

export function UsageIndicator({connection,provider,models,onOpen}:{connection:Connection;provider:'claude'|'codex'|'copilot';models:string[];onOpen:()=>void}){
  useLanguage();
  const button=useRef<HTMLButtonElement|null>(null);
  const [visible,setVisible]=useState(false),[snapshot,setSnapshot]=useState<CodexUsageSnapshot|null>(null),[failed,setFailed]=useState(false),[,setTick]=useState(0);
  useEffect(()=>{const node=button.current;if(!node)return;const observer=new IntersectionObserver(entries=>setVisible(entries.some(entry=>entry.isIntersecting)));observer.observe(node);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    setSnapshot(null);setFailed(false);
    if(!visible)return;let active=true;
    const stop=startVisiblePoll(async()=>{
      try{const value=await request<CodexUsageSnapshot>(connection,`/${provider}/usage`);if(active){setSnapshot(value);setFailed(false);publishUsage(provider,value);}}
      catch{if(active)setFailed(true);}
    },60_000);
    return()=>{active=false;stop();};
  },[visible,connection.url,connection.token,provider]);
  // A window that resets before the next poll stops counting at that moment instead of showing an expired percentage.
  useEffect(()=>{const next=Math.min(...(Array.isArray(snapshot?.buckets)?snapshot!.buckets.flatMap(bucket=>(bucket.windows||[]).map(window=>window.resetsAt===null?Infinity:window.resetsAt*1000)):[]));if(!Number.isFinite(next))return;const wait=next-Date.now();if(wait<=0||wait>60_000)return;const timer=setTimeout(()=>setTick(value=>value+1),wait+50);return()=>clearTimeout(timer);},[snapshot]);
  const remaining=failed?null:remainingUsage(snapshot,provider,models),engine=provider==='copilot'?'Copilot':provider==='codex'?'Codex':'Claude';
  const percent=remaining===null?'—':`${Math.floor(remaining)}%`,tone=remaining===null?'':usageTone(remaining);
  const label=remaining===null?t('{0}: лимиты недоступны',engine):t('{0}: осталось {1} лимита',engine,percent);
  const hint=t('Минимальный остаток доступных лимитов для текущей модели. Нажмите для подробностей.');
  return <button ref={button} type="button" className={'usage-indicator'+(tone==='danger'?' usage-low':tone==='warning'?' usage-warning':'')} aria-label={label} aria-description={hint} onClick={onOpen}>
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle className="usage-track" cx="10" cy="10" r="8"/><circle className="usage-value" cx="10" cy="10" r="8" pathLength="100" strokeDasharray={`${remaining??0} 100`} transform="rotate(-90 10 10)"/></svg><span className="usage-percent" role="tooltip">{percent}</span>
  </button>;
}
