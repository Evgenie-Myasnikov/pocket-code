import {useEffect,useRef,useState} from 'react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {startVisiblePoll} from './visible-poll';
import {remainingUsage,validUsageSnapshot} from './usage-summary';
import {usageTone} from './usage-format';
import {publishUsage} from './live-settings';
import type {CodexUsageSnapshot} from '../server/codex-usage';
import './usage-indicator.css';

/** How long the remaining percentage replaces the Send/Stop icon, and how often it comes back. */
const FLASH_MS=2600,FLASH_EVERY_MS=45_000,FIRST_FLASH_MS=1500;

/** The allowance ring around Send. It is not a control: limit details live in Settings → Usage limits. */
export function UsageIndicator({connection,provider,models}:{connection:Connection;provider:'claude'|'codex'|'copilot';models:string[]}){
  useLanguage();
  const button=useRef<HTMLDivElement|null>(null);
  const [flash,setFlash]=useState(false),[ink,setInk]=useState('');
  const [visible,setVisible]=useState(false),[snapshot,setSnapshot]=useState<CodexUsageSnapshot|null>(null),[failed,setFailed]=useState(false),[,setTick]=useState(0);
  useEffect(()=>{const node=button.current;if(!node)return;const observer=new IntersectionObserver(entries=>setVisible(entries.some(entry=>entry.isIntersecting)));observer.observe(node);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    setSnapshot(null);setFailed(false);
    if(!visible)return;let active=true;
    const stop=startVisiblePoll(async()=>{
      try{const value=await request<CodexUsageSnapshot>(connection,`/${provider}/usage`);if(!validUsageSnapshot(value))throw new Error('Usage data is unavailable.');if(active){setSnapshot(value);setFailed(false);publishUsage(provider,value);}}
      catch{if(active)setFailed(true);}
    },60_000);
    return()=>{active=false;stop();};
  },[visible,connection.url,connection.token,provider]);
  // A window that resets before the next poll stops counting at that moment instead of showing an expired percentage.
  useEffect(()=>{const next=Math.min(...(Array.isArray(snapshot?.buckets)?snapshot!.buckets.flatMap(bucket=>(bucket.windows||[]).map(window=>window.resetsAt===null?Infinity:window.resetsAt*1000)):[]));if(!Number.isFinite(next))return;const wait=next-Date.now();if(wait<=0||wait>60_000)return;const timer=setTimeout(()=>setTick(value=>value+1),wait+50);return()=>clearTimeout(timer);},[snapshot]);
  const remaining=failed?null:remainingUsage(snapshot,provider,models),engine=provider==='copilot'?'Copilot':provider==='codex'?'Codex':'Claude';
  const percent=remaining===null?'—':`${Math.floor(remaining)}%`,tone=remaining===null?'':usageTone(remaining);
  const label=remaining===null?t('{0}: лимиты недоступны',engine):t('{0}: осталось {1} лимита',engine,percent);
  // Now and then the button shows the remaining percentage instead of its icon, then returns to Send/Stop.
  const shown=remaining===null?null:Math.floor(remaining);
  useEffect(()=>{if(shown===null||!visible){setFlash(false);return;}let hide=0;const show=()=>{
      // The number takes the exact colour of the icon it replaces, whatever the theme and button state.
      const icon=button.current?.closest('.composer-submit')?.querySelector<SVGElement>(':is(.send-button,.stop-button)>svg');if(icon)setInk(getComputedStyle(icon).color);
      setFlash(true);window.clearTimeout(hide);hide=window.setTimeout(()=>setFlash(false),FLASH_MS);};
    const first=window.setTimeout(show,FIRST_FLASH_MS),every=window.setInterval(()=>{if(document.visibilityState==='visible')show();},FLASH_EVERY_MS);
    return()=>{window.clearTimeout(first);window.clearInterval(every);window.clearTimeout(hide);};},[shown,visible]);
  return <div ref={button} role="img" className={'usage-indicator'+(tone==='danger'?' usage-low':tone==='warning'?' usage-warning':'')} data-flash={flash||undefined} aria-label={label}>
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle className="usage-track" cx="10" cy="10" r="8"/><circle className="usage-value" cx="10" cy="10" r="8" pathLength="100" strokeDasharray={`${remaining??0} 100`} transform="rotate(-90 10 10)"/></svg><span className="usage-percent" aria-hidden="true" style={ink?{color:ink}:undefined}>{percent}</span>
  </div>;
}
