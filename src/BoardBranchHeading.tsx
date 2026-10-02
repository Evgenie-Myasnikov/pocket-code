import {useEffect,useRef} from 'react';

export function BoardBranchHeading({name,left,disabled,onRename}:{name:string;left:number;disabled:boolean;onRename():void}){
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const start=useRef<{x:number;y:number}|null>(null);
  const cancel=()=>{clearTimeout(timer.current);start.current=null;};
  useEffect(()=>cancel,[]);
  return <button className="board-version" style={{left}} disabled={disabled} aria-label={name}
    onPointerDown={e=>{cancel();if(e.button!==0||!e.isPrimary)return;e.currentTarget.setPointerCapture(e.pointerId);start.current={x:e.clientX,y:e.clientY};timer.current=setTimeout(()=>{cancel();onRename();},550);}}
    onPointerMove={e=>{if(start.current&&Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>8)cancel();}}
    onPointerUp={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel}
    onContextMenu={e=>{e.preventDefault();cancel();if(!disabled)onRename();}}
    onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onRename();}}}><strong>{name}</strong></button>;
}
