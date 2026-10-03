import {useEffect,type RefObject} from 'react';
export function useBoardPan(ref:RefObject<HTMLDivElement|null>,boardId?:string){
 useEffect(()=>{const viewport=ref.current;if(!viewport||!boardId)return;
  const start=(event:PointerEvent)=>{if(event.pointerType!=='mouse'||![0,1].includes(event.button)||event.button===0&&(event.target as Element).closest('button,input,select,.board-note,.board-version'))return;event.preventDefault();const x=event.clientX,y=event.clientY,left=viewport.scrollLeft,top=viewport.scrollTop;viewport.setPointerCapture(event.pointerId);viewport.classList.add('board-panning');
   const move=(e:PointerEvent)=>{viewport.scrollLeft=left+x-e.clientX;viewport.scrollTop=top+y-e.clientY;};
   const end=()=>{viewport.classList.remove('board-panning');viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',end);viewport.removeEventListener('pointercancel',end);};
   viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
  };viewport.addEventListener('pointerdown',start);return()=>viewport.removeEventListener('pointerdown',start);
 },[ref,boardId]);
}
