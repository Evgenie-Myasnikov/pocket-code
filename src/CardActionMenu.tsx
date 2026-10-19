import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import type {LucideIcon} from 'lucide-react';
import {useBackAction} from './navigation';

export type CardAction={label:string;Icon?:LucideIcon;danger?:boolean;disabled?:boolean;current?:boolean;onSelect():void};
/** Long-press / right-click menu for a card: useful actions first, the destructive one last after a separator. */
export function CardActionMenu({label,point,items,onClose}:{label:string;point:{x:number;y:number};items:CardAction[];onClose():void}){
  const menu=useRef<HTMLDivElement>(null),previous=useRef<HTMLElement|null>(null),latest=useRef(onClose);latest.current=onClose;
  useBackAction(()=>{onClose();return true;},110,true);
  useEffect(()=>{previous.current=document.activeElement instanceof HTMLElement?document.activeElement:null;return()=>{if(previous.current?.isConnected)previous.current.focus({preventScroll:true});};},[]);
  useEffect(()=>{menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus({preventScroll:true});},[items.map(item=>item.label).join('|')]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))latest.current();};
    const close=()=>latest.current();
    const timer=setTimeout(()=>document.addEventListener('pointerdown',outside),0);window.addEventListener('resize',close);window.addEventListener('blur',close);
    return()=>{clearTimeout(timer);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',close);window.removeEventListener('blur',close);};
  },[]);
  const move=(event:React.KeyboardEvent)=>{
    const buttons=[...(menu.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)')||[])],index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='ArrowDown'?index+1:event.key==='ArrowUp'?index-1:event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
    if(next===null){if(event.key==='Tab'){event.preventDefault();onClose();}return;}
    event.preventDefault();buttons[(next+buttons.length)%buttons.length]?.focus();
  };
  const width=240,left=Math.max(8,Math.min(point.x,window.innerWidth-width-8)),top=Math.max(8,Math.min(point.y,window.innerHeight-items.length*48-24));
  const firstDanger=items.findIndex(item=>item.danger);
  return createPortal(<div ref={menu} className="board-context-menu card-action-menu" role="menu" aria-label={label} style={{left,top}} onKeyDown={move} onContextMenu={e=>e.preventDefault()}>
    {items.map((item,index)=><div key={item.label} role="none">{index===firstDanger&&index>0&&<hr role="separator" aria-hidden="true"/>}<button type="button" role="menuitem" className={item.danger?'danger':undefined} disabled={item.disabled} aria-current={item.current||undefined} onClick={()=>{onClose();item.onSelect();}}>{item.Icon&&<item.Icon size={20} aria-hidden="true"/>}<span>{item.label}</span></button></div>)}
  </div>,document.body);
}
