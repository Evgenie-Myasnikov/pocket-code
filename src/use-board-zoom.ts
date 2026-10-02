import {useEffect,useLayoutEffect,useRef,type RefObject} from 'react';

// Keep the canvas point beneath the cursor/fingers fixed while its layout changes.
export function useBoardZoom(viewport:RefObject<HTMLDivElement|null>,boardId:string|undefined,zoom:number,setZoom:(value:number)=>void){
  const current=useRef(zoom),pending=useRef<{left:number;top:number}|null>(null);
  useLayoutEffect(()=>{current.current=zoom;const el=viewport.current;if(el&&pending.current){el.scrollLeft=pending.current.left;el.scrollTop=pending.current.top;pending.current=null;}},[zoom]);
  useEffect(()=>{
    const el=viewport.current;if(!el)return;
    let last:{x:number;y:number;distance:number}|null=null,suppressUntil=0,draggingNote=false;
    const change=(next:number,x:number,y:number,dx=0,dy=0)=>{
      next=Math.max(.15,Math.min(3,next));const old=current.current;
      const left=(el.scrollLeft+x)/old*next-x-dx,top=(el.scrollTop+y)/old*next-y-dy;
      if(next===old){el.scrollLeft=left;el.scrollTop=top;return;}
      pending.current={left,top};current.current=next;setZoom(next);
    };
    const wheel=(e:WheelEvent)=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const box=el.getBoundingClientRect();change(current.current*Math.exp(-e.deltaY*(e.deltaMode===1?.04:.002)),e.clientX-box.left,e.clientY-box.top);};
    const point=(touches:TouchList)=>{const a=touches[0],b=touches[1]||a,box=el.getBoundingClientRect();return {x:(a.clientX+b.clientX)/2-box.left,y:(a.clientY+b.clientY)/2-box.top,distance:touches.length>1?Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY):0};};
    const start=(e:TouchEvent)=>{if(e.touches.length===1){delete el.dataset.pinching;draggingNote=!!(e.target as Element).closest('.note-drag');}if(e.touches.length>1){draggingNote=false;el.dataset.pinching='true';}last=point(e.touches);};
    const move=(e:TouchEvent)=>{if(!last||!e.touches.length||draggingNote)return;e.preventDefault();const next=point(e.touches);const dx=next.x-last.x,dy=next.y-last.y;if(Math.abs(dx)+Math.abs(dy)>2||next.distance!==last.distance)suppressUntil=Date.now()+400;change(last.distance&&next.distance?current.current*next.distance/last.distance:current.current,last.x,last.y,dx,dy);last=next;};
    const end=(e:TouchEvent)=>{last=e.touches.length?point(e.touches):null;};
    const click=(e:MouseEvent)=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopPropagation();}};
    el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('touchstart',start,{passive:true});el.addEventListener('touchmove',move,{passive:false});el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);el.addEventListener('click',click,true);
    return()=>{el.removeEventListener('wheel',wheel);el.removeEventListener('touchstart',start);el.removeEventListener('touchmove',move);el.removeEventListener('touchend',end);el.removeEventListener('touchcancel',end);el.removeEventListener('click',click,true);pending.current=null;};
  },[boardId]);
}
