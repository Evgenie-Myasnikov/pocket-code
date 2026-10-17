import {useState} from 'react';
import {Clock,ChevronDown,ChevronUp,Paperclip} from 'lucide-react';
import {t,useLanguage} from './i18n';
import {plural} from './plural';

/** A message the agent has not received yet: queued for the end of the turn, waiting after a refusal, or left undelivered by Stop. */
export type OutboxItem={id:string;text:string;attachments:number;caption:string;onEdit?():void;onRemove?():void;onSendNow?():void;removeLabel?:string};
/** One "Waiting to send" block above the composer with the same actions for every reason a message waits. */
export function OutboxShelf({items,busy=false}:{items:OutboxItem[];busy?:boolean}){
  useLanguage();
  const [collapsed,setCollapsed]=useState(false);
  if(!items.length)return null;
  return <section className="outbox-shelf" aria-label={t('Ожидают отправки')}>
    <button type="button" className="outbox-toggle" aria-expanded={!collapsed} onClick={()=>setCollapsed(value=>!value)}><Clock size={14} aria-hidden="true"/>{t('Ожидают отправки')}: {items.length}{collapsed?<ChevronUp size={14} aria-hidden="true"/>:<ChevronDown size={14} aria-hidden="true"/>}</button>
    {!collapsed&&<ul>{items.map(item=><li key={item.id} className="outbox-item">
      <p className="outbox-text" title={item.text}>{item.text||t('Без текста')}</p>
      <p className="outbox-meta" role="status">{item.caption}{item.attachments>0&&<> · <Paperclip size={12} aria-hidden="true"/>{plural(item.attachments,['{0} файл','{0} файла','{0} файлов'])}</>}</p>
      <div className="outbox-actions">
        {item.onSendNow&&<button type="button" className="text-button" disabled={busy} onClick={item.onSendNow}>{t('Отправить сейчас')}</button>}
        {item.onEdit&&<button type="button" className="text-button" disabled={busy} onClick={item.onEdit}>{t('Изменить')}</button>}
        {item.onRemove&&<button type="button" className="text-button" disabled={busy} onClick={item.onRemove}>{item.removeLabel||t('Удалить')}</button>}
      </div>
    </li>)}</ul>}
  </section>;
}
