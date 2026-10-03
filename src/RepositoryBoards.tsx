import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Folder,ChevronRight,Plus} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import type {BoardView} from './WorkBoards';
export function RepositoryBoards({connection,roots,onOpen}:{connection:Connection;roots:string[];onOpen(board:BoardView):void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [missing,setMissing]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const epoch=useRef(0),lock=useRef(false);
 useEffect(()=>{epoch.current++;setMissing('');setError('');return()=>{epoch.current++;};},[connection.url,connection.token,roots.join('|')]);
 async function open(root:string,create=false){if(lock.current)return;lock.current=true;setBusy(root);setError('');const generation=epoch.current;
  try{const board=create?await request<BoardView>(connection,'/project-board/create',{root,language:ru?'ru':'en'}):(await request<{board:BoardView|null}>(connection,'/project-board?root='+encodeURIComponent(root))).board;
   if(generation!==epoch.current)return;if(board){setMissing('');onOpen({...board,name:root.split(/[\\/]/).filter(Boolean).at(-1)||board.name});}else setMissing(root);
  }catch(e){if(generation===epoch.current)setError((e as Error).message);}finally{lock.current=false;setBusy('');}
 }
 return <div className="board-index project-board-index">{error&&<p role="alert">{error}</p>}{!roots.length&&<p>{l('No projects available. Connect to the PC or join a workspace.','Нет доступных проектов. Подключитесь к ПК или рабочей области.')}</p>}{[...new Set(roots)].map(root=><div key={root} className="project-board-row"><button className="board-index-item" disabled={!!busy} onClick={()=>void open(root)}><Folder size={22}/><span><strong>{root.split(/[\\/]/).filter(Boolean).at(-1)||root}</strong><small>{busy===root?l('Opening…','Открываем…'):l('Project board','Доска проекта')}</small></span><ChevronRight size={18}/></button>{missing===root&&<div className="project-board-create"><p>{l('This project does not have a board yet.','У этого проекта пока нет доски.')}</p><button className="primary" disabled={!!busy} onClick={()=>void open(root,true)}><Plus size={18}/>{l('Create project board','Создать доску проекта')}</button></div>}</div>)}</div>;
}
