import {MiroBoard} from './MiroBoard';
import {miroLink} from './miro-link';
﻿import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Folder,Plus} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import type {BoardView} from './WorkBoards';
export function RepositoryBoards({connection,roots,onOpen}:{connection:Connection;roots:string[];onOpen(board:BoardView):void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [miro,setMiro]=useState<{root:string;url:string}|null>(null),[miroRoots,setMiroRoots]=useState<string[]>([]),[kind,setKind]=useState<'repository'|'miro'>('repository'),[miroUrl,setMiroUrl]=useState('');
 const [existing,setExisting]=useState<string[]>([]),[missing,setMissing]=useState<string[]>([]),[failed,setFailed]=useState<string[]>([]);
 const [adding,setAdding]=useState(false),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const epoch=useRef(0),lock=useRef(false);
 useEffect(()=>{const generation=++epoch.current;setMiro(null);setMiroRoots([]);setExisting([]);setMissing([]);setFailed([]);setAdding(false);setSelected('');setError('');setLoading(true);
  const queue=[...new Set(roots)],found:string[]=[],linked:string[]=[],absent:string[]=[],unavailable:string[]=[];let cursor=0;
  void Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(cursor<queue.length&&generation===epoch.current){const root=queue[cursor++];try{const result=await request<{board:BoardView|null;miro?:{root:string;url:string}}>(connection,'/project-board?root='+encodeURIComponent(root));(result.board||result.miro?found:absent).push(root);if(result.miro)linked.push(root);}catch{unavailable.push(root);}}})).then(()=>{if(generation!==epoch.current)return;setMiroRoots(linked);setExisting(queue.filter(r=>found.includes(r)));setMissing(queue.filter(r=>absent.includes(r)));setFailed(unavailable);setLoading(false);});
  return()=>{epoch.current++;};
 },[connection.url,connection.token,roots.join('|'),revision]);
 async function open(root:string,create=false){if(lock.current)return;lock.current=true;setBusy(root);setError('');const generation=epoch.current;
  try{if(create&&kind==='miro'){const url=miroLink(miroUrl).url;const result=await request<{miro:{root:string;url:string}}>(connection,'/project-board/miro',{root,url});if(generation===epoch.current)setMiro(result.miro);return;}
   if(!create){const result=await request<{board:BoardView|null;miro?:{root:string;url:string}}>(connection,'/project-board?root='+encodeURIComponent(root));if(generation!==epoch.current)return;if(result.miro){setMiro(result.miro);return;}if(result.board){onOpen({...result.board,name:root.split(/[\\/]/).filter(Boolean).at(-1)||result.board.name});return;}}
   const board=create?await request<BoardView>(connection,'/project-board/create',{root,language:ru?'ru':'en'}):(await request<{board:BoardView|null}>(connection,'/project-board?root='+encodeURIComponent(root))).board;
   if(generation!==epoch.current)return;if(board)onOpen({...board,name:root.split(/[\\/]/).filter(Boolean).at(-1)||board.name});else{setExisting(old=>old.filter(r=>r!==root));setMissing(old=>[...new Set([...old,root])]);}
  }catch(e){if(generation===epoch.current)setError((e as Error).message);}finally{lock.current=false;setBusy('');}
 }
 const name=(root:string)=>root.split(/[\\/]/).filter(Boolean).at(-1)||root;
 if(miro)return <MiroBoard url={miro.url} name={name(miro.root)} onBack={()=>{setMiro(null);setRevision(v=>v+1);}} onDisconnect={async()=>{await request(connection,'/project-board/miro',{root:miro.root,url:null});setMiro(null);setRevision(v=>v+1);}}/>;
 return <div className="board-index project-board-index">
  <div className="board-index-actions"><button className="secondary" disabled={loading||!!busy||!missing.length} onClick={()=>{setAdding(v=>!v);setSelected(missing[0]||'');}}><Plus size={18}/>{l('Add project board','Добавить доску проекта')}</button><button className="icon-button" aria-label={l('Refresh boards','Обновить доски')} disabled={loading||!!busy} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18}/></button></div>
  {adding&&<form className="project-board-create" onSubmit={event=>{event.preventDefault();if(selected)void open(selected,true);}}><label>{l('Project','Проект')}<select aria-label={l('Project for new board','Проект для новой доски')} value={selected} onChange={e=>setSelected(e.target.value)}>{missing.map(root=><option key={root} value={root}>{name(root)}</option>)}</select></label><label>{l('Board type','Тип доски')}<select value={kind} onChange={e=>setKind(e.target.value as 'repository'|'miro')}><option value="repository">{l('Repository board','Доска репозитория')}</option><option value="miro">Miro</option></select></label>{kind==='miro'&&<label>{l('Miro board link','Ссылка на доску Miro')}<input type="url" required maxLength={2048} value={miroUrl} placeholder="https://miro.com/app/board/…" onChange={e=>setMiroUrl(e.target.value)}/></label>}<button className="primary" disabled={!!busy||!selected}>{kind==='miro'?l('Connect Miro board','Подключить доску Miro'):l('Create project board','Создать доску проекта')}</button></form>}
  {error&&<p role="alert">{error}</p>}{loading&&<p role="status">{l('Loading boards…','Загружаем доски…')}</p>}
  {!!failed.length&&<p role="alert">{l('Some projects could not be checked. Refresh to retry.','Некоторые проекты не удалось проверить. Обновите список, чтобы повторить.')}</p>}
  {!loading&&!existing.length&&<p>{l('No project boards yet. Add one when you need it.','Досок проектов пока нет. Добавьте доску, когда она понадобится.')}</p>}
  {existing.map(root=><div key={root} className="project-board-row"><button className="board-index-item" disabled={!!busy} onClick={()=>void open(root)}><Folder size={22}/><span><strong>{name(root)}</strong><small>{busy===root?l('Opening…','Открываем…'):miroRoots.includes(root)?'Miro':l('Project board','Доска проекта')}</small></span></button></div>)}
 </div>;
}
