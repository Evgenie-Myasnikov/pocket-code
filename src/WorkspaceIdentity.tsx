import {profileName,completeName} from './profile-name';
import {savedProfile,saveProfile} from './workspace-profile';
import {useEffect,useRef,useState} from 'react';
import {request,type Connection} from './api';
import type {useProjectWorkspaces} from './project-workspaces';
import {useLanguage} from './i18n';
import './note-assignees.css';

export function WorkspaceIdentity({connection,value}:{connection:Connection|null;value:ReturnType<typeof useProjectWorkspaces>}){
  const ru=useLanguage()==='ru',ws=value.workspace,required=!!ws?.me&&(ws.me.needsName||!completeName(profileName(ws.me)));
  const dialog=useRef<HTMLDialogElement>(null),[name,setName]=useState(''),[lastName,setLastName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const profile=ws?.me&&!ws.me.needsName?profileName(ws.me):savedProfile()||profileName(ws?.me?.needsName?undefined:ws?.me);setName(profile.firstName);setLastName(profile.lastName);setError('');},[ws?.id,ws?.me?.needsName]);
  const reused=useRef('');
  useEffect(()=>{if(!connection||!ws?.me)return;if(!required){saveProfile(profileName(ws.me));return;}const profile=savedProfile(),key=connection.url+'|'+ws.id+'|'+ws.me.id;if(!profile||reused.current===key)return;reused.current=key;setBusy(true);void request(connection,'/workspaces/'+ws.id+'/profile',{...profile,name:profile.firstName+' '+profile.lastName}).then(()=>value.refresh()).catch(e=>setError(e.message)).finally(()=>setBusy(false));},[connection?.url,ws?.id,ws?.me?.id,required]);
  useEffect(()=>{if(required)dialog.current?.showModal();else dialog.current?.close();},[required,ws?.id]);
  return <dialog ref={dialog} className="workspace-identity-dialog" aria-label={ru?'Ваше имя в рабочей области':'Your workspace name'} onCancel={e=>e.preventDefault()}><form onSubmit={async e=>{e.preventDefault();if(!connection||!ws||busy)return;setBusy(true);setError('');try{await request(connection,'/workspaces/'+ws.id+'/profile',{name:[name.trim(),lastName.trim()].join(' '),firstName:name.trim(),lastName:lastName.trim()});saveProfile({firstName:name.trim(),lastName:lastName.trim()});await value.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
    <h2>{ws?.name}</h2><label>{ru?'Имя':'First name'}<input aria-label={ru?'Как вас зовут?':'What is your name?'} autoFocus required maxLength={80} autoComplete="given-name" value={name} onChange={e=>setName(e.target.value)}/></label><label>{ru?'Фамилия':'Last name'}<input required maxLength={79} autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)}/></label><p className="muted">{ru?'Это имя увидят участники на доске и в заметках.':'Participants will see this name on the board and notes.'}</p>{error&&<p role="alert">{error}</p>}<footer><button className="primary" disabled={busy||!name.trim()||!lastName.trim()}>{busy?(ru?'Сохранение…':'Saving…'):(ru?'Продолжить':'Continue')}</button></footer>
  </form></dialog>;
}
