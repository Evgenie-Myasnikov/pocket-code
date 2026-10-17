import {ArrowLeft,Eye,GitCompareArrows,PanelsTopLeft,GitBranch,Users,Ellipsis,ArrowUpToLine,Check} from 'lucide-react';
import {t} from './i18n';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {DetailMode} from './activity-groups';
import {RunStatusDot,type RunStatus} from './run-status';
import './chat-header.css';

type Props={title:string;project:string;provider:string;branch?:string;notifications?:ReactNode;status?:{value:RunStatus;label:string};context?:ReactNode;onBack():void;review?:{disabled:boolean;open():void};outputs?:{disabled:boolean;open():void};subagents?:{count:number;running:number;disabled:boolean;open():void};reading?:{disabled:boolean;open():void};top?:{disabled:boolean;open():void};detail?:{value:DetailMode;set(value:DetailMode):void}};
/** One conversation header: Back (with the state of other chats), the title as h1, a subtitle that picks provider and project in a new chat, and only applicable, labelled actions. */
/** Rare conversation actions: jump to the beginning and brief or detailed activity. Fixed position, so the header band never clips it. */
function ChatMenu({top,detail}:{top?:Props['top'];detail?:Props['detail']}){
  const [place,setPlace]=useState<{top:number;right:number}|null>(null),button=useRef<HTMLButtonElement|null>(null),menu=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(!place)return;menu.current?.querySelector<HTMLElement>('[role^=menuitem]:not(:disabled)')?.focus();
    const close=(event:Event)=>{if(event instanceof KeyboardEvent){
      // A menu moves with the arrow keys; Tab leaves it closed.
      if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){const items=[...menu.current?.querySelectorAll<HTMLElement>('[role^=menuitem]:not(:disabled)')||[]];if(!items.length)return;event.preventDefault();const index=items.indexOf(document.activeElement as HTMLElement),next=event.key==='Home'?0:event.key==='End'||index<0&&event.key==='ArrowUp'?items.length-1:index<0?0:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next].focus();return;}
      if(event.key==='Tab'){setPlace(null);return;}
      if(event.key!=='Escape')return;event.stopPropagation();event.preventDefault();button.current?.focus();}else if(menu.current?.contains(event.target as Node)||button.current?.contains(event.target as Node))return;setPlace(null);};
    document.addEventListener('pointerdown',close,true);document.addEventListener('keydown',close,true);return()=>{document.removeEventListener('pointerdown',close,true);document.removeEventListener('keydown',close,true);};},[place]);
  const toggle=()=>{if(place){setPlace(null);return;}const rect=button.current!.getBoundingClientRect();setPlace({top:rect.bottom+4,right:Math.max(8,window.innerWidth-rect.right)});};
  const run=(action:()=>void)=>{setPlace(null);action();};
  return <><button ref={button} className="chat-menu-button" aria-label={t('Ещё действия')} title={t('Ещё действия')} aria-haspopup="menu" aria-expanded={Boolean(place)} onClick={toggle}><Ellipsis size={19}/></button>
    {place&&<div ref={menu} className="chat-menu" role="menu" aria-label={t('Ещё действия')} style={{top:place.top,right:place.right}}>
      {top&&<button role="menuitem" disabled={top.disabled} onClick={()=>run(top.open)}><ArrowUpToLine size={17} aria-hidden="true"/>{t('В начало чата')}</button>}
      {detail&&<div role="group" aria-label={t('Детализация ленты')}>{(['brief','detailed'] as const).map(value=><button key={value} role="menuitemradio" aria-checked={detail.value===value} onClick={()=>run(()=>detail.set(value))}><Check size={17} aria-hidden="true" style={{visibility:detail.value===value?'visible':'hidden'}}/>{t(value==='brief'?'Кратко':'Подробно')}</button>)}</div>}
    </div>}</>;
}
export function ChatHeader({title,project,provider,branch,notifications,status,context,onBack,review,outputs,subagents,reading,top,detail}:Props){
  const agentsLabel=subagents?t('Субагенты · {0}',subagents.count)+(subagents.running?' · '+t('Работают: {0}',subagents.running):''):'';
  return <header className="chat-header chat-header-conversation" data-section="chats">
    <div className="chat-header-main"><button className="icon-button mobile-back" aria-label={t('К списку чатов')} aria-description={status?.label} title={status?.label} onClick={onBack}><span className="chat-tab-icon"><ArrowLeft size={21}/>{status&&<RunStatusDot status={status.value} className={'chat-tab-status chat-tab-status-'+status.value}/>}</span></button>
      <div className="header-title"><h1 title={title}>{top?<button className="chat-title-button" disabled={top.disabled} aria-description={t('Перейти в начало чата')} onClick={top.open}>{title}</button>:title}</h1>{context?<div className="chat-context chat-context-picker">{context}</div>:<div className="chat-context" title={[provider,project,branch].filter(Boolean).join(' · ')}><span className="chat-context-provider">{provider}</span>{project&&<><span aria-hidden="true">·</span><span className="chat-context-project">{project}</span></>}{branch&&<span className="chat-context-branch"><GitBranch size={12}/><span>{branch}</span></span>}</div>}</div>
      {notifications}
    </div>
    {(review||outputs||subagents?.count||reading||top||detail)&&<div className="chat-header-actions" role="group" aria-label={t('Действия чата')}>
      {review&&<button className="review-button" aria-label="Review" title="Review" disabled={review.disabled} onClick={review.open}><GitCompareArrows size={19}/><span>Review</span></button>}
      {outputs&&<button className="outputs-entry" aria-label={t('Результаты')} title={t('Результаты')} disabled={outputs.disabled} onClick={outputs.open}><PanelsTopLeft size={19}/><span>{t('Результаты')}</span></button>}
      {!!subagents?.count&&<button className="subagents-entry" aria-label={agentsLabel} title={agentsLabel} disabled={subagents.disabled} onClick={subagents.open}><Users size={19}/><span>{t('Субагенты · {0}',subagents.count)}</span><small className="header-agent-count" aria-hidden="true">{subagents.count}</small></button>}
      {reading&&<button className="reading-entry" aria-label={t('Режим чтения')} title={t('Режим чтения')} disabled={reading.disabled} onClick={reading.open}><Eye size={19}/><span>{t('Чтение')}</span></button>}
      {(top||detail)&&<ChatMenu top={top} detail={detail}/>}
    </div>}
  </header>;
}
