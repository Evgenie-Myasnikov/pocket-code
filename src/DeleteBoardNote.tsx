import {useRef} from 'react';
import {useLanguage} from './i18n';
import {useModal} from './navigation';

export function DeleteBoardNote({title,busy,error,onClose,onDelete}:{title:string;busy:boolean;error:string;onClose():void;onDelete():Promise<boolean>}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const dialog=useRef<HTMLElement|null>(null);
 useModal(dialog,true,()=>{if(!busy)onClose();});
 return <div className="modal-backdrop"><section ref={dialog} className="board-dialog" role="dialog" aria-modal="true" aria-label={l('Delete note','Удалить карточку')}>
  <h2>{l('Delete note','Удалить карточку')}: {title}</h2>
  <p>{l('This note and references to it will be removed. Other notes and image files are kept.','Карточка и ссылки на неё будут удалены. Остальные карточки и файлы изображений сохранятся.')}</p>
  {error&&<p role="alert">{error}</p>}
  <footer><button disabled={busy} onClick={onClose}>{l('Cancel','Отмена')}</button><button className="danger" disabled={busy} onClick={async()=>{if(!busy&&await onDelete())onClose();}}>{l('Delete note','Удалить карточку')}</button></footer>
 </section></div>;
}
