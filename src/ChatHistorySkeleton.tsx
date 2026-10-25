import {t} from './i18n';
import './chat-motion.css';
export function ChatHistorySkeleton(){return <div className="chat-history-skeleton" role="status" aria-label={t('Загружаем историю с ПК…')}><span className="sr-only">{t('Загружаем историю с ПК…')}</span>{[false,true,false].map((user,index)=><div key={index} className={'chat-skeleton-message'+(user?' chat-skeleton-user':'')} aria-hidden="true"><i/><div><b/><b/><b/></div></div>)}</div>;}
