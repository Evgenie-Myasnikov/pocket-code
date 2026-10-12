import {useLayoutEffect,type RefObject} from 'react';

export function transcriptFollowing(element:HTMLElement,previousTop:number,wasFollowing:boolean){
  return element.scrollHeight-element.scrollTop-element.clientHeight<80||wasFollowing&&element.scrollTop>=previousTop-1;
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
    const observer=new ResizeObserver(follow);observer.observe(content);observer.observe(element);
    element.addEventListener('wheel',wheel,{passive:true});element.addEventListener('touchstart',start,{passive:true});element.addEventListener('touchmove',move,{passive:true});
    follow();
    return()=>{observer.disconnect();element.removeEventListener('wheel',wheel);element.removeEventListener('touchstart',start);element.removeEventListener('touchmove',move);};
  },[scroll,following,enabled,context]);
}
