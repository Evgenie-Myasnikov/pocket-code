import {useEffect,useRef,useState,type RefObject} from 'react';
import {Plus} from 'lucide-react';
import {useLanguage} from './i18n';

export function BoardContextMenu({viewport,boardId,zoom,enabled,onCreate}:{viewport:RefObject<HTMLDivElement|null>;boardId:string|undefined;zoom:number;enabled:boolean;onCreate(point:{x:number;y:number}):void}){
  const [position,setPosition]=useState<{left:number;top:number;x:number;y:number}|null>(null);
  const button=useRef<HTMLButtonElement>(null),scale=useRef(zoom);scale.current=zoom;
  const ru=useLanguage()==='ru';
  useEffect(()=>{if(position)button.current?.focus({preventScroll:true});},[position]);
  useEffect(()=>{
    const el=viewport.current;setPosition(null);if(!el||!enabled)return;
    let timer:ReturnType<typeof setTimeout>|undefined,start:{x:number;y:number;id:number}|null=null;
    const pointers=new Set<number>();
    const cancel=()=>{clearTimeout(timer);timer=undefined;start=null;};
    const empty=(target:EventTarget|null)=>target instanceof Element&&!target.closest('.board-note,button,input,select,textarea');
    const show=(x:number,y:number)=>{const rect=el.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(x,window.innerWidth-232)),top:Math.max(8,Math.min(y,window.innerHeight-64)),x:Math.max(0,Math.min(19500,(el.scrollLeft+x-rect.left)/scale.current)),y:Math.max(60,Math.min(19500,(el.scrollTop+y-rect.top)/scale.current))});};
    const down=(e:PointerEvent)=>{pointers.add(e.pointerId);cancel();if(pointers.size!==1||e.button!==0||!empty(e.target))return;start={x:e.clientX,y:e.clientY,id:e.pointerId};timer=setTimeout(()=>{if(start){show(start.x,start.y);cancel();}},550);};
    const move=(e:PointerEvent)=>{if(start&&e.pointerId===start.id&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)cancel();};
    const end=(e:PointerEvent)=>{pointers.delete(e.pointerId);cancel();};
    const dismiss=()=>{cancel();setPosition(null);};
    const outside=(e:PointerEvent)=>{if(!button.current?.contains(e.target as Node))setPosition(null);};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')dismiss();};
    const context=(e:MouseEvent)=>{if(empty(e.target)){e.preventDefault();cancel();if((e as PointerEvent).pointerType!=='touch')show(e.clientX,e.clientY);}};
    el.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);el.addEventListener('contextmenu',context);el.addEventListener('scroll',dismiss);el.addEventListener('wheel',dismiss);window.addEventListener('blur',dismiss);window.addEventListener('resize',dismiss);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    return()=>{cancel();el.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);el.removeEventListener('contextmenu',context);el.removeEventListener('scroll',dismiss);el.removeEventListener('wheel',dismiss);window.removeEventListener('blur',dismiss);window.removeEventListener('resize',dismiss);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};
  },[boardId,enabled]);
  if(!position||!enabled)return null;
  return <div className="board-context-menu" role="menu" style={{left:position.left,top:position.top}}><button ref={button} role="menuitem" onClick={()=>{onCreate({x:position.x,y:position.y});setPosition(null);}}><Plus size={18}/>{ru?'Создать заметку':'Create note'}</button></div>;
}
