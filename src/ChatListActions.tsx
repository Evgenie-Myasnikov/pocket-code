import {Bell,BellOff,MoreHorizontal} from 'lucide-react';
import {useRef} from 'react';
import {useUiPress} from './ui-motion';
import {useLanguage} from './i18n';
import type {Session} from './session';
import type {Connection} from './api';
import {useChatMute} from './chat-mute';
import type {ChatActionTarget} from './ChatActions';
import './chat-list-actions.css';

/** A separate control keeps opening a conversation distinct from managing it. */
export function ChatListActions({session,connection,provider,jobId,running,disabled,open,row,onOpen,onClose}:{session:Session;connection:Connection|null;provider:string;jobId?:string;running?:boolean;disabled?:boolean;open:boolean;row?:number;onOpen(target:ChatActionTarget):void;onClose():void}){
 const button=useRef<HTMLButtonElement>(null),bell=useRef<HTMLButtonElement>(null);useUiPress(button);useUiPress(bell);
 const {muted,toggle}=useChatMute(connection,session.provider||provider,session.sessionId,jobId);
 const ru=useLanguage()==='ru',title=session.customTitle||session.summary||(ru?'Без названия':'Untitled chat');
 const label=ru?'Действия чата':'Chat actions';
 const action=muted?(ru?'Включить уведомления':'Unmute notifications'):(ru?'Отключить уведомления':'Mute notifications');
 const BellIcon=muted?BellOff:Bell;
 return <span className="chat-list-action-slot" style={row?{gridRow:row}:undefined}>
  <button ref={bell} type="button" className="chat-mute-action" aria-label={ru?'Уведомления чата':'Chat notifications'} aria-pressed={!muted} aria-description={title} title={action+' · '+title} disabled={!connection} onClick={toggle}><BellIcon size={16} aria-hidden="true"/></button>
  <button ref={button} type="button" className="chat-list-action" aria-label={label} aria-description={title} title={label+' · '+title} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onPointerDown={event=>{if(open)event.stopPropagation();}} onClick={event=>{event.currentTarget.focus({preventScroll:true});if(open){onClose();return;}const rect=event.currentTarget.getBoundingClientRect();onOpen({session,running,x:rect.right+6,y:rect.top});}}><MoreHorizontal size={18} aria-hidden="true"/></button>
 </span>;
}
