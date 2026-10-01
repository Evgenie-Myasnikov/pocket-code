import {useId,useRef} from 'react';
import {Check,ChevronRight,LoaderCircle,MessageCircle,RefreshCw,Square,TriangleAlert,X} from 'lucide-react';
import type {ActivityItem} from '../server/types';
import {t,useLanguage} from './i18n';
import {useModal} from './navigation';
import './activity-drawer.css';

export type ActivityDrawerProps={
  items:ActivityItem[];
  loading:boolean;
  error?:string;
  busy?:boolean;
  onRetry:()=>void;
  onOpen:(item:ActivityItem)=>void;
  onClose:()=>void;
};
const groups=[
  {id:'attention',title:'Требует внимания',statuses:['needs_input','error']},
  {id:'running',title:'В работе',statuses:['running']},
  {id:'completed',title:'Завершено',statuses:['done','stopped']},
] as const;
function state(item:ActivityItem){
  switch(item.status){
    case 'needs_input':return {Icon:MessageCircle,label:t('Ожидает ответа')};
    case 'error':return {Icon:TriangleAlert,label:t('Ошибка')};
    case 'running':return {Icon:LoaderCircle,label:t('Работает')};
    case 'stopped':return {Icon:Square,label:t('Остановлен')};
    default:return {Icon:Check,label:t('Завершено')};
  }
}

/** Unmount to close. Viewing/acknowledging results belongs to the parent navigator. */
export function ActivityDrawer({items,loading,error,busy=false,onRetry,onOpen,onClose}:ActivityDrawerProps){
  useLanguage();
  const backdrop=useRef<HTMLDivElement|null>(null),id=useId();
  const needsHostUpdate=Boolean(error&&t(error)===t('Активность чатов недоступна. Обновите сервер ПК.'));
  useModal(backdrop,true,onClose);
  return <div ref={backdrop} className="activity-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <aside className="activity-drawer" role="dialog" aria-modal="true" aria-label={t('Активность чатов')}>
      <header className="activity-drawer-header">
        <div><h2>{t('Активность')}</h2><p>{t('Запуски через Pocket Code')}</p></div>
        <button className="icon-button" aria-label={t('Обновить активность')} title={t('Обновить активность')} disabled={loading} onClick={onRetry}><RefreshCw size={18} aria-hidden="true"/></button>
        <button className="icon-button" aria-label={t('Закрыть активность')} title={t('Закрыть активность')} onClick={onClose}><X size={20} aria-hidden="true"/></button>
      </header>
      <div className="activity-drawer-content">
        {error&&<div className="activity-sync-error" role="status"><TriangleAlert size={16} aria-hidden="true"/><p>{needsHostUpdate?t(error):items.length?t('Список не обновлён. Показаны последние полученные данные.'):t('Не удалось загрузить активность.')}</p>{!needsHostUpdate&&<details><summary>{t('Подробности ошибки')}</summary><p>{t(error)}</p></details>}<button disabled={loading} onClick={onRetry}>{t('Повторить')}</button></div>}
        {loading&&!items.length&&<p className="activity-empty" role="status">{t('Загружаем активность…')}</p>}
        {!loading&&!error&&!items.length&&<p className="activity-empty">{t('Нет активных задач и непросмотренных результатов.')}</p>}
        {groups.map(group=>{
          const entries=items.filter(item=>(group.statuses as readonly string[]).includes(item.status));
          if(!entries.length)return null;
          const heading=`${id}-${group.id}`;
          return <section className="activity-group" key={group.id} aria-labelledby={heading}>
            <h3 id={heading}>{t(group.title)}<span>{entries.length}</span></h3>
            <ul>{entries.map((item,index)=>{
              const {Icon,label}=state(item),meta=`${heading}-${index}`,title=item.title||t('Новый разговор');
              const project=item.cwd.split(/[\\/]/).filter(Boolean).at(-1)||item.cwd;
              return <li key={`${item.provider}:${item.id}`}><button className={`activity-task-row activity-task-${item.status}`} aria-label={title} aria-describedby={meta} disabled={busy} onClick={()=>onOpen(item)}>
                <Icon className="activity-task-row-icon" size={18} aria-hidden="true"/>
                <span className="activity-task-row-content"><strong>{title}</strong><span className="activity-task-row-meta" id={meta}><span>{item.provider==='codex'?'Codex':'Claude'}</span><span aria-hidden="true">·</span><span className="activity-project" title={item.cwd}>{project}</span><span className="activity-task-row-status">{label}</span></span></span>
                <ChevronRight className="activity-task-row-chevron" size={16} aria-hidden="true"/>
              </button></li>;
            })}</ul>
          </section>;
        })}
      </div>
    </aside>
  </div>;
}
