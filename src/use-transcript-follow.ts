import {useLayoutEffect,type RefObject} from 'react';

const scrollGeometry=new WeakMap<HTMLElement,{height:number;content:number}>();
export function transcriptFollowing(element:HTMLElement,previousTop:number,wasFollowing:boolean){
  const previous=scrollGeometry.get(element),height=element.clientHeight,content=element.scrollHeight;
  scrollGeometry.set(element,{height,content});
  // A shrinking draft can clamp scrollTop just before the keyboard resizes the
  // viewport. That backward movement is layout, not a request to read history.
  const resized=previous&&(previous.height!==height||previous.content!==content);
  return content-element.scrollTop-height<80||wasFollowing&&(element.scrollTop>=previousTop-1||!!resized);
}

/** Follow rendered height, including paced letters, images and disclosure changes. */
export function useTranscriptFollow(scroll:RefObject<HTMLDivElement|null>,following:{current:boolean},enabled:boolean,context:string){
  useLayoutEffect(()=>{
    const element=scroll.current,content=element?.querySelector('.conversation-inner');
    if(!enabled||!element||!content)return;
    const follow=()=>{if(following.current&&element.getClientRects().length)element.scrollTop=element.scrollHeight;};
    let touchY:number|undefined;
    const wheel=(event:WheelEvent)=>{if(event.deltaY<0)following.current=false;};
    const start=(event:TouchEvent)=>{touchY=event.touches[0]?.clientY;};
    const move=(event:TouchEvent)=>{const y=event.touches[0]?.clientY;if(y!==undefined&&touchY!==undefined&&y>touchY+2)following.current=false;touchY=y;};
    // Floating controls change scroll padding without changing text content size.
    const observer=new ResizeObserver(follow);observer.observe(content,{box:'border-box'});observer.observe(element);
    element.addEventListener('wheel',wheel,{passive:true});element.addEventListener('touchstart',start,{passive:true});element.addEventListener('touchmove',move,{passive:true});
    follow();
    return()=>{observer.disconnect();element.removeEventListener('wheel',wheel);element.removeEventListener('touchstart',start);element.removeEventListener('touchmove',move);};
  },[scroll,following,enabled,context]);
}
