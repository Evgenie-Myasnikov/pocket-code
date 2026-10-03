import {useState} from 'react';
import {Trash2} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
export function DeleteWorkspaceItem({connection,kind,id,name,onDeleted}:{connection:Connection;kind:'boards'|'workspaces';id:string;name:string;onDeleted():Promise<void>}){
 const ru=useLanguage()==='ru',[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const title=kind==='boards'?(ru?'Удалить доску':'Delete board'):(ru?'Удалить рабочую область':'Delete workspace');
 return <><button className="icon-button" aria-label={title} onClick={()=>{setError('');setOpen(true);}}><Trash2 size={18}/></button>{open&&<div className="modal-backdrop"><section className="board-dialog" role="dialog" aria-modal="true" aria-label={title}><h2>{title}: {name}</h2><p>{kind==='workspaces'?(ru?'Доски, заявки и доступы участников этой области будут удалены.':'Boards, requests and member access in this workspace will be removed.'):(ru?'Доска и её заметки будут удалены.':'This board and its notes will be removed.')}</p><p>{ru?'Файлы проекта останутся на ПК. Отменить удаление нельзя.':'Project files stay on the PC. This cannot be undone.'}</p>{error&&<p role="alert">{error}</p>}<footer><button disabled={busy} onClick={()=>setOpen(false)}>{ru?'Отмена':'Cancel'}</button><button className="danger" disabled={busy} onClick={async()=>{setBusy(true);try{await request(connection,'/'+kind+'/'+id+'/delete',{});await onDeleted();setOpen(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{ru?'Удалить':'Delete'}</button></footer></section></div>}</>;
}
