import {useEffect,useRef} from 'react';
import {BoardPreview,type BoardPreviewData} from './BoardPreview';
import {t} from './i18n';
import {taskStageLabel,type TaskDisplayStage} from './task-run-ui';

export type BoardTaskSummary={stage:TaskDisplayStage;waiting:number};
/** Long-press or right-click opens the card's action menu (Delete is its last item); the Delete key still deletes directly. */
export function ProjectBoardCard({name,project,preview,miro,tasks,disabled,busy,onOpen,onDelete,onMenu}:{name:string;project:string;preview?:BoardPreviewData;miro?:boolean;tasks?:BoardTaskSummary;disabled:boolean;busy:boolean;onOpen():void;onDelete?:()=>void;onMenu?:(point:{x:number;y:number})=>void}){
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),start=useRef<{x:number;y:number}|null>(null),held=useRef(false);
 const cancel=()=>{clearTimeout(timer.current);start.current=null;};
 useEffect(()=>()=>cancel(),[]);
 const action=onMenu||onDelete,more=(point:{x:number;y:number})=>{if(onMenu)onMenu(point);else onDelete?.();};
 return <button className={'board-index-item'+(preview||miro?' has-preview':'')} disabled={disabled} aria-busy={busy}
  onClick={()=>{if(held.current){held.current=false;return;}onOpen();}}
  onContextMenu={e=>{if(action){e.preventDefault();cancel();if(!held.current)more({x:e.clientX,y:e.clientY});}}}
  onKeyDown={e=>{if(onDelete&&e.key==='Delete'){e.preventDefault();cancel();onDelete();}else if(action&&(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')){e.preventDefault();cancel();const box=e.currentTarget.getBoundingClientRect();more({x:box.left+16,y:box.top+24});}}}
  onPointerDown={e=>{held.current=false;cancel();if(e.button!==0||!action)return;const point={x:e.clientX,y:e.clientY};start.current=point;timer.current=setTimeout(()=>{held.current=true;more(point);cancel();},550);}}
  onPointerMove={e=>{if(start.current&&Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>8)cancel();}}
  onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}>
  {miro?<div className="board-preview-stage board-preview-miro" aria-hidden="true"><span className="board-miro-mark">M</span></div>:preview&&<BoardPreview board={preview}/>}
  <span><strong>{name}</strong><small>{miro?<span className="board-kind-badge">Miro</span>:project}</small>{tasks&&<small className="project-board-tasks"><span className={'task-stage-dot task-stage-'+tasks.stage} aria-hidden="true"/>{tasks.waiting?t('Ждут вас: {0}',tasks.waiting):taskStageLabel(tasks.stage)}</small>}</span>
 </button>;
}
