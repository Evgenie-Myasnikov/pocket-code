import {useEffect,useRef} from 'react';

/** Context actions preserve a card showing only its board and project names. */
export function ProjectBoardCard({name,project,disabled,busy,onOpen,onDelete}:{name:string;project:string;disabled:boolean;busy:boolean;onOpen():void;onDelete?:()=>void}){
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),start=useRef<{x:number;y:number}|null>(null),held=useRef(false);
 const cancel=()=>{clearTimeout(timer.current);start.current=null;};
 useEffect(()=>()=>cancel(),[]);
 return <button className="board-index-item" disabled={disabled} aria-busy={busy}
  onClick={()=>{if(held.current){held.current=false;return;}onOpen();}}
  onContextMenu={e=>{if(onDelete){e.preventDefault();cancel();if(!held.current)onDelete();}}}
  onKeyDown={e=>{if(onDelete&&(e.key==='Delete'||e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')){e.preventDefault();cancel();onDelete();}}}
  onPointerDown={e=>{held.current=false;cancel();if(e.button!==0||!onDelete)return;start.current={x:e.clientX,y:e.clientY};timer.current=setTimeout(()=>{held.current=true;onDelete();cancel();},550);}}
  onPointerMove={e=>{if(start.current&&Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>8)cancel();}}
  onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}>
  <span><strong>{name}</strong><small>{project}</small></span>
 </button>;
}
