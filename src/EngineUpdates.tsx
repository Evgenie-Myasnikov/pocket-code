import {useEffect,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {startVisiblePoll} from './visible-poll';
import {Notice} from './Notice';
import type {WorkspaceProvider} from './preferences';
type Status={supported:boolean;enabled:boolean;sourceRoot?:string;versions:Record<string,string>;changes:{id:string;engine:string;from:string;to:string;state:string}[]};
/** Product names instead of host ids, so the history reads "Codex CLI 0.47 → 0.48". */
const product=(engine:string)=>engine==='codex'?'Codex CLI':engine==='claude'?'Claude Code':engine==='copilot'?'GitHub Copilot CLI':engine;
const states:Record<string,string>={pending:'Ожидает свободного проекта',reserved:'Запуск зарезервирован — проверьте чаты',started:'Задача создана в чатах',failed:'Не удалось запустить — проверьте подключение AI'};
/** Engines live on the PC, so this block is shown whichever workspace is selected. */
export function EngineUpdates({connection,provider}:{connection:Connection|null;provider:WorkspaceProvider}){
  useLanguage();
  const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!connection)return;let active=true;
    const stop=startVisiblePoll(async()=>{try{const value=await request<Status>(connection,'/engine-updates');if(active&&value?.supported)setStatus(value);}catch{/* The block stays hidden until the host answers. */}},10000);
    return()=>{active=false;stop();};
  },[connection]);
  async function update(endpoint:string,data:unknown){if(!connection)return;const previous=status;setBusy(true);setError('');try{setStatus(await request(connection,endpoint,data));}catch(e){setStatus(previous);setError((e as Error).message);}finally{setBusy(false);}}
  if(!status?.supported)return null;
  return <section className="engine-updates"><h3>{t('Совместимость AI')}</h3><p>{Object.entries(status.versions).map(([engine,version])=>`${product(engine)} ${version}`).join(' · ')||t('Версии пока недоступны')}</p>
    <label className="checkbox-label"><input type="checkbox" checked={status.enabled} disabled={busy} onChange={e=>{const enabled=e.target.checked;setStatus({...status,enabled});void update('/engine-updates/settings',{provider,enabled});}}/>{t('Создавать AI-задачу при смене версии')}</label>
    <p className="muted">{status.sourceRoot?t('Проверяет текущий AI в отдельном чате Pocket Code. Изменения и тесты — в исходниках; публикация отдельно.'):t('Добавьте папку исходников Pocket Code в разрешённые проекты ПК. До этого изменения версий будут только сохраняться.')}</p>
    <button className="secondary" disabled={busy} onClick={()=>void update('/engine-updates/check',{})}>{t('Проверить версии AI')}</button>
    {error&&<Notice tone="error">{error}</Notice>}
    {status.changes.length>0&&<details className="disclosure"><summary><ChevronDown className="disclosure-chevron" size={20} aria-hidden="true"/>{t('История проверок')} ({status.changes.length})</summary><ul>{status.changes.slice().reverse().map(change=><li key={change.id}>{product(change.engine)}: {change.from} → {change.to}<br/>{t(states[change.state]||change.state)}</li>)}</ul></details>}
  </section>;
}
