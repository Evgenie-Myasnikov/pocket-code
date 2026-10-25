import {createPortal} from 'react-dom';
import {plural} from './plural';
import {ArrowLeft,MessageSquarePlus,Eye,GitCompareArrows,PanelsTopLeft,GitBranch,Users,Ellipsis,ArrowUpToLine,Check} from 'lucide-react';
import {t} from './i18n';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {DetailMode} from './activity-groups';
import {RunStatusDot,type RunStatus} from './run-status';
import './chat-header.css';

type Props={newBoardChat?:{disabled:boolean;open():void};unread?:number;title:string;project:string;provider:string;branch?:string;notifications?:ReactNode;status?:{value:RunStatus;label:string};context?:ReactNode;onBack():void;review?:{disabled:boolean;open():void;stats?:{added:number;removed:number;files:number}};outputs?:{disabled:boolean;open():void};subagents?:{count:number;running:number;disabled:boolean;open():void};reading?:{disabled:boolean;open():void};top?:{disabled:boolean;open():void};detail?:{value:DetailMode;set(value:DetailMode):void}};
/** One conversation header: Back (with the state of other chats), the title as h1, a subtitle that picks provider and project in a new chat, and only applicable, labelled actions. */
/** Rare conversation actions: jump to the beginning and brief or detailed activity. Fixed position, so the header band never clips it. */
function ChatMenu({top,detail,reading,notifications,unread=0,review,outputs,subagents,branch,newBoardChat}:Pick<Props,'top'|'detail'|'reading'|'notifications'|'unread'|'review'|'outputs'|'subagents'|'branch'|'newBoardChat'>){
  const agentsLabel=subagents?t('Субагенты · {0}',subagents.count)+(subagents.running?' · '+t('Работают: {0}',subagents.running):''):'';
  const [place,setPlace]=useState<{top:number;right:number}|null>(null),button=useRef<HTMLButtonElement|null>(null),menu=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(!place)return;menu.current?.querySelector<HTMLElement>('[role^=menuitem]:not(:disabled)')?.focus();
    const close=(event:Event)=>{if(event instanceof KeyboardEvent){
      // A menu moves with the arrow keys; Tab leaves it closed.
      if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){const items=[...menu.current?.querySelectorAll<HTMLElement>('[role^=menuitem]:not(:disabled)')||[]];if(!items.length)return;event.preventDefault();const index=items.indexOf(document.activeElement as HTMLElement),next=event.key==='Home'?0:event.key==='End'||index<0&&event.key==='ArrowUp'?items.length-1:index<0?0:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next].focus();return;}
      if(event.key==='Tab'){setPlace(null);return;}
      if(event.key!=='Escape')return;event.stopPropagation();event.preventDefault();button.current?.focus();}else if(menu.current?.contains(event.target as Node)||button.current?.contains(event.target as Node))return;setPlace(null);};
    document.addEventListener('pointerdown',close,true);document.addEventListener('keydown',close,true);return()=>{document.removeEventListener('pointerdown',close,true);document.removeEventListener('keydown',close,true);};},[place]);
  const toggle=()=>{if(place){setPlace(null);return;}const rect=button.current!.getBoundingClientRect();setPlace({top:rect.bottom+4,right:Math.max(8,window.innerWidth-rect.right)});};
  const run=(action:()=>void)=>{button.current?.focus({preventScroll:true});setPlace(null);action();};
  return <><button ref={button} className="chat-menu-button" aria-label={t('Ещё действия')} title={t('Ещё действия')} aria-description={unread?t('Ждут вас: {0}',unread):undefined} aria-haspopup="menu" aria-expanded={Boolean(place)} onClick={toggle}><Ellipsis size={20}/>{unread>0&&<small className="chat-menu-badge" aria-hidden="true">{unread>99?'99+':unread}</small>}</button>
    {place&&createPortal(<div ref={menu} className="chat-menu" role="menu" aria-label={t('Ещё действия')} style={{top:place.top,right:place.right,maxHeight:Math.max(80,window.innerHeight-place.top-8),overflowY:'auto'}}>
      {newBoardChat&&<button role="menuitem" disabled={newBoardChat.disabled} onClick={()=>run(newBoardChat.open)}><MessageSquarePlus size={16} aria-hidden="true"/>{t('Новый чат доски')}</button>}
      {review&&<button className="review-button" role="menuitem" aria-label="Review" aria-description={review.stats?t('Изменено')+' '+plural(review.stats.files,['{0} файл','{0} файла','{0} файлов'])+` · +${review.stats.added} −${review.stats.removed}`:undefined} aria-keyshortcuts="Control+Shift+D" title={review.stats?`Review · ${plural(review.stats.files,['{0} файл','{0} файла','{0} файлов'])} · +${review.stats.added} −${review.stats.removed}`:'Review'} disabled={review.disabled} onClick={()=>run(review.open)}><GitCompareArrows size={20}/><span>Review</span>{review.stats&&(review.stats.added||review.stats.removed)?<span className="review-button-stats" aria-hidden="true"><b>+{review.stats.added}</b> <i>−{review.stats.removed}</i></span>:review.stats?.files?<span className="review-button-stats" aria-hidden="true">{review.stats.files}</span>:null}</button>}
      {outputs&&<button className="outputs-entry" role="menuitem" aria-label={t('Результаты')} title={t('Результаты')} disabled={outputs.disabled} onClick={()=>run(outputs.open)}><PanelsTopLeft size={20}/><span>{t('Результаты')}</span></button>}
      {!!subagents?.count&&<button className="subagents-entry" role="menuitem" aria-label={agentsLabel} title={agentsLabel} disabled={subagents.disabled} onClick={()=>run(subagents.open)}><Users size={20}/><span>{t('Субагенты · {0}',subagents.count)}</span></button>}
      {branch&&<div className="chat-menu-branch"><GitBranch size={16} aria-hidden="true"/><span>{branch}</span></div>}
      {notifications&&<div className="chat-menu-inbox" onClick={()=>{button.current?.focus({preventScroll:true});setPlace(null);}}>{notifications}</div>}
      {reading&&<button className="reading-entry" role="menuitem" disabled={reading.disabled} onClick={()=>run(reading.open)}><Eye size={16} aria-hidden="true"/>{t('Режим чтения')}</button>}
      {top&&<button role="menuitem" disabled={top.disabled} onClick={()=>run(top.open)}><ArrowUpToLine size={16} aria-hidden="true"/>{t('В начало чата')}</button>}
      {detail&&<div role="group" aria-label={t('Детализация ленты')}>{(['brief','detailed'] as const).map(value=><button key={value} role="menuitemradio" aria-checked={detail.value===value} onClick={()=>run(()=>detail.set(value))}><Check size={16} aria-hidden="true" style={{visibility:detail.value===value?'visible':'hidden'}}/>{t(value==='brief'?'Кратко':'Подробно')}</button>)}</div>}
    </div>,document.body)}</>;
}
export function ChatHeader({newBoardChat,unread,title,project,provider,branch,notifications,status,context,onBack,review,outputs,subagents,reading,top,detail}:Props){
  return <header className="chat-header chat-header-conversation" data-section="chats">
    <div className="chat-header-main"><button className="icon-button mobile-back" aria-label={t('К списку чатов')} aria-description={status?.label} title={status?.label} onClick={onBack}><span className="chat-tab-icon"><ArrowLeft size={20}/>{status&&<RunStatusDot status={status.value} className={'chat-tab-status chat-tab-status-'+status.value}/>}</span></button>
      <div className="header-title"><h1 title={title}>{top?<button className="chat-title-button" disabled={top.disabled} aria-description={t('Перейти в начало чата')} onClick={top.open}>{title}</button>:title}</h1>{context?<div className="chat-context chat-context-picker">{context}</div>:<div className="chat-context" title={[provider,project,branch].filter(Boolean).join(' · ')}><span className="chat-context-provider">{provider}</span>{project&&<><span aria-hidden="true">·</span><span className="chat-context-project">{project}</span></>}</div>}</div>
    </div>
    {(review||outputs||subagents?.count||reading||top||detail||notifications||branch||newBoardChat)&&<div className="chat-header-actions" role="group" aria-label={t('Действия чата')}>
      <ChatMenu top={top} detail={detail} reading={reading} notifications={notifications} unread={unread} review={review} outputs={outputs} subagents={subagents} branch={branch} newBoardChat={newBoardChat}/>
    </div>}
  </header>;
}
