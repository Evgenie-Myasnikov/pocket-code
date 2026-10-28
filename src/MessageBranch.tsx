import {useRef,useState} from 'react';
import type {ChatMessage} from '../server/types';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import {userAttachmentBlocks} from './user-attachments';
export type BranchTarget={message:ChatMessage;history:ChatMessage[];regenerate:boolean;sourceId:string};
export function MessageBranch({target,onClose,onSubmit}:{target:BranchTarget;onClose():void;onSubmit(text:string):Promise<boolean>}){
 const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
 const [text,setText]=useState(()=>userAttachmentBlocks(target.message.blocks).filter(b=>b.type==='text').map(b=>b.text||'').join('\n')),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const ref=useRef<HTMLElement|null>(null);useModal(ref,true,()=>{if(!busy)onClose();});
 const title=target.regenerate?l('Regenerate response','Повторить ответ'):l('Edit message','Редактировать сообщение');
 return <div className="modal-backdrop"><section ref={ref} className="confirm-modal" role="dialog" aria-modal="true" aria-label={title}><form onSubmit={e=>{e.preventDefault();setBusy(true);setError('');void onSubmit(text).then(ok=>{if(ok)onClose();else setError(l('Not sent. Check the connection and try again.','Не отправлено. Проверьте подключение и повторите.'));}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}><h2>{title}</h2><p>{l('Creates a new conversation from this point. The original conversation is kept; project files are not rewound. Attachments are restored when available.','Создаст новый чат с этого места. Исходная переписка сохранится; файлы проекта не откатываются. Доступные вложения будут восстановлены.')}</p><textarea aria-label={l('Message text','Текст сообщения')} value={text} readOnly={target.regenerate} onChange={e=>setText(e.target.value)} rows={6}/>{error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy||!text.trim()&&!userAttachmentBlocks(target.message.blocks).some(b=>b.type!=='text')}>{busy?l('Preparing…','Подготовка…'):target.regenerate?l('Regenerate','Повторить'):l('Save and send','Сохранить и отправить')}</button><button type="button" className="text-button" disabled={busy} onClick={onClose}>{l('Cancel','Отмена')}</button></form></section></div>;
}
