import {useRef,useState} from 'react';
import {Pencil,Trash2} from 'lucide-react';
import {CardActionMenu} from './CardActionMenu';
import {request,type Connection} from './api';
import type {Session} from './session';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
export type ChatActionTarget={session:Session;x:number;y:number;running?:boolean};
export function ChatActions({target,connection,provider,onClose,onChanged}:{target:ChatActionTarget;connection:Connection;provider:string;onClose():void;onChanged(session:Session,deleted:boolean):void}){
 const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
 const [phase,setPhase]=useState<'menu'|'rename'|'delete'>('menu'),[title,setTitle]=useState(target.session.customTitle||target.session.summary||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const menuSelection=useRef(false);
 const choose=(next:'rename'|'delete')=>{menuSelection.current=true;setPhase(next);};
 const closeMenu=()=>queueMicrotask(()=>{if(!menuSelection.current)onClose();});
 const dialog=useRef<HTMLElement|null>(null);useModal(dialog,phase==='rename'||phase==='delete',()=>{if(!busy)onClose();});
 async function save(){setBusy(true);setError('');try{await request(connection,`/sessions/${encodeURIComponent(target.session.sessionId)}/manage`,{provider,action:phase,title:phase==='rename'?title.trim():undefined});onChanged({...target.session,customTitle:title.trim()},phase==='delete');onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(phase==='menu')return <CardActionMenu label={l('Chat actions','Действия чата')} point={target} onClose={closeMenu} items={[{label:l('Rename','Переименовать'),Icon:Pencil,onSelect:()=>choose('rename')},{label:l('Delete from Pocket Code','Удалить из Pocket Code'),Icon:Trash2,danger:true,disabled:target.running,onSelect:()=>choose('delete')}]}/>;
 return <div className="modal-backdrop"><section ref={dialog} className="confirm-modal" role="dialog" aria-modal="true" aria-label={phase==='rename'?l('Rename chat','Переименовать чат'):l('Delete chat','Удалить чат')}><form onSubmit={e=>{e.preventDefault();void save();}}><h2>{phase==='rename'?l('Rename chat','Переименовать чат'):l('Delete chat','Удалить чат')}</h2>{phase==='rename'?<input autoFocus aria-label={l('Chat name','Название чата')} value={title} maxLength={200} onChange={e=>setTitle(e.target.value)}/>:<p>{l('Remove this chat from Pocket Code on this PC and connected phones? Its original history in the AI provider remains available.','Удалить чат из Pocket Code на этом ПК и подключённых телефонах? Исходная история в AI-провайдере сохранится.')}</p>}{error&&<p role="alert">{error}</p>}<button type="submit" className={'primary'+(phase==='delete'?' danger':'')} disabled={busy||phase==='rename'&&!title.trim()}>{l('Confirm','Подтвердить')}</button><button type="button" className="text-button" disabled={busy} onClick={onClose}>{l('Cancel','Отмена')}</button></form></section></div>;
}
