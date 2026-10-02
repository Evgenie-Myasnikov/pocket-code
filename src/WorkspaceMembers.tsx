import {useState} from 'react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import type {ProjectWorkspace} from '../server/boards';
export function WorkspaceMembers({workspace,connection,onChange}:{workspace:ProjectWorkspace;connection:Connection;onChange():Promise<void>}){
  const ru=useLanguage()==='ru',l=(en:string,r:string)=>ru?r:en;
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function update(memberId:string,data:{role?:string;remove?:boolean}){setBusy(true);setError('');try{await request(connection,'/workspaces/'+workspace.id+'/member',{memberId,...data});await onChange();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(!connection.desktop)return null;
  if(workspace.role!=='host')return <p className="muted">{l('Role','Роль')}: {workspace.role}</p>;
  return <details className="workspace-members"><summary>{l('Members and roles','Участники и роли')} · {workspace.members?.length||0}</summary><p className="muted">{l('Devices paired with the host QR have host permissions. Password sign-in starts with read-only access.','Устройства, подключённые QR хоста, имеют права хоста. Вход по паролю сначала даёт доступ только к просмотру.')}</p>{workspace.members?.map(m=><div className="workspace-member" key={m.id}><span>{m.name}</span><select aria-label={l('Role for ','Роль для ')+m.name} value={m.role} disabled={busy} onChange={e=>void update(m.id,{role:e.target.value})}><option value="viewer">{l('Viewer','Наблюдатель')}</option><option value="developer">{l('Developer','Разработчик')}</option><option value="reviewer">{l('Reviewer','Ревьюер')}</option><option value="qa">QA</option></select><button disabled={busy} onClick={()=>void update(m.id,{remove:true})}>{l('Revoke access','Отозвать доступ')}</button></div>)}<p className="muted">{l('Members can edit notes according to their role. AI runs on this host are started by the host; isolated member execution is not enabled yet.','Участники могут редактировать заметки по своей роли. AI на этом ПК запускает хост; изолированный запуск от участников пока не включён.')}</p>{error&&<p role="alert">{error}</p>}</details>;
}
