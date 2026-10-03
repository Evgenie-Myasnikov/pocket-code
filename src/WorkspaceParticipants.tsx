import {RenameWorkspaceProfile} from './RenameWorkspaceProfile';
import {useEffect,useRef,useState} from 'react';
import {Users,X} from 'lucide-react';
import type {ProjectWorkspace} from '../server/boards';
import type {Connection} from './api';
import {useLanguage} from './i18n';
import {WorkspaceMembers} from './WorkspaceMembers';

export function WorkspaceParticipants({workspace,connection,manage,onChange}:{workspace:ProjectWorkspace;connection:Connection;manage:boolean;onChange():Promise<void>}){
  const ru=useLanguage()==='ru',[open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const title=ru?'Участники':'Participants',people=workspace.people||[...(workspace.members||[])];
  const roles:Record<string,string>=ru?{host:'Хост',viewer:'Наблюдатель',developer:'Разработчик',reviewer:'Ревьюер',qa:'QA'}:{host:'Host',viewer:'Viewer',developer:'Developer',reviewer:'Reviewer',qa:'QA'};
  useEffect(()=>{setOpen(false);},[workspace.id]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  return <><button ref={trigger} className="workspace-participants-button" aria-label={title+': '+people.length} aria-haspopup="dialog" onClick={()=>setOpen(true)}><Users size={18}/><span>{people.length}</span></button>
    <dialog ref={dialog} className="workspace-participants-dialog" aria-label={title} onCancel={()=>setOpen(false)} onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget){const b=e.currentTarget.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)setOpen(false);}}}>
      <header><h2>{title} · {people.length}</h2><button className="icon-button" autoFocus aria-label={ru?'Закрыть':'Close'} onClick={()=>setOpen(false)}><X size={20}/></button></header>
      <ul>{people.map(p=><li key={p.id}><span>{p.name}</span><small>{roles[p.role]||p.role}</small>{p.id===workspace.me?.id&&<RenameWorkspaceProfile connection={connection} workspaceId={workspace.id} name={p.name} onChange={onChange}/>}</li>)}</ul>
      {manage&&connection.desktop&&<WorkspaceMembers workspace={workspace} connection={connection} onChange={onChange}/>}
    </dialog></>;
}
