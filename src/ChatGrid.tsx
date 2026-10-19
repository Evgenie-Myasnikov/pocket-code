import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {LayoutGrid,List} from 'lucide-react';
import {request,type Connection} from './api';
import {t} from './i18n';
import {imageBlob,thumbnailQueue} from './image-thumbnails';
import {ChatRunStatus,relativeTime,fullTime,dayGroupLabel,type RunStatus} from './run-status';
import type {Session} from './session';
import type {ChatGrouping,ChatListView,WorkspaceProvider} from './preferences';
import './chat-grid.css';

type Preview={state:'loading'|'ready'|'error';text:string;image:string|null};
type Wire={sessionId:string;lastModified?:number;text?:string;image?:{name:string}|null;error?:true};
const basename=(value:string)=>value.split(/[\\/]/).filter(Boolean).at(-1)||value;

/** Today, yesterday, the rest of the last seven days, then everything older. */
export type GridDay='today'|'yesterday'|'week'|'earlier';
export function gridDay(at:number,now=Date.now()):GridDay{
  const start=new Date(now);start.setHours(0,0,0,0);const day=start.getTime();
  if(at>=day)return 'today';if(at>=day-86400000)return 'yesterday';return at>=day-6*86400000?'week':'earlier';
}
const dayLabel=(group:GridDay)=>group==='week'?t('На этой неделе'):dayGroupLabel(group);
/** Sections in display order: by date newest first; by project, the folder with the most recent chat first. */
export function groupSessions(sessions:Session[],grouping:ChatGrouping,now=Date.now()){
  const groups=new Map<string,{key:string;label:string;items:Session[]}>();
  for(const session of [...sessions].sort((a,b)=>b.lastModified-a.lastModified)){
    const key=grouping==='date'?gridDay(session.lastModified,now):'project:'+(session.cwd?basename(session.cwd).toLowerCase():'');
    const label=grouping==='date'?dayLabel(key as GridDay):session.cwd?basename(session.cwd):t('Без проекта');
    const group=groups.get(key)||{key,label,items:[]};group.items.push(session);groups.set(key,group);
  }
  const list=[...groups.values()];
  return grouping==='date'?list.sort((a,b)=>['today','yesterday','week','earlier'].indexOf(a.key)-['today','yesterday','week','earlier'].indexOf(b.key)):list;
}

// Previews survive switching views and groupings; a new lastModified is a new entry.
const previewCache=new Map<string,Preview>(),thumbnailCache=new Map<string,string>();
// One shared decoder queue: tiles cancel their own tasks when they unmount, so it never needs disposing.
const queue=thumbnailQueue(2);
function remember<T>(map:Map<string,T>,key:string,value:T,limit:number,drop?:(value:T)=>void){map.delete(key);map.set(key,value);while(map.size>limit){const [oldest,old]=map.entries().next().value!;map.delete(oldest);drop?.(old);}}
/** Reads previews only for tiles near the viewport, in small batches, two requests at a time. */
class PreviewLoader{
  private wanted=new Map<string,Session>();private timer=0;private active=0;private listeners=new Set<()=>void>();version=0;
  constructor(private connection:Connection|null,private provider:WorkspaceProvider){}
  key(session:Session){return (this.connection?.url||'')+'|'+this.provider+'|'+session.sessionId+'|'+session.lastModified;}
  get(session:Session):Preview{return previewCache.get(this.key(session))||{state:this.connection?'loading':'ready',text:'',image:null};}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private emit(){this.version++;for(const listener of this.listeners)listener();}
  want(session:Session){
    if(!this.connection||previewCache.has(this.key(session))||session.sessionId.startsWith('pending-'))return;
    this.wanted.set(session.sessionId,session);if(!this.timer)this.timer=window.setTimeout(()=>{this.timer=0;this.pump();},60);
  }
  dispose(){window.clearTimeout(this.timer);this.timer=0;this.wanted.clear();}
  private pump(){
    while(this.active<2&&this.wanted.size){
      const batch=[...this.wanted.values()].slice(0,24);for(const item of batch)this.wanted.delete(item.sessionId);
      this.active++;
      void request<{previews:Wire[]}>(this.connection!,`/sessions/previews?provider=${this.provider}&ids=${batch.map(item=>item.sessionId).join(',')}`).then(result=>{
        const found=new Map((Array.isArray(result?.previews)?result.previews:[]).map(item=>[item.sessionId,item]));
        for(const session of batch){const item=found.get(session.sessionId);remember(previewCache,this.key(session),item&&!item.error?{state:'ready',text:typeof item.text==='string'?item.text:'',image:item.image?.name||null}:{state:'error',text:'',image:null},600);}
      }).catch(()=>{for(const session of batch)remember(previewCache,this.key(session),{state:'error',text:'',image:null},600);}).finally(()=>{this.active--;this.emit();this.pump();});
    }
  }
}

function ChatTile({session,loader,connection,provider,status,disabled,selected,onOpen}:{session:Session;loader:PreviewLoader;connection:Connection|null;provider:WorkspaceProvider;status?:RunStatus;disabled?:boolean;selected?:boolean;onOpen(session:Session):void}){
  const element=useRef<HTMLButtonElement|null>(null),[near,setNear]=useState(false);
  useSyncExternalStore(loader.subscribe,()=>loader.version);
  const preview=loader.get(session),key=loader.key(session),[thumb,setThumb]=useState<string|null>(()=>thumbnailCache.get(key)||null);
  useEffect(()=>{const node=element.current;if(!node)return;if(typeof IntersectionObserver==='undefined'){setNear(true);return;}const observer=new IntersectionObserver(entries=>setNear(entries.some(entry=>entry.isIntersecting)),{rootMargin:'240px'});observer.observe(node);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(near)loader.want(session);},[near,loader,key]);
  useEffect(()=>{
    if(!near||!preview.image||!connection)return;
    const cached=thumbnailCache.get(key);if(cached){setThumb(cached);return;}
    return queue.enqueue(async()=>{const value=await request<{mimeType:string;data?:string}>(connection,`/sessions/${encodeURIComponent(session.sessionId)}/preview-image?provider=${provider}`);return imageBlob(`data:${value.mimeType};base64,${value.data||''}`);},url=>{if(!url)return;remember(thumbnailCache,key,url,80,old=>URL.revokeObjectURL(old));setThumb(url);});
  },[near,preview.image,connection,key]);
  const title=session.customTitle||session.summary||t('Без названия'),project=session.cwd?basename(session.cwd):t('Без проекта');
  const text=preview.text||(preview.state==='ready'||preview.state==='error'?(session.customTitle&&session.summary&&session.summary!==title?session.summary:''):'');
  return <button ref={element} type="button" className="chat-tile" data-preview={preview.state} data-image={thumb?'true':undefined} aria-current={selected?'true':undefined} disabled={disabled} aria-label={title} aria-description={[project,status?undefined:fullTime(session.lastModified)].filter(Boolean).join(' · ')} onClick={()=>onOpen(session)}>
    {preview.image&&<span className="chat-tile-media" aria-hidden="true">{thumb?<img src={thumb} alt="" decoding="async"/>:<span className="chat-tile-media-placeholder"/>}</span>}
    <span className="chat-tile-body">
      <strong className="chat-tile-title">{title}</strong>
      {preview.state==='loading'?<span className="chat-tile-skeleton" role="status" aria-label={t('Загружаем превью…')}><span/><span/><span/></span>
        :text?<span className="chat-tile-text">{text}</span>:<span className="chat-tile-text chat-tile-empty">{preview.state==='error'?t('Превью недоступно'):t('Ответа AI пока нет')}</span>}
      <small className="chat-tile-meta"><span className="chat-tile-project">{session.source==='desktop'?'Desktop · ':''}{project}</span><span aria-hidden="true">·</span>{status?<ChatRunStatus status={status}/>:<time dateTime={new Date(session.lastModified).toISOString()} title={fullTime(session.lastModified)}>{relativeTime(session.lastModified)}</time>}</small>
    </span>
  </button>;
}

/** Chats as tiles: the newest image and AI reply of each chat, grouped by date or project folder. */
export function ChatGrid({connection,provider,sessions,grouping,status,onOpen,disabled,selectedId,className=''}:{connection:Connection|null;provider:WorkspaceProvider;sessions:Session[];grouping:ChatGrouping;status?(sessionId:string):RunStatus|undefined;onOpen(session:Session):void;disabled?:boolean;selectedId?:string;className?:string}){
  const loader=useMemo(()=>new PreviewLoader(connection,provider),[connection?.url,connection?.token,provider]);
  useEffect(()=>()=>loader.dispose(),[loader]);
  const groups=groupSessions(sessions,grouping);
  return <div className={('chat-grid-view '+className).trim()} data-grouping={grouping}>{groups.map(group=><section className="chat-grid-group" key={group.key} aria-label={group.label}>
    <h2 className="list-label">{group.label}<span aria-label={t('Чатов: {0}',group.items.length)}>{group.items.length}</span></h2>
    <ul className="chat-grid" role="list">{group.items.map(session=><li key={session.sessionId}><ChatTile session={session} loader={loader} connection={connection} provider={provider} status={status?.(session.sessionId)} disabled={disabled} selected={selectedId===session.sessionId} onOpen={onOpen}/></li>)}</ul>
  </section>)}</div>;
}

/** List or grid, and the grid's grouping: two small groups of pressed-state buttons with 48px targets. */
export function ChatViewControls({view,onView,grouping,onGrouping}:{view:ChatListView;onView(value:ChatListView):void;grouping:ChatGrouping;onGrouping(value:ChatGrouping):void}){
  return <div className="chat-view-controls">
    <div className="chat-view-switch" role="group" aria-label={t('Вид списка чатов')}>{([['list',List,t('Список')],['grid',LayoutGrid,t('Сетка')]] as const).map(([id,Icon,label])=><button key={id} type="button" aria-pressed={view===id} aria-label={label} title={label} onClick={()=>onView(id)}><Icon size={18} aria-hidden="true"/></button>)}</div>
    {view==='grid'&&<div className="chat-view-switch chat-view-grouping" role="group" aria-label={t('Группировка чатов')}>{([['date',t('По дате')],['project',t('По проекту')]] as const).map(([id,label])=><button key={id} type="button" aria-pressed={grouping===id} onClick={()=>onGrouping(id)}>{label}</button>)}</div>}
  </div>;
}
