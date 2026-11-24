import {useEffect,useRef,useState} from 'react';
import {Archive,ArchiveRestore,Bell,BellOff,FolderInput,FolderOutput,FolderPlus,ListChecks,Pencil,Pin,PinOff,Trash2} from 'lucide-react';
import {CardActionMenu} from './CardActionMenu';
import {request,type Connection} from './api';
import type {Session} from './session';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import {useChatMute} from './chat-mute';
import {forgetChatTranscripts} from './chat-cache';
export type ChatActionTarget={session:Session;x:number;y:number;running?:boolean;select?():void;
 /** The PC chat list: pin to the top and archive out of the list. With these the menu is Rename, Pin, Archive, Delete. */
 pin?:{on:boolean;toggle():void};archive?:{on:boolean;toggle():void};
 /** The PC chat list deletes at once: the row leaves the list, the host erases the transcript and the cache, and a refusal is reported here. */
 onDeleteFailed?(session:Session,message:string):void;
 /** The PC chat list: user folders this chat can move to, the one it is in, and a new folder made with it. */
 folders?:{list:{id:string;name:string}[];current?:string;move(folder:string|null):void;create():void}};
/** Erase a chat's provider transcript and the Pocket Code cache. Throws with the host's reason. */
export async function eraseChat(connection:Connection,provider:string,session:Session,ru:boolean){
 const result=await request<{deleted?:boolean;originalRemoved?:boolean}>(connection,`/sessions/${encodeURIComponent(session.sessionId)}/manage`,{provider,action:'erase',eraseOriginals:true,...(session.account?{account:session.account}:{})});
 if(!(result?.deleted&&result.originalRemoved))throw Error(ru?'Сервер не подтвердил полное удаление. Обновите сервер и повторите попытку.':'The host did not confirm permanent erasure. Refresh or update the host before retrying.');
 await forgetChatTranscripts(connection,provider,[session.sessionId]);
}
export function ChatActions({target,connection,provider,jobId,managementDisabled,onClose,onChanged}:{target:ChatActionTarget;connection:Connection;provider:string;jobId?:string;managementDisabled?:boolean;onClose():void;onChanged(session:Session,deleted:boolean):void}){
 const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
 const {muted,toggle}=useChatMute(connection,target.session.provider||provider,target.session.sessionId,jobId);
 const [phase,setPhase]=useState<'menu'|'rename'|'delete'>('menu'),[title,setTitle]=useState(target.session.customTitle||target.session.summary||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [eraseOriginals,setEraseOriginals]=useState(true),cancelButton=useRef<HTMLButtonElement>(null),saving=useRef(false);
 const menuSelection=useRef(false);
 const choose=(next:'rename'|'delete')=>{menuSelection.current=true;setPhase(next);};
 const closeMenu=()=>queueMicrotask(()=>{if(!menuSelection.current)onClose();});
 const dialog=useRef<HTMLElement|null>(null);useModal(dialog,phase==='rename'||phase==='delete',()=>{if(!busy)onClose();});
 useEffect(()=>{if(phase==='delete')cancelButton.current?.focus({preventScroll:true});},[phase]);
 async function save(){
   if(saving.current||phase==='menu')return;
   saving.current=true;setBusy(true);setError('');
   try{
     const deleting=phase==='delete',original=deleting&&eraseOriginals;
     const result=await request<{deleted?:boolean;originalRemoved?:boolean}>(connection,`/sessions/${encodeURIComponent(target.session.sessionId)}/manage`,{
       provider,action:original?'erase':phase,...(!deleting?{title:title.trim()}:original?{eraseOriginals:true,...(target.session.account?{account:target.session.account}:{})}:{})
     });
     if(original&&!(result?.deleted&&result.originalRemoved))throw Error(l('The host did not confirm permanent erasure. Refresh or update the host before retrying.','Сервер не подтвердил полное удаление. Обновите сервер и повторите попытку.'));
     if(deleting)await forgetChatTranscripts(connection,provider,[target.session.sessionId]);
     onChanged({...target.session,customTitle:title.trim()},deleting);onClose();
   }catch(e){setError((e as Error).message);}finally{saving.current=false;setBusy(false);}
 }
 if(phase==='menu')return <CardActionMenu label={l('Chat actions','Действия чата')} point={target} onClose={closeMenu} items={[
  {label:l('Rename','Переименовать'),Icon:Pencil,disabled:managementDisabled,onSelect:()=>choose('rename')},
  ...(target.pin&&target.archive?[{label:target.pin.on?l('Unpin','Открепить'):l('Pin','Закрепить'),Icon:target.pin.on?PinOff:Pin,onSelect:()=>{target.pin!.toggle();onClose();}},{label:target.archive.on?l('Unarchive','Вернуть из архива'):l('Archive','В архив'),Icon:target.archive.on?ArchiveRestore:Archive,onSelect:()=>{target.archive!.toggle();onClose();}}]
   .concat(target.folders?[
    ...target.folders.list.filter(f=>f.id!==target.folders!.current).map(f=>({label:l('Move to ','Переместить в ')+'«'+f.name+'»',Icon:FolderInput,onSelect:()=>{target.folders!.move(f.id);onClose();}})),
    ...(target.folders.current?[{label:l('Remove from folder','Убрать из папки'),Icon:FolderOutput,onSelect:()=>{target.folders!.move(null);onClose();}}]:[]),
    {label:l('New folder with this chat','Новая папка с этим чатом'),Icon:FolderPlus,onSelect:()=>{target.folders!.create();onClose();}}]:[])
   :[...(target.select?[{label:l('Select chat','Выбрать чат'),Icon:ListChecks,onSelect:target.select}]:[]),{label:muted?l('Unmute notifications','Включить уведомления'):l('Mute notifications','Отключить уведомления'),Icon:muted?Bell:BellOff,onSelect:toggle}]),
  {label:target.pin?l('Delete','Удалить'):l('Erase chat…','Стереть чат…'),Icon:Trash2,danger:true,disabled:managementDisabled||target.running,onSelect:()=>{
   if(!target.onDeleteFailed){choose('delete');return;}
   const session=target.session,failed=target.onDeleteFailed;
   onChanged(session,true);onClose();
   void eraseChat(connection,provider,session,ru).catch(e=>failed(session,(e as Error).message));
  }},
 ]}/>;
 const heading=phase==='rename'?l('Rename chat','Переименовать чат'):l('Erase chat','Стереть чат');
 const submit=phase==='rename'?l('Rename','Переименовать'):eraseOriginals?l('Erase permanently','Стереть безвозвратно'):l('Remove from list','Убрать из списка');
 return <div className="modal-backdrop"><section ref={dialog} className="confirm-modal" role="dialog" aria-modal="true" aria-label={heading}>
   <form aria-busy={busy} onSubmit={e=>{e.preventDefault();void save();}}>
     <h2>{heading}</h2><p style={{overflowWrap:'anywhere'}}>{target.session.customTitle||target.session.summary||l('Untitled chat','Чат без названия')}</p>
     {phase==='rename'?<input autoFocus aria-label={l('Chat name','Название чата')} value={title} maxLength={200} onChange={e=>setTitle(e.target.value)}/>:<>
       <label>{l('Action','Действие')}<select value={eraseOriginals?'erase':'list'} disabled={busy} onChange={e=>{setEraseOriginals(e.target.value==='erase');setError('');}}>
         <option value="erase">{l('Erase original and cached copies','Стереть оригинал и кеш')}</option>
         <option value="list">{l('Only remove from list','Только убрать из списка')}</option>
       </select></label>
       <p>{eraseOriginals?l('This permanently erases the provider transcript stored on this PC and clears the Pocket Code cache. Connected devices remove their saved copy when they sync.','Переписка провайдера на этом ПК и кеш Pocket Code будут удалены безвозвратно. Подключённые устройства удалят свою копию при синхронизации.'):l('Hide the chat from the Pocket Code library. You can still open the original in the provider.','Чат исчезнет из списка Pocket Code. Исходная переписка останется доступна у провайдера.')}</p>
     </>}
     {error&&<p role="alert">{error}</p>}
     <button type="submit" className={'primary'+(phase==='delete'?' danger':'')} disabled={busy||phase==='rename'&&!title.trim()}>{busy?(phase==='rename'?l('Saving…','Сохраняем…'):l('Removing…','Удаляем…')):submit}</button>
     <button type="button" ref={cancelButton} className="text-button" disabled={busy} onClick={onClose}>{l('Cancel','Отмена')}</button>
   </form>
 </section></div>;
}
