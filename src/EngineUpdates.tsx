import {useEffect,useState} from 'react';
import {request,type Connection} from './api';
import {getLanguage} from './i18n';
import type {WorkspaceProvider} from './preferences';
type Status={supported:boolean;enabled:boolean;sourceRoot?:string;versions:Record<string,string>;changes:{id:string;engine:string;from:string;to:string;state:string}[]};
export function EngineUpdates({connection,provider}:{connection:Connection|null;provider:WorkspaceProvider}){
  const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const ru=getLanguage()==='ru';
  useEffect(()=>{if(!connection)return;let active=true;
    const poll=()=>request<Status>(connection,'/engine-updates').then(value=>{if(active&&value?.supported)setStatus(value);}).catch(()=>{});
    void poll();const timer=setInterval(poll,10000);return()=>{active=false;clearInterval(timer);};
  },[connection]);
  async function update(endpoint:string,data:unknown){if(!connection)return;const previous=status;setBusy(true);setError('');try{setStatus(await request(connection,endpoint,data));}catch(e){setStatus(previous);setError((e as Error).message);}finally{setBusy(false);}}
  if(!status?.supported)return null;
  const states:Record<string,string>=ru?{pending:'Ожидает свободного проекта',reserved:'Запуск зарезервирован — проверьте чаты',started:'Задача создана в чатах',failed:'Не удалось запустить — проверьте подключение AI'}:{pending:'Waiting for the project to be idle',reserved:'Launch reserved — check Chats',started:'Task created in Chats',failed:'Could not start — check the AI connection'};
  return <section className="engine-updates"><h3>{ru?'Совместимость AI':'AI compatibility'}</h3><p>{Object.entries(status.versions).map(([engine,version])=>`${engine==='codex'?'Codex':'Claude'} ${version}`).join(' · ')|| (ru?'Версии пока недоступны':'Versions not available yet')}</p>
    <label className="update-toggle"><input type="checkbox" checked={status.enabled} disabled={busy} onChange={e=>{const enabled=e.target.checked;setStatus({...status,enabled});void update('/engine-updates/settings',{provider,enabled});}}/>{ru?'Создавать AI-задачу при смене версии':'Create an AI task when a version changes'}</label>
    <p className="muted">{status.sourceRoot?(ru?'Проверяет текущий AI в отдельном чате Pocket Code. Изменения и тесты — в исходниках; публикация отдельно.':'The current AI checks Pocket Code in a separate chat, updates source and runs tests. Publishing is separate.'):(ru?'Добавьте папку исходников Pocket Code в разрешённые проекты ПК. До этого изменения версий будут только сохраняться.':'Share the Pocket Code source folder on the PC to run compatibility tasks. Until then, version changes are recorded only.')}</p>
    <button className="secondary" disabled={busy} onClick={()=>void update('/engine-updates/check',{})}>{ru?'Проверить версии AI':'Check AI versions'}</button>
    {error&&<p role="alert">{error}</p>}
    {status.changes.length>0&&<details><summary>{ru?'История проверок':'Check history'} ({status.changes.length})</summary><ul>{status.changes.slice().reverse().map(change=><li key={change.id}>{change.engine}: {change.from} → {change.to}<br/>{states[change.state]||change.state}</li>)}</ul></details>}
  </section>;
}
