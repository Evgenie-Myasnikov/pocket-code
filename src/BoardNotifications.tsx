import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,X,MessageCircle,UserPlus,ChevronRight,LoaderCircle,RefreshCw,TriangleAlert} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {useModal} from './navigation';
import type {BoardNotice} from '../server/board-attention';
import type {ProjectBoard} from '../server/boards';
import './task-notifications.css';
import './board-notifications.css';
import {ActivityList,type ActivityFeed,type ActivityFilter} from './ActivityList';
import type {ActivityItem} from '../server/types';
import {relativeTime,fullTime} from './run-status';
import './notification-center.css';

export type BoardNoticeTarget={board:ProjectBoard;connection:Connection;noteId:string;message:string;requestId:number};
export type BoardNoticeFeed=ReturnType<typeof useBoardNotices>;
type InboxFilter=ActivityFilter|'all'|'board';

/** The single app-level source of board notices: one poll, one unread count for every bell. */
export function useBoardNotices(connection:Connection|null){
  const identity=JSON.stringify([connection?.url,connection?.token]),identityRef=useRef(identity);identityRef.current=identity;
  const [state,setState]=useState<{identity:string;items:BoardNotice[];error:string;loaded:boolean;refreshing:boolean;updatedAt:number}>({identity:'',items:[],error:'',loaded:false,refreshing:false,updatedAt:0});
  const run=useRef<(manual:boolean)=>void>(()=>{});
  useEffect(()=>{if(!connection){run.current=()=>{};return;}let stopped=false,pending=false,timer:ReturnType<typeof setTimeout>;
    const poll=async(manual:boolean)=>{if(stopped||pending)return;pending=true;clearTimeout(timer);if(manual)setState(old=>old.identity===identity?{...old,refreshing:true}:old);
      try{const result=await request<{items:BoardNotice[]}>(connection,'/board-notifications');if(!Array.isArray(result?.items))throw Error('Unsupported inbox response');
        if(!stopped&&identityRef.current===identity)setState(old=>old.identity===identity&&!old.error&&!old.refreshing&&JSON.stringify(old.items)===JSON.stringify(result.items)?old:{identity,items:result.items,error:'',loaded:true,refreshing:false,updatedAt:Date.now()});}
      catch{if(!stopped&&identityRef.current===identity)setState(old=>({...(old.identity===identity?old:{items:[],updatedAt:0}),identity,loaded:true,refreshing:false,error:'Уведомления недоступны. Проверьте подключение.'}));}
      finally{pending=false;if(!stopped)timer=setTimeout(()=>void poll(false),10000);}};
    run.current=manual=>void poll(manual);void poll(false);return()=>{stopped=true;clearTimeout(timer);run.current=()=>{};};
  },[identity]);
  const current=state.identity===identity?state:null,items=current?.items||[];
  const markRead=useCallback(async(ids:string[])=>{if(!connection||!ids.length)return;await request(connection,'/board-notifications/read',{ids:ids.slice(0,200)});if(identityRef.current===identity)setState(old=>old.identity===identity?{...old,items:old.items.map(n=>ids.includes(n.id)&&!n.readAt?{...n,readAt:Date.now()}:n)}:old);},[connection,identity]);
  return{connection,items,unread:items.filter(n=>!n.readAt).length,error:current?.error||'',loading:Boolean(connection)&&!current?.loaded,refreshing:Boolean(current?.refreshing),updatedAt:current?.updatedAt||0,refresh:()=>run.current(true),markRead};
}

/** Every bell only opens the shared inbox. The number counts what needs the person; work in progress is a ring and unseen results a dot. */
export function InboxButton({notices,activity,open,onOpen,variant='icon'}:{notices:BoardNoticeFeed;activity?:ActivityFeed;open:boolean;onOpen():void;variant?:'icon'|'rail'|'tab'}){
  useLanguage();
  const attention=(activity?.attention||0)+notices.unread,running=activity?.running||0,unseen=activity?.unseen||0,danger=Boolean(activity?.items.some(item=>item.status==='error'));
  const parts=[attention?t('Ждут вас: {0}',attention):'',running?t('Работают: {0}',running):'',unseen?t('Готово: {0}',unseen):''].filter(Boolean).join(', ');
  // The bottom bar keeps its four places; without a PC the inbox stays visible but disabled.
  if(!notices.connection&&variant!=='tab')return null;
  return <div className="board-notifications"><button disabled={!notices.connection} className={'board-notifications-trigger inbox-trigger-'+variant+(running?' inbox-running':'')} aria-label={t('Входящие')} aria-description={parts||undefined} title={parts?t('Входящие')+' · '+parts:t('Входящие')} aria-haspopup="dialog" aria-expanded={open} aria-current={open&&variant!=='icon'?'page':undefined} onClick={onOpen}>
    <span className="inbox-bell"><Bell size={24} aria-hidden="true"/>{attention>0?<b className={danger?'inbox-badge-danger':undefined}>{attention>99?'99+':attention}</b>:unseen>0?<i className="inbox-unseen-dot" aria-hidden="true"/>:null}</span><span className="inbox-label">{t('Входящие')}</span></button></div>;
}

export function NotificationInbox({open,onClose,notices,activity,onOpenActivity,onOpenNotice,busy}:{open:boolean;onClose():void;notices:BoardNoticeFeed;activity?:ActivityFeed;onOpenActivity?:(item:ActivityItem)=>void;onOpenNotice?:(target:BoardNoticeTarget)=>void;busy?:boolean}){
  useLanguage();
  const connection=notices.connection;
  const [filter,setFilter]=useState<InboxFilter>('all'),[opening,setOpening]=useState(''),[error,setError]=useState(''),[reply,setReply]=useState<BoardNotice|null>(null),[answer,setAnswer]=useState(''),[sending,setSending]=useState(false),[undo,setUndo]=useState<{label:string;restore():void}|null>(null);
  const modal=useRef<HTMLElement|null>(null),scroller=useRef<HTMLDivElement|null>(null),epoch=useRef(0);
  const close=()=>{setReply(null);onClose();};
  useModal(modal,open,()=>{if(reply){setReply(null);return;}close();});
  // Each opening starts on All with fresh state; a remembered filter could hide the item behind the badge.
  useEffect(()=>{epoch.current++;if(open){setFilter('all');setError('');setOpening('');setReply(null);setUndo(null);}},[open,connection]);
  useEffect(()=>{scroller.current?.scrollTo?.({top:0});},[filter,reply]);
  useEffect(()=>{if(!undo)return;const timer=setTimeout(()=>setUndo(null),6000);return()=>clearTimeout(timer);},[undo]);
  if(!open||!connection)return null;
  async function read(item:BoardNotice){
    if(opening||!connection)return;
    if(item.kind==='question'){setReply(item);setAnswer('');setError('');return;}
    const generation=epoch.current;setOpening(item.id);setError('');
    try{const board=await request<ProjectBoard>(connection,'/boards/'+item.boardId),note=board.notes.find(n=>n.id===item.noteId);if(!note)throw Error('Missing note');if(generation!==epoch.current)return;
      onOpenNotice?.({board,connection,noteId:note.id,message:item.message,requestId:Date.now()});close();await notices.markRead([item.id]);}
    catch{if(generation===epoch.current)setError('Не удалось открыть задачу. Возможно, она удалена.');}
    finally{if(generation===epoch.current)setOpening('');}
  }
  async function openCard(item:BoardNotice){
    const generation=epoch.current;setOpening(item.id);setError('');
    try{const board=await request<ProjectBoard>(connection!,'/boards/'+item.boardId),note=board.notes.find(n=>n.id===item.noteId);if(!note)throw Error('Missing note');if(generation!==epoch.current)return;onOpenNotice?.({board,connection:connection!,noteId:note.id,message:item.message,requestId:Date.now()});close();}
    catch{if(generation===epoch.current)setError('Не удалось открыть задачу. Возможно, она удалена.');}
    finally{if(generation===epoch.current)setOpening('');}
  }
  // The answer is written into the card and the card returns to Ready, so the next agent run sees it.
  async function sendAnswer(item:BoardNotice){
    const text=answer.trim();if(!text||sending)return;const generation=epoch.current;setSending(true);setError('');
    try{const board=await request<ProjectBoard>(connection!,'/boards/'+item.boardId),note=board.notes.find(n=>n.id===item.noteId);if(!note)throw Error('Missing note');
      await request(connection!,'/boards/'+board.id,{revision:board.revision,versions:board.versions,notes:board.notes.map(n=>n.id===note.id?{...n,description:[n.description.trim(),t('Ответ: {0}',text)].filter(Boolean).join('\n\n'),status:n.status==='questions'?'ready':n.status}:n)});
      // The answer is already on the card: a failed read mark must not invite a retry that appends it twice.
      await notices.markRead([item.id]).catch(()=>{});if(generation===epoch.current){setReply(null);setAnswer('');setUndo(null);}}
    catch{if(generation===epoch.current)setError('Не удалось отправить ответ. Проверьте подключение и повторите.');}
    finally{if(generation===epoch.current)setSending(false);}
  }
  async function hide(item:BoardNotice){try{await notices.markRead([item.id]);setReply(null);}catch{setError('Не удалось обновить уведомление.');}}
  async function readAll(){const ids=notices.items.filter(n=>!n.readAt).map(n=>n.id);try{await notices.markRead(ids);}catch{setError('Не удалось обновить уведомление.');}}
  function clearFinished(){if(!activity)return;const finished=activity.items.filter(item=>item.status==='done'||item.status==='stopped');if(!finished.length)return;const before=activity.markAllViewed(finished);setUndo({label:t('Готовые скрыты: {0}',finished.length),restore:()=>{activity.restoreSeen(before);setUndo(null);}});}
  const counts={all:(activity?.items.length||0)+notices.items.length,attention:activity?.attention||0,running:activity?.running||0,done:activity?.unseen||0,board:notices.unread};
  const chips:[InboxFilter,string][]=[['all','Все'],['attention','Ждут вас'],['running','Работают'],['done','Готово'],['board','Доска']];
  const syncError=notices.error||activity?.error,updatedAt=Math.max(notices.updatedAt,activity?.updatedAt||0),refreshing=notices.refreshing||Boolean(activity?.refreshing);
  const visibleNotices=filter==='all'||filter==='board'?notices.items:[];
  return createPortal(<div className="task-inbox-backdrop board-notifications-inbox" onClick={event=>{if(event.target===event.currentTarget)close();}}><section className="task-inbox notification-center" role="dialog" aria-modal="true" aria-label={t('Входящие')} ref={modal}>
    <header><h2>{reply?t('Ответить на вопрос'):t('Входящие')}</h2><button className={'icon-button'+(refreshing?' inbox-refreshing':'')} aria-label={t('Обновить')} aria-busy={refreshing} disabled={refreshing} onClick={()=>{activity?.refresh();notices.refresh();}}><RefreshCw size={20}/></button><button className="icon-button" aria-label={t('Закрыть')} onClick={close}><X size={20}/></button></header>
    {!reply&&<div className="task-inbox-tools" role="group" aria-label={t('Фильтр входящих')}>{chips.map(([value,name])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{t(name)}<span className="inbox-chip-count">{counts[value]}</span></button>)}</div>}
    <div className="task-inbox-scroll" ref={scroller}>
      {syncError&&!reply&&<div className="inbox-sync-error" role="status"><TriangleAlert size={20} aria-hidden="true"/><div><p>{t(syncError)}</p>{updatedAt>0&&<p className="muted">{t('Обновлено {0}',relativeTime(updatedAt))}</p>}</div><button className="secondary" disabled={refreshing} onClick={()=>{activity?.refresh();notices.refresh();}}>{t('Повторить')}</button></div>}
      {error&&<p className="inbox-error" role="alert">{t(error)}</p>}
      {reply?<article className="board-notification-reply"><p className="muted">{t('Нужно уточнение')} · <time title={fullTime(reply.at)}>{relativeTime(reply.at)}</time></p><h3>{reply.title}</h3>{reply.message&&<blockquote>{reply.message}</blockquote>}
        <label>{t('Ваш ответ')}<textarea value={answer} rows={4} disabled={sending} onChange={event=>setAnswer(event.target.value)}/></label>
        <div className="board-reply-actions"><button className="primary" disabled={sending||!answer.trim()} aria-busy={sending} onClick={()=>void sendAnswer(reply)}>{sending&&<LoaderCircle size={16} className="inbox-spin"/>}{t('Отправить ответ')}</button><button className="secondary" disabled={sending||Boolean(opening)} onClick={()=>void openCard(reply)}>{t('Открыть карточку')}</button>{!reply.readAt&&<button className="text-button" disabled={sending} onClick={()=>void hide(reply)}>{t('Скрыть')}</button>}<button className="text-button" disabled={sending} onClick={()=>setReply(null)}>{t('Назад')}</button></div></article>
      :<>{filter!=='board'&&activity&&onOpenActivity&&<ActivityList feed={activity} busy={busy||Boolean(opening)} filter={filter==='all'?undefined:filter} onOpen={item=>{close();onOpenActivity(item);}} onClearFinished={clearFinished}/>}
        {visibleNotices.length>0&&<section className="inbox-board"><h3>{t('Доска')}<span>{notices.items.length}</span>{notices.unread>0&&<button className="text-button" onClick={()=>void readAll()}>{t('Прочитать всё')}</button>}</h3><ul>{visibleNotices.map(item=><li key={item.id}><button className={'task-inbox-item inbox-notice-row'+(!item.readAt?' unread':'')} disabled={Boolean(opening)&&opening!==item.id} aria-busy={opening===item.id} onClick={()=>void read(item)}>
          <span className={'board-notice-icon '+item.kind} aria-hidden="true">{opening===item.id?<LoaderCircle size={20} className="inbox-spin"/>:item.kind==='question'?<MessageCircle size={20}/>:<UserPlus size={20}/>}</span>
          <span className="board-notice-body"><strong>{item.title}</strong><small>{item.kind==='assigned'?t('Вам назначена задача'):t('Нужно уточнение')} · <time title={fullTime(item.at)}>{relativeTime(item.at)}</time></small>{item.message&&<span>{item.message}</span>}</span>
          {!item.readAt&&<i className="inbox-unread-dot"><span className="visually-hidden">{t('Не прочитано')}</span></i>}<ChevronRight size={16} aria-hidden="true"/></button></li>)}</ul></section>}
        {filter==='board'&&!notices.items.length&&!notices.error&&<p className="muted">{t('Пока нет назначений и вопросов.')}</p>}</>}
    </div>
    {undo&&<div className="inbox-snackbar" role="status"><span>{undo.label}</span><button className="text-button" onClick={undo.restore}>{t('Отменить')}</button></div>}
  </section></div>,document.body);
}
