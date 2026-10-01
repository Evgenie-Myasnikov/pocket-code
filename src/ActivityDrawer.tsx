import {useEffect,useId,useRef,useState,type CSSProperties,type RefObject} from 'react';
import {Check,ChevronRight,LoaderCircle,MessageCircle,RefreshCw,Square,TriangleAlert,X} from 'lucide-react';
import type {ActivityItem} from '../server/types';
import {t,useLanguage} from './i18n';
import {useModal} from './navigation';
import './activity-drawer.css';

export type ActivityDrawerProps={
  surfaceRef?:RefObject<HTMLDivElement|null>;
  dragging?:boolean;
  reveal?:number;
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
export function ActivityDrawer({items,loading,error,busy=false,onRetry,onOpen,onClose,surfaceRef,dragging=false,reveal=0}:ActivityDrawerProps){
  useLanguage();
  const localBackdrop=useRef<HTMLDivElement|null>(null),backdrop=surfaceRef||localBackdrop,id=useId();
  const [closing,setClosing]=useState(false);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const swipe=useRef<{id:number;x:number;y:number;started:number;active:boolean}|null>(null);
  const suppressClick=useRef(false);
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
  const close=()=>{if(closing)return;setClosing(true);closeTimer.current=setTimeout(onClose,matchMedia('(prefers-reduced-motion: reduce)').matches?0:130);};
  const needsHostUpdate=Boolean(error&&t(error)===t('Активность чатов недоступна. Обновите сервер ПК.'));
  useModal(backdrop,!dragging,close);
  return <div ref={backdrop} className={`activity-backdrop${dragging?' activity-opening':''}${closing?' activity-closing':''}`} style={{'--activity-reveal':`${reveal}px`} as CSSProperties} onPointerDown={event=>{if(event.target===event.currentTarget)close();}}>
    <aside className="activity-drawer"
      onClickCapture={event=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;}}}
      onPointerDown={event=>{if(!event.isPrimary||event.button!==0||dragging)return;suppressClick.current=false;swipe.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),active:false};}}
      onPointerMove={event=>{const start=swipe.current;if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=Math.abs(event.clientY-start.y);
        if(!start.active&&dx>8&&dx>dy*1.3){start.active=true;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.dataset.dragging='true';}
        if(start.active){suppressClick.current=true;event.currentTarget.style.setProperty('--activity-offset',Math.max(0,dx)+'px');}
      }}
      onPointerUp={event=>{const start=swipe.current;if(!start||start.id!==event.pointerId)return;swipe.current=null;delete event.currentTarget.dataset.dragging;
        const dx=event.clientX-start.x;if(start.active&&(dx>64||(dx>20&&dx/Math.max(1,performance.now()-start.started)>.35)))close();
        event.currentTarget.style.removeProperty('--activity-offset');
      }}
      onPointerCancel={event=>{swipe.current=null;delete event.currentTarget.dataset.dragging;event.currentTarget.style.removeProperty('--activity-offset');}}
      role="dialog" aria-modal="true" aria-label={t('Активность чатов')}>
      <header className="activity-drawer-header">
        <div><h2>{t('Активность')}</h2><p>{t('Запуски через Pocket Code')}</p></div>
        <button className="icon-button" aria-label={t('Обновить активность')} title={t('Обновить активность')} disabled={loading} onClick={onRetry}><RefreshCw size={18} aria-hidden="true"/></button>
        <button className="icon-button" aria-label={t('Закрыть активность')} title={t('Закрыть активность')} onClick={close}><X size={20} aria-hidden="true"/></button>
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
                <span className="activity-task-row-content"><strong>{title}</strong><span className="activity-task-row-meta" id={meta}><span>{item.provider==='copilot'?'Copilot':item.provider==='codex'?'Codex':'Claude'}</span><span aria-hidden="true">·</span><span className="activity-project" title={item.cwd}>{project}</span><span className="activity-task-row-status">{label}</span></span></span>
                <ChevronRight className="activity-task-row-chevron" size={16} aria-hidden="true"/>
              </button></li>;
            })}</ul>
          </section>;
        })}
      </div>
    </aside>
  </div>;
}
