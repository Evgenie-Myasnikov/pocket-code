import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage,t} from './i18n';

type Runtime={bundled?:string;installed?:string;using:'bundled'|'installed';canUpdate:boolean;ok?:boolean;message?:string};
/** An error that says the Claude Code on the PC is older than the model needs. */
export const claudeOutdated=(text?:string)=>!!text&&/does not support this model|or newer is required|claude update/i.test(text);
/** Claude Code on the PC: which copy answers and a button that runs the installed copy's own updater. */
export function ClaudeEngineUpdate({connection,compact}:{connection:Connection|null;compact?:boolean}){
 useLanguage();
 const [runtime,setRuntime]=useState<Runtime|null>(null),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 useEffect(()=>{if(!connection)return;let active=true;request<Runtime>(connection,'/engine-updates/claude').then(value=>{if(active&&value&&typeof value==='object')setRuntime(value);}).catch(()=>{/* An older host has no such control. */});return()=>{active=false;};},[connection?.url,connection?.token]);
 if(!connection||!runtime)return null;
 async function update(){setBusy(true);setNote('');try{const next=await request<Runtime>(connection!,'/engine-updates/claude',{});setRuntime(next);setNote(next.ok?t('Claude Code обновлён. Повторите сообщение.'):t('Не удалось обновить Claude Code: {0}',next.message||''));}catch(error){setNote((error as Error).message);}finally{setBusy(false);}}
 const versions=[runtime.installed&&t('на ПК {0}',runtime.installed),runtime.bundled&&t('встроенный {0}',runtime.bundled)].filter(Boolean).join(' · ');
 return <div className={'claude-engine-update'+(compact?' compact':'')}>
  {!compact&&<p className="muted">Claude Code: {versions||t('Версии пока недоступны')}. {runtime.using==='installed'?t('Ответы идут через Claude Code, установленный на ПК.'):t('Ответы идут через встроенный Claude Code.')}</p>}
  {runtime.canUpdate?<button className="secondary" disabled={busy} onClick={()=>void update()}><RefreshCw size={16}/>{busy?t('Обновляем Claude Code…'):t('Обновить Claude Code')}</button>:<p className="muted">{t('Claude Code на ПК не установлен; встроенный обновляется вместе с Pocket Code.')}</p>}
  {note&&<p className="muted" role="status">{note}</p>}
 </div>;
}
