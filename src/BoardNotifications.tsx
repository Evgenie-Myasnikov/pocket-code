import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,X,TriangleAlert} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {useModal} from './navigation';
import type {BoardNotice} from '../server/board-attention';
import type {ProjectBoard} from '../server/boards';
import './task-notifications.css';
import './board-notifications.css';
import {ActivityList,type ActivityFeed} from './ActivityList';
import type {ActivityItem} from '../server/types';
import {relativeTime,fullTime} from './run-status';
import './notification-center.css';

export type BoardNoticeTarget={board:ProjectBoard;connection:Connection;noteId:string;message:string;requestId:number};
export type BoardNoticeFeed=ReturnType<typeof useBoardNotices>;

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
export function InboxButton({notices,activity,open,onOpen,variant='icon'}:{notices:BoardNoticeFeed;activity?:ActivityFeed;open:boolean;onOpen():void;variant?:'icon'|'rail'|'tab'|'menu'}){
  useLanguage();
  const attention=activity?.attention||0,running=activity?.running||0,unseen=activity?.unseen||0,danger=Boolean(activity?.items.some(item=>item.status==='error'));
  const parts=[attention?t('Ждут вас: {0}',attention):'',running?t('Работают: {0}',running):'',unseen?t('Готово: {0}',unseen):''].filter(Boolean).join(', ');
  // The bottom bar keeps its four places; without a PC the inbox stays visible but disabled.
  if(!notices.connection&&variant!=='tab')return null;
  return <div className="board-notifications"><button role={variant==='menu'?'menuitem':undefined} disabled={!notices.connection} className={'board-notifications-trigger inbox-trigger-'+variant+(running?' inbox-running':'')} aria-label={t('Входящие')} aria-description={parts||undefined} title={parts?t('Входящие')+' · '+parts:t('Входящие')} aria-haspopup="dialog" aria-expanded={open} aria-current={open&&variant!=='icon'?'page':undefined} onClick={onOpen}>
    <span className="inbox-bell"><Bell size={24} aria-hidden="true"/>{attention>0?<b className={danger?'inbox-badge-danger':undefined}>{attention>99?'99+':attention}</b>:unseen>0?<i className="inbox-unseen-dot" aria-hidden="true"/>:null}</span><span className="inbox-label">{t('Входящие')}</span></button></div>;
}

export function NotificationInbox({open,onClose,notices,activity,onOpenActivity,busy}:{open:boolean;onClose():void;notices:BoardNoticeFeed;activity?:ActivityFeed;onOpenActivity?:(item:ActivityItem)=>void;onOpenNotice?:(target:BoardNoticeTarget)=>void;busy?:boolean}){
 useLanguage();
 const modal=useRef<HTMLElement|null>(null),[undo,setUndo]=useState<{label:string;restore():void}|null>(null);
 useModal(modal,open,onClose);
 useEffect(()=>{if(open)setUndo(null);},[open]);
 useEffect(()=>{if(!undo)return;const timer=setTimeout(()=>setUndo(null),6000);return()=>clearTimeout(timer);},[undo]);
 if(!open||!notices.connection)return null;
 function clearFinished(){if(!activity)return;const finished=activity.items.filter(item=>item.status==='done'||item.status==='stopped');if(!finished.length)return;const before=activity.markAllViewed(finished);setUndo({label:t('Готовые скрыты: {0}',finished.length),restore:()=>{activity.restoreSeen(before);setUndo(null);}});}
 return createPortal(<div className="task-inbox-backdrop board-notifications-inbox" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="task-inbox notification-center" role="dialog" aria-modal="true" aria-label={t('Входящие')} ref={modal}>
  <header className="notification-center-controls"><button className="icon-button" aria-label={t('Закрыть')} onClick={onClose}><X size={20}/></button></header>
  <div className="task-inbox-scroll">
   {activity?.error&&<div className="inbox-sync-error" role="status"><TriangleAlert size={20}/><div><p>{t(activity.error)}</p>{activity.updatedAt>0&&<p className="muted">{t('Обновлено {0}',relativeTime(activity.updatedAt))}</p>}</div><button className="secondary" disabled={activity.refreshing} onClick={()=>activity.refresh()}>{t('Повторить')}</button></div>}
   {activity&&onOpenActivity&&<ActivityList connection={notices.connection} feed={activity} busy={busy} onOpen={item=>{onClose();onOpenActivity(item);}} onClearFinished={clearFinished}/>}
  </div>
  {undo&&<div className="inbox-snackbar" role="status"><span>{undo.label}</span><button className="text-button" onClick={undo.restore}>{t('Отменить')}</button></div>}
 </section></div>,document.body);
}
