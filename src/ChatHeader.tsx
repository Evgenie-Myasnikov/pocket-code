import {ArrowLeft,Eye,GitCompareArrows,PanelsTopLeft,GitBranch} from 'lucide-react';
import {t} from './i18n';
import './chat-header.css';

type Props={title:string;project:string;provider:string;branch?:string;onBack():void;review?:{disabled:boolean;open():void};outputs?:{disabled:boolean;open():void};reading?:{disabled:boolean;open():void}};
export function ChatHeader({title,project,provider,branch,onBack,review,outputs,reading}:Props){
  return <header className="chat-header chat-header-conversation" data-section="chats">
    <div className="chat-header-main"><button className="icon-button mobile-back" aria-label={t('К списку чатов')} onClick={onBack}><ArrowLeft size={21}/></button>
      <div className="header-title"><strong title={title}>{title}</strong><div className="chat-context" title={[provider,project,branch].filter(Boolean).join(' · ')}><span className="chat-context-provider">{provider}</span>{project&&<><span aria-hidden="true">·</span><span className="chat-context-project">{project}</span></>}{branch&&<span className="chat-context-branch"><GitBranch size={12}/><span>{branch}</span></span>}</div></div>
    </div>
    {(review||outputs||reading)&&<div className="chat-header-actions" role="group" aria-label={t('Действия чата')}>
      {review&&<button className="review-button" aria-label="Review" title="Review" disabled={review.disabled} onClick={review.open}><GitCompareArrows size={19}/><span>Review</span></button>}
      {outputs&&<button className="outputs-entry" aria-label={t('Результаты')} title={t('Результаты')} disabled={outputs.disabled} onClick={outputs.open}><PanelsTopLeft size={19}/><span>{t('Результаты')}</span></button>}
      {reading&&<button className="reading-entry" aria-label={t('Режим чтения')} title={t('Режим чтения')} disabled={reading.disabled} onClick={reading.open}><Eye size={19}/><span>{t('Чтение')}</span></button>}
    </div>}
  </header>;
}
