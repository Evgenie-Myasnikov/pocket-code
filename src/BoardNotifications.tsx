import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,Check,X,MessageCircle,UserPlus,ChevronRight} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import type {BoardNotice} from '../server/board-attention';
import type {ProjectBoard} from '../server/boards';
import './task-notifications.css';
import './board-notifications.css';
import {ActivityList,type ActivityFeed} from './ActivityList';
import type {ActivityItem} from '../server/types';
import {RefreshCw} from 'lucide-react';
import './notification-center.css';

export type BoardNoticeTarget={board:ProjectBoard;connection:Connection;noteId:string;message:string;requestId:number};
export function BoardNotifications({connection,onOpen,activity,onOpenActivity,busy,onOpenChange}:{connection:Connection|null;onOpen?:(target:BoardNoticeTarget)=>void;activity?:ActivityFeed;onOpenActivity?:(item:ActivityItem)=>void;busy?:boolean;onOpenChange?:(open:boolean)=>void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const identity=JSON.stringify([connection?.url,connection?.token]),identityRef=useRef(identity);identityRef.current=identity;
 const [loadedIdentity,setLoadedIdentity]=useState('');
 const [storedItems,setItems]=useState<BoardNotice[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(''),[detail,setDetail]=useState<{title:string;description:string}|null>(null);
 const items=loadedIdentity===identity?storedItems:[];
 const [filter,setFilter]=useState<'all'|'processes'|'notifications'>('all');
 useEffect(()=>{onOpenChange?.(open);return()=>{if(open)onOpenChange?.(false);};},[open,onOpenChange]);
 const refreshNotices=useRef(()=>{});
 const modal=useRef<HTMLElement|null>(null),epoch=useRef(0);useModal(modal,open,()=>{setOpen(false);setDetail(null);});
 useEffect(()=>{const generation=++epoch.current;setItems([]);setDetail(null);setOpen(false);setError('');setFilter('all');if(!connection)return;let stopped=false,pending=false,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{if(stopped||pending)return;pending=true;clearTimeout(timer);try{const result=await request<{items:BoardNotice[]}>(connection,'/board-notifications');if(!Array.isArray(result?.items))throw Error('Unsupported inbox response');if(!stopped&&identityRef.current===identity){setLoadedIdentity(identity);setItems(result.items);setError('');}}catch{if(!stopped)setError(l('Notifications unavailable. Retry when connected.','Уведомления недоступны. Проверьте подключение.'));}finally{pending=false;if(!stopped&&generation===epoch.current)timer=setTimeout(poll,10000);}};
  refreshNotices.current=()=>void poll();void poll();return()=>{stopped=true;clearTimeout(timer);refreshNotices.current=()=>{};};
 },[connection?.url,connection?.token,ru]);
 async function read(item:BoardNotice){if(!connection)return;const generation=epoch.current;try{const board=await request<ProjectBoard>(connection,'/boards/'+item.boardId),note=board.notes.find(n=>n.id===item.noteId);if(!note)throw Error('Missing note');if(generation!==epoch.current||identityRef.current!==identity)return;if(onOpen){setOpen(false);setDetail(null);onOpen({board,connection,noteId:note.id,message:item.message,requestId:Date.now()});}else setDetail({title:note.title,description:item.kind==='question'?item.message:note.description});await request(connection,'/board-notifications/read',{ids:[item.id]});if(generation===epoch.current&&identityRef.current===identity)setItems(old=>old.map(n=>n.id===item.id?{...n,readAt:Date.now()}:n));}catch{if(generation===epoch.current&&identityRef.current===identity)setError(l('Could not open the task. It may have been removed.','Не удалось открыть задачу. Возможно, она удалена.'));}}
 const unread=items.filter(n=>!n.readAt).length+(activity?.count||0);
 if(!connection)return null;
 return <div className="board-notifications"><button className="board-notifications-trigger" aria-label={l('Notifications and activity','Уведомления и процессы')} title={l('Notifications and activity','Уведомления и процессы')} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><Bell size={24}/><span>{l('Notifications','Уведомления')}</span>{unread>0&&<b>{unread>99?'99+':unread}</b>}</button>
 {open&&createPortal(<div className="task-inbox-backdrop board-notifications-inbox" onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}><section className="task-inbox notification-center" role="dialog" aria-modal="true" aria-label={l('Notifications and activity','Уведомления и процессы')} ref={modal}><header><h2>{l('Notifications','Уведомления')}</h2><button className="icon-button" aria-label={l('Refresh','Обновить')} onClick={()=>{activity?.refresh();refreshNotices.current();}}><RefreshCw size={20}/></button><button className="icon-button" aria-label={l('Close','Закрыть')} onClick={()=>{setOpen(false);setDetail(null);}}><X size={20}/></button></header>{!detail&&<div className="task-inbox-tools" aria-label={l('Inbox filter','Фильтр')}>{(['all','processes','notifications'] as const).map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='all'?l('All','Всё'):value==='processes'?l('Processes','Процессы'):l('Notifications','Уведомления')}</button>)}</div>}<div className="task-inbox-scroll">{!detail&&filter!=='notifications'&&activity&&onOpenActivity&&<ActivityList feed={activity} busy={busy} onOpen={item=>{setOpen(false);onOpenActivity(item);}}/>}{filter!=='processes'&&error&&<p role="alert">{error}</p>}
 {detail?<article className="board-notification-detail"><button onClick={()=>setDetail(null)}>{l('Back to notifications','К уведомлениям')}</button><h3>{detail.title}</h3><p>{detail.description}</p></article>:filter!=='processes'&&<>{filter==='all'&&items.length>0&&<h3>{l('Notifications','\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f')}</h3>}{filter==='notifications'&&!items.length&&<p>{l('No assignments or clarification requests yet.','Пока нет назначений и вопросов.')}</p>}<ul>{items.map(item=><li key={item.id}><button className={'task-inbox-item'+(!item.readAt?' unread':'')} onClick={()=>void read(item)}><span className={'board-notice-icon '+item.kind} aria-hidden="true">{item.kind==='question'?<MessageCircle size={20}/>:<UserPlus size={20}/>}</span><span className="board-notice-body"><small>{item.kind==='assigned'?l('You were assigned a task','Вам назначена задача'):l('Clarification requested','Нужно уточнение')}</small><strong>{item.title}</strong>{item.message&&<span>{item.message}</span>}<time>{new Date(item.at).toLocaleString(ru?'ru':'en')}</time></span>{item.readAt?<Check size={16}/>:<ChevronRight size={16}/>}</button></li>)}</ul></>}
 </div></section></div>,document.body)}
 </div>;
}
