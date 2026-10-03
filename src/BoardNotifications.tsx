import {useEffect,useRef,useState} from 'react';
import {Bell,Check,X} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import type {BoardNotice} from '../server/board-attention';
import type {ProjectBoard} from '../server/boards';
import './task-notifications.css';
import './board-notifications.css';

export function BoardNotifications({connection}:{connection:Connection|null}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [items,setItems]=useState<BoardNotice[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(''),[detail,setDetail]=useState<{title:string;description:string}|null>(null);
 const modal=useRef<HTMLElement|null>(null),epoch=useRef(0);useModal(modal,open,()=>{setOpen(false);setDetail(null);});
 useEffect(()=>{const generation=++epoch.current;setItems([]);setDetail(null);setOpen(false);setError('');if(!connection)return;let stopped=false,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const result=await request<{items:BoardNotice[]}>(connection,'/board-notifications');if(!Array.isArray(result?.items))throw Error('Unsupported inbox response');if(!stopped){setItems(result.items);setError('');}}catch{if(!stopped)setError(l('Notifications unavailable. Retry when connected.','Уведомления недоступны. Проверьте подключение.'));}finally{if(!stopped&&generation===epoch.current)timer=setTimeout(poll,10000);}};
  void poll();return()=>{stopped=true;clearTimeout(timer);};
 },[connection?.url,connection?.token,ru]);
 async function read(item:BoardNotice){if(!connection)return;const generation=epoch.current;try{const board=await request<ProjectBoard>(connection,'/boards/'+item.boardId),note=board.notes.find(n=>n.id===item.noteId);if(!note)throw Error('Missing note');if(generation!==epoch.current)return;setDetail({title:note.title,description:item.kind==='question'?item.message:note.description});await request(connection,'/board-notifications/read',{ids:[item.id]});if(generation===epoch.current)setItems(old=>old.map(n=>n.id===item.id?{...n,readAt:Date.now()}:n));}catch{if(generation===epoch.current)setError(l('Could not open the task. It may have been removed.','Не удалось открыть задачу. Возможно, она удалена.'));}}
 const unread=items.filter(n=>!n.readAt).length;
 if(!connection)return null;
 return <div className="board-notifications"><button className="board-notifications-trigger" aria-label={l('Board notifications','Уведомления досок')} onClick={()=>setOpen(true)}><Bell size={18}/><span>{l('Notifications','Уведомления')}</span>{unread>0&&<b>{unread>99?'99+':unread}</b>}</button>
 {open&&<div className="task-inbox-backdrop" onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}><section className="task-inbox" role="dialog" aria-modal="true" aria-label={l('Board notifications','Уведомления досок')} ref={modal}><header><h2>{l('Notifications','Уведомления')}</h2><button className="icon-button" aria-label={l('Close','Закрыть')} onClick={()=>{setOpen(false);setDetail(null);}}><X size={20}/></button></header><div className="task-inbox-scroll">{error&&<p role="alert">{error}</p>}
 {detail?<article className="board-notification-detail"><button onClick={()=>setDetail(null)}>{l('Back to notifications','К уведомлениям')}</button><h3>{detail.title}</h3><p>{detail.description}</p></article>:<>{!items.length&&<p>{l('No assignments or clarification requests yet.','Пока нет назначений и вопросов.')}</p>}<ul>{items.map(item=><li key={item.id}><button className={'task-inbox-item'+(!item.readAt?' unread':'')} onClick={()=>void read(item)}><span><small>{item.kind==='assigned'?l('You were assigned a task','Вам назначена задача'):l('Clarification requested','Нужно уточнение')}</small><strong>{item.title}</strong>{item.message&&<span>{item.message}</span>}<time>{new Date(item.at).toLocaleString(ru?'ru':'en')}</time></span>{item.readAt&&<Check size={16}/>}</button></li>)}</ul></>}
 </div></section></div>}
 </div>;
}
