import {MoreHorizontal} from 'lucide-react';
import {useRef} from 'react';
import {useUiPress} from './ui-motion';
import {useLanguage} from './i18n';
import type {Session} from './session';
import type {ChatActionTarget} from './ChatActions';
import './chat-list-actions.css';

/** A separate control keeps opening a conversation distinct from managing it. */
export function ChatListActions({session,running,disabled,open,row,onOpen,onClose}:{session:Session;running?:boolean;disabled?:boolean;open:boolean;row?:number;onOpen(target:ChatActionTarget):void;onClose():void}){
 const button=useRef<HTMLButtonElement>(null);useUiPress(button);
 const ru=useLanguage()==='ru',title=session.customTitle||session.summary||(ru?'Без названия':'Untitled chat');
 const label=ru?'Действия чата':'Chat actions';
 return <span className="chat-list-action-slot" style={row?{gridRow:row}:undefined}>
  <button ref={button} type="button" className="chat-list-action" aria-label={label} aria-description={title} title={label+' · '+title} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onPointerDown={event=>{if(open)event.stopPropagation();}} onClick={event=>{event.currentTarget.focus({preventScroll:true});if(open){onClose();return;}const rect=event.currentTarget.getBoundingClientRect();onOpen({session,running,x:rect.right-240,y:rect.bottom+4});}}><MoreHorizontal size={18} aria-hidden="true"/></button>
 </span>;
}
