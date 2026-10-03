import {useEffect,useState} from 'react';
import {RefreshCw,FileText} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import type {BoardView} from './WorkBoards';

export function RepositoryBoards({connection,roots,onOpen}:{connection:Connection;roots:string[];onOpen(board:BoardView):void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [root,setRoot]=useState(roots[0]||''),[items,setItems]=useState<{file:string;name:string;noteCount:number}[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{if(!roots.includes(root))setRoot(roots[0]||'');},[roots.join('|'),root]);
 useEffect(()=>{let active=true;setItems([]);setError('');if(!root)return;setBusy(true);void request<typeof items>(connection,'/repository-boards?root='+encodeURIComponent(root)).then(result=>{if(active)setItems(result);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[root,connection.url,connection.token,refresh]);
 return <div className="board-index"><div className="board-toolbar"><label>{l('Repository','Репозиторий')}<select value={root} disabled={busy} onChange={e=>setRoot(e.target.value)}>{roots.map(r=><option key={r} value={r}>{r.split(/[\\/]/).at(-1)}</option>)}</select></label><button className="icon-button" disabled={busy||!root} aria-label={l('Refresh boards','Обновить доски')} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={20}/></button></div>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">{l('Loading boards…','Загрузка досок…')}</p>}{!busy&&!error&&!items.length&&<p>{l('No boards in this repository yet. Save a board in project-boards to display it here.','В этом репозитории пока нет досок. Сохраните доску в project-boards, чтобы она появилась здесь.')}</p>}{items.map(item=><button className="board-index-item" disabled={busy} key={item.file} onClick={async()=>{setBusy(true);setError('');try{onOpen(await request<BoardView>(connection,'/repository-board?root='+encodeURIComponent(root)+'&file='+encodeURIComponent(item.file)));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><FileText size={20}/><strong>{item.name}</strong><span>{item.noteCount} {l('notes','заметок')}</span></button>)}</div>;
}
