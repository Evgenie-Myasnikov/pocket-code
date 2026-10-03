import {useEffect,useState} from 'react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';

export function ProjectRuleSwitch({connection,root}:{connection:Connection;root:string}){
  const ru=useLanguage()==='ru';
  const [settings,setSettings]=useState<{boardMaintenance:boolean;canEdit:boolean}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let cancelled=false;request<{boardMaintenance:boolean;canEdit:boolean}>(connection,'/project-rules?cwd='+encodeURIComponent(root)).then(value=>{if(!cancelled)setSettings(value);}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};},[connection,root]);
  return <section className="project-built-in-rule">
    <label><input type="checkbox" checked={settings?.boardMaintenance??true} disabled={!settings?.canEdit||busy} onChange={async event=>{const enabled=event.target.checked;setBusy(true);setError('');try{setSettings(await request(connection,'/project-rules',{cwd:root,boardMaintenance:enabled}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}/>{ru?'Ведение доски проекта':'Maintain the project board'}</label>
    <small>{ru?'Встроенное правило Pocket Code · применяется со следующего запуска AI':'Built-in Pocket Code rule · applies on the next AI run'}</small>
    <details><summary>{ru?'Что делает правило':'What this rule does'}</summary><p>{ru?'Если доска существует, AI читает задачи и обновляет карточки с результатами проверки. Доска необязательна и создаётся только по явному запросу. Отключение не удаляет файлы и не отключает AGENTS.md или CLAUDE.md, которые провайдер читает самостоятельно.':'If a board exists, AI reads tasks and updates cards with validation evidence. Boards are optional and created only on explicit request. Disabling this does not delete files or disable AGENTS.md or CLAUDE.md loaded independently by the provider.'}</p></details>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
