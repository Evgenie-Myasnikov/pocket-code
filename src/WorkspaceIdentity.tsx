import {useEffect,useRef,useState} from 'react';
import {request,type Connection} from './api';
import type {useProjectWorkspaces} from './project-workspaces';
import {useLanguage} from './i18n';
import './note-assignees.css';

export function WorkspaceIdentity({connection,value}:{connection:Connection|null;value:ReturnType<typeof useProjectWorkspaces>}){
  const ru=useLanguage()==='ru',ws=value.workspace,required=!!ws?.me?.needsName;
  const dialog=useRef<HTMLDialogElement>(null),[name,setName]=useState(''),[lastName,setLastName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setName(ws?.me?.needsName?'':ws?.me?.name||'');setLastName('');setError('');},[ws?.id,ws?.me?.needsName]);
  useEffect(()=>{if(required)dialog.current?.showModal();else dialog.current?.close();},[required,ws?.id]);
  return <dialog ref={dialog} className="workspace-identity-dialog" aria-label={ru?'Ваше имя в рабочей области':'Your workspace name'} onCancel={e=>e.preventDefault()}><form onSubmit={async e=>{e.preventDefault();if(!connection||!ws||busy)return;setBusy(true);setError('');try{await request(connection,'/workspaces/'+ws.id+'/profile',{name:[name.trim(),lastName.trim()].filter(Boolean).join(' ')});await value.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
    <h2>{ws?.name}</h2><label>{ru?'Имя':'First name'}<input aria-label={ru?'Как вас зовут?':'What is your name?'} autoFocus required maxLength={80} autoComplete="given-name" value={name} onChange={e=>setName(e.target.value)}/></label><label>{ru?'Фамилия':'Last name'}<input maxLength={79} autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)}/></label><p className="muted">{ru?'Это имя увидят участники на доске и в заметках.':'Participants will see this name on the board and notes.'}</p>{error&&<p role="alert">{error}</p>}<footer><button className="primary" disabled={busy||!name.trim()}>{busy?(ru?'Сохранение…':'Saving…'):(ru?'Продолжить':'Continue')}</button></footer>
  </form></dialog>;
}
