import {useRef,useState} from 'react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';

export function DeleteProjectBoard({connection,root,name,miro,repositoryRevision,onClose,onDeleted}:{connection:Connection;root:string;name:string;miro:boolean;repositoryRevision?:string;onClose():void;onDeleted():void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),dialog=useRef<HTMLElement|null>(null);
 useModal(dialog,true,()=>{if(!busy)onClose();});
 const title=miro?l('Disconnect board','Отключить доску'):l('Delete board','Удалить доску');
 return <div className="modal-backdrop"><section ref={dialog} className="board-dialog" role="dialog" aria-modal="true" aria-label={title}>
  <h2>{title}: {name}</h2><p>{miro?l('Remove this connection? The board remains in Miro.','Удалить подключение? Доска останется в Miro.'):l('The board file and its notes will be deleted from this project. Other project files and image assets are kept.','Файл доски и её заметки будут удалены из проекта. Остальные файлы проекта и вложенные изображения сохранятся.')}</p>
  {error&&<p role="alert">{error}</p>}<footer><button disabled={busy} onClick={onClose}>{l('Cancel','Отмена')}</button><button className="danger" disabled={busy} onClick={async()=>{
   if(busy)return;setBusy(true);setError('');try{if(miro)await request(connection,'/project-board/miro',{root,url:null});else{if(!repositoryRevision)throw Error(l('Refresh the board list before deleting.','Обновите список досок перед удалением.'));await request(connection,'/project-board/delete',{root,repositoryRevision});}onDeleted();}catch(e){setError((e as Error).message);setBusy(false);}
  }}>{title}</button></footer>
 </section></div>;
}
