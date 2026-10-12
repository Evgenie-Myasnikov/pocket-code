import {Check,LoaderCircle,MessageCircle,Square,TriangleAlert} from 'lucide-react';
import {useLanguage} from './i18n';
import type {ActivityItem} from '../server/types';
import type {useActivity} from './useActivity';
export type ActivityFeed=ReturnType<typeof useActivity>;
export function ActivityList({feed,busy,onOpen}:{feed:ActivityFeed;busy?:boolean;onOpen(item:ActivityItem):void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const states={needs_input:{Icon:MessageCircle,label:l('Needs your answer','Нужен ваш ответ')},error:{Icon:TriangleAlert,label:l('Error','Ошибка')},running:{Icon:LoaderCircle,label:l('Running','Работает')},done:{Icon:Check,label:l('Completed','Завершено')},stopped:{Icon:Square,label:l('Stopped','Остановлен')}};
 return <div className="inbox-processes">
  {feed.error&&<div role="status" className="inbox-sync-error"><p>{l('Processes could not be refreshed.','Не удалось обновить процессы.')}</p>{feed.items.length>0&&<p>{l('Showing the last received states.','Показаны последние полученные состояния.')}</p>}<button onClick={feed.refresh} disabled={feed.loading}>{l('Retry','Повторить')}</button></div>}
  {feed.loading&&!feed.items.length&&<p role="status">{l('Loading processes…','Загружаем процессы…')}</p>}
  {!feed.loading&&!feed.error&&!feed.items.length&&<p className="muted">{l('No active processes or unseen results.','Нет активных процессов и непросмотренных результатов.')}</p>}
  {[{name:l('Needs attention','Требует внимания'),statuses:['needs_input','error']},{name:l('In progress','В работе'),statuses:['running']},{name:l('Finished','Завершено'),statuses:['done','stopped']}].map(group=>{
   const items=feed.items.filter(item=>group.statuses.includes(item.status));if(!items.length)return null;
   return <section key={group.name}><h3>{group.name}<span>{items.length}</span></h3><ul>{items.map(item=>{const {Icon,label}=states[item.status];return <li key={item.provider+':'+item.id}><button className={'inbox-process-row state-'+item.status} disabled={busy} onClick={()=>onOpen(item)} aria-label={item.title||l('New conversation','Новый разговор')}><Icon size={20}/><span><strong>{item.title||l('New conversation','Новый разговор')}</strong><small>{item.provider==='codex'?'Codex':item.provider==='claude'?'Claude':'Copilot'} · {item.cwd.split(/[\\/]/).filter(Boolean).at(-1)}</small><small className="process-status">{label}</small></span></button></li>;})}</ul></section>;
  })}
 </div>;
}
