import {ScanLine} from 'lucide-react';
import {useLanguage} from './i18n';
import {WorkspaceParticipants} from './WorkspaceParticipants';
import type {WorkspaceAccess} from './workspace-access';
import type {useProjectWorkspaces} from './project-workspaces';
import './mobile-workspace-header.css';

export function MobileWorkspaceHeader({accesses,current,value,local,canLocal,onLocal,onSelect,onJoin}:{accesses:WorkspaceAccess[];current:WorkspaceAccess|null;value:ReturnType<typeof useProjectWorkspaces>;local:boolean;canLocal:boolean;onLocal():void;onSelect(access:WorkspaceAccess):void;onJoin():void}){
 const ru=useLanguage()==='ru';
 const key=(item:WorkspaceAccess)=>item.url+'|'+item.workspaceId;
 return <header className="mobile-workspace-header">
  <label><small>WorkSpace</small><select aria-label={ru?'Рабочая область':'Workspace'} value={local?'local':current?key(current):''} onChange={e=>{if(e.target.value==='local')onLocal();else{const access=accesses.find(item=>key(item)===e.target.value);if(access)onSelect(access);}}}>
   {!current&&!local&&<option value="">{ru?'Присоединиться':'Join a workspace'}</option>}
   {accesses.map((item,i)=><option key={key(item)} value={key(item)}>{item.workspaceId===value.workspace?.id?value.workspace?.name:item.name||(ru?'Рабочая область ':'Workspace ')+(i+1)}</option>)}
   {canLocal&&<option value="local">{ru?'Локальные доски':'Local boards'}</option>}
  </select></label>
  <button className="icon-button" aria-label={ru?'Сканировать QR рабочей области':'Scan workspace QR'} onClick={onJoin}><ScanLine size={21}/></button>
  {!local&&current&&value.workspace&&<WorkspaceParticipants workspace={value.workspace} connection={current} manage={false} onChange={value.refresh}/>}
 </header>;
}
