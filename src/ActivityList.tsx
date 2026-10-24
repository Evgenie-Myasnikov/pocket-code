import {useMemo,useEffect} from 'react';
import type {Connection} from './api';
import {PreviewLoader,ChatPreviewImage} from './ChatGrid';
import {t,useLanguage} from './i18n';
import type {ActivityItem} from '../server/types';
import type {useActivity} from './useActivity';
import {RunStatusIcon,runStatusLabel,relativeTime,fullTime} from './run-status';
export type ActivityFeed=ReturnType<typeof useActivity>;
export type ActivityFilter='attention'|'running'|'done';
export const providerName=(provider:ActivityItem['provider'])=>provider==='codex'?'Codex':provider==='claude'?'Claude':'Copilot';
const project=(cwd:string)=>cwd.split(/[\\/]/).filter(Boolean).at(-1)||cwd;
const groups:{id:ActivityFilter;name:string;statuses:ActivityItem['status'][]}[]=[{id:'attention',name:'Ждут вас',statuses:['needs_input','error']},{id:'running',name:'Работают',statuses:['running']},{id:'done',name:'Готово',statuses:['done','stopped']}];
/** One two-line row per process: title, then provider · project · time; a pill only when the person must act. */
export function ActivityList({connection,feed,busy,onOpen,filter,onClearFinished}:{connection?:Connection;feed:ActivityFeed;busy?:boolean;onOpen(item:ActivityItem):void;filter?:ActivityFilter;onClearFinished?():void}){
 useLanguage();
 const loaders=useMemo(()=>connection?{claude:new PreviewLoader(connection,'claude',12000),codex:new PreviewLoader(connection,'codex',12000),copilot:new PreviewLoader(connection,'copilot',12000)}:null,[connection?.url,connection?.token]);
 useEffect(()=>()=>{if(loaders)Object.values(loaders).forEach(loader=>loader.dispose());},[loaders]);
 const shown=groups.filter(group=>!filter||group.id===filter);
 const empty=!feed.items.some(item=>shown.some(group=>group.statuses.includes(item.status)));
 return <div className="inbox-processes">
  {feed.loading&&!feed.items.length&&<p className="muted">{t('Загружаем процессы…')}</p>}
  {!feed.loading&&!feed.error&&empty&&<p className="muted">{filter==='attention'?t('Никто не ждёт вашего ответа.'):filter==='running'?t('Сейчас ничего не работает.'):filter==='done'?t('Нет непросмотренных результатов.'):t('Нет активных процессов и непросмотренных результатов.')}</p>}
  {shown.map(group=>{
   const items=feed.items.filter(item=>group.statuses.includes(item.status));if(!items.length)return null;
   return <section key={group.id} data-group={group.id}><h3>{t(group.name)}<span>{items.length}</span>{group.id==='done'&&onClearFinished&&<button className="text-button" disabled={busy} onClick={onClearFinished}>{t('Очистить готовые')}</button>}</h3><ul>{items.map(item=>{
    const title=item.title||t('Новый разговор'),label=runStatusLabel(item.status),meta=[providerName(item.provider),project(item.cwd)].join(' · ');
    return <li key={item.provider+':'+item.id} className="inbox-process-item"><button className={'inbox-process-row state-'+item.status} disabled={busy} onClick={()=>onOpen(item)} aria-label={`${title}, ${label}, ${meta}`}><RunStatusIcon status={item.status} size={20}/><span><strong>{title}</strong><small>{meta} · <time dateTime={new Date(item.startedAt).toISOString()} title={fullTime(item.startedAt)}>{relativeTime(item.startedAt)}</time></small></span>{(item.status==='needs_input'||item.status==='error')&&<span className={'inbox-pill run-status-'+item.status} aria-hidden="true">{label}</span>}{connection&&loaders&&item.sessionId&&<ChatPreviewImage session={{sessionId:item.sessionId,lastModified:item.startedAt,summary:item.title,cwd:item.cwd,previewVersion:item.version}} loader={loaders[item.provider]} connection={connection} provider={item.provider}/>}</button>
     {item.status==='error'&&<button className="text-button inbox-dismiss" disabled={busy} onClick={()=>feed.markViewed(item)} aria-label={t('Скрыть ошибку: {0}',title)}>{t('Скрыть')}</button>}</li>;})}</ul></section>;
  })}
 </div>;
}
