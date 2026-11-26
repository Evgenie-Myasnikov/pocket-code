import {Fragment,useEffect,useRef,useState,type KeyboardEvent,type MouseEvent,type ReactNode} from 'react';
import {Check,ChevronDown,ChevronRight,Folder,FolderPlus,LayoutDashboard,MoreHorizontal,Pencil,Pin,Trash2,X} from 'lucide-react';
import {CardActionMenu} from './CardActionMenu';
import {ChatListActions} from './ChatListActions';
import type {ChatActionTarget} from './ChatActions';
import {chatTitle} from './chat-title';
import {ChatRunStatus,RunStatusDot,relativeTime,fullTime} from './run-status';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './chat-delete-options.css';
import './chat-list.css';
import type {Session} from './session';
import type {JobView} from '../server/types';

type Target={folder?:string;ids?:string[]};
type Preview={ids:string[];running:string[];unavailable:string[];failed?:string[];unsupported?:string[];alreadyRemoved?:string[];eraseOriginals?:boolean};
type Provider='claude'|'codex'|'copilot'|'gemini';
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

export const CHAT_PAGE=30;
/** Pinned and archived chats are a choice of this PC window, kept in its local storage. */
function readIds(key:string){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return new Set<string>(Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,2000):[]);}catch{return new Set<string>();}}
function writeIds(key:string,ids:Set<string>){try{localStorage.setItem(key,JSON.stringify([...ids]));}catch{/* The choice still holds until the window closes. */}}
const PINNED='pocket-desktop-pinned-chats',FOLDERS='pocket-desktop-chat-folders';
/** There is no archive: every chat is in the list (chats archived before stay in the list again). */
const NO_ARCHIVE:ReadonlySet<string>=new Set();
/** Folders are made and named by the person; like pins they belong to this PC window. A chat is in at most one folder. */
/** `at` is the folder's place among the chats outside folders: how many of them are above it (none: at the top). */
export type ChatFolder={id:string;name:string;collapsed:boolean;chats:string[];at?:number};
function readFolders():ChatFolder[]{
  try{const value=JSON.parse(localStorage.getItem(FOLDERS)||'[]');
    return Array.isArray(value)?value.filter(f=>f&&typeof f.id==='string'&&typeof f.name==='string'&&Array.isArray(f.chats)).slice(0,200).map(f=>({id:f.id,name:f.name.slice(0,120),collapsed:f.collapsed===true,chats:f.chats.filter((c:unknown)=>typeof c==='string').slice(0,2000),...(Number.isInteger(f.at)&&f.at>0?{at:Math.min(f.at,100000)}:{})})):[];}
  catch{return [];}
}
function writeFolders(folders:ChatFolder[]){try{localStorage.setItem(FOLDERS,JSON.stringify(folders));}catch{/* The folders still hold until the window closes. */}}
const CHAT_DRAG='application/x-pocket-chat',FOLDER_DRAG='application/x-pocket-folder';
const providerNames:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'Copilot',gemini:'Gemini'};
type Props={
  /** Chats of every provider, newest first; each carries its provider. */
  sessions:Session[];jobs:Map<string,JobView>;focusId?:string;actionId?:string;connection:Connection;provider:Provider;
  loading:boolean;online:boolean;onOpen(s:Session):void;onMenu(target:ChatActionTarget):void;onCloseMenu():void;onDeleted(ids:string[],provider:Provider):void;
  /** A block shown above the chats (scheduled tasks). */
  beforeChats?:ReactNode;
};
/** One flat list of chats. Only the first page is rendered; "Show more" adds the next one, so a long history costs nothing until asked for. */
export function DesktopChatList({sessions:allSessions,jobs,focusId,actionId,loading,online,onOpen,onMenu,onCloseMenu,onDeleted,connection,provider,beforeChats}:Props){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const tree=useRef<HTMLDivElement>(null),anchor=useRef<string|undefined>(undefined);
  const single=useRef<string|undefined>(undefined);
  const [marked,setMarked]=useState(new Set<string>()),[queue,setQueue]=useState<(Target&Scope)[]>([]);
  const [menu,setMenu]=useState<{x:number;y:number}>();
  const [limit,setLimit]=useState(CHAT_PAGE);
  const [pinned,setPinned]=useState(()=>readIds(PINNED)),archived=NO_ARCHIVE,showArchived=false;
  const [folders,setFolders]=useState<ChatFolder[]>(readFolders),[renaming,setRenaming]=useState<string>(),[folderMenu,setFolderMenu]=useState<{id:string;x:number;y:number}>(),[dropTarget,setDropTarget]=useState<string>();
  const changeFolders=(change:(old:ChatFolder[])=>ChatFolder[])=>setFolders(old=>{const next=change(old);writeFolders(next);return next;});
  /** Moves a chat out of every folder and, unless folder is null, into that one. */
  const moveChat=(id:string,folder:string|null)=>changeFolders(old=>old.map(f=>({...f,chats:f.id===folder?[...f.chats.filter(c=>c!==id),id]:f.chats.filter(c=>c!==id)})));
  const createFolder=()=>{const id=crypto.randomUUID();changeFolders(old=>[...old,{id,name:l('New folder','Новая папка'),collapsed:false,chats:[]}]);setRenaming(id);};
  const [draggingFolder,setDraggingFolder]=useState<string>();
  /**
   * Puts a folder where the pointer was let go, among the other folders and the chats outside folders: it goes after every one
   * whose middle is above the pointer. Each folder keeps how many outside chats come before it, so the order survives a reload.
   */
  function placeFolder(id:string,y:number){
    const items=Array.from(tree.current?.querySelectorAll<HTMLElement>('.desktop-sessions > button.desktop-chat-folder, .desktop-sessions > button[data-chat-id]:not([data-nested])')||[]);
    const order=items.filter(item=>item.dataset.folderId!==id).map(item=>({folder:item.dataset.folderId,above:item.getBoundingClientRect().top+item.getBoundingClientRect().height/2<y}));
    const at=order.filter(item=>item.above).length;
    order.splice(at,0,{folder:id,above:false});
    changeFolders(old=>{
      const byId=new Map(old.map(f=>[f.id,f]));let loose=0;const next:ChatFolder[]=[];
      for(const item of order){
        if(!item.folder){loose++;continue;}
        const f=byId.get(item.folder);
        if(f){const {at:_old,...rest}=f;next.push(loose?{...rest,at:loose}:rest);byId.delete(item.folder);}
      }
      return [...next,...byId.values()];
    });
  }
  const flip=(key:string,set:(update:(old:Set<string>)=>Set<string>)=>void,id:string)=>set(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);writeIds(key,next);return next;});
  const archivedCount=allSessions.filter(s=>archived.has(s.sessionId)).length;
  const folderOf=new Map<string,string>();if(!showArchived)for(const f of folders)for(const c of f.chats)folderOf.set(c,f.id);
  // Archived chats leave the list; pinned ones lead it. The incoming order (running, then newest) is kept inside each part.
  const ordered=showArchived&&archivedCount?allSessions.filter(s=>archived.has(s.sessionId)):[...allSessions.filter(s=>!archived.has(s.sessionId)&&pinned.has(s.sessionId)),...allSessions.filter(s=>!archived.has(s.sessionId)&&!pinned.has(s.sessionId))];
  // Chats in a folder are listed under it; "Show more" pages the chats outside folders.
  const sessions=ordered.filter(s=>!folderOf.has(s.sessionId));
  const inFolder=(id:string)=>ordered.filter(s=>folderOf.get(s.sessionId)===id);
  // The open chat is always rendered, even when it is older than the first page.
  const focusIndex=focusId?sessions.findIndex(s=>s.sessionId===focusId):-1;
  const shown=sessions.slice(0,Math.max(limit,focusIndex+1)),hidden=sessions.length-shown.length;
  const laneOf=(s:Session):Provider=>s.provider==='codex'||s.provider==='copilot'||s.provider==='gemini'||s.provider==='claude'?s.provider:provider;
  const rows=()=>Array.from(tree.current?.querySelectorAll<HTMLButtonElement>('.desktop-sessions > button[data-chat-id]')||[]);
  useEffect(()=>{
    if(!marked.size)return;
    const known=new Set(ordered.map(s=>s.sessionId));
    if([...marked].some(id=>!known.has(id)))setMarked(new Set([...marked].filter(id=>known.has(id))));
  },[ordered,marked]);
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
  /** A selection may mix providers and accounts; each group is confirmed and deleted on its own. */
  function selectTarget(ids:string[]){
    const groups=new Map<string,Target&Scope>();
    for(const s of ordered){
      if(!ids.includes(s.sessionId))continue;
      const lane=laneOf(s),account=lane==='claude'?s.account||'':'',group=groups.get(lane+'|'+account);
      if(group)group.ids!.push(s.sessionId);else groups.set(lane+'|'+account,{ids:[s.sessionId],connection,provider:lane,account});
    }
    setQueue([...groups.values()]);
  }
  function openMenu(t:ChatActionTarget){
    if(marked.has(t.session.sessionId)){onCloseMenu();setMenu({x:t.x,y:t.y});}
    else{clear();const id=t.session.sessionId;onMenu({...t,select:()=>{anchor.current=id;setMarked(new Set([id]));},pin:{on:pinned.has(id),toggle:()=>flip(PINNED,setPinned,id)}});}
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
  const target=queue[0];
  return <>
    {marked.size>0&&<div className="desktop-list-caption"><span>{l('Selected','Выбрано')+' · '+marked.size}</span>
      <span className="bulk-toolbar"><button className="icon-button" aria-label={l('Delete selected chats','Удалить выбранные чаты')} disabled={!online} onClick={()=>selectTarget([...marked])}><Trash2 size={16}/></button><button className="icon-button" aria-label={l('Clear selection','Снять выделение')} onClick={clear}><X size={16}/></button></span>
    </div>}
    {!showArchived&&beforeChats}
    {!showArchived&&<div className="desktop-list-heading"><span className="desktop-list-heading-title">{l('Chats','Чаты')}</span><button type="button" className="icon-button desktop-list-heading-action desktop-new-folder" aria-label={l('New folder','Новая папка')} title={l('New folder','Новая папка')} onClick={()=>createFolder()}><FolderPlus size={16} aria-hidden="true"/></button></div>}
    <div ref={tree} className="desktop-session-groups desktop-chat-list">{loading&&!ordered.length?<p role="status">{l('Loading chats…','Загружаем чаты…')}</p>:
      <div className="desktop-sessions" onDragOver={e=>{if(e.dataTransfer.types.includes(CHAT_DRAG)||e.dataTransfer.types.includes(FOLDER_DRAG))e.preventDefault();}}
        onDrop={e=>{const folder=e.dataTransfer.getData(FOLDER_DRAG);if(folder){e.preventDefault();setDraggingFolder(undefined);placeFolder(folder,e.clientY);return;}const id=e.dataTransfer.getData(CHAT_DRAG);setDropTarget(undefined);if(id&&!(e.target as HTMLElement).closest('.desktop-chat-folder')){e.preventDefault();moveChat(id,null);}}}>{(()=>{
        let row=0;
        const chatRow=(s:Session,nested:boolean)=>{
          const index=++row;
          const job=jobs.get(s.sessionId),running=job?.status==='running',status=running&&job?.approvals?.length?'needs_input':job?.status,lane=laneOf(s);
          const title=s.customTitle||chatTitle(s.summary,l('Untitled chat','Без названия')),isMarked=marked.has(s.sessionId);
          return <Fragment key={s.sessionId}><button style={{gridRow:index}} data-chat-id={s.sessionId} data-provider={lane} data-running={running||undefined} data-marked={isMarked||undefined} data-nested={nested||undefined}
            draggable={!showArchived} onDragStart={e=>{e.dataTransfer.setData(CHAT_DRAG,s.sessionId);e.dataTransfer.effectAllowed='move';}}
            aria-description={running?l('Working','Работает'):undefined} onContextMenu={e=>{e.preventDefault();openMenu({session:s,x:e.clientX,y:e.clientY,running});}} onKeyDown={e=>key(e,s,running)}
            title={[s.customTitle||s.summary,providerNames[lane],s.board?(s.board.kind==='discussion'?l('Board discussion: ','Обсуждение доски: '):s.board.kind==='task'?l('Board task: ','Задача доски: '):l('Board: ','Доска: '))+s.board.title:'',s.cwd||'',fullTime(s.lastModified)].filter(Boolean).join(' · ')}
            aria-pressed={marked.size?isMarked:focusId===s.sessionId} onClick={e=>click(e,s)}>
            {isMarked?<Check size={14} className="marked-chat-check" aria-hidden="true"/>:status&&status!=='running'?<RunStatusDot status={status} className="desktop-chat-dot" labelled={false}/>:<span className="desktop-chat-dot" data-status="idle"/>}
            <span><strong>{pinned.has(s.sessionId)&&!showArchived&&<Pin className="desktop-chat-pin" size={12} aria-label={l('Pinned','Закреплён')}/>}{s.board&&<LayoutDashboard className="desktop-chat-board" size={13} aria-label={l('Board chat: ','Чат доски: ')+s.board.title}/>}{title}</strong>
              <small>{providerNames[lane]}{s.cwd?' · '+basename(s.cwd):''}{!status&&<> · <time title={fullTime(s.lastModified)}>{relativeTime(s.lastModified)}</time></>}</small>
              {status&&status!=='running'&&<small className="desktop-run-label"><ChatRunStatus status={status}/></small>}</span>{!status&&<time className="chat-row-time" title={fullTime(s.lastModified)}>{relativeTime(s.lastModified)}</time>}
          </button><ChatListActions session={s} provider={lane} connection={connection} jobId={job?.id} row={index} running={running} open={actionId===s.sessionId} onOpen={openMenu} onClose={onCloseMenu}/></Fragment>;
        };
        const folderRow=(f:ChatFolder)=>{
          const index=++row,chats=inFolder(f.id),Chevron=f.collapsed?ChevronRight:ChevronDown;
          const header=renaming===f.id
            ?<form className="desktop-chat-folder desktop-chat-folder-rename" style={{gridRow:index}} onSubmit={e=>{e.preventDefault();const name=new FormData(e.currentTarget).get('name')?.toString().trim();if(name)changeFolders(old=>old.map(x=>x.id===f.id?{...x,name:name.slice(0,120)}:x));setRenaming(undefined);}}>
               <Folder size={15} aria-hidden="true"/><input name="name" autoFocus aria-label={l('Folder name','Название папки')} defaultValue={f.name} maxLength={120} onFocus={e=>e.currentTarget.select()} onBlur={e=>e.currentTarget.form?.requestSubmit()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setRenaming(undefined);}}}/></form>
            :<><button type="button" className="desktop-chat-folder" style={{gridRow:index}} data-folder-id={f.id} data-drop={dropTarget===f.id||undefined} data-dragging={draggingFolder===f.id||undefined} aria-expanded={!f.collapsed}
               draggable={!showArchived} onDragStart={e=>{e.dataTransfer.setData(FOLDER_DRAG,f.id);e.dataTransfer.effectAllowed='move';setDraggingFolder(f.id);}} onDragEnd={()=>setDraggingFolder(undefined)}
               onClick={()=>changeFolders(old=>old.map(x=>x.id===f.id?{...x,collapsed:!x.collapsed}:x))} onDoubleClick={()=>setRenaming(f.id)}
               onContextMenu={e=>{e.preventDefault();setFolderMenu({id:f.id,x:e.clientX,y:e.clientY});}}
               onDragOver={e=>{if(e.dataTransfer.types.includes(CHAT_DRAG)){e.preventDefault();e.stopPropagation();setDropTarget(f.id);}}} onDragLeave={()=>setDropTarget(old=>old===f.id?undefined:old)}
               onDrop={e=>{const id=e.dataTransfer.getData(CHAT_DRAG);setDropTarget(undefined);if(id){e.preventDefault();e.stopPropagation();moveChat(id,f.id);}}}>
               <Chevron size={15} aria-hidden="true"/><Folder size={15} aria-hidden="true"/><strong>{f.name}</strong><small>{chats.length}</small></button>
              <span className="chat-list-action-slot desktop-folder-actions" style={{gridRow:index}}><button type="button" className="chat-list-action" aria-label={l('Folder actions','Действия папки')} aria-description={f.name} aria-haspopup="menu" aria-expanded={folderMenu?.id===f.id}
               onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();setFolderMenu(folderMenu?.id===f.id?undefined:{id:f.id,x:rect.right+6,y:rect.top});}}><MoreHorizontal size={18} aria-hidden="true"/></button></span></>;
          return <Fragment key={f.id}>{header}{!f.collapsed&&chats.map(s=>chatRow(s,true))}</Fragment>;
        };
        // Each folder stands before the chat at its place; a place past the shown chats puts it after the last one.
        const placed=showArchived?[]:folders.map((f,i)=>({f,i,at:f.at??0})).sort((a,b)=>a.at-b.at||a.i-b.i);
        const out:ReactNode[]=[];let next=0;
        for(let k=0;k<=shown.length;k++){
          while(next<placed.length&&(placed[next].at<=k||k===shown.length))out.push(folderRow(placed[next++].f));
          if(k<shown.length)out.push(chatRow(shown[k],false));
        }
        return <>{out}</>;
      })()}</div>}
      {hidden>0&&<button type="button" className="rail-action desktop-more-chats" onClick={()=>setLimit(shown.length+CHAT_PAGE)}><ChevronDown size={16} aria-hidden="true"/><span>{l('Show more chats','Показать ещё чаты')} · {hidden}</span></button>}
      {!loading&&!ordered.length&&!online&&<p className="muted">{l('Chats will load when the local server is available.','Чаты загрузятся, когда локальный сервер будет доступен.')}</p>}
    </div>
    {folderMenu&&<CardActionMenu point={folderMenu} label={l('Folder actions','Действия папки')} onClose={()=>setFolderMenu(undefined)} items={[
      {label:l('Rename','Переименовать'),Icon:Pencil,onSelect:()=>{setRenaming(folderMenu.id);setFolderMenu(undefined);}},
      {label:l('Delete folder','Удалить папку'),Icon:Trash2,danger:true,onSelect:()=>{changeFolders(old=>old.filter(f=>f.id!==folderMenu.id));setFolderMenu(undefined);}}]}/>}
    {menu&&<CardActionMenu point={menu} label={l('Selected chat actions','Действия выбранных чатов')} onClose={()=>setMenu(undefined)}
      items={[{label:l('Delete selected chats','Удалить выбранные чаты'),Icon:Trash2,danger:true,disabled:!online,onSelect:()=>selectTarget([...marked])}]}/>}
    {target&&<DeleteChatsDialog key={target.provider+'|'+target.account} connection={target.connection} provider={target.provider} account={target.account} target={{ids:target.ids}} onClose={()=>setQueue(old=>old.slice(1))} onDeleted={ids=>{onDeleted(ids,target.provider);setMarked(old=>{const next=new Set(old);for(const id of ids)next.delete(id);return next;});}}/>}
  </>;
}
