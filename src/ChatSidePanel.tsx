import {createContext,useContext,useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ChevronLeft,ChevronRight,Expand,FileText,GitCompareArrows,PanelRightClose,PanelsTopLeft,RefreshCw,Shrink,Users,X} from 'lucide-react';
import {t} from './i18n';
import './chat-side-panel.css';

/** Opens a file of the chat's folder as a tab of the PC window's side panel. Absent on phones, where files open full screen. */
export const SidePreview=createContext<((root:string,path:string)=>void)|null>(null);
export const useSidePreview=()=>useContext(SidePreview);

export type SidePanelTab={id:string;kind:'file'|'review'|'outputs'|'agents';label:string;title?:string;detail?:ReactNode};
const icons={file:FileText,review:GitCompareArrows,outputs:PanelsTopLeft,agents:Users};
/**
 * The PC window's panel beside a chat, after the Strata preview sidebar: files the chat made or changed open as tabs,
 * next to Changes, Results and Subagents. The chat stays usable while it is open; Full screen covers the chat, Collapse closes it.
 */
export function ChatSidePanel({tabs,active,expanded,onSelect,onCloseTab,onRefresh,onExpand,onClose,children}:{
  tabs:SidePanelTab[];active:string;expanded:boolean;
  onSelect(id:string):void;onCloseTab(id:string):void;onRefresh?():void;onExpand():void;onClose():void;children:ReactNode;
}){
  const host=document.querySelector('.desktop-app')||document.body,strip=useRef<HTMLDivElement>(null);
  // The chat column makes room for the panel while it is docked.
  useEffect(()=>{const root=document.documentElement;root.dataset.chatSidePanel=expanded?'expanded':'docked';return()=>{delete root.dataset.chatSidePanel;};},[expanded]);
  useEffect(()=>{strip.current?.querySelector<HTMLElement>('[aria-selected=true]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[active]);
  const scroll=(direction:number)=>strip.current?.scrollBy({left:direction*240,behavior:'smooth'});
  return createPortal(<section className="chat-side-panel" data-expanded={expanded||undefined} aria-label={t('Панель чата')}
    onKeyDown={event=>{if(event.key==='Escape'&&!event.defaultPrevented&&expanded){event.preventDefault();onExpand();}}}>
    <header className="chat-side-panel-bar">
      <button type="button" className="icon-button chat-side-panel-scroll" aria-label={t('Предыдущие вкладки')} onClick={()=>scroll(-1)}><ChevronLeft size={16}/></button>
      <div ref={strip} className="chat-side-panel-tabs" role="tablist" aria-label={t('Панель чата')}>{tabs.map(tab=>{const Icon=icons[tab.kind];return <span key={tab.id} className="chat-side-panel-tab" data-selected={tab.id===active||undefined}>
        <button type="button" role="tab" aria-selected={tab.id===active} title={tab.title||tab.label} onClick={()=>onSelect(tab.id)}><Icon size={15} aria-hidden="true"/><span>{tab.label}</span>{tab.detail}</button>
        {tab.kind==='file'&&<button type="button" className="chat-side-panel-tab-close" aria-label={t('Закрыть вкладку {0}',tab.label)} title={t('Закрыть вкладку')} onClick={()=>onCloseTab(tab.id)}><X size={13}/></button>}
      </span>;})}</div>
      <button type="button" className="icon-button chat-side-panel-scroll" aria-label={t('Следующие вкладки')} onClick={()=>scroll(1)}><ChevronRight size={16}/></button>
      <div className="chat-side-panel-actions">
        {onRefresh&&<button type="button" className="icon-button" aria-label={t('Обновить')} title={t('Обновить')} onClick={onRefresh}><RefreshCw size={16}/></button>}
        <button type="button" className="icon-button" aria-label={expanded?t('Выйти из полноэкранного режима'):t('На весь экран')} title={expanded?t('Выйти из полноэкранного режима'):t('На весь экран')} onClick={onExpand}>{expanded?<Shrink size={17}/>:<Expand size={17}/>}</button>
        <button type="button" className="icon-button" aria-label={t('Свернуть панель')} title={t('Свернуть панель')} onClick={onClose}><PanelRightClose size={17}/></button>
      </div>
    </header>
    <div className="chat-side-panel-body" role="tabpanel">{children}</div>
  </section>,host);
}
