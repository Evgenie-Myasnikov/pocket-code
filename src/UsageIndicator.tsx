import {useEffect,useRef,useState} from 'react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {startVisiblePoll} from './visible-poll';
import {remainingUsage} from './usage-summary';
import type {CodexUsageSnapshot} from '../server/codex-usage';
import './usage-indicator.css';

export function UsageIndicator({connection,provider,models,onOpen}:{connection:Connection;provider:'claude'|'codex';models:string[];onOpen:()=>void}){
  const ru=useLanguage()==='ru',button=useRef<HTMLButtonElement|null>(null);
  const [visible,setVisible]=useState(false),[snapshot,setSnapshot]=useState<CodexUsageSnapshot|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{const node=button.current;if(!node)return;const observer=new IntersectionObserver(entries=>setVisible(entries.some(entry=>entry.isIntersecting)));observer.observe(node);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!visible)return;let active=true;
    const stop=startVisiblePoll(async()=>{
      try{const value=await request<CodexUsageSnapshot>(connection,`/${provider}/usage`);if(active){setSnapshot(value);setFailed(false);}}
      catch{if(active)setFailed(true);}
    },60_000);
    return()=>{active=false;stop();};
  },[visible,connection.url,connection.token,provider]);
  const remaining=failed?null:remainingUsage(snapshot,provider,models),engine=provider==='codex'?'Codex':'Claude';
  const percent=remaining===null?'—':`${Math.floor(remaining)}%`;
  const label=remaining===null?(ru?`${engine}: лимиты недоступны`:`${engine}: limits unavailable`):(ru?`${engine}: осталось ${percent} лимита`:`${engine}: ${percent} allowance remaining`);
  const hint=ru?'Минимальный остаток доступных лимитов для текущей модели. Нажмите для подробностей.':'Lowest remaining allowance across available limits for the current model. Open for details.';
  return <button ref={button} type="button" className={'usage-indicator'+(remaining!==null&&remaining<=10?' usage-low':'')} aria-label={label} title={`${label}. ${hint}`} onClick={onOpen}>
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle className="usage-track" cx="10" cy="10" r="8"/><circle className="usage-value" cx="10" cy="10" r="8" pathLength="100" strokeDasharray={`${remaining??0} 100`} transform="rotate(-90 10 10)"/></svg><span>{percent}</span>
  </button>;
}
