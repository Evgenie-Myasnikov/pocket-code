import {Fragment,useEffect,useRef,useState,type KeyboardEvent,type MouseEvent} from 'react';
import {Check,ChevronRight,Folder,LayoutDashboard,MoreHorizontal,RefreshCw,Trash2,X} from 'lucide-react';
import {CardActionMenu} from './CardActionMenu';
import {ChatListActions} from './ChatListActions';
import type {ChatActionTarget} from './ChatActions';
import {chatTitle} from './chat-title';
import {ChatRunStatus,RunStatusDot,relativeTime,fullTime} from './run-status';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './chat-delete-options.css';
import type {Session} from './session';
import type {JobView} from '../server/types';

type Target={folder?:string;ids?:string[]};
type Preview={ids:string[];running:string[];unavailable:string[];failed?:string[];unsupported?:string[];alreadyRemoved?:string[];eraseOriginals?:boolean};
type Provider='claude'|'codex'|'copilot';
type Scope={connection:Connection;provider:Provider;account:string};
const basename=(path:string)=>path.split(/[\\/]/).filter(Boolean).at(-1)||path;

function DeleteChatsDialog({target,connection,provider,account,onClose,onDeleted}:{target:Target;onClose():void;onDeleted(ids:string[]):void}&Scope){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const ref=useRef<HTMLElement>(null);
  const [preview,setPreview]=useState<Preview>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const [result,setResult]=useState<Preview>();
  const [permanent,setPermanent]=useState(true);
  const lock=useRef(false);
  useModal(ref,true,()=>{if(!lock.current)onClose();});
  useEffect(()=>{
    let live=true;
    setError('');setPreview(undefined);
    void request<Preview>(connection,'/chat-library/bulk-delete',{...target,provider,account:account||undefined,action:'preview',...(permanent?{eraseOriginals:true}:{})})
      .then(data=>{
        if(!live)return;
        if(permanent&&data?.eraseOriginals!==true){setError(l('Update the PC host to erase original chats.','Обновите хост на ПК для удаления оригиналов.'));return;}
        setPreview(data);
      },e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[target,provider,account,connection,revision,permanent]);
  async function remove(){
    if(!preview?.ids.length||lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try{
      const removed=await request<Preview>(connection,'/chat-library/bulk-delete',{...target,provider,account:account||undefined,action:'delete',ids:preview.ids,...(permanent?{eraseOriginals:true}:{})});
      if(permanent&&removed?.eraseOriginals!==true)throw new Error(l('The host did not confirm original chat removal.','Хост не подтвердил удаление оригиналов.'));
      onDeleted([...removed.ids,...(removed.alreadyRemoved||[])]);
      if(removed.running.length||removed.unavailable.length||removed.unsupported?.length||removed.failed?.length)setResult(removed);else onClose();
    }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  function choose(value:boolean){setPreview(undefined);setResult(undefined);setError('');setPermanent(value);}
  const value=result||preview;
  const actionLabel=permanent?l('Erase permanently','Стереть безвозвратно'):l('Remove from list','Убрать из списка');
  const countLabel=permanent?(result?l('Original chats erased','Стерто оригиналов'):l('Original chats to erase','Оригиналов чатов к удалению'))
    :(result?l('Removed from the list','Убрано из списка'):l('Chats to remove from the list','Чатов к удалению из списка'));
  return <div className="modal-backdrop"><section ref={ref} className="confirm-modal" role="dialog" aria-modal="true" aria-label={l('Delete chats','Удалить чаты')}>
    <h2>{l('Delete chats','Удалить чаты')}</h2>
    {target.folder!==undefined&&<p className="muted bulk-folder-path"><Folder size={15}/> {target.folder||l('No project','Без проекта')}</p>}
    <fieldset className="chain-delete-options" disabled={busy}><legend>{l('What to delete','Что удалить')}</legend>
      <label><input type="radio" name="chat-removal" checked={permanent} onChange={()=>choose(true)}/>{l('Original chats and local cache','Оригиналы чатов и локальный кэш')}</label>
      <label><input type="radio" name="chat-removal" checked={!permanent} onChange={()=>choose(false)}/>{l('Only remove from the Pocket Code list','Только убрать из списка Pocket Code')}</label>
    </fieldset>
    {!value&&!error&&<p role="status">{l('Counting chats…','Считаем чаты…')}</p>}
    {value&&<><p role="status">{countLabel} · <strong>{value.ids.length}</strong></p>
      {!!value.running.length&&<p>{l('Running chats kept','Активные чаты сохранены')} · {value.running.length}</p>}
      {!!value.unavailable.length&&<p>{l('Unavailable or changed','Недоступны или изменились')} · {value.unavailable.length}</p>}
      {!!value.unsupported?.length&&<p>{l('Provider does not support deletion','Провайдер не поддерживает удаление')} · {value.unsupported.length}</p>}
      {!!value.alreadyRemoved?.length&&<p>{l('Previously erased','Уже стёрты')} · {value.alreadyRemoved.length}</p>}
      {!!value.failed?.length&&<p>{l('Failed to erase','Не удалось удалить')} · {value.failed.length}</p>}</>}
    {permanent&&<p className="muted">{l('Erasing removes the original history stored by the provider and cached transcripts on this device. This cannot be undone.','У провайдера будет удалена исходная история, а на этом устройстве — её кэш. Восстановить её из приложения будет невозможно.')}</p>}
    {!permanent&&preview&&!result&&preview.ids.length>0&&<p className="muted">{l('These chats will be removed from the chat lists on this PC and connected phones. Their original provider history will remain available.','Чаты исчезнут из списка на этом ПК и подключённых телефонах. Исходная история у провайдера сохранится.')}</p>}
    {error&&<p role="alert">{error}</p>}
    <div className="bulk-dialog-actions"><button className="secondary" disabled={busy} onClick={onClose}>{result?l('Close','Закрыть'):l('Cancel','Отмена')}</button>
      {(error&&!preview||permanent&&(result||preview&&!preview.ids.length))&&<button className="secondary" onClick={()=>{setPreview(undefined);setResult(undefined);setRevision(v=>v+1);}}>{l('Retry','Повторить')}</button>}
      {preview&&!result&&preview.ids.length>0&&<button className="primary danger" disabled={busy} onClick={()=>void remove()}>{busy?l('Deleting…','Удаляем…'):actionLabel+' · '+preview.ids.length}</button>}</div>
  </section></div>;
}

type Props=Scope&{
  groups:Map<string,Session[]>;jobs:Map<string,JobView>;focusId?:string;actionId?:string;projectFilter:string;
  loading:boolean;online:boolean;onRefresh():void;onOpen(s:Session):void;onMenu(target:ChatActionTarget):void;onCloseMenu():void;onDeleted(ids:string[]):void;
};
export function DesktopChatFolders({groups,jobs,focusId,actionId,projectFilter,loading,online,onRefresh,onOpen,onMenu,onCloseMenu,onDeleted,...scope}:Props){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const tree=useRef<HTMLDivElement>(null),anchor=useRef<string|undefined>(undefined);
  const single=useRef<string|undefined>(undefined);
  const [marked,setMarked]=useState(new Set<string>()),[target,setTarget]=useState<Target>();
  const [menu,setMenu]=useState<{x:number;y:number;folder?:string}>();
  const rows=()=>Array.from(tree.current?.querySelectorAll<HTMLButtonElement>('details[open] .desktop-sessions > button[data-chat-id]')||[]);
  useEffect(()=>{
    if(!marked.size)return;
    const known=new Set([...groups.values()].flatMap(list=>list.map(s=>s.sessionId)));
    if([...marked].some(id=>!known.has(id)))setMarked(new Set([...marked].filter(id=>known.has(id))));
  },[groups,marked]);
  function clear(){setMarked(new Set());anchor.current=undefined;single.current=undefined;}
  function toggle(id:string){
    const base=single.current;single.current=undefined;
    setMarked(old=>{const next=new Set(old);if(!next.size&&base&&rows().some(b=>b.dataset.chatId===base))next.add(base);
      if(next.has(id))next.delete(id);else next.add(id);return next;});
    anchor.current=id;
  }
  function range(id:string,keep:boolean){
    single.current=undefined;
    const order=rows().map(row=>row.dataset.chatId!),end=order.indexOf(id);
    if(end<0)return;
    let start=order.indexOf(anchor.current||'');if(start<0){start=end;anchor.current=id;}
    const part=order.slice(Math.min(start,end),Math.max(start,end)+1);
    setMarked(old=>new Set(keep?[...old,...part]:part));
  }
  function click(event:MouseEvent,s:Session){
    if(event.shiftKey){range(s.sessionId,event.ctrlKey||event.metaKey);return;}
    if(event.ctrlKey||event.metaKey){toggle(s.sessionId);return;}
    clear();anchor.current=s.sessionId;single.current=s.sessionId;onOpen(s);
  }
  function selectTarget(ids:string[]){setTarget({ids,...(projectFilter?{folder:projectFilter}:{})});}
  function openMenu(t:ChatActionTarget){
    if(marked.has(t.session.sessionId)){onCloseMenu();setMenu({x:t.x,y:t.y});}
    else{clear();onMenu({...t,select:()=>{anchor.current=t.session.sessionId;setMarked(new Set([t.session.sessionId]));}});}
  }
  function key(event:KeyboardEvent<HTMLButtonElement>,s:Session,running:boolean){
    const id=s.sessionId,ctrl=event.ctrlKey||event.metaKey;
    if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){
      event.preventDefault();const rect=event.currentTarget.getBoundingClientRect();openMenu({x:rect.left,y:rect.bottom,session:s,running});return;
    }
    if(event.shiftKey&&(event.key==='ArrowDown'||event.key==='ArrowUp')){
      event.preventDefault();const all=rows(),i=all.indexOf(event.currentTarget),next=all[i+(event.key==='ArrowUp'?-1:1)];
      if(next){anchor.current??=id;range(next.dataset.chatId!,ctrl);next.focus();}return;
    }
    if(ctrl&&event.key.toLowerCase()==='a'){event.preventDefault();setMarked(new Set(rows().map(b=>b.dataset.chatId!)));anchor.current=id;}
    else if(ctrl&&event.code==='Space'){event.preventDefault();toggle(id);}
    else if(event.key==='Escape'){event.preventDefault();clear();}
    else if(event.key==='Delete'&&online){event.preventDefault();selectTarget(marked.has(id)?[...marked]:[id]);}
  }
  function folderMenu(folder:string,x:number,y:number){onCloseMenu();setMenu({folder,x,y});}
  return <>
    <div className="desktop-list-caption"><span>{marked.size?l('Selected','Выбрано')+' · '+marked.size:l('Workspace chats','Чаты по папкам')}</span>
      {marked.size>0?<span className="bulk-toolbar"><button className="icon-button" aria-label={l('Delete selected chats','Удалить выбранные чаты')} disabled={!online} onClick={()=>selectTarget([...marked])}><Trash2 size={16}/></button><button className="icon-button" aria-label={l('Clear selection','Снять выделение')} onClick={clear}><X size={16}/></button></span>:<button className="icon-button" aria-label={l('Refresh','Обновить')} onClick={onRefresh}><RefreshCw size={16}/></button>}
    </div>
    <div ref={tree} className="desktop-session-groups">{loading&&!groups.size?<p role="status">{l('Loading chats…','Загружаем чаты…')}</p>:
      Array.from(groups,([folder,items])=><details key={folder} className="rail-chat-folder" open>
        <summary title={folder} onContextMenu={e=>{e.preventDefault();folderMenu(folder,e.clientX,e.clientY);}}><ChevronRight size={13} aria-hidden="true"/><Folder size={15} aria-hidden="true"/><span>{folder?basename(folder):l('No project','Без проекта')}</span>
          <button type="button" className="folder-chat-actions" aria-label={l('Folder actions','Действия папки')+' · '+(folder||l('No project','Без проекта'))} aria-haspopup="menu" onClick={e=>{e.preventDefault();e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();folderMenu(folder,r.left,r.bottom);}}><MoreHorizontal size={15}/></button>
        </summary>
        <div className="desktop-sessions">{items.map((s,index)=>{
          const job=jobs.get(s.sessionId),running=job?.status==='running',status=running&&job?.approvals?.length?'needs_input':job?.status;
          const title=s.customTitle||chatTitle(s.summary,l('Untitled chat','Без названия')),isMarked=marked.has(s.sessionId);
          return <Fragment key={s.sessionId}><button style={{gridRow:index+1}} data-chat-id={s.sessionId} data-running={running||undefined} data-marked={isMarked||undefined}
            aria-description={running?l('Working','Работает'):undefined} onContextMenu={e=>{e.preventDefault();openMenu({session:s,x:e.clientX,y:e.clientY,running});}} onKeyDown={e=>key(e,s,running)}
            title={[s.customTitle||s.summary,s.board?(s.board.kind==='discussion'?l('Board discussion: ','Обсуждение доски: '):s.board.kind==='task'?l('Board task: ','Задача доски: '):l('Board: ','Доска: '))+s.board.title:'',s.cwd?basename(s.cwd):'',fullTime(s.lastModified)].filter(Boolean).join(' · ')}
            aria-pressed={marked.size?isMarked:focusId===s.sessionId} onClick={e=>click(e,s)}>
            {isMarked?<Check size={14} className="marked-chat-check" aria-hidden="true"/>:status&&status!=='running'?<RunStatusDot status={status} className="desktop-chat-dot" labelled={false}/>:<span className="desktop-chat-dot" data-status="idle"/>}
            <span><strong>{s.board&&<LayoutDashboard className="desktop-chat-board" size={13} aria-label={l('Board chat: ','Чат доски: ')+s.board.title}/>}{title}</strong>
              <small>{s.cwd?basename(s.cwd):l('No project','Без проекта')}{!status&&<> · <time title={fullTime(s.lastModified)}>{relativeTime(s.lastModified)}</time></>}</small>
              {status&&status!=='running'&&<small className="desktop-run-label"><ChatRunStatus status={status}/></small>}</span><ChevronRight size={14}/>
          </button><ChatListActions session={s} provider={scope.provider} connection={scope.connection} jobId={job?.id} row={index+1} running={running} open={actionId===s.sessionId} onOpen={openMenu} onClose={onCloseMenu}/></Fragment>;
        })}</div></details>)}
      {!loading&&!groups.size&&<p className="muted">{online?l('No matching chats','Нет подходящих чатов'):l('Chats will load when the local server is available.','Чаты загрузятся, когда локальный сервер будет доступен.')}</p>}
    </div>
    {menu&&<CardActionMenu point={menu} label={menu.folder===undefined?l('Selected chat actions','Действия выбранных чатов'):l('Folder actions','Действия папки')} onClose={()=>setMenu(undefined)}
      items={[{label:menu.folder===undefined?l('Delete selected chats','Удалить выбранные чаты'):l('Delete all chats in this folder','Удалить все чаты в папке'),Icon:Trash2,danger:true,disabled:!online,onSelect:()=>menu.folder===undefined?selectTarget([...marked]):setTarget({folder:menu.folder})}]}/>}
    {target&&<DeleteChatsDialog {...scope} target={target} onClose={()=>setTarget(undefined)} onDeleted={ids=>{onDeleted(ids);setMarked(old=>{const next=new Set(old);for(const id of ids)next.delete(id);return next;});}}/>}
  </>;
}
