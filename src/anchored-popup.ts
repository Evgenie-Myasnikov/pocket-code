import {useLayoutEffect,useState,type CSSProperties,type RefObject} from 'react';

/**
 * Viewport position just above an anchor. The chat's bottom overlay scrolls, so a popup placed
 * above a composer control with `position:absolute` is clipped; render it in a portal with this style.
 */
export function useAnchoredPlace(open:boolean,anchor:RefObject<HTMLElement|null>,width:number,align:'left'|'right'='left'):CSSProperties{
  const [place,setPlace]=useState<CSSProperties>({left:8,bottom:80});
  useLayoutEffect(()=>{
    if(!open)return;
    const update=()=>{
      const rect=anchor.current?.getBoundingClientRect();if(!rect)return;
      const room=Math.min(width,innerWidth-16),bottom=Math.max(8,innerHeight-rect.top+8);
      setPlace(align==='right'?{right:Math.max(8,Math.min(innerWidth-rect.right,innerWidth-8-room)),bottom}:{left:Math.max(8,Math.min(rect.left,innerWidth-8-room)),bottom});
    };
    update();
    window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
    return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
  },[open,anchor,width,align]);
  return place;
}
