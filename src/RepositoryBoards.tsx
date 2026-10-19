import type {BoardPreviewData} from './BoardPreview';
import {ProjectBoardCard,type BoardTaskSummary} from './ProjectBoardCard';
import {CardActionMenu} from './CardActionMenu';
import {latestRuns,taskDisplayStage,type TaskDisplayStage,type TaskRun} from './task-run-ui';
import {DeleteProjectBoard} from './DeleteProjectBoard';
import {MiroBoard} from './MiroBoard';
import {miroLink} from './miro-link';
﻿import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Plus,Search,PanelTop,Trash2} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage,t} from './i18n';
import type {BoardView} from './WorkBoards';
import {hostDown,retryNow,useReachability} from './reachability';
import './connection-status.css';
const urgency:TaskDisplayStage[]=['questions','failed','review','checks','working','prepared','approved'];
/** The host stores real paths with backslashes; a configured root may use forward slashes or a trailing separator. */
const pathKey=(value:string)=>value.replace(/[\\/]+/g,'/').replace(/\/$/,'').toLowerCase();
/** One request for every task run: the gallery shows what waits for the person per project, without per-board polling. */
function summarize(runs:TaskRun[]){const result:Record<string,BoardTaskSummary>={};for(const run of latestRuns(runs).values()){const key=pathKey(run.projectPath),stage=taskDisplayStage(run),known=result[key];if(stage==='approved'&&!known)continue;result[key]={stage:known&&urgency.indexOf(known.stage)<urgency.indexOf(stage)?known.stage:stage,waiting:(known?.waiting||0)+(stage==='questions'?1:0)};}return result;}
export function RepositoryBoards({connection,roots,onOpen}:{connection:Connection;roots:string[];onOpen(board:BoardView):void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [miro,setMiro]=useState<{root:string;url:string}|null>(null),[boardNames,setBoardNames]=useState<Record<string,string>>({}),[kind,setKind]=useState<'repository'|'miro'>('repository'),[miroUrl,setMiroUrl]=useState('');
 const [existing,setExisting]=useState<string[]>([]),[missing,setMissing]=useState<string[]>([]),[failed,setFailed]=useState<string[]>([]);
 const [query,setQuery]=useState('');
 const [adding,setAdding]=useState(false),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const [menu,setMenu]=useState<{root:string;point:{x:number;y:number}}|null>(null),[tasks,setTasks]=useState<Record<string,BoardTaskSummary>>({});
 const [deleting,setDeleting]=useState<string|null>(null),[records,setRecords]=useState<Record<string,{miro:boolean;revision?:string;canEdit:boolean;preview?:BoardPreviewData}>>({});
 const epoch=useRef(0),lock=useRef(false),reach=useReachability(),away=hostDown(reach);
 // The PC answering again reloads the gallery at once instead of waiting for the next manual refresh.
 useEffect(()=>{const recovered=()=>setRevision(v=>v+1);window.addEventListener('pocket-recovered',recovered);return()=>window.removeEventListener('pocket-recovered',recovered);},[]);
 const name=(root:string)=>root.split(/[\\/]/).filter(Boolean).at(-1)||root;
 useEffect(()=>{const generation=++epoch.current;setMiro(null);setDeleting(null);setMenu(null);setTasks({});setRecords({});setBoardNames({});setExisting([]);setMissing([]);setFailed([]);setAdding(false);setSelected('');setError('');setLoading(true);
  const queue=[...new Set(roots)],found:string[]=[],titles:Record<string,string>={},metadata:Record<string,{miro:boolean;revision?:string;canEdit:boolean;preview?:BoardPreviewData}>={},absent:string[]=[],unavailable:string[]=[];let cursor=0;
  void Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(cursor<queue.length&&generation===epoch.current){const root=queue[cursor++];try{const result=await request<{board:BoardView|null;miro?:{root:string;url:string};canEdit?:boolean}>(connection,'/project-board?root='+encodeURIComponent(root));(result.board||result.miro?found:absent).push(root);if(result.board||result.miro){titles[root]=result.miro?name(root):result.board!.name;metadata[root]={preview:result.board?{versions:result.board.versions,notes:result.board.notes.map(({x,y,branch,status,title})=>({x,y,branch,status,title}))}:undefined,miro:!!result.miro,revision:result.board?.repositoryRevision,canEdit:result.canEdit!==false};}}catch{unavailable.push(root);}}})).then(()=>{if(generation!==epoch.current)return;void request<{runs:TaskRun[]}>(connection,'/task-runs').then(data=>{if(generation===epoch.current&&Array.isArray(data?.runs))setTasks(summarize(data.runs));}).catch(()=>{/* Older hosts and shared workspaces have no task runs. */});setBoardNames(titles);setRecords(metadata);setExisting(queue.filter(r=>found.includes(r)));setMissing(queue.filter(r=>absent.includes(r)));setFailed(unavailable);setLoading(false);});
  return()=>{epoch.current++;};
 },[connection.url,connection.token,roots.join('|'),revision]);
 async function open(root:string,create=false){if(lock.current)return;lock.current=true;setBusy(root);setError('');const generation=epoch.current;
  try{if(create&&kind==='miro'){const url=miroLink(miroUrl).url;const result=await request<{miro:{root:string;url:string}}>(connection,'/project-board/miro',{root,url});if(generation===epoch.current)setMiro(result.miro);return;}
   if(!create){const result=await request<{board:BoardView|null;miro?:{root:string;url:string}}>(connection,'/project-board?root='+encodeURIComponent(root));if(generation!==epoch.current)return;if(result.miro){setMiro(result.miro);return;}if(result.board){onOpen(result.board);return;}}
   const board=create?await request<BoardView>(connection,'/project-board/create',{root,language:ru?'ru':'en'}):(await request<{board:BoardView|null}>(connection,'/project-board?root='+encodeURIComponent(root))).board;
   if(generation!==epoch.current)return;if(board)onOpen(board);else{setExisting(old=>old.filter(r=>r!==root));setMissing(old=>[...new Set([...old,root])]);}
  }catch(e){if(generation===epoch.current)setError((e as Error).message);}finally{lock.current=false;setBusy('');}
 }
 if(miro)return <MiroBoard url={miro.url} name={name(miro.root)} onBack={()=>{setMiro(null);setRevision(v=>v+1);}} onDisconnect={async()=>{await request(connection,'/project-board/miro',{root:miro.root,url:null});setMiro(null);setRevision(v=>v+1);}}/>;
 return <div className="board-index project-board-index">
  <div className="board-index-actions"><label className="board-gallery-search"><Search size={20}/><input aria-label={l('Find board','Найти доску')} placeholder={l('Find board','Найти доску')} value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="secondary" disabled={loading||!!busy||!missing.length||away} title={away?t('Доступно, когда ПК на связи'):undefined} onClick={()=>{setAdding(v=>!v);setSelected(missing[0]||'');}}><Plus size={20}/>{l('Add project board','Добавить доску проекта')}</button><button className="icon-button" aria-label={l('Refresh boards','Обновить доски')} disabled={loading||!!busy} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={20}/></button></div>
  {adding&&<form className="project-board-create" onSubmit={event=>{event.preventDefault();if(selected)void open(selected,true);}}><label>{l('Project','Проект')}<select aria-label={l('Project for new board','Проект для новой доски')} value={selected} onChange={e=>setSelected(e.target.value)}>{missing.map(root=><option key={root} value={root}>{name(root)}</option>)}</select></label><label>{l('Board type','Тип доски')}<select value={kind} onChange={e=>setKind(e.target.value as 'repository'|'miro')}><option value="repository">{l('Repository board','Доска репозитория')}</option><option value="miro">Miro</option></select></label>{kind==='miro'&&<label>{l('Miro board link','Ссылка на доску Miro')}<input type="url" required maxLength={2048} value={miroUrl} placeholder="https://miro.com/app/board/…" onChange={e=>setMiroUrl(e.target.value)}/></label>}<button className="primary" disabled={!!busy||!selected}>{kind==='miro'?l('Connect Miro board','Подключить доску Miro'):l('Create project board','Создать доску проекта')}</button></form>}
  {error&&<p role="alert">{error}</p>}{loading&&!existing.length&&<div className="loading-skeleton" role="status" aria-label={l('Loading boards…','Загружаем доски…')}><span/><span/></div>}
  {/* "No boards" is said only after the PC answered for at least one project; offline the gallery says why it is empty. */}
  {!loading&&!existing.length&&(away||!roots.length&&reach.status!=='online'||roots.length>0&&failed.length===new Set(roots).size)?<div className="offline-empty" role="status"><p>{away||!roots.length?t('Доски пока недоступны офлайн. Они появятся, когда ПК будет на связи.'):t('Не удалось проверить проекты.')}</p><button className="secondary" onClick={()=>{retryNow();setRevision(v=>v+1);}}>{t('Повторить')}</button></div>
  :<>{!!failed.length&&<p role="alert">{l('Some projects could not be checked. Refresh to retry.','Некоторые проекты не удалось проверить. Обновите список, чтобы повторить.')}</p>}
  {!loading&&!existing.length&&<p>{l('No project boards yet. Add one when you need it.','Досок проектов пока нет. Добавьте доску, когда она понадобится.')}</p>}</>}
  <div className="project-board-grid">{[...existing].sort((a,b)=>(boardNames[a]||name(a)).localeCompare(boardNames[b]||name(b),undefined,{sensitivity:'base'})||name(a).localeCompare(name(b))).filter(root=>!query.trim()||(boardNames[root]+' '+name(root)).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(root=><div key={root} className="project-board-row"><ProjectBoardCard name={boardNames[root]} project={name(root)} preview={records[root]?.preview} miro={records[root]?.miro} tasks={tasks[pathKey(root)]} disabled={!!busy} busy={busy===root} onOpen={()=>void open(root)} onDelete={records[root]?.canEdit?()=>setDeleting(root):undefined} onMenu={point=>setMenu({root,point})}/></div>)}</div>
  {menu&&<CardActionMenu label={t('Действия с доской «{0}»',boardNames[menu.root]||name(menu.root))} point={menu.point} onClose={()=>setMenu(null)} items={[{label:t('Открыть'),Icon:PanelTop,onSelect:()=>void open(menu.root)},...(records[menu.root]?.canEdit?[{label:t('Удалить…'),Icon:Trash2,danger:true,onSelect:()=>setDeleting(menu.root)}]:[])]}/>}
  {deleting&&<DeleteProjectBoard connection={connection} root={deleting} name={boardNames[deleting]} miro={records[deleting].miro} repositoryRevision={records[deleting].revision} onClose={()=>setDeleting(null)} onDeleted={()=>{setDeleting(null);setRevision(v=>v+1);}}/>}
 </div>;
}
