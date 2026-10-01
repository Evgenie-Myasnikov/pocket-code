import {useCallback,useEffect,useRef,useState} from 'react';
import {Bell,CheckCheck,ChevronRight,RefreshCw,X} from 'lucide-react';
import {providerRequest,type Connection} from './api';
import type {TaskNotification} from '../server/task-notifications';
import {useLanguage,locale} from './i18n';
import {useModal} from './navigation';
import './task-notifications.css';
type Inbox={items:TaskNotification[];unread:number;loading:boolean;checkedAt:number;error?:string;sources?:{id:string;name:string}[]};
const empty:Inbox={items:[],unread:0,loading:false,checkedAt:0};
export function useTaskNotifications(connection:Connection|null,provider:'claude'|'codex'|'copilot'='claude'){
 const request=providerRequest(provider);
 const [inbox,setInbox]=useState<Inbox>(empty),generation=useRef(0),pending=useRef(false),refreshRef=useRef<()=>Promise<void>>(async()=>{});
 useEffect(()=>{const current=++generation.current;setInbox(empty);pending.current=false;if(!connection)return;
  let stopped=false,timer:ReturnType<typeof setTimeout>;
  const refresh=async()=>{if(stopped||pending.current||document.visibilityState==='hidden')return;pending.current=true;
   try{const value=await request<Inbox>(connection,'/task-notifications');if(!stopped)setInbox(value);}
   catch{if(!stopped)setInbox(old=>({...old,loading:false,error:'unavailable'}));}
   finally{if(!stopped){pending.current=false;clearTimeout(timer);timer=setTimeout(refresh,10000);}}
  };
  refreshRef.current=refresh;const visible=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',visible);void refresh();
  return()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);if(generation.current===current)refreshRef.current=async()=>{};};
 },[connection,provider]);
 const markRead=useCallback(async(ids:string[])=>{if(!connection||!ids.length)return;const current=generation.current;await request(connection,'/task-notifications/read',{ids});if(generation.current===current)setInbox(old=>{const items=old.items.map(i=>ids.includes(i.id)?{...i,readAt:Date.now()}:i);return{...old,items,unread:items.filter(i=>!i.readAt).length};});},[connection,provider]);
 return{inbox,markRead,refresh:()=>refreshRef.current()};
}
const words={title:['Task notifications','Уведомления задач'],close:['Close notifications','Закрыть уведомления'],refresh:['Refresh notifications','Обновить уведомления'],read:['Mark all as read','Прочитать все'],unread:['Unread only','Только непрочитанные'],empty:['No task updates yet','Пока нет обновлений задач'],none:['No unread notifications','Нет непрочитанных уведомлений'],error:['Notifications could not be refreshed. Check the PC connection and update the server if needed.','Не удалось обновить уведомления. Проверьте связь с ПК и при необходимости обновите сервер.'],opening:['Opening task…','Открываем задачу…'],failed:['Could not open this task. The notification stays unread.','Не удалось открыть задачу. Уведомление останется непрочитанным.'],readError:['Could not save the read status. Try again.','Не удалось сохранить статус прочтения. Попробуйте ещё раз.'],note:['Changes to your assigned tasks. Updates are checked periodically while the app is open.','Изменения назначенных вам задач. Обновления проверяются периодически, пока приложение открыто.'],baseline:['The first sync sets a starting point; existing tasks do not create notifications.','Первая синхронизация задаёт точку отсчёта — старые задачи не создают уведомлений.'],updated:['Task updated','Задача обновлена'],status:['Status changed','Изменён статус'],comment:['New comments','Новые комментарии']} as const;
export function TaskNotificationBell({count,disabled,onClick}:{count:number;disabled?:boolean;onClick:()=>void}){
 const lang=useLanguage(),label=words.title[lang==='ru'?1:0];return <button className="icon-button task-notification-bell" aria-label={label} aria-description={String(count)} aria-haspopup="dialog" disabled={disabled} onClick={onClick}><Bell size={21}/>{count>0&&<span aria-hidden="true">{count>99?'99+':count}</span>}</button>;
}
export function TaskNotificationInbox({feed,onClose,onOpen}:{feed:ReturnType<typeof useTaskNotifications>;onClose:()=>void;onOpen:(item:TaskNotification)=>Promise<void>}){
 const lang=useLanguage(),label=(key:keyof typeof words)=>words[key][lang==='ru'?1:0];const modal=useRef<HTMLElement|null>(null);
 const [unreadOnly,setUnreadOnly]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');useModal(modal,true,onClose);
 const items=feed.inbox.items.filter(i=>!unreadOnly||!i.readAt);
 async function open(item:TaskNotification){setBusy(true);setError('');try{await onOpen(item);try{await feed.markRead([item.id]);onClose();}catch{setError(label('readError'));}}catch{setError(label('failed'));}finally{setBusy(false);}}
 return <div className="task-inbox-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section className="task-inbox" ref={modal} role="dialog" aria-modal="true" aria-label={label('title')}>
  <header><h2>{label('title')}</h2><button className="icon-button" aria-label={label('refresh')} onClick={()=>void feed.refresh()} disabled={feed.inbox.loading||busy}><RefreshCw size={19}/></button><button className="icon-button" aria-label={label('close')} onClick={onClose}><X size={21}/></button></header>
  <div className="task-inbox-tools"><button aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(!unreadOnly)}>{label('unread')}</button><button disabled={busy||!feed.inbox.unread} onClick={async()=>{setBusy(true);try{await feed.markRead(feed.inbox.items.filter(i=>!i.readAt).map(i=>i.id));}catch{setError(label('readError'));}finally{setBusy(false);}}}><CheckCheck size={18}/>{label('read')}</button></div>
  <div className="task-inbox-scroll">{(error||feed.inbox.error)&&<p role="alert">{error||label('error')}</p>}{busy&&<p role="status">{label('opening')}</p>}
   {!items.length&&<div className="task-inbox-empty"><Bell size={30}/><h3>{label(unreadOnly?'none':'empty')}</h3><p>{label('baseline')}</p></div>}
   <ul>{items.map(item=><li key={item.id}><button className={'task-inbox-item'+(!item.readAt?' unread':'')} disabled={busy} onClick={()=>void open(item)}><span className="task-inbox-dot"/><span><small>{item.sourceLabel}</small><strong>{item.key} · {item.summary}</strong><span>{label(item.kind)}{item.previousStatus?` · ${item.previousStatus} → ${item.status}`:item.status?` · ${item.status}`:''}</span><time dateTime={new Date(item.at).toISOString()}>{new Date(item.at).toLocaleString(locale(),{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></span><ChevronRight size={18}/></button></li>)}</ul>
   {!items.length&&<p className="task-inbox-note">{label('note')}</p>}
  </div>
 </section></div>;
}
